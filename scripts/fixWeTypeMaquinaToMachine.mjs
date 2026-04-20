// Fix WE.type "Maquina" (espanol) -> "Machine" (canonico) en TODOS los AMFEs
// Regla amfe.md: los types canonicos son Machine/Man/Method/Material/Measurement/Environment
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => {
    const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()];
  })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// Mapa de alias espanol -> canonico ingles
const TYPE_MAP = {
  'maquina': 'Machine',
  'máquina': 'Machine',
  'maquinaria': 'Machine',
  'maquinario': 'Machine',
  'hombre': 'Man',
  'persona': 'Man',
  'operario': 'Man',
  'operador': 'Man',
  'metodo': 'Method',
  'método': 'Method',
  'material': 'Material',
  'medicion': 'Measurement',
  'medición': 'Measurement',
  'ambiente': 'Environment',
  'medioambiente': 'Environment',
  'medio ambiente': 'Environment',
  'environment': 'Environment',
};

const { data: docs, error } = await sb.from('amfe_documents').select('id, amfe_number, data');
if (error) { console.error(error); process.exit(1); }

let totalDocsModified = 0;
let totalFixed = 0;

for (const d of docs) {
  const data = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  let docFixed = 0;
  let changedInDoc = false;

  for (const op of data.operations || []) {
    for (const we of op.workElements || []) {
      if (!we.type) continue;
      const key = String(we.type).trim().toLowerCase();
      if (TYPE_MAP[key] && we.type !== TYPE_MAP[key]) {
        we.type = TYPE_MAP[key];
        docFixed++;
        changedInDoc = true;
      }
    }
  }

  if (changedInDoc) {
    const { error: upErr } = await sb.from('amfe_documents').update({ data }).eq('id', d.id);
    if (upErr) { console.error(`${d.amfe_number}: ${upErr.message}`); continue; }
    console.log(`  ${d.amfe_number}: fixed ${docFixed} WE types`);
    totalDocsModified++;
    totalFixed += docFixed;
  }
}

console.log(`\n===== DONE =====`);
console.log(`Docs modified: ${totalDocsModified}  |  WE types fixed: ${totalFixed}`);
process.exit(0);
