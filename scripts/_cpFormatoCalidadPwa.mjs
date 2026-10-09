// node scripts/_cpFormatoCalidadPwa.mjs <carpeta>
// Baja los 2 planes de control de las telas Hilux (base) a JSON para armarlos en el formato de Calidad
// (scripts/_cpFormatoCalidadPwa.py). Ordena por numero de operacion.
import { writeFileSync } from 'node:fs';
import { connectSupabase, parseData } from './_lib/amfeIo.mjs';
const out = process.argv[2];
const sb = await connectSupabase();
const num = (s) => parseInt(String(s).replace(/^OP\s*/i, ''), 10) || 0;
for (const [id, clave] of [['332bcdda-a7d8-4d28-a41d-3961472ccb0e', 'planas'], ['85fd046d-a3bd-4de1-a9f9-d2fd51466999', 'termo']]) {
  const { data } = await sb.from('cp_documents').select('data').eq('id', id).single();
  const doc = parseData(data.data);
  doc.items = doc.items.map((it, i) => ({ ...it, _i: i })).sort((a, b) => num(a.processStepNumber) - num(b.processStepNumber) || a._i - b._i);
  writeFileSync(`${out}/cp_${clave}.json`, JSON.stringify(doc, null, 1));
  console.log(clave, doc.items.length);
}
process.exit(0);
