/**
 * _auditFinal3Amfes.mjs — Consolidated audit of 3 VWA door panel AMFEs
 *
 * AMFEs:
 *   TOP_ROLL:            78eaa89b-ad0b-4342-9046-ab2e9b14d3b3
 *   INSERT:              7cfe2db7-9e5a-4b46-804d-76194557c581
 *   ARMREST_DOOR_PANEL:  5268704d-30ae-48f3-ad05-8402a6ded7fe
 *
 * Checks (11):
 *   C-OPFUNC:        operationFunction NOT empty on every OP
 *   C-FEF:           focusElementFunction NOT empty, "Interno: / Cliente: / Usuario final:"
 *   C-SOD:           Every cause with text must have S, O, D (1-10), none = 0
 *   C-EFFECTS:       Every failure mode has effectLocal, effectNextLevel, effectEndUser
 *   C-1M:            Each WE is ONE item (no " / " in name)
 *   C-NAMING:        OP names UPPERCASE, in Spanish
 *   C-AP:            AP calculated with official AIAG-VDA table (sample of 5+)
 *   C-CAPACITACION:  "Capacitacion"/"Entrenamiento" NEVER as cause
 *   C-META:          operation_count and cause_count match real data
 *   C-WIP:           No "ALMACENAMIENTO WIP" operations
 *   C-TYPES:         WE types must be standard 6M English
 *
 * EXCLUSIONS: AP=H without actions, CC/SC missing — NOT reported.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ═══════════════════════════════════════════════════════════════════════════════
// ENV + AUTH
// ═══════════════════════════════════════════════════════════════════════════════

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { error: authErr } = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL,
  password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }

// ═══════════════════════════════════════════════════════════════════════════════
// AP TABLE — official AIAG-VDA 2019 (copied from apTable.ts)
// ═══════════════════════════════════════════════════════════════════════════════

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
  const sI = Math.round(s), oI = Math.round(o), dI = Math.round(d);
  if (sI < 1 || sI > 10 || oI < 1 || oI > 10 || dI < 1 || dI > 10) return '';
  return apRule(sI, oI, dI);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_WE_TYPES = new Set([
  'Machine', 'Man', 'Method', 'Material', 'Measurement', 'Environment',
]);

const ENGLISH_WORDS = [
  'machine', 'method', 'environment', 'measurement',
  'operator', 'worker', 'trimming', 'cutting', 'welding',
  'assembly', 'inspection', 'storage', 'transport', 'packaging',
  'edge folding', 'molding', 'injection', 'quality', 'reception',
  'sewing', 'lamination', 'thermoforming', 'stamping', 'bonding',
  'foam', 'wrapping', 'riveting', 'img',
];

const CAPACITACION_KW = [
  'capacitacion', 'capacitación', 'entrenamiento',
  'falta de capacitacion', 'falta de capacitación',
  'operario no capacitado', 'falta de entrenamiento',
  'no capacitado', 'personal no capacitado',
];

const WIP_KW = ['almacenamiento wip', 'almacen wip'];

const SAFETY_KW = [
  'flamabilidad', 'flamable', 'inflamab', 'voc', 'emisiones', 'emision',
  'airbag', 'borde filoso', 'bordes filosos', 'filo', 'cortante',
  'seguridad', 'safety', 'tl 1010', 'tl1010', 'laceracion',
  'quemadura', 'incendio', 'toxico', 'toxicidad', 'legal', 'normativa',
];

// ═══════════════════════════════════════════════════════════════════════════════
// AMFE IDs
// ═══════════════════════════════════════════════════════════════════════════════

const AMFES = [
  { label: 'TOP_ROLL',            id: '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3' },
  { label: 'INSERT',              id: '7cfe2db7-9e5a-4b46-804d-76194557c581' },
  { label: 'ARMREST_DOOR_PANEL',  id: '5268704d-30ae-48f3-ad05-8402a6ded7fe' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function opLabel(op) {
  return `OP ${op.operationNumber || op.opNumber || '?'} "${op.operationName || op.name || '?'}"`;
}
function causeText(cause) { return cause.cause || cause.description || ''; }
function getSeverity(fail, cause) {
  const cs = Number(cause.severity);
  if (!isNaN(cs) && cs >= 1) return cs;
  const fs = Number(fail.severity);
  if (!isNaN(fs) && fs >= 1) return fs;
  return NaN;
}
function getStoredAP(cause) {
  return ((cause.ap || cause.actionPriority || '') + '').toUpperCase().trim();
}

// Iterate all causes in an AMFE's operations
function* iterCauses(ops) {
  for (const op of ops) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
          for (const cause of (fail.causes || [])) {
            yield { op, we, fn, fail, cause };
          }
        }
      }
    }
  }
}

function* iterFailures(ops) {
  for (const op of ops) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
          yield { op, we, fn, fail };
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT ONE AMFE — returns { blockers[], warnings[], pass[], info{} }
// ═══════════════════════════════════════════════════════════════════════════════

async function auditAmfe(amfeId, label) {
  const { data: doc, error: fetchErr } = await sb
    .from('amfe_documents')
    .select('*')
    .eq('id', amfeId)
    .single();

  if (fetchErr) {
    return { label, error: `Fetch failed: ${fetchErr.message}`, blockers: [], warnings: [], pass: [], info: {} };
  }

  let amfeData = doc.data;
  if (typeof amfeData === 'string') {
    try { amfeData = JSON.parse(amfeData); } catch (e) {
      return { label, error: `JSON parse failed: ${e.message}`, blockers: ['Double-serialization or corrupt data'], warnings: [], pass: [], info: {} };
    }
  }
  if (typeof amfeData === 'string') {
    return { label, error: 'Double-serialized data', blockers: ['BLOCKER: data is double-serialized'], warnings: [], pass: [], info: {} };
  }

  const ops = amfeData.operations || [];
  const blockers = [];
  const warnings = [];
  const pass = [];
  const info = {
    opCount: ops.length,
    weCount: 0,
    causeCount: 0,
    metaOpCount: doc.operation_count,
    metaCauseCount: doc.cause_count,
    apChecked: 0,
    apMismatch: 0,
  };

  // Count totals
  for (const op of ops) {
    info.weCount += (op.workElements || []).length;
  }
  for (const { cause } of iterCauses(ops)) {
    info.causeCount++;
  }

  // ── C-OPFUNC: operationFunction NOT empty ──
  let opfuncOk = true;
  for (const op of ops) {
    const wes = op.workElements || [];
    if (wes.length === 0) continue;
    const opFunc = (op.operationFunction || '').trim();
    if (!opFunc) {
      blockers.push(`[C-OPFUNC] ${opLabel(op)} — operationFunction is EMPTY`);
      opfuncOk = false;
    }
  }
  if (opfuncOk) pass.push('C-OPFUNC');

  // ── C-FEF: focusElementFunction NOT empty, 3 perspectives ──
  let fefOk = true;
  for (const op of ops) {
    const wes = op.workElements || [];
    if (wes.length === 0) continue;
    const fef = (op.focusElementFunction || '').trim();
    if (!fef) {
      blockers.push(`[C-FEF] ${opLabel(op)} — focusElementFunction is EMPTY`);
      fefOk = false;
    } else {
      const hasInterno = /intern/i.test(fef);
      const hasCliente = /client/i.test(fef);
      const hasUsuario = /usuario|usr|final/i.test(fef);
      const hasSeps = (fef.match(/ \/ /g) || []).length >= 2;
      if (!hasSeps && !(hasInterno && hasCliente && hasUsuario)) {
        warnings.push(`[C-FEF] ${opLabel(op)} — may lack 3 perspectives: "${fef.slice(0, 60)}..."`);
        fefOk = false;
      }
    }
  }
  if (fefOk) pass.push('C-FEF');

  // ── C-SOD: S/O/D complete (1-10, not 0) ──
  let sodOk = true;
  for (const { op, we, fail, cause } of iterCauses(ops)) {
    const ct = causeText(cause);
    if (!ct.trim()) continue;
    const s = getSeverity(fail, cause);
    const o = Number(cause.occurrence);
    const d = Number(cause.detection);

    const missing = [];
    if (isNaN(s) || s < 1 || s > 10) missing.push(`S=${cause.severity ?? 'empty'}`);
    if (isNaN(o) || o < 1 || o > 10) missing.push(`O=${cause.occurrence ?? 'empty'}`);
    if (isNaN(d) || d < 1 || d > 10) missing.push(`D=${cause.detection ?? 'empty'}`);
    if (s === 0) missing.push('S=0');
    if (o === 0) missing.push('O=0');
    if (d === 0) missing.push('D=0');

    if (missing.length > 0) {
      blockers.push(`[C-SOD] ${opLabel(op)} | WE "${(we.name||'').slice(0,30)}" | Cause: "${ct.slice(0, 40)}" — ${missing.join(', ')}`);
      sodOk = false;
    }
  }
  if (sodOk) pass.push('C-SOD');

  // ── C-EFFECTS: 3 VDA effects on every failure with causes ──
  let effectsOk = true;
  for (const { op, we, fail } of iterFailures(ops)) {
    if (!fail.causes || fail.causes.length === 0) continue;
    const missingE = [];
    if (!(fail.effectLocal || '').trim()) missingE.push('effectLocal');
    if (!(fail.effectNextLevel || '').trim()) missingE.push('effectNextLevel');
    if (!(fail.effectEndUser || '').trim()) missingE.push('effectEndUser');
    if (missingE.length > 0) {
      blockers.push(`[C-EFFECTS] ${opLabel(op)} | WE "${(we.name||'').slice(0,30)}" | Fail "${(fail.description||'').slice(0,40)}" — missing: ${missingE.join(', ')}`);
      effectsOk = false;
    }
  }
  if (effectsOk) pass.push('C-EFFECTS');

  // ── C-1M: No " / " in WE name ──
  let oneM_Ok = true;
  for (const op of ops) {
    for (const we of (op.workElements || [])) {
      const weName = we.name || '';
      if (weName.includes(' / ')) {
        blockers.push(`[C-1M] ${opLabel(op)} | WE "${weName.slice(0, 60)}" — contains " / "`);
        oneM_Ok = false;
      }
    }
  }
  if (oneM_Ok) pass.push('C-1M');

  // ── C-NAMING: UPPERCASE + Spanish ──
  let namingOk = true;
  for (const op of ops) {
    const opName = op.operationName || op.name || '';
    if (opName !== opName.toUpperCase()) {
      warnings.push(`[C-NAMING] ${opLabel(op)} — not UPPERCASE: "${opName}"`);
      namingOk = false;
    }
    const opLower = opName.toLowerCase();
    for (const ew of ENGLISH_WORDS) {
      if (opLower === ew || opLower.includes(` ${ew} `) || opLower.startsWith(`${ew} `) || opLower.endsWith(` ${ew}`)) {
        warnings.push(`[C-NAMING] ${opLabel(op)} — English word "${ew}" detected`);
        namingOk = false;
        break;
      }
    }
  }
  if (namingOk) pass.push('C-NAMING');

  // ── C-AP: AP with official table (check all, report mismatches) ──
  let apOk = true;
  for (const { op, we, fail, cause } of iterCauses(ops)) {
    const s = getSeverity(fail, cause);
    const o = Number(cause.occurrence);
    const d = Number(cause.detection);
    if (isNaN(s) || s < 1 || isNaN(o) || o < 1 || isNaN(d) || d < 1) continue;

    const expected = calculateAP(s, o, d);
    if (!expected) continue;
    info.apChecked++;
    const stored = getStoredAP(cause);

    if (stored && stored !== expected) {
      blockers.push(`[C-AP] ${opLabel(op)} | Cause: "${causeText(cause).slice(0,40)}" — S=${s} O=${o} D=${d} stored=${stored} expected=${expected}`);
      info.apMismatch++;
      apOk = false;
    } else if (!stored) {
      warnings.push(`[C-AP] ${opLabel(op)} | Cause: "${causeText(cause).slice(0,40)}" — S=${s} O=${o} D=${d} AP empty (expected ${expected})`);
      info.apMismatch++;
      apOk = false;
    }
  }
  if (apOk) pass.push('C-AP');

  // ── C-CAPACITACION: Never as cause ──
  let capaOk = true;
  for (const { op, we, cause } of iterCauses(ops)) {
    const ct = causeText(cause).toLowerCase();
    for (const kw of CAPACITACION_KW) {
      if (ct.includes(kw)) {
        blockers.push(`[C-CAPACITACION] ${opLabel(op)} | Cause: "${causeText(cause).slice(0, 50)}" — uses "${kw}"`);
        capaOk = false;
        break;
      }
    }
  }
  if (capaOk) pass.push('C-CAPACITACION');

  // ── C-META: operation_count / cause_count sync ──
  let metaOk = true;
  if (info.metaOpCount != null && info.metaOpCount !== info.opCount) {
    warnings.push(`[C-META] operation_count mismatch: stored=${info.metaOpCount} actual=${info.opCount}`);
    metaOk = false;
  }
  if (info.metaCauseCount != null && info.metaCauseCount !== info.causeCount) {
    warnings.push(`[C-META] cause_count mismatch: stored=${info.metaCauseCount} actual=${info.causeCount}`);
    metaOk = false;
  }
  if (metaOk) pass.push('C-META');

  // ── C-WIP: No ALMACENAMIENTO WIP ──
  let wipOk = true;
  for (const op of ops) {
    const opName = (op.operationName || op.name || '').toLowerCase();
    for (const kw of WIP_KW) {
      if (opName.includes(kw)) {
        blockers.push(`[C-WIP] ${opLabel(op)} — ALMACENAMIENTO WIP should not exist in AMFE`);
        wipOk = false;
        break;
      }
    }
  }
  if (wipOk) pass.push('C-WIP');

  // ── C-TYPES: WE types must be standard 6M ──
  let typesOk = true;
  for (const op of ops) {
    for (const we of (op.workElements || [])) {
      const weType = we.type || '';
      if (!VALID_WE_TYPES.has(weType)) {
        blockers.push(`[C-TYPES] ${opLabel(op)} | WE "${(we.name||'').slice(0,40)}" — invalid type "${weType}" (expected: ${[...VALID_WE_TYPES].join(', ')})`);
        typesOk = false;
      }
    }
  }
  if (typesOk) pass.push('C-TYPES');

  // ── BONUS: S=9-10 calibration (warning only) ──
  for (const { op, we, fail, cause } of iterCauses(ops)) {
    const sev = getSeverity(fail, cause);
    if (isNaN(sev) || sev < 9) continue;
    const allText = [
      fail.description || '', fail.effectLocal || '', fail.effectNextLevel || '',
      fail.effectEndUser || '', causeText(cause),
    ].join(' ').toLowerCase();
    const hasSafety = SAFETY_KW.some(kw => allText.includes(kw));
    if (!hasSafety) {
      warnings.push(`[C-SEV] ${opLabel(op)} | WE "${(we.name||'').slice(0,30)}" — S=${sev} without safety keywords in fail/effects/cause`);
    }
  }

  return { label, error: null, blockers, warnings, pass, info };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — run all 3 audits
// ═══════════════════════════════════════════════════════════════════════════════

console.log('='.repeat(100));
console.log('  AUDIT FINAL — 3 AMFEs VWA PUERTAS PATAGONIA');
console.log('  Date:', new Date().toISOString().slice(0, 19));
console.log('='.repeat(100));
console.log('');

const results = [];
for (const { label, id } of AMFES) {
  console.log(`--- Auditing ${label} (${id}) ---`);
  const r = await auditAmfe(id, label);
  results.push(r);

  if (r.error) {
    console.log(`  ERROR: ${r.error}`);
    continue;
  }

  console.log(`  OPs: ${r.info.opCount}  WEs: ${r.info.weCount}  Causes: ${r.info.causeCount}`);
  console.log(`  Meta: op_count=${r.info.metaOpCount} cause_count=${r.info.metaCauseCount}`);
  console.log(`  AP checked: ${r.info.apChecked}, mismatches: ${r.info.apMismatch}`);
  console.log(`  Blockers: ${r.blockers.length}  Warnings: ${r.warnings.length}  Passed: ${r.pass.length}/11`);
  console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAILED RESULTS
// ═══════════════════════════════════════════════════════════════════════════════

for (const r of results) {
  console.log('');
  console.log('#'.repeat(100));
  console.log(`  ${r.label}`);
  console.log('#'.repeat(100));

  if (r.error) {
    console.log(`  FATAL ERROR: ${r.error}`);
    continue;
  }

  if (r.blockers.length > 0) {
    console.log(`\n  BLOCKERS (${r.blockers.length}):`);
    for (const b of r.blockers) console.log(`    [BLOCKER] ${b}`);
  }
  if (r.warnings.length > 0) {
    console.log(`\n  WARNINGS (${r.warnings.length}):`);
    for (const w of r.warnings) console.log(`    [WARN] ${w}`);
  }
  if (r.pass.length > 0) {
    console.log(`\n  PASSED (${r.pass.length}/11):`);
    for (const p of r.pass) console.log(`    [PASS] ${p}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY TABLE
// ═══════════════════════════════════════════════════════════════════════════════

const CHECKS = [
  'C-OPFUNC', 'C-FEF', 'C-SOD', 'C-EFFECTS', 'C-1M',
  'C-NAMING', 'C-AP', 'C-CAPACITACION', 'C-META', 'C-WIP', 'C-TYPES',
];

console.log('\n');
console.log('='.repeat(100));
console.log('  SUMMARY TABLE');
console.log('='.repeat(100));

// Header
const colW = 22;
const checkW = 16;
let header = 'CHECK'.padEnd(checkW);
for (const r of results) header += r.label.padEnd(colW);
console.log(header);
console.log('-'.repeat(checkW + colW * results.length));

// Each check
for (const check of CHECKS) {
  let row = check.padEnd(checkW);
  for (const r of results) {
    if (r.error) {
      row += 'ERROR'.padEnd(colW);
    } else if (r.pass.includes(check)) {
      row += 'PASS'.padEnd(colW);
    } else {
      // Count blockers and warnings for this check
      const bCount = r.blockers.filter(b => b.startsWith(`[${check}]`)).length;
      const wCount = r.warnings.filter(w => w.startsWith(`[${check}]`)).length;
      if (bCount > 0) {
        row += `FAIL (${bCount} blocker${bCount>1?'s':''})`.padEnd(colW);
      } else if (wCount > 0) {
        row += `WARN (${wCount})`.padEnd(colW);
      } else {
        row += 'PASS'.padEnd(colW);
      }
    }
  }
  console.log(row);
}

// Totals row
console.log('-'.repeat(checkW + colW * results.length));
let totRow = 'TOTALS'.padEnd(checkW);
for (const r of results) {
  if (r.error) {
    totRow += 'ERROR'.padEnd(colW);
  } else {
    totRow += `B:${r.blockers.length} W:${r.warnings.length} P:${r.pass.length}/11`.padEnd(colW);
  }
}
console.log(totRow);

// Stats row
let statsRow = 'OPs/WEs/Causes'.padEnd(checkW);
for (const r of results) {
  if (r.error) {
    statsRow += 'N/A'.padEnd(colW);
  } else {
    statsRow += `${r.info.opCount}/${r.info.weCount}/${r.info.causeCount}`.padEnd(colW);
  }
}
console.log(statsRow);

// Verdict
console.log('\n' + '='.repeat(100));
const totalBlockers = results.reduce((s, r) => s + r.blockers.length, 0);
const totalWarnings = results.reduce((s, r) => s + r.warnings.length, 0);
const totalPassed = results.reduce((s, r) => s + r.pass.length, 0);
console.log(`  OVERALL: ${totalBlockers} blockers, ${totalWarnings} warnings, ${totalPassed}/33 checks passed`);
console.log(`  VERDICT: ${totalBlockers === 0 ? 'PASS' : 'FAIL — blockers must be resolved'}`);
console.log('='.repeat(100));

process.exit(totalBlockers > 0 ? 1 : 0);
