#!/usr/bin/env node
/**
 * SEED: ARMREST DOOR PANEL — VWA / PATAGONIA
 *
 * Creates:
 *   1. AMFE document (23-page extraction, ~18 operations, ~100+ causes)
 *   2. PFD (Process Flow Diagram) from flujograma
 *   3. Control Plan generated from AMFE (AP=H or M)
 *   4. HO stubs (one sheet per operation)
 *   5. Product family "Armrest Patagonia" linking all 4 docs
 *
 * Usage: node scripts/seed-armrest.mjs
 */

import { randomUUID, createHash } from 'crypto';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

// ─── Config ─────────────────────────────────────────────────────────────────

const PROJECT_NAME = 'VWA/PATAGONIA/ARMREST';
const FAMILY_NAME = 'Armrest Patagonia';
const FAMILY_DESCRIPTION = 'Familia Armrest Door Panel para plataforma Patagonia VW';

// ─── Helpers ────────────────────────────────────────────────────────────────

const uuid = () => randomUUID();
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

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
        preventionAction: '', detectionAction: '',
        responsible: '', targetDate: '', status: '',
        actionTaken: '', completionDate: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
        observations: data.obs || '',
    };
}

function mkFailure(data) {
    return {
        id: uuid(),
        description: data.desc || '',
        effectLocal: data.efLocal || '',
        effectNextLevel: data.efClient || '',
        effectEndUser: data.efUser || '',
        severity: data.S ?? '',
        severityLocal: '', severityNextLevel: '', severityEndUser: '',
        causes: (data.causes || []).map(mkCause),
    };
}

function mkFunc(data) {
    return {
        id: uuid(),
        description: data.desc || '',
        requirements: data.req || '',
        failures: (data.failures || []).map(mkFailure),
    };
}

function mkWE(type, name, functions) {
    return {
        id: uuid(),
        type,
        name,
        functions: functions.map(mkFunc),
    };
}

function mkOp(opNumber, name, workElements) {
    return {
        id: uuid(),
        opNumber: String(opNumber),
        name,
        workElements,
    };
}

/** Standard WIP storage operation template */
function mkWipOp(opNumber, parentProcess, funcInternal, funcClient, funcUser) {
    return mkOp(opNumber, `${parentProcess} - ALMACENAMIENTO EN MEDIOS WIP`, [
        mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
            {
                desc: funcInternal,
                failures: [{
                    desc: 'Faltante/exceso de componentes en la caja del kit',
                    efLocal: 'Una porcion de la produccion sea descartada (scrap)', S: 7,
                    efClient: 'Parada de linea entre una hora y un turno de produccion completo',
                    efUser: 'Degradacion de la funcion secundaria del vehiculo',
                    causes: [
                        { cause: 'El Operador no realiza el conteo/verificacion completo de la cantidad de componentes segun la OP.', prev: 'Existencia de documentacion de proceso para la preparacion del kit', det: 'Verificacion manual o conteo visual del kit por parte del operador', O: 5, D: 7, ap: 'H', sc: 'SC' },
                    ],
                }, {
                    desc: 'Componente incorrecto (variante o color) incluido',
                    efLocal: 'Una porcion de la produccion afectada debe ser desechada', S: 7,
                    efClient: 'Parada de linea entre una hora y un turno de produccion completo',
                    efUser: 'Degradacion de la funcion secundaria del vehiculo',
                    causes: [
                        { cause: 'Mano de Obra no realiza la verificacion visual contra la Orden de Produccion (OP)', prev: 'La Orden de Produccion (OP) se encuentra disponible y formalizada', det: 'El operador realiza una verificacion visual del componente fisico contra el codigo listado en la OP', O: 5, D: 7, ap: 'H', sc: 'SC' },
                    ],
                }, {
                    desc: 'Pieza danada (rasgadura, mancha) incluida en el kit',
                    efLocal: 'Descartar (scrap) una porcion de la produccion', S: 8,
                    efClient: 'Parada de linea entre una hora y un turno de produccion completo',
                    efUser: 'Degradacion de la funcion secundaria del vehiculo',
                    causes: [
                        { cause: 'El Operador no sigue el procedimiento de revision visual de defectos', prev: 'Instruccion o procedimiento que establece revision visual antes de incluir la pieza en el kit', det: 'El operador realiza una inspeccion visual para detectar rasgadura/mancha antes de liberar el kit', O: 5, D: 8, ap: 'H', sc: 'SC' },
                    ],
                }],
            },
        ]),
        mkWE('Material', 'Etiquetas / Lapicera / Medios', [
            {
                desc: 'Proteger el producto y contener las piezas para asegurar su integridad',
                failures: [],
            },
        ]),
        mkWE('Machine', 'Zorras manuales', [
            {
                desc: 'Mantener la estabilidad de la carga durante el movimiento interno',
                failures: [],
            },
        ]),
    ]);
}

// ============================================================================
// AMFE DATA — Extracted from 23-page PDF
// ============================================================================

const header = {
    organization: 'BARACK MERCOSUL',
    location: 'PLANTA HURLINGHAM',
    client: 'VWA',
    modelYear: 'PATAGONIA',
    subject: 'ARMREST',
    startDate: '2026-02-11',
    revDate: '2026-02-11',
    team: 'Carlos Baptista Ingenieria, Manuel Meszaros Calidad, Cristina Rabago Seguridad e higiene, Marianna Vera Produccion',
    amfeNumber: 'AMFE-ARMREST-001',
    responsible: 'Carlos Baptista',
    confidentiality: '-',
    partNumber: 'ARMREST DOOR PANEL',
    processResponsible: 'Carlos Baptista',
    revision: 'A',
    approvedBy: '',
    scope: 'Proceso completo Armrest Door Panel',
    applicableParts: '',
};

// ── OPERATION 10: RECEPCION DE MATERIA PRIMA ─────────────────────────────
const op10 = mkOp(10, 'RECEPCIONAR MATERIA PRIMA', [
    mkWE('Machine', 'Autoelevador', [
        {
            desc: 'Garantizar la estabilidad y la integridad fisica del material durante el transporte interno',
            failures: [{
                desc: 'Material / pieza golpeada o danada durante transporte',
                efLocal: 'Riesgo de reproceso o scrap; paro de linea si no hay stock', S: 6,
                efClient: 'Potencial parada de linea',
                efUser: 'Posible ruido o falla estetica',
                causes: [
                    { cause: 'Mala estiba y embalaje inadecuado', prev: 'Medios de embalaje validados', det: 'Verificacion del estado del embalaje antes de que el camion salga o inmediatamente cuando llega', O: 6, D: 6, ap: 'M' },
                    { cause: 'Manipulacion incorrecta en transito', prev: 'Existencia de instrucciones de trabajo que definen como debe estibarse y manipularse el material', det: 'Inspeccion Visual de danos/suciedad en el empaque al recibir', O: 6, D: 6, ap: 'M' },
                    { cause: 'Almacenaje inadecuado en transporte (sin protecciones)', prev: 'Procedimientos de Logistica sobre estiba segura y uso de Embalajes Cubiertos o cerrados', det: 'Inspeccion Visual de danos/suciedad en el empaque al recibir', O: 5, D: 6, ap: 'M' },
                ],
            }],
        },
    ]),
    mkWE('Man', 'Operador de produccion / Operador de calidad', [
        {
            desc: 'Asegurar la conformidad de la calidad y cantidad de material recibido',
            failures: [{
                desc: 'Material con especificacion erronea (dimensiones, color, dureza, etc.)',
                efLocal: 'Montaje con ajuste forzado/imposibilidad de ensamblar', S: 7,
                efClient: 'Problemas de calidad durante el ensamble',
                efUser: 'Potencial reclamo de aspecto/comfort',
                causes: [
                    { cause: 'Proveedor no respeta tolerancias', prev: 'Requisitos Contractuales de Calidad y Auditorias al Proveedor', det: 'Revision del Certificado de Calidad (CoC) y Control Dimensional por Muestreo en recepcion', O: 6, D: 6, ap: 'H', sc: 'SC' },
                    { cause: 'Error en la orden de compra o ficha tecnica', prev: 'Revision de Ingenieria de la Ficha Tecnica/OC antes de la emision al proveedor', det: 'Control dimensional por muestreo en recepcion y Revision obligatoria del CoC', O: 5, D: 6, ap: 'H', sc: 'SC' },
                ],
            }, {
                desc: 'Contaminacion / suciedad en la materia prima',
                efLocal: 'Potencial scrap', S: 6,
                efClient: 'Potencial parada de linea',
                efUser: 'Potencial reclamo de aspecto/comfort',
                causes: [
                    { cause: 'Ambiente sucio en planta del proveedor', prev: 'Auditorias de Calidad', det: 'Inspeccion Visual de la pieza y Revision del Certificado de Calidad del proveedor', O: 6, D: 6, ap: 'M', sc: 'SC' },
                    { cause: 'Falta de inspeccion visual al recibir', prev: 'Instruccion de Trabajo de Recepcion que exige la verificacion fisica y visual del material', det: 'Inspeccion visual en recepcion', O: 5, D: 5, ap: 'M' },
                ],
            }, {
                desc: 'Falta de documentacion o trazabilidad',
                efLocal: 'Riesgo de mezclar lotes no conformes', S: 6,
                efClient: 'Dificultades en trazabilidad si surge un reclamo',
                efUser: 'Posible ruido o falla estetica',
                causes: [
                    { cause: 'Proveedor sin sistema robusto de trazabilidad', prev: 'Auditorias de Sistema y Requisitos que validan la capacidad de trazabilidad del proveedor', det: 'Verificacion del Certificado de Conformidad y registro obligatorio de lote en sistema de recepcion', O: 6, D: 6, ap: 'H', sc: 'SC' },
                    { cause: 'No se utiliza el sistema ARB', prev: 'Procedimiento Operacional Estandar que exige el uso del sistema ARB', det: 'El sistema impide la emision de ubicaciones o registro de entrada hasta que todos los campos del ARB sean completados', O: 3, D: 7, ap: 'M' },
                    { cause: 'Procesos administrativos deficientes', prev: 'El sistema ARB obliga a registrar lote y codigo en recepcion', det: 'Verificacion automatica del lote/codigo registrado contra la base de datos', O: 4, D: 4, ap: 'H' },
                ],
            }],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        {
            desc: 'Comprobar que el embalaje no este danado. Corroborar que la orden sea la correcta. Cargar la materia prima en ARB.',
            failures: [],
        },
    ]),
    mkWE('Material', 'Etiquetas blancas / Etiquetas de rechazo / Material indirecto', [
        {
            desc: 'Disponer de etiquetas blancas y etiquetas de rechazo para clasificacion',
            failures: [],
        },
    ]),
    mkWE('Measurement', 'Micrometro / Probeta de peeling / Probeta de flamabilidad / Calibres', [
        {
            desc: 'Verificar el cumplimiento y la trazabilidad de la materia prima recibida',
            failures: [],
        },
    ]),
    mkWE('Environment', 'Iluminacion/Ruido / Ley 19587 / Decreto Reglamentario', [
        {
            desc: 'Mantener las condiciones de seguridad ocupacional segun la Ley 19587',
            failures: [],
        },
    ]),
]);

// ── OPERATION 15: PREPARACION DE CORTE ───────────────────────────────────
const op15 = mkOp(15, 'CORTE DE COMPONENTES - PREPARACION DE CORTE', [
    mkWE('Man', 'Operador de produccion', [
        {
            desc: 'Proveer Material Cortado Conforme a Requerimientos Dimensionales y de Trazabilidad',
            failures: [{
                desc: 'Corte fuera de medida (pano mas corto o mas largo que la especificacion)',
                efLocal: 'Perdida de material (scrap)', S: 7,
                efClient: 'Imposibilidad de ensamblar la pieza, potencial paro de linea',
                efUser: 'Posible ruido o falla estetica',
                causes: [
                    { cause: 'Error del operario al medir con la regla metalica', prev: 'Medicion de la primera capa usando la regla metalica fija como referencia', det: 'No se realiza una medicion del pano una vez cortado', O: 5, D: 10, ap: 'H', sc: 'SC' },
                ],
            }, {
                desc: 'Contaminacion / suciedad en la materia prima',
                efLocal: 'Retrabajo', S: 6,
                efClient: 'Reclamo de aspecto',
                efUser: 'Posible ruido o falla estetica',
                causes: [
                    { cause: 'Ambiente sucio en planta del proveedor', prev: 'Instruccion de Trabajo', det: 'Inspeccion Visual del estado de la pieza/empaque', O: 6, D: 6, ap: 'M' },
                    { cause: 'Falta de inspeccion al llegar', prev: 'Auditorias de Calidad', det: 'Inspeccion Visual de la pieza y Revision del Certificado de Calidad del proveedor', O: 6, D: 6, ap: 'M' },
                ],
            }],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        {
            desc: 'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme',
            failures: [],
        },
    ]),
    mkWE('Machine', 'Zorras manuales / Cortadora de panos', [
        {
            desc: 'Ajustar el Rollo de Material con Firmeza y Estabilidad, Configurar parametros de corte, Medir los panos',
            failures: [],
        },
    ]),
    mkWE('Material', 'Tijera / Lapicera / Regla / Bandas elasticas', [
        {
            desc: 'Registrar Informacion de Trazabilidad o Clasificacion de Forma Clara y Permanente',
            failures: [],
        },
    ]),
    mkWE('Environment', 'Iluminacion/Ruido / Ley 19587', [
        {
            desc: 'Mantener las condiciones de seguridad ocupacional segun la Ley 19587',
            failures: [],
        },
    ]),
]);

// ── OPERATION 20: CORTE DE COMPONENTES ───────────────────────────────────
const op20 = mkOp(20, 'CORTE DE COMPONENTES DE VINILO O TELA', [
    mkWE('Machine', 'Maquina de corte', [
        {
            desc: 'Ejecutar el Corte del Material de Forma Constante, Pareja y Conforme a la Longitud Requerida',
            failures: [{
                desc: 'Seleccion incorrecta del material (vinilo mal identificado)',
                efLocal: '100% del material cortado es scrap por material incorrecto', S: 8,
                efClient: 'Parada de linea mayor a un turno de produccion completo. Paro de envios.',
                efUser: 'Degradacion de la funcion primaria del vehiculo',
                causes: [
                    { cause: 'Falta de verificacion del codigo de material antes del corte', prev: 'Orden Automatica del Sistema: emite la orden con los datos correctos', det: 'Inspeccion Visual (Hoja vs. Etiqueta): El operario compara visualmente la etiqueta del rollo contra la planilla de mesa', O: 5, D: 6, ap: 'H', sc: 'SC' },
                ],
            }, {
                desc: 'Corte incompleto o irregular',
                efLocal: 'Una porcion de la produccion tiene que ser descartada (scrap)', S: 7,
                efClient: 'Parada de linea entre una hora y un turno de produccion completo',
                efUser: 'Degradacion de la funcion secundaria del vehiculo',
                causes: [
                    { cause: 'Desgaste de la cuchilla de corte', prev: 'Cambio de cuchillas por calendario u horas de uso', det: 'Set up de lanzamiento / Regla / Inspeccion visual', O: 5, D: 7, ap: 'M', sc: 'SC' },
                    { cause: 'Falla en la maquina', prev: 'Mantenimiento preventivo', det: 'Inspeccion visual', O: 3, D: 6, ap: 'L' },
                ],
            }, {
                desc: 'Contaminacion del material durante el corte o almacenamiento',
                efLocal: 'Retrabajo', S: 6,
                efClient: 'Reclamo de aspecto',
                efUser: 'Degradacion de la funcion secundaria del vehiculo',
                causes: [
                    { cause: 'Ambiente de trabajo con polvo o particulas', prev: 'Procedimientos de limpieza periodica', det: 'Inspeccion visual (El operador verifica visualmente el material)', O: 5, D: 6, ap: 'L' },
                ],
            }, {
                desc: 'Desviacion en el corte de los pliegos',
                efLocal: 'Retrabajo', S: 7,
                efClient: 'Parada de linea entre una hora y un turno',
                efUser: 'Degradacion de la funcion secundaria del vehiculo',
                causes: [
                    { cause: 'Parametros de corte mal ingresados', prev: 'La maquina alinea y corta automaticamente el vinilo/tela', det: 'Inspeccion visual', O: 8, D: 3, ap: 'H', sc: 'SC' },
                    { cause: 'Instructivo para colocar correctamente tension y velocidad de rollo', prev: 'Instructivo de tension/velocidad', det: 'Inspección visual', O: 7, D: 6, ap: 'L' },
                ],
            }],
        },
    ]),
    mkWE('Man', 'Operador de produccion / Lider de equipo', [
        {
            desc: 'Lograr el Contorno/Forma Geometrica del patron Conforme al Mylar',
            failures: [],
        },
    ]),
    mkWE('Measurement', 'Mylar de control', [
        {
            desc: 'Asegurar la conformidad dimensional del contorno cortado',
            failures: [],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        {
            desc: 'Utilizar la Hoja de Operaciones vigente',
            failures: [],
        },
    ]),
    mkWE('Material', 'Etiquetas / Tijera / Bandas elasticas / Lapicera', [
        {
            desc: 'Asegurar la Trazabilidad Univoca y la Clasificacion Correcta del Producto',
            failures: [],
        },
    ]),
    mkWE('Environment', 'Iluminacion/Ruido / Ley 19587', [
        {
            desc: 'Mantener las condiciones de seguridad ocupacional segun la Ley 19587',
            failures: [],
        },
    ]),
]);

// ── OPERATION 25: CONTROL CON MYLAR ──────────────────────────────────────
const op25 = mkOp(25, 'CORTE DE COMPONENTES - CONTROL CON MYLAR', [
    mkWE('Man', 'Operador de produccion', [
        {
            desc: 'Verificar la conformidad dimensional del contorno cortado',
            failures: [{
                desc: 'Omitir la operacion de inspeccion',
                efLocal: 'Parada de linea de produccion menor a una hora', S: 6,
                efClient: 'Necesidad de incorporar procesos adicionales de clasificacion',
                efUser: 'Perdida de la funcion secundaria del vehiculo',
                causes: [
                    { cause: 'Operador de produccion omite la tarea de verificacion visual', prev: 'Instruccion/Checklist de Set Up', det: 'Auditorias internas', O: 3, D: 9, ap: 'H', sc: 'SC' },
                ],
            }, {
                desc: 'Contaminacion del material durante el corte o almacenamiento',
                efLocal: 'Retrabajo de una porcion de la produccion', S: 6,
                efClient: 'Defecto visual moderado en apariencia o vibracion',
                efUser: 'Menos del 10% de los productos afectados',
                causes: [
                    { cause: 'Ambiente de trabajo con polvo o particulas', prev: 'Procedimientos de limpieza periodica en el area de corte', det: 'Inspeccion visual (El operador verifica visualmente el material)', O: 5, D: 6, ap: 'L' },
                ],
            }],
        },
    ]),
    mkWE('Machine', 'Mylar de control', [
        {
            desc: 'Asegurar la Verificacion Rapida y Precisa de la Geometria y el Contorno del Corte',
            failures: [],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        {
            desc: 'Utilizar la Hoja de Operaciones vigente',
            failures: [],
        },
    ]),
    mkWE('Environment', 'Iluminacion/Ruido / Ley 19587', [
        {
            desc: 'Mantener las condiciones de seguridad ocupacional segun la Ley 19587',
            failures: [],
        },
    ]),
]);

// ── OPERATION 30: ALMACENAMIENTO EN MEDIOS WIP ──────────────────────────
const op30 = mkWipOp(30, 'CORTE DE COMPONENTES',
    'Preparar Kit completo y ordenado de componentes segun la Orden de Produccion; Contener componentes en medios definidos; Etiquetar caja; Mover kits a la zona de costura.',
    'Permitir el Ensamble de la Pieza',
    'Garantizar la Apariencia Estetica del Interior'
);

// ── OPERATION 40: REFILADO ───────────────────────────────────────────────
const op40 = mkOp(40, 'COSTURA - REFILADO', [
    mkWE('Machine', 'Maquina refiladora', [
        {
            desc: 'Generar la dimension de refilado segun especificacion en la ubicacion correcta',
            failures: [{
                desc: 'Posicionado de cortes NOK',
                efLocal: 'Scrap potencial / 100% de Retrabajo', S: 7,
                efClient: 'Parada de linea entre una hora y un turno de produccion completo',
                efUser: 'Degradacion de la funcion secundaria',
                causes: [
                    { cause: 'Operador posiciona el corte en la refiladora fuera de la tolerancia marcada en la ayuda visual / instruccion', prev: 'Ayudas Visuales y Instruccion de Proceso (HO)', det: 'Control Visual del Operario (Inspeccion 100%) / Piezas Patron de Referencia', O: 7, D: 6, ap: 'M', sc: 'SC' },
                ],
            }, {
                desc: 'Refilado fuera de especificaciones',
                efLocal: '100% Retrabajo fuera de linea o Scrap', S: 7,
                efClient: 'Parada de linea de produccion menor a una hora',
                efUser: 'Perdida/Degradacion de la funcion secundaria',
                causes: [
                    { cause: 'Cuchilla desafilada / desgastada', prev: 'Mantenimiento Preventivo', det: 'Inspeccion de Primera Pieza (Verificacion del Set Up)', O: 6, D: 6, ap: 'M', sc: 'SC' },
                    { cause: 'Operador posiciona el corte fuera de la tolerancia', prev: 'Ayudas Visuales y Instruccion de Proceso (HO)', det: 'Control Visual del Operario (Inspeccion 100%) / Piezas Patron de Referencia', O: 7, D: 6, ap: 'L', sc: 'SC' },
                ],
            }],
        },
    ]),
    mkWE('Man', 'Operador de produccion / Lider de equipo', [
        {
            desc: 'Posicionar el componente y accionar el ciclo de la maquina refiladora conforme a la instruccion',
            failures: [],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        {
            desc: 'Utilizar la Hoja de Operaciones vigente',
            failures: [],
        },
    ]),
]);

// ── OPERATION 50: COSTURA UNION ──────────────────────────────────────────
const op50 = mkOp(50, 'COSTURA - COSTURA UNION', [
    mkWE('Machine', 'Maquina de coser', [
        {
            desc: 'Permite la union de los paneles. Costura union entre paneles.',
            failures: [{
                desc: 'Costura descosida o debil',
                efLocal: 'Impacta en produccion, genera scrap o retrabajos', S: 8,
                efClient: 'Puede causar fallas en ensamble y rechazo del lote',
                efUser: 'Defecto estetico sin impacto funcional',
                causes: [
                    { cause: 'Tension de hilo incorrecta', prev: 'Las costureras configuran la maquina segun hojas de operaciones', det: 'Calibre para verificar puntadas', O: 4, D: 4, ap: 'M' },
                    { cause: 'Puntadas demasiado largas', prev: 'Checklist diaria de configuracion de maquina, set-up de control de lanzamiento', det: 'Inspeccion visual', O: 4, D: 4, ap: 'M' },
                    { cause: 'Hilo inadecuado', prev: 'Las hojas de operaciones indican que hilo utilizar', det: 'Visual', O: 5, D: 6, ap: 'M' },
                ],
            }, {
                desc: 'Costura desviada o fuera de especificacion',
                efLocal: 'Scrap', S: 8,
                efClient: 'Defecto estetico, posible rechazo del lote',
                efUser: 'Defecto estetico sin impacto funcional',
                causes: [
                    { cause: 'Falta de guia en costura', prev: 'Las maquinas poseen una guia', det: 'Inspeccion visual en linea', O: 4, D: 4, ap: 'M' },
                    { cause: 'Error del operario', prev: 'Verificacion de piquetes en piezas antes de coser para asegurar alineacion correcta', det: 'Uso de plantillas de referencia / Registros de control segun plan de control', O: 5, D: 5, ap: 'M' },
                ],
            }, {
                desc: 'Puntadas irregulares o arrugas',
                efLocal: 'Puede corregirse en produccion', S: 4,
                efClient: 'Puede provocar rechazo por calidad visual',
                efUser: 'No afecta funcionalidad, pero impacta percepcion de calidad',
                causes: [
                    { cause: 'Mala configuracion de la maquina', prev: 'Mantenimiento preventivo', det: 'Visual', O: 6, D: 6, ap: 'M' },
                ],
            }],
        },
    ]),
    mkWE('Man', 'Operador / Lider de equipo / Supervisor', [
        {
            desc: 'Tomar la pieza en produccion, alinear ambas puntas de los cortes y realizar la costura de union',
            failures: [],
        },
    ]),
    mkWE('Method', 'Hoja de Operacion', [
        {
            desc: 'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme.',
            failures: [],
        },
    ]),
    mkWE('Environment', 'Iluminacion 1500 Lux / Ley 19587', [
        {
            desc: 'Mantener las condiciones de seguridad ocupacional',
            failures: [],
        },
    ]),
]);

// ── OPERATION 51: COSTURA DOBLE ──────────────────────────────────────────
const op51 = mkOp(51, 'COSTURA - COSTURA DOBLE', [
    mkWE('Machine', 'Maquina de coser', [
        {
            desc: 'Permite la costura decorativa. Realiza costura decorativa.',
            failures: [{
                desc: 'Costura descosida o debil',
                efLocal: 'Impacta en produccion, genera scrap o retrabajos', S: 8,
                efClient: 'Puede causar fallas en ensamble y rechazo del lote',
                efUser: 'Defecto estetico sin impacto funcional',
                causes: [
                    { cause: 'Tension de hilo incorrecta', prev: 'Las costureras configuran la maquina segun hojas de operaciones', det: 'Calibre para verificar puntadas', O: 4, D: 4, ap: 'M' },
                    { cause: 'Puntadas demasiado largas', prev: 'Checklist diaria de configuracion de maquina, set-up de control de lanzamiento', det: 'Inspeccion visual', O: 4, D: 4, ap: 'M' },
                    { cause: 'Hilo inadecuado', prev: 'Las hojas de operaciones indican que hilo utilizar', det: 'Visual', O: 5, D: 6, ap: 'M' },
                ],
            }, {
                desc: 'Costura desviada o fuera de especificacion',
                efLocal: 'Scrap', S: 8,
                efClient: 'Defecto estetico, posible rechazo del lote',
                efUser: 'Defecto estetico sin impacto funcional',
                causes: [
                    { cause: 'Falta de guia en costura', prev: 'Las maquinas poseen una guia', det: 'Inspeccion visual en linea', O: 4, D: 4, ap: 'M' },
                    { cause: 'Error del operario', prev: 'Verificacion de piquetes en piezas antes de coser', det: 'Uso de plantillas de referencia', O: 5, D: 5, ap: 'M' },
                ],
            }, {
                desc: 'Puntadas irregulares o arrugas',
                efLocal: 'Puede provocar rechazo por calidad visual', S: 4,
                efClient: 'Puede provocar rechazo por calidad visual',
                efUser: 'No afecta funcionalidad, solo estetica',
                causes: [
                    { cause: 'Mala configuracion de la maquina', prev: 'Mantenimiento preventivo', det: 'Visual', O: 6, D: 6, ap: 'M' },
                    { cause: 'Falta de mantenimiento', prev: 'Mantenimiento preventivo', det: 'Visual', O: 4, D: 4, ap: 'M' },
                ],
            }, {
                desc: 'Rotura del vinilo en la zona de la costura',
                efLocal: 'Scrap o retrabajo', S: 8,
                efClient: 'Pieza no conforme, posible rechazo total',
                efUser: 'Puede causar falla en el uso, riesgo de seguridad',
                causes: [
                    { cause: 'Agujas inadecuadas', prev: 'Se utilizan agujas especificas para vinilos', det: 'Inspeccion visual', O: 3, D: 6, ap: 'M' },
                    { cause: 'Puntada demasiado apretada', prev: 'Se configura la longitud de la puntada en la maquina', det: 'Inspeccion visual', O: 3, D: 6, ap: 'M' },
                ],
            }, {
                desc: 'Seleccion incorrecta del hilo',
                efLocal: 'Detectable en linea de produccion', S: 6,
                efClient: 'Puede generar rechazo por incumplimiento de especificaciones',
                efUser: 'No afecta funcionalidad, solo percepcion de calidad',
                causes: [
                    { cause: 'Error en la carga de hilo en maquina', prev: 'Las hojas de operaciones indican que hilo utilizar', det: 'Visual', O: 2, D: 6, ap: 'M' },
                ],
            }, {
                desc: 'Largo de puntada fuera de especificacion',
                efLocal: 'Scrap', S: 8,
                efClient: 'Puede generar rechazo por incumplimiento de especificaciones',
                efUser: 'Potencial reclamo de aspecto',
                causes: [
                    { cause: 'Error en la configuracion de la maquina', prev: 'Configuracion de la maquina segun especificaciones', det: 'Calibre', O: 5, D: 6, ap: 'M' },
                ],
            }, {
                desc: 'Toma de costura fuera de especificacion',
                efLocal: 'Scrap', S: 8,
                efClient: 'Puede generar rechazo por incumplimiento de especificaciones',
                efUser: 'Potencial reclamo de aspecto',
                causes: [
                    { cause: 'Error en la configuracion de la maquina', prev: 'Configuracion de la maquina segun especificaciones', det: 'Calibre', O: 5, D: 6, ap: 'M' },
                ],
            }],
        },
    ]),
    mkWE('Man', 'Operador / Lider de equipo / Supervisor', [
        {
            desc: 'Posicionar la pieza en la maquina y realizar la costura vista segun lo especificado',
            failures: [],
        },
    ]),
    mkWE('Method', 'Hoja de Operacion', [
        { desc: 'Utilizar la Hoja de Operaciones vigente', failures: [] },
    ]),
    mkWE('Environment', 'Iluminacion 1500 Lux / Ley 19587', [
        { desc: 'Mantener las condiciones de seguridad ocupacional', failures: [] },
    ]),
]);

// ── OPERATION 52: ALMACENAMIENTO EN MEDIOS WIP (COSTURA) ────────────────
const op52 = mkWipOp(52, 'COSTURA',
    'Preparar Kit completo y ordenado; Etiquetar caja; Mover kits a la zona de prearmado.',
    'Permitir el Ensamble de la Pieza',
    'Acabado estetico'
);

// ── OPERATION 60: INYECCION DE PIEZAS PLASTICAS ─────────────────────────
const op60 = mkOp(60, 'INYECCION PLASTICA - INYECCION DE PIEZAS PLASTICAS', [
    mkWE('Machine', 'Maquina inyectora de plastico', [
        {
            desc: 'Moldear la pieza plastica inyectando la materia prima en la cavidad, asegurando la geometria, dimensiones y apariencia',
            failures: [{
                desc: 'Llenado Incompleto de Pieza',
                efLocal: '100% de la produccion en ese ciclo tiene que ser Scrapeada', S: 9,
                efClient: 'Parada de linea mayor a un turno de produccion completo o paro de envios',
                efUser: 'Perdida de la Funcion Primaria del vehiculo',
                causes: [
                    { cause: 'Presion de Inyeccion configurada fuera de especificacion', prev: 'Monitoreo automatico de presion y mantenimiento preventivo con calibracion periodica de sensores', det: 'Deteccion automatica de llenado incompleto / Inspeccion visual por parte del operador', O: 5, D: 5, ap: 'H', sc: 'SC' },
                    { cause: 'Temperatura de fusion del material demasiado baja', prev: 'Programa de Mantenimiento y Calibracion del Sistema Termico Y Verificacion Estandar de la Configuracion de Potencia', det: 'Verificacion Visual y Dimensional de la Primera Pieza tras el set-up o cambio de turno', O: 4, D: 8, ap: 'H', sc: 'SC' },
                ],
            }, {
                desc: 'Omitir la operacion de inspeccion dimensional de cotas index',
                efLocal: 'Una porcion de la produccion requiere Retrabajo Fuera de Linea', S: 8,
                efClient: 'Se desencadena un Plan de Reaccion Importante',
                efUser: 'Degradacion de la Funcion Secundaria',
                causes: [
                    { cause: 'Operador omite la verificacion dimensional de la cota index', prev: 'Lista de Verificacion (Checklist) para asegurar que el paso se incluya al inicio del turno', det: 'Auditoria de Proceso', O: 5, D: 5, ap: 'M' },
                    { cause: 'Instruccion de trabajo ambigua sobre la frecuencia o metodologia de la inspeccion de cota index', prev: 'Las Hojas de Proceso describen el metodo operativo y las pautas de control', det: 'Cada dos meses se verifica una pieza con su documentacion', O: 4, D: 5, ap: 'M' },
                ],
            }, {
                desc: 'Rebaba Excesiva / Exceso de Material',
                efLocal: '100% de la produccion tiene que ser Retrabajada Fuera de Linea', S: 7,
                efClient: 'Parada de linea de produccion menor a una hora',
                efUser: 'Perdida de la Funcion Secundaria del vehiculo',
                causes: [
                    { cause: 'Fuerza de Cierre insuficiente', prev: 'Mantenimiento Preventivo programado de la Unidad de Cierre / Instruccion de Set-up para configuracion de Clamping Force', det: 'Monitoreo Automatico de Presion de Cierre / Inspeccion dimensional manual por muestreo', O: 5, D: 3, ap: 'L' },
                    { cause: 'Molde o cavidad contaminada con material residual', prev: 'Procedimiento de limpieza y purga estandarizado para la cavidad y linea de particion del molde', det: 'Aprobacion de la Primera Pieza: Inspeccion de parametros y verificacion dimensional por Calidad/Supervision', O: 5, D: 8, ap: 'M' },
                    { cause: 'Parametros de Inyeccion configurados incorrectamente', prev: 'Instruccion de Set-up Estandarizada (Plan de Control / Hoja de Proceso)', det: 'Monitoreo Automatico de Parametros', O: 7, D: 5, ap: 'H', sc: 'SC' },
                    { cause: 'Mantenimiento Preventivo del molde para verificar el correcto sellado de la linea de particion', prev: 'Mantenimiento Preventivo del molde', det: 'Inspeccion visual por parte del operador de la cavidad', O: 5, D: 8, ap: 'M' },
                    { cause: 'Mantenimiento Preventivo y Calibracion de Sensores de la maquina', prev: 'Mantenimiento Preventivo y Calibracion de Sensores', det: 'Monitoreo Automatico de Parametros', O: 8, D: 5, ap: 'M' },
                ],
            }],
        },
    ]),
    mkWE('Man', 'Operador de produccion / Lider de equipo', [
        {
            desc: 'Descargar la pieza y realizar la inspeccion visual al 100% para segregar defectos como rebabas y/o quemaduras',
            failures: [],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        { desc: 'Utilizar la Hoja de Operaciones vigente', failures: [] },
    ]),
    mkWE('Material', 'Etiquetas / Lapicera / Medios', [
        { desc: 'Proteger el producto, Identificar Producto/Kit, Asegurar Trazabilidad', failures: [] },
    ]),
    mkWE('Environment', 'Iluminacion/Ruido / Ley 19587', [
        { desc: 'Mantener las condiciones de seguridad ocupacional', failures: [] },
    ]),
]);

// ── OPERATION 61: ALMACENAMIENTO EN MEDIOS WIP (INYECCION PLASTICA) ─────
const op61 = mkWipOp(61, 'INYECCION PLASTICA',
    'Preparar Kit completo y ordenado; Etiquetar caja; Mover kits a la zona de prearmado.',
    'Permitir el Montaje/Ensamble Exitoso de la Pieza',
    'Acabado estetico'
);

// ── OPERATION 70: INYECCION PU ───────────────────────────────────────────
const op70 = mkOp(70, 'INYECCION PU', [
    mkWE('Machine', 'Inyectora de PUR', [
        {
            desc: 'Se sobreinyecta la espuma de poliuretano sobre la cubierta plastica exterior de la pieza',
            failures: [{
                desc: 'Vertido incorrecto de mezcla sobre molde',
                efLocal: 'Retrabajo / nueva inyeccion', S: 5,
                efClient: 'Scrap',
                efUser: 'Rechazo de la Pieza',
                causes: [
                    { cause: 'Error de operario', prev: 'Uso de ayudas visuales / hoja de Operaciones', det: 'Control visual del operario', O: 3, D: 7, ap: 'M' },
                ],
            }, {
                desc: 'Inyeccion incompleta o exceso de material en el molde',
                efLocal: 'Retrabajo / nueva inyeccion', S: 5,
                efClient: 'Potencial retrabajo',
                efUser: 'Rechazo de la pieza',
                causes: [
                    { cause: 'Falla de dispositivo', prev: 'Plan de mantenimiento segun cronograma', det: 'Control visual del operario', O: 2, D: 7, ap: 'M' },
                ],
            }, {
                desc: 'Aplicacion de forma no uniforme de desmoldante',
                efLocal: 'Retrabajo / nueva inyeccion', S: 5,
                efClient: 'Scrap',
                efUser: 'Rechazo de la Pieza',
                causes: [
                    { cause: 'Error de operario', prev: 'Uso de ayudas visuales / hoja de Operaciones', det: 'Control visual del operario', O: 3, D: 7, ap: 'M' },
                ],
            }, {
                desc: 'Colocar cabezal fuera de la referencia definida',
                efLocal: 'Retrabajo / nueva inyeccion', S: 5,
                efClient: 'Scrap',
                efUser: 'Rechazo de la Pieza',
                causes: [
                    { cause: 'Error de operario', prev: 'Uso de ayudas visuales / hoja de Operaciones', det: 'Control visual del operario', O: 3, D: 7, ap: 'M' },
                ],
            }, {
                desc: 'Colocacion de Material en tanque incorrecto',
                efLocal: 'Retrabajo / nueva inyeccion', S: 5,
                efClient: 'Scrap',
                efUser: 'Rechazo de la Pieza',
                causes: [
                    { cause: 'Error de operario', prev: 'Uso de ayudas visuales / hoja de Operaciones', det: 'Control visual del operario', O: 3, D: 7, ap: 'M' },
                ],
            }, {
                desc: 'Colocar fuera del tacho de limpieza el cabezal de inyeccion luego de inyectar',
                efLocal: 'No afecta el proceso', S: 5,
                efClient: 'Potencial retrabajo',
                efUser: 'No afecta',
                causes: [
                    { cause: 'Error de operario', prev: 'Uso de ayudas visuales / hoja de Operaciones', det: 'Control visual del operario', O: 2, D: 5, ap: 'M' },
                ],
            }, {
                desc: 'Retirar de forma incorrecta la pieza dentro del molde',
                efLocal: 'Retrabajo / nueva inyeccion', S: 5,
                efClient: 'Scrap',
                efUser: 'Rechazo de la Pieza',
                causes: [
                    { cause: 'Error de operario', prev: 'Uso de ayudas visuales / hoja de Operaciones', det: 'Control visual del operario', O: 3, D: 7, ap: 'M' },
                ],
            }, {
                desc: 'Retirar la pieza antes de los 4 min de curado',
                efLocal: 'Retrabajo / nueva inyeccion', S: 5,
                efClient: 'Scrap',
                efUser: 'Rechazo de la Pieza',
                causes: [
                    { cause: 'Error de operario', prev: 'Hojas de operaciones', det: 'Control visual del operario', O: 3, D: 7, ap: 'M' },
                ],
            }, {
                desc: 'Peso de la pieza distinto de 420 +/- 25 grs',
                efLocal: 'Potencial retrabajo', S: 7,
                efClient: 'Reclamo de calidad',
                efUser: 'Potencial efecto en vida util de la pieza',
                causes: [
                    { cause: 'Error de operario', prev: 'Hojas de operaciones', det: 'Se realizan 3 controles por turno (al inicio, a mitad y al final) utilizando una balanza', O: 3, D: 5, ap: 'M' },
                ],
            }],
        },
    ]),
    mkWE('Man', 'Operador', [
        {
            desc: 'Realizar operacion de inyeccion PU: aplicar desmoldante, posicionar colada, inyectar, curar, extraer pieza',
            failures: [],
        },
    ]),
    mkWE('Method', 'Hoja de operacion', [
        { desc: 'Estandarizar a los operadores como utilizar la maquinaria', failures: [] },
    ]),
    mkWE('Measurement', 'Registros de control / Control visual / Balanza', [
        { desc: 'Registros de control en calidad segun plan de control', failures: [] },
    ]),
    mkWE('Environment', 'Ley 19587 / Reglamentacion 886', [
        { desc: 'Mantener las condiciones de seguridad ocupacional', failures: [] },
    ]),
]);

// ── OPERATION 71: PREARMADO DE ESPUMA ────────────────────────────────────
const op71 = mkOp(71, 'PREARMADO - PREARMADO DE ESPUMA', [
    mkWE('Man', 'Operador de produccion / Lider de equipo', [
        {
            desc: 'Adherir espuma a pieza plastica, asegurando una alineacion correcta',
            failures: [{
                desc: 'Espuma se suelta',
                efLocal: 'Potencial Scrap', S: 7,
                efClient: 'Reclamo de comfort',
                efUser: 'Potencial faltante en ergonomia',
                causes: [
                    { cause: 'Error del operario: Incorrecta colocacion del separador de espuma', prev: 'Ayudas Visuales: Piezas patron y Hoja de operacion estandar', det: 'Control visual del operario / Set Up: Autocontrol visual', O: 7, D: 8, ap: 'H', sc: 'SC' },
                ],
            }],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        { desc: 'Utilizar la Hoja de Operaciones vigente', failures: [] },
    ]),
    mkWE('Environment', 'Ley 19587 / Reglamentacion 886', [
        { desc: 'Mantener las condiciones de seguridad ocupacional', failures: [] },
    ]),
]);

// ── OPERATION 72: ENSAMBLE DE SUSTRATO CON ESPUMA / WIP (INYECCION PU) ──
const op72 = mkOp(72, 'INYECCION PU - ALMACENAMIENTO EN MEDIOS WIP', [
    mkWE('Man', 'Operador de produccion', [
        {
            desc: 'Embalar las piezas correctamente en su medio intermedio de almacenamiento',
            failures: [{
                desc: 'Cantidad de piezas incorrecta en medio definido',
                efLocal: 'Retrabajo / nueva inyeccion', S: 5,
                efClient: 'Potencial retrabajo',
                efUser: 'No afecta',
                causes: [
                    { cause: 'Error de operario', prev: 'Uso de ayudas visuales / hoja de Operaciones', det: 'Control visual del operario', O: 3, D: 7, ap: 'M' },
                ],
            }, {
                desc: 'Piezas danadas por no respetar disposicion',
                efLocal: 'Retrabajo / nueva inyeccion', S: 5,
                efClient: 'Scrap',
                efUser: 'Rechazo de la Pieza',
                causes: [
                    { cause: 'Error de operario', prev: 'Uso de ayudas visuales / hoja de Operaciones', det: 'Control visual del operario', O: 3, D: 7, ap: 'M' },
                ],
            }, {
                desc: 'Medio equivocado',
                efLocal: 'Retrabajo / nueva inyeccion', S: 5,
                efClient: 'Potencial retrabajo',
                efUser: 'No afecta',
                causes: [
                    { cause: 'Error de operario', prev: 'Uso de ayudas visuales / hoja de Operaciones', det: 'Control visual del operario', O: 2, D: 7, ap: 'M' },
                ],
            }, {
                desc: 'Peso de la pieza distinto de 420 +/- 25 grs',
                efLocal: 'Potencial retrabajo', S: 7,
                efClient: 'Reclamo de calidad',
                efUser: 'Potencial efecto en vida util de la pieza',
                causes: [
                    { cause: 'Error de operario', prev: 'Hojas de operaciones', det: 'Se realizan 3 controles por turno utilizando una balanza', O: 3, D: 5, ap: 'M' },
                ],
            }],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        { desc: 'Utilizar la Hoja de Operaciones vigente', failures: [] },
    ]),
]);

// ── OPERATION 80: ADHESIVADO ─────────────────────────────────────────────
const op80 = mkOp(80, 'ADHESIVADO - ADHESIVAR PIEZAS', [
    mkWE('Machine', 'Pistola de adhesivado', [
        {
            desc: 'Aplicar adhesivo y unir piezas, logrando una adhesion completa y uniforme',
            failures: [{
                desc: 'Adhesion insuficiente o fuera de especificacion',
                efLocal: 'Scrap (100% de la produccion debe ser descartada)', S: 8,
                efClient: 'Parada de linea de ensamblaje en el cliente',
                efUser: 'Degradacion de la funcion primaria del vehiculo / Reclamo de aspecto',
                causes: [
                    { cause: 'Uso de adhesivo o reticulante vencido/degradado (Mala gestion de Materiales)', prev: 'Set-up de lanzamiento: Verificacion manual de fechas de caducidad', det: 'Gestion de stock (FIFO)', O: 4, D: 5, ap: 'H', sc: 'SC' },
                    { cause: 'Proporcion de mezcla incorrecta', prev: 'Hoja de proceso detalla como realizar la mezcla correctamente', det: 'Inspeccion visual: El operador mira la mezcla', O: 7, D: 8, ap: 'H', sc: 'SC' },
                    { cause: 'Exceso o falta de adhesivo', prev: 'Instrucciones de proceso: Documento estandar', det: 'Pieza patron e Inspeccion visual: Comparacion visual contra muestra limite', O: 6, D: 8, ap: 'H', sc: 'SC' },
                ],
            }],
        },
    ]),
    mkWE('Man', 'Operador de produccion / Lider de equipo', [
        {
            desc: 'Posicionar el componente y aplicar adhesivo conforme a la instruccion',
            failures: [],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        { desc: 'Utilizar la Hoja de Operaciones vigente', failures: [] },
    ]),
    mkWE('Material', 'Medios', [
        { desc: 'Proteger el producto y contener las piezas', failures: [] },
    ]),
    mkWE('Environment', 'Iluminacion/Ruido / Ley 19587', [
        { desc: 'Mantener las condiciones de seguridad ocupacional', failures: [] },
    ]),
]);

// ── OPERATION 81: INSPECCION DE PIEZA ADHESIVADA ─────────────────────────
const op81 = mkOp(81, 'ADHESIVADO - INSPECCIONAR PIEZA ADHESIVADA', [
    mkWE('Man', 'Operador de produccion / Lider de equipo', [
        {
            desc: 'Verificar la conformidad de la adhesion y la caracteristica visual del producto',
            failures: [{
                desc: 'Adhesion insuficiente o fuera de especificacion',
                efLocal: 'Scrap (100% de la produccion debe ser descartada)', S: 8,
                efClient: 'Parada de linea de ensamblaje en el cliente',
                efUser: 'Degradacion de la funcion primaria del vehiculo / Reclamo de aspecto',
                causes: [
                    { cause: 'Uso de adhesivo o reticulante vencido/degradado', prev: 'Set-up de lanzamiento: Verificacion manual de fechas de caducidad', det: 'Gestion de stock (FIFO)', O: 4, D: 5, ap: 'H', sc: 'SC' },
                    { cause: 'Proporcion de mezcla incorrecta', prev: 'Hoja de proceso detalla como realizar la mezcla correctamente', det: 'Inspeccion visual: El operador mira la mezcla', O: 7, D: 8, ap: 'H', sc: 'SC' },
                    { cause: 'Exceso o falta de adhesivo', prev: 'Instrucciones de proceso: Documento estandar', det: 'Pieza patron e Inspeccion visual', O: 6, D: 8, ap: 'H', sc: 'SC' },
                ],
            }],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        { desc: 'Utilizar la Hoja de Operaciones vigente', failures: [] },
    ]),
    mkWE('Material', 'Medios', [
        { desc: 'Proteger el producto y contener las piezas', failures: [] },
    ]),
]);

// ── OPERATION 82: ALMACENAMIENTO EN MEDIOS WIP (ADHESIVADO) ─────────────
const op82 = mkWipOp(82, 'ADHESIVADO',
    'Preparar Kit completo; Etiquetar caja; Mover kits a la zona de adhesivado.',
    'Permitir el montaje correcto del componente en el vehiculo',
    'Contribuir a la durabilidad o estetica/confort del vehiculo'
);

// ── OPERATION 90: TAPIZADO SEMIAUTOMATICO (Operacion 100 in PDF) ────────
const op90 = mkOp(90, 'TAPIZADO - TAPIZADO SEMIAUTOMATICO', [
    mkWE('Machine', 'Maquina de tapizado semiautomatico / Troqueladora puente', [
        {
            desc: 'Adherir el vinilo al sustrato del IP en la zona principal asegurando la posicion y el pegado segun especificacion',
            failures: [{
                desc: 'El operador intenta quitar la pieza durante el proceso de tapizado antes de finalizado',
                efLocal: 'Scrap', S: 10,
                efClient: 'Parada de linea',
                efUser: 'Riesgo para la salud del operador',
                causes: [
                    { cause: 'Error del operario', prev: 'Sensor de proximidad: Incorporado a la maquina (Barrera de luz / Interlock)', det: 'Visual', O: 1, D: 2, ap: 'L', sc: 'CC' },
                ],
            }, {
                desc: 'Vinilo despegado (falta / ausencia de adhesivo)',
                efLocal: 'Scrap', S: 8,
                efClient: 'Parada de linea',
                efUser: 'Potencial reclamo',
                causes: [
                    { cause: 'Falta / ausencia de adhesivo', prev: 'Hojas de operaciones / ayudas visuales', det: 'Visual', O: 5, D: 8, ap: 'H', sc: 'SC' },
                ],
            }, {
                desc: 'Se coloca una pieza plastica de otro producto',
                efLocal: 'Scrap', S: 8,
                efClient: 'Parada de linea',
                efUser: 'Potencial reclamo',
                causes: [
                    { cause: 'Error del operario', prev: 'Poka-Yoke de Diseno: Moldes especificos que impiden el encastre fisico de piezas incorrectas', det: 'Visual', O: 1, D: 5, ap: 'L' },
                ],
            }, {
                desc: 'Se coloca mal el vinilo',
                efLocal: 'Scrap', S: 8,
                efClient: 'Parada de linea',
                efUser: 'Potencial reclamo',
                causes: [
                    { cause: 'Error del operario', prev: 'Diseno del producto: Piquetes y zonas demarcadas', det: 'Visual', O: 3, D: 5, ap: 'M', sc: 'SC' },
                ],
            }, {
                desc: 'Mal colocado de la pieza plastica',
                efLocal: 'Scrap', S: 8,
                efClient: 'Parada de linea',
                efUser: 'Potencial reclamo',
                causes: [
                    { cause: 'Error del operario', prev: 'Poka-Yoke Tecnico: La maquina detecta si la pieza esta mal colocada y no realiza el proceso', det: 'Visual', O: 1, D: 5, ap: 'L' },
                ],
            }, {
                desc: 'Falla el proceso automatico',
                efLocal: 'Scrap', S: 8,
                efClient: 'Parada de linea',
                efUser: 'Potencial reclamo',
                causes: [
                    { cause: 'Falla de la maquina', prev: 'Mantenimiento preventivo', det: 'Visual: El operador ve que la maquina paro', O: 2, D: 5, ap: 'L' },
                ],
            }],
        },
    ]),
    mkWE('Man', 'Operador de produccion / Lider de equipo', [
        {
            desc: 'Cargar y posicionar los componentes en los encastres de la maquina, accionar el mando bimanual',
            failures: [],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        { desc: 'Utilizar la Hoja de Operaciones vigente', failures: [] },
    ]),
    mkWE('Material', 'Medios / Troquel', [
        { desc: 'Proteger el producto y contener las piezas', failures: [] },
    ]),
    mkWE('Environment', 'Iluminacion/Ruido / Ley 19587', [
        { desc: 'Mantener las condiciones de seguridad ocupacional', failures: [] },
    ]),
]);

// ── OPERATION 100: CONTROL FINAL DE CALIDAD ─────────────────────────────
const op100 = mkOp(100, 'INSPECCION FINAL - CONTROL FINAL DE CALIDAD', [
    mkWE('Man', 'Operador de calidad / Lider de equipo', [
        {
            desc: 'Verificar/Confirmar la conformidad del producto terminado segun Plan de Control',
            failures: [{
                desc: 'Aprobacion de Pieza No Conforme',
                efLocal: 'Una porcion de la produccion requiere Retrabajo Fuera de Linea', S: 8,
                efClient: 'Parada de linea mayor a un turno o Suspension de envios',
                efUser: 'Perdida de la funcion primaria del vehiculo',
                causes: [
                    { cause: 'Omision o error en la ejecucion de la verificacion', prev: 'Lista de Verificacion (Checklist) y Mantenimiento/Calibracion de instrumentos', det: 'Auditoria de Proceso y Verificacion manual/visual', O: 5, D: 8, ap: 'M', sc: 'SC' },
                ],
            }, {
                desc: 'Vinilo despegado (falta / ausencia de adhesivo)',
                efLocal: 'Scrap', S: 8,
                efClient: 'Potencial parada de linea',
                efUser: 'Reclamo de apariencia',
                causes: [
                    { cause: 'Falta / ausencia de adhesivo', prev: 'Instruccion Visual', det: 'Inspeccion Visual', O: 4, D: 8, ap: 'M', sc: 'SC' },
                ],
            }],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        { desc: 'Utilizar la Hoja de Operaciones vigente', failures: [] },
    ]),
    mkWE('Material', 'Lapicera / Bolsas plasticas', [
        { desc: 'Proteger semiterminados y contener producto durante el transporte interno', failures: [] },
    ]),
    mkWE('Environment', 'Iluminacion/Ruido / Ley 19587', [
        { desc: 'Mantener las condiciones de seguridad ocupacional', failures: [] },
    ]),
]);

// ── OPERATION 101: CLASIFICACION Y SEGREGACION ──────────────────────────
const op101 = mkOp(101, 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', [
    mkWE('Man', 'Operador de calidad / Lider de equipo', [
        {
            desc: 'Segregar producto (conforme y no conforme) segun Plan de Control; Prevenir el escape y la mezcla de piezas no conformes',
            failures: [{
                desc: 'Pieza No Conforme (NC) es clasificada como Conforme (OK)',
                efLocal: 'Producto defectuoso desencadena un Plan de Reaccion Importante', S: 10,
                efClient: 'Parada de linea mayor a un turno o Suspension de envios',
                efUser: 'Perdida de la funcion primaria del vehiculo necesaria para la conduccion normal',
                causes: [
                    { cause: 'Operador coloca la Pieza NC en el contenedor de Embalaje/OK por error', prev: 'Hojas de operaciones / ayudas visuales', det: 'Visual', O: 5, D: 8, ap: 'H', sc: 'SC' },
                    { cause: 'Contenedor de Producto Conforme y No Conforme no estan claramente diferenciados', prev: 'Instruccion Visual', det: 'Inspeccion Visual', O: 4, D: 8, ap: 'H', sc: 'SC' },
                    { cause: 'Instruccion de Trabajo del puesto de Clasificacion y Segregacion es ambigua', prev: 'Hojas de operaciones / ayudas visuales', det: 'Visual', O: 5, D: 8, ap: 'H', sc: 'SC' },
                ],
            }],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        { desc: 'Utilizar la Hoja de Operaciones vigente', failures: [] },
    ]),
    mkWE('Material', 'Etiquetas / Lapicera / Bolsas plasticas / Medios', [
        { desc: 'Registrar Informacion de Trazabilidad y Proteger producto', failures: [] },
    ]),
    mkWE('Environment', 'Iluminacion/Ruido / Ley 19587', [
        { desc: 'Mantener las condiciones de seguridad ocupacional', failures: [] },
    ]),
]);

// ── OPERATION 103: REPROCESO FALTA DE ADHESIVO ──────────────────────────
const op103 = mkOp(103, 'REPROCESO: FALTA DE ADHESIVO', [
    mkWE('Man', 'Operador de calidad / Lider de equipo', [
        {
            desc: 'Restituir la capa de adhesivo en las areas del sustrato donde estaba ausente',
            failures: [{
                desc: 'Falta de adhesivo / Cobertura incompleta',
                efLocal: 'Scrap del 100%', S: 8,
                efClient: 'Paro de linea / Problemas de Ensamble',
                efUser: 'Apariencia / Ruido',
                causes: [
                    { cause: 'Omision por fatiga o distraccion: El operador olvida aplicar adhesivo en una seccion especifica', prev: 'Instrucciones de proceso y ayudas visuales disponibles en el puesto', det: 'Inspeccion de calidad', O: 5, D: 8, ap: 'H', sc: 'SC' },
                    { cause: 'Instruccion deficiente: La Hoja de Operacion Estandar de reproceso no especifica el patron de recorrido', prev: 'La hoja de instruccion detalla el metodo de aplicacion y el patron de recorrido', det: 'Inspeccion de calidad', O: 4, D: 3, ap: 'M' },
                    { cause: 'La herramienta manual no carga suficiente adhesivo o el adhesivo en el recipiente se seco parcialmente', prev: 'La pistola de adhesivado evita que se seque el adhesivo', det: 'Inspeccion de calidad', O: 7, D: 5, ap: 'H' },
                ],
            }, {
                desc: 'Exceso de adhesivo / se aplica adhesivo donde no corresponde',
                efLocal: 'Retrabajo en linea', S: 8,
                efClient: 'El exceso de pegamento interfiere con los clips o puntos de fijacion',
                efUser: 'Vibracion, ruidos o aspecto',
                causes: [
                    { cause: 'Sobre-procesamiento: El operador aplica doble capa', prev: 'La instruccion detalla que no se debe aplicar mas de 1 vez el adhesivo', det: 'Inspeccion de calidad', O: 3, D: 8, ap: 'M', sc: 'SC' },
                    { cause: 'No existe una plantilla o mascara de proteccion para tapar zonas donde no lleva adhesivo', prev: 'Instrucciones de proceso detallan donde aplicar el adhesivo', det: 'Inspeccion de calidad', O: 5, D: 8, ap: 'H', sc: 'SC' },
                ],
            }, {
                desc: 'Mezcla de producto No Conforme (NC) con producto Conforme (OK)',
                efLocal: 'Fuerte posibilidad de incorporar procesos adicionales de clasificacion', S: 8,
                efClient: 'Parada de linea entre una hora y un turno de produccion completo',
                efUser: 'Perdida de la funcion primaria del vehiculo',
                causes: [
                    { cause: 'Operador coloca piezas NC en el contenedor de OK por error de distraccion', prev: 'Instruccion Visual', det: 'Inspeccion Visual', O: 5, D: 8, ap: 'H' },
                    { cause: 'Contenedores de Producto Conforme y No Conforme no estan fisicamente separados', prev: 'Instruccion Visual', det: 'Inspeccion Visual', O: 4, D: 8, ap: 'H' },
                    { cause: 'Instruccion de Trabajo del puesto de Clasificacion y Segregacion es ambigua', prev: 'Hojas de operaciones / ayudas visuales', det: 'Visual', O: 5, D: 8, ap: 'H' },
                ],
            }, {
                desc: 'Etiqueta o tarjeta de identificacion de Scrap/Retrabajo omitida',
                efLocal: 'Fuerte posibilidad de incorporar procesos adicionales de clasificacion', S: 8,
                efClient: 'Insumos de identificacion no disponibles',
                efUser: 'No afecta',
                causes: [
                    { cause: 'Operador omite el paso de identificacion', prev: 'El procedimiento de segregacion no requiere la colocacion de la tarjeta/etiqueta antes de la colocacion en el contenedor NC', det: 'Inspeccion Visual', O: 4, D: 8, ap: 'H' },
                ],
            }],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales / Piquete', [
        { desc: 'Utilizar la Hoja de Operaciones vigente', failures: [] },
    ]),
    mkWE('Material', 'Etiquetas / Lapicera / Bolsas plasticas / Medios', [
        { desc: 'Proteger producto, Identificar, Asegurar Trazabilidad', failures: [] },
    ]),
    mkWE('Environment', 'Iluminacion/Ruido / Ley 19587', [
        { desc: 'Mantener las condiciones de seguridad ocupacional', failures: [] },
    ]),
]);

// ── OPERATION 110: EMBALAJE Y ETIQUETADO ─────────────────────────────────
const op110 = mkOp(110, 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', [
    mkWE('Man', 'Operador de calidad / Lider de equipo', [
        {
            desc: 'Obtener producto conforme, correctamente contenido y protegido, con trazabilidad establecida',
            failures: [{
                desc: 'Pieza deformada por mal posicionamiento en el embalaje',
                efLocal: '100% produccion requiere retrabajo en estacion', S: 8,
                efClient: 'Paro de linea temporal o devolucion del lote',
                efUser: 'Dano permanente en la espuma o en la costura',
                causes: [
                    { cause: 'Mal posicionamiento / Sin separadores', prev: 'Uso de separadores, bandejas o estructuras que mantienen la forma durante el embalaje', det: 'Inspeccion visual del operador al momento de ubicar', O: 3, D: 8, ap: 'M', sc: 'SC' },
                ],
            }, {
                desc: 'Colocacion de mayor o menor cantidad de piezas por medio',
                efLocal: 'Plan de reaccion importante por desvio de cantidad', S: 6,
                efClient: 'Paro de linea temporal o devolucion del lote',
                efUser: 'El error se corrige antes de llegar al usuario',
                causes: [
                    { cause: 'Falta de control en la cantidad cargada por medio', prev: 'Estandar visual con foto de referencia indicando la cantidad por medio', det: 'Verificacion visual del medio completo antes del cierre', O: 3, D: 6, ap: 'M' },
                ],
            }, {
                desc: 'Hilos sobrantes, rebabas textiles o imperfecciones en costuras',
                efLocal: 'Retrabajo', S: 4,
                efClient: 'Defecto notorio y disconformidad inmediata',
                efUser: 'Reclamo de aspecto',
                causes: [
                    { cause: 'Omision de la operacion de eliminacion de hilos sobrantes', prev: 'Instrucciones de proceso', det: 'Inspeccion visual', O: 3, D: 8, ap: 'M' },
                ],
            }],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        { desc: 'Utilizar la Hoja de Operaciones vigente', failures: [] },
    ]),
    mkWE('Material', 'Etiquetas / Lapicera / Bolsas plasticas / Medios', [
        { desc: 'Proteger producto, Identificar, Asegurar Trazabilidad', failures: [] },
    ]),
    mkWE('Environment', 'Iluminacion/Ruido / Ley 19587', [
        { desc: 'Mantener las condiciones de seguridad ocupacional', failures: [] },
    ]),
]);

// ── All Operations ──────────────────────────────────────────────────────
const allOperations = [
    op10, op15, op20, op25, op30, op40, op50, op51, op52,
    op60, op61, op70, op71, op72,
    op80, op81, op82, op90, op100, op101, op103, op110,
];

const amfeDoc = { header, operations: allOperations };

// ============================================================================
// PFD DATA — Extracted from Flujograma
// ============================================================================

function mkStep(stepNumber, stepType, description, extras = {}) {
    return {
        id: uuid(),
        stepNumber,
        stepType,
        description,
        machineDeviceTool: extras.machine || '',
        productCharacteristic: extras.prodChar || '',
        productSpecialChar: extras.prodSC || 'none',
        processCharacteristic: extras.procChar || '',
        processSpecialChar: extras.procSC || 'none',
        reference: '',
        department: extras.dept || '',
        notes: extras.notes || '',
        isRework: false,
        isExternalProcess: false,
        reworkReturnStep: '',
        rejectDisposition: extras.rejectDisp || 'none',
        scrapDescription: extras.scrapDesc || '',
        branchId: extras.branchId || '',
        branchLabel: extras.branchLabel || '',
    };
}

const pfdSteps = [
    mkStep('10', 'storage', 'RECEPCION DE MATERIA PRIMA', { dept: 'Recepcion', procChar: 'Conformidad de calidad y cantidad de material', procSC: 'SC' }),
    mkStep('', 'inspection', 'INSPECCION DE MATERIA PRIMA', { procChar: 'Verificacion de especificaciones', procSC: 'SC', rejectDisp: 'scrap', scrapDesc: 'Reclamo de calidad al proveedor' }),
    mkStep('', 'storage', 'ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA'),
    mkStep('15', 'operation', 'PREPARACION DE CORTE', { dept: 'Mesa de Corte' }),
    mkStep('', 'transport', 'TRASLADO: VINILOS Y TELAS A SECTOR DE MESA DE CORTE'),
    mkStep('20', 'operation', 'CORTE DE COMPONENTES', { machine: 'Maquina de corte', prodChar: 'Dimension de corte', prodSC: 'SC', procChar: 'Parametros de corte', procSC: 'SC' }),
    mkStep('25', 'inspection', 'CONTROL CON MYLAR', { machine: 'Mylar de control', prodChar: 'Conformidad dimensional del contorno', prodSC: 'SC' }),
    mkStep('30', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP'),
    mkStep('', 'transport', 'TRASLADO: KITS DE COMPONENTES A SECTOR DE COSTURA'),
    mkStep('40', 'operation', 'REFILADO', { machine: 'Maquina refiladora', prodChar: 'Dimension de refilado', prodSC: 'SC' }),
    mkStep('50', 'operation', 'COSTURA UNION', { machine: 'Maquina de coser', prodChar: 'Costura completa y firme', prodSC: 'SC' }),
    mkStep('', 'transport', 'TRASLADO: HILOS A SECTOR DE COSTURA'),
    mkStep('51', 'operation', 'COSTURA DOBLE', { machine: 'Maquina de coser', prodChar: 'Costura decorativa conforme', prodSC: 'SC' }),
    mkStep('52', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP'),
    mkStep('', 'transport', 'TRASLADO: SEMITERMINADOS COSIDOS A SECTOR DE ADHESIVADO'),
    mkStep('60', 'operation', 'INYECCION DE PIEZAS PLASTICAS', { machine: 'Maquina inyectora de plastico', prodChar: 'Llenado completo, sin rebaba', prodSC: 'SC', procChar: 'Presion, Temperatura, Tiempo', procSC: 'SC', branchId: 'A', branchLabel: 'Linea Inyeccion' }),
    mkStep('61', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', { branchId: 'A' }),
    mkStep('', 'transport', 'TRASLADO: MATERIA PRIMA A SECTOR DE INYECCION PLASTICA', { branchId: 'A' }),
    mkStep('', 'transport', 'TRASLADO: SUSTRATO A SECTOR DE INYECCION PU'),
    mkStep('70', 'operation', 'INYECCION PU', { machine: 'Inyectora de PUR', prodChar: 'Peso 420 +/- 25 grs', prodSC: 'SC', branchId: 'B', branchLabel: 'Linea PU' }),
    mkStep('', 'transport', 'TRASLADO: BARRIL AL SECTOR DE INYECCION PU', { branchId: 'B' }),
    mkStep('71', 'operation', 'PREARMADO DE ESPUMA', { procChar: 'Alineacion de espuma', procSC: 'SC' }),
    mkStep('72', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP'),
    mkStep('', 'transport', 'TRASLADO: SUSTRATO + ESPUMA A SECTOR DE ADHESIVADO'),
    mkStep('80', 'operation', 'ADHESIVADO', { machine: 'Pistola de adhesivado', prodChar: 'Adhesion completa y uniforme', prodSC: 'SC', procChar: 'Fecha vencimiento, Proporcion mezcla', procSC: 'SC' }),
    mkStep('81', 'inspection', 'INSPECCION DE PIEZA ADHESIVADA', { prodChar: 'Conformidad de adhesion', prodSC: 'SC' }),
    mkStep('82', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP'),
    mkStep('', 'transport', 'TRASLADO: PIEZA ADHESIVADA AL SECTOR DE TAPIZADO'),
    mkStep('90', 'operation', 'TAPIZADO SEMIAUTOMATICO', { machine: 'Maquina de tapizado semiautomatico', prodChar: 'Adhesion vinilo-sustrato sin arrugas', prodSC: 'CC', procChar: 'Parametros de maquina', procSC: 'SC' }),
    mkStep('100', 'inspection', 'CONTROL FINAL DE CALIDAD', { prodChar: 'Conformidad del producto terminado', prodSC: 'SC', rejectDisp: 'scrap' }),
    mkStep('101', 'decision', 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', { rejectDisp: 'scrap', scrapDesc: 'SCRAP PIEZA IRRECUPERABLE' }),
    mkStep('103', 'operation', 'REPROCESO: FALTA DE ADHESIVO', { notes: 'RE-ENTRADA AL FLUJO PRINCIPAL' }),
    mkStep('110', 'operation', 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', { dept: 'Embalaje', prodChar: 'Integridad fisica y trazabilidad', prodSC: 'SC' }),
    mkStep('', 'storage', 'ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO)'),
    mkStep('', 'transport', 'TRASLADO A SECTOR DE PRODUCTO TERMINADO'),
];

const pfdDoc = {
    id: uuid(),
    header: {
        partNumber: 'ARMREST DOOR PANEL',
        partName: 'ARMREST PATAGONIA',
        engineeringChangeLevel: '',
        modelYear: 'PATAGONIA',
        documentNumber: 'I-IN-002/III',
        revisionLevel: 'A',
        revisionDate: '2025-11-12',
        companyName: 'BARACK MERCOSUL',
        plantLocation: 'Hurlingham, Buenos Aires',
        supplierCode: '',
        customerName: 'VW',
        client: 'VWA',
        coreTeam: 'P. Gamboa, C. Baptista',
        keyContact: '',
        processPhase: 'pre-launch',
        preparedBy: 'P. GAMBOA',
        preparedDate: '2025-11-12',
        approvedBy: 'C. BAPTISTA',
        approvedDate: '2025-11-12',
        applicableParts: '',
    },
    steps: pfdSteps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

// ============================================================================
// HELPERS — Statistics & CP Generation
// ============================================================================

function countCauses(operations) {
    let total = 0, apH = 0, apM = 0;
    for (const op of operations)
        for (const we of (op.workElements || []))
            for (const func of (we.functions || []))
                for (const fail of (func.failures || []))
                    for (const cause of (fail.causes || [])) {
                        total++;
                        if (cause.ap === 'H') apH++;
                        if (cause.ap === 'M') apM++;
                    }
    return { total, apH, apM };
}

function calcCoverage(operations) {
    let total = 0, covered = 0;
    for (const op of operations)
        for (const we of (op.workElements || []))
            for (const func of (we.functions || []))
                for (const fail of (func.failures || []))
                    for (const cause of (fail.causes || [])) {
                        total++;
                        if ((cause.preventionControl && cause.preventionControl !== '-' && cause.preventionControl !== 'N/A') ||
                            (cause.detectionControl && cause.detectionControl !== '-' && cause.detectionControl !== 'N/A'))
                            covered++;
                    }
    return total > 0 ? Math.round((covered / total) * 10000) / 100 : 0;
}

function inferOpCategory(name) {
    const n = (name || '').toLowerCase();
    if (/sold[au]/i.test(n)) return 'soldadura';
    if (/ensam[bp]l/i.test(n)) return 'ensamble';
    if (/inyecci[oó]n|inyeccion/i.test(n)) return 'inyeccion';
    if (/inspec/i.test(n)) return 'inspeccion';
    if (/costur/i.test(n)) return 'costura';
    if (/corte/i.test(n)) return 'corte';
    if (/embala/i.test(n)) return 'embalaje';
    if (/adhesi/i.test(n)) return 'adhesivado';
    if (/tapiz/i.test(n)) return 'tapizado';
    if (/recep/i.test(n)) return 'recepcion';
    if (/refil/i.test(n)) return 'refilado';
    if (/almacen|wip/i.test(n)) return 'almacenamiento';
    if (/reproc/i.test(n)) return 'reproceso';
    if (/clasif|segreg/i.test(n)) return 'clasificacion';
    if (/prearm/i.test(n)) return 'ensamble';
    return '';
}

// ============================================================================
// CONTROL PLAN GENERATOR
// ============================================================================

function generateControlPlan(amfeDoc, phase) {
    const items = [];
    const qualifying = [];

    for (const op of amfeDoc.operations) {
        for (const we of (op.workElements || [])) {
            for (const func of (we.functions || [])) {
                for (const fail of (func.failures || [])) {
                    for (const cause of (fail.causes || [])) {
                        const severity = Number(fail.severity) || 0;
                        const occurrence = Number(cause.occurrence) || 0;
                        // AIAG-VDA 2019: CC=S≥9, SC=S=5-8 AND O≥4
                        const autoSpecialChar = cause.specialChar
                            || (severity >= 9 ? 'CC' : (severity >= 5 && occurrence >= 4) ? 'SC' : '');
                        if (cause.ap !== 'H' && cause.ap !== 'M') continue;
                        qualifying.push({ op, we, func, fail, cause, severity, autoSpecialChar });
                    }
                }
            }
        }
    }

    // PROCESS rows
    const processGroups = new Map();
    for (const q of qualifying) {
        const key = JSON.stringify([q.op.opNumber, (q.cause.cause || '').toLowerCase().trim().replace(/\s+/g, ' '), (q.cause.preventionControl || '').toLowerCase().trim().replace(/\s+/g, ' ')]);
        const group = processGroups.get(key) || [];
        group.push(q);
        processGroups.set(key, group);
    }

    for (const [, group] of processGroups) {
        const rep = group[0];
        const highSev = Math.max(...group.map(g => g.severity));
        const highAp = group.some(g => g.cause.ap === 'H') ? 'H' : 'M';
        let bestSC = '';
        for (const g of group) { if (g.autoSpecialChar === 'CC') { bestSC = 'CC'; break; } if (g.autoSpecialChar === 'SC') bestSC = 'SC'; }

        const { sampleSize, sampleFrequency, reactionPlan, reactionPlanOwner, evaluationTechnique, specification } =
            getDefaults(highAp, highSev, phase, rep, 'process');

        items.push({
            id: uuid(),
            processStepNumber: rep.op.opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: rep.we.name || '',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: rep.cause.cause || '',
            specialCharClass: bestSC,
            specification,
            evaluationTechnique,
            sampleSize,
            sampleFrequency,
            controlMethod: rep.cause.preventionControl || '',
            reactionPlan,
            reactionPlanOwner,
            controlProcedure: '',
            autoFilledFields: [],
            amfeAp: highAp,
            amfeSeverity: highSev,
            operationCategory: inferOpCategory(rep.op.name),
            amfeCauseIds: [...new Set(group.map(g => g.cause.id))],
            amfeFailureId: rep.fail.id,
            amfeFailureIds: [...new Set(group.map(g => g.fail.id))],
        });
    }

    // PRODUCT rows
    const productGroups = new Map();
    for (const q of qualifying) {
        const key = JSON.stringify([q.op.opNumber, (q.fail.description || '').toLowerCase().trim().replace(/\s+/g, ' '), (q.cause.detectionControl || '').toLowerCase().trim().replace(/\s+/g, ' ')]);
        const group = productGroups.get(key) || [];
        group.push(q);
        productGroups.set(key, group);
    }

    for (const [, group] of productGroups) {
        const rep = group[0];
        const highSev = Math.max(...group.map(g => g.severity));
        const highAp = group.some(g => g.cause.ap === 'H') ? 'H' : 'M';
        let bestSC = '';
        for (const g of group) { if (g.autoSpecialChar === 'CC') { bestSC = 'CC'; break; } if (g.autoSpecialChar === 'SC') bestSC = 'SC'; }

        const { sampleSize, sampleFrequency, reactionPlan, reactionPlanOwner, specification } =
            getDefaults(highAp, highSev, phase, rep, 'product');

        items.push({
            id: uuid(),
            processStepNumber: rep.op.opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: rep.we.name || '',
            characteristicNumber: '',
            productCharacteristic: rep.fail.description || '',
            processCharacteristic: '',
            specialCharClass: bestSC,
            specification,
            evaluationTechnique: rep.cause.detectionControl || '',
            sampleSize,
            sampleFrequency,
            controlMethod: '',
            reactionPlan,
            reactionPlanOwner,
            controlProcedure: '',
            autoFilledFields: [],
            amfeAp: highAp,
            amfeSeverity: highSev,
            operationCategory: inferOpCategory(rep.op.name),
            amfeCauseIds: [...new Set(group.map(g => g.cause.id))],
            amfeFailureId: rep.fail.id,
            amfeFailureIds: [...new Set(group.map(g => g.fail.id))],
        });
    }

    items.sort((a, b) => {
        const na = parseInt(a.processStepNumber) || 0;
        const nb = parseInt(b.processStepNumber) || 0;
        if (na !== nb) return na - nb;
        return (a.processCharacteristic ? 0 : 1) - (b.processCharacteristic ? 0 : 1);
    });

    return { items, qualifyingCount: qualifying.length };
}

function getDefaults(ap, severity, phase, rep, rowType) {
    let sampleSize, sampleFrequency, reactionPlan, reactionPlanOwner, evaluationTechnique, specification;

    if (ap === 'H') { sampleSize = '100%'; sampleFrequency = 'Cada pieza'; }
    else if (severity >= 7) { sampleSize = '5 piezas'; sampleFrequency = 'Cada 2 horas'; }
    else { sampleSize = '3 piezas'; sampleFrequency = 'Cada turno'; }

    if (severity >= 9) reactionPlan = 'Detener linea. Segregar producto sospechoso. Escalar a Gerencia de Calidad. Contener lote completo.';
    else if (severity >= 7) reactionPlan = 'Contener producto sospechoso. Verificar ultimas N piezas. Ajustar proceso. Notificar a Lider.';
    else reactionPlan = 'Ajustar proceso. Reinspeccionar ultimo lote. Registrar desvio.';

    const cat = inferOpCategory(rep.op.name);
    if (severity >= 9 || ap === 'H') {
        reactionPlanOwner = cat === 'inspeccion' || cat === 'clasificacion' ? 'Supervisor de Calidad' : 'Lider de Produccion / Calidad';
    } else if (severity >= 7) {
        reactionPlanOwner = 'Lider de Produccion';
    } else {
        reactionPlanOwner = 'Operador de Produccion';
    }

    evaluationTechnique = '';
    if (rowType === 'process') {
        const det = (rep.cause.detectionControl || '').toLowerCase();
        if (det.includes('visual')) evaluationTechnique = 'Inspeccion visual';
        else if (det.includes('auditor')) evaluationTechnique = 'Auditoria de proceso';
        else if (det.includes('set') || det.includes('puesta')) evaluationTechnique = 'Verificacion de set-up';
        else if (det.includes('dimensional')) evaluationTechnique = 'Control dimensional';
        else if (det.includes('monitor')) evaluationTechnique = 'Monitoreo automatico';
        else evaluationTechnique = 'Verificacion operativa';
    }

    specification = '';
    if (rowType === 'product') {
        const fd = (rep.fail.description || '').toLowerCase();
        if (fd.includes('fuera de medida') || fd.includes('dimensional')) specification = 'Segun plano / tolerancia dimensional';
        else if (fd.includes('contaminaci') || fd.includes('suciedad')) specification = 'Libre de contaminacion visual';
        else if (fd.includes('adhesi') || fd.includes('adhesivo') || fd.includes('despegado')) specification = 'Adhesion completa sin despegues';
        else if (fd.includes('costura') || fd.includes('hilo') || fd.includes('descosid')) specification = 'Costura continua segun especificacion';
        else if (fd.includes('aspecto') || fd.includes('apariencia')) specification = 'Sin defectos visuales';
        else if (fd.includes('refilad')) specification = 'Conforme a pieza patron';
        else if (fd.includes('deformad')) specification = 'Sin deformaciones';
        else if (fd.includes('identificaci') || fd.includes('trazabilidad')) specification = 'Identificacion completa (codigo, lote, fecha)';
        else specification = 'Conforme a especificacion de proceso';
    } else {
        const cd = (rep.cause.cause || '').toLowerCase();
        if (cd.includes('temperatura')) specification = 'Rango de temperatura segun set-up';
        else if (cd.includes('tiempo') || cd.includes('ciclo')) specification = 'Tiempos de ciclo segun set-up';
        else if (cd.includes('presion')) specification = 'Presion segun parametros de proceso';
        else if (cd.includes('color') || cd.includes('variante')) specification = 'Color/variante segun OP';
        else if (cd.includes('vencimiento') || cd.includes('fecha')) specification = 'Dentro de fecha de vigencia';
        else specification = 'Segun instruccion de proceso';
    }

    return { sampleSize, sampleFrequency, reactionPlan, reactionPlanOwner, evaluationTechnique, specification };
}

// ============================================================================
// HO STUBS — One sheet per operation
// ============================================================================

function generateHoSheets(operations) {
    return operations.map(op => ({
        id: uuid(),
        amfeOperationId: op.id,
        operationNumber: op.opNumber,
        operationName: op.name,
        hoNumber: `HO-${op.opNumber}`,
        sector: '',
        puestoNumber: '',
        vehicleModel: 'PATAGONIA',
        partCodeDescription: 'ARMREST DOOR PANEL',
        safetyElements: ['anteojos', 'guantes', 'zapatos'],
        hazardWarnings: [],
        steps: [],
        qualityChecks: [],
        reactionPlanText: 'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME:\nDETENGA LA OPERACION\nNOTIFIQUE DE INMEDIATO A SU LIDER O SUPERVISOR\nESPERE LA DEFINICION DEL LIDER O SUPERVISOR',
        reactionContact: '',
        visualAids: [],
        preparedBy: '',
        approvedBy: '',
        date: '2026-03-17',
        revision: 'A',
        status: 'borrador',
    }));
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('================================================================');
    console.log('  SEED: ARMREST DOOR PANEL — VWA/PATAGONIA');
    console.log('  AMFE + PFD + CP + HO + FAMILIA');
    console.log('================================================================');

    // ── 0. Connect ─────────────────────────────────────────────────────
    await initSupabase();

    // ── 1. AMFE stats ──────────────────────────────────────────────────
    const { total: causeCount, apH, apM } = countCauses(allOperations);
    const coverage = calcCoverage(allOperations);

    console.log(`\n── AMFE ──`);
    console.log(`  Operations: ${allOperations.length}`);
    console.log(`  Causes: ${causeCount} (H=${apH}, M=${apM})`);
    console.log(`  Coverage: ${coverage}%`);

    // ── 2. Control Plan ────────────────────────────────────────────────
    const cpPhase = 'preLaunch';
    const { items: cpItems, qualifyingCount } = generateControlPlan(amfeDoc, cpPhase);
    const cpHeader = {
        controlPlanNumber: 'CP-ARMREST-001',
        phase: cpPhase,
        partNumber: 'ARMREST DOOR PANEL',
        latestChangeLevel: header.revision,
        partName: 'ARMREST DOOR PANEL',
        applicableParts: '',
        organization: 'BARACK MERCOSUL',
        supplier: '',
        supplierCode: '',
        keyContactPhone: '',
        date: '2026-03-17',
        revision: '1',
        responsible: 'Carlos Baptista',
        approvedBy: '',
        client: 'VWA',
        coreTeam: header.team,
        customerApproval: '',
        otherApproval: '',
        linkedAmfeProject: PROJECT_NAME,
    };
    const cpDoc = { header: cpHeader, items: cpItems };

    console.log(`\n── CONTROL PLAN ──`);
    console.log(`  Items: ${cpItems.length}`);
    console.log(`  From ${qualifyingCount} qualifying AMFE causes`);

    // ── 3. HO stubs ────────────────────────────────────────────────────
    const hoSheets = generateHoSheets(allOperations);
    const hoDoc = {
        header: {
            formNumber: 'I-IN-002.4-R01',
            organization: 'BARACK MERCOSUL',
            client: 'VWA',
            partNumber: 'ARMREST DOOR PANEL',
            partDescription: 'ARMREST DOOR PANEL',
            applicableParts: '',
            linkedAmfeProject: PROJECT_NAME,
            linkedCpProject: PROJECT_NAME,
        },
        sheets: hoSheets,
    };

    console.log(`\n── HOJA DE OPERACIONES ──`);
    console.log(`  Sheets: ${hoSheets.length} (stubs)`);

    // ── 4. PFD ─────────────────────────────────────────────────────────
    console.log(`\n── PFD ──`);
    console.log(`  Steps: ${pfdSteps.length}`);

    // ═══════════════════════════════════════════════════════════════════
    // DATABASE INSERTS
    // ═══════════════════════════════════════════════════════════════════

    console.log(`\n── INSERTING INTO SUPABASE ──`);

    // ── DELETE existing Armrest docs (idempotent) ──────────────────────
    const existingAmfe = await selectSql(`SELECT id FROM amfe_documents WHERE project_name = ?`, [PROJECT_NAME]);
    if (existingAmfe.length > 0) {
        await execSql(`DELETE FROM amfe_documents WHERE project_name = ?`, [PROJECT_NAME]);
        console.log(`  Deleted existing AMFE for ${PROJECT_NAME}`);
    }
    const existingCp = await selectSql(`SELECT id FROM cp_documents WHERE project_name = ?`, [PROJECT_NAME]);
    if (existingCp.length > 0) {
        await execSql(`DELETE FROM cp_documents WHERE project_name = ?`, [PROJECT_NAME]);
        console.log(`  Deleted existing CP for ${PROJECT_NAME}`);
    }
    const existingHo = await selectSql(`SELECT id FROM ho_documents WHERE linked_amfe_project = ?`, [PROJECT_NAME]);
    if (existingHo.length > 0) {
        await execSql(`DELETE FROM ho_documents WHERE linked_amfe_project = ?`, [PROJECT_NAME]);
        console.log(`  Deleted existing HO for ${PROJECT_NAME}`);
    }
    const existingPfd = await selectSql(`SELECT id FROM pfd_documents WHERE document_number = ?`, ['I-IN-002/III-ARM']);
    if (existingPfd.length > 0) {
        await execSql(`DELETE FROM pfd_documents WHERE document_number = ?`, ['I-IN-002/III-ARM']);
        console.log(`  Deleted existing PFD for I-IN-002/III-ARM`);
    }

    // ── AMFE: Insert ──────────────────────────────────────────────────
    const amfeId = uuid();
    const amfeDataJson = JSON.stringify(amfeDoc);
    const amfeChecksum = sha256(amfeDataJson);

    await execSql(`INSERT INTO amfe_documents (
        id, amfe_number, project_name, subject, client, part_number,
        responsible, organization, status,
        operation_count, cause_count, ap_h_count, ap_m_count, coverage_percent,
        start_date, last_revision_date, data, checksum)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [amfeId, header.amfeNumber, PROJECT_NAME, 'ARMREST', 'VWA', 'ARMREST DOOR PANEL',
         header.responsible, header.organization, 'draft',
         allOperations.length, causeCount, apH, apM, coverage,
         header.startDate, header.revDate, amfeDataJson, amfeChecksum]);
    console.log(`  + AMFE inserted: ${header.amfeNumber} (${allOperations.length} ops, ${causeCount} causes)`);

    // ── CP: Insert ────────────────────────────────────────────────────
    const cpId = uuid();
    const cpDataJson = JSON.stringify(cpDoc);
    const cpChecksum = sha256(cpDataJson);

    await execSql(`INSERT INTO cp_documents (
        id, project_name, control_plan_number, phase,
        part_number, part_name, organization, client,
        responsible, revision, linked_amfe_project, linked_amfe_id,
        item_count, data, checksum)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cpId, PROJECT_NAME, 'CP-ARMREST-001', cpPhase,
         'ARMREST DOOR PANEL', 'ARMREST DOOR PANEL', 'BARACK MERCOSUL', 'VWA',
         'Carlos Baptista', '1', PROJECT_NAME, amfeId,
         cpItems.length, cpDataJson, cpChecksum]);
    console.log(`  + CP inserted: CP-ARMREST-001 (${cpItems.length} items)`);

    // ── HO: Insert ────────────────────────────────────────────────────
    const hoId = uuid();
    const hoDataJson = JSON.stringify(hoDoc);
    const hoChecksum = sha256(hoDataJson);

    await execSql(`INSERT INTO ho_documents (
        id, form_number, organization, client,
        part_number, part_description,
        linked_amfe_project, linked_cp_project,
        sheet_count, data, checksum)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [hoId, 'I-IN-002.4-R01', 'BARACK MERCOSUL', 'VWA',
         'ARMREST DOOR PANEL', 'ARMREST DOOR PANEL',
         PROJECT_NAME, PROJECT_NAME,
         hoSheets.length, hoDataJson, hoChecksum]);
    console.log(`  + HO inserted: HO (${hoSheets.length} sheets)`);

    // ── PFD: Insert ───────────────────────────────────────────────────
    const pfdId = pfdDoc.id;
    const pfdDataJson = JSON.stringify(pfdDoc);
    const pfdChecksum = sha256(pfdDataJson);

    await execSql(`INSERT INTO pfd_documents (
        id, part_number, part_name, document_number, revision_level,
        revision_date, customer_name, step_count,
        data, checksum)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pfdId, 'ARMREST DOOR PANEL', 'ARMREST PATAGONIA', 'I-IN-002/III-ARM', 'A',
         '2025-11-12', 'VW', pfdSteps.length,
         pfdDataJson, pfdChecksum]);
    console.log(`  + PFD inserted: I-IN-002/III (${pfdSteps.length} steps)`);

    // ── Family: Create ────────────────────────────────────────────────
    console.log(`\n── CREATING FAMILY ──`);

    // Check if family already exists
    const existFam = await selectSql(`SELECT id FROM product_families WHERE name = ?`, [FAMILY_NAME]);
    let familyId;

    if (existFam.length > 0) {
        familyId = existFam[0].id;
        console.log(`  Family "${FAMILY_NAME}" already exists (id=${familyId})`);
        // Clean up old family_documents for this family (idempotent)
        await execSql(`DELETE FROM family_documents WHERE family_id = ?`, [familyId]);
        console.log(`  Cleaned existing family_documents for family ${familyId}`);
    } else {
        const result = await execSql(
            `INSERT INTO product_families (name, description, linea_code, linea_name)
             VALUES (?, ?, ?, ?)`,
            [FAMILY_NAME, FAMILY_DESCRIPTION, 'VWA', 'VWA']);
        familyId = result.lastInsertId;
        console.log(`  + Family created: "${FAMILY_NAME}" (id=${familyId})`);
    }

    // Link master documents
    for (const { module, documentId, label } of [
        { module: 'amfe', documentId: amfeId, label: 'AMFE' },
        { module: 'cp', documentId: cpId, label: 'CP' },
        { module: 'pfd', documentId: pfdId, label: 'PFD' },
        { module: 'ho', documentId: hoId, label: 'HO' },
    ]) {
        const result = await execSql(
            `INSERT INTO family_documents (family_id, module, document_id, is_master, source_master_id, product_id)
             VALUES (?, ?, ?, 1, NULL, NULL)`,
            [familyId, module, documentId]);
        console.log(`  + ${label}: Linked as master (family_doc_id=${result.lastInsertId})`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // VERIFICATION
    // ═══════════════════════════════════════════════════════════════════

    console.log('\n── VERIFICATION ──');

    const amfeCheck = await selectSql(
        `SELECT id, amfe_number, project_name, operation_count, cause_count, ap_h_count, ap_m_count
         FROM amfe_documents WHERE project_name = ?`, [PROJECT_NAME]);
    console.log(`  AMFE: ${amfeCheck.length} document(s)`);
    if (amfeCheck[0]) {
        const a = amfeCheck[0];
        console.log(`    Number: ${a.amfe_number}`);
        console.log(`    Ops: ${a.operation_count}, Causes: ${a.cause_count} (H=${a.ap_h_count}, M=${a.ap_m_count})`);
    }

    const cpCheck = await selectSql(
        `SELECT id, control_plan_number, item_count, phase
         FROM cp_documents WHERE project_name = ?`, [PROJECT_NAME]);
    console.log(`  CP: ${cpCheck.length} document(s)`);
    if (cpCheck[0]) {
        console.log(`    Number: ${cpCheck[0].control_plan_number}, Items: ${cpCheck[0].item_count}`);
    }

    const hoCheck = await selectSql(
        `SELECT id, sheet_count FROM ho_documents WHERE linked_amfe_project = ?`, [PROJECT_NAME]);
    console.log(`  HO: ${hoCheck.length} document(s)`);
    if (hoCheck[0]) {
        console.log(`    Sheets: ${hoCheck[0].sheet_count}`);
    }

    const pfdCheck = await selectSql(
        `SELECT id, step_count, part_name FROM pfd_documents WHERE document_number = ?`, ['I-IN-002/III-ARM']);
    console.log(`  PFD: ${pfdCheck.length} document(s)`);
    if (pfdCheck[0]) {
        console.log(`    Steps: ${pfdCheck[0].step_count}`);
    }

    const famCheck = await selectSql(
        `SELECT fd.module, fd.is_master FROM family_documents fd
         WHERE fd.family_id = ?`, [familyId]);
    console.log(`  Family docs: ${famCheck.length}`);
    for (const fd of famCheck) {
        console.log(`    [${fd.module.toUpperCase()}] ${fd.is_master ? 'MASTER' : 'VARIANT'}`);
    }

    // ── Summary ────────────────────────────────────────────────────────
    console.log('\n================================================================');
    console.log('  SEED COMPLETE — ARMREST DOOR PANEL');
    console.log('================================================================');
    console.log(`  AMFE: ${allOperations.length} operations, ${causeCount} causes (H=${apH}, M=${apM})`);
    console.log(`  PFD: ${pfdSteps.length} steps`);
    console.log(`  CP: ${cpItems.length} items (from ${qualifyingCount} qualifying causes)`);
    console.log(`  HO: ${hoSheets.length} sheets (stubs)`);
    console.log(`  Family: "${FAMILY_NAME}" with 4 master documents`);
    console.log('================================================================');

    close();
}

main().catch(err => {
    console.error('\nERROR:', err);
    close();
    process.exit(1);
});
