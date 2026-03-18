#!/usr/bin/env node
/**
 * SEED: TOP ROLL PATAGONIA (VWA) — AMFE + PFD + CP + HO + Family
 *
 * Creates all APQP documents for the Top Roll product from VWA:
 *   1. AMFE document (9 operations, 13 pages of data)
 *   2. PFD document (flow diagram with all process steps)
 *   3. Control Plan (generated from AMFE causes with AP = H or M)
 *   4. HO document (one sheet per AMFE operation, stubs)
 *   5. Product family "Top Roll Patagonia"
 *   6. Verification queries
 *
 * Usage: node scripts/seed-top-roll.mjs
 */

import { createHash, randomUUID } from 'crypto';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

// ─── Helpers ────────────────────────────────────────────────────────────────

const uuid = () => randomUUID();
const sha256 = (str) => createHash('sha256').update(str).digest('hex');

const PROJECT_NAME = 'VWA/PATAGONIA/TOP_ROLL';
const PART_NUMBER = '2GJ.868.087 / 2GJ.868.088';

// ─── AP Calculation per AIAG-VDA ────────────────────────────────────────────

function calcAP(severity, occurrence, detection) {
    const s = Number(severity) || 1;
    const o = Number(occurrence) || 1;
    const d = Number(detection) || 1;
    // AIAG-VDA AP logic (simplified standard table)
    if (s >= 9 && o >= 4) return 'H';
    if (s >= 9 && o >= 2 && d >= 4) return 'H';
    if (s >= 9) return 'H';
    if (s >= 7 && o >= 4 && d >= 4) return 'H';
    if (s >= 5 && o >= 6) return 'H';
    if (s >= 7 && o >= 3) return 'M';
    if (s >= 5 && o >= 4) return 'M';
    if (s >= 4 && o >= 5) return 'M';
    if (s >= 7 && d >= 6) return 'M';
    if (s >= 5 && o >= 3 && d >= 4) return 'M';
    return 'L';
}

function inferOpCategory(name) {
    const n = (name || '').toLowerCase();
    if (/sold[au]/i.test(n)) return 'soldadura';
    if (/ensam[bp]l/i.test(n)) return 'ensamble';
    if (/inyecci[oó]n/i.test(n)) return 'inyeccion';
    if (/inspec/i.test(n)) return 'inspeccion';
    if (/trim/i.test(n)) return 'corte';
    if (/corte/i.test(n)) return 'corte';
    if (/embala/i.test(n) || /empaque/i.test(n)) return 'embalaje';
    if (/adhesi/i.test(n)) return 'adhesivado';
    if (/tapiz/i.test(n) || /img/i.test(n) || /termoform/i.test(n)) return 'tapizado';
    if (/recep/i.test(n)) return 'recepcion';
    if (/refil/i.test(n)) return 'refilado';
    if (/almacen|wip/i.test(n)) return 'almacenamiento';
    if (/pleg/i.test(n) || /edge.*fold/i.test(n) || /fold/i.test(n)) return 'plegado';
    return '';
}

// ═══════════════════════════════════════════════════════════════════════════
// AMFE DOCUMENT — Parsed from PDF extract
// ═══════════════════════════════════════════════════════════════════════════

const amfeHeader = {
    organization: 'BARACK MERCOSUL',
    location: 'PLANTA HURLINGHAM',
    client: 'VWA',
    modelYear: 'PATAGONIA',
    subject: 'TOP ROLL',
    startDate: '2026-02-13',
    revDate: '2026-02-13',
    team: 'Cristina Rabago Seguridad e higiene, Marianna Vera Producción, Carlos Baptista Ingeniería, Manuel Meszaros Calidad',
    amfeNumber: 'AMFE-TOPROLL-001',
    responsible: 'Carlos Baptista',
    confidentiality: '-',
    partNumber: PART_NUMBER,
    processResponsible: 'Carlos Baptista',
    revision: '01',
    approvedBy: 'Manuel Meszaros',
    scope: 'TOP ROLL FRONT DI - DD TAOS',
    applicableParts: '2GJ.868.087\n2GJ.868.088',
};

// ── Helper to build a cause ──────────────────────────────────────────────

function cause(causeText, prevention, detection, sev, occ, det, specialChar = '') {
    const ap = calcAP(sev, occ, det);
    return {
        id: uuid(),
        cause: causeText,
        preventionControl: prevention,
        detectionControl: detection,
        occurrence: occ,
        detection: det,
        ap,
        characteristicNumber: '',
        specialChar,
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
        observations: '',
    };
}

function failure(desc, effectLocal, effectClient, effectUser, severity, causes) {
    return {
        id: uuid(),
        description: desc,
        effectLocal: effectLocal,
        effectNextLevel: effectClient,
        effectEndUser: effectUser,
        severity,
        causes,
    };
}

function func(desc, requirements, failures) {
    return { id: uuid(), description: desc, requirements, failures };
}

function workElement(type, name, functions) {
    return { id: uuid(), type, name, functions };
}

// ══════════════════════════════════════════════════════════════════════════
// OPERATION 5 — RECEPCION DE MATERIA PRIMA
// ══════════════════════════════════════════════════════════════════════════

const op5 = {
    id: uuid(),
    opNumber: '5',
    name: 'RECEPCIONAR MATERIA PRIMA',
    focusElementFunction: 'Recepción de materia prima',
    operationFunction: 'Asegurar la conformidad de la calidad y cantidad de material recibido',
    workElements: [
        workElement('Machine', 'Autoelevador', [
            func('Garantizar la estabilidad y la integridad física del material durante el transporte interno', '', [
                failure('Material / pieza golpeada o dañada durante transporte',
                    'Retrabajo', 'Problemas en el ensamble final', 'Potencial reclamo de aspecto/comfort', 7,
                    [
                        cause('Mala estiba y embalaje inadecuado',
                            'Medios de embalaje validados',
                            'Inspección Visual de daños/suciedad en el empaque al recibir', 7, 6, 6, 'SC'),
                        cause('Manipulación incorrecta en tránsito',
                            'Existencia de instrucciones de trabajo que definen cómo debe estibarse y manipularse el material',
                            'Inspección Visual del estado de la pieza/empaque', 7, 5, 6),
                        cause('Almacenaje inadecuado en transporte (sin protecciones)',
                            'Procedimientos de Logística sobre estiba segura y uso de Embalajes Cubiertos o cerrados',
                            'Verificación del estado del embalaje antes de que el camión salga', 7, 5, 6),
                    ]
                ),
            ]),
        ]),
        workElement('Man', 'Operador de producción / Operador de calidad', [
            func('Verificar el cumplimiento y la trazabilidad de la materia prima recibida', '', [
                failure('Falta de documentación o trazabilidad',
                    'Riesgo de mezclar lotes no conformes', 'Dificultades en trazabilidad si surge un reclamo', 'Potencial reclamo', 7,
                    [
                        cause('Procesos administrativos deficientes',
                            'El sistema ARB obliga a registrar lote y código en recepción y verifica contra base de datos',
                            'Verificación automática del lote/código registrado contra la base de datos', 7, 3, 7),
                        cause('Proveedor sin sistema robusto de trazabilidad',
                            'Auditorías de Sistema y Requisitos que validan la capacidad de trazabilidad del proveedor',
                            'Verificación del Certificado de Conformidad y registro obligatorio de lote', 7, 5, 5, 'SC'),
                    ]
                ),
                failure('Material con especificación errónea (dimensiones, color, dureza, etc.)',
                    'Potencial scrap', 'Potencial parada de línea', 'Potencial reclamo de aspecto', 8,
                    [
                        cause('Error en la orden de compra o ficha técnica',
                            'Revisión de Ingeniería de la Ficha Técnica/OC antes de la emisión al proveedor',
                            'Revisión del Certificado de Calidad (CoC) y Control Dimensional por Muestreo en recepción', 8, 6, 6, 'SC'),
                        cause('Proveedor no respeta tolerancias',
                            'Requisitos Contractuales de Calidad y Auditorías al Proveedor',
                            'Control dimensional por muestreo en recepción y Revisión obligatoria del Certificado de Calidad', 8, 7, 6, 'SC'),
                    ]
                ),
            ]),
        ]),
        workElement('Material', 'Calibres, Micrómetro, Probeta de flamabilidad, Probeta de peeling', [
            func('Disponer y utilizar instrumentos de medición y ensayo', '', [
                failure('Contaminación / suciedad en la materia prima',
                    'Potencial scrap', 'Reclamo de aspecto', 'Problemas de calidad durante el ensamble', 6,
                    [
                        cause('Ambiente sucio en planta del proveedor',
                            'Auditorías de Calidad',
                            'Inspección Visual de la pieza y Revisión del Certificado de Calidad del proveedor', 6, 6, 6),
                        cause('Falta de inspección visual al recibir',
                            'Instrucción de Trabajo de Recepción que exige la verificación física y visual',
                            'Inspección visual en recepción', 6, 5, 5),
                    ]
                ),
            ]),
        ]),
        workElement('Method', 'Método de Fabricación', [
            func('Comprobar que el embalaje no esté dañado. Corroborar que la orden sea la correcta. Cargar la materia prima en ARB.', '', [
                failure('No se utiliza el sistema ARB',
                    'Falta de trazabilidad', 'Potencial mezcla de lotes', 'Reclamo por trazabilidad', 6,
                    [
                        cause('Falta de control dimensional en recepción',
                            'Procedimiento Operacional Estándar de Inspección',
                            'El sistema impide la emisión de ubicaciones hasta que todos los campos del ARB sean completados', 6, 4, 4),
                    ]
                ),
            ]),
        ]),
        workElement('Environment', 'Iluminación/Ruido, Ley 19587', [
            func('Mantener las condiciones de seguridad ocupacional según la Ley 19587', '', [
                failure('Condiciones ambientales inadecuadas',
                    'Posible error de inspección', 'N/A', 'N/A', 6,
                    [
                        cause('Iluminación insuficiente en zona de recepción',
                            'Programa de mantenimiento de luminarias',
                            'Auditoría de condiciones ambientales', 6, 3, 6),
                    ]
                ),
            ]),
        ]),
    ],
};

// ══════════════════════════════════════════════════════════════════════════
// OPERATION 10 — INYECCION DE PIEZAS PLASTICAS
// ══════════════════════════════════════════════════════════════════════════

const op10 = {
    id: uuid(),
    opNumber: '10',
    name: 'INYECCIÓN DE PIEZAS PLÁSTICAS',
    focusElementFunction: 'INYECCIÓN PLÁSTICA',
    operationFunction: 'Fabricar la pieza plástica cumpliendo con las especificaciones dimensionales y de apariencia',
    workElements: [
        workElement('Machine', 'Máquina inyectora de plástico', [
            func('Moldear la pieza plástica inyectando la materia prima en la cavidad', '', [
                failure('Llenado Incompleto de Pieza',
                    '100% de la producción en ese ciclo tiene que ser Scrapeada', 'Parada de línea mayor a un turno', 'Pérdida de la Función Primaria del vehículo', 9,
                    [
                        cause('Presión de Inyección configurada fuera de especificación',
                            'Monitoreo automático de presión y mantenimiento preventivo con calibración periódica de sensores',
                            'Detección automática de llenado incompleto', 9, 5, 5, 'SC'),
                        cause('Temperatura de fusión del material (T°) demasiado baja',
                            'Programa de Mantenimiento y Calibración del Sistema Térmico',
                            'Verificación Visual y Dimensional de Aprobación de la Primera Pieza', 9, 4, 5),
                    ]
                ),
                failure('Rebaba Excesiva / Exceso de Material',
                    '100% de la producción tiene que ser Retrabajada Fuera de Línea', 'Parada de línea de producción menor a una hora', 'Pérdida de la Función Secundaria del vehículo', 8,
                    [
                        cause('Fuerza de Cierre insuficiente',
                            'Mantenimiento Preventivo de la Unidad de Cierre / Instrucción de Set-up detallada',
                            'Monitoreo Automático de Presión de Cierre / Inspección dimensional manual por muestreo', 8, 5, 3),
                        cause('Molde o cavidad contaminada con material residual',
                            'Procedimiento de limpieza y purga estandarizado para la cavidad',
                            'Inspección visual por parte del operador de la cavidad', 8, 5, 8, 'SC'),
                        cause('Parámetros de Inyección configurados incorrectamente',
                            'Instrucción de Set-up Estandarizada detallando valores nominales y rangos',
                            'Aprobación de la Primera Pieza por personal de Calidad/Supervisión', 8, 5, 8, 'SC'),
                    ]
                ),
                failure('Omitir inspección dimensional de cotas index',
                    'Una porción de la producción requiere Retrabajo', 'Se desencadena un Plan de Reacción Importante', 'Degradación de la Función Secundaria', 7,
                    [
                        cause('Operador omite la verificación dimensional de la cota index',
                            'Lista de Verificación (Checklist) para asegurar que el paso se incluya al inicio del turno',
                            'Auditoría de Proceso', 7, 5, 5, 'SC'),
                        cause('Instrucción de trabajo ambigua sobre la frecuencia o la metodología',
                            'Las Hojas de Proceso describen el método operativo y las pautas de control',
                            'Cada dos meses se verifica una pieza con su documentación', 7, 5, 5),
                    ]
                ),
            ]),
        ]),
        workElement('Man', 'Operador de producción / Líder de equipo', [
            func('Supervisar las actividades del operario según las hojas de operaciones', '', [
                failure('Contaminación / suciedad en la materia prima',
                    'Potencial scrap', 'Reclamo de aspecto', 'Problemas de calidad', 6,
                    [
                        cause('Ambiente sucio en planta del proveedor',
                            'Auditorías de Calidad',
                            'Inspección Visual de la pieza y Revisión del Certificado de Calidad del proveedor', 6, 5, 6),
                        cause('Falta de inspección al llegar',
                            'Instrucción de Trabajo',
                            'Inspección visual en recepción', 6, 6, 6),
                    ]
                ),
            ]),
        ]),
        workElement('Method', 'Método de Fabricación', [
            func('Utilizar la Hoja de Operaciones vigente. Definir el plan de reacción ante un No conforme.', '', []),
        ]),
        workElement('Environment', 'Iluminación/Ruido, Ley 19587', [
            func('Mantener las condiciones de seguridad ocupacional según la Ley 19587', '', []),
        ]),
    ],
};

// ══════════════════════════════════════════════════════════════════════════
// OPERATION 11 — ALMACENAMIENTO EN MEDIOS WIP
// ══════════════════════════════════════════════════════════════════════════

const op11 = {
    id: uuid(),
    opNumber: '11',
    name: 'ALMACENAMIENTO EN MEDIOS WIP',
    focusElementFunction: 'INYECCIÓN PLÁSTICA',
    operationFunction: 'Verificar piezas visualmente y colocarlas de forma ordenada; Etiquetar caja; Mover producto',
    workElements: [
        workElement('Machine', 'Zorras manuales', [
            func('Mantener la Estabilidad de la Carga durante el Movimiento Interno', '', []),
        ]),
        workElement('Man', 'Operador de producción / Líder de equipo', [
            func('Preparar Kit completo y ordenado de componentes según la Orden de Producción', '', [
                failure('Faltante/exceso de componentes en la caja del kit',
                    'Una porción de la producción sea descartada (scrap)', 'Parada de línea entre una hora y un turno', 'Degradación de la función secundaria del vehículo', 7,
                    [
                        cause('El Operador no realiza el conteo/verificación completo de la cantidad de componentes según la OP',
                            'Existencia de documentación de proceso (Ayuda visual / Hoja de operación estándar)',
                            'Verificación manual o conteo visual del kit por parte del operador', 7, 5, 5, 'SC'),
                    ]
                ),
                failure('Componente incorrecto (variante o color) incluido',
                    'Una porción de la producción afectada debe ser desechada', 'Parada de línea', 'Degradación de la función secundaria del vehículo', 8,
                    [
                        cause('Mano de Obra no realiza la verificación visual contra la Orden de Producción',
                            'La Orden de Producción (OP) se encuentra disponible y formalizada',
                            'El operador realiza una verificación visual del componente contra el código en la OP', 8, 5, 5, 'SC'),
                    ]
                ),
                failure('Pieza dañada (rasgadura, mancha) incluida en el kit',
                    'Descartar (scrap) una porción de la producción', 'Parada de línea', 'Degradación de la función secundaria del vehículo', 7,
                    [
                        cause('El Operador no sigue el procedimiento de revisión visual de defectos',
                            'Instrucción o procedimiento que establece que el operador debe buscar rasgaduras o manchas',
                            'Inspección visual por operador', 7, 5, 5),
                    ]
                ),
            ]),
        ]),
        workElement('Material', 'Etiquetas blancas 100x60mm / Etiquetas de rechazo', [
            func('Identificar Producto/Kit. Asegurar Trazabilidad.', '', []),
        ]),
        workElement('Method', 'Método de Fabricación', [
            func('Utilizar la Hoja de Operaciones vigente.', '', []),
        ]),
        workElement('Environment', 'Iluminación/Ruido, Ley 19587', [
            func('Mantener condiciones de seguridad ocupacional según Ley 19587', '', []),
        ]),
    ],
};

// ══════════════════════════════════════════════════════════════════════════
// OPERATION 20 — ADHESIVADO HOT MELT
// ══════════════════════════════════════════════════════════════════════════

const op20 = {
    id: uuid(),
    opNumber: '20',
    name: 'ADHESIVADO HOT MELT',
    focusElementFunction: 'ADHESIVO',
    operationFunction: 'Aplicar una capa uniforme de adhesivo Hot Melt sobre el sustrato TPO para garantizar la adhesión',
    workElements: [
        workElement('Machine', 'Sistema de Fusión / Sistema de Aplicación / Sistema de Desenrollado y Tensión / Sistema de Enfriamiento', [
            func('Calentar y fundir el adhesivo, transferir capa controlada sobre sustrato TPO, suministrar sustrato continuo, reducir temperatura', '', [
                failure('Adhesión deficiente del vinilo en la pieza plástica / quemaduras en el vinilo',
                    'Scrap', 'Potencial parada de línea', 'Reclamo de aspecto', 8,
                    [
                        cause('Temperatura de aplicación mayor o menor a 190-210°C',
                            'Hojas de operaciones / ayudas visuales',
                            'Visual', 8, 4, 8, 'SC'),
                        cause('Superficie de la pieza con polvo, grasa o oleosidad',
                            'Hojas de operaciones / ayudas visuales',
                            'Visual', 8, 3, 8),
                        cause('Error del operario / máquina empastada',
                            'Limpieza constante del rodillo / Hojas de operaciones',
                            'Visual', 8, 3, 8),
                    ]
                ),
                failure('Peso del vinilo adhesivado incorrecto',
                    'Adhesión deficiente', 'Potencial parada de línea', 'Reclamo de aspecto', 8,
                    [
                        cause('Falta de control de peso de adhesivo',
                            'Plan de reacción',
                            'Pesaje por muestreo', 8, 4, 8),
                    ]
                ),
            ]),
        ]),
        workElement('Man', 'Operador de producción / Líder de equipo', [
            func('Cargar los parámetros correctos de la receta en el HMI y realizar la carga/empalme de la bobina de TPO sin arrugas', '', [
                failure('Posible quemadura en el operario',
                    'Accidente laboral', 'N/A', 'Riesgo de seguridad', 10,
                    [
                        cause('Falta de EPP y herramientas',
                            'Pinzas para tomar el vinilo',
                            'Visual', 10, 1, 4),
                    ]
                ),
            ]),
        ]),
        workElement('Material', 'Adhesivo Hot Melt / Rollo de TPO (Sustrato)', [
            func('Adhesión química y resistencia térmica. Fundirse homogéneamente con viscosidad adecuada.', '', []),
        ]),
        workElement('Method', 'Método de Fabricación', [
            func('Utilizar la Hoja de Operaciones vigente.', '', []),
        ]),
        workElement('Environment', 'Iluminación/Ruido, Ley 19587', [
            func('Mantener condiciones de seguridad ocupacional según Ley 19587', '', []),
        ]),
    ],
};

// ══════════════════════════════════════════════════════════════════════════
// OPERATION 30 — PROCESO DE IMG (Termoformado)
// ══════════════════════════════════════════════════════════════════════════

const op30 = {
    id: uuid(),
    opNumber: '30',
    name: 'PROCESO DE IMG',
    focusElementFunction: 'PROCESO DE IMG',
    operationFunction: 'Conformar térmicamente la lámina pre-laminada para obtener la geometría final y replicar la textura (grano)',
    workElements: [
        workElement('Machine', 'Estación de Calentamiento / Estación de Formado / Sistema de Vacío / Sistema de Enfriamiento / Mecanismo de Transporte', [
            func('Calentar la lámina pre-laminada, conformarla por vacío sobre un molde texturizado, enfriar la pieza', '', [
                failure('Temperatura de lámina TPO insuficiente',
                    'Scrap / Retrabajo', 'Potencial parada de línea', 'Deformaciones o pérdida de textura', 10,
                    [
                        cause('Sensor de temperatura de horno descalibrado o desplazado',
                            'Calibración del sensor cada turno con pirómetro de referencia',
                            'Inspección visual 100% de textura en estación de control', 10, 4, 7, 'SC'),
                    ]
                ),
                failure('Espesor de pared excesivo en zona de ruptura de Airbag',
                    'Scrap / Retrabajo', 'Riesgo de seguridad - Airbag no despliega correctamente', 'Riesgo de seguridad', 10,
                    [
                        cause('Obstrucción parcial de micro-canales de vacío por acumulación de vapores Hot Melt',
                            'Limpieza de molde programada cada 4 hs con hielo seco',
                            'Medición por Ultrasonido cada 2 horas', 10, 6, 3, 'CC'),
                    ]
                ),
            ]),
        ]),
        workElement('Man', 'Operador de Proceso', [
            func('Cargar parámetros en el HMI, vigilar el ciclo automático y verificar visualmente las piezas conformadas', '', []),
        ]),
        workElement('Material', 'Rollo Pre-laminado (TPO + Hot Melt) / Molde de IMG', [
            func('Base receptora del adhesivo con tensión superficial correcta y estabilidad dimensional', '', [
                failure('Ancho de bobina de TPO fuera de tolerancia',
                    'Desperdicio de material / Costo adicional', 'Sin efecto significativo', 'Sin efecto', 3,
                    [
                        cause('Error en el pedido de compras o variación del proveedor de lámina',
                            'Certificado de calidad del proveedor verificado en recepción',
                            'Medición de ancho con flexómetro al inicio de cada bobina', 3, 3, 4),
                    ]
                ),
            ]),
        ]),
        workElement('Method', 'Método de Fabricación', [
            func('Utilizar la Hoja de Operaciones vigente.', '', []),
        ]),
        workElement('Environment', 'Suministro de Agua / Suministro de Aire Comprimido', [
            func('Mantener condiciones de seguridad ocupacional según Ley 19587', '', []),
        ]),
    ],
};

// ══════════════════════════════════════════════════════════════════════════
// OPERATION 40 — TRIMMING (CORTE FINAL)
// ══════════════════════════════════════════════════════════════════════════

const op40 = {
    id: uuid(),
    opNumber: '40',
    name: 'TRIMMING CORTE FINAL',
    focusElementFunction: 'PROCESO DE TRIMMING (CORTE FINAL)',
    operationFunction: 'Entregar piezas con contorno final dentro de tolerancia dimensional, bordes sin rebarbas ni quemaduras',
    workElements: [
        workElement('Machine', 'Componentes de Cuchilla (Hot Knife) / Sistema Neumático / Plataforma del Molde Inferior / Sistema de Control Eléctrico', [
            func('Proveer fuerza y movimiento preciso para desplazar módulos de corte, controlar tiempos y secuencia', '', [
                failure('Contorno de corte desplazado (Fuera de tolerancia geométrica)',
                    'Retrabajo manual costoso (lijado/recorte)', 'Gap excesivo entre panel y chapa', 'Ruidos (Squeak & Rattle)', 8,
                    [
                        cause('Desgaste en los pines de centrado del fixture o pieza mal asentada por suciedad',
                            'Mantenimiento Preventivo de Fixtures: verificación dimensional de pines cada 3 meses',
                            'Medición en Dispositivo de Control (Checking Fixture): 1 pieza cada hora', 8, 3, 7, 'SC'),
                    ]
                ),
                failure('Borde de corte quemado o con hilachas (Angel hair)',
                    'Retrabajo', 'Defecto visual menor', 'Mala apariencia de bordes', 5,
                    [
                        cause('Velocidad de avance de cuchilla incorrecta por fuga de aire o regulador desajustado',
                            'Hoja de Parámetros Estándar: verificación de presiones de aire al inicio de turno',
                            'Inspección Visual 100%: el operario retira las hilachas manualmente', 5, 6, 5),
                    ]
                ),
            ]),
        ]),
        workElement('Man', 'Operador de Carga/Descarga', [
            func('Cargar pieza en fixture, iniciar ciclo, descargar y verificar', '', []),
        ]),
        workElement('Material', 'Pieza Termoformada (Formed Part) / Aire Comprimido', [
            func('Mantener geometría al ser colocada en el nido, permitir corte sin fracturarse ni delaminarse', '', []),
        ]),
        workElement('Method', 'Método de Fabricación', [
            func('Utilizar la Hoja de Operaciones vigente.', '', []),
        ]),
        workElement('Environment', 'Iluminación/Ruido, Ley 19587', [
            func('Mantener condiciones de seguridad ocupacional según Ley 19587', '', []),
        ]),
    ],
};

// ══════════════════════════════════════════════════════════════════════════
// OPERATION 50 — EDGE FOLDING (PLEGADO DE BORDES)
// ══════════════════════════════════════════════════════════════════════════

const op50 = {
    id: uuid(),
    opNumber: '50',
    name: 'EDGE FOLDING',
    focusElementFunction: 'PROCESO DE EDGE FOLDING (PLEGADO DE BORDES)',
    operationFunction: 'Plegar el borde de TPO sobre el reverso del sustrato y adherirlo por presión generando un borde estético',
    workElements: [
        workElement('Machine', 'Sistema de Calentamiento / Mecanismo de Plegado / Sistema de Presión / Fixture-Nido', [
            func('Generar calor localizado, empujar solapa de TPO, aplicar presión uniforme, soporte y posicionamiento', '', [
                failure('Espesor de borde fuera de especificación (Plegado abierto o incompleto)',
                    'Parada de máquina para ajuste', 'Problemas de montaje', 'Ruidos (Squeak & Rattle) por roce con la chapa', 6,
                    [
                        cause('Fuga de aire o baja presión en cilindros neumáticos de los sliders de plegado',
                            'Switch de Presión Digital: la máquina no inicia ciclo si la presión < 6 Bar',
                            'Verificación en Galga (Checking Fixture): pasa/no pasa por muestreo', 6, 6, 6),
                    ]
                ),
                failure('Arrugas o pliegues irregulares visibles en el radio del borde',
                    'Retrabajo', 'Mala apariencia en bordes visibles', 'Defecto estético en interior del auto', 5,
                    [
                        cause('Pieza mal posicionada en el nido por el operador al cargar',
                            'Pines de referencia en el nido (Poka-yoke): ayudas visuales y mecánicas',
                            'Inspección Visual 100%: el operador revisa la pieza al descargarla', 5, 6, 5),
                    ]
                ),
            ]),
        ]),
        workElement('Man', 'Operador de Línea (Carga/Descarga)', [
            func('Posicionar la pieza en el nido asegurando que los puntos de referencia calcen a fondo', '', []),
        ]),
        workElement('Material', 'Pieza Recortada (Trimmed Part) / Adhesivo Reactivado (Hot Melt)', [
            func('Tener la longitud de solapa correcta para permitir el doblado', '', []),
        ]),
        workElement('Method', 'Método de Fabricación', [
            func('Utilizar la Hoja de Operaciones vigente.', '', []),
        ]),
        workElement('Environment', 'Temperatura Ambiente / Energía', [
            func('Mantener condiciones de seguridad ocupacional según Ley 19587', '', []),
        ]),
    ],
};

// ══════════════════════════════════════════════════════════════════════════
// OPERATION 60 — SOLDADO DE REFUERZOS INTERNOS
// ══════════════════════════════════════════════════════════════════════════

const op60 = {
    id: uuid(),
    opNumber: '60',
    name: 'SOLDADO DE REFUERZOS INTERNOS',
    focusElementFunction: 'PROCESO DE SOLDADURA DE REFUERZOS INTERNOS',
    operationFunction: 'Unir permanentemente los refuerzos plásticos al sustrato del Top Roll mediante fusión ultrasónica',
    workElements: [
        workElement('Machine', 'Generador de Ultrasonido / Conj. Acústico-Sonotrodo / Sist. de Presión / Fixture-Nido', [
            func('Convertir energía eléctrica en señal de alta frecuencia (20 kHz) y aplicar fuerza de compresión controlada', '', [
                failure('Soldadura fría / Falta de fusión (Cold Weld)',
                    'Scrap del Top Roll completo y cuarentena', 'El refuerzo se sale durante el montaje en la puerta, parada de línea', 'Ruido (Squeak & Rattle) dentro de la puerta', 7,
                    [
                        cause('Energía entregada insuficiente (Joules/Tiempo) por desajuste en el generador o sonotrodo flojo',
                            'Monitoreo de Curva de Proceso: ventana de parámetros (Energía/Tiempo/Colapso)',
                            'Prueba de Push-out manual: el operario empuja el refuerzo con la mano', 7, 3, 7),
                    ]
                ),
                failure('Marca de rechupe o quemadura visible en la Cara A (Read-through)',
                    'Scrap inmediato (pieza estética arruinada)', 'Rechazo en inspección final', 'Defecto estético en panel de puerta', 7,
                    [
                        cause('Exceso de colapso (profundidad de soldadura) por presión de aire muy alta o falta de Hard Stop',
                            'Tope Mecánico (Hard Stop): tornillo que impide que el sonotrodo baje más de la cuenta',
                            'Inspección Visual 100%: el operario da vuelta la pieza y mira la Cara A bajo luz controlada', 7, 2, 2),
                    ]
                ),
                failure('Refuerzo / Inserto faltante en el ensamble',
                    'Retrabajo o Scrap si los postes se rompieron', 'No pueden montar el componente, parada de línea', 'N/A (no llega al usuario)', 7,
                    [
                        cause('Error de operario: olvido de cargar el componente en el nido',
                            'Sensores de Presencia (Poka-Yoke): el nido tiene sensores inductivos. Si no detectan la pieza, la máquina NO arranca',
                            'La propia máquina: alerta en pantalla Falta Pieza y bloqueo de ciclo', 7, 2, 2),
                    ]
                ),
            ]),
        ]),
        workElement('Man', 'Operador de Soldadura', [
            func('Colocar todos los refuerzos en sus alojamientos del fixture y posicionar el Top Roll correctamente', '', []),
        ]),
        workElement('Material', 'Pieza Plegada (Edgewrapped Part) / Refuerzos Plásticos (Brackets/Bosses)', [
            func('Proveer superficie rígida y estable para recibir la soldadura', '', []),
        ]),
        workElement('Method', 'Método de Fabricación', [
            func('Utilizar la Hoja de Operaciones vigente.', '', []),
        ]),
        workElement('Environment', 'Ruido / Cabina Insonorizada', [
            func('Mantener condiciones de seguridad ocupacional (Iluminación, protección auditiva por ruido ultrasónico)', '', []),
        ]),
    ],
};

// ══════════════════════════════════════════════════════════════════════════
// OPERATION 70 — SOLDADO TWEETER
// ══════════════════════════════════════════════════════════════════════════

const op70 = {
    id: uuid(),
    opNumber: '70',
    name: 'SOLDADO TWEETER',
    focusElementFunction: 'PROCESO DE SOLDADURA DE TWEETER',
    operationFunction: 'Unión permanente del Tweeter al sustrato del Top Roll mediante soldadura por ultrasonido',
    workElements: [
        workElement('Machine', 'Generador de Ultrasonido / Conj. Acústico-Sonotrodo / Sist. de Movimiento / Fixture-Nido', [
            func('Convertir energía eléctrica en señal de alta frecuencia para fundir los domos de fijación del Tweeter', '', [
                failure('Soldadura fría / Juego libre del Tweeter (Loose assembly)',
                    'Retrabajo o Scrap', 'Falla en prueba de Shake & Rattle', 'Ruido de vibración audible al escuchar música', 7,
                    [
                        cause('Tiempo de soldadura muy corto o amplitud baja',
                            'Monitoreo de Energía (Ventana de Proceso): alarma si la energía consumida está por debajo del mínimo',
                            'Prueba de Torque/Push manual', 7, 3, 7),
                    ]
                ),
                failure('Marca de rechupe o brillo visible en superficie A (Read-through)',
                    'Scrap inmediato', 'Rechazo en inspección final', 'Defecto estético en panel de puerta', 7,
                    [
                        cause('Ausencia de soporte (yunco) o soporte dañado en el nido',
                            'Mantenimiento Preventivo de Nidos: revisión semanal de superficie de apoyos',
                            'Inspección Visual 100% (Lado A)', 7, 2, 2),
                    ]
                ),
                failure('Tweeter dañado internamente (Bobina abierta / Membrana rota)',
                    'Si no se prueba, defecto se escapa', 'Falla en test eléctrico final del auto', 'Pérdida de función de audio', 10,
                    [
                        cause('Contacto directo del sonotrodo con la malla/cono del Tweeter por desalineación',
                            'Diseño de Sonotrodo con alivio (Relief): hueco en el medio para no tocar la malla',
                            'Ninguna en esta estación. No hay test eléctrico en la soldadora', 10, 2, 10, 'CC'),
                    ]
                ),
            ]),
        ]),
        workElement('Man', 'Operador de Soldadura', [
            func('Insertar el Tweeter en los alojamientos del Top Roll asegurando que asiente a fondo antes de activar la máquina', '', []),
        ]),
        workElement('Material', 'Top Roll (Sustrato) / Tweeter-Grilla de Altavoz', [
            func('Sustrato proveniente de operación anterior con orificios para calzar el Tweeter', '', []),
        ]),
        workElement('Method', 'Método de Fabricación', [
            func('Utilizar la Hoja de Operaciones vigente.', '', []),
        ]),
        workElement('Environment', 'Temperatura Ambiente / Iluminación', [
            func('Mantener condiciones de seguridad ocupacional según Ley 19587', '', []),
        ]),
    ],
};

// ══════════════════════════════════════════════════════════════════════════
// OPERATION 80 — INSPECCIÓN FINAL Y EMPAQUE
// ══════════════════════════════════════════════════════════════════════════

const op80 = {
    id: uuid(),
    opNumber: '80',
    name: 'INSPECCIÓN FINAL Y EMPAQUE',
    focusElementFunction: 'PROCESO DE INSPECCIÓN FINAL Y EMPAQUE',
    operationFunction: 'Verificar y confirmar que el Top Roll cumple con 100% de especificaciones. Proteger para transporte.',
    workElements: [
        workElement('Machine', 'Dispositivo de Control (Checking Fixture) / Sistema de Iluminación / Escáner-Sist. de Etiquetado', [
            func('Verificar conformidad del Top Roll terminado según Plan de Control', '', [
                failure('Pieza NO CONFORME aceptada y enviada (Fuga de defecto de seguridad)',
                    'Scrap del ensamble', 'Parada de planta del cliente', 'Riesgo de seguridad', 10,
                    [
                        cause('Energía/señal del sensor de presencia en el Fixture falsa (sensor trabado o descalibrado)',
                            'Verificación de Conejo Rojo (Red Rabbit / Master de Falla): al inicio de cada turno',
                            'Luz Verde en el Fixture + Marca de OK', 10, 3, 4, 'CC'),
                    ]
                ),
                failure('Pieza mal identificada / Etiqueta mixta (Wrong Label)',
                    'Retrabajo: re-etiquetado del lote completo', 'La línea de ensamble del cliente se para por escáner da error', 'Pieza incorrecta montada en vehículo', 9,
                    [
                        cause('Error humano en la selección de etiqueta: el operario tomó el rollo equivocado',
                            'Impresión On-Demand interconectada: la etiqueta solo se imprime SI Y SOLO SI el Fixture dio OK',
                            'Escaneo de validación final: se escanea la etiqueta contra una hoja maestra', 9, 2, 2),
                    ]
                ),
            ]),
        ]),
        workElement('Man', 'Inspector Final / Empacador', [
            func('Ejecutar la secuencia de inspección visual y táctil estandarizada buscando defectos de operaciones anteriores', '', [
                failure('Fuga de defecto visual (Pieza con raya/rechupe aceptada)',
                    'Costo de mala calidad interno', 'Rechazo puntual en la línea del cliente', 'Defecto estético visible', 7,
                    [
                        cause('Fatiga visual del inspector / Criterio no alineado',
                            'Ayudas Visuales y Muestras Límite (Boundary Samples). Descansos programados.',
                            'Inspección Visual 100% (Manual)', 7, 5, 7),
                    ]
                ),
            ]),
        ]),
        workElement('Material', 'Top Roll Ensamblado / Contenedor-Rack / Separadores-Bolsas / Etiqueta de Cliente', [
            func('Proteger producto contra daños durante almacenamiento y transporte', '', []),
        ]),
        workElement('Method', 'Método de Fabricación', [
            func('Utilizar la Hoja de Operaciones vigente.', '', []),
        ]),
        workElement('Environment', 'Iluminación estandarizada (> 1000 Lux)', [
            func('Proveer iluminación estandarizada sin sombras para detección de defectos cosméticos', '', []),
        ]),
    ],
};

// ══════════════════════════════════════════════════════════════════════════
// OPERATION 90 — EMPAQUE FINAL Y ETIQUETADO
// ══════════════════════════════════════════════════════════════════════════

const op90 = {
    id: uuid(),
    opNumber: '90',
    name: 'EMPAQUE FINAL Y ETIQUETADO DE PRODUCTO TERMINADO',
    focusElementFunction: 'EMPAQUE FINAL Y ETIQUETADO DE PRODUCTO TERMINADO',
    operationFunction: 'Preservar la calidad del producto terminado durante almacenamiento y transporte. Cantidad exacta por contenedor.',
    workElements: [
        workElement('Machine', 'Contenedor Estándar / Separadores / Sistema de Etiquetado', [
            func('Proveer protección física contra impactos, roces y deformaciones. Comunicar información de trazabilidad.', '', [
                failure('Piezas rayadas / Marcas de abrasión (Scuffing)',
                    'Reposición de piezas urgente', 'Rechazo en inspección de recibo o línea', 'Defecto estético visible en panel de puerta', 5,
                    [
                        cause('Separadores (Dunnage) dañados, sucios o con polvo excesivo',
                            'Plan de Limpieza de Contenedores: los contenedores se lavan/aspiran cada 5 vueltas',
                            'Inspección Visual de Contenedor: el operador revisa el estado del dunnage', 5, 5, 7),
                    ]
                ),
                failure('Etiqueta incorrecta / Piezas mezcladas (Mixed Parts)',
                    'Costos de sorteo en destino', 'Parada de línea de ensamble', 'Pieza incorrecta montada en vehículo', 7,
                    [
                        cause('Error humano en la selección de etiqueta: operador tomó etiqueta pre-impresa de otro lote',
                            'Impresión contra escaneo (Interlock): la impresora solo libera si el escáner leyó OK',
                            'Inspección Visual del Operador', 7, 5, 7),
                    ]
                ),
                failure('Cantidad incorrecta en el contenedor (Shortage)',
                    'Problemas en manejo de materiales', 'Retraso en entrega del vehículo por falta de piezas', 'N/A', 4,
                    [
                        cause('Distracción del operador / Interrupción del ciclo',
                            'Diseño del Contenedor (Poka-Yoke visual): nidos o espacios definidos',
                            'Inspección Visual final de Caja Llena', 4, 6, 3),
                    ]
                ),
            ]),
        ]),
        workElement('Man', 'Operador de Empaque / Líder de equipo', [
            func('Colocar piezas en contenedor siguiendo patrón de estiba definido', '', []),
        ]),
        workElement('Material', 'Top Roll Terminado / Contenedor / Separadores / Etiqueta / Bolsas Plásticas', [
            func('Proteger individualmente cada pieza contra rayaduras, polvo y contaminación', '', []),
        ]),
        workElement('Method', 'Método de Fabricación', [
            func('Utilizar la Hoja de Operaciones vigente.', '', []),
        ]),
        workElement('Environment', 'Iluminación/Ruido, Ley 19587', [
            func('Mantener condiciones de seguridad ocupacional según Ley 19587', '', []),
        ]),
    ],
};

// ═══════════════════════════════════════════════════════════════════════════
// ALL OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

const allOperations = [op5, op10, op11, op20, op30, op40, op50, op60, op70, op80, op90];

const amfeDoc = { header: amfeHeader, operations: allOperations };

// ═══════════════════════════════════════════════════════════════════════════
// PFD DOCUMENT — Parsed from Flujograma extract
// ═══════════════════════════════════════════════════════════════════════════

function pfdStep(stepNumber, stepType, description, extras = {}) {
    return {
        id: uuid(),
        stepNumber,
        stepType,
        description,
        machineDeviceTool: extras.machine || '',
        productCharacteristic: extras.productChar || '',
        productSpecialChar: extras.productSC || 'none',
        processCharacteristic: extras.processChar || '',
        processSpecialChar: extras.processSC || 'none',
        reference: extras.ref || '',
        department: extras.dept || '',
        notes: extras.notes || '',
        isRework: false,
        isExternalProcess: false,
        reworkReturnStep: '',
        rejectDisposition: extras.reject || 'none',
        scrapDescription: extras.scrapDesc || '',
        branchId: '',
        branchLabel: '',
    };
}

const pfdSteps = [
    pfdStep('REC', 'storage', 'Almacenado en sector de recepción de materia prima pendiente de control', { dept: 'Recepción' }),
    pfdStep('OP 5', 'combined', 'Recepción de materiales: Tabla de materiales. Inspección de materiales.', { machine: 'Autoelevador', dept: 'Recepción', reject: 'scrap', scrapDesc: 'Reclamo de calidad al proveedor', productChar: 'Tipo de producto, Color, Torres, Dimensional, Aspecto', productSC: 'SC' }),
    pfdStep('', 'storage', 'Almacenado en sector de recepción de materia prima controlada e identificada', { dept: 'Recepción' }),
    pfdStep('', 'transport', 'Traslado de materia prima al sector de inyección', { dept: 'Logística' }),
    pfdStep('OP 10', 'operation', 'Inyección de pieza plástica', { machine: 'Máquina inyectora de plástico', dept: 'Producción', reject: 'scrap', productChar: 'Dimensiones, Apariencia, Geometría', productSC: 'SC', processChar: 'Presión, Temperatura, Tiempo ciclo', processSC: 'SC' }),
    pfdStep('OP 20', 'operation', 'Adhesivado Hot Melt', { machine: 'Sistema de Fusión / Aplicación / Desenrollado', dept: 'Producción', reject: 'scrap', productChar: 'Adhesión, Peso vinilo', productSC: 'SC', processChar: 'Temperatura 190-210°C', processSC: 'SC' }),
    pfdStep('OP 30', 'operation', 'Proceso de IMG (Termoformado)', { machine: 'Estación de Calentamiento / Formado / Vacío', dept: 'Producción', reject: 'scrap', productChar: 'Textura, Espesor de pared, Geometría', productSC: 'CC', processChar: 'Temperatura horno, Presión vacío', processSC: 'SC' }),
    pfdStep('OP 40', 'operation', 'Trimming - Corte final', { machine: 'Hot Knife / Sistema Neumático / Fixture', dept: 'Producción', reject: 'scrap', productChar: 'Contorno de corte, Bordes', productSC: 'SC', processChar: 'Presión aire, Velocidad cuchilla', processSC: 'SC' }),
    pfdStep('OP 50', 'operation', 'Edge Folding - Soldado de refuerzos internos', { machine: 'Sist. Calentamiento / Plegado / Presión', dept: 'Producción', reject: 'scrap', productChar: 'Espesor borde, Arrugas', processChar: 'Presión cilindros, Posición en nido' }),
    pfdStep('OP 60', 'operation', 'Soldado de refuerzos internos', { machine: 'Soldadora Ultrasónica / Sonotrodo', dept: 'Producción', reject: 'scrap', productChar: 'Resistencia soldadura, Read-through', productSC: 'SC', processChar: 'Energía, Tiempo, Colapso' }),
    pfdStep('OP 70', 'operation', 'Soldado Tweeter', { machine: 'Soldadora Ultrasónica', dept: 'Producción', reject: 'scrap', productChar: 'Soldadura Tweeter, Read-through, Daño Tweeter', productSC: 'CC', processChar: 'Energía, Amplitud, Alineación sonotrodo', processSC: 'CC' }),
    pfdStep('', 'inspection', 'Inspección: Esta OK la pieza?', { dept: 'Calidad', reject: 'scrap' }),
    pfdStep('OP 80', 'combined', 'Inspección final', { machine: 'Checking Fixture / Escáner / Iluminación 1000 Lux', dept: 'Calidad', reject: 'scrap', productChar: 'Aspecto visual, Dimensiones, Trazabilidad', productSC: 'CC' }),
    pfdStep('OP 90', 'operation', 'Embalaje', { machine: 'Contenedor estándar / Separadores / Etiquetadora', dept: 'Logística', productChar: 'Cantidad, Identificación, Estado dunnage' }),
    pfdStep('', 'transport', 'Traslado de piezas al sector de producto terminado', { dept: 'Logística' }),
    pfdStep('', 'inspection', 'Control de las cantidades de despacho', { dept: 'Logística' }),
    pfdStep('ENV', 'storage', 'Almacenado en sector de producto terminado', { dept: 'Logística' }),
];

const pfdDoc = {
    id: uuid(),
    header: {
        partNumber: PART_NUMBER,
        partName: 'TOP ROLL FRONT DI - DD TAOS',
        engineeringChangeLevel: '',
        modelYear: 'PATAGONIA',
        documentNumber: 'PFD-TOPROLL-001',
        revisionLevel: '01',
        revisionDate: '2025-12-29',
        processPhase: 'production',
        companyName: 'Barack Mercosul',
        plantLocation: 'Hurlingham, Buenos Aires',
        supplierCode: '',
        customerName: 'VW Argentina',
        coreTeam: 'P. Gamboa, C. Baptista',
        keyContact: '',
        preparedBy: 'P. Gamboa',
        preparedDate: '2025-12-29',
        approvedBy: 'C. Baptista',
        approvedDate: '2025-12-29',
        applicableParts: '2GJ.868.087\n2GJ.868.088',
    },
    steps: pfdSteps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL PLAN — Generated from AMFE causes (AP=H or M)
// ═══════════════════════════════════════════════════════════════════════════

function generateControlPlan(amfeDocument) {
    const items = [];

    for (const op of amfeDocument.operations) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const sev = Number(fail.severity) || 0;
                    for (const c of (fail.causes || [])) {
                        if (c.ap !== 'H' && c.ap !== 'M') continue;

                        // Determine sample size/frequency based on AP and severity
                        let sampleSize, sampleFrequency, reactionPlan, reactionPlanOwner;
                        if (c.ap === 'H') {
                            sampleSize = '100%';
                            sampleFrequency = 'Cada pieza';
                        } else {
                            if (sev >= 9) { sampleSize = '5 piezas'; sampleFrequency = 'Cada hora'; }
                            else if (sev >= 7) { sampleSize = '5 piezas'; sampleFrequency = 'Cada 2 horas'; }
                            else { sampleSize = '3 piezas'; sampleFrequency = 'Cada turno'; }
                        }

                        if (sev >= 9) {
                            reactionPlan = 'Detener línea. Segregar producto sospechoso. Escalar a Gerencia de Calidad. Contener lote completo.';
                            reactionPlanOwner = 'Líder de Producción / Calidad';
                        } else if (sev >= 7) {
                            reactionPlan = 'Contener producto sospechoso. Verificar últimas N piezas. Ajustar proceso. Notificar a Líder.';
                            reactionPlanOwner = 'Líder de Producción';
                        } else {
                            reactionPlan = 'Ajustar proceso. Reinspeccionar último lote. Registrar desvío.';
                            reactionPlanOwner = 'Operador de Producción';
                        }

                        const autoSpecialChar = c.specialChar || (sev >= 9 ? 'CC' : sev >= 5 ? 'SC' : '');

                        // PROCESS row
                        items.push({
                            id: uuid(),
                            processStepNumber: op.opNumber,
                            processDescription: op.name,
                            machineDeviceTool: we.name || '',
                            characteristicNumber: c.characteristicNumber || '',
                            productCharacteristic: '',
                            processCharacteristic: c.cause || '',
                            specialCharClass: autoSpecialChar,
                            specification: c.preventionControl ? 'Según instrucción de proceso' : '',
                            evaluationTechnique: c.detectionControl ? 'Verificación operativa' : '',
                            sampleSize,
                            sampleFrequency,
                            controlMethod: c.preventionControl || '',
                            reactionPlan,
                            reactionPlanOwner,
                            controlProcedure: `P-09/I. Según HO-${op.opNumber}`,
                            autoFilledFields: [],
                            amfeAp: c.ap,
                            amfeSeverity: sev,
                            operationCategory: inferOpCategory(op.name),
                            amfeCauseIds: [c.id],
                            amfeFailureId: fail.id,
                            amfeFailureIds: [fail.id],
                        });

                        // PRODUCT row
                        items.push({
                            id: uuid(),
                            processStepNumber: op.opNumber,
                            processDescription: op.name,
                            machineDeviceTool: we.name || '',
                            characteristicNumber: c.characteristicNumber || '',
                            productCharacteristic: fail.description || '',
                            processCharacteristic: '',
                            specialCharClass: autoSpecialChar,
                            specification: 'Conforme a especificación de proceso',
                            evaluationTechnique: c.detectionControl || '',
                            sampleSize,
                            sampleFrequency,
                            controlMethod: '',
                            reactionPlan,
                            reactionPlanOwner,
                            controlProcedure: `P-09/I. Según HO-${op.opNumber}`,
                            autoFilledFields: [],
                            amfeAp: c.ap,
                            amfeSeverity: sev,
                            operationCategory: inferOpCategory(op.name),
                            amfeCauseIds: [c.id],
                            amfeFailureId: fail.id,
                            amfeFailureIds: [fail.id],
                        });
                    }
                }
            }
        }
    }

    // Add manual CP items from Control Plan reference document
    items.push(
        // Recepcion: material controls from CP reference
        {
            id: uuid(), processStepNumber: '5', processDescription: 'RECEPCIONAR MATERIA PRIMA',
            machineDeviceTool: 'Patrón de Aspecto / Balanza', characteristicNumber: '',
            productCharacteristic: 'Tipo de Producto, Color, Torres de sujeción, Aspecto',
            processCharacteristic: '', specialCharClass: 'SC',
            specification: 'Según patrón de aspecto y certificado del proveedor',
            evaluationTechnique: 'Visual / Certificado proveedor', sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
            controlMethod: 'P-10/I. Recepción de materiales. P-14.', reactionPlan: 'Rechazar material no conforme. Notificar a Calidad.',
            reactionPlanOwner: 'Operador de Producción / Calidad', controlProcedure: 'P-10/I, P-14',
            autoFilledFields: [], amfeAp: 'M', amfeSeverity: 8, operationCategory: 'recepcion',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Recepcion: Flamabilidad SC
        {
            id: uuid(), processStepNumber: '5', processDescription: 'RECEPCIONAR MATERIA PRIMA',
            machineDeviceTool: 'Certificado del proveedor', characteristicNumber: '',
            productCharacteristic: 'Flamabilidad', processCharacteristic: '', specialCharClass: 'SC',
            specification: '<100 mm/min', evaluationTechnique: 'Certificado del proveedor',
            sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
            controlMethod: 'P-10/I. Recepción de materiales. P-14.', reactionPlan: 'Rechazar lote. Notificar a Calidad.',
            reactionPlanOwner: 'Calidad', controlProcedure: 'P-10/I, P-14',
            autoFilledFields: [], amfeAp: 'H', amfeSeverity: 9, operationCategory: 'recepcion',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 10: Set-up de Máquina
        {
            id: uuid(), processStepNumber: '10', processDescription: 'INYECCIÓN DE PIEZAS PLÁSTICAS',
            machineDeviceTool: 'Mesa de corte automática', characteristicNumber: '',
            productCharacteristic: '', processCharacteristic: 'Set up de Máquina (según programa)',
            specialCharClass: '', specification: 'Según hoja de set-up',
            evaluationTechnique: 'Control visual', sampleSize: '1 Control', sampleFrequency: 'Inicio de turno y después de cada intervención mecánica',
            controlMethod: 'Hoja de set-up', reactionPlan: 'No iniciar producción hasta corregir parámetros.',
            reactionPlanOwner: 'Operador de producción', controlProcedure: 'P-09/I',
            autoFilledFields: [], amfeAp: 'M', amfeSeverity: 8, operationCategory: 'inyeccion',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 20: Adhesivado set-up
        {
            id: uuid(), processStepNumber: '20', processDescription: 'ADHESIVADO HOT MELT',
            machineDeviceTool: 'Sistema de Fusión', characteristicNumber: '',
            productCharacteristic: '', processCharacteristic: 'Adhesivo en buen estado (>6 meses posteriores a fecha de recepción)',
            specialCharClass: '', specification: '>6 meses posteriores a fecha de recepción',
            evaluationTechnique: 'Visual / Certificado', sampleSize: '100%', sampleFrequency: 'Por lote',
            controlMethod: 'Autocontrol', reactionPlan: 'Rechazar adhesivo vencido.',
            reactionPlanOwner: 'Operador de producción', controlProcedure: 'P-09/I',
            autoFilledFields: [], amfeAp: 'M', amfeSeverity: 8, operationCategory: 'adhesivado',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 30: Tapizado semi-automático
        {
            id: uuid(), processStepNumber: '30', processDescription: 'PROCESO DE IMG',
            machineDeviceTool: 'Estación de Formado', characteristicNumber: '',
            productCharacteristic: 'Tapizado sin arrugas, sin marcas, adherencia correcta',
            processCharacteristic: '', specialCharClass: 'SC',
            specification: 'Según patrón visual', evaluationTechnique: 'Control visual / Muestra patrón',
            sampleSize: '100%', sampleFrequency: 'Por lote', controlMethod: 'Autocontrol',
            reactionPlan: 'Segregar pieza NC. Ajustar parámetros de proceso.',
            reactionPlanOwner: 'Operador de producción', controlProcedure: 'P-09/I',
            autoFilledFields: [], amfeAp: 'H', amfeSeverity: 10, operationCategory: 'tapizado',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 40: Virolado + Refilado
        {
            id: uuid(), processStepNumber: '40', processDescription: 'TRIMMING CORTE FINAL',
            machineDeviceTool: 'Calibre de control', characteristicNumber: '',
            productCharacteristic: 'Control dimensional de piezas tapizadas',
            processCharacteristic: '', specialCharClass: 'SC',
            specification: 'Según Myler de control', evaluationTechnique: 'Calibre de control',
            sampleSize: '5 piezas por lote', sampleFrequency: 'Por lote de inyección',
            controlMethod: 'Según Instructivo medición de calibre', reactionPlan: 'Segregar. Verificar cuchilla. Ajustar.',
            reactionPlanOwner: 'Metrología', controlProcedure: 'P-09/I',
            autoFilledFields: [], amfeAp: 'H', amfeSeverity: 8, operationCategory: 'corte',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 80: Inspección final
        {
            id: uuid(), processStepNumber: '80', processDescription: 'INSPECCIÓN FINAL Y EMPAQUE',
            machineDeviceTool: 'Puesto de inspección', characteristicNumber: '',
            productCharacteristic: 'Apariencia sin despegues, cortes, terminación soldadura OK, sin manchas',
            processCharacteristic: '', specialCharClass: 'CC',
            specification: 'Sin defectos visuales según criterio de aceptación',
            evaluationTechnique: 'Visual', sampleSize: '100%', sampleFrequency: 'Por lote',
            controlMethod: 'Autocontrol', reactionPlan: 'Segregar pieza NC. Contener lote. Notificar a Calidad.',
            reactionPlanOwner: 'Operador de producción / Calidad', controlProcedure: 'P-09/I',
            autoFilledFields: [], amfeAp: 'H', amfeSeverity: 10, operationCategory: 'inspeccion',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 90: Embalaje - Identificación y cantidad
        {
            id: uuid(), processStepNumber: '90', processDescription: 'EMPAQUE FINAL Y ETIQUETADO',
            machineDeviceTool: 'Contenedor / Etiquetadora', characteristicNumber: '',
            productCharacteristic: 'Identificación correcta, Cantidad 8 piezas por cajón en bolsa',
            processCharacteristic: '', specialCharClass: '',
            specification: 'Identificación según código, Cantidad = 8 piezas por medio',
            evaluationTechnique: 'Visual', sampleSize: '100%', sampleFrequency: 'Por turno',
            controlMethod: 'Autocontrol', reactionPlan: 'Corregir identificación. Verificar cantidad.',
            reactionPlanOwner: 'Operador de logística', controlProcedure: 'P-09/I',
            autoFilledFields: [], amfeAp: 'M', amfeSeverity: 7, operationCategory: 'embalaje',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
    );

    // Sort by operation number
    items.sort((a, b) => {
        const na = parseInt(a.processStepNumber) || 0;
        const nb = parseInt(b.processStepNumber) || 0;
        return na - nb;
    });

    return items;
}

const cpHeader = {
    controlPlanNumber: 'CP-TOPROLL-001',
    phase: 'production',
    partNumber: PART_NUMBER,
    latestChangeLevel: '01',
    partName: 'TOP ROLL FRONT DI - DD TAOS',
    applicableParts: '2GJ.868.087\n2GJ.868.088',
    organization: 'BARACK MERCOSUL',
    supplier: '',
    supplierCode: '',
    keyContactPhone: '',
    date: '2025-02-25',
    revision: '0',
    responsible: 'M. Nieve',
    approvedBy: 'M. Meszaros / P. Centurion / L. Lattanzi',
    client: 'VWA',
    coreTeam: 'M. Nieve / M. Meszaros / P. Centurion / L. Lattanzi',
    customerEngApproval: '',
    customerQualityApproval: '',
    otherApproval: '',
    linkedAmfeProject: PROJECT_NAME,
};

const cpItems = generateControlPlan(amfeDoc);
const cpDoc = { header: cpHeader, items: cpItems };

// ═══════════════════════════════════════════════════════════════════════════
// HO DOCUMENT — Stubs for each AMFE operation
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_REACTION_PLAN =
    'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME:\n' +
    'DETENGA LA OPERACION\n' +
    'NOTIFIQUE DE INMEDIATO A SU LIDER O SUPERVISOR\n' +
    'ESPERE LA DEFINICION DEL LIDER O SUPERVISOR';

function createHoSheet(op) {
    // Default PPE for all ops
    const defaultPpe = ['anteojos', 'guantes', 'zapatos'];
    // Add hearing protection for ultrasonic welding ops
    const ppeForOp = (op.opNumber === '60' || op.opNumber === '70')
        ? [...defaultPpe, 'proteccionAuditiva']
        : defaultPpe;

    return {
        id: uuid(),
        amfeOperationId: op.id,
        operationNumber: op.opNumber,
        operationName: op.name,
        hoNumber: `HO-TR-${op.opNumber}`,
        sector: 'Producción',
        puestoNumber: '',
        vehicleModel: 'PATAGONIA',
        partCodeDescription: 'TOP ROLL 2GJ.868.087 / 2GJ.868.088',
        safetyElements: ppeForOp,
        hazardWarnings: [],
        steps: [
            {
                id: uuid(),
                stepNumber: 1,
                description: `Ejecutar operación ${op.opNumber}: ${op.name}`,
                isKeyPoint: false,
                keyPointReason: '',
            },
        ],
        qualityChecks: [],
        reactionPlanText: DEFAULT_REACTION_PLAN,
        reactionContact: 'Líder de Producción / Calidad',
        visualAids: [],
        preparedBy: '',
        approvedBy: '',
        date: '2026-02-13',
        revision: 'A',
        status: 'borrador',
    };
}

const hoSheets = allOperations.map(op => createHoSheet(op));

const hoDoc = {
    header: {
        formNumber: 'I-IN-002.4-R01',
        organization: 'BARACK MERCOSUL',
        client: 'VWA',
        partNumber: 'TOP ROLL',
        partDescription: 'TOP ROLL FRONT DI - DD TAOS',
        applicableParts: '2GJ.868.087\n2GJ.868.088',
        linkedAmfeProject: PROJECT_NAME,
        linkedCpProject: PROJECT_NAME,
    },
    sheets: hoSheets,
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — Statistics
// ═══════════════════════════════════════════════════════════════════════════

function countCauses(operations) {
    let total = 0, apH = 0, apM = 0, apL = 0;
    for (const op of operations)
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        total++;
                        if (c.ap === 'H') apH++;
                        else if (c.ap === 'M') apM++;
                        else apL++;
                    }
    return { total, apH, apM, apL };
}

function calcCoverage(operations) {
    let total = 0, covered = 0;
    for (const op of operations)
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        total++;
                        if ((c.preventionControl && c.preventionControl !== '-' && c.preventionControl !== 'N/A') ||
                            (c.detectionControl && c.detectionControl !== '-' && c.detectionControl !== 'N/A'))
                            covered++;
                    }
    return total > 0 ? Math.round((covered / total) * 10000) / 100 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SEED: TOP ROLL PATAGONIA (VWA)');
    console.log('  AMFE + PFD + CP + HO + FAMILIA');
    console.log('═══════════════════════════════════════════════════════════════');

    // ── 0. Connect ────────────────────────────────────────────────────────
    await initSupabase();

    // ── 1. Stats ──────────────────────────────────────────────────────────
    const { total: causeCount, apH, apM, apL } = countCauses(allOperations);
    const coverage = calcCoverage(allOperations);

    console.log(`\n── AMFE ──`);
    console.log(`  Operations: ${allOperations.length}`);
    console.log(`  Causes: ${causeCount} (H=${apH}, M=${apM}, L=${apL})`);
    console.log(`  Coverage: ${coverage}%`);

    console.log(`\n── PFD ──`);
    console.log(`  Steps: ${pfdSteps.length}`);

    console.log(`\n── CONTROL PLAN ──`);
    console.log(`  Items: ${cpItems.length}`);

    console.log(`\n── HO ──`);
    console.log(`  Sheets: ${hoSheets.length}`);

    // ═══════════════════════════════════════════════════════════════════════
    // DATABASE INSERTS
    // ═══════════════════════════════════════════════════════════════════════

    console.log(`\n── INSERTING INTO SUPABASE ──`);

    // ── AMFE ──────────────────────────────────────────────────────────────
    const amfeId = uuid();
    const amfeDataJson = JSON.stringify(amfeDoc);
    const amfeChecksum = sha256(amfeDataJson);

    const existingAmfe = await selectSql(
        `SELECT id FROM amfe_documents WHERE project_name = ?`, [PROJECT_NAME]
    );

    if (existingAmfe.length > 0) {
        const existId = existingAmfe[0].id;
        await execSql(`UPDATE amfe_documents SET
            data = ?, checksum = ?, updated_at = datetime('now'),
            project_name = ?, operation_count = ?, cause_count = ?,
            ap_h_count = ?, ap_m_count = ?, coverage_percent = ?,
            last_revision_date = ?, part_number = ?, subject = ?, client = ?
            WHERE id = ?`,
            [amfeDataJson, amfeChecksum, PROJECT_NAME,
             allOperations.length, causeCount, apH, apM,
             coverage, '2026-02-13', PART_NUMBER, 'TOP ROLL', 'VWA', existId]);
        console.log(`  + AMFE updated (ID: ${existId})`);
    } else {
        await execSql(`INSERT INTO amfe_documents (
            id, amfe_number, project_name, subject, client, part_number,
            responsible, organization, status,
            operation_count, cause_count, ap_h_count, ap_m_count, coverage_percent,
            start_date, last_revision_date, data, checksum)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [amfeId, 'AMFE-TOPROLL-001', PROJECT_NAME, 'TOP ROLL', 'VWA', PART_NUMBER,
             'Carlos Baptista', 'BARACK MERCOSUL', 'draft',
             allOperations.length, causeCount, apH, apM, coverage,
             '2026-02-13', '2026-02-13', amfeDataJson, amfeChecksum]);
        console.log(`  + AMFE inserted: AMFE-TOPROLL-001`);
    }

    // Get the actual AMFE ID for linking
    const amfeRows = await selectSql(`SELECT id FROM amfe_documents WHERE project_name = ?`, [PROJECT_NAME]);
    const finalAmfeId = amfeRows[0]?.id || amfeId;

    // ── PFD ───────────────────────────────────────────────────────────────
    const pfdDataJson = JSON.stringify(pfdDoc);
    const pfdChecksum = sha256(pfdDataJson);

    const existingPfd = await selectSql(
        `SELECT id FROM pfd_documents WHERE part_name = 'TOP ROLL FRONT DI - DD TAOS'`
    );

    if (existingPfd.length > 0) {
        const existPfdId = existingPfd[0].id;
        await execSql(`UPDATE pfd_documents SET
            data = ?, checksum = ?, updated_at = datetime('now'),
            step_count = ?, revision_level = ?, revision_date = ?
            WHERE id = ?`,
            [pfdDataJson, pfdChecksum, pfdSteps.length, '01', '2025-12-29', existPfdId]);
        console.log(`  + PFD updated (ID: ${existPfdId})`);
    } else {
        await execSql(`INSERT INTO pfd_documents (
            id, part_number, part_name, document_number, revision_level,
            revision_date, customer_name, step_count, data, checksum)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pfdDoc.id, PART_NUMBER, 'TOP ROLL FRONT DI - DD TAOS', 'PFD-TOPROLL-001',
             '01', '2025-12-29', 'VW Argentina',
             pfdSteps.length, pfdDataJson, pfdChecksum]);
        console.log(`  + PFD inserted: PFD-TOPROLL-001`);
    }

    const pfdRows = await selectSql(`SELECT id FROM pfd_documents WHERE part_name = 'TOP ROLL FRONT DI - DD TAOS'`);
    const finalPfdId = pfdRows[0]?.id || pfdDoc.id;

    // ── CONTROL PLAN ─────────────────────────────────────────────────────
    const cpId = uuid();
    const cpDataJson = JSON.stringify(cpDoc);
    const cpChecksum = sha256(cpDataJson);

    const existingCp = await selectSql(
        `SELECT id FROM cp_documents WHERE project_name = ?`, [PROJECT_NAME]
    );

    if (existingCp.length > 0) {
        const existCpId = existingCp[0].id;
        await execSql(`UPDATE cp_documents SET
            data = ?, checksum = ?, updated_at = datetime('now'),
            item_count = ?, phase = ?, revision = ?, part_number = ?
            WHERE id = ?`,
            [cpDataJson, cpChecksum, cpItems.length, 'production', '0', PART_NUMBER, existCpId]);
        console.log(`  + CP updated (ID: ${existCpId})`);
    } else {
        await execSql(`INSERT INTO cp_documents (
            id, project_name, control_plan_number, phase,
            part_number, part_name, organization, client,
            responsible, revision, linked_amfe_project, linked_amfe_id,
            item_count, data, checksum)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [cpId, PROJECT_NAME, 'CP-TOPROLL-001', 'production',
             PART_NUMBER, 'TOP ROLL FRONT DI - DD TAOS', 'BARACK MERCOSUL', 'VWA',
             'M. Nieve', '0', PROJECT_NAME, finalAmfeId,
             cpItems.length, cpDataJson, cpChecksum]);
        console.log(`  + CP inserted: CP-TOPROLL-001 (${cpItems.length} items)`);
    }

    const cpRows = await selectSql(`SELECT id FROM cp_documents WHERE project_name = ?`, [PROJECT_NAME]);
    const finalCpId = cpRows[0]?.id || cpId;

    // ── HO ────────────────────────────────────────────────────────────────
    const hoId = uuid();
    const hoDataJson = JSON.stringify(hoDoc);
    const hoChecksum = sha256(hoDataJson);

    const existingHo = await selectSql(
        `SELECT id FROM ho_documents WHERE linked_amfe_project = ?`, [PROJECT_NAME]
    );

    if (existingHo.length > 0) {
        const existHoId = existingHo[0].id;
        await execSql(`UPDATE ho_documents SET
            data = ?, checksum = ?, updated_at = datetime('now'),
            sheet_count = ?, part_number = ?, part_description = ?
            WHERE id = ?`,
            [hoDataJson, hoChecksum, hoSheets.length, 'TOP ROLL', 'TOP ROLL FRONT DI - DD TAOS', existHoId]);
        console.log(`  + HO updated (ID: ${existHoId})`);
    } else {
        await execSql(`INSERT INTO ho_documents (
            id, form_number, organization, client,
            part_number, part_description,
            linked_amfe_project, linked_cp_project,
            sheet_count, data, checksum)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [hoId, 'I-IN-002.4-R01', 'BARACK MERCOSUL', 'VWA',
             'TOP ROLL', 'TOP ROLL FRONT DI - DD TAOS',
             PROJECT_NAME, PROJECT_NAME,
             hoSheets.length, hoDataJson, hoChecksum]);
        console.log(`  + HO inserted: HO (${hoSheets.length} sheets)`);
    }

    const hoRows = await selectSql(`SELECT id FROM ho_documents WHERE linked_amfe_project = ?`, [PROJECT_NAME]);
    const finalHoId = hoRows[0]?.id || hoId;

    // ── PRODUCT FAMILY ───────────────────────────────────────────────────
    console.log(`\n── CREATING FAMILY ──`);

    const FAMILY_NAME = 'Top Roll Patagonia';
    const FAMILY_LINE = 'VWA';

    // Ensure customer line exists
    await execSql(`INSERT OR IGNORE INTO customer_lines (code, name, product_count, is_automotive)
        VALUES (?, ?, ?, ?)`, ['095', '095 VOLKSWAGEN', 2, 1]);

    // Check existing family
    const existFam = await selectSql(`SELECT id FROM product_families WHERE name = ?`, [FAMILY_NAME]);
    let familyId;

    if (existFam.length > 0) {
        familyId = existFam[0].id;
        console.log(`  + Family "${FAMILY_NAME}" already exists (ID: ${familyId})`);
    } else {
        const famResult = await execSql(
            `INSERT INTO product_families (name, description, linea_code, linea_name)
            VALUES (?, ?, ?, ?)`,
            [FAMILY_NAME, 'Top Roll Front para plataforma Patagonia VW', FAMILY_LINE, 'Volkswagen Argentina']);
        familyId = famResult.lastInsertId;
        console.log(`  + Family created: "${FAMILY_NAME}" (ID: ${familyId})`);
    }

    // Insert products
    const productCodes = [
        { codigo: '2GJ.868.087', descripcion: 'TOP ROLL FRONT DI TAOS' },
        { codigo: '2GJ.868.088', descripcion: 'TOP ROLL FRONT DD TAOS' },
    ];

    for (const prod of productCodes) {
        await execSql(
            `INSERT OR IGNORE INTO products (codigo, descripcion, linea_code, linea_name)
            VALUES (?, ?, ?, ?)`,
            [prod.codigo, prod.descripcion, '095', '095 VOLKSWAGEN']);

        const prodResult = await selectSql(
            `SELECT id FROM products WHERE codigo = ? AND linea_code = ?`,
            [prod.codigo, '095']
        );
        if (prodResult.length > 0) {
            const isPrimary = prod.codigo === '2GJ.868.087' ? 1 : 0;
            await execSql(
                `INSERT OR IGNORE INTO product_family_members (family_id, product_id, is_primary)
                VALUES (?, ?, ?)`,
                [familyId, prodResult[0].id, isPrimary]);
        }
    }
    console.log(`  + Products linked: ${productCodes.map(p => p.codigo).join(', ')}`);

    // Link documents to family
    const docLinks = [
        { module: 'amfe', documentId: finalAmfeId, label: 'AMFE' },
        { module: 'pfd', documentId: finalPfdId, label: 'PFD' },
        { module: 'cp', documentId: finalCpId, label: 'CP' },
        { module: 'ho', documentId: finalHoId, label: 'HO' },
    ];

    for (const link of docLinks) {
        const existing = await selectSql(
            `SELECT id FROM family_documents WHERE family_id = ? AND module = ? AND document_id = ?`,
            [familyId, link.module, link.documentId]
        );

        if (existing.length > 0) {
            console.log(`  + ${link.label}: Already linked (family_doc_id=${existing[0].id})`);
        } else {
            const result = await execSql(
                `INSERT INTO family_documents (family_id, module, document_id, is_master, source_master_id, product_id)
                 VALUES (?, ?, ?, 1, NULL, NULL) RETURNING id`,
                [familyId, link.module, link.documentId]);
            console.log(`  + ${link.label}: Linked as master (family_doc_id=${result.lastInsertId})`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n── VERIFICATION ──');

    const amfeCheck = await selectSql(
        `SELECT id, amfe_number, project_name, operation_count, cause_count, ap_h_count, ap_m_count, coverage_percent
         FROM amfe_documents WHERE project_name = ?`, [PROJECT_NAME]);
    console.log(`  AMFE: ${amfeCheck.length} document(s)`);
    if (amfeCheck[0]) {
        const a = amfeCheck[0];
        console.log(`    ID: ${a.id}`);
        console.log(`    Number: ${a.amfe_number}`);
        console.log(`    Ops: ${a.operation_count}, Causes: ${a.cause_count} (H=${a.ap_h_count}, M=${a.ap_m_count})`);
        console.log(`    Coverage: ${a.coverage_percent}%`);
    }

    const pfdCheck = await selectSql(
        `SELECT id, part_name, step_count
         FROM pfd_documents WHERE part_name = 'TOP ROLL FRONT DI - DD TAOS'`);
    console.log(`  PFD: ${pfdCheck.length} document(s)`);
    if (pfdCheck[0]) {
        const p = pfdCheck[0];
        console.log(`    ID: ${p.id}`);
        console.log(`    Steps: ${p.step_count}`);
    }

    const cpCheck = await selectSql(
        `SELECT id, control_plan_number, item_count, phase
         FROM cp_documents WHERE project_name = ?`, [PROJECT_NAME]);
    console.log(`  CP: ${cpCheck.length} document(s)`);
    if (cpCheck[0]) {
        const c = cpCheck[0];
        console.log(`    ID: ${c.id}`);
        console.log(`    Number: ${c.control_plan_number}, Items: ${c.item_count}, Phase: ${c.phase}`);
    }

    const hoCheck = await selectSql(
        `SELECT id, sheet_count
         FROM ho_documents WHERE linked_amfe_project = ?`, [PROJECT_NAME]);
    console.log(`  HO: ${hoCheck.length} document(s)`);
    if (hoCheck[0]) {
        const h = hoCheck[0];
        console.log(`    ID: ${h.id}`);
        console.log(`    Sheets: ${h.sheet_count}`);
    }

    const famCheck = await selectSql(
        `SELECT pf.id, pf.name, pf.description
         FROM product_families pf WHERE pf.name = ?`, [FAMILY_NAME]);
    console.log(`  Family: ${famCheck.length}`);
    if (famCheck[0]) {
        console.log(`    "${famCheck[0].name}": ${famCheck[0].description}`);
    }

    const famDocCheck = await selectSql(
        `SELECT fd.module, fd.document_id, fd.is_master
         FROM family_documents fd
         JOIN product_families pf ON pf.id = fd.family_id
         WHERE pf.name = ?
         ORDER BY fd.module`, [FAMILY_NAME]);
    console.log(`  Family docs: ${famDocCheck.length}`);
    for (const fd of famDocCheck) {
        const role = fd.is_master ? 'MASTER' : 'VARIANT';
        console.log(`    [${fd.module.toUpperCase().padEnd(4)}] ${role} doc=${fd.document_id}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  SEED COMPLETO — TOP ROLL PATAGONIA (VWA)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  AMFE: ${allOperations.length} operaciones, ${causeCount} causas (H=${apH}, M=${apM}, L=${apL})`);
    console.log(`  PFD:  ${pfdSteps.length} pasos`);
    console.log(`  CP:   ${cpItems.length} items`);
    console.log(`  HO:   ${hoSheets.length} hojas`);
    console.log(`  FAM:  "${FAMILY_NAME}" con ${productCodes.length} productos`);
    console.log('═══════════════════════════════════════════════════════════════');

    close();
}

main().catch(err => {
    console.error('\nERROR:', err);
    close();
    process.exit(1);
});
