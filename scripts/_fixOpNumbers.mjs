// Quick fix: OP 115→120 (Control Final), OP 120→130 (Embalaje)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local', 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';

await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
const { data: doc } = await sb.from('amfe_documents').select('data').eq('id', ID).single();
let d = doc.data;
if (typeof d === 'string') d = JSON.parse(d);

// Order matters: rename 120→130 first, then 115→120
for (const op of d.operations) {
  if ((op.opNumber === '120' || op.operationNumber === '120') && (op.name || op.operationName || '').includes('EMBALAJE')) {
    op.opNumber = '130'; op.operationNumber = '130';
    console.log('Embalaje -> OP 130');
  }
}
for (const op of d.operations) {
  if (op.opNumber === '115' || op.operationNumber === '115') {
    op.opNumber = '120'; op.operationNumber = '120';
    console.log('Control Final -> OP 120');
  }
}

for (const op of d.operations) console.log('  OP', op.opNumber, ':', op.name);

const wr = await sb.from('amfe_documents').update({ data: d }).eq('id', ID);
if (wr.error) { console.error('FAIL:', wr.error.message); process.exit(1); }
console.log('OK - Written');
