/**
 * _agregarEngrampadoApb83.mjs — agrega la operacion 83 ENGRAMPADO al AMFE del APB de puerta
 * (AMFE-ARM-PAT, 161) y la deja anotada en el historial de revisiones.
 *
 *   node scripts/_agregarEngrampadoApb83.mjs            # dry-run: muestra lo que agrega
 *   node scripts/_agregarEngrampadoApb83.mjs --apply    # escribe (pasa por runWithValidation)
 *
 * POR QUE (Fak, 01/10/2026: en el APB de puerta "la prensa tapiza y despues se engrampa a mano";
 * el engrampado entra como operacion nueva 83 en flujograma y AMFE)
 *   La BOM del arb del 28/09/2026 carga 27 grampas en el delantero y 21 en el trasero, y el AMFE
 *   solo nombraba la grampa en la recepcion. El flujograma 153 ya tiene la 83 despues de 80-82.
 *
 * DE DONDE SALE CADA TEXTO (nada inventado)
 *   - Los cuatro modos de falla son las cuatro filas del ciclo de control y la nota de las hojas
 *     HO-971 ENGRAMPADO de P. Gamboa (APB delantero 25/09/2026, trasero 28/09/2026): cantidad de
 *     grampas por el camino de inspeccion · grampas firmes, sin salientes ni sueltas · presion de
 *     aire de la engrampadora con manometro en el set up · cara vista sin arrugas, pliegues ni
 *     marcas de calor · "no apoyar la pistola de calor sobre la cara vista".
 *   - Elemento "Engrampadora neumatica", su falla y sus efectos: el mismo elemento del AMFE del
 *     Insert (OP 101) y del IP Pad (OP 120), llevado al apoyabrazos de puerta.
 *   - "Arrugas o pliegues": se usan los efectos y la S=4 que este mismo AMFE ya le da a esa falla
 *     en la operacion 80-82.
 *   - S=6 en las otras tres: vinilo despegado o defecto de aspecto con retrabajo fuera de linea
 *     (amfe.md 1, banda 5-6; igual que el Insert). O=6: prevencion por hoja de operacion, producto
 *     sin historial de serie. D=8: inspeccion humana al 100 %, metodo no probado (P3 oficial,
 *     amfe.md 13). AP por calculateAP.
 *   - Caracteristica especial: VACIA. Asignarla es de Fak (por criterio, S6 y O6 dan SC).
 *   - Acciones de optimizacion: vacias (amfe.md 4 y 5).
 *
 * No duplica: si el AMFE ya tiene la operacion 83, no hace nada.
 */
import { randomUUID } from 'crypto';
import {
    connectSupabase, listAmfes, readAmfe, saveAmfe, findOperation, calculateAP, syncLegacyFmFields, syncFieldAliases,
} from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const NUMERO = 'AMFE-ARM-PAT';
const FECHA = '01/10/2026';
const DETALLE_REV = 'SE AGREGA LA OPERACION 83 ENGRAMPADO, DESPUES DEL TAPIZADO (80-82).';
const O = 6, D = 8;

const EFECTO_DESPEGADO = {
    effectLocal: 'Pieza con el vinilo despegado del sustrato, retrabajo fuera de linea',
    effectNextLevel: 'Retrabajo o rechazo de la pieza antes del despacho',
    effectEndUser: 'Vinilo levantado a la vista en el apoyabrazos de puerta del vehiculo',
};

// [tipo, nombre del elemento, funcion, [falla, S, efectos, causa, prevencion, deteccion]...]
const ELEMENTOS = [
    ['Machine', 'Engrampadora neumatica', 'Fijar el borde del vinilo al sustrato con grampas en todo el contorno', [
        ['Vinilo sin fijar en el contorno de la pieza', 6, EFECTO_DESPEGADO,
            'Grampas en cantidad o posicion distinta a la definida',
            'Hoja de operacion con la secuencia de engrampado',
            'Conteo de grampas con el camino de inspeccion, 100%'],
        ['Grampa saliente o suelta', 6, EFECTO_DESPEGADO,
            'Presion de aire de la engrampadora fuera de regulacion',
            'Verificacion de la presion de aire con manometro en el set up',
            'Verificacion visual y tactil de las grampas, 100%'],
    ]],
    ['Machine', 'Pistola de calor', 'Calentar el borde del vinilo para plegarlo sobre el sustrato', [
        ['Marca de calor en la cara vista', 6, {
            effectLocal: 'Pieza con defecto de aspecto en la cara vista, se separa en el puesto',
            effectNextLevel: 'Rechazo de la pieza antes del despacho',
            effectEndUser: 'Defecto de aspecto visible en el apoyabrazos de puerta del vehiculo',
        },
            'Pistola de calor apoyada sobre la cara vista',
            'Hoja de operacion: no apoyar la pistola de calor sobre la cara vista',
            'Verificacion visual de la cara vista, 100%'],
    ]],
    ['Man', 'Operador de Producción', 'Tensar y plegar el vinilo sobre el sustrato del centro hacia los extremos', [
        ['Arrugas o pliegues en la cara vista', 4, {
            effectLocal: 'Retrabajo parcial o en estación',
            effectNextLevel: 'Plan de reacción menor',
            effectEndUser: 'Defecto visual notorio',
        },
            'Vinilo engrampado sin tensar',
            'Hoja de operacion con la secuencia de tensado y engrampado',
            'Verificacion visual de la cara vista, 100%'],
    ]],
];

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const fila = (await listAmfes(sb)).filter(a => a.amfe_number === NUMERO);
if (fila.length !== 1) throw new Error(`${NUMERO}: esperaba 1 documento y hay ${fila.length}`);
const ID = fila[0].id;
const { doc: before, amfe_number } = await readAmfe(sb, ID);
if (amfe_number !== NUMERO) throw new Error(`esperaba ${NUMERO} y lei ${amfe_number}: no toco nada`);

if (findOperation(before, '83')) {
    console.log('El AMFE ya tiene la operacion 83: nada para hacer.');
    process.exit(0);
}

const after = structuredClone(before);
const tapizado = findOperation(after, '80-82');
if (!tapizado) throw new Error('no encuentro la OP 80-82');
const pos = after.operations.indexOf(tapizado);

// La causa nueva lleva las mismas claves que las causas vecinas (vacias), para que el export
// y la app la lean igual.
const molde = tapizado.workElements.flatMap(w => w.functions || []).flatMap(f => f.failures || [])
    .flatMap(f => f.causes || []).find(c => 'preventionAction' in c);
const vacia = Object.fromEntries(Object.keys(molde || {}).map(k => [k, '']));

const workElements = ELEMENTOS.map(([type, name, fnTxt, fallas]) => ({
    id: randomUUID(),
    name,
    type,
    functions: [{
        id: randomUUID(),
        description: fnTxt,
        functionDescription: fnTxt,
        requirements: '',
        failures: fallas.map(([desc, S, efectos, causaTxt, prev, det]) => {
            const ap = calculateAP(S, O, D);
            return {
                id: randomUUID(),
                description: desc,
                ...efectos,
                causes: [{
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
                    preventionControl: prev,
                    detectionControl: det,
                    _autoFilled: true,
                }],
            };
        }),
    }],
}));

const nombre = 'ENGRAMPADO';
const nueva = {
    id: randomUUID(),
    operationNumber: '83',
    opNumber: '83',
    operationName: nombre,
    name: nombre,
    focusElementFunction: tapizado.focusElementFunction,
    operationFunction: 'Fijar con grampas el borde del vinilo al sustrato en todo el contorno, sin marcar la cara vista',
    workElements,
};
after.operations.splice(pos + 1, 0, nueva);

console.log(`\n${NUMERO} · operacion nueva 83 ${nombre} (despues de la 80-82):`);
for (const we of workElements) {
    console.log(`  WE [${we.type}] ${we.name}`);
    console.log(`    Funcion: ${we.functions[0].description}`);
    for (const fm of we.functions[0].failures) {
        const c = fm.causes[0];
        console.log(`    Falla  : ${fm.description}`);
        console.log(`      efectos: ${fm.effectLocal} / ${fm.effectNextLevel} / ${fm.effectEndUser}`);
        console.log(`      causa  : ${c.cause}   S${c.severity} O${c.occurrence} D${c.detection} AP=${c.ap}   sigla: (vacia)`);
        console.log(`      prev   : ${c.preventionControl}`);
        console.log(`      det    : ${c.detectionControl}`);
    }
}

after.revisions = Array.isArray(after.revisions) ? after.revisions : [];
after.revisions.push({ rev: 'A', date: FECHA, item: '83', details: DETALLE_REV, pswDate: '', modifiedBy: 'FS' });
after.header = after.header || {};
after.header.revDate = FECHA;
console.log(`\nHistorial: fila nueva  A · ${FECHA} · item 83 · ${DETALLE_REV}\n`);

syncLegacyFmFields(after);
syncFieldAliases(after);

const plan = [{ id: ID, amfeNumber: NUMERO, productName: 'ARMREST DOOR PANEL Patagonia', before, after }];
await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, ID, after, { expectedAmfeNumber: NUMERO });
});
finish(apply);
