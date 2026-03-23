#!/usr/bin/env node
/**
 * SEED: CP + HO + PFD + Families for PWA Telas Planas & Telas Termoformadas
 *
 * Prerequisites: AMFEs for PWA/TELAS_PLANAS and PWA/TELAS_TERMOFORMADAS
 *                must already exist in Supabase (seeded by earlier scripts).
 *
 * This script:
 *   1. Finds existing AMFE documents in Supabase
 *   2. For each product, generates:
 *      a. PFD document (from flujograma data)
 *      b. Control Plan (from AMFE causes with AP=H or AP=M)
 *      c. HO document (one stub sheet per AMFE operation)
 *   3. Creates product families linking AMFE, CP, PFD, HO
 *   4. Verifies all data
 *
 * Usage: node scripts/seed-pwa-telas.mjs
 */

import { createHash, randomUUID } from 'crypto';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

const uuid = () => randomUUID();
const sha256 = (str) => createHash('sha256').update(str).digest('hex');

// ─── AMFE Data Builders ─────────────────────────────────────────────────────

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

// ─── Embedded AMFE Data for Telas Planas ────────────────────────────────────

function buildAmfeTelasPlanas() {
    const header = {
        organization: 'BARACK MERCOSUL', location: 'Planta Hurlingham', client: 'PWA',
        customerName: 'PWA', modelYear: '', subject: 'TELA ASSENTO DIANTEIRO',
        partNumber: '21-8909', responsibleDesign: 'F.SANTORO', startDate: '2022-10-31',
        revDate: '2024-12-02', revision: '2',
        teamMembers: 'CAL: M.NIEVE, PROD: G.CAL, INGEN: F.SANTORO',
        plant: 'PWA', companyName: 'BARACK MERCOSUL',
        applicableParts: '21-8909 CONJ TELA FSC LH P2X',
    };
    const operations = [
        mkOp(10, 'Recepcion de Punzonado', [
            mkWE('Method', 'Recepcion de materiales', [
                { desc: 'Recibir y verificar material punzonado conforme a especificaciones', failures: [
                    { desc: 'Gramaje Mayor a 120g/m2+15%', S: 7, efLocal: 'Material incumple gramaje, falla en espumado', causes: [
                        { cause: 'Material fuera de especificacion requerida', O: 2, det: 'Recepcion de materiales', D: 6, ap: 'L' }]},
                    { desc: 'Gramaje Menor a 120g/m2-15%', S: 7, efLocal: 'Material incumple gramaje, falla en espumado', causes: [
                        { cause: 'Material fuera de especificacion requerida', O: 2, det: 'Recepcion de materiales', D: 6, ap: 'L' }]},
                    { desc: 'Ancho de material distinto a 2m', S: 7, efLocal: 'Incumplimiento de ancho, falla en troquelado', causes: [
                        { cause: 'Material fuera de especificacion requerida', O: 2, det: 'Recepcion de materiales', D: 6, ap: 'L' }]},
                    { desc: 'Flamabilidad fuera de especificacion (100 mm/min)', S: 10, efLocal: 'Material incumple flamabilidad', causes: [
                        { cause: 'Material fuera de especificacion requerida', O: 2, det: 'Recepcion de materiales', D: 6, ap: 'H', sc: 'CC' }]},
                ]},
            ]),
        ]),
        mkOp('10b', 'Recepcion de Punzonado con Bi-componente', [
            mkWE('Method', 'Recepcion de materiales', [
                { desc: 'Recibir y verificar bi-componente', failures: [
                    { desc: 'Gramaje Mayor a 280g/m2+15%', S: 7, efLocal: 'Material incumple gramaje', causes: [
                        { cause: 'Material fuera de especificacion requerida', O: 2, det: 'Recepcion de materiales', D: 6, ap: 'L' }]},
                    { desc: 'Flamabilidad fuera de especificacion (100 mm/min)', S: 10, efLocal: 'Material incumple flamabilidad', causes: [
                        { cause: 'Material fuera de especificacion requerida', O: 2, det: 'Recepcion de materiales', D: 6, ap: 'H', sc: 'CC' }]},
                ]},
            ]),
        ]),
        mkOp(20, 'Corte por maquina de pieza Central', [
            mkWE('Machine', 'Maquina de corte automatica', [
                { desc: 'Cortar piezas centrales segun especificacion dimensional', failures: [
                    { desc: 'Agujeros de O4 menor a 17 por pieza', S: 7, efLocal: 'Mal posicionamiento en molde del cliente', causes: [
                        { cause: 'Material fuera de especificacion requerida', O: 2, prev: 'Set up de la maquina de corte automatica', det: 'Control inicio y fin de turno', D: 6, ap: 'L' }]},
                    { desc: 'Orificios fuera de posicion segun pieza patron', S: 7, efLocal: 'Mal posicionamiento en molde del cliente', causes: [
                        { cause: 'Programacion equivocada de la maquina de corte automatica', O: 2, prev: 'Set up de la maquina de corte automatica', det: 'Control inicio y fin de turno', D: 6, ap: 'L' }]},
                    { desc: 'Material distinto a punzonado de 120g/m2', S: 7, efLocal: 'Incumplimiento de especificaciones', causes: [
                        { cause: 'Material fuera de especificacion requerida', O: 2, prev: 'Set up de la maquina de corte automatica', det: 'Control inicio y fin de turno', D: 7, ap: 'L' }]},
                ]},
            ]),
        ]),
        mkOp(21, 'Corte por maquina, Blank de piezas laterales', [
            mkWE('Machine', 'Maquina de corte automatica', [
                { desc: 'Cortar blanks de piezas laterales', failures: [
                    { desc: 'Medida mayor a 550mmx500mm', S: 7, efLocal: 'Mal posicionamiento del blank en matriz', causes: [
                        { cause: 'Material fuera de especificacion requerida', O: 2, prev: 'Set up de la maquina de corte automatica', det: 'Control inicio y fin de turno', D: 6, ap: 'L' }]},
                ]},
            ]),
        ]),
        mkOp('10d', 'Colocado de Aplix', [
            mkWE('Method', 'Colocacion manual de aplix', [
                { desc: 'Colocar aplix en posicion y cantidad correcta', failures: [
                    { desc: 'Colocacion de menos de 9 aplix', S: 7, efLocal: 'Mal posicionamiento en molde del cliente / Rechazo', causes: [
                        { cause: 'Orificios fuera de posicion / Error del operario', O: 2, prev: 'Set up de la maquina / Capacitacion del operario', det: 'Control inicio y fin de turno / Pieza patron', D: 7, ap: 'L' }]},
                    { desc: 'Colocacion de Aplix en posicion distinta a la especificada', S: 7, efLocal: 'Mal posicionamiento en molde del cliente', causes: [
                        { cause: 'Orificios fuera de posicion / Error del operario', O: 2, prev: 'Set up de la maquina / Capacitacion del operario', det: 'Control inicio y fin de turno / Pieza patron', D: 7, ap: 'L' }]},
                ]},
            ]),
        ]),
        mkOp('20b', 'Horno', [
            mkWE('Machine', 'Horno de calentamiento', [
                { desc: 'Calentar material de manera uniforme para termoformado', failures: [
                    { desc: 'Temperatura del horno distinta de 150C +/-20C', S: 7, efLocal: 'Pieza con quemaduras', causes: [
                        { cause: 'Mal seteo de la maquina / Error del operario', O: 2, prev: 'Hoja de operaciones / Set up de lanzamiento', det: 'Set up de lanzamiento', D: 7, ap: 'L' }]},
                    { desc: 'Calentar el material de manera no uniforme', S: 7, efLocal: 'Imposibilidad de realizar proceso posterior', causes: [
                        { cause: 'Mal posicionamiento de la pieza, Error del Operario', O: 3, prev: 'Capacitacion del operario', det: 'Control inicio y fin de turno / Pieza patron', D: 7, ap: 'H' },
                        { cause: 'Falla en el horno', O: 3, prev: 'Set Up del Horno / Mantenimiento Preventivo', det: 'Control inicio y fin de turno', D: 6, ap: 'M' }]},
                ]},
            ]),
        ]),
        mkOp(30, 'Termoformado', [
            mkWE('Machine', 'Termoformadora', [
                { desc: 'Termoformar piezas segun especificacion', failures: [
                    { desc: 'Termoformar de forma desprolija', S: 7, efLocal: 'Pieza fuera de dimensiones', causes: [
                        { cause: 'Mal posicionamiento de la pieza, Material Fuera de especificacion, Error del Operario', O: 3, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'M' }]},
                    { desc: 'Termoformar de forma incompleta', S: 7, efLocal: 'No utilizacion de dispositivo de apertura de agujeros', causes: [
                        { cause: 'Mal posicionamiento de la pieza, Material Fuera de especificacion, Error del Operario', O: 6, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 3, ap: 'M' }]},
                    { desc: 'Termoformado de pieza con roturas', S: 7, efLocal: 'Pieza fuera de dimensiones, Rechazo del cliente', causes: [
                        { cause: 'Mal posicionamiento de la pieza, Material Fuera de especificacion, Error del Operario', O: 6, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 3, ap: 'M' }]},
                    { desc: 'Pieza con roturas', S: 7, efLocal: 'Rechazo del cliente, Scrap', causes: [
                        { cause: 'Mal posicionamiento de la pieza, error del operario', O: 6, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 3, ap: 'M' }]},
                ]},
            ]),
        ]),
        mkOp(40, 'Corte de la pieza en prensa', [
            mkWE('Machine', 'Prensa de corte', [
                { desc: 'Cortar pieza termoformada en prensa', failures: [
                    { desc: 'Corte desprolijo', S: 7, efLocal: 'Rechazo del cliente, Scrap', causes: [
                        { cause: 'Mal posicionamiento de la pieza, error del operario', O: 6, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 3, ap: 'M' }]},
                    { desc: 'Corte Perimetral incompleto', S: 7, efLocal: 'Rechazo del cliente, Retrabajo', causes: [
                        { cause: 'Mal posicionamiento de la pieza, error del operario', O: 6, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 3, ap: 'M' }]},
                ]},
            ]),
        ]),
        mkOp(50, 'Perforado (21-8875 R y 21-8876 L)', [
            mkWE('Machine', 'Perforadora', [
                { desc: 'Perforar piezas laterales con 9 agujeros cada una', failures: [
                    { desc: 'Apertura de Menos de 9 agujeros', S: 7, efLocal: 'Pieza fuera de dimensiones', causes: [
                        { cause: 'Mal posicionamiento de la pieza', O: 6, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' },
                        { cause: 'Punzones Danados', O: 5, prev: 'Mantenimiento Preventivo a Punzones', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' }]},
                    { desc: 'Apertura de agujeros desprolija', S: 7, efLocal: 'Pieza fuera de dimensiones', causes: [
                        { cause: 'Mal posicionamiento de la pieza', O: 6, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' },
                        { cause: 'Punzones Danados', O: 5, prev: 'Mantenimiento Preventivo a Punzones', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' }]},
                    { desc: 'Apertura No pasante o incompleta', S: 7, efLocal: 'Pieza fuera de dimensiones', causes: [
                        { cause: 'Mal posicionamiento de la pieza', O: 6, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' }]},
                    { desc: 'Apertura con arrastres', S: 7, efLocal: 'Pieza fuera de dimensiones', causes: [
                        { cause: 'Punzones Danados', O: 5, prev: 'Mantenimiento Preventivo a Punzones', det: 'Control Visual 100%/Autocontrol', D: 4, ap: 'H' }]},
                ]},
            ]),
        ]),
        mkOp(60, 'Soldadura (21-8877, 21-8875 y 21-8876)', [
            mkWE('Method', 'Soldadura por puntos', [
                { desc: 'Unir piezas centrales y laterales mediante soldadura', failures: [
                    { desc: 'Realizar proceso con piezas distintas', S: 7, efLocal: 'Pieza fuera de dimensiones, Scrap', causes: [
                        { cause: 'Mala seleccion de piezas para el proceso', O: 4, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' }]},
                    { desc: 'Realizar mas de 5 puntos de soldadura en cada extremo', S: 7, efLocal: 'Pieza fuera de dimensiones', causes: [
                        { cause: 'No cumplir con lo especificado en la hoja de operaciones', O: 4, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' }]},
                    { desc: 'Realizar menos de 5 puntos de soldadura en cada extremo', S: 7, efLocal: 'Pieza fuera de dimensiones, Scrap, Retrabajo', causes: [
                        { cause: 'No cumplir con lo especificado en la hoja de operaciones', O: 4, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' }]},
                    { desc: 'No union de las piezas despues del proceso', S: 7, efLocal: 'Pieza fuera de dimensiones, Scrap, Retrabajo', causes: [
                        { cause: 'No cumplir con lo especificado en la hoja de operaciones', O: 4, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' }]},
                ]},
            ]),
        ]),
        mkOp(70, 'Control de pieza final', [
            mkWE('Method', 'Inspeccion visual y control dimensional', [
                { desc: 'Verificar la conformidad de la pieza terminada', failures: [
                    { desc: 'Pieza terminada con aplix mayor o menor a 9 unidades', S: 7, efLocal: 'Mal posicionamiento en molde del cliente, Scrap', causes: [
                        { cause: 'Error en operaciones anteriores', O: 4, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' }]},
                    { desc: 'Pieza Terminada con mas o menos de 10 puntos de soldadura', S: 7, efLocal: 'Mal posicionamiento en molde del cliente, Scrap', causes: [
                        { cause: 'Error en operaciones anteriores', O: 4, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' }]},
                    { desc: 'Pieza Desunida distinta a pieza Patron', S: 7, efLocal: 'Mal posicionamiento en molde del cliente, Scrap', causes: [
                        { cause: 'Error en operaciones anteriores', O: 4, prev: 'Capacitacion del Operario', det: 'Control Visual 100%/Autocontrol', D: 6, ap: 'H' }]},
                ]},
            ]),
        ]),
        mkOp(80, 'Embalaje', [
            mkWE('Method', 'Embalaje e identificacion', [
                { desc: 'Embalar y rotular producto terminado', failures: [
                    { desc: 'Mayor de 25 piezas por medio', S: 7, efLocal: 'Deformacion de la pieza', causes: [
                        { cause: 'Error de conteo', O: 2, det: 'Autocontrol / Audit de producto terminado', D: 7, ap: 'L' }]},
                    { desc: 'Menor de 25 piezas por medio', S: 8, efLocal: 'Reclamo de cliente', causes: [
                        { cause: 'Error de conteo', O: 2, prev: 'Control del despacho segun ficha de embalaje', det: 'Autocontrol / Audit de producto terminado', D: 6, ap: 'L' }]},
                    { desc: 'Error de identificacion', S: 8, efLocal: 'Perdida de rastreabilidad / Reclamo del Cliente', causes: [
                        { cause: 'Error de identificacion por parte del operador', O: 2, prev: 'Control del despacho segun ficha de embalaje', det: 'Autocontrol / Audit de producto terminado', D: 6, ap: 'L' }]},
                    { desc: 'Falta de identificacion', S: 8, efLocal: 'Perdida de rastreabilidad / Reclamo del Cliente', causes: [
                        { cause: 'Etiqueta mal colocada', O: 2, prev: 'Control del despacho segun ficha de embalaje', det: 'Autocontrol / Audit de producto terminado', D: 6, ap: 'L' }]},
                ]},
            ]),
        ]),
    ];
    return { header, operations };
}

// ─── Embedded AMFE Data for Telas Termoformadas ─────────────────────────────

function buildAmfeTermoformadas() {
    const header = {
        organization: 'BARACK MERCOSUL', location: 'Planta Hurlingham', client: 'PWA',
        customerName: 'PWA', modelYear: '', subject: 'TELAS TERMOFORMADAS',
        partNumber: 'Segun tabla', responsibleDesign: 'F.SANTORO', startDate: '2020-06-18',
        revDate: '2025-04-29', revision: 'D',
        teamMembers: 'CAL: M.Nieve, PROD: G.Cal, INGEN: P.Centurion',
        plant: 'PWA', companyName: 'BARACK MERCOSUL',
        applicableParts: 'Segun tabla (TNT/Telas termoformadas)',
    };
    const operations = [
        mkOp(10, 'Recepcion de materiales con identificacion correcta', [
            mkWE('Method', 'Recepcion de materiales', [
                { desc: 'Recibir y verificar materiales con identificacion correcta', failures: [
                    { desc: 'Identificacion incorrecta', S: 7, efLocal: 'Problemas en orden del stock', causes: [
                        { cause: 'Falta de capacitacion', O: 2, prev: 'Capacitacion de operario', det: 'Recepcion de materiales', D: 6, ap: 'L' }]},
                    { desc: 'Material distinto segun plan de control de recepcion', S: 7, efLocal: 'Problemas con operaciones posteriores', causes: [
                        { cause: 'Falta de control de recepcion/capacitacion del operario', O: 3, prev: 'Capacitacion del operario', det: 'Recepcion de materiales', D: 7, ap: 'H' }]},
                    { desc: 'Omision de la recepcion de material', S: 7, efLocal: 'Problemas en orden del stock', causes: [
                        { cause: 'Falta de capacitacion', O: 2, prev: 'Capacitacion de operario', det: 'Recepcion de materiales', D: 6, ap: 'L' }]},
                ]},
            ]),
        ]),
        mkOp(15, 'Preparacion de corte', [
            mkWE('Machine', 'Cortadora de extremo / Mesa de corte', [
                { desc: 'Preparar material TNT para corte', failures: [
                    { desc: 'Desplazamiento involuntario del material TNT', S: 7, efLocal: 'Problemas en operaciones posteriores', causes: [
                        { cause: 'Operario no verifico enrase de las lineas de contorno', O: 2, prev: 'Hoja de operaciones con lineas de referencia', det: 'Inspeccion visual de perforaciones', D: 6, ap: 'L' }]},
                    { desc: 'TNT plegado involuntariamente al cargar', S: 7, efLocal: 'Requiere retrabajo completo', causes: [
                        { cause: 'El operario carga el TNT con un pliegue no detectado', O: 2, prev: 'Hoja de Operaciones HO964', det: 'Inspeccion Visual Posterior al Corte', D: 6, ap: 'L' }]},
                ]},
            ]),
        ]),
        mkOp(20, 'Corte por maquina automatica segun dimensional', [
            mkWE('Machine', 'Maquina de corte automatica', [
                { desc: 'Cortar piezas con dimensiones y orificios segun plan de control', failures: [
                    { desc: 'Largo distinto al especificado', S: 7, efLocal: 'Inutilizacion del material', causes: [
                        { cause: 'Programacion equivocada de la maquina de corte automatica', O: 2, prev: 'Set up de la maquina de corte automatica', det: 'Control con pieza patron', D: 6, ap: 'L' }]},
                    { desc: 'Falta de orificios', S: 7, efLocal: 'Imposibilidad de realizar el proceso posterior', causes: [
                        { cause: 'Programacion equivocada de la maquina de corte automatica', O: 2, prev: 'Set up de la maquina de corte automatica', det: 'Control visual', D: 6, ap: 'L' }]},
                    { desc: 'Orificios fuera de posicion', S: 7, efLocal: 'Imposibilidad de realizar el proceso posterior', causes: [
                        { cause: 'Programacion equivocada de la maquina de corte automatica', O: 2, prev: 'Set up de la maquina de corte automatica', det: 'Control con pieza patron', D: 6, ap: 'L' }]},
                ]},
            ]),
        ]),
        mkOp(30, 'Costura fuerte, sin arruga ni pliegues', [
            mkWE('Machine', 'Maquina de costura', [
                { desc: 'Costura fuerte, sin arruga ni pliegues con hilo segun especificaciones', failures: [
                    { desc: 'Refuerzo costurado opuesto al airbag posicionado de manera inversa', S: 7, efLocal: 'Scrap', causes: [
                        { cause: 'Falla del operario', O: 2, prev: 'Hoja de operaciones', det: 'Autocontrol', D: 6, ap: 'L' }]},
                    { desc: 'Falta de costura', S: 7, efLocal: 'Scrap', causes: [
                        { cause: 'Carreteles mal ubicados', O: 2, prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patron', D: 6, ap: 'L' },
                        { cause: 'Aguja mal ubicada', O: 2, prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patron', D: 6, ap: 'L' }]},
                    { desc: 'Costura floja / deficiente', S: 8, efLocal: 'Retrabajo', causes: [
                        { cause: 'Falla en la tension del hilo', O: 2, prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patron', D: 6, ap: 'L' }]},
                ]},
            ]),
        ]),
        mkOp(40, 'Colocado de clips en posicion correcta', [
            mkWE('Method', 'Colocacion manual de clips', [
                { desc: 'Colocar clips en posicion y cantidad correcta', failures: [
                    { desc: 'Clips colocados en posicion incorrecta', S: 7, efLocal: 'Retrabajo de la pieza', causes: [
                        { cause: 'Orificios fuera de posicion', O: 2, prev: 'Control con pieza patron', det: 'Control visual', D: 7, ap: 'L' }]},
                    { desc: 'Falta de clips', S: 7, efLocal: 'Retrabajo de la pieza', causes: [
                        { cause: 'Falta de orificios', O: 2, prev: 'Control con pieza patron', det: 'Control visual', D: 7, ap: 'L' }]},
                ]},
            ]),
        ]),
        mkOp(50, 'Pegado de dots en posicion correcta', [
            mkWE('Method', 'Pegado manual de dots', [
                { desc: 'Colocar dots en posicion y cantidad correcta', failures: [
                    { desc: 'Dots colocados en posicion incorrecta', S: 7, efLocal: 'Retrabajo de la pieza', causes: [
                        { cause: 'Orificios fuera de posicion', O: 2, det: 'Control visual', D: 7, ap: 'L' }]},
                    { desc: 'Falta de dots', S: 7, efLocal: 'Retrabajo de la pieza', causes: [
                        { cause: 'Falta de orificios', O: 2, det: 'Control visual', D: 7, ap: 'L' }]},
                ]},
            ]),
        ]),
        mkOp(60, 'Inspeccion final de la pieza', [
            mkWE('Method', 'Inspeccion dimensional y visual', [
                { desc: 'Inspeccion final dimensional y visual', failures: [
                    { desc: 'Dimensional fuera de especificacion', S: 8, efLocal: 'Rechazo de Cliente', causes: [
                        { cause: 'Programacion equivocada de la maquina de corte automatica', O: 2, det: 'Control dimensional de la pieza', D: 6, ap: 'L' }]},
                ]},
            ]),
        ]),
        mkOp(70, 'Embalaje identificado con cantidad de piezas especificas', [
            mkWE('Method', 'Embalaje e identificacion', [
                { desc: 'Embalar y rotular producto terminado con cantidad correcta', failures: [
                    { desc: 'Mayor cantidad de piezas por medio', S: 7, efLocal: 'Reclamo de cliente', causes: [
                        { cause: 'Error de conteo', O: 2, prev: 'Control adicional con otro metodo', det: 'Autocontrol / Audit de producto terminado', D: 7, ap: 'L' }]},
                    { desc: 'Menor cantidad de piezas por medio', S: 8, efLocal: 'Reclamo de cliente', causes: [
                        { cause: 'Error de conteo', O: 2, prev: 'Control adicional con otro metodo', det: 'Autocontrol / Audit de producto terminado', D: 7, ap: 'M' }]},
                    { desc: 'Error de identificacion', S: 8, efLocal: 'Perdida de rastreabilidad / Reclamo del Cliente', causes: [
                        { cause: 'Error de identificacion por parte del operador', O: 2, prev: 'Autocontrol / Organizacion de etiquetas', det: 'Audit de producto terminado', D: 7, ap: 'M' }]},
                    { desc: 'Falta de identificacion', S: 8, efLocal: 'Perdida de rastreabilidad / Reclamo del Cliente', causes: [
                        { cause: 'Falla de operario', O: 2, prev: 'Audit de producto terminado', det: 'Audit de producto terminado', D: 7, ap: 'M' }]},
                ]},
            ]),
        ]),
    ];
    return { header, operations };
}

/** Seed an AMFE to Supabase and return its id and parsed data */
async function seedAmfeToSupabase(product, amfeData) {
    const jsonStr = JSON.stringify(amfeData);
    const checksum = sha256(jsonStr);
    const id = uuid();

    let causeCount = 0, apH = 0, apM = 0, covered = 0;
    for (const op of amfeData.operations)
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

    // Get next AMFE number — use COUNT to avoid collisions
    const numRows = await selectSql(`SELECT COUNT(*) as cnt FROM amfe_documents`);
    const nextNum = (numRows.length > 0 ? (numRows[0].cnt || 0) + 100 : 100);
    const amfeNumber = `AMFE-PWA-${String(nextNum).padStart(3, '0')}`;

    await execSql(`INSERT INTO amfe_documents (
        id, amfe_number, project_name, status, subject, client, part_number,
        responsible, organization, operation_count, cause_count, ap_h_count, ap_m_count,
        coverage_percent, start_date, last_revision_date, data, checksum, revisions)
        VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')`,
        [id, amfeNumber, product.projectName,
         amfeData.header.subject, amfeData.header.client, amfeData.header.partNumber || product.partNumber,
         amfeData.header.responsibleDesign || 'F.Santoro', amfeData.header.organization,
         amfeData.operations.length, causeCount, apH, apM, coveragePct,
         amfeData.header.startDate, amfeData.header.revDate, jsonStr, checksum]);

    console.log(`    AMFE seeded to Supabase: ${amfeNumber} (ID: ${id})`);
    console.log(`      Ops: ${amfeData.operations.length}, Causes: ${causeCount} (H=${apH}, M=${apM})`);

    return id;
}

// ─── Product Definitions ────────────────────────────────────────────────────

const PRODUCTS = [
    {
        key: 'planas',
        projectName: 'PWA/TELAS_PLANAS',
        cpNumber: 'CP-TELAS-PLANAS-001',
        partName: 'TELA ASSENTO DIANTEIRO (Telas Planas)',
        partNumber: '21-8909',
        familyName: 'Telas Planas PWA',
        familyDescription: 'Familia de telas planas para cliente PWA',
        lineaCode: 'PWA',
        lineaName: 'PWA',
        pfdDocNumber: 'I-IN-002/III-PLANAS',
        pfdPartName: 'Telas Planas PWA - HILUX 581D',
        applicableParts: [
            '219463 PAD FR SEAT BACK LH',
            '219464 PAD FR SEAT CUSHION LH',
            '219465 PAD FR SEAT BACK RH',
            '219466 PAD FR SEAT CUSHION RH',
            '219467 PAD FR SEAT BACK RH',
            '219468 PAD FR SEAT BACK LH',
            '219469 PAD FR SEAT CUSHION RH',
            '219470 PAD FR SEAT CUSHION RH',
            '219471 PAD FR SEAT CUSHION LH',
            '219472 PAD FR SEAT CUSHION LH',
            '219474 PAD FR SEAT BACK LH',
            '219475 PAD FR SEAT BACK RH',
        ],
        pfdSteps: [
            { num: '10', type: 'operation', desc: 'RECEPCION DE MATERIA PRIMA', dept: 'Recepcion' },
            { num: '', type: 'inspection', desc: 'INSPECCION DE MATERIA PRIMA', dept: 'Calidad' },
            { num: '', type: 'storage', desc: 'ALMACENADO EN SECTOR DE MATERIA PRIMA CONTROLADA', dept: 'Almacen' },
            { num: '15', type: 'operation', desc: 'PREPARACION DE CORTE', dept: 'Corte' },
            { num: '20', type: 'operation', desc: 'CORTE DE COMPONENTES', dept: 'Corte' },
            { num: '25', type: 'inspection', desc: 'CONTROL CON MYLAR', dept: 'Calidad' },
            { num: '30', type: 'operation', desc: 'PREPARACION DE KITS DE COMPONENTES', dept: 'Blanco' },
            { num: '40', type: 'operation', desc: 'COSTURA RECTA', dept: 'Costura' },
            { num: '50', type: 'operation', desc: 'TROQUELADO DE REFUERZOS', dept: 'Troquelado' },
            { num: '60', type: 'operation', desc: 'TROQUELADO DE APLIX', dept: 'Troquelado' },
            { num: '70', type: 'operation', desc: 'PEGADO DE DOTS APLIX', dept: 'Blanco' },
            { num: '80', type: 'inspection', desc: 'CONTROL FINAL DE CALIDAD', dept: 'Calidad' },
            { num: '90', type: 'decision', desc: 'PRODUCTO CONFORME?', dept: 'Calidad' },
            { num: '100', type: 'operation', desc: 'REPROCESO (ELIMINACION DE HILO / REUBICACION APLIX / CORRECCION COSTURA)', dept: 'Reproceso', isRework: true },
            { num: '110', type: 'operation', desc: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', dept: 'Embalaje' },
            { num: '', type: 'storage', desc: 'ALMACENAMIENTO PRODUCTO TERMINADO (FIFO)', dept: 'Almacen' },
        ],
    },
    {
        key: 'termoformadas',
        projectName: 'PWA/TELAS_TERMOFORMADAS',
        cpNumber: 'CP-TELAS-TERMO-001',
        partName: 'TELAS TERMOFORMADAS',
        partNumber: 'Segun tabla',
        familyName: 'Telas Termoformadas PWA',
        familyDescription: 'Familia de telas termoformadas para cliente PWA',
        lineaCode: 'PWA',
        lineaName: 'PWA',
        pfdDocNumber: 'I-IN-002/III-TERMO',
        pfdPartName: 'Telas Termoformadas PWA - Asiento Respaldo',
        applicableParts: [
            '21-9440 Backing cloth LH',
            '21-9441 Backing cloth RH',
            '21-9642 Backing cloth LH',
            '21-9643 Backing cloth RH',
        ],
        pfdSteps: [
            { num: '10', type: 'operation', desc: 'RECEPCION DE MATERIA PRIMA', dept: 'Recepcion' },
            { num: '', type: 'inspection', desc: 'INSPECCION DE MATERIA PRIMA', dept: 'Calidad' },
            { num: '', type: 'storage', desc: 'ALMACENADO EN SECTOR DE MATERIA PRIMA CONTROLADA', dept: 'Almacen' },
            { num: '15', type: 'operation', desc: 'PREPARACION DE CORTE', dept: 'Corte' },
            { num: '20', type: 'operation', desc: 'CORTE DE COMPONENTES', dept: 'Corte' },
            { num: '25', type: 'inspection', desc: 'CONTROL CON MYLAR', dept: 'Calidad' },
            { num: '30', type: 'operation', desc: 'PREPARACION DE KITS DE COMPONENTES', dept: 'Blanco' },
            { num: '40', type: 'operation', desc: 'TERMOFORMADO DE TELAS', dept: 'Termoformado' },
            { num: '50', type: 'operation', desc: 'CORTE LASER DE TELAS TERMOFORMADAS', dept: 'Corte' },
            { num: '60', type: 'operation', desc: 'TROQUELADO DE REFUERZOS', dept: 'Troquelado' },
            { num: '70', type: 'operation', desc: 'TROQUELADO DE APLIX', dept: 'Troquelado' },
            { num: '80', type: 'operation', desc: 'COSTURA DE REFUERZOS', dept: 'Costura' },
            { num: '90', type: 'operation', desc: 'APLICACION DE APLIX', dept: 'Blanco' },
            { num: '100', type: 'inspection', desc: 'CONTROL FINAL DE CALIDAD', dept: 'Calidad' },
            { num: '110', type: 'decision', desc: 'PRODUCTO CONFORME?', dept: 'Calidad' },
            { num: '120', type: 'operation', desc: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', dept: 'Embalaje' },
            { num: '', type: 'storage', desc: 'ALMACENAMIENTO PRODUCTO TERMINADO (FIFO)', dept: 'Almacen' },
        ],
    },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function inferOpCategory(name) {
    const n = (name || '').toLowerCase();
    if (/sold[au]/i.test(n)) return 'soldadura';
    if (/ensam[bp]l/i.test(n)) return 'ensamble';
    if (/inspec/i.test(n)) return 'inspeccion';
    if (/troquel/i.test(n)) return 'troquelado';
    if (/costur/i.test(n)) return 'costura';
    if (/corte/i.test(n)) return 'corte';
    if (/embala/i.test(n)) return 'embalaje';
    if (/recep/i.test(n)) return 'recepcion';
    if (/horno|calent/i.test(n)) return 'horno';
    if (/termoform/i.test(n)) return 'termoformado';
    if (/perfor/i.test(n)) return 'perforado';
    if (/reproc|retrab/i.test(n)) return 'reproceso';
    if (/prepar/i.test(n)) return 'preparacion';
    if (/control.*final/i.test(n)) return 'inspeccion';
    if (/pegado|dots|aplix|clip/i.test(n)) return 'ensamble';
    return '';
}

/** Count AMFE causes */
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

/** Get default CP fields based on AP level and severity */
function getCpDefaults(ap, severity, rep, rowType) {
    let sampleSize, sampleFrequency, reactionPlan, reactionPlanOwner, evaluationTechnique, specification;

    // Sample size & frequency
    if (ap === 'H') {
        sampleSize = '100%';
        sampleFrequency = 'Cada pieza';
    } else if (ap === 'M') {
        if (severity >= 9) { sampleSize = '5 piezas'; sampleFrequency = 'Cada hora'; }
        else if (severity >= 7) { sampleSize = '5 piezas'; sampleFrequency = 'Cada 2 horas'; }
        else { sampleSize = '3 piezas'; sampleFrequency = 'Cada turno'; }
    } else {
        sampleSize = '1 pieza';
        sampleFrequency = 'Cada turno';
    }

    // Reaction plan
    if (severity >= 9) {
        reactionPlan = 'Detener linea. Segregar producto sospechoso. Escalar a Gerencia de Calidad.';
    } else if (severity >= 7) {
        reactionPlan = 'Contener producto sospechoso. Verificar ultimas N piezas. Ajustar proceso. Notificar a Lider.';
    } else if (severity >= 4) {
        reactionPlan = 'Ajustar proceso. Reinspeccionar ultimo lote. Registrar desvio.';
    } else {
        reactionPlan = 'Registrar desvio. Ajustar en proximo set-up.';
    }

    // Reaction plan owner
    const cat = inferOpCategory(rep.op.name);
    if (severity >= 9 || ap === 'H') {
        reactionPlanOwner = cat === 'inspeccion' ? 'Supervisor de Calidad' : 'Lider de Produccion / Calidad';
    } else if (severity >= 7) {
        reactionPlanOwner = 'Lider de Produccion';
    } else {
        reactionPlanOwner = 'Operador de Produccion';
    }

    // Evaluation technique for process rows
    evaluationTechnique = '';
    if (rowType === 'process') {
        const det = (rep.cause.detectionControl || '').toLowerCase();
        if (det.includes('visual')) evaluationTechnique = 'Inspeccion visual';
        else if (det.includes('audit')) evaluationTechnique = 'Auditoria de proceso';
        else if (det.includes('set') || det.includes('puesta')) evaluationTechnique = 'Verificacion de set-up';
        else if (det.includes('dimensional')) evaluationTechnique = 'Control dimensional';
        else if (det.includes('patron')) evaluationTechnique = 'Comparacion con pieza patron';
        else if (det.includes('recep')) evaluationTechnique = 'Verificacion de recepcion';
        else evaluationTechnique = 'Verificacion operativa';
    }

    // Specification
    specification = '';
    if (rowType === 'product') {
        const failDesc = (rep.fail.description || '').toLowerCase();
        if (failDesc.includes('dimensional') || failDesc.includes('medida') || failDesc.includes('mm')) specification = 'Segun plano / tolerancia dimensional';
        else if (failDesc.includes('costura') || failDesc.includes('hilo')) specification = 'Costura continua segun especificacion';
        else if (failDesc.includes('flamab')) specification = 'Flamabilidad < 100 mm/min';
        else if (failDesc.includes('gramaje')) specification = 'Gramaje dentro de tolerancia';
        else if (failDesc.includes('identif') || failDesc.includes('trazab')) specification = 'Identificacion completa (codigo, lote, fecha)';
        else if (failDesc.includes('roturas') || failDesc.includes('rotura')) specification = 'Sin roturas ni fisuras';
        else if (failDesc.includes('solda')) specification = 'Soldadura segun pieza patron';
        else specification = 'Conforme a especificacion de producto';
    } else {
        const causeDesc = (rep.cause.cause || '').toLowerCase();
        if (causeDesc.includes('temperatura')) specification = 'Rango de temperatura segun set-up';
        else if (causeDesc.includes('programa')) specification = 'Programa de corte verificado';
        else if (causeDesc.includes('material') && causeDesc.includes('fuera')) specification = 'Material conforme a especificacion';
        else if (causeDesc.includes('posicion')) specification = 'Posicionamiento segun pieza patron';
        else specification = 'Segun instruccion de proceso';
    }

    return { sampleSize, sampleFrequency, reactionPlan, reactionPlanOwner, evaluationTechnique, specification };
}

/** Generate CP items from AMFE operations */
function generateControlPlan(amfeDoc, phase) {
    const items = [];
    const qualifying = [];

    // Collect qualifying causes (AP=H or AP=M)
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

    // PROCESS rows (grouped by op + cause + prevention)
    const processGroups = new Map();
    for (const q of qualifying) {
        const key = JSON.stringify([
            q.op.opNumber,
            (q.cause.cause || '').toLowerCase().trim().replace(/\s+/g, ' '),
            (q.cause.preventionControl || '').toLowerCase().trim().replace(/\s+/g, ' '),
        ]);
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

        const defaults = getCpDefaults(highAp, highSev, rep, 'process');

        items.push({
            id: uuid(),
            processStepNumber: rep.op.opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: rep.we.name || '',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: rep.cause.cause || '',
            specialCharClass: bestSC,
            specification: defaults.specification,
            evaluationTechnique: defaults.evaluationTechnique,
            sampleSize: defaults.sampleSize,
            sampleFrequency: defaults.sampleFrequency,
            controlMethod: rep.cause.preventionControl || '',
            reactionPlan: defaults.reactionPlan,
            reactionPlanOwner: defaults.reactionPlanOwner,
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

    // PRODUCT rows (grouped by op + failure + detection)
    const productGroups = new Map();
    for (const q of qualifying) {
        const key = JSON.stringify([
            q.op.opNumber,
            (q.fail.description || '').toLowerCase().trim().replace(/\s+/g, ' '),
            (q.cause.detectionControl || '').toLowerCase().trim().replace(/\s+/g, ' '),
        ]);
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

        const defaults = getCpDefaults(highAp, highSev, rep, 'product');

        items.push({
            id: uuid(),
            processStepNumber: rep.op.opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: rep.we.name || '',
            characteristicNumber: '',
            productCharacteristic: rep.fail.description || '',
            processCharacteristic: '',
            specialCharClass: bestSC,
            specification: defaults.specification,
            evaluationTechnique: rep.cause.detectionControl || '',
            sampleSize: defaults.sampleSize,
            sampleFrequency: defaults.sampleFrequency,
            controlMethod: '',
            reactionPlan: defaults.reactionPlan,
            reactionPlanOwner: defaults.reactionPlanOwner,
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

    // Sort by operation number
    items.sort((a, b) => {
        const numA = parseInt(a.processStepNumber) || 0;
        const numB = parseInt(b.processStepNumber) || 0;
        if (numA !== numB) return numA - numB;
        return (a.processCharacteristic ? 0 : 1) - (b.processCharacteristic ? 0 : 1);
    });

    return { items, qualifyingCount: qualifying.length };
}

/** Generate HO document from AMFE operations (stub sheets) */
function generateHoDocument(amfeDoc, product) {
    const DEFAULT_REACTION = 'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME:\n' +
        'DETENGA LA OPERACION\n' +
        'NOTIFIQUE DE INMEDIATO A SU LIDER O SUPERVISOR\n' +
        'ESPERE LA DEFINICION DEL LIDER O SUPERVISOR';

    const sheets = [];
    for (const op of amfeDoc.operations) {
        sheets.push({
            id: uuid(),
            amfeOperationId: op.id,
            operationNumber: op.opNumber,
            operationName: op.name,
            hoNumber: `HO-${op.opNumber}`,
            sector: '',
            puestoNumber: '',
            vehicleModel: '',
            partCodeDescription: product.partNumber + ' ' + product.partName,
            safetyElements: [],
            hazardWarnings: [],
            steps: [],
            qualityChecks: [],
            reactionPlanText: DEFAULT_REACTION,
            reactionContact: '',
            visualAids: [],
            preparedBy: 'F.Santoro',
            approvedBy: 'G.Cal',
            date: '2026-03-17',
            revision: 'A',
            status: 'borrador',
        });
    }

    const hoDoc = {
        header: {
            formNumber: 'I-IN-002.4-R01',
            organization: 'BARACK MERCOSUL',
            client: 'PWA',
            partNumber: product.partNumber,
            partDescription: product.partName,
            applicableParts: product.applicableParts.join('\n'),
            linkedAmfeProject: product.projectName,
            linkedCpProject: product.projectName,
        },
        sheets,
    };

    return hoDoc;
}

/** Generate PFD document from flujograma data */
function generatePfdDocument(product) {
    const pfdId = uuid();
    const steps = product.pfdSteps.map((s, i) => ({
        id: uuid(),
        stepNumber: s.num || '',
        stepType: s.type,
        description: s.desc,
        machineDeviceTool: '',
        productCharacteristic: '',
        productSpecialChar: 'none',
        processCharacteristic: '',
        processSpecialChar: 'none',
        reference: '',
        department: s.dept || '',
        notes: '',
        isRework: s.isRework || false,
        isExternalProcess: false,
        reworkReturnStep: '',
        rejectDisposition: 'none',
        scrapDescription: '',
        branchId: '',
        branchLabel: '',
    }));

    return {
        id: pfdId,
        header: {
            partNumber: product.partNumber,
            partName: product.pfdPartName,
            engineeringChangeLevel: '',
            modelYear: '',
            documentNumber: product.pfdDocNumber,
            revisionLevel: 'A',
            revisionDate: '2026-03-17',
            processPhase: 'production',
            companyName: 'BARACK MERCOSUL',
            plantLocation: 'Hurlingham, Buenos Aires',
            supplierCode: '',
            customerName: 'PWA',
            client: 'PWA',
            coreTeam: 'F.Santoro, P.Centurion, G.Cal',
            keyContact: '',
            preparedBy: 'F.Santoro',
            preparedDate: '2026-03-17',
            approvedBy: 'G.Cal',
            approvedDate: '2026-03-17',
            applicableParts: product.applicableParts.join('\n'),
        },
        steps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('================================================================');
    console.log('  SEED: CP + HO + PFD + Families for PWA Telas');
    console.log('  (Telas Planas + Telas Termoformadas)');
    console.log('================================================================');

    // Step 0: Connect
    await initSupabase();

    for (const product of PRODUCTS) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`  Processing: ${product.familyName}`);
        console.log(`${'='.repeat(60)}`);

        // ── Step 1: Find existing AMFE ───────────────────────────────────
        console.log('\n  Step 1: Finding AMFE...');
        const amfeRows = await selectSql(
            `SELECT id, amfe_number, project_name, operation_count, cause_count, data
             FROM amfe_documents WHERE project_name = ?`,
            [product.projectName]
        );

        let amfeId, amfeDoc;
        if (amfeRows.length > 0) {
            amfeId = amfeRows[0].id;
            amfeDoc = typeof amfeRows[0].data === 'string' ? JSON.parse(amfeRows[0].data) : amfeRows[0].data;
            console.log(`    Found: ${amfeRows[0].amfe_number} (${amfeRows[0].operation_count} ops, ${amfeRows[0].cause_count} causes)`);
        } else {
            // AMFE not in Supabase yet — create it from embedded data
            console.log(`    AMFE not found for "${product.projectName}" — creating...`);
            amfeDoc = product.key === 'planas' ? buildAmfeTelasPlanas() : buildAmfeTermoformadas();
            amfeId = await seedAmfeToSupabase(product, amfeDoc);
        }

        const { total: causeTotal, apH, apM } = countCauses(amfeDoc.operations);
        console.log(`    AMFE ID: ${amfeId}`);
        console.log(`    Operations: ${amfeDoc.operations.length}, Causes: ${causeTotal} (H=${apH}, M=${apM})`);

        // ── Step 2: Create PFD ───────────────────────────────────────────
        console.log('\n  Step 2: Creating PFD...');
        const pfdDoc = generatePfdDocument(product);
        const pfdDataJson = JSON.stringify(pfdDoc);
        const pfdChecksum = sha256(pfdDataJson);
        const pfdId = pfdDoc.id;

        // Check if PFD already exists
        const existingPfd = await selectSql(
            `SELECT id FROM pfd_documents WHERE document_number = ?`,
            [product.pfdDocNumber]
        );

        if (existingPfd.length > 0) {
            const existPfdId = existingPfd[0].id;
            await execSql(`UPDATE pfd_documents SET
                data = ?, checksum = ?, updated_at = NOW(),
                step_count = ?, part_number = ?, part_name = ?,
                revision_level = ?, revision_date = ?, customer_name = ?
                WHERE id = ?`,
                [pfdDataJson, pfdChecksum, pfdDoc.steps.length,
                 product.partNumber, product.pfdPartName,
                 'A', '2026-03-17', 'PWA', existPfdId]);
            pfdDoc.id = existPfdId;
            console.log(`    PFD updated (ID: ${existPfdId}, ${pfdDoc.steps.length} steps)`);
        } else {
            await execSql(`INSERT INTO pfd_documents (
                id, part_number, part_name, document_number, revision_level,
                revision_date, customer_name, step_count, data, checksum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [pfdId, product.partNumber, product.pfdPartName,
                 product.pfdDocNumber, 'A', '2026-03-17', 'PWA',
                 pfdDoc.steps.length, pfdDataJson, pfdChecksum]);
            console.log(`    PFD inserted (ID: ${pfdId}, ${pfdDoc.steps.length} steps)`);
        }

        // ── Step 3: Generate Control Plan ────────────────────────────────
        console.log('\n  Step 3: Generating Control Plan...');
        const cpPhase = 'production';
        const cpId = uuid();

        const cpHeader = {
            controlPlanNumber: product.cpNumber,
            phase: cpPhase,
            partNumber: product.partNumber,
            latestChangeLevel: amfeDoc.header.revision || '',
            partName: product.partName,
            applicableParts: product.applicableParts.join('\n'),
            organization: 'BARACK MERCOSUL',
            supplier: '',
            supplierCode: '',
            keyContactPhone: '',
            date: '2026-03-17',
            revision: '1',
            responsible: 'F.Santoro',
            approvedBy: 'G.Cal',
            client: 'PWA',
            coreTeam: amfeDoc.header.teamMembers || amfeDoc.header.team || '',
            customerEngApproval: '',
            customerQualityApproval: '',
            otherApproval: '',
            linkedAmfeProject: product.projectName,
        };

        const { items: cpItems, qualifyingCount } = generateControlPlan(amfeDoc, cpPhase);
        const cpDoc = { header: cpHeader, items: cpItems };
        const cpDataJson = JSON.stringify(cpDoc);
        const cpChecksum = sha256(cpDataJson);

        console.log(`    Qualifying AMFE causes: ${qualifyingCount}`);
        console.log(`    CP items generated: ${cpItems.length}`);

        // Check if CP already exists
        const existingCp = await selectSql(
            `SELECT id FROM cp_documents WHERE project_name = ? OR control_plan_number = ?`,
            [product.projectName, product.cpNumber]
        );

        let finalCpId;
        if (existingCp.length > 0) {
            finalCpId = existingCp[0].id;
            await execSql(`UPDATE cp_documents SET
                data = ?, checksum = ?, updated_at = NOW(),
                item_count = ?, phase = ?, revision = ?, part_number = ?,
                part_name = ?, control_plan_number = ?,
                linked_amfe_project = ?, linked_amfe_id = ?
                WHERE id = ?`,
                [cpDataJson, cpChecksum, cpItems.length, cpPhase, '1',
                 product.partNumber, product.partName, product.cpNumber,
                 product.projectName, amfeId, finalCpId]);
            console.log(`    CP updated (ID: ${finalCpId})`);
        } else {
            finalCpId = cpId;
            await execSql(`INSERT INTO cp_documents (
                id, project_name, control_plan_number, phase,
                part_number, part_name, organization, client,
                responsible, revision, linked_amfe_project, linked_amfe_id,
                item_count, data, checksum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [cpId, product.projectName, product.cpNumber, cpPhase,
                 product.partNumber, product.partName, 'BARACK MERCOSUL', 'PWA',
                 'F.Santoro', '1', product.projectName, amfeId,
                 cpItems.length, cpDataJson, cpChecksum]);
            console.log(`    CP inserted (ID: ${cpId}, ${cpItems.length} items)`);
        }

        // ── Step 4: Generate HO ──────────────────────────────────────────
        console.log('\n  Step 4: Generating HO...');
        const hoDoc = generateHoDocument(amfeDoc, product);
        const hoDataJson = JSON.stringify(hoDoc);
        const hoChecksum = sha256(hoDataJson);
        const hoId = uuid();

        // Check if HO already exists
        const existingHo = await selectSql(
            `SELECT id FROM ho_documents WHERE linked_amfe_project = ?`,
            [product.projectName]
        );

        let finalHoId;
        if (existingHo.length > 0) {
            finalHoId = existingHo[0].id;
            await execSql(`UPDATE ho_documents SET
                data = ?, checksum = ?, updated_at = NOW(),
                sheet_count = ?, part_number = ?, part_description = ?,
                linked_cp_project = ?
                WHERE id = ?`,
                [hoDataJson, hoChecksum, hoDoc.sheets.length,
                 product.partNumber, product.partName,
                 product.projectName, finalHoId]);
            console.log(`    HO updated (ID: ${finalHoId}, ${hoDoc.sheets.length} sheets)`);
        } else {
            finalHoId = hoId;
            await execSql(`INSERT INTO ho_documents (
                id, form_number, organization, client,
                part_number, part_description,
                linked_amfe_project, linked_cp_project,
                linked_amfe_id, linked_cp_id,
                sheet_count, data, checksum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [hoId, 'I-IN-002.4-R01', 'BARACK MERCOSUL', 'PWA',
                 product.partNumber, product.partName,
                 product.projectName, product.projectName,
                 amfeId, finalCpId,
                 hoDoc.sheets.length, hoDataJson, hoChecksum]);
            console.log(`    HO inserted (ID: ${hoId}, ${hoDoc.sheets.length} sheets)`);
        }

        // ── Step 5: Create Product Family ────────────────────────────────
        console.log('\n  Step 5: Creating product family...');

        // Ensure customer line exists
        await execSql(`INSERT OR IGNORE INTO customer_lines (code, name, product_count, is_automotive)
            VALUES (?, ?, ?, ?)`,
            [product.lineaCode, product.lineaName, product.applicableParts.length, 1]);

        // Create or find family
        const existFam = await selectSql(
            `SELECT id FROM product_families WHERE name = ?`,
            [product.familyName]
        );

        let familyId;
        if (existFam.length > 0) {
            familyId = existFam[0].id;
            console.log(`    Family "${product.familyName}" already exists (ID: ${familyId})`);
        } else {
            await execSql(
                `INSERT INTO product_families (name, description, linea_code, linea_name)
                VALUES (?, ?, ?, ?)`,
                [product.familyName, product.familyDescription, product.lineaCode, product.lineaName]);
            // Query for the newly created family ID
            const newFam = await selectSql(
                `SELECT id FROM product_families WHERE name = ?`, [product.familyName]);
            familyId = newFam[0]?.id;
            if (!familyId) {
                console.error(`    ERROR: Family "${product.familyName}" was not created!`);
                continue;
            }
            console.log(`    Family created: "${product.familyName}" (ID: ${familyId})`);
        }

        // ── Step 6: Link documents to family ─────────────────────────────
        console.log('\n  Step 6: Linking documents to family...');

        // Get final PFD ID (may have been updated)
        const finalPfdId = existingPfd.length > 0 ? existingPfd[0].id : pfdId;

        const docLinks = [
            { module: 'amfe', documentId: amfeId, label: 'AMFE' },
            { module: 'cp', documentId: finalCpId, label: 'CP' },
            { module: 'pfd', documentId: finalPfdId, label: 'PFD' },
            { module: 'ho', documentId: finalHoId, label: 'HO' },
        ];

        for (const { module, documentId, label } of docLinks) {
            const existing = await selectSql(
                `SELECT id FROM family_documents WHERE family_id = ? AND module = ? AND document_id = ?`,
                [familyId, module, documentId]
            );

            if (existing.length > 0) {
                console.log(`    ${label}: Already linked (family_doc_id=${existing[0].id})`);
            } else {
                await execSql(
                    `INSERT INTO family_documents (family_id, module, document_id, is_master, source_master_id, product_id)
                     VALUES (?, ?, ?, 1, NULL, NULL)`,
                    [familyId, module, documentId]);
                console.log(`    ${label}: Linked as master`);
            }
        }

        // Insert products and link to family
        for (const part of product.applicableParts) {
            const parts = part.split(' ');
            const codigo = parts[0];
            const descripcion = parts.slice(1).join(' ');

            await execSql(
                `INSERT OR IGNORE INTO products (codigo, descripcion, linea_code, linea_name)
                VALUES (?, ?, ?, ?)`,
                [codigo, descripcion, product.lineaCode, product.lineaName]);

            const productResult = await selectSql(
                `SELECT id FROM products WHERE codigo = ? AND linea_code = ?`,
                [codigo, product.lineaCode]
            );
            if (productResult.length > 0) {
                const productId = productResult[0].id;
                await execSql(
                    `INSERT OR IGNORE INTO product_family_members (family_id, product_id, is_primary)
                    VALUES (?, ?, ?)`,
                    [familyId, productId, codigo === product.applicableParts[0].split(' ')[0] ? 1 : 0]);
            }
        }
        console.log(`    Products: ${product.applicableParts.length} linked`);

        // ── Verify ───────────────────────────────────────────────────────
        console.log('\n  -- Verification --');

        const cpVerify = await selectSql(
            `SELECT id, control_plan_number, item_count, phase FROM cp_documents WHERE project_name = ?`,
            [product.projectName]);
        console.log(`    CP: ${cpVerify.length} doc(s)${cpVerify[0] ? ` — ${cpVerify[0].item_count} items, phase=${cpVerify[0].phase}` : ''}`);

        const hoVerify = await selectSql(
            `SELECT id, sheet_count FROM ho_documents WHERE linked_amfe_project = ?`,
            [product.projectName]);
        console.log(`    HO: ${hoVerify.length} doc(s)${hoVerify[0] ? ` — ${hoVerify[0].sheet_count} sheets` : ''}`);

        const pfdVerify = await selectSql(
            `SELECT id, step_count FROM pfd_documents WHERE document_number = ?`,
            [product.pfdDocNumber]);
        console.log(`    PFD: ${pfdVerify.length} doc(s)${pfdVerify[0] ? ` — ${pfdVerify[0].step_count} steps` : ''}`);

        const famVerify = await selectSql(
            `SELECT COUNT(*) as cnt FROM family_documents WHERE family_id = ?`,
            [familyId]);
        console.log(`    Family docs: ${famVerify[0]?.cnt ?? 0} linked`);
    }

    // ═════════════════════════════════════════════════════════════════════
    // GLOBAL SUMMARY
    // ═════════════════════════════════════════════════════════════════════

    console.log('\n================================================================');
    console.log('  GLOBAL VERIFICATION');
    console.log('================================================================');

    const allAmfe = await selectSql(
        `SELECT id, project_name, operation_count, cause_count FROM amfe_documents WHERE project_name LIKE 'PWA/%'`);
    console.log(`\n  AMFE documents (PWA): ${allAmfe.length}`);
    for (const a of allAmfe) console.log(`    ${a.project_name}: ${a.operation_count} ops, ${a.cause_count} causes`);

    const allCp = await selectSql(
        `SELECT id, project_name, item_count, phase FROM cp_documents WHERE project_name LIKE 'PWA/%'`);
    console.log(`\n  CP documents (PWA): ${allCp.length}`);
    for (const c of allCp) console.log(`    ${c.project_name}: ${c.item_count} items, phase=${c.phase}`);

    const allHo = await selectSql(
        `SELECT id, linked_amfe_project, sheet_count FROM ho_documents WHERE linked_amfe_project LIKE 'PWA/%'`);
    console.log(`\n  HO documents (PWA): ${allHo.length}`);
    for (const h of allHo) console.log(`    ${h.linked_amfe_project}: ${h.sheet_count} sheets`);

    const allPfd = await selectSql(
        `SELECT id, document_number, part_name, step_count FROM pfd_documents WHERE customer_name = 'PWA'`);
    console.log(`\n  PFD documents (PWA): ${allPfd.length}`);
    for (const p of allPfd) console.log(`    ${p.document_number}: ${p.part_name} (${p.step_count} steps)`);

    const allFam = await selectSql(
        `SELECT pf.id, pf.name, COUNT(fd.id) as doc_count
         FROM product_families pf
         LEFT JOIN family_documents fd ON fd.family_id = pf.id
         WHERE pf.name LIKE '%PWA%'
         GROUP BY pf.id, pf.name`);
    console.log(`\n  Families (PWA): ${allFam.length}`);
    for (const f of allFam) console.log(`    "${f.name}": ${f.doc_count} docs`);

    console.log('\n================================================================');
    console.log('  SEED COMPLETE: PWA Telas (CP + HO + PFD + Families)');
    console.log('================================================================');

    close();
}

main().catch(err => {
    console.error('\nERROR:', err);
    close();
    process.exit(1);
});
