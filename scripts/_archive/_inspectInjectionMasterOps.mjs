import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const MASTER_DOC_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';
const { data: row } = await sb.from('amfe_documents').select('data').eq('id', MASTER_DOC_ID).single();
const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

console.log(`operations: ${d.operations.length}`);
for (const op of d.operations) {
  console.log(`\n=== OP ${op.operationNumber ?? op.opNumber} ${op.operationName ?? op.name} ===`);
  const wes = op.workElements || [];
  for (const we of wes) {
    console.log(`  WE [${we.type}] ${we.name}`);
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        console.log(`     FM: ${fm.description}`);
        for (const c of (fm.causes || [])) {
          console.log(`        - S=${c.severity} O=${c.occurrence} D=${c.detection} AP=${c.actionPriority || c.ap}  ::  ${c.description || c.cause}`);
        }
      }
    }
  }
}
