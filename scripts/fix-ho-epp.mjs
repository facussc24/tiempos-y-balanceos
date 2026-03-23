#!/usr/bin/env node
/**
 * fix-ho-epp.mjs
 *
 * Adds missing EPP (PPE) items to HO sheets:
 *   - Costura sheets → proteccionAuditiva (hearing protection)
 *   - Inyección sheets → respirador + delantal (respirator + apron)
 *
 * Uses supabaseHelper.mjs for DB access.
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    await initSupabase();

    // 1. Load all HO documents
    const rows = await selectSql('SELECT id, form_number, part_number, data FROM ho_documents');
    console.log(`\nLoaded ${rows.length} HO documents.\n`);

    if (rows.length === 0) {
        console.log('No HO documents found. Nothing to do.');
        close();
        return;
    }

    // Log one document structure for debugging
    const sampleData = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    const topKeys = Object.keys(sampleData);
    console.log(`Sample doc structure — top-level keys: [${topKeys.join(', ')}]`);
    if (sampleData.sheets) {
        console.log(`  sheets: array of ${sampleData.sheets.length} items`);
        if (sampleData.sheets[0]) {
            console.log(`  First sheet keys: [${Object.keys(sampleData.sheets[0]).join(', ')}]`);
            console.log(`  First sheet operationName: "${sampleData.sheets[0].operationName}"`);
            console.log(`  First sheet safetyElements: ${JSON.stringify(sampleData.sheets[0].safetyElements)}`);
        }
    }
    console.log('');

    // Stats
    let totalSheetsModified = 0;
    let totalSheetsScanned = 0;
    let totalSheetsWithEpp = 0;
    let docsUpdated = 0;

    for (const row of rows) {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

        // Find the sheets array
        const sheets = data.sheets;
        if (!sheets || !Array.isArray(sheets)) {
            console.log(`  [SKIP] HO id=${row.id} (${row.form_number}) — no sheets array found`);
            continue;
        }

        let docModified = false;
        const modifications = [];

        for (const sheet of sheets) {
            totalSheetsScanned++;
            const opName = sheet.operationName || '';

            // Initialize safetyElements if missing
            if (!Array.isArray(sheet.safetyElements)) {
                sheet.safetyElements = [];
            }

            const added = [];

            // Check COSTURA → proteccionAuditiva
            if (/costura/i.test(opName)) {
                if (!sheet.safetyElements.includes('proteccionAuditiva')) {
                    sheet.safetyElements.push('proteccionAuditiva');
                    added.push('proteccionAuditiva');
                }
            }

            // Check INYECCION/INYECCIÓN → respirador + delantal
            if (/inyecci[oó]n/i.test(opName)) {
                if (!sheet.safetyElements.includes('respirador')) {
                    sheet.safetyElements.push('respirador');
                    added.push('respirador');
                }
                if (!sheet.safetyElements.includes('delantal')) {
                    sheet.safetyElements.push('delantal');
                    added.push('delantal');
                }
            }

            if (added.length > 0) {
                totalSheetsModified++;
                docModified = true;
                modifications.push({ sheet: opName, added });
            }

            // Count EPP coverage
            if (sheet.safetyElements.length > 0) {
                totalSheetsWithEpp++;
            }
        }

        if (docModified) {
            docsUpdated++;

            // Recalculate checksum
            const dataStr = JSON.stringify(data);
            const checksum = createHash('sha256').update(dataStr).digest('hex');

            // Update in Supabase
            const escapedData = dataStr.replace(/'/g, "''");
            await execSql(
                `UPDATE ho_documents SET data = '${escapedData}', checksum = '${checksum}' WHERE id = '${row.id}'`
            );

            // Report
            console.log(`  [UPDATED] HO id=${row.id} — ${row.form_number} (${row.part_number})`);
            for (const mod of modifications) {
                console.log(`    Sheet "${mod.sheet}" → added: [${mod.added.join(', ')}]`);
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Summary
    // ---------------------------------------------------------------------------
    console.log('\n' + '='.repeat(60));
    console.log('REPORT');
    console.log('='.repeat(60));
    console.log(`HO documents scanned:  ${rows.length}`);
    console.log(`HO documents updated:  ${docsUpdated}`);
    console.log(`Total sheets scanned:  ${totalSheetsScanned}`);
    console.log(`Total sheets modified: ${totalSheetsModified}`);
    console.log(`EPP coverage:          ${totalSheetsWithEpp}/${totalSheetsScanned} sheets have EPP`);
    console.log('='.repeat(60));

    close();
}

main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
});
