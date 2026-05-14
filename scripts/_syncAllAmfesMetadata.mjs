/**
 * Sincroniza metadata cache (operation_count, cause_count, ap_h_count, ap_m_count)
 * de TODOS los amfe_documents tras cambios masivos en data JSONB.
 *
 * Uso:
 *   node scripts/_syncAllAmfesMetadata.mjs --apply
 */
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import { connectSupabase } from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows } = await sb.from('amfe_documents').select('id, amfe_number, data, operation_count, cause_count, ap_h_count, ap_m_count');

for (const row of rows || []) {
  const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  if (!d || !Array.isArray(d.operations)) continue;

  const opsCount = d.operations.length;
  let causesCount = 0, apH = 0, apM = 0;
  for (const op of d.operations) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fm of (fn.failures || [])) {
          for (const c of (fm.causes || [])) {
            causesCount++;
            if ((c.ap || c.actionPriority) === 'H') apH++;
            else if ((c.ap || c.actionPriority) === 'M') apM++;
          }
        }
      }
    }
  }

  const needsUpdate = row.operation_count !== opsCount || row.cause_count !== causesCount
    || (row.ap_h_count || 0) !== apH || (row.ap_m_count || 0) !== apM;

  if (!needsUpdate) continue;

  logChange(apply, `${row.amfe_number}`, {
    ops: `${row.operation_count} -> ${opsCount}`,
    causes: `${row.cause_count} -> ${causesCount}`,
    apH: `${row.ap_h_count || 0} -> ${apH}`,
    apM: `${row.ap_m_count || 0} -> ${apM}`,
  });

  if (apply) {
    const { error } = await sb.from('amfe_documents').update({
      operation_count: opsCount,
      cause_count: causesCount,
      ap_h_count: apH,
      ap_m_count: apM,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id);
    if (error) { console.error('Error:', error); process.exit(1); }
  }
}

finish(apply);
