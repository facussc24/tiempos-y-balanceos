import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({email:env.VITE_AUTO_LOGIN_EMAIL,password:env.VITE_AUTO_LOGIN_PASSWORD});

const {data:docs} = await sb.from('amfe_documents').select('id,amfe_number,project_name,subject,operation_count,cause_count');
for (const d of docs) {
  if ((d.project_name||'').toUpperCase().includes('INSERT') || (d.subject||'').toLowerCase().includes('insert')) {
    console.log('=== FOUND INSERT ===');
    console.log('ID:', d.id);
    console.log('project_name:', d.project_name);
    console.log('subject:', d.subject);
    console.log('operation_count:', d.operation_count, '| cause_count:', d.cause_count);

    const {data:full} = await sb.from('amfe_documents').select('data').eq('id',d.id).single();
    let fd = full.data;
    if (typeof fd === 'string') fd = JSON.parse(fd);

    let totalCauses = 0;
    let groupedWEs = 0;
    console.log('\nOperations:', fd.operations.length);
    for (const op of fd.operations) {
      const n = op.opNumber || op.operationNumber;
      const nm = op.name || op.operationName;
      const wes = op.workElements || [];
      let c = 0;
      for (const we of wes) {
        for (const fn of (we.functions||[])) for (const f of (fn.failures||[])) c += (f.causes||[]).length;
        if ((we.name||'').includes(' / ')) groupedWEs++;
      }
      totalCauses += c;
      console.log('  OP ' + n + ': ' + nm + ' | WEs=' + wes.length + ' | C=' + c);
      for (const we of wes) {
        const wc = (we.functions||[]).reduce((s,fn) => s + (fn.failures||[]).reduce((s2,f) => s2 + (f.causes||[]).length, 0), 0);
        const flag = (we.name||'').includes(' / ') ? ' *** GROUPED ***' : '';
        console.log('    [' + we.type + '] ' + we.name + ' | C=' + wc + flag);
      }
    }
    console.log('\nTotal causes:', totalCauses);
    console.log('Grouped WEs:', groupedWEs);
    console.log('focusElementFunction:', (fd.operations[0]?.focusElementFunction || '(empty)'));
    console.log('Has OP 11?', fd.operations.some(op => (op.opNumber||op.operationNumber)==='11'));
  }
}
