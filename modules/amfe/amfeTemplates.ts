/**
 * AMFE Quick Templates
 *
 * Predefined operation templates for common manufacturing processes.
 * Each template provides a full Operation → WorkElement → Function → Failure → Cause
 * structure following the AIAG-VDA 5-level hierarchy.
 *
 * Templates cover the most common BARACK MERCOSUL manufacturing processes:
 * - Soldadura (Welding)
 * - Ensamble (Assembly)
 * - Pintura (Painting)
 * - Mecanizado CNC (CNC Machining)
 * - Inyeccion Plastica (Injection Molding)
 * - Inspeccion / Control (Inspection / Quality Control)
 *
 * Each template generates fresh UUIDs on every call to prevent shared references.
 */

import { v4 as uuidv4 } from 'uuid';
import {
    AmfeOperation,
    AmfeWorkElement,
    AmfeFunction,
    AmfeFailure,
    AmfeCause,
    WorkElementType,
    createEmptyCause,
} from './amfeTypes';
import { calculateAP } from './apTable';

/** Template metadata for UI display. */
export interface AmfeTemplate {
    id: string;
    name: string;
    description: string;
    icon: string; // emoji
    category: 'fabrication' | 'assembly' | 'finishing' | 'inspection';
    /** Factory: creates a fresh operation with new UUIDs each call. */
    create: () => AmfeOperation;
}

// --- Helpers ---

function mkCause(overrides: Partial<AmfeCause> = {}): AmfeCause {
    return { ...createEmptyCause(), id: uuidv4(), ...overrides };
}

function mkFailure(overrides: Partial<AmfeFailure> & { description: string }): AmfeFailure {
    const result: AmfeFailure = {
        id: uuidv4(),
        effectLocal: '', effectNextLevel: '', effectEndUser: '',
        severity: '',
        causes: [],
        ...overrides,
    };
    // Auto-calculate AP for causes when S/O/D are provided
    const s = Number(result.severity) || 0;
    if (s > 0) {
        for (const cause of result.causes) {
            const o = Number(cause.occurrence) || 0;
            const d = Number(cause.detection) || 0;
            if (o > 0 && d > 0) {
                cause.ap = calculateAP(s, o, d);
            }
        }
    }
    return result;
}

function mkFunction(desc: string, failures: AmfeFailure[] = []): AmfeFunction {
    return { id: uuidv4(), description: desc, requirements: '', failures };
}

function mkWorkElement(type: WorkElementType, name: string, functions: AmfeFunction[] = []): AmfeWorkElement {
    return { id: uuidv4(), type, name, functions };
}

function mkOperation(opNumber: string, name: string, workElements: AmfeWorkElement[] = []): AmfeOperation {
    return { id: uuidv4(), opNumber, name, workElements };
}

// ============================
//  TEMPLATE DEFINITIONS
// ============================

const createSoldaduraTemplate = (): AmfeOperation => {
    return mkOperation('10', 'Soldadura', [
        // Machine
        mkWorkElement('Machine', 'Equipo de Soldadura', [
            mkFunction('Aplicar cordón de soldadura según especificación', [
                mkFailure({
                    description: 'Cordón de soldadura incompleto',
                    severity: '8',
                    effectLocal: 'Pieza no conforme',
                    effectNextLevel: 'Reclamo de cliente',
                    effectEndUser: 'Falla estructural del producto',
                    causes: [
                        mkCause({ cause: 'Parámetros de soldadura incorrectos (corriente/voltaje)', occurrence: '5', detection: '4', preventionControl: 'Receta de parámetros bloqueada en equipo', detectionControl: 'Inspección visual 100%' }),
                        mkCause({ cause: 'Electrodo desgastado', occurrence: '4', detection: '5', preventionControl: 'Programa de cambio preventivo de electrodos', detectionControl: 'Verificación de desgaste por turno' }),
                    ],
                }),
                mkFailure({
                    description: 'Salpicaduras excesivas',
                    severity: '5',
                    effectLocal: 'Retrabajo en área de limpieza',
                    effectNextLevel: 'Apariencia deficiente',
                    effectEndUser: 'Insatisfacción del usuario',
                    causes: [
                        mkCause({ cause: 'Gas de protección insuficiente', occurrence: '3', detection: '4', preventionControl: 'Caudalímetro con alarma mínima', detectionControl: 'Control visual de salpicaduras' }),
                    ],
                }),
            ]),
        ]),
        // Man
        mkWorkElement('Man', 'Operador de Soldadura', [
            mkFunction('Posicionar piezas en fixture de soldadura', [
                mkFailure({
                    description: 'Posicionamiento incorrecto de piezas',
                    severity: '7',
                    effectLocal: 'Soldadura fuera de posición',
                    effectNextLevel: 'Piezas no ensamblan',
                    effectEndUser: 'Producto defectuoso',
                    causes: [
                        mkCause({ cause: 'Falta de capacitación en procedimiento', occurrence: '4', detection: '6', preventionControl: 'Matriz de habilidades actualizada', detectionControl: 'Auditoría escalonada de proceso' }),
                    ],
                }),
            ]),
        ]),
        // Method
        mkWorkElement('Method', 'Procedimiento de Soldadura', [
            mkFunction('Seguir secuencia de soldadura definida', [
                mkFailure({
                    description: 'Secuencia de soldadura no respetada',
                    severity: '6',
                    effectLocal: 'Distorsión térmica',
                    effectNextLevel: 'Dimensiones fuera de tolerancia',
                    effectEndUser: 'Ruido/vibración en producto final',
                    causes: [
                        mkCause({ cause: 'Instrucción de trabajo no actualizada', occurrence: '3', detection: '5', preventionControl: 'Revisión de IT en cada cambio de ingeniería', detectionControl: 'Verificación dimensional post-soldadura' }),
                    ],
                }),
            ]),
        ]),
    ]);
};

const createEnsambleTemplate = (): AmfeOperation => {
    return mkOperation('', 'Ensamble', [
        // Machine
        mkWorkElement('Machine', 'Herramienta de Torque', [
            mkFunction('Aplicar torque especificado a sujetadores', [
                mkFailure({
                    description: 'Torque fuera de especificación',
                    effectLocal: 'Pieza mal ajustada',
                    effectNextLevel: 'Aflojamiento en transporte',
                    effectEndUser: 'Desprendimiento de componente',
                    causes: [
                        mkCause({ cause: 'Herramienta sin calibración vigente', preventionControl: 'Plan de calibración con alerta automática', detectionControl: 'Verificación de torque con llave dinamométrica' }),
                        mkCause({ cause: 'Selección incorrecta de programa de torque', preventionControl: 'Sistema Poka-Yoke de selección', detectionControl: 'Monitoreo electrónico de torque' }),
                    ],
                }),
            ]),
        ]),
        // Man
        mkWorkElement('Man', 'Operador de Ensamble', [
            mkFunction('Ensamblar componentes según secuencia definida', [
                mkFailure({
                    description: 'Componente faltante en ensamble',
                    effectLocal: 'Ensamble incompleto',
                    effectNextLevel: 'Línea de cliente parada',
                    effectEndUser: 'Producto no funcional',
                    causes: [
                        mkCause({ cause: 'Distracción del operador', preventionControl: 'Kitting de componentes por estación', detectionControl: 'Sistema de conteo por peso / sensor' }),
                    ],
                }),
                mkFailure({
                    description: 'Componente incorrecto instalado',
                    effectLocal: 'Retrabajo / desarme',
                    effectNextLevel: 'Mezcla de variantes',
                    effectEndUser: 'Producto con función incorrecta',
                    causes: [
                        mkCause({ cause: 'Piezas similares sin identificación clara', preventionControl: 'Codificación por colores / Poka-Yoke geométrico', detectionControl: 'Verificación con scanner de código de barras' }),
                    ],
                }),
            ]),
        ]),
        // Material
        mkWorkElement('Material', 'Componentes de Ensamble', [
            mkFunction('Proveer componentes dentro de especificación', [
                mkFailure({
                    description: 'Componente fuera de dimensión',
                    effectLocal: 'No ensambla / fuerza excesiva',
                    effectNextLevel: 'Reclamo dimensional',
                    effectEndUser: 'Ruido / juego excesivo',
                    causes: [
                        mkCause({ cause: 'Variación dimensional de proveedor', preventionControl: 'PPAP / Control de recepción por muestreo', detectionControl: 'Galga pasa/no-pasa en línea' }),
                    ],
                }),
            ]),
        ]),
    ]);
};

const createPinturaTemplate = (): AmfeOperation => {
    return mkOperation('', 'Pintura', [
        // Machine
        mkWorkElement('Machine', 'Cabina de Pintura / Robot', [
            mkFunction('Aplicar capa de pintura uniforme según espesura especificada', [
                mkFailure({
                    description: 'Espesura de película fuera de rango',
                    effectLocal: 'Re-pintado',
                    effectNextLevel: 'Defecto de apariencia',
                    effectEndUser: 'Corrosión prematura',
                    causes: [
                        mkCause({ cause: 'Boquilla obstruida / desgastada', preventionControl: 'Cambio preventivo de boquillas', detectionControl: 'Medición de espesura con medidor electrónico' }),
                        mkCause({ cause: 'Presión de aire incorrecta', preventionControl: 'Regulador de presión con alarma', detectionControl: 'Control de espesura húmeda en proceso' }),
                    ],
                }),
                mkFailure({
                    description: 'Descuelgue / chorreo de pintura',
                    effectLocal: 'Retrabajo de lijado',
                    effectNextLevel: 'Rechazo por apariencia',
                    effectEndUser: 'Insatisfacción estética',
                    causes: [
                        mkCause({ cause: 'Exceso de aplicación en zonas verticales', preventionControl: 'Programa de robot optimizado por zona', detectionControl: 'Inspección visual post-aplicación' }),
                    ],
                }),
            ]),
        ]),
        // Environment
        mkWorkElement('Environment', 'Condiciones Ambientales Cabina', [
            mkFunction('Mantener temperatura y humedad dentro de rango', [
                mkFailure({
                    description: 'Defectos por humedad (burbujas, ampollas)',
                    effectLocal: 'Scrap / retrabajo',
                    effectNextLevel: 'Defectos de campo',
                    effectEndUser: 'Corrosión / desprendimiento de pintura',
                    causes: [
                        mkCause({ cause: 'Sistema HVAC con falla', preventionControl: 'Mantenimiento preventivo HVAC trimestral', detectionControl: 'Monitoreo continuo T°/HR con alarma' }),
                    ],
                }),
            ]),
        ]),
        // Material
        mkWorkElement('Material', 'Pintura / Primer / Catalizador', [
            mkFunction('Proveer pintura con viscosidad y proporción correcta', [
                mkFailure({
                    description: 'Mezcla incorrecta pintura/catalizador',
                    effectLocal: 'Secado deficiente',
                    effectNextLevel: 'Adherencia insuficiente',
                    effectEndUser: 'Descascaramiento en uso',
                    causes: [
                        mkCause({ cause: 'Error de dosificación manual', preventionControl: 'Dosificador automático volumétrico', detectionControl: 'Test de adherencia por turno (cross-hatch)' }),
                    ],
                }),
            ]),
        ]),
    ]);
};

const createMecanizadoTemplate = (): AmfeOperation => {
    return mkOperation('', 'Mecanizado CNC', [
        // Machine
        mkWorkElement('Machine', 'Centro de Mecanizado CNC', [
            mkFunction('Mecanizar pieza según plano dimensional', [
                mkFailure({
                    description: 'Dimensión fuera de tolerancia',
                    effectLocal: 'Pieza rechazada',
                    effectNextLevel: 'No ensambla en cliente',
                    effectEndUser: 'Falla funcional del producto',
                    causes: [
                        mkCause({ cause: 'Desgaste de herramienta de corte', preventionControl: 'Contador de piezas con vida útil definida', detectionControl: 'Medición dimensional con CMM cada N piezas' }),
                        mkCause({ cause: 'Offset de herramienta incorrecto', preventionControl: 'Verificación de offset post-cambio obligatoria', detectionControl: 'Primera pieza medida antes de producción' }),
                    ],
                }),
                mkFailure({
                    description: 'Rugosidad superficial deficiente',
                    effectLocal: 'Retrabajo de pulido',
                    effectNextLevel: 'Sello no estanco',
                    effectEndUser: 'Fuga / ruido',
                    causes: [
                        mkCause({ cause: 'Velocidad de avance excesiva', preventionControl: 'Parámetros de corte validados y bloqueados', detectionControl: 'Rugosímetro cada arranque de turno' }),
                    ],
                }),
            ]),
        ]),
        // Measurement
        mkWorkElement('Measurement', 'Sistema de Medición', [
            mkFunction('Verificar dimensiones críticas de pieza mecanizada', [
                mkFailure({
                    description: 'Medición incorrecta (error de MSA)',
                    effectLocal: 'Aprobación de pieza fuera de tolerancia',
                    effectNextLevel: 'Lote defectuoso enviado',
                    effectEndUser: 'Falla en campo',
                    causes: [
                        mkCause({ cause: 'Instrumento sin calibración vigente', preventionControl: 'Plan de calibración con alertas', detectionControl: 'Estudio MSA (R&R) semestral' }),
                    ],
                }),
            ]),
        ]),
        // Method
        mkWorkElement('Method', 'Programa CNC', [
            mkFunction('Ejecutar programa de mecanizado validado', [
                mkFailure({
                    description: 'Programa incorrecto cargado',
                    effectLocal: 'Pieza con geometría incorrecta',
                    effectNextLevel: 'Lote mezclado',
                    effectEndUser: 'Producto no funcional',
                    causes: [
                        mkCause({ cause: 'Nomenclatura de programa confusa', preventionControl: 'Sistema de gestión de programas con código de barras', detectionControl: 'Verificación de programa vs. orden de trabajo' }),
                    ],
                }),
            ]),
        ]),
    ]);
};

const createInyeccionTemplate = (): AmfeOperation => {
    return mkOperation('', 'Inyección Plástica', [
        // Machine
        mkWorkElement('Machine', 'Inyectora / Molde', [
            mkFunction('Inyectar pieza plástica según parámetros definidos', [
                mkFailure({
                    description: 'Pieza con rechupe (sink mark)',
                    effectLocal: 'Pieza rechazada por apariencia',
                    effectNextLevel: 'Defecto estético visible',
                    effectEndUser: 'Insatisfacción del usuario',
                    causes: [
                        mkCause({ cause: 'Presión de compactación insuficiente', preventionControl: 'Receta de parámetros validada y bloqueada', detectionControl: 'Inspección visual cada N piezas' }),
                        mkCause({ cause: 'Tiempo de enfriamiento insuficiente', preventionControl: 'Timer de ciclo con alarma mínima', detectionControl: 'Control dimensional por muestreo' }),
                    ],
                }),
                mkFailure({
                    description: 'Pieza incompleta (short shot)',
                    effectLocal: 'Scrap',
                    effectNextLevel: 'Desabastecimiento al cliente',
                    effectEndUser: 'Producto no disponible',
                    causes: [
                        mkCause({ cause: 'Temperatura de masa baja', preventionControl: 'Monitoreo de temperatura con banda muerta ajustada', detectionControl: 'Detección automática de pieza incompleta (cámara/peso)' }),
                    ],
                }),
            ]),
        ]),
        // Material
        mkWorkElement('Material', 'Resina / Masterbatch', [
            mkFunction('Proveer material plástico dentro de especificación', [
                mkFailure({
                    description: 'Material con humedad excesiva',
                    effectLocal: 'Burbujas / ráfagas en pieza',
                    effectNextLevel: 'Rechazo por apariencia',
                    effectEndUser: 'Pieza con propiedades mecánicas reducidas',
                    causes: [
                        mkCause({ cause: 'Secado insuficiente de resina', preventionControl: 'Deshumidificador con control de punto de rocío', detectionControl: 'Medición de humedad de material antes de proceso' }),
                    ],
                }),
            ]),
        ]),
        // Environment
        mkWorkElement('Environment', 'Temperatura de Molde', [
            mkFunction('Mantener temperatura de molde estable', [
                mkFailure({
                    description: 'Variación dimensional por temperatura de molde',
                    effectLocal: 'Piezas fuera de tolerancia intermitentes',
                    effectNextLevel: 'Reclamo dimensional',
                    effectEndUser: 'Problemas de ensamble en uso',
                    causes: [
                        mkCause({ cause: 'Atemperador con falla / flujo obstruido', preventionControl: 'Mantenimiento preventivo de atemperador', detectionControl: 'Sensor de temperatura en molde con alarma' }),
                    ],
                }),
            ]),
        ]),
    ]);
};

const createInspeccionTemplate = (): AmfeOperation => {
    return mkOperation('', 'Inspección / Control de Calidad', [
        // Measurement
        mkWorkElement('Measurement', 'Equipos de Medición', [
            mkFunction('Verificar conformidad de producto según plan de control', [
                mkFailure({
                    description: 'No detección de pieza defectuosa',
                    effectLocal: 'Pieza defectuosa aprobada',
                    effectNextLevel: 'Lote contaminado enviado a cliente',
                    effectEndUser: 'Falla en campo / recall',
                    causes: [
                        mkCause({ cause: 'Frecuencia de muestreo insuficiente', preventionControl: 'Plan de control con frecuencia basada en riesgo', detectionControl: 'Auditoría de producto terminado' }),
                        mkCause({ cause: 'Criterio de aceptación/rechazo ambiguo', preventionControl: 'Límite maestro / patrón de referencia disponible', detectionControl: 'Capacitación con muestras límite' }),
                    ],
                }),
            ]),
        ]),
        // Man
        mkWorkElement('Man', 'Inspector de Calidad', [
            mkFunction('Ejecutar inspección según instrucción de trabajo', [
                mkFailure({
                    description: 'Inspección incompleta (pasos omitidos)',
                    effectLocal: 'Característica no verificada',
                    effectNextLevel: 'Defecto no detectado llega a cliente',
                    effectEndUser: 'Defecto de seguridad / función',
                    causes: [
                        mkCause({ cause: 'Fatiga / monotonía en inspección visual', preventionControl: 'Rotación de inspectores cada 2 horas', detectionControl: 'Auditoría escalonada con piezas patrón insertadas' }),
                    ],
                }),
            ]),
        ]),
        // Method
        mkWorkElement('Method', 'Plan de Control / Instrucción', [
            mkFunction('Definir métodos de inspección apropiados', [
                mkFailure({
                    description: 'Método de inspección inadecuado para la característica',
                    effectLocal: 'Alta variabilidad en resultados de inspección',
                    effectNextLevel: 'Falsa aprobación / falso rechazo',
                    effectEndUser: 'Calidad inconsistente percibida',
                    causes: [
                        mkCause({ cause: 'MSA no realizado / no repetido', preventionControl: 'MSA obligatorio para cada método en plan de control', detectionControl: 'Revisión cruzada de resultados entre inspectores' }),
                    ],
                }),
            ]),
        ]),
    ]);
};

// ============================
//  EXPORT TEMPLATES CATALOG
// ============================

export const AMFE_TEMPLATES: AmfeTemplate[] = [
    {
        id: 'soldadura',
        name: 'Soldadura',
        description: 'Proceso de soldadura: equipo, operador, procedimiento. Incluye cordón incompleto, salpicaduras, distorsión.',
        icon: '🔥',
        category: 'fabrication',
        create: createSoldaduraTemplate,
    },
    {
        id: 'ensamble',
        name: 'Ensamble',
        description: 'Estación de ensamble: torque, componentes, operador. Incluye torque fuera de spec, componente faltante/incorrecto.',
        icon: '🔧',
        category: 'assembly',
        create: createEnsambleTemplate,
    },
    {
        id: 'pintura',
        name: 'Pintura',
        description: 'Cabina de pintura: robot, ambiente, material. Incluye espesura, chorreo, humedad, mezcla.',
        icon: '🎨',
        category: 'finishing',
        create: createPinturaTemplate,
    },
    {
        id: 'mecanizado',
        name: 'Mecanizado CNC',
        description: 'Centro de mecanizado: CNC, medición, programa. Incluye tolerancia, rugosidad, programa incorrecto.',
        icon: '⚙️',
        category: 'fabrication',
        create: createMecanizadoTemplate,
    },
    {
        id: 'inyeccion',
        name: 'Inyección Plástica',
        description: 'Proceso de inyección: inyectora, material, molde. Incluye rechupe, short shot, humedad.',
        icon: '🏭',
        category: 'fabrication',
        create: createInyeccionTemplate,
    },
    {
        id: 'inspeccion',
        name: 'Inspección / Control',
        description: 'Estación de inspección: equipos, inspector, plan de control. Incluye no-detección, inspección incompleta, MSA.',
        icon: '🔍',
        category: 'inspection',
        create: createInspeccionTemplate,
    },
];

/** Category display labels (Spanish). */
export const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
    fabrication: 'Fabricación',
    assembly: 'Ensamble',
    finishing: 'Acabado',
    inspection: 'Inspección',
};
