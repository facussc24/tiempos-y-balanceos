/**
 * loadApoyacabezasGaps.mjs
 *
 * Carga gaps del listado oficial I-PY-001.7 Rev A en los 3 AMFEs Headrest VWA.
 *
 * Seccion A — CAUSAS NUEVAS (17 por AMFE = 51 total):
 *   OP 10 RECEPCION DE MATERIA PRIMA:
 *     - D/TLD 4 Emisiones VW 50180 (CC, S=9)
 *     - D/TLD 5 Sustancias prohibidas 2000/53/CE (CC, S=9)
 *     - SC22 Resistencia temperatura -30 a +90 C (SC, S=7)
 *     - SC23 Ciclo ambiental PV 2005 (SC, S=7)
 *     - SC24 Intemperie VW 50185 (SC, S=7)
 *     - SC27 Constancia color VW 50190 (SC, S=6)
 *     - SC28 Resistencia luz PV 1303 5 periodos (SC, S=6)
 *     - SC29 Escala grises DIN EN 20105-A02 >= 4 (SC, S=6)
 *   OP 40 COSTURA 2DA ETAPA:
 *     - SC35 Costura Y cubierta simple longitud 4mm (SC, S=6)
 *     - SC36 Costura Y ancho cubierta 4mm ±1 (SC, S=6)
 *   OP 90 EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO:
 *     - SC37 Marcado identificacion VW 10500 (SC, S=5)
 *     - SC38 Logotipo/marca VW 10514-C10 (SC, S=5)
 *     - SC39 Pais de origen VW 10550 (SC, S=5)
 *     - SC40 Codigo fabricante VW 10540 (SC, S=5)
 *     - SC41 Numero pieza DIN 1451-4-3 (SC, S=5)
 *     - SC42 Marcado fecha VW 10560 (SC, S=5, deteccion lector codigo barras)
 *     - SC43 Marcado material VDA 260 (SC, S=5)
 *
 * Seccion B — RECLASIFICACIONES FLAG→SC (7 por AMFE = 21 total):
 *   Solo modifica specialChar de "" a "SC" en causas existentes.
 *
 * Respeta reglas:
 *   - scripts/_lib/amfeIo.mjs (connectSupabase, readAmfe, saveAmfe, calculateAP)
 *   - scripts/_lib/dryRunGuard.mjs (parseSafeArgs, runWithValidation, finish)
 *   - .claude/rules/amfe.md (calibracion S, field aliases, WE 1M-por-linea)
 *   - .claude/rules/amfe-actions.md (NO inventar acciones)
 *   - .claude/rules/amfe-aph-pending.md (AP=H sin accion => "Pendiente definicion equipo APQP")
 *   - .claude/skills/apqp-schema (estructura JSON)
 *   - .claude/skills/supabase-safety (dry-run default, runWithValidation gate)
 *
 * Scope: solo los 3 AMFEs Headrest VWA. NO toca Telas PWA ni otros AMFEs.
 */

import { randomUUID } from 'crypto';
import {
    connectSupabase,
    readAmfe,
    saveAmfe,
    calculateAP,
    findOperation,
    findWorkElement,
    normalizeText,
} from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish, logChange } from './_lib/dryRunGuard.mjs';

// ─── Targets ────────────────────────────────────────────────────────────────
const HEADREST_TARGETS = [
    { id: '10eaebce-ad87-4035-9343-3e20e4ee0fc9', key: 'HF', name: 'Headrest Front' },
    { id: 'e9320798-ceaa-4623-97e9-92200b5234b6', key: 'HRC', name: 'Headrest Rear Center' },
    { id: 'beda6d47-30ae-4d5f-81e0-468be8950014', key: 'HRO', name: 'Headrest Rear Outer' },
];

// ─── Nuevas causas (17 entries) ─────────────────────────────────────────────
// Cada entry describe donde ir (op, weName, weType) + contenido de function/failure/cause.
// Si un WE con ese nombre no existe, se crea nuevo.

const NEW_CAUSES = [
    // OP 10 RECEPCION — Material: Tela termoformable (6 SC de propiedades del material)
    {
        id: 'DTLD4',
        opNumber: '10',
        opName: 'RECEPCION DE MATERIA PRIMA',
        weName: 'Material: Tela termoformable',
        weType: 'Material',
        functionDescription: 'Proveer material libre de emisiones VOC',
        failureDescription: 'Emisiones VOC fuera de especificacion VW 50180',
        effectLocal: 'Lote no conforme, material a segregar',
        effectNextLevel: 'Rechazo ensayo VW 50180 en auditoria cliente',
        effectEndUser: 'Ambiente cabina con olor/VOC, confort afectado',
        cause: 'Proveedor sin certificado VW 50180 vigente',
        severity: 9,
        occurrence: 3,
        detection: 3,
        specialChar: 'CC',
        preventionControl: 'Certificado VW 50180 del proveedor por lote',
        detectionControl: 'Verificacion documental P-14',
        responsible: 'Inspector de Calidad',
    },
    {
        id: 'DTLD5',
        opNumber: '10',
        opName: 'RECEPCION DE MATERIA PRIMA',
        weName: 'Material: Tela termoformable',
        weType: 'Material',
        functionDescription: 'Proveer material conforme directiva EU 2000/53/CE',
        failureDescription: 'Material contiene sustancias prohibidas segun anexo II',
        effectLocal: 'Lote no conforme, material a segregar',
        effectNextLevel: 'Incumplimiento regulatorio EU, multa cliente',
        effectEndUser: 'Producto no homologable en mercado europeo',
        cause: 'Proveedor sin declaracion IMDS actualizada',
        severity: 9,
        occurrence: 3,
        detection: 3,
        specialChar: 'CC',
        preventionControl: 'Declaracion IMDS del proveedor + verificacion sustancias anexo II',
        detectionControl: 'Verificacion documental P-14',
        responsible: 'Inspector de Calidad',
    },
    {
        id: 'SC22',
        opNumber: '10',
        opName: 'RECEPCION DE MATERIA PRIMA',
        weName: 'Material: Tela termoformable',
        weType: 'Material',
        functionDescription: 'Material resiste ciclo termico cabina',
        failureDescription: 'Material pierde propiedades a temperatura extrema',
        effectLocal: 'Lote rechazado en ensayo de laboratorio',
        effectNextLevel: 'Producto degradado en campo',
        effectEndUser: 'Deformacion/rotura en verano/invierno',
        cause: 'Material sin ensayo camara climatica conforme',
        severity: 7,
        occurrence: 3,
        detection: 4,
        specialChar: 'SC',
        preventionControl: 'Certificado ensayo camara climatica -30 a +90 C del proveedor',
        detectionControl: 'Verificacion documental lote',
        responsible: 'Inspector de Calidad',
    },
    {
        id: 'SC23',
        opNumber: '10',
        opName: 'RECEPCION DE MATERIA PRIMA',
        weName: 'Material: Tela termoformable',
        weType: 'Material',
        functionDescription: 'Material supera 50 ciclos ambientales sin alteracion',
        failureDescription: 'Alteracion visible despues de ensayo PV 2005',
        effectLocal: 'Rechazo ensayo laboratorio',
        effectNextLevel: 'Degradacion temprana en vehiculo',
        effectEndUser: 'Vida util reducida de pieza',
        cause: 'Material sin certificado PV 2005',
        severity: 7,
        occurrence: 3,
        detection: 4,
        specialChar: 'SC',
        preventionControl: 'Certificado PV 2005 50 ciclos del proveedor',
        detectionControl: 'Verificacion documental',
        responsible: 'Inspector de Calidad',
    },
    {
        id: 'SC24',
        opNumber: '10',
        opName: 'RECEPCION DE MATERIA PRIMA',
        weName: 'Material: Tela termoformable',
        weType: 'Material',
        functionDescription: 'Material resiste intemperie',
        failureDescription: 'Material con fallos/quejas campo por intemperie',
        effectLocal: 'Rechazo VW 50185',
        effectNextLevel: 'Retrabajos en linea',
        effectEndUser: 'Decoloracion/degradacion estetica',
        cause: 'Material sin certificado VW 50185',
        severity: 7,
        occurrence: 3,
        detection: 4,
        specialChar: 'SC',
        preventionControl: 'Certificado VW 50185 del proveedor',
        detectionControl: 'Verificacion documental',
        responsible: 'Inspector de Calidad',
    },
    {
        id: 'SC27',
        opNumber: '10',
        opName: 'RECEPCION DE MATERIA PRIMA',
        weName: 'Material: Tela termoformable',
        weType: 'Material',
        functionDescription: 'Material mantiene color lote a lote',
        failureDescription: 'Variacion de color entre lotes',
        effectLocal: 'Mezcla visible en ensamble',
        effectNextLevel: 'Rechazo linea VW',
        effectEndUser: 'Aspecto desparejo entre piezas',
        cause: 'Material sin certificado VW 50190',
        severity: 6,
        occurrence: 4,
        detection: 4,
        specialChar: 'SC',
        preventionControl: 'Certificado VW 50190 del proveedor',
        detectionControl: 'Comparacion con muestra patron bajo luz controlada',
        responsible: 'Inspector de Calidad',
    },
    {
        id: 'SC28',
        opNumber: '10',
        opName: 'RECEPCION DE MATERIA PRIMA',
        weName: 'Material: Tela termoformable',
        weType: 'Material',
        functionDescription: 'Material mantiene color bajo radiacion solar',
        failureDescription: 'Decoloracion antes de 5 periodos PV 1303',
        effectLocal: 'Rechazo laboratorio',
        effectNextLevel: 'Reclamo garantia cliente',
        effectEndUser: 'Pieza decolorada en vehiculo',
        cause: 'Material sin certificado PV 1303',
        severity: 6,
        occurrence: 3,
        detection: 4,
        specialChar: 'SC',
        preventionControl: 'Certificado PV 1303 5 periodos del proveedor',
        detectionControl: 'Verificacion documental',
        responsible: 'Inspector de Calidad',
    },
    {
        id: 'SC29',
        opNumber: '10',
        opName: 'RECEPCION DE MATERIA PRIMA',
        weName: 'Material: Tela termoformable',
        weType: 'Material',
        functionDescription: 'Material cumple solidez color escala grises >= 4',
        failureDescription: 'Escala grises < 4 post-ensayo',
        effectLocal: 'Rechazo laboratorio',
        effectNextLevel: 'Transferencia de color a otras piezas',
        effectEndUser: 'Manchas de color en habitaculo',
        cause: 'Material con solidez color insuficiente',
        severity: 6,
        occurrence: 3,
        detection: 4,
        specialChar: 'SC',
        preventionControl: 'Certificado DIN EN 20105-A02 escala >= 4',
        detectionControl: 'Verificacion documental',
        responsible: 'Inspector de Calidad',
    },

    // OP 40 COSTURA 2DA ETAPA — Costura Y cubierta (2 SC)
    {
        id: 'SC35',
        opNumber: '40',
        opName: 'COSTURA 2DA ETAPA',
        weName: 'Metodo: Costura Y cubierta simple',
        weType: 'Method',
        functionDescription: 'Costura Y cubierta simple con largo puntada especificado',
        failureDescription: 'Largo de puntada costura Y fuera de 4mm nominal',
        effectLocal: 'Costura rechazada por operario',
        effectNextLevel: 'Rechazo cliente por apariencia',
        effectEndUser: 'Costura visible desprolija',
        cause: 'Largo puntada mal configurado en maquina',
        severity: 6,
        occurrence: 4,
        detection: 3,
        specialChar: 'SC',
        preventionControl: 'Set-up maquina con regla calibrada + autocontrol arranque',
        detectionControl: 'Regla + conteo puntadas 5 pz/turno',
        responsible: 'Operador de produccion',
    },
    {
        id: 'SC36',
        opNumber: '40',
        opName: 'COSTURA 2DA ETAPA',
        weName: 'Metodo: Costura Y cubierta simple',
        weType: 'Method',
        functionDescription: 'Ancho cubierta costura Y dentro de tolerancia',
        failureDescription: 'Ancho cubierta fuera de 4mm ±1',
        effectLocal: 'Costura rechazada',
        effectNextLevel: 'Rechazo apariencia cliente',
        effectEndUser: 'Costura irregular',
        cause: 'Guia de costura desajustada',
        severity: 6,
        occurrence: 4,
        detection: 3,
        specialChar: 'SC',
        preventionControl: 'Set-up guia + autocontrol arranque',
        detectionControl: 'Regla calibrada 5 pz/turno',
        responsible: 'Operador de produccion',
    },

    // OP 90 EMBALAJE — marcado cluster (7 SC)
    {
        id: 'SC37',
        opNumber: '90',
        opName: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
        weName: 'Metodo: Marcado e identificacion de pieza',
        weType: 'Method',
        functionDescription: 'Pieza identificada segun VW 10500',
        failureDescription: 'Marcado de identificacion ausente o incorrecto',
        effectLocal: 'Rechazo embalaje',
        effectNextLevel: 'Trazabilidad perdida en planta cliente',
        effectEndUser: 'Recall dificultoso ante defecto',
        cause: 'Etiqueta no colocada o erronea',
        severity: 5,
        occurrence: 3,
        detection: 3,
        specialChar: 'SC',
        preventionControl: 'Impresora calibrada + muestra patron VW 10500',
        detectionControl: 'Inspeccion visual 100%',
        responsible: 'Operador de produccion',
    },
    {
        id: 'SC38',
        opNumber: '90',
        opName: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
        weName: 'Metodo: Marcado e identificacion de pieza',
        weType: 'Method',
        functionDescription: 'Pieza identificada con logotipo segun VW 10514-C10',
        failureDescription: 'Logotipo/marca ausente o incorrecto',
        effectLocal: 'Rechazo embalaje',
        effectNextLevel: 'Rechazo en planta cliente por identificacion',
        effectEndUser: 'Producto no homologado segun VW',
        cause: 'Etiqueta sin logotipo VW 10514-C10',
        severity: 5,
        occurrence: 3,
        detection: 3,
        specialChar: 'SC',
        preventionControl: 'Muestra patron VW 10514-C10 + verificacion arranque',
        detectionControl: 'Inspeccion visual 100%',
        responsible: 'Operador de produccion',
    },
    {
        id: 'SC39',
        opNumber: '90',
        opName: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
        weName: 'Metodo: Marcado e identificacion de pieza',
        weType: 'Method',
        functionDescription: 'Pieza identificada con pais de origen segun VW 10550',
        failureDescription: 'Pais de origen ausente o incorrecto',
        effectLocal: 'Rechazo embalaje',
        effectNextLevel: 'Retencion aduanera en cliente',
        effectEndUser: 'Incumplimiento legal declaracion origen',
        cause: 'Etiqueta sin pais de origen VW 10550',
        severity: 5,
        occurrence: 3,
        detection: 3,
        specialChar: 'SC',
        preventionControl: 'Muestra patron VW 10550 + verificacion arranque',
        detectionControl: 'Inspeccion visual 100%',
        responsible: 'Operador de produccion',
    },
    {
        id: 'SC40',
        opNumber: '90',
        opName: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
        weName: 'Metodo: Marcado e identificacion de pieza',
        weType: 'Method',
        functionDescription: 'Pieza identificada con codigo fabricante segun VW 10540',
        failureDescription: 'Codigo fabricante ausente o incorrecto',
        effectLocal: 'Rechazo embalaje',
        effectNextLevel: 'Imposible trazar proveedor desde planta cliente',
        effectEndUser: 'Recall dificultoso ante reclamo',
        cause: 'Etiqueta sin codigo fabricante VW 10540',
        severity: 5,
        occurrence: 3,
        detection: 3,
        specialChar: 'SC',
        preventionControl: 'Muestra patron VW 10540 + verificacion arranque',
        detectionControl: 'Inspeccion visual 100%',
        responsible: 'Operador de produccion',
    },
    {
        id: 'SC41',
        opNumber: '90',
        opName: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
        weName: 'Metodo: Marcado e identificacion de pieza',
        weType: 'Method',
        functionDescription: 'Numero de pieza con tipografia DIN 1451-4-3',
        failureDescription: 'Numero de pieza con tipografia no conforme DIN 1451-4-3',
        effectLocal: 'Rechazo embalaje',
        effectNextLevel: 'Rechazo cliente por no cumplir estandar tipografia',
        effectEndUser: 'Identificacion dificil en recall',
        cause: 'Impresora configurada con tipografia incorrecta',
        severity: 5,
        occurrence: 3,
        detection: 3,
        specialChar: 'SC',
        preventionControl: 'Set-up impresora con DIN 1451-4-3 validada',
        detectionControl: 'Inspeccion visual 100%',
        responsible: 'Operador de produccion',
    },
    {
        id: 'SC42',
        opNumber: '90',
        opName: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
        weName: 'Metodo: Marcado e identificacion de pieza',
        weType: 'Method',
        functionDescription: 'Pieza identificada con fecha segun VW 10560',
        failureDescription: 'Marcado de fecha ausente o ilegible',
        effectLocal: 'Rechazo embalaje',
        effectNextLevel: 'Trazabilidad temporal perdida',
        effectEndUser: 'Recall de fecha especifica dificultoso',
        cause: 'Impresora sin actualizacion fecha o etiqueta sin leer',
        severity: 5,
        occurrence: 3,
        detection: 2,
        specialChar: 'SC',
        preventionControl: 'Impresora calibrada con fecha + muestra patron VW 10560',
        detectionControl: 'Lector codigo barras 100%',
        responsible: 'Operador de produccion',
    },
    {
        id: 'SC43',
        opNumber: '90',
        opName: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
        weName: 'Metodo: Marcado e identificacion de pieza',
        weType: 'Method',
        functionDescription: 'Pieza identificada con material segun VDA 260',
        failureDescription: 'Marcado de material ausente o incorrecto',
        effectLocal: 'Rechazo embalaje',
        effectNextLevel: 'Reciclaje end-of-life complicado',
        effectEndUser: 'Incumplimiento regulatorio reciclaje EU',
        cause: 'Etiqueta sin codigo material VDA 260',
        severity: 5,
        occurrence: 3,
        detection: 3,
        specialChar: 'SC',
        preventionControl: 'Muestra patron VDA 260 + verificacion arranque',
        detectionControl: 'Inspeccion visual 100%',
        responsible: 'Operador de produccion',
    },
];

// ─── Reclasificaciones (7 entries) ──────────────────────────────────────────
// Cada entry describe como identificar la causa existente a reclasificar:
// - opNumber: donde buscar
// - matchText: substring normalizado para matchear el texto de la causa existente
// Si hay multiples matches en distintas OPs, la primera que matchee se usa.
// Si no hay match, se flaggea como gap.
// Al aplicar: specialChar => "SC", y opcionalmente mergear texto de control.

const RECLASSIFICATIONS = [
    {
        id: 'SC25',
        name: 'Hilo VW 50106',
        searchOps: ['30', '40'],
        matchText: 'seleccion incorrecta del hilo', // busca en fm.description o cause
        matchField: 'failure', // o 'cause'
        normExtra: 'error en la carga de hilo',
        appendPrevention: 'VW 50106',
        appendDetection: null,
    },
    {
        id: 'SC26',
        name: 'Tono color vs patron',
        searchOps: ['10'],
        matchText: 'contaminacion / suciedad en la materia prima',
        matchField: 'failure',
        normExtra: null,
        appendPrevention: 'Comparacion con muestra patron de tono color',
        appendDetection: null,
    },
    {
        id: 'SC30',
        name: 'Geometria CAD / Math Data',
        searchOps: ['10', '20'],
        matchText: 'material con especificacion erronea',
        matchField: 'failure',
        normExtra: null,
        appendPrevention: 'Verificacion vs Math Data / CAD',
        appendDetection: null,
    },
    {
        id: 'SC31',
        name: 'Contorno exterior 3mm',
        searchOps: ['30'],
        matchText: 'toma de costura fuera de especificacion',
        matchField: 'failure',
        normExtra: null,
        appendPrevention: 'Tolerancia contorno 3mm ±1',
        appendDetection: null,
    },
    {
        id: 'SC32',
        name: 'Acabado apariencia vs muestra',
        searchOps: ['80'],
        matchText: 'costura vista con desviacion o imperfeccion estetica',
        matchField: 'failure',
        normExtra: null,
        appendPrevention: 'Comparacion con muestra patron de acabado',
        appendDetection: null,
    },
    {
        id: 'SC33',
        name: 'Costura X 4mm / 4 puntadas/16mm',
        searchOps: ['30', '40'],
        matchText: 'largo de puntada fuera de especificacion',
        matchField: 'failure',
        normExtra: null,
        appendPrevention: 'Largo puntada 4mm / 4 puntadas cada 16mm',
        appendDetection: null,
    },
    {
        id: 'SC34',
        name: 'Costura X1 margen 3mm ±1',
        searchOps: ['30'],
        matchText: 'toma de costura fuera de especificacion',
        matchField: 'failure',
        normExtra: null,
        appendPrevention: 'Margen costura X1 3mm ±1',
        appendDetection: null,
    },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function includesNormalized(haystack, needle) {
    return normalizeText(haystack).includes(normalizeText(needle));
}

/**
 * Encuentra o crea un WE en la operacion. Busca matching por nombre normalizado.
 * Si no existe, crea uno nuevo vacio con el nombre exacto indicado.
 */
function findOrCreateWe(op, weName, weType) {
    const existing = findWorkElement(op, weName);
    if (existing) return { we: existing, created: false };
    const we = {
        id: randomUUID(),
        name: weName,
        description: weName, // alias legacy que algunos exports leen
        type: weType,
        functions: [],
    };
    op.workElements = op.workElements || [];
    op.workElements.push(we);
    return { we, created: true };
}

/**
 * Encuentra o crea una function en un WE con description/functionDescription dados.
 */
function findOrCreateFunction(we, fnDescription) {
    const target = normalizeText(fnDescription);
    const existing = (we.functions || []).find(
        f => normalizeText(f.description || f.functionDescription) === target
    );
    if (existing) return { fn: existing, created: false };
    const fn = {
        id: randomUUID(),
        description: fnDescription,
        functionDescription: fnDescription,
        requirements: '',
        failures: [],
    };
    we.functions = we.functions || [];
    we.functions.push(fn);
    return { fn, created: true };
}

/**
 * Encuentra o crea una failure en una function con description dada.
 */
function findOrCreateFailure(fn, fmDescription, effectLocal, effectNextLevel, effectEndUser) {
    const target = normalizeText(fmDescription);
    const existing = (fn.failures || []).find(fm => normalizeText(fm.description) === target);
    if (existing) return { fm: existing, created: false };
    const fm = {
        id: randomUUID(),
        description: fmDescription,
        effectLocal,
        effectNextLevel,
        effectEndUser,
        // Campos legacy fm-level (se sincronizan luego por syncLegacyFmFields en saveAmfe)
        severity: 0,
        occurrence: 0,
        detection: 0,
        ap: '',
        causes: [],
    };
    fn.failures = fn.failures || [];
    fn.failures.push(fm);
    return { fm, created: true };
}

/**
 * Agrega una causa nueva a una failure, con ambos aliases poblados.
 */
function addCause(fm, nc) {
    const ap = calculateAP(nc.severity, nc.occurrence, nc.detection);
    // Regla amfe-aph-pending.md: AP=H sin accion => placeholder "Pendiente definicion equipo APQP"
    const preventionAction = ap === 'H' ? 'Pendiente definicion equipo APQP' : '';
    const detectionAction = ap === 'H' ? 'Pendiente definicion equipo APQP' : '';

    const cause = {
        id: randomUUID(),
        cause: nc.cause,                // alias 1 (amfe.md "Schema de campos")
        description: nc.cause,          // alias 2
        severity: nc.severity,
        occurrence: nc.occurrence,
        detection: nc.detection,
        ap,                             // alias 1
        actionPriority: ap,             // alias 2
        preventionControl: nc.preventionControl,
        detectionControl: nc.detectionControl,
        preventionAction,
        detectionAction,
        specialChar: nc.specialChar || '',
        characteristicNumber: '',       // lo asigna el equipo APQP
        filterCode: '',
        responsible: nc.responsible || 'Inspector de Calidad',
        targetDate: '',
        status: ap === 'H' ? 'Pendiente' : '',
        _autoFilled: true,              // trazabilidad (regla database.md)
        _source: `I-PY-001.7 ${nc.id}`,
    };
    fm.causes = fm.causes || [];
    fm.causes.push(cause);

    // Sincronizar campos legacy fm-level con el max de las causas (regla amfe.md
    // "Campos legacy a nivel failure"). El validator FM_LEGACY_EMPTY_BUT_CAUSE_HAS_VALUE
    // es critical-blocking — necesitamos poblar fm.{severity,occurrence,detection,ap}
    // al momento de crear/poblar el fm, no solo en saveAmfe (que corre despues del gate).
    const causes = fm.causes;
    const sevMax = Math.max(...causes.map(c => Number(c.severity) || 0));
    const occMax = Math.max(...causes.map(c => Number(c.occurrence) || 0));
    const detMax = Math.max(...causes.map(c => Number(c.detection) || 0));
    const apOrder = { H: 3, M: 2, L: 1 };
    let maxAp = '', maxScore = 0;
    for (const c of causes) {
        const v = c.ap || c.actionPriority || '';
        const score = apOrder[String(v).toUpperCase()] || 0;
        if (score > maxScore) { maxAp = v; maxScore = score; }
    }
    if (sevMax > 0) fm.severity = sevMax;
    if (occMax > 0) fm.occurrence = occMax;
    if (detMax > 0) fm.detection = detMax;
    if (maxAp) {
        fm.ap = maxAp;
        fm.actionPriority = maxAp;
    }
    // Sincronizar tambien campos opcionales legacy (solo si estan vacios y la causa tiene valor)
    const firstCause = causes[0];
    if (!fm.preventionControl && firstCause.preventionControl) fm.preventionControl = firstCause.preventionControl;
    if (!fm.detectionControl && firstCause.detectionControl) fm.detectionControl = firstCause.detectionControl;
    if (!fm.specialChar && firstCause.specialChar) fm.specialChar = firstCause.specialChar;

    return cause;
}

/**
 * Aplica una causa nueva a un doc AMFE.
 * Si la OP destino no existe, flaggea en gaps[].
 */
function applyNewCause(doc, nc, tgt, gaps, logs) {
    const op = findOperation(doc, nc.opNumber);
    if (!op) {
        gaps.push({
            target: tgt.key,
            ncId: nc.id,
            reason: `OP ${nc.opNumber} "${nc.opName}" no existe`,
        });
        return false;
    }
    // Log si el nombre difiere (por seguridad solo, no bloquea)
    const opNameActual = op.name || op.operationName || '';
    if (normalizeText(opNameActual) !== normalizeText(nc.opName)) {
        logs.push(
            `[${tgt.key}] INFO: OP ${nc.opNumber} actual "${opNameActual}" != esperada "${nc.opName}" (se usa la actual)`
        );
    }

    const { we, created: weCreated } = findOrCreateWe(op, nc.weName, nc.weType);
    const { fn, created: fnCreated } = findOrCreateFunction(we, nc.functionDescription);
    const { fm, created: fmCreated } = findOrCreateFailure(
        fn,
        nc.failureDescription,
        nc.effectLocal,
        nc.effectNextLevel,
        nc.effectEndUser
    );
    addCause(fm, nc);

    logs.push(
        `[${tgt.key}] +causa ${nc.id} ${nc.specialChar} S=${nc.severity} → OP${nc.opNumber}/${nc.weName}${weCreated ? ' (WE nuevo)' : ''}${fnCreated ? ' (fn nueva)' : ''}${fmCreated ? ' (fm nueva)' : ''}`
    );
    return true;
}

/**
 * Aplica una reclasificacion FLAG→SC a un doc AMFE.
 * Busca la primera causa cuyo failure matchea matchText en searchOps.
 * Solo modifica si specialChar actual es "" (no pisa valores existentes).
 */
function applyReclass(doc, rc, tgt, gaps, logs) {
    let matchedAny = false;
    for (const opNum of rc.searchOps) {
        const op = findOperation(doc, opNum);
        if (!op) continue;
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    const fieldValue =
                        rc.matchField === 'cause'
                            ? '' // (no usado en estas reglas)
                            : fm.description || '';
                    if (!includesNormalized(fieldValue, rc.matchText)) continue;
                    for (const c of fm.causes || []) {
                        const currentSpecial = c.specialChar || '';
                        if (currentSpecial !== '' && currentSpecial !== 'SC') {
                            logs.push(
                                `[${tgt.key}] WARN reclass ${rc.id}: causa ya tiene specialChar="${currentSpecial}" (no pisa) en OP${opNum}`
                            );
                            continue;
                        }
                        // Si ya esta SC (por otro reclass previo en este run), igual permitimos
                        // aplicar este reclass para appendear su norma al preventionControl.
                        // Pero no logueamos como "~reclass" a menos que haya cambios efectivos.
                        const wasSc = currentSpecial === 'SC';
                        c.specialChar = 'SC';
                        c._autoFilled = true;
                        c._reclassSource = c._reclassSource
                            ? `${c._reclassSource}; I-PY-001.7 ${rc.id}`
                            : `I-PY-001.7 ${rc.id}`;
                        // Append norma al preventionControl si no la tiene
                        if (
                            rc.appendPrevention &&
                            !includesNormalized(c.preventionControl || '', rc.appendPrevention)
                        ) {
                            c.preventionControl = (c.preventionControl || '').trim();
                            c.preventionControl = c.preventionControl
                                ? `${c.preventionControl} / ${rc.appendPrevention}`
                                : rc.appendPrevention;
                        }
                        if (
                            rc.appendDetection &&
                            !includesNormalized(c.detectionControl || '', rc.appendDetection)
                        ) {
                            c.detectionControl = (c.detectionControl || '').trim();
                            c.detectionControl = c.detectionControl
                                ? `${c.detectionControl} / ${rc.appendDetection}`
                                : rc.appendDetection;
                        }
                        logs.push(
                            `[${tgt.key}] ~reclass ${rc.id}${wasSc ? ' (append)' : ''} → OP${opNum} FM "${(fm.description || '').slice(0, 40)}" causa "${(c.cause || c.description || '').slice(0, 40)}"`
                        );
                        matchedAny = true;
                    }
                }
            }
        }
    }
    if (!matchedAny) {
        gaps.push({
            target: tgt.key,
            ncId: rc.id,
            reason: `Reclass no encontro match ${rc.matchText} en OPs ${rc.searchOps.join(',')}`,
        });
    }
    return matchedAny;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    const { apply } = parseSafeArgs();
    const sb = await connectSupabase();

    const plan = [];
    const allLogs = [];
    const allGaps = [];

    console.log(`\nCargando gaps I-PY-001.7 en ${HEADREST_TARGETS.length} AMFEs Headrest...`);
    console.log(`  ${NEW_CAUSES.length} causas nuevas + ${RECLASSIFICATIONS.length} reclasificaciones por AMFE`);
    console.log(`  Esperado: ${NEW_CAUSES.length * HEADREST_TARGETS.length} causas nuevas + ${RECLASSIFICATIONS.length * HEADREST_TARGETS.length} reclasificaciones = ${(NEW_CAUSES.length + RECLASSIFICATIONS.length) * HEADREST_TARGETS.length} cambios totales\n`);

    for (const tgt of HEADREST_TARGETS) {
        console.log(`─── ${tgt.key} (${tgt.name}) — ${tgt.id}`);
        const { doc: before, amfe_number } = await readAmfe(sb, tgt.id);
        const after = structuredClone(before);

        const tgtLogs = [];
        const tgtGaps = [];

        // 1. Causas nuevas
        for (const nc of NEW_CAUSES) {
            applyNewCause(after, nc, tgt, tgtGaps, tgtLogs);
        }

        // 2. Reclasificaciones
        for (const rc of RECLASSIFICATIONS) {
            applyReclass(after, rc, tgt, tgtGaps, tgtLogs);
        }

        // Imprimir resumen por target
        for (const line of tgtLogs) console.log('  ' + line);
        if (tgtGaps.length > 0) {
            console.log(`  GAPS (${tgtGaps.length}):`);
            for (const g of tgtGaps) console.log(`    - ${g.ncId}: ${g.reason}`);
        }

        allLogs.push(...tgtLogs);
        allGaps.push(...tgtGaps);

        plan.push({
            id: tgt.id,
            amfeNumber: amfe_number || tgt.key,
            productName: tgt.name,
            before,
            after,
        });

        logChange(apply, `${tgt.key}: ${tgtLogs.length} cambios aplicados`, {
            gaps: tgtGaps.length,
            newCausesAttempted: NEW_CAUSES.length,
            reclassAttempted: RECLASSIFICATIONS.length,
        });
    }

    // Resumen global
    console.log('\n─── RESUMEN GLOBAL');
    console.log(`  Total cambios logged: ${allLogs.length}`);
    console.log(`  Total gaps (no aplicados): ${allGaps.length}`);
    if (allGaps.length > 0) {
        console.log('  GAPS DETALLE:');
        for (const g of allGaps) console.log(`    [${g.target}] ${g.ncId}: ${g.reason}`);
    }

    // Gate pre-commit. Si --apply y hay criticos nuevos → bloquea.
    await runWithValidation(plan, apply, async () => {
        for (const change of plan) {
            await saveAmfe(sb, change.id, change.after);
            console.log(`  saveAmfe OK ${change.amfeNumber} (${change.id})`);
        }
    });

    finish(apply);
}

main().catch(err => {
    console.error('ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
});
