#!/usr/bin/env node
/**
 * FIX: Update all CP documents:
 * 1. Add Producción to coreTeam (Marianna Vera)
 * 2. Merge customerEngApproval + customerQualityApproval → customerApproval
 *
 * Usage: node scripts/fix-cp-team-and-approval.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const NEW_TEAM = 'Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Marianna Vera (Producción)';

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  FIX: CP team + customer approval unification');
    console.log('═══════════════════════════════════════════════════════════\n');

    await initSupabase();

    // ── Step 1: Read all CPs ─────────────────────────────────────────
    const cpRows = await selectSql(
        `SELECT id, project_name, data FROM cp_documents ORDER BY project_name`
    );
    console.log(`  Loaded ${cpRows.length} CP documents.\n`);

    let docsUpdated = 0;

    // ── Step 2: Iterate and modify ───────────────────────────────────
    for (const row of cpRows) {
        const cpData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const cpName = row.project_name || row.id;
        const h = cpData.header;
        const changes = [];

        // Fix 1: Update coreTeam
        const oldTeam = h.coreTeam || '';
        h.coreTeam = NEW_TEAM;
        if (oldTeam !== NEW_TEAM) {
            changes.push(`coreTeam: "${oldTeam}" → "${NEW_TEAM}"`);
        }

        // Fix 2: Merge customer approval fields
        const engApproval = h.customerEngApproval || '';
        const qualApproval = h.customerQualityApproval || '';
        const existingUnified = h.customerApproval || '';

        if (!existingUnified && (engApproval || qualApproval)) {
            const parts = [engApproval, qualApproval].filter(Boolean);
            h.customerApproval = parts.join(' / ');
            changes.push(`customerApproval merged: "${h.customerApproval}"`);
        } else if (!existingUnified) {
            h.customerApproval = '';
        }

        // Remove old fields
        if ('customerEngApproval' in h) {
            delete h.customerEngApproval;
            changes.push('removed customerEngApproval');
        }
        if ('customerQualityApproval' in h) {
            delete h.customerQualityApproval;
            changes.push('removed customerQualityApproval');
        }

        // ── Step 3: Save back ─────────────────────────────────────────
        if (changes.length > 0) {
            docsUpdated++;
            const dataStr = JSON.stringify(cpData);
            const checksum = sha256(dataStr);
            const jsonEscaped = dataStr.replace(/'/g, "''");

            await execSql(
                `UPDATE cp_documents SET data = '${jsonEscaped}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${row.id}'`
            );

            console.log(`  ✓ ${cpName}`);
            for (const c of changes) console.log(`      ${c}`);
        } else {
            console.log(`  – ${cpName} (no changes needed)`);
        }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`  DONE: ${docsUpdated}/${cpRows.length} CP documents updated`);
    console.log('═══════════════════════════════════════════════════════════');

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
