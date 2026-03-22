#!/usr/bin/env node
/**
 * Normalize team names in ALL AMFE and CP documents in Supabase.
 *
 * AMFE header fields:
 *   - responsible, processResponsible, team, approvedBy
 * CP header fields:
 *   - responsible, approvedBy, coreTeam
 *
 * Does NOT touch CP items[].reactionPlanOwner.
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AMFE_HEADER = {
    responsible: 'Carlos Baptista (Ingeniería)',
    processResponsible: 'Carlos Baptista (Ingeniería)',
    team: 'Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Facundo Santoro, Marianna Vera (Producción), Cristina Rabago (Seguridad e Higiene)',
    approvedBy: 'Carlos Baptista',
};

const CP_HEADER = {
    responsible: 'Manuel Meszaros',
    approvedBy: 'Carlos Baptista',
    coreTeam: 'Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad)',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

function setHeaderFields(data, fields) {
    let changed = false;
    if (!data.header) data.header = {};
    for (const [key, value] of Object.entries(fields)) {
        if (data.header[key] !== value) {
            data.header[key] = value;
            changed = true;
        }
    }
    return changed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    await initSupabase();

    // --- AMFE ---
    console.log('\n=== AMFE Documents ===');
    const amfeDocs = await selectSql('SELECT id, data FROM amfe_documents');
    console.log(`Found ${amfeDocs.length} AMFE documents.`);

    let amfeUpdated = 0;
    let amfeSkipped = 0;
    const amfeErrors = [];

    for (const row of amfeDocs) {
        try {
            const data = JSON.parse(row.data);
            const changed = setHeaderFields(data, AMFE_HEADER);

            if (!changed) {
                amfeSkipped++;
                continue;
            }

            const jsonString = JSON.stringify(data);
            const checksum = sha256(jsonString);

            await execSql(
                `UPDATE amfe_documents SET data = ?, responsible = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                [jsonString, AMFE_HEADER.responsible, checksum, row.id]
            );

            amfeUpdated++;
            console.log(`  [AMFE] Updated id=${row.id}`);
        } catch (err) {
            amfeErrors.push({ id: row.id, error: err.message });
            console.error(`  [AMFE] ERROR id=${row.id}: ${err.message}`);
        }
    }

    // --- CP ---
    console.log('\n=== CP Documents ===');
    const cpDocs = await selectSql('SELECT id, data FROM cp_documents');
    console.log(`Found ${cpDocs.length} CP documents.`);

    let cpUpdated = 0;
    let cpSkipped = 0;
    const cpErrors = [];

    for (const row of cpDocs) {
        try {
            const data = JSON.parse(row.data);
            const changed = setHeaderFields(data, CP_HEADER);

            if (!changed) {
                cpSkipped++;
                continue;
            }

            const jsonString = JSON.stringify(data);
            const checksum = sha256(jsonString);

            await execSql(
                `UPDATE cp_documents SET data = ?, responsible = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                [jsonString, CP_HEADER.responsible, checksum, row.id]
            );

            cpUpdated++;
            console.log(`  [CP] Updated id=${row.id}`);
        } catch (err) {
            cpErrors.push({ id: row.id, error: err.message });
            console.error(`  [CP] ERROR id=${row.id}: ${err.message}`);
        }
    }

    // --- Summary ---
    console.log('\n========== SUMMARY ==========');
    console.log(`AMFE: ${amfeUpdated} updated, ${amfeSkipped} already correct, ${amfeErrors.length} errors (of ${amfeDocs.length} total)`);
    console.log(`CP:   ${cpUpdated} updated, ${cpSkipped} already correct, ${cpErrors.length} errors (of ${cpDocs.length} total)`);

    if (amfeUpdated > 0) {
        console.log('\nAMFE fields set:');
        for (const [k, v] of Object.entries(AMFE_HEADER)) {
            console.log(`  header.${k} = "${v}"`);
        }
        console.log(`  responsible column = "${AMFE_HEADER.responsible}"`);
    }

    if (cpUpdated > 0) {
        console.log('\nCP fields set:');
        for (const [k, v] of Object.entries(CP_HEADER)) {
            console.log(`  header.${k} = "${v}"`);
        }
        console.log(`  responsible column = "${CP_HEADER.responsible}"`);
    }

    if (amfeErrors.length > 0) {
        console.log('\nAMFE errors:');
        amfeErrors.forEach(e => console.log(`  id=${e.id}: ${e.error}`));
    }
    if (cpErrors.length > 0) {
        console.log('\nCP errors:');
        cpErrors.forEach(e => console.log(`  id=${e.id}: ${e.error}`));
    }

    close();
    console.log('\nDone.');
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
