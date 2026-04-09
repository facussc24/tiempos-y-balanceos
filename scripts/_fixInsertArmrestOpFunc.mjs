/**
 * Fill empty operationFunction in INSERT and ARMREST_DOOR_PANEL AMFEs.
 *
 * INSERT (7cfe2db7-9e5a-4b46-804d-76194557c581):
 *   OP 5 RECEPCION DE MATERIA PRIMA
 *
 * ARMREST_DOOR_PANEL (5268704d-30ae-48f3-ad05-8402a6ded7fe):
 *   OP 10 RECEPCION DE MATERIA PRIMA
 *   OP 20 CORTE DE COMPONENTES
 *   OP 50 COSTURA UNION
 *   OP 90 TAPIZADO SEMIAUTOMATICO
 *   OP 100 CONTROL FINAL DE CALIDAD
 *   OP 110 EMBALAJE
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// --- operationFunction map per product ---

// INSERT: pieza de puerta (tela cortada + cosida + sustrato inyectado + adhesivada)
const insertOpFunc = {
  '5': 'Asegurar la conformidad de la calidad, cantidad y trazabilidad de la materia prima recibida',
};

// ARMREST DOOR PANEL: apoyabrazos de puerta (tela cortada + cosida + inyectado + PU + adhesivado + tapizado)
const armrestOpFunc = {
  '10': 'Asegurar la conformidad de la calidad, cantidad y trazabilidad de la materia prima recibida',
  '20': 'Proveer componentes cortados conforme a requerimientos dimensionales y de forma',
  '50': 'Unir las piezas de tela mediante costura garantizando resistencia y alineación de costuras',
  '90': 'Revestir el sustrato con la funda cosida asegurando adherencia, posición y ausencia de defectos superficiales',
  '100': 'Asegurar la conformidad del producto terminado verificando dimensiones, apariencia y funcionalidad antes del embalaje',
  '110': 'Mantener la integridad física y la conformidad del producto durante el almacenamiento y transporte',
};

const docs = [
  { id: '7cfe2db7-9e5a-4b46-804d-76194557c581', name: 'INSERT', map: insertOpFunc },
  { id: '5268704d-30ae-48f3-ad05-8402a6ded7fe', name: 'ARMREST_DOOR_PANEL', map: armrestOpFunc },
];

for (const { id, name, map } of docs) {
  console.log(`\n=== ${name} (${id}) ===`);
  const { data: doc, error: fetchErr } = await sb.from('amfe_documents').select('id, data').eq('id', id).single();
  if (fetchErr) { console.error('FETCH ERROR:', fetchErr.message); continue; }

  const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
  let fixed = 0;

  for (const op of (data.operations || [])) {
    const num = op.opNumber || op.operationNumber || '';
    if (map[num] && (!op.operationFunction || op.operationFunction.trim() === '')) {
      op.operationFunction = map[num];
      console.log(`  OP ${num} ${op.operationName || op.name || ''}: SET operationFunction`);
      fixed++;
    }
  }

  if (fixed > 0) {
    const { error } = await sb.from('amfe_documents').update({ data }).eq('id', doc.id);
    console.log(error ? '  SAVE FAILED: ' + error.message : `  Saved OK (${fixed} OPs fixed)`);
  } else {
    console.log('  Nothing to fix');
  }

  // Verify
  const { data: v } = await sb.from('amfe_documents').select('data').eq('id', doc.id).single();
  const vd = typeof v.data === 'string' ? JSON.parse(v.data) : v.data;
  console.log(`  --- Verification ---`);
  for (const op of vd.operations) {
    const num = op.opNumber || op.operationNumber || '';
    if (map[num]) {
      const of_ = op.operationFunction || '(EMPTY)';
      console.log(`  OP ${num}: operationFunction="${of_}"`);
    }
  }
}

console.log('\nDone.');
