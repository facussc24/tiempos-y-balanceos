/**
 * Quick scan of OP 20 failures/WEs in the injection master doc.
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

const MASTER_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';
const { data: doc, error } = await sb
  .from('amfe_documents')
  .select('id, amfe_number, data')
  .eq('id', MASTER_ID)
  .single();

if (error) { console.error(error); process.exit(1); }
console.log('data typeof:', typeof doc.data);
const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
console.log('ops:', data.operations.length);

const op20 = data.operations.find(o => (o.opNumber || o.operationNumber) === '20');
console.log('OP 20:', op20?.name || op20?.operationName);
console.log('WEs:', op20?.workElements?.length);
for (const we of op20?.workElements || []) {
  console.log(`  WE "${we.name}" (${we.type})`);
  for (const fn of we.functions || []) {
    for (const f of fn.failures || []) {
      console.log(`    Failure: "${f.description}" (causes=${f.causes?.length || 0})`);
    }
  }
}

process.exit(0);
