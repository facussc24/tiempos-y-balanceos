/**
 * Fix Top Roll AMFE — Structural corrections 2026-04-08
 * 1. Remove OP 11 "ALMACENAMIENTO EN MEDIOS WIP" — move its 3 causes to OP 10 "Mano de Obra" WE
 * 2. Rename operations to Spanish (OP 30, 40, 70)
 * 3. Merge duplicate machine WEs in OP 10
 * 4. Update metadata (operation_count, cause_count)
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
const AMFE_ID = '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3';

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

console.log('=== TOP ROLL AMFE fetched ===');
console.log(`Operations: ${amfeData.operations.length}`);
for (const op of amfeData.operations) {
  const opNum = op.operationNumber || op.opNumber;
  const opName = op.operationName || op.name;
  console.log(`  OP ${opNum}: ${opName} (${(op.workElements || []).length} WEs)`);
  for (const we of (op.workElements || [])) {
    const causeCount = (we.functions || []).reduce((sum, fn) => {
      return sum + (fn.failures || []).reduce((s2, fail) => s2 + (fail.causes || []).length, 0);
    }, 0);
    console.log(`    WE: "${we.name}" [${we.type}] (${(we.functions || []).length} funcs, ${causeCount} causes)`);
  }
}

// ── Backup before changes ───────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/toproll-structural-${ts}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
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

// Helper to count all causes in the entire AMFE
function countAllCauses() {
  let total = 0;
  for (const op of data.operations) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
          total += (fail.causes || []).length;
        }
      }
    }
  }
  return total;
}

// Helper to count causes in a WE
function countWeCauses(we) {
  let total = 0;
  for (const fn of (we.functions || [])) {
    for (const fail of (fn.failures || [])) {
      total += (fail.causes || []).length;
    }
  }
  return total;
}

const causesBefore = countAllCauses();
console.log(`\nTotal causes BEFORE: ${causesBefore}`);

// ═══════════════════════════════════════════════════════════════════
// TASK 1: Remove OP 11 "ALMACENAMIENTO EN MEDIOS WIP"
// Move its 3 causes (from "Mano de Obra" WE) to OP 10's "Mano de Obra" WE
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== TASK 1: Remove OP 11 "ALMACENAMIENTO EN MEDIOS WIP" ===');

const op11 = findOp(11);
const op10 = findOp(10);

if (!op11) {
  console.error('ERROR: OP 11 not found!');
  console.log('Available operations:');
  for (const op of data.operations) {
    console.log(`  OP ${op.operationNumber || op.opNumber}: ${op.operationName || op.name}`);
  }
  process.exit(1);
}
if (!op10) {
  console.error('ERROR: OP 10 not found!');
  process.exit(1);
}

const op11Name = op11.operationName || op11.name;
console.log(`Found OP 11: "${op11Name}" with ${(op11.workElements || []).length} WEs`);

// Find the "Mano de Obra" WE in OP 11
let op11ManoDeObraWe = null;
for (const we of (op11.workElements || [])) {
  const weName = (we.name || '').toLowerCase();
  const weType = (we.type || '').toLowerCase();
  if (weName.includes('mano de obra') || weType === 'man' || weType === 'mano de obra') {
    op11ManoDeObraWe = we;
    break;
  }
}

if (!op11ManoDeObraWe) {
  console.error('ERROR: Could not find "Mano de Obra" WE in OP 11');
  console.log('OP 11 WEs:');
  for (const we of (op11.workElements || [])) {
    console.log(`  - "${we.name}" [${we.type}] (${countWeCauses(we)} causes)`);
  }
  // Try to find any WE with causes (might have different name)
  for (const we of (op11.workElements || [])) {
    if (countWeCauses(we) > 0) {
      op11ManoDeObraWe = we;
      console.log(`Using WE "${we.name}" [${we.type}] as source (has ${countWeCauses(we)} causes)`);
      break;
    }
  }
  if (!op11ManoDeObraWe) {
    console.error('FATAL: No WE with causes found in OP 11');
    process.exit(1);
  }
}

const op11CauseCount = countWeCauses(op11ManoDeObraWe);
console.log(`OP 11 source WE: "${op11ManoDeObraWe.name}" [${op11ManoDeObraWe.type}] with ${op11CauseCount} causes`);

// Log the functions/failures/causes being moved
for (const fn of (op11ManoDeObraWe.functions || [])) {
  const fDesc = fn.description || fn.functionDescription || '(no desc)';
  console.log(`  Function: "${fDesc}"`);
  for (const fail of (fn.failures || [])) {
    console.log(`    Failure: "${fail.description || '(no desc)'}"`);
    for (const cause of (fail.causes || [])) {
      const cDesc = cause.cause || cause.description || '(no desc)';
      console.log(`      Cause: "${cDesc}" S=${cause.severity} O=${cause.occurrence} D=${cause.detection} AP=${cause.ap || cause.actionPriority}`);
    }
  }
}

// Find the "Mano de Obra" WE in OP 10
let op10ManoDeObraWe = null;
for (const we of (op10.workElements || [])) {
  const weName = (we.name || '').toLowerCase();
  const weType = (we.type || '').toLowerCase();
  if (weName.includes('operador') || weType === 'man' || weType === 'mano de obra') {
    op10ManoDeObraWe = we;
    break;
  }
}

if (!op10ManoDeObraWe) {
  console.error('ERROR: Could not find "Mano de Obra" WE in OP 10');
  console.log('OP 10 WEs:');
  for (const we of (op10.workElements || [])) {
    console.log(`  - "${we.name}" [${we.type}] (${countWeCauses(we)} causes)`);
  }
  process.exit(1);
}

const op10ManoBefore = countWeCauses(op10ManoDeObraWe);
console.log(`\nOP 10 target WE: "${op10ManoDeObraWe.name}" [${op10ManoDeObraWe.type}] with ${op10ManoBefore} causes BEFORE`);

// Move all functions from OP 11 Mano de Obra WE to OP 10 Mano de Obra WE
if (!op10ManoDeObraWe.functions) op10ManoDeObraWe.functions = [];
for (const fn of (op11ManoDeObraWe.functions || [])) {
  op10ManoDeObraWe.functions.push(fn);
}

const op10ManoAfter = countWeCauses(op10ManoDeObraWe);
console.log(`OP 10 target WE now has ${op10ManoAfter} causes AFTER (added ${op10ManoAfter - op10ManoBefore})`);

// Remove OP 11 from operations array
const op11Idx = data.operations.findIndex(op =>
  (op.operationNumber || op.opNumber) === '11'
);
if (op11Idx === -1) {
  console.error('ERROR: Could not find OP 11 index for removal');
  process.exit(1);
}
data.operations.splice(op11Idx, 1);
console.log(`Removed OP 11 from operations array (was at index ${op11Idx})`);
console.log(`Operations count: ${data.operations.length}`);

// Verify no causes were lost
const causesAfterTask1 = countAllCauses();
console.log(`Causes after Task 1: ${causesAfterTask1} (before: ${causesBefore}, diff: ${causesAfterTask1 - causesBefore})`);
if (causesAfterTask1 !== causesBefore) {
  console.error(`WARNING: Cause count changed! Expected ${causesBefore}, got ${causesAfterTask1}`);
}

// ═══════════════════════════════════════════════════════════════════
// TASK 2: Rename operations to Spanish
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== TASK 2: Rename operations ===');

const renames = [
  { opNum: 30, oldPattern: 'PROCESO DE IMG', newName: 'TERMOFORMADO' },
  { opNum: 40, oldPattern: 'TRIMMING', newName: 'CORTE FINAL' },
  { opNum: 70, oldPattern: 'SOLDADO TWEETER', newName: 'SOLDADURA TWEETER' },
];

for (const r of renames) {
  const op = findOp(r.opNum);
  if (!op) {
    console.error(`ERROR: OP ${r.opNum} not found!`);
    process.exit(1);
  }

  const oldName = op.operationName || op.name;
  console.log(`OP ${r.opNum}: "${oldName}" -> "${r.newName}"`);

  // Update BOTH aliases
  op.name = r.newName;
  op.operationName = r.newName;

  console.log(`  op.name = "${op.name}"`);
  console.log(`  op.operationName = "${op.operationName}"`);
}

// ═══════════════════════════════════════════════════════════════════
// TASK 3: Merge duplicate machine WEs in OP 10
// "Maquina inyectora de plastico" [Maquina] (7 causes) +
// "Inyectora" [Machine] (28 causes)
// => Keep "Maquina inyectora de plastico" with type "Machine", merge all
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== TASK 3: Merge duplicate machine WEs in OP 10 ===');

// Re-find OP 10 (same reference, but let's be explicit)
const op10ForMerge = findOp(10);
if (!op10ForMerge) {
  console.error('ERROR: OP 10 not found for merge task!');
  process.exit(1);
}

// Find the two machine WEs
let targetWeIdx = -1;
let sourceWeIdx = -1;

for (let i = 0; i < (op10ForMerge.workElements || []).length; i++) {
  const we = op10ForMerge.workElements[i];
  const weName = (we.name || '').toLowerCase();
  const weType = (we.type || '').toLowerCase();

  if (weName.includes('quina inyectora') || weName.includes('máquina inyectora') || weName.includes('maquina inyectora')) {
    targetWeIdx = i;
  } else if (weName === 'inyectora' && (weType === 'machine' || weType === 'maquina')) {
    sourceWeIdx = i;
  }
}

if (targetWeIdx === -1) {
  console.error('ERROR: Could not find target WE "Maquina inyectora de plastico" in OP 10');
  console.log('OP 10 WEs:');
  for (const we of (op10ForMerge.workElements || [])) {
    console.log(`  - "${we.name}" [${we.type}] (${countWeCauses(we)} causes)`);
  }
  process.exit(1);
}

if (sourceWeIdx === -1) {
  console.error('ERROR: Could not find source WE "Inyectora" in OP 10');
  console.log('OP 10 WEs:');
  for (const we of (op10ForMerge.workElements || [])) {
    console.log(`  - "${we.name}" [${we.type}] (${countWeCauses(we)} causes)`);
  }
  process.exit(1);
}

const targetWe = op10ForMerge.workElements[targetWeIdx];
const sourceWe = op10ForMerge.workElements[sourceWeIdx];

const targetCausesBefore = countWeCauses(targetWe);
const sourceCausesBefore = countWeCauses(sourceWe);

console.log(`Target WE: "${targetWe.name}" [${targetWe.type}] — ${targetCausesBefore} causes`);
console.log(`Source WE: "${sourceWe.name}" [${sourceWe.type}] — ${sourceCausesBefore} causes`);

// Move ALL functions from source to target
if (!targetWe.functions) targetWe.functions = [];
for (const fn of (sourceWe.functions || [])) {
  targetWe.functions.push(fn);
}

// Change target type from "Maquina" to "Machine" (the standard)
const oldType = targetWe.type;
targetWe.type = 'Machine';
console.log(`Changed target WE type: "${oldType}" -> "${targetWe.type}"`);

const targetCausesAfter = countWeCauses(targetWe);
console.log(`Target WE now has ${targetCausesAfter} causes (was ${targetCausesBefore}, added ${targetCausesAfter - targetCausesBefore})`);

// Remove source WE
// Adjust index if target was before source (splice shifts indices)
const removeIdx = sourceWeIdx > targetWeIdx ? sourceWeIdx : sourceWeIdx;
op10ForMerge.workElements.splice(removeIdx, 1);
console.log(`Removed duplicate WE "${sourceWe.name}" (was at index ${removeIdx})`);
console.log(`OP 10 now has ${op10ForMerge.workElements.length} WEs`);

// Verify no causes lost
const causesAfterTask3 = countAllCauses();
console.log(`Causes after Task 3: ${causesAfterTask3} (expected: ${causesBefore}, diff: ${causesAfterTask3 - causesBefore})`);
if (causesAfterTask3 !== causesBefore) {
  console.error(`WARNING: Cause count changed! Expected ${causesBefore}, got ${causesAfterTask3}`);
}

// ═══════════════════════════════════════════════════════════════════
// TASK 4: Update metadata (operation_count, cause_count) + Save
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== TASK 4: Update metadata and save ===');

const finalOpCount = data.operations.length;
const finalCauseCount = countAllCauses();

console.log(`Final operation_count: ${finalOpCount}`);
console.log(`Final cause_count: ${finalCauseCount}`);

// Save — pass object directly, NEVER JSON.stringify
const { error: updateErr } = await sb
  .from('amfe_documents')
  .update({
    data: data,
    operation_count: finalOpCount,
    cause_count: finalCauseCount,
  })
  .eq('id', AMFE_ID);

if (updateErr) {
  console.error('ERROR saving:', updateErr.message);
  process.exit(1);
}
console.log('Saved to Supabase successfully.');

// Verify typeof data
const { data: verifyDoc, error: verifyErr } = await sb
  .from('amfe_documents')
  .select('data, operation_count, cause_count')
  .eq('id', AMFE_ID)
  .single();

if (verifyErr) {
  console.error('ERROR verifying:', verifyErr.message);
  process.exit(1);
}

if (typeof verifyDoc.data === 'object') {
  console.log('VERIFIED: typeof data === "object"');
} else {
  console.error(`ERROR: typeof data === "${typeof verifyDoc.data}" — DOUBLE SERIALIZED!`);
  process.exit(1);
}

if (Array.isArray(verifyDoc.data.operations)) {
  console.log(`VERIFIED: data.operations is array with ${verifyDoc.data.operations.length} operations`);
} else {
  console.error('ERROR: data.operations is not an array!');
  process.exit(1);
}

console.log(`VERIFIED: operation_count = ${verifyDoc.operation_count}`);
console.log(`VERIFIED: cause_count = ${verifyDoc.cause_count}`);

// Save after state
writeFileSync(`${backupDir}/amfe_after.json`, JSON.stringify(data, null, 2));
console.log(`After-state saved to: ${backupDir}/amfe_after.json`);

// ═══════════════════════════════════════════════════════════════════
// Final summary
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== FINAL SUMMARY ===');
console.log(`Operations: ${data.operations.length} (removed OP 11)`);
console.log(`Total causes: ${finalCauseCount} (was ${causesBefore})`);
console.log('');
for (const op of data.operations) {
  const opNum = op.operationNumber || op.opNumber;
  const opName = op.operationName || op.name;
  console.log(`  OP ${opNum}: ${opName} (${(op.workElements || []).length} WEs)`);
  for (const we of (op.workElements || [])) {
    const cc = countWeCauses(we);
    console.log(`    WE: "${we.name}" [${we.type}] (${cc} causes)`);
  }
}

console.log('\nChanges applied:');
console.log('  1. OP 11 "ALMACENAMIENTO EN MEDIOS WIP" removed; its causes moved to OP 10 Mano de Obra WE');
console.log('  2. OP 30 renamed to "TERMOFORMADO"');
console.log('  3. OP 40 renamed to "CORTE FINAL"');
console.log('  4. OP 70 renamed to "SOLDADURA TWEETER"');
console.log('  5. OP 10 machine WEs merged: "Inyectora" into "Maquina inyectora de plastico" (type -> Machine)');
console.log(`  6. Metadata updated: operation_count=${finalOpCount}, cause_count=${finalCauseCount}`);

console.log('\nDone. Run `node scripts/_backup.mjs` next.');
process.exit(0);
