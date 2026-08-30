/**
 * _mejorarViniloTelaPatagonia.mjs — los vinilos y telas de Patagonia pasan a tener el
 * repertorio de controles que Barack YA le aplica a estos materiales en otros proyectos.
 *
 * DE DONDE SALE — Fak: "antes ya se controlaban este tipo de vinilos, revisa planes de
 * control viejos o de otros proyectos". Tenia razon: la carpeta
 * `SGC-Recepcion\1 - Planes de control\VINILO\Patagonia\` esta vacia, pero en el resto de
 * `VINILO\` hay 19 planes de control de recepcion de vinilo/PVC y 8 de tela, de AMAROK,
 * MIRGOR, SMRC REYDEL, P703 FORD, GM BSUV, IP TAOS, THAINAM y VOLKSWAGEN.
 *
 * Medido sobre esos 19 planes, el repertorio real de la casa para un VINILO es:
 *
 *   Color / grabado          19/19 (100%)  Visual contra patron de aspecto
 *   Flamabilidad             19/19 (100%)  Camara de flamabilidad MC184 y/o certificado
 *   Espesor                  18/19         Calibre digital MC413 / medidor de espesores
 *   Peso / gramaje           13/19         Balanza
 *   Ancho de rollo            9/19         Cinta metrica MC406
 *   Lote / certificado        7/19         Certificado + visual, registro en ARB
 *   Peeling (SOLO bondeados)  2/19         Dinamometro — laboratorio externo
 *
 * Y para una TELA (8 planes: AUNDE, TNT, PUNZONADO, tejido):
 *   Color 8/8 · Flamabilidad 8/8 · Ancho 6/8 · Peso 6/8 · Espesor 4/8 · Lote 1/8
 *
 * Los AMFE tenian 3 o 4 de esas caracteristicas. Faltaban gramaje, ancho de rollo y —lo mas
 * importante— la ADHERENCIA del bondeado en el Insert, que usa vinilos de 1 mm de PVC sobre
 * 3 mm de PU: si el bondeado se despega, la pieza falla en uso. El peeling con dinamometro
 * es un control que Barack ya hacia en el apoyabrazos del P-21 y en el proyecto GM BSUV.
 *
 * Los instrumentos citados (MC184 camara de flamabilidad, MC413 calibre, MC406 cinta
 * metrica, balanza, dinamometro) NO son inventados: son los que figuran en esos mismos
 * planes de control, o sea equipos que Barack tiene.
 *
 * SIN VALORES: en el AMFE va metodo + instrumento + frecuencia + de que documento sale el
 * criterio (regla amfe.md §11). Las cotas viven en el Plan de Control.
 *
 * Solo se reescriben work elements con `_autoFilled: true`. Los que vienen del import
 * original ("Material: Tela termoformable", "Vinilo PVC Sansuy (narbe H)", "Piping PVC")
 * no se tocan.
 *
 * Uso:  node scripts/_mejorarViniloTelaPatagonia.mjs           (dry-run)
 *       node scripts/_mejorarViniloTelaPatagonia.mjs --apply
 */

import { randomUUID } from 'crypto';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import {
    connectSupabase, parseData, saveAmfe, calculateAP,
    syncLegacyFmFields, syncFieldAliases,
} from './_lib/amfeIo.mjs';

const PREV_P14 = 'Verificacion segun P-14';
const PREV_CERT = 'Certificado del proveedor por lote (P-14)';

const LOTE_SEGREGADO = 'Lote segregado en recepcion';
const LOTE_NO_CONFORME = 'Lote no conforme, material a segregar';
const RIESGO_USUARIO = 'Riesgo para la seguridad del usuario del vehiculo';

function mkCause({ desc, s, o, d, prev, det }) {
    const ap = calculateAP(s, o, d);
    return {
        id: randomUUID(),
        cause: desc, description: desc,
        severity: s, occurrence: o, detection: d,
        ap, actionPriority: ap, specialChar: '',
        preventionControl: prev, detectionControl: det,
        preventionAction: ap === 'H' ? 'Pendiente definicion equipo APQP' : '',
        detectionAction: '', optimizationAction: '',
        responsible: '', targetDate: '', status: '',
        _autoFilled: true,
    };
}

function mkFailure({ desc, local, next, end, causa, s, o, d, prev, det }) {
    return {
        id: randomUUID(),
        description: desc,
        effectLocal: local, effectNextLevel: next, effectEndUser: end,
        causes: [mkCause({ desc: causa, s, o, d, prev, det })],
    };
}

// ─── Las caracteristicas del repertorio, una funcion por cada una ───────────

const flColor = () => mkFailure({
    desc: 'Color o grabado fuera del patron de aspecto',
    local: LOTE_SEGREGADO,
    next: 'Diferencia de tono entre las piezas del conjunto',
    end: 'Apariencia despareja en el habitaculo',
    causa: 'Variacion de tono entre partidas del proveedor',
    s: 6, o: 3, d: 5, prev: PREV_P14,
    det: 'Inspeccion visual contra patron de aspecto conforme VW 50180, por lote de entrega (P-10/I)',
});

const flEspesor = () => mkFailure({
    desc: 'Espesor del material fuera de especificacion',
    local: LOTE_SEGREGADO,
    next: 'Variacion en el tapizado y en la costura',
    end: 'Arrugas o marcas visibles en la pieza',
    causa: 'Variacion del laminado en el proveedor',
    s: 5, o: 3, d: 4, prev: PREV_CERT,
    det: 'Medicion con calibre digital MC413 y certificado del proveedor, por lote de entrega (P-10/I)',
});

const flGramaje = () => mkFailure({
    desc: 'Gramaje del material fuera de especificacion',
    local: LOTE_SEGREGADO,
    next: 'Variacion de firmeza y de comportamiento en el tapizado',
    end: 'Tacto de la pieza distinto al aprobado por el cliente',
    causa: 'Variacion del proceso de laminado o de la base textil en el proveedor',
    s: 5, o: 3, d: 4, prev: PREV_CERT,
    det: 'Pesaje en balanza y certificado del proveedor, por lote de entrega (P-10/I)',
});

const flAncho = () => mkFailure({
    desc: 'Ancho del rollo menor al especificado',
    local: 'Rollo que no permite ubicar la tizada completa',
    next: 'Mayor desperdicio de material en el corte',
    end: 'Riesgo de faltante de material para cumplir el programa',
    causa: 'Variacion del corte del rollo en el proveedor',
    s: 4, o: 3, d: 4, prev: PREV_P14,
    det: 'Medicion con cinta metrica MC406 y certificado del proveedor, por lote de entrega (P-10/I)',
});

const flFlamabilidad = () => mkFailure({
    desc: 'Flamabilidad fuera de lo exigido por TL 1010 VW',
    local: LOTE_NO_CONFORME,
    next: 'Rechazo del ensayo de flamabilidad del conjunto',
    end: RIESGO_USUARIO,
    causa: 'Lote del proveedor sin ensayo de flamabilidad conforme',
    s: 9, o: 3, d: 4, prev: PREV_CERT,
    det: 'Ensayo en camara de flamabilidad MC184 y certificado del proveedor conforme TL 1010 VW, por entrega (P-10/I)',
});

/** Solo para vinilos BONDEADOS (PVC + espuma). Control que ya se hace en el P-21 y GM BSUV. */
const flPeeling = () => mkFailure({
    desc: 'Adherencia entre el PVC y la espuma del bondeado por debajo de lo especificado',
    local: LOTE_SEGREGADO,
    next: 'Delaminacion del vinilo durante el tapizado o el troquelado',
    end: 'Tapizado que se despega o burbujea en uso',
    causa: 'Falla del laminado en el proveedor',
    s: 7, o: 3, d: 5, prev: PREV_CERT,
    det: 'Ensayo de peeling con dinamometro en laboratorio externo y certificado del proveedor, por lote (P-10/I)',
});

const flLote = (mat) => mkFailure({
    desc: `Lote de ${mat} sin identificacion ni trazabilidad`,
    local: LOTE_SEGREGADO,
    next: 'Imposibilidad de acotar el alcance ante una no conformidad',
    end: 'Riesgo de campana ampliada por no poder identificar los vehiculos afectados',
    causa: 'Remito o certificado del proveedor incompleto',
    s: 6, o: 3, d: 4, prev: PREV_P14,
    det: 'Verificacion del certificado y la etiqueta, y registro de lote en el sistema ARB conforme VW 10500 (P-10/I)',
});

/** Repertorio segun el tipo de material. */
function fallasDe(tipo) {
    if (tipo === 'tela') {
        return [flColor(), flFlamabilidad(), flAncho(), flGramaje(), flEspesor(), flLote('tela')];
    }
    if (tipo === 'bondeado') {
        return [flColor(), flEspesor(), flGramaje(), flAncho(), flFlamabilidad(), flPeeling(), flLote('vinilo')];
    }
    return [flColor(), flEspesor(), flGramaje(), flAncho(), flFlamabilidad(), flLote('vinilo')];
}

const FN_DESC = {
    vinilo: 'Aportar el vinilo con el color, el espesor, el gramaje, el ancho y la flamabilidad especificados',
    bondeado: 'Aportar el vinilo bondeado con el color, el espesor, el gramaje, el ancho, la flamabilidad y la adherencia especificados',
    tela: 'Aportar la tela con el color, el gramaje, el ancho, el espesor y la flamabilidad especificados',
};

/** Decide el tipo por el nombre del work element. */
function tipoDe(nombre) {
    const n = nombre.toLowerCase();
    if (n.includes('bondeado')) return 'bondeado';
    if (n.startsWith('tela ')) return 'tela';
    return 'vinilo';
}

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, data, project_name')
    .like('project_name', 'VWA/PATAGONIA%');
if (error) throw error;

const plan = [];
const commits = [];
let totalWe = 0, totalAntes = 0, totalDespues = 0;

for (const row of rows) {
    const before = parseData(row.data);
    const doc = parseData(row.data);
    let tocados = 0;

    for (const op of doc.operations || []) {
        if (!/RECEPCION/i.test(op.name || op.operationName || '')) continue;
        for (const we of op.workElements || []) {
            const nombre = we.name || '';
            if (!/vinilo|tela |TPO/i.test(nombre)) continue;
            if (we._autoFilled !== true) continue;   // contenido original: no se toca

            const tipo = tipoDe(nombre);
            const antes = (we.functions || []).reduce((n, fn) => n + (fn.failures || []).length, 0);
            const fallas = fallasDe(tipo);
            we.functions = [{
                id: randomUUID(),
                description: FN_DESC[tipo], functionDescription: FN_DESC[tipo],
                requirements: '', failures: fallas,
            }];
            tocados++; totalWe++; totalAntes += antes; totalDespues += fallas.length;
            logChange(apply, `[${tipo}] "${nombre}": ${antes} -> ${fallas.length} modos de falla`, {});
        }
    }

    if (!tocados) continue;
    syncLegacyFmFields(doc);
    syncFieldAliases(doc);
    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: 'PATAGONIA', before, after: doc });
    commits.push(async () => {
        await saveAmfe(sb, row.id, doc);
        console.log(`POST-CHECK live ${row.amfe_number}: ${tocados} materiales de tapizado actualizados`);
    });
}

console.log(`\n  ${totalWe} work elements de vinilo/tela: ${totalAntes} -> ${totalDespues} modos de falla\n`);

await runWithValidation(plan, apply, async () => {
    for (const c of commits) await c();
});

finish(apply);
