/**
 * Completa operationFunction de las OPs del AMFE-HF-PAT que tienen WEs pero
 * dejaron `operationFunction` vacio tras la renumeracion.
 *
 * OPs afectadas (segun warnings del validator post-renumeracion):
 *   OP 51 INSERCION DE VARILLA
 *   OP 63 INYECCION DE PU
 *   OP 90 EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO
 *
 * Reglas aplicadas:
 *  - Lenguaje simple, max 8-10 palabras (amfe.md "Lenguaje simple")
 *  - operationFunction = QUE HACE EL PASO especifico (Nivel 2 VDA 2019 Step 3)
 *    Distinto de focusElementFunction (Nivel 1) — regla amfe-funciones-3-niveles.md
 *  - NO inventar valores tecnicos. Solo describir la funcion del paso.
 *
 * Uso:
 *   node scripts/_fillHfPatOpFunctions.mjs             # dry-run
 *   node scripts/_fillHfPatOpFunctions.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const HF_PAT_ID = '10eaebce-ad87-4035-9343-3e20e4ee0fc9';

// operationFunction propuesta por OP (Nivel 2 VDA 2019 Step 3 — funcion del paso)
const OP_FUNCTIONS = {
  10: 'Asegurar conformidad de calidad, cantidad y trazabilidad de materia prima',
  20: 'Cortar vinilo segun dimensiones de paneles sin defectos visibles',
  30: 'Unir paneles textiles con costura resistente y alineada',
  40: 'Aplicar costura vista cumpliendo densidad de puntada y color de hilo',
  50: 'Calzar funda sobre asta sin pliegues y centrada',
  51: 'Insertar varilla en funda asegurando vinilo como reten para evitar fuga PU',
  63: 'Inyectar mezcla PU controlando relacion y tiempo de curado sin defectos',
  70: 'Verificar conformidad final dimensional, estetica y funcional del producto',
  90: 'Embalar y etiquetar producto terminado segun especificacion cliente',
};

// ---------- Auth ----------
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { apply } = parseSafeArgs();

// ---------- Read live ----------
const { data: row, error } = await sb.from('amfe_documents')
  .select('id, amfe_number, project_name, data, updated_at')
  .eq('id', HF_PAT_ID)
  .single();
if (error) { console.error('Error leyendo AMFE-HF-PAT:', error); process.exit(2); }

const before = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
const after = JSON.parse(JSON.stringify(before));

// ---------- Transform ----------
console.log('\n=== Fill operationFunction OPs 51, 63, 90 ===\n');

let changed = 0;
after.operations = (after.operations || []).map(op => {
  const num = parseInt(op.opNumber || op.operationNumber);
  const proposed = OP_FUNCTIONS[num];
  if (!proposed) return op;
  if ((op.operationFunction || '').trim()) {
    console.log(`  OP ${num}: ya tiene operationFunction, skip ("${op.operationFunction.substring(0, 60)}...")`);
    return op;
  }
  console.log(`  OP ${num}: set operationFunction = "${proposed}"`);
  changed++;
  return { ...op, operationFunction: proposed };
});

console.log(`\nTotal cambios: ${changed}`);

if (changed === 0) {
  console.log('Nada que hacer.');
  process.exit(0);
}

// ---------- Validate + commit ----------
const plan = [{
  id: row.id,
  amfeNumber: row.amfe_number,
  productName: row.project_name || '',
  before,
  after,
}];

await runWithValidation(plan, apply, async () => {
  const { error: upErr } = await sb.from('amfe_documents')
    .update({ data: after, updated_at: new Date().toISOString() })
    .eq('id', HF_PAT_ID);
  if (upErr) { console.error('Error update:', upErr); process.exit(2); }
  console.log('Update aplicado.');
});
