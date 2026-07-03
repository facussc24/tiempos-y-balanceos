/**
 * FINAL VERIFICATION AUDIT — 2026-04-07
 * Checks:
 *   1. IP PAD completeness (causes, operations, fail.severity, header)
 *   2. All AMFEs cause.cause check
 *   3. All AMFEs approvedBy check
 *   4. Metadata sync
 *   5. Export readiness for IP PAD
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// --- Connect ---
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { error: authErr } = await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
if (authErr) { console.error('AUTH FAILED:', authErr.message); process.exit(1); }

// --- Load ALL AMFEs ---
const { data: allDocs, error: loadErr } = await sb.from('amfe_documents').select('id, project_name, data, operation_count, cause_count');
if (loadErr) { console.error('LOAD FAILED:', loadErr.message); process.exit(1); }
console.log(`Loaded ${allDocs.length} AMFE documents\n`);

let totalErrors = 0;
let totalWarnings = 0;
function err(msg) { console.log(`  [ERROR] ${msg}`); totalErrors++; }
function warn(msg) { console.log(`  [WARN]  ${msg}`); totalWarnings++; }
function ok(msg) { console.log(`  [OK]    ${msg}`); }

// Helper: parse data
function parseData(doc) {
    return typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
}

// Helper: count actual causes
function countCauses(data) {
    let c = 0;
    for (const op of (data.operations || []))
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    c += (fail.causes || []).length;
    return c;
}

// ===========================================================================
// 1. IP PAD COMPLETENESS
// ===========================================================================
console.log('='.repeat(72));
console.log(' 1. IP PAD COMPLETENESS');
console.log('='.repeat(72));

const ipPadDoc = allDocs.find(d => d.project_name.includes('IP_PADS'));
if (!ipPadDoc) { err('IP PAD document NOT FOUND!'); } else {
    const ipData = parseData(ipPadDoc);
    const ops = ipData.operations || [];

    // 1a. cause.cause populated for ALL causes
    let totalCauses = 0;
    let emptyCauseCause = 0;
    for (const op of ops)
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        totalCauses++;
                        if (!c.cause || c.cause.trim() === '') emptyCauseCause++;
                    }
    if (emptyCauseCause > 0) err(`${emptyCauseCause}/${totalCauses} causes have EMPTY cause.cause`);
    else ok(`All ${totalCauses} causes have cause.cause populated`);

    // Check if 104 causes
    if (totalCauses === 104) ok(`Cause count = 104 (expected)`);
    else warn(`Cause count = ${totalCauses} (expected 104)`);

    // 1b. op.focusElementFunction populated for all 14 operations
    let emptyFEF = 0;
    for (const op of ops) {
        if (!op.focusElementFunction || op.focusElementFunction.trim() === '') emptyFEF++;
    }
    if (emptyFEF > 0) err(`${emptyFEF}/${ops.length} operations have EMPTY focusElementFunction`);
    else ok(`All ${ops.length} operations have focusElementFunction`);

    // 1c. op.operationFunction populated for all 14 operations
    let emptyOF = 0;
    for (const op of ops) {
        if (!op.operationFunction || op.operationFunction.trim() === '') emptyOF++;
    }
    if (emptyOF > 0) err(`${emptyOF}/${ops.length} operations have EMPTY operationFunction`);
    else ok(`All ${ops.length} operations have operationFunction`);

    // 1d. op.opNumber populated for all 14 operations
    let emptyOpNum = 0;
    for (const op of ops) {
        const num = op.opNumber || op.operationNumber || '';
        if (!num || String(num).trim() === '') emptyOpNum++;
    }
    if (emptyOpNum > 0) err(`${emptyOpNum}/${ops.length} operations have EMPTY opNumber`);
    else ok(`All ${ops.length} operations have opNumber`);

    // 1e. fail.severity populated (not just cause.severity)
    let missingFailSev = 0;
    let totalFails = 0;
    for (const op of ops)
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || [])) {
                    totalFails++;
                    if (!fail.severity || fail.severity === 0 || fail.severity === '') missingFailSev++;
                }
    if (missingFailSev > 0) err(`${missingFailSev}/${totalFails} failures have EMPTY fail.severity`);
    else ok(`All ${totalFails} failures have fail.severity populated`);

    // 1f. cause.ap populated
    let missingAp = 0;
    for (const op of ops)
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        const ap = c.ap || c.actionPriority || '';
                        if (!ap || ap.trim() === '') missingAp++;
                    }
    if (missingAp > 0) err(`${missingAp}/${totalCauses} causes have EMPTY ap`);
    else ok(`All ${totalCauses} causes have ap populated`);

    // 1g. Header check
    const h = ipData.header || {};
    if (h.responsible === 'Leonardo Lattanzi') ok('Header: responsible = "Leonardo Lattanzi"');
    else err(`Header: responsible = "${h.responsible}" (expected "Leonardo Lattanzi")`);

    if (h.approvedBy === 'Gonzalo Cal') ok('Header: approvedBy = "Gonzalo Cal"');
    else err(`Header: approvedBy = "${h.approvedBy}" (expected "Gonzalo Cal")`);

    // Check 14 operations
    if (ops.length === 14) ok(`Operation count = 14 (expected)`);
    else warn(`Operation count = ${ops.length} (expected 14)`);
}

// ===========================================================================
// 2. ALL AMFEs cause.cause CHECK
// ===========================================================================
console.log('\n' + '='.repeat(72));
console.log(' 2. ALL AMFEs cause.cause CHECK');
console.log('='.repeat(72));

for (const doc of allDocs) {
    const name = doc.project_name.split('/').pop();
    const data = parseData(doc);
    let total = 0, emptyCC = 0;
    const examples = [];
    for (const op of (data.operations || []))
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        total++;
                        const hasDesc = c.description && c.description.trim();
                        const hasCause = c.cause && c.cause.trim();
                        if (hasDesc && !hasCause) {
                            emptyCC++;
                            if (examples.length < 3) {
                                const opNum = op.opNumber || op.operationNumber || '?';
                                examples.push(`OP ${opNum}: desc="${c.description.substring(0, 50)}"`);
                            }
                        }
                    }
    if (emptyCC > 0) {
        err(`${name}: ${emptyCC}/${total} causes have description but EMPTY cause.cause`);
        for (const ex of examples) console.log(`          -> ${ex}`);
    } else {
        ok(`${name}: ${total} causes — all with cause.cause populated`);
    }
}

// ===========================================================================
// 3. ALL AMFEs approvedBy CHECK
// ===========================================================================
console.log('\n' + '='.repeat(72));
console.log(' 3. ALL AMFEs approvedBy CHECK');
console.log('='.repeat(72));

for (const doc of allDocs) {
    const name = doc.project_name.split('/').pop();
    const data = parseData(doc);
    const ab = (data.header || {}).approvedBy || '';
    if (ab === 'Gonzalo Cal') ok(`${name}: approvedBy = "Gonzalo Cal"`);
    else err(`${name}: approvedBy = "${ab}" (expected "Gonzalo Cal")`);
}

// ===========================================================================
// 4. METADATA SYNC
// ===========================================================================
console.log('\n' + '='.repeat(72));
console.log(' 4. METADATA SYNC');
console.log('='.repeat(72));

for (const doc of allDocs) {
    const name = doc.project_name.split('/').pop();
    const data = parseData(doc);
    const actualOps = (data.operations || []).length;
    const actualCauses = countCauses(data);
    const metaOps = doc.operation_count;
    const metaCauses = doc.cause_count;

    let synced = true;
    if (actualOps !== metaOps) {
        err(`${name}: operation_count mismatch — actual=${actualOps}, metadata=${metaOps}`);
        synced = false;
    }
    if (actualCauses !== metaCauses) {
        err(`${name}: cause_count mismatch — actual=${actualCauses}, metadata=${metaCauses}`);
        synced = false;
    }
    if (synced) ok(`${name}: ops=${actualOps} causes=${actualCauses} — metadata in sync`);
}

// ===========================================================================
// 5. EXPORT READINESS FOR IP PAD
// ===========================================================================
console.log('\n' + '='.repeat(72));
console.log(' 5. EXPORT READINESS FOR IP PAD');
console.log('='.repeat(72));

if (ipPadDoc) {
    const ipData = parseData(ipPadDoc);
    const ops = ipData.operations || [];

    // Sort operations numerically
    const sorted = [...ops].sort((a, b) => {
        const na = parseInt(a.opNumber || a.operationNumber || '0');
        const nb = parseInt(b.opNumber || b.operationNumber || '0');
        return na - nb;
    });

    let exportErrors = 0;
    console.log('\n  OP# | Name                                     | FEF present | OpFunc present');
    console.log('  ' + '-'.repeat(90));

    for (const op of sorted) {
        const num = op.opNumber || op.operationNumber || '???';
        const name = (op.name || op.operationName || '???').substring(0, 40).padEnd(40);
        const hasFEF = !!(op.focusElementFunction && op.focusElementFunction.trim());
        const hasOF = !!(op.operationFunction && op.operationFunction.trim());
        const fefIcon = hasFEF ? 'YES' : 'EMPTY!';
        const ofIcon = hasOF ? 'YES' : 'EMPTY!';
        if (!hasFEF || !hasOF) exportErrors++;
        console.log(`  ${String(num).padStart(3)} | ${name} | ${fefIcon.padEnd(11)} | ${ofIcon}`);
    }

    // For first 3 causes per operation (simulating FC column)
    console.log('\n  First 3 causes per operation (FC column content):');
    console.log('  ' + '-'.repeat(90));

    for (const op of sorted) {
        const num = op.opNumber || op.operationNumber || '???';
        const opName = (op.name || op.operationName || '???').substring(0, 30);
        const causes = [];
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || []))
                        causes.push(c);

        const sample = causes.slice(0, 3);
        if (sample.length === 0) {
            console.log(`  OP ${num} (${opName}): no causes`);
        } else {
            for (let i = 0; i < sample.length; i++) {
                const cc = sample[i].cause || '';
                const isEmpty = !cc || cc.trim() === '';
                const display = isEmpty ? 'EMPTY!' : cc.substring(0, 70);
                if (isEmpty) exportErrors++;
                console.log(`  OP ${num} cause[${i}]: ${display}`);
            }
        }
    }

    if (exportErrors > 0) err(`${exportErrors} empty values found where export expects data`);
    else ok('All export-critical fields populated — export ready');
}

// ===========================================================================
// SUMMARY
// ===========================================================================
console.log('\n' + '='.repeat(72));
console.log(' FINAL SUMMARY');
console.log('='.repeat(72));
console.log(`  Total ERRORS:   ${totalErrors}`);
console.log(`  Total WARNINGS: ${totalWarnings}`);
if (totalErrors === 0) {
    console.log('\n  >>> ALL CHECKS PASSED — DATA IS CLEAN <<<');
} else {
    console.log('\n  >>> ERRORS FOUND — REVIEW ABOVE <<<');
}
console.log('='.repeat(72));
