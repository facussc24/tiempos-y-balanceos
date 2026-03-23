#!/usr/bin/env node
/**
 * FIX: Add hearing protection (proteccionAuditiva) to costura HO sheets
 *
 * Sewing machines are noisy and require hearing protection.
 * Finds sheets where operationName contains "costura" (case-insensitive)
 * but NOT "almacenamiento" (storage ops are not actual sewing).
 * Adds proteccionAuditiva to safetyElements if not already present.
 *
 * Targets 6 master HO documents, expects 8 sheets modified.
 *
 * Usage: node scripts/fix-round2-costura-auditiva.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// ═══════════════════════════════════════════════════════════════════════════
// LOGIC: Add proteccionAuditiva to costura sheets
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a sheet is a costura operation that needs hearing protection.
 * Must contain "costura" but NOT "almacenamiento" (Armrest Op 52 is storage).
 */
function isCosturaOperation(operationName) {
    const opLower = (operationName || '').toLowerCase();
    return opLower.includes('costura') && !opLower.includes('almacenamiento');
}

/**
 * Check if a sheet already has proteccionAuditiva.
 */
function hasHearingProtection(sheet) {
    return Array.isArray(sheet.safetyElements) &&
           sheet.safetyElements.includes('proteccionAuditiva');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  FIX: Add Hearing Protection to Costura HO Sheets');
    console.log('═══════════════════════════════════════════════════════════\n');

    await initSupabase();

    // ── Step 1: Query target HO documents ────────────────────────────────
    console.log('── Step 1: Querying target HO documents ──────────────────');

    const rows = await selectSql(
        `SELECT id, data, linked_amfe_project FROM ho_documents WHERE linked_amfe_project IN ('VWA/PATAGONIA/INSERT','VWA/PATAGONIA/ARMREST_DOOR_PANEL','VWA/PATAGONIA/HEADREST_FRONT','VWA/PATAGONIA/HEADREST_REAR_CEN','VWA/PATAGONIA/HEADREST_REAR_OUT','PWA/TELAS_TERMOFORMADAS')`
    );

    console.log(`  Found ${rows.length} HO document(s)\n`);

    if (rows.length === 0) {
        console.log('  No target HO documents found. Exiting.');
        close();
        return;
    }

    let totalModified = 0;
    let totalSkipped = 0;

    for (const row of rows) {
        console.log(`── Processing HO document: ${row.id} (${row.linked_amfe_project}) ──`);

        let doc;
        try {
            doc = JSON.parse(row.data);
        } catch (e) {
            console.log(`  ERROR: Could not parse JSON data: ${e.message}`);
            continue;
        }

        if (!doc.sheets || !Array.isArray(doc.sheets)) {
            console.log(`  WARNING: No sheets array found in document.`);
            continue;
        }

        let docModified = 0;
        let docSkipped = 0;

        for (const sheet of doc.sheets) {
            const opName = sheet.operationName || '(unnamed)';

            if (!isCosturaOperation(sheet.operationName)) {
                // Not a costura operation — skip silently
                continue;
            }

            if (hasHearingProtection(sheet)) {
                docSkipped++;
                totalSkipped++;
                console.log(`    SKIPPED:  Op ${sheet.operationNumber || '?'} "${opName}" (already has proteccionAuditiva)`);
            } else {
                // Add proteccionAuditiva without removing existing EPP
                if (!Array.isArray(sheet.safetyElements)) {
                    sheet.safetyElements = [];
                }
                sheet.safetyElements.push('proteccionAuditiva');
                docModified++;
                totalModified++;
                console.log(`    ADDED:    Op ${sheet.operationNumber || '?'} "${opName}" → +proteccionAuditiva [${sheet.safetyElements.join(', ')}]`);
            }
        }

        console.log(`  Subtotal: ${docModified} modified, ${docSkipped} skipped\n`);

        if (docModified === 0) {
            console.log(`  No changes needed for this document.\n`);
            continue;
        }

        // ── Write back to Supabase ────────────────────────────────────
        const jsonStr = JSON.stringify(doc);
        const checksum = sha256(jsonStr);

        await execSql(
            `UPDATE ho_documents SET data = '${jsonStr.replace(/'/g, "''")}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${row.id}'`
        );

        console.log(`  SAVED to Supabase.\n`);
    }

    // ── Summary ───────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  TOTAL: ${totalModified} sheets modified, ${totalSkipped} sheets skipped`);
    console.log('═══════════════════════════════════════════════════════════');

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
