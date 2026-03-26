/**
 * Reclasificar AP del CP Insert basándose en las causas AMFE.
 * Strategy:
 *   1. Match by causeId (exact)
 *   2. Match by text similarity (same op + similar characteristic text)
 *   3. Fallback: keep current AP
 * Then group AP=L items into generic lines per operation.
 *
 * DRY RUN by default. Pass --commit to write to Supabase.
 */
import { createClient } from '@supabase/supabase-js';

const URL = 'https://fbfsbbewmgoegjgnkkag.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnNiYmV3bWdvZWdqZ25ra2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTI4NDksImV4cCI6MjA4OTA4ODg0OX0.YKHwbbwcnqNCnxFMSyeoM6VzZgvGuIctVSfdMNyQfL4';
const AMFE_ID = '938978d7-7e49-4d72-bc3e-8673320e9737';
const CP_ID = '8942ef5b-2a20-42cd-ba71-84817a6b784b';
const dryRun = !process.argv.includes('--commit');

const supabase = createClient(URL, KEY);
await supabase.auth.signInWithPassword({ email: 'admin@barack.com', password: 'U3na%LNSYVmVCYvP' });
console.log('Authenticated');

// ============ LOAD AMFE ============
const { data: amfeRows } = await supabase.from('amfe_documents').select('data').eq('id', AMFE_ID);
const amfe = JSON.parse(amfeRows[0].data);

// Build cause map by ID and by op+text
const causeById = new Map();
const causesByOp = new Map(); // opNumber -> [{ id, ap, severity, causeText }]

for (const op of amfe.operations) {
  const opCauses = [];
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        const severity = Number(fail.severity) || 0;
        for (const cause of (fail.causes || [])) {
          const entry = {
            id: cause.id,
            ap: cause.ap || 'L',
            severity,
            occurrence: Number(cause.occurrence) || 0,
            detection: Number(cause.detection) || 0,
            causeText: (cause.cause || '').toLowerCase().trim(),
            specialChar: cause.specialChar || ''
          };
          causeById.set(cause.id, entry);
          opCauses.push(entry);
        }
      }
    }
  }
  causesByOp.set(op.opNumber, opCauses);
}
console.log(`AMFE: ${causeById.size} causes, ${causesByOp.size} operations`);

// ============ TEXT SIMILARITY ============
function normalize(text) {
  return (text || '').toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i').replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function wordOverlap(a, b) {
  const wa = new Set(normalize(a).split(' ').filter(w => w.length > 2));
  const wb = new Set(normalize(b).split(' ').filter(w => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let overlap = 0;
  for (const w of wa) { if (wb.has(w)) overlap++; }
  return overlap / Math.max(wa.size, wb.size);
}

function findBestCauseMatch(cpItem) {
  const opCauses = causesByOp.get(cpItem.processStepNumber) || [];
  if (opCauses.length === 0) return null;

  const cpText = cpItem.processCharacteristic || cpItem.productCharacteristic || '';
  if (!cpText) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const cause of opCauses) {
    const score = wordOverlap(cpText, cause.causeText);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cause;
    }
  }

  // Require at least 30% word overlap
  return bestScore >= 0.3 ? bestMatch : null;
}

// ============ LOAD CP ============
const { data: cpRows } = await supabase.from('cp_documents').select('data').eq('id', CP_ID);
const cp = JSON.parse(cpRows[0].data);
const items = cp.items || [];
console.log(`CP: ${items.length} items`);

const beforeDist = { H: 0, M: 0, L: 0 };
items.forEach(it => beforeDist[it.amfeAp || 'L']++);
console.log('AP BEFORE:', beforeDist);

// ============ PASO 1: RECLASIFICAR AP ============
let matchByCauseId = 0;
let matchByText = 0;
let noMatch = 0;
let reclassified = 0;

for (const item of items) {
  const causeIds = item.amfeCauseIds || [];

  // Strategy 1: match by causeId
  let bestAp = '';
  const apOrder = { H: 3, M: 2, L: 1, '': 0 };

  for (const cid of causeIds) {
    const cause = causeById.get(cid);
    if (cause && apOrder[cause.ap] > apOrder[bestAp]) {
      bestAp = cause.ap;
    }
  }

  if (bestAp) {
    matchByCauseId++;
    if (item.amfeAp !== bestAp) reclassified++;
    item.amfeAp = bestAp;
    continue;
  }

  // Strategy 2: match by text similarity
  const textMatch = findBestCauseMatch(item);
  if (textMatch) {
    matchByText++;
    if (item.amfeAp !== textMatch.ap) reclassified++;
    item.amfeAp = textMatch.ap;
    // Also update amfeCauseIds to point to the matched cause
    item.amfeCauseIds = [textMatch.id];
    continue;
  }

  // Strategy 3: no match - use AP from amfeSeverity heuristic
  // For unmatchable items: if severity ≤ 5 → likely L or M, not H
  // But we don't have O/D, so keep current AP unless it's clearly wrong
  noMatch++;

  // Heuristic: if S <= 4 but AP=H, downgrade to M (VDA: S=4, needs O>=8 AND D>=5 for H)
  if ((item.amfeSeverity || 0) <= 4 && item.amfeAp === 'H') {
    item.amfeAp = 'M';
    reclassified++;
  }
}

console.log(`\nPaso 1 - Matching:`);
console.log(`  By causeId: ${matchByCauseId}`);
console.log(`  By text: ${matchByText}`);
console.log(`  No match: ${noMatch}`);
console.log(`  Reclassified: ${reclassified}`);

const afterReclassDist = { H: 0, M: 0, L: 0 };
items.forEach(it => afterReclassDist[it.amfeAp || 'L']++);
console.log('AP AFTER reclassify:', afterReclassDist);

// ============ PASO 2: AGRUPAR AP=L ============
const byOp = new Map();
for (const item of items) {
  const step = item.processStepNumber || 'noStep';
  if (!byOp.has(step)) byOp.set(step, []);
  byOp.get(step).push(item);
}

const newItems = [];
const removedIds = [];
const genericItemIds = new Map();

console.log('\nPaso 2 - Agrupación:');
console.log('OP   | Desc                                     | Total | Indiv | Agrup | Después');
console.log('-----|------------------------------------------|-------|-------|-------|--------');

for (const [step, opItems] of [...byOp.entries()].sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
  const individual = [];
  const groupable = [];

  for (const item of opItems) {
    const isHM = item.amfeAp === 'H' || item.amfeAp === 'M';
    const isCCSC = (item.specialCharClass || '').includes('CC') || (item.specialCharClass || '').includes('SC');
    if (isHM || isCCSC) {
      individual.push(item);
    } else {
      groupable.push(item);
    }
  }

  newItems.push(...individual);

  if (groupable.length <= 1) {
    newItems.push(...groupable);
  } else {
    const desc = opItems[0].processDescription || '';
    const genericId = crypto.randomUUID();

    const allCauseIds = [];
    const allFailureIds = [];
    for (const g of groupable) {
      removedIds.push(g.id);
      if (g.amfeCauseIds) allCauseIds.push(...g.amfeCauseIds);
      if (g.amfeFailureId) allFailureIds.push(g.amfeFailureId);
      if (g.amfeFailureIds) allFailureIds.push(...g.amfeFailureIds);
    }

    newItems.push({
      id: genericId,
      processStepNumber: step,
      processDescription: desc,
      machineDeviceTool: 'N/A',
      characteristicNumber: '',
      productCharacteristic: '',
      processCharacteristic: 'Autocontrol visual general',
      specialCharClass: '',
      specification: 'Según instrucción de trabajo / HO',
      evaluationTechnique: 'Inspección visual',
      sampleSize: '100%',
      sampleFrequency: 'Continuo',
      controlMethod: 'Autocontrol del operador según instrucción de trabajo',
      reactionPlan: 'Contener producto sospechoso. Notificar a Líder. Según P-10/I. P-14.',
      reactionPlanOwner: 'Operador de producción',
      autoFilledFields: [],
      amfeAp: 'L',
      amfeSeverity: Math.max(...groupable.map(g => g.amfeSeverity || 0)),
      operationCategory: opItems[0].operationCategory || '',
      amfeCauseIds: [...new Set(allCauseIds)],
      amfeFailureId: allFailureIds[0] || '',
      amfeFailureIds: [...new Set(allFailureIds.filter(Boolean))],
      controlProcedure: ''
    });

    genericItemIds.set(step, genericId);
    const after = individual.length + 1;
    console.log(`${step.padEnd(5)}| ${desc.substring(0, 40).padEnd(41)}| ${String(opItems.length).padStart(5)} | ${String(individual.length).padStart(5)} | ${String(groupable.length).padStart(5)} | ${String(after).padStart(6)}`);
  }
}

newItems.sort((a, b) => parseInt(a.processStepNumber || '0') - parseInt(b.processStepNumber || '0'));

const finalDist = { H: 0, M: 0, L: 0 };
newItems.forEach(it => finalDist[it.amfeAp || 'L']++);

console.log(`\n${'='.repeat(60)}`);
console.log(`  RESUMEN FINAL`);
console.log(`${'='.repeat(60)}`);
console.log(`  Items ANTES:   ${items.length}`);
console.log(`  Items DESPUÉS: ${newItems.length}`);
console.log(`  Reducción:     ${items.length - newItems.length} items (${Math.round((items.length - newItems.length) / items.length * 100)}%)`);
console.log(`  Items eliminados: ${removedIds.length}`);
console.log(`  Líneas genéricas: ${genericItemIds.size}`);
console.log(`  AP BEFORE: H=${beforeDist.H} M=${beforeDist.M} L=${beforeDist.L}`);
console.log(`  AP AFTER:  H=${finalDist.H} M=${finalDist.M} L=${finalDist.L}`);
console.log(`${'='.repeat(60)}`);

// ============ SAVE ============
import { writeFileSync } from 'fs';
import { join } from 'path';
const tmp = process.env.TEMP || '/tmp';

writeFileSync(join(tmp, 'cp_removed_ids.json'), JSON.stringify(removedIds));
writeFileSync(join(tmp, 'cp_generic_items.json'), JSON.stringify(Object.fromEntries(genericItemIds)));

if (dryRun) {
  console.log('\n[DRY RUN] No changes written. Pass --commit to apply.');
} else {
  cp.items = newItems;
  cp.header.itemCount = newItems.length;

  const { error } = await supabase.from('cp_documents').update({
    data: JSON.stringify(cp),
    item_count: newItems.length,
    updated_at: new Date().toISOString()
  }).eq('id', CP_ID);

  if (error) { console.error('UPDATE FAILED:', error); process.exit(1); }
  console.log('\nCP actualizado en Supabase OK');
}

await supabase.auth.signOut();
