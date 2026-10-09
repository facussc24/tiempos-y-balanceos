// node scripts/_agujasFieltroPwaCpRetoque.mjs [--apply]
// Retoque de los 2 planes de control despues de mirarlos impresos (09/10/2026): reaccion de OP 70 que
// seguia diciendo "dots", revision vacia en el encabezado y material largo que se cortaba.
import { connectSupabase, saveCp, parseData } from './_lib/amfeIo.mjs';
const apply = process.argv.includes('--apply');
const sb = await connectSupabase();
for (const id of ['332bcdda-a7d8-4d28-a41d-3961472ccb0e', '85fd046d-a3bd-4de1-a9f9-d2fd51466999']) {
  const { data } = await sb.from('cp_documents').select('project_name,data').eq('id', id).single();
  const doc = parseData(data.data); const cambios = [];
  if (!doc.header.revision) { cambios.push(`revision "" -> "${doc.header.rev}"`); doc.header.revision = doc.header.rev; }
  for (const it of doc.items) {
    if (/dots/i.test(it.reactionPlan || '')) { const n = it.reactionPlan.replace(/dots/gi, 'aplix'); cambios.push(`${it.processStepNumber} reaccion "${it.reactionPlan}" -> "${n}"`); it.reactionPlan = n; }
    if (/agujas/i.test(it.productCharacteristic) && it.componentMaterial && it.componentMaterial !== 'Fieltro') { cambios.push(`${it.processStepNumber} material "${it.componentMaterial}" -> "Fieltro"`); it.componentMaterial = 'Fieltro'; }
  }
  console.log(data.project_name); for (const c of cambios) console.log('  ~', c);
  if (apply && cambios.length) { await saveCp(sb, id, doc); console.log('  guardado'); }
}
process.exit(0);
