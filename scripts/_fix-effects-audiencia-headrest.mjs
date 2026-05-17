/**
 * Fix: HF-PAT + HRC-PAT + HRO-PAT — failures con effects llenos con
 * "Cliente Interno-Barack" / "Cliente Externo" / "TBD" (audiencia, no efecto).
 *
 * Sesion soft-snacking-elephant 2026-05-17.
 *
 * VDA 2019 exige texto descriptivo del efecto en effectLocal/NextLevel/EndUser.
 * Los 3 Headrest tienen 64 failures con audiencia copiada en lugar de
 * descripcion. 55/64 tienen failure description identica o similar en otros
 * AMFEs Barack con efectos correctamente descritos -> reusar.
 *
 * Logica:
 * - Para cada failure en HF/HRC/HRO con audiencia/TBD en algun nivel:
 *   - Buscar la mejor match (similaridad >= 0.6) en otros AMFEs
 *   - Si los 3 niveles del match son validos (no audiencia, no TBD, >=10 chars):
 *     - Copiar los 3 niveles al failure target
 *   - Solo sobrescribir niveles que ESTEN con audiencia/TBD (no tocar lo bueno)
 *
 * Uso:
 *   node scripts/_fix-effects-audiencia-headrest.mjs           # dry-run
 *   node scripts/_fix-effects-audiencia-headrest.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const TARGETS = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const SIM_THRESHOLD = 0.6;

function normalize(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function tokens(s) {
    return new Set(normalize(s).split(/\s+/).filter(w => w.length > 3));
}
function similarity(a, b) {
    const ta = tokens(a), tb = tokens(b);
    if (!ta.size || !tb.size) return 0;
    if (normalize(a) === normalize(b)) return 1.0;
    let c = 0;
    for (const w of ta) if (tb.has(w)) c++;
    return c / Math.max(ta.size, tb.size);
}
function isAudienceOrEmpty(s) {
    const n = normalize(s);
    if (!n || n === 'tbd' || n.startsWith('tbd')) return true;
    return /^cliente\s+(interno|externo)/i.test(s || '');
}
function isGoodEffect(s) {
    const n = normalize(s);
    if (!n || n === 'tbd' || n.startsWith('tbd')) return false;
    if (/^cliente\s+(interno|externo)/i.test(s || '')) return false;
    return n.length >= 10;
}

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);
const byNumber = Object.fromEntries(all.map(a => [a.amfe_number, a]));

// Build index of all AMFEs (read once)
const fullDocs = {};
for (const m of all) {
    const r = await readAmfe(sb, m.id);
    fullDocs[m.amfe_number] = { meta: m, doc: r.doc, projectName: r.row.project_name };
}

// Build index of "good" failures (3 niveles validos)
const goodIndex = [];
for (const [amfeNum, entry] of Object.entries(fullDocs)) {
    for (const op of (entry.doc.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fl of (fn.failures || [])) {
                    if (isGoodEffect(fl.effectLocal) && isGoodEffect(fl.effectNextLevel) && isGoodEffect(fl.effectEndUser)) {
                        goodIndex.push({
                            amfe: amfeNum,
                            opName: op.name || op.operationName || '',
                            failure: fl.description || '',
                            el: fl.effectLocal,
                            en: fl.effectNextLevel,
                            eu: fl.effectEndUser,
                        });
                    }
                }
            }
        }
    }
}
console.log(`Index: ${goodIndex.length} failures con 3 efectos validos.`);

// Apply fixes
const plan = [];
for (const tgtNumber of TARGETS) {
    const entry = fullDocs[tgtNumber];
    if (!entry) { console.warn(`SKIP ${tgtNumber}`); continue; }
    const before = entry.doc;
    const after = JSON.parse(JSON.stringify(before));

    let touched = 0;
    for (const op of (after.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fl of (fn.failures || [])) {
                    const elBad = isAudienceOrEmpty(fl.effectLocal);
                    const enBad = isAudienceOrEmpty(fl.effectNextLevel);
                    const euBad = isAudienceOrEmpty(fl.effectEndUser);
                    if (!elBad && !enBad && !euBad) continue;

                    // Buscar match
                    const matches = goodIndex
                        .filter(g => g.amfe !== tgtNumber)
                        .map(g => ({ ...g, sim: similarity(g.failure, fl.description || '') }))
                        .filter(g => g.sim >= SIM_THRESHOLD)
                        .sort((a, b) => b.sim - a.sim);

                    if (matches.length === 0) continue;
                    const m = matches[0];

                    let changes = [];
                    if (elBad) { fl.effectLocal = m.el; changes.push('EL'); }
                    if (enBad) { fl.effectNextLevel = m.en; changes.push('EN'); }
                    if (euBad) { fl.effectEndUser = m.eu; changes.push('EU'); }
                    if (changes.length === 0) continue;

                    touched++;
                    if (touched <= 5) {
                        logChange(apply,
                            `${tgtNumber} OP${op.opNumber || op.operationNumber} "${(fl.description || '').slice(0, 50)}" <- ${m.amfe} sim=${m.sim.toFixed(2)}`,
                            { campos: changes.join(','), EL: m.el.slice(0, 50), EN: m.en.slice(0, 50), EU: m.eu.slice(0, 50) }
                        );
                    }
                }
            }
        }
    }

    console.log(`  ${tgtNumber}: ${touched} failures con efectos actualizados.`);

    if (touched > 0) {
        plan.push({
            id: entry.meta.id,
            amfeNumber: tgtNumber,
            productName: entry.projectName,
            before,
            after,
        });
    }
}

console.log(`\nResumen: ${plan.length} AMFEs con cambios.`);
if (plan.length === 0) { process.exit(0); }

await runWithValidation(plan, apply, async () => {
    for (const p of plan) {
        await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
        console.log(`  ✓ ${p.amfeNumber} actualizado.`);
    }
});

finish(apply);
process.exit(0);
