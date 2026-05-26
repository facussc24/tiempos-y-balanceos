/**
 * syncPurMasterToHeadrests.mjs
 *
 * Replica el contenido del Maestro AMFE Inyeccion PUR in place
 * (AMFE-MAESTRO-PU-001, family 19) a las OPs PU de los 3 Headrest:
 *   - AMFE-HF-PAT   OP 63 INYECCION DE PU
 *   - AMFE-HRC-PAT  OP 50 INYECCION DE PU
 *   - AMFE-HRO-PAT  OP 50 INYECCION DE PU
 *
 * Estrategia:
 *  1. Lee el maestro PU (single OP "10" con 11 WEs + 11 FMs + 51 causas)
 *  2. Por cada target, encuentra su OP "INYECCION DE PU"
 *  3. Reemplaza workElements de esa OP con los del maestro (UUIDs regenerados)
 *  4. MANTIENE: opNumber del target (63 o 50, NO 10), operationName del target
 *  5. ACTUALIZA: focusElementFunction, operationFunction del maestro
 *  6. Backup pre/post + verificacion
 *
 * Reglas respetadas:
 *  - regla `no-ho-barack.md`: las OPs reales pueden tener numeracion distinta al maestro
 *  - regla `amfe.md`: aliases sincronizados (opNumber+operationNumber, name+operationName, etc.)
 *  - regla `database.md`: NO double-serializar JSONB
 *  - regla `verify-supabase-live.md`: leer live, no dumps
 *
 * Uso:
 *   node scripts/syncPurMasterToHeadrests.mjs           # dry-run
 *   node scripts/syncPurMasterToHeadrests.mjs --apply   # ejecutar
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Supabase connection ─────────────────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const APPLY = process.argv.includes('--apply');

// Targets: amfe_number pattern + OP number a reemplazar
const TARGETS = [
  { pattern: '%HF-PAT%',  targetOpNumber: '63' },
  { pattern: '%HRC-PAT%', targetOpNumber: '50' },
  { pattern: '%HRO-PAT%', targetOpNumber: '50' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Recursivamente regenera UUIDs y mantiene mapa para remapeo de refs */
function regenerateUuids(obj, idMap) {
  if (typeof obj === 'string') {
    if (idMap.has(obj)) return idMap.get(obj);
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(item => regenerateUuids(item, idMap));
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'id' && typeof val === 'string' && val.length > 30) {
        const fresh = randomUUID();
        idMap.set(val, fresh);
        result[key] = fresh;
      } else {
        result[key] = regenerateUuids(val, idMap);
      }
    }
    return result;
  }
  return obj;
}

function countCauses(workElements) {
  let total = 0;
  for (const we of workElements || []) {
    for (const fn of we.functions || []) {
      for (const fail of fn.failures || []) {
        total += (fail.causes || []).length;
      }
    }
  }
  return total;
}

function countAPLevels(workElements) {
  let h = 0, m = 0;
  for (const we of workElements || []) {
    for (const fn of we.functions || []) {
      for (const fail of fn.failures || []) {
        for (const cause of fail.causes || []) {
          const ap = (cause.ap || cause.actionPriority || '').toUpperCase();
          if (ap === 'H') h++;
          else if (ap === 'M') m++;
        }
      }
    }
  }
  return { h, m };
}

// ══════════════════════════════════════════════════════════════════════════════
// PART A: READ MAESTRO PU
// ══════════════════════════════════════════════════════════════════════════════

console.log('=== PART A: LEYENDO MAESTRO PU ===\n');

const { data: masterRow, error: e1 } = await sb
  .from('amfe_documents').select('id,amfe_number,data,updated_at')
  .eq('amfe_number', 'AMFE-MAESTRO-PU-001').single();
if (e1) { console.error('ERROR leyendo maestro PU:', e1.message); process.exit(1); }

const masterData = typeof masterRow.data === 'string' ? JSON.parse(masterRow.data) : masterRow.data;
const masterOp = masterData.operations[0];
if (!masterOp) { console.error('ERROR: maestro PU sin operaciones'); process.exit(1); }

console.log(`  Maestro: ${masterRow.amfe_number} (id=${masterRow.id})`);
console.log(`  Updated: ${masterRow.updated_at}`);
console.log(`  Master OP: ${masterOp.opNumber} "${masterOp.operationName}"`);
console.log(`  Master WEs: ${(masterOp.workElements || []).length}`);
console.log(`  Master causes: ${countCauses(masterOp.workElements)}`);

// ══════════════════════════════════════════════════════════════════════════════
// PART B: READ TARGETS
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== PART B: LEYENDO TARGETS ===\n');

const targetData = [];
for (const t of TARGETS) {
  const { data, error } = await sb.from('amfe_documents')
    .select('id,amfe_number,data,updated_at,operation_count,cause_count')
    .ilike('amfe_number', t.pattern).single();
  if (error) { console.error(`ERROR ${t.pattern}:`, error.message); process.exit(1); }

  const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
  const op = parsed.operations.find(o => (o.opNumber || o.operationNumber) === t.targetOpNumber);
  if (!op) {
    console.error(`ERROR: ${data.amfe_number} no tiene OP ${t.targetOpNumber}`);
    process.exit(1);
  }

  const isText = typeof data.data === 'string';
  console.log(`  ${data.amfe_number}: OP ${t.targetOpNumber} "${op.operationName || op.name}"`);
  console.log(`    Pre-replicacion: WEs=${(op.workElements || []).length} causes=${countCauses(op.workElements)}`);
  console.log(`    Formato data: ${isText ? 'TEXT' : 'JSONB'}`);

  targetData.push({
    pattern: t.pattern,
    targetOpNumber: t.targetOpNumber,
    amfeId: data.id,
    amfeNumber: data.amfe_number,
    fullData: parsed,
    targetOp: op,
    targetOperationName: op.operationName || op.name,
    isText
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// PART C: BUILD REPLACEMENT FOR EACH TARGET
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== PART C: CONSTRUYENDO REEMPLAZOS ===\n');

for (const t of targetData) {
  // Clonar el contenido del maestro y regenerar UUIDs
  const cloned = JSON.parse(JSON.stringify(masterOp));
  const idMap = new Map();
  const fresh = regenerateUuids(cloned, idMap);

  // Mantener opNumber + operationName del target (NO del maestro)
  fresh.id = t.targetOp.id; // mantener el ID original de la OP para no romper refs
  fresh.opNumber = t.targetOpNumber;
  fresh.operationNumber = t.targetOpNumber;
  fresh.name = t.targetOperationName;
  fresh.operationName = t.targetOperationName;
  // Preservar otros campos legacy del target que no están en el maestro
  if (t.targetOp.linkedPfdStepId !== undefined) fresh.linkedPfdStepId = t.targetOp.linkedPfdStepId;

  // Reemplazar la OP en el AMFE completo
  const newOps = t.fullData.operations.map(op => {
    if ((op.opNumber || op.operationNumber) === t.targetOpNumber) {
      return fresh;
    }
    return op;
  });

  t.newFullData = { ...t.fullData, operations: newOps };
  t.uuidsRegenerated = idMap.size;
  t.newCauses = countCauses(fresh.workElements);
  t.newAPLevels = countAPLevels(fresh.workElements);

  console.log(`  ${t.amfeNumber} OP ${t.targetOpNumber}:`);
  console.log(`    UUIDs regenerados: ${t.uuidsRegenerated}`);
  console.log(`    WEs nuevos: ${(fresh.workElements || []).length}`);
  console.log(`    Causas nuevas: ${t.newCauses}`);
  console.log(`    AP H/M: ${t.newAPLevels.h}/${t.newAPLevels.m}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== RESUMEN ===\n');
for (const t of targetData) {
  const preWEs = (t.targetOp.workElements || []).length;
  const preCauses = countCauses(t.targetOp.workElements);
  const postWEs = (t.newFullData.operations.find(o => (o.opNumber || o.operationNumber) === t.targetOpNumber).workElements || []).length;
  console.log(`  ${t.amfeNumber} OP ${t.targetOpNumber}: WEs ${preWEs}→${postWEs} | causes ${preCauses}→${t.newCauses}`);
}

if (!APPLY) {
  console.log('\n*** DRY RUN — usar --apply para ejecutar ***');
  process.exit(0);
}

// ══════════════════════════════════════════════════════════════════════════════
// APPLY
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== APLICANDO CAMBIOS ===\n');

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/pu-headrests-sync-${ts}/`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });

for (const t of targetData) {
  // Backup pre-write
  writeFileSync(`${backupDir}/${t.amfeNumber}_before.json`, JSON.stringify(t.fullData, null, 2));

  // Total causes for whole AMFE
  let totalCauses = 0;
  let totalH = 0, totalM = 0;
  for (const op of t.newFullData.operations) {
    totalCauses += countCauses(op.workElements);
    const apl = countAPLevels(op.workElements);
    totalH += apl.h;
    totalM += apl.m;
  }

  const dataToWrite = t.isText ? JSON.stringify(t.newFullData) : t.newFullData;

  const { error: upErr } = await sb.from('amfe_documents')
    .update({
      data: dataToWrite,
      cause_count: totalCauses,
      ap_h_count: totalH,
      ap_m_count: totalM,
      updated_at: new Date().toISOString()
    })
    .eq('id', t.amfeId);
  if (upErr) {
    console.error(`ERROR actualizando ${t.amfeNumber}:`, upErr.message);
    process.exit(1);
  }
  console.log(`  ${t.amfeNumber}: actualizado (total causes=${totalCauses}, H=${totalH}, M=${totalM})`);
  writeFileSync(`${backupDir}/${t.amfeNumber}_after.json`, JSON.stringify(t.newFullData, null, 2));
}

console.log(`\n  Backups en: ${backupDir}`);

// ══════════════════════════════════════════════════════════════════════════════
// VERIFICATION
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== VERIFICACION POST-APPLY ===\n');

let allOk = true;
for (const t of targetData) {
  const { data: vData } = await sb.from('amfe_documents')
    .select('id,amfe_number,data,operation_count,cause_count').eq('id', t.amfeId).single();
  const parsed = typeof vData.data === 'string' ? JSON.parse(vData.data) : vData.data;
  const isObject = typeof vData.data === 'object' || (typeof vData.data === 'string' && parsed !== null);

  const op = parsed.operations.find(o => (o.opNumber || o.operationNumber) === t.targetOpNumber);
  const weCount = (op?.workElements || []).length;
  const causeCount = countCauses(op?.workElements);
  const totalCauses = countCauses(parsed.operations.flatMap(o => o.workElements || []));

  const ok = weCount === 11 && causeCount === 51 && vData.cause_count === totalCauses;
  if (!ok) allOk = false;
  console.log(`  ${t.amfeNumber}: OP ${t.targetOpNumber} WEs=${weCount} causes=${causeCount} | total causes=${totalCauses} | col=${vData.cause_count} | ${ok ? 'OK' : 'FAIL'}`);
}

console.log(`\n  ${allOk ? 'VERIFICACION GLOBAL OK' : 'ATENCION — revisar fallos arriba'}`);
process.exit(allOk ? 0 : 1);
