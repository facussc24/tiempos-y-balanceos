import { connectSupabase, parseData } from './_lib/amfeIo.mjs';
const sb = await connectSupabase();

// PFD IP PAD
const { data: pfds } = await sb.from('pfd_documents').select('*').eq('part_number', '2HC.858.417.B FAM');
let target;
if (pfds && pfds.length) {
  target = pfds[0];
} else {
  // Try by part_name
  const { data: byName } = await sb.from('pfd_documents').select('*').ilike('part_name', '%IP PAD%');
  if (byName && byName.length) target = byName[0];
}
if (!target) {
  const { data: allP } = await sb.from('pfd_documents').select('id, part_number, part_name, document_number');
  console.log('NO match, all pfds:');
  for (const p of allP || []) console.log(`  ${p.id} | ${p.part_number} | ${p.part_name} | ${p.document_number}`);
  process.exit(1);
}

console.log('PFD id:', target.id);
console.log('part_number:', target.part_number);
console.log('part_name:', target.part_name);
console.log('document_number:', target.document_number);
console.log('revision_level:', target.revision_level);
console.log('customer_name:', target.customer_name);
console.log('step_count:', target.step_count);

const d = parseData(target.data);
console.log('\nheader:', JSON.stringify(d.header, null, 2).substring(0, 1000));

console.log('\nsteps keys first:', Object.keys((d.steps || [])[0] || {}).join(', '));
console.log('\nsteps:');
for (const s of d.steps || []) {
  const label = s.label || s.description || s.operationName || s.processStep;
  const num = s.opNumber || s.operationNumber || s.number || s.processStepNumber;
  const kind = s.kind || s.type || s.shape;
  console.log(`  [${kind}] #${num} ${label}`);
}
console.log('\nnodes:');
for (const n of d.nodes || []) {
  const label = n.label || n.description || n.name;
  const num = n.opNumber || n.operationNumber;
  const kind = n.kind || n.type;
  console.log(`  [${kind}] #${num} ${label}`);
}
console.log('sample step:');
console.log(JSON.stringify(d.steps?.[3] || d.nodes?.[3] || 'none', null, 2).substring(0, 1500));
