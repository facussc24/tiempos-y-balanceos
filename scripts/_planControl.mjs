/**
 * _planControl.mjs — arma la BASE PRELIMINAR del plan de control de una pieza (JSON intermedio +
 * reporte en markdown) y corre sus gates. P6 etapa 1 (plan `docs/PLAN_P6_PLANES_DE_CONTROL_2026-10-10.md` §7.4).
 *
 * Uso:
 *   node scripts/_planControl.mjs APB                       # lee el AMFE de Supabase (solo lectura)
 *   node scripts/_planControl.mjs APB --amfe-json <ruta>    # AMFE desde un JSON ya bajado (sin Supabase)
 *   node scripts/_planControl.mjs APB --sin-ho              # prueba de mutacion: sin la HO en las entradas
 *   node scripts/_planControl.mjs APB --vinculos <json>     # tabla causa -> fila (p. ej. la de prueba de los tests)
 *
 * Etapa 2 (planControlAmfe.mjs): propuesta de siglas en hoja aparte (propuesta_siglas.md), gate 3
 * (la columna solo se copia del AMFE), gate 7 (control final), gate 8 (AMFE <-> plan) y los seis
 * chequeos del §7.6.
 *   node scripts/_planControl.mjs APB --out <carpeta>       # por defecto exports/PLAN_CONTROL_<pieza>_<AAAAMMDD>/
 *
 * Que NO hace: no escribe en Supabase (el cliente es el de solo lectura: un update tira), no genera
 * el .xls (etapa 3), no asigna siglas (etapa 2), no manda nada a Calidad. Sale con 0 si ningun gate
 * frena, 1 si alguno frena, 2 si falta una entrada.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  leerEntradas, leerFlujograma, leerAmfe, leerHoXlsx, leerBomXlsx, leerPlanExistenteXls,
} from './_lib/planControlFuentes.mjs';
import { armarPlan, correrGates, compararConPlanExistente, reporteMarkdown, FRENO } from './_lib/planControlCheck.mjs';
import { correrEtapa2, reporteEtapa2, propuestaMarkdown } from './_lib/planControlAmfe.mjs';

function arg(nombre) { const i = process.argv.indexOf(nombre); return i > 0 ? process.argv[i + 1] : ''; }
const tiene = (nombre) => process.argv.includes(nombre);

async function amfeVivo(entradas) {
  const { conectarSoloLectura } = await import('./_lib/supabaseSoloLectura.mjs');
  const { parseData } = await import('./_lib/amfeIo.mjs');
  const sb = await conectarSoloLectura();
  const { data, error } = await sb.from('amfe_documents').select('id, amfe_number, project_name, revision_level, updated_at, data');
  if (error) throw new Error(`no pude leer amfe_documents: ${error.message}`);
  const filas = (data || []).filter((d) => d.amfe_number === entradas.amfe.amfe_number);
  if (!filas.length) throw new Error(`el AMFE ${entradas.amfe.amfe_number} no esta en Supabase (hay ${(data || []).length} AMFE)`);
  if (filas.length > 1) throw new Error(`hay ${filas.length} AMFE con amfe_number ${entradas.amfe.amfe_number} (${filas.map((f) => `${f.id} ${f.updated_at}`).join(' · ')}): no decido cual es el vigente`);
  const fila = filas[0];
  console.log(`AMFE ${fila.amfe_number} (${fila.project_name}) rev ${fila.revision_level} · updated_at ${fila.updated_at} [Supabase: amfe_documents.id=${fila.id}]`);
  return { doc: parseData(fila.data), meta: { id: fila.id, updatedAt: fila.updated_at, path: `Supabase live: amfe_documents.id=${fila.id}` } };
}

async function main() {
  const pieza = process.argv[2];
  if (!pieza || pieza.startsWith('--')) { console.error('Uso: node scripts/_planControl.mjs <pieza> [--amfe-json ruta] [--sin-ho] [--out carpeta]'); process.exit(2); }
  const entradas = leerEntradas(pieza);
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;   // fecha LOCAL, no UTC
  const out = arg('--out') || path.join('exports', `PLAN_CONTROL_${pieza}_${fecha}`);

  const flujograma = leerFlujograma(entradas.flujograma);
  // --amfe-json: un AMFE ya bajado y parseado ({ doc } o el doc pelado); no pasa por parseData()
  let amfeDoc = arg('--amfe-json') ? JSON.parse(fs.readFileSync(arg('--amfe-json'), 'utf8')) : await amfeVivo(entradas);
  // tambien vale una fila de Supabase tal cual ({ data: '<json>' }): se desarma con parseData()
  if (amfeDoc.data !== undefined && !amfeDoc.doc) { const { parseData } = await import('./_lib/amfeIo.mjs'); amfeDoc = { doc: parseData(amfeDoc.data) }; }
  const amfe = leerAmfe(amfeDoc.doc || amfeDoc, { numeroCasa: entradas.amfe?.numeroCasa || '' });
  if (!amfe.causas.length) { console.error(`El AMFE leido no tiene ninguna causa (${amfe.operations.length} operaciones): el archivo no tiene la forma esperada ({ doc: { operations } }, el doc pelado, o una fila con data). No sigo.`); process.exit(2); }
  amfe.meta = amfeDoc.meta || { path: arg('--amfe-json') ? `JSON: ${arg('--amfe-json')}` : '' };
  const ho = tiene('--sin-ho') || !fs.existsSync(entradas.ho?.path || '') ? null : await leerHoXlsx(entradas.ho.path, { doc: entradas.ho.doc });
  if (!ho) console.log(tiene('--sin-ho') ? 'HO: fuera de las entradas (--sin-ho)' : `HO: no se encontro ${entradas.ho?.path}: todo lo que venia de ahi queda TBD`);
  const bom = fs.existsSync(entradas.bom?.path || '') ? leerBomXlsx(entradas.bom.path, entradas.codigos, { hoja: entradas.bom.hoja }) : null;
  if (!bom) console.log(`BOM: no se encontro ${entradas.bom?.path}`);
  const planExistente = entradas.planExistente && fs.existsSync(entradas.planExistente.path) ? leerPlanExistenteXls(entradas.planExistente.path, { hoja: entradas.planExistente.hoja }) : null;
  if (planExistente) planExistente.doc = entradas.planExistente.doc || planExistente.doc;

  // --vinculos: una tabla causa -> fila ({ causaAFila: [...] }) en vez de la de las entradas (p. ej. una de prueba)
  if (arg('--vinculos')) {
    const v = JSON.parse(fs.readFileSync(arg('--vinculos'), 'utf8'));
    entradas.vinculos = { causaAFila: v.causaAFila || [] };
    console.log(`Vinculos: ${entradas.vinculos.causaAFila.length} de ${arg('--vinculos')}${v._doc ? ` (${String(v._doc).slice(0, 80)})` : ''}`);
  }

  const plan = armarPlan({ flujograma, amfe, ho, bom, planExistente, entradas });
  const comparacion = planExistente ? compararConPlanExistente(plan, planExistente) : null;
  const etapa2 = correrEtapa2(plan, { planExistente, comparacion });
  const hallazgos = [...correrGates(plan, { planExistente }), ...etapa2.hallazgos];

  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'plan.json'), JSON.stringify({ ...plan, etapa2: { propuestaResumen: etapa2.propuesta.resumen, cruce: etapa2.cruce } }, null, 1));
  // el reporte lleva TODOS los hallazgos (etapa 1 y 2) en una sola lista: el encabezado cuenta lo mismo que la consola
  fs.writeFileSync(path.join(out, 'reporte.md'), reporteMarkdown(plan, hallazgos, comparacion, reporteEtapa2(plan, etapa2, { conHallazgos: false })));
  fs.writeFileSync(path.join(out, 'propuesta_siglas.md'), propuestaMarkdown(plan, etapa2.propuesta));
  const frenos = hallazgos.filter((x) => x.nivel === FRENO);
  console.log(`${plan.items.length} filas · ${plan.pendientes.length} pendientes · ${frenos.length} FRENO · ${hallazgos.length - frenos.length} AVISO`);
  const r = etapa2.propuesta.resumen;
  console.log(`Siglas: ${plan.items.filter((i) => i.classification.length).length} fila(s) con sigla copiada del AMFE · propuesta (hoja aparte): ${r.conSigla} causas con sigla, ${r.siglaFueraDeRegla} fuera de regla, ${r.candidatasSinSigla} candidatas sin sigla`);
  const nEstado = (e) => etapa2.cruce.pares.filter((p) => p.estado === e).length;
  console.log(`Gate 8: ${etapa2.cruce.pares.length ? `OK ${nEstado('OK')} · GENERICO ${nEstado('GENERICO')} · DIFERENTE ${nEstado('DIFERENTE')} · FILA SIN METODO ${nEstado('FILA SIN METODO')}` : 'NO EVALUADO (sin vinculos)'} · SIN FILA ${etapa2.cruce.sinFila.length} · SIN CAUSA ${etapa2.cruce.sinCausa.length}`);
  if (comparacion) console.log(`Contra ${comparacion.doc}: faltan ${comparacion.faltan.length} operaciones (${comparacion.faltan.map((x) => x.split(' ')[0]).join(', ')}), ${comparacion.sinValor.length} filas sin valor, ${comparacion.setUpAjeno.length} set up con texto ajeno`);
  for (const f of frenos) console.log(`  FRENO ${f.gate} OP ${f.op}: ${f.mensaje}`);
  console.log(`Salida: ${path.join(out, 'plan.json')}, ${path.join(out, 'reporte.md')} y ${path.join(out, 'propuesta_siglas.md')}`);
  process.exit(frenos.length ? 1 : 0);
}

main().catch((e) => { console.error(e.message); process.exit(2); });
