#!/usr/bin/env node
/**
 * Audit CC/SC Classification in ALL Control Plans
 * Cross-referenced with linked AMFEs.
 *
 * Classification Rules (AIAG-VDA 2019 + IATF 16949):
 *   CC (Critical)     = Severity 9-10
 *   SC (Significant)  = Severity 5-8 AND max(Occurrence) >= 4
 *   Unclassified ('')  = Severity 1-4, OR Severity 5-8 with max(O) < 4
 *
 * Current WRONG logic in code:
 *   severity >= 9 ? 'CC' : severity >= 5 ? 'SC' : ''
 *   (ignores Occurrence for SC entirely)
 */

import { initSupabase, selectSql, close } from './supabaseHelper.mjs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/**
 * CORRECT classification per AIAG-VDA 2019 + IATF 16949.
 * @param {number} severity  - S value (from AMFE failure)
 * @param {number} maxOccurrence - max O value across linked causes
 * @returns {string} 'CC' | 'SC' | ''
 */
function correctClassification(severity, maxOccurrence) {
    if (severity >= 9) return 'CC';
    if (severity >= 5 && severity <= 8 && maxOccurrence >= 4) return 'SC';
    return '';
}

/**
 * Pad or truncate string to fixed width for table formatting.
 */
function pad(str, width, align = 'left') {
    const s = String(str ?? '');
    if (s.length >= width) return s.slice(0, width);
    return align === 'right' ? s.padStart(width) : s.padEnd(width);
}

function padCenter(str, width) {
    const s = String(str ?? '');
    if (s.length >= width) return s.slice(0, width);
    const left = Math.floor((width - s.length) / 2);
    return s.padStart(left + s.length).padEnd(width);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n========================================================================');
    console.log('  AUDIT: CC/SC Classification — All CPs cross-referenced with AMFEs');
    console.log('========================================================================\n');

    // 1) Load ALL CP documents
    const cpRows = await selectSql(
        `SELECT id, project_name, control_plan_number, linked_amfe_id, data FROM cp_documents ORDER BY project_name`
    );
    console.log(`Loaded ${cpRows.length} CP documents.`);

    // 2) Load ALL AMFE documents
    const amfeRows = await selectSql(
        `SELECT id, amfe_number, project_name, data FROM amfe_documents ORDER BY project_name`
    );
    console.log(`Loaded ${amfeRows.length} AMFE documents.\n`);

    // Build AMFE map: id → parsed document
    const amfeMap = new Map();
    for (const row of amfeRows) {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        amfeMap.set(row.id, {
            id: row.id,
            amfeNumber: row.amfe_number,
            projectName: row.project_name,
            data,
        });
    }

    // ─── Per-product accumulators ─────────────────────────────────────────────
    const productSummaries = [];     // { name, ccNow, scNow, emptyNow, ccCorrect, scCorrect, emptyCorrect, ptcNow }
    const changeItems = [];          // items where current != correct
    const ccWithLowSev = [];         // CC with S < 9
    const scWrongItems = [];         // SC with S < 5 or O < 4
    const shouldBeCc = [];           // S >= 9 but not CC
    const shouldBeSc = [];           // S 5-8, O >= 4, but not SC
    const needsManualReview = [];    // no AMFE links and no amfeSeverity
    let totalItems = 0;
    let totalChanges = 0;

    // ─── Process each CP ──────────────────────────────────────────────────────
    for (const cpRow of cpRows) {
        const cpData = typeof cpRow.data === 'string' ? JSON.parse(cpRow.data) : cpRow.data;
        const cpItems = cpData?.items || [];
        const cpName = cpRow.project_name || cpRow.control_plan_number || cpRow.id;
        const linkedAmfeId = cpRow.linked_amfe_id;

        // Build AMFE lookup maps for this CP
        const failureSeverityMap = new Map();   // failure.id → severity (number)
        const causeOccurrenceMap = new Map();    // cause.id → occurrence (number)
        const failureCauseIdsMap = new Map();    // failure.id → [cause.id, ...]

        if (linkedAmfeId && amfeMap.has(linkedAmfeId)) {
            const amfe = amfeMap.get(linkedAmfeId);
            const ops = amfe.data?.operations || [];
            for (const op of ops) {
                for (const we of (op.workElements || [])) {
                    for (const func of (we.functions || [])) {
                        for (const fail of (func.failures || [])) {
                            const sev = toNum(fail.severity);
                            if (fail.id) {
                                failureSeverityMap.set(fail.id, sev);
                                const causeIds = [];
                                for (const cause of (fail.causes || [])) {
                                    const occ = toNum(cause.occurrence);
                                    if (cause.id) {
                                        causeOccurrenceMap.set(cause.id, occ);
                                        causeIds.push(cause.id);
                                    }
                                }
                                failureCauseIdsMap.set(fail.id, causeIds);
                            }
                        }
                    }
                }
            }
        }

        let ccNow = 0, scNow = 0, emptyNow = 0, ptcNow = 0;
        let ccCorrect = 0, scCorrect = 0, emptyCorrect = 0;

        for (const item of cpItems) {
            totalItems++;

            const currentClass = (item.specialCharClass || '').trim().toUpperCase();
            if (currentClass === 'CC') ccNow++;
            else if (currentClass === 'SC') scNow++;
            else if (currentClass === 'PTC') ptcNow++;
            else emptyNow++;

            // ── Resolve Severity from AMFE links ──
            let severity = null;
            let maxOccurrence = null;
            let linkMethod = 'none';

            // Try amfeFailureId first
            const failureId = item.amfeFailureId;
            const failureIds = item.amfeFailureIds || [];
            const causeIds = item.amfeCauseIds || [];

            // Gather all failure IDs to check
            const allFailureIds = new Set();
            if (failureId) allFailureIds.add(failureId);
            for (const fid of failureIds) allFailureIds.add(fid);

            // Get max severity across all linked failures
            for (const fid of allFailureIds) {
                if (failureSeverityMap.has(fid)) {
                    const s = failureSeverityMap.get(fid);
                    if (severity === null || s > severity) severity = s;
                    linkMethod = 'amfe_failure_link';
                }
            }

            // Get max occurrence across linked causes
            if (causeIds.length > 0) {
                for (const cid of causeIds) {
                    if (causeOccurrenceMap.has(cid)) {
                        const o = causeOccurrenceMap.get(cid);
                        if (maxOccurrence === null || o > maxOccurrence) maxOccurrence = o;
                    }
                }
            }

            // If no cause IDs but we have failure IDs, get all causes from those failures
            if (maxOccurrence === null && allFailureIds.size > 0) {
                for (const fid of allFailureIds) {
                    const cids = failureCauseIdsMap.get(fid) || [];
                    for (const cid of cids) {
                        if (causeOccurrenceMap.has(cid)) {
                            const o = causeOccurrenceMap.get(cid);
                            if (maxOccurrence === null || o > maxOccurrence) maxOccurrence = o;
                        }
                    }
                }
            }

            // Fallback: use amfeSeverity stored on the CP item
            if (severity === null && item.amfeSeverity != null) {
                severity = toNum(item.amfeSeverity);
                linkMethod = 'cp_amfeSeverity_field';
                // We don't have occurrence data in this case — will be null
            }

            // ── Calculate correct classification ──
            let correct;
            let reason = '';

            if (severity === null) {
                // No severity data at all — skip PTC items (they're a different concept)
                if (currentClass === 'PTC') {
                    // PTC = Pass-Through Characteristic, not severity-based
                    correct = 'PTC';
                    reason = 'PTC (pass-through, not severity-based)';
                } else {
                    correct = 'NEEDS_REVIEW';
                    reason = 'No AMFE link and no amfeSeverity — needs manual review';
                    needsManualReview.push({
                        cpName,
                        processDesc: item.processDescription || '(no desc)',
                        currentClass: currentClass || '(empty)',
                        itemId: item.id,
                    });
                }
            } else if (severity === 0 && linkMethod === 'cp_amfeSeverity_field') {
                // amfeSeverity = 0 likely means "not set"
                correct = 'NEEDS_REVIEW';
                reason = 'amfeSeverity = 0 (likely not populated)';
                needsManualReview.push({
                    cpName,
                    processDesc: item.processDescription || '(no desc)',
                    currentClass: currentClass || '(empty)',
                    itemId: item.id,
                });
            } else {
                const effectiveOcc = maxOccurrence !== null ? maxOccurrence : 0;
                correct = correctClassification(severity, effectiveOcc);
                if (correct === 'CC') reason = `S=${severity} >= 9 → CC`;
                else if (correct === 'SC') reason = `S=${severity} (5-8) AND max(O)=${effectiveOcc} >= 4 → SC`;
                else if (severity >= 5 && effectiveOcc < 4) reason = `S=${severity} (5-8) but max(O)=${effectiveOcc} < 4 → Unclassified`;
                else reason = `S=${severity} < 5 → Unclassified`;
            }

            // Count corrects (skip NEEDS_REVIEW and PTC)
            if (correct === 'CC') ccCorrect++;
            else if (correct === 'SC') scCorrect++;
            else if (correct !== 'NEEDS_REVIEW' && correct !== 'PTC') emptyCorrect++;

            // ── Compare current vs correct ──
            if (correct !== 'NEEDS_REVIEW' && correct !== 'PTC') {
                const normalizedCurrent = currentClass === 'PTC' ? '' : currentClass;
                if (normalizedCurrent !== correct) {
                    totalChanges++;
                    const effectiveOcc = maxOccurrence !== null ? maxOccurrence : 'N/A';
                    changeItems.push({
                        cpName,
                        processDesc: item.processDescription || '(no desc)',
                        currentClass: currentClass || '(empty)',
                        correctClass: correct || '(empty)',
                        severity: severity ?? 'N/A',
                        maxOcc: effectiveOcc,
                        reason,
                        linkMethod,
                    });

                    // Sub-categorize
                    if (currentClass === 'CC' && severity !== null && severity < 9) {
                        ccWithLowSev.push({
                            cpName,
                            processDesc: item.processDescription || '(no desc)',
                            severity,
                            maxOcc: effectiveOcc,
                        });
                    }
                    if (currentClass === 'SC' && (severity === null || severity < 5 || (maxOccurrence !== null && maxOccurrence < 4))) {
                        scWrongItems.push({
                            cpName,
                            processDesc: item.processDescription || '(no desc)',
                            severity: severity ?? 'N/A',
                            maxOcc: effectiveOcc,
                        });
                    }
                    if (correct === 'CC' && currentClass !== 'CC') {
                        shouldBeCc.push({
                            cpName,
                            processDesc: item.processDescription || '(no desc)',
                            currentClass: currentClass || '(empty)',
                            severity,
                        });
                    }
                    if (correct === 'SC' && currentClass !== 'SC') {
                        shouldBeSc.push({
                            cpName,
                            processDesc: item.processDescription || '(no desc)',
                            currentClass: currentClass || '(empty)',
                            severity,
                            maxOcc: effectiveOcc,
                        });
                    }
                }
            }
        }

        productSummaries.push({
            name: cpName,
            ccNow, scNow, ptcNow, emptyNow,
            ccCorrect, scCorrect, emptyCorrect,
            totalItems: cpItems.length,
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // REPORT
    // ═════════════════════════════════════════════════════════════════════════

    // ── (a) Per-product summary table ──
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('  (a) PER-PRODUCT SUMMARY TABLE');
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    const nameW = 40;
    const colW = 8;
    const header = `${pad('Product Name', nameW)} | ${padCenter('CC', colW)} | ${padCenter('SC', colW)} | ${padCenter('PTC', colW)} | ${padCenter('Empty', colW)} || ${padCenter('CC*', colW)} | ${padCenter('SC*', colW)} | ${padCenter('Empty*', colW)} | ${padCenter('Total', colW)}`;
    const separator = '-'.repeat(header.length);

    console.log(`  ${pad('', nameW)}   ──── CURRENT ────────────────────   ── CORRECT ────────────────────`);
    console.log(`  ${header}`);
    console.log(`  ${separator}`);

    let totCcNow = 0, totScNow = 0, totPtcNow = 0, totEmptyNow = 0;
    let totCcCorr = 0, totScCorr = 0, totEmptyCorr = 0, totAllItems = 0;

    for (const p of productSummaries) {
        totCcNow += p.ccNow;
        totScNow += p.scNow;
        totPtcNow += p.ptcNow;
        totEmptyNow += p.emptyNow;
        totCcCorr += p.ccCorrect;
        totScCorr += p.scCorrect;
        totEmptyCorr += p.emptyCorrect;
        totAllItems += p.totalItems;

        console.log(`  ${pad(p.name, nameW)} | ${padCenter(p.ccNow, colW)} | ${padCenter(p.scNow, colW)} | ${padCenter(p.ptcNow, colW)} | ${padCenter(p.emptyNow, colW)} || ${padCenter(p.ccCorrect, colW)} | ${padCenter(p.scCorrect, colW)} | ${padCenter(p.emptyCorrect, colW)} | ${padCenter(p.totalItems, colW)}`);
    }

    console.log(`  ${separator}`);
    console.log(`  ${pad('TOTAL', nameW)} | ${padCenter(totCcNow, colW)} | ${padCenter(totScNow, colW)} | ${padCenter(totPtcNow, colW)} | ${padCenter(totEmptyNow, colW)} || ${padCenter(totCcCorr, colW)} | ${padCenter(totScCorr, colW)} | ${padCenter(totEmptyCorr, colW)} | ${padCenter(totAllItems, colW)}`);
    console.log();

    // ── (b) Items that would CHANGE classification ──
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`  (b) ITEMS THAT WOULD CHANGE CLASSIFICATION (${changeItems.length} total)`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    if (changeItems.length === 0) {
        console.log('  (none)\n');
    } else {
        for (const c of changeItems) {
            console.log(`  CP: ${c.cpName}`);
            console.log(`    Item: ${c.processDesc}`);
            console.log(`    Current: ${c.currentClass}  →  Correct: ${c.correctClass}`);
            console.log(`    S=${c.severity}, max(O)=${c.maxOcc}`);
            console.log(`    Reason: ${c.reason}`);
            console.log(`    Link method: ${c.linkMethod}`);
            console.log();
        }
    }

    // ── (c) CC with S < 9 (definite errors) ──
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`  (c) ITEMS MARKED CC WITH S < 9 — DEFINITE ERRORS (${ccWithLowSev.length})`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    if (ccWithLowSev.length === 0) {
        console.log('  (none)\n');
    } else {
        for (const c of ccWithLowSev) {
            console.log(`  CP: ${c.cpName} | Item: ${c.processDesc} | S=${c.severity}, max(O)=${c.maxOcc}`);
        }
        console.log();
    }

    // ── (d) SC with S < 5 or O < 4 (errors per new criteria) ──
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`  (d) ITEMS MARKED SC WITH S < 5 OR O < 4 — ERRORS (${scWrongItems.length})`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    if (scWrongItems.length === 0) {
        console.log('  (none)\n');
    } else {
        for (const c of scWrongItems) {
            console.log(`  CP: ${c.cpName} | Item: ${c.processDesc} | S=${c.severity}, max(O)=${c.maxOcc}`);
        }
        console.log();
    }

    // ── (e) Items that SHOULD be CC but aren't ──
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`  (e) ITEMS THAT SHOULD BE CC BUT AREN'T (${shouldBeCc.length})`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    if (shouldBeCc.length === 0) {
        console.log('  (none)\n');
    } else {
        for (const c of shouldBeCc) {
            console.log(`  CP: ${c.cpName} | Item: ${c.processDesc} | Current: ${c.currentClass} | S=${c.severity}`);
        }
        console.log();
    }

    // ── (f) Items that SHOULD be SC but aren't ──
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`  (f) ITEMS THAT SHOULD BE SC BUT AREN'T (${shouldBeSc.length})`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    if (shouldBeSc.length === 0) {
        console.log('  (none)\n');
    } else {
        for (const c of shouldBeSc) {
            console.log(`  CP: ${c.cpName} | Item: ${c.processDesc} | Current: ${c.currentClass} | S=${c.severity}, max(O)=${c.maxOcc}`);
        }
        console.log();
    }

    // ── (g) Items needing manual review ──
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`  (g) ITEMS NEEDING MANUAL REVIEW — NO AMFE DATA (${needsManualReview.length})`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    if (needsManualReview.length === 0) {
        console.log('  (none)\n');
    } else {
        // Group by CP for readability
        const byCP = new Map();
        for (const nr of needsManualReview) {
            if (!byCP.has(nr.cpName)) byCP.set(nr.cpName, []);
            byCP.get(nr.cpName).push(nr);
        }
        for (const [cpName, items] of byCP) {
            console.log(`  CP: ${cpName} (${items.length} items without AMFE data)`);
            for (const it of items.slice(0, 5)) {
                console.log(`    - ${it.processDesc} [current: ${it.currentClass}]`);
            }
            if (items.length > 5) console.log(`    ... and ${items.length - 5} more`);
            console.log();
        }
    }

    // ── Grand Total ──
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('  GRAND TOTAL');
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    const pct = totalItems > 0 ? ((totalChanges / totalItems) * 100).toFixed(1) : '0.0';
    console.log(`  Total CP items analyzed:          ${totalItems}`);
    console.log(`  Items that would change:          ${totalChanges} (${pct}% of total)`);
    console.log(`  Items needing manual review:      ${needsManualReview.length}`);
    console.log();
    console.log(`  Breakdown of changes:`);
    console.log(`    CC marked but S < 9:            ${ccWithLowSev.length}`);
    console.log(`    SC marked but S < 5 or O < 4:   ${scWrongItems.length}`);
    console.log(`    Should be CC (S>=9) but isn't:   ${shouldBeCc.length}`);
    console.log(`    Should be SC (S=5-8,O>=4) but isn't: ${shouldBeSc.length}`);
    console.log();

    // ── Classification distribution comparison ──
    console.log('  Current distribution:');
    console.log(`    CC:    ${totCcNow}  (${totalItems > 0 ? ((totCcNow/totalItems)*100).toFixed(1) : 0}%)`);
    console.log(`    SC:    ${totScNow}  (${totalItems > 0 ? ((totScNow/totalItems)*100).toFixed(1) : 0}%)`);
    console.log(`    PTC:   ${totPtcNow}  (${totalItems > 0 ? ((totPtcNow/totalItems)*100).toFixed(1) : 0}%)`);
    console.log(`    Empty: ${totEmptyNow}  (${totalItems > 0 ? ((totEmptyNow/totalItems)*100).toFixed(1) : 0}%)`);
    console.log();
    console.log('  Correct distribution (excl. PTC & manual review):');
    console.log(`    CC:    ${totCcCorr}  (${totalItems > 0 ? ((totCcCorr/totalItems)*100).toFixed(1) : 0}%)`);
    console.log(`    SC:    ${totScCorr}  (${totalItems > 0 ? ((totScCorr/totalItems)*100).toFixed(1) : 0}%)`);
    console.log(`    Empty: ${totEmptyCorr}  (${totalItems > 0 ? ((totEmptyCorr/totalItems)*100).toFixed(1) : 0}%)`);
    console.log();

    console.log('========================================================================');
    console.log('  END OF AUDIT');
    console.log('========================================================================\n');

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
