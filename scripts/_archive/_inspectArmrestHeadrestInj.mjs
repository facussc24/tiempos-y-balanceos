/**
 * Inspeccion read-only de los 4 AMFEs target de la sincronizacion de inyeccion.
 * Imprime subject/id, operaciones (nombre normalizado), y WEs por operacion
 * para las ops que matcheen con "INYECCION".
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

function parseData(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  if (typeof raw === 'object') return raw;
  return null;
}

function norm(s) {
  if (typeof s !== 'string') return '';
  return s.toUpperCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

const { data: rows, error } = await sb
  .from('amfe_documents')
  .select('id, subject, project_name, data')
  .or('subject.ilike.%Armrest%,subject.ilike.%Headrest%,project_name.ilike.%Armrest%,project_name.ilike.%Headrest%');

if (error) { console.error(error); process.exit(1); }

console.log(`rows found: ${rows.length}\n`);

for (const row of rows) {
  const d = parseData(row.data);
  console.log(`─────────────────────────────────────────`);
  console.log(`id:           ${row.id}`);
  console.log(`subject:      ${row.subject}`);
  console.log(`project_name: ${row.project_name}`);
  console.log(`family_id:    ${row.family_id}`);
  console.log(`data type:    ${typeof row.data}`);
  if (!d || !Array.isArray(d.operations)) {
    console.log('  (no operations)\n');
    continue;
  }
  console.log(`  operations: ${d.operations.length}`);
  for (const op of d.operations) {
    const n = op.operationName ?? op.name ?? '';
    const normed = norm(n);
    const marker = normed.includes('INYECCION') || normed.includes('INYECTAR') ? ' <-- INY' : '';
    console.log(`    op ${op.operationNumber ?? op.opNumber ?? '?'} "${n}" [${normed}]${marker}`);
    if (marker) {
      const wes = op.workElements || [];
      console.log(`       WEs (${wes.length}):`);
      for (const we of wes) {
        const fns = we.functions || [];
        let fmCount = 0, causeCount = 0;
        for (const fn of fns) {
          for (const fm of (fn.failures || [])) {
            fmCount++;
            for (const c of (fm.causes || [])) causeCount++;
          }
        }
        console.log(`         - [${we.type}] ${we.name}  (${fns.length} fn, ${fmCount} fm, ${causeCount} c)`);
      }
    }
  }
  console.log('');
}
