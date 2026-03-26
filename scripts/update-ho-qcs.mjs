/**
 * Update HO QCs after CP reclassification:
 * 1. Remove QCs whose cpItemId points to a deleted CP item
 * 2. Add 1 generic QC per operation for grouped L items
 * 3. Remove QCs with evaluationTechnique containing audit/dimensional keywords
 *    (those are not executed by the operator at the station)
 *
 * DRY RUN by default. Pass --commit to write.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const URL = 'https://fbfsbbewmgoegjgnkkag.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnNiYmV3bWdvZWdqZ25ra2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTI4NDksImV4cCI6MjA4OTA4ODg0OX0.YKHwbbwcnqNCnxFMSyeoM6VzZgvGuIctVSfdMNyQfL4';
const HO_ID = '18dc1704-b632-4d49-bff8-5a8eee3fdb33';
const dryRun = !process.argv.includes('--commit');

const tmp = process.env.TEMP || '/tmp';
const removedCpIds = JSON.parse(readFileSync(join(tmp, 'cp_removed_ids.json'), 'utf8'));
const genericItems = JSON.parse(readFileSync(join(tmp, 'cp_generic_items.json'), 'utf8'));
// genericItems: { opNumber: newGenericCpItemId }

const removedSet = new Set(removedCpIds);
console.log(`Loaded: ${removedSet.size} removed CP IDs, ${Object.keys(genericItems).length} generic items`);

const supabase = createClient(URL, KEY);
await supabase.auth.signInWithPassword({ email: 'admin@barack.com', password: 'U3na%LNSYVmVCYvP' });

const { data: hoRows } = await supabase.from('ho_documents').select('data').eq('id', HO_ID);
const ho = JSON.parse(hoRows[0].data);
const sheets = ho.sheets || [];

console.log(`HO loaded: ${sheets.length} sheets`);

// Audit/dimensional keywords to filter
const auditKeywords = [
  'auditoria', 'auditoría', 'audit',
  'control dimensional', 'dimensional',
  'metrologia', 'metrología',
  'laboratorio'
];
function isAuditTechnique(tech) {
  const t = (tech || '').toLowerCase();
  return auditKeywords.some(kw => t.includes(kw));
}

let totalQcBefore = 0;
let removedByOrphan = 0;
let removedByAudit = 0;
let genericAdded = 0;

console.log('\nPor sheet:');
console.log('Sheet | OpNum | Desc                                 | QC antes | Orphan | Audit | +Generic | QC después');
console.log('------|-------|--------------------------------------|----------|--------|-------|----------|----------');

for (const sheet of sheets) {
  const qcs = sheet.qualityChecks || [];
  const before = qcs.length;
  totalQcBefore += before;

  const opNum = sheet.operationNumber || '';
  let orphanCount = 0;
  let auditCount = 0;

  // Filter QCs
  const newQcs = [];
  for (const qc of qcs) {
    // Check if cpItemId was removed
    if (qc.cpItemId && removedSet.has(qc.cpItemId)) {
      orphanCount++;
      continue;
    }

    // Check if evaluationTechnique is audit/dimensional
    if (isAuditTechnique(qc.evaluationTechnique)) {
      auditCount++;
      continue;
    }

    newQcs.push(qc);
  }

  removedByOrphan += orphanCount;
  removedByAudit += auditCount;

  // Add generic QC if this operation had grouped items
  const genericCpId = genericItems[opNum];
  let addedGeneric = 0;
  if (genericCpId && orphanCount > 0) {
    // Only add if we actually removed orphans (meaning this op had L items grouped)
    newQcs.push({
      id: crypto.randomUUID(),
      characteristic: 'Autocontrol visual general — verificar ausencia de defectos según instrucción de trabajo',
      specification: 'Según instrucción de trabajo / HO',
      evaluationTechnique: 'Inspección visual',
      frequency: 'Continuo',
      controlMethod: 'Autocontrol del operador',
      reactionAction: 'Contener producto sospechoso. Notificar a Líder.',
      reactionContact: 'Operador de producción',
      specialCharSymbol: '',
      registro: '',
      cpItemId: genericCpId
    });
    addedGeneric = 1;
    genericAdded++;
  }

  sheet.qualityChecks = newQcs;

  const after = newQcs.length;
  if (orphanCount > 0 || auditCount > 0 || addedGeneric > 0) {
    const desc = (sheet.operationName || sheet.title || '').substring(0, 36);
    console.log(`${String(sheets.indexOf(sheet)).padStart(5)} | ${opNum.padEnd(5)} | ${desc.padEnd(37)}| ${String(before).padStart(8)} | ${String(orphanCount).padStart(6)} | ${String(auditCount).padStart(5)} | ${String(addedGeneric).padStart(8)} | ${String(after).padStart(9)}`);
  }
}

let totalQcAfter = 0;
sheets.forEach(s => totalQcAfter += (s.qualityChecks || []).length);

console.log(`\n${'='.repeat(60)}`);
console.log(`  RESUMEN HO`);
console.log(`${'='.repeat(60)}`);
console.log(`  QCs ANTES:     ${totalQcBefore}`);
console.log(`  QCs DESPUÉS:   ${totalQcAfter}`);
console.log(`  Eliminados orphan: ${removedByOrphan}`);
console.log(`  Eliminados audit:  ${removedByAudit}`);
console.log(`  Genéricos añadidos: ${genericAdded}`);
console.log(`  Reducción neta: ${totalQcBefore - totalQcAfter} (${Math.round((totalQcBefore - totalQcAfter) / totalQcBefore * 100)}%)`);
console.log(`${'='.repeat(60)}`);

if (dryRun) {
  console.log('\n[DRY RUN] No changes written. Pass --commit to apply.');
} else {
  ho.sheets = sheets;

  const { error } = await supabase.from('ho_documents').update({
    data: JSON.stringify(ho),
    sheet_count: sheets.length,
    updated_at: new Date().toISOString()
  }).eq('id', HO_ID);

  if (error) { console.error('UPDATE FAILED:', error); process.exit(1); }
  console.log('\nHO actualizado en Supabase OK');
}

await supabase.auth.signOut();
