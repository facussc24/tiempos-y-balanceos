/**
 * Fix IP PAD Patagonia + Re-sync ALL AMFE metadata
 * Handles both field naming conventions (ap/actionPriority, cause.severity/fail.severity)
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

const getAP = c => c.ap || c.actionPriority || '';
const setAP = (c, v) => { if ('actionPriority' in c) c.actionPriority = v; if ('ap' in c) c.ap = v; };
const getSev = (c, f) => Number(c.severity) || Number(f.severity) || 0;
const getOpNum = op => op.opNumber || op.operationNumber || '?';

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
    return { operation_count: (doc.operations || []).length, cause_count: cc, ap_h_count: h, ap_m_count: m, coverage_percent: cc > 0 ? Math.round((filled / cc) * 100) : 0 };
}

console.log('=== Fix IP PAD + Re-sync ===\n');
const { data: allDocs, error } = await sb.from('amfe_documents').select('id, project_name, client, data');
if (error) { console.error(error); process.exit(1); }
console.log(`${allDocs.length} docs loaded\n`);

const ipPad = allDocs.find(d => d.project_name.includes('IP_PADS') || d.project_name.includes('IP PADs'));
if (!ipPad) { console.error('IP PAD not found!'); process.exit(1); }

if (!ipPad.project_name.includes('/')) {
    await sb.from('amfe_documents').update({ project_name: 'VWA/PATAGONIA/IP_PADS', client: 'VWA' }).eq('id', ipPad.id);
    console.log('TASK 1: Reclassified');
} else console.log('TASK 1: Already classified');

const ipData = typeof ipPad.data === 'string' ? JSON.parse(ipPad.data) : ipPad.data;
let sevN = 0, apN = 0;

for (const op of ipData.operations || [])
    for (const we of op.workElements || [])
        for (const fn of we.functions || [])
            for (const fail of fn.failures || []) {
                const desc = (fail.description || '').toLowerCase();
                for (const c of fail.causes || []) {
                    const s = getSev(c, fail), o = Number(c.occurrence), d = Number(c.detection);
                    if (desc.includes('rotura') && desc.includes('vinilo') && desc.includes('costura') && s === 10) {
                        if ('severity' in c) c.severity = 7;
                        if ('severity' in fail && Number(fail.severity) === 10) fail.severity = 7;
                        sevN++;
                        console.log(`TASK 3: S 10->7 OP${getOpNum(op)} "${fail.description.substring(0,50)}"`);
                        if (o >= 1 && d >= 1) { const na = apRule(7,o,d); if (na !== getAP(c)) { setAP(c,na); apN++; console.log(`  AP: ${getAP(c)}->${na}`); } }
                    }
                    if (desc.includes('puntadas') && desc.includes('irregulares') && s === 8) {
                        if ('severity' in c) c.severity = 5;
                        if ('severity' in fail && Number(fail.severity) === 8) fail.severity = 5;
                        sevN++;
                        console.log(`TASK 3: S 8->5 OP${getOpNum(op)} "${fail.description.substring(0,50)}"`);
                        if (o >= 1 && d >= 1) { const na = apRule(5,o,d); if (na !== getAP(c)) { setAP(c,na); apN++; console.log(`  AP: ${getAP(c)}->${na}`); } }
                    }
                }
            }
console.log(`TASK 3: ${sevN} sev, ${apN} AP\n`);

let pend = 0;
for (const op of ipData.operations || [])
    for (const we of op.workElements || [])
        for (const fn of we.functions || [])
            for (const fail of fn.failures || [])
                for (const c of fail.causes || []) {
                    if (getAP(c) === 'H' && !c.preventionAction && !c.detectionAction && !(c.observations || '').includes('Pendiente')) {
                        c.observations = 'Pendiente definición equipo APQP';
                        c.status = c.status || 'Pendiente';
                        pend++;
                        console.log(`TASK 4: OP${getOpNum(op)} "${(c.description||'').substring(0,40)}"`);
                    }
                }
console.log(`TASK 4: ${pend} marked\n`);

const { error: se } = await sb.from('amfe_documents').update({ data: ipData }).eq('id', ipPad.id);
console.log(se ? `SAVE FAILED: ${se.message}` : 'IP PAD saved OK\n');

console.log('TASK 2: Re-sync all');
for (const doc of allDocs) {
    const data = doc.id === ipPad.id ? ipData : (typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data);
    const st = computeStats(data);
    await sb.from('amfe_documents').update(st).eq('id', doc.id);
    const n = doc.id === ipPad.id ? 'IP_PADS' : doc.project_name.split('/').pop();
    console.log(`  ${n}: ops=${st.operation_count} c=${st.cause_count} H=${st.ap_h_count} M=${st.ap_m_count} cov=${st.coverage_percent}%`);
}

const { data: v } = await sb.from('amfe_documents').select('project_name,client,operation_count,cause_count,ap_h_count,ap_m_count').eq('id', ipPad.id).single();
console.log(`\nVerify: ${v.project_name} | ${v.client} | ops=${v.operation_count} c=${v.cause_count} H=${v.ap_h_count} M=${v.ap_m_count}`);
console.log('=== DONE ===');
