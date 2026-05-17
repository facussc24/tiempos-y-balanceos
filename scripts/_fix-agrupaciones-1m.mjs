/**
 * Fix: 3 WEs con agrupacion "/" que viola regla 1M por linea (rules/amfe.md)
 *
 * Sesion soft-snacking-elephant 2026-05-17.
 *
 * 1. MAESTRO-LOG-REC OP10 "Aspirador / Sistema de alimentacion de pellet"
 *    -> renombrar a "Aspirador (sistema de alimentacion de pellet)" (cosmetico,
 *       es UN solo equipo descrito con alias).
 *
 * 2. VWA-PAT-IPPADS-001 OP70 ADHESIVADO "Pistola de adhesivado / Rodillo"
 *    -> renombrar a "Pistola de adhesivado". Las 4 fallas actuales son del
 *       proceso de adhesivado y se mantienen. NO se crea WE nuevo para
 *       rodillo (regla amfe-no-inventar: no crear fallas inventadas).
 *
 * 3. 150 (Armrest Rear Center) OP20 CORTE "Cinta metrica / Calibre"
 *    -> desglosar en 2 WEs separados. WE actual sin fallas, asi que solo
 *       se duplica la estructura sin inventar contenido.
 *
 * Uso:
 *   node scripts/_fix-agrupaciones-1m.mjs           # dry-run
 *   node scripts/_fix-agrupaciones-1m.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);
const byNumber = Object.fromEntries(all.map(a => [a.amfe_number, a]));

const cache = new Map();
async function loadDoc(amfeNumber) {
    if (cache.has(amfeNumber)) return cache.get(amfeNumber);
    const meta = byNumber[amfeNumber];
    if (!meta) throw new Error(`AMFE not found: ${amfeNumber}`);
    const read = await readAmfe(sb, meta.id);
    const entry = { meta, read, before: read.doc, after: JSON.parse(JSON.stringify(read.doc)) };
    cache.set(amfeNumber, entry);
    return entry;
}

// === FIX #1: MAESTRO-LOG OP10 Aspirador ===
{
    const entry = await loadDoc('AMFE-MAESTRO-LOG-REC-001');
    const op = entry.after.operations.find(o => +(o.opNumber || o.operationNumber) === 10);
    const we = op?.workElements?.find(w => /^Aspirador\s*\/\s*Sistema/i.test(w.name || ''));
    if (we) {
        const oldName = we.name;
        we.name = 'Aspirador (sistema de alimentación de pellet)';
        logChange(apply, `#1 MAESTRO-LOG OP10 WE rename`, { before: oldName, after: we.name });
    } else {
        console.warn('#1 SKIP: WE no encontrado en MAESTRO-LOG OP10');
    }
}

// === FIX #2: IP-PADS OP70 Pistola/Rodillo ===
{
    const entry = await loadDoc('VWA-PAT-IPPADS-001');
    const op = entry.after.operations.find(o => +(o.opNumber || o.operationNumber) === 70);
    const we = op?.workElements?.find(w => /Pistola\s+de\s+adhesivado\s*\/\s*Rodillo/i.test(w.name || ''));
    if (we) {
        const oldName = we.name;
        we.name = 'Pistola de adhesivado';
        logChange(apply, `#2 IP-PADS OP70 WE rename`, { before: oldName, after: we.name });
    } else {
        console.warn('#2 SKIP: WE no encontrado en IP-PADS OP70');
    }
}

// === FIX #3: 150 OP20 Cinta metrica / Calibre — desglosar en 2 WEs ===
{
    const entry = await loadDoc('150');
    const op = entry.after.operations.find(o => +(o.opNumber || o.operationNumber) === 20);
    const idx = op?.workElements?.findIndex(w => /Cinta\s+m[eé]trica\s*\/\s*Calibre/i.test(w.name || ''));
    if (idx >= 0) {
        const we = op.workElements[idx];
        const hasFailures = (we.functions || []).some(fn => (fn.failures || []).length > 0);
        if (hasFailures) {
            console.warn('#3 SKIP: WE tiene failures — desglose requiere reasignar manualmente');
        } else {
            const baseFn = (we.functions && we.functions[0]) || {};
            const weCinta = {
                ...JSON.parse(JSON.stringify(we)),
                name: 'Cinta métrica',
                functions: [{
                    ...JSON.parse(JSON.stringify(baseFn)),
                    description: 'Medir longitudes generales con cinta métrica según patrón de corte',
                    functionDescription: 'Medir longitudes generales con cinta métrica según patrón de corte',
                    failures: [],
                }],
            };
            const weCalibre = {
                ...JSON.parse(JSON.stringify(we)),
                name: 'Calibre',
                functions: [{
                    ...JSON.parse(JSON.stringify(baseFn)),
                    description: 'Medir dimensiones precisas (espesores, anchos) con calibre',
                    functionDescription: 'Medir dimensiones precisas (espesores, anchos) con calibre',
                    failures: [],
                }],
            };
            op.workElements.splice(idx, 1, weCinta, weCalibre);
            logChange(apply, `#3 150 OP20 WE split`, {
                from: 'Cinta metrica / Calibre',
                to: 'Cinta métrica + Calibre (2 WEs separados, type=Measurement c/u)',
            });
        }
    } else {
        console.warn('#3 SKIP: WE no encontrado en 150 OP20');
    }
}

// Build plan
const plan = [];
for (const [, entry] of cache) {
    if (JSON.stringify(entry.before) === JSON.stringify(entry.after)) continue;
    plan.push({
        id: entry.meta.id,
        amfeNumber: entry.meta.amfe_number,
        productName: entry.read.row.project_name,
        before: entry.before,
        after: entry.after,
    });
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
