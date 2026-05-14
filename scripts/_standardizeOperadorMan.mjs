/**
 * Estandariza "Operador de tapizado" / "Operador de insercion de varilla" /
 * "Operador de insercion" a "Operador de produccion" en los WEs reconvertidos
 * en la pasada anterior. Criterio Fak: "operador de produccion y listo, mas
 * facil asi lo estandarizas".
 *
 * Solo toca WEs con name en esa lista exacta. NO toca roles legitimos especificos
 * que ya estaban en los AMFEs (Costurera, Inspector de calidad, Operador de corte,
 * Operador de inyectora, etc. — esos son distintivos del proceso, no se generalizan).
 *
 * Uso:
 *   node scripts/_standardizeOperadorMan.mjs            # dry-run
 *   node scripts/_standardizeOperadorMan.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const TARGETS = [
  'operador de tapizado',
  'operador de insercion de varilla',
  'operador de insercion',
];
const NEW_NAME = 'Operador de produccion';

function normalize(s) {
  return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { apply } = parseSafeArgs();

const { data: rows, error } = await sb.from('amfe_documents').select('id, amfe_number, project_name, data');
if (error) { console.error(error); process.exit(2); }

const allPlans = [];
let totalChanges = 0;

for (const row of rows || []) {
  const before = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  if (!before || !Array.isArray(before.operations)) continue;
  const after = JSON.parse(JSON.stringify(before));

  let changes = 0;
  for (const op of after.operations) {
    for (const we of (op.workElements || [])) {
      const n = normalize(we.name || we.description || '');
      if (TARGETS.includes(n)) {
        console.log(`  ${row.amfe_number} OP ${op.opNumber || op.operationNumber}: "${we.name}" -> "${NEW_NAME}"`);
        we.name = NEW_NAME;
        we.description = NEW_NAME;
        we._autoFilled = Array.from(new Set([...(we._autoFilled || []), 'name']));
        changes++;
        totalChanges++;
      }
    }
  }
  if (changes === 0) continue;
  allPlans.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name || '', before, after });
}

console.log(`\nTotal WEs estandarizados: ${totalChanges}`);
console.log(`AMFEs afectados: ${allPlans.length}`);

if (allPlans.length === 0) { console.log('Nada que aplicar.'); process.exit(0); }

await runWithValidation(allPlans, apply, async () => {
  for (const p of allPlans) {
    const { error: upErr } = await sb.from('amfe_documents')
      .update({ data: p.after, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (upErr) { console.error(`Error update ${p.amfeNumber}:`, upErr); process.exit(2); }
    console.log(`Aplicado: ${p.amfeNumber}`);
  }
});
