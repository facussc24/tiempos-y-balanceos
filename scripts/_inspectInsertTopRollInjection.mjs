/**
 * _inspectInsertTopRollInjection.mjs
 *
 * Quick read-only inspection of the injection operations of:
 *   - Insert Patagonia AMFE  (id: 7cfe2db7-9e5a-4b46-804d-76194557c581)
 *   - Top Roll Patagonia AMFE (id: 78eaa89b-ad0b-4342-9046-ab2e9b14d3b3)
 *
 * Prints: operation name, operationNumber, WE count, failure count, causes count,
 * and lists WE names + failure descriptions for debugging.
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

const TARGETS = [
  { label: 'Insert Patagonia', id: '7cfe2db7-9e5a-4b46-804d-76194557c581' },
  { label: 'Top Roll Patagonia', id: '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3' },
];

function normalizeOpName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.toUpperCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}
function parseAmfeData(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  if (typeof raw === 'object') return raw;
  return null;
}
function isInjectionPlastica(opName) {
  const n = normalizeOpName(opName);
  if (!n) return false;
  // EXCLUDE PU injection
  if (n.includes(' PU') || n.endsWith(' PU') || n.includes('POLIURETANO')) return false;
  return (
    n.includes('INYECCION DE PIEZA') ||
    n.includes('INYECCION DE PIEZAS PLASTICAS') ||
    n.includes('INYECCION PLASTICA')
  );
}

for (const t of TARGETS) {
  console.log('\n==============================================================');
  console.log(`${t.label}  (${t.id})`);
  console.log('==============================================================');

  const { data: row, error } = await sb
    .from('amfe_documents')
    .select('id, subject, project_name, amfe_number, data')
    .eq('id', t.id)
    .single();

  if (error) {
    console.log(`  ERROR: ${error.message}`);
    continue;
  }

  console.log(`  subject:       ${row.subject}`);
  console.log(`  project_name:  ${row.project_name}`);
  console.log(`  amfe_number:   ${row.amfe_number}`);
  console.log(`  data type:     ${typeof row.data}`);

  const data = parseAmfeData(row.data);
  if (!data || !Array.isArray(data.operations)) {
    console.log(`  ERROR: data invalid, operations not array`);
    continue;
  }
  console.log(`  operations:    ${data.operations.length}`);

  // List all operations
  console.log('\n  -- All operations --');
  for (const op of data.operations) {
    const rawName = op.operationName || op.name || '(no name)';
    const n = normalizeOpName(rawName);
    const isInj = isInjectionPlastica(rawName);
    const weCount = Array.isArray(op.workElements) ? op.workElements.length : 0;
    let fmCount = 0, cauCount = 0;
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fm of (fn.failures || [])) {
          fmCount++;
          cauCount += (fm.causes || []).length;
        }
      }
    }
    const marker = isInj ? ' [MATCH]' : '';
    console.log(`    OP ${op.operationNumber || op.opNumber}  "${rawName}"  WE=${weCount} FM=${fmCount} C=${cauCount}${marker}`);
  }

  // Detail of matched injection op
  const injOps = data.operations.filter(op => isInjectionPlastica(op.operationName || op.name));
  if (injOps.length === 0) {
    console.log('\n  NO injection plastica operation matched.');
    continue;
  }
  for (const op of injOps) {
    console.log(`\n  === DETAIL: OP ${op.operationNumber || op.opNumber} "${op.operationName || op.name}" ===`);
    console.log(`  linkedPfdStepId: ${op.linkedPfdStepId || '(none)'}`);
    console.log(`  focusElementFunction: ${(op.focusElementFunction || '').slice(0, 120)}...`);
    console.log(`  operationFunction: ${(op.operationFunction || '').slice(0, 120)}...`);
    for (const we of (op.workElements || [])) {
      const fnCount = (we.functions || []).length;
      let fmCount = 0;
      for (const fn of (we.functions || [])) fmCount += (fn.failures || []).length;
      console.log(`    WE "${we.name}" (type=${we.type}) fn=${fnCount} fm=${fmCount}`);
      for (const fn of (we.functions || [])) {
        for (const fm of (fn.failures || [])) {
          const cCount = (fm.causes || []).length;
          console.log(`       FM: "${fm.description}"  causes=${cCount}`);
        }
      }
    }
  }
}

console.log('\nDONE.');
