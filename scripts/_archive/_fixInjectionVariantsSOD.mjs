/**
 * Propaga las correcciones S/D del Master Inyeccion (family 15) a las
 * 4 variantes con inyeccion plastica:
 *   - AMFE-INS-PAT (Insert Patagonia, OP 70)
 *   - VWA-PAT-IPPADS-001 (IP PAD, OP 20)
 *   - AMFE-ARM-PAT (Armrest carrier, OP 60)
 *   - AMFE-TR-PAT (Top Roll, OP 20)
 *
 * Solo aplica cambios a operaciones cuyo nombre matchea /INYECCION|INYECTAR/i
 * y NO toca PU ni Headrest (decision por regla injection.md).
 *
 * Mismas reglas que _fixMasterInyeccionSOD.mjs:
 *   1. S=6 → S=7 si FE menciona ensamble/bloqueo/interferencia
 *   2. D=6/7 → D=4 si FM visualmente obvio + DC visual 100% + patron
 *   3. AP recalculado con calculateAP()
 *
 * Uso:
 *   node scripts/_fixInjectionVariantsSOD.mjs           # dry-run
 *   node scripts/_fixInjectionVariantsSOD.mjs --apply
 */
import { connectSupabase, readAmfe, saveAmfe, calculateAP } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const TARGETS = [
  { id: '7cfe2db7-d6e1-4858-b4ad-d8a7afad0bca', name: 'AMFE-INS-PAT' },     // Insert
  { id: 'c9b93b84-21bb-43c3-9b1a-09f0b3c01d80', name: 'VWA-PAT-IPPADS-001' },// IP PAD
  { id: '5268704d-2f2c-4c2b-aaef-13e8c2c34a5d', name: 'AMFE-ARM-PAT' },     // Armrest
  { id: '78eaa89b-78b8-46a9-8dd9-de8f0c63dffd', name: 'AMFE-TR-PAT' },      // Top Roll
];

const ENSAMBLE_KW = /bloqueo|interferencia|montable|ensamble|encastre|gap.*flush|fija/i;
const VISUAL_OBVIOUS_FM = /rebab|rebarba|quemadur|raya|hundimien|venteo.*tapad|color.*conform|incompleta|deformad/i;
const VISUAL_DC_KW = /inspeccion visual.*100%|100%.*visual|muestra patron|muestra maestra|panel/i;
const INJECTION_OP = /INYECCION|INYECTAR/i;
const APQP_PLACEHOLDER = 'Pendiente definicion equipo APQP';

const plan = [];

// Buscar IDs reales si difieren (el _tmp_find scrape me dio prefijos cortos)
const { data: allDocs } = await sb.from('amfe_documents').select('id, amfe_number');
const idMap = new Map(allDocs.map(d => [d.amfe_number, d.id]));

const resolvedTargets = TARGETS.map(t => ({
  id: idMap.get(t.name) || t.id,
  name: t.name,
}));
console.log('Targets resueltos:', resolvedTargets.map(t => `${t.name}=${t.id.slice(0,8)}`).join(', '));

for (const target of resolvedTargets) {
  const { doc: before, amfe_number } = await readAmfe(sb, target.id);
  const after = JSON.parse(JSON.stringify(before));
  const changes = [];

  for (const op of after.operations || []) {
    const opName = op.name || op.operationName || '';
    if (!INJECTION_OP.test(opName)) continue;  // SOLO ops de inyeccion
    const opNum = op.opNumber || op.operationNumber;

    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const f of fn.failures || []) {
          const fe = [f.effectLocal, f.effectNextLevel, f.effectEndUser].filter(Boolean).join(' / ');
          const fmDesc = f.description || '';
          const oldS = Number(f.severity);
          let newS = oldS;

          if (ENSAMBLE_KW.test(fe) && oldS >= 5 && oldS < 7) {
            newS = 7;
            f.severity = newS;
            changes.push({ kind: 'S', opNum, fmDesc, oldVal: oldS, newVal: newS });
          }

          for (const c of f.causes || []) {
            const oldD = Number(c.detection);
            let newD = oldD;
            if (VISUAL_OBVIOUS_FM.test(fmDesc) && VISUAL_DC_KW.test(c.detectionControl || '') && oldD >= 6) {
              newD = 4;
              c.detection = newD;
              changes.push({ kind: 'D', opNum, fmDesc, causeDesc: c.cause || c.description, oldVal: oldD, newVal: newD });
            }

            if (newS !== oldS || newD !== oldD) {
              const oldAP = c.ap || c.actionPriority || '';
              const newAP = calculateAP(newS, Number(c.occurrence) || 1, newD);
              if (newAP !== oldAP) {
                c.ap = newAP;
                c.actionPriority = newAP;
                changes.push({ kind: 'AP', opNum, fmDesc, causeDesc: c.cause || c.description, oldVal: oldAP, newVal: newAP });

                if (newAP === 'H') {
                  if (!c.preventionAction || c.preventionAction.trim() === '') {
                    c.preventionAction = APQP_PLACEHOLDER;
                    changes.push({ kind: 'preventionAction', opNum, fmDesc, oldVal: '', newVal: APQP_PLACEHOLDER });
                  }
                  if (!c.detectionAction || c.detectionAction.trim() === '') {
                    c.detectionAction = APQP_PLACEHOLDER;
                    changes.push({ kind: 'detectionAction', opNum, fmDesc, oldVal: '', newVal: APQP_PLACEHOLDER });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  console.log(`\n━━━ ${amfe_number} (${target.id.slice(0,8)}) ━━━`);
  const byKind = {};
  for (const ch of changes) byKind[ch.kind] = (byKind[ch.kind] || 0) + 1;
  console.log(`  Cambios: ${changes.length} (${Object.entries(byKind).map(([k,v])=>`${k}:${v}`).join(', ')})`);
  for (const ch of changes.slice(0, 8)) {
    if (ch.kind === 'S') console.log(`    S OP${ch.opNum} "${ch.fmDesc}": ${ch.oldVal} → ${ch.newVal}`);
    else if (ch.kind === 'D') console.log(`    D OP${ch.opNum} "${ch.fmDesc}" / "${(ch.causeDesc||'').slice(0,30)}": ${ch.oldVal} → ${ch.newVal}`);
    else if (ch.kind === 'AP') console.log(`    AP OP${ch.opNum} "${ch.fmDesc}" / "${(ch.causeDesc||'').slice(0,30)}": ${ch.oldVal} → ${ch.newVal}`);
  }
  if (changes.length > 8) console.log(`    ... +${changes.length - 8} mas`);

  if (changes.length > 0) {
    plan.push({ id: target.id, amfeNumber: amfe_number, productName: target.name, before, after });
  }
}

console.log(`\n=== TOTAL: ${plan.length} variantes a actualizar ===`);

await runWithValidation(plan, apply, async () => {
  for (const change of plan) {
    await saveAmfe(sb, change.id, change.after);
    console.log(`  ✓ saved ${change.amfeNumber}`);
  }
});

finish(apply);
