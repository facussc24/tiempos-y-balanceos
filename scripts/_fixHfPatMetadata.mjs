/**
 * Fix metadata desync del AMFE-HF-PAT tras renumeracion del 2026-05-14.
 * Las columnas cache quedaron en 14 cuando data.operations.length es 16.
 */
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import { connectSupabase, readAmfe } from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const AMFE_ID = '10eaebce-ad87-4035-9343-3e20e4ee0fc9';

const { doc, row } = await readAmfe(sb, AMFE_ID);
const opsCount = doc.operations.length;
let causesCount = 0;
let apH = 0, apM = 0;
for (const op of doc.operations) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        for (const c of (fm.causes || [])) {
          causesCount++;
          if (c.ap === 'H') apH++;
          else if (c.ap === 'M') apM++;
        }
      }
    }
  }
}

logChange(apply, `UPDATE metadata AMFE ${AMFE_ID}`, {
  operation_count: `${row.operation_count} -> ${opsCount}`,
  cause_count: `${row.cause_count} -> ${causesCount}`,
  ap_h_count: apH,
  ap_m_count: apM,
});

if (apply) {
  const { error } = await sb.from('amfe_documents').update({
    operation_count: opsCount,
    cause_count: causesCount,
    ap_h_count: apH,
    ap_m_count: apM,
    updated_at: new Date().toISOString(),
  }).eq('id', AMFE_ID);
  if (error) { console.error('UPDATE err:', error); process.exit(1); }
  console.log('Metadata actualizada.');
}
finish(apply);
