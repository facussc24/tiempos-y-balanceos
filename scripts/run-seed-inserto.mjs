#!/usr/bin/env node
/**
 * Run Seed: Insert AMFE INSERTO into production SQLite database
 *
 * Usage: node scripts/run-seed-inserto.mjs
 *
 * Reads the seed data from the 3 seed modules and inserts a complete
 * AmfeDocument into the barack_mercosul.db at AppData/Roaming.
 */

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash, randomUUID } from 'crypto';

import { header, allOperations as ops1 } from './seed-amfe-inserto.mjs';
import { ops60to92 } from './seed-ops-60-92.mjs';
import { ops100to120 } from './seed-ops-100-120.mjs';

// ─── Config ──────────────────────────────────────────────────────────────────

// The REAL database location — the app resolves to this path
const DB_PATH = join(
    process.env.APPDATA || join(process.env.USERPROFILE || 'C:\\Users\\FacundoS-PC', 'AppData', 'Roaming'),
    'com.barackmercosul.app',
    'barack_mercosul.db'
);
const PROJECT_NAME = 'VWA/PATAGONIA/INSERTO';
const AMFE_NUMBER = 'AMFE-00001';
const DOC_ID = randomUUID();

// ─── Build AmfeDocument ──────────────────────────────────────────────────────

const allOperations = [...ops1, ...ops60to92, ...ops100to120];

const amfeDoc = {
    header,
    operations: allOperations,
};

// ─── Insert into SQLite ──────────────────────────────────────────────────────

async function main() {
    console.log(`DB path: ${DB_PATH}`);

    const SQL = await initSqlJs();

    // Read existing DB
    let dbBuffer;
    try {
        dbBuffer = readFileSync(DB_PATH);
        console.log(`Loaded existing DB (${dbBuffer.length} bytes)`);
    } catch {
        console.error('ERROR: Database file not found at', DB_PATH);
        process.exit(1);
    }

    const db = new SQL.Database(dbBuffer);

    // Ensure tables exist (same DDL as database.ts)
    db.run(`
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
        )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_amfe_status ON amfe_documents(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_amfe_client ON amfe_documents(client)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_amfe_updated ON amfe_documents(updated_at DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_amfe_number ON amfe_documents(amfe_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_amfe_project_name ON amfe_documents(project_name)`);
    console.log('Schema ensured.');

    // Count operations and causes for metadata
    let causeCount = 0;
    let apH = 0;
    let apM = 0;
    for (const op of allOperations) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fail of fn.failures || []) {
                    for (const c of fail.causes || []) {
                        causeCount++;
                        if (c.ap === 'H') apH++;
                        if (c.ap === 'M') apM++;
                    }
                }
            }
        }
    }

    const data = JSON.stringify(amfeDoc);
    const checksum = createHash('sha256').update(data).digest('hex');
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    console.log(`Document ID: ${DOC_ID}`);
    console.log(`Project: ${PROJECT_NAME}`);
    console.log(`Operations: ${allOperations.length}`);
    console.log(`Causes: ${causeCount} (H=${apH}, M=${apM})`);
    console.log(`Data size: ${(data.length / 1024).toFixed(1)} KB`);

    // Check if already exists
    const existing = db.exec(
        `SELECT id FROM amfe_documents WHERE project_name = '${PROJECT_NAME}'`
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
        console.log('Document already exists, updating...');
        db.run(
            `UPDATE amfe_documents SET data = ?, checksum = ?, updated_at = datetime('now'),
             operation_count = ?, cause_count = ?, ap_h_count = ?, ap_m_count = ?
             WHERE project_name = ?`,
            [data, checksum, allOperations.length, causeCount, apH, apM, PROJECT_NAME]
        );
    } else {
        console.log('Inserting new document...');
        db.run(
            `INSERT INTO amfe_documents
             (id, amfe_number, project_name, client, subject, part_number, responsible,
              status, operation_count, cause_count, ap_h_count, ap_m_count,
              coverage_percent, start_date, last_revision_date,
              created_at, updated_at, data, checksum)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     datetime('now'), datetime('now'), ?, ?)`,
            [
                DOC_ID, AMFE_NUMBER, PROJECT_NAME,
                header.client, header.subject, header.partNumber, header.responsible,
                'draft', allOperations.length, causeCount, apH, apM,
                0, header.startDate, header.revDate,
                data, checksum,
            ]
        );
    }

    // Save back to disk
    const output = db.export();
    const buffer = Buffer.from(output);
    writeFileSync(DB_PATH, buffer);
    console.log(`\nSaved DB (${buffer.length} bytes) to ${DB_PATH}`);

    // Verify
    const verify = db.exec('SELECT id, project_name, operation_count, cause_count FROM amfe_documents');
    console.log('\nDocuments in DB:');
    for (const row of verify[0]?.values || []) {
        console.log(`  ${row[1]} — ${row[2]} ops, ${row[3]} causes`);
    }

    db.close();
    console.log('\n✅ AMFE INSERTO seeded successfully!');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
