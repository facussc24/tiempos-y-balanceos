#!/usr/bin/env node
/**
 * Add missing "Costura salteada" failure mode + 3 causes to Armrest AMFE OP 50,
 * then add corresponding CP items for AP=H/M causes.
 *
 * Audit found that the PDF source has failure "Costura salteada" with causes
 * "Peine dañado", "Aguja despuntada", "Hilo enredado" in OP 30 (Costura)
 * that were not loaded into Supabase. These map to Armrest AMFE OP 50
 * (COSTURA - COSTURA UNION).
 *
 * The Insert AMFE is used as reference for S/O/D values (it has the same failure).
 *
 * Usage: node scripts/fix-round2-armrest-costura-salteada.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { calcAP } from './apTableShared.mjs';
import { createHash, randomUUID } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// ---------------------------------------------------------------------------
// Helpers (same as fix-round1)
// ---------------------------------------------------------------------------

function collectFailuresFlat(op) {
    const failures = [];
    for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                failures.push(fail);
            }
        }
    }
    return failures;
}

function computeStats(data) {
    let causeCount = 0;
    let apH = 0;
    let apM = 0;
    let causesWithSOD = 0;

    for (const op of (data.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const severity = Number(fail.severity) || 0;
                    for (const cause of (fail.causes || [])) {
                        causeCount++;
                        const occ = Number(cause.occurrence) || 0;
                        const det = Number(cause.detection) || 0;
                        if (severity >= 1 && occ >= 1 && det >= 1) {
                            causesWithSOD++;
                        }
                        if (cause.ap === 'H') apH++;
                        if (cause.ap === 'M') apM++;
                    }
                }
            }
        }
    }

    return {
        operation_count: (data.operations || []).length,
        cause_count: causeCount,
        ap_h_count: apH,
        ap_m_count: apM,
        coverage_percent: causeCount > 0 ? Math.round((causesWithSOD / causeCount) * 100) : 0,
    };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    await initSupabase();

    // -----------------------------------------------------------------------
    // STEP 1: Read Insert AMFE to get reference S/O/D for "Costura salteada"
    // -----------------------------------------------------------------------
    console.log('\n  ══════════════════════════════════════');
    console.log('  STEP 1: Reading Insert AMFE for reference...');
    console.log('  ══════════════════════════════════════\n');

    const insertDocs = await selectSql(
        `SELECT id, data FROM amfe_documents WHERE project_name = 'VWA/PATAGONIA/INSERTO'`
    );

    if (insertDocs.length === 0) {
        console.error('  ERROR: Insert AMFE not found!');
        close();
        return;
    }

    const insertDoc = insertDocs[0];
    const insertData = typeof insertDoc.data === 'string' ? JSON.parse(insertDoc.data) : insertDoc.data;

    // Search for "costura salteada" across all operations
    let refFailure = null;
    let refOpNumber = null;

    for (const op of (insertData.operations || [])) {
        const failures = collectFailuresFlat(op);
        for (const fail of failures) {
            const desc = (fail.description || fail.failure || fail.failureMode || '').toLowerCase();
            if (desc.includes('costura salteada') || desc.includes('puntada salteada')) {
                refFailure = fail;
                refOpNumber = op.opNumber;
                break;
            }
        }
        if (refFailure) break;
    }

    let refSeverity, refEffectLocal, refEffectNextLevel, refEffectEndUser;
    let refCauseMap = {}; // cause name → { occurrence, detection, preventionControl, detectionControl }

    if (refFailure) {
        console.log(`  Found reference failure in Insert OP ${refOpNumber}:`);
        console.log(`    Description: "${refFailure.description || refFailure.failure || refFailure.failureMode}"`);
        refSeverity = Number(refFailure.severity);
        refEffectLocal = refFailure.effectLocal || 'Puntadas ausentes en tramos del recorrido';
        refEffectNextLevel = refFailure.effectNextLevel || 'Funda con costuras incompletas';
        refEffectEndUser = refFailure.effectEndUser || 'Producto no conforme / rechazo del cliente';

        console.log(`    Severity: ${refSeverity}`);
        console.log(`    Effects: local="${refEffectLocal}", next="${refEffectNextLevel}", end="${refEffectEndUser}"`);

        for (const cause of (refFailure.causes || [])) {
            const causeName = (cause.cause || '').toLowerCase().trim();
            refCauseMap[causeName] = {
                occurrence: Number(cause.occurrence),
                detection: Number(cause.detection),
                preventionControl: cause.preventionControl || 'Mantenimiento preventivo',
                detectionControl: cause.detectionControl || 'Inspeccion visual',
            };
            console.log(`    Cause: "${cause.cause}" — O=${cause.occurrence}, D=${cause.detection}, prev="${cause.preventionControl}", det="${cause.detectionControl}"`);
        }
    } else {
        console.log('  WARNING: "Costura salteada" NOT found in Insert AMFE!');
        console.log('  Using conservative fallback values: S=7, O=5, D=6');
        refSeverity = 7;
        refEffectLocal = 'Puntadas ausentes en tramos del recorrido';
        refEffectNextLevel = 'Funda con costuras incompletas';
        refEffectEndUser = 'Producto no conforme / rechazo del cliente';
    }

    // -----------------------------------------------------------------------
    // STEP 2: Read Armrest AMFE
    // -----------------------------------------------------------------------
    console.log('\n  ══════════════════════════════════════');
    console.log('  STEP 2: Reading Armrest AMFE...');
    console.log('  ══════════════════════════════════════\n');

    const armrestDocs = await selectSql(
        `SELECT id, data, amfe_number FROM amfe_documents WHERE project_name = 'VWA/PATAGONIA/ARMREST_DOOR_PANEL'`
    );

    if (armrestDocs.length === 0) {
        console.error('  ERROR: Armrest AMFE not found!');
        close();
        return;
    }

    const armrestDoc = armrestDocs[0];
    const armrestData = typeof armrestDoc.data === 'string' ? JSON.parse(armrestDoc.data) : armrestDoc.data;

    console.log(`  AMFE: ${armrestDoc.amfe_number} (id: ${armrestDoc.id})`);

    // Find OP 50
    const op50 = (armrestData.operations || []).find(o => String(o.opNumber) === '50');
    if (!op50) {
        console.error('  ERROR: OP 50 not found in Armrest AMFE!');
        close();
        return;
    }

    console.log(`  Found OP 50: "${op50.opDescription || op50.description || 'COSTURA - COSTURA UNION'}"`);

    // Check if "Costura salteada" already exists
    const existingFailures = collectFailuresFlat(op50);
    const alreadyExists = existingFailures.some(f => {
        const desc = (f.description || f.failure || f.failureMode || '').toLowerCase();
        return desc.includes('costura salteada') || desc.includes('puntada salteada');
    });

    if (alreadyExists) {
        console.log('  "Costura salteada" already exists in OP 50. Nothing to do.');
        close();
        return;
    }

    console.log(`  Existing failures in OP 50: ${existingFailures.length}`);
    for (const f of existingFailures) {
        console.log(`    - "${f.description || f.failure || f.failureMode}" (S=${f.severity})`);
    }

    // -----------------------------------------------------------------------
    // STEP 3: Add new failure to Armrest OP 50
    // -----------------------------------------------------------------------
    console.log('\n  ══════════════════════════════════════');
    console.log('  STEP 3: Adding "Costura salteada" failure...');
    console.log('  ══════════════════════════════════════\n');

    // Find the workElement that has failures (machine/method workElement)
    let targetWe = null;
    let targetFn = null;
    for (const we of (op50.workElements || [])) {
        for (const fn of (we.functions || [])) {
            if ((fn.failures || []).length > 0) {
                targetWe = we;
                targetFn = fn;
                break;
            }
        }
        if (targetFn) break;
    }

    if (!targetFn) {
        console.error('  ERROR: No function with failures found in OP 50!');
        close();
        return;
    }

    console.log(`  Target workElement: "${targetWe.name || targetWe.description || 'N/A'}"`);
    console.log(`  Target function: "${targetFn.name || targetFn.description || 'N/A'}"`);

    // Build the three causes
    const causeDefs = [
        { name: 'Peine danado', lookupKey: 'peine dañado' },
        { name: 'Aguja despuntada', lookupKey: 'aguja despuntada' },
        { name: 'Hilo enredado', lookupKey: 'hilo enredado' },
    ];

    const causes = causeDefs.map(def => {
        // Try to find reference values from Insert
        let occ, det, prevCtrl, detCtrl;
        const ref = refCauseMap[def.lookupKey] || refCauseMap[def.name.toLowerCase()];
        if (ref) {
            occ = ref.occurrence;
            det = ref.detection;
            prevCtrl = ref.preventionControl;
            detCtrl = ref.detectionControl;
        } else {
            // Fallback
            console.log(`    WARNING: No Insert reference for "${def.name}", using fallback O=5, D=6`);
            occ = 5;
            det = 6;
            prevCtrl = 'Mantenimiento preventivo';
            detCtrl = 'Inspeccion visual';
        }

        const ap = calcAP(refSeverity, occ, det);

        return {
            id: randomUUID(),
            cause: def.name,
            occurrence: occ,
            detection: det,
            preventionControl: prevCtrl,
            detectionControl: detCtrl,
            ap: ap,
            characteristicNumber: '',
        };
    });

    const newFailure = {
        id: randomUUID(),
        description: 'Costura salteada',
        severity: refSeverity,
        effectLocal: refEffectLocal,
        effectNextLevel: refEffectNextLevel,
        effectEndUser: refEffectEndUser,
        causes: causes,
    };

    // Record stats before
    const statsBefore = computeStats(armrestData);

    // Add the failure
    targetFn.failures.push(newFailure);

    console.log(`  Added failure: "${newFailure.description}" (S=${newFailure.severity})`);
    for (const c of causes) {
        console.log(`    Cause: "${c.cause}" — O=${c.occurrence}, D=${c.detection}, AP=${c.ap}`);
    }

    // -----------------------------------------------------------------------
    // STEP 4: Recalculate AMFE stats
    // -----------------------------------------------------------------------
    console.log('\n  ══════════════════════════════════════');
    console.log('  STEP 4: Recalculating AMFE stats...');
    console.log('  ══════════════════════════════════════\n');

    const statsAfter = computeStats(armrestData);

    console.log('  BEFORE:');
    console.log(`    causes=${statsBefore.cause_count}, H=${statsBefore.ap_h_count}, M=${statsBefore.ap_m_count}, coverage=${statsBefore.coverage_percent}%`);
    console.log('  AFTER:');
    console.log(`    causes=${statsAfter.cause_count}, H=${statsAfter.ap_h_count}, M=${statsAfter.ap_m_count}, coverage=${statsAfter.coverage_percent}%`);

    // -----------------------------------------------------------------------
    // STEP 5: Update AMFE in Supabase
    // -----------------------------------------------------------------------
    console.log('\n  ══════════════════════════════════════');
    console.log('  STEP 5: Updating AMFE in Supabase...');
    console.log('  ══════════════════════════════════════\n');

    const amfeJsonStr = JSON.stringify(armrestData);
    const amfeChecksum = sha256(amfeJsonStr);

    await execSql(
        `UPDATE amfe_documents SET data = '${amfeJsonStr.replace(/'/g, "''")}', ` +
        `checksum = '${amfeChecksum}', ` +
        `operation_count = ${statsAfter.operation_count}, ` +
        `cause_count = ${statsAfter.cause_count}, ` +
        `ap_h_count = ${statsAfter.ap_h_count}, ` +
        `ap_m_count = ${statsAfter.ap_m_count}, ` +
        `coverage_percent = ${statsAfter.coverage_percent}, ` +
        `updated_at = NOW() ` +
        `WHERE id = '${armrestDoc.id}'`
    );

    console.log('  AMFE updated successfully.');

    // -----------------------------------------------------------------------
    // STEP 6: Read Armrest CP
    // -----------------------------------------------------------------------
    console.log('\n  ══════════════════════════════════════');
    console.log('  STEP 6: Reading Armrest CP...');
    console.log('  ══════════════════════════════════════\n');

    const cpDocs = await selectSql(
        `SELECT id, data FROM cp_documents WHERE project_name = 'VWA/PATAGONIA/ARMREST_DOOR_PANEL'`
    );

    if (cpDocs.length === 0) {
        console.error('  ERROR: Armrest CP not found!');
        close();
        return;
    }

    const cpDoc = cpDocs[0];
    const cpData = typeof cpDoc.data === 'string' ? JSON.parse(cpDoc.data) : cpDoc.data;
    const cpItems = cpData.items || [];
    const cpItemCountBefore = cpItems.length;

    console.log(`  CP doc id: ${cpDoc.id}`);
    console.log(`  Existing CP items: ${cpItemCountBefore}`);

    // -----------------------------------------------------------------------
    // STEP 7: Add CP items for each cause with AP=H or AP=M
    // -----------------------------------------------------------------------
    console.log('\n  ══════════════════════════════════════');
    console.log('  STEP 7: Adding CP items for AP=H/M causes...');
    console.log('  ══════════════════════════════════════\n');

    let cpItemsAdded = 0;

    for (const cause of causes) {
        if (cause.ap === 'H' || cause.ap === 'M') {
            const specialCharClass = refSeverity >= 9 ? 'CC' : (refSeverity >= 7 ? 'SC' : '');

            const newCpItem = {
                id: randomUUID(),
                processStepNumber: '50',
                processDescription: 'COSTURA - COSTURA UNION',
                machineDeviceTool: 'Maquina de coser',
                characteristicNumber: '',
                productCharacteristic: 'Costura salteada',
                processCharacteristic: cause.cause,
                specialCharClass: specialCharClass,
                specification: 'Sin puntadas salteadas en el recorrido de costura',
                evaluationTechnique: 'Inspeccion visual',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
                controlMethod: 'Visual',
                reactionPlan: 'Separar y evaluar',
                reactionPlanOwner: 'Supervisor de Costura',
                controlProcedure: '',
                amfeCauseIds: [cause.id],
                amfeFailureId: newFailure.id,
                amfeAp: cause.ap,
                amfeSeverity: refSeverity,
            };

            cpItems.push(newCpItem);
            cpItemsAdded++;
            console.log(`  Added CP item: process="${cause.cause}", AP=${cause.ap}, SC="${specialCharClass}"`);
        } else {
            console.log(`  Skipped cause "${cause.cause}" — AP=${cause.ap} (not H or M)`);
        }
    }

    if (cpItemsAdded === 0) {
        console.log('  No causes with AP=H or AP=M. No CP items added.');
    }

    // -----------------------------------------------------------------------
    // STEP 8: Update CP in Supabase
    // -----------------------------------------------------------------------
    console.log('\n  ══════════════════════════════════════');
    console.log('  STEP 8: Updating CP in Supabase...');
    console.log('  ══════════════════════════════════════\n');

    cpData.items = cpItems;
    const cpJsonStr = JSON.stringify(cpData);
    const cpChecksum = sha256(cpJsonStr);

    await execSql(
        `UPDATE cp_documents SET data = '${cpJsonStr.replace(/'/g, "''")}', ` +
        `checksum = '${cpChecksum}', ` +
        `item_count = ${cpItems.length}, ` +
        `updated_at = NOW() ` +
        `WHERE id = '${cpDoc.id}'`
    );

    console.log('  CP updated successfully.');

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    console.log('\n  ══════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('  ══════════════════════════════════════════════════\n');

    console.log('  AMFE Changes:');
    console.log(`    Document: ${armrestDoc.amfe_number} (Armrest Door Panel)`);
    console.log(`    Added failure: "Costura salteada" (S=${refSeverity})`);
    console.log(`    Effects: local="${newFailure.effectLocal}"`);
    console.log(`             next="${newFailure.effectNextLevel}"`);
    console.log(`             end="${newFailure.effectEndUser}"`);
    console.log('');
    console.log('    Causes added:');
    for (const c of causes) {
        console.log(`      - "${c.cause}": S=${refSeverity} O=${c.occurrence} D=${c.detection} → AP=${c.ap}`);
    }
    console.log('');
    console.log('    Stats:');
    console.log(`      Causes:   ${statsBefore.cause_count} → ${statsAfter.cause_count} (+${statsAfter.cause_count - statsBefore.cause_count})`);
    console.log(`      AP=H:     ${statsBefore.ap_h_count} → ${statsAfter.ap_h_count} (+${statsAfter.ap_h_count - statsBefore.ap_h_count})`);
    console.log(`      AP=M:     ${statsBefore.ap_m_count} → ${statsAfter.ap_m_count} (+${statsAfter.ap_m_count - statsBefore.ap_m_count})`);
    console.log(`      Coverage:  ${statsBefore.coverage_percent}% → ${statsAfter.coverage_percent}%`);
    console.log('');
    console.log('  CP Changes:');
    console.log(`    Items before: ${cpItemCountBefore}`);
    console.log(`    Items added:  ${cpItemsAdded}`);
    console.log(`    Items after:  ${cpItems.length}`);

    console.log('\n  All done.\n');
    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
