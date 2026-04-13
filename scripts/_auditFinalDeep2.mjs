/**
 * Final verification — corrected filters
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const MASTER_AMFE_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';

function norm(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

const { data: row } = await sb.from('amfe_documents').select('data').eq('id', MASTER_AMFE_ID).single();
const doc = JSON.parse(row.data);

// Print ALL OP10 causes
console.log('===== ALL OP10 CAUSES =====');
for (const op of doc.operations) {
  if (String(op.operationNumber || op.opNumber) !== '10') continue;
  for (const we of (op.workElements || [])) {
    console.log(`\nWE: ${we.name}`);
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        console.log(`  FAILURE: "${fm.description.slice(0, 90)}"`);
        console.log(`    fm.severity=${fm.severity}`);
        for (const c of (fm.causes || [])) {
          console.log(`    cause: S=${c.severity} O=${c.occurrence} D=${c.detection} AP=${c.ap} — "${(c.description||c.cause||'').slice(0,80)}"`);
        }
      }
    }
  }
}
