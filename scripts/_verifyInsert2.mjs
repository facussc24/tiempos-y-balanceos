import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({email:env.VITE_AUTO_LOGIN_EMAIL,password:env.VITE_AUTO_LOGIN_PASSWORD});
const {data:doc} = await sb.from('amfe_documents').select('data,operation_count,cause_count').eq('id','7cfe2db7-9e5a-4b46-804d-76194557c581').single();
let d = doc.data;
if (typeof d === 'string') d = JSON.parse(d);
let causes = 0;
let grouped = 0;
console.log('Operations:', d.operations.length, '| meta_ops:', doc.operation_count, '| meta_causes:', doc.cause_count);
for (const op of d.operations) {
  const n = op.opNumber || op.operationNumber;
  const nm = op.name || op.operationName;
  let c = 0;
  for (const we of (op.workElements||[])) {
    for (const fn of (we.functions||[])) for (const f of (fn.failures||[])) c += (f.causes||[]).length;
    if ((we.name||'').includes(' / ')) grouped++;
  }
  causes += c;
  console.log('  OP ' + n + ': ' + nm + ' WEs=' + (op.workElements||[]).length + ' C=' + c);
}
console.log('Total causes:', causes, '| Grouped WEs:', grouped);
console.log('focusElementFunction:', (d.operations[0]?.focusElementFunction||'(empty)').substring(0,80)+'...');
