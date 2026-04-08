/**
 * Verify IP PAD AMFE data after fix.
 * The `data` column is TEXT type in Supabase, so it's NORMAL for typeof to be 'string'.
 * We just need to verify the JSON parses correctly and contains our changes.
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

const AMFE_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';

const { data: doc, error } = await sb
  .from('amfe_documents')
  .select('data')
  .eq('id', AMFE_ID)
  .single();

if (error) {
  console.error('Fetch error:', error.message);
  process.exit(1);
}

console.log('typeof doc.data:', typeof doc.data);

// Parse the data (it's TEXT column, so it's a string — that's normal)
let amfeData;
if (typeof doc.data === 'string') {
  amfeData = JSON.parse(doc.data);
  // Check if still double-serialized (would be a string again)
  if (typeof amfeData === 'string') {
    console.log('WARNING: data is double-serialized. Parsing again...');
    amfeData = JSON.parse(amfeData);
  }
} else {
  amfeData = doc.data;
}

console.log('typeof parsed data:', typeof amfeData);
console.log('Operations count:', amfeData.operations?.length);

let allGood = true;

// Check Task 1: OP 130 should NOT have embalaje WE, OP 140 should have it
const op130 = amfeData.operations.find(op => (op.operationNumber || op.opNumber) === '130');
const op140 = amfeData.operations.find(op => (op.operationNumber || op.opNumber) === '140');

if (op130) {
  console.log('\n--- OP 130 (CONTROL FINAL DE CALIDAD) ---');
  const hasEmbalaje = (op130.workElements || []).some(we => (we.name || '').toLowerCase().includes('embalaje'));
  console.log(`  WEs: ${(op130.workElements || []).length}`);
  for (const we of (op130.workElements || [])) {
    console.log(`    - "${we.name}" [${we.type}]`);
  }
  if (hasEmbalaje) {
    console.log('  FAIL: OP 130 still has embalaje WE!');
    allGood = false;
  } else {
    console.log('  OK: No embalaje WE in OP 130');
  }
}

if (op140) {
  console.log('\n--- OP 140 (EMBALAJE DE PRODUCTO TERMINADO) ---');
  const hasEmbalaje = (op140.workElements || []).some(we => (we.name || '').toLowerCase().includes('embalaje'));
  console.log(`  WEs: ${(op140.workElements || []).length}`);
  for (const we of (op140.workElements || [])) {
    console.log(`    - "${we.name}" [${we.type}]`);
  }
  if (hasEmbalaje) {
    console.log('  OK: OP 140 has embalaje WE');
  } else {
    console.log('  FAIL: OP 140 missing embalaje WE!');
    allGood = false;
  }
}

// Check Task 2: OP 110 renamed
const op110 = amfeData.operations.find(op => (op.operationNumber || op.opNumber) === '110');
if (op110) {
  console.log('\n--- OP 110 ---');
  const n = op110.name || op110.operationName;
  const on = op110.operationName || op110.name;
  console.log(`  name: "${op110.name}"`);
  console.log(`  operationName: "${op110.operationName}"`);
  if (n === 'SOLDADURA CON ULTRASONIDO Y ENSAMBLE' && on === 'SOLDADURA CON ULTRASONIDO Y ENSAMBLE') {
    console.log('  OK: Both aliases updated');
  } else {
    console.log('  FAIL: Name not updated correctly');
    allGood = false;
  }
}

// Check Task 3: OP 10 separate WEs
const op10 = amfeData.operations.find(op => (op.operationNumber || op.opNumber) === '10');
if (op10) {
  console.log('\n--- OP 10 (RECEPCION DE MATERIA PRIMA) ---');
  console.log(`  WEs: ${(op10.workElements || []).length}`);
  for (const we of (op10.workElements || [])) {
    console.log(`    - "${we.name}" [${we.type}] (${(we.functions || []).length} funcs)`);
    for (const f of (we.functions || [])) {
      const desc = f.description || f.functionDescription;
      console.log(`      func: "${desc}" (${(f.failures || []).length} failures)`);
      for (const fail of (f.failures || [])) {
        console.log(`        fail: "${fail.description}" S=${fail.severity}`);
        for (const c of (fail.causes || [])) {
          console.log(`          cause: "${c.cause || c.description}" O=${c.occurrence} D=${c.detection} AP=${c.ap || c.actionPriority}`);
        }
      }
    }
  }

  // Check no grouped WE remains
  const grouped = (op10.workElements || []).find(we => (we.name || '').includes('vinilo PVC, espuma PU'));
  if (grouped) {
    console.log('  FAIL: Grouped materia prima WE still exists!');
    allGood = false;
  } else {
    console.log('  OK: No grouped materia prima WE');
  }

  // Check individual WEs exist
  const hasVinilo = (op10.workElements || []).some(we => (we.name || '').includes('Vinilo PVC'));
  const hasEspuma = (op10.workElements || []).some(we => (we.name || '').includes('Espuma PU'));
  const hasSustrato = (op10.workElements || []).some(we => (we.name || '').includes('Sustrato PP'));
  const hasClips = (op10.workElements || []).some(we => (we.name || '').includes('Clips'));
  const hasLogo = (op10.workElements || []).some(we => (we.name || '').includes('Logo airbag'));
  const hasTornillos = (op10.workElements || []).some(we => (we.name || '').includes('Tornillos'));
  const hasDifusor = (op10.workElements || []).some(we => (we.name || '').includes('Difusor'));

  console.log(`  Vinilo PVC: ${hasVinilo ? 'OK' : 'MISSING'}`);
  console.log(`  Espuma PU: ${hasEspuma ? 'OK' : 'MISSING'}`);
  console.log(`  Sustrato PP: ${hasSustrato ? 'OK' : 'MISSING'}`);
  console.log(`  Clips: ${hasClips ? 'OK' : 'MISSING'}`);
  console.log(`  Logo airbag: ${hasLogo ? 'OK' : 'MISSING'}`);
  console.log(`  Tornillos: ${hasTornillos ? 'OK' : 'MISSING'}`);
  console.log(`  Difusor: ${hasDifusor ? 'OK' : 'MISSING'}`);

  if (!hasVinilo || !hasEspuma || !hasSustrato || !hasClips || !hasLogo || !hasTornillos || !hasDifusor) {
    allGood = false;
  }
}

console.log(`\n=== FINAL RESULT: ${allGood ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'} ===`);
process.exit(allGood ? 0 : 1);
