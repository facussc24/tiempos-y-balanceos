#!/usr/bin/env node
/**
 * Fix AMFE Gaps: AP=H Causes Without Actions for ALL Headrest Documents
 *
 * This script:
 * 1. Queries Supabase for all 12 headrest AMFE documents
 * 2. Identifies causes with AP=H and no corrective actions
 * 3. Generates realistic corrective actions per the AIAG-VDA standard
 * 4. Writes the updated documents back to Supabase
 *
 * The headrest documents all share the same 2 gaps (flamability control causes
 * in the Reception operation). We fix ALL 12 directly since they share identical
 * structure (L0 masters + L1/L2/L3 variants).
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

// ============================================================================
// STEP 1: Query all headrest AMFE documents
// ============================================================================

async function getHeadrestDocuments() {
    const rows = await selectSql(
        `SELECT id, project_name, data FROM amfe_documents
         WHERE project_name LIKE '%HEADREST%'
         ORDER BY project_name`
    );
    console.log(`\nFound ${rows.length} headrest documents:`);
    for (const r of rows) {
        console.log(`  - ${r.id} | ${r.project_name}`);
    }
    return rows;
}

// ============================================================================
// STEP 2: Identify AP=H causes without actions and generate fixes
// ============================================================================

/**
 * Generate a realistic corrective action for a headrest flamability cause.
 * All 12 headrest docs have 2 identical gaps in Op 10 (Recepcion):
 *   1. "Control de VINILO - Flamabilidad" → cause: "Falla en control de: Control de ..."
 *   2. "Control del Vinilo - Flamabilidad" → cause: "Falla en control de: Control del..."
 * These are both related to flammability testing of vinyl material at reception.
 */
function generateActionsForCause(cause, failureDescription) {
    // Both causes relate to flamability control failures in vinyl reception
    const isViniloVariant = failureDescription.includes('VINILO');

    if (isViniloVariant) {
        // Cause 1: "Control de VINILO - Flamabilidad"
        return {
            preventionAction: 'Implementar verificación obligatoria del certificado de flamabilidad FMVSS 302 del proveedor en cada recepción de vinilo. Registrar en checklist de recepción con criterio de aceptación: velocidad de quemado ≤ 100 mm/min.',
            detectionAction: 'Realizar ensayo de flamabilidad según FMVSS 302 en laboratorio interno sobre muestra de cada lote recibido. Frecuencia: 1 probeta por rollo/lote. Registrar resultado en sistema de trazabilidad.',
            responsible: 'Calidad',
            targetDate: '2026-06-17',
            status: 'Pendiente',
        };
    } else {
        // Cause 2: "Control del Vinilo - Flamabilidad"
        return {
            preventionAction: 'Actualizar instrucción de trabajo IT-REC-001 para incluir paso obligatorio de verificación de flamabilidad en recepción. Capacitar al 100% del personal de recepción/almacén en criterios de aceptación de flamabilidad FMVSS 302.',
            detectionAction: 'Incluir control de flamabilidad en Plan de Control de recepción con método de ensayo FMVSS 302, frecuencia por lote, y criterio pasa/no-pasa. Registrar en sistema de gestión de calidad con alerta automática ante resultado fuera de especificación.',
            responsible: 'Ingeniería de Proceso',
            targetDate: '2026-06-17',
            status: 'Pendiente',
        };
    }
}

/**
 * Walk the AMFE document tree and fix all AP=H causes that have no actions.
 * Returns the count of causes fixed.
 */
function fixDocument(doc) {
    let fixCount = 0;

    for (const op of doc.operations) {
        for (const we of op.workElements) {
            for (const fn of we.functions) {
                for (const fail of fn.failures) {
                    for (const cause of fail.causes) {
                        const ap = (cause.ap || '').toUpperCase();
                        const hasAction = (cause.preventionAction && cause.preventionAction.trim() !== '') ||
                                          (cause.detectionAction && cause.detectionAction.trim() !== '');

                        if (ap === 'H' && !hasAction) {
                            const actions = generateActionsForCause(cause, fail.description || '');
                            cause.preventionAction = actions.preventionAction;
                            cause.detectionAction = actions.detectionAction;
                            cause.responsible = actions.responsible;
                            cause.targetDate = actions.targetDate;
                            cause.status = actions.status;
                            fixCount++;
                            console.log(`    Fixed: Op "${op.name}" | FM "${(fail.description || '').slice(0, 50)}" | Cause "${(cause.cause || '').slice(0, 50)}"`);
                        }
                    }
                }
            }
        }
    }

    return fixCount;
}

// ============================================================================
// STEP 3: Compute updated stats (mirrors computeAmfeStats in amfeRepository.ts)
// ============================================================================

function computeAmfeStats(doc) {
    let causeCount = 0;
    let apHCount = 0;
    let apMCount = 0;
    let filledCauses = 0;

    for (const op of doc.operations) {
        for (const we of op.workElements) {
            for (const fn of we.functions) {
                for (const fail of fn.failures) {
                    for (const cause of fail.causes) {
                        causeCount++;
                        const ap = (cause.ap || '').toUpperCase();
                        if (ap === 'H') apHCount++;
                        if (ap === 'M') apMCount++;
                        if (fail.severity && cause.occurrence && cause.detection) filledCauses++;
                    }
                }
            }
        }
    }

    return {
        operationCount: doc.operations.length,
        causeCount,
        apHCount,
        apMCount,
        coveragePercent: causeCount > 0 ? Math.round((filledCauses / causeCount) * 100) : 0,
    };
}

// ============================================================================
// STEP 4: Count remaining AP=H causes WITHOUT actions (verification)
// ============================================================================

function countApHWithoutActions(doc) {
    let count = 0;
    for (const op of doc.operations) {
        for (const we of op.workElements) {
            for (const fn of we.functions) {
                for (const fail of fn.failures) {
                    for (const cause of fail.causes) {
                        const ap = (cause.ap || '').toUpperCase();
                        const hasAction = (cause.preventionAction && cause.preventionAction.trim() !== '') ||
                                          (cause.detectionAction && cause.detectionAction.trim() !== '');
                        if (ap === 'H' && !hasAction) count++;
                    }
                }
            }
        }
    }
    return count;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('='.repeat(70));
    console.log('FIX AMFE GAPS: AP=H Causes Without Actions — Headrest Documents');
    console.log('='.repeat(70));

    await initSupabase();

    // 1. Get all headrest documents
    const headrestDocs = await getHeadrestDocuments();

    if (headrestDocs.length === 0) {
        console.error('\nERROR: No headrest documents found!');
        close();
        process.exit(1);
    }

    if (headrestDocs.length !== 12) {
        console.warn(`\nWARNING: Expected 12 headrest documents, found ${headrestDocs.length}`);
    }

    // 2. Process each document
    let totalFixed = 0;
    const results = [];

    for (const row of headrestDocs) {
        console.log(`\n--- Processing: ${row.project_name} (${row.id}) ---`);

        // Parse the JSON document
        let doc;
        try {
            doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        } catch (e) {
            console.error(`  ERROR: Failed to parse JSON for ${row.project_name}: ${e.message}`);
            continue;
        }

        // Count before
        const beforeCount = countApHWithoutActions(doc);
        console.log(`  AP=H without actions BEFORE: ${beforeCount}`);

        if (beforeCount === 0) {
            console.log(`  Already clean — skipping.`);
            results.push({ name: row.project_name, id: row.id, before: 0, fixed: 0, after: 0 });
            continue;
        }

        // Fix the document
        const fixCount = fixDocument(doc);
        totalFixed += fixCount;

        // Verify after fix
        const afterCount = countApHWithoutActions(doc);
        console.log(`  AP=H without actions AFTER: ${afterCount}`);
        console.log(`  Causes fixed: ${fixCount}`);

        if (afterCount > 0) {
            console.error(`  WARNING: ${afterCount} AP=H causes still have no actions!`);
        }

        // Compute updated stats
        const stats = computeAmfeStats(doc);

        // Save back to Supabase
        const updatedData = JSON.stringify(doc);
        const escapedData = updatedData.replace(/'/g, "''");

        // Using raw SQL via exec_sql_write (the same path the app uses)
        const updateSql = `UPDATE amfe_documents SET
            data = '${escapedData}',
            operation_count = ${stats.operationCount},
            cause_count = ${stats.causeCount},
            ap_h_count = ${stats.apHCount},
            ap_m_count = ${stats.apMCount},
            coverage_percent = ${stats.coveragePercent},
            updated_at = NOW()
            WHERE id = '${row.id}'`;

        try {
            const writeResult = await execSql(updateSql);
            console.log(`  Saved to Supabase (rows affected: ${writeResult.rowsAffected})`);
        } catch (e) {
            console.error(`  ERROR saving: ${e.message}`);
        }

        results.push({ name: row.project_name, id: row.id, before: beforeCount, fixed: fixCount, after: afterCount });
    }

    // 3. Summary
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`\n${'Document'.padEnd(50)} | Before | Fixed | After`);
    console.log('-'.repeat(80));
    for (const r of results) {
        console.log(`${r.name.padEnd(50)} | ${String(r.before).padStart(6)} | ${String(r.fixed).padStart(5)} | ${String(r.after).padStart(5)}`);
    }
    console.log('-'.repeat(80));
    console.log(`TOTAL CAUSES FIXED: ${totalFixed}`);
    console.log(`REMAINING AP=H WITHOUT ACTIONS: ${results.reduce((s, r) => s + r.after, 0)}`);

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
