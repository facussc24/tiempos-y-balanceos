/**
 * Fix: AMFE 150 OP40 COSTURA UNION — Fallas 7 y 8 con vocabulario Claude.
 *
 * Aplicando los mismos patrones validados por Fak en Fallas 5 y 6:
 * - Sacar parametros numericos de la description (van al CP, no AMFE)
 * - Cambiar "Inspeccion Humana" / "Inspeccion de proceso (Humana)" por autocontrol
 * - Cambiar "Mantenimiento Preventivo y rutina de Calibracion" por "Mant. preventivo + set up"
 * - Cambiar "Instruccion de Trabajo (IT) visual" por "Hoja de operacion" o "Guia"
 *
 * FALLA 7 — "Longitud de puntada fuera de especificacion 4 puntadas/16 mm ±1 mm (Dobladillo)"
 *   description: -> "Longitud de puntada fuera de especificacion (Dobladillo)"
 *   detControl: "Inspeccion de proceso (Humana) por operador..."
 *     -> "Autocontrol con regla o calibre de longitud de puntada"
 *   prevControl: "Mantenimiento Preventivo y rutina de Calibracion del mecanismo..."
 *     -> "Mantenimiento preventivo del mecanismo de arrastre + set up de lanzamiento"
 *
 * FALLA 8 — "Hilo superior / inferior no conforme a la especificacion" (sin params, OK)
 *   detControl: "Inspeccion Humana (Visual) del hilo instalado..."
 *     -> "Autocontrol visual del hilo instalado y verificacion con muestra patron al inicio del lote"
 *   prevControl: "Instruccion de Trabajo (IT) visual clara para la identificacion del material..."
 *     -> "Hoja de operacion con identificacion visual del hilo correcto"
 *
 * Sesion soft-snacking-elephant 2026-05-17.
 *
 * Uso:
 *   node scripts/_fix-amfe150-op40-fallas-7y8-claude.mjs           # dry-run
 *   node scripts/_fix-amfe150-op40-fallas-7y8-claude.mjs --apply
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

// FALLA 7
const RE_F7_DESC = /Longitud\s+de\s+puntada\s+fuera\s+de\s+especificaci[oó]n\s+\d+\s+puntadas\s*\/\s*\d+\s*mm/i;
const F7_NEW_DESC = 'Longitud de puntada fuera de especificación (Dobladillo)';
const RE_F7_DET = /Inspecci[oó]n\s+de\s+proceso\s+\(Humana\)\s+por\s+operador/i;
const F7_NEW_DET = 'Autocontrol con regla o calibre de longitud de puntada';
const RE_F7_PREV = /Mantenimiento\s+Preventivo\s+y\s+rutina\s+de\s+Calibraci[oó]n\s+del\s+mecanismo/i;
const F7_NEW_PREV = 'Mantenimiento preventivo del mecanismo de arrastre + set up de lanzamiento';

// FALLA 8
const RE_F8_DESC = /Hilo\s+superior\s*\/\s*inferior\s+no\s+conforme/i;
const RE_F8_DET = /Inspecci[oó]n\s+Humana\s+\(Visual\)\s+del\s+hilo\s+instalado/i;
const F8_NEW_DET = 'Autocontrol visual del hilo instalado y verificación con muestra patrón al inicio del lote';
const RE_F8_PREV = /Instrucci[oó]n\s+de\s+Trabajo\s+\(IT\)\s+visual\s+clara\s+para\s+la\s+identificaci[oó]n/i;
const F8_NEW_PREV = 'Hoja de operación con identificación visual del hilo correcto';

let touched = 0;
for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
        for (const fl of (fn.failures || [])) {
            const desc = fl.description || '';

            if (RE_F7_DESC.test(desc)) {
                logChange(apply, `AMFE 150 OP40 falla7 description`, { before: desc, after: F7_NEW_DESC });
                fl.description = F7_NEW_DESC;
                touched++;
                for (const c of (fl.causes || [])) {
                    if (RE_F7_DET.test(c.detectionControl || '')) {
                        logChange(apply, `AMFE 150 OP40 falla7 causa "${(c.cause||'').slice(0,40)}" detControl`,
                            { before: c.detectionControl.slice(0, 70), after: F7_NEW_DET });
                        c.detectionControl = F7_NEW_DET; touched++;
                    }
                    if (RE_F7_PREV.test(c.preventionControl || '')) {
                        logChange(apply, `AMFE 150 OP40 falla7 causa "${(c.cause||'').slice(0,40)}" prevControl`,
                            { before: c.preventionControl.slice(0, 70), after: F7_NEW_PREV });
                        c.preventionControl = F7_NEW_PREV; touched++;
                    }
                }
            }

            if (RE_F8_DESC.test(desc)) {
                for (const c of (fl.causes || [])) {
                    if (RE_F8_DET.test(c.detectionControl || '')) {
                        logChange(apply, `AMFE 150 OP40 falla8 causa "${(c.cause||'').slice(0,40)}" detControl`,
                            { before: c.detectionControl.slice(0, 70), after: F8_NEW_DET });
                        c.detectionControl = F8_NEW_DET; touched++;
                    }
                    if (RE_F8_PREV.test(c.preventionControl || '')) {
                        logChange(apply, `AMFE 150 OP40 falla8 causa "${(c.cause||'').slice(0,40)}" prevControl`,
                            { before: c.preventionControl.slice(0, 70), after: F8_NEW_PREV });
                        c.preventionControl = F8_NEW_PREV; touched++;
                    }
                }
            }
        }
    }
}

console.log(`\nResumen: ${touched} cambios.`);
if (touched === 0) { process.exit(0); }

const plan = [{ id: AMFE_ID, amfeNumber: read.amfe_number, productName: read.row.project_name, before, after }];
await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, AMFE_ID, after, { expectedAmfeNumber: '150' });
    console.log('✓ AMFE 150 actualizado.');
});
finish(apply);
process.exit(0);
