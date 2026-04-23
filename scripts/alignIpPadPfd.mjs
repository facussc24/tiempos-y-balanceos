/**
 * alignIpPadPfd.mjs
 *
 * Desdobla el step "COSTURA" del PFD IP PAD en 3 steps consecutivos
 * para alinear con el AMFE actualizado (OP 40 REFILADO / OP 41 COSTURA UNION /
 * OP 42 COSTURA VISTA).
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

const costuraIdx = doc.steps.findIndex(s => s.description === 'COSTURA');
if (costuraIdx < 0) throw new Error('Step COSTURA not found');
const costuraOrig = doc.steps[costuraIdx];

// Construir los 3 steps nuevos basados en el original (preservar branchId, department, etc)
function mkStep(over) {
  return {
    ...costuraOrig,
    id: randomUUID(),
    ...over,
  };
}

const stepRefilado = mkStep({
  stepNumber: 'OP 40',
  description: 'REFILADO',
  machineDeviceTool: 'Maquina refiladora',
  productCharacteristic: 'Dimension del panel y calidad de borde',
  processCharacteristic: 'Velocidad de avance, estado de cuchilla, posicionamiento en plantilla',
});

const stepUnion = mkStep({
  stepNumber: 'OP 41',
  description: 'COSTURA UNION',
  machineDeviceTool: 'Maquina de coser (union)',
  productCharacteristic: 'Resistencia y alineacion de costura de union entre paneles',
  processCharacteristic: 'Tension de hilo, largo de puntada, trayectoria de union',
});

const stepVista = mkStep({
  stepNumber: 'OP 42',
  description: 'COSTURA VISTA',
  machineDeviceTool: 'Maquina de coser (vista)',
  productCharacteristic: 'Aspecto decorativo y alineacion costura vista',
  processCharacteristic: 'Tension de hilo, patron decorativo, distancia entre costuras',
});

// Reemplazar 1 step por 3
doc.steps.splice(costuraIdx, 1, stepRefilado, stepUnion, stepVista);

console.log(`Plan: PFD ${PFD_ID}`);
console.log(`  Antes: 28 steps (step #${costuraIdx + 1} = COSTURA consolidado)`);
console.log(`  Despues: ${doc.steps.length} steps`);
console.log(`    step #${costuraIdx + 1} REFILADO`);
console.log(`    step #${costuraIdx + 2} COSTURA UNION`);
console.log(`    step #${costuraIdx + 3} COSTURA VISTA`);

logChange(apply, `UPDATE PFD data (steps 28 -> ${doc.steps.length})`);

if (apply) {
  await savePfd(sb, PFD_ID, doc, { extraFields: { step_count: doc.steps.length, updated_at: new Date().toISOString() } });
  console.log('\nPFD guardado. Verificando...');
  const { data: verify } = await sb.from('pfd_documents').select('data, step_count').eq('id', PFD_ID).single();
  const dv = parseData(verify.data);
  console.log(`step_count: ${verify.step_count}`);
  console.log(`steps count in data: ${dv.steps.length}`);
  // Show new steps
  const costuraStart = dv.steps.findIndex(s => s.description === 'REFILADO');
  for (let i = costuraStart; i <= costuraStart + 2 && i < dv.steps.length; i++) {
    console.log(`  step #${i + 1}: [${dv.steps[i].stepNumber}] ${dv.steps[i].description} | ${dv.steps[i].machineDeviceTool}`);
  }
}

finish(apply);
