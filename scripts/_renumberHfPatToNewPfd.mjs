/**
 * Renumera y reordena el AMFE-HF-PAT (Front Headrest Patagonia VW Amarok) para
 * alinearlo al PFD preliminar P-APO-001/PRE rev 04/05/2026 que arma Fak.
 *
 * Cambios:
 * 1. ELIMINA OP 11 (CONTROL DE MATERIA PRIMA) — redundante con OP 10 (recepcion incluye control).
 * 2. RENUMERA legacy -> nuevo segun tabla:
 *      25 -> 28 (mylar)
 *      50 -> 63 (inyeccion PU)
 *      60 -> 50 (enfundado)
 *      70 -> 51 (insercion varilla)
 *      80 -> 70 (control final)
 *      90 -> 80, 91 -> 81, 92 -> 82 (reprocesos)
 *      100 -> 90 (embalaje)
 * 3. RENOMBRA OP 20 -> "OP 20-26 CORTE DE VINILO" (criterio Fak: agrupar sub-pasos similares).
 *    RENOMBRA OP 30 -> "OP 30-33 COSTURA UNION" (idem).
 * 4. CREA OP 60, 61, 62 (pre-inyeccion PU) vacias (placeholder, equipo APQP completara).
 * 5. LIMPIA operationFunction de OP 40 (esta duplicada con focusElementFunction,
 *    bug pre-2026-05-08 estilo AMFE 150, regla amfe-funciones-3-niveles.md).
 *
 * NO inventa: WEs, causas, controles, acciones, CC/SC. Las OPs vacias quedan
 * como placeholder para que el equipo APQP las complete.
 *
 * Uso:
 *   node scripts/_renumberHfPatToNewPfd.mjs               # dry-run
 *   node scripts/_renumberHfPatToNewPfd.mjs --apply       # aplica (bloquea si introduce criticos)
 *   node scripts/_renumberHfPatToNewPfd.mjs --apply --allow-new-critical  # aplica permitiendo nuevos criticos (justificado: creamos OP 60-62 vacias)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const HF_PAT_ID = '10eaebce-ad87-4035-9343-3e20e4ee0fc9';

const RENUMBER = {
  10: 10,
  11: null,    // eliminar
  20: 20,
  25: 28,
  30: 30,
  40: 40,
  50: 63,
  60: 50,
  70: 51,
  80: 70,
  90: 80,
  91: 81,
  92: 82,
  100: 90,
};

const RENAME = {
  20: 'OP 20-26 CORTE DE VINILO',
  30: 'OP 30-33 COSTURA UNION',
};

// OPs nuevas pre-inyeccion PU (vacias, placeholder)
const NEW_OPS_DEFINITIONS = [
  { num: 60, name: 'COLOCACION DE PRECINTO CON PISTOLA ETIQUETADORA' },
  { num: 61, name: 'COLOCACION DE BOLSA Y CARGA DEL APOYACABEZAS EN EL MOLDE' },
  { num: 62, name: 'CIERRE DEL MOLDE Y COLOCACION DE BOQUILLA' },
];

// ---------- Auth ----------
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { apply } = parseSafeArgs();
const allowNewCritical = process.argv.includes('--allow-new-critical');

// ---------- Read live ----------
const { data: row, error } = await sb.from('amfe_documents')
  .select('id, amfe_number, project_name, data, updated_at')
  .eq('id', HF_PAT_ID)
  .single();
if (error) { console.error('Error leyendo AMFE-HF-PAT:', error); process.exit(2); }

const before = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
const after = JSON.parse(JSON.stringify(before));  // deep clone para mutar

// Sample focusElementFunction (invariante entre OPs)
const sampleFef = (after.operations || []).find(op => op.focusElementFunction)?.focusElementFunction || '';

// ---------- Transform ----------
console.log('\n=== Transformacion AMFE-HF-PAT (PFD P-APO-001/PRE alignment) ===\n');

// 1. Eliminar OP 11
const beforeOps = after.operations || [];
let ops = beforeOps.filter(op => {
  const n = parseInt(op.opNumber || op.operationNumber);
  return RENUMBER[n] !== null;  // null = eliminar
});
console.log(`Eliminado OP 11 (CONTROL DE MATERIA PRIMA) — redundante con OP 10`);

// 2. Renumerar y renombrar
ops = ops.map(op => {
  const oldNum = parseInt(op.opNumber || op.operationNumber);
  const newNum = RENUMBER[oldNum];
  if (newNum === undefined) {
    console.warn(`  ! OP ${oldNum} NO esta en el RENUMBER map, se mantiene tal cual`);
    return op;
  }
  const newName = RENAME[newNum] || op.name || op.operationName;
  const cleanedOpFunc = (oldNum === 40 && op.operationFunction && op.operationFunction === op.focusElementFunction)
    ? ''  // regla amfe-funciones-3-niveles: NO duplicar focusElementFunction en operationFunction
    : (op.operationFunction || '');
  if (oldNum !== newNum) console.log(`  Renumerar OP ${oldNum} -> ${newNum} (${newName})`);
  else if (RENAME[newNum]) console.log(`  Renombrar OP ${oldNum}: "${op.name}" -> "${newName}"`);
  if (oldNum === 40 && cleanedOpFunc === '') console.log(`  Limpiar opFunc OP 40 (duplicada con focusElementFunction)`);
  return {
    ...op,
    opNumber: String(newNum),
    operationNumber: String(newNum),
    name: newName,
    operationName: newName,
    operationFunction: cleanedOpFunc,
  };
});

// 3. Crear OPs 60, 61, 62 (placeholder vacias)
for (const def of NEW_OPS_DEFINITIONS) {
  ops.push({
    opNumber: String(def.num),
    operationNumber: String(def.num),
    name: def.name,
    operationName: def.name,
    focusElementFunction: sampleFef,
    operationFunction: '',
    workElements: [],
  });
  console.log(`  Crear OP ${def.num} ${def.name} (vacia, placeholder)`);
}

// 4. Ordenar por opNumber numerico
ops.sort((a, b) => parseInt(a.opNumber) - parseInt(b.opNumber));

after.operations = ops;

console.log('\nOPs resultantes:');
for (const op of after.operations) {
  console.log(`  OP ${op.opNumber} — ${op.name} (WEs:${(op.workElements || []).length})`);
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
  if (upErr) {
    console.error('Error en update:', upErr);
    process.exit(2);
  }
  console.log('Update aplicado a Supabase.');
}, { allowNewCritical });
