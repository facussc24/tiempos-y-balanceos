#!/usr/bin/env node
/**
 * link-ho-cp-missing.mjs
 *
 * Links CPs to HO documents for Top Roll, Telas Planas, and Telas Termoformadas,
 * then regenerates quality checks on every HO sheet from the matched CP items.
 *
 * These three products have HOs with 0 quality checks because their CP was never linked.
 *
 * Steps per product:
 *   1. Find the CP document by project_name pattern
 *   2. Find the HO document by linked_amfe_project
 *   3. For each HO sheet, match CP items by processStepNumber == operationNumber
 *   4. Generate quality checks from matching CP items
 *   5. Update HO header linkedCpProject and save to Supabase
 *
 * Usage: node scripts/link-ho-cp-missing.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { randomUUID } from 'crypto';

// ─── Products to process ────────────────────────────────────────────────────

const PRODUCTS = [
    {
        name: 'Top Roll',
        hoLinkedAmfeProject: 'VWA/PATAGONIA/TOP_ROLL',
        cpPatterns: ['%TOP_ROLL%', '%TOP ROLL%', '%TOPROLL%'],
    },
    {
        name: 'Telas Planas',
        hoLinkedAmfeProject: 'PWA/TELAS_PLANAS',
        cpPatterns: ['%TELAS_PLANAS%', '%TELAS PLANAS%', '%TELASPLANAS%'],
    },
    {
        name: 'Telas Termoformadas',
        hoLinkedAmfeProject: 'PWA/TELAS_TERMOFORMADAS',
        cpPatterns: ['%TELAS_TERMOFORMADAS%', '%TELAS TERMOFORMADAS%', '%TERMOFORMADAS%'],
    },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseData(row) {
    return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
}

/**
 * Generate a quality check from a CP item.
 * Mirrors the mapping used in fix-round2-headrest-ho-kp-qc.mjs
 */
function cpItemToQualityCheck(cpItem) {
    return {
        id: randomUUID(),
        characteristic: cpItem.productCharacteristic || cpItem.processCharacteristic || '',
        specification: cpItem.specification || '',
        evaluationTechnique: cpItem.evaluationTechnique || '',
        frequency: cpItem.sampleFrequency || '',
        controlMethod: cpItem.controlMethod || '',
        reactionAction: cpItem.reactionPlan || '',
        reactionContact: cpItem.reactionPlanOwner || '',
        specialCharSymbol: cpItem.specialCharClass || '',
        registro: '',
        cpItemId: cpItem.id,
    };
}

/**
 * Check if a CP item has a non-empty characteristic (product or process).
 */
function hasCharacteristic(cpItem) {
    const prod = (cpItem.productCharacteristic || '').trim();
    const proc = (cpItem.processCharacteristic || '').trim();
    return prod.length > 0 || proc.length > 0;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('='.repeat(70));
    console.log('  Link Missing CPs to HO Documents + Regenerate Quality Checks');
    console.log('  Products: Top Roll, Telas Planas, Telas Termoformadas');
    console.log('='.repeat(70) + '\n');

    await initSupabase();

    const summary = [];

    for (const product of PRODUCTS) {
        console.log('\n' + '-'.repeat(70));
        console.log(`  Processing: ${product.name}`);
        console.log('-'.repeat(70));

        // ── Step 1: Find the CP document ────────────────────────────────
        let cpRow = null;
        for (const pattern of product.cpPatterns) {
            const rows = await selectSql(
                `SELECT id, data, project_name FROM cp_documents WHERE project_name ILIKE '${pattern}'`
            );
            if (rows.length > 0) {
                cpRow = rows[0];
                console.log(`  CP found: ${cpRow.project_name} (id: ${cpRow.id.slice(0, 8)}...)`);
                break;
            }
        }

        if (!cpRow) {
            console.log(`  WARNING: No CP document found for ${product.name}. Skipping.`);
            summary.push({
                product: product.name,
                cpFound: false,
                cpProject: null,
                cpItemCount: 0,
                hoFound: false,
                sheetsProcessed: 0,
                qcPerSheet: [],
                totalQcs: 0,
            });
            continue;
        }

        const cpData = parseData(cpRow);
        const cpItems = cpData.items || [];
        const controlPlanNumber = cpData.header?.controlPlanNumber || cpRow.project_name;
        console.log(`  CP items: ${cpItems.length}`);
        console.log(`  CP controlPlanNumber: ${controlPlanNumber}`);

        // ── Step 2: Find the HO document ────────────────────────────────
        const hoRows = await selectSql(
            `SELECT id, data, linked_amfe_project, linked_cp_project, linked_cp_id FROM ho_documents WHERE linked_amfe_project = '${product.hoLinkedAmfeProject}'`
        );

        if (hoRows.length === 0) {
            console.log(`  WARNING: No HO document found for linked_amfe_project = ${product.hoLinkedAmfeProject}. Skipping.`);
            summary.push({
                product: product.name,
                cpFound: true,
                cpProject: cpRow.project_name,
                cpItemCount: cpItems.length,
                hoFound: false,
                sheetsProcessed: 0,
                qcPerSheet: [],
                totalQcs: 0,
            });
            continue;
        }

        const hoRow = hoRows[0];
        const hoData = parseData(hoRow);
        const sheets = hoData.sheets || [];
        console.log(`  HO found: ${hoRow.id.slice(0, 8)}... (${sheets.length} sheets)`);
        console.log(`  HO current linked_cp_project: ${hoRow.linked_cp_project || '(null)'}`);
        console.log(`  HO current linked_cp_id: ${hoRow.linked_cp_id || '(null)'}`);

        // ── Step 3: For each HO sheet, match CP items and generate QCs ──
        let totalQcsGenerated = 0;
        const qcPerSheet = [];

        for (const sheet of sheets) {
            const opNum = String(sheet.operationNumber || '');
            const opName = sheet.operationName || '(unnamed)';

            // Find CP items matching this operation number
            const matchingCpItems = cpItems.filter(item => {
                return String(item.processStepNumber || '') === opNum && hasCharacteristic(item);
            });

            if (matchingCpItems.length === 0) {
                console.log(`    Sheet Op ${opNum} (${opName}): 0 matching CP items -> 0 QCs`);
                qcPerSheet.push({ op: opNum, name: opName, qcs: 0 });
                continue;
            }

            // Generate quality checks
            const qualityChecks = matchingCpItems.map(cpItemToQualityCheck);
            sheet.qualityChecks = qualityChecks;
            totalQcsGenerated += qualityChecks.length;

            console.log(`    Sheet Op ${opNum} (${opName}): ${matchingCpItems.length} CP items -> ${qualityChecks.length} QCs`);
            for (const qc of qualityChecks) {
                console.log(`      - ${qc.characteristic.substring(0, 60)}`);
            }

            qcPerSheet.push({ op: opNum, name: opName, qcs: qualityChecks.length });
        }

        // ── Step 4: Update HO header with linkedCpProject ───────────────
        if (hoData.header) {
            hoData.header.linkedCpProject = controlPlanNumber;
        }

        // ── Step 5: Save to Supabase ────────────────────────────────────
        const jsonStr = JSON.stringify(hoData);
        const escapedJson = jsonStr.replace(/'/g, "''");

        await execSql(
            `UPDATE ho_documents SET data = '${escapedJson}', linked_cp_project = '${cpRow.project_name.replace(/'/g, "''")}', linked_cp_id = '${cpRow.id}', updated_at = NOW() WHERE id = '${hoRow.id}'`
        );

        console.log(`\n  SAVED: HO updated with linked_cp_project = ${cpRow.project_name}, linked_cp_id = ${cpRow.id.slice(0, 8)}...`);
        console.log(`  Total QCs generated: ${totalQcsGenerated}`);

        summary.push({
            product: product.name,
            cpFound: true,
            cpProject: cpRow.project_name,
            cpItemCount: cpItems.length,
            hoFound: true,
            sheetsProcessed: sheets.length,
            qcPerSheet,
            totalQcs: totalQcsGenerated,
        });
    }

    // ─── Final Report ───────────────────────────────────────────────────────
    console.log('\n\n' + '='.repeat(70));
    console.log('  FINAL REPORT');
    console.log('='.repeat(70));

    for (const s of summary) {
        console.log(`\n  ${s.product}:`);
        console.log(`    CP found: ${s.cpFound ? 'YES' : 'NO'}${s.cpProject ? ' (' + s.cpProject + ')' : ''}`);
        console.log(`    CP items: ${s.cpItemCount}`);
        console.log(`    HO found: ${s.hoFound ? 'YES' : 'NO'}`);
        console.log(`    Sheets processed: ${s.sheetsProcessed}`);
        if (s.qcPerSheet.length > 0) {
            for (const q of s.qcPerSheet) {
                console.log(`      Op ${q.op} (${q.name}): ${q.qcs} QCs`);
            }
        }
        console.log(`    Total QCs generated: ${s.totalQcs}`);
    }

    const grandTotalQcs = summary.reduce((acc, s) => acc + s.totalQcs, 0);
    console.log(`\n  Grand Total QCs generated: ${grandTotalQcs}`);
    console.log('='.repeat(70));

    close();
    console.log('\nDone.');
}

main().catch((err) => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
