/**
 * Fix: 5 patrones de fallas en Headrest (HF/HRC/HRO) con efectos pendientes
 * (audiencia o TBD) reescritos con texto descriptivo validado por Fak.
 *
 * Sesion soft-snacking-elephant 2026-05-17.
 *
 * Patron A — Desviacion en corte de pliegos (OP corte de paneles/vinilo)
 *   - HF OP20, HRC OP20, HRO OP20
 * Patron B — Inserto EPP mal posicionado (OP enfundado)
 *   - HF OP50
 * Patron C — Varilla desalineada (OP insercion varilla)
 *   - HF OP51, HRC OP70, HRO OP70
 * Patron D — Tiempo de presion inadecuado (OP inyeccion PU)
 *   - HF OP63
 * Patron E — Pieza fuera de peso especificado (OP inyeccion PU)
 *   - HF OP63, HRC OP50, HRO OP50
 *
 * Logica: solo sobrescribir niveles que tengan audiencia ("Cliente Interno/Externo")
 * o TBD. NO tocar niveles que ya tengan texto descriptivo valido.
 *
 * Uso:
 *   node scripts/_fix-headrest-effects-5patterns.mjs           # dry-run
 *   node scripts/_fix-headrest-effects-5patterns.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const TARGETS = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];

function normalize(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function isAudienceOrEmpty(s) {
    const n = normalize(s);
    if (!n || n === 'tbd' || n.startsWith('tbd')) return true;
    return /^cliente\s+(interno|externo)/i.test(s || '');
}

// Cada patron: regex de failure description + 3 textos nuevos
const PATTERNS = [
    {
        id: 'A',
        re: /desviaci[oó]n\s+en\s+el\s+corte\s+de\s+los\s+pliegos/i,
        el: 'Material cortado descartado como SCRAP, no recuperable',
        en: 'Detección en costura, parada de línea hasta segregar lote y ajustar parámetros de corte',
        eu: 'Defecto estético perceptible (corte irregular visible en componentes del Headrest)',
    },
    {
        id: 'B',
        re: /inserto\s+EPP\s+mal\s+posicionado/i,
        el: 'Funda mal armada, retrabajo de re-enfundado offline',
        en: 'Pieza con geometría fuera de tolerancia detectada en control final',
        eu: 'Headrest con forma irregular, posible reclamo estético',
    },
    {
        id: 'C',
        re: /varilla\s+desalineada/i,
        el: 'Fuga de PU durante espumado, scrap del conjunto',
        en: 'Pieza scrap, parada hasta recalibrar herramental',
        eu: 'Riesgo de seguridad: varilla mal anclada puede zafarse en uso del Headrest',
    },
    {
        id: 'D',
        re: /tiempo\s+de\s+presi[oó]n\s+inadecuado/i,
        el: 'Pieza con densidad fuera de spec, scrap',
        en: 'Lote afectado scrap, retención hasta validar nuevo set-up',
        eu: 'Riesgo de seguridad: confort/firmeza inadecuada del Headrest',
    },
    {
        id: 'E',
        re: /pieza\s+fuera\s+de\s+peso\s+especificado/i,
        el: 'Pieza scrap por densidad incorrecta',
        en: 'Detección en pesaje 100%, segregación del lote afectado',
        eu: 'Afecta confort/firmeza del Headrest, posible reclamo de calidad',
    },
];

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);

const plan = [];
for (const tnum of TARGETS) {
    const meta = all.find(a => a.amfe_number === tnum);
    if (!meta) { console.warn(`SKIP ${tnum}`); continue; }
    const read = await readAmfe(sb, meta.id);
    const before = read.doc;
    const after = JSON.parse(JSON.stringify(before));

    let touched = 0;
    for (const op of (after.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fl of (fn.failures || [])) {
                    const desc = fl.description || '';
                    for (const p of PATTERNS) {
                        if (!p.re.test(desc)) continue;
                        const elBad = isAudienceOrEmpty(fl.effectLocal);
                        const enBad = isAudienceOrEmpty(fl.effectNextLevel);
                        const euBad = isAudienceOrEmpty(fl.effectEndUser);
                        if (!elBad && !enBad && !euBad) break; // already good
                        const changes = [];
                        if (elBad) { fl.effectLocal = p.el; changes.push('EL'); }
                        if (enBad) { fl.effectNextLevel = p.en; changes.push('EN'); }
                        if (euBad) { fl.effectEndUser = p.eu; changes.push('EU'); }
                        if (changes.length > 0) {
                            touched++;
                            logChange(apply,
                                `${tnum} OP${op.opNumber || op.operationNumber} [Patron ${p.id}] "${desc.slice(0, 50)}"`,
                                { campos: changes.join(',') }
                            );
                        }
                        break;
                    }
                }
            }
        }
    }

    console.log(`  ${tnum}: ${touched} failures actualizadas.`);
    if (touched > 0) {
        plan.push({
            id: meta.id,
            amfeNumber: tnum,
            productName: read.row.project_name,
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
