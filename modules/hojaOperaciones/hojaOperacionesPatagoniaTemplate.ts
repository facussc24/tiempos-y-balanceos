/**
 * Patagonia Inserto — Complete HO Template
 *
 * 22 sheets (one per AMFE operation). 5 sheets have full detail from PDF:
 * - Op 10:  Recepción de materia prima
 * - Op 100: Tapizado semiautomático
 * - Op 105: Refilado post-tapizado
 * - Op 110: Inspección final
 * - Op 120: Embalaje
 *
 * Remaining sheets are placeholders for user to complete.
 * Source: INSERT PATAGONIA.pdf (HO Rev.1, 19/02/2026 and 06/03/2026)
 */

import { v4 as uuidv4 } from 'uuid';
import type { HoDocument, HoDocumentHeader, HojaOperacion, HoStep, HoQualityCheck, PpeItem } from './hojaOperacionesTypes';

const DEFAULT_REACTION =
    'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME:\n' +
    'DETENGA LA OPERACIÓN\n' +
    'NOTIFIQUE DE INMEDIATO A SU LÍDER O SUPERVISOR\n' +
    'ESPERE LA DEFINICIÓN DEL LÍDER O SUPERVISOR';

const APPLICABLE_PARTS = [
    'N 227', 'N 392', 'N 389', 'N 393', 'N 390', 'N 394', 'N 391', 'N 395',
    'N 396', 'N 400', 'N 397', 'N 401', 'N 398', 'N 402', 'N 399', 'N 403',
].join('\n');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mkEmptySheet(opNumber: number, opName: string): HojaOperacion {
    return {
        id: uuidv4(),
        amfeOperationId: '',
        operationNumber: String(opNumber),
        operationName: opName,
        hoNumber: 'HO-215',
        sector: 'Tapizado',
        puestoNumber: '',
        vehicleModel: 'PATAGONIA',
        partCodeDescription: 'INSERT',
        safetyElements: [] as PpeItem[],
        hazardWarnings: [],
        steps: [],
        qualityChecks: [],
        reactionPlanText: DEFAULT_REACTION,
        reactionContact: 'Líder / Supervisor',
        visualAids: [],
        preparedBy: '',
        approvedBy: '',
        date: new Date().toISOString().split('T')[0],
        revision: '1',
        status: 'borrador' as const,
    };
}

function mkStep(n: number, desc: string, isKeyPoint = false, reason = ''): HoStep {
    return {
        id: uuidv4(),
        stepNumber: n,
        description: desc,
        isKeyPoint,
        keyPointReason: reason,
    };
}

function mkQC(data: {
    char?: string; spec?: string; method?: string; freq?: string;
    control?: string; reaction?: string; contact?: string; sc?: string; reg?: string;
}): HoQualityCheck {
    return {
        id: uuidv4(),
        characteristic: data.char || '',
        specification: data.spec || '',
        evaluationTechnique: data.method || '',
        frequency: data.freq || '',
        controlMethod: data.control || '',
        reactionAction: data.reaction || DEFAULT_REACTION,
        reactionContact: data.contact || 'Líder / Supervisor',
        specialCharSymbol: data.sc || '',
        registro: data.reg || '',
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// SHEET: Op 10 — RECEPCIONAR MATERIA PRIMA (from PDF)
// ═════════════════════════════════════════════════════════════════════════════

function createSheet10(): HojaOperacion {
    return {
        ...mkEmptySheet(10, 'RECEPCIÓN DE MATERIA PRIMA'),
        hoNumber: 'HO',
        puestoNumber: '2',
        safetyElements: ['zapatos'] as PpeItem[],
        steps: [
            mkStep(1, 'Verificar la documentación del proveedor: remito, certificado de calidad y orden de compra correspondiente.', true, 'Trazabilidad obligatoria IATF 16949'),
            mkStep(2, 'Inspeccionar visualmente el estado del embalaje de cada material. Rechazar si presenta daños, humedad o contaminación.', true, 'Primera barrera de detección de daños'),
            mkStep(3, 'Controlar la identificación de cada material recibido (código, lote, fecha de vencimiento si aplica) contra la orden de compra.', true, 'Prevención de ingreso de material incorrecto'),
            mkStep(4, 'Verificar las cantidades recibidas vs. las cantidades indicadas en el remito y la orden de compra.'),
            mkStep(5, 'Almacenar los materiales aprobados en el sector designado, respetando las condiciones de almacenamiento (temperatura, humedad, apilamiento).', true, 'Condiciones de almacenamiento afectan calidad del material'),
            mkStep(6, 'Identificar los materiales con la etiqueta de estado de inspección (Aprobado / Rechazado / En espera).', true, 'Prevención de uso de material no aprobado'),
            mkStep(7, 'Registrar el ingreso en el sistema y archivar la documentación respaldatoria.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Estado del embalaje: sin daños, humedad ni contaminación', method: 'Visual', control: 'Inspección visual 100%', freq: 'Cada recepción', contact: 'OP', reg: 'Planilla de recepción' }),
            mkQC({ char: 'Cantidad recibida vs. remito y orden de compra', method: 'Conteo / Documentación', control: 'Verificación documental', freq: 'Cada recepción', contact: 'OP', reg: 'Planilla de recepción' }),
            mkQC({ char: 'Identificación de Hilo Needle thread (Linanhyl) - Verificar color según variante (Jet Black / Alpe Gray)', method: 'Visual / Documentación', control: 'Verificación contra planilla', freq: 'Cada recepción', contact: 'OP', reg: 'Planilla de recepción', sc: 'SC' }),
            mkQC({ char: 'Identificación y fecha de SikaMelt® 171IMG (SIKA)', method: 'Visual / Documentación', control: 'Verificación contra planilla + FIFO', freq: 'Cada recepción', contact: 'OP', reg: 'Planilla de recepción', sc: 'SC' }),
            mkQC({ char: 'Identificación de Tessa 52110 1500mm x 200m (TESA)', method: 'Visual / Documentación', control: 'Verificación contra planilla', freq: 'Cada recepción', contact: 'OP', reg: 'Planilla de recepción' }),
            mkQC({ char: 'Identificación y estado de Vinilo PVC 1mm+3mm PU (SANSUY) - Verificar color según variante (Titan Black / Platinium)', method: 'Visual / Documentación', control: 'Verificación contra planilla + muestra de color', freq: 'Cada recepción', contact: 'OP', reg: 'Planilla de recepción', sc: 'SC' }),
            mkQC({ char: 'Identificación y lote de PC/ABS CYCOLOY™ LG9000 (SABIC)', method: 'Visual / Documentación', control: 'Verificación contra planilla + CoC', freq: 'Cada recepción', contact: 'OP', reg: 'Planilla de recepción', sc: 'SC' }),
            mkQC({ char: 'Identificación de PU FOAM 35Kg/m3 + 3mm (Sponge layer)', method: 'Visual / Documentación', control: 'Verificación contra planilla', freq: 'Cada recepción', contact: 'OP', reg: 'Planilla de recepción' }),
        ],
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// SHEET: Op 100 — TAPIZADO SEMIAUTOMÁTICO (from PDF)
// ═════════════════════════════════════════════════════════════════════════════

function createSheet100(): HojaOperacion {
    return {
        ...mkEmptySheet(100, 'TAPIZADO SEMIAUTOMÁTICO'),
        safetyElements: ['anteojos'] as PpeItem[],
        steps: [
            mkStep(1, 'Presionar ambos botones hasta que solo quede encendida la luz verde.', true, 'Inicio seguro del ciclo — ambos botones = protección bimanual'),
            mkStep(2, 'Tomar vinilos y piezas plásticas a producir de la estantería con perchas.'),
            mkStep(3, 'Colocar las piezas plásticas en la parte superior de la máquina, lo que dará inicio al vacío.', true, 'Posicionamiento correcto es crítico para adhesión'),
            mkStep(4, 'Ubicar el vinilo en la parte inferior haciendo coincidir el borde de la costura con la guía/canaleta.', true, 'Alineación de costura con guía determina aspecto final'),
            mkStep(5, 'Presionar ambos botones nuevamente para dar inicio al ciclo, dejar de presionar una vez que la puerta se cierra por completo.', true, 'Comando bimanual de seguridad'),
            mkStep(6, 'Una vez finalizado el ciclo, y se levante por completo la puerta, retirar la pieza.', true, 'No retirar antes de que la puerta esté completamente abierta — riesgo de seguridad (CC S=10)'),
        ],
        qualityChecks: [
            mkQC({ char: 'Verificación de parámetros de máquina (tiempos de ciclo)', spec: 'Según set-up definido en planilla', method: 'Timer / Display de máquina', control: 'Lectura de display y registro en planilla de set-up', freq: 'Inicio de turno', contact: 'OP', reg: 'Set up', sc: 'SC' }),
            mkQC({ char: 'Tiempo de ciclo del operador', spec: 'Según estudio de tiempos', method: 'Cronómetro / Observación', control: 'Medición y registro', freq: 'Según plan de control', contact: 'Ingeniería', reg: 'Planilla de tiempos' }),
            mkQC({ char: 'Verificación de temperatura en vinilo y sustrato', spec: 'Rango definido en set-up', method: 'Termómetro infrarrojo', control: 'Medición y registro frecuencial', freq: 'Cada 2 horas', contact: 'Calidad', reg: 'Set up', sc: 'SC' }),
        ],
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// SHEET: Op 105 — REFILADO POST-TAPIZADO (from PDF)
// ═════════════════════════════════════════════════════════════════════════════

function createSheet105(): HojaOperacion {
    return {
        ...mkEmptySheet(105, 'REFILADO DE PIEZA'),
        safetyElements: ['anteojos', 'guantes'] as PpeItem[],
        steps: [
            mkStep(1, 'Tomar las piezas pre-tapizadas y colocarlas en la mesa de refilado.'),
            mkStep(2, 'Con un cutter, realizar el refilado completo de la pieza: recortar los bordes y material sobrante según la imagen de referencia.', true, 'Corte según referencia visual — exceso de corte = scrap irrecuperable'),
            mkStep(3, 'Verificar el refilado con la pieza patrón para asegurarse de que esté correcto. La pieza patrón se encuentra junto al puesto.', true, 'Pieza patrón es el estándar de aceptación'),
        ],
        qualityChecks: [
            mkQC({ char: 'REFILADO OK', spec: 'Conforme a pieza patrón', method: 'PIEZA PATRON', control: 'Comparación visual contra pieza patrón', freq: 'Inicio de turno / cambio de lote', contact: 'OP', reg: 'SET UP', sc: 'SC' }),
        ],
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// SHEET: Op 110 — INSPECCIÓN FINAL (from PDF)
// ═════════════════════════════════════════════════════════════════════════════

function createSheet110(): HojaOperacion {
    return {
        ...mkEmptySheet(110, 'INSPECCIÓN DE LA PIEZA TERMINADA'),
        safetyElements: ['anteojos', 'guantes', 'zapatos'] as PpeItem[],
        steps: [
            mkStep(1, 'Tomar la pieza terminada y realizar una inspección visual completa, verificando que no presente defectos de aspecto (manchas, roturas, despegues, deformaciones u otros).', true, 'Detección de defectos estéticos — CC, cada pieza'),
            mkStep(2, 'Controlar la costura y los bordes de la pieza, asegurando que cumplan con los requisitos de calidad según la imagen de referencia.', true, 'Detección de defectos de costura — CC, cada pieza'),
            mkStep(3, 'Si la pieza es conforme, aprobarla. Caso contrario, seguir el plan de reacción ante no conforme.', true, 'Decisión de aprobación/rechazo'),
        ],
        qualityChecks: [
            mkQC({ char: 'ASPECTO', spec: 'Sin manchas, roturas, despegues, deformaciones', method: 'Visual', control: 'Inspección visual 100%', freq: 'Cada pieza', contact: 'CC', reg: 'SI', sc: 'CC' }),
            mkQC({ char: 'COSTURA', spec: 'Conforme a imagen de referencia, sin saltos ni hilos sueltos', method: 'Visual', control: 'Inspección visual 100%', freq: 'Cada pieza', contact: 'CC', reg: 'SI', sc: 'CC' }),
        ],
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// SHEET: Op 120 — EMBALAJE (from PDF)
// ═════════════════════════════════════════════════════════════════════════════

function createSheet120(): HojaOperacion {
    return {
        ...mkEmptySheet(120, 'EMBALAJE'),
        safetyElements: ['anteojos', 'guantes', 'zapatos'] as PpeItem[],
        steps: [
            mkStep(1, 'Tomar la caja de embalaje (496mm x 634mm x 170mm) y colocar 8 piezas por caja según la disposición indicada en la imagen de referencia (vista superior).', true, 'Cantidad y disposición definida: 8 piezas por caja'),
            mkStep(2, 'Armar el pallet colocando 3 cajas por piso (24 piezas por piso). Idealmente, si la caja soporta, apilar hasta 3 pisos (72 piezas por pallet).', true, 'Máximo 3 pisos — exceso puede dañar piezas'),
            mkStep(3, 'Colocar la etiqueta de producto terminado en la caja según la imagen de referencia.', true, 'Trazabilidad obligatoria'),
            mkStep(4, 'Envolver el pallet completo con film.'),
        ],
        qualityChecks: [
            mkQC({ char: '8 piezas por caja', spec: '8 unidades exactas por caja', method: 'Visual', control: 'Conteo visual antes de cerrar caja', freq: 'Cada caja', contact: 'OP', reg: 'N/A' }),
            mkQC({ char: '3 cajas por piso / máx. 3 pisos', spec: '3 cajas/piso, máx. 3 pisos (72 pzas/pallet)', method: 'Visual', control: 'Verificación visual del apilado', freq: 'Cada pallet', contact: 'OP', reg: 'N/A' }),
            mkQC({ char: 'Etiqueta de producto terminado', spec: 'Etiqueta correcta según código de producto', method: 'Visual', control: 'Verificación visual de etiqueta', freq: 'Cada caja', contact: 'OP', reg: 'N/A' }),
        ],
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORT: Complete HO document
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Creates the complete HO document for INSERTO PATAGONIA.
 * 5 sheets have full detail from PDF, 17 are placeholders.
 */
export function createPatagoniaHoDocument(): HoDocument {
    const header: HoDocumentHeader = {
        formNumber: 'I-IN-002.4-R01',
        organization: 'BARACK MERCOSUL',
        client: 'Volkswagen Argentina',
        partNumber: 'INSERTO',
        partDescription: 'TAPIZADO INSERT',
        applicableParts: APPLICABLE_PARTS,
        linkedAmfeProject: 'PATAGONIA - INSERTO',
        linkedCpProject: 'PATAGONIA - INSERTO',
    };

    const sheets: HojaOperacion[] = [
        // Op 10: Full detail
        createSheet10(),
        // Ops 15-50: Placeholders (Corte + Costura)
        mkEmptySheet(15, 'CORTE DE COMPONENTES - Preparación de corte'),
        mkEmptySheet(20, 'CORTE DE COMPONENTES - Cortar componentes'),
        mkEmptySheet(25, 'CORTE DE COMPONENTES - Control con mylar'),
        mkEmptySheet(30, 'CORTE DE COMPONENTES - Almacenamiento WIP'),
        mkEmptySheet(40, 'COSTURA - Refilado'),
        mkEmptySheet(50, 'COSTURA - Costura CNC'),
        // Ops 60-92: Placeholders (Troquelado, Inyección, Prearmado, Adhesivado)
        mkEmptySheet(60, 'TROQUELADO - Troquelado de espuma'),
        mkEmptySheet(61, 'TROQUELADO - Almacenamiento WIP'),
        mkEmptySheet(70, 'INYECCIÓN PLÁSTICA - Inyección de piezas plásticas'),
        mkEmptySheet(71, 'INYECCIÓN PLÁSTICA - Almacenamiento WIP'),
        mkEmptySheet(80, 'PREARMADO DE ESPUMA'),
        mkEmptySheet(81, 'PREARMADO - Almacenamiento WIP'),
        mkEmptySheet(90, 'ADHESIVADO - Adhesivar piezas'),
        mkEmptySheet(91, 'ADHESIVADO - Inspeccionar pieza adhesivada'),
        mkEmptySheet(92, 'ADHESIVADO - Almacenamiento WIP'),
        // Op 100: Full detail
        createSheet100(),
        // Op 103: Placeholder
        mkEmptySheet(103, 'REPROCESO: FALTA DE ADHESIVO'),
        // Op 105: Full detail
        createSheet105(),
        // Op 110: Full detail
        createSheet110(),
        // Op 111: Placeholder
        mkEmptySheet(111, 'CLASIFICACIÓN Y SEGREGACIÓN DE PRODUCTO NO CONFORME'),
        // Op 120: Full detail
        createSheet120(),
    ];

    return { header, sheets };
}
