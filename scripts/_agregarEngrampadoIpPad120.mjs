/**
 * _agregarEngrampadoIpPad120.mjs — agrega el engrampado de puntas a la OP 120 TERMINACION del
 * AMFE del IP PAD (VWA-PAT-IPPADS-001) y lo deja anotado en el historial de revisiones.
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
 *   - Control preventivo: la hoja HO-985 OP 120 (fotos con la posicion de cada grampa).
 *   - Control de deteccion: el paso de conteo de esa hoja (contar las grampas de cada punta).
 *   - S=6: el efecto es vinilo despegado con retrabajo fuera de linea (amfe.md §1, banda 5-6;
 *     igual que el Insert). O=6: prevencion por instruccion, producto sin historial de serie.
 *     D=8: inspeccion humana, metodo no probado (P3 oficial, amfe.md §13). AP por calculateAP.
 *   - Caracteristica especial: se deja VACIA. Asignarla es de Fak (por criterio, S6 y O6 dan SC).
 *   - Acciones de optimizacion: vacias (amfe.md §4 y §5).
 *
 * EL HISTORIAL (lo marco el auditor el 01/10/2026: la primera corrida agrego el elemento y no
 * dejo rastro en revisiones). El IP Pad no se volvio a emitir, asi que la letra sigue en A
 * (amfe.md §4bis); se suma una fila con el item 120 y `header.revDate` sigue a esa fila (§17.6),
 * igual que `_agregarOpsTapizadoInsert.mjs`.
 *
 * No duplica: cada una de las dos partes se hace solo si falta.
 */
import { randomUUID } from 'crypto';
import {
    connectSupabase, readAmfe, saveAmfe, findOperation, calculateAP, syncLegacyFmFields, syncFieldAliases,
} from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';
const NUMERO = 'VWA-PAT-IPPADS-001';
const S = 6, O = 6, D = 8;
const FECHA = '01/10/2026';
const DETALLE_REV = 'SE AGREGA EL ENGRAMPADO DE PUNTAS EN LA OPERACION TERMINACION.';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const { doc: before, amfe_number } = await readAmfe(sb, ID);
if (amfe_number !== NUMERO) throw new Error(`esperaba ${NUMERO} y lei ${amfe_number}: no toco nada`);

const after = structuredClone(before);
const op = findOperation(after, '120');
if (!op) throw new Error('no encuentro la OP 120');
let cambios = 0;

// ─── 1. El elemento de trabajo ──────────────────────────────────────────────
if (JSON.stringify(op).toLowerCase().includes('gramp')) {
    console.log('La OP 120 ya nombra grampas: el elemento no se vuelve a agregar.');
} else {
    // La causa nueva lleva las mismas claves que las causas que ya tiene la operacion (vacias),
    // para que el export y la app la lean igual que a sus vecinas.
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
    const falla = {
        id: randomUUID(),
        description: 'Vinilo sin fijar en las puntas de la pieza',
        effectLocal: 'Pieza con el vinilo despegado en la punta, retrabajo fuera de linea',
        effectNextLevel: 'Retrabajo o rechazo de la pieza antes del despacho',
        effectEndUser: 'Vinilo levantado en la punta del tablero del vehiculo',
        causes: [causa],
    };
    const we = {
        id: randomUUID(),
        name: 'Engrampadora neumatica',
        type: 'Machine',
        functions: [{ id: randomUUID(), description: fnTxt, functionDescription: fnTxt, requirements: '', failures: [falla] }],
    };
    op.workElements.push(we);
    cambios++;

    console.log(`\n${NUMERO} · OP 120 ${op.name || op.operationName} — elemento que se agrega:`);
    console.log(`  WE [${we.type}] ${we.name}`);
    console.log(`    Funcion : ${fnTxt}`);
    console.log(`    Falla   : ${falla.description}`);
    console.log(`    Efectos : local = ${falla.effectLocal}`);
    console.log(`              siguiente = ${falla.effectNextLevel}`);
    console.log(`              usuario = ${falla.effectEndUser}`);
    console.log(`    Causa   : ${causaTxt}   S${S} O${O} D${D} AP=${ap}   caracteristica especial: (vacia)`);
    console.log(`    Prevencion: ${causa.preventionControl}`);
    console.log(`    Deteccion : ${causa.detectionControl}\n`);
}

// ─── 2. El historial de revisiones ──────────────────────────────────────────
after.revisions = Array.isArray(after.revisions) ? after.revisions : [];
const yaAnotado = after.revisions.some(r => String(r.item || '').trim() === '120'
    && /ENGRAMPADO/i.test(String(r.details || r.description || '')));
if (yaAnotado) {
    console.log('El historial ya tiene la fila del engrampado: no se vuelve a agregar.');
} else {
    after.revisions.push({ rev: 'A', date: FECHA, item: '120', details: DETALLE_REV, pswDate: '', modifiedBy: 'FS' });
    after.header = after.header || {};
    after.header.revDate = FECHA;
    cambios++;
    console.log(`Historial: fila nueva  A · ${FECHA} · item 120 · ${DETALLE_REV}`);
    console.log(`           header.revDate ${before.header?.revDate} -> ${FECHA}\n`);
}

if (cambios === 0) {
    console.log('\nNada para hacer.');
    process.exit(0);
}

// Los campos espejo de la falla (fm.severity, fm.ap...) y los alias los pone la misma funcion que
// usa saveAmfe(): se corre aca para que el validador vea el documento como va a quedar guardado.
syncLegacyFmFields(after);
syncFieldAliases(after);

const plan = [{ id: ID, amfeNumber: NUMERO, productName: 'IP PAD Patagonia', before, after }];
await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, ID, after, { expectedAmfeNumber: NUMERO });
});
finish(apply);
