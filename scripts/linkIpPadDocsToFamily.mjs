/**
 * linkIpPadDocsToFamily.mjs
 *
 * Linkea AMFE y PFD existentes del IP PAD a la familia recien creada
 * (family_id=17) via family_documents. Sin esto, la UI del dashboard
 * muestra "Sin documento" en el exportador APQP.
 *
 * Dry-run por default. --apply para ejecutar.
 */

import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import { connectSupabase } from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const FAMILY_ID = 17;
const LINKS = [
  { module: 'amfe', document_id: 'c9b93b84-f804-4cd0-91c1-c4878db41b97', is_master: 1 },
  { module: 'pfd', document_id: 'pfd-ippads-trim-asm-upr-wrapping', is_master: 1 },
];

for (const link of LINKS) {
  const { data: existing } = await sb.from('family_documents')
    .select('*')
    .eq('family_id', FAMILY_ID)
    .eq('module', link.module)
    .eq('document_id', link.document_id);
  if (existing && existing.length) {
    console.log(`Link ya existe: family=${FAMILY_ID} module=${link.module} doc=${link.document_id}. Skip.`);
    continue;
  }
  const row = { family_id: FAMILY_ID, module: link.module, document_id: link.document_id, is_master: link.is_master, source_master_id: null, product_id: null };
  logChange(apply, `LINK ${link.module} -> family 17`, row);
  if (apply) {
    const { error } = await sb.from('family_documents').insert(row);
    if (error) { console.error(`ERR link ${link.module}:`, error); process.exit(1); }
  }
}

if (apply) {
  const { data: all } = await sb.from('family_documents').select('*').eq('family_id', FAMILY_ID);
  console.log(`\nVerificacion: ${all?.length} links en family_id=${FAMILY_ID}`);
  for (const l of all || []) console.log(`  [${l.module}] ${l.document_id} (master=${l.is_master})`);
}

finish(apply);
