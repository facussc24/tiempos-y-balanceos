// READ-ONLY: buscar opNumbers sospechosos (con "OP" prefix en el valor)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
const { data: docs } = await sb.from('amfe_documents').select('amfe_number, data');
for (const d of docs) {
  const data = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  for (const op of data.operations || []) {
    const on = op.opNumber || op.operationNumber;
    const name = op.name || op.operationName;
    if (on && /[a-zA-Z]/.test(String(on))) {
      console.log(`  ${d.amfe_number}: opNumber="${on}" name="${String(name).slice(0,40)}"`);
    }
  }
}
process.exit(0);
