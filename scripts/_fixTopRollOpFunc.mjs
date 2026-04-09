/**
 * Fix Top Roll AMFE — Set operationFunction on all 10 operations.
 * operationFunction = "Func. Paso" = what is done at each process step.
 * Different from focusElementFunction (function of the product, already filled).
 *
 * Source: AMFE de Proceso - TOP ROLL.pdf (column "Func. Paso")
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

const AMFE_ID = '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3';

// Func. Paso from the PDF (column "Func. Paso" in AMFE de Proceso - TOP ROLL.pdf)
const OP_FUNCTIONS = {
  '5':  'Asegurar la conformidad de la calidad y cantidad de material recibido',
  '10': 'Fabricar la pieza plastica cumpliendo con las especificaciones dimensionales y de apariencia',
  '20': 'Aplicar una capa uniforme de adhesivo Hot Melt sobre el sustrato TPO para garantizar la adhesion',
  '30': 'Conformar termicamente la lamina pre-laminada para obtener la geometria final y replicar la textura (grano)',
  '40': 'Entregar piezas con contorno final dentro de tolerancia dimensional, bordes sin rebarbas ni quemaduras',
  '50': 'Plegar el borde de TPO sobre el reverso del sustrato y adherirlo por presion generando un borde estetico',
  '60': 'Unir permanentemente los refuerzos plasticos al sustrato del Top Roll mediante fusion ultrasonica',
  '70': 'Union permanente del Tweeter al sustrato del Top Roll mediante soldadura por ultrasonido',
  '80': 'Verificar y confirmar que el Top Roll cumple con el 100% de las especificaciones. Proteger para transporte.',
  '90': 'Preservar el producto terminado y transportarlo de manera segura al cliente',
};

// 1. Fetch doc
const { data: doc, error: fetchErr } = await sb.from('amfe_documents').select('id, data').eq('id', AMFE_ID).single();
if (fetchErr) { console.error('FETCH ERROR:', fetchErr.message); process.exit(1); }
let d = doc.data;
if (typeof d === 'string') d = JSON.parse(d);

// 2. Fill operationFunction
let updated = 0;
for (const op of (d.operations || [])) {
  const num = op.opNumber || op.operationNumber || '';
  if (OP_FUNCTIONS[num]) {
    const prev = op.operationFunction || '(vacío)';
    op.operationFunction = OP_FUNCTIONS[num];
    console.log(`OP ${num} ${op.name || op.operationName}: "${OP_FUNCTIONS[num]}" (was: ${prev})`);
    updated++;
  }
}

if (updated === 0) {
  console.log('No operations matched. Check opNumber values.');
  process.exit(1);
}

// 3. Save — object, NEVER stringify
const { error: saveErr } = await sb.from('amfe_documents').update({ data: d }).eq('id', AMFE_ID);
if (saveErr) { console.error('SAVE ERROR:', saveErr.message); process.exit(1); }
console.log(`\nSaved ${updated} operationFunction fields.`);

// 4. Verify post-save
const { data: v } = await sb.from('amfe_documents').select('data').eq('id', AMFE_ID).single();
const vd = typeof v.data === 'string' ? JSON.parse(v.data) : v.data;

if (typeof v.data !== 'object') {
  console.error('CRITICAL: data is string (double-serialized)!');
  process.exit(1);
}

console.log(`\n--- Verification ---`);
console.log(`typeof data = ${typeof v.data} (should be object)`);
console.log(`operations count = ${vd.operations?.length}`);
for (const op of vd.operations) {
  const num = op.opNumber || op.operationNumber;
  console.log(`OP ${num}: operationFunction = "${op.operationFunction || '(vacío)'}"`);
}
