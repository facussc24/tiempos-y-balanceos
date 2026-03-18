#!/usr/bin/env node
/**
 * SEED: HEADREST REAL AMFE DATA — VWA / PATAGONIA
 *
 * Replaces stub AMFE data for the 3 master (L0) headrest documents
 * with real data parsed from PDFs (AMFE 151, 153, 155 - Con Costura Vista).
 *
 * Target documents (UPDATE, not INSERT - keep existing IDs):
 *   - Headrest Front L0:       95719160-c714-464e-9983-0878cbb1546a
 *   - Headrest Rear Center L0: 42370217-f305-48c3-92d8-d31079ee3b4b
 *   - Headrest Rear Outer L0:  0446af1c-e76a-44bf-ab1a-d4fc2b6c9d16
 *
 * Usage: node scripts/seed-headrest-real-amfe.mjs
 */

import { randomUUID, createHash } from 'crypto';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

// ─── Target IDs ─────────────────────────────────────────────────────────
const TARGETS = {
    FRONT: {
        id: '95719160-c714-464e-9983-0878cbb1546a',
        projectName: 'VWA/PATAGONIA/HEADREST_FRONT',
        subject: 'Apoyacabezas Delantero Con Costura Vista - Patagonia',
        amfeNumber: 'AMFE-151',
    },
    REAR_CENTER: {
        id: '42370217-f305-48c3-92d8-d31079ee3b4b',
        projectName: 'VWA/PATAGONIA/HEADREST_REAR_CEN',
        subject: 'Apoyacabezas Trasero Central Con Costura Vista - Patagonia',
        amfeNumber: 'AMFE-153',
    },
    REAR_OUTER: {
        id: '0446af1c-e76a-44bf-ab1a-d4fc2b6c9d16',
        projectName: 'VWA/PATAGONIA/HEADREST_REAR_OUT',
        subject: 'Apoyacabezas Trasero Lateral Con Costura Vista - Patagonia',
        amfeNumber: 'AMFE-155',
    },
};

// ─── Helpers ────────────────────────────────────────────────────────────
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
        preventionAction: data.prevAction || '',
        detectionAction: data.detAction || '',
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

// ─── Stats helpers ──────────────────────────────────────────────────────
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

// ============================================================================
// SHARED HEADER TEMPLATE
// ============================================================================
function makeHeader(target) {
    return {
        organization: 'BARACK MERCOSUL',
        location: 'PLANTA HURLINGHAM',
        client: 'Volkswagen',
        modelYear: '2025',
        subject: target.subject,
        startDate: '2025-03-25',
        revDate: '2025-03-25',
        team: 'Paulo Centurion - Ingenieria, Manuel Meszaros - Calidad, Cristina Rabago - Seguridad e Higiene, Mariana Vera - Produccion',
        amfeNumber: target.amfeNumber,
        responsible: 'Paulo Centurion',
        confidentiality: '-',
        partNumber: target.subject,
        processResponsible: 'Paulo Centurion',
        revision: 'A',
        approvedBy: '',
        scope: 'Proceso completo ' + target.subject,
        applicableParts: '',
    };
}

// ============================================================================
// OP 10: RECEPCIONAR MATERIA PRIMA (shared across all 3 headrests)
// ============================================================================
function makeOp10(productName) {
    return mkOp(10, 'RECEPCIONAR MATERIA PRIMA', [
        mkWE('Machine', 'Autoelevador / Transporte', [
            {
                desc: 'Garantizar la estabilidad e integridad del material durante el transporte',
                failures: [{
                    desc: 'Material / pieza golpeada o danada durante transporte',
                    efLocal: 'Riesgo de reproceso o scrap; paro de linea si no hay stock', S: 7,
                    efClient: 'Montaje con ajuste forzado/imposibilidad de ensamblar',
                    efUser: 'Posible ruido o falla estetica',
                    causes: [
                        { cause: 'Mala estiba y embalaje inadecuado', prev: 'Medios de embalaje validados', det: 'Verificacion del estado del embalaje antes de que el camion salga o inmediatamente cuando llega a su destino', O: 6, D: 6, ap: 'M' },
                        { cause: 'Manipulacion incorrecta en transito', prev: 'Existencia de instrucciones de trabajo que definen como debe estibarse y manipularse el material', det: 'Inspeccion visual en recepcion', O: 7, D: 6, ap: 'H',
                          prevAction: 'Reforzar instrucciones de manipulacion con capacitacion periodica', detAction: 'Implementar checklist de inspeccion visual en recepcion' },
                    ],
                }],
            },
        ]),
        mkWE('Man', 'Operador de produccion', [
            {
                desc: 'Verificar el cumplimiento y la trazabilidad de la materia prima recibida. Comprobar que el embalaje no este danado. Corroborar que la orden sea la correcta. Cargar la materia prima en ARB.',
                failures: [{
                    desc: 'Falta de documentacion o trazabilidad',
                    efLocal: 'Riesgo de mezclar lotes no conformes', S: 8,
                    efClient: 'Dificultades en trazabilidad si surge un reclamo',
                    efUser: 'No afecta',
                    causes: [
                        { cause: 'Procesos administrativos deficientes', prev: 'El sistema [ARB] obliga a registrar lote y codigo en recepcion y verifica contra base de datos', det: 'Verificacion automatica del lote/codigo registrado contra la base de datos', O: 3, D: 5, ap: 'L' },
                        { cause: 'Falta de inspeccion visual al recibir', prev: 'Instruccion de Trabajo de Recepcion que exige la verificacion fisica y visual del material', det: 'Inspeccion visual en recepcion', O: 5, D: 4, ap: 'L' },
                        { cause: 'Proveedor sin sistema robusto de trazabilidad', prev: 'Auditorias de Sistema y Requisitos que validan la capacidad de trazabilidad del proveedor antes de su aprobacion', det: 'Verificacion del Certificado de Conformidad y registro obligatorio de lote en el sistema de recepcion antes de la aceptacion de la materia prima', O: 6, D: 4, ap: 'H',
                          prevAction: 'Reforzar requisitos de trazabilidad en contratos con proveedores', detAction: 'Validar certificados de conformidad contra base de datos' },
                        { cause: 'No se utiliza el sistema ARB', prev: 'Procedimiento Operacional Estandar que exige y documenta la obligatoriedad del uso del sistema ARB', det: 'El sistema impide la emision de ubicaciones o el registro de entrada del material hasta que todos los campos del ARB sean completados', O: 6, D: 4, ap: 'H',
                          prevAction: 'Capacitacion obligatoria en uso del sistema ARB', detAction: 'Bloqueo automatico del sistema si campos incompletos' },
                    ],
                }],
            },
        ]),
        mkWE('Material', 'Materia prima / Etiquetas / Insumos', [
            {
                desc: 'Disponer de etiquetas blancas 100x60 y etiquetas de rechazo para clasificacion',
                failures: [{
                    desc: 'Material con especificacion erronea (dimensiones, color, dureza, etc.)',
                    efLocal: 'Potencial scrap', S: 6,
                    efClient: 'Potencial parada de linea. Problemas en el ensamble final',
                    efUser: 'Potencial reclamo de aspecto/comfort',
                    causes: [
                        { cause: 'Error en la orden de compra o ficha tecnica', prev: 'Revision de Ingenieria de la Ficha Tecnica/OC antes de la emision al proveedor', det: 'Control dimensional por muestreo en recepcion y Revision obligatoria del Certificado de Calidad (CoC)', O: 6, D: 6, ap: 'M', sc: 'SC' },
                        { cause: 'Falta de control dimensional en recepcion', prev: 'Procedimiento Operacional Estandar de Inspeccion', det: 'Control dimensional por muestreo con calibre en recepcion', O: 6, D: 6, ap: 'H', sc: 'SC',
                          prevAction: 'Implementar control dimensional obligatorio en recepcion', detAction: 'Agregar frecuencia de muestreo al plan de control' },
                        { cause: 'Proveedor no respeta tolerancias', prev: 'Requisitos Contractuales de Calidad y Auditorias al Proveedor para verificar su capacidad de Control Estadistico de Proceso', det: 'Revision del Certificado de Calidad (CoC) y Control Dimensional por Muestreo en recepcion', O: 7, D: 6, ap: 'H', sc: 'SC',
                          prevAction: 'Aumentar frecuencia de auditorias a proveedores criticos', detAction: 'Implementar muestreo reforzado en recepcion' },
                    ],
                }, {
                    desc: 'Contaminacion / suciedad en la materia prima',
                    efLocal: 'Problemas de calidad durante el ensamble', S: 6,
                    efClient: 'Potencial parada de linea',
                    efUser: 'Potencial reclamo de aspecto',
                    causes: [
                        { cause: 'Almacenaje inadecuado en transporte (sin protecciones)', prev: 'Procedimientos de Logistica sobre estiba segura y uso de Embalajes Cubiertos o cerrados', det: 'Inspeccion Visual de danos/suciedad en el empaque al recibir', O: 6, D: 6, ap: 'H', sc: 'SC',
                          prevAction: 'Reforzar uso de embalajes cerrados con proveedores', detAction: 'Checklist de inspeccion visual al recibir' },
                        { cause: 'Ambiente sucio en planta del proveedor', prev: 'Auditorias de Calidad', det: 'Inspeccion Visual de la pieza y Revision del Certificado de Calidad del proveedor', O: 5, D: 6, ap: 'M' },
                        { cause: 'Falta de inspeccion al llegar', prev: 'Instruccion de Trabajo', det: 'Inspeccion Visual del estado de la pieza/empaque, requerida como punto de control del proceso de recepcion', O: 6, D: 6, ap: 'M' },
                    ],
                }],
            },
        ]),
        mkWE('Measurement', 'Calibres / Instrumentos de medicion', [
            {
                desc: 'Verificar la trazabilidad de la materia prima asegurando que el numero de lote sea legible y coincida con el sistema ARB',
                failures: [],
            },
        ]),
        mkWE('Method', 'Hoja de Operaciones / Plan de reaccion', [
            {
                desc: 'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme.',
                failures: [],
            },
        ]),
        mkWE('Environment', 'Medio ambiente / Ley 19587', [
            {
                desc: 'Mantener las condiciones de seguridad ocupacional (iluminacion adecuada) segun la Ley 19587',
                failures: [],
            },
        ]),
    ]);
}

// ============================================================================
// OP 20: CORTE DEL VINILO / TELA (FUNDA) - shared across all 3
// ============================================================================
function makeOp20(productName) {
    return mkOp(20, 'CORTE DEL VINILO / TELA (FUNDA)', [
        mkWE('Machine', 'Mesa de corte BMA090 / BMA089', [
            {
                desc: 'La maquina alinea y corta automaticamente el vinilo / tela. Corte de paneles utilizando programa cutter control.',
                failures: [{
                    desc: 'Desviacion en el corte de los pliegos',
                    efLocal: 'Parada de linea entre una hora y un turno de produccion completo', S: 5,
                    efClient: 'Degradacion de la funcion primaria del vehiculo',
                    efUser: 'Degradacion de la funcion secundaria del vehiculo',
                    causes: [
                        { cause: 'Parametros de corte mal ingresados', prev: 'La maquina alinea y corta automaticamente el vinilo / tela', det: 'Set up de lanzamiento / Regla / Inspeccion visual', O: 5, D: 5, ap: 'M' },
                        { cause: 'Falla en la maquina', prev: 'Mantenimiento preventivo de la maquina', det: 'Verificacion de cuchillas antes del inicio del lote', O: 2, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Seleccion incorrecta del material (vinilo equivocado)',
                    efLocal: '100% del material cortado es scrap por material incorrecto', S: 5,
                    efClient: 'Parada de linea entre una hora y un turno de produccion completo',
                    efUser: 'Degradacion de la funcion secundaria del vehiculo',
                    causes: [
                        { cause: 'Falta de verificacion del codigo de material antes del corte', prev: 'El sistema genera automaticamente una orden de produccion con codigo y descripcion del vinilo', det: 'El operario verifica esa orden contra una planilla de mesa de corte', O: 5, D: 6, ap: 'M' },
                        { cause: 'Vinilo mal identificado', prev: 'Etiquetado de vinilo por logistica', det: 'Inspeccion visual', O: 5, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Corte incompleto o irregular',
                    efLocal: 'Una porcion de la produccion tiene que ser descartada (scrap)', S: 5,
                    efClient: 'Parada de linea entre una hora y un turno de produccion completo',
                    efUser: 'Degradacion de la funcion secundaria del vehiculo',
                    causes: [
                        { cause: 'Desgaste de la cuchilla de corte', prev: 'Mantenimiento preventivo de la maquina', det: 'Verificacion de las piezas cortadas mediante un mylar de control fisico, utilizado por el operario en la estacion de corte', O: 5, D: 5, ap: 'M' },
                    ],
                }, {
                    desc: 'Contaminacion del material durante el corte o almacenamiento en el area',
                    efLocal: 'Retrabajo de una porcion de la produccion', S: 3,
                    efClient: 'Menos del 10% de los productos afectados, requiere clasificacion adicional',
                    efUser: 'Defecto visual moderado en apariencia o vibracion',
                    causes: [
                        { cause: 'Ambiente de trabajo con polvo o particulas', prev: 'Procedimientos de limpieza periodica en el area de corte', det: 'Inspeccion visual', O: 3, D: 6, ap: 'M' },
                    ],
                }],
            },
        ]),
        mkWE('Man', 'Operador de produccion / Lider de equipo / Supervisor', [
            {
                desc: 'Montar rollo, preparar vinilo, configurar maquina, cortar y retirar pliegos',
                failures: [],
            },
        ]),
        mkWE('Material', 'Nylon / Calibre MC167 / Bin plastico / Etiqueta / Tijera / Cinta metrica', [
            {
                desc: 'Disponer de los insumos necesarios para el proceso de corte',
                failures: [],
            },
        ]),
        mkWE('Method', 'Hoja de Operacion / Instructivo', [
            {
                desc: 'Instructivo para colocar correctamente tension y velocidad de rollo. Definir el plan de reaccion ante un No conforme.',
                failures: [],
            },
        ]),
        mkWE('Measurement', 'Registros de control / Calibres', [
            {
                desc: 'Registros de control en calidad segun plan de control. Disponer y utilizar calibres de diferentes tamanos, micrometro, metro, probeta de flamabilidad, probeta de peeling.',
                failures: [],
            },
        ]),
        mkWE('Environment', 'Medio ambiente / Ley 19587', [
            {
                desc: 'Mantener las condiciones de seguridad ocupacional. Iluminacion 1500 Lux.',
                failures: [],
            },
        ]),
    ]);
}

// ============================================================================
// OP 30: COSTURA UNION ENTRE PANELES (shared across all 3)
// ============================================================================
function makeOp30(productName) {
    return mkOp(30, 'COSTURA UNION ENTRE PANELES', [
        mkWE('Machine', 'Maquina de coser', [
            {
                desc: 'Permite la union de los paneles. Costura union entre paneles.',
                failures: [{
                    desc: 'Costura descosida o debil',
                    efLocal: 'Impacta en produccion, genera scrap o retrabajos', S: 8,
                    efClient: 'Parada de linea mayor a un turno de produccion completo. Paro de envios.',
                    efUser: 'Scrap',
                    causes: [
                        { cause: 'Tension de hilo incorrecta', prev: 'Las costureras configuran la maquina segun hojas de operaciones', det: 'Calibre para verificar puntadas', O: 4, D: 6, ap: 'M' },
                        { cause: 'Puntadas demasiado largas', prev: 'Las maquinas poseen una guia', det: 'Inspeccion visual en linea', O: 4, D: 6, ap: 'M' },
                        { cause: 'Hilo inadecuado', prev: 'Las hojas de operaciones indican que hilo utilizar', det: 'Visual', O: 3, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Costura desviada o fuera de especificacion',
                    efLocal: 'Defecto estetico, posible rechazo del lote', S: 4,
                    efClient: 'No afecta funcionalidad, pero impacta percepcion de calidad',
                    efUser: 'Puede provocar rechazo por calidad visual',
                    causes: [
                        { cause: 'Falta de guia en costura', prev: 'Las maquinas poseen una guia', det: 'Inspeccion visual en linea', O: 4, D: 4, ap: 'M' },
                        { cause: 'Error del operario', prev: 'Verificacion de piquetes en piezas antes de coser para asegurar alineacion correcta', det: 'Uso de plantillas de referencia', O: 5, D: 5, ap: 'M' },
                    ],
                }, {
                    desc: 'Puntadas irregulares o arrugas',
                    efLocal: 'Defecto estetico sin impacto funcional ni de seguridad', S: 4,
                    efClient: 'Puede corregirse en produccion',
                    efUser: 'Puede provocar rechazo por calidad visual',
                    causes: [
                        { cause: 'Mala configuracion de la maquina', prev: 'Mantenimiento preventivo', det: 'Visual', O: 4, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Rotura del vinilo en la zona de la costura',
                    efLocal: 'Scrap o retrabajo', S: 6,
                    efClient: 'Pieza no conforme, posible rechazo total',
                    efUser: 'Puede causar falla en el uso, riesgo de seguridad',
                    causes: [
                        { cause: 'Falta de mantenimiento', prev: 'Checklist diaria de configuracion de maquina, mediante un set-up de control de lanzamiento', det: 'Inspeccion visual', O: 3, D: 6, ap: 'M' },
                        { cause: 'Agujas inadecuadas', prev: 'Se utilizan agujas especificas para vinilos', det: 'Inspeccion visual', O: 2, D: 6, ap: 'M' },
                        { cause: 'Puntada demasiado apretada', prev: 'Se configura la longitud de la puntada en la maquina', det: 'Detectable en linea de produccion', O: 2, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Seleccion incorrecta del hilo',
                    efLocal: 'Scrap', S: 5,
                    efClient: 'Puede generar rechazo por incumplimiento de especificaciones',
                    efUser: 'Puede generar rechazo por incumplimiento de especificaciones',
                    causes: [
                        { cause: 'Error en la carga de hilo en maquina', prev: 'Las hojas de operaciones indican que hilo utilizar', det: 'Visual', O: 5, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Largo de puntada fuera de especificacion',
                    efLocal: 'Scrap', S: 5,
                    efClient: 'Puede generar rechazo por incumplimiento de especificaciones',
                    efUser: 'Potencial reclamo de aspecto',
                    causes: [
                        { cause: 'Error en la configuracion de la maquina', prev: 'Checklist diaria de configuracion de maquina, mediante un set-up de control de lanzamiento', det: 'Calibre', O: 5, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Toma de costura fuera de especificacion',
                    efLocal: 'Scrap', S: 5,
                    efClient: 'Puede generar rechazo por incumplimiento de especificaciones',
                    efUser: 'Potencial reclamo de aspecto',
                    causes: [
                        { cause: 'Error en la configuracion de la maquina', prev: 'Configuracion de la maquina segun especificaciones', det: 'Calibre', O: 5, D: 6, ap: 'M' },
                    ],
                }],
            },
        ]),
        mkWE('Man', 'Operador de produccion / Lider de equipo / Supervisor', [
            {
                desc: 'Tomar la pieza en produccion, alinear ambas puntas de los cortes y realizar la costura de union',
                failures: [],
            },
        ]),
        mkWE('Material', 'Piquete / Lapicera / Hilos', [
            {
                desc: 'Disponer de materiales para la costura: piquete, lapicera, hilos',
                req: 'Costura completa, Costura firme',
                failures: [],
            },
        ]),
        mkWE('Method', 'Hoja de Operacion / Plan de reaccion', [
            {
                desc: 'Definir las distintas actividades de la operacion. Definir el plan de reaccion ante un No conforme.',
                failures: [],
            },
        ]),
        mkWE('Measurement', 'Registros de control / Calibres', [
            {
                desc: 'Registros de control en calidad segun plan de control. Definir las caracteristicas de producto o proceso que debe controlar el operador (autocontrol).',
                failures: [],
            },
        ]),
        mkWE('Environment', 'Medio ambiente / Ley 19587', [
            {
                desc: 'Mantener condiciones de seguridad ocupacional. Iluminacion 1500 Lux.',
                failures: [],
            },
        ]),
    ]);
}

// ============================================================================
// OP 40: COSTURA VISTA (shared across all 3)
// ============================================================================
function makeOp40(productName) {
    return mkOp(40, 'COSTURA VISTA', [
        mkWE('Machine', 'Maquina de coser', [
            {
                desc: 'Permite la costura decorativa. Realiza costura decorativa.',
                failures: [{
                    desc: 'Costura descosida o debil',
                    efLocal: 'Impacta en produccion, genera scrap o retrabajos', S: 8,
                    efClient: 'Parada de linea mayor a un turno de produccion completo',
                    efUser: 'Scrap',
                    causes: [
                        { cause: 'Tension de hilo incorrecta', prev: 'Las costureras configuran la maquina segun hojas de operaciones', det: 'Calibre para verificar puntadas', O: 4, D: 4, ap: 'M' },
                        { cause: 'Puntadas demasiado largas', prev: 'Checklist diaria de configuracion de maquina, mediante un set-up de control de lanzamiento', det: 'Inspeccion visual', O: 4, D: 4, ap: 'M' },
                        { cause: 'Hilo inadecuado', prev: 'Las hojas de operaciones indican que hilo utilizar', det: 'Visual', O: 3, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Costura desviada o fuera de especificacion',
                    efLocal: 'Defecto estetico, posible rechazo del lote', S: 4,
                    efClient: 'No afecta funcionalidad, pero impacta percepcion de calidad',
                    efUser: 'Puede provocar rechazo por calidad visual',
                    causes: [
                        { cause: 'Falta de guia en costura', prev: 'Las maquinas poseen una guia', det: 'Inspeccion visual en linea', O: 4, D: 4, ap: 'M' },
                        { cause: 'Error del operario', prev: 'Verificacion de piquetes en piezas antes de coser para asegurar alineacion correcta', det: 'Uso de plantillas de referencia', O: 5, D: 5, ap: 'M' },
                    ],
                }, {
                    desc: 'Puntadas irregulares o arrugas',
                    efLocal: 'Defecto estetico sin impacto funcional ni de seguridad', S: 4,
                    efClient: 'Puede corregirse en produccion',
                    efUser: 'Puede generar rechazo por incumplimiento de especificaciones',
                    causes: [
                        { cause: 'Mala configuracion de la maquina', prev: 'Mantenimiento preventivo', det: 'Visual', O: 5, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Rotura del vinilo en la zona de la costura',
                    efLocal: 'Scrap o retrabajo', S: 6,
                    efClient: 'Pieza no conforme, posible rechazo total',
                    efUser: 'Puede causar falla en el uso, riesgo de seguridad',
                    causes: [
                        { cause: 'Falta de mantenimiento', prev: 'Checklist diaria de configuracion de maquina, mediante un set-up de control de lanzamiento', det: 'Inspeccion visual', O: 3, D: 6, ap: 'M' },
                        { cause: 'Agujas inadecuadas', prev: 'Se utilizan agujas especificas para vinilos', det: 'Inspeccion visual', O: 2, D: 6, ap: 'M' },
                        { cause: 'Puntada demasiado apretada', prev: 'Se configura la longitud de la puntada en la maquina', det: 'Detectable en linea de produccion', O: 2, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Seleccion incorrecta del hilo',
                    efLocal: 'Scrap', S: 5,
                    efClient: 'Puede generar rechazo por incumplimiento de especificaciones',
                    efUser: 'Puede generar rechazo por incumplimiento de especificaciones',
                    causes: [
                        { cause: 'Error en la carga de hilo en maquina', prev: 'Las hojas de operaciones indican que hilo utilizar', det: 'Visual', O: 5, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Largo de puntada fuera de especificacion',
                    efLocal: 'Scrap', S: 5,
                    efClient: 'Puede generar rechazo por incumplimiento de especificaciones',
                    efUser: 'Potencial reclamo de aspecto',
                    causes: [
                        { cause: 'Error en la configuracion de la maquina', prev: 'Checklist diaria de configuracion de maquina, mediante un set-up de control de lanzamiento', det: 'Calibre', O: 5, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Toma de costura fuera de especificacion',
                    efLocal: 'Scrap', S: 5,
                    efClient: 'Puede generar rechazo por incumplimiento de especificaciones',
                    efUser: 'Potencial reclamo de aspecto',
                    causes: [
                        { cause: 'Error en la configuracion de la maquina', prev: 'Configuracion de la maquina segun especificaciones', det: 'Calibre', O: 5, D: 6, ap: 'M' },
                    ],
                }],
            },
        ]),
        mkWE('Man', 'Operador de produccion / Lider de equipo / Supervisor', [
            {
                desc: 'Posicionar la pieza en la maquina segun la referencia indicada y realizar la costura vista segun lo especificado en la hoja de operaciones',
                failures: [],
            },
        ]),
        mkWE('Material', 'Piquete / Lapicera / Hilos', [
            {
                desc: 'Disponer de materiales para la costura vista: piquete, lapicera, hilos',
                req: 'Costura completa, Costura firme',
                failures: [],
            },
        ]),
        mkWE('Method', 'Hoja de Operacion / Ayudas visuales', [
            {
                desc: 'Definir las distintas actividades de la operacion. Definir el plan de reaccion ante un No conforme. Mostrar como debe quedar el producto para evitar ciertos defectos.',
                failures: [],
            },
        ]),
        mkWE('Measurement', 'Registros de control / Calibres', [
            {
                desc: 'Registros de control en calidad segun plan de control. Definir las caracteristicas de producto o proceso que debe controlar el operador (autocontrol).',
                failures: [],
            },
        ]),
        mkWE('Environment', 'Medio ambiente / Ley 19587', [
            {
                desc: 'Mantener condiciones de seguridad ocupacional. Iluminacion 1500 Lux.',
                failures: [],
            },
        ]),
    ]);
}

// ============================================================================
// OP 50 FRONT ONLY: ENSAMBLE VARILLA + EPP
// ============================================================================
function makeOp50Front() {
    return mkOp(50, 'ENSAMBLE DE VARILLA + EPP', [
        mkWE('Machine', 'Prensa de Incrustacion de EPP', [
            {
                desc: 'Se preensamblan los componentes del apoyacabezas. Aplicar presion para insertar el EPP sobre la varilla.',
                failures: [{
                    desc: 'EPP no es completamente insertado en la varilla',
                    efLocal: 'Se requiere retrabajo en la misma estacion. Afecta la funcion primaria del componente', S: 9,
                    efClient: 'Genera paro de linea entre 1 hora y 1 turno',
                    efUser: 'Riesgo de seguridad',
                    causes: [
                        { cause: 'Presion insuficiente', prev: 'Mantenimiento preventivo', det: 'Poka-Yoke preventivo en estacion (Sensor verifica union completa del EPP a la varilla antes de iniciar el proceso)', O: 4, D: 2, ap: 'M', sc: 'CC' },
                        { cause: 'Incorrecta alineacion', prev: 'Uso de guias de posicionamiento', det: 'Poka-Yoke preventivo en estacion (Sensor verifica alineacion y correcta colocacion de la varilla antes de iniciar el proceso)', O: 4, D: 2, ap: 'M', sc: 'CC' },
                        { cause: 'Falla en la maquina', prev: 'Mantenimiento preventivo', det: 'Inspeccion visual', O: 2, D: 2, ap: 'M' },
                    ],
                }, {
                    desc: 'Varilla desalineada',
                    efLocal: 'Retrabajo en la misma estacion', S: 4,
                    efClient: 'Paro de linea entre 1 hora y 1 turno',
                    efUser: 'No afecta',
                    causes: [
                        { cause: 'Colocacion incorrecta por parte del operador', prev: 'Uso de guias de posicionamiento', det: 'Poka-Yoke preventivo en estacion (Sensor verifica alineacion y correcta colocacion de la varilla antes de iniciar el proceso)', O: 4, D: 2, ap: 'M' },
                    ],
                }, {
                    desc: 'Tiempo de presion inadecuado',
                    efLocal: 'Retrabajo en la misma estacion', S: 4,
                    efClient: 'No afecta',
                    efUser: 'No afecta',
                    causes: [
                        { cause: 'Operador retira la pieza antes del tiempo adecuado', prev: 'Temporizador automatico en la maquina: El proceso se detiene si la puerta se abre antes de su finalizacion', det: 'Poka-Yoke preventivo (Temporizador automatico en la maquina)', O: 2, D: 2, ap: 'M' },
                    ],
                }],
            },
        ]),
        mkWE('Man', 'Operador de produccion / Lider de equipo / Supervisor', [
            {
                desc: 'Colocar varilla en maquina, tomar inserto EPP, alinear con varilla, activar maquina para incrustacion',
                failures: [],
            },
        ]),
        mkWE('Method', 'Hoja de Operacion / Ayudas visuales', [
            {
                desc: 'Definir las distintas actividades de la operacion. Definir el plan de reaccion ante un No conforme.',
                failures: [],
            },
        ]),
        mkWE('Measurement', 'Registros de control', [
            {
                desc: 'Registros de control en calidad segun plan de control',
                failures: [],
            },
        ]),
        mkWE('Environment', 'Medio ambiente / Ley 19587', [
            {
                desc: 'Mantener condiciones de seguridad ocupacional. Iluminacion 1500 Lux.',
                failures: [],
            },
        ]),
    ]);
}

// ============================================================================
// OP 60 FRONT / OP 50 REAR: INYECCION PUR
// ============================================================================
function makeOpInyeccionPUR(opNumber) {
    return mkOp(opNumber, 'INYECCION PUR - APOYACABEZAS', [
        mkWE('Machine', 'Sistema de vertido de PUR / Unidad de curado', [
            {
                desc: 'Se inyecta PUR en la funda con varilla e inserto, se espuma, cura y desmoldea el apoyacabezas. Vierte PUR liquido en la funda colocada dentro del molde.',
                failures: [{
                    desc: 'Pieza con rebaba visible',
                    efLocal: 'Pieza con rebaba o perdida de PUR (puede requerir retrabajo en estacion)', S: 4,
                    efClient: 'Rebabas o restos externos (retrabajo parcial en estacion)',
                    efUser: 'Defecto visual perceptible (rebaba o marca)',
                    causes: [
                        { cause: 'Fuga leve de PUR durante inyeccion (por mala posicion o presion)', prev: 'Control del volumen y presion del PUR para evitar que se genere rebaba', det: 'Inspecccion visual post-desmoldeo', O: 4, D: 6, ap: 'L' },
                    ],
                }, {
                    desc: 'Sellado incompleto del orificio inferior',
                    efLocal: 'Activa plan de reaccion menor', S: 6,
                    efClient: 'Apariencia visual alterada, activa plan de reaccion',
                    efUser: 'Defecto moderado perceptible',
                    causes: [
                        { cause: 'Formula incorrecta', prev: 'Configuracion inicial del dosificador (setup)', det: 'Inspeccion visual post-desmoldeo', O: 6, D: 6, ap: 'M' },
                        { cause: 'Dosificacion insuficiente de PUR', prev: 'Calibracion y mantenimiento periodico del dosificador de PUR, junto con configuracion validada del programa de inyeccion para asegurar cantidad correcta', det: 'Inspeccion visual post-desmoldeo', O: 6, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Inserto EPP mal posicionado dentro de la funda',
                    efLocal: 'ligera deformacion o asimetria genera retrabajo parcial en estacion', S: 2,
                    efClient: 'plan de reaccion menor',
                    efUser: 'defecto moderado perceptible',
                    causes: [
                        { cause: 'Inserto colocado sin guia, se mueve al cerrar el molde', prev: 'Guia fisica dentro del molde que limita el movimiento del inserto EPP y asegura su correcta posicion al momento del cierre', det: 'Inspeccion visual del operador antes del cierre del molde', O: 2, D: 5, ap: 'L' },
                    ],
                }, {
                    desc: 'Perdida de material (fuga leve de PUR por costura abierta)',
                    efLocal: 'Scrap de la espuma / retrabajo', S: 3,
                    efClient: 'Plan de reaccion importante',
                    efUser: 'Afecta funcion secundaria, posible percepcion de calidad o seguridad',
                    causes: [
                        { cause: 'Costura previa abierta, sin cierre completo antes de espumado', prev: 'Control del volumen y presion de inyeccion del PUR dentro de los limites validados para el diseno de la funda', det: 'Inspeccion visual post-desmoldeo', O: 3, D: 5, ap: 'M' },
                    ],
                }, {
                    desc: 'Pieza fuera de peso especificado (Apoyacabezas delantero: 600g, trasero lateral: 589g, trasero central: 529g)',
                    efLocal: 'Scrap de la espuma / retrabajo', S: 3,
                    efClient: 'Plan de reaccion importante',
                    efUser: 'Afecta funcion secundaria, posible percepcion de calidad o seguridad',
                    causes: [
                        { cause: 'Variacion en la dosificacion del PUR (componente A y B), burbuja interna, fuga parcial durante el espumado o carga incorrecta en el ciclo', prev: 'Calibracion y mantenimiento periodico del dosificador de PUR, junto con configuracion validada del programa de inyeccion para asegurar cantidad correcta', det: 'Control de peso en balanza tras el desmoldeo, con hoja de registro o validacion por lote', O: 3, D: 5, ap: 'M' },
                    ],
                }],
            },
        ]),
        mkWE('Man', 'Operador de produccion / Lider de equipo / Supervisor', [
            {
                desc: 'Colocar conjunto apoyacabezas dentro del molde, verter PUR, curar, extraer pieza terminada',
                failures: [],
            },
        ]),
        mkWE('Method', 'Hoja de Operacion / Ayudas visuales', [
            {
                desc: 'Definir las distintas actividades de la operacion. Definir el plan de reaccion ante un No conforme.',
                failures: [],
            },
        ]),
        mkWE('Measurement', 'Registros de control / Balanza', [
            {
                desc: 'Registros de control en calidad segun plan de control',
                failures: [],
            },
        ]),
        mkWE('Environment', 'Medio ambiente / Ley 19587', [
            {
                desc: 'Mantener condiciones de seguridad ocupacional. Iluminacion 1500 Lux.',
                failures: [],
            },
        ]),
    ]);
}

// ============================================================================
// OP 70 FRONT / OP 60 REAR: INSPECCION FINAL
// ============================================================================
function makeOpInspeccionFinal(opNumber) {
    return mkOp(opNumber, 'INSPECCION FINAL - APOYACABEZAS INYECTADO', [
        mkWE('Machine', 'Equipo de inspeccion', [
            {
                desc: 'Se realiza la inspeccion final del apoyacabezas.',
                failures: [{
                    desc: 'Pieza con rebaba visible',
                    efLocal: 'Separamos la pieza, requiere retrabajo parcial en estacion (corte o recorte)', S: 4,
                    efClient: 'Plan de reaccion menor',
                    efUser: 'Defecto moderado perceptible',
                    causes: [
                        { cause: 'Fuga leve de PUR durante inyeccion (por mala posicion o presion)', prev: 'Control del volumen y presion del PUR para evitar que se genere rebaba', det: 'Inspeccion visual con iluminacion dirigida y estandar visual con muestra limite', O: 4, D: 6, ap: 'M' },
                    ],
                }, {
                    desc: 'Costura vista con desviacion o imperfeccion estetica',
                    efLocal: 'pieza es rechazada y se descarta (scrap)', S: 8,
                    efClient: 'Defecto notorio visual',
                    efUser: 'Paro de linea >1 turno y reclamo severo',
                    causes: [
                        { cause: 'Desajuste en guia', prev: 'Guia fisica en la maquina de coser y ajuste validado del pie y avance, junto con setup estandarizado para asegurar alineacion de la costura decorativa', det: 'Inspeccion visual con plantilla de referencia', O: 3, D: 5, ap: 'M' },
                        { cause: 'Variacion en tensiones o avance del material', prev: 'Capacitacion de personal', det: 'Inspeccion visual con plantilla de referencia', O: 3, D: 5, ap: 'M' },
                        { cause: 'Mal centrado del operador', prev: 'Capacitacion de personal', det: 'Inspeccion visual con plantilla de referencia', O: 3, D: 5, ap: 'M' },
                    ],
                }],
            },
        ]),
        mkWE('Man', 'Operador de produccion / Lider de equipo', [
            {
                desc: 'Verificar visualmente el estado de la costura externa. Revisar apariencia general (rebabas, marcas, deformaciones). Revisar sellado del orificio inferior. Confirmar presencia y posicion correcta de varilla e inserto EPP. Etiquetar piezas conformes.',
                failures: [],
            },
        ]),
        mkWE('Method', 'Hoja de Operacion / Ayudas visuales', [
            {
                desc: 'Definir las distintas actividades de la operacion. Definir el plan de reaccion ante un No conforme.',
                failures: [],
            },
        ]),
        mkWE('Measurement', 'Registros de control', [
            {
                desc: 'Registros de control en calidad segun plan de control',
                failures: [],
            },
        ]),
        mkWE('Environment', 'Medio ambiente / Ley 19587', [
            {
                desc: 'Mantener condiciones de seguridad ocupacional. Iluminacion 1500 Lux.',
                failures: [],
            },
        ]),
    ]);
}

// ============================================================================
// OP 80 FRONT / OP 70 REAR: EMBALAJE
// ============================================================================
function makeOpEmbalaje(opNumber) {
    return mkOp(opNumber, 'EMBALAJE', [
        mkWE('Machine', 'Medios de embalaje', [
            {
                desc: 'Se colocan los apoyacabezas inspeccionados en su embalaje para su traslado o almacenamiento.',
                failures: [{
                    desc: 'Pieza deformada por mal posicionamiento en el embalaje',
                    efLocal: 'Dano permanente en la espuma o en la costura', S: 8,
                    efClient: 'Paro de linea temporal o devolucion del lote',
                    efUser: 'Defecto notorio y disconformidad inmediata',
                    causes: [
                        { cause: 'Las piezas se colocan sin separadores adecuados, con contacto directo o presion entre ellas, lo que genera deformacion durante el almacenamiento o traslado', prev: 'Uso de separadores, bandejas o estructuras que mantienen la forma del apoyacabezas durante el embalaje y almacenaje', det: 'Inspeccion visual del operador al momento de ubicar las piezas en el embalaje, verificando que no haya contacto directo, presion excesiva o mala colocacion', O: 3, D: 5, ap: 'M' },
                    ],
                }, {
                    desc: 'Colocacion de mayor o menor cantidad de piezas por medio',
                    efLocal: '100% produccion requiere retrabajo en estacion', S: 3,
                    efClient: 'Plan de reaccion importante por desvio de cantidad (stock incorrecto, paro leve)',
                    efUser: 'El error se corrige antes de llegar al usuario',
                    causes: [
                        { cause: 'Falta de control en la cantidad cargada por medio debido a ausencia de guia visual o desatencion del operador', prev: 'Estandar visual con foto de referencia indicando la cantidad por medio, visible en el puesto de trabajo', det: 'Verificacion visual del medio completo antes del cierre', O: 3, D: 6, ap: 'M' },
                    ],
                }],
            },
        ]),
        mkWE('Man', 'Operador de produccion / Lider de equipo', [
            {
                desc: 'Separar piezas conformes. Colocar cada pieza en bolsas protectoras. Acomodar piezas dentro del medio de embalaje. Colocar etiquetas de trazabilidad en los medios.',
                failures: [],
            },
        ]),
        mkWE('Material', 'Bolsas plasticas / Etiquetas adhesivas / Medios de embalaje', [
            {
                desc: 'Disponer de bolsas plasticas, etiquetas adhesivas y medios de embalaje',
                failures: [],
            },
        ]),
        mkWE('Method', 'Hoja de Operacion / Ayudas visuales', [
            {
                desc: 'Definir las distintas actividades de la operacion. Definir el plan de reaccion ante un No conforme.',
                failures: [],
            },
        ]),
        mkWE('Measurement', 'Registros de control', [
            {
                desc: 'Registros de control en calidad segun plan de control',
                failures: [],
            },
        ]),
        mkWE('Environment', 'Medio ambiente / Ley 19587', [
            {
                desc: 'Mantener condiciones de seguridad ocupacional. Iluminacion 1500 Lux.',
                failures: [],
            },
        ]),
    ]);
}

// ============================================================================
// FRONT-SPECIFIC: Op 40 has an extra failure mode (distancia entre costuras)
// ============================================================================
function makeOp40Front(productName) {
    const op = makeOp40(productName);
    // Add the extra "Distancia entre costuras fuera de especificacion" failure
    // to the Machine work element
    const machineWE = op.workElements.find(we => we.type === 'Machine');
    if (machineWE && machineWE.functions[0]) {
        machineWE.functions[0].failures.push(mkFailure({
            desc: 'Distancia entre costuras fuera de especificacion',
            efLocal: 'Scrap', S: 5,
            efClient: 'Puede generar rechazo por incumplimiento de especificaciones',
            efUser: 'Potencial reclamo de aspecto',
            causes: [
                { cause: 'Error en la configuracion de la maquina', prev: 'Configuracion de la maquina segun especificaciones', det: 'Calibre', O: 5, D: 6, ap: 'M' },
            ],
        }));
    }
    return op;
}

// ============================================================================
// REAR-SPECIFIC: Op 40 adds "Distancia entre costuras" too
// ============================================================================
function makeOp40Rear(productName) {
    const op = makeOp40(productName);
    const machineWE = op.workElements.find(we => we.type === 'Machine');
    if (machineWE && machineWE.functions[0]) {
        machineWE.functions[0].failures.push(mkFailure({
            desc: 'Distancia entre costuras fuera de especificacion',
            efLocal: 'Scrap', S: 5,
            efClient: 'Puede generar rechazo por incumplimiento de especificaciones',
            efUser: 'Potencial reclamo de aspecto',
            causes: [
                { cause: 'Error en la configuracion de la maquina', prev: 'Configuracion de la maquina segun especificaciones', det: 'Calibre', O: 5, D: 6, ap: 'M' },
            ],
        }));
    }
    return op;
}

// ============================================================================
// BUILD OPERATIONS FOR EACH HEADREST TYPE
// ============================================================================

// FRONT: 8 operations (10, 20, 30, 40, 50, 60, 70, 80)
function buildFrontOperations() {
    return [
        makeOp10('Apoyacabezas Delantero'),
        makeOp20('Apoyacabezas Delantero'),
        makeOp30('Apoyacabezas Delantero'),
        makeOp40Front('Apoyacabezas Delantero'),
        makeOp50Front(),
        makeOpInyeccionPUR(60),
        makeOpInspeccionFinal(70),
        makeOpEmbalaje(80),
    ];
}

// REAR CENTER: 7 operations (10, 20, 30, 40, 50=PUR, 60=Inspeccion, 70=Embalaje)
function buildRearCenterOperations() {
    return [
        makeOp10('Apoyacabezas Trasero Central'),
        makeOp20('Apoyacabezas Trasero Central'),
        makeOp30('Apoyacabezas Trasero Central'),
        makeOp40Rear('Apoyacabezas Trasero Central'),
        makeOpInyeccionPUR(50),
        makeOpInspeccionFinal(60),
        makeOpEmbalaje(70),
    ];
}

// REAR OUTER: 7 operations (10, 20, 30, 40, 50=PUR, 60=Inspeccion, 70=Embalaje)
function buildRearOuterOperations() {
    return [
        makeOp10('Apoyacabezas Trasero Lateral'),
        makeOp20('Apoyacabezas Trasero Lateral'),
        makeOp30('Apoyacabezas Trasero Lateral'),
        makeOp40Rear('Apoyacabezas Trasero Lateral'),
        makeOpInyeccionPUR(50),
        makeOpInspeccionFinal(60),
        makeOpEmbalaje(70),
    ];
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
    console.log('================================================================');
    console.log('  SEED: HEADREST REAL AMFE — VWA/PATAGONIA');
    console.log('  Replacing stubs for 3 master (L0) documents');
    console.log('================================================================');

    await initSupabase();

    // Build all 3 datasets
    const datasets = [
        { target: TARGETS.FRONT, operations: buildFrontOperations() },
        { target: TARGETS.REAR_CENTER, operations: buildRearCenterOperations() },
        { target: TARGETS.REAR_OUTER, operations: buildRearOuterOperations() },
    ];

    for (const { target, operations } of datasets) {
        console.log(`\n── ${target.projectName} ──`);

        // Calculate stats
        const { total: causeCount, apH, apM } = countCauses(operations);
        const coverage = calcCoverage(operations);

        console.log(`  Operations: ${operations.length}`);
        console.log(`  Causes: ${causeCount} (H=${apH}, M=${apM})`);
        console.log(`  Coverage: ${coverage}%`);

        // Build AMFE document
        const header = makeHeader(target);
        const amfeDoc = { header, operations };
        const amfeDataJson = JSON.stringify(amfeDoc);
        const amfeChecksum = sha256(amfeDataJson);

        // Verify document exists
        const existing = await selectSql(
            `SELECT id, operation_count, cause_count FROM amfe_documents WHERE id = ?`,
            [target.id]
        );

        if (existing.length === 0) {
            console.log(`  WARNING: Document ${target.id} not found! Skipping.`);
            continue;
        }

        console.log(`  Found existing doc: ops=${existing[0].operation_count}, causes=${existing[0].cause_count}`);

        // UPDATE the existing document
        await execSql(`UPDATE amfe_documents SET
            amfe_number = ?,
            subject = ?,
            client = ?,
            part_number = ?,
            responsible = ?,
            organization = ?,
            operation_count = ?,
            cause_count = ?,
            ap_h_count = ?,
            ap_m_count = ?,
            coverage_percent = ?,
            start_date = ?,
            last_revision_date = ?,
            data = ?,
            checksum = ?,
            updated_at = NOW()
            WHERE id = ?`,
            [target.amfeNumber, target.subject, 'Volkswagen', target.subject,
             'Paulo Centurion', 'BARACK MERCOSUL',
             operations.length, causeCount, apH, apM, coverage,
             '2025-03-25', '2025-03-25',
             amfeDataJson, amfeChecksum,
             target.id]);

        console.log(`  UPDATED: ${target.amfeNumber} -> ${operations.length} ops, ${causeCount} causes (H=${apH}, M=${apM})`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // VERIFICATION
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  VERIFICATION');
    console.log('══════════════════════════════════════════════════════════════');

    for (const target of Object.values(TARGETS)) {
        const rows = await selectSql(
            `SELECT id, amfe_number, project_name, operation_count, cause_count, ap_h_count, ap_m_count, coverage_percent
             FROM amfe_documents WHERE id = ?`,
            [target.id]
        );

        if (rows.length > 0) {
            const r = rows[0];
            console.log(`\n  ${r.project_name}:`);
            console.log(`    AMFE#: ${r.amfe_number}`);
            console.log(`    Ops: ${r.operation_count}, Causes: ${r.cause_count}`);
            console.log(`    AP: H=${r.ap_h_count}, M=${r.ap_m_count}`);
            console.log(`    Coverage: ${r.coverage_percent}%`);
        } else {
            console.log(`\n  ${target.projectName}: NOT FOUND!`);
        }
    }

    // Also check total across all headrest AMFEs
    const allHeadrest = await selectSql(
        `SELECT project_name, operation_count, cause_count, ap_h_count, ap_m_count
         FROM amfe_documents
         WHERE project_name LIKE 'VWA/PATAGONIA/HEADREST%'
         ORDER BY project_name`
    );

    console.log(`\n  Total headrest AMFE documents: ${allHeadrest.length}`);
    let totalOps = 0, totalCauses = 0, totalH = 0, totalM = 0;
    for (const r of allHeadrest) {
        totalOps += r.operation_count || 0;
        totalCauses += r.cause_count || 0;
        totalH += r.ap_h_count || 0;
        totalM += r.ap_m_count || 0;
    }
    console.log(`  Total across all: Ops=${totalOps}, Causes=${totalCauses}, H=${totalH}, M=${totalM}`);

    close();
    console.log('\nDone.');
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
