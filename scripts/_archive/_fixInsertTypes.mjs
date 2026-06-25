import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({email:env.VITE_AUTO_LOGIN_EMAIL,password:env.VITE_AUTO_LOGIN_PASSWORD});

const ID = '7cfe2db7-9e5a-4b46-804d-76194557c581';
const {data:doc} = await sb.from('amfe_documents').select('data').eq('id',ID).single();
let d = doc.data;
if (typeof d === 'string') d = JSON.parse(d);

const typeMap = {
  'maquina': 'Machine', 'mano de obra': 'Man', 'metodo': 'Method',
  'material': 'Material', 'medio ambiente': 'Environment', 'medicion': 'Measurement'
};

let fixed = 0;
for (const op of d.operations) {
  for (const we of (op.workElements||[])) {
    const lower = (we.type||'').toLowerCase();
    if (typeMap[lower]) {
      const old = we.type;
      we.type = typeMap[lower];
      if (old !== we.type) {
        console.log(`OP ${op.opNumber||op.operationNumber}: "${we.name}" ${old} -> ${we.type}`);
        fixed++;
      }
    }
  }
}
console.log(`Fixed ${fixed} WE types`);
if (fixed > 0) {
  await sb.from('amfe_documents').update({data:d}).eq('id',ID);
  console.log('Saved.');
}
