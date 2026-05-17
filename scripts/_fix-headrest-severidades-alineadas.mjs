/**
 * Fix: Alinear severidades de 3 fallas en Headrest entre HF/HRC/HRO segun
 * calibracion Barack (amfe.md lineas 7-12).
 *
 * Sesion soft-snacking-elephant M-review 2026-05-17.
 *
 * Detector comparativo encontro 3 fallas con S inconsistente entre los 3
 * Headrest (productos hermanos). Analisis vs calibracion Barack indica
 * HF (Front) es la version mas madura, HRO outlier en 3 de 3.
 *
 * Correcciones aplicadas (S y AP recalculado con calculateAP):
 *
 * 1. "Puntadas irregulares o arrugas" — S=5-6 segun calibracion (costura torcida)
 *    - HRC: 3 -> 6
 *    - HRO: 8 -> 6
 *
 * 2. "Costura descosida o débil" — S=7-8 segun calibracion (encastre severo)
 *    - HRO: 4 -> 8 (HF y HRC ya en 8)
 *
 * 3. "Pieza con rebaba visible" — S=3-4 segun calibracion (cosmetico menor)
 *    - HRO: 8 -> 3 (HF y HRC ya en 3)
 *
 * Decision Fak 2026-05-17: alinear los 3 segun calibracion Barack.
 *
 * Uso:
 *   node scripts/_fix-headrest-severidades-alineadas.mjs           # dry-run
 *   node scripts/_fix-headrest-severidades-alineadas.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe, calculateAP } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const ALIGNMENTS = [
    {
        amfe: 'AMFE-HRC-PAT',
        failureRe: /puntadas\s+irregulares\s+o\s+arrugas/i,
        newSeverity: 6,
    },
    {
        amfe: 'AMFE-HRO-PAT',
        failureRe: /puntadas\s+irregulares\s+o\s+arrugas/i,
        newSeverity: 6,
    },
    {
        amfe: 'AMFE-HRO-PAT',
        failureRe: /costura\s+descosida\s+o\s+d[eé]bil/i,
        newSeverity: 8,
    },
    {
        amfe: 'AMFE-HRO-PAT',
        failureRe: /pieza\s+con\s+rebaba\s+visible/i,
        newSeverity: 3,
    },
];

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);

const cache = new Map();
async function loadDoc(amfeNumber) {
    if (cache.has(amfeNumber)) return cache.get(amfeNumber);
    const meta = all.find(a => a.amfe_number === amfeNumber);
    if (!meta) throw new Error(`AMFE not found: ${amfeNumber}`);
    const read = await readAmfe(sb, meta.id);
    const entry = { meta, read, before: read.doc, after: JSON.parse(JSON.stringify(read.doc)) };
    cache.set(amfeNumber, entry);
    return entry;
}

let totalCausesTouched = 0;
for (const al of ALIGNMENTS) {
    const entry = await loadDoc(al.amfe);
    let found = false;
    for (const op of (entry.after.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fl of (fn.failures || [])) {
                    if (!al.failureRe.test(fl.description || '')) continue;
                    found = true;
                    for (const c of (fl.causes || [])) {
                        const oldS = c.severity;
                        if (oldS === al.newSeverity) continue;
                        const oldAP = c.ap || c.actionPriority;
                        c.severity = al.newSeverity;
                        const newAP = calculateAP(al.newSeverity, c.occurrence, c.detection);
                        c.ap = newAP;
                        c.actionPriority = newAP;

                        // Si AP nuevo es H y no hay accion ni placeholder, agregar placeholder
                        // (regla amfe-aph-pending.md)
                        let placeholderAdded = false;
                        if (newAP === 'H') {
                            const optAct = String(c.optimizationAction || '').trim();
                            const prevAct = String(c.preventionAction || '').trim();
                            const detAct = String(c.detectionAction || '').trim();
                            if (!optAct && !prevAct && !detAct) {
                                c.optimizationAction = 'Pendiente definición equipo APQP';
                                placeholderAdded = true;
                            }
                        }

                        totalCausesTouched++;
                        logChange(apply,
                            `${al.amfe} OP${op.opNumber || op.operationNumber} "${(fl.description || '').slice(0, 40)}" causa "${(c.cause || '').slice(0, 40)}"`,
                            {
                                S: `${oldS}->${al.newSeverity}`,
                                AP: `${oldAP}->${newAP}`,
                                ...(placeholderAdded ? { placeholder: 'agregado en optimizationAction' } : {}),
                            }
                        );
                    }
                }
            }
        }
    }
    if (!found) console.warn(`SKIP: failure no encontrada en ${al.amfe} con ${al.failureRe}`);
}

console.log(`\nResumen: ${totalCausesTouched} causas tocadas en ${cache.size} AMFEs.`);
if (totalCausesTouched === 0) { process.exit(0); }

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

await runWithValidation(plan, apply, async () => {
    for (const p of plan) {
        await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
        console.log(`  ✓ ${p.amfeNumber} actualizado.`);
    }
});

finish(apply);
process.exit(0);
