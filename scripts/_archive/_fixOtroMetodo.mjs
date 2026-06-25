/**
 * Reemplaza "Control adicional con otro metodo" -> "Pendiente definicion equipo APQP"
 * Esto es el control absurdo que Fak marco en AMFE-1 OP80.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envText = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const ABSURD_RE = /control\s+adicional\s+con\s+otro\s+m[eé]todo/i;
const PENDING = 'Pendiente definicion equipo APQP';

const { data } = await sb.from('amfe_documents').select('id, amfe_number, data');
let total = 0;
for (const d of data) {
  const p = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  let docFixes = 0;
  for (const op of p.operations || []) {
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const fl of fn.failures || []) {
          for (const c of fl.causes || []) {
            for (const field of ['preventionControl', 'detectionControl']) {
              if (ABSURD_RE.test(c[field] || '')) {
                console.log(`  ${d.amfe_number} OP${op.opNumber} ${field}: "${c[field]}" -> pendiente`);
                c[field] = PENDING;
                docFixes++;
              }
            }
          }
        }
      }
    }
  }
  if (docFixes > 0) {
    const { error } = await sb.from('amfe_documents').update({ data: p }).eq('id', d.id);
    console.log(`  ${d.amfe_number}: ${docFixes} fixes ${error?.message || 'OK'}`);
    total += docFixes;
  }
}
console.log(`Total: ${total} controles reemplazados.`);
process.exit(0);
