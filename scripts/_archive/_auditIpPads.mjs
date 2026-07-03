/**
 * _auditIpPads.mjs
 *
 * FINAL AUDITOR script for TRIM ASM-UPR WRAPPING (IP PADs Patagonia).
 * Fetches AMFE and PFD documents from Supabase and runs all audit checks.
 *
 * Usage:
 *   node scripts/_auditIpPads.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ─── Config ─────────────────────────────────────────────────────────────────
const ENV_PATH = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';
const AMFE_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';
const PFD_ID = 'pfd-ippads-trim-asm-upr-wrapping';

// ─── Supabase connection ────────────────────────────────────────────────────
const envText = readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// ─── AP Table (AIAG-VDA 2019) ───────────────────────────────────────────────
function calcAP(s, o, d) {
  if (!s || !o || !d) return '';
  const sn = Number(s), on = Number(o), dn = Number(d);
  if (isNaN(sn) || isNaN(on) || isNaN(dn)) return '';
  if (sn < 1 || sn > 10 || on < 1 || on > 10 || dn < 1 || dn > 10) return '';

  if (sn <= 1) return 'L';
  if (sn <= 3) {
    if (on >= 8 && dn >= 5) return 'M';
    return 'L';
  }
  if (sn <= 6) {
    if (on >= 8) return dn >= 5 ? 'H' : 'M';
    if (on >= 6) return dn >= 2 ? 'M' : 'L';
    if (on >= 4) return dn >= 7 ? 'M' : 'L';
    return 'L';
  }
  if (sn <= 8) {
    if (on >= 8) return 'H';
    if (on >= 6) return dn >= 2 ? 'H' : 'M';
    if (on >= 4) return dn >= 7 ? 'H' : 'M';
    if (on >= 2) return dn >= 5 ? 'M' : 'L';
    return 'L';
  }
  // S=9-10
  if (on >= 6) return 'H';
  if (on >= 4) return dn >= 2 ? 'H' : 'M';
  if (on >= 2) {
    if (dn >= 7) return 'H';
    if (dn >= 5) return 'M';
    return 'L';
  }
  return 'L';
}

// ─── Auth ───────────────────────────────────────────────────────────────────
const { error: authErr } = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL,
  password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (authErr) {
  console.error('Auth failed:', authErr.message);
  process.exit(1);
}
console.log('Authenticated.\n');

// ─── Fetch documents ────────────────────────────────────────────────────────
const { data: amfeDoc, error: amfeErr } = await sb
  .from('amfe_documents')
  .select('id, data')
  .eq('id', AMFE_ID)
  .single();

if (amfeErr) {
  console.error('AMFE fetch error:', amfeErr.message);
  process.exit(1);
}

const { data: pfdDoc, error: pfdErr } = await sb
  .from('pfd_documents')
  .select('id, data')
  .eq('id', PFD_ID)
  .single();

if (pfdErr) {
  console.error('PFD fetch error:', pfdErr.message);
  process.exit(1);
}

// ─── Parse data (handle possible text column) ──────────────────────────────
function parseData(raw) {
  if (typeof raw === 'object' && raw !== null) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' ? parsed : null;
    } catch { return null; }
  }
  return null;
}

const amfeData = parseData(amfeDoc.data);
const pfdData = parseData(pfdDoc.data);

if (!amfeData) { console.error('AMFE data could not be parsed'); process.exit(1); }
if (!pfdData) { console.error('PFD data could not be parsed'); process.exit(1); }

// ─── Output JSON for analysis ───────────────────────────────────────────────
console.log('=== AMFE DOCUMENT ===');
console.log('typeof amfeDoc.data:', typeof amfeDoc.data);
console.log('typeof amfeData:', typeof amfeData);
console.log('Has header:', !!amfeData.header);
console.log('Has operations:', Array.isArray(amfeData.operations));
console.log('Operations count:', amfeData.operations?.length);
console.log('');

// Double-serialization check
let amfeDoubleSerialized = false;
if (typeof amfeDoc.data === 'string') {
  try {
    const p1 = JSON.parse(amfeDoc.data);
    if (typeof p1 === 'string') amfeDoubleSerialized = true;
  } catch {}
}
if (typeof amfeDoc.data === 'object') amfeDoubleSerialized = false;

let pfdDoubleSerialized = false;
if (typeof pfdDoc.data === 'string') {
  try {
    const p1 = JSON.parse(pfdDoc.data);
    if (typeof p1 === 'string') pfdDoubleSerialized = true;
  } catch {}
}
if (typeof pfdDoc.data === 'object') pfdDoubleSerialized = false;

console.log('AMFE double-serialized:', amfeDoubleSerialized);
console.log('PFD double-serialized:', pfdDoubleSerialized);
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// AMFE AUDIT
// ═══════════════════════════════════════════════════════════════════════════
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                     AMFE AUDIT                              ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const ops = amfeData.operations || [];

// CHECK 1: Data integrity — count operations, FMs, causes
let totalFMs = 0;
let totalCauses = 0;
for (const op of ops) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        totalFMs++;
        totalCauses += (fm.causes || []).length;
      }
    }
  }
}

console.log('\n--- CHECK A1: Data Integrity ---');
console.log(`  Operations: ${ops.length} (expected 14)`);
console.log(`  Failure Modes: ${totalFMs}`);
console.log(`  Causes: ${totalCauses}`);
console.log(`  RESULT: ${ops.length === 14 ? 'PASS' : 'FAIL'}`);

// List operations
console.log('\n  Operations list:');
for (const op of ops) {
  console.log(`    OP ${op.operationNumber}: ${op.operationName}`);
}

// CHECK A1b: OP 85 "INYECCION DE PIEZAS PLASTICAS" exists with 10 FMs and ~28 causes
console.log('\n--- CHECK A1b: OP 85 Injection Operation ---');
const op85 = ops.find(o => String(o.operationNumber) === '85');
let op85FMs = 0;
let op85Causes = 0;
if (op85) {
  for (const we of (op85.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        op85FMs++;
        op85Causes += (fm.causes || []).length;
      }
    }
  }
}
console.log(`  OP 85 found: ${!!op85}`);
console.log(`  OP 85 name: "${op85?.operationName || 'NOT FOUND'}"`);
console.log(`  OP 85 name correct: ${op85?.operationName === 'INYECCION DE PIEZAS PLASTICAS' ? 'YES' : 'NO'}`);
console.log(`  OP 85 Failure Modes: ${op85FMs} (expected 10)`);
console.log(`  OP 85 Causes: ${op85Causes} (expected ~28)`);
const op85Pass = !!op85 && op85?.operationName === 'INYECCION DE PIEZAS PLASTICAS' && op85FMs === 10;
console.log(`  RESULT: ${op85Pass ? 'PASS' : 'FAIL'}`);

// CHECK A1c: Operations ordered correctly (10,20,30,40,50,60,70,80,85,90,100,110,120,130)
console.log('\n--- CHECK A1c: Operation Ordering ---');
const expectedOrder = [10, 20, 30, 40, 50, 60, 70, 80, 85, 90, 100, 110, 120, 130];
const actualOrder = ops.map(o => parseInt(o.operationNumber));
const orderCorrect = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);
console.log(`  Expected: ${expectedOrder.join(', ')}`);
console.log(`  Actual:   ${actualOrder.join(', ')}`);
console.log(`  RESULT: ${orderCorrect ? 'PASS' : 'FAIL'}`);

// CHECK 2: All 3 VDA effects filled
console.log('\n--- CHECK A2: VDA 3-Level Effects ---');
let emptyEffects = [];
for (const op of ops) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        const missing = [];
        if (!fm.effectLocal || fm.effectLocal.trim() === '') missing.push('effectLocal');
        if (!fm.effectNextLevel || fm.effectNextLevel.trim() === '') missing.push('effectNextLevel');
        if (!fm.effectEndUser || fm.effectEndUser.trim() === '') missing.push('effectEndUser');
        if (missing.length > 0) {
          emptyEffects.push({
            op: op.operationNumber,
            opName: op.operationName,
            fm: fm.description,
            missing,
          });
        }
      }
    }
  }
}
console.log(`  FMs with missing effects: ${emptyEffects.length}`);
if (emptyEffects.length > 0) {
  for (const e of emptyEffects) {
    console.log(`    OP ${e.op} [${e.opName}] FM="${e.fm}" missing: ${e.missing.join(', ')}`);
  }
}
console.log(`  RESULT: ${emptyEffects.length === 0 ? 'PASS' : 'FAIL'}`);

// CHECK 3: AP calculated correctly using AIAG-VDA 2019 table
console.log('\n--- CHECK A3: AP Calculation Correctness ---');
let apErrors = [];
for (const op of ops) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        for (const c of (fm.causes || [])) {
          const s = c.severity, o = c.occurrence, d = c.detection;
          const stored = c.actionPriority;
          const expected = calcAP(s, o, d);
          if (stored !== expected && expected !== '') {
            apErrors.push({
              op: op.operationNumber,
              fm: fm.description,
              cause: c.description,
              s, o, d,
              stored,
              expected,
            });
          }
        }
      }
    }
  }
}
console.log(`  AP mismatches: ${apErrors.length}`);
if (apErrors.length > 0) {
  for (const e of apErrors) {
    console.log(`    OP ${e.op} cause="${e.cause}" S=${e.s} O=${e.o} D=${e.d} stored=${e.stored} expected=${e.expected}`);
  }
}
console.log(`  RESULT: ${apErrors.length === 0 ? 'PASS' : 'FAIL'}`);

// CHECK 4: OP 120 = "CONTROL FINAL DE CALIDAD"
console.log('\n--- CHECK A4: OP 120 Name ---');
const op120 = ops.find(o => String(o.operationNumber) === '120');
const op120Name = op120?.operationName || 'NOT FOUND';
console.log(`  OP 120 name: "${op120Name}"`);
console.log(`  RESULT: ${op120Name === 'CONTROL FINAL DE CALIDAD' ? 'PASS' : 'FAIL'}`);

// CHECK 5: OP 130 should NOT have "Falta de elementos de proteccion personal" in "Falta de identificacion" FM
console.log('\n--- CHECK A5: OP 130 No EPP Cause in Identification FM ---');
const op130 = ops.find(o => String(o.operationNumber) === '130');
let hasBadCause = false;
let checkDetails = '';
if (op130) {
  for (const we of (op130.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        if (fm.description && fm.description.toLowerCase().includes('falta de identificaci')) {
          for (const c of (fm.causes || [])) {
            if (c.description && c.description.toLowerCase().includes('falta de elementos de protecci')) {
              hasBadCause = true;
              checkDetails = `Found: FM="${fm.description}", Cause="${c.description}"`;
            }
          }
        }
      }
    }
  }
}
console.log(`  ${hasBadCause ? checkDetails : 'Bad cause not found (correct)'}`);
console.log(`  RESULT: ${hasBadCause ? 'FAIL' : 'PASS'}`);

// CHECK 6: OP 10 flamabilidad FM with CC, S=10, referencing TL 1010 VW
console.log('\n--- CHECK A6: OP 10 Flamabilidad FM ---');
const op10 = ops.find(o => String(o.operationNumber) === '10');
let flamFound = false;
let flamDetails = {};
if (op10) {
  for (const we of (op10.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        const desc = (fm.description || '').toLowerCase();
        if (desc.includes('flamab') || desc.includes('flamm') || desc.includes('inflamab')) {
          flamFound = true;
          // Check causes
          for (const c of (fm.causes || [])) {
            flamDetails = {
              fmDesc: fm.description,
              causeDesc: c.description,
              severity: c.severity,
              specialChar: c.specialChar,
              preventionControl: c.preventionControl,
              detectionControl: c.detectionControl,
            };
          }
        }
      }
    }
  }
}
const flamHasCC = flamDetails.specialChar === 'CC';
const flamHasS10 = flamDetails.severity === 10;
const flamRefsTL1010 =
  ((flamDetails.preventionControl || '') + ' ' + (flamDetails.detectionControl || '') + ' ' + (flamDetails.causeDesc || ''))
    .toLowerCase().includes('tl 1010') ||
  ((flamDetails.preventionControl || '') + ' ' + (flamDetails.detectionControl || ''))
    .toLowerCase().includes('tl1010');

console.log(`  Flamabilidad FM found: ${flamFound}`);
if (flamFound) {
  console.log(`    FM: "${flamDetails.fmDesc}"`);
  console.log(`    Cause: "${flamDetails.causeDesc}"`);
  console.log(`    Severity: ${flamDetails.severity} (expected 10): ${flamHasS10 ? 'OK' : 'FAIL'}`);
  console.log(`    CC: ${flamDetails.specialChar} (expected CC): ${flamHasCC ? 'OK' : 'FAIL'}`);
  console.log(`    TL 1010 ref: ${flamRefsTL1010 ? 'OK' : 'FAIL'}`);
}
console.log(`  RESULT: ${flamFound && flamHasCC && flamHasS10 && flamRefsTL1010 ? 'PASS' : 'FAIL'}`);

// CHECK 7: CC% should be 1-5%
console.log('\n--- CHECK A7: CC Percentage ---');
let totalCausesForCC = 0;
let ccCount = 0;
for (const op of ops) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        for (const c of (fm.causes || [])) {
          totalCausesForCC++;
          if (c.specialChar === 'CC') ccCount++;
        }
      }
    }
  }
}
const ccPct = totalCausesForCC > 0 ? ((ccCount / totalCausesForCC) * 100).toFixed(1) : 0;
console.log(`  CC items: ${ccCount} / ${totalCausesForCC} = ${ccPct}%`);
console.log(`  RESULT: ${ccPct >= 1 && ccPct <= 5 ? 'PASS' : (ccPct < 1 ? 'WARNING (too low)' : 'WARNING (too high)')}`);

// CHECK 8: 0 optimization actions invented
console.log('\n--- CHECK A8: No Invented Actions ---');
let inventedActions = [];
for (const op of ops) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        for (const c of (fm.causes || [])) {
          if ((c.preventionAction && c.preventionAction.trim() !== '') ||
              (c.detectionAction && c.detectionAction.trim() !== '')) {
            inventedActions.push({
              op: op.operationNumber,
              cause: c.description,
              preventionAction: c.preventionAction,
              detectionAction: c.detectionAction,
            });
          }
        }
      }
    }
  }
}
console.log(`  Causes with non-empty actions: ${inventedActions.length}`);
if (inventedActions.length > 0) {
  for (const a of inventedActions) {
    console.log(`    OP ${a.op} cause="${a.cause}" pA="${a.preventionAction}" dA="${a.detectionAction}"`);
  }
}
console.log(`  RESULT: ${inventedActions.length === 0 ? 'PASS' : 'FAIL'}`);

// CHECK 9: No double-serialization
console.log('\n--- CHECK A9: No Double-Serialization ---');
console.log(`  typeof amfeDoc.data: ${typeof amfeDoc.data}`);
console.log(`  Double-serialized: ${amfeDoubleSerialized}`);
console.log(`  RESULT: ${amfeDoubleSerialized ? 'FAIL' : 'PASS'}`);


// ═══════════════════════════════════════════════════════════════════════════
// PFD AUDIT
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                      PFD AUDIT                              ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const pfdSteps = pfdData.steps || [];

// CHECK P1: Data integrity
console.log('\n--- CHECK P1: Data Integrity ---');
console.log(`  Total steps: ${pfdSteps.length}`);
console.log(`  Has header: ${!!pfdData.header}`);

// Count by type
const typeMap = {};
for (const s of pfdSteps) {
  const t = s.stepType || s.type || 'unknown';
  typeMap[t] = (typeMap[t] || 0) + 1;
}
console.log('  Step types:', JSON.stringify(typeMap));

// List steps
console.log('\n  Steps:');
for (const s of pfdSteps) {
  const t = s.stepType || s.type || '?';
  const name = s.description || s.name || '?';
  const num = s.stepNumber || '?';
  console.log(`    [${t.padEnd(10)}] ${num.toString().padEnd(8)} ${name}`);
}
console.log(`  RESULT: ${pfdSteps.length > 0 ? 'PASS' : 'FAIL'}`);

// CHECK P1b: OP 85 step in PFD
console.log('\n--- CHECK P1b: OP 85 Step in PFD ---');
const pfdOp85 = pfdSteps.find(s => {
  const num = String(s.stepNumber || '');
  return num === 'OP 85' || num === '85';
});
console.log(`  OP 85 step found: ${!!pfdOp85}`);
if (pfdOp85) {
  console.log(`  OP 85 name: "${pfdOp85.description || pfdOp85.name}"`);
  console.log(`  OP 85 type: "${pfdOp85.stepType || pfdOp85.type}"`);
}
console.log(`  RESULT: ${pfdOp85 ? 'PASS' : 'FAIL'}`);

// CHECK P2: Names match between PFD and AMFE
console.log('\n--- CHECK P2: PFD-AMFE Name Matching ---');
// Extract operation steps from PFD (those starting with "OP")
const pfdOpSteps = pfdSteps.filter(s => {
  const num = String(s.stepNumber || '');
  return num.startsWith('OP') || /^\d+$/.test(num);
});
// Map AMFE operations by number
const amfeOpMap = {};
for (const op of ops) {
  amfeOpMap[String(op.operationNumber)] = op.operationName;
}

let nameMatches = [];
let nameMismatches = [];
for (const s of pfdSteps) {
  const pfdNum = String(s.stepNumber || '');
  // Extract bare number from "OP 10" format
  const match = pfdNum.match(/^OP\s*(\d+)$/);
  if (match) {
    const bareNum = match[1];
    const pfdName = s.description || s.name || '';
    const amfeName = amfeOpMap[bareNum];
    if (amfeName) {
      if (pfdName === amfeName) {
        nameMatches.push({ num: bareNum, name: pfdName });
      } else {
        nameMismatches.push({ num: bareNum, pfd: pfdName, amfe: amfeName });
      }
    } else {
      nameMismatches.push({ num: bareNum, pfd: pfdName, amfe: 'NOT IN AMFE' });
    }
  }
}
console.log(`  Matches: ${nameMatches.length}`);
console.log(`  Mismatches: ${nameMismatches.length}`);
if (nameMismatches.length > 0) {
  for (const m of nameMismatches) {
    console.log(`    OP ${m.num}: PFD="${m.pfd}" vs AMFE="${m.amfe}"`);
  }
}
console.log(`  RESULT: ${nameMismatches.length === 0 ? 'PASS' : 'FAIL'}`);

// CHECK P3: Uses "CONTROL FINAL DE CALIDAD" not "INSPECCION FINAL"
console.log('\n--- CHECK P3: PFD uses CONTROL FINAL DE CALIDAD ---');
let hasInspeccionFinal = false;
let hasControlFinal = false;
for (const s of pfdSteps) {
  const name = (s.description || s.name || '').toUpperCase();
  if (name.includes('INSPECCION FINAL') || name.includes('INSPECCIÓN FINAL')) hasInspeccionFinal = true;
  if (name.includes('CONTROL FINAL DE CALIDAD')) hasControlFinal = true;
}
console.log(`  Has "CONTROL FINAL DE CALIDAD": ${hasControlFinal}`);
console.log(`  Has "INSPECCION FINAL": ${hasInspeccionFinal}`);
console.log(`  RESULT: ${hasControlFinal && !hasInspeccionFinal ? 'PASS' : 'FAIL'}`);

// CHECK P4: Has decision steps after inspection operations
console.log('\n--- CHECK P4: Decision Steps After Inspections ---');
let inspectionOps = [];
for (let i = 0; i < pfdSteps.length; i++) {
  const s = pfdSteps[i];
  const t = s.stepType || s.type || '';
  if (t === 'inspection') {
    const nextStep = pfdSteps[i + 1];
    const nextType = nextStep ? (nextStep.stepType || nextStep.type || '') : '';
    const nextName = nextStep ? (nextStep.description || nextStep.name || '') : '';
    const hasDecision = nextType === 'decision';
    inspectionOps.push({
      num: s.stepNumber,
      name: s.description || s.name,
      nextDecision: hasDecision,
      nextName,
    });
  }
}
const allHaveDecisions = inspectionOps.every(i => i.nextDecision);
console.log(`  Inspections found: ${inspectionOps.length}`);
for (const i of inspectionOps) {
  console.log(`    ${i.num} "${i.name}" → next is decision: ${i.nextDecision} ("${i.nextName}")`);
}
console.log(`  RESULT: ${allHaveDecisions ? 'PASS' : 'FAIL'}`);

// CHECK P5: All names UPPERCASE and in Spanish
console.log('\n--- CHECK P5: UPPERCASE and Spanish ---');
let nonUppercase = [];
let englishTerms = ['EDGE FOLDING', 'TRIMMING', 'WRAPPING', 'CUTTING', 'SEWING', 'INSPECTION'];
let englishFound = [];
for (const s of pfdSteps) {
  const name = s.description || s.name || '';
  if (name !== name.toUpperCase() && name.length > 0) {
    // Allow "?" in decisions
    if (name.replace('?', '').trim() !== name.replace('?', '').trim().toUpperCase()) {
      nonUppercase.push({ num: s.stepNumber, name });
    }
  }
  for (const term of englishTerms) {
    if (name.toUpperCase().includes(term)) {
      englishFound.push({ num: s.stepNumber, name, term });
    }
  }
}
console.log(`  Non-uppercase names: ${nonUppercase.length}`);
for (const n of nonUppercase) console.log(`    ${n.num}: "${n.name}"`);
console.log(`  English terms found: ${englishFound.length}`);
for (const e of englishFound) console.log(`    ${e.num}: "${e.name}" (${e.term})`);
console.log(`  RESULT: ${nonUppercase.length === 0 && englishFound.length === 0 ? 'PASS' : 'FAIL'}`);

// CHECK P6: companyName = "BARACK MERCOSUL", customerName = "VWA"
console.log('\n--- CHECK P6: Company/Customer Names ---');
const pfdHeader = pfdData.header || {};
console.log(`  companyName: "${pfdHeader.companyName}" (expected "BARACK MERCOSUL")`);
console.log(`  customerName: "${pfdHeader.customerName}" (expected "VWA")`);
const p6pass = pfdHeader.companyName === 'BARACK MERCOSUL' && pfdHeader.customerName === 'VWA';
console.log(`  RESULT: ${p6pass ? 'PASS' : 'FAIL'}`);

// CHECK P7: Has transport steps between sectors
console.log('\n--- CHECK P7: Transport Steps ---');
const transportSteps = pfdSteps.filter(s => (s.stepType || s.type) === 'transport');
console.log(`  Transport steps: ${transportSteps.length}`);
for (const t of transportSteps) {
  console.log(`    ${t.stepNumber}: ${t.description || t.name}`);
}
console.log(`  RESULT: ${transportSteps.length > 0 ? 'PASS' : 'FAIL'}`);

// CHECK P8: Type assignments correct
console.log('\n--- CHECK P8: Type Assignments ---');
let typeIssues = [];
for (const s of pfdSteps) {
  const t = s.stepType || s.type || '';
  const name = (s.description || s.name || '').toUpperCase();
  const num = String(s.stepNumber || '');

  // Storage for reception
  if (name.includes('RECEPCION') && t !== 'storage') {
    typeIssues.push({ num, name, type: t, expected: 'storage' });
  }
  // Inspection for QC operations
  if ((name.includes('CONTROL DE CALIDAD') || name.includes('CONTROL FINAL')) && !name.includes('?') && t !== 'inspection') {
    typeIssues.push({ num, name, type: t, expected: 'inspection' });
  }
}
console.log(`  Type assignment issues: ${typeIssues.length}`);
for (const i of typeIssues) {
  console.log(`    ${i.num} "${i.name}": type="${i.type}" expected="${i.expected}"`);
}
console.log(`  RESULT: ${typeIssues.length === 0 ? 'PASS' : 'FAIL'}`);


// ═══════════════════════════════════════════════════════════════════════════
// CROSS-DOC COHERENCE
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║              CROSS-DOCUMENT COHERENCE                       ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// CHECK X1: Every AMFE operation has a PFD step
console.log('\n--- CHECK X1: AMFE Operations Covered in PFD ---');
const pfdOpNumbers = new Set();
for (const s of pfdSteps) {
  const num = String(s.stepNumber || '');
  const match2 = num.match(/^OP\s*(\d+)$/);
  if (match2) pfdOpNumbers.add(match2[1]);
}
let missingInPfd = [];
for (const op of ops) {
  const num = String(op.operationNumber);
  if (!pfdOpNumbers.has(num)) {
    missingInPfd.push({ num, name: op.operationName });
  }
}
console.log(`  AMFE ops: ${ops.length}`);
console.log(`  PFD operation steps: ${pfdOpNumbers.size}`);
console.log(`  AMFE ops missing from PFD: ${missingInPfd.length}`);
for (const m of missingInPfd) console.log(`    OP ${m.num}: ${m.name}`);
console.log(`  RESULT: ${missingInPfd.length === 0 ? 'PASS' : 'FAIL'}`);

// CHECK X2: PFD step names match AMFE operation names exactly
console.log('\n--- CHECK X2: Exact Name Match (PFD vs AMFE) ---');
let x2mismatches = [];
for (const s of pfdSteps) {
  const num = String(s.stepNumber || '');
  const m = num.match(/^OP\s*(\d+)$/);
  if (m) {
    const bareNum = m[1];
    const pfdName = s.description || s.name || '';
    const amfeName = amfeOpMap[bareNum];
    if (amfeName && pfdName !== amfeName) {
      x2mismatches.push({ num: bareNum, pfd: pfdName, amfe: amfeName });
    }
  }
}
console.log(`  Exact mismatches: ${x2mismatches.length}`);
for (const m of x2mismatches) {
  console.log(`    OP ${m.num}: PFD="${m.pfd}" AMFE="${m.amfe}"`);
}
console.log(`  RESULT: ${x2mismatches.length === 0 ? 'PASS' : 'FAIL'}`);


// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  AUDIT COMPLETE');
console.log('═══════════════════════════════════════════════════════════════');

// Also dump the TL 1010 reference search across entire AMFE for CHECK 6
console.log('\n--- Additional: TL 1010 search across AMFE OP 10 ---');
if (op10) {
  for (const we of (op10.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        const desc = (fm.description || '').toLowerCase();
        if (desc.includes('flamab') || desc.includes('flamm')) {
          console.log(`  FM: "${fm.description}"`);
          console.log(`    effectLocal: "${fm.effectLocal}"`);
          console.log(`    effectNextLevel: "${fm.effectNextLevel}"`);
          console.log(`    effectEndUser: "${fm.effectEndUser}"`);
          for (const c of (fm.causes || [])) {
            console.log(`    Cause: "${c.description}"`);
            console.log(`      S=${c.severity} O=${c.occurrence} D=${c.detection} AP=${c.actionPriority}`);
            console.log(`      specialChar=${c.specialChar}`);
            console.log(`      preventionControl: "${c.preventionControl}"`);
            console.log(`      detectionControl: "${c.detectionControl}"`);
          }
        }
      }
    }
  }
}

// Dump OP 85 details
console.log('\n--- Additional: OP 85 Injection Details ---');
if (op85) {
  for (const we of (op85.workElements || [])) {
    console.log(`  WE: "${we.description}"`);
    for (const fn of (we.functions || [])) {
      console.log(`    FN: "${fn.description}"`);
      for (const fm of (fn.failures || [])) {
        console.log(`    FM: "${fm.description}"`);
        console.log(`      effectLocal: "${fm.effectLocal}"`);
        console.log(`      effectNextLevel: "${fm.effectNextLevel}"`);
        console.log(`      effectEndUser: "${fm.effectEndUser}"`);
        for (const c of (fm.causes || [])) {
          console.log(`      Cause: "${c.description}" S=${c.severity} O=${c.occurrence} D=${c.detection} AP=${c.actionPriority} CC/SC=${c.specialChar || '-'}`);
          console.log(`        preventionControl: "${c.preventionControl || ''}"`);
          console.log(`        detectionControl: "${c.detectionControl || ''}"`);
          console.log(`        preventionAction: "${c.preventionAction || ''}"`);
          console.log(`        detectionAction: "${c.detectionAction || ''}"`);
        }
      }
    }
  }
} else {
  console.log('  OP 85 NOT FOUND');
}

// Dump SC/CC stats
console.log('\n--- Additional: SC/CC Distribution ---');
let scCount = 0;
for (const op of ops) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        for (const c of (fm.causes || [])) {
          if (c.specialChar === 'SC') scCount++;
        }
      }
    }
  }
}
const scPct = totalCausesForCC > 0 ? ((scCount / totalCausesForCC) * 100).toFixed(1) : 0;
console.log(`  CC: ${ccCount} (${ccPct}%)`);
console.log(`  SC: ${scCount} (${scPct}%)`);
console.log(`  Standard: ${totalCausesForCC - ccCount - scCount} (${totalCausesForCC > 0 ? (((totalCausesForCC - ccCount - scCount) / totalCausesForCC) * 100).toFixed(1) : 0}%)`);
console.log(`  Total: ${totalCausesForCC}`);
