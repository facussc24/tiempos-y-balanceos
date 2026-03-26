#!/usr/bin/env node
/**
 * Fix AP=H Causes Without Corrective Actions — ALL Headrest AMFE Documents
 *
 * Queries LIVE Supabase data, finds ALL causes where:
 *   - ap === 'H' (case-insensitive)
 *   - AND either:
 *     a) preventionAction AND detectionAction are both empty/undefined/null, OR
 *     b) responsible, targetDate, or status are missing
 *
 * For (a): generates realistic corrective actions based on failure context.
 * For (b): fills in the missing metadata fields.
 * Then writes the updated documents back to Supabase.
 *
 * Covers masters (L0) AND variants (L1/L2/L3).
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ============================================================================
// ACTION GENERATION — Context-based corrective actions
// ============================================================================

/**
 * Classify the failure context based on description keywords.
 * Returns a category string used to select the right corrective actions.
 */
function classifyFailureContext(failureDesc, causeDesc, opName) {
    const combined = `${failureDesc} ${causeDesc} ${opName}`.toLowerCase();

    if (combined.includes('flamab') || combined.includes('fmvss') || combined.includes('quemado')) {
        return 'flammability';
    }
    if (combined.includes('especificac') || combined.includes('toleranc') || combined.includes('dimensional') || combined.includes('espesor') || combined.includes('medida')) {
        return 'material_specification';
    }
    if (combined.includes('trazab') || combined.includes('documentac') || combined.includes('certificado') || combined.includes('registro') || combined.includes('identificac')) {
        return 'traceability';
    }
    if (combined.includes('contaminac') || combined.includes('suciedad') || combined.includes('dano') || combined.includes('embalaje') || combined.includes('golpe') || combined.includes('rayadur')) {
        return 'contamination';
    }
    return 'generic';
}

/**
 * Generate corrective actions for a given failure context category.
 */
function generateActions(category) {
    switch (category) {
        case 'flammability':
            return {
                preventionAction: 'Implementar verificación obligatoria del certificado de flamabilidad FMVSS 302 en cada recepción de material. Registrar en checklist de recepción.',
                detectionAction: 'Ensayo de flamabilidad según FMVSS 302 en laboratorio interno sobre muestra de cada lote recibido.',
            };
        case 'material_specification':
            return {
                preventionAction: 'Establecer acuerdo de calidad con proveedor incluyendo tolerancias dimensionales y criterios de aceptación. Auditoría anual al proveedor.',
                detectionAction: 'Control dimensional por muestreo en recepción según plan de inspección. Registrar resultados en sistema de trazabilidad.',
            };
        case 'traceability':
            return {
                preventionAction: 'Actualizar procedimiento de recepción para incluir verificación obligatoria de documentación y trazabilidad por lote.',
                detectionAction: 'Auditoría semanal de registros de recepción para verificar completitud de documentación.',
            };
        case 'contamination':
            return {
                preventionAction: 'Definir requisitos de embalaje y transporte con proveedores. Incluir protección contra contaminación.',
                detectionAction: 'Inspección visual 100% del estado del embalaje y material al recibir. Registro fotográfico de no conformidades.',
            };
        default:
            return {
                preventionAction: 'Implementar control preventivo en el proceso para evitar la causa raíz identificada. Capacitación del personal involucrado.',
                detectionAction: 'Control de detección según Plan de Control vigente. Registro de resultados en sistema de gestión de calidad.',
            };
    }
}

// ============================================================================
// DOCUMENT WALKING AND FIXING
// ============================================================================

/**
 * Check if a string field is empty/undefined/null.
 */
function isEmpty(val) {
    return !val || (typeof val === 'string' && val.trim() === '');
}

/**
 * Walk the AMFE document tree and fix all AP=H causes that are incomplete.
 * A cause is incomplete if:
 *   - It has no preventionAction AND no detectionAction, OR
 *   - It has actions but is missing responsible/targetDate/status
 * Returns an array of fix details for reporting.
 */
function fixDocument(doc) {
    const fixes = [];

    for (const op of (doc.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    for (const cause of (fail.causes || [])) {
                        const ap = (cause.ap || '').toUpperCase();
                        if (ap !== 'H') continue;

                        const hasPrevention = !isEmpty(cause.preventionAction);
                        const hasDetection = !isEmpty(cause.detectionAction);
                        const hasResponsible = !isEmpty(cause.responsible);
                        const hasTargetDate = !isEmpty(cause.targetDate);
                        const hasStatus = !isEmpty(cause.status);

                        const needsActions = !hasPrevention && !hasDetection;
                        const needsMetadata = !hasResponsible || !hasTargetDate || !hasStatus;

                        if (!needsActions && !needsMetadata) continue;

                        const fixDetails = [];

                        // Fill in missing actions
                        if (needsActions) {
                            const category = classifyFailureContext(
                                fail.description || '',
                                cause.cause || '',
                                op.name || ''
                            );
                            const actions = generateActions(category);
                            cause.preventionAction = actions.preventionAction;
                            cause.detectionAction = actions.detectionAction;
                            fixDetails.push(`actions [${category}]`);
                        }

                        // Fill in missing metadata
                        if (!hasResponsible) {
                            cause.responsible = 'Carlos Baptista (Ingeniería)';
                            fixDetails.push('responsible');
                        }
                        if (!hasTargetDate) {
                            cause.targetDate = '2026-07-01';
                            fixDetails.push('targetDate');
                        }
                        if (!hasStatus) {
                            cause.status = 'Pendiente';
                            fixDetails.push('status');
                        }

                        fixes.push({
                            opName: op.name || '(sin nombre)',
                            failureDesc: (fail.description || '(sin descripción)').slice(0, 80),
                            causeDesc: (cause.cause || '(sin causa)').slice(0, 80),
                            fixedFields: fixDetails.join(', '),
                        });
                    }
                }
            }
        }
    }

    return fixes;
}

/**
 * Count AP=H causes that are incomplete:
 *   - Missing both preventionAction AND detectionAction, OR
 *   - Missing responsible, targetDate, or status
 */
function countApHIncomplete(doc) {
    let count = 0;
    for (const op of (doc.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    for (const cause of (fail.causes || [])) {
                        const ap = (cause.ap || '').toUpperCase();
                        if (ap !== 'H') continue;
                        const needsActions = isEmpty(cause.preventionAction) && isEmpty(cause.detectionAction);
                        const needsMetadata = isEmpty(cause.responsible) || isEmpty(cause.targetDate) || isEmpty(cause.status);
                        if (needsActions || needsMetadata) count++;
                    }
                }
            }
        }
    }
    return count;
}

/**
 * Count total AP=H causes (for reporting).
 */
function countApH(doc) {
    let count = 0;
    for (const op of (doc.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    for (const cause of (fail.causes || [])) {
                        if ((cause.ap || '').toUpperCase() === 'H') count++;
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
    console.log('FIX AP=H CAUSES WITHOUT ACTIONS — ALL Headrest AMFE Documents');
    console.log('='.repeat(70));
    console.log('Queries LIVE Supabase data. Fixes ALL AP=H causes missing actions.');
    console.log('');

    await initSupabase();

    // 1. Query all headrest AMFE documents
    const rows = await selectSql(
        `SELECT id, project_name, data FROM amfe_documents
         WHERE project_name LIKE '%HEADREST%'
         ORDER BY project_name`
    );

    console.log(`\nFound ${rows.length} headrest AMFE documents:`);
    for (const r of rows) {
        console.log(`  - ${r.project_name} (${r.id})`);
    }

    if (rows.length === 0) {
        console.error('\nERROR: No headrest documents found!');
        close();
        process.exit(1);
    }

    // 2. Process each document
    let totalFixed = 0;
    let totalApH = 0;
    const results = [];

    for (const row of rows) {
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`Processing: ${row.project_name}`);
        console.log(`ID: ${row.id}`);

        // Parse JSON
        let doc;
        try {
            doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        } catch (e) {
            console.error(`  ERROR parsing JSON: ${e.message}`);
            results.push({ name: row.project_name, apH: 0, before: 0, fixed: 0, after: 0, fixes: [] });
            continue;
        }

        const apHTotal = countApH(doc);
        totalApH += apHTotal;
        const beforeCount = countApHIncomplete(doc);

        console.log(`  Total AP=H causes: ${apHTotal}`);
        console.log(`  AP=H incomplete (before): ${beforeCount}`);

        if (beforeCount === 0) {
            console.log(`  All AP=H causes are complete — skipping.`);
            results.push({ name: row.project_name, apH: apHTotal, before: 0, fixed: 0, after: 0, fixes: [] });
            continue;
        }

        // Fix the document
        const fixes = fixDocument(doc);
        totalFixed += fixes.length;

        // Report each fix
        for (const fix of fixes) {
            console.log(`  FIXED [${fix.fixedFields}]:`);
            console.log(`    Op: ${fix.opName}`);
            console.log(`    Failure: ${fix.failureDesc}`);
            console.log(`    Cause: ${fix.causeDesc}`);
        }

        // Verify
        const afterCount = countApHIncomplete(doc);
        console.log(`  AP=H incomplete (after): ${afterCount}`);
        console.log(`  Causes fixed in this doc: ${fixes.length}`);

        if (afterCount > 0) {
            console.error(`  WARNING: ${afterCount} AP=H causes STILL incomplete!`);
        }

        // Compute checksum and save
        const updatedData = JSON.stringify(doc);
        const checksum = createHash('sha256').update(updatedData).digest('hex');
        const escapedData = updatedData.replace(/'/g, "''");

        const updateSql = `UPDATE amfe_documents SET
            data = '${escapedData}',
            checksum = '${checksum}',
            updated_at = NOW()
            WHERE id = '${row.id}'`;

        try {
            const writeResult = await execSql(updateSql);
            console.log(`  Saved to Supabase (rows affected: ${writeResult.rowsAffected})`);
        } catch (e) {
            console.error(`  ERROR saving to Supabase: ${e.message}`);
        }

        results.push({
            name: row.project_name,
            apH: apHTotal,
            before: beforeCount,
            fixed: fixes.length,
            after: afterCount,
            fixes,
        });
    }

    // 3. Summary
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log('');
    console.log(`${'Document'.padEnd(45)} | AP=H | Before | Fixed | After`);
    console.log('─'.repeat(80));

    for (const r of results) {
        console.log(
            `${r.name.padEnd(45)} | ${String(r.apH).padStart(4)} | ${String(r.before).padStart(6)} | ${String(r.fixed).padStart(5)} | ${String(r.after).padStart(5)}`
        );
    }

    console.log('─'.repeat(80));
    console.log(`TOTAL AP=H CAUSES ACROSS ALL DOCS: ${totalApH}`);
    console.log(`TOTAL CAUSES FIXED: ${totalFixed}`);
    console.log(`REMAINING AP=H INCOMPLETE: ${results.reduce((s, r) => s + r.after, 0)}`);
    console.log('');

    if (results.reduce((s, r) => s + r.after, 0) === 0) {
        console.log('All AP=H causes now have corrective actions and metadata assigned.');
    } else {
        console.error('WARNING: Some AP=H causes still incomplete — review manually.');
    }

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
