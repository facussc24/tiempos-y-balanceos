/**
 * Normalize IP PAD field names + Fix header + approvedBy for ALL AMFEs
 * Converts VWA naming convention to match TypeScript types
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

function apRule(s, o, d) {
    if (s <= 1) return 'L';
    if (s <= 3) return (o >= 8 && d >= 5) ? 'M' : 'L';
    if (s <= 6) {
        if (o >= 8) return d >= 5 ? 'H' : 'M';
        if (o >= 6) return d >= 2 ? 'M' : 'L';
        if (o >= 4) return d >= 7 ? 'M' : 'L';
        return 'L';
    }
    if (s <= 8) {
        if (o >= 8) return 'H';
        if (o >= 6) return d >= 2 ? 'H' : 'M';
        if (o >= 4) return d >= 7 ? 'H' : 'M';
        if (o >= 2) return d >= 5 ? 'M' : 'L';
        return 'L';
    }
    if (o >= 6) return 'H';
    if (o >= 4) return d >= 2 ? 'H' : 'M';
    if (o >= 2) { if (d >= 7) return 'H'; if (d >= 5) return 'M'; return 'L'; }
    return 'L';
}

function computeStats(doc) {
    let cc = 0, h = 0, m = 0, filled = 0;
    for (const op of (doc.operations || []))
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        cc++;
                        const ap = c.ap || c.actionPriority || '';
                        if (ap === 'H') h++;
                        if (ap === 'M') m++;
                        const sev = Number(fail.severity) || Number(c.severity) || 0;
                        if (sev && c.occurrence && c.detection) filled++;
                    }
    return { operation_count: (doc.operations || []).length, cause_count: cc, ap_h_count: h, ap_m_count: m, coverage_percent: cc > 0 ? Math.round((filled / cc) * 100) : 0 };
}

console.log('=== Normalize IP PAD + Fix Headers ===\n');

const { data: allDocs, error } = await sb.from('amfe_documents').select('id, project_name, data');
if (error) { console.error(error); process.exit(1); }
console.log(`${allDocs.length} docs loaded\n`);

const ipPad = allDocs.find(d => d.project_name.includes('IP_PADS'));
if (!ipPad) { console.error('IP PAD not found!'); process.exit(1); }

const ipData = typeof ipPad.data === 'string' ? JSON.parse(ipPad.data) : ipPad.data;

// === TASK 1: Normalize field names ===
console.log('--- TASK 1: Normalize field names ---');
let opNorm = 0, causeNorm = 0, sevMoved = 0;

for (const op of (ipData.operations || [])) {
    // Add opNumber + name aliases (keep originals for backward compat)
    if (op.operationNumber && !op.opNumber) { op.opNumber = op.operationNumber; opNorm++; }
    if (op.operationName && !op.name) { op.name = op.operationName; opNorm++; }

    for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                // Move severity from causes to failure (VDA standard: severity on failure)
                if (!fail.severity || fail.severity === '' || fail.severity === 0) {
                    // Find max severity from causes
                    let maxSev = 0;
                    for (const c of (fail.causes || [])) {
                        const s = Number(c.severity);
                        if (s > maxSev) maxSev = s;
                    }
                    if (maxSev > 0) {
                        fail.severity = maxSev;
                        sevMoved++;
                    }
                }

                for (const c of (fail.causes || [])) {
                    // Add ap alias from actionPriority
                    if (c.actionPriority && !c.ap) {
                        c.ap = c.actionPriority;
                        causeNorm++;
                    }
                    // Recalculate AP if we have S/O/D
                    const s = Number(fail.severity) || Number(c.severity);
                    const o = Number(c.occurrence);
                    const d = Number(c.detection);
                    if (s >= 1 && o >= 1 && d >= 1) {
                        const newAp = apRule(s, o, d);
                        if (newAp) {
                            c.ap = newAp;
                            c.actionPriority = newAp;
                        }
                    }
                }
            }
        }
    }
}
console.log(`  ${opNorm} op fields normalized, ${causeNorm} cause.ap added, ${sevMoved} severities moved to failure`);

// === TASK 2: Fix IP PAD header ===
console.log('\n--- TASK 2: Fix IP PAD header ---');
ipData.header = ipData.header || {};
ipData.header.processResponsible = 'Leonardo Lattanzi (Ingeniería)';
ipData.header.responsible = 'Leonardo Lattanzi';
ipData.header.approvedBy = 'Gonzalo Cal';
ipData.header.organization = 'BARACK MERCOSUL';
ipData.header.location = 'PLANTA HURLINGHAM';
ipData.header.client = 'VWA';
ipData.header.modelYear = 'PATAGONIA';
ipData.header.subject = ipData.header.subject || 'TRIM ASM-UPR WRAPPING';
console.log('  Header updated: responsible=Leonardo Lattanzi, approvedBy=Gonzalo Cal');

// Save IP PAD
const { error: saveErr } = await sb.from('amfe_documents').update({ data: ipData }).eq('id', ipPad.id);
console.log(saveErr ? `  SAVE FAILED: ${saveErr.message}` : '  IP PAD saved OK');

// === TASK 3: Fix approvedBy in ALL AMFEs ===
console.log('\n--- TASK 3: Fix approvedBy = "Gonzalo Cal" in ALL AMFEs ---');
for (const doc of allDocs) {
    if (doc.id === ipPad.id) continue; // already done
    const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    if (!data.header) data.header = {};
    const old = data.header.approvedBy || '';
    data.header.approvedBy = 'Gonzalo Cal';
    const { error: e } = await sb.from('amfe_documents').update({ data }).eq('id', doc.id);
    const name = doc.project_name.split('/').pop();
    console.log(e ? `  X ${name}: ${e.message}` : `  ${name}: "${old}" -> "Gonzalo Cal"`);
}

// === TASK 4: Re-sync metadata ===
console.log('\n--- TASK 4: Re-sync metadata ---');
// Re-read all docs (some were modified)
const { data: freshDocs } = await sb.from('amfe_documents').select('id, project_name, data');
for (const doc of freshDocs) {
    const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    const st = computeStats(data);
    await sb.from('amfe_documents').update(st).eq('id', doc.id);
    const name = doc.project_name.split('/').pop();
    console.log(`  ${name}: ops=${st.operation_count} c=${st.cause_count} H=${st.ap_h_count} M=${st.ap_m_count} cov=${st.coverage_percent}%`);
}

console.log('\n=== DONE ===');
