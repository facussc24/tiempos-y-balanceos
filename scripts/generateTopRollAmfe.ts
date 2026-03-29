/**
 * Script: Generate AMFE TOP ROLL JSON
 *
 * Transcribes the AMFE_TOP ROLL_Rev.pdf into a valid AmfeDocument JSON file
 * that can be imported via the AMFE module's "Import JSON" feature.
 *
 * Run: npx tsx scripts/generateTopRollAmfe.ts
 * Output: scripts/output/AMFE TOP ROLL.json
 */

import { v4 as uuidv4 } from 'uuid';
import { calculateAP } from '../modules/amfe/apTable';
import { validateAmfeDocument } from '../modules/amfe/amfeValidation';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Types (duplicated minimally to avoid Tauri imports)
// ============================================================================

type WorkElementType = 'Machine' | 'Man' | 'Material' | 'Method' | 'Environment' | 'Measurement';

interface AmfeCause {
    id: string;
    cause: string;
    preventionControl: string;
    detectionControl: string;
    occurrence: number | string;
    detection: number | string;
    ap: string;
    characteristicNumber: string;
    specialChar: string;
    filterCode: string;
    preventionAction: string;
    detectionAction: string;
    responsible: string;
    targetDate: string;
    status: string;
    actionTaken: string;
    completionDate: string;
    severityNew: number | string;
    occurrenceNew: number | string;
    detectionNew: number | string;
    apNew: string;
    observations: string;
}

interface AmfeFailure {
    id: string;
    description: string;
    effectLocal: string;
    effectNextLevel: string;
    effectEndUser: string;
    severity: number | string;
    causes: AmfeCause[];
}

interface AmfeFunction {
    id: string;
    description: string;
    requirements: string;
    failures: AmfeFailure[];
}

interface AmfeWorkElement {
    id: string;
    type: WorkElementType;
    name: string;
    functions: AmfeFunction[];
}

interface AmfeOperation {
    id: string;
    opNumber: string;
    name: string;
    workElements: AmfeWorkElement[];
}

interface AmfeDocument {
    header: Record<string, string>;
    operations: AmfeOperation[];
}

// ============================================================================
// Helper constructors
// ============================================================================

function makeOp(opNumber: string, name: string, workElements: AmfeWorkElement[]): AmfeOperation {
    return { id: uuidv4(), opNumber, name, workElements };
}

function makeWe(type: WorkElementType, name: string, functions: AmfeFunction[]): AmfeWorkElement {
    return { id: uuidv4(), type, name, functions };
}

function makeFunc(description: string, requirements: string, failures: AmfeFailure[]): AmfeFunction {
    return { id: uuidv4(), description, requirements, failures };
}

function makeFail(
    desc: string,
    effectLocal: string,
    effectNext: string,
    effectEnd: string,
    severity: number,
    causes: AmfeCause[]
): AmfeFailure {
    return {
        id: uuidv4(),
        description: desc,
        effectLocal,
        effectNextLevel: effectNext,
        effectEndUser: effectEnd,
        severity,
        causes,
    };
}

function makeCause(
    cause: string,
    pc: string,
    dc: string,
    o: number,
    d: number,
    severity: number,
    specialChar: string = ''
): AmfeCause {
    return {
        id: uuidv4(),
        cause,
        preventionControl: pc,
        detectionControl: dc,
        occurrence: o,
        detection: d,
        ap: calculateAP(severity, o, d),
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

// ============================================================================
// Header
// ============================================================================

const header = {
    organization: 'BARACK MERCOSUL',
    location: 'PLANTA HURLINGHAM',
    client: 'VWA',
    modelYear: 'PATAGONIA',
    subject: 'TOP ROLL',
    startDate: '13/2/2026',
    revDate: '13/2/2026',
    team: 'Carlos Baptista Ingenieria, Manuel Meszaros Calidad, Cristina Rabago Seguridad e higiene, Marianna Vera Produccion',
    amfeNumber: '-',
    responsible: 'Carlos Baptista',
    confidentiality: '-',
    partNumber: '',
    processResponsible: 'Carlos Baptista Ingenieria',
    revision: '',
    approvedBy: '',
    scope: '',
};

// ============================================================================
// OP 5 — RECEPCION DE MATERIA PRIMA
// ============================================================================

const OP5 = makeOp('5', 'Recepcion de materia prima', [
    // -- Machine: Autoelevador --
    makeWe('Machine', 'Autoelevador', [
        makeFunc(
            'Asegurar la estabilidad y la integridad fisica del material durante el transporte interno',
            '',
            [
                makeFail(
                    'Mala estiba y embalaje inadecuado',
                    'Riesgo de reproceso o scrap; paro de linea si no hay stock',
                    '',
                    '',
                    6,
                    [
                        makeCause(
                            'Mala estiba y embalaje inadecuado',
                            'Medios de embalaje validados',
                            'Inspeccion visual en recepcion',
                            6, 6, 6, 'SC'
                        ),
                    ]
                ),
            ]
        ),
    ]),

    // -- Man: Operador de produccion, Operador de calidad, Lider de equipo --
    makeWe('Man', 'Operador de produccion / Operador de calidad / Lider de equipo', [
        makeFunc(
            'Asegurar la conformidad de la calidad y cantidad de material recibido. Verificar el cumplimiento y la trazabilidad de la materia prima',
            '',
            [
                // FM1: Material/pieza golpeada o danada durante transporte
                makeFail(
                    'Material / pieza golpeada o danada durante transporte',
                    'Montaje con ajuste forzado/imposibilidad de ensamblar',
                    '',
                    'Posible ruido o falla estetica',
                    7,
                    [
                        makeCause(
                            'Manipulacion incorrecta en transito',
                            'Existencia de instrucciones de trabajo que definen como debe estibarse y manipularse el material',
                            'Verificacion del estado del embalaje antes de que el camion salga o inmediatamente cuando llega a su destino',
                            5, 6, 7, 'SC'
                        ),
                    ]
                ),

                // FM2: Falta de documentacion o trazabilidad
                makeFail(
                    'Falta de documentacion o trazabilidad',
                    'Dificultades en trazabilidad si surge un reclamo',
                    '',
                    'No afecta',
                    6,
                    [
                        makeCause(
                            'Proveedor sin sistema robusto de trazabilidad',
                            'Auditorias de Sistema y Requisitos que validan la capacidad de trazabilidad del proveedor antes de su aprobacion',
                            'Verificacion del Certificado de Conformidad y registro obligatorio de lote en el sistema de recepcion antes de la aceptacion de la materia prima',
                            1, 6, 6
                        ),
                    ]
                ),
            ]
        ),
        makeFunc(
            'Comprobar que el embalaje no este danado. Corroborar que la orden sea la correcta. Cargar la materia prima en ARB',
            '',
            [
                // FM: Riesgo de mezclar lotes no conformes
                makeFail(
                    'Riesgo de mezclar lotes no conformes',
                    'Riesgo de mezclar lotes no conformes',
                    '',
                    '',
                    7,
                    [
                        makeCause(
                            'Falta de inspeccion visual al recibir material',
                            'Recepcion que exige la verificacion fisica y visual del material',
                            'Inspeccion visual en recepcion',
                            5, 6, 7
                        ),
                        makeCause(
                            'Procesos administrativos deficientes',
                            'El sistema ARB obliga a registrar lote y codigo en recepcion y verifica contra base de datos',
                            'Verificacion automatica del lote/codigo registrado contra la base de datos',
                            3, 4, 7
                        ),
                    ]
                ),

                // FM: No se utiliza el sistema ARB
                makeFail(
                    'No se utiliza el sistema ARB',
                    '',
                    '',
                    '',
                    6,
                    [
                        makeCause(
                            'No se utiliza el sistema ARB',
                            'Procedimiento Operacional Estandar que exige y documenta la obligatoriedad del uso del sistema ARB',
                            'El sistema impide la emision de ubicaciones o el registro de entrada del material hasta que todos los campos del ARB sean completados',
                            4, 4, 6, 'SC'
                        ),
                    ]
                ),

                // FM: Material con especificacion erronea
                makeFail(
                    'Material con especificacion erronea (dimensiones, color, dureza, etc.)',
                    'Potencial scrap',
                    'Potencial parada de linea. Problemas en el ensamble final',
                    'Potencial reclamo de aspecto/comfort',
                    8,
                    [
                        makeCause(
                            'Error en la orden de compra o ficha tecnica',
                            'Revision de Ingenieria de la Ficha Tecnica/OC antes de la emision al proveedor',
                            'Control dimensional por muestreo en recepcion y Revision obligatoria del Certificado de Calidad (CoC)',
                            5, 6, 8, 'SC/HI'
                        ),
                        makeCause(
                            'Falta de control dimensional en recepcion',
                            'Procedimiento Operacional Estandar de Inspeccion. Requisitos Contractuales de Calidad',
                            'Control dimensional por muestreo con calibre en recepcion',
                            6, 6, 8, 'SC'
                        ),
                        makeCause(
                            'Proveedor no respeta tolerancias',
                            'Auditorias al Proveedor para verificar su capacidad de Control Estadistico',
                            'Revision del Certificado de Calidad (CoC) y Control Dimensional por Muestreo en recepcion',
                            7, 6, 8, 'SC'
                        ),
                    ]
                ),

                // FM: Contaminacion / suciedad en materia prima
                makeFail(
                    'Contaminacion / suciedad en la materia prima',
                    '',
                    '',
                    '',
                    5,
                    [
                        makeCause(
                            'Ambiente sucio en planta del proveedor',
                            'Auditorias de Calidad del proveedor',
                            'Revision del Certificado de Calidad del proveedor. Inspeccion Visual',
                            5, 6, 5
                        ),
                        makeCause(
                            'Almacenaje inadecuado en transporte (sin protecciones)',
                            'Logistica sobre estiba segura y uso de Embalajes Cubiertos o cerrados',
                            'Inspeccion Visual de danos/suciedad en el empaque al recibir',
                            8, 6, 8, 'SC'
                        ),
                        makeCause(
                            'Falta de inspeccion al llegar',
                            'Auditorias de Calidad. Instruccion de Trabajo',
                            'Inspeccion Visual de la pieza y Revision del Certificado de Calidad del proveedor. Inspeccion Visual del estado de la pieza/empaque, requerida como punto de control del proceso de recepcion',
                            5, 6, 5
                        ),
                    ]
                ),
            ]
        ),
    ]),

    // -- Measurement --
    makeWe('Measurement', 'Calibres de diferentes tamanos / Micrometro / Probeta de flamabilidad / Probeta de peeling', [
        makeFunc(
            'Disponer y utilizar Calibres de diferentes tamanos, Micrometro, Metro, Probeta de flamabilidad, Probeta de peeling. Registrar el control en calidad segun plan de control',
            '',
            []
        ),
    ]),

    // -- Method --
    makeWe('Method', 'Hoja de operaciones / Ayudas visuales', [
        makeFunc(
            'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un "No conforme"',
            '',
            []
        ),
        makeFunc(
            'Mostrar como debe quedar el producto para evitar ciertos defectos',
            '',
            []
        ),
    ]),

    // -- Material (Indirectos) --
    makeWe('Material', 'Etiquetas blancas 100x60mm / Engrapadora / Libretas / Etiquetas de rechazo / Post it / Lapiz blanco / Tijera / Lapicera / Bandas elasticas / Cinta scotch', [
        makeFunc(
            'Disponer de etiquetas blancas 100x60 y etiquetas de rechazo para clasificacion',
            '',
            []
        ),
    ]),

    // -- Environment --
    makeWe('Environment', 'Iluminacion/Ruido / Ley 19587 / Decreto Reglamentario 351/79', [
        makeFunc(
            'Mantener las condiciones de seguridad ocupacional (ej. Iluminacion adecuada) segun la Ley 19587 (cumplimiento de regulaciones ambientales y de seguridad y salud ocupacional)',
            '',
            []
        ),
    ]),
]);

// ============================================================================
// OP 10 — INYECCION DE PIEZAS PLASTICAS
// ============================================================================

const OP10 = makeOp('10', 'Inyeccion de piezas plasticas', [
    // -- Machine: Maquina inyectora --
    makeWe('Machine', 'Maquina inyectora de plastico', [
        makeFunc(
            'Moldear la pieza plastica inyectando la materia prima en la cavidad, asegurando la geometria, dimensiones y apariencia fisica segun el diseno',
            '',
            [
                // FM1: Llenado Incompleto de Pieza
                makeFail(
                    'Llenado Incompleto de Pieza',
                    '100% de la produccion en ese ciclo tiene que ser Scrapeada',
                    'Parada de linea mayor a un turno de produccion completo o paro de envios',
                    'Perdida de la Funcion Primaria del vehiculo',
                    8,
                    [
                        makeCause(
                            'Presion de Inyeccion configurada fuera de especificacion',
                            'Monitoreo automatico de presion y mantenimiento preventivo con calibracion periodica de sensores',
                            'Deteccion automatica de llenado incompleto. Verificacion Visual',
                            5, 7, 8, 'SC'
                        ),
                        makeCause(
                            'Temperatura de fusion del material (T) demasiado baja',
                            'Mantenimiento y Calibracion del Sistema Termico y Verificacion Estandar de la Configuracion de Potencia',
                            'Aprobacion de la Primera Pieza tras el set-up o cambio de turno, realizada por el Operador/Calidad',
                            4, 8, 8, 'SC'
                        ),
                    ]
                ),

                // FM2: Omitir la operacion de inspeccion dimensional de cotas index
                makeFail(
                    'Omitir la operacion de inspeccion dimensional de cotas index',
                    'Una porcion de la produccion requiere Retrabajo Fuera de Linea',
                    'Se desencadena un Plan de Reaccion Importante',
                    'Degradacion de la Funcion Secundaria',
                    7,
                    [
                        makeCause(
                            'Operador omite la verificacion dimensional de la cota index',
                            'Lista de Verificacion (Checklist) para asegurar que el paso se incluya al inicio del turno',
                            'Auditoria de Proceso',
                            7, 9, 7, 'SC'
                        ),
                        makeCause(
                            'Instruccion de trabajo ambigua sobre la frecuencia o la metodologia de la inspeccion de la cota index',
                            'Las Hojas de Proceso describen el metodo operativo y las pautas de control del Plan de Control, elaboradas por el equipo de diseno e implementacion',
                            'Cada dos meses se verifica una pieza con su documentacion; las diferencias se registran como No Conformidades internas',
                            5, 9, 7
                        ),
                    ]
                ),

                // FM3: Rebaba Excesiva / Exceso de Material
                makeFail(
                    'Rebaba Excesiva / Exceso de Material',
                    '100% de la produccion tiene que ser Retrabajada Fuera de Linea y aceptada',
                    'Parada de linea de produccion menor a una hora',
                    'Perdida de la Funcion Secundaria del vehiculo',
                    7,
                    [
                        makeCause(
                            'Fuerza de Cierre insuficiente',
                            'Mantenimiento Preventivo (MP) programado de la Unidad de Cierre / Instruccion de Set-up detallada para configuracion de Clamping Force',
                            'Monitoreo Automatico de Presion de Cierre (Primario) / Inspeccion dimensional manual por muestreo (Secundario)',
                            5, 3, 7
                        ),
                        makeCause(
                            'Molde o cavidad contaminada con material residual',
                            'Procedimiento de limpieza y purga estandarizado para la cavidad y linea de particion del molde antes de cada set-up o despues de interrupciones',
                            'Inspeccion visual por parte del operador de la cavidad',
                            5, 8, 7
                        ),
                        makeCause(
                            'Mantenimiento Preventivo del molde para verificar el correcto sellado de la linea de particion',
                            'Mantenimiento Preventivo del molde para verificar el correcto sellado de la linea de particion',
                            'Inspeccion visual por parte del operador de la cavidad',
                            5, 8, 7
                        ),
                        makeCause(
                            'Parametros de Inyeccion configurados incorrectamente (Presion, Temperatura, Tiempos, Velocidad)',
                            'Instruccion de Setup Estandarizada (Plan de Control / Hoja de Proceso) que detalla los valores nominales y rangos de tolerancia para todos los parametros criticos',
                            'Aprobacion de la Primera Pieza (First Piece Approval): Inspeccion de los parametros de la maquina y verificacion dimensional de la pieza por personal de Calidad/Supervision antes de liberar la produccion',
                            5, 8, 7, 'SC'
                        ),
                    ]
                ),
            ]
        ),
        makeFunc(
            'Inyectar el material en el molde controlando los parametros de proceso (presion, temperatura, tiempo) para garantizar el llenado y enfriamiento correcto segun la ficha tecnica',
            '',
            [
                makeFail(
                    'Parametros de Inyeccion configurados incorrectamente (Presion, Temperatura, Tiempos, Velocidad)',
                    'Una porcion de la produccion sea descartada (scrap)',
                    '',
                    '',
                    7,
                    [
                        makeCause(
                            'Parametros de Inyeccion configurados incorrectamente',
                            'Instruccion de Setup Estandarizada (Plan de Control / Hoja de Proceso) que detalla los valores nominales y rangos de tolerancia para todos los parametros criticos',
                            'Aprobacion de la Primera Pieza (First Piece Approval): Inspeccion de los parametros de la maquina y verificacion dimensional de la pieza por personal de Calidad/Supervision antes de liberar la produccion',
                            5, 8, 7
                        ),
                        makeCause(
                            'Sensores de la maquina descalibrados',
                            'Mantenimiento Preventivo y Calibracion de Sensores de la maquina para asegurar que la lectura de los parametros es precisa',
                            'Monitoreo Automatico de Parametros',
                            4, 7, 7
                        ),
                    ]
                ),
            ]
        ),
    ]),

    // -- Man --
    makeWe('Man', 'Operador de produccion / Lider de equipo', [
        makeFunc(
            'Descargar la pieza y realizar la inspeccion visual al 100% (segun pauta) para segregar defectos como rebabas y/o quemaduras antes del embalaje intermedio',
            '',
            []
        ),
    ]),

    // -- Method --
    makeWe('Method', 'Hoja de operaciones / Ayudas visuales', [
        makeFunc('Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un "No conforme"', '', []),
        makeFunc('Mostrar como debe quedar el producto para evitar ciertos defectos', '', []),
    ]),

    // -- Material (Indirectos) --
    makeWe('Material', 'Etiquetas blancas 100x60mm / Etiquetas de rechazo 100x60mm / Lapicera / Medios', [
        makeFunc('Identificar Producto/Kit Asegurar Trazabilidad', '', []),
        makeFunc('Proteger el producto (contra danos mecanicos o contaminacion); y Contener las piezas (para asegurar su integridad y facilitar la manipulacion)', '', []),
    ]),

    // -- Environment --
    makeWe('Environment', 'Iluminacion/Ruido / Ley 19587 / Decreto Reglamentario 351/79', [
        makeFunc('Mantener las condiciones de seguridad ocupacional (ej. Iluminacion adecuada) segun la Ley 19587', '', []),
    ]),
]);

// ============================================================================
// OP 11 — ALMACENAMIENTO EN MEDIOS WIP
// ============================================================================

const OP11 = makeOp('11', 'Almacenamiento en medios WIP', [
    makeWe('Machine', 'Zorras manuales', [
        makeFunc('Mantener la Estabilidad de la Carga durante el Movimiento Interno', '', []),
    ]),

    makeWe('Man', 'Operador de produccion / Lider de equipo', [
        makeFunc(
            'Preparar Kit completo y ordenado de componentes (segun la Orden de Produccion); Contener componentes en medios definidos; Etiquetar caja con identificacion minima obligatoria (N de parte/modelo, OP, Fecha/Turno); y Mover kits a la zona de prearmado',
            '',
            [
                // FM1: Faltante/exceso de componentes en la caja del kit
                makeFail(
                    'Faltante/exceso de componentes en la caja del kit',
                    'Una porcion de la produccion afectada',
                    'Parada de linea entre una hora y un turno de produccion completo',
                    'Degradacion de la funcion secundaria del vehiculo',
                    7,
                    [
                        makeCause(
                            'El Operador no realiza el conteo/verificacion completo de la cantidad de componentes segun la OP',
                            'Existencia de documentacion de proceso (Ayuda visual / Hoja de operacion estandar)',
                            'Verificacion manual o conteo visual del kit por parte del operador',
                            7, 8, 7, 'SC'
                        ),
                    ]
                ),

                // FM2: Componente incorrecto (variante o color) incluido
                makeFail(
                    'Componente incorrecto (variante o color) incluido',
                    'Una porcion de la produccion debe ser desechada',
                    'Esto requeriria una accion de reparacion o reemplazo en campo o una detencion del envio',
                    'Degradacion de la funcion secundaria del vehiculo',
                    7,
                    [
                        makeCause(
                            'Mano de Obra no realiza la verificacion visual contra la Orden de Produccion (OP)',
                            'La Orden de Produccion (OP) (que contiene el codigo a cortar/seleccionar) se encuentra disponible y formalizada al igual que la instruccion del operador',
                            'El operador realiza una verificacion visual del componente fisico (color o variante) contra el codigo listado en la OP antes de incluirlo en el kit',
                            5, 8, 7, 'SC'
                        ),
                    ]
                ),

                // FM3: Pieza danada (rasgadura, mancha) incluida en el kit
                makeFail(
                    'Pieza danada (rasgadura, mancha) incluida en el kit',
                    'Descartar (scrap) una porcion de la produccion',
                    'Parada de linea entre una hora y un turno de produccion completo',
                    'Degradacion de la funcion secundaria del vehiculo',
                    7,
                    [
                        makeCause(
                            'El Operador (Mano de Obra) no sigue el procedimiento de revision visual de defectos (rasgaduras o manchas)',
                            'Instruccion o procedimiento (Mano de Obra/Metodo) que establece que el operador debe buscar rasgaduras o manchas antes de incluir la pieza en el kit',
                            '-',
                            7, 10, 7, 'SC/HI'
                        ),
                    ]
                ),
            ]
        ),
        makeFunc(
            'Verificar piezas visualmente y colocarlas de forma ordenada en la caja; Etiquetar caja (con identificacion minima); Mover producto (a la zona de costura)',
            '',
            []
        ),
    ]),

    // -- Method --
    makeWe('Method', 'Hoja de operaciones / Ayudas visuales', [
        makeFunc('Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un "No conforme"', '', []),
        makeFunc('Mostrar como debe quedar el producto para evitar ciertos defectos', '', []),
    ]),

    // -- Material --
    makeWe('Material', 'Etiquetas blancas 100x60mm / Etiquetas de rechazo 100x60mm / Lapicera / Medios', [
        makeFunc('Proteger el producto (contra danos mecanicos o contaminacion); y Contener las piezas', '', []),
        makeFunc('Identificar Producto/Kit Asegurar Trazabilidad', '', []),
    ]),

    // -- Environment --
    makeWe('Environment', 'Iluminacion/Ruido / Ley 19587 / Decreto Reglamentario 351/79', [
        makeFunc('Mantener las condiciones de seguridad ocupacional', '', []),
    ]),
]);

// ============================================================================
// OP 20 — ADHESIVADO HOT MELT
// ============================================================================

const OP20 = makeOp('20', 'Adhesivado Hot Melt', [
    makeWe('Machine', 'Sistema de Fusion / Sistema de Aplicacion / Sistema de Desenrollado y Tension / Sistema de Enfriamiento', [
        makeFunc(
            'Aplicar una capa uniforme de adhesivo Hot Melt sobre el sustrato TPO para garantizar la adhesion en el termoformado posterior',
            '',
            [
                makeFail(
                    'Adhesion deficiente del vinilo en la pieza plastica / quemaduras en el vinilo y/o pieza plastica',
                    'Scrap',
                    'Potencial parada de linea',
                    'Reclamo de aspecto',
                    8,
                    [
                        makeCause(
                            'Temperatura de aplicacion mayor o menor a 190-210 C',
                            'Hojas de operaciones / ayudas visuales',
                            'Peso del vinilo adhesivado incorrecto - Visual',
                            3, 8, 8
                        ),
                    ]
                ),
                makeFail(
                    'Adhesion deficiente - Aplicar adhesivo del lado equivocado del vinilo',
                    'Scrap',
                    'Potencial parada de linea',
                    'Reclamo de aspecto',
                    8,
                    [
                        makeCause(
                            'Superficie de la pieza con polvo, grasa o oleosidad',
                            'Hojas de operaciones / ayudas visuales',
                            'Visual',
                            3, 8, 8
                        ),
                        makeCause(
                            'Error del operario / maquina empastada',
                            'Limpieza constante del rodillo / Hojas de operaciones',
                            'Visual',
                            4, 8, 8
                        ),
                    ]
                ),
                makeFail(
                    'Posible quemadura en el operario',
                    '',
                    '',
                    '',
                    10,
                    [
                        makeCause(
                            'Falta de EPP y herramientas',
                            'Pinzas para tomar el vinilo',
                            'Visual',
                            1, 4, 10
                        ),
                    ]
                ),
            ]
        ),
    ]),

    makeWe('Man', 'Operador de produccion / Lider de equipo', [
        makeFunc(
            'Cargar los parametros correctos de la receta en el HMI y realizar la carga/empalme de la bobina de TPO sin arrugas',
            '',
            []
        ),
    ]),

    makeWe('Method', 'Hoja de operaciones / Ayudas visuales', [
        makeFunc('Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un "No conforme"', '', []),
        makeFunc('Mostrar como debe quedar el producto para evitar ciertos defectos', '', []),
    ]),

    makeWe('Material', 'Adhesivo Hot Melt / Rollo de TPO (Sustrato) / Agente de limpieza', [
        makeFunc('Adhesion quimica y resistencia termica. Fundirse homogeneamente con viscosidad adecuada', '', []),
        makeFunc('Base receptora del adhesivo con tension superficial correcta y estabilidad dimensional', '', []),
    ]),

    makeWe('Environment', 'Iluminacion/Ruido / Ley 19587 / Decreto Reglamentario 351/79', [
        makeFunc('Mantener las condiciones de seguridad ocupacional', '', []),
    ]),
]);

// ============================================================================
// OP 30 — PROCESO DE IMG (TERMOFORMADO)
// ============================================================================

const OP30 = makeOp('30', 'Proceso de IMG', [
    makeWe('Machine', 'Estacion de Calentamiento / Estacion de Formado / Sistema de Vacio / Sistema de Enfriamiento / Mecanismo de Transporte / Mecanismo de Corte / Sistema Neumatico', [
        makeFunc(
            'Conformar termicamente la lamina pre-laminada para obtener la geometria final de la pieza y replicar la textura (grano) definida en el molde sobre la superficie del TPO',
            '',
            [
                // CRITICAL: Airbag zone - S=10
                makeFail(
                    'Espesor de pared excesivo en zona de ruptura de Airbag',
                    'Scrap / Retrabajo',
                    'Riesgo de seguridad Airbag no despliega correctamente',
                    '',
                    10,
                    [
                        makeCause(
                            'Obstruccion parcial de micro-canales de vacio por acumulacion de vapores Hot Melt',
                            'Limpieza de molde programada cada 4 hs con hielo seco',
                            'Medicion por Ultrasonido cada 2 horas',
                            4, 6, 10
                        ),
                    ]
                ),

                makeFail(
                    'Textura deficiente / falta de definicion de grano',
                    'Reproceso / Scrap',
                    'Potencial parada de linea',
                    '',
                    6,
                    [
                        makeCause(
                            'Temperatura de lamina TPO insuficiente',
                            'Calibracion del sensor cada turno con pirometro de referencia',
                            'Inspeccion visual 100% de textura en estacion de control',
                            3, 4, 6
                        ),
                        makeCause(
                            'Sensor de temperatura de horno descalibrado o desplazado',
                            'Calibracion del sensor cada turno con pirometro de referencia',
                            'Inspeccion visual 100% de textura en estacion de control',
                            3, 4, 6
                        ),
                    ]
                ),

                makeFail(
                    'Ancho de bobina de TPO fuera de tolerancia',
                    'Desperdicio de material / Costo adicional',
                    'Sin efecto significativo',
                    '',
                    3,
                    [
                        makeCause(
                            'Error en el pedido de compras o variacion del proveedor de lamina',
                            'Certificado de calidad del proveedor verificado en recepcion',
                            'Medicion de ancho con flexometro al inicio de cada bobina',
                            2, 3, 3
                        ),
                    ]
                ),
            ]
        ),
    ]),

    makeWe('Man', 'Operador de Proceso', [
        makeFunc(
            'Cargar parametros en el HMI, vigilar el ciclo automatico y verificar visualmente las piezas conformadas',
            '',
            []
        ),
    ]),

    makeWe('Method', 'Hoja de operaciones / Ayudas visuales', [
        makeFunc('Utilizar la Hoja de Operaciones vigente', '', []),
        makeFunc('Mostrar como debe quedar el producto para evitar ciertos defectos', '', []),
    ]),

    makeWe('Material', 'Rollo Pre-laminado (TPO + Hot Melt) / Molde de IMG (herramental)', [
        makeFunc('Deformarse plasticamente bajo calor y vacio sin romperse (elongacion) y retener la forma y textura una vez enfriado', '', []),
        makeFunc('Proveer la superficie negativa con la textura y geometria exactas para transferir el acabado estetico al TPO', '', []),
    ]),

    makeWe('Environment', 'Suministro de Agua / Suministro de Aire Comprimido', [
        makeFunc('Mantener las condiciones de seguridad ocupacional segun Ley 19587', '', []),
    ]),
]);

// ============================================================================
// OP 40 — TRIMMING / CORTE FINAL
// ============================================================================

const OP40 = makeOp('40', 'Trimming - Corte final', [
    makeWe('Machine', 'Componentes de Corte (Cuchilla 1-4) / Sistema Neumatico / Plataforma del Molde Inferior / Sistema de Ciclo de Agua / Sistema de Control Electrico / Estructura Principal', [
        makeFunc(
            'Separar y eliminar el material excedente (scrap) de la pieza termoformada mediante corte termico-mecanico con cuchilla caliente (Hot Knife), generando el contorno final definido en el diseno',
            '',
            [
                // CRITICAL: Airbag zone - S=10
                makeFail(
                    'Corte incompleto en zona de despliegue de Airbag (Rebaba excesiva o material no separado)',
                    'Scrap y cuarentena de lote sospechoso',
                    'Parada de linea o rechazo de lote sospechoso',
                    'Airbag no despliega',
                    10,
                    [
                        makeCause(
                            'Temperatura de la cuchilla por debajo del set-point debido a termopar danado o resistencia quemada',
                            'PLC con enclavamiento de temperatura: la maquina no permite iniciar ciclo si la temperatura real no esta dentro de tolerancia (+/-5 C)',
                            'Inspeccion visual 100%: el operario revisa el corte al descargar la pieza',
                            3, 7, 10
                        ),
                    ]
                ),

                // FM: Contorno de corte fuera de tolerancia
                makeFail(
                    'Contorno de corte fuera de tolerancia geometrica',
                    'Retrabajo manual costoso (lijado/recorte)',
                    'Gap excesivo entre panel y chapa, o interferencia con otro componente. Requiere retrabajos',
                    'Ruidos (Squeak & Rattle) o mala apariencia de las uniones',
                    6,
                    [
                        makeCause(
                            'Desgaste en los pines de centrado del fixture o pieza mal asentada por suciedad en los puntos de apoyo (Nesting)',
                            'Mantenimiento Preventivo de Fixtures: verificacion dimensional de pines cada 3 meses. Limpieza de nido por operario cada inicio de turno',
                            'Medicion en Dispositivo de Control (Checking Fixture): 1 pieza cada hora verificada en galga pasa/no pasa',
                            5, 6, 6
                        ),
                    ]
                ),

                // FM: Borde de corte quemado o con hilachas (Angel hair)
                makeFail(
                    'Borde de corte quemado o con hilachas (Angel hair)',
                    'Retrabajo (limpieza de rebaba) antes de empaque',
                    'Defecto visual menor. Puede requerir limpieza extra en linea de ensamble. No afecta funcion',
                    'Mala apariencia en bordes visibles al abrir la puerta',
                    4,
                    [
                        makeCause(
                            'Velocidad de avance de cuchilla incorrecta (demasiado lenta quema, demasiado rapida desgarra) por fuga de aire o regulador de caudal desajustado',
                            'Hoja de Parametros Estandar: verificacion de presiones de aire al inicio de turno. Marcas visuales en los reguladores de caudal',
                            'Inspeccion Visual 100%: el operario retira las hilachas manualmente si las ve',
                            4, 3, 4
                        ),
                    ]
                ),
            ]
        ),
    ]),

    makeWe('Man', 'Operador de Carga/Descarga', [
        makeFunc(
            'Cargar la pieza en el fixture asegurando el correcto asentamiento (que no quede levantada) e iniciar el ciclo de corte',
            '',
            []
        ),
    ]),

    makeWe('Method', 'Hoja de operaciones / Ayudas visuales', [
        makeFunc('Utilizar la Hoja de Operaciones vigente', '', []),
        makeFunc('Mostrar como debe quedar el producto para evitar ciertos defectos', '', []),
    ]),

    makeWe('Material', 'Pieza Termoformada (Formed Part) / Cuchilla de Corte (Cutting Blade) / Fixture-Nido (Lower Mold)', [
        makeFunc('Mantener su geometria al ser colocada en el nido y permitir el corte sin fracturarse ni delaminarse', '', []),
    ]),

    makeWe('Environment', 'Aire Comprimido / Energia', [
        makeFunc('Mantener las condiciones de seguridad ocupacional segun Ley 19587', '', []),
    ]),
]);

// ============================================================================
// OP 50 — EDGE FOLDING (PLEGADO DE BORDES)
// ============================================================================

const OP50 = makeOp('50', 'Edge Folding', [
    makeWe('Machine', 'Sistema de Calentamiento/Reactivacion / Mecanismo de Plegado / Sistema de Presion / Fixture-Nido de Alojamiento', [
        makeFunc(
            'Realizar el plegado controlado del material TPO excedente sobre el reverso (lado B) del sustrato, mediante reactivacion termica del adhesivo Hot Melt y presion mecanica de las correderas (sliders), generando un borde estetico y adherido',
            '',
            [
                // FM1: Despegue parcial del material (Delaminacion)
                makeFail(
                    'Despegue parcial del material (Delaminacion) en la zona de plegado',
                    'Scrap y costos de contencion (cuarentena)',
                    'Falla en pruebas de laboratorio (envejecimiento). Rechazo de lote',
                    'El recubrimiento se levanta o hace "globo" con el tiempo/calor. Perdida de funcion primaria (vida util)',
                    8,
                    [
                        makeCause(
                            'Temperatura de aire caliente/IR por debajo del set-point (< 180 C). El adhesivo no llego a su punto de activacion',
                            'PLC con ventana de alarma: la maquina se bloquea automaticamente si la temperatura real varia +/-5 C del set-point',
                            'Prueba de Pelado (Peel Test) destructiva: se rompe 1 pieza cada 4 horas o al inicio de turno para verificar fuerza de pegado',
                            2, 7, 8
                        ),
                    ]
                ),

                // FM2: Arrugas o pliegues irregulares
                makeFail(
                    'Arrugas o pliegues irregulares visibles en el radio del borde',
                    'Retrabajo (planchar con calor manual) o Scrap',
                    'Defecto visual detectado en linea de ensamble. Posible reclamo',
                    'Defecto estetico menor, apariencia pobre en el interior del auto',
                    4,
                    [
                        makeCause(
                            'Pieza mal posicionada en el nido (fixture) por operador al cargar. La pieza quedo corrida y la maquina plego chueco',
                            'Pines de referencia en el nido (Poka-yoke): ayudas visuales y mecanicas para que la pieza solo entre en una posicion',
                            'Inspeccion Visual 100%: el operador revisa la pieza al descargarla de la maquina',
                            4, 3, 4
                        ),
                    ]
                ),

                // FM3: Espesor de borde fuera de especificacion
                makeFail(
                    'Espesor de borde fuera de especificacion (Plegado "abierto" o incompleto)',
                    'Parada de maquina para ajuste',
                    'Problemas de montaje. La pieza no clipa bien en la puerta porque el borde choca',
                    'Ruidos (Squeak & Rattle) por roce con la chapa',
                    6,
                    [
                        makeCause(
                            'Fuga de aire o baja presion en los cilindros neumaticos de los sliders de plegado',
                            'Switch de Presion Digital: la maquina no inicia ciclo si la presion de linea es < 6 Bar',
                            'Galga (Checking Fixture): control de interferencia pasa/no pasa por muestreo (1ra y ultima pieza)',
                            2, 6, 6
                        ),
                    ]
                ),
            ]
        ),
    ]),

    makeWe('Man', 'Operador de Linea (Carga/Descarga)', [
        makeFunc(
            'Posicionar la pieza en el nido asegurando que los puntos de referencia calcen a fondo antes de iniciar el ciclo, para evitar que el plegado se haga desfasado',
            '',
            []
        ),
    ]),

    makeWe('Method', 'Hoja de operaciones / Ayudas visuales', [
        makeFunc('Utilizar la Hoja de Operaciones vigente', '', []),
    ]),

    makeWe('Material', 'Pieza Recortada (Trimmed Part) / Adhesivo Reactivado (Hot Melt)', [
        makeFunc('Tener la longitud de solapa (sobrante) correcta para permitir el doblado', '', []),
    ]),

    makeWe('Environment', 'Temperatura Ambiente / Energia', [
        makeFunc('Mantener las condiciones de seguridad ocupacional segun Ley 19587', '', []),
    ]),
]);

// ============================================================================
// OP 60 — SOLDADO DE REFUERZOS INTERNOS
// ============================================================================

const OP60 = makeOp('60', 'Soldado de refuerzos internos', [
    makeWe('Machine', 'Generador de Ultrasonido / Conjunto Acustico / Sistema de Presion-Actuador Neumatico / Fixture-Nido (Lower Mold)', [
        makeFunc(
            'Unir permanentemente los refuerzos plasticos (brackets/bosses) a la cara posterior (Lado B) del Top Roll mediante energia ultrasonica, fundiendo los directores de energia para crear una union molecular solida',
            '',
            [
                // FM1: Soldadura fria / Falta de fusion (Cold Weld)
                makeFail(
                    'Soldadura fria / Falta de fusion (Cold Weld). El refuerzo se despega al aplicar una fuerza minima',
                    'Scrap del Top Roll completo (no se puede resoldar) y cuarentena',
                    'El refuerzo se sale durante el montaje del panel en la puerta. Parada de linea',
                    'Ruido (Squeak & Rattle) dentro de la puerta o refuerzo se cae, inutilizando manija o apoyabrazos',
                    7,
                    [
                        makeCause(
                            'Energia entregada insuficiente (Joules/Tiempo) por desajuste en el generador o sonotrodo flojo. No hubo suficiente friccion para derretir el plastico',
                            'Monitoreo de Curva de Proceso: la maquina tiene ventana de parametros (Energia/Tiempo/Colapso). Si la soldadura sale de la curva, alarma automatica',
                            'Prueba de "Pushout" manual: el operario empuja el refuerzo con la mano para ver si se mueve (Subjetivo, no garantiza fuerza real)',
                            3, 7, 7
                        ),
                    ]
                ),

                // FM2: Marca de rechupe o quemadura visible en Cara A (Read-through)
                makeFail(
                    'Marca de rechupe o quemadura visible en la Cara A (Read-through). Se ve el punto de soldadura del lado del cliente',
                    'Scrap inmediato (pieza estetica arruinada)',
                    'Rechazo en inspeccion final de linea. Reclamo por calidad visual',
                    'Defecto estetico. El dueno del auto ve una marca fea en el panel de la puerta',
                    4,
                    [
                        makeCause(
                            'Exceso de colapso (profundidad de soldadura) por presion de aire muy alta o falta de "Hard Stop" mecanico en el herramental',
                            'Tope Mecanico (Hard Stop): el cilindro tiene un tornillo que impide que el sonotrodo baje mas de la cuenta, aunque quiera',
                            'Inspeccion Visual 100%: el operario da vuelta la pieza y mira la Cara A bajo luz controlada al descargarla',
                            4, 3, 4
                        ),
                    ]
                ),

                // FM3: Refuerzo / Inserto faltante en el ensamble
                makeFail(
                    'Refuerzo / Inserto faltante en el ensamble. El Top Roll sale sin el soporte plastico',
                    'Retrabajo (volver a meter la pieza en maquina)',
                    'No pueden montar el componente (ej. la tecla levantavidrios no tiene donde atornillarse). Parada de linea',
                    'N/A (no llega al usuario porque no se puede armar el auto)',
                    7,
                    [
                        makeCause(
                            'Error de operario: olvido de cargar el componente en el nido antes de iniciar el ciclo',
                            'Sensores de Presencia (Poka-Yoke): el nido tiene sensores inductivos/opticos. Si no detectan la pieza, la maquina NO arranca',
                            'La propia maquina: alerta en pantalla "Falta Pieza" y bloqueo de ciclo. El error se detecta ANTES de procesar',
                            2, 2, 7
                        ),
                    ]
                ),
            ]
        ),
    ]),

    makeWe('Man', 'Operador de Soldadura', [
        makeFunc(
            'Colocar todos los refuerzos en sus alojamientos del fixture y posicionar el Top Roll correctamente antes de iniciar el ciclo, verificando que los componentes esten asentados',
            '',
            []
        ),
    ]),

    makeWe('Method', 'Hoja de operaciones / Ayudas visuales', [
        makeFunc('Utilizar la Hoja de Operaciones vigente', '', []),
        makeFunc('Mostrar como debe quedar el producto para evitar ciertos defectos', '', []),
    ]),

    makeWe('Material', 'Pieza Plegada (Edgewrapped Part) / Refuerzos Plasticos (Brackets/Bosses)', [
        makeFunc('Proveer superficie rigida y estable para recibir la soldadura', '', []),
    ]),

    makeWe('Environment', 'Ruido / Cabina Insonorizada', [
        makeFunc('Mantener las condiciones de seguridad ocupacional (Iluminacion, proteccion auditiva por ruido ultrasonico)', '', []),
    ]),
]);

// ============================================================================
// OP 70 — SOLDADO TWEETER
// ============================================================================

const OP70 = makeOp('70', 'Soldado Tweeter', [
    makeWe('Machine', 'Generador de Ultrasonido (Power Supply) / Conjunto Acustico (Convertidor+Booster+Horn) / Sistema de Movimiento (Actuador/Cilindro) / Fixture-Nido (Nest)', [
        makeFunc(
            'Union permanente del Tweeter (o su soporte/grilla) al sustrato del Top Roll mediante soldadura por ultrasonido. Se funden los domos o puntos de fijacion para garantizar que la pieza no se mueva ni genere ruidos parasitos, manteniendo la estetica del Lado A',
            '',
            [
                // FM1: Soldadura fria / Juego libre del Tweeter
                makeFail(
                    'Soldadura fria / Juego libre del Tweeter (Loose assembly). El domo plastico no se fundio completamente',
                    'Retrabajo (intentar resoldar) o Scrap si los postes se rompieron',
                    'Falla en prueba de "Shake & Rattle" o el Tweeter se desprende al montar el panel',
                    'Ruido de vibracion (Buzz) audible al escuchar musica con bajos o en terreno irregular',
                    7,
                    [
                        makeCause(
                            'Tiempo de soldadura muy corto o amplitud baja. No se genero suficiente calor friccional para fundir la union',
                            'Monitoreo de Energia (Ventana de Proceso): el equipo alarma si la energia consumida (Joules) esta por debajo del minimo establecido',
                            'Prueba de Torque/Push manual: el operario intenta girar o empujar el Tweeter levemente para ver si esta firme (Subjetivo, depende del tacto del operario)',
                            3, 7, 7
                        ),
                    ]
                ),

                // FM2: Marca de rechupe o brillo visible en superficie A (Read-through)
                makeFail(
                    'Marca de rechupe o brillo visible en superficie A (Read-through). Se nota el punto de soldadura del lado del cuero/TPO',
                    'Scrap inmediato (pieza no recuperable)',
                    'Rechazo en inspeccion de entrada o linea final. Reclamo por calidad visual',
                    'Defecto estetico en el panel de puerta. Mala percepcion de calidad',
                    4,
                    [
                        makeCause(
                            'Ausencia de soporte (yunco) o soporte danado en el nido. El nido no apoyo bien la zona debajo de la soldadura y el material cedio',
                            'Mantenimiento Preventivo de Nidos: revision semanal de la superficie de los apoyos (que no tengan golpes ni desgaste)',
                            'Inspeccion Visual 100% (Lado A): el operario gira la pieza y verifica la superficie bajo luz estandarizada',
                            4, 3, 4
                        ),
                    ]
                ),

                // FM3: Tweeter danado internamente (Bobina abierta / Membrana rota)
                makeFail(
                    'Tweeter danado internamente (Bobina abierta / Membrana rota). El parlante no suena o suena "frito"',
                    'Si no se prueba, el defecto se escapa. Riesgo de envio de pieza defectuosa',
                    'Falla en test electrico final del auto (End of Line). Retrabajo costoso (desarmar puerta)',
                    'Perdida de funcion de audio. El sistema de sonido se escucha mal de un lado o no suena',
                    6,
                    [
                        makeCause(
                            'Contacto directo del sonotrodo con la malla/cono del Tweeter por desalineacion en la carga. La vibracion se transmitio a la parte sensible del parlante en vez de al plastico',
                            'Diseno de Sonotrodo con alivio (Relief): el sonotrodo tiene un hueco en el medio para no tocar nunca la malla, solo toca los bordes de soldadura',
                            'Ninguna en esta estacion. No hay test electrico en la soldadora. El defecto pasa a la siguiente estacion sin ser detectado',
                            2, 10, 6
                        ),
                    ]
                ),
            ]
        ),
    ]),

    makeWe('Man', 'Operador de Soldadura', [
        makeFunc(
            'Insertar el Tweeter en los alojamientos del Top Roll asegurando que asiente a fondo (click) antes de activar la maquina, y verificar que no haya cables atrapados',
            '',
            []
        ),
    ]),

    makeWe('Method', 'Hoja de operaciones / Ayudas visuales', [
        makeFunc('Utilizar la Hoja de Operaciones vigente', '', []),
        makeFunc('Mostrar como debe quedar el producto para evitar ciertos defectos', '', []),
    ]),

    makeWe('Material', 'Top Roll (Sustrato) / Tweeter - Grilla de Altavoz', [
        makeFunc('Tiene los orificios o pernos donde calza el Tweeter. Debe estar limpio y sin deformaciones', '', []),
    ]),

    makeWe('Environment', 'Temperatura Ambiente', [
        makeFunc('Mantener las condiciones de seguridad ocupacional (Iluminacion, proteccion auditiva) segun Ley 19587', '', []),
    ]),
]);

// ============================================================================
// OP 80 — INSPECCION FINAL Y EMPAQUE
// ============================================================================

const OP80 = makeOp('80', 'Inspeccion final y empaque', [
    makeWe('Machine', 'Dispositivo de Control (Checking Fixture) / Sistema de Iluminacion / Escaner-Sistema de Etiquetado', [
        makeFunc(
            'Verificar y confirmar que el Top Roll ensamblado cumple con el 100% de las especificaciones criticas de cliente (Aspecto, Dimensiones, Integridad) y protegerlo adecuadamente para su transporte, evitando el envio de piezas No Conformes',
            '',
            [
                // CRITICAL: Pieza NO CONFORME aceptada y enviada (S=9/10)
                makeFail(
                    'Pieza NO CONFORME aceptada y enviada (Fuga de defecto de seguridad). Ej: Clip de airbag faltante o torre de sujecion rota no detectada',
                    'Scrap del ensamble',
                    'Parada de planta del cliente',
                    'Riesgo de seguridad. El airbag no despliega o componente se suelta',
                    9,
                    [
                        makeCause(
                            'Energia/senal del sensor de presencia en el Fixture falsa (sensor trabado, "puenteado" o descalibrado) que dio senal verde aunque la pieza estaba mal asentada o tenia componente faltante',
                            'Verificacion de "Conejo Rojo" (Red Rabbit / Master de Falla): al inicio de cada turno se pasa una pieza mala conocida por el Fixture para confirmar que el sistema la rechaza',
                            'Luz Verde en el Fixture + Marca de OK: la maquina marca la pieza fisicamente o enciende una luz. El operador confia en la senal automatica',
                            3, 4, 9
                        ),
                    ]
                ),

                // FM: Pieza mal identificada / Etiqueta mixta (Wrong Label)
                makeFail(
                    'Pieza mal identificada / Etiqueta mixta (Wrong Label). La etiqueta dice Parte A, pero la pieza fisica es Parte B',
                    'Retrabajo: re-etiquetado del lote completo, sorteo y verificacion uno a uno',
                    'La linea de ensamble del cliente se para porque el escaner da error. No encastra correctamente',
                    'Pieza incorrecta montada en el vehiculo',
                    7,
                    [
                        makeCause(
                            'Error humano en la seleccion de etiqueta: el impresor saco etiquetas por lote y el operario tomo el rollo equivocado de la mesa',
                            'Impresion "On-Demand" interconectada: la etiqueta solo se imprime SI Y SOLO SI el Fixture dio OK a la pieza y detecto que mano es (Izquierda/Derecha). Elimina etiquetas pre-impresas sueltas',
                            'Escaneo de validacion final: antes de colocar la pieza en la caja, se escanea la etiqueta contra una hoja maestra. El escaner no permite continuar si hay discrepancia',
                            2, 2, 7
                        ),
                    ]
                ),

                // FM: Fuga de defecto visual (Falso Negativo)
                makeFail(
                    'Fuga de defecto visual (Pieza con raya/rechupe aceptada). Falso Negativo en inspeccion cosmetica',
                    'Costo de mala calidad interno. Reproceso o scrap si el defecto es grave',
                    'Rechazo puntual en la linea del cliente. Reclamo de calidad (Queja 0km)',
                    'Defecto estetico. Mala percepcion de calidad',
                    5,
                    [
                        makeCause(
                            'Fatiga visual del inspector / Criterio no alineado: el defecto era limite (borderline) y ante la duda, la paso. O la iluminacion bajo de intensidad',
                            'Muestras Limite (Boundary Samples): tener al lado de la estacion la pieza "peor aceptable" firmada por calidad. Descansos programados para el inspector',
                            'Inspeccion Visual 100% (Manual): el propio acto de inspeccionar es la deteccion. Dependencia total del "sensor humano"',
                            4, 7, 5
                        ),
                    ]
                ),
            ]
        ),
    ]),

    makeWe('Man', 'Inspector Final / Empacador', [
        makeFunc(
            'Ejecutar la secuencia de inspeccion visual y tactil estandarizada (recorrido visual) buscando defectos de operaciones anteriores (arrugas Op 40, marcas de soldadura Op 60/70). Colocar la pieza OK en el contenedor asignado siguiendo la pauta de empaque para evitar danos por transporte',
            '',
            []
        ),
    ]),

    makeWe('Method', 'Hoja de operaciones / Ayudas visuales', [
        makeFunc('Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un "No conforme"', '', []),
        makeFunc('Mostrar como debe quedar el producto terminado. Incluir limites de aceptacion/rechazo', '', []),
    ]),

    makeWe('Material', 'Top Roll Ensamblado / Contenedor-Rack / Separadores-Bolsas / Etiqueta de Cliente', [
        makeFunc('Proteger el producto y contener las piezas para su transporte', '', []),
    ]),

    makeWe('Environment', 'Iluminacion estandarizada', [
        makeFunc('Mantener las condiciones de seguridad ocupacional segun Ley 19587. Proveer iluminacion estandarizada (> 1000 Lux) sin sombras para deteccion de defectos cosmeticos sutiles', '', []),
    ]),
]);

// ============================================================================
// OP 90 — EMPAQUE FINAL Y ETIQUETADO
// ============================================================================

const OP90 = makeOp('90', 'Empaque final y etiquetado de producto terminado', [
    makeWe('Machine', 'Impresora de etiquetas / Escaner', [
        makeFunc(
            'Preservar la calidad del producto terminado durante el almacenamiento y transporte, asegurando la cantidad exacta por contenedor, la orientacion correcta de las piezas y la identificacion trazable',
            '',
            [
                // FM: Piezas mezcladas (Mixed Parts)
                makeFail(
                    'Piezas mezcladas (Mixed Parts). La informacion del codigo de barras no coincide con el contenido fisico',
                    'Costos de sorteo en destino (revisar todas las cajas) y penalizacion logistica',
                    'Parada de linea de ensamble o vehiculo construido incorrectamente',
                    'Pieza incorrecta montada en el vehiculo',
                    7,
                    [
                        makeCause(
                            'Error humano en la seleccion de etiqueta: el operador tomo una etiqueta pre-impresa de la mesa que correspondia a otro lote/modelo. Falta de control "On-Demand"',
                            'Impresion contra escaneo (Interlock): la impresora solo libera la etiqueta si el escaner leyo correctamente la ultima pieza empacada como "OK". No hay etiquetas sueltas en la mesa',
                            'Inspeccion Visual del Operador: el operador mira la etiqueta y la pieza antes de pegar. Poco confiable por "ceguera por repeticion"',
                            3, 7, 7
                        ),
                    ]
                ),

                // FM: Piezas rayadas / Marcas de abrasion (Scuffing)
                makeFail(
                    'Piezas rayadas / Marcas de abrasion (Scuffing). Dano en superficie A generado dentro de la caja',
                    'Reposicion de piezas urgente. Costo de mala calidad interna',
                    'Rechazo en inspeccion de recibo o linea. Retrabajo (pulido) si es leve, o scrap',
                    'Defecto estetico visible en el panel de puerta. Baja satisfaccion del cliente (Fit & Finish)',
                    4,
                    [
                        makeCause(
                            'Separadores (Dunnage) danados, sucios o con polvo excesivo: el material de proteccion (textil/espuma) ha perdido sus propiedades o tiene virutas de metal/plastico incrustadas',
                            'Plan de Limpieza de Contenedores: los contenedores se lavan/aspiran cada 5 vueltas (ciclos logisticos)',
                            'Inspeccion Visual de Contenedor: el operador revisa el estado del dunnage antes de poner la primera pieza',
                            5, 4, 4
                        ),
                    ]
                ),

                // FM: Cantidad incorrecta en el contenedor (Shortage)
                makeFail(
                    'Cantidad incorrecta en el contenedor (Shortage). Faltan piezas para completar el standard pack',
                    'Reclamo administrativo y ajuste de stock. Reposicion urgente de piezas faltantes',
                    'Problemas en el manejo de materiales. Si el cliente consume por "caja completa" y le falta una, le para la linea',
                    'Retraso en la entrega del vehiculo por falta de componente',
                    6,
                    [
                        makeCause(
                            'Distraccion del operador / Interrupcion del ciclo: el operador perdio la cuenta al ser interrumpido o empaco una pieza que luego saco por defecto y no repuso',
                            'Diseno del Contenedor (Poka-Yoke visual): el contenedor tiene "nidos" o espacios definidos. Si falta una pieza, queda un hueco vacio muy evidente',
                            'Inspeccion Visual final de "Caja Llena": antes de cerrar la tapa, se verifica que no haya huecos vacios',
                            6, 6, 6
                        ),
                    ]
                ),
            ]
        ),
    ]),

    makeWe('Man', 'Operador de Empaque / Lider de equipo', [
        makeFunc(
            'Colocar las piezas en el contenedor siguiendo el patron de estiba definido (sin forzarlas) y verificar visualmente que el contenedor este completo y libre de objetos extranos',
            '',
            []
        ),
    ]),

    makeWe('Method', 'Hoja de operaciones / Ayudas visuales', [
        makeFunc('Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un "No conforme"', '', []),
        makeFunc('Mostrar el patron de estiba correcto (orientacion, cantidad por capa, uso de separadores). Incluir limites de aceptacion/rechazo', '', []),
    ]),

    makeWe('Material', 'Top Roll Terminado / Contenedor Estandar / Separadores Internos / Etiqueta de Cliente / Bolsas Plasticas Protectoras', [
        makeFunc('Proveer proteccion fisica contra impactos, roces y deformaciones durante el transporte, y asegurar la separacion individual de las piezas', '', []),
        makeFunc('Comunicar de forma legible y escaneable la trazabilidad exigida', '', []),
    ]),

    makeWe('Environment', 'Iluminacion/Ruido / Ley 19587 / Decreto Reglamentario 351/79', [
        makeFunc('Mantener las condiciones de seguridad ocupacional segun la Ley 19587', '', []),
    ]),
]);

// ============================================================================
// Assemble the document
// ============================================================================

const doc: AmfeDocument = {
    header,
    operations: [OP5, OP10, OP11, OP20, OP30, OP40, OP50, OP60, OP70, OP80, OP90],
};

// ============================================================================
// Validate
// ============================================================================

const validation = validateAmfeDocument(doc);
if (!validation.valid) {
    console.error('VALIDATION FAILED:');
    validation.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
}

// ============================================================================
// Statistics
// ============================================================================

let totalOps = 0;
let totalWe = 0;
let totalFunc = 0;
let totalFail = 0;
let totalCauses = 0;
let apH = 0;
let apM = 0;
let apL = 0;
const _apMismatches: string[] = [];

for (const op of doc.operations) {
    totalOps++;
    for (const we of op.workElements) {
        totalWe++;
        for (const func of we.functions) {
            totalFunc++;
            for (const fail of func.failures) {
                totalFail++;
                for (const cause of fail.causes) {
                    totalCauses++;
                    if (cause.ap === 'H') apH++;
                    else if (cause.ap === 'M') apM++;
                    else if (cause.ap === 'L') apL++;
                }
            }
        }
    }
}

console.log('\n=== AMFE TOP ROLL - Statistics ===');
console.log(`Operations:     ${totalOps}`);
console.log(`Work Elements:  ${totalWe}`);
console.log(`Functions:      ${totalFunc}`);
console.log(`Failure Modes:  ${totalFail}`);
console.log(`Causes:         ${totalCauses}`);
console.log(`AP Distribution: H=${apH} M=${apM} L=${apL}`);
console.log(`Validation: PASSED`);

// ============================================================================
// Write JSON file
// ============================================================================

const outputDir = path.resolve(__dirname, 'output');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'AMFE TOP ROLL.json');
fs.writeFileSync(outputPath, JSON.stringify(doc, null, 2), 'utf-8');
console.log(`\nOutput: ${outputPath}`);
console.log('Done! Import this file via the AMFE module "Import JSON" feature.');
