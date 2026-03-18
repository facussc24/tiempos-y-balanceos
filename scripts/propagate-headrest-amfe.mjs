#!/usr/bin/env node
/**
 * PROPAGATE: Master AMFE data → Headrest variants (L1/L2/L3)
 *
 * The 3 headrest masters were updated with real AMFE data (60/55/55 causes)
 * but their variants still have old stub data (2 causes each).
 *
 * This script:
 * 1. Reads each master AMFE document from Supabase
 * 2. For each variant (L1/L2/L3), clones the master content with new UUIDs
 * 3. Preserves the variant's own identity (amfeNumber, subject, project_name)
 * 4. Updates the variant in Supabase with the new content + stats
 * 5. Clears any stale overrides for the variant in family_document_overrides
 *
 * Usage: node scripts/propagate-headrest-amfe.mjs
 */

import { randomUUID, createHash } from 'crypto';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

// ─── Helpers ────────────────────────────────────────────────────────────────

const uuid = () => randomUUID();
const sha256 = (str) => createHash('sha256').update(str).digest('hex');
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Recursively walk an object and replace every field named 'id' whose value
 * matches UUID v4 with a fresh UUID. Returns cloned object.
 */
function regenerateUuids(obj) {
    const idMap = new Map();
    function walk(value, key) {
        if (value === null || value === undefined) return value;
        if (Array.isArray(value)) return value.map(item => walk(item));
        if (typeof value === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(value)) {
                out[k] = walk(v, k);
            }
            return out;
        }
        if (typeof value === 'string' && key === 'id' && UUID_REGEX.test(value)) {
            if (!idMap.has(value)) idMap.set(value, uuid());
            return idMap.get(value);
        }
        return value;
    }
    return { result: walk(obj), idMap };
}

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
    let filled = 0, total = 0;
    for (const op of operations)
        for (const we of (op.workElements || []))
            for (const func of (we.functions || []))
                for (const fail of (func.failures || []))
                    for (const cause of (fail.causes || [])) {
                        total++;
                        if (fail.severity && cause.occurrence && cause.detection) filled++;
                    }
    return total > 0 ? Math.round((filled / total) * 100) : 0;
}

// ─── Master configurations ──────────────────────────────────────────────────

const MASTERS = [
    {
        key: 'FRONT',
        masterProjectName: 'VWA/PATAGONIA/HEADREST_FRONT',
        variantLevels: ['L1', 'L2', 'L3'],
    },
    {
        key: 'REAR_CEN',
        masterProjectName: 'VWA/PATAGONIA/HEADREST_REAR_CEN',
        variantLevels: ['L1', 'L2', 'L3'],
    },
    {
        key: 'REAR_OUT',
        masterProjectName: 'VWA/PATAGONIA/HEADREST_REAR_OUT',
        variantLevels: ['L1', 'L2', 'L3'],
    },
];

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('================================================================');
    console.log('  PROPAGATE: Master AMFE → Headrest Variants (L1/L2/L3)');
    console.log('================================================================\n');

    await initSupabase();

    let totalUpdated = 0;

    for (const master of MASTERS) {
        console.log(`\n── ${master.key} ──`);

        // 1. Load master AMFE document
        const masterRows = await selectSql(
            `SELECT id, project_name, amfe_number, data, operation_count, cause_count
             FROM amfe_documents WHERE project_name = ?`,
            [master.masterProjectName]
        );

        if (masterRows.length === 0) {
            console.error(`  ERROR: Master not found: ${master.masterProjectName}`);
            continue;
        }

        const masterRow = masterRows[0];
        const masterDoc = JSON.parse(masterRow.data);
        console.log(`  Master: ${masterRow.project_name} (${masterRow.amfe_number})`);
        console.log(`    Operations: ${masterRow.operation_count}, Causes: ${masterRow.cause_count}`);

        // 2. Get the master's family_documents record
        const masterFdRows = await selectSql(
            `SELECT fd.id, fd.family_id FROM family_documents fd
             WHERE fd.document_id = ? AND fd.module = 'amfe' AND fd.is_master = 1`,
            [masterRow.id]
        );

        if (masterFdRows.length === 0) {
            console.error(`  ERROR: No family_documents record for master ${masterRow.id}`);
            continue;
        }

        const familyId = masterFdRows[0].family_id;
        console.log(`  Family ID: ${familyId}`);

        // 3. For each variant level, update the AMFE
        for (const level of master.variantLevels) {
            const variantProjectName = `${master.masterProjectName} [${level}]`;

            // Load variant
            const variantRows = await selectSql(
                `SELECT id, project_name, amfe_number, subject, part_number, data, cause_count
                 FROM amfe_documents WHERE project_name = ?`,
                [variantProjectName]
            );

            if (variantRows.length === 0) {
                console.error(`    ERROR: Variant not found: ${variantProjectName}`);
                continue;
            }

            const variantRow = variantRows[0];
            console.log(`\n    ${level}: ${variantRow.project_name} (current causes: ${variantRow.cause_count})`);

            // Clone master doc with new UUIDs
            const { result: clonedDoc } = regenerateUuids(JSON.parse(JSON.stringify(masterDoc)));

            // Preserve variant's own header identity
            clonedDoc.header.amfeNumber = variantRow.amfe_number;
            clonedDoc.header.subject = variantRow.subject;
            clonedDoc.header.partNumber = variantRow.part_number || clonedDoc.header.partNumber;

            // Compute stats
            const ops = clonedDoc.operations || [];
            const stats = countCauses(ops);
            const coverage = calcCoverage(ops);

            // Serialize
            const docJson = JSON.stringify(clonedDoc);
            const checksum = sha256(docJson);

            // Update variant in Supabase
            await execSql(
                `UPDATE amfe_documents SET
                    data = ?, checksum = ?, updated_at = datetime('now'),
                    operation_count = ?, cause_count = ?, ap_h_count = ?, ap_m_count = ?,
                    coverage_percent = ?
                 WHERE id = ?`,
                [docJson, checksum, ops.length, stats.total, stats.apH, stats.apM,
                 coverage, variantRow.id]
            );

            console.log(`      Updated: ${ops.length} ops, ${stats.total} causes (was ${variantRow.cause_count})`);
            totalUpdated++;

            // Clear stale overrides for this variant
            const varFdRows = await selectSql(
                `SELECT id FROM family_documents
                 WHERE document_id = ? AND module = 'amfe' AND is_master = 0`,
                [variantRow.id]
            );

            if (varFdRows.length > 0) {
                const fdId = varFdRows[0].id;
                await execSql(
                    `DELETE FROM family_document_overrides WHERE family_doc_id = ?`,
                    [fdId]
                );
                console.log(`      Cleared overrides for family_doc_id=${fdId}`);

                // Also clear any stale change proposals
                await execSql(
                    `DELETE FROM family_change_proposals WHERE target_family_doc_id = ?`,
                    [fdId]
                );
                console.log(`      Cleared change proposals for family_doc_id=${fdId}`);
            }
        }
    }

    // ─── Verification ──────────────────────────────────────────────────────

    console.log('\n\n================================================================');
    console.log('  VERIFICATION');
    console.log('================================================================\n');

    for (const master of MASTERS) {
        console.log(`── ${master.key} ──`);
        const allDocs = await selectSql(
            `SELECT project_name, operation_count, cause_count
             FROM amfe_documents WHERE project_name LIKE ?
             ORDER BY project_name`,
            [`${master.masterProjectName}%`]
        );
        for (const d of allDocs) {
            console.log(`  ${d.project_name}: ${d.operation_count} ops, ${d.cause_count} causes`);
        }
    }

    console.log('\n================================================================');
    console.log(`  DONE — ${totalUpdated} variant documents updated`);
    console.log('================================================================');

    close();
}

main().catch(err => {
    console.error('\nERROR:', err);
    close();
    process.exit(1);
});
