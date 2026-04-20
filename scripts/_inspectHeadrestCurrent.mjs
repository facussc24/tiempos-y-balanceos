// READ-ONLY: inventario completo operaciones Headrest
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => {
    const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()];
  })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: docs } = await sb.from('amfe_documents').select('amfe_number, data').in('amfe_number', ['AMFE-HF-PAT','AMFE-HRC-PAT','AMFE-HRO-PAT']);

for (const d of docs) {
  const data = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  console.log(`\n===== ${d.amfe_number} (${(data.operations||[]).length} ops) =====`);
  for (const op of data.operations || []) {
    const weTypes = (op.workElements||[]).map(w=>w.type).join(',');
    const firstFail = (op.workElements?.[0]?.functions?.[0]?.failures?.[0]?.description) || (op.workElements?.[0]?.functions?.[0]?.failures?.[0]?.failureMode) || '';
    console.log(`  OP ${op.opNumber||op.operationNumber}: ${op.name||op.operationName}`);
    console.log(`     WEs: ${(op.workElements||[]).length} [${weTypes}]`);
    if (firstFail) console.log(`     1ra falla: "${String(firstFail).slice(0,70)}"`);
  }
}
process.exit(0);
