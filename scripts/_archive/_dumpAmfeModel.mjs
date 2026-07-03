// Dump completo de AMFE-2 (Telas Termoformadas) — modelo de ops finales y de AMFE-1 (Telas Planas) para inspeccion.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
const envText = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const numbers = ['AMFE-1', 'AMFE-2'];
const out = {};
for (const num of numbers) {
  const { data } = await sb.from('amfe_documents').select('data').eq('amfe_number', num).single();
  const p = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
  out[num] = p;
}
writeFileSync('scripts/_dumped_amfes.json', JSON.stringify(out, null, 2));
console.log('Dumped to scripts/_dumped_amfes.json');
console.log('AMFE-2 ops count:', (out['AMFE-2'].operations || []).length);
console.log('AMFE-1 ops count:', (out['AMFE-1'].operations || []).length);
process.exit(0);
