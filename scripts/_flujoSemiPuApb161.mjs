/**
 * _flujoSemiPuApb161.mjs — AMFE del APB de puerta (AMFE-ARM-PAT, 161) alineado al flujograma 153 Rev.E:
 * agrega 60 TROQUELADO DE CINTA y 71 ARMADO DE CINTA Y ESPUMA SOBRE EL PLASTICO y renumera desde el 60.
 *
 *   node scripts/_flujoSemiPuApb161.mjs            # dry-run: muestra lo que cambia
 *   node scripts/_flujoSemiPuApb161.mjs --apply    # escribe (pasa por runWithValidation)
 *
 * POR QUE
 *   Pedido de Carlos Baptista, mail "Modificación flujo de proceso – Armrest DP (APB)" del 02/10/2026:
 *   la cinta se troquela en Conversion de Cinta, en PU el operador arma la cinta y la espuma sobre el
 *   plastico durante el curado, y el semielaborado pasa por Deposito antes del tapizado. Flujograma 153
 *   Rev.E emitido el 05/10/2026; renumeracion desde el 60 decidida por Fak ese dia.
 *
 * DE DONDE SALE CADA TEXTO (OK de Fak a la tabla, 05/10/2026)
 *   - La 60 copia el TROQUELADO DE ESPUMAS (OP 50) y la 71 el ENSAMBLE SUSTRATO + ESPUMA (OP 60) del
 *     AMFE del IP Pad (VWA-PAT-IPPADS-001), que usa el mismo film Tesa 52110. Se cambia "espuma" por
 *     "cinta" donde corresponde; el efecto local de la 60 es scrap (amfe.md §1: corte = scrap).
 *   - O=4 (no el 3 del IP Pad): proceso nuevo, sin historia en serie (amfe.md §13, P2). D=8: inspeccion
 *     humana, metodo no probado (P3 oficial). S de los modelos. AP por calculateAP.
 *   - Caracteristica especial: VACIA (asignarla es de Fak). Acciones de optimizacion: vacias.
 *   - En la 71 la prevencion del operador es la hoja de operaciones: el dispositivo con topes del IP Pad
 *     no consta para esta pieza.
 *
 * Idempotente: si el AMFE ya tiene la operacion 71 ARMADO..., no hace nada.
 */
import { randomUUID } from 'crypto';
import {
    connectSupabase, listAmfes, readAmfe, saveAmfe, findOperation, calculateAP, syncLegacyFmFields, syncFieldAliases,
} from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const NUMERO = 'AMFE-ARM-PAT';
const FECHA = '05/10/2026';
const ITEM_REV = '60 / 70-71 / 80-82 / 90-93 / 100';
const DETALLE_REV = 'SE AGREGAN 60 TROQUELADO DE CINTA (CONVERSION DE CINTA) Y 71 ARMADO DE CINTA Y ESPUMA SOBRE EL '
    + 'PLASTICO, DURANTE EL CURADO EN INYECCION PU. EL SEMIELABORADO PLASTICO + ESPUMA PU PASA POR DEPOSITO ANTES DEL '
    + 'TAPIZADO. SE RENUMERAN: PU 60 A 70, ADHESIVADO 70-71 A 80-81, REPROCESO DE ADHESIVO 100 A 82, TAPIZADO 80-82 A '
    + '90-92, ENGRAMPADO 83 A 93, CONTROL FINAL 90 A 100.';
const O = 4, D = 8;

// numero viejo -> numero nuevo (se aplica por objeto, de una sola pasada: 70 -> 80 no sigue a 90)
const RENUMERO = { '60': '70', '70': '80', '71': '81', '100': '82', '80-82': '90-92', '83': '93', '90': '100' };

// [tipo, nombre del elemento, funcion, [falla, S, efectos, causa, prevencion, deteccion]...]
const OP60 = [
    ['Machine', 'Troqueladora', 'Troquelar la cinta a la medida y forma definidas', [
        ['Cinta fuera de dimension', 5, {
            effectLocal: 'Scrap de la cinta mal troquelada',
            effectNextLevel: 'Armado de cinta y espuma desalineado sobre el plastico',
            effectEndUser: 'Bulto perceptible al tacto en el apoyabrazos',
        }, 'Desgaste de la matriz de troquelado', 'Plan de mantenimiento preventivo de matrices',
            'Inspeccion visual dimensional post-troquelado'],
    ]],
    ['Man', 'Operador de Producción', 'Cargar en la troqueladora el rollo de cinta correcto', [
        ['Rollo de cinta equivocado cargado', 5, {
            effectLocal: 'Scrap de la cinta troquelada',
            effectNextLevel: 'Espuma mal adherida al plastico en el armado',
            effectEndUser: 'Bulto o despegue perceptible en el apoyabrazos',
        }, 'Operador toma el rollo equivocado', 'Identificacion visual de rollos por codigo',
            'Inspeccion visual del rollo cargado'],
    ]],
];
const OP71 = [
    ['Material', 'Film adhesivo Tesa 52110', 'Adherir la cinta y la espuma al plastico', [
        ['Cinta faltante o mal adherida', 6, {
            effectLocal: 'Espuma se despega del plastico',
            effectNextLevel: 'Delaminacion en el tapizado',
            effectEndUser: 'Burbujas o despegue visible en el apoyabrazos',
        }, 'Cinta mal posicionada o incompleta', 'Autocontrol segun P-09/I', 'Inspeccion visual'],
    ]],
    ['Man', 'Operador de Producción', 'Armar la cinta y la espuma sobre el plastico en la posicion correcta', [
        ['Cinta o espuma mal posicionada', 5, {
            effectLocal: 'Retrabajo, reposicionar la espuma',
            effectNextLevel: 'Tapizado con arruga o bulto',
            effectEndUser: 'Superficie despareja en el apoyabrazos',
        }, 'Posicionamiento incorrecto de la cinta o la espuma', 'Hoja de operaciones', 'Inspeccion visual'],
    ]],
];

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const fila = (await listAmfes(sb)).filter(a => a.amfe_number === NUMERO);
if (fila.length !== 1) throw new Error(`${NUMERO}: esperaba 1 documento y hay ${fila.length}`);
const ID = fila[0].id;
const { doc: before, amfe_number } = await readAmfe(sb, ID);
if (amfe_number !== NUMERO) throw new Error(`esperaba ${NUMERO} y lei ${amfe_number}: no toco nada`);
if (before.operations.some(o => /ARMADO DE CINTA/i.test(o.name ?? o.operationName ?? ''))) {
    console.log('El AMFE ya tiene el ARMADO DE CINTA: nada para hacer.');
    process.exit(0);
}

const after = structuredClone(before);
const num = o => String(o.opNumber ?? o.operationNumber);
const esperados = ['10', '20', '21', '22', '30', '40', '41', '50', '51', '60', '70', '71', '80-82', '83', '90', '100', '101', '110'];
const actuales = after.operations.map(num);
if (JSON.stringify(actuales) !== JSON.stringify(esperados)) {
    throw new Error(`la secuencia del AMFE no es la de la Rev.D:\n  hoy:      ${actuales.join(' ')}\n  esperada: ${esperados.join(' ')}`);
}

// 1. renumerar (por objeto, una sola pasada)
const cambios = [];
for (const o of after.operations) {
    const viejo = num(o);
    if (RENUMERO[viejo]) {
        o.opNumber = o.operationNumber = RENUMERO[viejo];
        cambios.push(`${viejo} -> ${RENUMERO[viejo]}  ${o.name ?? o.operationName}`);
    }
}
// el reproceso de adhesivado (ex 100, ahora 82) va despues de la inspeccion 81, no despues del control final
{
    const rep = findOperation(after, '82');
    const insp = findOperation(after, '81');
    if (!rep || !insp || !/REPROCESO/i.test(rep.name ?? '')) throw new Error('no encuentro el reproceso 82 o la inspeccion 81');
    after.operations.splice(after.operations.indexOf(rep), 1);
    after.operations.splice(after.operations.indexOf(insp) + 1, 0, rep);
}
// un WE con el numero de OP viejo en el nombre seria residuo de la renumeracion (amfe.md §10)
for (const o of after.operations) {
    for (const w of o.workElements ?? []) {
        if (/\bop\.?\s*\d+/i.test(w.name ?? '')) console.log(`  ⚠ WE con numero de OP en el nombre: OP ${num(o)} "${w.name}"`);
    }
}

// 2. operaciones nuevas, con las claves de causa de las vecinas (vacias)
const molde = after.operations.flatMap(o => o.workElements ?? []).flatMap(w => w.functions ?? [])
    .flatMap(f => f.failures ?? []).flatMap(f => f.causes ?? []).find(c => 'preventionAction' in c);
const vacia = Object.fromEntries(Object.keys(molde || {}).map(k => [k, '']));
const focus = after.operations[0].focusElementFunction;

function operacion(numero, nombre, funcionPaso, elementos) {
    return {
        id: randomUUID(),
        operationNumber: numero, opNumber: numero, operationName: nombre, name: nombre,
        focusElementFunction: focus,
        operationFunction: funcionPaso,
        workElements: elementos.map(([type, name, fnTxt, fallas]) => ({
            id: randomUUID(), name, type,
            functions: [{
                id: randomUUID(), description: fnTxt, functionDescription: fnTxt, requirements: '',
                failures: fallas.map(([desc, S, efectos, causaTxt, prev, det]) => {
                    const ap = calculateAP(S, O, D);
                    return {
                        id: randomUUID(), description: desc, ...efectos,
                        causes: [{
                            ...vacia, id: randomUUID(), cause: causaTxt, description: causaTxt,
                            severity: S, occurrence: O, detection: D, ap, actionPriority: ap, specialChar: '',
                            preventionControl: prev, detectionControl: det, _autoFilled: true,
                        }],
                    };
                }),
            }],
        })),
    };
}

const op60 = operacion('60', 'TROQUELADO DE CINTA',
    'Proveer la cinta troquelada a la medida y forma definidas para el armado en inyeccion PU, sin generar scrap', OP60);
const op71 = operacion('71', 'ARMADO DE CINTA Y ESPUMA SOBRE EL PLASTICO',
    'Armar la cinta y la espuma sobre el plastico durante el curado, en la posicion definida', OP71);
const pu = findOperation(after, '70');
if (!pu || !/PU|POLIURETANO/i.test(pu.name ?? '')) throw new Error('no encuentro la OP 70 de inyeccion PU despues de renumerar');
after.operations.splice(after.operations.indexOf(pu), 0, op60);
after.operations.splice(after.operations.indexOf(pu) + 1, 0, op71);

const final = after.operations.map(num);
console.log(`\n${NUMERO} · renumeracion:`);
cambios.forEach(c => console.log('  ' + c));
console.log(`\nSecuencia nueva: ${final.join(' ')}\n`);
for (const op of [op60, op71]) {
    console.log(`OP ${op.opNumber} ${op.name}`);
    for (const we of op.workElements) {
        for (const fm of we.functions[0].failures) {
            const c = fm.causes[0];
            console.log(`  WE [${we.type}] ${we.name} | ${fm.description} | ${c.cause} | S${c.severity} O${c.occurrence} D${c.detection} AP=${c.ap}`);
        }
    }
}

after.revisions = Array.isArray(after.revisions) ? after.revisions : [];
after.revisions.push({ rev: 'A', date: FECHA, item: ITEM_REV, details: DETALLE_REV, pswDate: '', modifiedBy: 'FS' });
after.header = after.header || {};
after.header.revDate = FECHA;
console.log(`\nHistorial: fila nueva  A · ${FECHA} · ${ITEM_REV}\n`);

syncLegacyFmFields(after);
syncFieldAliases(after);

const plan = [{ id: ID, amfeNumber: NUMERO, productName: 'ARMREST DOOR PANEL Patagonia', before, after }];
await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, ID, after, { expectedAmfeNumber: NUMERO });
});
finish(apply);
