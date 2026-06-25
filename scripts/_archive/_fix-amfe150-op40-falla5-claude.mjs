/**
 * Fix: AMFE 150 OP40 COSTURA UNION — Falla 5 ("Costura no conforme Ancho/longitud")
 * tiene 3 controles con vocabulario tipo Claude. Reescritos con textos dictados
 * por Fak (sesion 2026-05-17).
 *
 * Cambios:
 *
 * detControl (todas las causas de la falla 5):
 *   "Inspeccion de proceso (Humana) por parte del operador o supervisor..."
 *   -> "Autocontrol con regla o calibre de longitud y ancho de puntada"
 *
 * prevControl causa 1 (Ajuste/calibracion incorrecta):
 *   "Implementar Mantenimiento Preventivo y rutina de calibracion de la maquina de coser"
 *   -> "Mantenimiento preventivo y set up de lanzamiento"
 *
 * prevControl causa 3 (Frecuencia de verificacion insuficiente):
 *   "Instruccion de Trabajo que exija al operador la verificacion inicial del patron..."
 *   -> "Verificacion con pieza patron al inicio de turno y tras paradas mayores a 1 hora"
 *
 * Uso:
 *   node scripts/_fix-amfe150-op40-falla5-claude.mjs           # dry-run
 *   node scripts/_fix-amfe150-op40-falla5-claude.mjs --apply
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const AMFE_ID = '37cab669-0543-43c0-bb78-d00638114530';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const read = await readAmfe(sb, AMFE_ID);
if (read.amfe_number !== '150') throw new Error('AMFE number mismatch');

const before = read.doc;
const after = JSON.parse(JSON.stringify(before));

const op = after.operations.find(o => +(o.opNumber || o.operationNumber) === 40);
if (!op) throw new Error('OP40 not found');

const NEW_DET = 'Autocontrol con regla o calibre de longitud y ancho de puntada';
const NEW_PREV_AJUSTE = 'Mantenimiento preventivo y set up de lanzamiento';
const NEW_PREV_FREC = 'Verificación con pieza patrón al inicio de turno y tras paradas mayores a 1 hora';

const RE_FALLA5 = /Costura\s+de\s+uni[oó]n\s+y\s+costura\s+simple\s+NO\s+conforme/i;
const RE_DET_CLAUDE = /Inspecci[oó]n\s+de\s+proceso\s+\(Humana\)\s+por\s+parte\s+del\s+operador\s+o\s+supervisor/i;
const RE_PREV_AJUSTE = /Implementar\s+Mantenimiento\s+Preventivo\s+y\s+rutina\s+de\s+calibraci[oó]n\s+de\s+la\s+m[aá]quina\s+de\s+coser/i;
const RE_PREV_FREC = /Instrucci[oó]n\s+de\s+Trabajo\s+que\s+exija\s+al\s+operador\s+la\s+verificaci[oó]n\s+inicial\s+del\s+patr[oó]n/i;

let touched = 0;
for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
        for (const fl of (fn.failures || [])) {
            if (!RE_FALLA5.test(fl.description || '')) continue;
            for (const c of (fl.causes || [])) {
                const oldDet = c.detectionControl || '';
                const oldPrev = c.preventionControl || '';

                if (RE_DET_CLAUDE.test(oldDet)) {
                    c.detectionControl = NEW_DET;
                    touched++;
                    logChange(apply, `AMFE 150 OP40 falla5 causa "${(c.cause || '').slice(0, 40)}" detControl`,
                        { before: oldDet.slice(0, 70), after: NEW_DET });
                }
                if (RE_PREV_AJUSTE.test(oldPrev)) {
                    c.preventionControl = NEW_PREV_AJUSTE;
                    touched++;
                    logChange(apply, `AMFE 150 OP40 falla5 causa "${(c.cause || '').slice(0, 40)}" prevControl (ajuste)`,
                        { before: oldPrev.slice(0, 70), after: NEW_PREV_AJUSTE });
                }
                if (RE_PREV_FREC.test(oldPrev)) {
                    c.preventionControl = NEW_PREV_FREC;
                    touched++;
                    logChange(apply, `AMFE 150 OP40 falla5 causa "${(c.cause || '').slice(0, 40)}" prevControl (frecuencia)`,
                        { before: oldPrev.slice(0, 70), after: NEW_PREV_FREC });
                }
            }
        }
    }
}

console.log(`\nResumen: ${touched} controles tocados.`);
if (touched === 0) { process.exit(0); }

const plan = [{ id: AMFE_ID, amfeNumber: read.amfe_number, productName: read.row.project_name, before, after }];
await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, AMFE_ID, after, { expectedAmfeNumber: '150' });
    console.log('✓ AMFE 150 actualizado.');
});
finish(apply);
process.exit(0);
