#!/usr/bin/env node
/**
 * fix-cc-sc-classification.mjs
 *
 * Reclassifies CC/SC in ALL Control Plans in Supabase based on AIAG-VDA 2019 rules:
 *   CC = Severity 9-10 (safety/regulatory)
 *   SC = Severity 5-8 AND max(Occurrence) >= 4
 *   Empty = Severity < 5, or Severity 5-8 with max(Occurrence) < 4
 *
 * Steps:
 *   1. Load all AMFE and CP documents from Supabase
 *   2. Build AMFE lookup maps (failure→severity, cause→occurrence)
 *   3. For each CP item, resolve S and max(O) from linked AMFE
 *   4. Calculate correct classification
 *   5. Update changed documents in Supabase (data JSON + checksum)
 *   6. Print comprehensive before/after report
 *
 * Usage: node scripts/fix-cc-sc-classification.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/**
 * AIAG-VDA 2019 classification.
 * @param {number} severity
 * @param {number} maxOccurrence
 * @returns {'CC'|'SC'|''}
 */
function correctClassification(severity, maxOccurrence) {
    if (severity >= 9) return 'CC';
    if (severity >= 5 && severity <= 8 && maxOccurrence >= 4) return 'SC';
    return '';
}

function pad(str, width) {
    const s = String(str ?? '');
    return s.length >= width ? s.slice(0, width) : s.padEnd(width);
}

function padR(str, width) {
    const s = String(str ?? '');
    return s.length >= width ? s.slice(0, width) : s.padStart(width);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n========================================================================');
    console.log('  FIX: CC/SC Reclassification — All CPs (AIAG-VDA 2019 rules)');
    console.log('========================================================================\n');

    // ── 1. Load ALL AMFE documents ───────────────────────────────────────────
    const amfeRows = await selectSql(
        `SELECT id, project_name, data FROM amfe_documents ORDER BY project_name`
    );
    console.log(`Loaded ${amfeRows.length} AMFE documents.`);

    // Build AMFE map: id -> parsed data
    const amfeMap = new Map();
    for (const row of amfeRows) {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        amfeMap.set(row.id, {
            id: row.id,
            projectName: row.project_name,
            data,
        });
    }

    // ── 2. Load ALL CP documents ─────────────────────────────────────────────
    const cpRows = await selectSql(
        `SELECT id, project_name, data, linked_amfe_id, control_plan_number, item_count FROM cp_documents ORDER BY project_name`
    );
    console.log(`Loaded ${cpRows.length} CP documents.\n`);

    // ── 3. Process each CP ───────────────────────────────────────────────────
    const productReports = [];  // per-CP reports
    const allChanges = [];      // individual item changes
    let totalItemsAnalyzed = 0;
    let totalItemsChanged = 0;
    let docsUpdated = 0;

    // Grand totals BEFORE
    let grandBefore = { cc: 0, sc: 0, empty: 0, ptc: 0 };
    // Grand totals AFTER
    let grandAfter = { cc: 0, sc: 0, empty: 0, ptc: 0 };

    for (const cpRow of cpRows) {
        const cpData = typeof cpRow.data === 'string' ? JSON.parse(cpRow.data) : cpRow.data;
        const cpItems = cpData?.items || [];
        const cpName = cpRow.project_name || cpRow.control_plan_number || cpRow.id;
        const linkedAmfeId = cpRow.linked_amfe_id;

        // ── Build AMFE lookup maps for this CP ──
        const failureSeverityMap = new Map();   // failure.id -> severity
        const causeOccurrenceMap = new Map();    // cause.id -> occurrence
        const failureCauseIdsMap = new Map();    // failure.id -> [cause.id, ...]
        // Also build opName -> [causeOccurrences] for fallback matching
        const opNameCausesMap = new Map();       // opName (lower) -> [occurrence values]

        if (linkedAmfeId && amfeMap.has(linkedAmfeId)) {
            const amfe = amfeMap.get(linkedAmfeId);
            const ops = amfe.data?.operations || [];
            for (const op of ops) {
                const opCauseOccs = [];
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
                                        opCauseOccs.push(occ);
                                    }
                                }
                                failureCauseIdsMap.set(fail.id, causeIds);
                            }
                        }
                    }
                }
                // Store by operation name for fallback matching
                const opKey = (op.name || '').toLowerCase().trim();
                if (opKey && opCauseOccs.length > 0) {
                    if (!opNameCausesMap.has(opKey)) opNameCausesMap.set(opKey, []);
                    opNameCausesMap.get(opKey).push(...opCauseOccs);
                }
                // Also store by opNumber for matching
                const opNumKey = (op.opNumber || '').toLowerCase().trim();
                if (opNumKey && opCauseOccs.length > 0) {
                    if (!opNameCausesMap.has(opNumKey)) opNameCausesMap.set(opNumKey, []);
                    opNameCausesMap.get(opNumKey).push(...opCauseOccs);
                }
            }
        }

        // ── Per-CP counters ──
        let beforeCC = 0, beforeSC = 0, beforeEmpty = 0, beforePTC = 0;
        let afterCC = 0, afterSC = 0, afterEmpty = 0, afterPTC = 0;
        let cpChanges = 0;
        let modified = false;

        for (const item of cpItems) {
            totalItemsAnalyzed++;

            const currentClass = (item.specialCharClass || '').trim().toUpperCase();

            // Count BEFORE
            if (currentClass === 'CC') beforeCC++;
            else if (currentClass === 'SC') beforeSC++;
            else if (currentClass === 'PTC') beforePTC++;
            else beforeEmpty++;

            // ── Resolve Severity from AMFE links ──
            let severity = null;
            let maxOccurrence = null;

            // Try amfeFailureId / amfeFailureIds
            const failureId = item.amfeFailureId;
            const failureIds = item.amfeFailureIds || [];
            const causeIds = item.amfeCauseIds || [];

            const allFailureIds = new Set();
            if (failureId) allFailureIds.add(failureId);
            for (const fid of failureIds) allFailureIds.add(fid);

            // Get max severity across linked failures
            for (const fid of allFailureIds) {
                if (failureSeverityMap.has(fid)) {
                    const s = failureSeverityMap.get(fid);
                    if (severity === null || s > severity) severity = s;
                }
            }

            // Get max occurrence from explicitly linked causes
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
            if (severity === null && item.amfeSeverity != null && toNum(item.amfeSeverity) > 0) {
                severity = toNum(item.amfeSeverity);
            }

            // Fallback for occurrence: match by processDescription to AMFE operation name
            if (maxOccurrence === null && severity !== null && severity >= 5 && severity <= 8) {
                const procDesc = (item.processDescription || '').toLowerCase().trim();
                if (procDesc && opNameCausesMap.has(procDesc)) {
                    const occs = opNameCausesMap.get(procDesc);
                    if (occs.length > 0) {
                        maxOccurrence = Math.max(...occs);
                    }
                }
            }

            // ── Calculate correct classification ──
            let correct;

            // PTC items: keep as-is (different concept, not severity-based)
            if (currentClass === 'PTC') {
                correct = 'PTC';
            } else if (severity === null) {
                // No severity data at all: keep current (can't verify)
                correct = currentClass;
            } else {
                const effectiveOcc = maxOccurrence !== null ? maxOccurrence : 0;
                correct = correctClassification(severity, effectiveOcc);
            }

            // Count AFTER
            if (correct === 'CC') afterCC++;
            else if (correct === 'SC') afterSC++;
            else if (correct === 'PTC') afterPTC++;
            else afterEmpty++;

            // ── Check if change needed ──
            if (currentClass !== correct && correct !== 'PTC') {
                cpChanges++;
                totalItemsChanged++;
                modified = true;

                allChanges.push({
                    cpName,
                    processDesc: item.processDescription || '(no desc)',
                    before: currentClass || '(empty)',
                    after: correct || '(empty)',
                    severity: severity ?? 'N/A',
                    maxOcc: maxOccurrence ?? 'N/A',
                });

                // Apply the fix
                item.specialCharClass = correct;
            }
        }

        // Accumulate grand totals
        grandBefore.cc += beforeCC;
        grandBefore.sc += beforeSC;
        grandBefore.empty += beforeEmpty;
        grandBefore.ptc += beforePTC;
        grandAfter.cc += afterCC;
        grandAfter.sc += afterSC;
        grandAfter.empty += afterEmpty;
        grandAfter.ptc += afterPTC;

        productReports.push({
            name: cpName,
            beforeCC, beforeSC, beforeEmpty, beforePTC,
            afterCC, afterSC, afterEmpty, afterPTC,
            changes: cpChanges,
            total: cpItems.length,
        });

        // ── Update document in Supabase if changed ──
        if (modified) {
            docsUpdated++;
            const dataStr = JSON.stringify(cpData);
            const checksum = createHash('sha256').update(dataStr).digest('hex');
            const jsonEscaped = dataStr.replace(/'/g, "''");

            await execSql(
                `UPDATE cp_documents SET data = '${jsonEscaped}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${cpRow.id}'`
            );
            console.log(`  Updated: ${cpName} (${cpChanges} items changed, checksum: ${checksum.slice(0, 12)}...)`);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // REPORT
    // ═════════════════════════════════════════════════════════════════════════

    console.log('\n========================================================================');
    console.log('  PER-PRODUCT BEFORE / AFTER REPORT');
    console.log('========================================================================\n');

    const nameW = 42;
    const colW = 6;

    console.log(
        `  ${pad('Product', nameW)} | ` +
        `${padR('CC-B', colW)} ${padR('CC-A', colW)} | ` +
        `${padR('SC-B', colW)} ${padR('SC-A', colW)} | ` +
        `${padR('Em-B', colW)} ${padR('Em-A', colW)} | ` +
        `${padR('Chg', colW)} ${padR('Tot', colW)}`
    );
    console.log(`  ${'-'.repeat(nameW + 4 * 2 * colW + 20)}`);

    for (const p of productReports) {
        const marker = p.changes > 0 ? '*' : ' ';
        console.log(
            `${marker} ${pad(p.name, nameW)} | ` +
            `${padR(p.beforeCC, colW)} ${padR(p.afterCC, colW)} | ` +
            `${padR(p.beforeSC, colW)} ${padR(p.afterSC, colW)} | ` +
            `${padR(p.beforeEmpty, colW)} ${padR(p.afterEmpty, colW)} | ` +
            `${padR(p.changes, colW)} ${padR(p.total, colW)}`
        );
    }

    console.log(`  ${'-'.repeat(nameW + 4 * 2 * colW + 20)}`);
    console.log(
        `  ${pad('GRAND TOTAL', nameW)} | ` +
        `${padR(grandBefore.cc, colW)} ${padR(grandAfter.cc, colW)} | ` +
        `${padR(grandBefore.sc, colW)} ${padR(grandAfter.sc, colW)} | ` +
        `${padR(grandBefore.empty, colW)} ${padR(grandAfter.empty, colW)} | ` +
        `${padR(totalItemsChanged, colW)} ${padR(totalItemsAnalyzed, colW)}`
    );

    // ── Individual changes detail ──
    if (allChanges.length > 0) {
        console.log('\n========================================================================');
        console.log(`  INDIVIDUAL CHANGES (${allChanges.length} items)`);
        console.log('========================================================================\n');

        for (const c of allChanges) {
            console.log(`  CP: ${c.cpName}`);
            console.log(`    Item: ${c.processDesc}`);
            console.log(`    ${c.before} -> ${c.after}  (S=${c.severity}, max(O)=${c.maxOcc})`);
            console.log();
        }
    } else {
        console.log('\n  No changes needed — all classifications are already correct.');
    }

    // ── Grand Summary ──
    console.log('========================================================================');
    console.log('  SUMMARY');
    console.log('========================================================================\n');

    console.log(`  Total CP items analyzed:    ${totalItemsAnalyzed}`);
    console.log(`  Total items changed:        ${totalItemsChanged}`);
    console.log(`  CP documents updated:       ${docsUpdated} / ${cpRows.length}`);
    console.log();
    console.log(`  BEFORE distribution:`);
    console.log(`    CC:    ${grandBefore.cc}`);
    console.log(`    SC:    ${grandBefore.sc}`);
    console.log(`    PTC:   ${grandBefore.ptc}`);
    console.log(`    Empty: ${grandBefore.empty}`);
    console.log();
    console.log(`  AFTER distribution:`);
    console.log(`    CC:    ${grandAfter.cc}`);
    console.log(`    SC:    ${grandAfter.sc}`);
    console.log(`    PTC:   ${grandAfter.ptc}`);
    console.log(`    Empty: ${grandAfter.empty}`);
    console.log();

    console.log('========================================================================');
    console.log('  DONE');
    console.log('========================================================================\n');

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
