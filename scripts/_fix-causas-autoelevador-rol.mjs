/**
 * Fix: 15 causas en WE "Autoelevador" (Machine) que hablaban del proveedor
 * (estiba, embalaje, transporte previo) reescritas para reflejar el rol REAL
 * del autoelevador en Barack (operador que recibe, maniobra, almacena).
 *
 * Sesion soft-snacking-elephant 2026-05-17.
 *
 * 7 AMFEs OP10 Recepcion con WE Autoelevador:
 *   150, AMFE-INS-PAT, AMFE-HF-PAT, AMFE-ARM-PAT, AMFE-HRC-PAT, AMFE-TR-PAT, AMFE-HRO-PAT
 *
 * Reescrituras:
 *   - "Mala estiba y embalaje inadecuado"
 *     -> "Operador del autoelevador no detecta embalaje dañado al recibir el material"
 *   - "Manipulación incorrecta en tránsito"
 *     -> "Operador del autoelevador maniobra brusco durante traslado interno del material"
 *   - "Almacenaje inadecuado en transporte (sin protecciones)"
 *     -> "Operador del autoelevador deposita material sin protecciones (lonas/cunas) durante el almacenaje"
 *
 * Decision Fak 2026-05-17: detector M-CAUSE-TYPE-MISMATCH encontro estas
 * 15 causas como Man-en-Machine. Fak eligio "reescribir para reflejar el rol
 * del autoelevador" (no mover a WE distinto).
 *
 * Uso:
 *   node scripts/_fix-causas-autoelevador-rol.mjs           # dry-run
 *   node scripts/_fix-causas-autoelevador-rol.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const REWRITES = [
    {
        match: /^Mala\s+estiba\s+y\s+embalaje\s+inadecuado/i,
        to: 'Operador del autoelevador no detecta embalaje dañado al recibir el material',
    },
    {
        match: /^Manipulaci[oó]n\s+incorrecta\s+en\s+tr[aá]nsito/i,
        to: 'Operador del autoelevador maniobra brusco durante traslado interno del material',
    },
    {
        match: /^Almacenaje\s+inadecuado\s+en\s+transporte/i,
        to: 'Operador del autoelevador deposita material sin protecciones (lonas/cunas) durante el almacenaje',
    },
];

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);

const plan = [];
for (const m of all) {
    const { doc, row } = await readAmfe(sb, m.id);
    const before = doc;
    const after = JSON.parse(JSON.stringify(before));

    let touched = 0;
    for (const op of (after.operations || [])) {
        for (const we of (op.workElements || [])) {
            if (we.type !== 'Machine') continue;
            if (!/Autoelevador/i.test(we.name || '')) continue;
            for (const fn of (we.functions || [])) {
                for (const fl of (fn.failures || [])) {
                    for (const c of (fl.causes || [])) {
                        const oldTxt = c.cause || c.description || '';
                        for (const rw of REWRITES) {
                            if (!rw.match.test(oldTxt)) continue;
                            c.cause = rw.to;
                            c.description = rw.to;
                            touched++;
                            logChange(apply,
                                `${m.amfe_number} OP${op.opNumber || op.operationNumber} WE Autoelevador`,
                                { before: oldTxt.slice(0, 60), after: rw.to.slice(0, 70) }
                            );
                            break;
                        }
                    }
                }
            }
        }
    }

    if (touched > 0) {
        plan.push({
            id: m.id,
            amfeNumber: m.amfe_number,
            productName: row.project_name,
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
