/**
 * Corrige el focusElementFunction del AMFE-HF-PAT.
 *
 * INCIDENTE detectado 2026-05-14: el `focusElementFunction` de TODAS las OPs
 * tiene texto generico de INYECCION PLASTICA ("Conformar la pieza plastica
 * segun especificaciones dimensionales..."). Es texto propagado erroneamente
 * por el incidente 2026-04-20 (script `syncArmrestHeadrestFromInjectionMaster.mjs`
 * que copio el maestro de inyeccion plastica a los 3 Headrest).
 *
 * Sin embargo, el `operationFunction` de OP 40 (COSTURA VISTA) conserva el
 * texto correcto del Headrest:
 *   "Interno (Barack): Proveer apoyacabezas conforme con soporte estructural
 *    de varilla, espuma PU y funda textil/vinilo, cumpliendo integridad de
 *    costura, ensamble y bordes. / Cliente (VWA): Montar sin..."
 *
 * Este script:
 *  1. Toma el `operationFunction` de OP 40 (texto Headrest correcto)
 *  2. Lo aplica como `focusElementFunction` a TODAS las OPs
 *  3. Vacia el `operationFunction` de OP 40 (estaba duplicado con focusElementFunction
 *     una vez aplicado el fix — regla amfe-funciones-3-niveles.md)
 *
 * NO inventa contenido. Solo mueve texto ya validado al campo correcto.
 *
 * Uso:
 *   node scripts/_fixHfPatFocusElementFunction.mjs            # dry-run
 *   node scripts/_fixHfPatFocusElementFunction.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const HF_PAT_ID = '10eaebce-ad87-4035-9343-3e20e4ee0fc9';

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

// Localizar texto Headrest correcto (en OP 40 operationFunction)
const op40 = (after.operations || []).find(op => parseInt(op.opNumber || op.operationNumber) === 40);
if (!op40 || !op40.operationFunction) {
  console.error('OP 40 no encontrada o sin operationFunction. Aborto.');
  process.exit(2);
}

const headrestFocus = op40.operationFunction;
console.log('\n=== Fix focusElementFunction AMFE-HF-PAT ===\n');
console.log(`Texto Headrest correcto (de OP 40 opFunc, ${headrestFocus.length} chars):`);
console.log(`"${headrestFocus.substring(0, 250)}..."\n`);

let updated = 0;
after.operations = (after.operations || []).map(op => {
  const num = parseInt(op.opNumber || op.operationNumber);
  const currentFef = op.focusElementFunction || '';
  if (currentFef === headrestFocus) {
    return op;  // ya correcto
  }
  // Reemplazar el focusElementFunction (estaba con texto de inyeccion plastica)
  console.log(`  OP ${num}: focusElementFunction reemplazado (era "${currentFef.substring(0, 50)}...")`);
  updated++;
  return { ...op, focusElementFunction: headrestFocus };
});

// Vaciar op.operationFunction de OP 40 (queda duplicada con focusElementFunction)
const after40 = after.operations.find(op => parseInt(op.opNumber || op.operationNumber) === 40);
if (after40 && after40.operationFunction === headrestFocus) {
  after40.operationFunction = '';
  console.log(`\n  OP 40: operationFunction vaciado (estaba duplicado con focusElementFunction tras fix)`);
}

console.log(`\nOPs con focusElementFunction actualizado: ${updated}`);

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
});
