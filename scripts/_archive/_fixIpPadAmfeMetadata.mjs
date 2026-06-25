/**
 * Fix metadata desync del AMFE IP PAD (operation_count + cause_count).
 * Las columnas cache quedaron en 15/? cuando data.operations.length es 17.
 */
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import { connectSupabase, readAmfe } from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const AMFE_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';

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
