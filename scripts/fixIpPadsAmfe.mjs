/**
 * fixIpPadsAmfe.mjs
 *
 * Fixes 3 issues in the TRIM ASM-UPR WRAPPING (IP PADs) AMFE document:
 *
 *   Fix 1: Rename OP 120 from "INSPECCION FINAL" to "CONTROL FINAL DE CALIDAD"
 *          (standard name per pfd.md)
 *
 *   Fix 2: Fix OP 130 copy-paste error — "Falta de identificación" failure has
 *          cause "Falta de elementos de protección personal" which is nonsensical
 *          for a labeling issue. Change to "Error del operario".
 *
 *   Fix 3: Add mandatory flamabilidad CC failure mode to OP 10 (required for
 *          every VWA interior trim part per amfe.md). The original PDF omitted it.
 *
 * Usage:
 *   node scripts/fixIpPadsAmfe.mjs           # dry-run (default)
 *   node scripts/fixIpPadsAmfe.mjs --apply   # write to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ─── Config ─────────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--apply');
const ENV_PATH = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';
const DOC_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';

// ─── Supabase connection ────────────────────────────────────────────────────
const envText = readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ─── AIAG-VDA AP Lookup Table ───────────────────────────────────────────────
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

// ─── Report ─────────────────────────────────────────────────────────────────
const report = { fix1: false, fix2: false, fix3: false };

console.log('='.repeat(65));
console.log('  FIX IP PADs AMFE — TRIM ASM-UPR WRAPPING');
console.log(`  Document ID: ${DOC_ID}`);
console.log(`  Mode: ${DRY_RUN ? 'DRY-RUN (no changes written)' : 'APPLY (writing to Supabase)'}`);
console.log('='.repeat(65));

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: Fetch the document
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n--- Step 1: Fetching AMFE document ---\n');

const { data: doc, error: fetchErr } = await sb
  .from('amfe_documents')
  .select('id, project_name, subject, data')
  .eq('id', DOC_ID)
  .single();

if (fetchErr) {
  console.error('FATAL: Cannot fetch document:', fetchErr.message);
  process.exit(1);
}

console.log(`  Found: "${doc.project_name}" / "${doc.subject}"`);
console.log(`  typeof data: ${typeof doc.data}`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: Parse data
// ═══════════════════════════════════════════════════════════════════════════
let amfeData = doc.data;
if (typeof amfeData === 'string') {
  console.log('  Data is string — parsing JSON...');
  amfeData = JSON.parse(amfeData);
}

if (!amfeData || !amfeData.operations || !Array.isArray(amfeData.operations)) {
  console.error('FATAL: Data has no operations array');
  process.exit(1);
}

console.log(`  Operations count: ${amfeData.operations.length}`);

// ═══════════════════════════════════════════════════════════════════════════
// FIX 1: Rename OP 120 from "INSPECCION FINAL" to "CONTROL FINAL DE CALIDAD"
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n--- Fix 1: Rename OP 120 ---\n');

const op120 = amfeData.operations.find(op => String(op.operationNumber) === '120');
if (!op120) {
  console.log('  WARNING: OP 120 not found.');
} else {
  const oldName = op120.operationName;
  if (oldName === 'CONTROL FINAL DE CALIDAD') {
    console.log('  OP 120 already has correct name. Skipping.');
  } else {
    console.log(`  Old name: "${oldName}"`);
    op120.operationName = 'CONTROL FINAL DE CALIDAD';
    console.log(`  New name: "${op120.operationName}"`);
    report.fix1 = true;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FIX 2: Fix OP 130 copy-paste error in "Falta de identificacion" cause
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n--- Fix 2: Fix OP 130 copy-paste error ---\n');

const op130 = amfeData.operations.find(op => String(op.operationNumber) === '130');
if (!op130) {
  console.log('  WARNING: OP 130 not found.');
} else {
  let fixed = false;
  for (const we of (op130.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        // Find "Falta de identificacion" failure mode
        if (/falta de identificaci/i.test(fail.description)) {
          for (const cause of (fail.causes || [])) {
            if (/falta de elementos de protecci/i.test(cause.description)) {
              console.log(`  Found bad cause in FM "${fail.description}":`);
              console.log(`    Old: "${cause.description}"`);
              cause.description = 'Error del operario';
              console.log(`    New: "${cause.description}"`);
              fixed = true;
              report.fix2 = true;
            }
          }
        }
      }
    }
  }
  if (!fixed) {
    console.log('  No copy-paste error found (may already be fixed).');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FIX 3: Add flamabilidad CC failure mode to OP 10
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n--- Fix 3: Add flamabilidad CC to OP 10 ---\n');

const op10 = amfeData.operations.find(op => String(op.operationNumber) === '10');
if (!op10) {
  console.error('  FATAL: OP 10 not found.');
  process.exit(1);
}

// Check if flamabilidad already exists
let hasFlam = false;
for (const we of (op10.workElements || [])) {
  for (const fn of (we.functions || [])) {
    for (const fail of (fn.failures || [])) {
      if (/flamabilidad|flamable|tl\s*1010/i.test(fail.description)) {
        hasFlam = true;
        console.log(`  Flamabilidad FM already exists: "${fail.description}". Skipping.`);
        break;
      }
    }
    if (hasFlam) break;
  }
  if (hasFlam) break;
}

if (!hasFlam) {
  // S=10, O=2, D=5 -> AP calculation
  // S=9-10, O=2-3, D=5-6 -> M
  const s = 10, o = 2, d = 5;
  const ap = calcAP(s, o, d);
  console.log(`  AP calculation: S=${s}, O=${o}, D=${d} -> AP=${ap}`);

  const flamFailure = {
    id: randomUUID(),
    description: 'Material no cumple requisito de flamabilidad TL 1010 VW',
    effectLocal: 'Rechazo del lote en recepcion',
    effectNextLevel: 'Riesgo de incumplimiento normativo para planta VW',
    effectEndUser: 'Riesgo de seguridad del usuario ante incendio en habitaculo',
    causes: [
      {
        id: randomUUID(),
        description: 'Proveedor no realiza ensayo de flamabilidad o certificado no incluye TL 1010',
        severity: s,
        occurrence: o,
        detection: d,
        actionPriority: ap,
        preventionControl: 'Certificado de flamabilidad del proveedor segun TL 1010 VW',
        detectionControl: 'Ensayo de flamabilidad por muestreo en laboratorio',
        specialChar: 'CC',
        characteristicNumber: '',
        filterCode: '',
        // NEVER fill optimization actions — rule amfe-actions.md
        preventionAction: '',
        detectionAction: '',
        responsible: '',
        targetDate: '',
        status: '',
        actionTaken: '',
        completionDate: '',
        severityNew: '',
        occurrenceNew: '',
        detectionNew: '',
        apNew: '',
        observations: '',
      },
    ],
  };

  // Add to OP 10's first work element's first function
  const targetWE = op10.workElements?.[0];
  if (!targetWE) {
    console.error('  FATAL: OP 10 has no work elements.');
    process.exit(1);
  }
  const targetFn = targetWE.functions?.[0];
  if (!targetFn) {
    console.error('  FATAL: OP 10 first WE has no functions.');
    process.exit(1);
  }

  targetFn.failures = targetFn.failures || [];
  targetFn.failures.push(flamFailure);
  report.fix3 = true;

  console.log(`  Added flamabilidad FM to OP 10 -> WE "${targetWE.name}" -> function[0]`);
  console.log(`    FM: "${flamFailure.description}"`);
  console.log(`    S=${s} O=${o} D=${d} AP=${ap} CC=yes`);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: Save back to Supabase
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n--- Step 3: Save to Supabase ---\n');

const anyChanges = report.fix1 || report.fix2 || report.fix3;

if (!anyChanges) {
  console.log('  No changes needed. All fixes already applied.');
} else if (DRY_RUN) {
  console.log('  DRY RUN — changes NOT written. Run with --apply to save.');
  console.log(`    Fix 1 (OP 120 rename):       ${report.fix1 ? 'WOULD APPLY' : 'already OK'}`);
  console.log(`    Fix 2 (OP 130 cause fix):     ${report.fix2 ? 'WOULD APPLY' : 'already OK'}`);
  console.log(`    Fix 3 (flamabilidad CC OP10): ${report.fix3 ? 'WOULD APPLY' : 'already OK'}`);
} else {
  // Write back — pass as OBJECT, let Supabase handle serialization (rule: database.md)
  const { error: updateErr } = await sb
    .from('amfe_documents')
    .update({ data: amfeData })
    .eq('id', DOC_ID);

  if (updateErr) {
    console.error('  UPDATE FAILED:', updateErr.message);
    process.exit(1);
  }
  console.log('  Update successful.');
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: Verify after update
// ═══════════════════════════════════════════════════════════════════════════
if (!DRY_RUN && anyChanges) {
  console.log('\n--- Step 4: Verification ---\n');

  const { data: verifyDoc, error: verifyErr } = await sb
    .from('amfe_documents')
    .select('id, data')
    .eq('id', DOC_ID)
    .single();

  if (verifyErr) {
    console.error('  Verification fetch failed:', verifyErr.message);
    process.exit(1);
  }

  let verifyData = verifyDoc.data;
  if (typeof verifyData === 'string') {
    console.log('  WARNING: data came back as string, parsing...');
    verifyData = JSON.parse(verifyData);
  }

  const isObject = typeof verifyData === 'object' && verifyData !== null;
  console.log(`  typeof data: ${typeof verifyDoc.data} ${isObject ? 'OK' : 'FAIL'}`);

  // Check OP 120 name
  const vOp120 = verifyData.operations?.find(op => String(op.operationNumber) === '120');
  const op120ok = vOp120?.operationName === 'CONTROL FINAL DE CALIDAD';
  console.log(`  OP 120 name: "${vOp120?.operationName}" ${op120ok ? 'OK' : 'FAIL'}`);

  // Check OP 130 cause
  let op130causeOk = false;
  const vOp130 = verifyData.operations?.find(op => String(op.operationNumber) === '130');
  if (vOp130) {
    for (const we of (vOp130.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
          if (/falta de identificaci/i.test(fail.description)) {
            for (const cause of (fail.causes || [])) {
              if (cause.description === 'Error del operario') {
                op130causeOk = true;
              }
            }
          }
        }
      }
    }
  }
  console.log(`  OP 130 "Falta de identificacion" cause: ${op130causeOk ? 'OK (Error del operario)' : 'FAIL'}`);

  // Check OP 10 flamabilidad
  let flamOk = false;
  const vOp10 = verifyData.operations?.find(op => String(op.operationNumber) === '10');
  if (vOp10) {
    for (const we of (vOp10.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
          if (/flamabilidad.*TL 1010/i.test(fail.description)) {
            flamOk = true;
            // Verify CC is set
            const hasCc = fail.causes?.some(c => c.specialChar === 'CC');
            console.log(`  OP 10 flamabilidad FM: found ${hasCc ? 'with CC' : 'WITHOUT CC (!!)'}`);
          }
        }
      }
    }
  }
  console.log(`  OP 10 flamabilidad: ${flamOk ? 'OK' : 'NOT FOUND (!!)'}`);

  // Stats
  let totalFMs = 0, totalCauses = 0, ccCount = 0;
  for (const op of verifyData.operations) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fm of (fn.failures || [])) {
          totalFMs++;
          for (const c of (fm.causes || [])) {
            totalCauses++;
            if (c.specialChar === 'CC') ccCount++;
          }
        }
      }
    }
  }
  console.log(`\n  Total failure modes: ${totalFMs}`);
  console.log(`  Total causes: ${totalCauses}`);
  console.log(`  CC count: ${ccCount} (${(ccCount / totalCauses * 100).toFixed(1)}%)`);
}

// ═══════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(65));
console.log('  SUMMARY');
console.log('='.repeat(65));
console.log(`  Fix 1 (OP 120 rename):       ${report.fix1 ? 'APPLIED' : 'no change needed'}`);
console.log(`  Fix 2 (OP 130 cause fix):     ${report.fix2 ? 'APPLIED' : 'no change needed'}`);
console.log(`  Fix 3 (flamabilidad CC OP10): ${report.fix3 ? 'APPLIED' : 'no change needed'}`);
console.log(`  Mode:                         ${DRY_RUN ? 'DRY-RUN' : 'APPLIED'}`);
console.log('='.repeat(65) + '\n');

process.exit(0);
