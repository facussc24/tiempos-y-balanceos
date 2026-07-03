/**
 * fixIpPadPfdAdhesivadoRetrabajo.mjs
 *
 * Correcciones al PFD IP PAD post-desdoble de costura:
 *
 * 1. Asigna stepNumber "OP 80" al step CONTROL DE CALIDAD (estaba sin num).
 * 2. Inserta OP 81 RETRABAJO DE ADHESIVADO tras la decision
 *    "PRODUCTO CONFORME?" (rama NOK recuperable).
 * 3. Inserta step SCRAP terminal (rama NOK irrecuperable).
 * 4. Renumera OPs posteriores para alinear con AMFE:
 *    OP 80 ALINEACION -> OP 90
 *    OP 90 WRAPPING -> OP 100
 *    OP 100 ULTRASONIDO -> OP 110
 *    OP 110 TERMINACION -> OP 120
 *    OP 120 CONTROL FINAL -> OP 130
 *    OP 130 EMBALAJE -> OP 140
 *
 * Dry-run por default. --apply para ejecutar.
 */

import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData, readPfd, savePfd } from './_lib/amfeIo.mjs';
import { randomUUID } from 'crypto';

const { apply } = parseSafeArgs();
const PFD_ID = 'pfd-ippads-trim-asm-upr-wrapping';

const sb = await connectSupabase();
const { doc } = await readPfd(sb, PFD_ID);

// ── 1. Encontrar step CONTROL DE CALIDAD del adhesivado (el primero, el segundo es final) ──
const qcIdx = doc.steps.findIndex(s => s.description === 'CONTROL DE CALIDAD' && s.department === 'Calidad');
if (qcIdx < 0) throw new Error('CONTROL DE CALIDAD (adhesivado) not found');

// Decision "PRODUCTO CONFORME?" inmediatamente despues
const decisionIdx = qcIdx + 1;
if (doc.steps[decisionIdx]?.description !== 'PRODUCTO CONFORME?') {
  throw new Error('Expected PRODUCTO CONFORME? at idx ' + decisionIdx);
}

// ── 2. Asignar OP 80 al QC adhesivado ──
const qcStep = doc.steps[qcIdx];
const oldQcNumber = qcStep.stepNumber;
qcStep.stepNumber = 'OP 80';
logChange(apply, `SET CONTROL DE CALIDAD adhesivado stepNumber: "${oldQcNumber}" -> "OP 80"`);

// ── 3. Ajustar decision para apuntar al retrabajo ──
const decisionStep = doc.steps[decisionIdx];
decisionStep.rejectDisposition = 'rework';
decisionStep.reworkReturnStep = 'OP 81';
decisionStep.scrapDescription = 'NO recuperable - Retrabajo OP 81; NO irrecuperable - Scrap';
logChange(apply, `UPDATE decision PRODUCTO CONFORME? (adhesivado) apunta a OP 81 + scrap`);

// ── 4. Construir steps nuevos ──
function mkStep(overrides) {
  return {
    id: randomUUID(),
    stepNumber: '',
    stepType: 'operation',
    description: '',
    machineDeviceTool: '',
    productCharacteristic: '',
    productSpecialChar: 'none',
    processCharacteristic: '',
    processSpecialChar: 'none',
    reference: '',
    department: '',
    notes: '',
    isRework: false,
    isExternalProcess: false,
    reworkReturnStep: '',
    rejectDisposition: 'none',
    scrapDescription: '',
    branchId: '',
    branchLabel: '',
    ...overrides,
  };
}

const stepRetrabajo = mkStep({
  stepNumber: 'OP 81',
  stepType: 'operation',
  description: 'RETRABAJO DE ADHESIVADO',
  machineDeviceTool: 'Pistola de adhesivado + herramientas manuales',
  productCharacteristic: 'Adhesion correcta, uniformidad',
  processCharacteristic: 'Aplicacion localizada de adhesivo, presion y tiempo de secado',
  department: 'Adhesivado',
  notes: 'Retrabajo offline de piezas con adhesivado NOK recuperable. Vuelve a OP 80 para re-inspeccion.',
  isRework: true,
  reworkReturnStep: 'OP 80',
  branchId: 'D',
  branchLabel: 'Retrabajo adhesivado',
});

const stepScrap = mkStep({
  stepNumber: '',
  stepType: 'storage',
  description: 'SCRAP DE PRODUCTO NO CONFORME',
  machineDeviceTool: '',
  reference: 'Procedimiento P-13 Producto No Conforme',
  department: 'Calidad',
  notes: 'Piezas con adhesivado irrecuperable se segregan en medio de scrap identificado y se procesan segun P-13.',
  rejectDisposition: 'scrap',
  scrapDescription: 'Adhesivado irrecuperable: despegue total, contaminacion del sustrato, deformacion dimensional',
  branchId: 'E',
  branchLabel: 'Scrap',
});

// Insertar despues del decision (idx decisionIdx + 1)
const insertIdx = decisionIdx + 1;
doc.steps.splice(insertIdx, 0, stepRetrabajo, stepScrap);
logChange(apply, `INSERT OP 81 RETRABAJO DE ADHESIVADO + SCRAP en idx ${insertIdx}`);

// ── 5. Renumerar OPs posteriores ──
const RENUMBER = {
  'OP 80': 'OP 90',
  'OP 90': 'OP 100',
  'OP 100': 'OP 110',
  'OP 110': 'OP 120',
  'OP 120': 'OP 130',
  'OP 130': 'OP 140',
};
// Se renumera de mayor a menor para no colisionar
const order = ['OP 130', 'OP 120', 'OP 110', 'OP 100', 'OP 90', 'OP 80'];
for (const oldNum of order) {
  const newNum = RENUMBER[oldNum];
  // Buscar step con ese num DESPUES del insertIdx para no tocar el OP 80 del QC
  const idx = doc.steps.findIndex((s, i) => i > decisionIdx + 2 && s.stepNumber === oldNum);
  if (idx >= 0) {
    doc.steps[idx].stepNumber = newNum;
    logChange(apply, `RENUMBER step idx ${idx} "${doc.steps[idx].description}": ${oldNum} -> ${newNum}`);
  }
}

// ── 6. Save ──
console.log(`\nResultado esperado: ${doc.steps.length} steps (antes 30, debería quedar 32)`);

if (apply) {
  await savePfd(sb, PFD_ID, doc, {
    extraFields: { step_count: doc.steps.length, updated_at: new Date().toISOString() },
  });
  const { data: verify } = await sb.from('pfd_documents').select('data, step_count').eq('id', PFD_ID).single();
  const dv = parseData(verify.data);
  console.log('\n=== VERIFICACION POST (tramo adhesivado) ===');
  const start = dv.steps.findIndex(s => s.description === 'ADHESIVADO');
  for (let i = start; i <= start + 8 && i < dv.steps.length; i++) {
    const s = dv.steps[i];
    console.log(`  ${i} | ${(s.stepNumber||'').padEnd(8)} | ${s.stepType.padEnd(12)} | ${s.description}`);
  }
  console.log(`step_count: ${verify.step_count}`);
}

finish(apply);
