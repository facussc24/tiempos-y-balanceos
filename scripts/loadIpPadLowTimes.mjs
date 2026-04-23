/**
 * loadIpPadLowTimes.mjs
 *
 * Paso 4 del plan breezy-leaping-backus: actualizar tiempos LOW del IP PAD
 * Patagonia en el proyecto de balanceo (projects.id=13).
 *
 * Tiempos pasados por Fak (2026-04-23) para PL1 LOW (2HC.858.417.B FAM):
 * - Refilado (máquina refiladora): 129 s por ciclo de 5 piezas
 * - Costura Unión: 248 s por ciclo de 5 piezas
 * - Costura Vista: 199 s por ciclo de 5 piezas
 *
 * Los tiempos se cargan CRUDOS (valor total del ciclo) + cycleQuantity=5.
 * El motor calcula standardTime = (avg/cycleQty × rating/100) × (1 + fatigue)
 * automáticamente. Referencia: types/tasks.ts:45-50.
 *
 * Dry-run por default. --apply para ejecutar.
 */

import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData } from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const PROJECT_ID = 13; // IP_PAD

// Nuevos tiempos (raw cycle times for 5 pieces)
const NEW_TIMES = {
  'Refilado': { times: [129], cycleQuantity: 5 },
  'Costura unión': { times: [248], cycleQuantity: 5 },
  'Costura vista': { times: [199], cycleQuantity: 5 },
};

// Models en el project: default=HIGH, 33c3f1c0=LOW
const MODEL_HIGH = 'default';
const MODEL_LOW = '33c3f1c0';

const { data: project, error } = await sb.from('projects').select('*').eq('id', PROJECT_ID).single();
if (error || !project) { console.error('READ project 13:', error); process.exit(1); }
const d = parseData(project.data);

console.log(`Proyecto: ${project.name} | ${project.client} | ${project.project_code} | demand=${project.daily_demand}`);
console.log(`Modelos: ${d.meta.activeModels.map(m => `${m.name}(id=${m.id}, ${m.units}u)`).join(', ')}`);
console.log(`Tasks actuales: ${d.tasks?.length}`);

let updatedCount = 0;
for (const task of d.tasks || []) {
  const newConfig = NEW_TIMES[task.description];
  if (!newConfig) {
    console.log(`Task "${task.description}" no coincide con tiempos nuevos. Skip.`);
    continue;
  }

  const oldTimes = task.times;
  const oldCycleQty = task.cycleQuantity;
  const oldAvg = task.averageTime;
  const oldStd = task.standardTime;

  // Update task
  const validTimes = newConfig.times.filter(t => t != null && t > 0);
  const rawAvg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
  const normAvg = rawAvg / newConfig.cycleQuantity;
  const rating = task.ratingFactor || 100;
  // Fatigue compensation: leer del meta si existe
  const fatigueEnabled = d.meta?.fatigueCompensation?.enabled;
  const fatiguePct = fatigueEnabled ? (d.meta.fatigueCompensation.globalPercent || 10) / 100 : 0;
  const newStd = normAvg * (rating / 100) * (1 + fatiguePct);

  task.times = newConfig.times;
  task.cycleQuantity = newConfig.cycleQuantity;
  task.averageTime = Math.round(normAvg * 100) / 100;
  task.standardTime = Math.round(newStd * 100) / 100;

  // Aplicable a ambos modelos (HIGH y LOW). Fak pasó tiempos LOW pero hasta
  // que tengamos HIGH diferenciados, asumimos el mismo tiempo para ambos
  // (conservador: no rompe balanceo).
  task.modelApplicability = {
    [MODEL_HIGH]: true,
    [MODEL_LOW]: true,
  };

  logChange(apply, `UPDATE task "${task.description}"`, {
    'old times': JSON.stringify(oldTimes),
    'old cycleQty': oldCycleQty,
    'old std': oldStd,
    'new times': JSON.stringify(task.times),
    'new cycleQty': task.cycleQuantity,
    'new avg (per piece)': task.averageTime,
    'new std (per piece, +fatigue)': task.standardTime,
    'modelApplicability': JSON.stringify(task.modelApplicability),
  });
  updatedCount++;
}

if (updatedCount === 0) {
  console.log('No se encontraron tasks coincidentes. Abort.');
  process.exit(1);
}

// Save
if (apply) {
  const newDataStr = JSON.stringify(d);
  const { error: eu } = await sb.from('projects').update({
    data: newDataStr,
    updated_at: new Date().toISOString(),
    version: project.version, // mantener version existente
  }).eq('id', PROJECT_ID);
  if (eu) { console.error('UPDATE project:', eu); process.exit(1); }
  console.log(`\nProject ${PROJECT_ID} actualizado (${updatedCount} tasks).`);

  // Verify
  const { data: verify } = await sb.from('projects').select('data').eq('id', PROJECT_ID).single();
  const dv = parseData(verify.data);
  console.log('\n=== VERIFICACION POST ===');
  for (const t of dv.tasks) {
    console.log(`  ${t.description}: times=${JSON.stringify(t.times)} cycleQty=${t.cycleQuantity} avg=${t.averageTime} std=${t.standardTime}`);
  }
}

finish(apply);
