/**
 * fixVwaAmfesBugs.mjs
 *
 * Fixes 3 critical bugs found by independent auditor:
 *   Bug 1: Double-serialized data in Supabase (JSONB column has string instead of object)
 *   Bug 2: AP calculation using wrong S*O*D product formula instead of AIAG-VDA lookup table
 *   Bug 3: Armrest AMFE uses OP 5 for reception instead of OP 10 (mismatch with CP/Excel)
 *
 * Usage:
 *   node scripts/fixVwaAmfesBugs.mjs           # dry-run (default)
 *   node scripts/fixVwaAmfesBugs.mjs --apply   # write changes to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ─── Config ─────────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--apply');
const ENV_PATH = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';

// ─── Supabase connection ────────────────────────────────────────────────────
const envText = readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ─── AIAG-VDA AP Lookup Table (from modules/amfe/apTable.ts) ────────────────
function calculateAP(s, o, d) {
  if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
  const sInt = Math.round(s);
  const oInt = Math.round(o);
  const dInt = Math.round(d);
  if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';

  return apRule(sInt, oInt, dInt);
}

function apRule(s, o, d) {
  // S = 1: Always L
  if (s <= 1) return 'L';

  // S = 2-3: Only M when O=8-10 AND D=5-10
  if (s <= 3) {
    if (o >= 8 && d >= 5) return 'M';
    return 'L';
  }

  // S = 4-6
  if (s <= 6) {
    if (o >= 8) return d >= 5 ? 'H' : 'M';     // O=8-10: D>=5->H, D<=4->M
    if (o >= 6) return d >= 2 ? 'M' : 'L';      // O=6-7:  D>=2->M, D=1->L
    if (o >= 4) return d >= 7 ? 'M' : 'L';      // O=4-5:  D>=7->M, D<=6->L
    return 'L';                                   // O=1-3:  always L
  }

  // S = 7-8
  if (s <= 8) {
    if (o >= 8) return 'H';                       // O=8-10: always H
    if (o >= 6) return d >= 2 ? 'H' : 'M';       // O=6-7:  D>=2->H, D=1->M
    if (o >= 4) return d >= 7 ? 'H' : 'M';       // O=4-5:  D>=7->H, D<=6->M
    if (o >= 2) return d >= 5 ? 'M' : 'L';       // O=2-3:  D>=5->M, D<=4->L
    return 'L';                                    // O=1:    always L
  }

  // S = 9-10
  if (o >= 6) return 'H';                          // O=6-10: always H
  if (o >= 4) return d >= 2 ? 'H' : 'M';          // O=4-5:  D>=2->H, D=1->M
  if (o >= 2) {                                    // O=2-3:
    if (d >= 7) return 'H';                        //   D>=7->H
    if (d >= 5) return 'M';                        //   D=5-6->M
    return 'L';                                    //   D<=4->L
  }
  return 'L';                                      // O=1:    always L
}

// ─── Report state ───────────────────────────────────────────────────────────
const report = {
  bug1_deserialization: [],
  bug2_ap_recalc: [],
  bug3_op_renumber: [],
};

console.log('═══════════════════════════════════════════════════════════════');
console.log('  FIX VWA AMFE BUGS — Auditor-reported critical issues');
console.log(`  Mode: ${DRY_RUN ? 'DRY-RUN (no changes written)' : 'APPLY (writing to Supabase)'}`);
console.log('═══════════════════════════════════════════════════════════════\n');

// ═══════════════════════════════════════════════════════════════════════════
// BUG 1: Double-serialized data — check ALL AMFEs (VWA + PWA)
// ═══════════════════════════════════════════════════════════════════════════
console.log('─── Bug 1: Double-serialized data check (ALL AMFEs) ──────────\n');

const { data: allAmfes, error: fetchErr } = await sb
  .from('amfe_documents')
  .select('id, project_name, data');

if (fetchErr) {
  console.error('FATAL: Cannot fetch AMFEs:', fetchErr.message);
  process.exit(1);
}

console.log(`Found ${allAmfes.length} AMFE documents total.\n`);

const amfesToFix = [];

for (const amfe of allAmfes) {
  const isString = typeof amfe.data === 'string';
  const label = `  ${amfe.project_name} (${amfe.id.slice(0, 8)})`;
  if (isString) {
    console.log(`${label} — BUG: data is STRING (double-serialized)`);
    report.bug1_deserialization.push({ id: amfe.id, name: amfe.project_name });
    // Parse it back to an object
    try {
      amfe.data = JSON.parse(amfe.data);
      console.log(`    -> Parsed successfully. Type now: ${typeof amfe.data}`);
    } catch (e) {
      console.error(`    -> PARSE FAILED: ${e.message}`);
      continue;
    }
    amfesToFix.push(amfe);
  } else {
    console.log(`${label} — OK: data is object`);
  }
}

if (report.bug1_deserialization.length === 0) {
  console.log('\n  No double-serialization issues found.');
} else {
  console.log(`\n  Found ${report.bug1_deserialization.length} AMFEs with double-serialized data.`);
}

// ═══════════════════════════════════════════════════════════════════════════
// BUG 2: AP recalculation for ALL 6 VWA AMFEs using correct AIAG-VDA table
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n─── Bug 2: AP recalculation (VWA AMFEs) ───────────────────────\n');

// Get VWA AMFEs (refresh from parsed data or re-fetch)
const vwaAmfes = allAmfes.filter(a => a.project_name && a.project_name.startsWith('VWA'));
console.log(`Found ${vwaAmfes.length} VWA AMFEs.\n`);

for (const amfe of vwaAmfes) {
  // Ensure data is an object (may have been fixed in Bug 1)
  let data = amfe.data;
  if (typeof data === 'string') {
    data = JSON.parse(data);
    amfe.data = data;
  }

  if (!data || !data.operations) {
    console.log(`  ${amfe.project_name}: NO operations found, skipping.`);
    continue;
  }

  console.log(`  ${amfe.project_name} (${amfe.id.slice(0, 8)}):`);
  let changedCount = 0;

  for (const op of data.operations) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
          for (const cause of (fail.causes || [])) {
            const s = cause.severity;
            const o = cause.occurrence;
            const d = cause.detection;

            if (!s || !o || !d) continue;

            const correctAP = calculateAP(Number(s), Number(o), Number(d));
            const currentAP = cause.actionPriority || '';

            if (correctAP && currentAP !== correctAP) {
              report.bug2_ap_recalc.push({
                amfe: amfe.project_name,
                op: op.operationNumber,
                cause: (cause.description || '').slice(0, 60),
                s, o, d,
                oldAP: currentAP,
                newAP: correctAP,
              });
              cause.actionPriority = correctAP;
              changedCount++;
            }
          }
        }
      }
    }
  }

  if (changedCount > 0) {
    console.log(`    -> ${changedCount} causes with AP recalculated`);
  } else {
    console.log(`    -> All APs already correct (0 changes)`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUG 3: Operation numbering — Armrest OP 5 → OP 10
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n─── Bug 3: Armrest OP 5 → OP 10 renumbering ─────────────────\n');

const armrestAmfe = allAmfes.find(a => a.project_name && a.project_name.toUpperCase().includes('ARMREST'));

if (!armrestAmfe) {
  console.log('  WARNING: Armrest AMFE not found in database.');
} else {
  let armrestData = armrestAmfe.data;
  if (typeof armrestData === 'string') {
    armrestData = JSON.parse(armrestData);
    armrestAmfe.data = armrestData;
  }

  if (armrestData && armrestData.operations) {
    let found = false;
    for (const op of armrestData.operations) {
      if (op.operationNumber === '5' || op.operationNumber === 5) {
        const oldNum = op.operationNumber;
        op.operationNumber = '10';
        report.bug3_op_renumber.push({
          amfe: armrestAmfe.project_name,
          opName: op.operationName,
          oldNum: String(oldNum),
          newNum: '10',
        });
        found = true;
        console.log(`  Found OP ${oldNum} "${op.operationName}" -> changed to OP 10`);
      }
    }
    if (!found) {
      console.log('  No OP 5 found in Armrest AMFE (may already be OP 10).');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// APPLY CHANGES
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n─── Applying changes ──────────────────────────────────────────\n');

// Collect all AMFEs that need updating
const updatesNeeded = new Map(); // id -> amfe object

// Bug 1: deserialized AMFEs
for (const amfe of amfesToFix) {
  updatesNeeded.set(amfe.id, amfe);
}

// Bug 2: VWA AMFEs with AP changes
for (const amfe of vwaAmfes) {
  if (report.bug2_ap_recalc.some(r => r.amfe === amfe.project_name)) {
    updatesNeeded.set(amfe.id, amfe);
  }
}

// Bug 3: Armrest OP renumber
if (armrestAmfe && report.bug3_op_renumber.length > 0) {
  updatesNeeded.set(armrestAmfe.id, armrestAmfe);
}

if (updatesNeeded.size === 0) {
  console.log('  No changes needed. All AMFEs are clean.');
} else if (DRY_RUN) {
  console.log(`  ${updatesNeeded.size} AMFEs would be updated. Run with --apply to write changes.`);
} else {
  for (const [id, amfe] of updatesNeeded) {
    const { error } = await sb
      .from('amfe_documents')
      .update({ data: amfe.data })
      .eq('id', id);

    if (error) {
      console.error(`  FAILED ${amfe.project_name}: ${error.message}`);
    } else {
      console.log(`  OK ${amfe.project_name} (${id.slice(0, 8)})`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  DETAILED REPORT');
console.log('═══════════════════════════════════════════════════════════════\n');

// Bug 1 summary
console.log(`Bug 1 — Double-serialization: ${report.bug1_deserialization.length} AMFEs affected`);
for (const r of report.bug1_deserialization) {
  console.log(`  - ${r.name} (${r.id.slice(0, 8)})`);
}

// Bug 2 summary
console.log(`\nBug 2 — AP recalculation: ${report.bug2_ap_recalc.length} causes changed`);
// Group by AMFE
const apByAmfe = {};
for (const r of report.bug2_ap_recalc) {
  if (!apByAmfe[r.amfe]) apByAmfe[r.amfe] = [];
  apByAmfe[r.amfe].push(r);
}
for (const [amfeName, changes] of Object.entries(apByAmfe)) {
  console.log(`  ${amfeName}: ${changes.length} changes`);
  for (const c of changes) {
    console.log(`    OP ${c.op} | S=${c.s} O=${c.o} D=${c.d} | ${c.oldAP} -> ${c.newAP} | ${c.cause}`);
  }
}

// Bug 3 summary
console.log(`\nBug 3 — OP renumbering: ${report.bug3_op_renumber.length} operations changed`);
for (const r of report.bug3_op_renumber) {
  console.log(`  ${r.amfe}: OP ${r.oldNum} "${r.opName}" -> OP ${r.newNum}`);
}

console.log(`\n─── Summary ──────────────────────────────────────────────────`);
console.log(`  Bug 1 (double-serialization): ${report.bug1_deserialization.length} fixed`);
console.log(`  Bug 2 (AP recalculation):     ${report.bug2_ap_recalc.length} causes corrected`);
console.log(`  Bug 3 (OP renumbering):       ${report.bug3_op_renumber.length} operations renumbered`);
console.log(`  Total AMFEs updated:          ${updatesNeeded.size}`);
console.log(`  Mode:                         ${DRY_RUN ? 'DRY-RUN' : 'APPLIED'}`);
console.log('═══════════════════════════════════════════════════════════════\n');

process.exit(0);
