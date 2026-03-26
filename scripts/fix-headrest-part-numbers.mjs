#!/usr/bin/env node
/**
 * fix-headrest-part-numbers.mjs
 *
 * Replace XXX placeholder part numbers in all headrest documents
 * (AMFE, CP, HO, PFD) with the real VW part numbers.
 *
 * 9 mappings: 3 positions x 3 levels (L1, L2, L3)
 *
 * Usage: node scripts/fix-headrest-part-numbers.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ─── Part Number Mapping ────────────────────────────────────────────────────

const MAPPINGS = [
    { suffix: 'HEADREST_FRONT',     level: 'L1', partNumber: '2HC881901A GFV' },
    { suffix: 'HEADREST_FRONT',     level: 'L2', partNumber: '2HC881901B GEV' },
    { suffix: 'HEADREST_FRONT',     level: 'L3', partNumber: '2HC881901C EFG' },
    { suffix: 'HEADREST_REAR_CEN',  level: 'L1', partNumber: '2HC885900A EIF' },
    { suffix: 'HEADREST_REAR_CEN',  level: 'L2', partNumber: '2HC885900B SIY' },
    { suffix: 'HEADREST_REAR_CEN',  level: 'L3', partNumber: '2HC885900C SIY' },
    { suffix: 'HEADREST_REAR_OUT',  level: 'L1', partNumber: '2HC885901A GFU' },
    { suffix: 'HEADREST_REAR_OUT',  level: 'L2', partNumber: '2HC885901B GEQ' },
    { suffix: 'HEADREST_REAR_OUT',  level: 'L3', partNumber: '2HC885901C DZS' },
];

// Position descriptions for subject/partName/partDescription
const POSITION_DESCRIPTIONS = {
    HEADREST_FRONT:    'PATAGONIA - FRONT HEADREST, Passenger / Driver',
    HEADREST_REAR_CEN: 'PATAGONIA - REAR HEADREST, CENTER',
    HEADREST_REAR_OUT: 'PATAGONIA - REAR HEADREST, OUTER',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseData(doc) {
    return typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
}

function computeChecksum(data) {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function buildDescription(suffix, level, partNumber) {
    const desc = POSITION_DESCRIPTIONS[suffix];
    return `${desc}, ${level} (${partNumber})`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n============================================================');
    console.log('  FIX HEADREST PART NUMBERS');
    console.log('  Replace XXX placeholders with real VW part numbers');
    console.log('============================================================');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: AUDIT — Find all XXX occurrences
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n─── PHASE 1: AUDIT ─────────────────────────────────────────');

    const TABLES = ['amfe_documents', 'cp_documents', 'ho_documents', 'pfd_documents'];

    for (const table of TABLES) {
        // Check part_number column
        const byCol = await selectSql(
            `SELECT id, project_name, part_number FROM ${table} WHERE part_number LIKE '%XXX%'`
        );
        // Check inside data JSONB
        const byData = await selectSql(
            `SELECT id, project_name FROM ${table} WHERE CAST(data AS text) LIKE '%XXX%'`
        );

        const colNames = byCol.map(r => r.project_name);
        const dataNames = byData.map(r => r.project_name);
        const allNames = [...new Set([...colNames, ...dataNames])];

        console.log(`\n  ${table}:`);
        console.log(`    part_number col: ${byCol.length} rows with XXX`);
        console.log(`    data JSONB:      ${byData.length} rows with XXX`);
        if (allNames.length > 0) {
            console.log(`    projects:        ${allNames.join(', ')}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: FIX — Update each mapping
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n\n─── PHASE 2: FIX ───────────────────────────────────────────');

    let totalFixed = 0;

    for (const { suffix, level, partNumber } of MAPPINGS) {
        const projectName = `VWA/PATAGONIA/${suffix} [${level}]`;
        const description = buildDescription(suffix, level, partNumber);

        console.log(`\n  === ${projectName} ===`);
        console.log(`      Part#: ${partNumber}`);
        console.log(`      Desc:  ${description}`);

        // ─── AMFE ────────────────────────────────────────────────────────
        {
            const docs = await selectSql(
                `SELECT id, data FROM amfe_documents WHERE project_name = ?`, [projectName]
            );
            if (docs.length === 0) {
                console.log('      AMFE: not found');
            } else {
                for (const doc of docs) {
                    const data = parseData(doc);
                    data.header.partNumber = partNumber;
                    data.header.applicableParts = partNumber;
                    data.header.subject = description;
                    const checksum = computeChecksum(data);
                    const jsonStr = JSON.stringify(data).replace(/'/g, "''");
                    await execSql(
                        `UPDATE amfe_documents SET data = '${jsonStr}', checksum = '${checksum}', part_number = '${partNumber}', subject = '${description.replace(/'/g, "''")}', updated_at = NOW() WHERE id = '${doc.id}'`
                    );
                    console.log(`      AMFE: FIXED (id=${doc.id.slice(0,8)}...)`);
                    totalFixed++;
                }
            }
        }

        // ─── CP ──────────────────────────────────────────────────────────
        {
            const docs = await selectSql(
                `SELECT id, data FROM cp_documents WHERE project_name = ?`, [projectName]
            );
            if (docs.length === 0) {
                console.log('      CP:   not found');
            } else {
                for (const doc of docs) {
                    const data = parseData(doc);
                    data.header.partNumber = partNumber;
                    data.header.applicableParts = partNumber;
                    data.header.partName = description;
                    const checksum = computeChecksum(data);
                    const jsonStr = JSON.stringify(data).replace(/'/g, "''");
                    await execSql(
                        `UPDATE cp_documents SET data = '${jsonStr}', checksum = '${checksum}', part_number = '${partNumber}', part_name = '${description.replace(/'/g, "''")}', updated_at = NOW() WHERE id = '${doc.id}'`
                    );
                    console.log(`      CP:   FIXED (id=${doc.id.slice(0,8)}...)`);
                    totalFixed++;
                }
            }
        }

        // ─── HO ──────────────────────────────────────────────────────────
        {
            const docs = await selectSql(
                `SELECT id, data FROM ho_documents WHERE linked_amfe_project = ?`, [projectName]
            );
            if (docs.length === 0) {
                console.log('      HO:   not found');
            } else {
                for (const doc of docs) {
                    const data = parseData(doc);
                    data.header.partNumber = partNumber;
                    data.header.applicableParts = partNumber;
                    data.header.partDescription = description;
                    const checksum = computeChecksum(data);
                    const jsonStr = JSON.stringify(data).replace(/'/g, "''");
                    await execSql(
                        `UPDATE ho_documents SET data = '${jsonStr}', checksum = '${checksum}', part_number = '${partNumber}', part_description = '${description.replace(/'/g, "''")}', updated_at = NOW() WHERE id = '${doc.id}'`
                    );
                    console.log(`      HO:   FIXED (id=${doc.id.slice(0,8)}...)`);
                    totalFixed++;
                }
            }
        }

        // ─── PFD (audit only — variants don't have PFD) ─────────────────
        {
            const docs = await selectSql(
                `SELECT id, data FROM pfd_documents WHERE project_name = ?`, [projectName]
            );
            if (docs.length === 0) {
                console.log('      PFD:  not found (expected — variants have no PFD)');
            } else {
                for (const doc of docs) {
                    const data = parseData(doc);
                    data.header.partNumber = partNumber;
                    data.header.partName = description;
                    const checksum = computeChecksum(data);
                    const jsonStr = JSON.stringify(data).replace(/'/g, "''");
                    await execSql(
                        `UPDATE pfd_documents SET data = '${jsonStr}', checksum = '${checksum}', part_number = '${partNumber}', updated_at = NOW() WHERE id = '${doc.id}'`
                    );
                    console.log(`      PFD:  FIXED (id=${doc.id.slice(0,8)}...)`);
                    totalFixed++;
                }
            }
        }
    }

    console.log(`\n  Total documents fixed: ${totalFixed}`);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: VERIFY — Confirm no XXX remains
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n\n─── PHASE 3: VERIFY ────────────────────────────────────────');

    let remainingXXX = 0;
    for (const table of TABLES) {
        const byCol = await selectSql(
            `SELECT id, project_name FROM ${table} WHERE part_number LIKE '%XXX%'`
        );
        const byData = await selectSql(
            `SELECT id, project_name FROM ${table} WHERE CAST(data AS text) LIKE '%XXX%'`
        );
        const total = new Set([...byCol.map(r => r.id), ...byData.map(r => r.id)]).size;
        remainingXXX += total;
        if (total > 0) {
            console.log(`  WARNING: ${table} still has ${total} docs with XXX!`);
        }
    }

    if (remainingXXX === 0) {
        console.log('  OK: No XXX found in any table.');
    }

    // Print final state for all headrest docs
    console.log('\n  Final headrest part numbers:');
    for (const table of TABLES) {
        const rows = await selectSql(
            `SELECT project_name, part_number FROM ${table} WHERE project_name LIKE '%HEADREST%' ORDER BY project_name`
        );
        if (rows.length > 0) {
            console.log(`\n  ${table}:`);
            for (const r of rows) {
                console.log(`    ${r.project_name} → ${r.part_number}`);
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
