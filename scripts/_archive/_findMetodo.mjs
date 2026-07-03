import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
const envText = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
let out = '';
const { data } = await sb.from('amfe_documents').select('amfe_number, data');
for (const d of data) {
  const p = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  for (const op of p.operations || []) {
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const fl of fn.failures || []) {
          for (const c of fl.causes || []) {
            for (const field of ['preventionControl', 'detectionControl']) {
              const v = (c[field] || '').trim();
              if (!v) continue;
              if (/m[eé]todo/i.test(v)) {
                out += `${d.amfe_number} | OP${op.opNumber} | ${field}: "${v}"\n`;
              }
            }
          }
        }
      }
    }
  }
}
writeFileSync('scripts/_metodo_hits.txt', out);
console.log('Escrito scripts/_metodo_hits.txt (' + out.length + ' chars, ' + out.split('\n').length + ' lines)');
