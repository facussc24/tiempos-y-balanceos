#!/usr/bin/env node
/**
 * Database Seed Runner: AMFE INSERTO + Control Plan - Proyecto PATAGONIA (VW)
 *
 * Creates the SQLite database and inserts:
 *   1. Complete AMFE document (21 operations from PDF)
 *   2. Preliminary Control Plan (auto-generated from AMFE)
 *
 * Usage: node scripts/run-seed.mjs
 */

import initSqlJs from 'sql.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

// ─── Import AMFE data ────────────────────────────────────────────────────────

import { header, allOperations as ops10to50, uuid, sha256 } from './seed-amfe-inserto.mjs';
import { ops60to92 } from './seed-ops-60-92.mjs';
import { ops100to120 } from './seed-ops-100-120.mjs';

// ─── Config ──────────────────────────────────────────────────────────────────

const DB_PATH = join(
    process.env.APPDATA || join(process.env.USERPROFILE || 'C:\\Users\\FacundoS-PC', 'AppData', 'Roaming'),
    'com.barackmercosul.app',
    'barack_mercosul.db'
);

// ─── Schema DDL (must match utils/database.ts exactly) ───────────────────────

const SCHEMA_VERSION = 2;

const SCHEMA_DDL = `
-- Version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Projects (Tiempos y Balanceo studies)
CREATE TABLE IF NOT EXISTS projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    client          TEXT NOT NULL DEFAULT '',
    project_code    TEXT NOT NULL DEFAULT '',
    engineer        TEXT NOT NULL DEFAULT '',
    version         TEXT NOT NULL DEFAULT 'Borrador',
    daily_demand    INTEGER NOT NULL DEFAULT 1000,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    data            TEXT NOT NULL,
    checksum        TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- AMFE VDA documents
CREATE TABLE IF NOT EXISTS amfe_documents (
    id                  TEXT PRIMARY KEY,
    amfe_number         TEXT NOT NULL UNIQUE,
    project_name        TEXT NOT NULL,
    subject             TEXT NOT NULL DEFAULT '',
    client              TEXT NOT NULL DEFAULT '',
    part_number         TEXT NOT NULL DEFAULT '',
    responsible         TEXT NOT NULL DEFAULT '',
    organization        TEXT NOT NULL DEFAULT '',
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK(status IN ('draft','inReview','approved','archived')),
    operation_count     INTEGER NOT NULL DEFAULT 0,
    cause_count         INTEGER NOT NULL DEFAULT 0,
    ap_h_count          INTEGER NOT NULL DEFAULT 0,
    ap_m_count          INTEGER NOT NULL DEFAULT 0,
    coverage_percent    REAL NOT NULL DEFAULT 0,
    start_date          TEXT NOT NULL DEFAULT '',
    last_revision_date  TEXT NOT NULL DEFAULT '',
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    data                TEXT NOT NULL,
    revisions           TEXT NOT NULL DEFAULT '[]',
    checksum            TEXT
);

CREATE INDEX IF NOT EXISTS idx_amfe_status ON amfe_documents(status);
CREATE INDEX IF NOT EXISTS idx_amfe_client ON amfe_documents(client);
CREATE INDEX IF NOT EXISTS idx_amfe_updated ON amfe_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_amfe_number ON amfe_documents(amfe_number);
CREATE INDEX IF NOT EXISTS idx_amfe_project_name ON amfe_documents(project_name);

-- AMFE Library (global operation templates)
CREATE TABLE IF NOT EXISTS amfe_library_operations (
    id              TEXT PRIMARY KEY,
    op_number       TEXT NOT NULL,
    name            TEXT NOT NULL,
    category        TEXT DEFAULT '',
    description     TEXT DEFAULT '',
    tags            TEXT DEFAULT '[]',
    version         INTEGER NOT NULL DEFAULT 1,
    last_modified   TEXT NOT NULL DEFAULT (datetime('now')),
    data            TEXT NOT NULL,
    search_text     TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_library_category ON amfe_library_operations(category);
CREATE INDEX IF NOT EXISTS idx_library_name ON amfe_library_operations(name);

-- Control Plan documents
CREATE TABLE IF NOT EXISTS cp_documents (
    id                  TEXT PRIMARY KEY,
    project_name        TEXT NOT NULL DEFAULT '',
    control_plan_number TEXT NOT NULL DEFAULT '',
    phase               TEXT NOT NULL DEFAULT 'production'
                        CHECK(phase IN ('prototype','preLaunch','safeLaunch','production')),
    part_number         TEXT NOT NULL DEFAULT '',
    part_name           TEXT NOT NULL DEFAULT '',
    organization        TEXT NOT NULL DEFAULT '',
    client              TEXT NOT NULL DEFAULT '',
    responsible         TEXT NOT NULL DEFAULT '',
    revision            TEXT NOT NULL DEFAULT '',
    linked_amfe_project TEXT DEFAULT '',
    linked_amfe_id      TEXT REFERENCES amfe_documents(id) ON DELETE SET NULL,
    item_count          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    data                TEXT NOT NULL,
    checksum            TEXT
);

CREATE INDEX IF NOT EXISTS idx_cp_project_name ON cp_documents(project_name);
CREATE INDEX IF NOT EXISTS idx_cp_client ON cp_documents(client);
CREATE INDEX IF NOT EXISTS idx_cp_updated ON cp_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cp_linked_amfe ON cp_documents(linked_amfe_id);
CREATE INDEX IF NOT EXISTS idx_cp_linked_amfe_project ON cp_documents(linked_amfe_project);

-- Hojas de Operaciones documents
CREATE TABLE IF NOT EXISTS ho_documents (
    id                  TEXT PRIMARY KEY,
    form_number         TEXT NOT NULL DEFAULT 'I-IN-002.4-R01',
    organization        TEXT NOT NULL DEFAULT '',
    client              TEXT NOT NULL DEFAULT '',
    part_number         TEXT NOT NULL DEFAULT '',
    part_description    TEXT NOT NULL DEFAULT '',
    linked_amfe_project TEXT DEFAULT '',
    linked_cp_project   TEXT DEFAULT '',
    linked_amfe_id      TEXT REFERENCES amfe_documents(id) ON DELETE SET NULL,
    linked_cp_id        TEXT REFERENCES cp_documents(id) ON DELETE SET NULL,
    sheet_count         INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    data                TEXT NOT NULL,
    checksum            TEXT
);

CREATE INDEX IF NOT EXISTS idx_ho_client ON ho_documents(client);
CREATE INDEX IF NOT EXISTS idx_ho_updated ON ho_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ho_linked_amfe_project ON ho_documents(linked_amfe_project);

-- PFD (Process Flow Diagram) documents
CREATE TABLE IF NOT EXISTS pfd_documents (
    id              TEXT PRIMARY KEY,
    part_number     TEXT NOT NULL DEFAULT '',
    part_name       TEXT NOT NULL DEFAULT '',
    document_number TEXT NOT NULL DEFAULT '',
    revision_level  TEXT NOT NULL DEFAULT 'A',
    revision_date   TEXT NOT NULL DEFAULT '',
    customer_name   TEXT NOT NULL DEFAULT '',
    step_count      INTEGER NOT NULL DEFAULT 0,
    data            TEXT NOT NULL,
    checksum        TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pfd_updated ON pfd_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pfd_customer ON pfd_documents(customer_name);

-- Unified drafts
CREATE TABLE IF NOT EXISTS drafts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    module          TEXT NOT NULL CHECK(module IN ('project','amfe','cp','ho','pfd')),
    document_key    TEXT NOT NULL,
    data            TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(module, document_key)
);

CREATE INDEX IF NOT EXISTS idx_drafts_module ON drafts(module);
CREATE INDEX IF NOT EXISTS idx_drafts_updated ON drafts(updated_at DESC);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Recent projects
CREATE TABLE IF NOT EXISTS recent_projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    module          TEXT NOT NULL DEFAULT 'project',
    document_id     TEXT,
    name            TEXT NOT NULL,
    path            TEXT DEFAULT '',
    opened_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recent_opened ON recent_projects(opened_at DESC);
`;

// ============================================================================
// AMFE DOCUMENT BUILDER
// ============================================================================

function buildAmfeDocument(headerData, operations) {
    return {
        header: {
            ...headerData,
            // Ensure all header fields exist
            confidentiality: headerData.confidentiality || '',
            location: headerData.location || '',
            modelYear: headerData.modelYear || '',
            scope: headerData.scope || '',
        },
        operations,
    };
}

/** Count causes recursively */
function countCauses(operations) {
    let total = 0;
    let apH = 0;
    let apM = 0;
    for (const op of operations) {
        for (const we of (op.workElements || [])) {
            for (const func of (we.functions || [])) {
                for (const fail of (func.failures || [])) {
                    for (const cause of (fail.causes || [])) {
                        total++;
                        if (cause.ap === 'H') apH++;
                        if (cause.ap === 'M') apM++;
                    }
                }
            }
        }
    }
    return { total, apH, apM };
}

/** Calculate coverage: causes with at least one non-empty control / total causes */
function calcCoverage(operations) {
    let total = 0;
    let covered = 0;
    for (const op of operations) {
        for (const we of (op.workElements || [])) {
            for (const func of (we.functions || [])) {
                for (const fail of (func.failures || [])) {
                    for (const cause of (fail.causes || [])) {
                        total++;
                        if (
                            (cause.preventionControl && cause.preventionControl !== '-' && cause.preventionControl !== 'N/A') ||
                            (cause.detectionControl && cause.detectionControl !== '-' && cause.detectionControl !== 'N/A')
                        ) {
                            covered++;
                        }
                    }
                }
            }
        }
    }
    return total > 0 ? Math.round((covered / total) * 10000) / 100 : 0;
}

// ============================================================================
// CONTROL PLAN GENERATOR (pure JS port of controlPlanGenerator.ts)
// ============================================================================

/** Infer operation category from name (matches utils/processCategory.ts) */
function inferOperationCategory(name) {
    const n = (name || '').toLowerCase();
    if (/sold[au]/i.test(n)) return 'soldadura';
    if (/ensam[bp]l/i.test(n)) return 'ensamble';
    if (/pintu/i.test(n)) return 'pintura';
    if (/mecaniz/i.test(n)) return 'mecanizado';
    if (/inyecci[oó]n/i.test(n)) return 'inyeccion';
    if (/inspec/i.test(n)) return 'inspeccion';
    if (/troquel/i.test(n)) return 'troquelado';
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
    return '';
}

function normalizeForKey(s) {
    return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildProcessKey(opNumber, causeText, preventionControl) {
    return JSON.stringify([normalizeForKey(opNumber), normalizeForKey(causeText), normalizeForKey(preventionControl)]);
}

function buildProductKey(opNumber, failDesc, detectionControl) {
    return JSON.stringify([normalizeForKey(opNumber), normalizeForKey(failDesc), normalizeForKey(detectionControl)]);
}

function pickHighestAp(group) {
    if (group.some(g => g.cause.ap === 'H')) return 'H';
    if (group.some(g => g.cause.ap === 'M')) return 'M';
    return 'L';
}

function pickMostRestrictive(group) {
    let best = '';
    for (const g of group) {
        const sc = g.autoSpecialChar;
        if (sc === 'CC') return 'CC';
        if (sc === 'SC' && best !== 'CC') best = 'SC';
        else if (sc && !best) best = sc;
    }
    return best;
}

function pickCharacteristicNumber(group) {
    for (const g of group) {
        if (g.cause.characteristicNumber?.trim()) return g.cause.characteristicNumber;
    }
    return '';
}

/** Get CP defaults based on AP, severity, phase (matches controlPlanDefaults.ts) */
function getControlPlanDefaults(ap, severity, phase) {
    const autoFilledFields = [];
    let sampleSize = '';
    let sampleFrequency = '';

    if (ap === 'H') {
        sampleSize = '100%';
        sampleFrequency = 'Cada pieza';
        autoFilledFields.push('sampleSize', 'sampleFrequency');
    } else if (ap === 'M') {
        if (phase === 'prototype') {
            sampleSize = '100%';
            sampleFrequency = 'Cada pieza (Prototipo)';
        } else if (phase === 'preLaunch') {
            sampleSize = '100%';
            sampleFrequency = 'Cada pieza (Pre-Lanzamiento)';
        } else if (phase === 'safeLaunch') {
            sampleSize = '100%';
            sampleFrequency = 'Cada pieza (Safe Launch)';
        } else if (severity >= 9) {
            sampleSize = '5 piezas';
            sampleFrequency = 'Cada hora';
        } else {
            sampleSize = '5 piezas';
            sampleFrequency = 'Cada turno';
        }
        autoFilledFields.push('sampleSize', 'sampleFrequency');
    } else if (ap === 'L') {
        if (severity >= 9) {
            sampleSize = '3 piezas';
            sampleFrequency = 'Cada 2 horas';
        } else if (severity >= 5) {
            sampleSize = '1 pieza';
            sampleFrequency = 'Cada turno';
        }
        if (sampleSize) autoFilledFields.push('sampleSize', 'sampleFrequency');
    }

    let reactionPlan = '';
    if (severity >= 9) {
        reactionPlan = 'Detener linea. Escalar a Gerencia. Segregar producto.';
        autoFilledFields.push('reactionPlan');
    } else if (severity >= 7) {
        reactionPlan = 'Contener producto sospechoso. Verificar ultimas N piezas. Corregir proceso.';
        autoFilledFields.push('reactionPlan');
    } else if (severity >= 4) {
        reactionPlan = 'Ajustar proceso. Reinspeccionar ultimo lote.';
        autoFilledFields.push('reactionPlan');
    }

    return { sampleSize, sampleFrequency, reactionPlan, autoFilledFields };
}

/**
 * Generate Control Plan items from AMFE document.
 * Pure JS port of controlPlanGenerator.ts generateItemsFromAmfe()
 */
function generateControlPlan(amfeDoc, phase = 'production') {
    const items = [];
    let totalCauses = 0;

    // Phase 1: Collect qualifying causes
    const qualifying = [];
    for (const op of amfeDoc.operations) {
        for (const we of (op.workElements || [])) {
            for (const func of (we.functions || [])) {
                for (const fail of (func.failures || [])) {
                    for (const cause of (fail.causes || [])) {
                        totalCauses++;
                        const severity = Number(fail.severity) || 0;
                        const occurrence = Number(cause.occurrence) || 0;
                        // AIAG-VDA 2019: CC=S≥9, SC=S=5-8 AND O≥4
                        const autoSpecialChar = cause.specialChar
                            || (severity >= 9 ? 'CC' : (severity >= 5 && occurrence >= 4) ? 'SC' : '');

                        if (cause.ap !== 'H' && cause.ap !== 'M') {
                            if (cause.ap !== 'L' || !autoSpecialChar) continue;
                        }
                        qualifying.push({ op, we, func, fail, cause, severity, autoSpecialChar });
                    }
                }
            }
        }
    }

    // Phase 2: Group PROCESS rows
    const processGroups = new Map();
    for (const q of qualifying) {
        const key = buildProcessKey(q.op.opNumber, q.cause.cause, q.cause.preventionControl);
        const group = processGroups.get(key) || [];
        group.push(q);
        processGroups.set(key, group);
    }

    for (const [, group] of processGroups) {
        const rep = group[0];
        const highestSeverity = Math.max(...group.map(g => g.severity));
        const highestAp = pickHighestAp(group);
        const bestSpecialChar = pickMostRestrictive(group);
        const defaults = getControlPlanDefaults(highestAp, highestSeverity, phase);

        items.push({
            id: uuid(),
            processStepNumber: rep.op.opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: rep.we.name || '',
            characteristicNumber: pickCharacteristicNumber(group),
            productCharacteristic: '',
            processCharacteristic: rep.cause.cause || '',
            specialCharClass: bestSpecialChar,
            specification: '',
            evaluationTechnique: '',
            sampleSize: defaults.sampleSize,
            sampleFrequency: defaults.sampleFrequency,
            controlMethod: rep.cause.preventionControl || '',
            reactionPlan: defaults.reactionPlan,
            reactionPlanOwner: '',
            autoFilledFields: defaults.autoFilledFields,
            amfeAp: highestAp,
            amfeSeverity: highestSeverity,
            operationCategory: inferOperationCategory(rep.op.name) || '',
            amfeCauseIds: [...new Set(group.map(g => g.cause.id))],
            amfeFailureId: rep.fail.id,
            amfeFailureIds: [...new Set(group.map(g => g.fail.id))],
        });
    }

    // Phase 3: Group PRODUCT rows
    const productGroups = new Map();
    for (const q of qualifying) {
        const key = buildProductKey(q.op.opNumber, q.fail.description, q.cause.detectionControl);
        const group = productGroups.get(key) || [];
        group.push(q);
        productGroups.set(key, group);
    }

    for (const [, group] of productGroups) {
        const rep = group[0];
        const highestSeverity = Math.max(...group.map(g => g.severity));
        const highestAp = pickHighestAp(group);
        const bestSpecialChar = pickMostRestrictive(group);
        const defaults = getControlPlanDefaults(highestAp, highestSeverity, phase);

        items.push({
            id: uuid(),
            processStepNumber: rep.op.opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: rep.we.name || '',
            characteristicNumber: pickCharacteristicNumber(group),
            productCharacteristic: rep.fail.description || '',
            processCharacteristic: '',
            specialCharClass: bestSpecialChar,
            specification: '',
            evaluationTechnique: rep.cause.detectionControl || '',
            sampleSize: defaults.sampleSize,
            sampleFrequency: defaults.sampleFrequency,
            controlMethod: '',
            reactionPlan: defaults.reactionPlan,
            reactionPlanOwner: '',
            autoFilledFields: defaults.autoFilledFields,
            amfeAp: highestAp,
            amfeSeverity: highestSeverity,
            operationCategory: inferOperationCategory(rep.op.name) || '',
            amfeCauseIds: [...new Set(group.map(g => g.cause.id))],
            amfeFailureId: rep.fail.id,
            amfeFailureIds: [...new Set(group.map(g => g.fail.id))],
        });
    }

    // Phase 4: Sort
    items.sort((a, b) => {
        const numA = parseInt(a.processStepNumber) || 0;
        const numB = parseInt(b.processStepNumber) || 0;
        if (numA !== numB) return numA - numB;
        const typeA = a.processCharacteristic ? 0 : 1;
        const typeB = b.processCharacteristic ? 0 : 1;
        return typeA - typeB;
    });

    return { items, totalCauses, qualifyingCount: qualifying.length };
}

/** Build CP header from AMFE header */
function buildCpHeader(amfeHeader, amfeProjectName) {
    return {
        controlPlanNumber: '',
        phase: 'production',
        partNumber: amfeHeader.partNumber || '',
        latestChangeLevel: amfeHeader.revision || '',
        partName: amfeHeader.subject || '',
        applicableParts: amfeHeader.applicableParts || '',
        organization: amfeHeader.organization || '',
        supplier: '',
        supplierCode: '',
        keyContactPhone: '',
        date: new Date().toISOString().split('T')[0],
        revision: 'PRELIMINAR',
        responsible: amfeHeader.processResponsible || amfeHeader.responsible || '',
        approvedBy: amfeHeader.approvedBy || '',
        client: amfeHeader.client || '',
        coreTeam: amfeHeader.team || '',
        customerEngApproval: '',
        customerQualityApproval: '',
        otherApproval: '',
        linkedAmfeProject: amfeProjectName,
    };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SEED: AMFE INSERTO + Control Plan - PATAGONIA (VW)');
    console.log('═══════════════════════════════════════════════════════════════');

    // ─── Merge all operations ────────────────────────────────────────────────
    const allOperations = [...ops10to50, ...ops60to92, ...ops100to120];
    console.log(`\n✓ Operations loaded: ${allOperations.length}`);
    for (const op of allOperations) {
        const causeCount = (op.workElements || []).reduce((sum, we) =>
            sum + (we.functions || []).reduce((s2, f) =>
                s2 + (f.failures || []).reduce((s3, fail) =>
                    s3 + (fail.causes || []).length, 0), 0), 0);
        console.log(`  Op ${op.opNumber.padStart(3)}: ${op.name.substring(0, 60).padEnd(60)} [${causeCount} causes]`);
    }

    // ─── Build AMFE Document ─────────────────────────────────────────────────
    const amfeDoc = buildAmfeDocument(header, allOperations);
    const { total: causeCount, apH, apM } = countCauses(allOperations);
    const coverage = calcCoverage(allOperations);
    const amfeId = uuid();
    const amfeProjectName = 'PATAGONIA - INSERTO';

    console.log(`\n✓ AMFE Document built:`);
    console.log(`  ID:         ${amfeId}`);
    console.log(`  Number:     ${header.amfeNumber}`);
    console.log(`  Project:    ${amfeProjectName}`);
    console.log(`  Operations: ${allOperations.length}`);
    console.log(`  Causes:     ${causeCount} (AP-H: ${apH}, AP-M: ${apM})`);
    console.log(`  Coverage:   ${coverage}%`);

    // ─── Generate Control Plan ───────────────────────────────────────────────
    const cpHeader = buildCpHeader(header, amfeProjectName);
    const { items: cpItems, qualifyingCount } = generateControlPlan(amfeDoc, cpHeader.phase);
    const cpId = uuid();
    const cpDoc = { header: cpHeader, items: cpItems };

    const processRows = cpItems.filter(i => !!i.processCharacteristic).length;
    const productRows = cpItems.filter(i => !!i.productCharacteristic && !i.processCharacteristic).length;
    const opCount = new Set(cpItems.map(i => i.processStepNumber)).size;

    console.log(`\n✓ Control Plan generated:`);
    console.log(`  ID:            ${cpId}`);
    console.log(`  Items:         ${cpItems.length} (${processRows} process + ${productRows} product)`);
    console.log(`  Operations:    ${opCount}`);
    console.log(`  From causes:   ${qualifyingCount} qualifying (AP-H/M + SC/CC)`);

    // ─── Create SQLite database ──────────────────────────────────────────────
    console.log(`\n─── Creating SQLite database ───`);

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Run schema DDL (split by semicolons, skip empty)
    const statements = SCHEMA_DDL.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
        db.run(stmt + ';');
    }
    console.log(`  ✓ Schema created (${statements.length} statements)`);

    // Insert schema version
    db.run(
        `INSERT OR REPLACE INTO schema_version (version, description) VALUES (?, ?)`,
        [SCHEMA_VERSION, 'Initial schema + project_name on cp_documents']
    );

    // ─── Insert AMFE document ────────────────────────────────────────────────
    const amfeDataJson = JSON.stringify(amfeDoc);
    const amfeChecksum = sha256(amfeDataJson);

    db.run(`INSERT INTO amfe_documents (
        id, amfe_number, project_name, subject, client, part_number,
        responsible, organization, status,
        operation_count, cause_count, ap_h_count, ap_m_count, coverage_percent,
        start_date, last_revision_date,
        data, checksum
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        amfeId,
        header.amfeNumber,
        amfeProjectName,
        header.subject,
        header.client,
        header.partNumber,
        header.responsible,
        header.organization,
        'draft',
        allOperations.length,
        causeCount,
        apH,
        apM,
        coverage,
        header.startDate,
        header.revDate,
        amfeDataJson,
        amfeChecksum,
    ]);
    console.log(`  ✓ AMFE inserted: ${header.amfeNumber}`);

    // ─── Insert Control Plan document ────────────────────────────────────────
    const cpDataJson = JSON.stringify(cpDoc);
    const cpChecksum = sha256(cpDataJson);

    db.run(`INSERT INTO cp_documents (
        id, project_name, control_plan_number, phase,
        part_number, part_name, organization, client,
        responsible, revision,
        linked_amfe_project, linked_amfe_id,
        item_count, data, checksum
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        cpId,
        amfeProjectName,
        'CP-INSERTO-001',
        cpHeader.phase,
        cpHeader.partNumber,
        cpHeader.partName,
        cpHeader.organization,
        cpHeader.client,
        cpHeader.responsible,
        'PRELIMINAR',
        amfeProjectName,
        amfeId,
        cpItems.length,
        cpDataJson,
        cpChecksum,
    ]);
    console.log(`  ✓ Control Plan inserted: CP-INSERTO-001 (${cpItems.length} items)`);

    // ─── Insert recent project entry ─────────────────────────────────────────
    db.run(`INSERT INTO recent_projects (module, document_id, name) VALUES (?, ?, ?)`, [
        'amfe', amfeId, amfeProjectName,
    ]);
    db.run(`INSERT INTO recent_projects (module, document_id, name) VALUES (?, ?, ?)`, [
        'cp', cpId, amfeProjectName,
    ]);

    // ─── Write database file ─────────────────────────────────────────────────
    const dbDir = dirname(DB_PATH);
    if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
    }

    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
    db.close();

    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log(`\n✓ Database written: ${DB_PATH}`);
    console.log(`  Size: ${sizeMB} MB`);

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  SEED COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  AMFE:          ${header.amfeNumber} - ${amfeProjectName}`);
    console.log(`    Operations:  ${allOperations.length}`);
    console.log(`    Causes:      ${causeCount} (H:${apH} M:${apM})`);
    console.log(`    Coverage:    ${coverage}%`);
    console.log(`    Status:      PRELIMINAR (draft)`);
    console.log(`  Control Plan:  CP-INSERTO-001`);
    console.log(`    Items:       ${cpItems.length} (${processRows}P + ${productRows}D)`);
    console.log(`    Phase:       production`);
    console.log(`    Revision:    PRELIMINAR`);
    console.log(`  Database:      ${DB_PATH}`);
    console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
    console.error('\n✗ SEED FAILED:', err);
    process.exit(1);
});
