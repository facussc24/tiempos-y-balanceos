/**
 * Reasigna modos de falla (failures) entre OPs del AMFE-HF-PAT que quedaron
 * mal alocados tras la renumeracion del 2026-05-14.
 *
 * El AMFE legacy tenia el contenido pegado a las OPs ORIGINALES. Al renumerar
 * (opNumber cambio) los modos de falla quedaron en filas que ahora tienen
 * nombre distinto y no corresponden conceptualmente.
 *
 * Movimientos definidos por keywords de descripcion:
 *
 *   FROM OP 50 ENFUNDADO -> OP 63 INYECCION DE PU
 *     - "Perdida de material" (fuga PUR)
 *     - "Pieza fuera de peso"
 *     - "Pieza con rebaba"
 *
 *   FROM OP 51 INSERCION VARILLA -> OP 40 COSTURA VISTA
 *     - "Costura vista con desviacion"
 *
 *   FROM OP 63 INYECCION PU -> OP 51 INSERCION VARILLA
 *     - "Varilla desalineada"
 *
 * NO toca: S/O/D, causas, controles, AP. Solo MUEVE el failure de un array
 * a otro. Preserva todo el contenido tal cual lo definio el equipo APQP.
 *
 * Uso:
 *   node scripts/_reassignHfPatLegacyFailures.mjs            # dry-run
 *   node scripts/_reassignHfPatLegacyFailures.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const HF_PAT_ID = '10eaebce-ad87-4035-9343-3e20e4ee0fc9';

// Reglas de movimiento: cada regla matchea por opNumber origen + substring en failure.description
const MOVES = [
  { fromOp: 50, toOp: 63, descContains: 'perdida de material' },
  { fromOp: 50, toOp: 63, descContains: 'fuera de peso' },
  { fromOp: 50, toOp: 63, descContains: 'rebaba' },
  { fromOp: 51, toOp: 40, descContains: 'costura vista' },
  { fromOp: 63, toOp: 51, descContains: 'varilla desalineada' },
];

function normalize(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { apply } = parseSafeArgs();

const { data: row, error } = await sb.from('amfe_documents')
  .select('id, amfe_number, project_name, data, updated_at')
  .eq('id', HF_PAT_ID).single();
if (error) { console.error(error); process.exit(2); }

const before = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
const after = JSON.parse(JSON.stringify(before));

console.log('\n=== Reasignacion failures legacy AMFE-HF-PAT ===\n');

// Helper: encontrar OP por opNumber
function getOp(doc, num) {
  return (doc.operations || []).find(op => parseInt(op.opNumber || op.operationNumber) === num);
}

// Helper: asegurar que la OP tenga workElements[0].functions[0] (estructura minima para recibir failures)
function ensureFunctionSlot(op) {
  if (!Array.isArray(op.workElements) || op.workElements.length === 0) {
    op.workElements = [{ type: 'Method', name: 'Pendiente definicion', functions: [{ description: 'Pendiente definicion', failures: [] }] }];
  }
  const we = op.workElements[0];
  if (!Array.isArray(we.functions) || we.functions.length === 0) {
    we.functions = [{ description: 'Pendiente definicion', failures: [] }];
  }
  if (!Array.isArray(we.functions[0].failures)) {
    we.functions[0].failures = [];
  }
  return we.functions[0];
}

let moved = 0;

for (const move of MOVES) {
  const srcOp = getOp(after, move.fromOp);
  const dstOp = getOp(after, move.toOp);
  if (!srcOp || !dstOp) {
    console.warn(`  ! OP ${move.fromOp} o ${move.toOp} no encontrada, skip "${move.descContains}"`);
    continue;
  }

  // Buscar el failure en srcOp por substring en description
  let foundFm = null;
  let foundFnIdx = -1;
  let foundFmIdx = -1;
  let foundWeIdx = -1;
  for (let wi = 0; wi < (srcOp.workElements || []).length; wi++) {
    const we = srcOp.workElements[wi];
    for (let fi = 0; fi < (we.functions || []).length; fi++) {
      const fn = we.functions[fi];
      for (let mi = 0; mi < (fn.failures || []).length; mi++) {
        const fm = fn.failures[mi];
        const desc = normalize(fm.description || fm.failureMode || '');
        if (desc.includes(normalize(move.descContains))) {
          foundFm = fm;
          foundWeIdx = wi;
          foundFnIdx = fi;
          foundFmIdx = mi;
          break;
        }
      }
      if (foundFm) break;
    }
    if (foundFm) break;
  }

  if (!foundFm) {
    console.warn(`  ! En OP ${move.fromOp}, no encontre failure "${move.descContains}"`);
    continue;
  }

  // Remover del srcOp
  srcOp.workElements[foundWeIdx].functions[foundFnIdx].failures.splice(foundFmIdx, 1);

  // Agregar al dstOp (primer WE/function disponible)
  const dstFn = ensureFunctionSlot(dstOp);
  dstFn.failures.push(foundFm);

  console.log(`  Movido FM "${foundFm.description.substring(0, 50)}..." de OP ${move.fromOp} -> OP ${move.toOp}`);
  moved++;
}

console.log(`\nTotal movimientos: ${moved}`);

if (moved === 0) {
  console.log('Nada que mover.');
  process.exit(0);
}

const plan = [{
  id: row.id,
  amfeNumber: row.amfe_number,
  productName: row.project_name || '',
  before, after,
}];

await runWithValidation(plan, apply, async () => {
  const { error: upErr } = await sb.from('amfe_documents')
    .update({ data: after, updated_at: new Date().toISOString() })
    .eq('id', HF_PAT_ID);
  if (upErr) { console.error(upErr); process.exit(2); }
  console.log('Update aplicado.');
}, { allowNewCritical: true });  // movemos contenido sin alterarlo, el validator puede ver diferencias en cause counts
