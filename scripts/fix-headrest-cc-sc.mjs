#!/usr/bin/env node
/**
 * fix-headrest-cc-sc.mjs
 *
 * Fixes CC/SC classification discrepancies in all 12 Headrest Control Plans.
 * Updates masters AND variants directly (no inheritance propagation).
 *
 * Classification Rules (AIAG-VDA 2019):
 *   CC = Severity >= 9 (safety/regulatory)
 *   SC = Severity 5-8 AND max(Occurrence) >= 4
 *   Empty = Severity < 5, OR Severity 5-8 with max(O) < 4
 *
 * Resolution strategy per CP item:
 *   a. amfeFailureId / amfeFailureIds -> lookup failure -> get S
 *   b. amfeCauseIds -> lookup each cause -> max(O)
 *   c. If no amfeCauseIds but have failure -> iterate ALL failure's causes -> max(O)
 *   d. Text matching fallback: processDescription -> AMFE operation name -> failures
 *   e. Calculate correct classification and compare with current specialCharClass
 *
 * Usage: node scripts/fix-headrest-cc-sc.mjs
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

/**
 * Build all AMFE lookup maps from an AMFE document's operations.
 * Returns:
 *   failureMap:   failure.id -> { severity, causeIds: [id, ...] }
 *   causeMap:     cause.id   -> { occurrence }
 *   opFailureMap: opNameLower -> [{ failureId, severity, description, causes: [{id, occurrence}] }]
 */
function buildAmfeMaps(amfeData) {
    const failureMap = new Map();
    const causeMap = new Map();
    const opFailureMap = new Map();  // opName (lower) -> failures array

    const ops = amfeData?.operations || [];
    for (const op of ops) {
        const opKey = (op.name || '').toLowerCase().trim();
        const opFailures = [];

        for (const we of (op.workElements || [])) {
            for (const func of (we.functions || [])) {
                for (const fail of (func.failures || [])) {
                    const sev = toNum(fail.severity);
                    const causeIds = [];
                    const causesData = [];

                    for (const cause of (fail.causes || [])) {
                        const occ = toNum(cause.occurrence);
                        if (cause.id) {
                            causeMap.set(cause.id, { occurrence: occ });
                            causeIds.push(cause.id);
                            causesData.push({ id: cause.id, occurrence: occ });
                        }
                    }

                    if (fail.id) {
                        failureMap.set(fail.id, { severity: sev, causeIds });
                        opFailures.push({
                            failureId: fail.id,
                            severity: sev,
                            description: (fail.description || '').toLowerCase().trim(),
                            causes: causesData,
                        });
                    }
                }
            }
        }

        if (opKey && opFailures.length > 0) {
            if (!opFailureMap.has(opKey)) opFailureMap.set(opKey, []);
            opFailureMap.get(opKey).push(...opFailures);
        }

        // Also index by opNumber
        const opNumKey = (op.opNumber || '').toLowerCase().trim();
        if (opNumKey && opFailures.length > 0) {
            if (!opFailureMap.has(opNumKey)) opFailureMap.set(opNumKey, []);
            opFailureMap.get(opNumKey).push(...opFailures);
        }
    }

    return { failureMap, causeMap, opFailureMap };
}

/**
 * For a given CP item, resolve severity and max occurrence using AMFE maps.
 * Returns { severity, maxOccurrence, linkMethod }
 */
function resolveFromAmfe(item, failureMap, causeMap, opFailureMap) {
    let severity = null;
    let maxOccurrence = null;
    let linkMethod = 'none';

    // ── (a) Get severity from amfeFailureId / amfeFailureIds ──
    const allFailureIds = new Set();
    if (item.amfeFailureId) allFailureIds.add(item.amfeFailureId);
    for (const fid of (item.amfeFailureIds || [])) allFailureIds.add(fid);

    for (const fid of allFailureIds) {
        const f = failureMap.get(fid);
        if (f) {
            if (severity === null || f.severity > severity) severity = f.severity;
            linkMethod = 'amfe_failure_link';
        }
    }

    // ── (b) Get max occurrence from amfeCauseIds ──
    const causeIds = item.amfeCauseIds || [];
    if (causeIds.length > 0) {
        for (const cid of causeIds) {
            const c = causeMap.get(cid);
            if (c) {
                if (maxOccurrence === null || c.occurrence > maxOccurrence) {
                    maxOccurrence = c.occurrence;
                }
            }
        }
    }

    // ── (c) If no amfeCauseIds but have failure IDs -> iterate ALL causes of those failures ──
    if (maxOccurrence === null && allFailureIds.size > 0) {
        for (const fid of allFailureIds) {
            const f = failureMap.get(fid);
            if (f) {
                for (const cid of f.causeIds) {
                    const c = causeMap.get(cid);
                    if (c) {
                        if (maxOccurrence === null || c.occurrence > maxOccurrence) {
                            maxOccurrence = c.occurrence;
                        }
                    }
                }
            }
        }
    }

    // ── (d) Text matching fallback ──
    if (severity === null) {
        const procDesc = (item.processDescription || '').toLowerCase().trim();
        if (procDesc) {
            // Try to find matching AMFE operation by name
            const matchingFailures = opFailureMap.get(procDesc);
            if (matchingFailures && matchingFailures.length > 0) {
                linkMethod = 'text_match_op_name';

                // Try to narrow by productCharacteristic or processCharacteristic
                const prodChar = (item.productCharacteristic || '').toLowerCase().trim();
                const procChar = (item.processCharacteristic || '').toLowerCase().trim();

                let bestFailures = matchingFailures;
                if (prodChar || procChar) {
                    const charMatched = matchingFailures.filter(f => {
                        if (prodChar && f.description.includes(prodChar)) return true;
                        if (procChar && f.description.includes(procChar)) return true;
                        return false;
                    });
                    if (charMatched.length > 0) {
                        bestFailures = charMatched;
                        linkMethod = 'text_match_characteristic';
                    }
                }

                // Use max severity across matched failures
                for (const f of bestFailures) {
                    if (severity === null || f.severity > severity) severity = f.severity;
                }

                // Use max occurrence across all causes of matched failures
                if (maxOccurrence === null) {
                    for (const f of bestFailures) {
                        for (const c of f.causes) {
                            if (maxOccurrence === null || c.occurrence > maxOccurrence) {
                                maxOccurrence = c.occurrence;
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Fallback: use amfeSeverity stored on the CP item ──
    if (severity === null && item.amfeSeverity != null && toNum(item.amfeSeverity) > 0) {
        severity = toNum(item.amfeSeverity);
        linkMethod = 'cp_amfeSeverity_field';
    }

    return { severity, maxOccurrence, linkMethod };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n========================================================================');
    console.log('  FIX: Headrest CC/SC Reclassification (AIAG-VDA 2019)');
    console.log('========================================================================\n');

    // ── 1. Load ALL Headrest CPs ──────────────────────────────────────────────
    const cpRows = await selectSql(
        `SELECT id, project_name, data, linked_amfe_id, control_plan_number, item_count FROM cp_documents WHERE project_name LIKE '%HEADREST%' ORDER BY project_name`
    );
    console.log(`Loaded ${cpRows.length} Headrest CP documents.`);

    // ── 2. Load ALL Headrest AMFEs ────────────────────────────────────────────
    const amfeRows = await selectSql(
        `SELECT id, project_name, data FROM amfe_documents WHERE project_name LIKE '%HEADREST%' ORDER BY project_name`
    );
    console.log(`Loaded ${amfeRows.length} Headrest AMFE documents.`);

    // Build AMFE map: id -> { data, maps }
    const amfeById = new Map();
    for (const row of amfeRows) {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const maps = buildAmfeMaps(data);
        amfeById.set(row.id, {
            id: row.id,
            projectName: row.project_name,
            data,
            ...maps,
        });
    }

    console.log(`\nAMFE map keys: ${[...amfeById.keys()].join(', ')}\n`);

    // ── 3. Process each CP ────────────────────────────────────────────────────
    const productReports = [];
    const allChanges = [];
    const unresolved = [];      // items where we couldn't find AMFE data at all
    let totalItemsAnalyzed = 0;
    let totalItemsChanged = 0;
    let docsUpdated = 0;

    let grandBefore = { cc: 0, sc: 0, empty: 0, ptc: 0 };
    let grandAfter = { cc: 0, sc: 0, empty: 0, ptc: 0 };

    for (const cpRow of cpRows) {
        const cpData = typeof cpRow.data === 'string' ? JSON.parse(cpRow.data) : cpRow.data;
        const cpItems = cpData?.items || [];
        const cpName = cpRow.project_name || cpRow.control_plan_number || cpRow.id;
        const linkedAmfeId = cpRow.linked_amfe_id;

        // Get linked AMFE maps (or empty maps if not found)
        let failureMap, causeMap, opFailureMap;
        if (linkedAmfeId && amfeById.has(linkedAmfeId)) {
            const amfe = amfeById.get(linkedAmfeId);
            failureMap = amfe.failureMap;
            causeMap = amfe.causeMap;
            opFailureMap = amfe.opFailureMap;
        } else {
            // Try to find AMFE by matching project name pattern
            // e.g., CP project "VWA/PATAGONIA/HEADREST_FRONT/L1" -> AMFE "VWA/PATAGONIA/HEADREST_FRONT" or same
            failureMap = new Map();
            causeMap = new Map();
            opFailureMap = new Map();

            // Fallback: look through all loaded AMFEs for one with matching base project name
            const cpBaseName = cpName.replace(/\/L\d+$/, ''); // remove variant suffix
            for (const [amfeId, amfe] of amfeById) {
                const amfeBaseName = amfe.projectName.replace(/\/L\d+$/, '');
                if (amfeBaseName === cpBaseName) {
                    // Merge maps from this AMFE
                    for (const [k, v] of amfe.failureMap) failureMap.set(k, v);
                    for (const [k, v] of amfe.causeMap) causeMap.set(k, v);
                    for (const [k, v] of amfe.opFailureMap) {
                        if (!opFailureMap.has(k)) opFailureMap.set(k, []);
                        opFailureMap.get(k).push(...v);
                    }
                }
            }
        }

        const amfeAvailable = failureMap.size > 0;

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

            // ── Resolve S and O from AMFE ──
            const { severity, maxOccurrence, linkMethod } = resolveFromAmfe(
                item, failureMap, causeMap, opFailureMap
            );

            // ── Calculate correct classification ──
            let correct;

            if (currentClass === 'PTC') {
                correct = 'PTC'; // Pass-through characteristic, not severity-based
            } else if (severity === null) {
                // No severity data found — keep current (can't verify)
                correct = currentClass;
                unresolved.push({
                    cpName,
                    processDesc: item.processDescription || '(no desc)',
                    prodChar: item.productCharacteristic || '',
                    currentClass: currentClass || '(empty)',
                    itemId: item.id,
                });
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
                    prodChar: item.productCharacteristic || '',
                    before: currentClass || '(empty)',
                    after: correct || '(empty)',
                    severity: severity ?? 'N/A',
                    maxOcc: maxOccurrence ?? 'N/A',
                    linkMethod,
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
            linkedAmfeId: linkedAmfeId || '(none)',
            amfeAvailable,
            beforeCC, beforeSC, beforeEmpty, beforePTC,
            afterCC, afterSC, afterEmpty, afterPTC,
            changes: cpChanges,
            total: cpItems.length,
        });

        // ── 5. Save updated CP back to Supabase ──
        if (modified) {
            docsUpdated++;
            const dataStr = JSON.stringify(cpData);
            const checksum = createHash('sha256').update(dataStr).digest('hex');
            const jsonEscaped = dataStr.replace(/'/g, "''");

            await execSql(
                `UPDATE cp_documents SET data = '${jsonEscaped}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${cpRow.id}'`
            );
            console.log(`  Updated: ${cpName} (${cpChanges} items changed, checksum: ${checksum.slice(0, 12)}...)`);
        } else {
            console.log(`  No changes: ${cpName}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. REPORT
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('\n========================================================================');
    console.log('  PER-CP BEFORE / AFTER REPORT');
    console.log('========================================================================\n');

    const nameW = 44;
    const colW = 6;

    console.log(
        `  ${pad('CP Name', nameW)} | ` +
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

        // Group by CP for readability
        const byCP = new Map();
        for (const c of allChanges) {
            if (!byCP.has(c.cpName)) byCP.set(c.cpName, []);
            byCP.get(c.cpName).push(c);
        }

        for (const [cpName, items] of byCP) {
            console.log(`  CP: ${cpName} (${items.length} changes)`);
            for (const c of items) {
                console.log(`    ${c.before.padEnd(6)} -> ${c.after.padEnd(6)}  S=${String(c.severity).padEnd(3)} max(O)=${String(c.maxOcc).padEnd(3)}  [${c.linkMethod}]  ${c.processDesc.slice(0, 50)}`);
            }
            console.log();
        }
    } else {
        console.log('\n  No changes needed — all classifications are already correct.\n');
    }

    // ── Unresolved items ──
    if (unresolved.length > 0) {
        console.log('========================================================================');
        console.log(`  UNRESOLVED ITEMS — NO AMFE DATA FOUND (${unresolved.length})`);
        console.log('========================================================================\n');

        const byCP = new Map();
        for (const u of unresolved) {
            if (!byCP.has(u.cpName)) byCP.set(u.cpName, []);
            byCP.get(u.cpName).push(u);
        }

        for (const [cpName, items] of byCP) {
            console.log(`  CP: ${cpName} (${items.length} unresolved)`);
            for (const u of items.slice(0, 10)) {
                console.log(`    [${u.currentClass.padEnd(5)}] ${u.processDesc.slice(0, 60)}`);
            }
            if (items.length > 10) console.log(`    ... and ${items.length - 10} more`);
            console.log();
        }
    }

    // ── Grand Summary ──
    console.log('========================================================================');
    console.log('  SUMMARY');
    console.log('========================================================================\n');

    console.log(`  Headrest CPs analyzed:          ${cpRows.length}`);
    console.log(`  Headrest AMFEs loaded:          ${amfeRows.length}`);
    console.log(`  Total CP items analyzed:        ${totalItemsAnalyzed}`);
    console.log(`  Total items changed:            ${totalItemsChanged}`);
    console.log(`  CP documents updated:           ${docsUpdated} / ${cpRows.length}`);
    console.log(`  Items without AMFE data:        ${unresolved.length}`);
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
