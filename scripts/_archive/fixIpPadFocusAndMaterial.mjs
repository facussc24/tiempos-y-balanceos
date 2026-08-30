/**
 * Fix IP PAD AMFE:
 * 1. Update focusElementFunction for ALL operations to 3-level function (AIAG-VDA)
 * 2. Remove Material WEs from OP 100, 120, 130 (clips/film/embalaje are components, not indirect materials)
 * 3. Keep Material WEs ONLY in OP 10 (reception) and OP 50 (primer/fenoclor = indirect chemical)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

console.log('=== Fix IP PAD: focusElementFunction + Material WEs ===\n');

// 1. Load the IP PAD document
const { data: doc, error } = await sb.from('amfe_documents').select('id, data').eq('project_name', 'VWA/PATAGONIA/IP_PADS').single();
if (error || !doc) { console.error('FATAL: cannot load IP PAD:', error?.message); process.exit(1); }
const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
console.log(`Loaded IP PAD: ${doc.id}`);
console.log(`Operations: ${d.operations.length}\n`);

const NEW_FEF = 'Permite ensamblaje y encastre geometrico en sub-ensamble tablero, integridad bordes / Permite montaje modulo panel instrumentos en cabina VW, tolerancias Gap & Flush / Superficie estetica sin arrugas, confort tactil, sin ruidos S&R, no interfiere airbag pasajero';

// OPs where Material WEs are allowed
const KEEP_MATERIAL_OPS = ['10', '50'];
// OPs where we explicitly remove Material WEs
const REMOVE_MATERIAL_OPS = ['100', '120', '130'];

let fefUpdated = 0;
let materialRemoved = 0;

for (const op of d.operations) {
    const num = op.opNumber || op.operationNumber || '';

    // --- Fix 1: Update focusElementFunction ---
    const oldFef = op.focusElementFunction || '';
    if (oldFef !== NEW_FEF) {
        op.focusElementFunction = NEW_FEF;
        fefUpdated++;
        console.log(`  OP ${num}: focusElementFunction UPDATED`);
    } else {
        console.log(`  OP ${num}: focusElementFunction already correct`);
    }

    // --- Fix 2: Remove Material WEs from OP 100, 120, 130 ---
    if (REMOVE_MATERIAL_OPS.includes(num)) {
        const before = (op.workElements || []).length;
        const removed = (op.workElements || []).filter(we => we.type === 'Material');
        op.workElements = (op.workElements || []).filter(we => we.type !== 'Material');
        const after = op.workElements.length;
        if (before !== after) {
            materialRemoved += (before - after);
            for (const r of removed) {
                console.log(`  OP ${num}: REMOVED Material WE "${r.name}"`);
            }
        }
    } else if (!KEEP_MATERIAL_OPS.includes(num)) {
        // For any other OP that might have Material WEs, also check and warn (but don't remove automatically)
        const matWes = (op.workElements || []).filter(we => we.type === 'Material');
        if (matWes.length > 0) {
            console.log(`  OP ${num}: WARNING - has Material WE(s) but not in KEEP or REMOVE list: ${matWes.map(w => w.name).join(', ')}`);
        }
    }
}

console.log(`\n--- Summary ---`);
console.log(`focusElementFunction updated: ${fefUpdated} operations`);
console.log(`Material WEs removed: ${materialRemoved}`);

// 3. Save back to Supabase (OBJECT, not JSON.stringify!)
console.log('\nSaving to Supabase...');
const { error: updateError } = await sb.from('amfe_documents').update({ data: d }).eq('id', doc.id);
if (updateError) { console.error('FATAL: update failed:', updateError.message); process.exit(1); }

// 4. Verify no double-serialization
const { data: verify } = await sb.from('amfe_documents').select('data').eq('id', doc.id).single();
const vd = typeof verify.data === 'string' ? JSON.parse(verify.data) : verify.data;
const isObj = typeof verify.data === 'object' && verify.data !== null;
const hasOps = Array.isArray(vd.operations);
console.log(`Verification: data is object = ${isObj}, operations is array = ${hasOps}`);

// 5. Verify specific fixes
console.log('\n--- Post-save verification ---');
for (const op of vd.operations) {
    const num = op.opNumber || op.operationNumber;
    const fefOk = op.focusElementFunction === NEW_FEF;
    const matWes = (op.workElements || []).filter(we => we.type === 'Material');
    const matNames = matWes.map(w => w.name).join(', ') || 'NONE';
    const isRemoveOp = REMOVE_MATERIAL_OPS.includes(num);
    const matOk = isRemoveOp ? matWes.length === 0 : true;

    const status = (fefOk && matOk) ? 'OK' : 'ISSUE';
    console.log(`  OP ${num}: FEF=${fefOk ? 'OK' : 'WRONG'} Material=[${matNames}] ${status}`);
}

console.log('\nDONE');
