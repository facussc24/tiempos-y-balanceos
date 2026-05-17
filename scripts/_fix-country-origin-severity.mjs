/**
 * Fix: Severidad subcalibrada en "Pais de origen ausente o incorrecto"
 *
 * Detector D-SOD encontro 3 causas (en 3 Headrest) con S=5 cuando el efecto
 * end-user dice "Incumplimiento legal declaracion origen" (= retencion aduanera
 * en cliente, problema legal). Calibracion amfe.md indica que falla con
 * implicancia legal en cliente debe ser S>=7. Fak confirmo subir a 7.
 *
 * Tambien recalcula AP con calculateAP(s,o,d) y actualiza el alias actionPriority.
 *
 * Uso:
 *   node scripts/_fix-country-origin-severity.mjs            # dry-run
 *   node scripts/_fix-country-origin-severity.mjs --apply    # ejecuta
 */
import { connectSupabase, readAmfe, saveAmfe, calculateAP } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const NEW_SEVERITY = 7;
const FAILURE_DESC_MATCH = /pais\s+de\s+origen/i;

const TARGETS = [
    { amfe: 'AMFE-HF-PAT',  id: '10eaebce-ad87-4035-9343-3e20e4ee0fc9' },
    { amfe: 'AMFE-HRC-PAT', id: 'e9320798-ceaa-4623-97e9-92200b5234b6' },
    { amfe: 'AMFE-HRO-PAT', id: 'beda6d47-30ae-4d5f-81e0-468be8950014' },
];

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const plan = [];

for (const t of TARGETS) {
    const read = await readAmfe(sb, t.id);
    if (read.amfe_number !== t.amfe) {
        throw new Error(`AMFE number mismatch for ${t.id}: expected ${t.amfe}, got ${read.amfe_number}`);
    }
    const before = read.doc;
    const after = JSON.parse(JSON.stringify(before));

    let touchedHere = 0;
    after.operations.forEach((op, oi) => {
        const opName = (op.name || op.operationName || '').toUpperCase();
        if (!opName.includes('EMBALAJE')) return;

        op.workElements.forEach((we, wi) => {
            we.functions.forEach((fn, fi) => {
                fn.failures.forEach((fl, li) => {
                    if (!FAILURE_DESC_MATCH.test(fl.description || '')) return;

                    (fl.causes || []).forEach((c, ci) => {
                        const oldS = c.severity;
                        const oldAP = c.ap || c.actionPriority;
                        if (oldS == null || oldS >= NEW_SEVERITY) {
                            console.log(`  SKIP ${t.amfe} op${oi} fl${li} c${ci} — S=${oldS} ya >= ${NEW_SEVERITY}`);
                            return;
                        }
                        c.severity = NEW_SEVERITY;
                        const newAP = calculateAP(NEW_SEVERITY, c.occurrence, c.detection);
                        c.ap = newAP;
                        c.actionPriority = newAP;
                        touchedHere++;
                        logChange(apply,
                            `${t.amfe} op${op.opNumber || op.operationNumber} ${(op.name || op.operationName || '').slice(0, 30)} | causa "${(c.cause || c.description || '').slice(0, 50)}"`,
                            { S: `${oldS} -> ${NEW_SEVERITY}`, AP: `${oldAP} -> ${newAP}` }
                        );
                    });
                });
            });
        });
    });

    if (touchedHere > 0) {
        plan.push({
            id: t.id,
            amfeNumber: read.amfe_number,
            productName: read.row.project_name,
            before,
            after,
        });
    }
}

console.log(`\nResumen: ${plan.length} AMFEs con cambios.`);
if (plan.length === 0) { console.log('Nada que cambiar.'); process.exit(0); }

await runWithValidation(plan, apply, async () => {
    for (const p of plan) {
        await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
        console.log(`  ✓ ${p.amfeNumber} actualizado.`);
    }
});

finish(apply);
process.exit(0);
