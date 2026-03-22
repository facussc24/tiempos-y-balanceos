#!/usr/bin/env node
/**
 * Normalize team names in ALL HO and PFD documents in Supabase.
 *
 * HO documents: sets preparedBy and approvedBy on every sheet
 * PFD documents: sets preparedBy, approvedBy, coreTeam, keyContact on header
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Target values
// ---------------------------------------------------------------------------

const HO_PREPARED_BY = 'G.Cal / Facundo Santoro';
const HO_APPROVED_BY = 'Carlos Baptista';

const PFD_PREPARED_BY = 'Facundo Santoro';
const PFD_APPROVED_BY = 'Carlos Baptista';
const PFD_CORE_TEAM = 'Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Facundo Santoro, Marianna Vera (Producción), Cristina Rabago (Seguridad e Higiene)';
const PFD_KEY_CONTACT = 'Carlos Baptista';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log('=== Normalize Team Names in HO & PFD Documents ===\n');

    await initSupabase();

    // -----------------------------------------------------------------------
    // HO Documents
    // -----------------------------------------------------------------------
    console.log('\n--- HO Documents ---');
    const hoRows = await selectSql('SELECT id, data FROM ho_documents');
    console.log(`Found ${hoRows.length} HO documents`);

    let hoUpdated = 0;
    let totalSheetsUpdated = 0;
    let hoErrors = [];

    for (const row of hoRows) {
        try {
            const data = JSON.parse(row.data);
            if (!data.sheets || !Array.isArray(data.sheets)) {
                console.log(`  [SKIP] HO ${row.id}: no sheets array`);
                continue;
            }

            let changed = false;
            let sheetsInDoc = 0;

            for (const sheet of data.sheets) {
                let sheetChanged = false;

                if (sheet.preparedBy !== HO_PREPARED_BY) {
                    sheet.preparedBy = HO_PREPARED_BY;
                    sheetChanged = true;
                }
                if (sheet.approvedBy !== HO_APPROVED_BY) {
                    sheet.approvedBy = HO_APPROVED_BY;
                    sheetChanged = true;
                }

                if (sheetChanged) {
                    sheetsInDoc++;
                    changed = true;
                }
            }

            if (changed) {
                const jsonString = JSON.stringify(data);
                const checksum = sha256(jsonString);
                await execSql(
                    "UPDATE ho_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?",
                    [jsonString, checksum, row.id]
                );
                hoUpdated++;
                totalSheetsUpdated += sheetsInDoc;
                console.log(`  [OK] HO ${row.id}: ${sheetsInDoc} sheets updated (of ${data.sheets.length} total)`);
            } else {
                console.log(`  [NO CHANGE] HO ${row.id}: ${data.sheets.length} sheets already correct`);
            }
        } catch (err) {
            hoErrors.push({ id: row.id, error: err.message });
            console.error(`  [ERROR] HO ${row.id}: ${err.message}`);
        }
    }

    // -----------------------------------------------------------------------
    // PFD Documents
    // -----------------------------------------------------------------------
    console.log('\n--- PFD Documents ---');
    const pfdRows = await selectSql('SELECT id, data FROM pfd_documents');
    console.log(`Found ${pfdRows.length} PFD documents`);

    let pfdUpdated = 0;
    let pfdErrors = [];

    for (const row of pfdRows) {
        try {
            const data = JSON.parse(row.data);
            if (!data.header) {
                data.header = {};
            }

            let changed = false;

            if (data.header.preparedBy !== PFD_PREPARED_BY) {
                data.header.preparedBy = PFD_PREPARED_BY;
                changed = true;
            }
            if (data.header.approvedBy !== PFD_APPROVED_BY) {
                data.header.approvedBy = PFD_APPROVED_BY;
                changed = true;
            }
            if (data.header.coreTeam !== PFD_CORE_TEAM) {
                data.header.coreTeam = PFD_CORE_TEAM;
                changed = true;
            }
            if (data.header.keyContact !== PFD_KEY_CONTACT) {
                data.header.keyContact = PFD_KEY_CONTACT;
                changed = true;
            }

            if (changed) {
                const jsonString = JSON.stringify(data);
                const checksum = sha256(jsonString);
                await execSql(
                    "UPDATE pfd_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?",
                    [jsonString, checksum, row.id]
                );
                pfdUpdated++;
                console.log(`  [OK] PFD ${row.id}: header fields updated`);
            } else {
                console.log(`  [NO CHANGE] PFD ${row.id}: already correct`);
            }
        } catch (err) {
            pfdErrors.push({ id: row.id, error: err.message });
            console.error(`  [ERROR] PFD ${row.id}: ${err.message}`);
        }
    }

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    console.log('\n========== SUMMARY ==========');
    console.log(`HO documents updated:  ${hoUpdated} / ${hoRows.length}`);
    console.log(`HO sheets updated:     ${totalSheetsUpdated}`);
    console.log(`PFD documents updated: ${pfdUpdated} / ${pfdRows.length}`);
    console.log('\nFields changed:');
    console.log('  HO sheets:  preparedBy → "G.Cal / Facundo Santoro", approvedBy → "Carlos Baptista"');
    console.log('  PFD header: preparedBy → "Facundo Santoro", approvedBy → "Carlos Baptista"');
    console.log('  PFD header: coreTeam → full team list, keyContact → "Carlos Baptista"');

    if (hoErrors.length > 0) {
        console.log(`\nHO Errors (${hoErrors.length}):`);
        hoErrors.forEach(e => console.log(`  - ${e.id}: ${e.error}`));
    }
    if (pfdErrors.length > 0) {
        console.log(`\nPFD Errors (${pfdErrors.length}):`);
        pfdErrors.forEach(e => console.log(`  - ${e.id}: ${e.error}`));
    }

    if (hoErrors.length === 0 && pfdErrors.length === 0) {
        console.log('\nNo errors. All documents processed successfully.');
    }

    close();
}

main().catch(err => {
    console.error('\nFATAL:', err.message);
    close();
    process.exit(1);
});
