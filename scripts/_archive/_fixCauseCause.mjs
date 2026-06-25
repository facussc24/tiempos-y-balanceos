import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
console.log('=== Re-migrate cause.description -> cause.cause (fresh read) ===\n');
const { data: allDocs } = await sb.from('amfe_documents').select('id, project_name, data');
for (const doc of allDocs) {
    const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    let n = 0;
    for (const op of (data.operations||[])) for (const we of (op.workElements||[])) for (const fn of (we.functions||[])) for (const fail of (fn.failures||[])) for (const c of (fail.causes||[])) { if ((!c.cause||!c.cause.trim()) && c.description && c.description.trim()) { c.cause = c.description; n++; } }
    if (n > 0) { await sb.from('amfe_documents').update({ data }).eq('id', doc.id); console.log('  '+doc.project_name.split('/').pop()+': '+n+' causes fixed'); }
    else console.log('  '+doc.project_name.split('/').pop()+': OK');
}
// Verify IP PAD
const { data: v } = await sb.from('amfe_documents').select('data').eq('project_name', 'VWA/PATAGONIA/IP_PADS').single();
const vd = typeof v.data === 'string' ? JSON.parse(v.data) : v.data;
const o10 = vd.operations.find(op=>(op.opNumber||op.operationNumber)==='10');
const fc = o10?.workElements?.[0]?.functions?.[0]?.failures?.[0]?.causes?.[0];
console.log('\nVerify OP10:');
console.log('  focusElementFunction: '+(o10?.focusElementFunction||'EMPTY'));
console.log('  operationFunction: '+(o10?.operationFunction||'EMPTY'));
console.log('  cause.cause: '+(fc?.cause||'EMPTY'));
console.log('  cause.description: '+(fc?.description||'EMPTY'));
console.log('\n=== DONE ===');
