// node scripts/_cpTelasHiluxCorrecciones.mjs [--apply]
// Correcciones con fuente a los planes de control de telas Hilux (09/10/2026), despues de la revision
// fila por fila contra los planes de Calidad (PC PWA.xlsx, Cecilia Rodriguez) y la HO 984.
// Solo lo que tiene papel; lo demas queda en la lista para revisar con Fak.
//   - Responsables como los pone Calidad (PC PWA.xlsx hoja 21-6621 f.47-88): recepcion = Inspector de
//     recepcion de materiales; flamabilidad = Laboratorio interno; proceso = Operador de produccion;
//     control final y embalaje = Inspector de calidad.
//   - Flamabilidad: ensayo en camara MC184 por lote (PC PWA f.50; el propio AMFE dice ensayo por lote).
//   - "±2mm" sin fuente -> ±3 mm (AMFE 157 f.69; HO 984 hoja 70) o "Conforme a plano".
//   - Filas sin respaldo que se sacan: resistencia de costura por traccion (planas) y espesor del
//     termoformado (ni el AMFE ni la HO lo piden).
//   - Termoformado: horno 150 °C ±20 °C, 60 s (HO 984 hoja 20); embalaje 20 piezas por bolsa (HO 984 hoja 90).
import { connectSupabase, parseData, saveCp } from './_lib/amfeIo.mjs';
const apply = process.argv.includes('--apply');
const sb = await connectSupabase();
const n = (s) => parseInt(String(s).replace(/^OP\s*/i, ''), 10) || 0;

const PLANES = {
  '332bcdda-a7d8-4d28-a41d-3961472ccb0e': { final: 80, embalaje: 110 },
  '85fd046d-a3bd-4de1-a9f9-d2fd51466999': { final: 100, embalaje: 110 },
};
for (const [id, cfg] of Object.entries(PLANES)) {
  const { data } = await sb.from('cp_documents').select('project_name,data').eq('id', id).single();
  const doc = parseData(data.data);
  const log = [];
  const set = (it, k, v) => { if (it[k] !== v) { log.push(`${it.processStepNumber} | ${it.productCharacteristic} | ${k}: "${it[k] ?? ''}" -> "${v}"`); it[k] = v; } };
  const borrar = [];
  for (const it of doc.items) {
    const op = n(it.processStepNumber);
    const pc = it.productCharacteristic || '';
    // responsables
    if (op === 10) set(it, 'reactionPlanOwner', /flamab/i.test(pc) ? 'Laboratorio interno' : 'Inspector de recepción de materiales');
    else if (op === cfg.final || op === cfg.embalaje) set(it, 'reactionPlanOwner', 'Inspector de calidad');
    else set(it, 'reactionPlanOwner', 'Operador de producción');
    // flamabilidad
    if (op === 10 && /flamab/i.test(pc)) {
      set(it, 'specification', '< 100 mm/min (FMVSS 302)');
      set(it, 'evaluationTechnique', 'Cámara de flamabilidad (MC184)');
      set(it, 'sampleSize', '1 muestra');
      set(it, 'sampleFrequency', 'Por lote de entrega');
      set(it, 'controlMethod', 'P-10/I / ARB');
      set(it, 'reactionPlan', 'Rechazar lote s/ P-14');
    }
    // tolerancias sin fuente
    if (/±\s*2\s*mm/i.test(it.specification || '')) {
      set(it, 'specification', op === cfg.final && data.project_name.includes('TERMO') ? 'Conforme a plano' : it.specification.replace(/±\s*2\s*mm/i, '±3 mm'));
    }
    // filas sin respaldo
    if (/resistencia de costura/i.test(pc) || (op === 40 && /^espesor$/i.test(pc.trim()))) borrar.push(it);
    // termoformado y embalaje (HO 984)
    if (data.project_name.includes('TERMO')) {
      if (op === 40 && /forma 3d/i.test(pc)) {
        set(it, 'specification', 'Horno 150 °C ±20 °C, 60 s de calentamiento');
        set(it, 'evaluationTechnique', 'Verificación de parámetros vs hoja de set-up');
        set(it, 'sampleSize', '1 pieza');
        set(it, 'sampleFrequency', 'Inicio de turno');
        set(it, 'controlMethod', 'Autocontrol');
      }
      if (op === cfg.embalaje && /cantidad embalada/i.test(pc)) set(it, 'specification', '20 piezas por bolsa');
    }
  }
  for (const b of borrar) { log.push(`${b.processStepNumber} | ${b.productCharacteristic} | FILA SACADA (sin fuente)`); doc.items.splice(doc.items.indexOf(b), 1); }
  console.log(data.project_name, `(${doc.items.length} filas)`); for (const l of log) console.log('  ', l);
  if (apply && log.length) { await saveCp(sb, id, doc, { extraFields: { item_count: doc.items.length } }); console.log('  guardado'); }
}
process.exit(0);
