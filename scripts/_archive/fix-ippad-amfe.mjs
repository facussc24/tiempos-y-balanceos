/**
 * Fix IP PAD AMFE — Tasks from 2026-04-08
 * 1. Move WE "Procedimiento embalaje CKD" from OP 130 to OP 140
 * 2. Rename OP 110 to "SOLDADURA CON ULTRASONIDO Y ENSAMBLE"
 * 3. Separate materia prima WE in OP 10 into 3 individual WEs
 * 4. Add 4 new material WEs in OP 10 (Clips, Logo, Tornillos, Difusor)
 * 5. Backup, verify typeof data
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Read .env.local manually ────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ── AP calculation (copied from apTable.ts) ─────────────────────────
function apRule(s, o, d) {
  if (s <= 1) return 'L';
  if (s <= 3) {
    if (o >= 8 && d >= 5) return 'M';
    return 'L';
  }
  if (s <= 6) {
    if (o >= 8) return d >= 5 ? 'H' : 'M';
    if (o >= 6) return d >= 2 ? 'M' : 'L';
    if (o >= 4) return d >= 7 ? 'M' : 'L';
    return 'L';
  }
  if (s <= 8) {
    if (o >= 8) return 'H';
    if (o >= 6) return d >= 2 ? 'H' : 'M';
    if (o >= 4) return d >= 7 ? 'H' : 'M';
    if (o >= 2) return d >= 5 ? 'M' : 'L';
    return 'L';
  }
  // S = 9-10
  if (o >= 6) return 'H';
  if (o >= 4) return d >= 2 ? 'H' : 'M';
  if (o >= 2) {
    if (d >= 7) return 'H';
    if (d >= 5) return 'M';
    return 'L';
  }
  return 'L';
}

function calculateAP(s, o, d) {
  if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
  const sInt = Math.round(s);
  const oInt = Math.round(o);
  const dInt = Math.round(d);
  if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';
  return apRule(sInt, oInt, dInt);
}

// ── Fetch the AMFE ──────────────────────────────────────────────────
const AMFE_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';

const { data: doc, error: fetchErr } = await sb
  .from('amfe_documents')
  .select('*')
  .eq('id', AMFE_ID)
  .single();

if (fetchErr) {
  console.error('ERROR fetching AMFE:', fetchErr.message);
  process.exit(1);
}

// Parse if double-serialized
let amfeData = doc.data;
if (typeof amfeData === 'string') {
  amfeData = JSON.parse(amfeData);
  console.log('WARNING: data was double-serialized string, parsed it.');
}

console.log('=== IP PAD AMFE fetched ===');
console.log(`Operations: ${amfeData.operations.length}`);
for (const op of amfeData.operations) {
  const opNum = op.operationNumber || op.opNumber;
  const opName = op.operationName || op.name;
  console.log(`  OP ${opNum}: ${opName} (${(op.workElements || []).length} WEs)`);
  for (const we of (op.workElements || [])) {
    console.log(`    WE: "${we.name}" [${we.type}] (${(we.functions || []).length} functions)`);
  }
}

// ── Backup before changes ───────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/ippad-fix-${ts}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });
writeFileSync(`${backupDir}/amfe_before.json`, JSON.stringify(amfeData, null, 2));
console.log(`\nBackup saved to: ${backupDir}/amfe_before.json`);

// ── Deep clone for modification ─────────────────────────────────────
const data = JSON.parse(JSON.stringify(amfeData));

// Helper to find op by number
function findOp(opNum) {
  return data.operations.find(op =>
    (op.operationNumber || op.opNumber) === String(opNum)
  );
}

// ═══════════════════════════════════════════════════════════════════
// TASK 1: Move WE "Procedimiento embalaje CKD" from OP 130 to OP 140
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== TASK 1: Move WE from OP 130 to OP 140 ===');

const op130 = findOp(130);
const op140 = findOp(140);

if (!op130) {
  console.error('ERROR: OP 130 not found!');
  process.exit(1);
}
if (!op140) {
  console.error('ERROR: OP 140 not found!');
  process.exit(1);
}

// Find the WE with function "Embalar sin deformaciones" or name containing "embalaje"
let weToMoveIdx = -1;
for (let i = 0; i < (op130.workElements || []).length; i++) {
  const we = op130.workElements[i];
  const nameMatch = (we.name || '').toLowerCase().includes('embalaje');
  const funcMatch = (we.functions || []).some(f => {
    const desc = (f.description || f.functionDescription || '').toLowerCase();
    return desc.includes('embalar');
  });
  if (nameMatch || funcMatch) {
    weToMoveIdx = i;
    break;
  }
}

if (weToMoveIdx === -1) {
  console.error('ERROR: Could not find WE with embalaje/embalar in OP 130');
  console.log('OP 130 WEs:');
  for (const we of (op130.workElements || [])) {
    console.log(`  - "${we.name}"`);
    for (const f of (we.functions || [])) {
      console.log(`    func: "${f.description || f.functionDescription}"`);
    }
  }
  process.exit(1);
}

const weToMove = op130.workElements.splice(weToMoveIdx, 1)[0];
console.log(`Removed WE "${weToMove.name}" from OP 130`);

if (!op140.workElements) op140.workElements = [];
op140.workElements.push(weToMove);
console.log(`Added WE "${weToMove.name}" to OP 140`);
console.log(`OP 130 now has ${op130.workElements.length} WEs`);
console.log(`OP 140 now has ${op140.workElements.length} WEs`);

// ═══════════════════════════════════════════════════════════════════
// TASK 2: Rename OP 110
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== TASK 2: Rename OP 110 ===');

const op110 = findOp(110);
if (!op110) {
  console.error('ERROR: OP 110 not found!');
  process.exit(1);
}

const oldName = op110.name || op110.operationName;
const newName = 'SOLDADURA CON ULTRASONIDO Y ENSAMBLE';
// Update BOTH aliases
op110.name = newName;
op110.operationName = newName;
console.log(`Renamed OP 110: "${oldName}" -> "${newName}"`);
console.log(`  op110.name = "${op110.name}"`);
console.log(`  op110.operationName = "${op110.operationName}"`);

// ═══════════════════════════════════════════════════════════════════
// TASK 3: Separate materia prima WE in OP 10 into 3 individual WEs
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== TASK 3: Separate materia prima WE in OP 10 ===');

const op10 = findOp(10);
if (!op10) {
  console.error('ERROR: OP 10 not found!');
  process.exit(1);
}

// Find the grouped materia prima WE
let groupedWeIdx = -1;
for (let i = 0; i < (op10.workElements || []).length; i++) {
  const we = op10.workElements[i];
  const n = (we.name || '').toLowerCase();
  if (n.includes('materia prima') && (n.includes('vinilo') || n.includes('pvc') || n.includes('espuma') || n.includes('sustrato'))) {
    groupedWeIdx = i;
    break;
  }
}

if (groupedWeIdx === -1) {
  console.error('ERROR: Could not find grouped materia prima WE in OP 10');
  console.log('OP 10 WEs:');
  for (const we of (op10.workElements || [])) {
    console.log(`  - "${we.name}" [${we.type}]`);
  }
  process.exit(1);
}

const groupedWe = op10.workElements[groupedWeIdx];
console.log(`Found grouped WE: "${groupedWe.name}"`);
console.log(`  Functions: ${(groupedWe.functions || []).length}`);
for (const f of (groupedWe.functions || [])) {
  const desc = f.description || f.functionDescription || '';
  console.log(`    - "${desc}" (${(f.failures || []).length} failures)`);
}

// Clone functions/failures from the grouped WE and distribute
const originalFunctions = groupedWe.functions || [];

// Helper: deep clone and regenerate UUIDs
function cloneWithNewIds(obj) {
  const clone = JSON.parse(JSON.stringify(obj));
  clone.id = randomUUID();
  if (clone.failures) {
    for (const f of clone.failures) {
      f.id = randomUUID();
      if (f.causes) {
        for (const c of f.causes) {
          c.id = randomUUID();
        }
      }
    }
  }
  return clone;
}

// Create 3 separate WEs
// We'll distribute the functions based on content relevance
// For materials in recepcion, each gets the applicable functions

// WE1: Vinilo PVC 1.1mm
const we1 = {
  id: randomUUID(),
  name: 'Vinilo PVC 1.1mm',
  type: 'Material',
  functions: []
};

// WE2: Espuma PU 2mm
const we2 = {
  id: randomUUID(),
  name: 'Espuma PU 2mm',
  type: 'Material',
  functions: []
};

// WE3: Sustrato PP+EPDM-T20
const we3 = {
  id: randomUUID(),
  name: 'Sustrato PP+EPDM-T20',
  type: 'Material',
  functions: []
};

// Distribute functions: check each function's description to classify
for (const fn of originalFunctions) {
  const desc = (fn.description || fn.functionDescription || '').toLowerCase();

  // Check if function specifically mentions a material
  const mentionsVinilo = desc.includes('vinilo') || desc.includes('pvc') || desc.includes('cubierta') || desc.includes('estetica') || desc.includes('aspecto') || desc.includes('color') || desc.includes('tono');
  const mentionsEspuma = desc.includes('espuma') || desc.includes('pu') || desc.includes('acolchado') || desc.includes('amortiguacion') || desc.includes('densidad') || desc.includes('gramaje');
  const mentionsSustrato = desc.includes('sustrato') || desc.includes('pp') || desc.includes('epdm') || desc.includes('soporte') || desc.includes('rigidez') || desc.includes('estructura');

  // If function is generic (no specific material mention), give to all 3
  if (!mentionsVinilo && !mentionsEspuma && !mentionsSustrato) {
    // Generic function — distribute to all, each with new IDs
    we1.functions.push(cloneWithNewIds(fn));
    we2.functions.push(cloneWithNewIds(fn));
    we3.functions.push(cloneWithNewIds(fn));
  } else {
    // Assign to specific materials
    if (mentionsVinilo) we1.functions.push(cloneWithNewIds(fn));
    if (mentionsEspuma) we2.functions.push(cloneWithNewIds(fn));
    if (mentionsSustrato) we3.functions.push(cloneWithNewIds(fn));
  }
}

// If any WE ended up with no functions, give them the full set with new IDs
// (this ensures we don't lose any function coverage)
if (we1.functions.length === 0) {
  for (const fn of originalFunctions) we1.functions.push(cloneWithNewIds(fn));
}
if (we2.functions.length === 0) {
  for (const fn of originalFunctions) we2.functions.push(cloneWithNewIds(fn));
}
if (we3.functions.length === 0) {
  for (const fn of originalFunctions) we3.functions.push(cloneWithNewIds(fn));
}

// Replace the grouped WE with the 3 individual ones
op10.workElements.splice(groupedWeIdx, 1, we1, we2, we3);

console.log(`Replaced grouped WE with 3 individual WEs:`);
console.log(`  WE1: "${we1.name}" [${we1.type}] — ${we1.functions.length} functions`);
console.log(`  WE2: "${we2.name}" [${we2.type}] — ${we2.functions.length} functions`);
console.log(`  WE3: "${we3.name}" [${we3.type}] — ${we3.functions.length} functions`);

// ═══════════════════════════════════════════════════════════════════
// TASK 4: Add 4 new material WEs in OP 10
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== TASK 4: Add 4 new material WEs in OP 10 ===');

// Helper: create a new WE with proper structure (both aliases)
function createNewWE(weName, weType, funcDesc, failDesc, failEffects, causeText, s, o, d, prevControl, detControl) {
  const apVal = calculateAP(s, o, d);
  return {
    id: randomUUID(),
    name: weName,
    type: weType,
    functions: [
      {
        id: randomUUID(),
        description: funcDesc,
        functionDescription: funcDesc,
        requirements: '',
        failures: [
          {
            id: randomUUID(),
            description: failDesc,
            severity: s,
            effectLocal: failEffects.local,
            effectNextLevel: failEffects.nextLevel,
            effectEndUser: failEffects.endUser,
            causes: [
              {
                id: randomUUID(),
                description: causeText,
                cause: causeText,
                severity: s,
                occurrence: o,
                detection: d,
                preventionControl: prevControl,
                detectionControl: detControl,
                ap: apVal,
                actionPriority: apVal,
                specialChar: '',
                characteristicNumber: '',
                filterCode: '',
                recommendedAction: '',
              }
            ]
          }
        ]
      }
    ]
  };
}

// WE4: Clips de fijacion
const we4 = createNewWE(
  'Clips de fijacion',
  'Material',
  'Proveer sujecion mecanica del pad al tablero',
  'Clips faltantes o incorrectos',
  {
    local: 'Componente no disponible para ensamble',
    nextLevel: 'Pad no fija correctamente al tablero',
    endUser: 'Vibracion o desprendimiento del pad en uso'
  },
  'Error de proveedor en conteo/tipo',
  7, 3, 4,
  'Especificacion de materia prima al proveedor',
  'Inspeccion visual 100% en recepcion'
);
console.log(`WE4: "${we4.name}" — AP=${we4.functions[0].failures[0].causes[0].ap} (S=7 O=3 D=4)`);

// WE5: Logo airbag pasajero (CC por seguridad airbag)
const we5 = createNewWE(
  'Logo airbag pasajero',
  'Material',
  'Identificar zona de despliegue airbag',
  'Logo faltante o mal posicionado',
  {
    local: 'Pieza sin identificacion de airbag',
    nextLevel: 'Vehiculo sin marcado de zona de despliegue',
    endUser: 'Riesgo de seguridad: pasajero no identifica zona airbag'
  },
  'Proveedor no incluye logo en el envio',
  9, 2, 3,
  'Especificacion de materia prima al proveedor',
  'Inspeccion visual 100% en recepcion'
);
// S=9 → CC
we5.functions[0].failures[0].causes[0].specialChar = 'CC';
console.log(`WE5: "${we5.name}" — AP=${we5.functions[0].failures[0].causes[0].ap} (S=9 O=2 D=3) CC`);

// WE6: Tornillos de fijacion
const we6 = createNewWE(
  'Tornillos de fijacion',
  'Material',
  'Asegurar fijacion mecanica del pad',
  'Tornillos incorrectos o faltantes',
  {
    local: 'Componente no disponible o incorrecto para ensamble',
    nextLevel: 'Pad con fijacion debil al tablero',
    endUser: 'Vibracion o desprendimiento del pad en uso'
  },
  'Error en picking de proveedor',
  7, 3, 4,
  'Especificacion de materia prima al proveedor',
  'Inspeccion visual 100% en recepcion'
);
console.log(`WE6: "${we6.name}" — AP=${we6.functions[0].failures[0].causes[0].ap} (S=7 O=3 D=4)`);

// WE7: Difusor de aire acondicionado
const we7 = createNewWE(
  'Difusor de aire acondicionado',
  'Material',
  'Permitir paso de aire al habitaculo',
  'Difusor danado o incorrecto',
  {
    local: 'Pieza danada detectada en recepcion',
    nextLevel: 'Difusor no ensambla correctamente en pad',
    endUser: 'Flujo de aire restringido o estetica afectada'
  },
  'Manipulacion incorrecta en transporte',
  6, 3, 4,
  'Instruccion de embalaje al proveedor',
  'Inspeccion visual 100% en recepcion'
);
console.log(`WE7: "${we7.name}" — AP=${we7.functions[0].failures[0].causes[0].ap} (S=6 O=3 D=4)`);

// Add all 4 new WEs to OP 10
op10.workElements.push(we4, we5, we6, we7);
console.log(`\nOP 10 now has ${op10.workElements.length} WEs total`);

// ═══════════════════════════════════════════════════════════════════
// TASK 5: Save and verify
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== TASK 5: Save to Supabase ===');

// Save — pass object directly, NEVER JSON.stringify
const { error: updateErr } = await sb
  .from('amfe_documents')
  .update({ data: data })
  .eq('id', AMFE_ID);

if (updateErr) {
  console.error('ERROR saving:', updateErr.message);
  process.exit(1);
}
console.log('Saved to Supabase successfully.');

// Verify typeof data
const { data: verifyDoc, error: verifyErr } = await sb
  .from('amfe_documents')
  .select('data')
  .eq('id', AMFE_ID)
  .single();

if (verifyErr) {
  console.error('ERROR verifying:', verifyErr.message);
  process.exit(1);
}

if (typeof verifyDoc.data === 'object') {
  console.log('VERIFIED: typeof data === "object" ✓');
} else {
  console.error(`ERROR: typeof data === "${typeof verifyDoc.data}" — DOUBLE SERIALIZED!`);
  process.exit(1);
}

// Check operations array
if (Array.isArray(verifyDoc.data.operations)) {
  console.log(`VERIFIED: data.operations is array with ${verifyDoc.data.operations.length} operations ✓`);
} else {
  console.error('ERROR: data.operations is not an array!');
  process.exit(1);
}

// Save after state
writeFileSync(`${backupDir}/amfe_after.json`, JSON.stringify(data, null, 2));
console.log(`After-state saved to: ${backupDir}/amfe_after.json`);

// Final summary
console.log('\n=== SUMMARY ===');
for (const op of data.operations) {
  const opNum = op.operationNumber || op.opNumber;
  const opName = op.operationName || op.name;
  console.log(`  OP ${opNum}: ${opName} (${(op.workElements || []).length} WEs)`);
  for (const we of (op.workElements || [])) {
    console.log(`    WE: "${we.name}" [${we.type}]`);
  }
}

console.log('\nDone. Run `node scripts/_backup.mjs` next.');
process.exit(0);
