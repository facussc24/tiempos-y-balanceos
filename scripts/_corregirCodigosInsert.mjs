/**
 * _corregirCodigosInsert.mjs — el AMFE del Insert queda con los codigos del BOM VIGENTE.
 *
 * POR QUE
 * Los renglones de recepcion del Insert se cargaron con los codigos de `BOM-NOVAX-002`
 * Rev.11 (lo que hay en Supabase). Pero el BOM VIGENTE del servidor es
 * `BOM 002 - INSERT REV.A.xlsx` (30/06/2026, Liberado, C. Baptista) y usa OTROS codigos:
 * los de Sansuy `197.xxx`, no los internos `427-VIN-xxx`.
 *
 *   Rev.11 (obsoleto, Supabase)          REV.A (vigente, servidor)
 *   427-VIN-001-COR-01  Titan Black  ->  197.025.0426-8
 *   427-VIN-002-COR-01  Platinium    ->  197.026.0006-3
 *   427-VIN-003-COR-01  Andino Gray  ->  197.026.0007-5
 *   427-VIN-004-COR-01  Dark Slate   ->  197.026.0008-7
 *
 * Ademas el Rev.11 tenia DOS juegos de codigos de vinilo para los mismos cuatro colores
 * (`427-VIN-001..004` y `017..020`), y los 017-020 ya pertenecen a otros productos: el
 * `427VIN018COR01` es Titan Black en el apoyabrazos, no Platinium Gray. El REV.A resolvio
 * eso sacando los `427VIN` del Insert. Verificado contra el arb (foto del 02/08/2026) y el
 * `LISTADO PC PATAGONIA.xlsx`.
 *
 * LOS HILOS — aca el BOM vigente tiene un error que NO se propaga
 * El REV.A escribe el hilo Jet Black como `FX284TK-E0PTO (FX284-E0PTO)`. **`FX284TK` no
 * existe en el arb** (0 ocurrencias en insumos, relaciones e INSUMOS.TXT) y `FX284-E0PTO`
 * es el hilo de UNION 30/3, no el de vista 20/3.
 * El hilo Jet Black 20/3 real es **`FX483TK-E0PTO`**, confirmado por dos fuentes
 * independientes: el plan de control de recepcion 1062 ("Hilo Jet Black 20/3") y el consumo
 * del arb, donde los Insertos L0 consumen `FX483TK-E0PTO`.
 * Se carga el codigo REAL y el error del BOM se reporta para que lo corrijan.
 *
 * Y SE AGREGA UN MATERIAL QUE AL BOM LE FALTA
 * El arb consume en cada Inserto `FX284-E0PTO` (hilo de union 30/3) 0,000544 kg, y todos los
 * demas productos del proyecto lo declaran como `427HIL001COS01` "Join Seam 30/3". El BOM
 * del Insert no lo lista. Como el material ENTRA de verdad, necesita control de recepcion:
 * se agrega al AMFE y se reporta el faltante del BOM.
 *
 * Uso:  node scripts/_corregirCodigosInsert.mjs           (dry-run)
 *       node scripts/_corregirCodigosInsert.mjs --apply
 */

import { randomUUID } from 'crypto';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import {
    connectSupabase, parseData, saveAmfe, calculateAP,
    syncLegacyFmFields, syncFieldAliases,
} from './_lib/amfeIo.mjs';

/** nombre viejo (fragmento del codigo) -> nombre nuevo completo */
const RENOMBRAR = [
    ['427-VIN-001-COR-01', 'Vinilo bondeado Titan Black (Sansuy) (codigo 197.025.0426-8)'],
    ['427-VIN-002-COR-01', 'Vinilo bondeado Platinium Gray (Sansuy) (codigo 197.026.0006-3)'],
    ['427-VIN-003-COR-01', 'Vinilo bondeado Andino Gray (Sansuy) (codigo 197.026.0007-5)'],
    ['427-VIN-004-COR-01', 'Vinilo bondeado Dark Slate ML14 (Sansuy) (codigo 197.026.0008-7)'],
    ['427-HIL-002-COS-01', 'Hilo vista 20/3 Jet Black (Linhanyl) (codigo FX483TK-E0PTO)'],
    ['427-HIL-003-COS-01', 'Hilo vista 20/3 Alpe Gray (Linhanyl) (codigo FX483TK-11930E)'],
    ['427-HIL-004-COS-01', 'Hilo vista 20/3 Gray Violet (Linhanyl) (codigo FX483TK-11703E)'],
];

/** El plan de recepcion que le corresponde a cada hilo, para citarlo en el control. */
const PLAN_HILO = {
    'FX483TK-E0PTO': '1062',
    'FX483TK-11930E': '1063',
    'FX483TK-11703E': '1064',
    'FX284-E0PTO': '1043',
};

const PREV_P14 = 'Verificacion segun P-14';
const PREV_CERT = 'Certificado del proveedor por lote (P-14)';

function mkCause({ desc, s, o, d, prev, det }) {
    const ap = calculateAP(s, o, d);
    return {
        id: randomUUID(), cause: desc, description: desc,
        severity: s, occurrence: o, detection: d, ap, actionPriority: ap, specialChar: '',
        preventionControl: prev, detectionControl: det,
        preventionAction: ap === 'H' ? 'Pendiente definicion equipo APQP' : '',
        detectionAction: '', optimizationAction: '',
        responsible: '', targetDate: '', status: '', _autoFilled: true,
    };
}
function mkFailure({ desc, local, next, end, causa, s, o, d, prev, det }) {
    return {
        id: randomUUID(), description: desc,
        effectLocal: local, effectNextLevel: next, effectEndUser: end,
        causes: [mkCause({ desc: causa, s, o, d, prev, det })],
    };
}

/** El hilo de union 30/3 que le falta al BOM del Insert. Mismo repertorio que los otros. */
function weHiloUnion() {
    const ref = `, plan de recepcion ${PLAN_HILO['FX284-E0PTO']}`;
    const nombre = 'Hilo de union 30/3 Jet Black (Linhanyl) (codigo FX284-E0PTO)';
    return {
        id: randomUUID(), name: nombre, type: 'Material', description: '', _autoFilled: true,
        functions: [{
            id: randomUUID(),
            description: 'Aportar el hilo de union con el articulo, el color y la cantidad de cabos especificados',
            functionDescription: 'Aportar el hilo de union con el articulo, el color y la cantidad de cabos especificados',
            requirements: '',
            failures: [
                mkFailure({
                    desc: 'Color del hilo de union fuera del patron',
                    local: 'Lote segregado en recepcion',
                    next: 'Costura con tono distinto al del tapizado',
                    end: 'Defecto de apariencia en la costura',
                    causa: 'Partida del proveedor con variacion de tono',
                    s: 6, o: 3, d: 4, prev: PREV_P14,
                    det: `Inspeccion visual con patron de color, 1 muestra por lote (P-10/I${ref})`,
                }),
                mkFailure({
                    desc: 'Cantidad de cabos del hilo de union distinta a la especificada',
                    local: 'Lote segregado en recepcion',
                    next: 'Resistencia de la costura fuera de lo previsto',
                    end: 'Costura que se abre en uso',
                    causa: 'Error de preparacion del pedido en el proveedor',
                    s: 7, o: 2, d: 5, prev: PREV_P14,
                    det: `Inspeccion visual, 1 muestra por lote (P-10/I${ref})`,
                }),
                mkFailure({
                    desc: 'Articulo entregado distinto al pedido',
                    local: 'Lote segregado en recepcion',
                    next: 'Hilo equivocado montado en la maquina de costura',
                    end: 'Costura con hilo que no corresponde a la pieza',
                    causa: 'Error de despacho del proveedor',
                    s: 6, o: 3, d: 5, prev: PREV_P14,
                    det: `Verificacion de la etiqueta del material, 1 muestra por lote (P-10/I${ref})`,
                }),
                mkFailure({
                    desc: 'Flamabilidad del hilo fuera de especificacion',
                    local: 'Lote no conforme, material a segregar',
                    next: 'Rechazo del ensayo de flamabilidad del conjunto',
                    end: 'Riesgo para la seguridad del usuario del vehiculo',
                    causa: 'Lote del proveedor sin ensayo de flamabilidad conforme',
                    s: 9, o: 3, d: 5, prev: PREV_CERT,
                    det: `Certificado del proveedor conforme Norma VW 50106, anual (P-10/I y ARB${ref})`,
                }),
            ],
        }],
    };
}

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents').select('id, amfe_number, data').eq('amfe_number', 'AMFE-INS-PAT').limit(1);
if (error) throw error;
const row = rows[0];
const before = parseData(row.data);
const doc = parseData(row.data);

const op10 = doc.operations.find(o => /RECEPCION/i.test(o.name || o.operationName || ''));
if (!op10) throw new Error('No se encontro la operacion de recepcion');

let renombrados = 0;
for (const we of op10.workElements || []) {
    if (we._autoFilled !== true) continue;
    const hit = RENOMBRAR.find(([viejo]) => (we.name || '').includes(viejo));
    if (!hit) continue;
    const antes = we.name;
    we.name = hit[1];
    // Si es un hilo, el control detectivo cita el plan de recepcion: hay que actualizarlo.
    const codNuevo = (hit[1].match(/codigo (\S+)\)/) || [])[1];
    const planNuevo = PLAN_HILO[codNuevo];
    if (planNuevo) {
        for (const fn of we.functions || []) {
            for (const fl of fn.failures || []) {
                for (const cs of fl.causes || []) {
                    cs.detectionControl = (cs.detectionControl || '')
                        .replace(/plan de recepcion \d+/g, `plan de recepcion ${planNuevo}`);
                }
            }
        }
    }
    renombrados++;
    logChange(apply, `"${antes}"\n              -> "${we.name}"`, {});
}

// El hilo de union 30/3 que el BOM no lista pero el arb consume.
const yaEsta = (op10.workElements || []).some(w => (w.name || '').includes('FX284-E0PTO'));
let agregado = 0;
if (!yaEsta) {
    op10.workElements.push(weHiloUnion());
    agregado = 1;
    logChange(apply, '+ WE [Material] "Hilo de union 30/3 Jet Black (Linhanyl) (codigo FX284-E0PTO)" — el arb lo consume y el BOM no lo lista', {});
}

console.log(`\n  renombrados: ${renombrados} (esperados ${RENOMBRAR.length})  |  agregados: ${agregado}\n`);
if (renombrados !== RENOMBRAR.length) {
    throw new Error(`Se esperaban ${RENOMBRAR.length} renombres y se hicieron ${renombrados}. Se aborta.`);
}

syncLegacyFmFields(doc);
syncFieldAliases(doc);

await runWithValidation(
    [{ id: row.id, amfeNumber: 'AMFE-INS-PAT', productName: 'INSERT', before, after: doc }],
    apply,
    async () => {
        await saveAmfe(sb, row.id, doc);
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
        const live = parseData(chk.data);
        const opLive = live.operations.find(o => /RECEPCION/i.test(o.name || o.operationName || ''));
        const viejos = (opLive.workElements || []).filter(w => /427-VIN-00[1-4]|427-HIL-00[2-4]/.test(w.name || ''));
        if (viejos.length) throw new Error(`POST-CHECK: quedaron ${viejos.length} codigos viejos`);
        const nMat = (opLive.workElements || []).filter(w => w.type === 'Material').length;
        console.log(`POST-CHECK live: 0 codigos del BOM obsoleto, ${nMat} materiales en recepcion`);
    },
);

finish(apply);
