/**
 * Sincroniza columnas operation_count y cause_count contra el conteo real del JSON data.
 *
 * Aplica a master inyeccion + 4 variantes. Verifica los 5 por las dudas.
 *
 * NO toca data. Solo actualiza columnas de metadata.
 *
 * Uso:
 *   node scripts/_fixInjectionMetadataSync.mjs           # dry-run
 *   node scripts/_fixInjectionMetadataSync.mjs --apply
 */
import { connectSupabase } from './_lib/amfeIo.mjs';
import { parseSafeArgs, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const TARGETS = ['AMFE-MAESTRO-INY-001', 'AMFE-INS-PAT', 'VWA-PAT-IPPADS-001', 'AMFE-ARM-PAT', 'AMFE-TR-PAT'];

const { data: docs } = await sb.from('amfe_documents')
  .select('id, amfe_number, data, operation_count, cause_count')
  .in('amfe_number', TARGETS);

const updates = [];
for (const doc of docs) {
  const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
  let realOps = 0;
  let realCauses = 0;
  for (const op of d.operations || []) {
    realOps++;
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const f of fn.failures || []) {
          for (const _c of f.causes || []) realCauses++;
        }
      }
    }
  }
  const opMismatch = doc.operation_count !== realOps;
  const causeMismatch = doc.cause_count !== realCauses;

  console.log(`${doc.amfe_number}:`);
  console.log(`  ops:    stored=${doc.operation_count}  real=${realOps}  ${opMismatch ? '→ FIX' : '✓'}`);
  console.log(`  causes: stored=${doc.cause_count}  real=${realCauses}  ${causeMismatch ? '→ FIX' : '✓'}`);

  if (opMismatch || causeMismatch) {
    updates.push({ id: doc.id, amfe_number: doc.amfe_number, operation_count: realOps, cause_count: realCauses });
  }
}

console.log(`\n=== ${updates.length} doc(s) a actualizar ===`);

if (apply && updates.length > 0) {
  for (const u of updates) {
    const { error } = await sb.from('amfe_documents')
      .update({ operation_count: u.operation_count, cause_count: u.cause_count })
      .eq('id', u.id);
    if (error) { console.error(`  ✗ ${u.amfe_number}: ${error.message}`); continue; }
    console.log(`  ✓ ${u.amfe_number} sincronizado`);
  }
}

finish(apply);
