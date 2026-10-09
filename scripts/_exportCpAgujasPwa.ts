import { writeFileSync } from 'node:fs';
import { connectSupabase, parseData } from './_lib/amfeIo.mjs';
import { generateCpExcelBuffer } from '../modules/controlPlan/controlPlanExcelExport';
const OUT = 'exports/RECLAMO_AGUJAS_PWA_20261009';
const sb = await connectSupabase();
const planes: [string, string][] = [
  ['332bcdda-a7d8-4d28-a41d-3961472ccb0e', 'Plan de Control - Telas planas Hilux 21-9463 - Rev.A.xlsx'],
  ['85fd046d-a3bd-4de1-a9f9-d2fd51466999', 'Plan de Control - Telas termoformadas 582D - Rev.A.xlsx'],
];
for (const [id, nombre] of planes) {
  const { data, error } = await sb.from('cp_documents').select('data').eq('id', id).single();
  if (error) throw error;
  const doc = parseData(data.data);
  // El export ordena con parseInt("OP 10") = NaN: todas las filas quedan en 0 y salen ordenadas por material
  // (la recepcion termina al final). Para el archivo se pasa "OP 10" -> "10"; el dato en la base no cambia.
  for (const it of doc.items) it.processStepNumber = String(it.processStepNumber).replace(/^OP\s*/i, "");
  writeFileSync(`${OUT}/${nombre}`, generateCpExcelBuffer(doc));
  console.info('OK', nombre, doc.items.length, 'filas');
}
process.exit(0);
