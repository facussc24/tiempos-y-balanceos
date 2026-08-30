// READ-ONLY contra Supabase live. Confirma si los inventos siguen presentes hoy.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local', 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const PATTERNS = [
  ['hielo seco', /hielo seco/i],
  ['flexómetro', /flex[oó]metro/i],
  ['Medición por Ultrasonido cada', /medici[oó]n por ultrasonido cada/i],
  ['Rotacion de inspectores cada', /rotaci[oó]n de inspectores cada/i],
  ['pistola de ultrasonido', /pistola de ultrasonido/i],
];

for (const tbl of ['amfe_documents','cp_documents','ho_documents','pfd_documents']) {
  const { data, error } = await sb.from(tbl).select('id, data');
  if (error) { console.error(tbl, error.message); continue; }
  console.log(`\n=== ${tbl} (${data.length}) ===`);
  for (const d of data) {
    const s = typeof d.data === 'string' ? d.data : JSON.stringify(d.data);
    for (const [name, pat] of PATTERNS) {
      const m = s.match(new RegExp(pat.source, 'gi'));
      if (m) console.log(`  ${d.id.slice(0,8)}: "${name}" x${m.length}`);
    }
  }
}
