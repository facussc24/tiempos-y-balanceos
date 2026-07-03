import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({email:env.VITE_AUTO_LOGIN_EMAIL,password:env.VITE_AUTO_LOGIN_PASSWORD});
const {data:docs} = await sb.from('amfe_documents').select('id,project_name,operation_count,cause_count');
const d = docs.find(x => (x.project_name||'').toUpperCase().includes('ARMREST'));
if (!d) { console.log('ARMREST NOT FOUND in Supabase'); process.exit(0); }
console.log('ID:', d.id, '| project:', d.project_name, '| ops:', d.operation_count, '| causes:', d.cause_count);
const {data:full} = await sb.from('amfe_documents').select('data').eq('id',d.id).single();
let fd = full.data;
if (typeof fd === 'string') fd = JSON.parse(fd);
let tc=0, gw=0;
for (const op of fd.operations) {
  const n = op.opNumber||op.operationNumber;
  const nm = op.name||op.operationName;
  let c=0;
  for (const we of (op.workElements||[])) {
    for (const fn of (we.functions||[])) for (const f of (fn.failures||[])) c += (f.causes||[]).length;
    if ((we.name||'').includes(' / ')) gw++;
  }
  tc += c;
  console.log('  OP '+n+': '+nm+' WEs='+(op.workElements||[]).length+' C='+c);
}
console.log('Total causes:', tc, '| Grouped WEs:', gw);
console.log('FEF:', (fd.operations[0]?.focusElementFunction||'(empty)').substring(0,60));
console.log('Has WIP OP?', fd.operations.some(op => (op.name||op.operationName||'').includes('ALMACEN')));
