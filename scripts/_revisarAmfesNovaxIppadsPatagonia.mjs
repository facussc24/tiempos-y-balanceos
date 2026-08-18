/**
 * _revisarAmfesNovaxIppadsPatagonia.mjs — Recepcion de materiales en los 4 AMFE de
 * Patagonia que faltaban: Top Roll, Armrest Door Panel e Insert (NOVAX) + IP Pads (VWA).
 *
 * Pedido: Carlos Baptista — "Revisar AMFE de Patagonia y pasar a Calidad, hacer foco
 * en Recepcion de materiales" (Asaichi 10-11/08/2026). Continua el trabajo del APB
 * Trasero Central (AMFE 150, 14/08) y de los 3 apoyacabezas (16/08).
 *
 * DE DONDE SALE CADA DATO
 *
 *   [BOM]  bom_documents Supabase: BOM-NOVAX-001 (Top Roll), BOM-NOVAX-002 (Insert),
 *          BOM-NOVAX-003 (Armrest Door Panel) Rev.11; BOM-VW-PAT-IPPAD V3.
 *          Da QUE entra y con que codigo. Se consolida por MATERIAL DISTINTO, no por
 *          linea: el Insert tiene 157 lineas porque repite material por mano y por nivel.
 *          Los codigos `INY-` `COR-` `COS-` `TRO-` son semielaborados que fabrica Barack:
 *          NO entran por recepcion.
 *   [VW]   Normas del cliente citadas en el Plan de Control: TL 1010 VW (flamabilidad),
 *          VW 50180 (color y aspecto), VW 10500 (identificacion y trazabilidad de lote).
 *   [SGC]  Planes de Control de Recepcion por material del SGC:
 *          1043 / 1063 / 1064 hilos Linhanyl (FX284-E0PTO, FX483TK-11930E, FX483TK-11703E).
 *   [P]    Procedimientos: P-14 (no conformidad y accion correctiva), P-10/I (inspeccion
 *          y ensayos, Anexo I = registro individual de control) + sistema ARB.
 *
 * NO se usa `cp_documents` de la app como fuente de componentes: igual que en los
 * apoyacabezas, sus "caracteristicas" son causas de falla copiadas del AMFE
 * ("mala estiba", "ambiente sucio en planta del proveedor") y sus componentes son
 * genericos sin codigo ("PVC/Vinilo", "PVC/Vinilo TL 520 94K"). Solo se le toman las
 * NORMAS que cita, que si son dato real.
 *
 * DONDE VAN LOS NUMEROS — regla `rules/amfe.md` §11 (resuelta el 16/08/2026 contra el
 * manual de AMFE y el instructivo interno del SGC): en el control va METODO + INSTRUMENTO
 * + FRECUENCIA + de que documento sale el criterio. El VALOR no va: el formulario de AMFE
 * no tiene columna de especificacion, el de Plan de Control si.
 * Enforcement: check `CONTROL_CON_VALOR` en `scripts/_lib/amfeValidator.mjs`.
 *
 * amfe.md §5: no se inventan acciones de optimizacion.
 * amfe.md §2 + core-prohibiciones §2: NO se asigna ninguna CC/SC. Va como hallazgo.
 * amfe.md §9: 1 material por work element, prohibido agrupar varios en uno.
 *
 * Uso:  node scripts/_revisarAmfesNovaxIppadsPatagonia.mjs           (dry-run)
 *       node scripts/_revisarAmfesNovaxIppadsPatagonia.mjs --apply
 */

import { randomUUID } from 'crypto';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import {
    connectSupabase, parseData, saveAmfe, findOperation,
    syncLegacyFmFields, syncFieldAliases, calculateAP,
} from './_lib/amfeIo.mjs';

const PLACEHOLDER_APH = 'Pendiente definicion equipo APQP';
const FECHA_REV = '17/08/2026';
const DESC_REV =
    'REVISION CON FOCO EN RECEPCION DE MATERIALES (PEDIDO DE GERENCIA, ASAICHI 10-11/08/2026). '
    + 'SE AMPLIA LA OPERACION 10 A UN RENGLON POR MATERIAL DE LA LISTA DE MATERIALES, CON SU '
    + 'CONTROL PREVENTIVO Y DETECTIVO.';

// ─── Constructores ──────────────────────────────────────────────────────────

function mkCause({ desc, s, o, d, prev, det }) {
    const ap = calculateAP(s, o, d);
    return {
        id: randomUUID(),
        cause: desc,
        description: desc,
        severity: s, occurrence: o, detection: d,
        ap, actionPriority: ap,
        specialChar: '',
        preventionControl: prev,
        detectionControl: det,
        preventionAction: ap === 'H' ? PLACEHOLDER_APH : '',
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

function mkWorkElement({ name, fnDesc, failures }) {
    return {
        id: randomUUID(),
        name, type: 'Material', description: '', _autoFilled: true,
        functions: [{
            id: randomUUID(),
            description: fnDesc, functionDescription: fnDesc,
            requirements: '', failures,
        }],
    };
}

/** Columnas de `amfe_documents` que NO viven adentro de `data` (leccion 14/08). */
function contarMetadata(doc) {
    let causas = 0, apH = 0, apM = 0;
    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fl of fn.failures || []) {
                    for (const cs of fl.causes || []) {
                        causas++;
                        if (cs.ap === 'H') apH++; else if (cs.ap === 'M') apM++;
                    }
                }
            }
        }
    }
    return {
        operation_count: (doc.operations || []).length,
        cause_count: causas, ap_h_count: apH, ap_m_count: apM,
    };
}

// ─── Efectos y controles reutilizables ──────────────────────────────────────

const LOTE_SEGREGADO = 'Lote segregado en recepcion';
const LOTE_NO_CONFORME = 'Lote no conforme, material a segregar';
const RIESGO_USUARIO = 'Riesgo para la seguridad del usuario del vehiculo';
const PARADA_LINEA = 'Falta de material conforme para produccion';

const PREV_P14 = 'Verificacion segun P-14';
const PREV_CERT = 'Certificado del proveedor por lote (P-14)';

const DET_VISUAL = 'Inspeccion visual contra patron de aspecto, 1 muestra por entrega (P-10/I)';
const DET_CERT = 'Verificacion del certificado del proveedor, por lote (P-10/I y ARB)';
const DET_FLAMA = 'Certificado de flamabilidad del proveedor conforme TL 1010 VW, por entrega (P-10/I)';
const DET_MICRO = 'Medicion con micrometro, 1 muestra por entrega (P-10/I)';
const DET_CALIBRE = 'Medicion con calibre, 1 muestra por entrega (P-10/I)';
const DET_ARB = 'Verificacion de remito, lote y fecha en el sistema ARB (P-10/I)';
const DET_ETIQUETA = 'Verificacion visual de la etiqueta del material, 1 muestra por entrega (P-10/I)';

/** Falla de trazabilidad — comun a todos los materiales. [VW 10500] */
const flTrazabilidad = (mat) => mkFailure({
    desc: `Lote de ${mat} sin identificacion ni trazabilidad`,
    local: LOTE_SEGREGADO,
    next: 'Imposibilidad de acotar el alcance ante una no conformidad',
    end: 'Riesgo de campana ampliada por no poder identificar los vehiculos afectados',
    causa: 'Remito o certificado del proveedor incompleto',
    s: 6, o: 3, d: 4,
    prev: PREV_P14,
    det: DET_ARB,
});

// ─── Familias de material ───────────────────────────────────────────────────

/** Vinilo / TPO / tela de tapizado. [VW 50180 color] [TL 1010 VW flamabilidad] */
function weVinilo({ nombre, codigo }) {
    return mkWorkElement({
        name: codigo ? `${nombre} (codigo ${codigo})` : nombre,
        fnDesc: 'Aportar el material de tapizado con el color, el grabado, el espesor y la flamabilidad especificados',
        failures: [
            mkFailure({
                desc: 'Color o grabado fuera del patron de aspecto',
                local: LOTE_SEGREGADO,
                next: 'Diferencia de tono entre las piezas del conjunto',
                end: 'Apariencia despareja en el habitaculo',
                causa: 'Variacion de tono entre partidas del proveedor',
                s: 6, o: 3, d: 6, prev: PREV_P14,
                det: 'Inspeccion visual contra patron de aspecto conforme VW 50180, 1 muestra por entrega (P-10/I)',
            }),
            mkFailure({
                desc: 'Espesor del material fuera de especificacion',
                local: LOTE_SEGREGADO,
                next: 'Variacion en el tapizado y en la costura',
                end: 'Arrugas o marcas visibles en la pieza',
                causa: 'Variacion del laminado en el proveedor',
                s: 5, o: 3, d: 5, prev: PREV_P14, det: DET_MICRO,
            }),
            mkFailure({
                desc: 'Flamabilidad fuera de lo exigido por TL 1010 VW',
                local: LOTE_NO_CONFORME,
                next: 'Rechazo del ensayo de flamabilidad del conjunto',
                end: RIESGO_USUARIO,
                causa: 'Lote del proveedor sin ensayo de flamabilidad conforme',
                s: 9, o: 3, d: 4, prev: PREV_CERT, det: DET_FLAMA,
            }),
            flTrazabilidad('vinilo'),
        ],
    });
}

/** Hilo de costura Linhanyl. [SGC 1043 / 1063 / 1064] */
function weHilo({ nombre, codigo, plan }) {
    const ref = plan ? `, plan de recepcion ${plan}` : '';
    return mkWorkElement({
        name: `${nombre} (codigo ${codigo})`,
        fnDesc: 'Aportar el hilo con el articulo, el color y la cantidad de cabos especificados',
        failures: [
            mkFailure({
                desc: 'Color del hilo fuera del patron',
                local: LOTE_SEGREGADO,
                next: 'Costura visible con tono distinto al del tapizado',
                end: 'Defecto de apariencia en la costura vista',
                causa: 'Partida del proveedor con variacion de tono',
                s: 6, o: 3, d: 4, prev: PREV_P14,
                det: `Inspeccion visual con patron de color, 1 muestra por lote (P-10/I${ref})`,
            }),
            mkFailure({
                desc: 'Cantidad de cabos distinta a la especificada',
                local: LOTE_SEGREGADO,
                next: 'Resistencia de la costura fuera de lo previsto',
                end: 'Costura que se abre en uso',
                causa: 'Error de preparacion del pedido en el proveedor',
                s: 7, o: 2, d: 5, prev: PREV_P14,
                det: `Inspeccion visual, 1 muestra por lote (P-10/I${ref})`,
            }),
            mkFailure({
                desc: 'Articulo entregado distinto al pedido',
                local: LOTE_SEGREGADO,
                next: 'Hilo equivocado montado en la maquina de costura',
                end: 'Costura con hilo que no corresponde a la pieza',
                causa: 'Error de despacho del proveedor',
                s: 6, o: 3, d: 5, prev: PREV_P14,
                det: `Verificacion de la etiqueta del material, 1 muestra por lote (P-10/I${ref})`,
            }),
            mkFailure({
                desc: 'Flamabilidad del hilo fuera de especificacion',
                local: LOTE_NO_CONFORME,
                next: 'Rechazo del ensayo de flamabilidad del conjunto',
                end: RIESGO_USUARIO,
                causa: 'Lote del proveedor sin ensayo de flamabilidad conforme',
                s: 9, o: 3, d: 5, prev: PREV_CERT,
                det: `Certificado del proveedor conforme Norma VW 50106, anual (P-10/I y ARB${ref})`,
            }),
        ],
    });
}

/** Resina plastica para inyeccion (PC/ABS). */
function weResina({ nombre, codigo }) {
    return mkWorkElement({
        name: codigo ? `${nombre} (codigo ${codigo})` : nombre,
        fnDesc: 'Aportar la resina especificada, seca y libre de contaminacion',
        failures: [
            mkFailure({
                desc: 'Resina entregada distinta a la especificada',
                local: LOTE_SEGREGADO,
                next: 'Piezas inyectadas con propiedades mecanicas fuera de lo previsto',
                end: 'Rotura de la pieza en uso',
                causa: 'Error de despacho o de identificacion en el proveedor',
                s: 8, o: 2, d: 4, prev: PREV_CERT, det: DET_ETIQUETA,
            }),
            mkFailure({
                desc: 'Pellet contaminado o con material extrano',
                local: LOTE_SEGREGADO,
                next: 'Manchas y puntos negros en la pieza inyectada',
                end: 'Defecto de apariencia en pieza a la vista',
                causa: 'Contaminacion en el envasado o en el transporte',
                s: 6, o: 3, d: 5, prev: PREV_P14, det: DET_VISUAL,
            }),
            mkFailure({
                desc: 'Bolson abierto o dañado, con riesgo de humedad',
                local: LOTE_SEGREGADO,
                next: 'Defectos de inyeccion por humedad en el pellet',
                end: 'Piezas con rafagas y burbujas visibles',
                causa: 'Rotura del envase durante el transporte o la estiba',
                s: 6, o: 3, d: 4, prev: PREV_P14,
                det: 'Inspeccion visual del estado del envase al recibir (P-10/I)',
            }),
            flTrazabilidad('resina'),
        ],
    });
}

/** Adhesivo (hot melt, SikaMelt, HB Fuller, glue bicomponente). */
function weAdhesivo({ nombre, codigo }) {
    return mkWorkElement({
        name: codigo ? `${nombre} (codigo ${codigo})` : nombre,
        fnDesc: 'Aportar el adhesivo especificado, dentro de su vida util y en condiciones de uso',
        failures: [
            mkFailure({
                desc: 'Adhesivo recibido vencido o proximo a vencer',
                local: LOTE_SEGREGADO,
                next: 'Perdida de poder de adherencia en el pegado',
                end: 'Despegado del tapizado en uso',
                causa: 'Rotacion de stock del proveedor sin control de vida util',
                s: 8, o: 3, d: 3, prev: PREV_CERT,
                det: 'Verificacion de la fecha de vencimiento y del lote en la etiqueta, por entrega (P-10/I)',
            }),
            mkFailure({
                desc: 'Adhesivo entregado distinto al especificado',
                local: LOTE_SEGREGADO,
                next: 'Adherencia fuera de lo validado para el sustrato',
                end: 'Despegado del tapizado en uso',
                causa: 'Error de despacho del proveedor',
                s: 8, o: 2, d: 4, prev: PREV_CERT, det: DET_ETIQUETA,
            }),
            mkFailure({
                desc: 'Envase dañado o con perdida de producto',
                local: LOTE_SEGREGADO,
                next: 'Contaminacion del adhesivo y del puesto de trabajo',
                end: 'Falla de adherencia en zonas puntuales',
                causa: 'Manipulacion incorrecta en el transporte',
                s: 6, o: 3, d: 3, prev: PREV_P14,
                det: 'Inspeccion visual del estado del envase al recibir (P-10/I)',
            }),
            flTrazabilidad('adhesivo'),
        ],
    });
}

/** Espuma de poliuretano en placa o troquelada. */
function weEspuma({ nombre, codigo }) {
    return mkWorkElement({
        name: codigo ? `${nombre} (codigo ${codigo})` : nombre,
        fnDesc: 'Aportar la espuma con la densidad, el espesor y la flamabilidad especificados',
        failures: [
            mkFailure({
                desc: 'Densidad de la espuma fuera de especificacion',
                local: LOTE_SEGREGADO,
                next: 'Firmeza del conjunto fuera de estandar',
                end: 'Tacto de la pieza distinto al aprobado por el cliente',
                causa: 'Variacion del proceso de espumado en el proveedor',
                s: 6, o: 3, d: 5, prev: PREV_CERT, det: DET_CERT,
            }),
            mkFailure({
                desc: 'Espesor de la espuma fuera de especificacion',
                local: LOTE_SEGREGADO,
                next: 'Variacion en el espesor del conjunto tapizado',
                end: 'Diferencia de altura perceptible en la pieza',
                causa: 'Variacion del corte o del laminado en el proveedor',
                s: 5, o: 3, d: 5, prev: PREV_P14, det: DET_CALIBRE,
            }),
            mkFailure({
                desc: 'Flamabilidad fuera de lo exigido por TL 1010 VW',
                local: LOTE_NO_CONFORME,
                next: 'Rechazo del ensayo de flamabilidad del conjunto',
                end: RIESGO_USUARIO,
                causa: 'Lote del proveedor sin ensayo de flamabilidad conforme',
                s: 9, o: 3, d: 4, prev: PREV_CERT, det: DET_FLAMA,
            }),
            flTrazabilidad('espuma'),
        ],
    });
}

/** Pieza comprada o consignada (tweeter, bracket, clip, tornillo, plate, logo). */
function wePieza({ nombre, codigo, consignada }) {
    const prevPieza = consignada
        ? 'Certificado del proveedor por lote (P-14). Componente consignado por el cliente'
        : PREV_CERT;
    return mkWorkElement({
        name: codigo ? `${nombre} (codigo ${codigo})` : nombre,
        fnDesc: 'Aportar la pieza conforme a plano, libre de defectos de aspecto y en la cantidad pedida',
        failures: [
            mkFailure({
                desc: 'Pieza con defectos de aspecto (rebaba, marcas, deformacion, bordes filosos)',
                local: LOTE_SEGREGADO,
                next: 'Montaje dificultoso o pieza rechazada en control final',
                end: 'Defecto visible en el vehiculo',
                causa: 'Desgaste del herramental en el proveedor',
                s: 6, o: 3, d: 4, prev: PREV_P14, det: DET_VISUAL,
            }),
            mkFailure({
                desc: 'Dimensional de la pieza fuera de plano',
                local: LOTE_SEGREGADO,
                next: 'Interferencia o juego excesivo en el montaje',
                end: 'Ruidos y desajuste en el conjunto',
                causa: 'Variacion del proceso del proveedor',
                s: 7, o: 3, d: 4, prev: prevPieza,
                det: 'Verificacion del informe de control dimensional del proveedor, por lote (P-10/I)',
            }),
            mkFailure({
                desc: 'Cantidad recibida distinta a la del remito',
                local: 'Faltante de material en el pulmon de produccion',
                next: PARADA_LINEA,
                end: 'Riesgo de incumplimiento de entrega al cliente',
                causa: 'Error de conteo o de despacho del proveedor',
                s: 5, o: 4, d: 3, prev: PREV_P14,
                det: 'Conteo contra remito al recibir (P-10/I y ARB)',
            }),
            flTrazabilidad('pieza'),
        ],
    });
}

/** Film o cinta adhesiva en rollo. */
function weFilm({ nombre, codigo }) {
    return mkWorkElement({
        name: codigo ? `${nombre} (codigo ${codigo})` : nombre,
        fnDesc: 'Aportar el film con el ancho, el espesor y la adherencia especificados',
        failures: [
            mkFailure({
                desc: 'Film entregado distinto al especificado',
                local: LOTE_SEGREGADO,
                next: 'Adherencia fuera de lo validado',
                end: 'Despegado de la pieza en uso',
                causa: 'Error de despacho del proveedor',
                s: 7, o: 2, d: 4, prev: PREV_CERT, det: DET_ETIQUETA,
            }),
            mkFailure({
                desc: 'Ancho del rollo fuera de especificacion',
                local: LOTE_SEGREGADO,
                next: 'Sobrante o faltante de film en la aplicacion',
                end: 'Zonas sin adhesivo en la pieza terminada',
                causa: 'Variacion del corte del rollo en el proveedor',
                s: 5, o: 3, d: 4, prev: PREV_P14, det: DET_CALIBRE,
            }),
            mkFailure({
                desc: 'Rollo dañado, aplastado o con bordes pegados',
                local: LOTE_SEGREGADO,
                next: 'Desperdicio de material y paradas en la aplicacion',
                end: 'Zonas sin adhesivo en la pieza terminada',
                causa: 'Estiba o manipulacion incorrecta en el transporte',
                s: 5, o: 3, d: 3, prev: PREV_P14,
                det: 'Inspeccion visual del estado del rollo al recibir (P-10/I)',
            }),
            flTrazabilidad('film'),
        ],
    });
}

// ─── Que material entra en cada producto — todo sale del BOM ────────────────

/**
 * DECISION DE CRITERIO (Insert): el BOM trae DOS juegos de codigos para los mismos cuatro
 * colores — `427-VIN-001..004` (con la construccion completa: 1 mm PVC + 3 mm PU, narbe y
 * proveedor Sansuy) y `427-VIN-017..020` (solo "Vinyl (color)"). Se cargan los PRIMEROS,
 * que son los que identifican el material; poner los ocho duplicaria el mismo material y
 * va contra amfe.md §9. La duplicacion de codigos se reporta a Calidad como hallazgo.
 */
const PRODUCTOS = {
    'AMFE-TR-PAT': {
        producto: 'TOP ROLL',
        bom: 'BOM-NOVAX-001 Rev.11',
        materiales: () => [
            weVinilo({ nombre: 'TPO Bilaminate IMG-L negro', codigo: '427-VIN-005-COR-01' }),
            weResina({ nombre: 'PC/ABS Cycolac DL100 negro', codigo: 'CYCOLACDL100' }),
            weAdhesivo({ nombre: 'Adhesivo hot melt', codigo: '427-ADH-001-ADH-01' }),
            weAdhesivo({ nombre: 'Adhesivo SikaMelt-171 IMG', codigo: null }),
            wePieza({ nombre: 'Tweeter', codigo: 'TBD' }),
            wePieza({ nombre: 'Bracket de fijacion water cut (4 manos)', codigo: 'TBD' }),
            wePieza({ nombre: 'Upper decorative plate skeleton (4 manos)', codigo: 'TBD' }),
        ],
    },
    'AMFE-ARM-PAT': {
        producto: 'ARMREST DOOR PANEL',
        bom: 'BOM-NOVAX-003 Rev.11',
        materiales: () => [
            weVinilo({ nombre: 'Vinilo de tapizado Carbon Black', codigo: '427-VIN-009-COR-01' }),
            weVinilo({ nombre: 'Vinilo PVC Texture PR022 Carbon Black', codigo: null }),
            weHilo({ nombre: 'Hilo de union Jet Black', codigo: '427-HIL-001-COS-01', plan: '1043' }),
            weHilo({ nombre: 'Hilo de costura Carbon Black', codigo: '427-HIL-005-COS-01', plan: null }),
            weAdhesivo({ nombre: 'Adhesivo hot melt', codigo: '427-ADH-001-ADH-01' }),
            weAdhesivo({ nombre: 'Adhesivo HB Fuller CQ-7080-5', codigo: null }),
            weFilm({ nombre: 'Film adhesivo Tesa 52110', codigo: '52110-00000-00' }),
            weEspuma({ nombre: 'Espuma de poliuretano 50 kg/m3', codigo: 'TBD' }),
            weResina({ nombre: 'PC/ABS Cycolac DL100 negro', codigo: 'CYCOLACDL100' }),
            wePieza({ nombre: 'Upper decorative plate skeleton (4 manos)', codigo: 'TBD' }),
        ],
    },
    'AMFE-INS-PAT': {
        producto: 'INSERT',
        bom: 'BOM-NOVAX-002 Rev.11',
        materiales: () => [
            weVinilo({ nombre: 'Vinilo bondeado Titan Black (Sansuy)', codigo: '427-VIN-001-COR-01' }),
            weVinilo({ nombre: 'Vinilo bondeado Platinium Gray (Sansuy)', codigo: '427-VIN-002-COR-01' }),
            weVinilo({ nombre: 'Vinilo bondeado Andino Gray (Sansuy)', codigo: '427-VIN-003-COR-01' }),
            weVinilo({ nombre: 'Vinilo bondeado Dark Slate ML14 (Sansuy)', codigo: '427-VIN-004-COR-01' }),
            weHilo({ nombre: 'Hilo de costura Jet Black', codigo: '427-HIL-002-COS-01', plan: '1043' }),
            weHilo({ nombre: 'Hilo de costura Alpe Gray', codigo: '427-HIL-003-COS-01', plan: '1063' }),
            weHilo({ nombre: 'Hilo de costura Gray Violet', codigo: '427-HIL-004-COS-01', plan: '1064' }),
            weAdhesivo({ nombre: 'Adhesivo hot melt', codigo: '427-ADH-001-ADH-01' }),
            weAdhesivo({ nombre: 'Adhesivo HB Fuller CQ-7080-5', codigo: null }),
            weFilm({ nombre: 'Film adhesivo Tesa 52110', codigo: '52110-00000-00' }),
            weResina({ nombre: 'PC/ABS Cycolac DL100 negro', codigo: 'CYCOLACDL100' }),
            weEspuma({ nombre: 'Espuma de poliuretano del panel decorativo', codigo: '427-ESP-001-TRO-01' }),
            wePieza({ nombre: 'Embedded decorative panel skeleton (4 manos)', codigo: 'TBD' }),
        ],
    },
    'VWA-PAT-IPPADS-001': {
        producto: 'IP PADS',
        bom: 'BOM-VW-PAT-IPPAD V3',
        // Ya tiene 11 renglones de material cargados con nombre y codigo reales: es el
        // AMFE mas completo de los cuatro. Del BOM solo falta este.
        materiales: () => [
            wePieza({ nombre: 'Piping tubing negro', codigo: 'TBD' }),
        ],
    },
};

// ─── Correcciones de calidad detectadas por la auditoria ────────────────────

/**
 * Un WE de tipo `Material` cuyo nombre es una herramienta esta mal tipado: la cuchilla y
 * el molde son MAQUINA. Lo confirma el propio sistema — en los 3 apoyacabezas la
 * "Cuchilla de corte" ya figura como `Machine`. Check `WE_NAME_EQUALS_TYPE` (CRITICAL).
 */
const RETIPAR_A_MACHINE = [
    { amfe: 'AMFE-ARM-PAT', we: 'Cuchilla de corte' },
    { amfe: 'AMFE-INS-PAT', we: 'Cuchilla de corte' },
    { amfe: 'VWA-PAT-IPPADS-001', we: 'Cuchilla de corte' },
    { amfe: 'AMFE-TR-PAT', we: 'Molde de IMG' },
];

function retiparHerramientas(doc, amfeNumber, apply) {
    let n = 0;
    const objetivo = RETIPAR_A_MACHINE.filter(r => r.amfe === amfeNumber).map(r => r.we.toLowerCase());
    if (!objetivo.length) return 0;
    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            if (we.type === 'Material' && objetivo.includes((we.name || '').toLowerCase())) {
                we.type = 'Machine';
                n++;
                logChange(apply, `${op.name} ~ WE "${we.name}": type Material -> Machine`, {});
            }
        }
    }
    return n;
}

// ─── Main ───────────────────────────────────────────────────────────────────

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const plan = [];
const commits = [];

for (const [amfeNumber, cfg] of Object.entries(PRODUCTOS)) {
    const { data: rows, error } = await sb
        .from('amfe_documents')
        .select('id, amfe_number, project_name, data, revisions, status')
        .eq('amfe_number', amfeNumber)
        .limit(1);
    if (error) throw error;
    if (!rows?.length) throw new Error(`No se encontro el AMFE ${amfeNumber}`);

    const row = rows[0];
    const before = parseData(row.data);
    const doc = parseData(row.data);

    console.log(`\n=== ${amfeNumber} — ${cfg.producto} ===`);

    const op10 = findOperation(doc, '10')
        || doc.operations.find(o => /RECEPCION/i.test(o.name || o.operationName || ''));
    if (!op10) throw new Error(`${amfeNumber}: no se encontro la operacion de recepcion`);
    op10.workElements = op10.workElements || [];

    let agregados = 0, reemplazados = 0;
    for (const we of cfg.materiales()) {
        const i = op10.workElements.findIndex(w => (w.name || '').toLowerCase() === we.name.toLowerCase());
        if (i >= 0) {
            // Solo se pisa lo que genero este script. Contenido cargado a mano no se toca.
            if (op10.workElements[i]._autoFilled !== true) {
                console.log(`  (existe y NO es autogenerado, se respeta) "${we.name}"`);
                continue;
            }
            op10.workElements[i] = we;
            reemplazados++;
            logChange(apply, `OP10 ~ WE [Material] "${we.name}" (se reescribe)`, {});
            continue;
        }
        op10.workElements.push(we);
        agregados++;
        logChange(apply, `OP10 + WE [Material] "${we.name}"`, {
            fallas: we.functions[0].failures.length,
        });
    }

    const retipados = retiparHerramientas(doc, amfeNumber, apply);

    syncLegacyFmFields(doc);
    syncFieldAliases(doc);

    const nMaterial = op10.workElements.filter(w => w.type === 'Material').length;
    console.log(`  -> materiales en recepcion: ${nMaterial} (agregados ${agregados}, reescritos ${reemplazados}, retipados ${retipados})`);

    const meta = contarMetadata(doc);
    const revisions = Array.isArray(row.revisions)
        ? row.revisions
        : (typeof row.revisions === 'string' && row.revisions ? JSON.parse(row.revisions) : []);
    // Los nombres de campo importan: la caratula lee `item`, `details`, `pswDate` y
    // `modifiedBy` (ver `AmfeOfficialRevision` en modules/amfe/amfeCaratulaSheet.ts).
    // La primera version puso `detail` y `author` y la fila salio con la fecha y el resto
    // en blanco: el documento decia que hubo una revision pero no que se cambio.
    //
    // GUARD DE IDEMPOTENCIA: los work elements se de-duplican por `_autoFilled`, pero
    // `revisions` es un array aparte y un push sin condicion agrega una fila IGUAL en cada
    // corrida con --apply. El validador no mira `revisions`, asi que `runWithValidation()`
    // no lo frena. Mismo guard que usa `_revisarAmfesApoyacabezasPatagonia.mjs`.
    const filaRev = {
        rev: 'A',
        date: FECHA_REV,
        item: '10',
        details: DESC_REV,
        pswDate: '',
        modifiedBy: 'FS',
    };
    if (revisions.some(r => r.date === filaRev.date)) {
        console.log(`  (la fila de revision ${FECHA_REV} ya existe, no se duplica)`);
    } else {
        revisions.push(filaRev);
    }

    plan.push({ id: row.id, amfeNumber, productName: cfg.producto, before, after: doc });
    commits.push(async () => {
        await saveAmfe(sb, row.id, doc, {
            extraFields: { ...meta, revisions: JSON.stringify(revisions) },
        });
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
        const live = parseData(chk.data);
        const opLive = findOperation(live, '10')
            || live.operations.find(o => /RECEPCION/i.test(o.name || o.operationName || ''));
        const nLive = (opLive.workElements || []).filter(w => w.type === 'Material').length;
        console.log(`POST-CHECK live ${amfeNumber}: materiales en recepcion = ${nLive}`);
    });
}

await runWithValidation(plan, apply, async () => {
    for (const c of commits) await c();
});

finish(apply);

