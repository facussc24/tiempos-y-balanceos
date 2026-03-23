#!/usr/bin/env node
/**
 * fix-reaction-plans-sgc.mjs
 *
 * Adds SGC procedure references to CP items with generic reaction plans.
 * The Headrest CPs have correct SGC references — use as model:
 *   - Reception operations → " Según P-10/I. P-14."
 *   - Process operations → " Según P-09/I."
 *   - Inspection/quality operations → " Según P-14."
 *
 * Does NOT replace existing text — only appends the SGC ref.
 * Skips items that already contain P-09, P-10, P-14, or SGC.
 *
 * Usage: node scripts/fix-reaction-plans-sgc.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ─── Determine SGC reference based on operation type ─────────────────────────

function getSgcRef(item) {
    const procDesc = (item.processDescription || '').toUpperCase();

    // Reception operations
    if (/RECEP/i.test(procDesc)) {
        return ' Según P-10/I. P-14.';
    }

    // Inspection / quality / final control operations
    if (/INSPEC|CONTROL FINAL|CALIDAD/i.test(procDesc)) {
        return ' Según P-14.';
    }

    // All other process operations
    return ' Según P-09/I.';
}

function alreadyHasSgcRef(reactionPlan) {
    if (!reactionPlan) return false;
    return /P-09|P-10|P-14|SGC/i.test(reactionPlan);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n========================================================================');
    console.log('  FIX: Add SGC procedure references to reaction plans');
    console.log('========================================================================\n');

    const cpRows = await selectSql(
        `SELECT id, project_name, data FROM cp_documents ORDER BY project_name`
    );
    console.log(`Loaded ${cpRows.length} CP documents.\n`);

    let totalItemsUpdated = 0;
    let totalItemsSkipped = 0;
    let docsUpdated = 0;
    const perCpReport = [];

    for (const row of cpRows) {
        const cpData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const cpName = row.project_name || row.id;
        const items = cpData?.items || [];
        let modified = false;
        let cpUpdated = 0;
        let cpSkipped = 0;

        for (const item of items) {
            const rp = item.reactionPlan || '';

            if (alreadyHasSgcRef(rp)) {
                cpSkipped++;
                totalItemsSkipped++;
                continue;
            }

            // Empty reaction plan: skip (nothing to append to)
            if (!rp.trim()) {
                cpSkipped++;
                totalItemsSkipped++;
                continue;
            }

            const sgcRef = getSgcRef(item);
            item.reactionPlan = rp.trimEnd() + sgcRef;
            modified = true;
            cpUpdated++;
            totalItemsUpdated++;
        }

        if (modified) {
            docsUpdated++;
            const dataStr = JSON.stringify(cpData);
            const checksum = createHash('sha256').update(dataStr).digest('hex');
            const jsonEscaped = dataStr.replace(/'/g, "''");

            await execSql(
                `UPDATE cp_documents SET data = '${jsonEscaped}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${row.id}'`
            );

            console.log(`  Updated: ${cpName} (${cpUpdated} items updated, ${cpSkipped} skipped, checksum: ${checksum.slice(0, 12)}...)`);
        }

        perCpReport.push({
            name: cpName,
            updated: cpUpdated,
            skipped: cpSkipped,
            total: items.length,
        });
    }

    // ── Report ──
    console.log('\n========================================================================');
    console.log('  PER-CP REPORT');
    console.log('========================================================================\n');

    const nameW = 45;
    console.log(`  ${'CP'.padEnd(nameW)} | Updated | Skipped |  Total`);
    console.log(`  ${'-'.repeat(nameW + 30)}`);

    for (const r of perCpReport) {
        const marker = r.updated > 0 ? '*' : ' ';
        console.log(
            `${marker} ${r.name.padEnd(nameW)} | ${String(r.updated).padStart(7)} | ${String(r.skipped).padStart(7)} | ${String(r.total).padStart(6)}`
        );
    }

    console.log('\n========================================================================');
    console.log('  SUMMARY');
    console.log('========================================================================\n');
    console.log(`  Total items updated:     ${totalItemsUpdated}`);
    console.log(`  Total items skipped:     ${totalItemsSkipped} (already have SGC ref or empty)`);
    console.log(`  CP documents updated:    ${docsUpdated} / ${cpRows.length}`);
    console.log();

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
