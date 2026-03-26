#!/usr/bin/env node
/**
 * fix-cp-machine-device.mjs
 *
 * Fixes CP items where `machineDeviceTool` contains evaluation methods
 * (like "Visual", "Inspección visual") instead of actual equipment names.
 *
 * For each CP document:
 * 1. Load linked AMFE via header.linkedAmfeProject
 * 2. Build map: opNumber → Machine-type workElement name
 * 3. For each CP item with an evaluation method in machineDeviceTool:
 *    - If AMFE has a Machine-type workElement for that op → use it
 *    - Otherwise → set to "N/A"
 * 4. Save updated CP with recalculated checksum
 *
 * Usage: node scripts/fix-cp-machine-device.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ─── Patterns that are evaluation methods, NOT machines ─────────────────────
// Exact matches (case-insensitive)
const EXACT_METHOD_VALUES = new Set([
    'visual',
    'inspección visual',
    'verificación visual',
    'control visual',
    'autocontrol',
    'control visual 100%/autocontrol',
    'inspección',
    'verificación',
    'control dimensional',
    'control dimensional de la pieza',
    'recepción de materiales',
    'control con pieza patrón',
    'control inicio y fin de turno',
    'audit de producto terminado',
    'inspección dimensional y visual',
    'inspección visual de las perforaciones',
    'inspección visual posterior al corte',
    'muestra patrón',
    'control visual / muestra patrón',
    'control visual / pieza patrón',
]);

/**
 * Strip accents/diacritics from a string for fuzzy matching.
 */
function stripAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Build accent-stripped version of the set for matching without accents
const EXACT_METHOD_VALUES_NO_ACCENT = new Set(
    [...EXACT_METHOD_VALUES].map(v => stripAccents(v))
);

/**
 * Check if a machineDeviceTool value is actually an evaluation method.
 * Uses exact match against the known list (case-insensitive, accent-insensitive).
 */
function isEvaluationMethod(value) {
    if (!value || typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;

    // Exact match against the known set (with accents)
    if (EXACT_METHOD_VALUES.has(normalized)) return true;

    // Also try without accents (e.g., "Recepcion" vs "Recepción")
    const noAccent = stripAccents(normalized);
    if (EXACT_METHOD_VALUES_NO_ACCENT.has(noAccent)) return true;

    return false;
}

// ─── Build AMFE machine map ─────────────────────────────────────────────────

/**
 * From an AMFE document, build a map of opNumber → machine name.
 * Prefers workElements with type='Machine'. If multiple Machine elements
 * exist for an operation, joins them with " / ".
 */
function buildAmfeMachineMap(amfeData) {
    const map = new Map(); // opNumber → machine name

    if (!amfeData?.operations) return map;

    for (const op of amfeData.operations) {
        const opNum = (op.opNumber || '').trim();
        if (!opNum) continue;

        // Collect Machine-type work element names
        const machineNames = [];
        if (op.workElements && Array.isArray(op.workElements)) {
            for (const we of op.workElements) {
                if (we.type === 'Machine' && we.name && we.name.trim()) {
                    machineNames.push(we.name.trim());
                }
            }
        }

        if (machineNames.length > 0) {
            // Deduplicate and join
            const unique = [...new Set(machineNames)];
            map.set(opNum, unique.join(' / '));
        }
    }

    return map;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n========================================================================');
    console.log('  FIX: Corregir machineDeviceTool con métodos de evaluación en CP items');
    console.log('========================================================================\n');

    // Load all CP documents
    const cpRows = await selectSql(
        `SELECT id, project_name, data FROM cp_documents ORDER BY project_name`
    );
    console.log(`Loaded ${cpRows.length} CP documents.\n`);

    // Load all AMFE documents (for lookup)
    const amfeRows = await selectSql(
        `SELECT id, project_name, data FROM amfe_documents ORDER BY project_name`
    );
    console.log(`Loaded ${amfeRows.length} AMFE documents.\n`);

    // Build AMFE lookup: project_name → parsed data
    const amfeByProjectName = new Map();
    for (const row of amfeRows) {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        amfeByProjectName.set(row.project_name, data);
    }

    let totalItemsChecked = 0;
    let totalItemsCorrected = 0;
    let docsUpdated = 0;

    for (const row of cpRows) {
        const cpData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const cpName = row.project_name || row.id;

        if (!cpData.items || !Array.isArray(cpData.items)) {
            console.log(`  ${cpName} — no items, skipping`);
            continue;
        }

        // Find linked AMFE
        const linkedAmfe = cpData.header?.linkedAmfeProject;
        let machineMap = new Map();

        if (linkedAmfe && amfeByProjectName.has(linkedAmfe)) {
            machineMap = buildAmfeMachineMap(amfeByProjectName.get(linkedAmfe));
        } else if (linkedAmfe) {
            console.log(`  ${cpName} — linked AMFE "${linkedAmfe}" not found in DB`);
        }

        const corrections = [];
        let itemsChecked = 0;

        for (const item of cpData.items) {
            itemsChecked++;
            const currentValue = (item.machineDeviceTool || '').trim();

            if (!isEvaluationMethod(currentValue)) continue;

            // Look up machine from AMFE by processStepNumber
            const stepNum = (item.processStepNumber || '').trim();
            const amfeMachine = stepNum ? machineMap.get(stepNum) : null;

            const newValue = amfeMachine || 'N/A';

            corrections.push({
                itemId: item.id,
                step: stepNum,
                processDesc: (item.processDescription || '').substring(0, 40),
                oldValue: currentValue,
                newValue: newValue,
            });

            item.machineDeviceTool = newValue;
        }

        totalItemsChecked += itemsChecked;

        if (corrections.length > 0) {
            docsUpdated++;
            totalItemsCorrected += corrections.length;

            // Recalculate checksum
            const dataStr = JSON.stringify(cpData);
            const checksum = createHash('sha256').update(dataStr).digest('hex');
            const jsonEscaped = dataStr.replace(/'/g, "''");

            await execSql(
                `UPDATE cp_documents SET data = '${jsonEscaped}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${row.id}'`
            );

            console.log(`  ${cpName} — ${corrections.length} corrected / ${itemsChecked} items (checksum: ${checksum.slice(0, 12)}...)`);
            for (const c of corrections) {
                console.log(`    Op ${c.step} [${c.processDesc}]: "${c.oldValue}" → "${c.newValue}"`);
            }
            console.log();
        } else {
            console.log(`  ${cpName} — 0 corrections / ${itemsChecked} items ✓`);
        }
    }

    console.log('\n========================================================================');
    console.log('  SUMMARY');
    console.log('========================================================================\n');
    console.log(`  CP documents scanned:    ${cpRows.length}`);
    console.log(`  CP documents updated:    ${docsUpdated}`);
    console.log(`  Total items checked:     ${totalItemsChecked}`);
    console.log(`  Total items corrected:   ${totalItemsCorrected}`);
    console.log();

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
