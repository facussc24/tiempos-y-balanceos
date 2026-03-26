#!/usr/bin/env node
/**
 * consolidate-A-fix-master-xxx.mjs
 *
 * Fix XXX placeholder part numbers in the 3 headrest MASTER CP and HO documents.
 * The AMFE masters were already fixed previously (they use descriptive text like
 * "Apoyacabezas Delantero..." as partNumber).
 *
 * Targets:
 *   - CP docs by project_name  (VWA/PATAGONIA/HEADREST_FRONT, etc.)
 *   - HO docs by linked_amfe_project (same project_name)
 *
 * Usage: node scripts/consolidate-A-fix-master-xxx.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ─── Master Part Number Mapping ─────────────────────────────────────────────

const MASTERS = [
    {
        position: 'FRONT',
        projectName: 'VWA/PATAGONIA/HEADREST_FRONT',
        partNumber: '2HC881901 RL1',
        description: 'Apoyacabezas Delantero Con Costura Vista - Patagonia',
    },
    {
        position: 'REAR_CEN',
        projectName: 'VWA/PATAGONIA/HEADREST_REAR_CEN',
        partNumber: '2HC885900 RL1',
        description: 'Apoyacabezas Trasero Central Con Costura Vista - Patagonia',
    },
    {
        position: 'REAR_OUT',
        projectName: 'VWA/PATAGONIA/HEADREST_REAR_OUT',
        partNumber: '2HC885901 RL1',
        description: 'Apoyacabezas Trasero Lateral Con Costura Vista - Patagonia',
    },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseData(doc) {
    return typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
}

function computeChecksum(data) {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n============================================================');
    console.log('  FIX MASTER HEADREST XXX PART NUMBERS (CP + HO)');
    console.log('============================================================');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: AUDIT — Find all XXX occurrences across all 4 tables
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n--- PHASE 1: AUDIT -----------------------------------------');

    const TABLES = ['amfe_documents', 'cp_documents', 'ho_documents', 'pfd_documents'];

    for (const table of TABLES) {
        const byCol = await selectSql(
            `SELECT id, project_name, part_number FROM ${table} WHERE part_number LIKE '%XXX%'`
        );
        const byData = await selectSql(
            `SELECT id, project_name FROM ${table} WHERE CAST(data AS text) LIKE '%XXX%'`
        );

        const colNames = byCol.map(r => `${r.project_name} (part_number=${r.part_number})`);
        const dataNames = byData.map(r => r.project_name);

        console.log(`\n  ${table}:`);
        console.log(`    part_number col: ${byCol.length} rows with XXX`);
        if (byCol.length > 0) {
            for (const name of colNames) console.log(`      - ${name}`);
        }
        console.log(`    data JSONB:      ${byData.length} rows with XXX`);
        if (byData.length > 0) {
            for (const name of dataNames) console.log(`      - ${name}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: FIX — Update master CP and HO documents
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n\n--- PHASE 2: FIX -------------------------------------------');

    let totalFixed = 0;

    for (const { position, projectName, partNumber, description } of MASTERS) {
        console.log(`\n  === ${position}: ${projectName} ===`);
        console.log(`      Part#: ${partNumber}`);
        console.log(`      Desc:  ${description}`);

        // ─── CP (by project_name) ────────────────────────────────────────
        {
            const docs = await selectSql(
                `SELECT id, data FROM cp_documents WHERE project_name = ?`, [projectName]
            );
            if (docs.length === 0) {
                console.log('      CP:   not found');
            } else {
                for (const doc of docs) {
                    const data = parseData(doc);
                    const oldPN = data.header?.partNumber || '(empty)';
                    data.header.partNumber = partNumber;
                    data.header.applicableParts = partNumber;
                    data.header.partName = description;
                    const checksum = computeChecksum(data);
                    const jsonStr = JSON.stringify(data).replace(/'/g, "''");
                    await execSql(
                        `UPDATE cp_documents SET data = '${jsonStr}', checksum = '${checksum}', part_number = '${partNumber}', part_name = '${description.replace(/'/g, "''")}', updated_at = NOW() WHERE id = '${doc.id}'`
                    );
                    console.log(`      CP:   FIXED (id=${doc.id.slice(0, 8)}...) [was: ${oldPN}]`);
                    totalFixed++;
                }
            }
        }

        // ─── HO (by linked_amfe_project) ─────────────────────────────────
        {
            const docs = await selectSql(
                `SELECT id, data FROM ho_documents WHERE linked_amfe_project = ?`, [projectName]
            );
            if (docs.length === 0) {
                console.log('      HO:   not found');
            } else {
                for (const doc of docs) {
                    const data = parseData(doc);
                    const oldPN = data.header?.partNumber || '(empty)';
                    data.header.partNumber = partNumber;
                    data.header.applicableParts = partNumber;
                    data.header.partDescription = description;
                    const checksum = computeChecksum(data);
                    const jsonStr = JSON.stringify(data).replace(/'/g, "''");
                    await execSql(
                        `UPDATE ho_documents SET data = '${jsonStr}', checksum = '${checksum}', part_number = '${partNumber}', part_description = '${description.replace(/'/g, "''")}', updated_at = NOW() WHERE id = '${doc.id}'`
                    );
                    console.log(`      HO:   FIXED (id=${doc.id.slice(0, 8)}...) [was: ${oldPN}]`);
                    totalFixed++;
                }
            }
        }
    }

    console.log(`\n  Total documents fixed: ${totalFixed}`);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: VERIFY — Confirm no XXX remains in any table
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n\n--- PHASE 3: VERIFY ----------------------------------------');

    let remainingXXX = 0;
    for (const table of TABLES) {
        const byCol = await selectSql(
            `SELECT id, project_name, part_number FROM ${table} WHERE part_number LIKE '%XXX%'`
        );
        const byData = await selectSql(
            `SELECT id, project_name FROM ${table} WHERE CAST(data AS text) LIKE '%XXX%'`
        );
        const total = new Set([...byCol.map(r => r.id), ...byData.map(r => r.id)]).size;
        remainingXXX += total;
        if (total > 0) {
            console.log(`  WARNING: ${table} still has ${total} docs with XXX:`);
            for (const r of byCol) console.log(`    - ${r.project_name} (col: ${r.part_number})`);
            for (const r of byData) console.log(`    - ${r.project_name} (data JSONB)`);
        }
    }

    if (remainingXXX === 0) {
        console.log('  OK: No XXX found in any table.');
    } else {
        console.log(`\n  TOTAL REMAINING: ${remainingXXX} docs still have XXX.`);
    }

    // Print final state for all headrest master docs
    console.log('\n  Final headrest MASTER part numbers:');
    for (const table of ['cp_documents', 'ho_documents']) {
        const rows = await selectSql(
            `SELECT project_name, part_number, part_name, part_description FROM ${table} WHERE project_name LIKE '%HEADREST%' AND project_name NOT LIKE '%[%' ORDER BY project_name`
        );
        if (rows.length > 0) {
            console.log(`\n  ${table}:`);
            for (const r of rows) {
                const desc = r.part_name || r.part_description || '';
                console.log(`    ${r.project_name} -> ${r.part_number} | ${desc}`);
            }
        }
    }

    console.log('\n============================================================');
    console.log('  DONE');
    console.log('============================================================\n');

    close();
}

main().catch((err) => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
