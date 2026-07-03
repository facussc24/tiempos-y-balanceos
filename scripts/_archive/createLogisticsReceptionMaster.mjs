/**
 * createLogisticsReceptionMaster.mjs
 *
 * Crea el "Maestro de Logística y Recepción" como documento nuevo:
 *  1. Nueva familia en product_families
 *  2. Nuevo AMFE master: extrae OP 10 del AMFE Maestro de Inyección, regenera UUIDs
 *  3. Nuevo CP master: extrae items OP 10 del CP Maestro de Inyección, re-mapea UUIDs
 *  4. Links en family_documents (module=amfe, module=cp, ambos is_master=1)
 *
 * Luego, elimina OP 10 del Maestro de Inyección (AMFE + CP).
 *
 * Justificación: AIAG CP 2024 "Procesos Interdependientes" + AIAG-VDA 2019 "Foundation FMEA"
 * para procesos transversales como recepción de materia prima.
 *
 * Uso:
 *   node scripts/createLogisticsReceptionMaster.mjs          # dry-run
 *   node scripts/createLogisticsReceptionMaster.mjs --apply   # ejecutar
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Supabase connection ─────────────────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const APPLY = process.argv.includes('--apply');
const INJ_AMFE_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';
const INJ_CP_ID = '81b60cdd-1296-4821-a348-a8e3c2433b0d';
const INJ_FAMILY_ID = 15;

// ── UUID regeneration with mapping ──────────────────────────────────────────
function regenerateUuids(obj, idMap) {
  if (typeof obj === 'string') {
    // If it looks like a UUID and we have a mapping, replace it
    if (idMap.has(obj)) return idMap.get(obj);
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => regenerateUuids(item, idMap));
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'id' && typeof val === 'string' && val.length > 30) {
        // UUID field — generate fresh and map
        const fresh = randomUUID();
        idMap.set(val, fresh);
        result[key] = fresh;
      } else if ((key === 'amfeCauseIds' || key === 'amfeFailureId' || key === 'amfeFailureIds' ||
                  key === 'linkedAmfeOperationId') && typeof val === 'string') {
        // Reference field — will be remapped after full pass
        result[key] = val;
      } else if (key === 'amfeCauseIds' && Array.isArray(val)) {
        result[key] = val; // Will be remapped after
      } else {
        result[key] = regenerateUuids(val, idMap);
      }
    }
    return result;
  }
  return obj;
}

/** Second pass: remap all reference fields using the idMap */
function remapReferences(obj, idMap) {
  if (typeof obj === 'string') {
    return idMap.has(obj) ? idMap.get(obj) : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => remapReferences(item, idMap));
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      if ((key === 'amfeCauseIds') && Array.isArray(val)) {
        result[key] = val.map(id => idMap.has(id) ? idMap.get(id) : id);
      } else if ((key === 'amfeFailureId' || key === 'linkedAmfeOperationId') && typeof val === 'string') {
        result[key] = idMap.has(val) ? idMap.get(val) : val;
      } else if (key === 'amfeFailureIds' && Array.isArray(val)) {
        result[key] = val.map(id => idMap.has(id) ? idMap.get(id) : id);
      } else {
        result[key] = remapReferences(val, idMap);
      }
    }
    return result;
  }
  return obj;
}

// ── Count AMFE causes and AP levels ─────────────────────────────────────────
function countCausesAndAP(operations) {
  let total = 0, apH = 0, apM = 0;
  for (const op of operations) {
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const fail of fn.failures || []) {
          for (const cause of fail.causes || []) {
            total++;
            const ap = (cause.ap || cause.actionPriority || '').toUpperCase();
            if (ap === 'H') apH++;
            else if (ap === 'M') apM++;
          }
        }
      }
    }
  }
  return { total, apH, apM };
}

// ══════════════════════════════════════════════════════════════════════════════
// PART A: READ SOURCE DATA
// ══════════════════════════════════════════════════════════════════════════════

console.log('=== PART A: LEYENDO DATOS FUENTE ===\n');

// Read injection AMFE master
const { data: injAmfeRow, error: e1 } = await sb
  .from('amfe_documents').select('*').eq('id', INJ_AMFE_ID).single();
if (e1) { console.error('ERROR reading injection AMFE:', e1.message); process.exit(1); }
const injAmfe = typeof injAmfeRow.data === 'string' ? JSON.parse(injAmfeRow.data) : injAmfeRow.data;

// Read injection CP master
const { data: injCpRow, error: e2 } = await sb
  .from('cp_documents').select('*').eq('id', INJ_CP_ID).single();
if (e2) { console.error('ERROR reading injection CP:', e2.message); process.exit(1); }
const injCp = typeof injCpRow.data === 'string' ? JSON.parse(injCpRow.data) : injCpRow.data;

// Extract OP 10 from AMFE
const op10 = injAmfe.operations.find(op => (op.opNumber || op.operationNumber) === '10');
if (!op10) { console.error('ERROR: OP 10 not found in injection AMFE'); process.exit(1); }

// Extract OP 10 items from CP
const cpOp10Items = injCp.items.filter(item => item.processStepNumber === '10');

console.log(`  Injection AMFE operations: ${injAmfe.operations.length}`);
console.log(`  OP 10 Work Elements: ${(op10.workElements || []).length}`);
const op10Counts = countCausesAndAP([op10]);
console.log(`  OP 10 Causes: ${op10Counts.total} (H=${op10Counts.apH}, M=${op10Counts.apM}, L=${op10Counts.total - op10Counts.apH - op10Counts.apM})`);
console.log(`  CP OP 10 items: ${cpOp10Items.length}`);

// ══════════════════════════════════════════════════════════════════════════════
// PART B: BUILD NEW LOGISTICS MASTER
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== PART B: CONSTRUYENDO MAESTRO DE LOGISTICA ===\n');

// Regenerate UUIDs for the new AMFE operation
const idMap = new Map();
const newOp10 = regenerateUuids(JSON.parse(JSON.stringify(op10)), idMap);
const newOp10Remapped = remapReferences(newOp10, idMap);

console.log(`  UUIDs regenerados: ${idMap.size}`);

// Build new AMFE data
const newAmfeId = randomUUID();
const today = new Date().toISOString().slice(0, 10);
const newAmfeData = {
  header: {
    companyName: 'BARACK MERCOSUL',
    scope: 'Proceso de Logistica y Recepcion de Materia Prima',
    partNumber: '',
    applicableParts: '',
    responsibleEngineer: 'Carlos Baptista',
    coreTeam: 'Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Marianna Vera (Produccion)',
    preparedBy: 'Facundo Santoro',
    approvedBy: 'Carlos Baptista',
    amfeDate: today,
    revisionLevel: 'A',
    revisionDate: today
  },
  operations: [newOp10Remapped]
};

// Build new CP data — remap amfeCauseIds using the idMap
const newCpId = randomUUID();
const newCpItems = cpOp10Items.map(item => {
  const cloned = JSON.parse(JSON.stringify(item));
  cloned.id = randomUUID();
  // Remap AMFE references
  if (Array.isArray(cloned.amfeCauseIds)) {
    cloned.amfeCauseIds = cloned.amfeCauseIds.map(id => idMap.has(id) ? idMap.get(id) : id);
  }
  if (cloned.amfeFailureId && idMap.has(cloned.amfeFailureId)) {
    cloned.amfeFailureId = idMap.get(cloned.amfeFailureId);
  }
  if (Array.isArray(cloned.amfeFailureIds)) {
    cloned.amfeFailureIds = cloned.amfeFailureIds.map(id => idMap.has(id) ? idMap.get(id) : id);
  }
  if (cloned.linkedAmfeOperationId && idMap.has(cloned.linkedAmfeOperationId)) {
    cloned.linkedAmfeOperationId = idMap.get(cloned.linkedAmfeOperationId);
  }
  return cloned;
});

const newCpData = {
  header: {
    partName: 'Proceso de Logistica y Recepcion de Materia Prima',
    partNumber: '',
    applicableParts: '',
    companyName: 'BARACK MERCOSUL',
    customerName: '',
    coreTeam: 'Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Marianna Vera (Produccion)',
    preparedBy: 'Facundo Santoro',
    approvedBy: 'Carlos Baptista',
    plantApproval: 'Gonzalo Cal',
    customerApproval: '',
    revisionLevel: 'A',
    revisionDate: today
  },
  items: newCpItems
};

console.log(`  Nuevo AMFE ID: ${newAmfeId}`);
console.log(`  Nuevo AMFE operations: 1`);
console.log(`  Nuevo AMFE causes: ${op10Counts.total}`);
console.log(`  Nuevo CP ID: ${newCpId}`);
console.log(`  Nuevo CP items: ${newCpItems.length}`);

// ══════════════════════════════════════════════════════════════════════════════
// PART C: BUILD UPDATED INJECTION MASTER (without OP 10)
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== PART C: MAESTRO DE INYECCION SIN OP 10 ===\n');

const injAmfeWithoutOp10 = {
  ...injAmfe,
  operations: injAmfe.operations.filter(op => (op.opNumber || op.operationNumber) !== '10')
};
const injCpWithoutOp10 = {
  ...injCp,
  items: injCp.items.filter(item => item.processStepNumber !== '10')
};

const injNewCounts = countCausesAndAP(injAmfeWithoutOp10.operations);
console.log(`  Injection AMFE after: ${injAmfeWithoutOp10.operations.length} ops, ${injNewCounts.total} causes`);
console.log(`  Injection CP after: ${injCpWithoutOp10.items.length} items`);

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== RESUMEN DE CAMBIOS ===\n');
console.log('  CREAR:');
console.log(`    Familia: "Proceso de Logistica y Recepcion"`);
console.log(`    AMFE: AMFE-MAESTRO-LOG-REC-001 (1 op, ${op10Counts.total} causas)`);
console.log(`    CP: CP-MAESTRO-LOG-REC-001 (${newCpItems.length} items)`);
console.log('  MODIFICAR:');
console.log(`    Injection AMFE: ${injAmfe.operations.length} ops → ${injAmfeWithoutOp10.operations.length} ops`);
console.log(`    Injection CP: ${injCp.items.length} items → ${injCpWithoutOp10.items.length} items`);

if (!APPLY) {
  console.log('\n*** DRY RUN — usar --apply para ejecutar ***');
  process.exit(0);
}

// ══════════════════════════════════════════════════════════════════════════════
// APPLY
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== APLICANDO CAMBIOS ===\n');

// Backup
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/logistics-master-${ts}/`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });
writeFileSync(`${backupDir}/inj_amfe_before.json`, JSON.stringify(injAmfe, null, 2));
writeFileSync(`${backupDir}/inj_cp_before.json`, JSON.stringify(injCp, null, 2));
console.log(`  Backup: ${backupDir}`);

// 1. Create family
const { data: familyRow, error: famErr } = await sb
  .from('product_families')
  .insert({
    name: 'Proceso de Logistica y Recepcion',
    description: 'AMFE de Fundacion: proceso interdependiente de recepcion, inspeccion y almacenamiento de materia prima (AIAG CP 2024)',
    linea_code: '',
    linea_name: '',
    active: 1
  })
  .select('id')
  .single();
if (famErr) { console.error('ERROR creating family:', famErr.message); process.exit(1); }
console.log(`  1. Familia creada: id=${familyRow.id}`);

// 2. Create AMFE master
const amfePayload = {
  id: newAmfeId,
  amfe_number: 'AMFE-MAESTRO-LOG-REC-001',
  project_name: 'MAESTRO/LOGISTICA_RECEPCION',
  subject: 'Proceso de Logistica y Recepcion de Materia Prima',
  client: '',
  part_number: '',
  responsible: 'Carlos Baptista',
  organization: 'BARACK MERCOSUL',
  status: 'draft',
  operation_count: 1,
  cause_count: op10Counts.total,
  ap_h_count: op10Counts.apH,
  ap_m_count: op10Counts.apM,
  coverage_percent: 100,
  start_date: today,
  last_revision_date: today,
  revision_level: 'A',
  data: newAmfeData  // Object for Supabase JSONB
};

// Handle TEXT vs JSONB
const isText = typeof injAmfeRow.data === 'string';
if (isText) {
  amfePayload.data = JSON.stringify(newAmfeData);
}

const { error: amfeErr } = await sb.from('amfe_documents').insert(amfePayload);
if (amfeErr) {
  console.error('ERROR creating AMFE:', amfeErr.message);
  await sb.from('product_families').delete().eq('id', familyRow.id);
  process.exit(1);
}
console.log(`  2. AMFE creado: ${newAmfeId}`);

// 3. Link AMFE to family
const { error: linkAmfeErr } = await sb.from('family_documents').insert({
  family_id: familyRow.id, module: 'amfe', document_id: newAmfeId, is_master: 1, source_master_id: null, product_id: null
});
if (linkAmfeErr) { console.error('ERROR linking AMFE:', linkAmfeErr.message); process.exit(1); }
console.log('  3. AMFE vinculado a familia');

// 4. Create CP master
const cpPayload = {
  id: newCpId,
  project_name: 'MAESTRO/LOGISTICA_RECEPCION',
  control_plan_number: 'CP-MAESTRO-LOG-REC-001',
  phase: 'production',
  part_number: '',
  part_name: 'Proceso de Logistica y Recepcion de Materia Prima',
  organization: 'BARACK MERCOSUL',
  client: '',
  responsible: 'Carlos Baptista',
  revision: '1',
  revision_level: 'A',
  last_revision_at: today,
  linked_amfe_project: 'MAESTRO/LOGISTICA_RECEPCION',
  linked_amfe_id: newAmfeId,
  item_count: newCpItems.length,
  data: isText ? JSON.stringify(newCpData) : newCpData
};

const { error: cpErr } = await sb.from('cp_documents').insert(cpPayload);
if (cpErr) { console.error('ERROR creating CP:', cpErr.message); process.exit(1); }
console.log(`  4. CP creado: ${newCpId}`);

// 5. Link CP to family
const { error: linkCpErr } = await sb.from('family_documents').insert({
  family_id: familyRow.id, module: 'cp', document_id: newCpId, is_master: 1, source_master_id: null, product_id: null
});
if (linkCpErr) { console.error('ERROR linking CP:', linkCpErr.message); process.exit(1); }
console.log('  5. CP vinculado a familia');

// 6. Remove OP 10 from injection AMFE
const injAmfeToWrite = isText ? JSON.stringify(injAmfeWithoutOp10) : injAmfeWithoutOp10;
const { error: injAmfeUpErr } = await sb.from('amfe_documents')
  .update({
    data: injAmfeToWrite,
    operation_count: injAmfeWithoutOp10.operations.length,
    cause_count: injNewCounts.total,
    ap_h_count: injNewCounts.apH,
    ap_m_count: injNewCounts.apM,
    updated_at: new Date().toISOString()
  })
  .eq('id', INJ_AMFE_ID);
if (injAmfeUpErr) { console.error('ERROR updating injection AMFE:', injAmfeUpErr.message); process.exit(1); }
console.log(`  6. Injection AMFE: OP 10 eliminada (${injAmfeWithoutOp10.operations.length} ops restantes)`);

// 7. Remove OP 10 items from injection CP
const injCpToWrite = isText ? JSON.stringify(injCpWithoutOp10) : injCpWithoutOp10;
const { error: injCpUpErr } = await sb.from('cp_documents')
  .update({
    data: injCpToWrite,
    item_count: injCpWithoutOp10.items.length,
    updated_at: new Date().toISOString()
  })
  .eq('id', INJ_CP_ID);
if (injCpUpErr) { console.error('ERROR updating injection CP:', injCpUpErr.message); process.exit(1); }
console.log(`  7. Injection CP: items OP 10 eliminados (${injCpWithoutOp10.items.length} items restantes)`);

// ══════════════════════════════════════════════════════════════════════════════
// VERIFICATION
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== VERIFICACION ===\n');

// Verify new logistics AMFE
const { data: vAmfe } = await sb.from('amfe_documents').select('id, amfe_number, operation_count, cause_count, data').eq('id', newAmfeId).single();
const vAmfeData = typeof vAmfe.data === 'string' ? JSON.parse(vAmfe.data) : vAmfe.data;
console.log(`  Logistics AMFE: ${vAmfe.amfe_number}, ops=${vAmfeData.operations.length}, causes_col=${vAmfe.cause_count}`);
console.log(`    typeof data: ${typeof vAmfe.data}`);

// Verify new logistics CP
const { data: vCp } = await sb.from('cp_documents').select('id, control_plan_number, item_count, data').eq('id', newCpId).single();
const vCpData = typeof vCp.data === 'string' ? JSON.parse(vCp.data) : vCp.data;
console.log(`  Logistics CP: ${vCp.control_plan_number}, items=${vCpData.items.length}, items_col=${vCp.item_count}`);

// Verify updated injection AMFE
const { data: vInjAmfe } = await sb.from('amfe_documents').select('id, operation_count, cause_count, data').eq('id', INJ_AMFE_ID).single();
const vInjAmfeData = typeof vInjAmfe.data === 'string' ? JSON.parse(vInjAmfe.data) : vInjAmfe.data;
const hasOp10 = vInjAmfeData.operations.some(op => (op.opNumber || op.operationNumber) === '10');
console.log(`  Injection AMFE: ops=${vInjAmfeData.operations.length}, causes_col=${vInjAmfe.cause_count}, has_op10=${hasOp10}`);

// Verify updated injection CP
const { data: vInjCp } = await sb.from('cp_documents').select('id, item_count, data').eq('id', INJ_CP_ID).single();
const vInjCpData = typeof vInjCp.data === 'string' ? JSON.parse(vInjCp.data) : vInjCp.data;
const hasOp10Items = vInjCpData.items.some(item => item.processStepNumber === '10');
console.log(`  Injection CP: items=${vInjCpData.items.length}, items_col=${vInjCp.item_count}, has_op10_items=${hasOp10Items}`);

// Verify family link
const { data: famLinks } = await sb.from('family_documents').select('*').eq('family_id', familyRow.id);
console.log(`  Family links: ${famLinks.length} (expected 2: amfe + cp)`);

// Count total families
const { data: allFams } = await sb.from('product_families').select('id, name');
console.log(`\n  Total familias: ${allFams.length}`);
for (const f of allFams) console.log(`    ${f.id}: ${f.name}`);

const allOk = !hasOp10 && !hasOp10Items && vAmfeData.operations.length === 1 && vCpData.items.length === cpOp10Items.length && famLinks.length === 2;
console.log(`\n  ${allOk ? 'VERIFICACION OK' : 'ATENCION — revisar manualmente'}`);

// Save after state
writeFileSync(`${backupDir}/logistics_amfe.json`, JSON.stringify(vAmfeData, null, 2));
writeFileSync(`${backupDir}/logistics_cp.json`, JSON.stringify(vCpData, null, 2));
writeFileSync(`${backupDir}/inj_amfe_after.json`, JSON.stringify(vInjAmfeData, null, 2));
writeFileSync(`${backupDir}/inj_cp_after.json`, JSON.stringify(vInjCpData, null, 2));
writeFileSync(`${backupDir}/idMap.json`, JSON.stringify(Object.fromEntries(idMap), null, 2));
console.log(`  Estado guardado en: ${backupDir}`);
