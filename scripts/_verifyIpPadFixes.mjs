/**
 * Verification: IP PAD focusElementFunction + Material WE fixes
 * Checks:
 * 1. focusElementFunction contains 3 functions separated by " / "
 * 2. No Material WEs in OP 100, 120, 130
 * 3. Material WEs only in OP 10 and OP 50
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

console.log('=== IP PAD Fix Verification ===\n');

const { data: doc, error } = await sb.from('amfe_documents').select('id, data').eq('project_name', 'VWA/PATAGONIA/IP_PADS').single();
if (error || !doc) { console.error('FATAL:', error?.message); process.exit(1); }
const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;

check('IP PAD loaded', !!d && Array.isArray(d.operations), 'no data or no operations');

// === CHECK 1: focusElementFunction has 3 functions separated by " / " ===
console.log('\n--- CHECK 1: focusElementFunction 3-level (all ops) ---');
const EXPECTED_FEF = 'Permite ensamblaje y encastre geometrico en sub-ensamble tablero, integridad bordes / Permite montaje modulo panel instrumentos en cabina VW, tolerancias Gap & Flush / Superficie estetica sin arrugas, confort tactil, sin ruidos S&R, no interfiere airbag pasajero';

for (const op of d.operations) {
    const num = op.opNumber || op.operationNumber;
    const fef = op.focusElementFunction || '';
    const parts = fef.split(' / ');
    check(`OP ${num} FEF has 3 parts`, parts.length === 3, `got ${parts.length} parts`);
    check(`OP ${num} FEF matches expected`, fef === EXPECTED_FEF, `got "${fef.substring(0, 60)}..."`);
}

// === CHECK 2: No Material WEs in OP 100, 120, 130 ===
console.log('\n--- CHECK 2: No Material WEs in OP 100, 120, 130 ---');
const FORBIDDEN_OPS = ['100', '120', '130'];
for (const op of d.operations) {
    const num = op.opNumber || op.operationNumber;
    if (!FORBIDDEN_OPS.includes(num)) continue;
    const matWes = (op.workElements || []).filter(we => we.type === 'Material');
    check(`OP ${num} has NO Material WEs`, matWes.length === 0, `found ${matWes.length}: ${matWes.map(w => w.name).join(', ')}`);
}

// === CHECK 3: Material WEs ONLY in OP 10 and OP 50 ===
console.log('\n--- CHECK 3: Material WEs only in OP 10 and OP 50 ---');
const ALLOWED_MATERIAL_OPS = ['10', '50'];
for (const op of d.operations) {
    const num = op.opNumber || op.operationNumber;
    const matWes = (op.workElements || []).filter(we => we.type === 'Material');
    if (ALLOWED_MATERIAL_OPS.includes(num)) {
        check(`OP ${num} has Material WE (expected)`, matWes.length > 0, 'no Material WE found');
        for (const mw of matWes) {
            console.log(`    -> "${mw.name}"`);
        }
    } else {
        check(`OP ${num} has NO Material WE`, matWes.length === 0, `unexpected: ${matWes.map(w => w.name).join(', ')}`);
    }
}

// === CHECK 4: No double-serialization ===
console.log('\n--- CHECK 4: No double-serialization ---');
const hasOps = Array.isArray(d.operations);
check('data.operations is array', hasOps, `typeof=${typeof d.operations}`);
if (hasOps) {
    check('operations count > 0', d.operations.length > 0, 'empty operations');
    check('operations count = 14', d.operations.length === 14, `got ${d.operations.length}`);
}

console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
