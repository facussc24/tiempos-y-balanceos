/**
 * Inspect structure of existing failure objects to copy field pattern.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// Get AMFE Termoformadas - inspect existing flamabilidad failure structure
const { data } = await sb.from('amfe_documents').select('data').eq('id', 'c5201ba9-1225-4663-b7a1-5430f9ee8912').single();
let d = data.data;
if (typeof d === 'string') d = JSON.parse(d);

const op10 = d.operations.find(op => (op.opNumber||op.operationNumber) === '10');
const monoWe = op10.workElements.find(we => we.name.includes('Bicomponente') || we.name.includes('Monofelt'));

for (const fn of (monoWe.functions || [])) {
  for (const fm of (fn.failures || [])) {
    const hasFlam = (fm.description||fm.failure||'').toLowerCase().includes('flamab') ||
                    (fm.causes||[]).some(c => (c.cause||c.description||'').toLowerCase().includes('flamab'));
    if (hasFlam) {
      console.log('FAILURE OBJECT (flamabilidad):');
      console.log(JSON.stringify(fm, null, 2));
      break;
    }
  }
}

// Also inspect what fields the cause has
console.log('\nCause keys in first cause of monoWe:');
const firstCause = (monoWe.functions||[])[0]?.failures?.[0]?.causes?.[0];
if (firstCause) console.log(Object.keys(firstCause).join(', '));

// Also check if TNT function has any failures array
const { data: planas } = await sb.from('amfe_documents').select('data').eq('id', '57011560-d4c1-4a8a-83f0-ed37a2bab1d5').single();
let dp = planas.data;
if (typeof dp === 'string') dp = JSON.parse(dp);
const op10p = dp.operations.find(op => (op.opNumber||op.operationNumber) === '10');
const tntWe = op10p.workElements.find(we => we.name.includes('TNT'));
if (tntWe) {
  console.log('\nTNT WE full structure:');
  console.log(JSON.stringify(tntWe, null, 2));
}

process.exit(0);
