#!/usr/bin/env node
/**
 * Fix "Aprob. Planta" in all CP documents.
 *
 * Problem: The `approvedBy` field was used for plant approval, but it should be
 * for engineering approval (Carlos Baptista). A separate `plantApproval` field
 * is needed for "Gonzalo Cal" (G.Cal).
 *
 * This script:
 *   1. Adds `plantApproval: "Gonzalo Cal"` to all CP headers
 *   2. Keeps `approvedBy: "Carlos Baptista"` (engineering — correct)
 *
 * Usage:
 *   node scripts/fix-cp-plant-approval.mjs              # dry-run
 *   node scripts/fix-cp-plant-approval.mjs --apply       # write changes
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const DRY_RUN = !process.argv.includes('--apply');

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

async function main() {
    await initSupabase();

    console.log(`\nMode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}\n`);

    const cpDocs = await selectSql('SELECT id, project_name, data FROM cp_documents');
    console.log(`Found ${cpDocs.length} CP documents.\n`);

    let updated = 0;

    for (const row of cpDocs) {
        const data = JSON.parse(row.data);
        if (!data.header) data.header = {};

        const before = {
            approvedBy: data.header.approvedBy || '(empty)',
            plantApproval: data.header.plantApproval || '(not set)',
        };

        // Set plantApproval to Gonzalo Cal
        data.header.plantApproval = 'Gonzalo Cal';

        // Ensure approvedBy is Carlos Baptista (engineering)
        if (!data.header.approvedBy || data.header.approvedBy === 'Gonzalo Cal' || data.header.approvedBy === 'G.Cal') {
            data.header.approvedBy = 'Carlos Baptista';
        }

        console.log(`  ${row.project_name}:`);
        console.log(`    approvedBy:    ${before.approvedBy} -> ${data.header.approvedBy}`);
        console.log(`    plantApproval: ${before.plantApproval} -> ${data.header.plantApproval}`);

        if (!DRY_RUN) {
            const jsonString = JSON.stringify(data);
            const checksum = sha256(jsonString);
            await execSql(
                `UPDATE cp_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                [jsonString, checksum, row.id]
            );
            updated++;
        }
    }

    console.log(`\n${DRY_RUN ? 'Would update' : 'Updated'} ${DRY_RUN ? cpDocs.length : updated} documents.`);

    close();
    console.log('Done.');
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
