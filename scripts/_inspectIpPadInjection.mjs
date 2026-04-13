/**
 * Inspect IP PAD AMFE injection operation before sync.
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

// Find the IP PAD AMFE
const { data: docs, error } = await sb
  .from('amfe_documents')
  .select('id, amfe_number, data')
  .ilike('amfe_number', '%IPPAD%');

if (error) {
  console.error('Error query:', error);
  process.exit(1);
}

console.log(`Found ${docs?.length || 0} docs matching IPPAD`);
for (const d of docs || []) {
  console.log('---');
  console.log('ID:', d.id);
  console.log('amfe_number:', d.amfe_number);
  console.log('data typeof:', typeof d.data);
  const data = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  console.log('operations count:', data?.operations?.length);
  console.log('header.partNumber:', data?.header?.partNumber);
  console.log('header.scope:', data?.header?.scope);
  for (const op of data?.operations || []) {
    const opNum = op.opNumber || op.operationNumber;
    const opName = op.name || op.operationName;
    const weCount = op.workElements?.length || 0;
    console.log(`  OP ${opNum} "${opName}" — ${weCount} WEs`);
    if (opName && /inyeccion|inyecc|injection/i.test(opName)) {
      console.log('  >>> MATCHES INJECTION <<<');
      for (const we of op.workElements || []) {
        console.log(`    WE: "${we.name}" (type=${we.type}) - ${we.functions?.length || 0} functions`);
        for (const fn of we.functions || []) {
          const failCount = fn.failures?.length || 0;
          console.log(`      Fn: "${fn.description || fn.functionDescription}" - ${failCount} failures`);
          for (const f of fn.failures || []) {
            console.log(`        Failure: "${f.description}" - causes=${f.causes?.length || 0}`);
            for (const c of f.causes || []) {
              console.log(`          Cause: "${(c.description || c.cause || '').slice(0,80)}" S=${c.severity} O=${c.occurrence} D=${c.detection} AP=${c.ap || c.actionPriority}`);
            }
          }
        }
      }
    }
  }
}

process.exit(0);
