import { connectSupabase } from './_lib/amfeIo.mjs';
const sb = await connectSupabase();

const { data: p } = await sb.from('projects').select('*').eq('id', 13).single();
console.log('=== projects.id=13 metadata ===');
for (const k of ['id', 'name', 'client', 'project_code', 'engineer', 'version', 'daily_demand', 'created_at', 'updated_at']) {
  console.log(`  ${k}: ${p[k]}`);
}

const d = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
console.log('\n=== meta ===');
console.log(JSON.stringify(d.meta || {}, null, 2).substring(0, 2000));

console.log('\n=== sectors ===');
for (const s of d.sectors || []) {
  console.log(`  ${s.id} | ${s.name} | tasks: ${s.taskIds?.length || 'N/A'}`);
}

console.log('\n=== tasks count ===', (d.tasks || []).length);
for (const t of d.tasks || []) {
  const tm = (t.times || []).filter(x => x != null);
  console.log(`  ${t.id} | ${t.description?.substring(0, 80)}`);
  console.log(`    times=${JSON.stringify(tm)} avg=${t.averageTime} std=${t.standardTime} cycleQty=${t.cycleQuantity || 1}`);
  if (t.modelApplicability) console.log(`    models=${JSON.stringify(t.modelApplicability)}`);
  if (t.sectorId) console.log(`    sector=${t.sectorId}`);
}
