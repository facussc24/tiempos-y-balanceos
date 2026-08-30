/**
 * _completarEppApoyacabezas.mjs — controles de recepcion del soporte de EPP del
 * apoyacabezas delantero (2HC.881.915, consignado VWA).
 *
 * QUE RESUELVE
 * En el Plan de Control del producto, la fila de este componente esta VACIA de punta a
 * punta: sin caracteristica, especificacion, tecnica, muestra, frecuencia, metodo ni plan
 * de reaccion. Solo tiene el nombre. En el central y el lateral la fila equivalente si esta
 * completa. Por eso el AMFE habia quedado con un solo modo de falla y el control en TBD.
 *
 * DE DONDE SALEN LOS CONTROLES — no se inventan
 * Del **Plan de Control PRELIMINAR** del apoyacabezas delantero
 * (`OBSOLETO\Proyecto patagonia obsoleto\Headrest\13-Plan de control\
 *   PATAGONIA_FRONT_HEADREST_L0_PdC preliminar.pdf`, Rev 0 del 10/04/2025), item 4:
 * "Componente consignado VWA C00686690 — Armazon interior (EPP)". Ahi si estan las cuatro
 * caracteristicas que se le controlan:
 *
 *     Tipo de Producto        EPP                              Visual identificacion en pieza
 *     Color                   TBD                              Patron de aspecto
 *     Dimensional de control  Segun informe del proveedor      Certificado del proveedor
 *     Aspecto                 libre de rebaba, marcas de herramental, deformaciones,
 *                             rechupe, bordes afilados, aceite, grasa
 *
 * El preliminar esta obsoleto como Plan de Control (describe materiales que ya no se usan),
 * pero ESTE componente es el mismo: sigue siendo el armazon de EPP consignado por VW. Se
 * toma de ahi el QUE se controla, y el COMO del patron que ya usa la varilla del mismo
 * apoyacabezas (plan de recepcion 1064): 3% del lote por entrega, P-10/I, reaccion P-14.
 *
 * El COLOR queda en TBD porque el preliminar tambien lo tiene en TBD. No se completa.
 *
 * S/O/D: se replican los del componente hermano (la varilla, plan 1064) que ya esta
 * calibrado en este mismo AMFE — mismo tipo de componente, mismo proveedor (VW consignado),
 * misma frecuencia de control.
 *
 * Uso:  node scripts/_completarEppApoyacabezas.mjs           (dry-run)
 *       node scripts/_completarEppApoyacabezas.mjs --apply
 */

import { randomUUID } from 'crypto';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import {
    connectSupabase, parseData, saveAmfe, calculateAP,
    syncLegacyFmFields, syncFieldAliases,
} from './_lib/amfeIo.mjs';

const WE_EPP = 'Soporte apoyacabezas EPP 2HC.881.915 (consignado VWA)';

const PREV = 'Certificado del proveedor por lote (P-14). Componente consignado por el cliente';
const MUESTRA = '3% del lote por entrega (P-10/I)';

function mkCause({ desc, s, o, d, det }) {
    const ap = calculateAP(s, o, d);
    return {
        id: randomUUID(),
        cause: desc, description: desc,
        severity: s, occurrence: o, detection: d,
        ap, actionPriority: ap,
        specialChar: '',
        preventionControl: PREV,
        detectionControl: det,
        preventionAction: ap === 'H' ? 'Pendiente definicion equipo APQP' : '',
        detectionAction: '', optimizationAction: '',
        responsible: '', targetDate: '', status: '',
        _autoFilled: true,
    };
}

function mkFailure({ desc, local, next, end, causa, s, o, d, det }) {
    return {
        id: randomUUID(),
        description: desc,
        effectLocal: local, effectNextLevel: next, effectEndUser: end,
        causes: [mkCause({ desc: causa, s, o, d, det })],
    };
}

/** Las cuatro caracteristicas del PdC preliminar + trazabilidad. */
const FALLAS = () => [
    mkFailure({
        desc: 'Armazon entregado con un tipo de producto distinto al especificado',
        local: 'Lote segregado en recepcion',
        next: 'Espumado sobre un armazon que no corresponde a la pieza',
        end: 'Apoyacabezas con firmeza y geometria fuera de lo aprobado',
        causa: 'Error de despacho o de identificacion en el proveedor',
        s: 7, o: 3, d: 5,
        det: `Verificacion visual de la identificacion en la pieza, ${MUESTRA}`,
    }),
    mkFailure({
        desc: 'Color del armazon fuera del patron',
        local: 'Lote segregado en recepcion',
        next: 'Diferencia de tono visible si el armazon queda a la vista',
        end: 'Defecto de apariencia en el habitaculo',
        causa: 'Variacion de tono entre partidas del proveedor',
        s: 4, o: 3, d: 5,
        det: `Verificacion contra patron de aspecto, ${MUESTRA}`,
    }),
    mkFailure({
        desc: 'Cotas del armazon fuera de lo declarado por el proveedor',
        local: 'Lote segregado en recepcion',
        next: 'Armazon que no calza en las guias del molde de espumado',
        end: 'Apoyacabezas descentrado o con geometria incorrecta',
        causa: 'Variacion del proceso de moldeo del EPP en el proveedor',
        s: 7, o: 3, d: 5,
        det: `Verificacion del informe de control dimensional del proveedor, por lote (P-10/I)`,
    }),
    mkFailure({
        desc: 'Armazon con rebaba, marcas de herramental, deformacion, rechupe o bordes afilados',
        local: 'Lote segregado en recepcion',
        next: 'Armazon que no asienta bien en el molde o daña la funda al espumar',
        end: 'Defecto visible o al tacto en la pieza terminada',
        causa: 'Desgaste del herramental de moldeo en el proveedor',
        s: 6, o: 3, d: 5,
        det: `Verificacion contra patron de aspecto, ${MUESTRA}`,
    }),
    mkFailure({
        desc: 'Lote de armazon sin identificacion ni trazabilidad',
        local: 'Lote segregado en recepcion',
        next: 'Imposibilidad de acotar el alcance ante una no conformidad',
        end: 'Riesgo de campana ampliada por no poder identificar los vehiculos afectados',
        causa: 'Remito o certificado del proveedor incompleto',
        s: 6, o: 3, d: 4,
        det: 'Verificacion de remito, lote y fecha en el sistema ARB (P-10/I)',
    }),
];

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents').select('id, amfe_number, data').eq('amfe_number', 'AMFE-HF-PAT').limit(1);
if (error) throw error;
const row = rows[0];
const before = parseData(row.data);
const doc = parseData(row.data);

let encontrado = false;
for (const op of doc.operations || []) {
    if (!/RECEPCION/i.test(op.name || op.operationName || '')) continue;
    for (const we of op.workElements || []) {
        if ((we.name || '').toLowerCase() !== WE_EPP.toLowerCase()) continue;
        if (we._autoFilled !== true) {
            throw new Error('El work element del EPP no es autogenerado: no se pisa contenido cargado a mano.');
        }
        const antes = (we.functions || []).reduce((n, fn) => n + (fn.failures || []).length, 0);
        we.functions = [{
            id: randomUUID(),
            description: 'Aportar el armazon de EPP conforme a plano, libre de defectos de aspecto y trazable',
            functionDescription: 'Aportar el armazon de EPP conforme a plano, libre de defectos de aspecto y trazable',
            requirements: '',
            failures: FALLAS(),
        }];
        encontrado = true;
        logChange(apply, `EPP 2HC.881.915: ${antes} -> ${we.functions[0].failures.length} modos de falla`, {
            detalle: we.functions[0].failures.map(f => f.description).join(' | '),
        });
    }
}
if (!encontrado) throw new Error(`No se encontro el work element "${WE_EPP}"`);

// El export lee severity/occurrence/detection del nivel FAILURE, no de la causa. Sin este
// sync las 5 celdas salen VACIAS en el PDF. Lo cazo `runWithValidation` con 5
// FM_LEGACY_EMPTY_BUT_CAUSE_HAS_VALUE y bloqueo el --apply, que es exactamente para lo que
// esta el gate.
syncLegacyFmFields(doc);
syncFieldAliases(doc);

await runWithValidation(
    [{ id: row.id, amfeNumber: 'AMFE-HF-PAT', productName: 'APC DELANTERO', before, after: doc }],
    apply,
    async () => {
        await saveAmfe(sb, row.id, doc);
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
        const live = parseData(chk.data);
        let n = 0, tbd = 0;
        for (const op of live.operations || []) {
            for (const we of op.workElements || []) {
                if ((we.name || '').toLowerCase() !== WE_EPP.toLowerCase()) continue;
                for (const fn of we.functions || []) {
                    for (const fl of fn.failures || []) {
                        n++;
                        for (const cs of fl.causes || []) {
                            if (/TBD/i.test(cs.detectionControl || '')) tbd++;
                        }
                    }
                }
            }
        }
        console.log(`POST-CHECK live: EPP con ${n} modos de falla, ${tbd} controles en TBD`);
        if (tbd > 0) throw new Error('quedaron controles en TBD');
    },
);

finish(apply);
