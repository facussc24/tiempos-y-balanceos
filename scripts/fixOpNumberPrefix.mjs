// Fix opNumber con prefijo "OP " -> solo numero
// AMFE-1 (Telas Planas PWA) tiene "OP 10", "OP 15" etc. Correcto es "10", "15"
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: docs } = await sb.from('amfe_documents').select('id, amfe_number, data');
let fixed = 0, docsMod = 0;

for (const d of docs) {
  const data = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  let changed = false;
  for (const op of data.operations || []) {
    for (const field of ['opNumber', 'operationNumber']) {
      const v = op[field];
      if (!v) continue;
      const m = String(v).match(/^OP\s*(\d+)$/i);
      if (m) {
        op[field] = m[1];
        fixed++;
        changed = true;
      }
    }
  }
  if (changed) {
    const { error } = await sb.from('amfe_documents').update({ data }).eq('id', d.id);
    if (error) { console.error(`${d.amfe_number}: ${error.message}`); continue; }
    console.log(`  ${d.amfe_number}: fixed opNumber prefix`);
    docsMod++;
  }
}

console.log(`\n===== DONE =====\nFixed: ${fixed} opNumbers in ${docsMod} docs`);
process.exit(0);
