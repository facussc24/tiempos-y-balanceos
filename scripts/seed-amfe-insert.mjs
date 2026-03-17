#!/usr/bin/env node
/**
 * VERIFICACIÓN / SEED del AMFE INSERTO PATAGONIA (VW)
 *
 * Este script verifica que el AMFE Inserto Patagonia esté presente en la DB.
 * Si no existe, lo crea usando los datos ya parseados de los módulos existentes.
 * Si ya existe, reporta estadísticas.
 *
 * Fuente: AMFE_INSERT_Rev.txt (3138 líneas, ya parseado en seed-amfe-inserto.mjs)
 *
 * Usage: node scripts/seed-amfe-insert.mjs
 */

import initSqlJs from 'sql.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// ─── Config ─────────────────────────────────────────────────────────────────

const DB_PATH = join(
    process.env.APPDATA || join(process.env.USERPROFILE || 'C:\\Users\\FacundoS-PC', 'AppData', 'Roaming'),
    'com.barackmercosul.app',
    'barack_mercosul.db'
);

const PROJECT_NAME = 'VWA/PATAGONIA/INSERTO';

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('══════════════════════════════════════════════════════════');
    console.log('  VERIFICACIÓN AMFE INSERTO PATAGONIA (VW)');
    console.log('══════════════════════════════════════════════════════════');

    if (!existsSync(DB_PATH)) {
        console.error(`❌ Base de datos no encontrada: ${DB_PATH}`);
        console.log('   Ejecutar primero: node scripts/run-seed-complete-inserto.mjs');
        process.exit(1);
    }

    const SQL = await initSqlJs();
    const buffer = readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    // Query AMFE documents
    const rows = db.exec(`
        SELECT id, amfe_number, project_name, status, subject, client, part_number,
               operation_count, cause_count, ap_h_count, ap_m_count, coverage_percent,
               start_date, last_revision_date, created_at, updated_at
        FROM amfe_documents
        WHERE project_name LIKE '%INSERTO%' OR project_name LIKE '%PATAGONIA%'
        ORDER BY updated_at DESC
    `);

    if (!rows.length || !rows[0].values.length) {
        console.log('\n⚠️  AMFE Inserto Patagonia NO encontrado en la DB.');
        console.log('   Ejecutar: node scripts/run-seed-complete-inserto.mjs');
        db.close();
        process.exit(1);
    }

    const cols = rows[0].columns;
    for (const row of rows[0].values) {
        const doc = {};
        cols.forEach((c, i) => doc[c] = row[i]);

        console.log('\n✅ AMFE encontrado en la DB:');
        console.log(`   ID:              ${doc.id}`);
        console.log(`   AMFE Number:     ${doc.amfe_number}`);
        console.log(`   Proyecto:        ${doc.project_name}`);
        console.log(`   Estado:          ${doc.status}`);
        console.log(`   Cliente:         ${doc.client}`);
        console.log(`   Part Number:     ${doc.part_number}`);
        console.log(`   Operaciones:     ${doc.operation_count}`);
        console.log(`   Causas totales:  ${doc.cause_count}`);
        console.log(`   AP High:         ${doc.ap_h_count}`);
        console.log(`   AP Medium:       ${doc.ap_m_count}`);
        console.log(`   Cobertura:       ${doc.coverage_percent}%`);
        console.log(`   Fecha inicio:    ${doc.start_date}`);
        console.log(`   Última revisión: ${doc.last_revision_date}`);
        console.log(`   Creado:          ${doc.created_at}`);
        console.log(`   Actualizado:     ${doc.updated_at}`);
    }

    // Load full JSON data to verify operations
    const dataRows = db.exec(`
        SELECT data FROM amfe_documents
        WHERE project_name LIKE '%INSERTO%' OR project_name LIKE '%PATAGONIA%'
        LIMIT 1
    `);

    if (dataRows.length && dataRows[0].values.length) {
        const amfeDoc = JSON.parse(dataRows[0].values[0][0]);
        const ops = amfeDoc.operations || [];

        console.log('\n── Operaciones en el AMFE ──────────────────────────────');
        let totalFailures = 0, totalCauses = 0;
        for (const op of ops) {
            let opFailures = 0, opCauses = 0;
            for (const we of (op.workElements || []))
                for (const func of (we.functions || []))
                    for (const fail of (func.failures || [])) {
                        opFailures++;
                        opCauses += (fail.causes || []).length;
                    }
            totalFailures += opFailures;
            totalCauses += opCauses;
            console.log(`   OP ${String(op.opNumber).padStart(3)} │ ${op.name.substring(0, 50).padEnd(50)} │ ${opFailures} fallas, ${opCauses} causas`);
        }

        console.log('───────────────────────────────────────────────────────');
        console.log(`   TOTAL: ${ops.length} operaciones, ${totalFailures} modos de falla, ${totalCauses} causas`);

        // Verify against TXT source
        const expectedOps = [10, 15, 20, 25, 30, 40, 50, 60, 61, 70, 71, 80, 81, 90, 91, 92, 100, 103, 105, 110, 111, 120];
        const actualOps = ops.map(o => Number(o.opNumber)).sort((a, b) => a - b);
        const missing = expectedOps.filter(n => !actualOps.includes(n));

        if (missing.length === 0) {
            console.log('\n✅ Todas las operaciones esperadas están presentes.');
        } else {
            console.log(`\n⚠️  Operaciones faltantes: ${missing.join(', ')}`);
        }
    }

    // Check for linked CP and HO
    const cpRows = db.exec(`SELECT id, control_plan_number FROM cp_documents WHERE linked_amfe_project LIKE '%INSERTO%' OR linked_amfe_project LIKE '%PATAGONIA%'`);
    const hoRows = db.exec(`SELECT id FROM ho_documents WHERE linked_amfe_project LIKE '%INSERTO%' OR linked_amfe_project LIKE '%PATAGONIA%'`);

    console.log(`\n── Documentos vinculados ───────────────────────────────`);
    console.log(`   Plan de Control: ${cpRows.length && cpRows[0].values.length ? '✅ Presente' : '❌ No encontrado'}`);
    console.log(`   Hoja de Operaciones: ${hoRows.length && hoRows[0].values.length ? '✅ Presente' : '❌ No encontrado'}`);

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  Verificación completada.');
    console.log('══════════════════════════════════════════════════════════\n');

    db.close();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
