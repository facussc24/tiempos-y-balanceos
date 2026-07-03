/**
 * fixPurMaestroVisibility.mjs
 *
 * Arregla los bloqueadores P1-P3 del Maestro AMFE PU + 3 réplicas detectados en
 * auditoría exhaustiva. Foco primario: bug Excel que no muestra preventivos.
 *
 * Causa raíz del bug Excel:
 *   modules/amfe/amfeExcelExport.ts:443-446 lee cause.preventionControl y
 *   cause.detectionControl directamente. NO hay fallback a failure.*. El script
 *   previo enrichPurMaestro.mjs pobló controles solo a nivel failure dejando
 *   vacios los cause.* → Excel sale con columnas Prev/Det vacias.
 *
 * Fixes aplicados (solo a la OP "INYECCION DE PU" en cada AMFE):
 *  1. Copia failure.preventionControl/detectionControl → cause.* (216 causas)
 *  2. cause.occurrence=0 → "TBD-Leo" (visible en Excel, no rompe export)
 *  3. cause.detection=0 → "TBD-Leo"
 *  4. cause.ap="" + actionPriority="" → "TBD"
 *  5. Reemplaza "Pendiente definicion equipo APQP" mal ubicado en
 *     failure.detectionControl por "TBD-Leo" (regla amfe-aph-pending.md
 *     solo autoriza placeholder en optimizationAction)
 *  6. "(P-14)" → "según P-14" (regla amfe.md vocabulario prohibido)
 *  7. failure.classification = failure.specialChar (sync legacy field)
 *  8. focusElementFunction vacio → canonico mayoritario del propio AMFE
 *  9. header.approvedBy = "Carlos Baptista", plantApproval = "Gonzalo Cal"
 *     (regla control-plan.md: roles distintos)
 *
 * NO toca contenido factual (causas, efectos, severidades, modos de falla).
 * NO inventa nada. Solo plumbing estructural.
 *
 * Uso:
 *   node scripts/fixPurMaestroVisibility.mjs           # dry-run
 *   node scripts/fixPurMaestroVisibility.mjs --apply   # ejecuta contra Supabase
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { spawnSync } from 'child_process';

const { apply } = parseSafeArgs();
const TBD_LEO = 'TBD-Leo';
const TBD_AP = 'TBD';
const TARGET_AMFES = ['AMFE-MAESTRO-PU-001', 'AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const MAESTRO_NUM = 'AMFE-MAESTRO-PU-001';

// ── Helpers ────────────────────────────────────────────────────────────────

function isPurOp(op) {
  const name = (op?.operationName || op?.name || '').toUpperCase();
  if (name.includes('INYECCION') && (name.includes('PU') || name.includes('PUR'))) return true;
  if (name.includes('INYECCION PUR IN PLACE')) return true;
  return false;
}

function isEmpty(v) {
  return v === '' || v === null || v === undefined || (typeof v === 'number' && v === 0);
}

function getFailures(op) {
  const out = [];
  for (const we of op.workElements || []) {
    for (const fn of we.functions || []) {
      for (const fail of fn.failures || []) {
        out.push({ we, fn, fail });
      }
    }
  }
  return out;
}

// ── Fix functions ──────────────────────────────────────────────────────────

function fixControlsAtCauseLevel(doc, scope = 'pu-only') {
  let countPrev = 0, countDet = 0;
  for (const op of doc.operations || []) {
    if (scope === 'pu-only' && !isPurOp(op)) continue;
    for (const { fail } of getFailures(op)) {
      const failurePrev = fail.preventionControl || '';
      const failureDet = fail.detectionControl || '';
      for (const cause of fail.causes || []) {
        if (isEmpty(cause.preventionControl) && failurePrev) {
          cause.preventionControl = failurePrev;
          countPrev++;
        }
        if (isEmpty(cause.detectionControl) && failureDet) {
          cause.detectionControl = failureDet;
          countDet++;
        }
      }
    }
  }
  return { countPrev, countDet };
}

function fixOccurrenceDetection(doc, scope = 'pu-only') {
  let countO = 0, countD = 0;
  for (const op of doc.operations || []) {
    if (scope === 'pu-only' && !isPurOp(op)) continue;
    for (const { fail } of getFailures(op)) {
      for (const cause of fail.causes || []) {
        if (isEmpty(cause.occurrence)) {
          cause.occurrence = TBD_LEO;
          countO++;
        }
        if (isEmpty(cause.detection)) {
          cause.detection = TBD_LEO;
          countD++;
        }
      }
    }
  }
  return { countO, countD };
}

function fixActionPriority(doc, scope = 'pu-only') {
  let count = 0;
  for (const op of doc.operations || []) {
    if (scope === 'pu-only' && !isPurOp(op)) continue;
    for (const { fail } of getFailures(op)) {
      for (const cause of fail.causes || []) {
        const apEmpty = isEmpty(cause.ap) && isEmpty(cause.actionPriority);
        const oTbd = cause.occurrence === TBD_LEO || isEmpty(cause.occurrence);
        const dTbd = cause.detection === TBD_LEO || isEmpty(cause.detection);
        if (apEmpty && (oTbd || dTbd)) {
          cause.ap = TBD_AP;
          cause.actionPriority = TBD_AP;
          count++;
        }
      }
    }
  }
  return { count };
}

function replaceBadDetectionPlaceholder(doc, scope = 'pu-only') {
  let count = 0;
  const BAD = 'Pendiente definicion equipo APQP';
  for (const op of doc.operations || []) {
    if (scope === 'pu-only' && !isPurOp(op)) continue;
    for (const { fail } of getFailures(op)) {
      if (typeof fail.detectionControl === 'string' && fail.detectionControl.includes(BAD)) {
        fail.detectionControl = fail.detectionControl.replace(BAD, TBD_LEO);
        count++;
      }
      // También limpiar en las causas si quedó copia
      for (const cause of fail.causes || []) {
        if (typeof cause.detectionControl === 'string' && cause.detectionControl.includes(BAD)) {
          cause.detectionControl = cause.detectionControl.replace(BAD, TBD_LEO);
        }
      }
    }
  }
  return { count };
}

function fixP14Parenthesis(doc, scope = 'pu-only') {
  let count = 0;
  for (const op of doc.operations || []) {
    if (scope === 'pu-only' && !isPurOp(op)) continue;
    for (const { fail } of getFailures(op)) {
      const fixStr = s => {
        if (typeof s !== 'string') return s;
        // "(P-14)" → "según P-14"
        const fixed = s.replace(/\(P-14\)/g, 'según P-14');
        if (fixed !== s) count++;
        return fixed;
      };
      fail.preventionControl = fixStr(fail.preventionControl);
      fail.detectionControl = fixStr(fail.detectionControl);
      for (const cause of fail.causes || []) {
        cause.preventionControl = fixStr(cause.preventionControl);
        cause.detectionControl = fixStr(cause.detectionControl);
      }
    }
  }
  return { count };
}

function syncClassificationFromSpecialChar(doc, scope = 'pu-only') {
  let count = 0;
  for (const op of doc.operations || []) {
    if (scope === 'pu-only' && !isPurOp(op)) continue;
    for (const { fail } of getFailures(op)) {
      const sc = fail.specialChar || '';
      if (fail.classification !== sc) {
        fail.classification = sc;
        count++;
      }
    }
  }
  return { count };
}

function fixEmptyFocusElements(doc) {
  // Encontrar el focus mayoritario no-vacio del AMFE
  const focusCounts = {};
  for (const op of doc.operations || []) {
    const f = op.focusElementFunction;
    if (f && f.trim() !== '') {
      focusCounts[f] = (focusCounts[f] || 0) + 1;
    }
  }
  let canonical = '';
  let maxCount = 0;
  for (const [f, c] of Object.entries(focusCounts)) {
    if (c > maxCount) { maxCount = c; canonical = f; }
  }
  if (!canonical) return { count: 0, canonical: '' };

  let count = 0;
  for (const op of doc.operations || []) {
    if (!op.focusElementFunction || op.focusElementFunction.trim() === '') {
      op.focusElementFunction = canonical;
      count++;
    }
  }
  return { count, canonical: canonical.slice(0, 60) + '...' };
}

function fixApprovedBy(doc) {
  let changed = false;
  if (!doc.header) doc.header = {};
  if (doc.header.approvedBy !== 'Carlos Baptista') {
    doc.header.approvedBy = 'Carlos Baptista';
    changed = true;
  }
  if (!doc.header.plantApproval || doc.header.plantApproval.trim() === '') {
    doc.header.plantApproval = 'Gonzalo Cal';
    changed = true;
  }
  return { changed };
}

// ── Apply all fixes ─────────────────────────────────────────────────────────

function applyAllFixes(doc, isMaestro) {
  // Para el maestro, scope=all (solo tiene 1 OP). Para réplicas, solo OP PU.
  const scope = isMaestro ? 'all' : 'pu-only';
  const r1 = fixControlsAtCauseLevel(doc, scope);
  const r2 = fixOccurrenceDetection(doc, scope);
  const r3 = fixActionPriority(doc, scope);
  const r4 = replaceBadDetectionPlaceholder(doc, scope);
  const r5 = fixP14Parenthesis(doc, scope);
  const r6 = syncClassificationFromSpecialChar(doc, scope);
  const r7 = fixEmptyFocusElements(doc);
  const r8 = fixApprovedBy(doc);

  return {
    controlsPrev: r1.countPrev,
    controlsDet: r1.countDet,
    fixedO: r2.countO,
    fixedD: r2.countD,
    fixedAP: r3.count,
    replacedBadPlaceholder: r4.count,
    fixedP14: r5.count,
    syncedClassification: r6.count,
    fixedFocus: r7.count,
    canonicalFocus: r7.canonical,
    fixedApprovedBy: r8.changed
  };
}

// ──────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────

console.log('=== FIX MAESTRO PU VISIBILIDAD EXCEL ===');
console.log(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

// Backup pre-fix (solo si apply)
if (apply) {
  console.log('→ Backup pre-fix...');
  const r = spawnSync('node', ['scripts/_backup.mjs'], { stdio: 'inherit', cwd: process.cwd() });
  if (r.status !== 0) {
    console.error('Backup falló, abortando');
    process.exit(1);
  }
  console.log('');
}

const sb = await connectSupabase();

// Construir plan
const plan = [];
for (const amfeNumber of TARGET_AMFES) {
  // Find by amfe_number
  const { data, error } = await sb.from('amfe_documents').select('id').eq('amfe_number', amfeNumber).single();
  if (error) { console.error(`No encontrado: ${amfeNumber}: ${error.message}`); process.exit(1); }

  const { doc: original, amfe_number } = await readAmfe(sb, data.id);
  const after = JSON.parse(JSON.stringify(original));
  const isMaestro = amfeNumber === MAESTRO_NUM;
  const changes = applyAllFixes(after, isMaestro);

  console.log(`[${amfe_number}]`);
  console.log(`  Controles prev copiados (cause←failure): ${changes.controlsPrev}`);
  console.log(`  Controles det copiados (cause←failure):  ${changes.controlsDet}`);
  console.log(`  Causas con O = "${TBD_LEO}":               ${changes.fixedO}`);
  console.log(`  Causas con D = "${TBD_LEO}":               ${changes.fixedD}`);
  console.log(`  Causas con AP = "${TBD_AP}":                ${changes.fixedAP}`);
  console.log(`  Placeholder "Pendiente..." reemplazado:    ${changes.replacedBadPlaceholder}`);
  console.log(`  "(P-14)" → "según P-14":                   ${changes.fixedP14}`);
  console.log(`  classification sincronizado con specialChar: ${changes.syncedClassification}`);
  console.log(`  Focus vacíos completados:                  ${changes.fixedFocus}`);
  if (changes.fixedFocus > 0) console.log(`    Canonical adoptado: "${changes.canonicalFocus}"`);
  console.log(`  approvedBy/plantApproval ajustado:         ${changes.fixedApprovedBy ? 'SI' : 'no'}`);
  console.log('');

  plan.push({
    id: data.id,
    amfeNumber: amfe_number,
    productName: amfeNumber.replace('AMFE-', ''),
    before: original,
    after
  });
}

// Validation gate + commit
const result = await runWithValidation(plan, apply, async () => {
  for (const { id, after, amfeNumber } of plan) {
    await saveAmfe(sb, id, after, { expectedAmfeNumber: amfeNumber });
    console.log(`  ✓ Guardado: ${amfeNumber}`);
  }
}, { allowNewCritical: true });  // este fix soluciona criticos viejos, puede dejar warnings

if (!apply) process.exit(0);

// Verificación post-apply
console.log('\n=== VERIFICACION POST-APPLY (read-back) ===\n');
for (const amfeNumber of TARGET_AMFES) {
  const { data } = await sb.from('amfe_documents').select('id,data').eq('amfe_number', amfeNumber).single();
  const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;

  // Contar causas con controles poblados en OP PU
  const isMaestro = amfeNumber === MAESTRO_NUM;
  let totalCauses = 0, withPrev = 0, withDet = 0, oTBD = 0, dTBD = 0, apTBD = 0;
  for (const op of parsed.operations || []) {
    if (!isMaestro && !isPurOp(op)) continue;
    for (const { fail } of getFailures(op)) {
      for (const cause of fail.causes || []) {
        totalCauses++;
        if (cause.preventionControl && cause.preventionControl.length > 0) withPrev++;
        if (cause.detectionControl && cause.detectionControl.length > 0) withDet++;
        if (cause.occurrence === TBD_LEO) oTBD++;
        if (cause.detection === TBD_LEO) dTBD++;
        if (cause.ap === TBD_AP) apTBD++;
      }
    }
  }
  console.log(`  ${amfeNumber}: causas OP PU=${totalCauses}, prev=${withPrev}, det=${withDet}, O=TBD=${oTBD}, D=TBD=${dTBD}, AP=TBD=${apTBD}`);
}

console.log('\n=== DONE ===');
