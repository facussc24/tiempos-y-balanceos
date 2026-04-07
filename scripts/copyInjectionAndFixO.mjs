/**
 * TASK 1: Copy injection WEs from IP PAD OP 85 to 4 destination AMFEs
 * TASK 2: Fix O=3 with "Capacitación" as sole preventionControl in IP PAD OP 10
 * TASK 3: Re-sync metadata for ALL 9 AMFEs + backup
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ─── Supabase auth ───
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ─── AP rule (official table) ───
function apRule(s, o, d) {
    if (s <= 1) return 'L';
    if (s <= 3) return (o >= 8 && d >= 5) ? 'M' : 'L';
    if (s <= 6) { if (o >= 8) return d >= 5 ? 'H' : 'M'; if (o >= 6) return d >= 2 ? 'M' : 'L'; if (o >= 4) return d >= 7 ? 'M' : 'L'; return 'L'; }
    if (s <= 8) { if (o >= 8) return 'H'; if (o >= 6) return d >= 2 ? 'H' : 'M'; if (o >= 4) return d >= 7 ? 'H' : 'M'; if (o >= 2) return d >= 5 ? 'M' : 'L'; return 'L'; }
    if (o >= 6) return 'H'; if (o >= 4) return d >= 2 ? 'H' : 'M'; if (o >= 2) { if (d >= 7) return 'H'; if (d >= 5) return 'M'; return 'L'; } return 'L';
}

// ─── Helpers ───
const getAP = c => c.ap || c.actionPriority || '';
const getSev = (c, f) => Number(c.severity) || Number(f?.severity) || 0;

function computeStats(doc) {
    let cc = 0, h = 0, m = 0, filled = 0;
    for (const op of (doc.operations || []))
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        cc++;
                        const ap = getAP(c);
                        if (ap === 'H') h++;
                        if (ap === 'M') m++;
                        if (getSev(c, fail) && c.occurrence && c.detection) filled++;
                    }
    return {
        operation_count: (doc.operations || []).length,
        cause_count: cc,
        ap_h_count: h,
        ap_m_count: m,
        coverage_percent: cc > 0 ? Math.round((filled / cc) * 100) : 0
    };
}

/**
 * Deep-clone a cause with new UUID
 */
function cloneCause(src) {
    return { ...src, id: randomUUID() };
}

/**
 * Deep-clone a failure with new UUID and new cause UUIDs
 */
function cloneFailure(src) {
    return {
        ...src,
        id: randomUUID(),
        causes: (src.causes || []).map(c => cloneCause(c))
    };
}

/**
 * Deep-clone a function with new UUID and new failure/cause UUIDs.
 * IP PAD uses `description` key; some destinations use `functionDescription`.
 * We preserve the source shape exactly.
 */
function cloneFunction(src) {
    return {
        ...src,
        id: randomUUID(),
        failures: (src.failures || []).map(f => cloneFailure(f))
    };
}

/**
 * Deep-clone a WE with new UUID and all nested new UUIDs.
 */
function cloneWE(src) {
    return {
        ...src,
        id: randomUUID(),
        functions: (src.functions || []).map(fn => cloneFunction(fn))
    };
}

// ═════════════════════════════════════════════════
// Load all docs
// ═════════════════════════════════════════════════
console.log('=== Loading all AMFE documents ===\n');
const { data: allDocs, error } = await sb.from('amfe_documents').select('id, project_name, client, data');
if (error) { console.error('Failed to load docs:', error.message); process.exit(1); }
console.log(`Loaded ${allDocs.length} AMFE documents\n`);

// Parse data
for (const doc of allDocs) {
    if (typeof doc.data === 'string') doc.data = JSON.parse(doc.data);
}

// ═════════════════════════════════════════════════
// TASK 1: Copy injection WEs from IP PAD to 4 AMFEs
// ═════════════════════════════════════════════════
console.log('========================================');
console.log('TASK 1: Copy injection WEs from IP PAD OP 85');
console.log('========================================\n');

const ipPad = allDocs.find(d => d.project_name === 'VWA/PATAGONIA/IP_PADS');
if (!ipPad) { console.error('IP PAD not found!'); process.exit(1); }

const ipOp85 = ipPad.data.operations.find(op => {
    const name = (op.operationName || op.name || '').toUpperCase();
    return name.includes('INYEC');
});
if (!ipOp85) { console.error('IP PAD OP 85 injection op not found!'); process.exit(1); }

const sourceWEs = ipOp85.workElements || [];
console.log(`Source: IP PAD OP ${ipOp85.operationNumber || ipOp85.opNumber} "${ipOp85.operationName || ipOp85.name}"`);
console.log(`  WEs to copy: ${sourceWEs.length}`);
for (const we of sourceWEs) {
    const fnCount = (we.functions || []).reduce((sum, fn) => sum + (fn.failures || []).length, 0);
    const causeCount = (we.functions || []).reduce((sum, fn) =>
        sum + (fn.failures || []).reduce((s2, f) => s2 + (f.causes || []).length, 0), 0);
    console.log(`    type="${we.type}" name="${we.name}" failures=${fnCount} causes=${causeCount}`);
}

const destinations = [
    { project: 'VWA/PATAGONIA/HEADREST_FRONT', opMatch: 'INYEC' },
    { project: 'VWA/PATAGONIA/HEADREST_REAR_CEN', opMatch: 'INYEC' },
    { project: 'VWA/PATAGONIA/HEADREST_REAR_OUT', opMatch: 'INYEC' },
    { project: 'VWA/PATAGONIA/TOP_ROLL', opMatch: 'INYEC' },
];

const docsToSave = []; // { id, data } pairs

for (const dest of destinations) {
    const doc = allDocs.find(d => d.project_name === dest.project);
    if (!doc) { console.log(`\n  SKIP ${dest.project}: not found`); continue; }

    const destOp = doc.data.operations.find(op => {
        const name = (op.operationName || op.name || '').toUpperCase();
        return name.includes(dest.opMatch);
    });
    if (!destOp) { console.log(`\n  SKIP ${dest.project}: no injection op found`); continue; }

    const destOpNum = destOp.operationNumber || destOp.opNumber || '?';
    const destOpName = destOp.operationName || destOp.name || '?';
    console.log(`\n  Dest: ${dest.project} OP ${destOpNum} "${destOpName}"`);
    console.log(`    Existing WEs: ${(destOp.workElements || []).length}`);

    // Get existing WE types
    const existingTypes = new Set((destOp.workElements || []).map(we => (we.type || '').toLowerCase()));
    console.log(`    Existing types: [${[...existingTypes].join(', ')}]`);

    let added = 0;
    for (const srcWE of sourceWEs) {
        const srcType = (srcWE.type || '').toLowerCase();
        if (existingTypes.has(srcType)) {
            console.log(`    SKIP WE type="${srcWE.type}" (already exists)`);
            continue;
        }
        const cloned = cloneWE(srcWE);
        if (!destOp.workElements) destOp.workElements = [];
        destOp.workElements.push(cloned);
        existingTypes.add(srcType);
        added++;

        const failCount = (cloned.functions || []).reduce((sum, fn) => sum + (fn.failures || []).length, 0);
        const causeCount = (cloned.functions || []).reduce((sum, fn) =>
            sum + (fn.failures || []).reduce((s2, f) => s2 + (f.causes || []).length, 0), 0);
        console.log(`    ADDED WE type="${cloned.type}" name="${cloned.name}" failures=${failCount} causes=${causeCount}`);
    }

    if (added > 0) {
        docsToSave.push({ id: doc.id, data: doc.data, name: dest.project });
    }
    console.log(`    Total WEs after: ${(destOp.workElements || []).length}`);
}

// Save TASK 1 changes
for (const { id, data, name } of docsToSave) {
    const { error: saveErr } = await sb.from('amfe_documents').update({ data }).eq('id', id);
    if (saveErr) console.log(`  SAVE FAILED ${name}: ${saveErr.message}`);
    else console.log(`  SAVED ${name} OK`);
}

// ═════════════════════════════════════════════════
// TASK 2: Fix O=3 with "Capacitación" as sole preventionControl in IP PAD OP 10
// ═════════════════════════════════════════════════
console.log('\n========================================');
console.log('TASK 2: Fix O=3 "Capacitación" causes in IP PAD OP 10');
console.log('========================================\n');

const ipOp10 = ipPad.data.operations.find(op => (op.operationNumber || op.opNumber) === '10');
if (!ipOp10) { console.error('IP PAD OP 10 not found!'); process.exit(1); }

let fixedCount = 0;
for (const we of (ipOp10.workElements || [])) {
    for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
            for (const c of (fail.causes || [])) {
                const prevCtrl = (c.preventionControl || '').toLowerCase();
                if (prevCtrl.includes('capacitaci') && Number(c.occurrence) === 3) {
                    const s = Number(c.severity);
                    const oldO = c.occurrence;
                    const d = Number(c.detection);
                    const oldAP = c.ap || c.actionPriority || '';

                    // Fix occurrence to 7
                    c.occurrence = 7;

                    // Recalculate AP
                    const newAP = apRule(s, 7, d);
                    c.ap = newAP;
                    c.actionPriority = newAP;

                    fixedCount++;
                    console.log(`  Fixed: "${(c.description || c.cause || '').substring(0, 50)}"`);
                    console.log(`    S=${s} O=${oldO}->7 D=${d} AP=${oldAP}->${newAP}`);
                }
            }
        }
    }
}

console.log(`\n  Total causes fixed: ${fixedCount}`);

// Save IP PAD
const { error: ipSaveErr } = await sb.from('amfe_documents').update({ data: ipPad.data }).eq('id', ipPad.id);
if (ipSaveErr) console.log(`  SAVE IP PAD FAILED: ${ipSaveErr.message}`);
else console.log('  SAVED IP PAD OK');

// ═════════════════════════════════════════════════
// TASK 3: Re-sync metadata for ALL 9 AMFEs
// ═════════════════════════════════════════════════
console.log('\n========================================');
console.log('TASK 3: Re-sync metadata for ALL AMFEs');
console.log('========================================\n');

// Re-read all docs to get latest data (some were modified above)
const { data: freshDocs, error: freshErr } = await sb.from('amfe_documents').select('id, project_name, data');
if (freshErr) { console.error('Failed to reload:', freshErr.message); process.exit(1); }

for (const doc of freshDocs) {
    const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    const st = computeStats(data);
    const { error: syncErr } = await sb.from('amfe_documents').update(st).eq('id', doc.id);
    const shortName = doc.project_name.split('/').pop();
    if (syncErr) {
        console.log(`  SYNC FAILED ${shortName}: ${syncErr.message}`);
    } else {
        console.log(`  ${shortName}: ops=${st.operation_count} causes=${st.cause_count} H=${st.ap_h_count} M=${st.ap_m_count} cov=${st.coverage_percent}%`);
    }
}

// ═════════════════════════════════════════════════
// Verification
// ═════════════════════════════════════════════════
console.log('\n========================================');
console.log('VERIFICATION');
console.log('========================================\n');

// Verify Task 1: Check injection ops have the added WEs
for (const dest of destinations) {
    const { data: vDoc } = await sb.from('amfe_documents').select('data').eq('project_name', dest.project).single();
    if (!vDoc) continue;
    const vData = typeof vDoc.data === 'string' ? JSON.parse(vDoc.data) : vDoc.data;
    const vOp = vData.operations.find(op => (op.operationName || op.name || '').toUpperCase().includes('INYEC'));
    if (!vOp) continue;
    const weTypes = (vOp.workElements || []).map(we => we.type);
    const causeCount = (vOp.workElements || []).reduce((sum, we) =>
        (we.functions || []).reduce((s2, fn) =>
            (fn.failures || []).reduce((s3, f) => s3 + (f.causes || []).length, s2), sum), 0);
    console.log(`  ${dest.project.split('/').pop()}: WE types=[${weTypes.join(', ')}] totalCauses=${causeCount}`);
}

// Verify Task 2: Check the 2 causes now have O=7
const { data: vIpPad } = await sb.from('amfe_documents').select('data').eq('project_name', 'VWA/PATAGONIA/IP_PADS').single();
const vIpData = typeof vIpPad.data === 'string' ? JSON.parse(vIpPad.data) : vIpPad.data;
const vOp10 = vIpData.operations.find(op => (op.operationNumber || op.opNumber) === '10');
let verified = 0;
for (const we of (vOp10.workElements || []))
    for (const fn of (we.functions || []))
        for (const fail of (fn.failures || []))
            for (const c of (fail.causes || [])) {
                if ((c.preventionControl || '').toLowerCase().includes('capacitaci')) {
                    console.log(`  OP 10 Capacitacion cause: O=${c.occurrence} AP=${c.ap || c.actionPriority}`);
                    verified++;
                }
            }
console.log(`  Verified ${verified} capacitacion causes`);

// Verify data type
console.log(`  IP PAD data type: ${typeof vIpPad.data} (should be object)`);

console.log('\n=== ALL DONE ===');
