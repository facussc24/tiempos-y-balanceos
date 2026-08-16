/**
 * _revisarAmfesApoyacabezasPatagonia.mjs — Recepcion de materiales en los 3 apoyacabezas
 * de Patagonia (delantero 2HC.881.901 RL1, trasero central 2HC.885.900 RL1,
 * trasero lateral 2HC.885.901 RL1).
 *
 * Pedido: Carlos Baptista — "Revisar AMFE de Patagonia y pasar a Calidad, hacer foco
 * en Recepcion de materiales" (Asaichi 10-11/08/2026). Sigue el molde del AMFE 150.
 *
 * TODO lo que se agrega sale de un documento real. Fuente por bloque:
 *
 *   [PdC]   Plan de Control VIGENTE "PC APOYACABEZAS Patagonia Delantero Rev0.xls",
 *           Rev 0 del 04/06/2026, equipo M. Nieve / M. Meszaros / N. Perez. Tiene 3
 *           hojas (PC DELANTERO, PC CENTRAL, PC LATERAL). Operacion 10 "Resepcion de
 *           materias primas" [sic]. Lo mando Nicolas Perez.
 *   [BOM]   bom_documents Supabase: BOM-VW-PAT-HRC-01/02/03, Rev V3.
 *   [LM]    LISTADO PC PATAGONIA.xlsx, hoja "agrupado APC" (SGC-Recepcion\1 - Planes de
 *           control). Da codigo interno, proveedor y construccion del material.
 *   [PC1063/1064/1065] Planes de Control de Recepcion de las estructuras de apoyacabezas,
 *           Rev A del 30/04/2026 — aportan las cotas que el PdC del producto no tiene.
 *   [H1043/H1063/H1064] Planes de Control de Recepcion de los hilos Linhanyl
 *           (FX284-E0PTO, FX483TK-11930E, FX483TK-11703E).
 *   [PC818/PC822] Planes de Control de Recepcion ISO-PLUS 1290 y POLI-PLUS FF-629 (Mas-Tin).
 *
 * NO se usa `cp_documents` de la app como fuente: esta cargado desde los Planes de Control
 * PRELIMINARES de abril 2025 (carpeta OBSOLETO), que describen materiales que ya no se usan.
 *
 * amfe.md §11: los valores numericos NO van en `failure.description` (van al Plan de Control).
 * La descripcion nombra el fenomeno; el numero real vive en el control detectivo cuando el
 * documento lo dice.
 * amfe.md §5: no se inventan acciones de optimizacion.
 * amfe.md §2 + core-prohibiciones §2: NO se asigna ninguna CC/SC. Va como hallazgo para Fak.
 *   (El PdC vigente no clasifica ni una sola caracteristica de recepcion en las 3 hojas.)
 *
 * Uso:  node scripts/_revisarAmfesApoyacabezasPatagonia.mjs           (dry-run)
 *       node scripts/_revisarAmfesApoyacabezasPatagonia.mjs --apply
 */

import { randomUUID } from 'crypto';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import {
    connectSupabase, parseData, saveAmfe, findOperation,
    syncLegacyFmFields, syncFieldAliases, calculateAP, countAmfeStats,
} from './_lib/amfeIo.mjs';

const PLACEHOLDER_APH = 'Pendiente definicion equipo APQP';
const FECHA_REV = '16/08/2026';

// ─── Constructores (identicos a _revisarAmfe150Patagonia.mjs) ───────────────

function mkCause({ desc, s, o, d, prev, det }) {
    const ap = calculateAP(s, o, d);
    return {
        id: randomUUID(),
        cause: desc,
        description: desc,
        severity: s,
        occurrence: o,
        detection: d,
        ap,
        actionPriority: ap,
        specialChar: '',
        preventionControl: prev,
        detectionControl: det,
        preventionAction: ap === 'H' ? PLACEHOLDER_APH : '',
        detectionAction: '',
        optimizationAction: '',
        responsible: '',
        targetDate: '',
        status: '',
        _autoFilled: true,
    };
}

function mkFailure({ desc, local, next, end, causa, s, o, d, prev, det }) {
    return {
        id: randomUUID(),
        description: desc,
        effectLocal: local,
        effectNextLevel: next,
        effectEndUser: end,
        causes: [mkCause({ desc: causa, s, o, d, prev, det })],
    };
}

function mkWorkElement({ name, fnDesc, failures }) {
    return {
        id: randomUUID(),
        name,
        type: 'Material',
        description: '',
        _autoFilled: true,
        functions: [{
            id: randomUUID(),
            description: fnDesc,
            functionDescription: fnDesc,
            requirements: '',
            failures,
        }],
    };
}

/**
 * `operation_count`, `cause_count`, `ap_h_count` y `ap_m_count` son COLUMNAS de
 * `amfe_documents`, no viven adentro de `data`. `saveAmfe()` escribe solo `data`, asi que
 * si no se pasan por `extraFields` quedan con el valor viejo y el auditor lo marca como
 * `metadata_desync`. Mismo caso que `revisions` (leccion del 14/08).
 */
function contarMetadata(doc) {
    let causas = 0, apH = 0, apM = 0;
    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fl of fn.failures || []) {
                    for (const cs of fl.causes || []) {
                        causas++;
                        if (cs.ap === 'H') apH++;
                        else if (cs.ap === 'M') apM++;
                    }
                }
            }
        }
    }
    return {
        operation_count: (doc.operations || []).length,
        cause_count: causas,
        ap_h_count: apH,
        ap_m_count: apM,
    };
}

// ─── Efectos reutilizables ──────────────────────────────────────────────────

const LOTE_SEGREGADO = 'Lote segregado en recepcion';
const LOTE_NO_CONFORME = 'Lote no conforme, material a segregar';
const RIESGO_USUARIO = 'Riesgo para la seguridad del usuario del vehiculo';

// Control preventivo generico autorizado para recepcion de materia prima (amfe.md §6).
const PREV_P14 = 'Verificacion segun P-14';
const PREV_CERT = 'Certificado del proveedor por lote (P-14)';

// ─── Materiales comunes a las 3 piezas — PdC vigente, items 1 a 9 ───────────

/** Un vinilo PVC. Los tres comparten caracteristicas; cambia el color. [PdC items 1-3] */
function weVinilo({ nombre, codigo, color, tecnicaEspesor, tecnicaFlama }) {
    return mkWorkElement({
        name: `${nombre} (codigo ${codigo})`,
        fnDesc: 'Aportar el vinilo con el grabado, el color, el espesor y la flamabilidad especificados',
        failures: [
            mkFailure({
                desc: 'Grabado o color del vinilo fuera de patron',
                local: LOTE_SEGREGADO,
                next: 'Diferencia de tono entre las piezas del conjunto',
                end: 'Apariencia despareja en el habitaculo',
                causa: 'Variacion de tono entre partidas del proveedor',
                s: 6, o: 3, d: 6,
                prev: PREV_P14,
                det: `Visual contra patron de tela, 1 pieza por entrega (P-10/I). Color ${color}`,
            }),
            mkFailure({
                desc: 'Espesor del vinilo fuera de tolerancia',
                local: LOTE_SEGREGADO,
                next: 'Variacion en el tapizado y en la costura',
                end: 'Arrugas o marcas visibles en la pieza',
                causa: 'Variacion del laminado en el proveedor',
                s: 5, o: 3, d: 5,
                prev: PREV_P14,
                det: tecnicaEspesor,
            }),
            mkFailure({
                desc: 'Flamabilidad del vinilo fuera de especificacion',
                local: LOTE_NO_CONFORME,
                next: 'Rechazo del ensayo de flamabilidad del conjunto',
                end: RIESGO_USUARIO,
                causa: 'Lote del proveedor sin ensayo de flamabilidad conforme',
                s: 9, o: 3, d: 4,
                prev: PREV_CERT,
                det: tecnicaFlama,
            }),
        ],
    });
}

/** Un hilo Linhanyl. [PdC items 5-7] + [H1043/H1063/H1064] para la flamabilidad. */
function weHilo({ nombre, codigo, articulo, metrico, color, planFlama }) {
    return mkWorkElement({
        name: `${nombre} (codigo ${codigo})`,
        fnDesc: 'Aportar el hilo con el articulo, el color y la cantidad de cabos especificados',
        failures: [
            mkFailure({
                desc: 'Color del hilo fuera de patron',
                local: LOTE_SEGREGADO,
                next: 'Costura con tono distinto al aprobado',
                end: 'Costura que desentona con el tapizado',
                causa: 'Variacion de tintura entre partidas del proveedor',
                s: 6, o: 3, d: 6,
                prev: PREV_P14,
                det: `Visual con patron de color, 1 muestra por lote (P-10/I). Color ${color}`,
            }),
            mkFailure({
                desc: 'Cantidad de cabos del hilo distinta a la especificada',
                local: LOTE_SEGREGADO,
                next: 'Resistencia de la costura fuera de lo previsto',
                end: 'Costura que se abre en uso',
                causa: 'Error de preparacion del pedido en el proveedor',
                s: 7, o: 2, d: 5,
                prev: PREV_P14,
                det: 'Visual, 1 muestra por lote (P-10/I). Cantidad de cabos: 3',
            }),
            mkFailure({
                desc: 'Articulo entregado distinto al pedido',
                local: LOTE_SEGREGADO,
                next: 'Hilo equivocado montado en la maquina de costura',
                end: 'Costura con hilo que no corresponde a la pieza',
                causa: 'Error de despacho del proveedor',
                s: 6, o: 3, d: 5,
                prev: PREV_P14,
                det: `Visual en etiqueta del material, 1 muestra por lote (P-10/I). Articulo ${articulo}, ${metrico}`,
            }),
            mkFailure({
                desc: 'Flamabilidad del hilo fuera de especificacion',
                local: LOTE_NO_CONFORME,
                next: 'Rechazo del ensayo de flamabilidad del conjunto',
                end: RIESGO_USUARIO,
                causa: 'Lote del proveedor sin ensayo de flamabilidad conforme',
                s: 9, o: 3, d: 5,
                prev: PREV_CERT,
                det: planFlama,
            }),
        ],
    });
}

/** Estructura metalica consignada por VWA. Cotas del plan de recepcion propio de cada pieza. */
function weVarilla({ nombre, codigoVw, codigoMaxus, plan, cotas }) {
    return mkWorkElement({
        name: `${nombre} ${codigoVw} (consignado VWA)`,
        fnDesc: 'Aportar la estructura con el cromado y las cotas especificadas',
        failures: [
            mkFailure({
                desc: 'Cromado de la estructura con rayas, manchas o falta de material',
                local: LOTE_SEGREGADO,
                next: 'Estructura visible con defecto en la pieza terminada',
                end: 'Defecto de aspecto en el apoyacabezas',
                causa: 'Defecto del proceso de cromado en el proveedor',
                s: 6, o: 3, d: 6,
                prev: PREV_P14,
                det: `Patron de aspecto, 3% del lote por entrega (${plan})`,
            }),
            mkFailure({
                desc: 'Cotas de la estructura fuera de tolerancia',
                local: LOTE_SEGREGADO,
                next: 'La estructura no encastra en el molde de espumado',
                end: 'Apoyacabezas que no entra o queda flojo en el asiento',
                causa: 'Variacion del conformado en el proveedor',
                s: 7, o: 3, d: 5,
                prev: PREV_P14,
                det: `Calibre digital, 3% del lote por entrega (${plan}). Cotas: ${cotas}`,
            }),
        ],
    });
}

const WE_COMUNES = () => [
    // [PdC item 1] + [LM] codigo y proveedor
    weVinilo({
        nombre: 'Vinilo PVC Titan Black H narbe (Sansuy BAH RL1)',
        codigo: '427VIN014COR01',
        color: 'Titan Black',
        tecnicaEspesor: 'Calibre MC 212, 1 pieza por entrega (P-10/I)',
        tecnicaFlama: 'Camara de flamabilidad MC 184, 1 pieza por entrega (P-10/I)',
    }),
    // [PdC item 2] — el PdC pide flamabilidad pero NO lista la camara entre sus tecnicas.
    // Se deja lo que el documento dice y el faltante va como hallazgo.
    weVinilo({
        nombre: 'Vinilo PVC Andino Gray ST Haptik',
        codigo: '427VIN016COR01',
        color: 'Andino Gray',
        tecnicaEspesor: 'Calibre MC 212, 1 pieza por entrega (P-10/I)',
        tecnicaFlama: 'Certificado del proveedor, 1 pieza por entrega (P-10/I)',
    }),
    // [PdC item 3]
    weVinilo({
        nombre: 'Vinilo PVC Dark Slate ML14',
        codigo: '427VIN017COR01',
        color: 'Dark Slate',
        tecnicaEspesor: 'Calibre, 1 pieza por entrega (P-10/I)',
        tecnicaFlama: 'Camara de flamabilidad, 1 pieza por entrega (P-10/I)',
    }),
    // [PdC item 4] — el unico material que lista Gramaje como caracteristica propia
    mkWorkElement({
        name: 'Tela Jacquard Woven Rennes Black Melange TPB-8VA (codigo 427TEL001COR01)',
        fnDesc: 'Aportar la tela con el color, el espesor, el gramaje y la flamabilidad especificados',
        failures: [
            mkFailure({
                desc: 'Grabado o color de la tela fuera de patron',
                local: LOTE_SEGREGADO,
                next: 'Diferencia de tono entre las piezas del conjunto',
                end: 'Apariencia despareja en el habitaculo',
                causa: 'Variacion de tono entre partidas del proveedor',
                s: 6, o: 3, d: 6,
                prev: PREV_P14,
                det: 'Visual contra patron de tela, 1 pieza por entrega (P-10/I)',
            }),
            mkFailure({
                desc: 'Espesor de la tela fuera de tolerancia',
                local: LOTE_SEGREGADO,
                next: 'Variacion en el tapizado y en la costura',
                end: 'Arrugas o marcas visibles en la pieza',
                causa: 'Variacion del laminado en el proveedor',
                s: 5, o: 3, d: 5,
                prev: PREV_P14,
                det: 'Calibre, 1 pieza por entrega (P-10/I)',
            }),
            mkFailure({
                desc: 'Gramaje de la tela fuera de especificacion',
                local: LOTE_SEGREGADO,
                next: 'Variacion de la firmeza y del comportamiento en costura',
                end: 'Tacto distinto al aprobado por el cliente',
                causa: 'Variacion del proceso de tejido en el proveedor',
                s: 5, o: 3, d: 6,
                prev: PREV_P14,
                det: 'Balanza, 1 pieza por entrega (P-10/I). Minimo 800 - maximo 1000 GMS/MT2',
            }),
            mkFailure({
                desc: 'Flamabilidad de la tela fuera de especificacion',
                local: LOTE_NO_CONFORME,
                next: 'Rechazo del ensayo de flamabilidad del conjunto',
                end: RIESGO_USUARIO,
                causa: 'Lote del proveedor sin ensayo de flamabilidad conforme',
                s: 9, o: 3, d: 4,
                prev: PREV_CERT,
                det: 'Camara de flamabilidad, 1 pieza por entrega (P-10/I)',
            }),
        ],
    }),
    // [PdC item 5] + [H1043]
    weHilo({
        nombre: 'Hilo de union 30/3 Jet Black (Linhanyl)',
        codigo: '427HIL001COS01',
        articulo: 'FX284TK-E0PTO segun el Plan de Control del producto (FX284-E0PTO segun el plan de recepcion 1043)',
        metrico: '30/3 Nm',
        color: 'Jet Black Pantone 19-0303 TPG',
        planFlama: 'Certificado del proveedor conforme Norma VW 50106, anual (P-10/I y ARB). 100 mm/min segun el plan 1043',
    }),
    // [PdC item 6] + [H1063]
    weHilo({
        nombre: 'Hilo vista 20/3 Alpe Gray (Linhanyl)',
        codigo: '427HIL003COS01',
        articulo: 'FX483TK-11930E',
        metrico: '20/3 Nm',
        color: 'Alpe Gray TGA IP3',
        planFlama: 'Certificado de calidad del proveedor, anual (P-10/I y ARB). Menor a 100 mm/min segun el plan 1063',
    }),
    // [PdC item 7] + [H1064]
    weHilo({
        nombre: 'Hilo vista 20/3 Gray Violet (Linhanyl)',
        codigo: '427HIL004COS01',
        articulo: 'FX483TK-11703E',
        metrico: '20/3 Nm',
        color: 'Gray Violet Pantone 14-4103 TPG (el Plan de Control lo llama TGA AT2)',
        planFlama: 'Certificado de calidad del proveedor, anual (P-10/I y ARB). Menor a 100 mm/min segun el plan 1064',
    }),
    // [PdC item 8] + [PC822]
    mkWorkElement({
        name: 'Poliol POLI-PLUS FF 629 (Mas-Tin)',
        fnDesc: 'Aportar el poliol dentro de los parametros del certificado del proveedor',
        failures: [
            mkFailure({
                desc: 'Poliol recibido vencido',
                local: LOTE_NO_CONFORME,
                next: 'Espuma fuera de densidad o con reaccion incompleta',
                end: 'Apoyacabezas con firmeza fuera de estandar',
                causa: 'Rotacion de stock inadecuada en el proveedor',
                s: 6, o: 3, d: 4,
                prev: PREV_CERT,
                det: 'Certificado del proveedor, 1 muestra por entrega (P-10/I)',
            }),
            mkFailure({
                desc: 'Viscosidad del poliol fuera de especificacion',
                local: LOTE_NO_CONFORME,
                next: 'Dosificacion despareja en la inyeccion de PU',
                end: 'Zonas blandas o duras en el apoyacabezas',
                causa: 'Variacion de la formulacion en el proveedor',
                s: 6, o: 3, d: 5,
                prev: PREV_CERT,
                det: 'Certificado del proveedor, 1 muestra por entrega (P-10/I). Viscosidad poliol 1200-2000',
            }),
            mkFailure({
                desc: 'Densidad libre del poliol fuera de especificacion',
                local: LOTE_NO_CONFORME,
                next: 'Densidad de la espuma fuera de lo previsto',
                end: 'Confort del apoyacabezas distinto al aprobado',
                causa: 'Variacion de la formulacion en el proveedor',
                s: 6, o: 3, d: 5,
                prev: PREV_CERT,
                det: 'Certificado del proveedor, 1 muestra por entrega (P-10/I). Densidad libre 55-85',
            }),
            mkFailure({
                desc: 'Tiempo de pegajosidad del poliol fuera de especificacion',
                local: LOTE_NO_CONFORME,
                next: 'Desmoldeo antes o despues de tiempo',
                end: 'Deformacion permanente del apoyacabezas',
                causa: 'Variacion de la formulacion en el proveedor',
                s: 6, o: 3, d: 5,
                prev: PREV_CERT,
                det: 'Certificado del proveedor, 1 muestra por entrega (P-10/I). Tiempo de pegajosidad 80-120',
            }),
            mkFailure({
                desc: 'Tiempo de crema del poliol fuera de especificacion',
                local: LOTE_NO_CONFORME,
                next: 'Llenado incompleto del molde',
                end: 'Apoyacabezas con zonas huecas',
                causa: 'Variacion de la formulacion en el proveedor',
                s: 6, o: 3, d: 5,
                prev: PREV_CERT,
                det: 'Certificado del proveedor, 1 muestra por entrega (P-10/I). Tiempo de crema 12-18',
            }),
        ],
    }),
    // [PdC item 9] + [PC818]
    mkWorkElement({
        name: 'Isocianato ISO-PLUS 1290 (Mas-Tin)',
        fnDesc: 'Aportar el isocianato dentro de los parametros del certificado del fabricante',
        failures: [
            mkFailure({
                desc: 'Isocianato recibido vencido',
                local: LOTE_NO_CONFORME,
                next: 'Reaccion incompleta en la inyeccion de PU',
                end: 'Apoyacabezas con firmeza fuera de estandar',
                causa: 'Rotacion de stock inadecuada en el proveedor',
                s: 6, o: 3, d: 4,
                prev: PREV_CERT,
                det: 'Certificado del fabricante y visual en etiqueta, 1 muestra por lote de entrega (P-10/I y ARB)',
            }),
            mkFailure({
                desc: 'Contenido de NCO fuera de especificacion',
                local: LOTE_NO_CONFORME,
                next: 'Relacion de mezcla desbalanceada en la inyeccion de PU',
                end: 'Apoyacabezas con dureza fuera de estandar',
                causa: 'Variacion de la sintesis en el proveedor',
                s: 7, o: 3, d: 4,
                prev: PREV_CERT,
                det: 'Certificado del fabricante segun ASTM D5155, 1 muestra por lote (P-10/I y ARB). NCO 25,5% a 26,5%',
            }),
            mkFailure({
                desc: 'Viscosidad del isocianato fuera de especificacion',
                local: LOTE_NO_CONFORME,
                next: 'Dosificacion despareja en la inyeccion de PU',
                end: 'Zonas blandas o duras en el apoyacabezas',
                causa: 'Variacion de la sintesis en el proveedor',
                s: 6, o: 3, d: 5,
                prev: PREV_CERT,
                det: 'Certificado del fabricante segun MI-IG-08-04, 1 muestra por lote (P-10/I y ARB). 300 cps a 500 cps',
            }),
            mkFailure({
                desc: 'Densidad del isocianato fuera de especificacion',
                local: LOTE_NO_CONFORME,
                next: 'Relacion de mezcla desbalanceada en la inyeccion de PU',
                end: 'Confort del apoyacabezas distinto al aprobado',
                causa: 'Variacion de la sintesis en el proveedor',
                s: 6, o: 3, d: 5,
                prev: PREV_CERT,
                det: 'Certificado del fabricante segun MI-IG-08-03, 1 muestra por lote (P-10/I y ARB). 1,2 +/- 0,05 gr/cm3',
            }),
        ],
    }),
    // [BOM] — entra en las 3 piezas y NO figura en el Plan de Control de ninguna.
    // amfe.md §6: sin documento que defina el control, va el generico de recepcion y TBD.
    mkWorkElement({
        name: 'Cinta TPU Foam barrier tape (codigo TBD)',
        fnDesc: 'Aportar la cinta barrera de TPU segun especificacion',
        failures: [
            mkFailure({
                desc: 'Cinta TPU no conforme a especificacion',
                local: LOTE_SEGREGADO,
                next: 'Barrera despareja entre la espuma y la funda',
                end: 'Marcas o durezas localizadas en el apoyacabezas',
                causa: 'Material sin plan de control de recepcion definido',
                s: 5, o: 4, d: 8,
                prev: PREV_P14,
                det: 'TBD — el material no figura en el Plan de Control de recepcion',
            }),
        ],
    }),
];

// ─── Especificos por pieza ──────────────────────────────────────────────────

const AMFES = [
    {
        amfeNumber: 'AMFE-HF-PAT',
        producto: 'HEADREST_FRONT',
        etiqueta: 'Apoyacabezas delantero 2HC.881.901 RL1',
        itemsPdC: 11,
        propios: () => [
            // [PdC DELANTERO item 10] — la fila esta VACIA en el documento: sin caracteristica,
            // especificacion, tecnica, muestra, frecuencia, metodo ni plan de reaccion.
            // No hay plan de recepcion propio. Por eso el control va TBD (amfe.md §6).
            mkWorkElement({
                name: 'Soporte apoyacabezas EPP 2HC.881.915 (consignado VWA)',
                fnDesc: 'Aportar el armazon interior de EPP segun especificacion',
                failures: [
                    mkFailure({
                        desc: 'Armazon de EPP no conforme a especificacion',
                        local: LOTE_SEGREGADO,
                        next: 'Armazon que no posiciona bien dentro del molde de espumado',
                        end: 'Apoyacabezas con forma o firmeza fuera de estandar',
                        causa: 'Componente sin control de recepcion definido',
                        s: 6, o: 4, d: 8,
                        prev: PREV_P14,
                        det: 'TBD — la fila del Plan de Control esta vacia y no hay plan de recepcion propio',
                    }),
                ],
            }),
            // [PdC DELANTERO item 11] + [PC1064]. OJO: PC1064 lleva el codigo 2HC.885.915,
            // que no es el de esta varilla (2HC.881.937) ni el del soporte (2HC.881.915).
            weVarilla({
                nombre: 'Varilla POLE HEADREST',
                codigoVw: '2HC.881.937',
                codigoMaxus: 'C00686689',
                plan: 'P-10/I, plan de recepcion 1064',
                cotas: 'diametro 90 mm, cota 130 mm, diametro 14 mm +0,05 -0,1 mm',
            }),
        ],
    },
    {
        amfeNumber: 'AMFE-HRC-PAT',
        producto: 'HEADREST_REAR_CEN',
        etiqueta: 'Apoyacabezas trasero central 2HC.885.900 RL1',
        itemsPdC: 10,
        propios: () => [
            // [PdC CENTRAL item 10] + [PC1063]
            weVarilla({
                nombre: 'Varilla HEADREST FRAME',
                codigoVw: '2HC.885.942',
                codigoMaxus: 'C00683052',
                plan: 'P-10/I, plan de recepcion 1063',
                cotas: 'diametro 7 mm +/- 0,1 mm, cota 167 mm, diametro 12,7 mm +0,02 -0,1 mm, cota 80 mm +/- 1 mm, cota 6,8 mm +/- 1 mm',
            }),
        ],
    },
    {
        amfeNumber: 'AMFE-HRO-PAT',
        producto: 'HEADREST_REAR_OUT',
        etiqueta: 'Apoyacabezas trasero lateral 2HC.885.901 RL1',
        itemsPdC: 10,
        propios: () => [
            // [PdC LATERAL item 10] + [PC1065]
            weVarilla({
                nombre: 'Varilla HEADREST FRAME',
                codigoVw: '2HC.885.941',
                codigoMaxus: 'C00683050',
                plan: 'P-10/I, plan de recepcion 1065',
                cotas: 'cota 102,6 mm, cota 7 +/- 0,1 mm, cota 130 +/- 1 mm, cota 12,75 +0,02 -0,1 mm',
            }),
        ],
    },
];

const DESC_REV =
    'REVISION CON FOCO EN RECEPCION DE MATERIALES (PEDIDO DE GERENCIA, ASAICHI 10-11/08/2026). '
    + 'SE AMPLIA LA OPERACION 10 A UN RENGLON POR CADA MATERIAL QUE ENTRA, CONTRA EL PLAN DE CONTROL '
    + 'REV 0 DEL 04/06/2026, LA LISTA DE MATERIALES REV V3 Y LOS PLANES DE CONTROL DE RECEPCION DEL SGC.';

// ─── Main ───────────────────────────────────────────────────────────────────

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const plan = [];
const commits = [];

for (const cfg of AMFES) {
    const { data: rows, error } = await sb
        .from('amfe_documents')
        .select('id, amfe_number, data, revisions')
        .eq('amfe_number', cfg.amfeNumber);
    if (error) throw error;
    if (!rows || rows.length !== 1) {
        throw new Error(`Esperaba 1 fila para ${cfg.amfeNumber}, hay ${rows?.length}`);
    }

    const row = rows[0];
    const before = parseData(row.data);
    const after = JSON.parse(JSON.stringify(before));
    const statsBefore = countAmfeStats(before);

    console.log(`\n${'='.repeat(72)}\n${cfg.amfeNumber} — ${cfg.etiqueta}\n${'='.repeat(72)}`);

    const op10 = findOperation(after, '10')
        || after.operations.find(o => /RECEPCION/i.test(o.name || o.operationName || ''));
    if (!op10) throw new Error(`${cfg.amfeNumber}: no se encontro la operacion de recepcion`);
    if (!Array.isArray(op10.workElements)) op10.workElements = [];

    const previos = new Set(op10.workElements.map(w => (w.name || '').toLowerCase()));
    const nuevos = [...WE_COMUNES(), ...cfg.propios()];

    let agregados = 0;
    for (const we of nuevos) {
        if (previos.has(we.name.toLowerCase())) {
            console.log(`  (ya existe, se omite) "${we.name}"`);
            continue;
        }
        op10.workElements.push(we);
        agregados++;
        logChange(apply, `OP10 + WE [Material] "${we.name}"`, {
            fallas: we.functions[0].failures.length,
            detalle: we.functions[0].failures.map(f => f.description).join(' | '),
        });
    }

    // Control de cobertura: los renglones de material tienen que dar la cuenta del PdC + la
    // cinta TPU, que el Plan de Control no cubre pero la lista de materiales si.
    const nMaterial = op10.workElements.filter(w => w.type === 'Material').length;
    console.log(`  -> work elements Material en recepcion: ${nMaterial} (agregados ${agregados})`);

    // Fila de revision. `revisions` es COLUMNA de amfe_documents, no vive dentro de `data`.
    const revsBefore = (() => {
        const raw = row.revisions;
        if (Array.isArray(raw)) return raw;
        try { const p = JSON.parse(raw || '[]'); return Array.isArray(p) ? p : []; } catch { return []; }
    })();
    const revisions = revsBefore.slice();
    const filaRev = {
        rev: after.header?.rev || 'A',
        date: FECHA_REV,
        item: '10',
        description: DESC_REV,
        pswDate: '',
        modifiedBy: 'FS',
    };
    if (!revisions.some(r => r.date === filaRev.date)) {
        revisions.push(filaRev);
        after.revisions = revisions;
        logChange(apply, `Fila de revision ${FECHA_REV}`);
    }

    syncLegacyFmFields(after);
    syncFieldAliases(after);

    const statsAfter = countAmfeStats(after);
    console.log('  --- conteo before -> after ---');
    for (const k of Object.keys(statsAfter)) {
        const b = statsBefore[k], a = statsAfter[k];
        if (a !== b) console.log(`    ${k.padEnd(16)} ${String(b).padStart(4)} -> ${String(a).padStart(4)}  (${a - b > 0 ? '+' : ''}${a - b})`);
    }

    plan.push({ id: row.id, amfeNumber: cfg.amfeNumber, productName: cfg.producto, before, after });
    commits.push({ id: row.id, after, amfeNumber: cfg.amfeNumber });
}

await runWithValidation(plan, apply, async () => {
    for (const c of commits) {
        await saveAmfe(sb, c.id, c.after, {
            expectedAmfeNumber: c.amfeNumber,
            extraFields: {
                revisions: JSON.stringify(c.after.revisions),
                ...contarMetadata(c.after),
            },
        });
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', c.id).single();
        const relido = parseData(chk.data);
        if (typeof relido !== 'object' || !Array.isArray(relido.operations)) {
            throw new Error(`POST-CHECK FALLO en ${c.amfeNumber}: data no es objeto con operations[]`);
        }
        if (relido.operations.length !== c.after.operations.length) {
            throw new Error(`POST-CHECK FALLO en ${c.amfeNumber}: ops live=${relido.operations.length} esperado=${c.after.operations.length}`);
        }
        console.log(`POST-CHECK live ${c.amfeNumber}: ops=${relido.operations.length} ${JSON.stringify(countAmfeStats(relido))}`);
    }
});

finish(apply);
