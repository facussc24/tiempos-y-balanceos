// node scripts/_agujasFieltroPwaTextos.mjs [--apply]
// Textos de las filas de agujas (09/10/2026) despues del auditor: no afirmar "cada plancha" (la
// cobertura no esta escrita: D=9) ni nombrar una instruccion con foto que todavia no existe en la
// HO; "Operador de Producción" como el resto del AMFE; tildes en las filas del plan de control.
import { connectSupabase, readAmfe, saveAmfe, parseData, saveCp } from './_lib/amfeIo.mjs';
import { runWithValidation } from './_lib/dryRunGuard.mjs';
const plan = [];
const apply = process.argv.includes('--apply');
const sb = await connectSupabase();
const REEMPLAZOS = [
  ['Verificar al tacto cada plancha de fieltro antes de troquelar', 'Verificar al tacto el fieltro antes de troquelar'],
  ['Control tactil de presencia de agujas en el fieltro al troquelar, segun instruccion de troquelado con foto', 'Control tactil de presencia de agujas en el fieltro al troquelar'],
  ['Control tactil segun instruccion de troquelado con foto', 'Control táctil'],
  ['Control tactil', 'Control táctil'],
  ['Sin agujas ni fragmentos metalicos', 'Sin agujas ni fragmentos metálicos'],
  ['Cada recepcion', 'Cada recepción'],
];
const tocar = (o, log) => { for (const k of Object.keys(o)) { const v = o[k];
  if (typeof v === 'string') { let n = v; for (const [a, b] of REEMPLAZOS) if (n === a) n = b; if (n !== v) { log.push(`${k}: "${v}" -> "${n}"`); o[k] = n; } }
  else if (v && typeof v === 'object') tocar(v, log); } };
for (const [id, num] of [['57011560-d4c1-4a8a-83f0-ed37a2bab1d5', 'AMFE-1'], ['c5201ba9-1225-4663-b7a1-5430f9ee8912', 'AMFE-2']]) {
  const { doc: before, amfe_number } = await readAmfe(sb, id); if (amfe_number !== num) throw new Error(num);
  const doc = structuredClone(before);
  const log = [];
  for (const op of doc.operations) for (const we of op.workElements) {
    if (we.name === 'Operador de produccion') { log.push(`OP${op.opNumber} WE "Operador de produccion" -> "Operador de Producción"`); we.name = 'Operador de Producción'; }
    for (const f of we.functions) if (/agujas|al tacto/i.test(JSON.stringify(f))) { const antes = log.length; tocar(f, log); if (log.length > antes) log.splice(antes, 0, `OP${op.opNumber}:`); }
  }
  console.log(num); for (const l of log) console.log('  ', l);
  if (log.length) plan.push({ id, amfeNumber: num, productName: num, before, after: doc });
}
await runWithValidation(plan, apply, async () => { for (const p of plan) { await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber }); console.log('  guardado', p.amfeNumber); } });
for (const id of ['332bcdda-a7d8-4d28-a41d-3961472ccb0e', '85fd046d-a3bd-4de1-a9f9-d2fd51466999']) {
  const { data } = await sb.from('cp_documents').select('project_name,data').eq('id', id).single();
  const doc = parseData(data.data); const log = [];
  for (const it of doc.items) if (/agujas/i.test(it.productCharacteristic)) tocar(it, log);
  console.log(data.project_name); for (const l of log) console.log('  ', l);
  if (apply && log.length) { await saveCp(sb, id, doc); console.log('  guardado'); }
}
process.exit(0);
