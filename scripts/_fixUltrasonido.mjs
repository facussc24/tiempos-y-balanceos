// Fix: "pistola de ultrasonido" → "Dispositivo de ultrasonido" in OP 110 TERMINACION
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local', 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';

await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
const { data: doc } = await sb.from('amfe_documents').select('data').eq('id', ID).single();
let d = doc.data;
if (typeof d === 'string') d = JSON.parse(d);

let fixes = 0;
for (const op of d.operations) {
  for (const we of (op.workElements || [])) {
    if ((we.name || '').toLowerCase().includes('pistola de ultrasonido')) {
      const oldName = we.name;
      we.name = we.name.replace(/pistola de ultrasonido/gi, 'Dispositivo de ultrasonido');
      console.log('OP', op.opNumber, ':', oldName, '->', we.name);
      fixes++;
    }
  }
}
console.log('Fixes:', fixes);

const wr = await sb.from('amfe_documents').update({ data: d }).eq('id', ID);
if (wr.error) { console.error('FAIL:', wr.error.message); process.exit(1); }
console.log('Written');
