#!/usr/bin/env node
/**
 * SEED: AMFE TELAS PLANAS — PWA
 *
 * Crea el AMFE de Telas Planas (Tela Assento Dianteiro) en la DB SQLite.
 * Fuente: AMFE_TELAS_PLANAS.txt (formato viejo Barack Mercosul)
 *
 * Operaciones: OP10 (Recepción), OP20/21 (Corte), OP10 (Aplix),
 *              OP11 (Retrabajo), OP20 (Horno), OP30 (Termoformado),
 *              OP40 (Corte prensa), OP50 (Perforado), OP60/61 (Soldadura),
 *              Op.70 (Control final), Op.80 (Embalaje)
 *
 * Usage: node scripts/seed-amfe-telas-planas.mjs
 */

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash, randomUUID } from 'crypto';

const uuid = () => randomUUID();
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const DB_PATH = join(
    process.env.APPDATA || join(process.env.USERPROFILE || 'C:\\Users\\FacundoS-PC', 'AppData', 'Roaming'),
    'com.barackmercosul.app',
    'barack_mercosul.db'
);

// ─── Helpers (same pattern as seed-amfe-inserto.mjs) ────────────────────

function mkCause(data) {
    return {
        id: uuid(), cause: data.cause || '', preventionControl: data.prev || '',
        detectionControl: data.det || '', occurrence: data.O ?? '', detection: data.D ?? '',
        ap: data.ap || '', characteristicNumber: data.charNum || '', specialChar: data.sc || '',
        filterCode: '', preventionAction: '', detectionAction: '', responsible: '',
        targetDate: '', status: '', actionTaken: '', completionDate: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '', observations: data.obs || '',
    };
}

function mkFailure(data) {
    return {
        id: uuid(), description: data.desc || '',
        effectLocal: data.efLocal || '', effectNextLevel: data.efClient || '', effectEndUser: data.efUser || '',
        severity: data.S ?? '', severityLocal: '', severityNextLevel: '', severityEndUser: '',
        causes: (data.causes || []).map(mkCause),
    };
}

function mkFunc(data) {
    return { id: uuid(), description: data.desc || '', requirements: data.req || '', failures: (data.failures || []).map(mkFailure) };
}

function mkWE(type, name, functions) {
    return { id: uuid(), type, name, functions: functions.map(mkFunc) };
}

function mkOp(opNumber, name, workElements) {
    return { id: uuid(), opNumber: String(opNumber), name, workElements };
}

// ─── AMFE Header ────────────────────────────────────────────────────────

const header = {
    organization: 'BARACK MERCOSUL',
    location: 'Planta Hurlingham',
    client: 'PWA',
    customerName: 'PWA',
    modelYear: '',
    subject: 'TELA ASSENTO DIANTEIRO',
    partNumber: '21-8909',
    responsibleDesign: 'F.SANTORO',
    startDate: '2022-10-31',
    revDate: '2024-12-02',
    revision: '2',
    teamMembers: 'CAL: M.NIEVE, PROD: G.CAL, INGEN: F.SANTORO',
    plant: 'PWA',
    companyName: 'BARACK MERCOSUL',
    applicableParts: '21-8909 CONJ TELA FSC LH P2X',
};

// ─── Operations ─────────────────────────────────────────────────────────

const operations = [
    // OP 10 — Recepción de Punzonado
    mkOp(10, 'Recepción de Punzonado', [
        mkWE('Method', 'Recepción de materiales', [
            {
                desc: 'Recibir y verificar material punzonado conforme a especificaciones',
                failures: [
                    { desc: 'Gramaje Mayor a 120g/m2+15%', S: 7, efLocal: 'Material incumple gramaje, falla en espumado', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, det: 'Recepción de materiales', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Gramaje Menor a 120g/m2-15%', S: 7, efLocal: 'Material incumple gramaje, falla en espumado', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, det: 'Recepción de materiales', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Ancho de material distinto a 2m', S: 7, efLocal: 'Incumplimiento de ancho, falla en troquelado', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, det: 'Recepción de materiales', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Flamabilidad fuera de especificación (100 mm/min)', S: 10, efLocal: 'Material incumple flamabilidad', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, det: 'Recepción de materiales', D: 6, ap: 'H', sc: 'CC' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 10b — Recepción de Bi-componente
    mkOp('10b', 'Recepción de Punzonado con Bi-componente', [
        mkWE('Method', 'Recepción de materiales', [
            {
                desc: 'Recibir y verificar bi-componente conforme a especificaciones',
                failures: [
                    { desc: 'Gramaje Mayor a 280g/m2+15%', S: 7, efLocal: 'Material incumple gramaje, falla en espumado', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, det: 'Recepción de materiales', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Gramaje Menor a 280g/m2-15%', S: 7, efLocal: 'Material incumple gramaje', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, D: 6, ap: 'L' },
                    ]},
                    { desc: 'Ancho de material distinto a 1.5m', S: 7, efLocal: 'Incumplimiento de ancho', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, det: 'Recepción de materiales', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Flamabilidad fuera de especificación (100 mm/min)', S: 10, efLocal: 'Material incumple flamabilidad', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, det: 'Recepción de materiales', D: 6, ap: 'H', sc: 'CC' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 10c — Recepción de Aplix
    mkOp('10c', 'Recepción de Rollo de Aplix', [
        mkWE('Method', 'Recepción de materiales', [
            {
                desc: 'Recibir y verificar rollo de aplix conforme a especificaciones',
                failures: [
                    { desc: 'Ancho de rollo distinto a 0.25m', S: 7, efLocal: 'Incumplimiento de ancho, falla en troquelado', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, det: 'Recepción de materiales', D: 6, ap: 'L' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 20 — Corte por máquina (pieza central)
    mkOp(20, 'Corte por máquina de pieza Central', [
        mkWE('Machine', 'Máquina de corte automática', [
            {
                desc: 'Cortar piezas centrales según especificación dimensional',
                failures: [
                    { desc: 'Agujeros de Ø4 menor a 17 por pieza', S: 7, efLocal: 'Mal posicionamiento en molde del cliente', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control inicio y fin de turno', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Agujeros de Ø4 mayor a 17 por pieza', S: 7, efLocal: 'Mal posicionamiento en molde del cliente', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control inicio y fin de turno', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Agujeros de Ø4 fuera de especificación (4mm)', S: 7, efLocal: 'Mal posicionamiento en molde del cliente', causes: [
                        { cause: 'Programación equivocada de la máquina de corte automática', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control inicio y fin de turno', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Orificios fuera de posición según pieza patrón', S: 7, efLocal: 'Mal posicionamiento en molde del cliente', causes: [
                        { cause: 'Programación equivocada de la máquina de corte automática', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control inicio y fin de turno', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Material distinto a punzonado de 120g/m2', S: 7, efLocal: 'Incumplimiento de especificaciones', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control inicio y fin de turno', D: 7, ap: 'L' },
                    ]},
                    { desc: 'Forma fuera de especificación según pieza patrón', S: 7, efLocal: 'Mal posicionamiento en molde del cliente', causes: [
                        { cause: 'Programación equivocada de la máquina de corte automática', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control inicio y fin de turno', D: 6, ap: 'L' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 21 — Corte por máquina (blank piezas laterales)
    mkOp(21, 'Corte por máquina, Blank de piezas laterales', [
        mkWE('Machine', 'Máquina de corte automática', [
            {
                desc: 'Cortar blanks de piezas laterales según especificación',
                failures: [
                    { desc: 'Medida mayor a 550mmx500mm', S: 7, efLocal: 'Mal posicionamiento del blank en matriz', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control inicio y fin de turno', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Medida menor a 550mmx500mm', S: 7, efLocal: 'Mal posicionamiento del blank en matriz', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control inicio y fin de turno', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Material distinto a punzonado de 280g/m2', S: 7, efLocal: 'Incumplimiento de especificaciones', causes: [
                        { cause: 'Material fuera de especificación requerida', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control inicio y fin de turno', D: 7, ap: 'L' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 10d — Colocado de Aplix
    mkOp('10d', 'Colocado de Aplix', [
        mkWE('Method', 'Colocación manual de aplix', [
            {
                desc: 'Colocar aplix en posición y cantidad correcta',
                failures: [
                    { desc: 'Colocación de menos de 9 aplix', S: 7, efLocal: 'Mal posicionamiento en molde del cliente / Rechazo', causes: [
                        { cause: 'Orificios fuera de posición / Error del operario', O: 2, prev: 'Set up de la máquina / Capacitación del operario', det: 'Control inicio y fin de turno / Pieza patrón', D: 7, ap: 'L' },
                    ]},
                    { desc: 'Colocación de más de 9 aplix', S: 7, efLocal: 'Mal posicionamiento en molde del cliente', causes: [
                        { cause: 'Orificios fuera de posición / Error del operario', O: 2, prev: 'Set up de la máquina / Capacitación del operario', det: 'Control inicio y fin de turno / Pieza patrón', D: 7, ap: 'L' },
                    ]},
                    { desc: 'Colocación de Aplix en posición distinta a la especificada', S: 7, efLocal: 'Mal posicionamiento en molde del cliente', causes: [
                        { cause: 'Orificios fuera de posición / Error del operario', O: 2, prev: 'Set up de la máquina / Capacitación del operario', det: 'Control inicio y fin de turno / Pieza patrón', D: 7, ap: 'L' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 20b — Horno
    mkOp('20b', 'Horno', [
        mkWE('Machine', 'Horno de calentamiento', [
            {
                desc: 'Calentar material de manera uniforme para termoformado',
                failures: [
                    { desc: 'Temperatura del horno distinta de 150°C ±20°C', S: 7, efLocal: 'Pieza con quemaduras', causes: [
                        { cause: 'Mal seteo de la máquina / Error del operario', O: 2, prev: 'Hoja de operaciones / Set up de lanzamiento', det: 'Set up de lanzamiento', D: 7, ap: 'L' },
                    ]},
                    { desc: 'Tiempo de calentamiento distinto de 60s', S: 7, efLocal: 'Pieza con quemaduras', causes: [
                        { cause: 'Mal seteo de la máquina / Error del operario', O: 2, prev: 'Hoja de operaciones / Set up de lanzamiento', det: 'Set up de lanzamiento', D: 7, ap: 'L' },
                    ]},
                    { desc: 'Calentar el material de manera no uniforme', S: 7, efLocal: 'Imposibilidad de realizar proceso posterior', causes: [
                        { cause: 'Mal posicionamiento de la pieza, Error del Operario', O: 3, prev: 'Capacitación del operario', det: 'Control inicio y fin de turno / Pieza patrón', D: 7, ap: 'H' },
                        { cause: 'Falla en el horno', O: 3, prev: 'Set Up del Horno / Mantenimiento Preventivo', det: 'Control inicio y fin de turno', D: 6, ap: 'M' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 30 — Termoformado
    mkOp(30, 'Termoformado', [
        mkWE('Machine', 'Termoformadora', [
            {
                desc: 'Termoformar piezas según especificación',
                failures: [
                    { desc: 'Termoformar de forma desprolija', S: 7, efLocal: 'Pieza fuera de dimensiones', causes: [
                        { cause: 'Mal posicionamiento de la pieza, Material Fuera de especificación, Error del Operario', O: 3, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'M' },
                    ]},
                    { desc: 'Termoformar de forma incompleta', S: 7, efLocal: 'No utilización de dispositivo de apertura de agujeros', causes: [
                        { cause: 'Mal posicionamiento de la pieza, Material Fuera de especificación, Error del Operario', O: 6, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 3, ap: 'M' },
                    ]},
                    { desc: 'Termoformado de pieza con roturas', S: 7, efLocal: 'Pieza fuera de dimensiones, Rechazo del cliente', causes: [
                        { cause: 'Mal posicionamiento de la pieza, Material Fuera de especificación, Error del Operario', O: 6, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 3, ap: 'M' },
                    ]},
                    { desc: 'Pieza con roturas', S: 7, efLocal: 'Rechazo del cliente, Scrap', causes: [
                        { cause: 'Mal posicionamiento de la pieza, error del operario', O: 6, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 3, ap: 'M' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 40 — Corte de la pieza en prensa
    mkOp(40, 'Corte de la pieza en prensa', [
        mkWE('Machine', 'Prensa de corte', [
            {
                desc: 'Cortar pieza termoformada en prensa',
                failures: [
                    { desc: 'Corte desprolijo', S: 7, efLocal: 'Rechazo del cliente, Scrap', causes: [
                        { cause: 'Mal posicionamiento de la pieza, error del operario', O: 6, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 3, ap: 'M' },
                    ]},
                    { desc: 'Corte Perimetral incompleto', S: 7, efLocal: 'Rechazo del cliente, Retrabajo', causes: [
                        { cause: 'Mal posicionamiento de la pieza, error del operario', O: 6, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 3, ap: 'M' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 50 — Perforado (21-8875 R y 21-8876 L)
    mkOp(50, 'Perforado (21-8875 R y 21-8876 L)', [
        mkWE('Machine', 'Perforadora', [
            {
                desc: 'Perforar piezas laterales con 9 agujeros cada una',
                failures: [
                    { desc: 'Apertura de Menos de 9 agujeros', S: 7, efLocal: 'Pieza fuera de dimensiones, Mal posicionamiento en molde', causes: [
                        { cause: 'Mal posicionamiento de la pieza', O: 6, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' },
                        { cause: 'Punzones Dañados', O: 5, prev: 'Mantenimiento Preventivo a Punzones', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' },
                    ]},
                    { desc: 'Apertura de más de 9 agujeros', S: 7, efLocal: 'Pieza fuera de dimensiones, Mal posicionamiento en molde', causes: [
                        { cause: 'Mal posicionamiento de la pieza', O: 6, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' },
                        { cause: 'Punzones Dañados', O: 5, prev: 'Mantenimiento Preventivo a Punzones', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' },
                    ]},
                    { desc: 'Apertura de agujeros desprolija', S: 7, efLocal: 'Pieza fuera de dimensiones', causes: [
                        { cause: 'Mal posicionamiento de la pieza', O: 6, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' },
                        { cause: 'Punzones Dañados', O: 5, prev: 'Mantenimiento Preventivo a Punzones', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' },
                    ]},
                    { desc: 'Apertura No pasante o incompleta', S: 7, efLocal: 'Pieza fuera de dimensiones', causes: [
                        { cause: 'Mal posicionamiento de la pieza', O: 6, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' },
                        { cause: 'Punzones Dañados', O: 5, prev: 'Mantenimiento Preventivo a Punzones', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' },
                    ]},
                    { desc: 'Apertura con arrastres', S: 7, efLocal: 'Pieza fuera de dimensiones', causes: [
                        { cause: 'Punzones Dañados', O: 5, prev: 'Mantenimiento Preventivo a Punzones', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 60 — Soldadura (21-8877, 21-8875 y 21-8876)
    mkOp(60, 'Soldadura (21-8877, 21-8875 y 21-8876)', [
        mkWE('Method', 'Soldadura por puntos', [
            {
                desc: 'Unir piezas centrales y laterales mediante soldadura',
                failures: [
                    { desc: 'Realizar proceso con piezas distintas a las centrales y laterales', S: 7, efLocal: 'Pieza fuera de dimensiones, Scrap', causes: [
                        { cause: 'Mala selección de piezas para el proceso', O: 4, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' },
                    ]},
                    { desc: 'Realizar más de 5 puntos de soldadura en cada extremo', S: 7, efLocal: 'Pieza fuera de dimensiones', causes: [
                        { cause: 'No cumplir con lo especificado en la hoja de operaciones', O: 4, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' },
                    ]},
                    { desc: 'Realizar menos de 5 puntos de soldadura en cada extremo', S: 7, efLocal: 'Pieza fuera de dimensiones, Scrap, Retrabajo', causes: [
                        { cause: 'No cumplir con lo especificado en la hoja de operaciones', O: 4, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' },
                    ]},
                    { desc: 'Soldadura de pieza distinta a pieza patrón', S: 7, efLocal: 'Pieza fuera de dimensiones, Scrap', causes: [
                        { cause: 'No cumplir con lo especificado en la hoja de operaciones', O: 4, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' },
                    ]},
                    { desc: 'No unión de las piezas después del proceso', S: 7, efLocal: 'Pieza fuera de dimensiones, Scrap, Retrabajo', causes: [
                        { cause: 'No cumplir con lo especificado en la hoja de operaciones', O: 4, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 70 — Control de pieza final
    mkOp(70, 'Control de pieza final', [
        mkWE('Method', 'Inspección visual y control dimensional', [
            {
                desc: 'Verificar la conformidad de la pieza terminada',
                failures: [
                    { desc: 'Pieza terminada con aplix mayor o menor a 9 unidades', S: 7, efLocal: 'Mal posicionamiento en molde del cliente, Scrap', causes: [
                        { cause: 'Error en operaciones anteriores', O: 4, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' },
                    ]},
                    { desc: 'Pieza Terminada con más o menos de 10 puntos de soldadura (5 de cada lado)', S: 7, efLocal: 'Mal posicionamiento en molde del cliente, Scrap', causes: [
                        { cause: 'Error en operaciones anteriores', O: 4, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' },
                    ]},
                    { desc: 'Pieza Desunida distinta a pieza Patrón', S: 7, efLocal: 'Mal posicionamiento en molde del cliente, Scrap', causes: [
                        { cause: 'Error en operaciones anteriores', O: 4, prev: 'Capacitación del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 80 — Embalaje
    mkOp(80, 'Embalaje', [
        mkWE('Method', 'Embalaje e identificación', [
            {
                desc: 'Embalar y rotular producto terminado',
                failures: [
                    { desc: 'Mayor de 25 piezas por medio', S: 7, efLocal: 'Deformación de la pieza', causes: [
                        { cause: 'Error de conteo', O: 2, det: 'Autocontrol / Audit de producto terminado', D: 7, ap: 'L' },
                    ]},
                    { desc: 'Menor de 25 piezas por medio', S: 8, efLocal: 'Reclamo de cliente', causes: [
                        { cause: 'Error de conteo', O: 2, prev: 'Control del despacho según ficha de embalaje', det: 'Autocontrol / Audit de producto terminado', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Error de identificación', S: 8, efLocal: 'Pérdida de rastreabilidad / Reclamo del Cliente', causes: [
                        { cause: 'Error de identificación por parte del operador', O: 2, prev: 'Control del despacho según ficha de embalaje', det: 'Autocontrol / Audit de producto terminado', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Falta de identificación', S: 8, efLocal: 'Pérdida de rastreabilidad / Reclamo del Cliente', causes: [
                        { cause: 'Etiqueta mal colocada', O: 2, prev: 'Control del despacho según ficha de embalaje', det: 'Autocontrol / Audit de producto terminado', D: 6, ap: 'L' },
                    ]},
                ],
            },
        ]),
    ]),
];

// ─── Insert into DB ─────────────────────────────────────────────────────

async function main() {
    console.log('══════════════════════════════════════════════════════════');
    console.log('  SEED: AMFE TELAS PLANAS — PWA');
    console.log('══════════════════════════════════════════════════════════');

    if (!existsSync(DB_PATH)) {
        console.error(`❌ DB no encontrada: ${DB_PATH}`);
        process.exit(1);
    }

    const SQL = await initSqlJs();
    const buffer = readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    const PROJECT_NAME = 'PWA/TELAS_PLANAS';
    const amfeDoc = { header, operations };
    const jsonStr = JSON.stringify(amfeDoc);
    const checksum = sha256(jsonStr);
    const id = uuid();

    // Count stats
    let causeCount = 0, apH = 0, apM = 0, covered = 0;
    for (const op of operations)
        for (const we of (op.workElements || []))
            for (const func of (we.functions || []))
                for (const fail of (func.failures || []))
                    for (const cause of (fail.causes || [])) {
                        causeCount++;
                        if (cause.ap === 'H') apH++;
                        if (cause.ap === 'M') apM++;
                        if (cause.preventionControl || cause.detectionControl) covered++;
                    }

    const coveragePct = causeCount > 0 ? Math.round((covered / causeCount) * 10000) / 100 : 0;

    // Check if already exists
    const existing = db.exec(`SELECT id FROM amfe_documents WHERE project_name = '${PROJECT_NAME}'`);
    if (existing.length && existing[0].values.length) {
        const existingId = existing[0].values[0][0];
        db.run(`UPDATE amfe_documents SET data = ?, checksum = ?, operation_count = ?, cause_count = ?, ap_h_count = ?, ap_m_count = ?, coverage_percent = ?, updated_at = datetime('now') WHERE id = ?`,
            [jsonStr, checksum, operations.length, causeCount, apH, apM, coveragePct, existingId]);
        console.log(`\n   ✅ AMFE actualizado (ID: ${existingId})`);
    } else {
        // Get next AMFE number
        const numRows = db.exec(`SELECT MAX(CAST(REPLACE(amfe_number, 'AMFE-', '') AS INTEGER)) FROM amfe_documents`);
        const nextNum = (numRows.length && numRows[0].values[0][0] ? numRows[0].values[0][0] + 1 : 2);
        const amfeNumber = `AMFE-${String(nextNum).padStart(5, '0')}`;

        db.run(`INSERT INTO amfe_documents (id, amfe_number, project_name, status, subject, client, part_number, responsible, organization, operation_count, cause_count, ap_h_count, ap_m_count, coverage_percent, start_date, last_revision_date, data, checksum, revisions, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', datetime('now'), datetime('now'))`,
            [id, amfeNumber, PROJECT_NAME, header.subject, header.client, header.partNumber, header.responsibleDesign, header.organization, operations.length, causeCount, apH, apM, coveragePct, header.startDate, header.revDate, jsonStr, checksum]);
        console.log(`\n   ✅ AMFE insertado (ID: ${id}, N°: ${amfeNumber})`);
    }

    console.log(`   Operaciones:    ${operations.length}`);
    console.log(`   Causas:         ${causeCount}`);
    console.log(`   AP High:        ${apH}`);
    console.log(`   AP Medium:      ${apM}`);
    console.log(`   Cobertura:      ${coveragePct}%`);

    // Write DB
    const outBuffer = Buffer.from(db.export());
    writeFileSync(DB_PATH, outBuffer);

    console.log('\n══════════════════════════════════════════════════════════\n');
    db.close();
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
