/**
 * Fix S/D del Master Inyeccion (family 15, AMFE-MAESTRO-INY-001).
 *
 * Cambios aplicados:
 *   1. Severidad: 4 failures con FE de "bloqueo/interferencia ensamble" → S=6 a S=7
 *   2. Deteccion: 18 causas con DC "100% visual + patron" en defectos visuales obvios → D=6/7 a D=4
 *   3. AP recalculado automaticamente con calculateAP() oficial
 *   4. Causas que pasan a AP=H sin accion → placeholder "Pendiente definicion equipo APQP"
 *
 * NO toca: PC/DC, descripciones, CC/SC, opNumber, FE/FM/FC, acciones existentes.
 *
 * Uso:
 *   node scripts/_fixMasterInyeccionSOD.mjs           # dry-run
 *   node scripts/_fixMasterInyeccionSOD.mjs --apply   # ejecuta
 */
import { connectSupabase, readAmfe, saveAmfe, calculateAP } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const MASTER_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';

// ── Plan: identificar y modificar in-place ──────────────────────────────
const ENSAMBLE_KW = /bloqueo|interferencia|montable|ensamble|encastre|gap.*flush|fija/i;
const VISUAL_OBVIOUS_FM = /rebab|quemadur|raya|hundimien|venteo.*tapad|color.*conform|incompleta|deformad/i;
const VISUAL_DC_KW = /inspeccion visual.*100%|100%.*visual|muestra patron|muestra maestra/i;
const APQP_PLACEHOLDER = 'Pendiente definicion equipo APQP';

const { doc: before, amfe_number } = await readAmfe(sb, MASTER_ID);

// Deep clone para comparar before/after
const after = JSON.parse(JSON.stringify(before));
const changes = [];

for (const op of after.operations || []) {
  for (const we of op.workElements || []) {
    for (const fn of we.functions || []) {
      for (const f of fn.failures || []) {
        const fe = [f.effectLocal, f.effectNextLevel, f.effectEndUser].filter(Boolean).join(' / ');
        const opNum = op.opNumber || op.operationNumber;
        const fmDesc = f.description || '';
        const oldS = Number(f.severity);

        // Cambio S
        let newS = oldS;
        if (ENSAMBLE_KW.test(fe) && oldS >= 5 && oldS < 7) {
          newS = 7;
          f.severity = newS;
          changes.push({ kind: 'S', opNum, fmDesc, oldVal: oldS, newVal: newS });
        }

        // Causas: cambio D + recalc AP
        for (const c of f.causes || []) {
          const oldD = Number(c.detection);
          let newD = oldD;
          if (VISUAL_OBVIOUS_FM.test(fmDesc) && VISUAL_DC_KW.test(c.detectionControl || '') && oldD >= 6) {
            newD = 4;
            c.detection = newD;
            changes.push({ kind: 'D', opNum, fmDesc, causeDesc: c.cause || c.description, oldVal: oldD, newVal: newD });
          }

          // Recalcular AP si cambio S o D
          if (newS !== oldS || newD !== oldD) {
            const oldAP = c.ap || c.actionPriority || '';
            const newAP = calculateAP(newS, Number(c.occurrence) || 1, newD);
            if (newAP !== oldAP) {
              c.ap = newAP;
              c.actionPriority = newAP;
              changes.push({ kind: 'AP', opNum, fmDesc, causeDesc: c.cause || c.description, oldVal: oldAP, newVal: newAP });

              // Si AP cambio a H y no tiene accion, placeholder
              if (newAP === 'H') {
                if (!c.preventionAction || c.preventionAction.trim() === '') {
                  c.preventionAction = APQP_PLACEHOLDER;
                  changes.push({ kind: 'preventionAction', opNum, fmDesc, causeDesc: c.cause || c.description, oldVal: '', newVal: APQP_PLACEHOLDER });
                }
                if (!c.detectionAction || c.detectionAction.trim() === '') {
                  c.detectionAction = APQP_PLACEHOLDER;
                  changes.push({ kind: 'detectionAction', opNum, fmDesc, causeDesc: c.cause || c.description, oldVal: '', newVal: APQP_PLACEHOLDER });
                }
              }
            }
          }
        }
      }
    }
  }
}

// ── Resumen del plan ────────────────────────────────────────────────────
console.log(`\n=== PLAN: Master ${amfe_number} (${MASTER_ID}) ===`);
const byKind = {};
for (const c of changes) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
console.log(`Cambios totales: ${changes.length}`);
for (const [k, n] of Object.entries(byKind)) console.log(`  ${k}: ${n}`);

console.log(`\n--- Detalle ---`);
for (const c of changes) {
  if (c.kind === 'S') {
    console.log(`  S OP${c.opNum} "${c.fmDesc}": ${c.oldVal} → ${c.newVal}`);
  } else if (c.kind === 'D') {
    console.log(`  D OP${c.opNum} "${c.fmDesc}" / "${(c.causeDesc||'').slice(0,40)}": ${c.oldVal} → ${c.newVal}`);
  } else if (c.kind === 'AP') {
    console.log(`  AP OP${c.opNum} "${c.fmDesc}" / "${(c.causeDesc||'').slice(0,40)}": ${c.oldVal} → ${c.newVal}`);
  } else {
    console.log(`  ${c.kind} OP${c.opNum} "${c.fmDesc}" / "${(c.causeDesc||'').slice(0,40)}": "${c.oldVal}" → "${c.newVal}"`);
  }
}

// ── Validador + commit ──────────────────────────────────────────────────
const plan = [{
  id: MASTER_ID,
  amfeNumber: amfe_number,
  productName: 'Master Inyeccion (family 15)',
  before,
  after,
}];

await runWithValidation(plan, apply, async () => {
  for (const change of plan) {
    await saveAmfe(sb, change.id, change.after);
    console.log(`  ✓ saved ${change.amfeNumber}`);
  }
});

finish(apply);
