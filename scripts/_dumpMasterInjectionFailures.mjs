/**
 * Dump master injection OP 20 WEs + failures (for matching analysis).
 */
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
const { data: row, error } = await sb
  .from('amfe_documents')
  .select('id, data')
  .eq('id', MASTER_DOC_ID)
  .single();
if (error) { console.error(error); process.exit(1); }

let data = row.data;
if (typeof data === 'string') data = JSON.parse(data);

console.log(`Master data.operations = ${data.operations.length}`);
for (const op of data.operations) {
  console.log(`\nOP ${op.operationNumber || op.opNumber}: ${op.operationName || op.name}`);
  for (const we of (op.workElements || [])) {
    console.log(`  WE [${we.type}] ${we.name}`);
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        console.log(`     FM: ${fm.description}  (causes: ${(fm.causes || []).length})`);
      }
    }
  }
}
