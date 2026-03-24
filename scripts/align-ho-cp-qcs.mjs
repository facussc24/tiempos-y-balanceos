#!/usr/bin/env node
/**
 * align-ho-cp-qcs.mjs
 *
 * Aligns HO quality checks with CP items for all master products.
 * For each HO sheet, finds matching CP items by operationNumber vs processStepNumber,
 * then replaces the HO sheet's qualityChecks array with fresh QCs generated from CP.
 *
 * Also updates linked_cp_project on the HO document to match the CP's controlPlanNumber.
 *
 * Usage: node scripts/align-ho-cp-qcs.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { randomUUID, createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS TO PROCESS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Each entry maps:
 *   hoProject: the linked_amfe_project used in ho_documents
 *   cpKeyword: a LIKE keyword to find the CP document (project_name may differ)
 */
const PRODUCTS = [
    { name: 'Insert',              hoProject: 'VWA/PATAGONIA/INSERT',              cpKeyword: 'INSERT' },
    { name: 'Armrest Door Panel',  hoProject: 'VWA/PATAGONIA/ARMREST_DOOR_PANEL',  cpKeyword: 'ARMREST' },
    { name: 'Headrest Front',      hoProject: 'VWA/PATAGONIA/HEADREST_FRONT',      cpKeyword: 'HEADREST_FRONT' },
    { name: 'Headrest Rear Center',hoProject: 'VWA/PATAGONIA/HEADREST_REAR_CEN',   cpKeyword: 'HEADREST_REAR_CEN' },
    { name: 'Headrest Rear Outer', hoProject: 'VWA/PATAGONIA/HEADREST_REAR_OUT',   cpKeyword: 'HEADREST_REAR_OUT' },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function parseData(row) {
    return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
}

function sha256(data) {
    return createHash('sha256').update(data).digest('hex');
}

/**
 * Build a quality check object from a CP item.
 * Returns null if the CP item has no characteristic (both product and process are empty).
 */
function cpItemToQualityCheck(cpItem) {
    const characteristic = (cpItem.productCharacteristic || '').trim() ||
                           (cpItem.processCharacteristic || '').trim();

    if (!characteristic) return null; // skip items with empty characteristic

    return {
        id: randomUUID(),
        characteristic,
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

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('='.repeat(72));
    console.log('  ALIGN HO QUALITY CHECKS WITH CP ITEMS');
    console.log('  Products: Insert, Armrest, Headrest Front/Rear Center/Rear Outer');
    console.log('='.repeat(72) + '\n');

    await initSupabase();

    const grandReport = [];

    for (const product of PRODUCTS) {
        console.log('\n' + '='.repeat(72));
        console.log(`  PRODUCT: ${product.name}`);
        console.log(`  HO project: ${product.hoProject}`);
        console.log('='.repeat(72));

        // ── 1. Load CP document ──────────────────────────────────────────
        const cpRows = await selectSql(
            `SELECT id, data, project_name FROM cp_documents WHERE project_name LIKE '%${product.cpKeyword}%'`
        );

        // For headrests, we might get multiple CPs (master + variants). Use the master (no [L*] suffix).
        let cpRow = null;
        if (cpRows.length === 0) {
            console.log(`  WARNING: No CP found for keyword '${product.cpKeyword}'. Skipping.`);
            grandReport.push({
                product: product.name,
                status: 'SKIPPED - No CP found',
                sheetsUpdated: 0,
                qcBefore: 0,
                qcAfter: 0,
                cpItemLinks: 0,
            });
            continue;
        } else if (cpRows.length === 1) {
            cpRow = cpRows[0];
        } else {
            // Pick the master (exact match to hoProject, or the one without [L*])
            cpRow = cpRows.find(r => r.project_name === product.hoProject)
                || cpRows.find(r => !r.project_name.includes('[L'))
                || cpRows[0];
        }

        console.log(`  CP found: ${cpRow.project_name} (id: ${cpRow.id.slice(0, 8)}...)`);

        const cpData = parseData(cpRow);
        const cpItems = cpData.items || [];
        const controlPlanNumber = cpData.header?.controlPlanNumber || '';

        console.log(`  CP items: ${cpItems.length}`);
        console.log(`  CP controlPlanNumber: ${controlPlanNumber || '(empty)'}`);

        // Build map: processStepNumber -> CP items[]
        const cpItemsByStep = {};
        for (const item of cpItems) {
            const step = String(item.processStepNumber || '').trim();
            if (!step) continue;
            if (!cpItemsByStep[step]) cpItemsByStep[step] = [];
            cpItemsByStep[step].push(item);
        }

        const uniqueSteps = Object.keys(cpItemsByStep).sort((a, b) => Number(a) - Number(b));
        console.log(`  CP step numbers: ${uniqueSteps.join(', ')}`);

        // ── 2. Load HO document ──────────────────────────────────────────
        const hoRows = await selectSql(
            `SELECT id, data, linked_amfe_project, linked_cp_project FROM ho_documents WHERE linked_amfe_project = '${product.hoProject}'`
        );

        if (hoRows.length === 0) {
            console.log(`  WARNING: No HO found for linked_amfe_project='${product.hoProject}'. Skipping.`);
            grandReport.push({
                product: product.name,
                status: 'SKIPPED - No HO found',
                sheetsUpdated: 0,
                qcBefore: 0,
                qcAfter: 0,
                cpItemLinks: 0,
            });
            continue;
        }

        const hoRow = hoRows[0];
        const hoData = parseData(hoRow);

        if (!hoData.sheets || !Array.isArray(hoData.sheets)) {
            console.log(`  WARNING: HO has no sheets array. Skipping.`);
            grandReport.push({
                product: product.name,
                status: 'SKIPPED - No sheets',
                sheetsUpdated: 0,
                qcBefore: 0,
                qcAfter: 0,
                cpItemLinks: 0,
            });
            continue;
        }

        console.log(`  HO found: ${hoRow.id.slice(0, 8)}... (${hoData.sheets.length} sheets)`);

        // ── 3. Process each HO sheet ─────────────────────────────────────
        let totalQcBefore = 0;
        let totalQcAfter = 0;
        let totalCpItemLinks = 0;
        let sheetsUpdated = 0;
        const sheetReports = [];

        for (const sheet of hoData.sheets) {
            const opNum = String(sheet.operationNumber || '').trim();
            const opName = sheet.operationName || '(unnamed)';

            const existingQcs = sheet.qualityChecks || [];
            totalQcBefore += existingQcs.length;

            // Find matching CP items by operationNumber == processStepNumber
            const matchingCpItems = cpItemsByStep[opNum] || [];

            if (matchingCpItems.length === 0) {
                sheetReports.push({
                    sheet: `Op ${opNum} - ${opName}`,
                    qcBefore: existingQcs.length,
                    qcAfter: existingQcs.length,
                    cpItemLinks: 0,
                    matched: false,
                    note: 'No matching CP items for this step number',
                });
                // Keep existing QCs unchanged if no CP match
                totalQcAfter += existingQcs.length;
                continue;
            }

            // Generate fresh QCs from CP items
            const newQcs = [];
            for (const cpItem of matchingCpItems) {
                const qc = cpItemToQualityCheck(cpItem);
                if (qc) newQcs.push(qc);
            }

            // Replace the sheet's quality checks
            sheet.qualityChecks = newQcs;
            totalQcAfter += newQcs.length;
            totalCpItemLinks += newQcs.length;
            sheetsUpdated++;

            sheetReports.push({
                sheet: `Op ${opNum} - ${opName}`,
                qcBefore: existingQcs.length,
                qcAfter: newQcs.length,
                cpItemLinks: newQcs.length,
                matched: true,
                note: `Matched ${matchingCpItems.length} CP items, ${newQcs.length} QCs generated`,
            });
        }

        // ── 4. Update linked_cp_project header field ─────────────────────
        if (controlPlanNumber) {
            hoData.linked_cp_project = controlPlanNumber;
        }

        // ── 5. Save back to Supabase ─────────────────────────────────────
        const jsonStr = JSON.stringify(hoData);
        const checksum = sha256(jsonStr);
        const escapedJson = jsonStr.replace(/'/g, "''");
        const linkedCpValue = controlPlanNumber
            ? `'${controlPlanNumber.replace(/'/g, "''")}'`
            : 'NULL';

        await execSql(
            `UPDATE ho_documents SET data = '${escapedJson}', linked_cp_project = ${linkedCpValue}, checksum = '${checksum}', updated_at = NOW() WHERE id = '${hoRow.id}'`
        );

        console.log(`\n  SAVED to Supabase (checksum: ${checksum.slice(0, 12)}...)`);

        // ── 6. Per-product report ────────────────────────────────────────
        console.log(`\n  ── REPORT: ${product.name} ──`);
        console.log(`  Sheets total:      ${hoData.sheets.length}`);
        console.log(`  Sheets updated:    ${sheetsUpdated}`);
        console.log(`  QCs before:        ${totalQcBefore}`);
        console.log(`  QCs after:         ${totalQcAfter}`);
        console.log(`  cpItemId links:    ${totalCpItemLinks}`);
        console.log(`  linked_cp_project: ${controlPlanNumber || '(not set)'}`);

        console.log('\n  Per-sheet detail:');
        for (const sr of sheetReports) {
            const marker = sr.matched ? 'OK' : '--';
            console.log(`    [${marker}] ${sr.sheet}: QCs ${sr.qcBefore} -> ${sr.qcAfter} (${sr.note})`);
        }

        grandReport.push({
            product: product.name,
            status: 'OK',
            sheetsTotal: hoData.sheets.length,
            sheetsUpdated,
            qcBefore: totalQcBefore,
            qcAfter: totalQcAfter,
            cpItemLinks: totalCpItemLinks,
            linkedCpProject: controlPlanNumber,
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GRAND SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n\n' + '='.repeat(72));
    console.log('  GRAND SUMMARY');
    console.log('='.repeat(72));

    console.log(`\n  ${'Product'.padEnd(25)} ${'Status'.padEnd(10)} ${'Sheets'.padStart(7)} ${'QC Before'.padStart(10)} ${'QC After'.padStart(9)} ${'Links'.padStart(6)}`);
    console.log('  ' + '-'.repeat(69));

    for (const r of grandReport) {
        const sheets = r.sheetsUpdated !== undefined ? `${r.sheetsUpdated}/${r.sheetsTotal || '?'}` : '-';
        console.log(
            `  ${r.product.padEnd(25)} ${(r.status || '').padEnd(10)} ${sheets.padStart(7)} ${String(r.qcBefore).padStart(10)} ${String(r.qcAfter).padStart(9)} ${String(r.cpItemLinks).padStart(6)}`
        );
    }

    const totalBefore = grandReport.reduce((s, r) => s + (r.qcBefore || 0), 0);
    const totalAfter = grandReport.reduce((s, r) => s + (r.qcAfter || 0), 0);
    const totalLinks = grandReport.reduce((s, r) => s + (r.cpItemLinks || 0), 0);
    console.log('  ' + '-'.repeat(69));
    console.log(`  ${'TOTAL'.padEnd(25)} ${''.padEnd(10)} ${''.padStart(7)} ${String(totalBefore).padStart(10)} ${String(totalAfter).padStart(9)} ${String(totalLinks).padStart(6)}`);

    console.log('\n' + '='.repeat(72));
    console.log('  DONE');
    console.log('='.repeat(72));

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
