#!/usr/bin/env node
/**
 * Fix 7 confirmed S/O/D values in Insert and Armrest master AMFEs.
 * Values verified against PDF originals in audit report docs/_audit_layer1/1A_amfe_style.md.
 *
 * After correcting each value, recalculates AP for all causes of the affected failure
 * using the AIAG-VDA 2019 table. Also recomputes metadata stats.
 *
 * Usage: node scripts/fix-round1-amfe-sod.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { calcAP } from './apTableShared.mjs';
import { createHash } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// ---------------------------------------------------------------------------
// Hardcoded corrections (verified against PDFs)
// Audit report: docs/_audit_layer1/1A_amfe_style.md
// 7 confirmed fixes; 2 additional Armrest OP30 discrepancies excluded because
// the PDF→Supabase operation mapping is ambiguous (OP30 split into OP50/51).
// ---------------------------------------------------------------------------

const FIXES = [
    // Insert - OP10
    { project: 'VWA/PATAGONIA/INSERTO', opNum: '10', fmIndex: 0, target: 'cause', causeIndex: 0, field: 'detection', oldVal: 7, newVal: 4 },
    { project: 'VWA/PATAGONIA/INSERTO', opNum: '10', fmIndex: 1, target: 'cause', causeIndex: 0, field: 'detection', oldVal: 7, newVal: 4 },
    // Insert - OP15
    { project: 'VWA/PATAGONIA/INSERTO', opNum: '15', fmIndex: 0, target: 'cause', causeIndex: 0, field: 'occurrence', oldVal: 7, newVal: 8 },
    { project: 'VWA/PATAGONIA/INSERTO', opNum: '15', fmIndex: 0, target: 'cause', causeIndex: 0, field: 'detection', oldVal: 10, newVal: 7 },
    // Insert - OP50
    { project: 'VWA/PATAGONIA/INSERTO', opNum: '50', fmIndex: 0, target: 'failure', field: 'severity', oldVal: 9, newVal: 8 },
    // Armrest - OP10
    { project: 'VWA/PATAGONIA/ARMREST_DOOR_PANEL', opNum: '10', fmIndex: 0, target: 'failure', field: 'severity', oldVal: 6, newVal: 7 },
    { project: 'VWA/PATAGONIA/ARMREST_DOOR_PANEL', opNum: '10', fmIndex: 0, target: 'cause', causeIndex: 0, field: 'occurrence', oldVal: 6, newVal: 2 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all failures flat across workElements → functions → failures for an operation */
function collectFailuresFlat(op) {
    const failures = [];
    for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                failures.push(fail);
            }
        }
    }
    return failures;
}

/** Compute metadata stats for an AMFE data blob */
function computeStats(data) {
    let causeCount = 0;
    let apH = 0;
    let apM = 0;
    let causesWithSOD = 0;

    for (const op of (data.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const severity = Number(fail.severity) || 0;
                    for (const cause of (fail.causes || [])) {
                        causeCount++;
                        const occ = Number(cause.occurrence) || 0;
                        const det = Number(cause.detection) || 0;
                        if (severity >= 1 && occ >= 1 && det >= 1) {
                            causesWithSOD++;
                        }
                        if (cause.ap === 'H') apH++;
                        if (cause.ap === 'M') apM++;
                    }
                }
            }
        }
    }

    return {
        operation_count: (data.operations || []).length,
        cause_count: causeCount,
        ap_h_count: apH,
        ap_m_count: apM,
        coverage_percent: causeCount > 0 ? Math.round((causesWithSOD / causeCount) * 100) : 0,
    };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    await initSupabase();

    console.log('\n  Fetching Insert and Armrest AMFE documents...');
    const docs = await selectSql(
        `SELECT id, data, project_name, amfe_number FROM amfe_documents WHERE project_name IN ('VWA/PATAGONIA/INSERTO','VWA/PATAGONIA/ARMREST_DOOR_PANEL')`
    );
    console.log(`  Found ${docs.length} documents\n`);

    if (docs.length === 0) {
        console.error('  ERROR: No documents found!');
        close();
        return;
    }

    // Index docs by project_name
    const docByProject = {};
    for (const doc of docs) {
        docByProject[doc.project_name] = doc;
    }

    let appliedCount = 0;
    let skippedCount = 0;
    const modifiedDocs = new Set();

    for (const fix of FIXES) {
        const doc = docByProject[fix.project];
        if (!doc) {
            console.log(`  SKIP: No document found for ${fix.project}`);
            skippedCount++;
            continue;
        }

        // Parse data if needed (first time for this doc)
        if (typeof doc.data === 'string') {
            doc.data = JSON.parse(doc.data);
        }
        const data = doc.data;

        // Find operation by opNum
        const op = (data.operations || []).find(o => String(o.opNumber) === String(fix.opNum));
        if (!op) {
            console.log(`  SKIP: OP${fix.opNum} not found in ${fix.project}`);
            skippedCount++;
            continue;
        }

        // Collect failures flat
        const failures = collectFailuresFlat(op);
        if (fix.fmIndex >= failures.length) {
            console.log(`  SKIP: FM index ${fix.fmIndex} out of range (${failures.length} failures) in OP${fix.opNum} of ${fix.project}`);
            skippedCount++;
            continue;
        }

        const failure = failures[fix.fmIndex];
        const failDesc = (failure.failure || failure.failureMode || '').substring(0, 60);

        if (fix.target === 'failure') {
            // Change failure.severity
            const currentVal = Number(failure[fix.field]);
            if (currentVal !== fix.oldVal) {
                console.log(`  MISMATCH: ${fix.project} OP${fix.opNum} FM${fix.fmIndex} "${failDesc}"`);
                console.log(`    Field: ${fix.field} — Expected old=${fix.oldVal}, found=${currentVal}. NOT changing.`);
                skippedCount++;
                continue;
            }

            const oldAPs = (failure.causes || []).map(c => {
                const s = Number(failure.severity);
                const o = Number(c.occurrence);
                const d = Number(c.detection);
                return calcAP(s, o, d);
            });

            failure[fix.field] = fix.newVal;

            // Recalculate AP for all causes of this failure
            const newAPs = [];
            for (const cause of (failure.causes || [])) {
                const sev = Number(failure.severity);
                const occ = Number(cause.occurrence);
                const det = Number(cause.detection);
                cause.ap = calcAP(sev, occ, det);
                newAPs.push(cause.ap);
            }

            console.log(`  APPLIED: ${fix.project} OP${fix.opNum} FM${fix.fmIndex} "${failDesc}"`);
            console.log(`    Field: severity  ${fix.oldVal} → ${fix.newVal}`);
            console.log(`    AP: [${oldAPs.join(',')}] → [${newAPs.join(',')}]`);
            appliedCount++;
            modifiedDocs.add(fix.project);

        } else if (fix.target === 'cause') {
            // Change cause field
            const causes = failure.causes || [];
            if (fix.causeIndex >= causes.length) {
                console.log(`  SKIP: Cause index ${fix.causeIndex} out of range (${causes.length} causes) in OP${fix.opNum} FM${fix.fmIndex} of ${fix.project}`);
                skippedCount++;
                continue;
            }

            const cause = causes[fix.causeIndex];
            const currentVal = Number(cause[fix.field]);
            if (currentVal !== fix.oldVal) {
                console.log(`  MISMATCH: ${fix.project} OP${fix.opNum} FM${fix.fmIndex} Cause${fix.causeIndex}`);
                console.log(`    "${failDesc}" — cause: "${(cause.cause || '').substring(0, 50)}"`);
                console.log(`    Field: ${fix.field} — Expected old=${fix.oldVal}, found=${currentVal}. NOT changing.`);
                skippedCount++;
                continue;
            }

            const oldSev = Number(failure.severity);
            const oldOcc = Number(cause.occurrence);
            const oldDet = Number(cause.detection);
            const oldAP = calcAP(oldSev, oldOcc, oldDet);

            cause[fix.field] = fix.newVal;

            // Recalculate AP for ALL causes of this failure (severity might be shared)
            for (const c of causes) {
                const sev = Number(failure.severity);
                const occ = Number(c.occurrence);
                const det = Number(c.detection);
                c.ap = calcAP(sev, occ, det);
            }

            const newSev = Number(failure.severity);
            const newOcc = Number(cause.occurrence);
            const newDet = Number(cause.detection);
            const newAP = calcAP(newSev, newOcc, newDet);

            console.log(`  APPLIED: ${fix.project} OP${fix.opNum} FM${fix.fmIndex} Cause${fix.causeIndex}`);
            console.log(`    "${failDesc}" — cause: "${(cause.cause || '').substring(0, 50)}"`);
            console.log(`    Field: ${fix.field}  ${fix.oldVal} → ${fix.newVal}`);
            console.log(`    S=${newSev} O=${newOcc} D=${newDet}  AP: ${oldAP} → ${newAP}`);
            appliedCount++;
            modifiedDocs.add(fix.project);
        }
    }

    // Update modified documents
    console.log('\n  ══════════════════════════════════════');
    console.log(`  Applied: ${appliedCount} corrections`);
    console.log(`  Skipped: ${skippedCount} corrections (mismatch or not found)`);
    console.log(`  Documents modified: ${modifiedDocs.size}`);
    console.log('  ══════════════════════════════════════\n');

    for (const projectName of modifiedDocs) {
        const doc = docByProject[projectName];
        const data = doc.data;
        const stats = computeStats(data);

        const jsonStr = JSON.stringify(data);
        const checksum = sha256(jsonStr);

        console.log(`  Updating ${doc.amfe_number} (${projectName})...`);
        console.log(`    Stats: ops=${stats.operation_count}, causes=${stats.cause_count}, H=${stats.ap_h_count}, M=${stats.ap_m_count}, coverage=${stats.coverage_percent}%`);

        await execSql(
            `UPDATE amfe_documents SET data = '${jsonStr.replace(/'/g, "''")}', ` +
            `checksum = '${checksum}', ` +
            `operation_count = ${stats.operation_count}, ` +
            `cause_count = ${stats.cause_count}, ` +
            `ap_h_count = ${stats.ap_h_count}, ` +
            `ap_m_count = ${stats.ap_m_count}, ` +
            `coverage_percent = ${stats.coverage_percent}, ` +
            `updated_at = NOW() ` +
            `WHERE id = '${doc.id}'`
        );
        console.log(`    Done.`);
    }

    console.log('\n  All done.\n');
    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
