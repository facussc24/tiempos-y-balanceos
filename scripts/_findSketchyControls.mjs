/**
 * Buscar controles "sospechosos" cortos/genericos en los AMFEs.
 * Lista candidatos para que Fak decida (no auto-reemplaza).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envText = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data } = await sb.from('amfe_documents').select('amfe_number, data');
for (const d of data) {
  const p = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  const ops = p.operations || [];
  for (const op of ops) {
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const fl of fn.failures || []) {
          for (const c of fl.causes || []) {
            for (const field of ['preventionControl', 'detectionControl']) {
              const v = (c[field] || '').trim();
              if (!v) continue;
              // Flaggear como sospechoso si es:
              // - Exactamente una palabra generica
              // - "Método" o variantes
              // - Menor a 10 caracteres y muy generico
              if (/^(m[eé]todo|proceso|sistema|control|capacitaci[oó]n|procedimiento|norma|est[aá]ndar|instructivo)$/i.test(v)) {
                console.log(`${d.amfe_number} | OP${op.opNumber} | ${field}: "${v}"`);
              }
              // Frases con "método" / "buen método" / etc
              if (/\bm[eé]todo\b/i.test(v) && v.split(/\s+/).length <= 3) {
                console.log(`${d.amfe_number} | OP${op.opNumber} | ${field}: "${v}" (contiene 'metodo')`);
              }
            }
          }
        }
      }
    }
  }
}
process.exit(0);
