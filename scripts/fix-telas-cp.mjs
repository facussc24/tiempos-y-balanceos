#!/usr/bin/env node
/**
 * fix-telas-cp.mjs
 *
 * Generates missing CP items for Telas Planas and Telas Termoformadas.
 * The AMFE has data for operations that were never carried over to the CP.
 *
 * Telas Planas   missing ops: 20, 21, 10d, 80
 * Telas Termoformadas missing ops: 15, 20, 30, 40, 50, 60
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { calcAP } from './apTableShared.mjs';
import { randomUUID, createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferFreq(opName) {
    const upper = (opName || '').toUpperCase();
    if (upper.includes('RECEP')) return 'Cada recepcion';
    if (upper.includes('EMBALA')) return 'Cada contenedor';
    if (upper.includes('CONTROL') || upper.includes('INSPECCION')) return 'Cada pieza';
    return 'Inicio y fin de turno';
}

function computeChecksum(data) {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function esc(str) {
    return (str || '').replace(/'/g, "''");
}

// ---------------------------------------------------------------------------
// Main logic per product
// ---------------------------------------------------------------------------

async function fixProduct(projectName, expectedMissingOps) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Processing: ${projectName}`);
    console.log(`Expected missing ops: ${expectedMissingOps.join(', ')}`);
    console.log('='.repeat(70));

    // 1. Read AMFE
    const amfeRows = await selectSql(
        `SELECT id, data FROM amfe_documents WHERE project_name = '${esc(projectName)}'`
    );
    if (amfeRows.length === 0) {
        console.error(`  ERROR: No AMFE found for ${projectName}`);
        return;
    }
    const amfeRow = amfeRows[0];
    const amfeData = typeof amfeRow.data === 'string' ? JSON.parse(amfeRow.data) : amfeRow.data;
    console.log(`  AMFE id: ${amfeRow.id}`);
    console.log(`  AMFE operations: ${amfeData.operations.length}`);

    // 2. Read CP
    const cpRows = await selectSql(
        `SELECT id, data FROM cp_documents WHERE project_name = '${esc(projectName)}'`
    );
    if (cpRows.length === 0) {
        console.error(`  ERROR: No CP found for ${projectName}`);
        return;
    }
    const cpRow = cpRows[0];
    const cpData = typeof cpRow.data === 'string' ? JSON.parse(cpRow.data) : cpRow.data;
    const itemsBefore = cpData.items.length;
    console.log(`  CP id: ${cpRow.id}`);
    console.log(`  CP items BEFORE: ${itemsBefore}`);

    // 3. Build set of existing CP processStepNumbers
    const existingSteps = new Set();
    for (const item of cpData.items) {
        if (item.processStepNumber) {
            existingSteps.add(item.processStepNumber.trim());
        }
    }
    console.log(`  Existing CP step numbers: [${[...existingSteps].sort().join(', ')}]`);

    // 4. Find AMFE operations not yet in CP
    let missingOpsCount = 0;
    let newItemsCount = 0;
    const newItems = [];

    for (const op of amfeData.operations) {
        const opNum = (op.opNumber || '').trim();
        if (existingSteps.has(opNum)) continue; // already in CP

        missingOpsCount++;
        console.log(`\n  Missing op: ${opNum} - ${op.name}`);

        // Collect qualifying causes across the full hierarchy:
        // Operation → WorkElements → Functions → Failures → Causes
        let qualifyingCauses = 0;
        let skippedCauses = 0;

        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const severity = Number(fail.severity) || 0;

                    for (const cause of (fail.causes || [])) {
                        const ap = (cause.ap || '').toUpperCase();
                        const sc = (cause.specialChar || '').toUpperCase();

                        const isHighMedAP = ap === 'H' || ap === 'M';
                        const isSpecialChar = sc === 'SC' || sc === 'CC';

                        if (!isHighMedAP && !isSpecialChar) {
                            skippedCauses++;
                            continue;
                        }

                        qualifyingCauses++;

                        const cpItem = {
                            id: randomUUID(),
                            processStepNumber: opNum,
                            processDescription: op.name || '',
                            machineDeviceTool: we.name || '',
                            characteristicNumber: cause.characteristicNumber || '',
                            productCharacteristic: '',
                            processCharacteristic: cause.cause || '',
                            specialCharClass: cause.specialChar || 'SC',
                            specification: 'Segun instruccion de proceso',
                            evaluationTechnique: cause.detectionControl || '',
                            sampleSize: '3 piezas',
                            sampleFrequency: inferFreq(op.name),
                            controlMethod: cause.preventionControl || '',
                            reactionPlan: 'Ajustar proceso. Reinspeccionar ultimo lote. Registrar desvio.',
                            reactionPlanOwner: 'Operador de Produccion',
                            controlProcedure: '',
                            autoFilledFields: [],
                            amfeAp: cause.ap,
                            amfeSeverity: severity,
                            operationCategory: '',
                            amfeCauseIds: [cause.id],
                            amfeFailureId: fail.id,
                            amfeFailureIds: [fail.id],
                        };

                        newItems.push(cpItem);
                        newItemsCount++;
                    }
                }
            }
        }

        if (qualifyingCauses === 0) {
            console.log(`    WARNING: Op ${opNum} has no causes with AP=H/M or SC/CC (skipped ${skippedCauses} low-risk causes)`);
        } else {
            console.log(`    Generated ${qualifyingCauses} CP items (skipped ${skippedCauses} low-risk causes)`);
        }
    }

    if (newItems.length === 0) {
        console.log(`\n  No new items to add for ${projectName}.`);
        return;
    }

    // 6. Append new items to CP
    cpData.items = [...cpData.items, ...newItems];
    const itemsAfter = cpData.items.length;

    // 7. Update CP with new checksum and item_count
    const newChecksum = computeChecksum(cpData);
    const dataStr = esc(JSON.stringify(cpData));

    await execSql(
        `UPDATE cp_documents SET data = '${dataStr}', checksum = '${newChecksum}', item_count = ${itemsAfter}, updated_at = NOW() WHERE id = '${esc(cpRow.id)}'`
    );

    // 8. Report
    console.log(`\n  --- REPORT for ${projectName} ---`);
    console.log(`  Missing operations found: ${missingOpsCount}`);
    console.log(`  New CP items generated:   ${newItemsCount}`);
    console.log(`  Items BEFORE: ${itemsBefore}`);
    console.log(`  Items AFTER:  ${itemsAfter}`);
    console.log(`  New checksum: ${newChecksum}`);
    console.log(`  UPDATE applied successfully.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log('fix-telas-cp.mjs — Generate missing CP items from AMFE data');
    console.log('============================================================\n');

    await initSupabase();

    await fixProduct('PWA/TELAS_PLANAS', ['20', '21', '10d', '80']);
    await fixProduct('PWA/TELAS_TERMOFORMADAS', ['15', '20', '30', '40', '50', '60']);

    console.log('\n\nDone.');
    close();
}

main().catch((err) => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
