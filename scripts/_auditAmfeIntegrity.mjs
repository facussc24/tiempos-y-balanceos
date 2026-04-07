/**
 * AMFE VDA Data Integrity Audit
 *
 * Checks all AMFE documents in Supabase for:
 * 1. Double-serialization (data should be object, not string)
 * 2. operation_count matches actual operations.length
 * 3. cause_count matches actual total causes
 * 4. Every operation has at least 1 work element
 * 5. Every work element has at least 1 function
 * 6. Every function has at least 1 failure mode
 * 7. Every failure mode has all 3 effects (effectLocal, effectNextLevel, effectEndUser)
 * 8. Every failure has at least 1 cause
 * 9. CC/SC percentages: CC should be 1-5%, SC 10-15%
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// --- Load env ---
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
    envText.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// --- Fetch all AMFE documents ---
const { data: rows, error } = await sb.from('amfe_documents').select('*');
if (error) {
    console.error('Failed to fetch AMFE documents:', error.message);
    process.exit(1);
}

if (!rows || rows.length === 0) {
    console.log('No AMFE documents found in Supabase.');
    process.exit(0);
}

console.log('='.repeat(80));
console.log('AMFE VDA DATA INTEGRITY AUDIT');
console.log(`Date: ${new Date().toISOString()}`);
console.log(`Total AMFE documents found: ${rows.length}`);
console.log('='.repeat(80));

let globalPass = true;
const summaryRows = [];

for (const row of rows) {
    const issues = [];
    const warnings = [];
    const docId = row.id;
    const projectName = row.project_name || '(unnamed)';
    const amfeNumber = row.amfe_number || '(no number)';

    console.log('\n' + '-'.repeat(80));
    console.log(`AMFE: ${projectName}  |  Number: ${amfeNumber}  |  ID: ${docId}`);
    console.log('-'.repeat(80));

    // --- Check 1: Double-serialization ---
    let doc;
    if (typeof row.data === 'string') {
        try {
            const parsed = JSON.parse(row.data);
            if (typeof parsed === 'string') {
                issues.push('CRITICAL: data is double-serialized (string inside string)');
                doc = null;
            } else {
                // Single-serialized string (Supabase returned as string but parses to object)
                doc = parsed;
                // This is normal if using REST API — not an error
            }
        } catch (e) {
            issues.push(`CRITICAL: data is a string that cannot be parsed as JSON: ${e.message}`);
            doc = null;
        }
    } else if (typeof row.data === 'object' && row.data !== null) {
        doc = row.data;
    } else {
        issues.push(`CRITICAL: data is ${typeof row.data} (expected object)`);
        doc = null;
    }

    if (!doc) {
        issues.push('SKIPPING remaining checks — document data is unreadable');
        for (const iss of issues) console.log(`  [FAIL] ${iss}`);
        summaryRows.push({ projectName, amfeNumber, operationCount: '?', causeCount: '?', issues, warnings });
        globalPass = false;
        continue;
    }

    // Check that it has the expected structure
    if (!doc.header) {
        issues.push('CRITICAL: doc.header is missing');
    }
    if (!Array.isArray(doc.operations)) {
        issues.push('CRITICAL: doc.operations is not an array');
        for (const iss of issues) console.log(`  [FAIL] ${iss}`);
        summaryRows.push({ projectName, amfeNumber, operationCount: '?', causeCount: '?', issues, warnings });
        globalPass = false;
        continue;
    }

    const ops = doc.operations;

    // --- Check 2: operation_count matches ---
    const actualOpCount = ops.length;
    const storedOpCount = row.operation_count;
    if (storedOpCount !== actualOpCount) {
        issues.push(`operation_count mismatch: stored=${storedOpCount}, actual=${actualOpCount}`);
    } else {
        console.log(`  [OK] operation_count: ${actualOpCount}`);
    }

    // --- Check 3: cause_count matches ---
    let actualCauseCount = 0;
    for (const op of ops) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    actualCauseCount += (fail.causes || []).length;
                }
            }
        }
    }
    const storedCauseCount = row.cause_count;
    if (storedCauseCount !== actualCauseCount) {
        issues.push(`cause_count mismatch: stored=${storedCauseCount}, actual=${actualCauseCount}`);
    } else {
        console.log(`  [OK] cause_count: ${actualCauseCount}`);
    }

    // --- Structural checks ---
    let opsWithoutWE = 0;
    let weWithoutFn = 0;
    let fnWithoutFail = 0;
    let failsWithoutCause = 0;
    const emptyEffects = { effectLocal: 0, effectNextLevel: 0, effectEndUser: 0 };
    let totalFailures = 0;

    // CC/SC tracking
    let totalCauses = 0;
    let ccCount = 0;
    let scCount = 0;

    for (let oi = 0; oi < ops.length; oi++) {
        const op = ops[oi];
        const opLabel = `Op ${op.opNumber || oi} "${op.name || '(unnamed)'}"`;

        // Check 4: Every operation has at least 1 work element
        if (!op.workElements || op.workElements.length === 0) {
            opsWithoutWE++;
            warnings.push(`${opLabel}: has 0 work elements`);
            continue;
        }

        for (let wi = 0; wi < op.workElements.length; wi++) {
            const we = op.workElements[wi];
            const weLabel = `${opLabel} > WE "${we.name || we.type || '(unnamed)'}"`;

            // Check 5: Every work element has at least 1 function
            if (!we.functions || we.functions.length === 0) {
                weWithoutFn++;
                warnings.push(`${weLabel}: has 0 functions`);
                continue;
            }

            for (let fi = 0; fi < we.functions.length; fi++) {
                const fn = we.functions[fi];
                const fnLabel = `${weLabel} > Fn "${(fn.description || '').slice(0, 40)}"`;

                // Check 6: Every function has at least 1 failure mode
                if (!fn.failures || fn.failures.length === 0) {
                    fnWithoutFail++;
                    warnings.push(`${fnLabel}: has 0 failure modes`);
                    continue;
                }

                for (let fai = 0; fai < fn.failures.length; fai++) {
                    const fail = fn.failures[fai];
                    totalFailures++;
                    const failLabel = `${fnLabel} > Fail "${(fail.description || '').slice(0, 40)}"`;

                    // Check 7: Every failure mode has all 3 effects
                    if (!fail.effectLocal || fail.effectLocal.trim() === '') {
                        emptyEffects.effectLocal++;
                    }
                    if (!fail.effectNextLevel || fail.effectNextLevel.trim() === '') {
                        emptyEffects.effectNextLevel++;
                    }
                    if (!fail.effectEndUser || fail.effectEndUser.trim() === '') {
                        emptyEffects.effectEndUser++;
                    }

                    // Check 8: Every failure has at least 1 cause
                    if (!fail.causes || fail.causes.length === 0) {
                        failsWithoutCause++;
                        warnings.push(`${failLabel}: has 0 causes`);
                        continue;
                    }

                    // Check 9: CC/SC classification
                    for (const cause of fail.causes) {
                        totalCauses++;
                        const sc = (cause.specialChar || '').toUpperCase().trim();
                        if (sc === 'CC') ccCount++;
                        else if (sc === 'SC') scCount++;
                    }
                }
            }
        }
    }

    // Report structural issues
    if (opsWithoutWE > 0) {
        issues.push(`${opsWithoutWE} operation(s) with 0 work elements`);
    } else {
        console.log(`  [OK] All ${ops.length} operations have work elements`);
    }

    if (weWithoutFn > 0) {
        issues.push(`${weWithoutFn} work element(s) with 0 functions`);
    } else {
        console.log(`  [OK] All work elements have functions`);
    }

    if (fnWithoutFail > 0) {
        issues.push(`${fnWithoutFail} function(s) with 0 failure modes`);
    } else {
        console.log(`  [OK] All functions have failure modes`);
    }

    if (failsWithoutCause > 0) {
        issues.push(`${failsWithoutCause} failure mode(s) with 0 causes`);
    } else {
        console.log(`  [OK] All ${totalFailures} failure modes have causes`);
    }

    // Report effects
    const effectIssues = [];
    if (emptyEffects.effectLocal > 0) effectIssues.push(`effectLocal empty: ${emptyEffects.effectLocal}/${totalFailures}`);
    if (emptyEffects.effectNextLevel > 0) effectIssues.push(`effectNextLevel empty: ${emptyEffects.effectNextLevel}/${totalFailures}`);
    if (emptyEffects.effectEndUser > 0) effectIssues.push(`effectEndUser empty: ${emptyEffects.effectEndUser}/${totalFailures}`);
    if (effectIssues.length > 0) {
        issues.push(`Missing VDA 3-level effects: ${effectIssues.join(', ')}`);
    } else if (totalFailures > 0) {
        console.log(`  [OK] All ${totalFailures} failure modes have 3-level VDA effects`);
    }

    // Report CC/SC percentages
    if (totalCauses > 0) {
        const ccPct = ((ccCount / totalCauses) * 100).toFixed(1);
        const scPct = ((scCount / totalCauses) * 100).toFixed(1);
        const stdPct = (((totalCauses - ccCount - scCount) / totalCauses) * 100).toFixed(1);
        console.log(`  CC/SC distribution: CC=${ccCount} (${ccPct}%), SC=${scCount} (${scPct}%), Std=${totalCauses - ccCount - scCount} (${stdPct}%) of ${totalCauses} causes`);

        const ccPctNum = parseFloat(ccPct);
        const scPctNum = parseFloat(scPct);

        if (ccPctNum > 5) {
            warnings.push(`CC percentage ${ccPct}% exceeds recommended 1-5% (${ccCount}/${totalCauses})`);
        } else if (ccPctNum === 0 && totalCauses > 5) {
            warnings.push(`CC percentage is 0% — expected at least flamability CC for interior cabin parts`);
        }

        if (scPctNum > 15) {
            warnings.push(`SC percentage ${scPct}% exceeds recommended 10-15% (${scCount}/${totalCauses})`);
        } else if (scPctNum < 10 && scPctNum > 0) {
            // Below range but nonzero — just note
            warnings.push(`SC percentage ${scPct}% is below recommended 10-15% range`);
        } else if (scPctNum === 0 && totalCauses > 5) {
            warnings.push(`SC percentage is 0% — expected 10-15% for typical process`);
        }
    } else {
        warnings.push('No causes found — cannot evaluate CC/SC distribution');
    }

    // Print issues and warnings
    for (const iss of issues) {
        console.log(`  [FAIL] ${iss}`);
    }
    for (const w of warnings) {
        console.log(`  [WARN] ${w}`);
    }
    if (issues.length === 0 && warnings.length === 0) {
        console.log('  [PASS] All checks passed');
    } else if (issues.length === 0) {
        console.log(`  [PASS with warnings] ${warnings.length} warning(s)`);
    }

    if (issues.length > 0) globalPass = false;

    summaryRows.push({
        projectName,
        amfeNumber,
        operationCount: actualOpCount,
        causeCount: actualCauseCount,
        issues,
        warnings,
    });
}

// --- Final Summary ---
console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Total AMFEs: ${summaryRows.length}`);
console.log('');

const colWidths = { name: 40, ops: 6, causes: 8, status: 8 };
console.log(
    'Document'.padEnd(colWidths.name) +
    'Ops'.padStart(colWidths.ops) +
    'Causes'.padStart(colWidths.causes) +
    'Status'.padStart(colWidths.status)
);
console.log('-'.repeat(colWidths.name + colWidths.ops + colWidths.causes + colWidths.status));

for (const r of summaryRows) {
    const status = r.issues.length > 0 ? 'FAIL' : (r.warnings.length > 0 ? 'WARN' : 'PASS');
    console.log(
        r.projectName.slice(0, colWidths.name - 1).padEnd(colWidths.name) +
        String(r.operationCount).padStart(colWidths.ops) +
        String(r.causeCount).padStart(colWidths.causes) +
        status.padStart(colWidths.status)
    );
}

console.log('');
const failCount = summaryRows.filter(r => r.issues.length > 0).length;
const warnCount = summaryRows.filter(r => r.issues.length === 0 && r.warnings.length > 0).length;
const passCount = summaryRows.filter(r => r.issues.length === 0 && r.warnings.length === 0).length;
console.log(`PASS: ${passCount}  |  WARN: ${warnCount}  |  FAIL: ${failCount}`);
console.log(`Overall: ${globalPass ? 'PASS' : 'FAIL'}`);
console.log('='.repeat(80));

process.exit(globalPass ? 0 : 1);
