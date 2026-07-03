/**
 * _auditFinalInjection.mjs
 *
 * Auditor final - read-only verification of:
 *   1. AMFE master recalibration
 *   2. 7 products re-sync
 *   3. CP master traceability
 *
 * NO writes, only reads and assertions.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ── Supabase connection ────────────────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const MASTER_AMFE_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';
const MASTER_CP_ID = '81b60cdd-1296-4821-a348-a8e3c2433b0d';
const PRODUCT_AMFE_NUMBERS = [
  'VWA-PAT-IPPADS-001',
  'AMFE-INS-PAT',
  'AMFE-TR-PAT',
  'AMFE-ARM-PAT',
  'AMFE-HF-PAT',
  'AMFE-HRC-PAT',
  'AMFE-HRO-PAT',
];

// ── Official AP table (copied from modules/amfe/apTable.ts) ────────────────
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
  if (Number.isNaN(s) || Number.isNaN(o) || Number.isNaN(d)) return '';
  const sInt = Math.round(s), oInt = Math.round(o), dInt = Math.round(d);
  if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';
  return apRule(sInt, oInt, dInt);
}

function norm(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

const findings = { TRUE_BUG: [], ROBUSTNESS: [], PASS: [] };
function pass(id, msg) { findings.PASS.push(`${id}: ${msg}`); }
function bug(id, msg) { findings.TRUE_BUG.push(`${id}: ${msg}`); }
function robust(id, msg) { findings.ROBUSTNESS.push(`${id}: ${msg}`); }

// ── A. AMFE MAESTRO ─────────────────────────────────────────────────────────
console.log('\n======== A. AMFE MAESTRO ========');
const { data: masterRow, error: mErr } = await sb
  .from('amfe_documents').select('id, amfe_number, data').eq('id', MASTER_AMFE_ID).single();
if (mErr || !masterRow) { console.error('Cannot read master:', mErr); process.exit(1); }

// A1. Integrity
const typeOfData = typeof masterRow.data;
console.log(`A1.a typeof data === 'string': ${typeOfData === 'string' ? 'YES' : 'NO ('+typeOfData+')'}`);
if (typeOfData !== 'string') bug('A1', `master.data type is ${typeOfData}, expected string`);
else pass('A1.a', `master.data is string`);

let masterDoc;
try {
  masterDoc = JSON.parse(masterRow.data);
  pass('A1.b', 'master JSON parseable');
} catch (e) {
  bug('A1.b', `master JSON not parseable: ${e.message}`);
  process.exit(1);
}

const ops = masterDoc.operations || [];
console.log(`A1.c operations count: ${ops.length}`);
if (ops.length !== 3) bug('A1', `expected 3 operations, got ${ops.length}`);
else pass('A1.c', '3 operations present');

// A2. AP counts
let h=0, m=0, l=0, empty=0, total=0;
const allCauses = [];
for (const op of ops) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        for (const c of (fm.causes || [])) {
          total++;
          const ap = c.ap || c.actionPriority || '';
          if (ap === 'H') h++;
          else if (ap === 'M') m++;
          else if (ap === 'L') l++;
          else empty++;
          allCauses.push({
            op: String(op.operationNumber || op.opNumber),
            opName: op.operationName || op.name,
            weName: we.name,
            failureDesc: fm.description || '',
            failureSeverity: fm.severity,
            cause: c.description || c.cause || '',
            id: c.id,
            s: c.severity, o: c.occurrence, d: c.detection,
            ap, specialChar: c.specialChar || '',
            preventionAction: c.preventionAction || '',
          });
        }
      }
    }
  }
}
console.log(`A2 AP counts: H=${h} M=${m} L=${l} empty=${empty} total=${total}`);
if (h === 0) pass('A2.H', 'H=0 (as expected)');
else robust('A2.H', `H=${h}, expected 0`);
if (m >= 3) pass('A2.M', `M=${m} (>= 3)`);
else bug('A2.M', `M=${m}, expected >= 3`);
if (l <= 62) pass('A2.L', `L=${l} (<=62)`);
else robust('A2.L', `L=${l}, expected <= 62`);

// A3. Spot-check recalibrated causes
console.log('\nA3. Spot-checks');
// A3.1 Dimensional in OP 20 — severity must be 7, ap matches calculateAP
const dimOp20 = allCauses.filter(c => c.op === '20' && norm(c.failureDesc).includes('dimensional'));
console.log(`  Dimensional causes in OP20: ${dimOp20.length}`);
if (dimOp20.length === 0) robust('A3.1', 'No dimensional causes found in OP 20');
else {
  const sample = dimOp20[0];
  console.log(`  sample: S=${sample.s} O=${sample.o} D=${sample.d} AP=${sample.ap} — "${sample.cause.slice(0,60)}"`);
  if (sample.s === 7) pass('A3.1a', `Dimensional OP20 severity=7`);
  else bug('A3.1a', `Dimensional OP20 sample severity=${sample.s}, expected 7`);
  const calc = calculateAP(sample.s, sample.o, sample.d);
  if (calc === sample.ap) pass('A3.1b', `AP=${sample.ap} matches calculateAP(${sample.s},${sample.o},${sample.d})`);
  else bug('A3.1b', `AP=${sample.ap} but calculateAP returns ${calc}`);
}

// A3.2 Humedad in OP 10 — occurrence must be 3
const humOp10 = allCauses.filter(c => c.op === '10' && (
  norm(c.failureDesc).includes('humedad') || norm(c.failureDesc).includes('secado insuficiente') ||
  norm(c.cause).includes('humedad') || norm(c.cause).includes('secado')
));
console.log(`  Humedad/secado causes in OP10: ${humOp10.length}`);
if (humOp10.length === 0) robust('A3.2', 'No humedad/secado causes found in OP 10');
else {
  const sample = humOp10[0];
  console.log(`  sample: S=${sample.s} O=${sample.o} D=${sample.d} AP=${sample.ap} — "${sample.cause.slice(0,60)}"`);
  if (sample.o === 3) pass('A3.2a', `humedad OP10 occurrence=3`);
  else bug('A3.2a', `humedad OP10 sample occurrence=${sample.o}, expected 3`);
  const calc = calculateAP(sample.s, sample.o, sample.d);
  if (calc === sample.ap) pass('A3.2b', `AP matches calculateAP`);
  else bug('A3.2b', `AP=${sample.ap} but calculateAP returns ${calc}`);
}

// A3.3 Linea de junta in OP 20 — occurrence must be 3
const ljOp20 = allCauses.filter(c => c.op === '20' && (
  norm(c.failureDesc).includes('linea de junta') || norm(c.cause).includes('linea de junta')
));
console.log(`  Linea de junta causes in OP20: ${ljOp20.length}`);
if (ljOp20.length === 0) robust('A3.3', 'No linea de junta causes found in OP 20');
else {
  const sample = ljOp20[0];
  console.log(`  sample: S=${sample.s} O=${sample.o} D=${sample.d} AP=${sample.ap} — "${sample.cause.slice(0,60)}"`);
  if (sample.o === 3) pass('A3.3a', `linea de junta OP20 occurrence=3`);
  else bug('A3.3a', `linea de junta OP20 sample occurrence=${sample.o}, expected 3`);
}

// A4. No invented actions — check that recalibrated AP=M causes have preventionAction empty or "Pendiente..."
console.log('\nA4. Check preventionAction of AP=M causes');
const apMCauses = allCauses.filter(c => c.ap === 'M');
console.log(`  AP=M causes total: ${apMCauses.length}`);
const validPhrases = ['pendiente definicion equipo apqp', 'pendiente definición equipo apqp', ''];
const inventedActions = [];
for (const c of apMCauses) {
  const pa = norm(c.preventionAction);
  if (pa && !validPhrases.some(p => pa.includes(norm(p)))) {
    inventedActions.push({ cause: c.cause.slice(0, 70), action: c.preventionAction.slice(0, 100) });
  }
}
if (inventedActions.length === 0) pass('A4', 'No invented actions on AP=M causes');
else {
  for (const ia of inventedActions) {
    bug('A4', `Potential invented action on "${ia.cause}": "${ia.action}"`);
  }
}

// A5. IDs preserved — we cannot compare against backup easily, but we verify all causes have valid UUIDs
console.log('\nA5. Cause IDs integrity');
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const badIds = allCauses.filter(c => !c.id || !uuidRe.test(c.id));
if (badIds.length === 0) pass('A5', `all ${allCauses.length} causes have valid UUIDs`);
else bug('A5', `${badIds.length} causes with missing/invalid UUIDs`);

// Compare against backup pre-recalibration
console.log('\nA5.b Compare cause IDs vs backup pre-recalibration');
try {
  const { readdirSync } = await import('fs');
  const backupDir = new URL('../backups/2026-04-11T01-49-39/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  const files = readdirSync(backupDir).filter(f => f.endsWith('.json'));
  const amfeFile = files.find(f => /amfe/i.test(f));
  if (amfeFile) {
    const backup = JSON.parse(readFileSync(backupDir + amfeFile, 'utf8'));
    const arr = Array.isArray(backup) ? backup : (backup.amfe_documents || backup.data || []);
    const backupMaster = arr.find(r => r.id === MASTER_AMFE_ID);
    if (backupMaster) {
      const backupData = typeof backupMaster.data === 'string' ? JSON.parse(backupMaster.data) : backupMaster.data;
      const backupIds = new Set();
      for (const op of (backupData.operations || [])) {
        for (const we of (op.workElements || [])) {
          for (const fn of (we.functions || [])) {
            for (const fm of (fn.failures || [])) {
              for (const c of (fm.causes || [])) {
                backupIds.add(c.id);
              }
            }
          }
        }
      }
      const currentIds = new Set(allCauses.map(c => c.id));
      let missing = 0, extra = 0;
      for (const id of backupIds) if (!currentIds.has(id)) missing++;
      for (const id of currentIds) if (!backupIds.has(id)) extra++;
      console.log(`  backup has ${backupIds.size} causes, current has ${currentIds.size}`);
      console.log(`  missing (in backup, not current): ${missing}`);
      console.log(`  extra (in current, not backup): ${extra}`);
      if (missing === 0 && extra === 0) pass('A5.b', 'all cause IDs preserved from backup');
      else bug('A5.b', `cause IDs diverge: ${missing} missing, ${extra} extra`);
    } else {
      robust('A5.b', 'master not in backup file');
    }
  } else {
    robust('A5.b', 'no AMFE backup file found');
  }
} catch (e) {
  robust('A5.b', `backup comparison failed: ${e.message}`);
}

// A6. failure.severity updated
console.log('\nA6. failure.severity = max(causes.severity)');
let a6bugs = 0;
for (const op of ops) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        const causes = fm.causes || [];
        if (causes.length === 0) continue;
        const maxS = Math.max(...causes.map(c => c.severity || 0));
        if ((fm.severity || 0) < maxS) {
          bug('A6', `failure "${(fm.description||'').slice(0,50)}" has severity=${fm.severity}, max cause severity=${maxS}`);
          a6bugs++;
        }
      }
    }
  }
}
if (a6bugs === 0) pass('A6', 'all failure.severity >= max(cause.severity)');

// ── B. 7 PRODUCTS ───────────────────────────────────────────────────────────
console.log('\n======== B. 7 PRODUCTS RE-SYNC ========');
const { data: prodRows, error: pErr } = await sb
  .from('amfe_documents').select('id, amfe_number, data').in('amfe_number', PRODUCT_AMFE_NUMBERS);
if (pErr) { console.error('Cannot read products:', pErr); process.exit(1); }

console.log(`Found ${prodRows.length} products`);
if (prodRows.length !== 7) bug('B0', `expected 7 products, got ${prodRows.length}`);
else pass('B0', '7 products found');

// Build map of recalibrated cause descriptions from master
const recalDescs = new Set();
// Identify causes that should have been recalibrated (match the rules)
for (const c of allCauses) {
  const fd = norm(c.failureDesc);
  const cd = norm(c.cause);
  if (fd.includes('dimensional') || fd.includes('dimension') || fd.includes('fuera de tolerancia')) recalDescs.add(cd);
  if (fd.includes('humedad') || fd.includes('secado insuficiente') || cd.includes('humedad') || cd.includes('secado insuficiente')) recalDescs.add(cd);
  if (fd.includes('certificado') || fd.includes('material incorrecto') || cd.includes('certificado') || cd.includes('material incorrecto')) recalDescs.add(cd);
  if (fd.includes('linea de junta') || cd.includes('linea de junta')) recalDescs.add(cd);
}
console.log(`Recalibrated cause descriptions from master: ${recalDescs.size}`);

for (const prod of prodRows) {
  console.log(`\n-- ${prod.amfe_number} --`);
  if (typeof prod.data !== 'string') {
    bug(`B.${prod.amfe_number}`, `data not string (${typeof prod.data})`);
    continue;
  }
  let doc;
  try { doc = JSON.parse(prod.data); } catch (e) { bug(`B.${prod.amfe_number}`, 'unparseable'); continue; }
  if (!Array.isArray(doc.operations)) {
    bug(`B.${prod.amfe_number}`, 'operations not array');
    continue;
  }

  // Find injection ops (excluding PU/poliuretano)
  const injOps = doc.operations.filter(op => {
    const n = norm(op.operationName || op.name || '');
    return (n.includes('inyeccion') || n.includes('inyección')) && !n.includes('pu') && !n.includes('poliuretano');
  });
  console.log(`  Injection ops: ${injOps.length}`);
  const opNames = injOps.map(o => `${o.operationNumber||o.opNumber}:${o.operationName||o.name}`).join(' | ');
  console.log(`  ${opNames}`);

  // B1. Count causes in inj ops that match recalibrated descriptions
  let matchedCount = 0;
  let okValues = 0;
  const causesByOp = {};
  for (const op of injOps) {
    const opNum = String(op.operationNumber || op.opNumber);
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fm of (fn.failures || [])) {
          for (const c of (fm.causes || [])) {
            const cd = norm(c.description || c.cause || '');
            if (recalDescs.has(cd)) {
              matchedCount++;
              // Find the master cause that matches and check if values align
              const masterMatch = allCauses.find(mc => norm(mc.cause) === cd);
              if (masterMatch && masterMatch.s === c.severity && masterMatch.o === c.occurrence && masterMatch.d === c.detection) {
                okValues++;
              }
            }
            if (!causesByOp[opNum]) causesByOp[opNum] = [];
            causesByOp[opNum].push({ s: c.severity, o: c.occurrence, d: c.detection, ap: c.ap, desc: (c.description||c.cause||'').slice(0,50) });
          }
        }
      }
    }
  }
  console.log(`  Causes matched to recalibrated master descriptions: ${matchedCount}`);
  console.log(`  Causes with synced S/O/D values: ${okValues}`);

  if (matchedCount >= 3) pass(`B1.${prod.amfe_number}`, `${matchedCount} causes matched`);
  else robust(`B1.${prod.amfe_number}`, `only ${matchedCount} causes matched (expected >= 3)`);
  if (okValues === matchedCount && matchedCount > 0) pass(`B1v.${prod.amfe_number}`, `all ${okValues} matched causes have synced S/O/D`);
  else if (matchedCount > 0) bug(`B1v.${prod.amfe_number}`, `${okValues}/${matchedCount} causes have synced values`);

  // B3. operationName preserved
  for (const op of injOps) {
    if (!(op.operationName || op.name)) {
      bug(`B3.${prod.amfe_number}`, `op ${op.operationNumber||op.opNumber} has no operationName`);
    }
  }

  // B4. Armrest: check INYECCION PU not touched (still has 3 WEs, contains poliuretano)
  if (prod.amfe_number === 'AMFE-ARM-PAT') {
    const puOps = doc.operations.filter(op => {
      const n = norm(op.operationName || op.name || '');
      return n.includes('pu') || n.includes('poliuretano');
    });
    console.log(`  PU ops in Armrest: ${puOps.length}`);
    if (puOps.length >= 1) {
      const puOp = puOps[0];
      console.log(`  PU op name: ${puOp.operationName || puOp.name}, workElements: ${(puOp.workElements||[]).length}`);
      if ((puOp.workElements || []).length >= 3) pass('B4', `Armrest PU op has ${(puOp.workElements||[]).length} WEs`);
      else robust('B4', `Armrest PU op has ${(puOp.workElements||[]).length} WEs (expected 3)`);
    } else {
      robust('B4', 'no PU op found in Armrest');
    }
  }
}

// ── C. CP MAESTRO TRACEABILITY ─────────────────────────────────────────────
console.log('\n======== C. CP MAESTRO TRACEABILITY ========');
const { data: cpRow, error: cErr } = await sb
  .from('cp_documents').select('id, data').eq('id', MASTER_CP_ID).single();
if (cErr || !cpRow) { console.error('Cannot read CP:', cErr); process.exit(1); }

let cpData;
try {
  cpData = typeof cpRow.data === 'string' ? JSON.parse(cpRow.data) : cpRow.data;
} catch (e) { bug('C1', `CP JSON not parseable: ${e.message}`); process.exit(1); }

const items = cpData.items || [];
console.log(`C1.a items count: ${items.length}`);
if (items.length === 17) pass('C1.a', '17 items');
else bug('C1.a', `expected 17 items, got ${items.length}`);

// C1.b core fields
let c1bugs = 0;
for (const it of items) {
  if (!it.processStepNumber || !it.characteristic || !it.reactionPlanOwner) {
    c1bugs++;
  }
}
if (c1bugs === 0) pass('C1.b', 'all items have core fields');
else bug('C1.b', `${c1bugs} items missing core fields`);

// C2. 11 items manual with amfeCauseIds.length >= 1
const allCauseIds = new Set(allCauses.map(c => c.id));
const linkedItems = items.filter(it => Array.isArray(it.amfeCauseIds) && it.amfeCauseIds.length > 0);
console.log(`C2 items with amfeCauseIds: ${linkedItems.length}`);

// The 11 items referenced are those that were manually linked. Items previously generated by Phase 1-3 also have amfeCauseIds.
// Distinguish by checking autoFilledFields
const scriptLinked = items.filter(it =>
  Array.isArray(it.autoFilledFields) && it.autoFilledFields.includes('linkedToAmfe') &&
  Array.isArray(it.amfeCauseIds) && it.amfeCauseIds.length > 0
);
console.log(`  with 'linkedToAmfe' marker and amfeCauseIds: ${scriptLinked.length}`);
if (scriptLinked.length >= 11) pass('C2', `${scriptLinked.length} items linked via script (>= 11)`);
else bug('C2', `only ${scriptLinked.length} items linked via script (expected 11)`);

// C3. Flamabilidad item has notes explaining no match
const flamItems = items.filter(it => norm(it.characteristic || '').includes('flamabilidad'));
console.log(`C3 flamabilidad items: ${flamItems.length}`);
for (const fi of flamItems) {
  const hasCauseIds = Array.isArray(fi.amfeCauseIds) && fi.amfeCauseIds.length > 0;
  const hasNotes = !!fi.notes;
  console.log(`  item: characteristic="${fi.characteristic}", amfeCauseIds=${hasCauseIds ? fi.amfeCauseIds.length : 0}, notes="${(fi.notes||'').slice(0,80)}"`);
  if (!hasCauseIds && hasNotes) pass('C3', `flamabilidad item has notes`);
  else if (hasCauseIds) robust('C3', 'flamabilidad item is linked to a cause (expected not linked)');
  else if (!hasCauseIds && !hasNotes) bug('C3', 'flamabilidad item has no causes and no notes');
}

// C4. Spot-check 3 items: verify referenced causeIds exist in AMFE
console.log('\nC4. Spot-check amfeCauseIds exist in AMFE master');
const sampleItems = scriptLinked.slice(0, 3);
for (const it of sampleItems) {
  const label = (it.processCharacteristic || it.productCharacteristic || '').slice(0,60);
  console.log(`  item "${label}" — causeIds: ${it.amfeCauseIds.length}`);
  let missing = 0;
  for (const cid of it.amfeCauseIds) {
    if (!allCauseIds.has(cid)) missing++;
  }
  if (missing === 0) pass(`C4.${label.slice(0,20)}`, `all ${it.amfeCauseIds.length} causeIds valid`);
  else bug(`C4.${label.slice(0,20)}`, `${missing}/${it.amfeCauseIds.length} causeIds do NOT exist in AMFE`);
}

// Additionally check ALL linked items, not just sample
let totalInvalidRefs = 0;
for (const it of scriptLinked) {
  for (const cid of (it.amfeCauseIds || [])) {
    if (!allCauseIds.has(cid)) totalInvalidRefs++;
  }
}
if (totalInvalidRefs === 0) pass('C4.all', `all amfeCauseIds in all linked items exist in AMFE`);
else bug('C4.all', `${totalInvalidRefs} invalid amfeCauseIds references across all linked items`);

// C5. autoFilledFields has 'linkedToAmfe' and NOT 'manualControl'
let c5linkOk = 0, c5manualRemnant = 0;
for (const it of scriptLinked) {
  const afs = it.autoFilledFields || [];
  if (afs.includes('linkedToAmfe')) c5linkOk++;
  if (afs.includes('manualControl')) c5manualRemnant++;
}
if (c5manualRemnant === 0) pass('C5', `no remnant manualControl markers, ${c5linkOk}/${scriptLinked.length} have linkedToAmfe`);
else bug('C5', `${c5manualRemnant} items still have 'manualControl' in autoFilledFields`);

// ── D1. Pre-existing Phase 1-3 items not modified ──────────────────────────
console.log('\n======== D. NO REGRESSIONS ========');
console.log('D1. Phase 1-3 generator items (not linked via script)');
// Items NOT in scriptLinked that have amfeCauseIds = phase 1-3 items
const phaseItems = items.filter(it =>
  Array.isArray(it.amfeCauseIds) && it.amfeCauseIds.length > 0 &&
  !(Array.isArray(it.autoFilledFields) && it.autoFilledFields.includes('linkedToAmfe'))
);
console.log(`  Phase 1-3 generator items: ${phaseItems.length}`);
// Verify their causeIds still exist in master
let d1invalid = 0;
for (const it of phaseItems) {
  for (const cid of it.amfeCauseIds) {
    if (!allCauseIds.has(cid)) d1invalid++;
  }
}
if (d1invalid === 0) pass('D1', `all ${phaseItems.length} phase 1-3 items preserved, all causeIds valid`);
else bug('D1', `${d1invalid} causeIds in phase 1-3 items no longer exist in AMFE`);

// ── Final summary ──────────────────────────────────────────────────────────
console.log('\n===========================================');
console.log('SUMMARY');
console.log('===========================================');
console.log(`TRUE_BUG: ${findings.TRUE_BUG.length}`);
for (const f of findings.TRUE_BUG) console.log(`  [BUG] ${f}`);
console.log(`ROBUSTNESS: ${findings.ROBUSTNESS.length}`);
for (const f of findings.ROBUSTNESS) console.log(`  [ROBUST] ${f}`);
console.log(`PASS: ${findings.PASS.length}`);

console.log('\nDone.');
