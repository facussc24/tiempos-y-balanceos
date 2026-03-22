#!/usr/bin/env node
/**
 * FIX: Sync frequencies between HO and CP for Armrest Door Panel
 *
 * In CP: items with processStepNumber in ('60', '80', '81') that have
 * sampleFrequency = 'Inicio de turno' -> change to 'Inicio y fin de turno'
 *
 * In HO: sheets with operationNumber = '60' that have qualityChecks with
 * frequency = 'Inicio de turno' -> change to 'Inicio y fin de turno'
 *
 * Usage: node scripts/fix-armrest-freq.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const OLD_FREQ = 'Inicio de turno';
const NEW_FREQ = 'Inicio y fin de turno';
const PROJECT = 'VWA/PATAGONIA/ARMREST_DOOR_PANEL';

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  FIX: Sync frequencies HO <-> CP for Armrest');
    console.log('═══════════════════════════════════════════════════════════\n');

    await initSupabase();

    let totalChanges = 0;

    // ── Step 1: Read Armrest CP ─────────────────────────────────────────
    console.log('── Step 1: Reading Armrest CP ─────────────────────────────');

    const cpRows = await selectSql(
        `SELECT id, data FROM cp_documents WHERE project_name = '${PROJECT.replace(/'/g, "''")}'`
    );

    if (cpRows.length === 0) {
        console.error('  ERROR: Armrest CP not found!');
        close();
        process.exit(1);
    }

    const cpRow = cpRows[0];
    const cpDoc = JSON.parse(cpRow.data);
    console.log(`  Found CP id=${cpRow.id}, items count: ${(cpDoc.items || []).length}`);

    // ── Step 2: Read Armrest HO ─────────────────────────────────────────
    console.log('\n── Step 2: Reading Armrest HO ─────────────────────────────');

    const hoRows = await selectSql(
        `SELECT id, data FROM ho_documents WHERE linked_amfe_project = '${PROJECT.replace(/'/g, "''")}'`
    );

    if (hoRows.length === 0) {
        console.error('  ERROR: Armrest HO not found!');
        close();
        process.exit(1);
    }

    const hoRow = hoRows[0];
    const hoDoc = JSON.parse(hoRow.data);
    console.log(`  Found HO id=${hoRow.id}, sheets count: ${(hoDoc.sheets || []).length}`);

    // ── Step 3: Fix CP frequencies ──────────────────────────────────────
    console.log('\n── Step 3: Fixing CP frequencies (ops 60, 80, 81) ────────');

    const targetOps = new Set(['60', '80', '81']);
    let cpChanges = 0;

    for (const item of cpDoc.items || []) {
        if (targetOps.has(item.processStepNumber) && item.sampleFrequency === OLD_FREQ) {
            console.log(`  CP CHANGE: Step ${item.processStepNumber} | "${item.processCharacteristic || item.productCharacteristic || '(no char)'}" | "${OLD_FREQ}" -> "${NEW_FREQ}"`);
            item.sampleFrequency = NEW_FREQ;
            cpChanges++;
        }
    }

    console.log(`  CP changes: ${cpChanges}`);
    totalChanges += cpChanges;

    // ── Step 4: Fix HO frequencies ──────────────────────────────────────
    console.log('\n── Step 4: Fixing HO frequencies (op 60) ──────────────────');

    let hoChanges = 0;

    for (const sheet of hoDoc.sheets || []) {
        if (sheet.operationNumber === '60') {
            for (const qc of sheet.qualityChecks || []) {
                if (qc.frequency === OLD_FREQ) {
                    console.log(`  HO CHANGE: Sheet "${sheet.operationName || sheet.operationNumber}" | QC "${qc.description || qc.characteristic || '(no desc)'}" | "${OLD_FREQ}" -> "${NEW_FREQ}"`);
                    qc.frequency = NEW_FREQ;
                    hoChanges++;
                }
            }
        }
    }

    console.log(`  HO changes: ${hoChanges}`);
    totalChanges += hoChanges;

    // ── Step 5: Save CP to Supabase ─────────────────────────────────────
    console.log('\n── Step 5: Saving documents to Supabase ────────────────────');

    if (cpChanges > 0) {
        const cpData = JSON.stringify(cpDoc);
        const cpChecksum = sha256(cpData);
        const escapedCpData = cpData.replace(/'/g, "''");

        await execSql(
            `UPDATE cp_documents
             SET data = '${escapedCpData}', checksum = '${cpChecksum}', updated_at = NOW()
             WHERE id = '${cpRow.id.replace(/'/g, "''")}'`
        );
        console.log(`  CP SAVED (${cpChanges} changes).`);
    } else {
        console.log('  CP: No changes, skipping save.');
    }

    // ── Step 6: Save HO to Supabase ─────────────────────────────────────
    if (hoChanges > 0) {
        const hoData = JSON.stringify(hoDoc);
        const hoChecksum = sha256(hoData);
        const escapedHoData = hoData.replace(/'/g, "''");

        await execSql(
            `UPDATE ho_documents
             SET data = '${escapedHoData}', checksum = '${hoChecksum}', updated_at = NOW()
             WHERE id = '${hoRow.id.replace(/'/g, "''")}'`
        );
        console.log(`  HO SAVED (${hoChanges} changes).`);
    } else {
        console.log('  HO: No changes, skipping save.');
    }

    // ── Done ──────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`  DONE: Total changes = ${totalChanges} (CP: ${cpChanges}, HO: ${hoChanges})`);
    console.log('═══════════════════════════════════════════════════════════');

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
