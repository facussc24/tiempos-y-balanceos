/**
 * Verification script for 2026-04-07 session changes
 * Checks: IP PAD normalization, headers, approvedBy, metadata, no double-serialization
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

let pass = 0, fail = 0;
function check(label, ok, detail) {
    if (ok) { console.log(`  PASS  ${label}`); pass++; }
    else { console.log(`  FAIL  ${label} — ${detail || 'unexpected'}`); fail++; }
}

console.log('=== Session Verification ===\n');

const { data: allDocs, error } = await sb.from('amfe_documents').select('*');
if (error) { console.error('FATAL:', error.message); process.exit(1); }
console.log(`Loaded ${allDocs.length} AMFE documents\n`);

// Parse data for all docs
for (const doc of allDocs) {
    if (typeof doc.data === 'string') doc.data = JSON.parse(doc.data);
}

// === CHECK 1: IP PAD classification ===
console.log('--- CHECK 1: IP PAD project_name and client ---');
const ipPad = allDocs.find(d => d.project_name && d.project_name.includes('IP_PADS'));
check('IP PAD exists', !!ipPad);
if (ipPad) {
    check('project_name = "VWA/PATAGONIA/IP_PADS"', ipPad.project_name === 'VWA/PATAGONIA/IP_PADS', `got "${ipPad.project_name}"`);
    check('client = "VWA"', ipPad.client === 'VWA', `got "${ipPad.client}"`);
}

// === CHECK 2: IP PAD header ===
console.log('\n--- CHECK 2: IP PAD header ---');
if (ipPad) {
    const h = ipPad.data.header || {};
    check('responsible = "Leonardo Lattanzi"', h.responsible === 'Leonardo Lattanzi', `got "${h.responsible}"`);
    check('approvedBy = "Gonzalo Cal"', h.approvedBy === 'Gonzalo Cal', `got "${h.approvedBy}"`);
}

// === CHECK 3: ALL 9 AMFEs have approvedBy = "Gonzalo Cal" ===
console.log('\n--- CHECK 3: ALL AMFEs approvedBy = "Gonzalo Cal" ---');
for (const doc of allDocs) {
    const h = doc.data.header || {};
    const name = (doc.project_name || '').split('/').pop() || doc.id.slice(0, 8);
    check(`${name} approvedBy`, h.approvedBy === 'Gonzalo Cal', `got "${h.approvedBy}"`);
}

// === CHECK 4: IP PAD operations have BOTH opNumber AND operationNumber ===
console.log('\n--- CHECK 4: IP PAD dual op field names ---');
if (ipPad) {
    const ops = ipPad.data.operations || [];
    let bothCount = 0, missingOpNumber = 0, missingOperationNumber = 0;
    for (const op of ops) {
        if (op.opNumber && op.operationNumber) bothCount++;
        if (!op.opNumber) missingOpNumber++;
        if (!op.operationNumber) missingOperationNumber++;
    }
    check(`${ops.length} operations: all have opNumber`, missingOpNumber === 0, `${missingOpNumber} missing opNumber`);
    check(`${ops.length} operations: all have operationNumber`, missingOperationNumber === 0, `${missingOperationNumber} missing operationNumber`);
    check(`Both fields present in all ops`, bothCount === ops.length, `only ${bothCount}/${ops.length} have both`);
}

// === CHECK 5: IP PAD causes have BOTH ap AND actionPriority ===
console.log('\n--- CHECK 5: IP PAD dual cause field names ---');
if (ipPad) {
    let totalCauses = 0, bothAp = 0, missingAp = 0, missingActionPriority = 0;
    for (const op of (ipPad.data.operations || []))
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        totalCauses++;
                        const hasAp = c.ap !== undefined && c.ap !== null && c.ap !== '';
                        const hasActionPriority = c.actionPriority !== undefined && c.actionPriority !== null && c.actionPriority !== '';
                        if (hasAp && hasActionPriority) bothAp++;
                        if (!hasAp) missingAp++;
                        if (!hasActionPriority) missingActionPriority++;
                    }
    check(`${totalCauses} causes: all have ap`, missingAp === 0, `${missingAp} missing ap`);
    check(`${totalCauses} causes: all have actionPriority`, missingActionPriority === 0, `${missingActionPriority} missing actionPriority`);
    // Only check "both" for causes that have ratings (S/O/D)
    check(`Causes with both fields`, bothAp === totalCauses, `only ${bothAp}/${totalCauses} have both`);
}

// === CHECK 6: Metadata matches actual data ===
console.log('\n--- CHECK 6: Metadata consistency ---');
for (const doc of allDocs) {
    const name = (doc.project_name || '').split('/').pop() || doc.id.slice(0, 8);
    const ops = doc.data.operations || [];
    let cc = 0;
    for (const op of ops)
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    cc += (fail.causes || []).length;

    check(`${name} operation_count: meta=${doc.operation_count} actual=${ops.length}`, doc.operation_count === ops.length, `meta=${doc.operation_count} actual=${ops.length}`);
    check(`${name} cause_count: meta=${doc.cause_count} actual=${cc}`, doc.cause_count === cc, `meta=${doc.cause_count} actual=${cc}`);
}

// === CHECK 7: No double-serialization ===
console.log('\n--- CHECK 7: No double-serialization ---');
for (const doc of allDocs) {
    const name = (doc.project_name || '').split('/').pop() || doc.id.slice(0, 8);
    // data was already parsed above; if it was double-serialized, operations would be undefined
    const isObj = typeof doc.data === 'object' && doc.data !== null;
    const hasOps = Array.isArray(doc.data.operations);
    check(`${name} data is object`, isObj, `typeof=${typeof doc.data}`);
    check(`${name} data.operations is array`, hasOps, `operations=${typeof doc.data.operations}`);
}

console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
