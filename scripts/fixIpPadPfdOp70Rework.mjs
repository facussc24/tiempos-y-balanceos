/**
 * OP 70 ADHESIVADO en el PFD IP PAD tiene rejectDisposition='rework' +
 * reworkReturnStep='OP 70' — es un rework a si mismo, sin sentido logico.
 * El retrabajo real se dispara desde la decision "PRODUCTO CONFORME?"
 * (rework_or_scrap). Lo limpiamos.
 */
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData, readPfd, savePfd } from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const PFD_ID = 'pfd-ippads-trim-asm-upr-wrapping';

const { doc } = await readPfd(sb, PFD_ID);
const op70 = doc.steps.find(s => s.stepNumber === 'OP 70' && s.description === 'ADHESIVADO');
if (!op70) { console.error('OP 70 no encontrado'); process.exit(1); }

logChange(apply, 'CLEAR OP 70 ADHESIVADO rework disposition', {
  before: `reject=${op70.rejectDisposition} returnTo="${op70.reworkReturnStep}"`,
  after: 'reject=none returnTo=""',
});

op70.rejectDisposition = 'none';
op70.reworkReturnStep = '';

if (apply) {
  await savePfd(sb, PFD_ID, doc, { extraFields: { updated_at: new Date().toISOString() } });
  const { data: v } = await sb.from('pfd_documents').select('data').eq('id', PFD_ID).single();
  const dv = parseData(v.data);
  const check = dv.steps.find(s => s.stepNumber === 'OP 70' && s.description === 'ADHESIVADO');
  console.log('Post: reject=' + check.rejectDisposition + ' returnTo="' + check.reworkReturnStep + '"');
}
finish(apply);
