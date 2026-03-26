#!/usr/bin/env node
/**
 * fix-cp-ccsc-termoformadas.mjs
 *
 * Classifies CC/SC in the Control Plan for PWA/TELAS_TERMOFORMADAS based on
 * linked AMFE severity and occurrence values (AIAG-VDA 2019 rules):
 *   CC = Severity >= 9 (safety/regulatory)
 *   SC = Severity 5-8 AND Occurrence >= 4
 *   Empty = everything else
 *
 * Steps:
 *   1. Connect to Supabase
 *   2. Load CP document for PWA/TELAS_TERMOFORMADAS
 *   3. Load linked AMFE document for PWA/TELAS_TERMOFORMADAS
 *   4. Build lookup maps from AMFE (failureId->severity, causeId->occurrence)
 *   5. For each CP item without specialCharClass:
 *      a. Get severity from item.amfeSeverity or AMFE failure lookup
 *      b. Get occurrence from item.amfeCauseIds[0] in AMFE causes
 *      c. Apply classification rules
 *   6. Update linked AMFE causes' specialChar to match (CC/SC consistency)
 *   7. Save updated CP and AMFE with recalculated checksums
 *   8. Print report
 *
 * Usage: node scripts/fix-cp-ccsc-termoformadas.mjs
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
 * @param {number} occurrence
 * @returns {'CC'|'SC'|''}
 */
function classify(severity, occurrence) {
    if (severity >= 9) return 'CC';
    if (severity >= 5 && severity < 9 && occurrence >= 4) return 'SC';
    return '';
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n========================================================================');
    console.log('  FIX: CC/SC Classification — CP Telas Termoformadas (AIAG-VDA 2019)');
    console.log('========================================================================\n');

    // ── 1. Load CP document for PWA/TELAS_TERMOFORMADAS ──────────────────────
    const cpRows = await selectSql(
        `SELECT id, project_name, data, linked_amfe_id, control_plan_number, item_count
         FROM cp_documents
         WHERE project_name = 'PWA/TELAS_TERMOFORMADAS'
         ORDER BY project_name`
    );

    if (cpRows.length === 0) {
        console.error('ERROR: No CP document found for PWA/TELAS_TERMOFORMADAS');
        close();
        process.exit(1);
    }

    console.log(`Loaded ${cpRows.length} CP document(s) for PWA/TELAS_TERMOFORMADAS.`);

    const cpRow = cpRows[0];
    const cpData = typeof cpRow.data === 'string' ? JSON.parse(cpRow.data) : cpRow.data;
    const cpItems = cpData?.items || [];
    const linkedAmfeId = cpRow.linked_amfe_id;

    console.log(`  CP ID: ${cpRow.id}`);
    console.log(`  Linked AMFE ID: ${linkedAmfeId || '(none)'}`);
    console.log(`  Total CP items: ${cpItems.length}`);

    // ── 2. Load AMFE document for PWA/TELAS_TERMOFORMADAS ────────────────────
    let amfeRow = null;

    // Try by linked_amfe_id first
    if (linkedAmfeId) {
        const amfeRows = await selectSql(
            `SELECT id, project_name, data FROM amfe_documents WHERE id = '${linkedAmfeId}'`
        );
        if (amfeRows.length > 0) amfeRow = amfeRows[0];
    }

    // Fallback: query by project_name
    if (!amfeRow) {
        const amfeRows = await selectSql(
            `SELECT id, project_name, data FROM amfe_documents
             WHERE project_name = 'PWA/TELAS_TERMOFORMADAS'
             ORDER BY project_name LIMIT 1`
        );
        if (amfeRows.length > 0) amfeRow = amfeRows[0];
    }

    if (!amfeRow) {
        console.error('ERROR: No AMFE document found for PWA/TELAS_TERMOFORMADAS');
        close();
        process.exit(1);
    }

    const amfeData = typeof amfeRow.data === 'string' ? JSON.parse(amfeRow.data) : amfeRow.data;
    console.log(`\n  AMFE ID: ${amfeRow.id}`);
    console.log(`  AMFE Project: ${amfeRow.project_name}`);
    console.log(`  AMFE Operations: ${(amfeData?.operations || []).length}`);

    // ── 3. Build AMFE lookup maps ────────────────────────────────────────────
    const failureMap = new Map();    // failureId -> { severity, causeIds }
    const causeMap = new Map();      // causeId -> { occurrence, failureId }
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

                    for (const cause of (fail.causes || [])) {
                        const occ = toNum(cause.occurrence);
                        if (cause.id) {
                            causeMap.set(cause.id, { occurrence: occ, failureId: fail.id });
                            causeIds.push(cause.id);
                        }
                    }

                    if (fail.id) {
                        failureMap.set(fail.id, { severity: sev, causeIds });
                        opFailures.push({
                            failureId: fail.id,
                            severity: sev,
                            causes: causeIds.map(cid => ({
                                id: cid,
                                occurrence: causeMap.get(cid)?.occurrence ?? 0,
                            })),
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

    console.log(`\n  AMFE lookup maps built:`);
    console.log(`    Failures: ${failureMap.size}`);
    console.log(`    Causes:   ${causeMap.size}`);
    console.log(`    Ops:      ${opFailureMap.size}`);

    // ── 4. Process each CP item ──────────────────────────────────────────────
    const changes = [];
    const unresolved = [];
    let countCC = 0, countSC = 0, countEmpty = 0;
    let cpModified = false;

    // Track cause IDs that need specialChar update in AMFE
    const causeClassUpdates = new Map(); // causeId -> classification

    for (const item of cpItems) {
        const currentClass = (item.specialCharClass || '').trim().toUpperCase();

        // Skip items that already have a classification
        if (currentClass === 'CC' || currentClass === 'SC' || currentClass === 'PTC') {
            if (currentClass === 'CC') countCC++;
            else if (currentClass === 'SC') countSC++;
            continue;
        }

        // ── (a) Resolve severity ──
        let severity = null;

        // First: check item.amfeSeverity
        if (item.amfeSeverity != null && toNum(item.amfeSeverity) > 0) {
            severity = toNum(item.amfeSeverity);
        }

        // Also try failure lookup for potentially higher severity
        const allFailureIds = new Set();
        if (item.amfeFailureId) allFailureIds.add(item.amfeFailureId);
        for (const fid of (item.amfeFailureIds || [])) allFailureIds.add(fid);

        for (const fid of allFailureIds) {
            const f = failureMap.get(fid);
            if (f) {
                if (severity === null || f.severity > severity) severity = f.severity;
            }
        }

        // ── (b) Resolve occurrence ──
        let occurrence = null;
        const causeIds = item.amfeCauseIds || [];

        // First try explicit cause IDs on the CP item
        if (causeIds.length > 0) {
            for (const cid of causeIds) {
                const c = causeMap.get(cid);
                if (c) {
                    if (occurrence === null || c.occurrence > occurrence) {
                        occurrence = c.occurrence;
                    }
                }
            }
        }

        // If no cause IDs but have failure IDs, get all causes from those failures
        if (occurrence === null && allFailureIds.size > 0) {
            for (const fid of allFailureIds) {
                const f = failureMap.get(fid);
                if (f) {
                    for (const cid of f.causeIds) {
                        const c = causeMap.get(cid);
                        if (c) {
                            if (occurrence === null || c.occurrence > occurrence) {
                                occurrence = c.occurrence;
                            }
                        }
                    }
                }
            }
        }

        // ── (c) Apply classification rules ──
        if (severity === null) {
            // No severity data found — leave as-is
            unresolved.push({
                processDesc: item.processDescription || '(no desc)',
                step: item.processStepNumber || '?',
                itemId: item.id,
            });
            countEmpty++;
            continue;
        }

        const effectiveOcc = occurrence !== null ? occurrence : 0;
        const newClass = classify(severity, effectiveOcc);

        // ── (d) Set specialCharClass ──
        if (newClass !== currentClass) {
            changes.push({
                step: item.processStepNumber || '?',
                processDesc: item.processDescription || '(no desc)',
                before: currentClass || '(empty)',
                after: newClass || '(empty)',
                severity,
                occurrence: effectiveOcc,
            });
            item.specialCharClass = newClass;
            cpModified = true;
        }

        // Count
        if (newClass === 'CC') countCC++;
        else if (newClass === 'SC') countSC++;
        else countEmpty++;

        // Track cause classification for AMFE update
        if (newClass && causeIds.length > 0) {
            for (const cid of causeIds) {
                causeClassUpdates.set(cid, newClass);
            }
        } else if (newClass && allFailureIds.size > 0) {
            // If no explicit cause IDs, update all causes of linked failures
            for (const fid of allFailureIds) {
                const f = failureMap.get(fid);
                if (f) {
                    for (const cid of f.causeIds) {
                        causeClassUpdates.set(cid, newClass);
                    }
                }
            }
        }
    }

    // ── 5. Update AMFE causes' specialChar ───────────────────────────────────
    let amfeModified = false;
    let amfeCausesUpdated = 0;

    if (causeClassUpdates.size > 0) {
        for (const op of (amfeData.operations || [])) {
            for (const we of (op.workElements || [])) {
                for (const func of (we.functions || [])) {
                    for (const fail of (func.failures || [])) {
                        for (const cause of (fail.causes || [])) {
                            if (cause.id && causeClassUpdates.has(cause.id)) {
                                const newSpecialChar = causeClassUpdates.get(cause.id);
                                const currentSpecialChar = (cause.specialChar || '').trim().toUpperCase();
                                if (currentSpecialChar !== newSpecialChar) {
                                    cause.specialChar = newSpecialChar;
                                    amfeModified = true;
                                    amfeCausesUpdated++;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ── 6. Save updated documents ────────────────────────────────────────────

    // Save CP
    if (cpModified) {
        const dataStr = JSON.stringify(cpData);
        const checksum = createHash('sha256').update(dataStr).digest('hex');
        const jsonEscaped = dataStr.replace(/'/g, "''");

        await execSql(
            `UPDATE cp_documents SET data = '${jsonEscaped}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${cpRow.id}'`
        );
        console.log(`\n  CP updated (checksum: ${checksum.slice(0, 12)}...)`);
    } else {
        console.log('\n  CP: no changes needed.');
    }

    // Save AMFE
    if (amfeModified) {
        const dataStr = JSON.stringify(amfeData);
        const checksum = createHash('sha256').update(dataStr).digest('hex');
        const jsonEscaped = dataStr.replace(/'/g, "''");

        await execSql(
            `UPDATE amfe_documents SET data = '${jsonEscaped}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${amfeRow.id}'`
        );
        console.log(`  AMFE updated: ${amfeCausesUpdated} causes got specialChar (checksum: ${checksum.slice(0, 12)}...)`);
    } else {
        console.log('  AMFE: no changes needed.');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. REPORT
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('\n========================================================================');
    console.log('  CLASSIFICATION REPORT — Telas Termoformadas');
    console.log('========================================================================\n');

    if (changes.length > 0) {
        console.log(`  Items classified (${changes.length}):\n`);
        console.log(`  ${'Step'.padEnd(8)} ${'Classification'.padEnd(18)} ${'S'.padEnd(4)} ${'O'.padEnd(4)} Process Description`);
        console.log(`  ${'-'.repeat(80)}`);

        for (const c of changes) {
            const classStr = `${c.before} -> ${c.after}`;
            console.log(`  ${String(c.step).padEnd(8)} ${classStr.padEnd(18)} ${String(c.severity).padEnd(4)} ${String(c.occurrence).padEnd(4)} ${c.processDesc.slice(0, 50)}`);
        }
    } else {
        console.log('  No items needed classification changes.');
    }

    if (unresolved.length > 0) {
        console.log(`\n  Unresolved items (no AMFE severity data): ${unresolved.length}`);
        for (const u of unresolved.slice(0, 10)) {
            console.log(`    Step ${u.step}: ${u.processDesc.slice(0, 60)}`);
        }
        if (unresolved.length > 10) {
            console.log(`    ... and ${unresolved.length - 10} more`);
        }
    }

    console.log('\n========================================================================');
    console.log('  SUMMARY');
    console.log('========================================================================\n');

    console.log(`  Total CP items:              ${cpItems.length}`);
    console.log(`  Items classified as CC:      ${countCC}`);
    console.log(`  Items classified as SC:      ${countSC}`);
    console.log(`  Items left empty:            ${countEmpty}`);
    console.log(`  Items changed in this run:   ${changes.length}`);
    console.log(`  Unresolved (no AMFE data):   ${unresolved.length}`);
    console.log(`  AMFE causes updated:         ${amfeCausesUpdated}`);
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
