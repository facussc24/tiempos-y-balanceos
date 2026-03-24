#!/usr/bin/env node
/**
 * Seed script: AMFE INSERTO - Proyecto PATAGONIA (VW)
 *
 * Creates the SQLite database and inserts the complete AMFE document
 * extracted from the PDF "AMFE_ _INSERT_Rev.pdf"
 *
 * Usage: node scripts/seed-amfe-inserto.mjs
 */

import initSqlJs from 'sql.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { join } from 'path';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uuid = () => randomUUID();
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/** Create an empty AmfeCause with defaults */
function mkCause(data) {
    return {
        id: uuid(),
        cause: data.cause || '',
        preventionControl: data.prev || '',
        detectionControl: data.det || '',
        occurrence: data.O ?? '',
        detection: data.D ?? '',
        ap: data.ap || '',
        characteristicNumber: data.charNum || '',
        specialChar: data.sc || '',
        filterCode: '',
        preventionAction: '',
        detectionAction: '',
        responsible: '',
        targetDate: '',
        status: '',
        actionTaken: '',
        completionDate: '',
        severityNew: '',
        occurrenceNew: '',
        detectionNew: '',
        apNew: '',
        observations: data.obs || '',
    };
}

/** Create an AmfeFailure */
function mkFailure(data) {
    return {
        id: uuid(),
        description: data.desc || '',
        effectLocal: data.efLocal || '',
        effectNextLevel: data.efClient || '',
        effectEndUser: data.efUser || '',
        severity: data.S ?? '',
        severityLocal: '',
        severityNextLevel: '',
        severityEndUser: '',
        causes: (data.causes || []).map(mkCause),
    };
}

/** Create an AmfeFunction */
function mkFunc(data) {
    return {
        id: uuid(),
        description: data.desc || '',
        requirements: data.req || '',
        failures: (data.failures || []).map(mkFailure),
    };
}

/** Create an AmfeWorkElement */
function mkWE(type, name, functions) {
    return {
        id: uuid(),
        type,
        name,
        functions: functions.map(mkFunc),
    };
}

/** Create an AmfeOperation */
function mkOp(opNumber, name, workElements) {
    return {
        id: uuid(),
        opNumber: String(opNumber),
        name,
        workElements,
    };
}

/** Standard WIP storage operation template (used by Op 30, 61, 71, 81, 92) */
function mkWipOp(opNumber, parentProcess, funcInternal, funcClient, funcUser, sevBase = 7) {
    return mkOp(opNumber, `${parentProcess} - ALMACENAMIENTO EN MEDIOS WIP`, [
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
            {
                desc: funcInternal,
                failures: [
                    {
                        desc: 'Faltante/exceso de componentes en la caja del kit',
                        efLocal: 'Una porción de la producción sea descartada (scrap)',
                        efClient: 'Parada de línea entre una hora y un turno de producción completo',
                        efUser: 'Degradación de la función secundaria del vehículo',
                        S: sevBase,
                        causes: [{
                            cause: 'El Operador no realiza el conteo/verificación completo de la cantidad de componentes según la OP.',
                            prev: 'Existencia de documentación de proceso para la preparación del kit, que guía la cantidad y tipo de componentes',
                            det: 'Verificación manual o conteo visual del kit por parte del operador',
                            O: 7, D: 8, ap: 'H', sc: 'SC',
                        }],
                    },
                    {
                        desc: 'Componente incorrecto (variante o color) incluido.',
                        efLocal: 'Una porción de la producción afectada debe ser desechada',
                        efClient: 'Esto requeriría una acción de reparación o reemplazo en campo o una detención del envío',
                        efUser: 'Degradación de la función secundaria del vehículo',
                        S: sevBase,
                        causes: [{
                            cause: 'Mano de Obra no realiza la verificación visual contra la Orden de Producción (OP)',
                            prev: 'La Orden de Producción (OP) se encuentra disponible y formalizada al igual que la instrucción del operador',
                            det: 'El operador realiza una verificación visual del componente físico (color o variante) contra el código listado en la OP antes de incluirlo en el kit',
                            O: 7, D: 8, ap: 'H', sc: 'SC',
                        }],
                    },
                    {
                        desc: 'Pieza dañada (rasgadura, mancha) incluida en el kit.',
                        efLocal: 'Descartar (scrap) una porción de la producción',
                        efClient: 'Parada de línea entre una hora y un turno de producción completo',
                        efUser: 'Degradación de la función secundaria del vehículo',
                        S: sevBase,
                        causes: [{
                            cause: 'El Operador (Mano de Obra) no sigue el procedimiento de revisión visual de defectos (rasgaduras o manchas)',
                            prev: 'Instrucción o procedimiento (Mano de Obra/Método) que establece que el operador debe buscar rasgaduras o manchas antes de incluir la pieza en el kit.',
                            det: 'El operador realiza una inspección visual para detectar el Modo de Falla (rasgadura/mancha) antes de liberar el kit.',
                            O: 7, D: 8, ap: 'H', sc: 'SC',
                        }],
                    },
                ],
            },
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

// ─── AMFE Header ─────────────────────────────────────────────────────────────

const header = {
    organization: 'BARACK MERCOSUL',
    location: 'PLANTA HURLINGHAM',
    client: 'Volkswagen Argentina',
    modelYear: 'PATAGONIA',
    subject: 'INSERTO',
    partNumber: 'TBD',
    amfeNumber: 'AMFE-00001',
    revision: 'PRELIMINAR',
    scope: 'AMFE de Proceso Preliminar - Producto Inserto - Plataforma Patagonia',
    applicableParts: 'TBD',
    startDate: '2025-11-27',
    revDate: '2025-11-27',
    team: 'Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Cristina Rabago (Seguridad e Higiene), Marianna Vera (Producción)',
    responsible: 'Carlos Baptista',
    processResponsible: 'Carlos Baptista',
    approvedBy: '',
    confidentiality: 'Preliminar - Sujeto a revisión',
};

// ─── Operation 10: RECEPCION DE MATERIA PRIMA ────────────────────────────────

const op10 = mkOp(10, 'RECEPCIONAR MATERIA PRIMA', [
    mkWE('Machine', 'Autoelevador', [
        {
            desc: 'Garantizar la estabilidad y la integridad física del material durante el transporte interno',
            failures: [
                {
                    desc: 'Material / pieza golpeada o dañada durante transporte',
                    efLocal: 'Riesgo de reproceso o scrap; paro de línea si no hay stock',
                    efClient: 'Montaje con ajuste forzado / imposibilidad de ensamblar',
                    efUser: 'Posible ruido o falla estética',
                    S: 6,
                    causes: [
                        {
                            cause: 'Mala estiba y embalaje inadecuado',
                            prev: 'Medios de embalaje validados',
                            det: 'Inspección visual en recepción',
                            O: 6, D: 6, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Manipulación incorrecta en tránsito',
                            prev: 'Existencia de instrucciones de trabajo que definen cómo debe estibarse y manipularse el material.',
                            det: 'Verificación del estado del embalaje antes de que el camión salga o inmediatamente cuando llega a su destino',
                            O: 7, D: 6, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Falta de inspección visual al recibir',
                            prev: 'Instrucción de Trabajo de Recepción que exige la verificación física y visual del material',
                            det: 'Inspección visual en recepción',
                            O: 6, D: 5, ap: 'M', sc: '',
                            obs: 'PRELIMINAR: Verificar si la instrucción de trabajo de recepción está implementada',
                        },
                        {
                            cause: 'Almacenaje inadecuado en transporte (sin protecciones)',
                            prev: 'Procedimientos de Logística sobre estiba segura y uso de Embalajes Cubiertos o cerrados',
                            det: 'Inspección Visual de daños/suciedad en el empaque al recibir.',
                            O: 6, D: 6, ap: 'H', sc: 'SC',
                        },
                    ],
                },
            ],
        },
    ]),
    mkWE('Man', 'Operador de producción / Operador de calidad / Líder de equipo', [
        {
            desc: 'Comprobar que el embalaje no esté dañado. Corroborar que la orden sea la correcta. Cargar la materia prima en ARB.',
            failures: [],
        },
    ]),
    mkWE('Measurement', 'Calibres de diferentes tamaños / Micrómetro / Probeta de flamabilidad / Probeta de peeling', [
        {
            desc: 'Verificar el cumplimiento y la trazabilidad de la materia prima recibida',
            failures: [
                {
                    desc: 'Falta de documentación o trazabilidad',
                    efLocal: 'Riesgo de mezclar lotes no conformes',
                    efClient: 'Dificultades en trazabilidad si surge un reclamo',
                    efUser: 'No afecta',
                    S: 7,
                    causes: [
                        {
                            cause: 'Procesos administrativos deficientes',
                            prev: 'El sistema [ARB] obliga a registrar lote y código en recepción y verifica contra base de datos',
                            det: 'Verificación automática del lote/código registrado contra la base de datos',
                            O: 3, D: 7, ap: 'L', sc: '',
                            obs: '',
                        },
                        {
                            cause: 'No se utiliza el sistema ARB',
                            prev: 'Procedimiento Operacional Estándar que exige y documenta la obligatoriedad del uso del sistema ARB.',
                            det: 'El sistema impide la emisión de ubicaciones o el registro de entrada del material hasta que todos los campos del ARB sean completados.',
                            O: 6, D: 4, ap: 'H', sc: '',
                            obs: '',
                        },
                        {
                            cause: 'Proveedor sin sistema robusto de trazabilidad',
                            prev: 'Auditorías de Sistema y Requisitos que validan la capacidad de trazabilidad del proveedor antes de su aprobación.',
                            det: 'Verificación del Certificado de Conformidad y registro obligatorio de lote en el sistema de recepción antes de la aceptación de la materia prima.',
                            O: 5, D: 6, ap: 'M', sc: 'SC',
                        },
                    ],
                },
            ],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas Visuales', [
        {
            desc: 'Asegurar la conformidad de la calidad y cantidad de material recibido',
            failures: [
                {
                    desc: 'Material con especificación errónea (dimensiones, color, dureza, etc.)',
                    efLocal: 'Problemas de calidad durante el ensamble',
                    efClient: 'Potencial parada de línea',
                    efUser: 'Potencial reclamo de aspecto/comfort',
                    S: 6,
                    causes: [
                        {
                            cause: 'Error en la orden de compra o ficha técnica',
                            prev: 'Revisión de Ingeniería de la Ficha Técnica/OC antes de la emisión al proveedor.',
                            det: 'Control dimensional por muestreo con calibre en recepción.',
                            O: 5, D: 6, ap: 'M', sc: 'SC',
                        },
                        {
                            cause: 'Proveedor no respeta tolerancias',
                            prev: 'Requisitos Contractuales de Calidad y Auditorías al Proveedor para verificar su capacidad de Control Estadístico de Proceso',
                            det: 'Revisión del Certificado de Calidad (CoC) y Control Dimensional por Muestreo en recepción.',
                            O: 7, D: 6, ap: 'H', sc: 'SC',
                            obs: 'PRELIMINAR: O=7 estimado - sin datos históricos del proveedor',
                        },
                    ],
                },
            ],
        },
    ]),
    mkWE('Material', 'Etiquetas blancas / Etiquetas de rechazo / Engrapadora / Libretas / Post-it / Lápiz blanco / Tijera / Lapicera / Bandas elásticas / Cinta scotch', [
        {
            desc: 'Disponer de etiquetas blancas 100x60 y etiquetas de rechazo para clasificación.',
            failures: [],
        },
    ]),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587 - Decreto Reglamentario 351/79', [
        {
            desc: 'Mantener las condiciones de seguridad ocupacional según la Ley 19587',
            failures: [
                {
                    desc: 'Contaminación / suciedad en la materia prima',
                    efLocal: 'Potencial scrap',
                    efClient: 'Potencial parada de línea. Problemas en el ensamble final',
                    efUser: 'Potencial reclamo de aspecto/comfort',
                    S: 6,
                    causes: [
                        {
                            cause: 'Almacenaje inadecuado en transporte (sin protecciones)',
                            prev: 'Procedimientos de Logística sobre estiba segura y uso de Embalajes Cubiertos o cerrados',
                            det: 'Inspección Visual de daños/suciedad en el empaque al recibir.',
                            O: 6, D: 6, ap: 'M', sc: 'SC',
                        },
                        {
                            cause: 'Ambiente sucio en planta del proveedor',
                            prev: 'N/A',
                            det: 'Inspección Visual de la pieza y Revisión del Certificado de Calidad del proveedor.',
                            O: 5, D: 6, ap: 'M', sc: 'SC',
                        },
                    ],
                },
            ],
        },
    ]),
]);

// ─── Operation 15: CORTE - Preparacion de corte ──────────────────────────────

const op15 = mkOp(15, 'CORTE DE COMPONENTES DE VINILO O TELA - Preparación de corte', [
    mkWE('Machine', 'Zorras manuales / Cortadora de paños', [
        {
            desc: 'Lograr el paño a la medida requerida',
            failures: [
                {
                    desc: 'Corte fuera de medida (paño más corto o más largo que la especificación).',
                    efLocal: 'Pérdida de material (scrap).',
                    efClient: 'Imposibilidad de ensamblar la pieza, potencial paro de línea.',
                    efUser: 'Posible ruido o falla estética',
                    S: 7,
                    causes: [{
                        cause: 'Error del operario al medir con la regla metálica.',
                        prev: 'Medición de la primera capa usando la regla metálica fija como referencia. Uso de la primera capa como plantilla para alinear las capas subsecuentes.',
                        det: 'No se realiza una medición del paño una vez cortado',
                        O: 7, D: 10, ap: 'H', sc: 'SC',
                        obs: 'CRITICO: D=10 indica que NO hay detección. Definir control post-corte.',
                    }],
                },
            ],
        },
    ]),
    mkWE('Man', 'Operador de producción / Líder de equipo', []),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Tijera / Lapicera / Regla', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', [
        {
            desc: 'Mantener las condiciones de seguridad ocupacional según la Ley 19587',
            failures: [
                {
                    desc: 'Contaminación / suciedad en la materia prima',
                    efLocal: 'Retrabajo',
                    efClient: 'Reclamo de aspecto',
                    efUser: 'Posible ruido o falla estética',
                    S: 5,
                    causes: [
                        {
                            cause: 'Falta de inspección al llegar',
                            prev: 'Instrucción de Trabajo',
                            det: 'Inspección Visual del estado de la pieza/empaque, requerida como punto de control del proceso de recepción.',
                            O: 6, D: 6, ap: 'M', sc: 'SC',
                        },
                        {
                            cause: 'Ambiente sucio en planta del proveedor',
                            prev: 'N/A',
                            det: 'Inspección Visual de la pieza y Revisión del Certificado de Calidad del proveedor.',
                            O: 5, D: 6, ap: 'M', sc: 'SC',
                        },
                    ],
                },
            ],
        },
    ]),
]);

// ─── Operation 20: CORTE - Cortar componentes ────────────────────────────────

const op20 = mkOp(20, 'CORTE DE COMPONENTES DE VINILO O TELA - Cortar componentes', [
    mkWE('Machine', 'Zorras manuales / Máquina de corte', [
        {
            desc: 'Lograr el Contorno/Forma Geométrica del patrón Conforme al Mylar',
            failures: [
                {
                    desc: 'Desviación en el corte de los pliegos',
                    efLocal: 'Retrabajo',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo.',
                    efUser: 'Degradación de la función secundaria del vehículo.',
                    S: 5,
                    causes: [{
                        cause: 'Parámetros de corte mal ingresados',
                        prev: 'La maquina alinea y corta automáticamente el vinilo / tela',
                        det: 'Set up de lanzamiento / Regla / Inspección visual',
                        O: 3, D: 7, ap: 'L', sc: '',
                    }],
                },
                {
                    desc: 'Falla en la maquina',
                    efLocal: 'Retrabajo',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo.',
                    efUser: 'Degradación de la función secundaria del vehículo.',
                    S: 6,
                    causes: [{
                        cause: 'Falla en la máquina de corte',
                        prev: 'Instructivo para colocar correctamente tensión y velocidad de rollo',
                        det: 'Inspección visual',
                        O: 6, D: 8, ap: 'H', sc: 'SC',
                        obs: 'TBD: Confirmar parámetros de la máquina cuando llegue el equipo',
                    }],
                },
                {
                    desc: 'Selección incorrecta del material',
                    efLocal: '100% del material cortado es scrap por material incorrecto.',
                    efClient: 'Parada de línea mayor a un turno de producción completo. Paro de envíos.',
                    efUser: 'Degradación de la función primaria del vehículo.',
                    S: 8,
                    causes: [
                        {
                            cause: 'Falta de verificación del código de material antes del corte.',
                            prev: 'Orden Automática del Sistema: El sistema emite la orden con los datos correctos',
                            det: 'Inspección Visual (Hoja vs. Etiqueta): El operario compara visualmente la etiqueta del rollo contra la planilla de mesa.',
                            O: 5, D: 6, ap: 'H', sc: 'SC',
                        },
                    ],
                },
                {
                    desc: 'Vinilo mal identificado',
                    efLocal: 'Una porción de la producción tiene que ser descartada (scrap)',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo.',
                    efUser: 'Degradación de la función secundaria del vehículo.',
                    S: 7,
                    causes: [{
                        cause: 'Error en identificación del material',
                        prev: 'Etiquetado Estándar (Logística): Procedimiento de identificación en almacén',
                        det: 'Inspección Visual de Atributos: El operador verifica color/grano, no solo la etiqueta',
                        O: 6, D: 7, ap: 'H', sc: 'SC',
                    }],
                },
                {
                    desc: 'Corte incompleto o irregular',
                    efLocal: 'Una porción de la producción tiene que ser descartada (scrap)',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo.',
                    efUser: 'Degradación de la función secundaria del vehículo.',
                    S: 7,
                    causes: [{
                        cause: 'Desgaste de la cuchilla de corte.',
                        prev: 'Cambio de cuchillas por calendario u horas de uso.',
                        det: 'Verificación de cuchilla en set up de lanzamiento',
                        O: 5, D: 7, ap: 'M', sc: 'SC',
                    }],
                },
            ],
        },
    ]),
    mkWE('Man', 'Operador de producción / Líder de equipo', []),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Etiquetas blancas / Etiquetas de rechazo / Tijera / Lapicera / Bandas elásticas', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', [
        {
            desc: 'Mantener las condiciones de seguridad ocupacional',
            failures: [{
                desc: 'Contaminación del material durante el corte o almacenamiento en el área',
                efLocal: 'Retrabajo de una porción de la producción.',
                efClient: 'Menos del 10% de los productos afectados, requiere clasificación adicional.',
                efUser: 'Defecto visual moderado en apariencia o vibración.',
                S: 4,
                causes: [{
                    cause: 'Ambiente de trabajo con polvo o partículas',
                    prev: 'Procedimientos de limpieza periódica en el área de corte.',
                    det: 'Inspección visual (El operador verifica visualmente el material antes/durante el proceso.)',
                    O: 3, D: 6, ap: 'L', sc: '',
                }],
            }],
        },
    ]),
]);

// ─── Operation 25: CORTE - Control con mylar ─────────────────────────────────

const op25 = mkOp(25, 'CORTE DE COMPONENTES DE VINILO O TELA - Control con mylar', [
    mkWE('Man', 'Operador de producción / Líder de equipo', [
        {
            desc: 'Verificar la conformidad dimensional del contorno cortado. Asegurar la conformidad dimensional del contorno cortado.',
            failures: [{
                desc: 'Omitir la operación de inspección',
                efLocal: 'Generación de Scrap',
                efClient: 'Parada de línea de producción (menor a una hora) o necesidad de incorporar procesos adicionales de clasificación de productos defectuosos',
                efUser: 'Pérdida de la función secundaria del vehículo',
                S: 6,
                causes: [{
                    cause: 'Operador de producción omite la tarea de verificación visual',
                    prev: 'Instrucción/Checklist de Set Up',
                    det: 'Auditorías internas',
                    O: 6, D: 9, ap: 'H', sc: 'SC',
                    obs: 'CRITICO: D=9 indica detección muy débil. Definir controles de proceso más robustos.',
                }],
            }],
        },
    ]),
    mkWE('Measurement', 'Mylar de control', [
        {
            desc: 'Asegurar la Verificación Rápida y Precisa de la Geometría y el Contorno del Corte Conforme a las Tolerancias Específicas',
            failures: [],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Operation 30: CORTE - Almacenamiento WIP ────────────────────────────────

const op30 = mkWipOp(30, 'CORTE DE COMPONENTES DE VINILO O TELA',
    'Preparar Kit completo y ordenado de componentes (según la Orden de Producción); Contener componentes en medios definidos; Etiquetar caja con identificación mínima obligatoria (N° de parte/modelo, OP, Fecha/Turno); y Mover kits a la zona de costura.',
    'Permitir el Ensamble de la Pieza',
    'Garantizar la Apariencia Estética del Interior y la Integridad Funcional del Producto sin Ruidos Objetables durante la Vida Útil Esperada.',
    7
);

// ─── Operation 40: COSTURA - Refilado ────────────────────────────────────────

const op40 = mkOp(40, 'Costura - Refilado', [
    mkWE('Machine', 'Maquina refiladora', [
        {
            desc: 'Generar la dimensión de refilado según especificación en la ubicación correcta.',
            failures: [
                {
                    desc: 'Posicionado de cortes NOK',
                    efLocal: 'Scrap potencial / 100% de Retrabajo',
                    efClient: 'Parada de línea de producción menor a una hora',
                    efUser: 'Pérdida/Degradación de la función secundaria',
                    S: 6,
                    causes: [{
                        cause: 'Operador posiciona el corte en la refiladora fuera de la tolerancia marcada en la ayuda visual / instrucción',
                        prev: 'Ayudas Visuales y Instrucción de Proceso (HO).',
                        det: 'Control Visual del Operario (Inspección 100%) / Piezas Patrón de Referencia',
                        O: 7, D: 6, ap: 'M', sc: 'SC',
                    }],
                },
                {
                    desc: 'Refilado fuera de especificaciones.',
                    efLocal: '100% Retrabajo fuera de línea o Scrap',
                    efClient: 'Parada de línea de producción menor a una hora',
                    efUser: 'Pérdida/Degradación de la función secundaria',
                    S: 6,
                    causes: [
                        {
                            cause: 'Operador posiciona el corte en la refiladora fuera de la tolerancia marcada en la ayuda visual / instrucción.',
                            prev: 'Ayudas Visuales y Instrucción de Proceso (HO).',
                            det: 'Control Visual del Operario (Inspección 100%) / Piezas Patrón de Referencia',
                            O: 7, D: 6, ap: 'M', sc: 'SC',
                        },
                        {
                            cause: 'Cuchilla desafilada / desgastada, resultando en refilado con rebaba o dimensión fuera de límite.',
                            prev: 'Mantenimiento Preventivo',
                            det: 'Inspección de Primera Pieza (Verificación del Set Up)',
                            O: 1, D: 4, ap: 'L', sc: 'SC',
                        },
                    ],
                },
            ],
        },
    ]),
    mkWE('Man', 'Operador de producción / Líder de equipo', []),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Operation 50: COSTURA CNC ───────────────────────────────────────────────

const op50 = mkOp(50, 'Costura - Costura CNC', [
    mkWE('Machine', 'Máquina de costura CNC', [
        {
            desc: 'Unir piezas de tela (según especificación de costura); y Obtener ensamble sin scrap o reprocesos',
            failures: [
                {
                    desc: 'Falla en el sensor de detección de plantilla o suciedad en el lector',
                    efLocal: '100% de la producción es descartada (Scrap)',
                    efClient: 'Parada de línea mayor a un turno completo',
                    efUser: 'Pérdida de la función primaria del vehículo O Muy objetiva la apariencia, vibración o ruidos',
                    S: 8,
                    causes: [
                        {
                            cause: 'Mano de Obra: Colocación de material dentro de la plantilla con pliegues o tensión desigual',
                            prev: 'Hoja de Proceso / Ayudas Visuales',
                            det: 'Puesta a Punto (Set-up) / Plan de Control',
                            O: 7, D: 8, ap: 'H', sc: 'SC',
                            obs: 'TBD: Confirmar parámetros cuando llegue la máquina CNC',
                        },
                        {
                            cause: 'Máquina: Pérdida de presión de aire',
                            prev: 'Control preventivo del Filtro de Aire',
                            det: 'Detectar fugas: Usar el oído para hallar pérdidas neumáticas',
                            O: 3, D: 8, ap: 'M', sc: '',
                            obs: 'TBD: D=8 con detección auditiva es optimista. Definir sensores.',
                        },
                        {
                            cause: 'Método: Falta de definición de topes físicos o guías en la mesa de carga',
                            prev: 'La máquina cuenta con topes físicos - Hoja de Proceso / Ayudas Visuales',
                            det: 'Puesta a Punto (Set-up) / Auditoría de Proceso',
                            O: 4, D: 8, ap: 'H', sc: 'SC',
                            obs: 'TBD: Confirmar diseño de topes cuando llegue la máquina',
                        },
                    ],
                },
                {
                    desc: 'Ruptura o Enredo del Hilo (Superior o Inferior) O Costura Incompleta/Saltada.',
                    efLocal: '100% de la producción tiene que ser descartada (Scrap) o requiere retrabajo fuera de línea',
                    efClient: 'Parada de línea mayor a un turno de producción completo.',
                    efUser: 'Pérdida de la función primaria del vehículo necesaria para conducción normal. O Muy objetiva la apariencia, vibración o ruidos.',
                    S: 8,
                    causes: [
                        {
                            cause: 'Mano de Obra: El operador instaló incorrectamente el hilo inferior. O El operador dejó un exceso de hilo (más de 6 cm) al inicio o al final del ciclo de costura.',
                            prev: 'Hoja de Operaciones / Ayudas Visuales',
                            det: 'Puesta a Punto (Set-up) / Plan de control',
                            O: 7, D: 8, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Máquina: Falla en el sistema de Tensión Electrónica del Hilo / Falla o desajuste de la cuchilla del sistema de corte automático de hilo / Falta de lubricación en el gancho o guías',
                            prev: 'Mantenimiento Preventivo Planificado',
                            det: 'Prueba Inicial (Setup)',
                            O: 4, D: 8, ap: 'H', sc: 'SC',
                            obs: 'TBD: Parámetros de mantenimiento a definir cuando llegue la máquina',
                        },
                        {
                            cause: 'Materiales: Aguja inadecuada para el grosor del material',
                            prev: 'Hoja de proceso indica que aguja se debe utilizar',
                            det: 'Control de recepción / Certificados de calidad / Puesta a punto (Set up)',
                            O: 5, D: 8, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Método: El procedimiento de instalación/ajuste de tensión es ambiguo o no está documentado claramente.',
                            prev: 'Hoja de Operaciones',
                            det: 'Puesta a Punto (Set-up) / Auditoría de Proceso',
                            O: 7, D: 9, ap: 'H', sc: 'SC',
                            obs: 'CRITICO: D=9 indica detección muy débil. Necesita mejor documentación.',
                        },
                        {
                            cause: 'Mano de Obra: El operador ingresa el código manualmente en lugar de usar el escáner',
                            prev: 'Plan de Control / Puesta a Punto (Set-up)',
                            det: 'Hoja de Operaciones',
                            O: 7, D: 8, ap: 'H', sc: 'SC',
                        },
                    ],
                },
                {
                    desc: 'Patrón de costura (programa) cargado no coincide con la plantilla física instalada.',
                    efLocal: '100% de la producción tiene que ser descartada (Scrap) debido a que la costura se realiza en la ubicación incorrecta.',
                    efClient: 'Parada de línea mayor a un turno de producción completo.',
                    efUser: 'Pérdida de la función primaria del vehículo necesaria para conducción normal.',
                    S: 9,
                    causes: [
                        {
                            cause: 'Máquina (Software): Fallo de la interfaz HMI o software: La máquina ejecuta un patrón predeterminado o un programa antiguo.',
                            prev: 'Mantenimiento Preventivo',
                            det: 'Puesta a Punto (Set-up)',
                            O: 4, D: 8, ap: 'H', sc: 'SC',
                            obs: 'TBD: Software a configurar cuando llegue la máquina CNC',
                        },
                        {
                            cause: 'Máquina (Sensor): El sensor que debería validar la presencia y el tipo de plantilla está descalibrado o no funciona correctamente.',
                            prev: 'Plan de Limpieza / Mantenimiento (Limpieza de lentes/sensores)',
                            det: 'Prueba de Error (Pasar una plantilla incorrecta para ver si la máquina la rechaza.)',
                            O: 4, D: 4, ap: 'H', sc: 'SC',
                            obs: 'TBD: Verificar sensor cuando llegue la máquina',
                        },
                        {
                            cause: 'Método: El procedimiento de set-up no exige una verificación cruzada clara y documentada entre el código del patrón y el código de la plantilla.',
                            prev: 'Hoja de Proceso',
                            det: 'Auditoría de Proceso',
                            O: 7, D: 9, ap: 'H', sc: 'SC',
                        },
                    ],
                },
                {
                    desc: 'Fallo o Degradación del Componente de la Máquina debido a suciedad, fricción o desgaste prematuro',
                    efLocal: '100% de la producción tiene que ser descartada (Scrap) por fallas mecánicas que causan costuras fuera de especificación.',
                    efClient: 'Parada de línea mayor a un turno de producción completo. O Parada de línea menor a una hora',
                    efUser: 'Pérdida de la función primaria del vehículo necesaria para conducción normal. O Degradación de la función primaria del vehículo.',
                    S: 9,
                    causes: [
                        {
                            cause: 'Mano de Obra: El operador (o personal de mantenimiento) omite o realiza incorrectamente el procedimiento de limpieza/lubricación al finalizar el turno',
                            prev: 'Ayudas Visuales',
                            det: 'Auditoría de 5S',
                            O: 7, D: 9, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Máquina: Fallo en los indicadores de mantenimiento (contadores de ciclo) que deberían recordar la necesidad de lubricación o reemplazo de piezas.',
                            prev: 'Mantenimiento Preventivo',
                            det: 'Visual humano',
                            O: 4, D: 8, ap: 'H', sc: 'SC',
                            obs: 'TBD: Sistema de mantenimiento a implementar con la máquina',
                        },
                        {
                            cause: 'Materiales: El aceite/lubricante utilizado no es el especificado o está contaminado.',
                            prev: 'Gestión de Proveedores y Especificación Técnica del insumo',
                            det: 'Recepción de Materiales / Identificación: Etiquetado claro del envase antes del uso.',
                            O: 4, D: 8, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Método: El procedimiento de mantenimiento preventivo/limpieza es inadecuado o no documenta la frecuencia y el tipo de lubricante requerido.',
                            prev: 'Instructivo General de Mantenimiento (I-MT-001): Documento mandatorio que define qué, cómo y cuándo lubricar',
                            det: 'Auditoría de Proceso',
                            O: 7, D: 9, ap: 'H', sc: 'SC',
                        },
                    ],
                },
            ],
        },
    ]),
    mkWE('Man', 'Operador de producción / Líder de equipo', []),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Etiquetas blancas / Etiquetas de rechazo / Lapicera / Piquete', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── CONTINUED IN PART 2 (Operations 60-120) ─────────────────────────────────
// The script continues below with remaining operations...
// PLACEHOLDER - Part 2 will be appended

// For now, collect all operations defined so far
const allOperations = [op10, op15, op20, op25, op30, op40, op50];

// Placeholder - will be replaced when Part 2 is added
export { header, allOperations, mkOp, mkWE, mkFunc, mkFailure, mkCause, mkWipOp, uuid, sha256 };
