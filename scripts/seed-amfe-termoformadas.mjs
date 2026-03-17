#!/usr/bin/env node
/**
 * SEED: AMFE TELAS TERMOFORMADAS — PWA
 *
 * Crea el AMFE de Telas Termoformadas en la DB SQLite.
 * Fuente: AMFE_TERMOFORMADAS.txt (formato viejo Barack Mercosul)
 *
 * Operaciones: OP10 (Recepción), OP15 (Preparación corte), OP20 (Corte),
 *              OP30 (Costura fuerte), OP40 (Colocado de clips), OP50 (Pegado dots),
 *              OP60 (Inspección final), OP70 (Embalaje)
 *
 * Usage: node scripts/seed-amfe-termoformadas.mjs
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
    subject: 'TELAS TERMOFORMADAS',
    partNumber: 'Según tabla',
    responsibleDesign: 'F.SANTORO',
    startDate: '2020-06-18',
    revDate: '2025-04-29',
    revision: 'D',
    teamMembers: 'CAL: M.Nieve, PROD: G.Cal, INGEN: P.Centurión',
    plant: 'PWA',
    companyName: 'BARACK MERCOSUL',
    applicableParts: 'Según tabla (TNT/Telas termoformadas)',
};

// ─── Operations ─────────────────────────────────────────────────────────

const operations = [
    // OP 10 — Recepción de materiales
    mkOp(10, 'Recepción de materiales con identificación correcta', [
        mkWE('Method', 'Recepción de materiales', [
            {
                desc: 'Recibir y verificar materiales con identificación correcta en sector indicado',
                failures: [
                    { desc: 'Identificación incorrecta', S: 7, efLocal: 'Problemas en orden del stock', causes: [
                        { cause: 'Falta de capacitación', O: 2, prev: 'Capacitación de operario', det: 'Recepción de materiales', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Ubicación en sector incorrecto', S: 7, efLocal: 'Problemas en orden del stock', causes: [
                        { cause: 'Falta de identificación de sector / Falta de capacitación', O: 2, prev: 'Capacitación de operario / identificación de sectores', det: 'Recepción de materiales', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Material distinto según plan de control de recepción', S: 7, efLocal: 'Problemas con operaciones posteriores', causes: [
                        { cause: 'Falta de control de recepción/capacitación del operario', O: 3, prev: 'Capacitación del operario', det: 'Recepción de materiales', D: 7, ap: 'H' },
                    ]},
                    { desc: 'Omisión de la recepción de material', S: 7, efLocal: 'Problemas en orden del stock', causes: [
                        { cause: 'Falta de capacitación', O: 2, prev: 'Capacitación de operario', det: 'Recepción de materiales', D: 6, ap: 'L' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 15 — Preparación de corte
    mkOp(15, 'Preparación de corte', [
        mkWE('Machine', 'Cortadora de extremo / Mesa de corte', [
            {
                desc: 'Preparar material TNT para corte con enrase correcto y perforaciones',
                failures: [
                    { desc: 'Desplazamiento involuntario del material TNT provocando falta de perforaciones y colocación incorrecta de aplix', S: 7, efLocal: 'Problemas en operaciones posteriores (falta de aplix en ubicaciones correctas)', causes: [
                        { cause: 'Operario no verificó enrase de las líneas de contorno del TNT', O: 2, prev: 'Hoja de operaciones con líneas de referencia impresas para punzonado', det: 'Inspección visual de las perforaciones inmediatamente después de punzonar', D: 6, ap: 'L' },
                    ]},
                    { desc: 'TNT plegado involuntariamente al cargar, provocando desplazamiento del contorno', S: 7, efLocal: 'Requiere retrabajo completo fuera de línea para corregir perforaciones y ubicación de aplix', causes: [
                        { cause: 'El operario carga el TNT con un pliegue no detectado en la mesa de corte', O: 2, prev: 'Hoja de Operaciones HO964', det: 'Inspección Visual Posterior al Corte', D: 6, ap: 'L' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 20 — Corte por máquina automática
    mkOp(20, 'Corte por máquina automática según dimensional con orificios según plan de control', [
        mkWE('Machine', 'Máquina de corte automática', [
            {
                desc: 'Cortar piezas con dimensiones y orificios según plan de control',
                failures: [
                    { desc: 'Largo distinto al especificado', S: 7, efLocal: 'Inutilización del material', causes: [
                        { cause: 'Programación equivocada de la máquina de corte automática', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control con pieza patrón', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Ancho distinto al especificado', S: 7, efLocal: 'Inutilización del material', causes: [
                        { cause: 'Programación equivocada de la máquina de corte automática', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control con pieza patrón', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Falta de orificios', S: 7, efLocal: 'Imposibilidad de realizar el proceso posterior', causes: [
                        { cause: 'Programación equivocada de la máquina de corte automática', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control visual', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Orificios fuera de posición', S: 7, efLocal: 'Imposibilidad de realizar el proceso posterior', causes: [
                        { cause: 'Programación equivocada de la máquina de corte automática', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control con pieza patrón', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Diámetro de orificios fuera de especificación', S: 7, efLocal: 'Imposibilidad de realizar el proceso posterior', causes: [
                        { cause: 'Programación equivocada de la máquina de corte automática', O: 2, prev: 'Set up de la máquina de corte automática', det: 'Control con pieza patrón', D: 6, ap: 'L' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 30 — Costura fuerte
    mkOp(30, 'Costura fuerte, sin arruga ni pliegues con hilo según especificaciones', [
        mkWE('Machine', 'Máquina de costura', [
            {
                desc: 'Costura fuerte, sin arruga ni pliegues con hilo según especificaciones',
                failures: [
                    { desc: 'Refuerzo costurado opuesto al airbag posicionado de manera inversa', S: 7, efLocal: 'Scrap', causes: [
                        { cause: 'Falla del operario', O: 2, prev: 'Hoja de operaciones', det: 'Autocontrol', D: 6, ap: 'L', obs: 'Acción tomada: Identificar con tilde en refuerzo costurado en Costura / packaging' },
                    ]},
                    { desc: 'Falta de costura', S: 7, efLocal: 'Scrap', causes: [
                        { cause: 'Carreteles mal ubicados', O: 2, prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patrón', D: 6, ap: 'L' },
                        { cause: 'Aguja mal ubicada', O: 2, prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patrón', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Costura floja / deficiente', S: 8, efLocal: 'Retrabajo', causes: [
                        { cause: 'Falla en la tensión del hilo', O: 2, prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patrón', D: 6, ap: 'L', obs: 'Acción tomada: Se crea instructivo de retrabajo' },
                    ]},
                    { desc: 'Costura salteada', S: 7, efLocal: 'Scrap', causes: [
                        { cause: 'Peine dañado', O: 2, prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patrón', D: 6, ap: 'L' },
                        { cause: 'Aguja despuntada', O: 2, prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patrón', D: 6, ap: 'L' },
                    ]},
                    { desc: 'Arrugas / Pliegues', S: 7, efLocal: 'Scrap', causes: [
                        { cause: 'Hilo enredado', O: 2, prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patrón', D: 6, ap: 'L' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 40 — Colocado de clips
    mkOp(40, 'Colocado de clips en posición correcta con cantidad correcta', [
        mkWE('Method', 'Colocación manual de clips', [
            {
                desc: 'Colocar clips en posición y cantidad correcta',
                failures: [
                    { desc: 'Clips colocados en posición incorrecta', S: 7, efLocal: 'Retrabajo de la pieza', causes: [
                        { cause: 'Orificios fuera de posición', O: 2, prev: 'Control con pieza patrón', det: 'Control visual', D: 7, ap: 'L' },
                    ]},
                    { desc: 'Falta de clips', S: 7, efLocal: 'Retrabajo de la pieza', causes: [
                        { cause: 'Falta de orificios', O: 2, prev: 'Control con pieza patrón', det: 'Control visual', D: 7, ap: 'L' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 50 — Pegado de dots
    mkOp(50, 'Pegado de dots en posición correcta con cantidad correcta', [
        mkWE('Method', 'Pegado manual de dots', [
            {
                desc: 'Colocar dots en posición y cantidad correcta',
                failures: [
                    { desc: 'Dots colocados en posición incorrecta', S: 7, efLocal: 'Retrabajo de la pieza', causes: [
                        { cause: 'Orificios fuera de posición', O: 2, det: 'Control visual', D: 7, ap: 'L' },
                    ]},
                    { desc: 'Falta de dots', S: 7, efLocal: 'Retrabajo de la pieza', causes: [
                        { cause: 'Falta de orificios', O: 2, det: 'Control visual', D: 7, ap: 'L' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 60 — Inspección final de la pieza
    mkOp(60, 'Inspección final de la pieza', [
        mkWE('Method', 'Inspección dimensional y visual', [
            {
                desc: 'Inspección final dimensional y visual de la pieza',
                failures: [
                    { desc: 'Dimensional fuera de especificación', S: 8, efLocal: 'Rechazo de Cliente', causes: [
                        { cause: 'Programación equivocada de la máquina de corte automática', O: 2, det: 'Control dimensional de la pieza', D: 6, ap: 'L' },
                    ]},
                ],
            },
        ]),
    ]),

    // OP 70 — Embalaje
    mkOp(70, 'Embalaje identificado con cantidad de piezas específicas', [
        mkWE('Method', 'Embalaje e identificación', [
            {
                desc: 'Embalar y rotular producto terminado con cantidad correcta',
                failures: [
                    { desc: 'Mayor cantidad de piezas por medio', S: 7, efLocal: 'Reclamo de cliente', causes: [
                        { cause: 'Error de conteo', O: 2, prev: 'Control adicional con otro método', det: 'Autocontrol / Audit de producto terminado', D: 7, ap: 'L' },
                    ]},
                    { desc: 'Menor cantidad de piezas por medio', S: 8, efLocal: 'Reclamo de cliente', causes: [
                        { cause: 'Error de conteo', O: 2, prev: 'Control adicional con otro método', det: 'Autocontrol / Audit de producto terminado', D: 7, ap: 'M',
                          obs: 'Acción tomada: Control del despacho según ficha de embalaje (S=8, O=2, D=6, NPR=96)' },
                    ]},
                    { desc: 'Error de identificación', S: 8, efLocal: 'Pérdida de rastreabilidad / Reclamo del Cliente', causes: [
                        { cause: 'Error de identificación por parte del operador', O: 2, prev: 'Autocontrol / Organización de etiquetas', det: 'Audit de producto terminado', D: 7, ap: 'M',
                          obs: 'Acción tomada: Control del despacho según ficha de embalaje (S=8, O=2, D=6, NPR=96)' },
                    ]},
                    { desc: 'Falta de identificación', S: 8, efLocal: 'Pérdida de rastreabilidad / Reclamo del Cliente', causes: [
                        { cause: 'Falla de operario', O: 2, prev: 'Audit de producto terminado', det: 'Audit de producto terminado', D: 7, ap: 'M',
                          obs: 'Acción tomada: Control del despacho según ficha de embalaje (S=8, O=2, D=6, NPR=96)' },
                    ]},
                ],
            },
        ]),
    ]),
];

// ─── Insert into DB ─────────────────────────────────────────────────────

async function main() {
    console.log('══════════════════════════════════════════════════════════');
    console.log('  SEED: AMFE TELAS TERMOFORMADAS — PWA');
    console.log('══════════════════════════════════════════════════════════');

    if (!existsSync(DB_PATH)) {
        console.error(`❌ DB no encontrada: ${DB_PATH}`);
        process.exit(1);
    }

    const SQL = await initSqlJs();
    const buffer = readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    const PROJECT_NAME = 'PWA/TELAS_TERMOFORMADAS';
    const amfeDoc = { header, operations };
    const jsonStr = JSON.stringify(amfeDoc);
    const checksum = sha256(jsonStr);
    const id = uuid();

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

    const existing = db.exec(`SELECT id FROM amfe_documents WHERE project_name = '${PROJECT_NAME}'`);
    if (existing.length && existing[0].values.length) {
        const existingId = existing[0].values[0][0];
        db.run(`UPDATE amfe_documents SET data = ?, checksum = ?, operation_count = ?, cause_count = ?, ap_h_count = ?, ap_m_count = ?, coverage_percent = ?, updated_at = datetime('now') WHERE id = ?`,
            [jsonStr, checksum, operations.length, causeCount, apH, apM, coveragePct, existingId]);
        console.log(`\n   ✅ AMFE actualizado (ID: ${existingId})`);
    } else {
        const numRows = db.exec(`SELECT MAX(CAST(REPLACE(amfe_number, 'AMFE-', '') AS INTEGER)) FROM amfe_documents`);
        const nextNum = (numRows.length && numRows[0].values[0][0] ? numRows[0].values[0][0] + 1 : 3);
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

    const outBuffer = Buffer.from(db.export());
    writeFileSync(DB_PATH, outBuffer);

    console.log('\n══════════════════════════════════════════════════════════\n');
    db.close();
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
