#!/usr/bin/env node
/**
 * fix-headrest-cp-links.mjs
 *
 * Diagnostic + Fix script for Headrest CP items missing AMFE links
 * (amfeFailureId, amfeCauseIds).
 *
 * Phase 1: Diagnostic — count linked vs unlinked items per CP
 * Phase 2: Fix — match CP items to AMFE operations/failures/causes by name
 * Phase 3: Report — summary of links created
 *
 * Usage: node scripts/fix-headrest-cp-links.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash, randomUUID } from 'crypto';

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseData(row) {
    return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
}

function normalize(s) {
    return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function generateChecksumNode(data) {
    return createHash('sha256').update(data).digest('hex');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    // =========================================================================
    // PHASE 1: DIAGNOSTIC
    // =========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('  PHASE 1: DIAGNOSTIC — Loading Headrest CPs and AMFEs');
    console.log('='.repeat(70));

    // 1a. Load ALL Headrest CPs
    const cpRows = await selectSql(
        `SELECT id, project_name, linked_amfe_id, linked_amfe_project, data
         FROM cp_documents WHERE project_name LIKE '%HEADREST%'
         ORDER BY project_name`
    );
    console.log(`\nFound ${cpRows.length} Headrest CP documents:`);
    for (const r of cpRows) {
        console.log(`  - ${r.project_name} (id: ${r.id.slice(0, 8)}..., linked_amfe_id: ${r.linked_amfe_id || 'NULL'})`);
    }

    // 1b. Load ALL Headrest AMFEs
    const amfeRows = await selectSql(
        `SELECT id, project_name, data
         FROM amfe_documents WHERE project_name LIKE '%HEADREST%'
         ORDER BY project_name`
    );
    console.log(`\nFound ${amfeRows.length} Headrest AMFE documents:`);
    for (const r of amfeRows) {
        console.log(`  - ${r.project_name} (id: ${r.id.slice(0, 8)}...)`);
    }

    // 1c. Parse AMFE data into a map by id
    const amfeById = new Map();
    for (const row of amfeRows) {
        amfeById.set(row.id, { ...row, parsed: parseData(row) });
    }

    // Also build a map by project_name for fallback matching
    const amfeByProject = new Map();
    for (const row of amfeRows) {
        amfeByProject.set(row.project_name, { ...row, parsed: parseData(row) });
    }

    // 1d. Diagnostic per CP
    console.log('\n' + '-'.repeat(70));
    console.log('  Diagnostic: AMFE link status per CP');
    console.log('-'.repeat(70));

    let grandTotalItems = 0;
    let grandWithFailureId = 0;
    let grandWithoutFailureId = 0;
    let grandWithCauseIds = 0;
    let grandWithoutCauseIds = 0;

    const cpParsed = []; // Store parsed CPs for Phase 2

    for (const cpRow of cpRows) {
        const cpData = parseData(cpRow);
        const items = cpData.items || [];
        const total = items.length;
        const withFailureId = items.filter(i => i.amfeFailureId && i.amfeFailureId.trim()).length;
        const withoutFailureId = total - withFailureId;
        const withCauseIds = items.filter(i => Array.isArray(i.amfeCauseIds) && i.amfeCauseIds.length > 0).length;
        const withoutCauseIds = total - withCauseIds;

        console.log(`\n  CP: ${cpRow.project_name}`);
        console.log(`    Total items:          ${total}`);
        console.log(`    With amfeFailureId:   ${withFailureId}`);
        console.log(`    WITHOUT amfeFailureId: ${withoutFailureId}`);
        console.log(`    With amfeCauseIds:    ${withCauseIds}`);
        console.log(`    WITHOUT amfeCauseIds:  ${withoutCauseIds}`);
        console.log(`    linked_amfe_id:       ${cpRow.linked_amfe_id || 'NULL'}`);

        grandTotalItems += total;
        grandWithFailureId += withFailureId;
        grandWithoutFailureId += withoutFailureId;
        grandWithCauseIds += withCauseIds;
        grandWithoutCauseIds += withoutCauseIds;

        cpParsed.push({ row: cpRow, data: cpData, items });
    }

    console.log('\n' + '-'.repeat(70));
    console.log('  DIAGNOSTIC SUMMARY');
    console.log('-'.repeat(70));
    console.log(`  Total Headrest CP items:    ${grandTotalItems}`);
    console.log(`  With amfeFailureId:         ${grandWithFailureId}`);
    console.log(`  WITHOUT amfeFailureId:      ${grandWithoutFailureId}`);
    console.log(`  With amfeCauseIds:          ${grandWithCauseIds}`);
    console.log(`  WITHOUT amfeCauseIds:       ${grandWithoutCauseIds}`);

    if (grandWithoutFailureId === 0 && grandWithoutCauseIds === 0) {
        console.log('\n  All Headrest CP items already have AMFE links. Nothing to fix.');
        close();
        return;
    }

    // =========================================================================
    // PHASE 2: FIX — Match CP items to AMFE data
    // =========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('  PHASE 2: FIX — Linking CP items to AMFE failures/causes');
    console.log('='.repeat(70));

    let totalLinked = 0;
    let totalCouldNotLink = 0;
    let totalAlreadyLinked = 0;
    const perCpResults = [];

    for (const { row: cpRow, data: cpData, items } of cpParsed) {
        console.log(`\n--- Processing CP: ${cpRow.project_name} ---`);

        // 2a. Find the linked AMFE
        let amfeData = null;
        let amfeId = null;

        // Strategy 1: Use linked_amfe_id from cp_documents row
        if (cpRow.linked_amfe_id && amfeById.has(cpRow.linked_amfe_id)) {
            amfeData = amfeById.get(cpRow.linked_amfe_id).parsed;
            amfeId = cpRow.linked_amfe_id;
            console.log(`  Linked AMFE found via linked_amfe_id: ${amfeId.slice(0, 8)}...`);
        }

        // Strategy 2: Match by project name pattern
        // CP: VWA/PATAGONIA/HEADREST_FRONT [L1] -> AMFE: VWA/PATAGONIA/HEADREST_FRONT [L1]
        if (!amfeData) {
            const cpProjectName = cpRow.project_name;
            if (amfeByProject.has(cpProjectName)) {
                const match = amfeByProject.get(cpProjectName);
                amfeData = match.parsed;
                amfeId = match.id;
                console.log(`  Linked AMFE found via exact project_name match: ${amfeId.slice(0, 8)}...`);
            }
        }

        // Strategy 3: Match by linked_amfe_project in header
        if (!amfeData && cpData.header?.linkedAmfeProject) {
            const lap = cpData.header.linkedAmfeProject;
            if (amfeByProject.has(lap)) {
                const match = amfeByProject.get(lap);
                amfeData = match.parsed;
                amfeId = match.id;
                console.log(`  Linked AMFE found via header.linkedAmfeProject (${lap}): ${amfeId.slice(0, 8)}...`);
            }
        }

        if (!amfeData) {
            console.log(`  WARNING: No matching AMFE found for CP ${cpRow.project_name}. Skipping.`);
            totalCouldNotLink += items.filter(i => !i.amfeFailureId || !i.amfeFailureId.trim()).length;
            perCpResults.push({
                name: cpRow.project_name,
                linked: 0,
                notLinked: items.filter(i => !i.amfeFailureId || !i.amfeFailureId.trim()).length,
                alreadyLinked: items.filter(i => i.amfeFailureId && i.amfeFailureId.trim()).length,
            });
            continue;
        }

        // 2b. Build AMFE lookup structures
        // Map: normalized operation name -> operation data (with all nested failures/causes)
        const opByName = new Map();
        // Map: normalized operation opNumber -> operation data
        const opByNumber = new Map();

        for (const op of (amfeData.operations || [])) {
            opByName.set(normalize(op.name), op);
            opByNumber.set(normalize(op.opNumber), op);
        }

        // 2c. For each CP item without amfeFailureId, try to match
        let linkedThisCp = 0;
        let couldNotLinkThisCp = 0;
        let alreadyLinkedThisCp = 0;
        let modified = false;

        for (const item of items) {
            // Skip items that already have links
            if (item.amfeFailureId && item.amfeFailureId.trim()) {
                alreadyLinkedThisCp++;
                continue;
            }

            // Find matching AMFE operation
            const normalizedDesc = normalize(item.processDescription);
            const normalizedStep = normalize(item.processStepNumber);
            let matchedOp = opByName.get(normalizedDesc) || opByNumber.get(normalizedStep);

            // Fallback: try partial match on operation name
            if (!matchedOp) {
                for (const [normName, op] of opByName) {
                    if (normName.includes(normalizedDesc) || normalizedDesc.includes(normName)) {
                        matchedOp = op;
                        break;
                    }
                }
            }

            // Fallback: match by opNumber in processStepNumber
            if (!matchedOp) {
                for (const op of (amfeData.operations || [])) {
                    if (normalize(op.opNumber) === normalizedStep) {
                        matchedOp = op;
                        break;
                    }
                }
            }

            if (!matchedOp) {
                couldNotLinkThisCp++;
                continue;
            }

            // 2d. Within the matched operation, find the best failure/cause match
            let bestFailure = null;
            let bestCauses = [];
            let bestScore = -1;

            for (const we of (matchedOp.workElements || [])) {
                for (const func of (we.functions || [])) {
                    for (const fail of (func.failures || [])) {
                        let score = 0;
                        const matchingCauses = [];

                        // Check if CP item is a PRODUCT characteristic row (has productCharacteristic)
                        if (item.productCharacteristic && item.productCharacteristic.trim()) {
                            // Product row: match failure.description to productCharacteristic
                            const normProd = normalize(item.productCharacteristic);
                            const normFailDesc = normalize(fail.description);

                            if (normProd === normFailDesc) {
                                score += 10; // Exact match
                            } else if (normProd.includes(normFailDesc) || normFailDesc.includes(normProd)) {
                                score += 5; // Partial match
                            }

                            // Also try matching evaluationTechnique to detectionControl
                            for (const cause of (fail.causes || [])) {
                                const normEval = normalize(item.evaluationTechnique);
                                const normDet = normalize(cause.detectionControl);
                                if (normEval && normDet && (normEval === normDet || normEval.includes(normDet) || normDet.includes(normEval))) {
                                    matchingCauses.push(cause);
                                    score += 3;
                                }
                            }

                            // If no cause matched by detection, add all causes of the matched failure
                            if (matchingCauses.length === 0 && score > 0) {
                                matchingCauses.push(...(fail.causes || []));
                            }
                        }

                        // Check if CP item is a PROCESS characteristic row (has processCharacteristic)
                        if (item.processCharacteristic && item.processCharacteristic.trim()) {
                            const normProc = normalize(item.processCharacteristic);

                            for (const cause of (fail.causes || [])) {
                                const normCause = normalize(cause.cause);

                                if (normProc === normCause) {
                                    score += 10; // Exact match
                                    matchingCauses.push(cause);
                                } else if (normProc.includes(normCause) || normCause.includes(normProc)) {
                                    score += 5; // Partial match
                                    matchingCauses.push(cause);
                                }

                                // Also try matching controlMethod to preventionControl
                                const normCtrl = normalize(item.controlMethod);
                                const normPrev = normalize(cause.preventionControl);
                                if (normCtrl && normPrev && (normCtrl === normPrev || normCtrl.includes(normPrev) || normPrev.includes(normCtrl))) {
                                    if (!matchingCauses.includes(cause)) {
                                        matchingCauses.push(cause);
                                    }
                                    score += 3;
                                }
                            }

                            // If no cause matched by name, add all causes of the failure
                            if (matchingCauses.length === 0 && score > 0) {
                                matchingCauses.push(...(fail.causes || []));
                            }
                        }

                        if (score > bestScore && (score > 0 || matchingCauses.length > 0)) {
                            bestScore = score;
                            bestFailure = fail;
                            bestCauses = matchingCauses;
                        }
                    }
                }
            }

            // Fallback: if no match by characteristic text, take the first failure
            // of the matched operation (better than no link at all)
            if (!bestFailure) {
                for (const we of (matchedOp.workElements || [])) {
                    for (const func of (we.functions || [])) {
                        if (func.failures && func.failures.length > 0) {
                            bestFailure = func.failures[0];
                            bestCauses = bestFailure.causes || [];
                            break;
                        }
                    }
                    if (bestFailure) break;
                }
            }

            if (!bestFailure) {
                couldNotLinkThisCp++;
                continue;
            }

            // 2e. Populate AMFE link fields
            item.amfeFailureId = bestFailure.id;
            item.amfeFailureIds = [bestFailure.id];
            item.amfeCauseIds = bestCauses.length > 0
                ? [...new Set(bestCauses.map(c => c.id))]
                : [];
            item.amfeSeverity = Number(bestFailure.severity) || undefined;

            // Set amfeAp from the best matching cause (pick highest AP)
            if (bestCauses.length > 0) {
                if (bestCauses.some(c => c.ap === 'H')) {
                    item.amfeAp = 'H';
                } else if (bestCauses.some(c => c.ap === 'M')) {
                    item.amfeAp = 'M';
                } else if (bestCauses.some(c => c.ap === 'L')) {
                    item.amfeAp = 'L';
                }
            }

            linkedThisCp++;
            modified = true;
        }

        alreadyLinkedThisCp = items.filter(i => i.amfeFailureId && i.amfeFailureId.trim()).length - linkedThisCp;
        // Recalculate: alreadyLinkedThisCp is items that had links BEFORE we started
        const preExisting = items.length - (linkedThisCp + couldNotLinkThisCp);
        // Actually let's count correctly from the counters we already have
        alreadyLinkedThisCp = items.length - linkedThisCp - couldNotLinkThisCp;

        console.log(`  Results: ${linkedThisCp} linked, ${couldNotLinkThisCp} could not link, ${alreadyLinkedThisCp} already had links`);

        totalLinked += linkedThisCp;
        totalCouldNotLink += couldNotLinkThisCp;
        totalAlreadyLinked += alreadyLinkedThisCp;

        perCpResults.push({
            name: cpRow.project_name,
            linked: linkedThisCp,
            notLinked: couldNotLinkThisCp,
            alreadyLinked: alreadyLinkedThisCp,
        });

        // 2f. Save if modified
        if (modified) {
            const jsonData = JSON.stringify(cpData);
            const checksum = generateChecksumNode(jsonData);
            const escapedJson = jsonData.replace(/'/g, "''");
            const itemCount = items.length;

            await execSql(
                `UPDATE cp_documents SET data = '${escapedJson}', checksum = '${checksum}', item_count = ${itemCount}, updated_at = NOW() WHERE id = '${cpRow.id}'`
            );
            console.log(`  Saved CP ${cpRow.project_name} (checksum: ${checksum.slice(0, 16)}...)`);
        }
    }

    // =========================================================================
    // PHASE 3: REPORT
    // =========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('  PHASE 3: FINAL REPORT');
    console.log('='.repeat(70));

    console.log('\n  Per-CP Results:');
    console.log('  ' + '-'.repeat(66));
    console.log(`  ${'CP Name'.padEnd(40)} ${'Linked'.padStart(7)} ${'NoMatch'.padStart(8)} ${'PreExist'.padStart(9)}`);
    console.log('  ' + '-'.repeat(66));
    for (const r of perCpResults) {
        console.log(`  ${r.name.padEnd(40)} ${String(r.linked).padStart(7)} ${String(r.notLinked).padStart(8)} ${String(r.alreadyLinked).padStart(9)}`);
    }
    console.log('  ' + '-'.repeat(66));

    console.log(`\n  TOTALS:`);
    console.log(`    Total Headrest CP items:     ${grandTotalItems}`);
    console.log(`    Newly linked (this run):     ${totalLinked}`);
    console.log(`    Could NOT link (no match):   ${totalCouldNotLink}`);
    console.log(`    Already had links:           ${totalAlreadyLinked}`);
    console.log(`    Total links created:         ${totalLinked}`);

    // Verification pass
    if (totalLinked > 0) {
        console.log('\n  --- Verification ---');
        const verifRows = await selectSql(
            `SELECT project_name, item_count FROM cp_documents WHERE project_name LIKE '%HEADREST%' ORDER BY project_name`
        );
        for (const v of verifRows) {
            console.log(`  ${v.project_name}: ${v.item_count} items`);
        }
    }

    close();
    console.log('\nDone.');
}

main().catch((err) => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
