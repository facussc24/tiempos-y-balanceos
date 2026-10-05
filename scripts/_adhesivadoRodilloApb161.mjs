/**
 * _adhesivadoRodilloApb161.mjs — en el AMFE del APB de puerta (AMFE-ARM-PAT, 161) la OP 80 ADHESIVADO
 * se hace en la LINEA HOT MELT, con rodillo (Fak, 05/10/2026: "con la hotmelera, o sea rodillo...
 * hotmelt es rodillo siempre"). El AMFE tenia el elemento "Pistola de adhesivado" con una causa de
 * boquilla y atomizacion, que no corresponde a esa maquina.
 *
 *   node scripts/_adhesivadoRodilloApb161.mjs            # dry-run
 *   node scripts/_adhesivadoRodilloApb161.mjs --apply    # escribe (pasa por runWithValidation)
 *
 * QUE CAMBIA (solo eso; el resto de la OP 80 queda igual)
 *   - WE "Pistola de adhesivado" -> "Línea de Adhesivado Hot Melt" (el nombre del AMFE del Top Roll,
 *     AMFE-TR-PAT OP 20, misma maquina).
 *   - La causa "Boquilla de pistola obstruida o presion de atomizacion descalibrada" pasa a la del Top
 *     Roll: "Temperatura de rodillo fuera de rango o rodillos sucios", con su prevencion y su deteccion
 *     y su O=3 y D=7. La S es la del modo de falla (no se toca). AP por calculateAP. La sigla queda como
 *     estaba si S y O la siguen sosteniendo; si no, se informa.
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe, findOperation, calculateAP, syncLegacyFmFields, syncFieldAliases } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const NUMERO = 'AMFE-ARM-PAT';
const FECHA = '05/10/2026';
const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const fila = (await listAmfes(sb)).filter(a => a.amfe_number === NUMERO);
if (fila.length !== 1) throw new Error(`${NUMERO}: esperaba 1 documento`);
const ID = fila[0].id;
const { doc: before } = await readAmfe(sb, ID);
const after = structuredClone(before);
const op = findOperation(after, '80');
if (!op || !/ADHESIVADO/i.test(op.name)) throw new Error('no encuentro la OP 80 ADHESIVADO');
const we = (op.workElements ?? []).find(w => /pistola/i.test(w.name));
if (!we) { console.log('La OP 80 ya no tiene "Pistola": nada para hacer.'); process.exit(0); }

console.log(`WE: "${we.name}" -> "Línea de Adhesivado Hot Melt"`);
we.name = 'Línea de Adhesivado Hot Melt';
let n = 0;
for (const f of we.functions ?? []) {
    if (/pistol|pulveriz/i.test(f.description)) {
        console.log(`  fn: "${f.description}" (menciona pistola: revisar)`);
    }
    for (const fm of f.failures ?? []) {
        for (const c of fm.causes ?? []) {
            if (!/boquilla|atomiz/i.test(c.cause)) continue;
            const S = Number(fm.severity) || Number(c.severity);
            const antes = `${c.cause} | O${c.occurrence} D${c.detection} AP ${c.ap} | P: ${c.preventionControl} | D: ${c.detectionControl}`;
            c.cause = c.description = 'Temperatura de rodillo fuera de rango o rodillos sucios';
            c.preventionControl = 'Limpieza periódica de rodillos aplicadores y control de temperatura de fusión';
            c.detectionControl = 'Ensayo de adherencia por lote y control visual';
            // la O queda la que estaba (bajarla le sacaria la SC, y cambiar una sigla es de Fak);
            // la D sale del metodo de deteccion del Top Roll, que es por lote (muestreo)
            c.detection = 9;   // "por lote" es muestreo: Tabla P3 "Random audits <100% of product" = 9
            c.ap = c.actionPriority = calculateAP(S, Number(c.occurrence), 9);
            n++;
            console.log(`  antes:   ${antes}\n  despues: ${c.cause} | S${S} O${c.occurrence} D9 AP ${c.ap} | P: ${c.preventionControl} | D: ${c.detectionControl} | sigla: ${c.specialChar || '(ninguna)'}`);
        }
    }
}
if (!n) throw new Error('no encontre la causa de boquilla/atomizacion');
after.revisions = Array.isArray(after.revisions) ? after.revisions : [];
after.revisions.push({ rev: 'A', date: FECHA, item: '80',
    details: 'EL ADHESIVADO SE HACE EN LA LINEA HOT MELT CON RODILLO: SE REEMPLAZA EL ELEMENTO PISTOLA DE ADHESIVADO Y SU CAUSA DE BOQUILLA POR LA DE TEMPERATURA O SUCIEDAD DE LOS RODILLOS.',
    pswDate: '', modifiedBy: 'FS' });
after.header = after.header || {};
after.header.revDate = FECHA;
syncLegacyFmFields(after);
syncFieldAliases(after);
await runWithValidation([{ id: ID, amfeNumber: NUMERO, productName: 'ARMREST DOOR PANEL Patagonia', before, after }], apply,
    async () => { await saveAmfe(sb, ID, after, { expectedAmfeNumber: NUMERO }); });
finish(apply);
