/**
 * _agregarEngrampadoIpPad120.mjs — agrega el engrampado de puntas a la OP 120 TERMINACION del
 * AMFE del IP PAD (VWA-PAT-IPPADS-001).
 *
 *   node scripts/_agregarEngrampadoIpPad120.mjs            # dry-run: muestra lo que agrega
 *   node scripts/_agregarEngrampadoIpPad120.mjs --apply    # escribe (pasa por runWithValidation)
 *
 * POR QUE (Fak, 01/10/2026: "dale agrega el engrampado en la OP 120 del AMFE")
 *   Las puntas del IP Pad se engrampan (video de Fak del 30/09/2026; HIGH 11, LOW 12 grampas
 *   84/06) y el AMFE no nombraba una grampa en ninguna operacion. La OP 120 ya trae el acabado
 *   manual de las puntas; la hoja de proceso del engrampado es la HO-985 OP 120.
 *
 * DE DONDE SALE CADA TEXTO (no hay nada inventado)
 *   - WE "Engrampadora neumatica", la funcion, la falla y sus tres efectos: el mismo elemento ya
 *     escrito en el AMFE del Insert (AMFE-INS-PAT, OP 101 VIROLADO MANUAL), llevado a "las puntas".
 *   - Control preventivo: la hoja HO-985 OP 120 (4 fotos con la posicion de cada grampa).
 *   - Control de deteccion: el paso 8 de esa hoja (contar las grampas de cada punta, cada pieza).
 *   - S=6: el efecto es vinilo despegado con retrabajo fuera de linea (amfe.md §1, banda 5-6;
 *     igual que el Insert). O=6: prevencion por instruccion, producto sin historial de serie.
 *     D=8: inspeccion humana, metodo no probado (P3 oficial, amfe.md §13). AP por calculateAP.
 *   - Caracteristica especial: se deja VACIA. Asignarla es de Fak (por criterio, S6 y O6 dan SC).
 *   - Acciones de optimizacion: vacias (amfe.md §4 y §5).
 */
import { randomUUID } from 'crypto';
import {
    connectSupabase, readAmfe, saveAmfe, findOperation, calculateAP, syncLegacyFmFields, syncFieldAliases,
} from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';
const NUMERO = 'VWA-PAT-IPPADS-001';
const S = 6, O = 6, D = 8;

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const { doc: before, amfe_number } = await readAmfe(sb, ID);
if (amfe_number !== NUMERO) throw new Error(`esperaba ${NUMERO} y lei ${amfe_number}: no toco nada`);

const after = structuredClone(before);
const op = findOperation(after, '120');
if (!op) throw new Error('no encuentro la OP 120');
if (JSON.stringify(op).toLowerCase().includes('gramp')) {
    console.log('La OP 120 ya nombra grampas: no agrego nada (el script no duplica).');
    process.exit(0);
}

// La causa nueva lleva las mismas claves que las causas que ya tiene la operacion (vacias), para
// que el export y la app la lean igual que a sus vecinas.
const molde = op.workElements.flatMap(w => w.functions || []).flatMap(f => f.failures || [])
    .flatMap(f => f.causes || []).find(c => 'preventionAction' in c);
const vacia = Object.fromEntries(Object.keys(molde || {}).map(k => [k, '']));
const ap = calculateAP(S, O, D);
const causaTxt = 'Grampas en cantidad o posicion distinta a la definida';
const causa = {
    ...vacia,
    id: randomUUID(),
    cause: causaTxt,
    description: causaTxt,
    severity: S,
    occurrence: O,
    detection: D,
    ap,
    actionPriority: ap,
    specialChar: '',
    preventionControl: 'Hoja de operaciones con la posicion de cada grampa',
    detectionControl: 'Conteo visual de grampas en cada punta, 100%',
    _autoFilled: true,
};
const fnTxt = 'Fijar el vinilo con grampas en las dos puntas de la pieza';
const we = {
    id: randomUUID(),
    name: 'Engrampadora neumatica',
    type: 'Machine',
    functions: [{
        id: randomUUID(),
        description: fnTxt,
        functionDescription: fnTxt,
        requirements: '',
        failures: [{
            id: randomUUID(),
            description: 'Vinilo sin fijar en las puntas de la pieza',
            effectLocal: 'Pieza con el vinilo despegado en la punta, retrabajo fuera de linea',
            effectNextLevel: 'Retrabajo o rechazo de la pieza antes del despacho',
            effectEndUser: 'Vinilo levantado en la punta del tablero del vehiculo',
            causes: [causa],
        }],
    }],
};
op.workElements.push(we);
// Los campos espejo de la falla (fm.severity, fm.ap...) y los alias los pone la misma funcion que usa
// saveAmfe(): se corre aca para que el validador vea el documento como va a quedar guardado.
syncLegacyFmFields(after);
syncFieldAliases(after);

console.log(`\n${NUMERO} · OP 120 ${op.name || op.operationName} — elemento que se agrega:`);
console.log(`  WE [${we.type}] ${we.name}`);
console.log(`    Funcion : ${fnTxt}`);
console.log(`    Falla   : ${we.functions[0].failures[0].description}`);
console.log(`    Efectos : local = ${we.functions[0].failures[0].effectLocal}`);
console.log(`              siguiente = ${we.functions[0].failures[0].effectNextLevel}`);
console.log(`              usuario = ${we.functions[0].failures[0].effectEndUser}`);
console.log(`    Causa   : ${causaTxt}   S${S} O${O} D${D} AP=${ap}   caracteristica especial: (vacia)`);
console.log(`    Prevencion: ${causa.preventionControl}`);
console.log(`    Deteccion : ${causa.detectionControl}\n`);

const plan = [{ id: ID, amfeNumber: NUMERO, productName: 'IP PAD Patagonia', before, after }];
await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, ID, after, { expectedAmfeNumber: NUMERO });
});
finish(apply);
