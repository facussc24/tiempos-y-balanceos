#!/usr/bin/env node
/**
 * FIX: Add missing failure mode to Top Roll AMFE OP 50 (Edge Folding)
 * and corresponding CP item.
 *
 * 1. Reads AMFE-TOPROLL-001 from Supabase
 * 2. Finds operation with opNumber = "50" (Edge Folding)
 * 3. Adds a new failure mode for delamination in the folding zone
 * 4. Updates metadata (cause_count, ap_m_count)
 * 5. Also adds a CP item for this new failure in the Top Roll Control Plan
 *
 * Usage: node scripts/fix-toproll-op50.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { calcAP } from './apTableShared.mjs';
import { randomUUID, createHash } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  FIX: Add failure mode to Top Roll AMFE OP 50');
    console.log('═══════════════════════════════════════════════════════════\n');

    await initSupabase();

    // ── Step 1: Read AMFE Top Roll ──────────────────────────────────────
    console.log('── Step 1: Reading AMFE Top Roll ──────────────────────────');

    const amfeRows = await selectSql(
        `SELECT id, data FROM amfe_documents WHERE project_name = '${('VWA/PATAGONIA/TOP_ROLL').replace(/'/g, "''")}'`
    );

    if (amfeRows.length === 0) {
        console.error('  ERROR: AMFE Top Roll not found!');
        close();
        process.exit(1);
    }

    const amfeRow = amfeRows[0];
    const amfeDoc = JSON.parse(amfeRow.data);
    console.log(`  Found AMFE id=${amfeRow.id}`);

    // ── Step 2: Find OP 50 (Edge Folding) ───────────────────────────────
    console.log('\n── Step 2: Finding OP 50 (Edge Folding) ───────────────────');

    const op50 = amfeDoc.operations.find(op => op.opNumber === '50');
    if (!op50) {
        console.error('  ERROR: Operation 50 not found in AMFE!');
        console.log('  Available operations:', amfeDoc.operations.map(op => `${op.opNumber} - ${op.name}`).join(', '));
        close();
        process.exit(1);
    }

    console.log(`  Found: Op ${op50.opNumber} - ${op50.name}`);

    // ── Step 3: Find first workElement, first function ──────────────────
    console.log('\n── Step 3: Locating first workElement/function ────────────');

    if (!op50.workElements || op50.workElements.length === 0) {
        console.error('  ERROR: No workElements in OP 50!');
        close();
        process.exit(1);
    }

    const we = op50.workElements[0];
    if (!we.functions || we.functions.length === 0) {
        console.error('  ERROR: No functions in first workElement!');
        close();
        process.exit(1);
    }

    const fn = we.functions[0];
    console.log(`  WorkElement: ${we.name || '(unnamed)'}`);
    console.log(`  Function: ${fn.description || fn.name || '(unnamed)'}`);
    console.log(`  Current failures count: ${(fn.failures || []).length}`);

    // ── Step 4: Add new failure mode ────────────────────────────────────
    console.log('\n── Step 4: Adding new failure mode ─────────────────────────');

    const apValue = calcAP(7, 5, 6);
    console.log(`  calcAP(7, 5, 6) = "${apValue}"`);

    const newFailure = {
        id: randomUUID(),
        description: "Despegue parcial del material (Delaminacion) en la zona de plegado",
        effectLocal: "Scrap de la pieza",
        effectNextLevel: "Rechazo en linea del cliente",
        effectEndUser: "Desprendimiento de material decorativo",
        severity: 7,
        severityLocal: "",
        severityNextLevel: "",
        severityEndUser: "",
        causes: [{
            id: randomUUID(),
            cause: "Temperatura de aire caliente/IR por debajo del set-point (< 180\u00B0C)",
            preventionControl: "Verificacion de temperatura del horno IR al inicio de turno",
            detectionControl: "Test de adherencia manual post-plegado",
            occurrence: 5,
            detection: 6,
            ap: apValue,
            characteristicNumber: "",
            specialChar: "SC",
            filterCode: "",
            preventionAction: "",
            detectionAction: "",
            responsible: "",
            targetDate: "",
            status: "",
            actionTaken: "",
            completionDate: "",
            severityNew: "",
            occurrenceNew: "",
            detectionNew: "",
            apNew: "",
            observations: ""
        }]
    };

    if (!fn.failures) fn.failures = [];
    fn.failures.push(newFailure);

    console.log(`  Added failure: "${newFailure.description}"`);
    console.log(`  Cause: "${newFailure.causes[0].cause}"`);
    console.log(`  S=${newFailure.severity}, O=${newFailure.causes[0].occurrence}, D=${newFailure.causes[0].detection}, AP=${apValue}`);
    console.log(`  New failures count: ${fn.failures.length}`);

    // ── Step 5: Recompute AMFE metadata ─────────────────────────────────
    console.log('\n── Step 5: Recomputing AMFE metadata ───────────────────────');

    let causeCount = 0, apHCount = 0, apMCount = 0, filledCauses = 0;
    let operationCount = (amfeDoc.operations || []).length;

    for (const op of amfeDoc.operations || []) {
        for (const we2 of op.workElements || []) {
            for (const fn2 of we2.functions || []) {
                for (const fail of fn2.failures || []) {
                    for (const cause of fail.causes || []) {
                        causeCount++;
                        if (cause.ap === 'H' || cause.ap === 'HIGH') apHCount++;
                        if (cause.ap === 'M' || cause.ap === 'MEDIUM') apMCount++;
                        if (fail.severity && cause.occurrence && cause.detection) filledCauses++;
                    }
                }
            }
        }
    }

    const coveragePercent = causeCount > 0 ? Math.round((filledCauses / causeCount) * 100) : 0;

    console.log(`  operation_count: ${operationCount}`);
    console.log(`  cause_count: ${causeCount}`);
    console.log(`  ap_h_count: ${apHCount}`);
    console.log(`  ap_m_count: ${apMCount}`);
    console.log(`  coverage_percent: ${coveragePercent}%`);

    // ── Step 6: UPDATE AMFE in Supabase ─────────────────────────────────
    console.log('\n── Step 6: Saving AMFE to Supabase ─────────────────────────');

    const amfeData = JSON.stringify(amfeDoc);
    const amfeChecksum = sha256(amfeData);

    const escapedAmfeData = amfeData.replace(/'/g, "''");

    await execSql(
        `UPDATE amfe_documents
         SET data = '${escapedAmfeData}', checksum = '${amfeChecksum}',
             operation_count = ${operationCount}, cause_count = ${causeCount},
             ap_h_count = ${apHCount}, ap_m_count = ${apMCount},
             coverage_percent = ${coveragePercent}, updated_at = NOW()
         WHERE id = '${amfeRow.id.replace(/'/g, "''")}'`
    );

    console.log('  AMFE SAVED.');

    // ── Step 7: Add CP item for this failure ────────────────────────────
    console.log('\n── Step 7: Adding CP item for new failure ──────────────────');

    const cpRows = await selectSql(
        `SELECT id, data FROM cp_documents WHERE project_name = '${('VWA/PATAGONIA/TOP_ROLL').replace(/'/g, "''")}'`
    );

    if (cpRows.length === 0) {
        console.error('  WARNING: CP Top Roll not found! Skipping CP update.');
    } else {
        const cpRow = cpRows[0];
        const cpDoc = JSON.parse(cpRow.data);
        console.log(`  Found CP id=${cpRow.id}`);
        console.log(`  Current CP items: ${(cpDoc.items || []).length}`);

        const newCpItem = {
            id: randomUUID(),
            processStepNumber: "50",
            processDescription: "Edge Folding / Plegado de bordes",
            machineDeviceTool: "Horno IR + Plegadora",
            processCharacteristic: "Temperatura de aire caliente/IR por debajo del set-point",
            productCharacteristic: "Adherencia del material en zona de plegado",
            specialCharClass: "SC",
            controlMethod: "Verificacion de temperatura con pirometro",
            sampleSize: "1",
            sampleFrequency: "Inicio de turno",
            reactionPlan: "Detener produccion, ajustar temperatura, re-verificar con test de adherencia",
            amfeFailureId: newFailure.id,
            amfeCauseIds: [newFailure.causes[0].id],
            amfeAp: apValue,
            amfeSeverity: 7,
            operationCategory: ""
        };

        if (!cpDoc.items) cpDoc.items = [];
        cpDoc.items.push(newCpItem);

        console.log(`  Added CP item: processStepNumber=50, characteristic="${newCpItem.processCharacteristic}"`);
        console.log(`  New CP items count: ${cpDoc.items.length}`);

        const cpData = JSON.stringify(cpDoc);
        const cpChecksum = sha256(cpData);

        const escapedCpData = cpData.replace(/'/g, "''");

        await execSql(
            `UPDATE cp_documents
             SET data = '${escapedCpData}', checksum = '${cpChecksum}', updated_at = NOW()
             WHERE id = '${cpRow.id.replace(/'/g, "''")}'`
        );

        console.log('  CP SAVED.');
    }

    // ── Done ──────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  DONE: Top Roll OP 50 failure mode + CP item added');
    console.log('═══════════════════════════════════════════════════════════');

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
