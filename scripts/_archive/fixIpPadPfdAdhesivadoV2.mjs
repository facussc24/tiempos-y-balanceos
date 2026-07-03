/**
 * fixIpPadPfdAdhesivadoV2.mjs
 *
 * Corrige el flujo del adhesivado en el PFD IP PAD aplicando el patron
 * estandar Barack (ver modules/pfd/pfdToFlowData.ts:100-130 + Telas Planas
 * como referencia de patron validado).
 *
 * ANTES (mal estructurado por V1):
 *   OP 70 ADHESIVADO
 *   OP 80 CONTROL DE CALIDAD (inspection)
 *   PRODUCTO CONFORME? (decision con rejectDisposition=rework + scrapDesc)
 *   OP 81 RETRABAJO DE ADHESIVADO  <- sin isRework flag, sin returnStep
 *   SCRAP DE PRODUCTO NO CONFORME  <- step separado (INCORRECTO)
 *
 * DESPUES (patron correcto):
 *   OP 70 ADHESIVADO
 *   OP 80 CONTROL DE CALIDAD (inspection)
 *   PRODUCTO CONFORME?
 *       SI (labelDown) -> sigue a OP 90 ALINEACION
 *       NO (rework)    -> OP 81 RETRABAJO
 *   OP 81 RETRABAJO DE ADHESIVADO
 *       isRework: true
 *       reworkReturnStep: 'OP 80'               <- flecha de retorno al control
 *       rejectDisposition: 'scrap'
 *       scrapDescription: 'Irrecuperable...'    <- triangle lateral automatico
 *
 * Renderer dibujara:
 *   - 1 rombo PRODUCTO CONFORME con SI abajo + NO lateral a OP 81
 *   - OP 81 con triangle SCRAP lateral (generado por el renderer, no por step)
 *   - OP 81 con flecha de retorno curvada hacia OP 80
 *
 * Dry-run por default. --apply para ejecutar.
 */

import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData, readPfd, savePfd } from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();
const PFD_ID = 'pfd-ippads-trim-asm-upr-wrapping';

const sb = await connectSupabase();
const { doc } = await readPfd(sb, PFD_ID);

// ── 1. Encontrar los 4 steps afectados ──
const qcIdx = doc.steps.findIndex(s => s.stepNumber === 'OP 80' && s.description === 'CONTROL DE CALIDAD');
const decisionIdx = doc.steps.findIndex(s => s.description === 'PRODUCTO CONFORME?' && s.department === 'Calidad');
const retrabajoIdx = doc.steps.findIndex(s => s.stepNumber === 'OP 81');
const scrapIdx = doc.steps.findIndex(s => s.description === 'SCRAP DE PRODUCTO NO CONFORME');

if (qcIdx < 0 || decisionIdx < 0 || retrabajoIdx < 0 || scrapIdx < 0) {
  console.error('Steps requeridos no encontrados:', { qcIdx, decisionIdx, retrabajoIdx, scrapIdx });
  process.exit(1);
}

console.log(`QC idx=${qcIdx}, decision idx=${decisionIdx}, retrabajo idx=${retrabajoIdx}, scrap idx=${scrapIdx}`);

// ── 2. FIX decision PRODUCTO CONFORME? — rework limpio, sin scrapDesc (ese va en OP 81) ──
const decision = doc.steps[decisionIdx];
const oldDecision = { rejectDisposition: decision.rejectDisposition, reworkReturnStep: decision.reworkReturnStep, scrapDesc: decision.scrapDescription };
decision.rejectDisposition = 'rework';
decision.reworkReturnStep = 'OP 81';
decision.scrapDescription = ''; // el scrap se dibuja desde OP 81, no desde la decision
decision.branchId = '';
decision.branchLabel = '';
logChange(apply, `UPDATE decision PRODUCTO CONFORME? (adhesivado)`, {
  'from': JSON.stringify(oldDecision),
  'to rejectDisposition': 'rework',
  'to reworkReturnStep': 'OP 81',
  'to scrapDescription': '(vaciado)',
});

// ── 3. FIX OP 81 RETRABAJO — agregar isRework, returnStep, rejectDisposition scrap ──
const retrabajo = doc.steps[retrabajoIdx];
const oldRetrabajo = { isRework: retrabajo.isRework, reworkReturnStep: retrabajo.reworkReturnStep, rejectDisposition: retrabajo.rejectDisposition };
retrabajo.isRework = true;
retrabajo.reworkReturnStep = 'OP 80';
retrabajo.rejectDisposition = 'scrap';
retrabajo.scrapDescription = 'Retrabajo irrecuperable (despegue total, contaminacion sustrato, deformacion) -> Scrap segun P-13';
retrabajo.branchId = '';
retrabajo.branchLabel = '';
retrabajo.reference = retrabajo.reference || 'Procedimiento P-13 Producto No Conforme';
retrabajo.notes = 'Retrabajo offline de piezas con adhesivado NOK recuperable. Vuelve a OP 80 para re-inspeccion. Si tras retrabajo sigue NOK -> Scrap (rama lateral).';
logChange(apply, `UPDATE OP 81 RETRABAJO DE ADHESIVADO`, {
  'from': JSON.stringify(oldRetrabajo),
  'to isRework': true,
  'to reworkReturnStep': 'OP 80',
  'to rejectDisposition': 'scrap',
  'to scrapDescription': retrabajo.scrapDescription.substring(0, 60) + '...',
});

// ── 4. ELIMINAR step SCRAP standalone (patron incorrecto) ──
const scrapStep = doc.steps[scrapIdx];
logChange(apply, `DELETE step SCRAP DE PRODUCTO NO CONFORME (idx ${scrapIdx})`, {
  reason: 'Patron incorrecto - el scrap se dibuja como rama lateral automatica desde rejectDisposition=scrap en OP 81',
  removed_step: scrapStep.description,
});
doc.steps.splice(scrapIdx, 1);

// ── 5. Save ──
console.log(`\nPFD resultado: ${doc.steps.length} steps (antes 32, quedan 31)`);

if (apply) {
  await savePfd(sb, PFD_ID, doc, {
    extraFields: { step_count: doc.steps.length, updated_at: new Date().toISOString() },
  });
  // Verify
  const { data: verify } = await sb.from('pfd_documents').select('data, step_count').eq('id', PFD_ID).single();
  const dv = parseData(verify.data);
  console.log('\n=== VERIFICACION POST (tramo adhesivado) ===');
  const start = dv.steps.findIndex(s => s.description === 'ADHESIVADO');
  for (let i = start; i <= start + 6 && i < dv.steps.length; i++) {
    const s = dv.steps[i];
    console.log(`  ${i} | ${(s.stepNumber||'').padEnd(8)} | ${s.stepType.padEnd(12)} | ${s.description}`);
    const flags = [];
    if (s.isRework) flags.push('isRework=true');
    if (s.reworkReturnStep) flags.push('returnTo=' + s.reworkReturnStep);
    if (s.rejectDisposition !== 'none') flags.push('reject=' + s.rejectDisposition);
    if (s.scrapDescription) flags.push('scrap="' + s.scrapDescription.substring(0, 40) + '..."');
    if (flags.length) console.log(`       ${flags.join(' | ')}`);
  }
  console.log(`step_count: ${verify.step_count}`);
}

finish(apply);
