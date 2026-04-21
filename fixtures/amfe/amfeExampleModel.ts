/**
 * AMFE Complete Example Model
 *
 * A realistic, fully-populated AMFE document demonstrating the AIAG-VDA methodology.
 * Process: Automotive chassis welding sub-assembly (Subchasis Soldado).
 *
 * This example includes:
 * - 3 operations with sequential numbering (10, 20, 30)
 * - Multiple 6M work elements per operation
 * - Functions → Failure Modes → Causes with full S/O/D/AP
 * - Both AP=H (requires action) and AP=L (acceptable) scenarios
 * - Optimization actions completed and pending
 * - CC/SC special characteristics
 *
 * Purpose: Let first-time users see what a "finished" AMFE looks like.
 */

import { v4 as uuidv4 } from 'uuid';
import { AmfeDocument, AmfeCause, AmfeFailure, AmfeFunction, AmfeWorkElement, AmfeOperation, WorkElementType } from './amfeTypes';
import { calculateAP } from './apTable';

// --- Helpers (same pattern as amfeTemplates.ts) ---

function mkCause(overrides: Partial<AmfeCause>): AmfeCause {
    return {
        id: uuidv4(),
        cause: '', preventionControl: '', detectionControl: '',
        occurrence: '', detection: '', ap: '',
        characteristicNumber: '', specialChar: '', filterCode: '',
        preventionAction: '', detectionAction: '',
        responsible: '', targetDate: '', status: '',
        actionTaken: '', completionDate: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
        observations: '',
        ...overrides,
    };
}

function mkFailure(overrides: Partial<AmfeFailure> & { description: string; severity: string }): AmfeFailure {
    const result: AmfeFailure = {
        id: uuidv4(),
        effectLocal: '', effectNextLevel: '', effectEndUser: '',
        causes: [],
        ...overrides,
    };
    // Auto-calculate AP for causes
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

function mkFunction(desc: string, requirements: string, failures: AmfeFailure[]): AmfeFunction {
    return { id: uuidv4(), description: desc, requirements, failures };
}

function mkWE(type: WorkElementType, name: string, functions: AmfeFunction[]): AmfeWorkElement {
    return { id: uuidv4(), type, name, functions };
}

function mkOp(opNumber: string, name: string, workElements: AmfeWorkElement[]): AmfeOperation {
    return { id: uuidv4(), opNumber, name, workElements };
}

// ============================
//  OPERATION 10: SOLDADURA MIG
// ============================

function createOp10(): AmfeOperation {
    return mkOp('10', 'Soldadura MIG - Subchasis', [
        // Machine
        mkWE('Machine', 'Celda Robotizada de Soldadura MIG', [
            mkFunction(
                'Aplicar cordones de soldadura estructurales según plano',
                'Cordón continuo, penetración min. 80%, sin porosidad. Norma AWS D8.8.',
                [
                    mkFailure({
                        description: 'Cordón de soldadura con porosidad',
                        severity: '9',
                        effectLocal: 'Pieza rechazada en inspección visual',
                        effectNextLevel: 'Reclamo de calidad del OEM',
                        effectEndUser: 'Riesgo de fractura estructural en uso',
                        causes: [
                            mkCause({
                                cause: 'Caudal de gas protector insuficiente (< 15 l/min)',
                                preventionControl: 'Caudalímetro digital con alarma mínima configurable',
                                detectionControl: 'Inspección visual 100% + ultrasonido muestral',
                                occurrence: '4', detection: '3',
                                specialChar: 'CC',
                                characteristicNumber: 'CP-001',
                                preventionAction: 'Instalar sensor de flujo con interlock (detiene robot si flujo < 15 l/min)',
                                responsible: 'Ing. Mantenimiento',
                                targetDate: '2026-04-15',
                                status: 'En Proceso',
                            }),
                            mkCause({
                                cause: 'Humedad en alambre de soldadura',
                                preventionControl: 'Almacenamiento en ambiente controlado (HR < 60%)',
                                detectionControl: 'Verificación de peso de carrete al inicio de turno',
                                occurrence: '2', detection: '4',
                                observations: 'Análisis concluido, controles actuales aceptables.',
                            }),
                        ],
                    }),
                    mkFailure({
                        description: 'Cordón incompleto (falta de fusión)',
                        severity: '10',
                        effectLocal: 'Pieza scrap / retrabajo crítico',
                        effectNextLevel: 'Parada de línea OEM por desabastecimiento',
                        effectEndUser: 'Falla de seguridad: colapso estructural en impacto',
                        causes: [
                            mkCause({
                                cause: 'Parámetros de soldadura incorrectos (voltaje/amperaje)',
                                preventionControl: 'Receta de parámetros bloqueada en controlador (no editable por operador)',
                                detectionControl: 'Monitoreo online de arco (sistema de registro de parámetros)',
                                occurrence: '3', detection: '2',
                                specialChar: 'CC',
                                characteristicNumber: 'CP-002',
                                preventionAction: 'Backup de recetas con verificación automática al arranque de programa',
                                detectionAction: 'Implementar sistema de visión artificial post-soldadura',
                                responsible: 'Ing. Calidad',
                                targetDate: '2026-05-01',
                                status: 'Pendiente',
                            }),
                        ],
                    }),
                ],
            ),
        ]),

        // Man
        mkWE('Man', 'Operador de Celda', [
            mkFunction(
                'Cargar piezas en fixture y verificar posicionamiento',
                'Piezas asentadas en todos los locators (tope + clamp). Fuerza clamp 200 kgf.',
                [
                    mkFailure({
                        description: 'Posicionamiento incorrecto de pieza en fixture',
                        severity: '8',
                        effectLocal: 'Soldadura fuera de posición / interferencia dimensional',
                        effectNextLevel: 'Pieza no ensambla en OEM',
                        effectEndUser: 'Ruido, vibración, ajuste deficiente',
                        causes: [
                            mkCause({
                                cause: 'Falta de capacitación del operador en carga de fixture',
                                preventionControl: 'Matriz de habilidades con re-capacitación anual',
                                detectionControl: 'Sensor de proximidad en cada locator (ok/nok antes de ciclo)',
                                occurrence: '3', detection: '2',
                                preventionAction: '',
                                observations: 'Análisis concluido. Poka-Yoke de sensores de proximidad mitiga eficazmente.',
                            }),
                        ],
                    }),
                ],
            ),
        ]),

        // Method
        mkWE('Method', 'Instrucción de Trabajo IT-SOL-010', [
            mkFunction(
                'Definir secuencia y parámetros de soldadura validados',
                'IT revisada ante cada cambio de ingeniería. Incluye secuencia de cordones.',
                [
                    mkFailure({
                        description: 'Secuencia de soldadura no respetada',
                        severity: '7',
                        effectLocal: 'Distorsión térmica acumulada',
                        effectNextLevel: 'Dimensiones fuera de tolerancia del subchasis',
                        effectEndUser: 'Alineación deficiente de suspensión',
                        causes: [
                            mkCause({
                                cause: 'Programa de robot no actualizado tras cambio de ingeniería',
                                preventionControl: 'Checklist de cambio de ingeniería con sign-off de manufactura',
                                detectionControl: 'Medición dimensional 3D (CMM) primera pieza post-cambio',
                                occurrence: '2', detection: '3',
                            }),
                        ],
                    }),
                ],
            ),
        ]),
    ]);
}

// ============================
//  OPERATION 20: INSPECCIÓN
// ============================

function createOp20(): AmfeOperation {
    return mkOp('20', 'Inspección Dimensional y Visual', [
        // Measurement
        mkWE('Measurement', 'Brazo de Medición 3D (FARO)', [
            mkFunction(
                'Verificar cotas críticas del subchasis soldado',
                'GD&T per plano: posición agujeros ±0.5mm, planitud ±1mm',
                [
                    mkFailure({
                        description: 'Medición incorrecta (error de instrumento)',
                        severity: '8',
                        effectLocal: 'Pieza fuera de tolerancia aprobada',
                        effectNextLevel: 'Lote defectuoso enviado a OEM',
                        effectEndUser: 'Falla de ensamble o comportamiento dinámico',
                        causes: [
                            mkCause({
                                cause: 'Brazo FARO sin calibración vigente',
                                preventionControl: 'Plan de calibración con alerta automática 30 días antes',
                                detectionControl: 'Verificación con patrón maestro al inicio de cada turno',
                                occurrence: '2', detection: '2',
                                characteristicNumber: 'CP-003',
                                observations: 'MSA R&R último resultado: 8.2% (Aceptable < 10%)',
                            }),
                            mkCause({
                                cause: 'Programa de medición con puntos incorrectos',
                                preventionControl: 'Revisión de programa por ingeniería ante cambio de plano',
                                detectionControl: 'Correlación CMM fijo vs brazo portátil trimestral',
                                occurrence: '2', detection: '3',
                            }),
                        ],
                    }),
                ],
            ),
        ]),

        // Man
        mkWE('Man', 'Inspector de Calidad', [
            mkFunction(
                'Ejecutar inspección visual según patrón de referencia',
                'Defectos tipo: porosidad visible, salpicaduras > 2mm, falta de cordón',
                [
                    mkFailure({
                        description: 'No detección de defecto visual',
                        severity: '9',
                        effectLocal: 'Pieza defectuosa aprobada para ensamble',
                        effectNextLevel: 'Reclamo 0km / sorting en planta OEM',
                        effectEndUser: 'Riesgo de falla estructural',
                        causes: [
                            mkCause({
                                cause: 'Fatiga visual del inspector (turno > 4 horas sin rotación)',
                                preventionControl: 'Rotación obligatoria de inspector cada 2 horas',
                                detectionControl: 'Auditoría escalonada con piezas patrón insertadas (1 por turno)',
                                occurrence: '4', detection: '5',
                                specialChar: 'SC',
                                characteristicNumber: 'CP-004',
                                preventionAction: 'Implementar sistema de iluminación con luz rasante para resaltar defectos',
                                detectionAction: 'Agregar segunda estación de inspección visual (doble check) para AP=H',
                                responsible: 'Supervisor Calidad',
                                targetDate: '2026-03-30',
                                status: 'Completado',
                                actionTaken: 'Se instaló iluminación LED rasante. Se implementó doble verificación en turno noche.',
                                completionDate: '2026-03-15',
                                occurrenceNew: '3',
                                detectionNew: '3',
                            }),
                        ],
                    }),
                ],
            ),
        ]),

        // Method
        mkWE('Method', 'Plan de Control - Inspección', [
            mkFunction(
                'Definir criterios de aceptación/rechazo alineados con cliente',
                'Criterios documentados en IT-CAL-020. Actualización ante cambio de ingeniería.',
                [
                    mkFailure({
                        description: 'Criterio de aceptación ambiguo o desactualizado',
                        severity: '7',
                        effectLocal: 'Variabilidad en decisiones de inspección (falso ok / falso nok)',
                        effectNextLevel: 'Desconfianza del OEM en inspección',
                        effectEndUser: 'Calidad inconsistente percibida',
                        causes: [
                            mkCause({
                                cause: 'IT de inspección no actualizada tras cambio de especificación cliente',
                                preventionControl: 'Procedimiento de cambio de ingeniería con sign-off de calidad',
                                detectionControl: 'Revisión cruzada de resultados entre inspectores semanalmente',
                                occurrence: '3', detection: '4',
                            }),
                        ],
                    }),
                ],
            ),
        ]),
    ]);
}

// ============================
//  OPERATION 30: PROTECCIÓN SUPERFICIAL
// ============================

function createOp30(): AmfeOperation {
    return mkOp('30', 'Protección Anticorrosiva (E-coat)', [
        // Machine
        mkWE('Machine', 'Línea de E-coat (Electroforesis)', [
            mkFunction(
                'Aplicar recubrimiento anticorrosivo uniforme',
                'Espesura: 20-30 µm. Adherencia: GT0 (cross-hatch). Salt spray > 500 horas.',
                [
                    mkFailure({
                        description: 'Espesura de recubrimiento fuera de rango',
                        severity: '7',
                        effectLocal: 'Re-proceso o scrap',
                        effectNextLevel: 'Defecto estético / corrosión prematura',
                        effectEndUser: 'Corrosión visible en < 5 años',
                        causes: [
                            mkCause({
                                cause: 'Voltaje de electroforesis fuera de parámetro',
                                preventionControl: 'PLC con receta validada y alarma por desviación',
                                detectionControl: 'Medición de espesura con medidor electromagnético cada arranque + c/2hrs',
                                occurrence: '3', detection: '3',
                                characteristicNumber: 'CP-005',
                            }),
                            mkCause({
                                cause: 'Contaminación del baño (pH, conductividad, sólidos)',
                                preventionControl: 'Análisis químico diario del baño con registro',
                                detectionControl: 'Test de adherencia (cross-hatch) c/turno',
                                occurrence: '3', detection: '2',
                            }),
                        ],
                    }),
                ],
            ),
        ]),

        // Environment
        mkWE('Environment', 'Condiciones de Baño y Horno', [
            mkFunction(
                'Mantener temperatura de horno de curado dentro de especificación',
                'Horno: 180°C ± 5°C, tiempo 20 min. Registrador continuo.',
                [
                    mkFailure({
                        description: 'Curado insuficiente del recubrimiento',
                        severity: '8',
                        effectLocal: 'Recubrimiento blando / fácil de rayar',
                        effectNextLevel: 'Falla de adherencia en línea de ensamble OEM',
                        effectEndUser: 'Corrosión temprana, desprendimiento de pintura',
                        causes: [
                            mkCause({
                                cause: 'Falla de resistencia calefactora en zona de horno',
                                preventionControl: 'Mantenimiento preventivo trimestral de resistencias con medición de aislación',
                                detectionControl: 'Registrador de temperatura continuo con alarma por zona',
                                occurrence: '2', detection: '2',
                                observations: 'Controles actuales robustos. AP=L aceptable.',
                            }),
                        ],
                    }),
                ],
            ),
        ]),

        // Material
        mkWE('Material', 'Pintura E-coat (Cataforesis)', [
            mkFunction(
                'Proveer pintura con propiedades dentro de especificación del proveedor',
                'Lote trazable. CoC del proveedor. Vida útil controlada.',
                [
                    mkFailure({
                        description: 'Pintura fuera de especificación (viscosidad / densidad)',
                        severity: '6',
                        effectLocal: 'Defecto de apariencia (burbujas, piel de naranja)',
                        effectNextLevel: 'Rechazo cosmético',
                        effectEndUser: 'Aspecto no satisfactorio',
                        causes: [
                            mkCause({
                                cause: 'Lote de pintura con desviación de proveedor',
                                preventionControl: 'PPAP vigente. Certificado de conformidad por lote.',
                                detectionControl: 'Control de recepción: viscosidad + densidad muestral',
                                occurrence: '2', detection: '3',
                            }),
                        ],
                    }),
                ],
            ),
        ]),
    ]);
}

// ============================
//  PATAGONIA TAPIZADO — VW
// ============================

function createPatagoniaOp10(): AmfeOperation {
    return mkOp('10', 'RECEPCIONAR MATERIA PRIMA', [
        mkWE('Machine', 'Autoelevador', [
            mkFunction('Garantizar la estabilidad y la integridad física del material durante el transporte interno', '', [
                mkFailure({
                    description: 'Material / pieza golpeada o dañada durante transporte',
                    severity: '6',
                    effectLocal: 'Riesgo de reproceso o scrap; paro de línea si no hay stock',
                    effectNextLevel: 'Montaje con ajuste forzado / imposibilidad de ensamblar',
                    effectEndUser: 'Posible ruido o falla estética',
                    causes: [
                        mkCause({
                            cause: 'Mala estiba y embalaje inadecuado',
                            preventionControl: 'Medios de embalaje validados',
                            detectionControl: 'Inspección visual en recepción',
                            occurrence: '6', detection: '6',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Manipulación incorrecta en tránsito',
                            preventionControl: 'Existencia de instrucciones de trabajo que definen cómo debe estibarse y manipularse el material.',
                            detectionControl: 'Verificación del estado del embalaje antes de que el camión salga o inmediatamente cuando llega a su destino',
                            occurrence: '7', detection: '6',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Falta de inspección visual al recibir',
                            preventionControl: 'Instrucción de Trabajo de Recepción que exige la verificación física y visual del material',
                            detectionControl: 'Inspección visual en recepción',
                            occurrence: '6', detection: '5',
                            observations: 'PRELIMINAR: Verificar si la instrucción de trabajo de recepción está implementada',
                        }),
                        mkCause({
                            cause: 'Almacenaje inadecuado en transporte (sin protecciones)',
                            preventionControl: 'Procedimientos de Logística sobre estiba segura y uso de Embalajes Cubiertos o cerrados',
                            detectionControl: 'Inspección Visual de daños/suciedad en el empaque al recibir.',
                            occurrence: '6', detection: '6',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Operador de calidad / Líder de equipo', [
            mkFunction('Comprobar que el embalaje no esté dañado. Corroborar que la orden sea la correcta. Cargar la materia prima en ARB.', '', []),
        ]),
        mkWE('Measurement', 'Calibres de diferentes tamaños / Micrómetro / Probeta de flamabilidad / Probeta de peeling', [
            mkFunction('Verificar el cumplimiento y la trazabilidad de la materia prima recibida', '', [
                mkFailure({
                    description: 'Falta de documentación o trazabilidad',
                    severity: '7',
                    effectLocal: 'Riesgo de mezclar lotes no conformes',
                    effectNextLevel: 'Dificultades en trazabilidad si surge un reclamo',
                    effectEndUser: 'No afecta',
                    causes: [
                        mkCause({
                            cause: 'Procesos administrativos deficientes',
                            preventionControl: 'El sistema [ARB] obliga a registrar lote y código en recepción y verifica contra base de datos',
                            detectionControl: 'Verificación automática del lote/código registrado contra la base de datos',
                            occurrence: '3', detection: '7',
                        }),
                        mkCause({
                            cause: 'No se utiliza el sistema ARB',
                            preventionControl: 'Procedimiento Operacional Estándar que exige y documenta la obligatoriedad del uso del sistema ARB.',
                            detectionControl: 'El sistema impide la emisión de ubicaciones o el registro de entrada del material hasta que todos los campos del ARB sean completados.',
                            occurrence: '6', detection: '4',
                        }),
                        mkCause({
                            cause: 'Proveedor sin sistema robusto de trazabilidad',
                            preventionControl: 'Auditorías de Sistema y Requisitos que validan la capacidad de trazabilidad del proveedor antes de su aprobación.',
                            detectionControl: 'Verificación del Certificado de Conformidad y registro obligatorio de lote en el sistema de recepción antes de la aceptación de la materia prima.',
                            occurrence: '5', detection: '6',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Method', 'Hoja de operaciones / Ayudas Visuales', [
            mkFunction('Asegurar la conformidad de la calidad y cantidad de material recibido', '', [
                mkFailure({
                    description: 'Material con especificación errónea (dimensiones, color, dureza, etc.)',
                    severity: '6',
                    effectLocal: 'Problemas de calidad durante el ensamble',
                    effectNextLevel: 'Potencial parada de línea',
                    effectEndUser: 'Potencial reclamo de aspecto/comfort',
                    causes: [
                        mkCause({
                            cause: 'Error en la orden de compra o ficha técnica',
                            preventionControl: 'Revisión de Ingeniería de la Ficha Técnica/OC antes de la emisión al proveedor.',
                            detectionControl: 'Control dimensional por muestreo con calibre en recepción.',
                            occurrence: '5', detection: '6',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Proveedor no respeta tolerancias',
                            preventionControl: 'Requisitos Contractuales de Calidad y Auditorías al Proveedor para verificar su capacidad de Control Estadístico de Proceso',
                            detectionControl: 'Revisión del Certificado de Calidad (CoC) y Control Dimensional por Muestreo en recepción.',
                            occurrence: '7', detection: '6',
                            specialChar: 'SC',
                            observations: 'PRELIMINAR: O=7 estimado - sin datos históricos del proveedor',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Material', 'Etiquetas blancas / Etiquetas de rechazo / Engrapadora / Libretas / Post-it / Lápiz blanco / Tijera / Lapicera / Bandas elásticas / Cinta scotch', [
            mkFunction('Disponer de etiquetas blancas 100x60 y etiquetas de rechazo para clasificación.', '', []),
        ]),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587 - Decreto Reglamentario 351/79', [
            mkFunction('Mantener las condiciones de seguridad ocupacional según la Ley 19587', '', [
                mkFailure({
                    description: 'Contaminación / suciedad en la materia prima',
                    severity: '6',
                    effectLocal: 'Potencial scrap',
                    effectNextLevel: 'Potencial parada de línea. Problemas en el ensamble final',
                    effectEndUser: 'Potencial reclamo de aspecto/comfort',
                    causes: [
                        mkCause({
                            cause: 'Almacenaje inadecuado en transporte (sin protecciones)',
                            preventionControl: 'Procedimientos de Logística sobre estiba segura y uso de Embalajes Cubiertos o cerrados',
                            detectionControl: 'Inspección Visual de daños/suciedad en el empaque al recibir.',
                            occurrence: '6', detection: '6',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Ambiente sucio en planta del proveedor',
                            preventionControl: 'N/A',
                            detectionControl: 'Inspección Visual de la pieza y Revisión del Certificado de Calidad del proveedor.',
                            occurrence: '5', detection: '6',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
    ]);
}

function createPatagoniaOp15(): AmfeOperation {
    return mkOp('15', 'CORTE DE COMPONENTES DE VINILO O TELA - Preparación de corte', [
        mkWE('Machine', 'Zorras manuales / Cortadora de paños', [
            mkFunction('Lograr el paño a la medida requerida', '', [
                mkFailure({
                    description: 'Corte fuera de medida (paño más corto o más largo que la especificación).',
                    severity: '7',
                    effectLocal: 'Pérdida de material (scrap).',
                    effectNextLevel: 'Imposibilidad de ensamblar la pieza, potencial paro de línea.',
                    effectEndUser: 'Posible ruido o falla estética',
                    causes: [
                        mkCause({
                            cause: 'Error del operario al medir con la regla metálica.',
                            preventionControl: 'Medición de la primera capa usando la regla metálica fija como referencia. Uso de la primera capa como plantilla para alinear las capas subsecuentes.',
                            detectionControl: 'No se realiza una medición del paño una vez cortado',
                            occurrence: '7', detection: '10',
                            specialChar: 'SC',
                            observations: 'CRITICO: D=10 indica que NO hay detección. Definir control post-corte.',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Tijera / Lapicera / Regla', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', [
            mkFunction('Mantener las condiciones de seguridad ocupacional según la Ley 19587', '', [
                mkFailure({
                    description: 'Contaminación / suciedad en la materia prima',
                    severity: '5',
                    effectLocal: 'Retrabajo',
                    effectNextLevel: 'Reclamo de aspecto',
                    effectEndUser: 'Posible ruido o falla estética',
                    causes: [
                        mkCause({
                            cause: 'Falta de inspección al llegar',
                            preventionControl: 'Instrucción de Trabajo',
                            detectionControl: 'Inspección Visual del estado de la pieza/empaque, requerida como punto de control del proceso de recepción.',
                            occurrence: '6', detection: '6',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Ambiente sucio en planta del proveedor',
                            preventionControl: 'N/A',
                            detectionControl: 'Inspección Visual de la pieza y Revisión del Certificado de Calidad del proveedor.',
                            occurrence: '5', detection: '6',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
    ]);
}

function createPatagoniaOp20(): AmfeOperation {
    return mkOp('20', 'CORTE DE COMPONENTES DE VINILO O TELA - Cortar componentes', [
        mkWE('Machine', 'Zorras manuales / Máquina de corte', [
            mkFunction('Lograr el Contorno/Forma Geométrica del patrón Conforme al Mylar', '', [
                mkFailure({
                    description: 'Desviación en el corte de los pliegos',
                    severity: '5',
                    effectLocal: 'Retrabajo',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo.',
                    effectEndUser: 'Degradación de la función secundaria del vehículo.',
                    causes: [
                        mkCause({
                            cause: 'Parámetros de corte mal ingresados',
                            preventionControl: 'La maquina alinea y corta automáticamente el vinilo / tela',
                            detectionControl: 'Set up de lanzamiento / Regla / Inspección visual',
                            occurrence: '3', detection: '7',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Falla en la maquina',
                    severity: '6',
                    effectLocal: 'Retrabajo',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo.',
                    effectEndUser: 'Degradación de la función secundaria del vehículo.',
                    causes: [
                        mkCause({
                            cause: 'Falla en la máquina de corte',
                            preventionControl: 'Instructivo para colocar correctamente tensión y velocidad de rollo',
                            detectionControl: 'Inspección visual',
                            occurrence: '6', detection: '8',
                            specialChar: 'SC',
                            observations: 'TBD: Confirmar parámetros de la máquina cuando llegue el equipo',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Selección incorrecta del material',
                    severity: '8',
                    effectLocal: '100% del material cortado es scrap por material incorrecto.',
                    effectNextLevel: 'Parada de línea mayor a un turno de producción completo. Paro de envíos.',
                    effectEndUser: 'Degradación de la función primaria del vehículo.',
                    causes: [
                        mkCause({
                            cause: 'Falta de verificación del código de material antes del corte.',
                            preventionControl: 'Orden Automática del Sistema: El sistema emite la orden con los datos correctos',
                            detectionControl: 'Inspección Visual (Hoja vs. Etiqueta): El operario compara visualmente la etiqueta del rollo contra la planilla de mesa.',
                            occurrence: '5', detection: '6',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Vinilo mal identificado',
                    severity: '7',
                    effectLocal: 'Una porción de la producción tiene que ser descartada (scrap)',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo.',
                    effectEndUser: 'Degradación de la función secundaria del vehículo.',
                    causes: [
                        mkCause({
                            cause: 'Error en identificación del material',
                            preventionControl: 'Etiquetado Estándar (Logística): Procedimiento de identificación en almacén',
                            detectionControl: 'Inspección Visual de Atributos: El operador verifica color/grano, no solo la etiqueta',
                            occurrence: '6', detection: '7',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Corte incompleto o irregular',
                    severity: '7',
                    effectLocal: 'Una porción de la producción tiene que ser descartada (scrap)',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo.',
                    effectEndUser: 'Degradación de la función secundaria del vehículo.',
                    causes: [
                        mkCause({
                            cause: 'Desgaste de la cuchilla de corte.',
                            preventionControl: 'Cambio de cuchillas por calendario u horas de uso.',
                            detectionControl: 'Verificación de cuchilla en set up de lanzamiento',
                            occurrence: '5', detection: '7',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Etiquetas blancas / Etiquetas de rechazo / Tijera / Lapicera / Bandas elásticas', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', [
            mkFunction('Mantener las condiciones de seguridad ocupacional', '', [
                mkFailure({
                    description: 'Contaminación del material durante el corte o almacenamiento en el área',
                    severity: '4',
                    effectLocal: 'Retrabajo de una porción de la producción.',
                    effectNextLevel: 'Menos del 10% de los productos afectados, requiere clasificación adicional.',
                    effectEndUser: 'Defecto visual moderado en apariencia o vibración.',
                    causes: [
                        mkCause({
                            cause: 'Ambiente de trabajo con polvo o partículas',
                            preventionControl: 'Procedimientos de limpieza periódica en el área de corte.',
                            detectionControl: 'Inspección visual (El operador verifica visualmente el material antes/durante el proceso.)',
                            occurrence: '3', detection: '6',
                        }),
                    ],
                }),
            ]),
        ]),
    ]);
}

function createPatagoniaOp25(): AmfeOperation {
    return mkOp('25', 'CORTE DE COMPONENTES DE VINILO O TELA - Control con mylar', [
        mkWE('Man', 'Operador de producción / Líder de equipo', [
            mkFunction('Verificar la conformidad dimensional del contorno cortado. Asegurar la conformidad dimensional del contorno cortado.', '', [
                mkFailure({
                    description: 'Omitir la operación de inspección',
                    severity: '6',
                    effectLocal: 'Generación de Scrap',
                    effectNextLevel: 'Parada de línea de producción (menor a una hora) o necesidad de incorporar procesos adicionales de clasificación de productos defectuosos',
                    effectEndUser: 'Pérdida de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Operador de producción omite la tarea de verificación visual',
                            preventionControl: 'Instrucción/Checklist de Set Up',
                            detectionControl: 'Auditorías internas',
                            occurrence: '6', detection: '9',
                            specialChar: 'SC',
                            observations: 'CRITICO: D=9 indica detección muy débil. Definir controles de proceso más robustos.',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Measurement', 'Mylar de control', [
            mkFunction('Asegurar la Verificación Rápida y Precisa de la Geometría y el Contorno del Corte Conforme a las Tolerancias Específicas', '', []),
        ]),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp30(): AmfeOperation {
    return mkOp('30', 'CORTE - ALMACENAMIENTO WIP', [
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
            mkFunction('Preparar Kit completo y ordenado de componentes (según la Orden de Producción); Contener componentes en medios definidos; Etiquetar caja con identificación mínima obligatoria (N° de parte/modelo, OP, Fecha/Turno); y Mover kits a la zona de costura.', '', [
                mkFailure({
                    description: 'Faltante/exceso de componentes en la caja del kit',
                    severity: '7',
                    effectLocal: 'Una porción de la producción sea descartada (scrap)',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'El Operador no realiza el conteo/verificación completo de la cantidad de componentes según la OP.',
                            preventionControl: 'Existencia de documentación de proceso para la preparación del kit, que guía la cantidad y tipo de componentes',
                            detectionControl: 'Verificación manual o conteo visual del kit por parte del operador',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Componente incorrecto (variante o color) incluido.',
                    severity: '7',
                    effectLocal: 'Una porción de la producción afectada debe ser desechada',
                    effectNextLevel: 'Esto requeriría una acción de reparación o reemplazo en campo o una detención del envío',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Mano de Obra no realiza la verificación visual contra la Orden de Producción (OP)',
                            preventionControl: 'La Orden de Producción (OP) se encuentra disponible y formalizada al igual que la instrucción del operador',
                            detectionControl: 'El operador realiza una verificación visual del componente físico (color o variante) contra el código listado en la OP antes de incluirlo en el kit',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Pieza dañada (rasgadura, mancha) incluida en el kit.',
                    severity: '7',
                    effectLocal: 'Descartar (scrap) una porción de la producción',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'El Operador (Mano de Obra) no sigue el procedimiento de revisión visual de defectos (rasgaduras o manchas)',
                            preventionControl: 'Instrucción o procedimiento (Mano de Obra/Método) que establece que el operador debe buscar rasgaduras o manchas antes de incluir la pieza en el kit.',
                            detectionControl: 'El operador realiza una inspección visual para detectar el Modo de Falla (rasgadura/mancha) antes de liberar el kit.',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp40(): AmfeOperation {
    return mkOp('40', 'Costura - Refilado', [
        mkWE('Machine', 'Maquina refiladora', [
            mkFunction('Generar la dimensión de refilado según especificación en la ubicación correcta.', '', [
                mkFailure({
                    description: 'Posicionado de cortes NOK',
                    severity: '6',
                    effectLocal: 'Scrap potencial / 100% de Retrabajo',
                    effectNextLevel: 'Parada de línea de producción menor a una hora',
                    effectEndUser: 'Pérdida/Degradación de la función secundaria',
                    causes: [
                        mkCause({
                            cause: 'Operador posiciona el corte en la refiladora fuera de la tolerancia marcada en la ayuda visual / instrucción',
                            preventionControl: 'Ayudas Visuales y Instrucción de Proceso (HO).',
                            detectionControl: 'Control Visual del Operario (Inspección 100%) / Piezas Patrón de Referencia',
                            occurrence: '7', detection: '6',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Refilado fuera de especificaciones.',
                    severity: '6',
                    effectLocal: '100% Retrabajo fuera de línea o Scrap',
                    effectNextLevel: 'Parada de línea de producción menor a una hora',
                    effectEndUser: 'Pérdida/Degradación de la función secundaria',
                    causes: [
                        mkCause({
                            cause: 'Operador posiciona el corte en la refiladora fuera de la tolerancia marcada en la ayuda visual / instrucción.',
                            preventionControl: 'Ayudas Visuales y Instrucción de Proceso (HO).',
                            detectionControl: 'Control Visual del Operario (Inspección 100%) / Piezas Patrón de Referencia',
                            occurrence: '7', detection: '6',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Cuchilla desafilada / desgastada, resultando en refilado con rebaba o dimensión fuera de límite.',
                            preventionControl: 'Mantenimiento Preventivo',
                            detectionControl: 'Inspección de Primera Pieza (Verificación del Set Up)',
                            occurrence: '1', detection: '4',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp50(): AmfeOperation {
    return mkOp('50', 'Costura - Costura CNC', [
        mkWE('Machine', 'Máquina de costura CNC', [
            mkFunction('Unir piezas de tela (según especificación de costura); y Obtener ensamble sin scrap o reprocesos', '', [
                mkFailure({
                    description: 'Falla en el sensor de detección de plantilla o suciedad en el lector',
                    severity: '8',
                    effectLocal: '100% de la producción es descartada (Scrap)',
                    effectNextLevel: 'Parada de línea mayor a un turno completo',
                    effectEndUser: 'Pérdida de la función primaria del vehículo O Muy objetiva la apariencia, vibración o ruidos',
                    causes: [
                        mkCause({
                            cause: 'Mano de Obra: Colocación de material dentro de la plantilla con pliegues o tensión desigual',
                            preventionControl: 'Hoja de Proceso / Ayudas Visuales',
                            detectionControl: 'Puesta a Punto (Set-up) / Plan de Control',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                            observations: 'TBD: Confirmar parámetros cuando llegue la máquina CNC',
                        }),
                        mkCause({
                            cause: 'Máquina: Pérdida de presión de aire',
                            preventionControl: 'Control preventivo del Filtro de Aire',
                            detectionControl: 'Detectar fugas: Usar el oído para hallar pérdidas neumáticas',
                            occurrence: '3', detection: '8',
                            observations: 'TBD: D=8 con detección auditiva es optimista. Definir sensores.',
                        }),
                        mkCause({
                            cause: 'Método: Falta de definición de topes físicos o guías en la mesa de carga',
                            preventionControl: 'La máquina cuenta con topes físicos - Hoja de Proceso / Ayudas Visuales',
                            detectionControl: 'Puesta a Punto (Set-up) / Auditoría de Proceso',
                            occurrence: '4', detection: '8',
                            specialChar: 'SC',
                            observations: 'TBD: Confirmar diseño de topes cuando llegue la máquina',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Ruptura o Enredo del Hilo (Superior o Inferior) O Costura Incompleta/Saltada.',
                    severity: '8',
                    effectLocal: '100% de la producción tiene que ser descartada (Scrap) o requiere retrabajo fuera de línea',
                    effectNextLevel: 'Parada de línea mayor a un turno de producción completo.',
                    effectEndUser: 'Pérdida de la función primaria del vehículo necesaria para conducción normal. O Muy objetiva la apariencia, vibración o ruidos.',
                    causes: [
                        mkCause({
                            cause: 'Mano de Obra: El operador instaló incorrectamente el hilo inferior. O El operador dejó un exceso de hilo (más de 6 cm) al inicio o al final del ciclo de costura.',
                            preventionControl: 'Hoja de Operaciones / Ayudas Visuales',
                            detectionControl: 'Puesta a Punto (Set-up) / Plan de control',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Máquina: Falla en el sistema de Tensión Electrónica del Hilo / Falla o desajuste de la cuchilla del sistema de corte automático de hilo / Falta de lubricación en el gancho o guías',
                            preventionControl: 'Mantenimiento Preventivo Planificado',
                            detectionControl: 'Prueba Inicial (Setup)',
                            occurrence: '4', detection: '8',
                            specialChar: 'SC',
                            observations: 'TBD: Parámetros de mantenimiento a definir cuando llegue la máquina',
                        }),
                        mkCause({
                            cause: 'Materiales: Aguja inadecuada para el grosor del material',
                            preventionControl: 'Hoja de proceso indica que aguja se debe utilizar',
                            detectionControl: 'Control de recepción / Certificados de calidad / Puesta a punto (Set up)',
                            occurrence: '5', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Método: El procedimiento de instalación/ajuste de tensión es ambiguo o no está documentado claramente.',
                            preventionControl: 'Hoja de Operaciones',
                            detectionControl: 'Puesta a Punto (Set-up) / Auditoría de Proceso',
                            occurrence: '7', detection: '9',
                            specialChar: 'SC',
                            observations: 'CRITICO: D=9 indica detección muy débil. Necesita mejor documentación.',
                        }),
                        mkCause({
                            cause: 'Mano de Obra: El operador ingresa el código manualmente en lugar de usar el escáner',
                            preventionControl: 'Plan de Control / Puesta a Punto (Set-up)',
                            detectionControl: 'Hoja de Operaciones',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Patrón de costura (programa) cargado no coincide con la plantilla física instalada.',
                    severity: '9',
                    effectLocal: '100% de la producción tiene que ser descartada (Scrap) debido a que la costura se realiza en la ubicación incorrecta.',
                    effectNextLevel: 'Parada de línea mayor a un turno de producción completo.',
                    effectEndUser: 'Pérdida de la función primaria del vehículo necesaria para conducción normal.',
                    causes: [
                        mkCause({
                            cause: 'Máquina (Software): Fallo de la interfaz HMI o software: La máquina ejecuta un patrón predeterminado o un programa antiguo.',
                            preventionControl: 'Mantenimiento Preventivo',
                            detectionControl: 'Puesta a Punto (Set-up)',
                            occurrence: '4', detection: '8',
                            specialChar: 'SC',
                            observations: 'TBD: Software a configurar cuando llegue la máquina CNC',
                        }),
                        mkCause({
                            cause: 'Máquina (Sensor): El sensor que debería validar la presencia y el tipo de plantilla está descalibrado o no funciona correctamente.',
                            preventionControl: 'Plan de Limpieza / Mantenimiento (Limpieza de lentes/sensores)',
                            detectionControl: 'Prueba de Error (Pasar una plantilla incorrecta para ver si la máquina la rechaza.)',
                            occurrence: '4', detection: '4',
                            specialChar: 'SC',
                            observations: 'TBD: Verificar sensor cuando llegue la máquina',
                        }),
                        mkCause({
                            cause: 'Método: El procedimiento de set-up no exige una verificación cruzada clara y documentada entre el código del patrón y el código de la plantilla.',
                            preventionControl: 'Hoja de Proceso',
                            detectionControl: 'Auditoría de Proceso',
                            occurrence: '7', detection: '9',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Fallo o Degradación del Componente de la Máquina debido a suciedad, fricción o desgaste prematuro',
                    severity: '9',
                    effectLocal: '100% de la producción tiene que ser descartada (Scrap) por fallas mecánicas que causan costuras fuera de especificación.',
                    effectNextLevel: 'Parada de línea mayor a un turno de producción completo. O Parada de línea menor a una hora',
                    effectEndUser: 'Pérdida de la función primaria del vehículo necesaria para conducción normal. O Degradación de la función primaria del vehículo.',
                    causes: [
                        mkCause({
                            cause: 'Mano de Obra: El operador (o personal de mantenimiento) omite o realiza incorrectamente el procedimiento de limpieza/lubricación al finalizar el turno',
                            preventionControl: 'Ayudas Visuales',
                            detectionControl: 'Auditoría de 5S',
                            occurrence: '7', detection: '9',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Máquina: Fallo en los indicadores de mantenimiento (contadores de ciclo) que deberían recordar la necesidad de lubricación o reemplazo de piezas.',
                            preventionControl: 'Mantenimiento Preventivo',
                            detectionControl: 'Visual humano',
                            occurrence: '4', detection: '8',
                            specialChar: 'SC',
                            observations: 'TBD: Sistema de mantenimiento a implementar con la máquina',
                        }),
                        mkCause({
                            cause: 'Materiales: El aceite/lubricante utilizado no es el especificado o está contaminado.',
                            preventionControl: 'Gestión de Proveedores y Especificación Técnica del insumo',
                            detectionControl: 'Recepción de Materiales / Identificación: Etiquetado claro del envase antes del uso.',
                            occurrence: '4', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Método: El procedimiento de mantenimiento preventivo/limpieza es inadecuado o no documenta la frecuencia y el tipo de lubricante requerido.',
                            preventionControl: 'Instructivo General de Mantenimiento (I-MT-001): Documento mandatorio que define qué, cómo y cuándo lubricar',
                            detectionControl: 'Auditoría de Proceso',
                            occurrence: '7', detection: '9',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Etiquetas blancas / Etiquetas de rechazo / Lapicera / Piquete', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp60(): AmfeOperation {
    return mkOp('60', 'TROQUELADO - Troquelado de espuma', [
        mkWE('Machine', 'Troqueladora puente', [
            mkFunction('Generar la geometría/contorno final de la pieza troquelada', '', [
                mkFailure({
                    description: 'Parte ensamblada con material incorrecto',
                    severity: '8',
                    effectLocal: 'Scrap / Retrabajo total del lote afectado',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Operario selecciona material incorrecto',
                            preventionControl: 'La instrucción de proceso y la lista de materiales detallan que material utilizar / Identificación con código correcto correspondiente',
                            detectionControl: 'Inspección humana visual / Set up de lanzamiento',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Material fuera de posición',
                    severity: '8',
                    effectLocal: 'Scrap / Retrabajo',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Operario no alinea la pieza con la referencia visual',
                            preventionControl: 'Marcas visuales para posicionado',
                            detectionControl: 'Control visual de posicionado',
                            occurrence: '6', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Troquel/Herramental incorrecto en la máquina',
                    severity: '7',
                    effectLocal: 'Scrap / Retrabajo total del lote',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Operario selecciona troquel equivocado',
                            preventionControl: 'Identificación correcta de troqueles y codificación colocada en HO (Documentación/Instrucción)',
                            detectionControl: 'Control visual de troquel a utilizar según HO (Inspección humana)',
                            occurrence: '6', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Fallo en la Conformación de la Pieza',
                    severity: '8',
                    effectLocal: 'Scrap / Retrabajo',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Desgaste o daño del utillaje/troquel',
                            preventionControl: 'Mantenimiento Preventivo y Predictivo del troquel',
                            detectionControl: 'Inspección Visual 100% de la pieza',
                            occurrence: '3', detection: '8',
                            observations: 'TBD: Confirmar parámetros cuando llegue la troqueladora',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Medios / Troquel', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp61(): AmfeOperation {
    return mkOp('61', 'TROQUELADO - ALMACENAMIENTO WIP', [
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
            mkFunction('Preparar Kit completo y ordenado de componentes (según la Orden de Producción); Contener componentes en medios definidos; Etiquetar caja con identificación mínima obligatoria (N° de parte/modelo, OP, Fecha/Turno); y Mover kits a la zona siguiente.', '', [
                mkFailure({
                    description: 'Faltante/exceso de componentes en la caja del kit',
                    severity: '7',
                    effectLocal: 'Una porción de la producción sea descartada (scrap)',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'El Operador no realiza el conteo/verificación completo de la cantidad de componentes según la OP.',
                            preventionControl: 'Existencia de documentación de proceso para la preparación del kit, que guía la cantidad y tipo de componentes',
                            detectionControl: 'Verificación manual o conteo visual del kit por parte del operador',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Componente incorrecto (variante o color) incluido.',
                    severity: '7',
                    effectLocal: 'Una porción de la producción afectada debe ser desechada',
                    effectNextLevel: 'Esto requeriría una acción de reparación o reemplazo en campo o una detención del envío',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Mano de Obra no realiza la verificación visual contra la Orden de Producción (OP)',
                            preventionControl: 'La Orden de Producción (OP) se encuentra disponible y formalizada al igual que la instrucción del operador',
                            detectionControl: 'El operador realiza una verificación visual del componente físico (color o variante) contra el código listado en la OP antes de incluirlo en el kit',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Pieza dañada (rasgadura, mancha) incluida en el kit.',
                    severity: '7',
                    effectLocal: 'Descartar (scrap) una porción de la producción',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'El Operador (Mano de Obra) no sigue el procedimiento de revisión visual de defectos (rasgaduras o manchas)',
                            preventionControl: 'Instrucción o procedimiento (Mano de Obra/Método) que establece que el operador debe buscar rasgaduras o manchas antes de incluir la pieza en el kit.',
                            detectionControl: 'El operador realiza una inspección visual para detectar el Modo de Falla (rasgadura/mancha) antes de liberar el kit.',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp70(): AmfeOperation {
    return mkOp('70', 'INYECCIÓN PLÁSTICA - INYECCIÓN DE PIEZAS PLÁSTICAS', [
        mkWE('Machine', 'Máquina inyectora de plástico', [
            mkFunction('Fabricar la pieza plástica cumpliendo especificaciones dimensionales y apariencia', '', [
                mkFailure({
                    description: 'Llenado Incompleto de Pieza',
                    severity: '8',
                    effectLocal: 'Scrap / Retrabajo',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Presión de Inyección fuera de especificación',
                            preventionControl: 'Monitoreo automático de presión y mantenimiento preventivo con calibración periódica de sensores',
                            detectionControl: 'Detección automática de llenado incompleto',
                            occurrence: '5', detection: '7',
                            specialChar: 'SC',
                            observations: 'TBD: Parámetros de inyección a definir cuando lleguen las máquinas',
                        }),
                        mkCause({
                            cause: 'Temperatura de fusión del material demasiado baja',
                            preventionControl: 'Programa de Mantenimiento y Calibración del Sistema Térmico y Verificación Estándar de la Configuración de Potencia',
                            detectionControl: 'Verificación Visual y Dimensional de Aprobación de la Primera Pieza tras el set-up o cambio de turno',
                            occurrence: '4', detection: '8',
                            specialChar: 'SC',
                            observations: 'TBD: Parámetros de inyección a definir cuando lleguen las máquinas',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Omitir la operación de inspección dimensional de cotas index',
                    severity: '7',
                    effectLocal: 'Pieza fuera de especificación no detectada',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Operador omite la verificación dimensional de la cota index',
                            preventionControl: 'Lista de Verificación (Checklist) para asegurar que el paso se incluya al inicio del turno',
                            detectionControl: 'Auditoría de Proceso',
                            occurrence: '5', detection: '9',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Instrucción de trabajo ambigua sobre la frecuencia o metodología',
                            preventionControl: 'Las Hojas de Proceso describen el método operativo y las pautas de control del Plan de Control',
                            detectionControl: 'Cada dos meses se verifica una pieza con su documentación; las diferencias se registran como No Conformidades internas',
                            occurrence: '5', detection: '9',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Rebaba Excesiva / Exceso de Material',
                    severity: '7',
                    effectLocal: 'Retrabajo / Scrap',
                    effectNextLevel: 'Parada de línea menor a una hora',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Fuerza de Cierre insuficiente',
                            preventionControl: 'Mantenimiento Preventivo (MP) programado de la Unidad de Cierre / Instrucción de Set-up',
                            detectionControl: 'Monitoreo Automático de Presión de Cierre (Primario) / Inspección dimensional manual por muestreo (Secundario)',
                            occurrence: '3', detection: '5',
                            specialChar: 'SC',
                            observations: 'TBD: Parámetros de inyección a definir cuando lleguen las máquinas',
                        }),
                        mkCause({
                            cause: 'Molde o cavidad contaminada con material residual',
                            preventionControl: 'Procedimiento de limpieza y purga estandarizado para la cavidad y línea de partición del molde',
                            detectionControl: 'Inspección visual por parte del operador de la cavidad',
                            occurrence: '5', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Parámetros de Inyección configurados incorrectamente',
                            preventionControl: 'Instrucción de Set-up Estandarizada (Plan de Control / Hoja de Proceso) que detalla valores nominales y rangos de tolerancia',
                            detectionControl: 'Aprobación de la Primera Pieza (First Piece Approval): Inspección de los parámetros de la máquina y verificación dimensional',
                            occurrence: '5', detection: '8',
                            specialChar: 'SC',
                            observations: 'TBD: Parámetros de inyección a definir cuando lleguen las máquinas',
                        }),
                        mkCause({
                            cause: 'Mantenimiento Preventivo y Calibración de Sensores de la máquina',
                            preventionControl: 'Mantenimiento Preventivo del molde para verificar el correcto sellado de la línea de partición',
                            detectionControl: 'Monitoreo Automático de Parámetros',
                            occurrence: '4', detection: '7',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Etiquetas / Medios', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp71(): AmfeOperation {
    return mkOp('71', 'INYECCIÓN PLÁSTICA - ALMACENAMIENTO WIP', [
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
            mkFunction('Preparar Kit completo y ordenado de componentes (según la Orden de Producción); Contener componentes en medios definidos; Etiquetar caja con identificación mínima obligatoria (N° de parte/modelo, OP, Fecha/Turno); y Mover kits a la zona de prearmado.', '', [
                mkFailure({
                    description: 'Faltante/exceso de componentes en la caja del kit',
                    severity: '7',
                    effectLocal: 'Una porción de la producción sea descartada (scrap)',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'El Operador no realiza el conteo/verificación completo de la cantidad de componentes según la OP.',
                            preventionControl: 'Existencia de documentación de proceso para la preparación del kit, que guía la cantidad y tipo de componentes',
                            detectionControl: 'Verificación manual o conteo visual del kit por parte del operador',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Componente incorrecto (variante o color) incluido.',
                    severity: '7',
                    effectLocal: 'Una porción de la producción afectada debe ser desechada',
                    effectNextLevel: 'Esto requeriría una acción de reparación o reemplazo en campo o una detención del envío',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Mano de Obra no realiza la verificación visual contra la Orden de Producción (OP)',
                            preventionControl: 'La Orden de Producción (OP) se encuentra disponible y formalizada al igual que la instrucción del operador',
                            detectionControl: 'El operador compara físicamente el componente contra la referencia de la OP antes de incluirlo en el kit',
                            occurrence: '7', detection: '4',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Pieza dañada (rasgadura, mancha) incluida en el kit.',
                    severity: '7',
                    effectLocal: 'Descartar (scrap) una porción de la producción',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'El Operador (Mano de Obra) no sigue el procedimiento de revisión visual de defectos (rasgaduras o manchas)',
                            preventionControl: '-',
                            detectionControl: 'No existe detección implementada para este modo de falla',
                            occurrence: '7', detection: '10',
                            specialChar: 'SC',
                            observations: 'CRITICO: D=10 indica que NO hay detección. Definir control de inspección visual.',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp80(): AmfeOperation {
    return mkOp('80', 'PREARMADO DE ESPUMA', [
        mkWE('Man', 'Operador de producción', [
            mkFunction('Ensamblar Componentes (Espuma y Plástico) con Adhesión Mínima Requerida. Adherir espuma adhesivada a pieza plástica, asegurando una alineación correcta.', '', [
                mkFailure({
                    description: 'Adhesión defectuosa',
                    severity: '6',
                    effectLocal: 'Retrabajo / Scrap',
                    effectNextLevel: 'Parada de línea menor a una hora',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Error del operario / Incorrecta alineación del separador de espuma',
                            preventionControl: 'Ayudas Visuales: Piezas patrón y Hoja de operación estándar',
                            detectionControl: 'Control visual del operario / Set Up: Autocontrol visual',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Pérdida de adherencia',
                    severity: '8',
                    effectLocal: 'Scrap / Retrabajo',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Error del operario / Burbujas en el adhesivo del separador',
                            preventionControl: '1- Piezas patrón de referencia, 2- Hoja de operación con parámetros y ayuda visual, 3- Set Up de control',
                            detectionControl: 'Control visual del operario: Verificar ausencia de burbujas',
                            occurrence: '4', detection: '6',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Etiquetas / Medios', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp81(): AmfeOperation {
    return mkOp('81', 'PREARMADO - ALMACENAMIENTO WIP', [
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
            mkFunction('Preparar Kit completo y ordenado de componentes (según la Orden de Producción); Contener componentes en medios definidos; Etiquetar caja con identificación mínima obligatoria (N° de parte/modelo, OP, Fecha/Turno); y Mover kits a la zona de adhesivado.', '', [
                mkFailure({
                    description: 'Faltante/exceso de componentes en la caja del kit',
                    severity: '7',
                    effectLocal: 'Una porción de la producción sea descartada (scrap)',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'El Operador no realiza el conteo/verificación completo de la cantidad de componentes según la OP.',
                            preventionControl: 'Existencia de documentación de proceso para la preparación del kit, que guía la cantidad y tipo de componentes',
                            detectionControl: 'Verificación manual o conteo visual del kit por parte del operador',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Componente incorrecto (variante o color) incluido.',
                    severity: '7',
                    effectLocal: 'Una porción de la producción afectada debe ser desechada',
                    effectNextLevel: 'Esto requeriría una acción de reparación o reemplazo en campo o una detención del envío',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Mano de Obra no realiza la verificación visual contra la Orden de Producción (OP)',
                            preventionControl: 'La Orden de Producción (OP) se encuentra disponible y formalizada al igual que la instrucción del operador',
                            detectionControl: 'El operador realiza una verificación visual del componente físico (color o variante) contra el código listado en la OP antes de incluirlo en el kit',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Pieza dañada (rasgadura, mancha) incluida en el kit.',
                    severity: '7',
                    effectLocal: 'Descartar (scrap) una porción de la producción',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'El Operador (Mano de Obra) no sigue el procedimiento de revisión visual de defectos (rasgaduras o manchas)',
                            preventionControl: 'Instrucción o procedimiento (Mano de Obra/Método) que establece que el operador debe buscar rasgaduras o manchas antes de incluir la pieza en el kit.',
                            detectionControl: 'El operador realiza una inspección visual para detectar el Modo de Falla (rasgadura/mancha) antes de liberar el kit.',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp90(): AmfeOperation {
    return mkOp('90', 'ADHESIVADO - ADHESIVAR PIEZAS', [
        mkWE('Machine', 'Pistola de adhesivado', [
            mkFunction('Entregar la pieza inyectada y adhesivada sin defectos. Aplicar adhesivo y unir piezas, logrando adhesión completa y uniforme.', '', [
                mkFailure({
                    description: 'Adhesión insuficiente o fuera de especificación',
                    severity: '8',
                    effectLocal: 'Scrap / Retrabajo',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Uso de adhesivo o reticulante vencido/degradado (Mala gestión de Materiales)',
                            preventionControl: 'Set-up de lanzamiento: Verificación manual de fechas de caducidad',
                            detectionControl: 'Gestión de stock (FIFO)',
                            occurrence: '4', detection: '5',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Proporción de mezcla incorrecta',
                            preventionControl: 'Hoja de proceso detalla como realizar la mezcla correctamente',
                            detectionControl: 'Inspección visual: El operador mira la mezcla',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Exceso o falta de adhesivo',
                            preventionControl: 'Instrucciones de proceso: Documento estándar',
                            detectionControl: 'Pieza patrón e Inspección visual: Comparación visual contra muestra límite',
                            occurrence: '6', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Medios', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp91(): AmfeOperation {
    return mkOp('91', 'ADHESIVADO - INSPECCIONAR PIEZA ADHESIVADA', [
        mkWE('Machine', 'Pistola de adhesivado', [
            mkFunction('Verificar la conformidad de la adhesión y la característica visual del producto', '', [
                mkFailure({
                    description: 'Adhesión insuficiente o fuera de especificación',
                    severity: '8',
                    effectLocal: 'Scrap / Retrabajo',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Uso de adhesivo o reticulante vencido/degradado (Mala gestión de Materiales)',
                            preventionControl: 'Set-up de lanzamiento: Verificación manual de fechas de caducidad',
                            detectionControl: 'Gestión de stock (FIFO)',
                            occurrence: '4', detection: '5',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Proporción de mezcla incorrecta',
                            preventionControl: 'Hoja de proceso detalla como realizar la mezcla correctamente',
                            detectionControl: 'Inspección visual: El operador mira la mezcla',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Exceso o falta de adhesivo',
                            preventionControl: 'Instrucciones de proceso: Documento estándar',
                            detectionControl: 'Pieza patrón e Inspección visual: Comparación visual contra muestra límite',
                            occurrence: '6', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Medios', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp92(): AmfeOperation {
    return mkOp('92', 'ADHESIVADO - ALMACENAMIENTO WIP', [
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
            mkFunction('Preparar Kit completo y ordenado de componentes (según la Orden de Producción); Contener componentes en medios definidos; Etiquetar caja con identificación mínima obligatoria (N° de parte/modelo, OP, Fecha/Turno); y Mover kits a la zona siguiente.', '', [
                mkFailure({
                    description: 'Faltante/exceso de componentes en la caja del kit',
                    severity: '7',
                    effectLocal: 'Una porción de la producción sea descartada (scrap)',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'El Operador no realiza el conteo/verificación completo de la cantidad de componentes según la OP.',
                            preventionControl: 'Existencia de documentación de proceso para la preparación del kit, que guía la cantidad y tipo de componentes',
                            detectionControl: 'Verificación manual o conteo visual del kit por parte del operador',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Componente incorrecto (variante o color) incluido.',
                    severity: '7',
                    effectLocal: 'Una porción de la producción afectada debe ser desechada',
                    effectNextLevel: 'Esto requeriría una acción de reparación o reemplazo en campo o una detención del envío',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Mano de Obra no realiza la verificación visual contra la Orden de Producción (OP)',
                            preventionControl: '-',
                            detectionControl: 'No existe detección implementada para este modo de falla',
                            occurrence: '7', detection: '10',
                            specialChar: 'SC',
                            observations: 'CRITICO: D=10 indica que NO hay detección ni prevención. Definir controles.',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Pieza dañada (rasgadura, mancha) incluida en el kit.',
                    severity: '7',
                    effectLocal: 'Descartar (scrap) una porción de la producción',
                    effectNextLevel: 'Parada de línea entre una hora y un turno de producción completo',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'El Operador (Mano de Obra) no sigue el procedimiento de revisión visual de defectos (rasgaduras o manchas)',
                            preventionControl: 'Instrucción de trabajo',
                            detectionControl: 'No existe detección implementada para este modo de falla',
                            occurrence: '7', detection: '10',
                            specialChar: 'SC',
                            observations: 'CRITICO: D=10 indica que NO hay detección. Definir control de inspección visual.',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp100(): AmfeOperation {
    return mkOp('100', 'Tapizado - Tapizado semiautomático', [
        mkWE('Machine', 'Máquina de tapizado semiautomático', [
            mkFunction('Tapizar el sustrato del IP con el material (piel/tela/vinilo) asegurando adhesión completa y libre de arrugas', 'Adherir el vinilo al sustrato del IP en la zona principal asegurando posición y pegado según especificación', [
                mkFailure({
                    description: 'El operador intenta quitar la pieza durante el proceso de tapizado antes de finalizado',
                    severity: '10',
                    effectLocal: 'Riesgo para la salud del operador',
                    effectNextLevel: 'No afecta',
                    effectEndUser: 'No afecta',
                    causes: [
                        mkCause({
                            cause: 'Error del operario',
                            preventionControl: 'Sensor de proximidad: Incorporado a la máquina (Barrera de luz / Interlock)',
                            detectionControl: 'Visual',
                            occurrence: '2', detection: '8',
                            specialChar: 'CC',
                            observations: 'OS/CC - Critical Characteristic. TBD: Confirmar parámetros y Poka-Yokes cuando llegue la máquina de tapizado',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Se coloca una pieza plástica de otro producto',
                    severity: '1',
                    effectLocal: 'Scrap',
                    effectNextLevel: 'No afecta',
                    effectEndUser: 'No afecta',
                    causes: [
                        mkCause({
                            cause: 'Error del operario',
                            preventionControl: 'Poka-Yoke de Diseño: Moldes específicos que impiden el encastre físico de piezas incorrectas',
                            detectionControl: 'Visual',
                            occurrence: '1', detection: '8',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Se coloca mal el vinilo',
                    severity: '8',
                    effectLocal: 'Potencial scrap',
                    effectNextLevel: 'Potencial parada de línea',
                    effectEndUser: 'Reclamo de aspecto',
                    causes: [
                        mkCause({
                            cause: 'Error del operario',
                            preventionControl: 'Diseño del producto: Piquetes y zonas demarcadas',
                            detectionControl: 'Visual',
                            occurrence: '3', detection: '8',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Mal colocado de la pieza plástica',
                    severity: '2',
                    effectLocal: 'Scrap',
                    effectNextLevel: 'Parada de línea',
                    effectEndUser: 'Potencial reclamo',
                    causes: [
                        mkCause({
                            cause: 'Error del operario',
                            preventionControl: 'Poka-Yoke Técnico: La máquina detecta si la pieza está mal colocada y no realiza el proceso',
                            detectionControl: 'Visual',
                            occurrence: '2', detection: '8',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Falla el proceso automático',
                    severity: '8',
                    effectLocal: 'Scrap',
                    effectNextLevel: 'Parada de línea',
                    effectEndUser: 'Potencial reclamo',
                    causes: [
                        mkCause({
                            cause: 'Falla de la máquina',
                            preventionControl: 'Mantenimiento preventivo',
                            detectionControl: 'Visual: El operador ve que la máquina paró',
                            occurrence: '5', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador + Líder', []),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Medios / Troquel', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp103(): AmfeOperation {
    return mkOp('103', 'REPROCESO: FALTA DE ADHESIVO', [
        mkWE('Man', 'Operador de calidad + Líder', [
            mkFunction('Restaurar la conformidad del componente eliminando el defecto detectado', 'Restituir la capa de adhesivo en áreas donde estaba ausente', [
                mkFailure({
                    description: 'Falta de adhesivo / Cobertura incompleta',
                    severity: '8',
                    effectLocal: 'Scrap del 100%',
                    effectNextLevel: 'Paro de línea / Problemas de Ensamble',
                    effectEndUser: 'Apariencia / Ruido',
                    causes: [
                        mkCause({
                            cause: 'Omisión por fatiga o distracción: El operador olvida aplicar adhesivo en una sección específica por falta de ayudas visuales',
                            preventionControl: 'Instrucciones de proceso y ayudas visuales disponibles en el puesto',
                            detectionControl: 'Inspección de calidad',
                            occurrence: '6', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Instrucción deficiente: La Hoja de Operación Estándar (SOS) de reproceso no especifica el patrón de recorrido',
                            preventionControl: 'La hoja de instrucción detalla el método de aplicación y el patrón de recorrido',
                            detectionControl: 'Inspección de calidad',
                            occurrence: '4', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'La herramienta manual no carga suficiente adhesivo o el adhesivo se secó parcialmente',
                            preventionControl: 'La pistola de adhesivado evita que se seque el adhesivo y carga una cantidad suficiente',
                            detectionControl: 'Inspección de calidad',
                            occurrence: '3', detection: '8',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Exceso de adhesivo / se aplica adhesivo donde no corresponde',
                    severity: '4',
                    effectLocal: 'Retrabajo en línea',
                    effectNextLevel: 'El exceso de pegamento interfiere con los clips o puntos de fijación del IP',
                    effectEndUser: 'Vibración, ruidos o aspecto',
                    causes: [
                        mkCause({
                            cause: 'Sobre-procesamiento: El operador aplica "doble capa" creyendo que "más es mejor"',
                            preventionControl: 'La instrucción detalla que no se debe aplicar más de 1 vez el adhesivo',
                            detectionControl: 'Inspección de calidad',
                            occurrence: '5', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'No existe una plantilla o máscara de protección para tapar zonas donde no lleva adhesivo',
                            preventionControl: 'Instrucciones de proceso detallan donde aplicar el adhesivo',
                            detectionControl: 'Inspección de calidad',
                            occurrence: '7', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Lapicera / Bolsas / Piquete / Medios / Etiquetas', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp105(): AmfeOperation {
    return mkOp('105', 'REFILADO POST-TAPIZADO', [
        mkWE('Machine', 'Herramienta de refilado manual', [
            mkFunction('Eliminar excedentes de material post-tapizado para cumplir dimensiones finales', '', [
                mkFailure({
                    description: 'Refilado excesivo (corte del vinilo más allá del límite)',
                    severity: '7',
                    effectLocal: 'Scrap de pieza tapizada',
                    effectNextLevel: 'Desabastecimiento / Parada de línea menor a una hora',
                    effectEndUser: 'Degradación de la función secundaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Operador corta más allá de la marca de referencia por error o falta de capacitación',
                            preventionControl: 'Ayudas Visuales y Piezas Patrón de Referencia',
                            detectionControl: 'Inspección visual del operario (100%) / Control en inspección final (OP 110)',
                            occurrence: '5', detection: '6',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Refilado insuficiente (excedente de material visible)',
                    severity: '5',
                    effectLocal: 'Retrabajo en línea',
                    effectNextLevel: 'Reclamo de aspecto',
                    effectEndUser: 'Defecto estético menor',
                    causes: [
                        mkCause({
                            cause: 'Operador no completa el refilado en toda la periferia de la pieza',
                            preventionControl: 'Ayudas Visuales y Hoja de Operación',
                            detectionControl: 'Control Visual del Operario (Inspección 100%)',
                            occurrence: '4', detection: '5',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Man', 'Operador de producción / Líder de equipo', []),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp110(): AmfeOperation {
    return mkOp('110', 'Inspección Final - CONTROL FINAL DE CALIDAD', [
        mkWE('Man', 'Operador de calidad', [
            mkFunction('Asegurar la conformidad del producto terminado según Plan de Control; Prevenir el escape de piezas no conformes', 'Verificar/Confirmar la conformidad del producto terminado', [
                mkFailure({
                    description: 'Vinilo despegado',
                    severity: '8',
                    effectLocal: 'SCRAP',
                    effectNextLevel: 'Rechazo de piezas / Reclamo de apariencia',
                    effectEndUser: 'Reclamo de apariencia',
                    causes: [
                        mkCause({
                            cause: 'Falta / ausencia de adhesivo',
                            preventionControl: 'Hojas de operaciones / ayudas visuales',
                            detectionControl: 'Visual',
                            occurrence: '4', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Aprobación de Pieza No Conforme',
                    severity: '5',
                    effectLocal: 'Una porción de la producción requiere Retrabajo Fuera de Línea',
                    effectNextLevel: 'Producto defectuoso desencadena Plan de Reacción Importante',
                    effectEndUser: 'Degradación de la Función Secundaria',
                    causes: [
                        mkCause({
                            cause: 'Omisión o error en la ejecución de la verificación',
                            preventionControl: 'Lista de Verificación (Checklist) y Mantenimiento/Calibración de instrumentos',
                            detectionControl: 'Auditoría de Proceso y Verificación manual/visual',
                            occurrence: '5', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Lapicera / Bolsas plásticas', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp111(): AmfeOperation {
    return mkOp('111', 'Inspección Final - CLASIFICACIÓN Y SEGREGACIÓN DE PRODUCTO NO CONFORME', [
        mkWE('Man', 'Operador de calidad', [
            mkFunction('Segregar producto (conforme y no conforme) según Plan de Control; Prevenir el escape de piezas no conformes', 'Clasificar producto (Conforme / No conforme) y Segregar producto', [
                mkFailure({
                    description: 'Pieza NC clasificada como Conforme',
                    severity: '8',
                    effectLocal: 'Fuerte posibilidad de incorporar procesos adicionales de clasificación',
                    effectNextLevel: 'Parada de línea mayor a un turno completo o Suspensión de envíos',
                    effectEndUser: 'Pérdida de la función primaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Contenedores OK/NC no están claramente diferenciados o rotulados',
                            preventionControl: 'Instrucción Visual',
                            detectionControl: 'Inspección Visual',
                            occurrence: '8', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Instrucción de Trabajo del puesto de Clasificación y Segregación es ambigua respecto al destino final',
                            preventionControl: 'Instrucción Visual',
                            detectionControl: 'Inspección Visual',
                            occurrence: '8', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Operador coloca Pieza NC en contenedor OK por error',
                            preventionControl: 'Instrucción Visual',
                            detectionControl: 'Inspección Visual',
                            occurrence: '5', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Mezcla de producto NC con OK en el contenedor de Embalaje (Contaminación)',
                    severity: '8',
                    effectLocal: 'Fuerte posibilidad de clasificación adicional',
                    effectNextLevel: 'Parada de línea entre una hora y un turno. Reparación o reemplazo en campo',
                    effectEndUser: 'Pérdida de la función primaria del vehículo',
                    causes: [
                        mkCause({
                            cause: 'Operador coloca piezas NC en OK por error de distracción',
                            preventionControl: 'Instrucción Visual',
                            detectionControl: 'Inspección Visual',
                            occurrence: '5', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Contenedores no están físicamente separados / El proceso de traslado no está diseñado para evitar proximidad',
                            preventionControl: 'Instrucción Visual',
                            detectionControl: 'Inspección Visual',
                            occurrence: '8', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Etiqueta o tarjeta de identificación de Scrap/Retrabajo omitida',
                    severity: '5',
                    effectLocal: 'Fuerte posibilidad de clasificación adicional',
                    effectNextLevel: '',
                    effectEndUser: '',
                    causes: [
                        mkCause({
                            cause: 'Operador omite el paso de identificación',
                            preventionControl: 'Instrucción Visual',
                            detectionControl: 'Inspección Visual',
                            occurrence: '1', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'Insumos de identificación no disponibles (No hay etiquetas/tarjetas)',
                            preventionControl: '-',
                            detectionControl: '-',
                            occurrence: '1', detection: '8',
                            specialChar: 'SC',
                        }),
                        mkCause({
                            cause: 'El procedimiento de segregación no requiere la colocación de la tarjeta antes de la colocación en el contenedor NC',
                            preventionControl: 'Instrucción Visual',
                            detectionControl: 'Inspección Visual',
                            occurrence: '1', detection: '8',
                            specialChar: 'SC',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Etiquetas / Bolsas / Lapicera / Medios', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

function createPatagoniaOp120(): AmfeOperation {
    return mkOp('120', 'Embalaje - EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', [
        mkWE('Man', 'Operador de calidad', [
            mkFunction('Mantener/Asegurar la integridad física y conformidad del producto; Establecer/Garantizar trazabilidad y conteo exacto', 'Obtener producto conforme, correctamente contenido y protegido, con trazabilidad establecida', [
                mkFailure({
                    description: 'Pieza deformada por mal posicionamiento en el embalaje',
                    severity: '7',
                    effectLocal: 'Daño permanente en la espuma o en la costura',
                    effectNextLevel: 'Paro de línea temporal o devolución del lote / Defecto notorio y disconformidad inmediata',
                    effectEndUser: '- (El error se corrige antes de llegar al usuario)',
                    causes: [
                        mkCause({
                            cause: 'Mal posicionamiento / Sin separadores',
                            preventionControl: 'Uso de separadores, bandejas o estructuras que mantienen la forma del apoyacabezas durante el embalaje y almacenaje',
                            detectionControl: 'Inspección visual del operador: Al momento de ubicar',
                            occurrence: '3', detection: '8',
                        }),
                    ],
                }),
                mkFailure({
                    description: 'Colocación de mayor o menor cantidad de piezas por medio',
                    severity: '4',
                    effectLocal: '100% producción requiere retrabajo en estación',
                    effectNextLevel: 'Plan de reacción importante por desvío de cantidad',
                    effectEndUser: '- (El error se corrige antes de llegar al usuario)',
                    causes: [
                        mkCause({
                            cause: 'Falta de control en la cantidad cargada por medio debido a ausencia de guía visual o desatención del operador',
                            preventionControl: 'Estándar visual con foto de referencia indicando la cantidad por medio, visible en el puesto de trabajo',
                            detectionControl: 'Verificación visual del medio completo antes del cierre',
                            occurrence: '3', detection: '6',
                        }),
                    ],
                }),
            ]),
        ]),
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
        mkWE('Material', 'Etiquetas / Bolsas / Lapicera / Medios', []),
        mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
    ]);
}

/**
 * Create a complete AMFE for the PATAGONIA tapizado process (VW).
 *
 * Process: Automotive door insert upholstery (Inserto Patagonia)
 * 22 Operations from reception through packaging.
 *
 * Each call generates fresh UUIDs to prevent shared references.
 */
export function createPatagoniaAmfeDocument(): AmfeDocument {
    return {
        header: {
            organization: 'BARACK MERCOSUL',
            location: 'PLANTA HURLINGHAM',
            client: 'VWA',
            modelYear: 'PATAGONIA',
            subject: 'INSERTO',
            startDate: '2025-11-27',
            revDate: '2025-11-27',
            team: 'Cristina Rabago Seguridad e higiene, Marianna Vera Producción, Manuel Meszaros Calidad',
            amfeNumber: 'AMFE-PAT-001',
            responsible: 'P. Gamboa',
            confidentiality: '-',
            partNumber: 'N 227 a N 403 — Insertos PATAGONIA VWA',
            processResponsible: 'Carlos Baptista',
            revision: 'PRELIMINAR',
            approvedBy: 'C. Baptista',
            scope: 'Proceso completo de tapizado automotriz del INSERTO PATAGONIA: desde recepción de MP hasta embalaje de producto terminado. Incluye corte, costura CNC, troquelado, inyección plástica, prearmado, adhesivado, tapizado e inspección final.',
            applicableParts: 'Insertos de Puerta Delanteros\nN 227 — INSERTO PTA. DEL. IZQ. L0\nN 392 — INSERTO PTA. DEL. DER. L0\nN 389 — INSERTO PTA. DEL. IZQ. L1\nN 393 — INSERTO PTA. DEL. DER. L1\nN 390 — INSERTO PTA. DEL. IZQ. L2\nN 394 — INSERTO PTA. DEL. DER. L2\nN 391 — INSERTO PTA. DEL. IZQ. L3\nN 395 — INSERTO PTA. DEL. DER. L3\nInsertos de Puerta Traseros\nN 396 — INSERTO PTA. TRAS. IZQ. L0\nN 400 — INSERTO PTA. TRAS. DER. L0\nN 397 — INSERTO PTA. TRAS. IZQ. L1\nN 401 — INSERTO PTA. TRAS. DER. L1\nN 398 — INSERTO PTA. TRAS. IZQ. L2\nN 402 — INSERTO PTA. TRAS. DER. L2\nN 399 — INSERTO PTA. TRAS. IZQ. L3\nN 403 — INSERTO PTA. TRAS. DER. L3',
        },
        operations: [
            createPatagoniaOp10(),
            createPatagoniaOp15(),
            createPatagoniaOp20(),
            createPatagoniaOp25(),
            createPatagoniaOp30(),
            createPatagoniaOp40(),
            createPatagoniaOp50(),
            createPatagoniaOp60(),
            createPatagoniaOp61(),
            createPatagoniaOp70(),
            createPatagoniaOp71(),
            createPatagoniaOp80(),
            createPatagoniaOp81(),
            createPatagoniaOp90(),
            createPatagoniaOp91(),
            createPatagoniaOp92(),
            createPatagoniaOp100(),
            createPatagoniaOp103(),
            createPatagoniaOp105(),
            createPatagoniaOp110(),
            createPatagoniaOp111(),
            createPatagoniaOp120(),
        ],
    };
}

// ============================
//  COMPLETE EXAMPLE DOCUMENT
// ============================

/**
 * Create a complete, realistic AMFE example document.
 *
 * Process: Automotive chassis welding sub-assembly (Subchasis Soldado)
 * - Operation 10: Soldadura MIG
 * - Operation 20: Inspección Dimensional y Visual
 * - Operation 30: Protección Anticorrosiva (E-coat)
 *
 * Each call generates fresh UUIDs to prevent shared references.
 */
export function createExampleAmfeDocument(): AmfeDocument {
    return {
        header: {
            organization: 'BARACK MERCOSUL',
            location: 'PLANTA HURLINGHAM',
            client: 'OEM AUTOMOTRIZ (Ejemplo)',
            modelYear: '2026',
            subject: 'AMFE Proceso - Subchasis Soldado (EJEMPLO)',
            startDate: '2026-01-15',
            revDate: '2026-02-28',
            team: 'Ing. Calidad, Ing. Manufactura, Ing. Mantenimiento, Supervisor Producción',
            amfeNumber: 'AMFE-EJEMPLO-001',
            responsible: 'Jefe de Calidad',
            confidentiality: 'Confidencial',
            partNumber: 'SC-2026-001-R01',
            processResponsible: 'Jefe de Manufactura',
            revision: 'B',
            approvedBy: 'Gerente de Planta',
            scope: 'Proceso de fabricación de subchasis soldado: desde soldadura MIG hasta protección anticorrosiva E-coat.',
            applicableParts: 'SC-2026-001\nSC-2026-002\nSC-2026-003',
        },
        operations: [
            createOp10(),
            createOp20(),
            createOp30(),
        ],
    };
}
