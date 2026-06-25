/**
 * Fix: 3 fallas en Headrest OP20 con effectLocal "retrabajo" cuando
 * corresponde "SCRAP" (regla amfe.md "Calibracion de efectos: corte = SCRAP").
 *
 * Detectado por check CUTTING_EFFECT_REWORK_SUSPECT recien agregado al
 * amfeValidator.mjs (sesion soft-snacking-elephant 2026-05-17).
 *
 * Fallas afectadas:
 * - AMFE-HF-PAT OP20 OP 20-26 CORTE DE VINILO — "Contaminacion del material durante el corte..."
 * - AMFE-HRC-PAT OP20 CORTE DE PANELES — idem
 * - AMFE-HRO-PAT OP20 CORTE DE PANELES — idem
 *
 * Texto actual effectLocal: "Retrabajo de una porción de la producción." (copiado de AMFE 150)
 * Texto correcto: "Material contaminado descartado como SCRAP, no recuperable"
 *
 * Uso:
 *   node scripts/_fix-contaminacion-corte-scrap.mjs           # dry-run
 *   node scripts/_fix-contaminacion-corte-scrap.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const TARGETS = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const FAILURE_PATTERN = /contaminaci[oó]n.+(durante\s+el\s+corte|del\s+material\s+durante)/i;
const NEW_EL = 'Material contaminado descartado como SCRAP, no recuperable';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);

const plan = [];
for (const tnum of TARGETS) {
    const meta = all.find(a => a.amfe_number === tnum);
    if (!meta) continue;
    const read = await readAmfe(sb, meta.id);
    const before = read.doc;
    const after = JSON.parse(JSON.stringify(before));

    let touched = 0;
    for (const op of (after.operations || [])) {
        if (!/CORTE/i.test(op.name || op.operationName || '')) continue;
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fl of (fn.failures || [])) {
                    if (!FAILURE_PATTERN.test(fl.description || '')) continue;
                    if (!/retrabajo/i.test(fl.effectLocal || '')) continue;
                    const oldEL = fl.effectLocal;
                    fl.effectLocal = NEW_EL;
                    touched++;
                    logChange(apply,
                        `${tnum} OP${op.opNumber || op.operationNumber} "${(fl.description || '').slice(0, 50)}"`,
                        { before: oldEL.slice(0, 70), after: NEW_EL }
                    );
                }
            }
        }
    }

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
