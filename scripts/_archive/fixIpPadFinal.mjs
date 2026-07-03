import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

console.log('=== Final IP PAD fixes ===\n');
const { data: doc } = await sb.from('amfe_documents').select('id, data').eq('project_name', 'VWA/PATAGONIA/IP_PADS').single();
const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;

// TASK 1: Fix focusElementFunction to PRODUCT level
const PRODUCT_FUNC = 'Proveer panel IP conforme a requerimientos de aspecto, dimensional y funcional del vehiculo';
let funcFixed = 0;
for (const op of d.operations) {
    op.focusElementFunction = PRODUCT_FUNC;
    funcFixed++;
}
console.log('TASK 1: focusElementFunction set to product-level for ' + funcFixed + ' ops');

// TASK 2: Remove direct material WEs from process operations
const DIRECT_MATERIAL_OPS = ['20', '21', '30', '40', '85'];
let removed = 0;
for (const op of d.operations) {
    const opNum = op.opNumber || op.operationNumber || '';
    if (!DIRECT_MATERIAL_OPS.includes(opNum)) continue;
    const before = op.workElements.length;
    op.workElements = op.workElements.filter(we => we.type !== 'Material');
    const diff = before - op.workElements.length;
    if (diff > 0) { removed += diff; console.log('TASK 2: Removed Material WE from OP ' + opNum); }
}
console.log('TASK 2: ' + removed + ' direct material WEs removed\n');

// Save
const { error } = await sb.from('amfe_documents').update({ data: d }).eq('id', doc.id);
console.log(error ? 'SAVE FAILED' : 'Saved OK');

// Re-sync metadata
const { data: fresh } = await sb.from('amfe_documents').select('id, project_name, data');
for (const doc of fresh) {
    const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    let cc=0,h=0,m=0,fl=0;
    for(const op of(data.operations||[]))for(const we of(op.workElements||[]))for(const fn of(we.functions||[]))for(const fail of(fn.failures||[]))for(const c of(fail.causes||[])){cc++;const ap=c.ap||c.actionPriority||'';if(ap==='H')h++;if(ap==='M')m++;if((Number(fail.severity)||Number(c.severity))&&c.occurrence&&c.detection)fl++;}
    const st={operation_count:(data.operations||[]).length,cause_count:cc,ap_h_count:h,ap_m_count:m,coverage_percent:cc>0?Math.round((fl/cc)*100):0};
    await sb.from('amfe_documents').update(st).eq('id',doc.id);
}
console.log('Metadata re-synced');

// Verify
const { data: v } = await sb.from('amfe_documents').select('data').eq('project_name', 'VWA/PATAGONIA/IP_PADS').single();
const vd = typeof v.data === 'string' ? JSON.parse(v.data) : v.data;
console.log('\nVerify:');
for (const op of vd.operations.slice(0,3)) {
    console.log('  OP ' + (op.opNumber||op.operationNumber) + ': FEF="' + (op.focusElementFunction||'').substring(0,50) + '" WEs=' + op.workElements.length + ' [' + op.workElements.map(w=>w.type).join(',') + ']');
}
console.log('\n=== DONE ===');
