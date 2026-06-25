import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const TYPE_MAP = {
  'Mano de Obra': 'Man',
  'Maquina': 'Machine',
  'Metodo': 'Method',
  'Medio Ambiente': 'Environment',
  'Medicion': 'Measurement',
};

const { data: doc } = await sb.from('amfe_documents').select('data').eq('id', '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3').single();
let d = doc.data;
if (typeof d === 'string') d = JSON.parse(d);

let fixed = 0;
for (const op of d.operations) {
  for (const we of (op.workElements || [])) {
    const mapped = TYPE_MAP[we.type];
    if (mapped) {
      console.log(`OP ${op.opNumber || op.operationNumber}: "${we.name}" [${we.type}] → [${mapped}]`);
      we.type = mapped;
      fixed++;
    }
  }
}
console.log(`\nFixed ${fixed} WE types`);

if (fixed > 0) {
  const { error } = await sb.from('amfe_documents').update({ data: d }).eq('id', '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3');
  if (error) { console.error(error); process.exit(1); }
  console.log('Saved to Supabase.');
}
