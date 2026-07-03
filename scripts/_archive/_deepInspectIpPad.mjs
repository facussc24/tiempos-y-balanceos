import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: doc } = await sb.from('amfe_documents').select('data').eq('project_name', 'VWA/PATAGONIA/IP_PADS').single();
const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;

// Deep inspect OP 10 completely
const op = d.operations[0];
console.log(`=== OP ${op.opNumber || op.operationNumber} "${op.name || op.operationName}" ===`);
console.log(`  WEs: ${op.workElements?.length || 0}`);

for (const we of (op.workElements || [])) {
    console.log(`\n  WE: type="${we.type}" name="${we.name}"`);
    console.log(`    Functions: ${we.functions?.length || 0}`);
    
    for (const fn of (we.functions || [])) {
        console.log(`\n    FUNC description="${(fn.description || '').substring(0, 80)}"`);
        console.log(`    FUNC requirements="${(fn.requirements || '').substring(0, 80)}"`);
        // Check ALL keys on function
        console.log(`    FUNC keys: ${Object.keys(fn).join(', ')}`);
        console.log(`    Failures: ${fn.failures?.length || 0}`);
        
        for (const fail of (fn.failures || []).slice(0, 2)) {
            console.log(`\n      FAIL description="${(fail.description || '').substring(0, 60)}"`);
            console.log(`      FAIL effectLocal="${(fail.effectLocal || '').substring(0, 60)}"`);
            console.log(`      FAIL severity=${fail.severity}`);
            console.log(`      FAIL keys: ${Object.keys(fail).join(', ')}`);
            console.log(`      Causes: ${fail.causes?.length || 0}`);
            
            for (const c of (fail.causes || []).slice(0, 2)) {
                console.log(`\n        CAUSE description="${(c.description || '').substring(0, 60)}"`);
                console.log(`        CAUSE cause="${(c.cause || '').substring(0, 60)}"`);
                console.log(`        CAUSE severity=${c.severity} O=${c.occurrence} D=${c.detection} ap=${c.ap} actionPriority=${c.actionPriority}`);
                console.log(`        CAUSE preventionControl="${(c.preventionControl || '').substring(0, 60)}"`);
                console.log(`        CAUSE detectionControl="${(c.detectionControl || '').substring(0, 60)}"`);
            }
        }
    }
}

// Summary of empty fields across ALL ops
console.log('\n\n=== EMPTY FIELD SUMMARY ===');
let emptyFuncDesc = 0, totalFuncs = 0;
let emptyCauseDesc = 0, totalCauses = 0;
let emptyFuncReq = 0;

for (const op of d.operations) {
    for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
            totalFuncs++;
            if (!fn.description || fn.description.trim() === '') emptyFuncDesc++;
            if (!fn.requirements || fn.requirements.trim() === '') emptyFuncReq++;
            
            for (const fail of (fn.failures || [])) {
                for (const c of (fail.causes || [])) {
                    totalCauses++;
                    const causeText = c.cause || c.description || '';
                    if (!causeText || causeText.trim() === '') emptyCauseDesc++;
                }
            }
        }
    }
}

console.log(`Functions: ${totalFuncs} total, ${emptyFuncDesc} empty description, ${emptyFuncReq} empty requirements`);
console.log(`Causes: ${totalCauses} total, ${emptyCauseDesc} empty cause/description text`);
