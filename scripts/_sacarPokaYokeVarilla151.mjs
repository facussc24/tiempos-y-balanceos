/**
 * _sacarPokaYokeVarilla151.mjs — saca del AMFE 151 un control que no existe en el puesto.
 *
 * QUE SE SACA
 * AMFE-HF-PAT (151, apoyacabezas delantero), OP41 INSERCION DE VARILLA, modo de falla
 * "2- Varilla desalineada", control de DETECCION:
 *
 *   "Poka-Yoke preventivo en estacion (Sensor verifica alineacion y correcta colocacion
 *    de la varilla antes de iniciar el proceso)."
 *
 * POR QUE
 * Fak, 24/08/2026: *"sacalo por favor directamente eliminalo"*. Decidido despues de mirar
 * la evidencia:
 *
 *  1. El texto NO es invento: sale palabra por palabra de un documento real de Barack —
 *     `...\Headrest\APQP\35- Plan de desarrollo o de plazos\QTR\C.4\
 *      AMFE - Apoyacabezas delantero Preliminar Rev.1 - Patagonia.xlsx`, hoja
 *     `Apoyacabezas`, celda **M428**. Ese archivo se titula "A.M.F.E. PRELIMINAR",
 *     emision inicial, y tiene TRES poka-yokes (M411 sensor de union del EPP, M428 este,
 *     M445 temporizador). Al AMFE vivo solo paso este.
 *  2. El PLAN DE CONTROL del apoyacabezas delantero — el documento que dice que se
 *     controla en produccion — no lo tiene: 0 ocurrencias de "sensor", 0 de "varilla".
 *     Su unico "Poka Yoke" es otro (seleccionar el programa de inyeccion segun el molde)
 *     y es control VISUAL del operador.
 *  3. La deteccion estaba en D=5. Un poka-yoke que frena el proceso antes de arrancar es
 *     a prueba de error y se puntua 1-2; el texto y el numero se contradecian.
 *
 * QUE QUEDA EN SU LUGAR
 * TBD, igual que en los traseros 153/155 (script `_corregirControlesVarillaTraseros.mjs`).
 * NO se inventa un control de reemplazo: cual es el control real del puesto lo define Fak.
 * S/O/D NO se tocan — cambiar la D sin saber el control real seria inventar un numero, y
 * ademas mueve el AP. Queda reportado para que Fak lo decida.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();

const AMFE = 'AMFE-HF-PAT';
const OP = '41';
const FM = /varilla desalineada/i;
const ES_EL_SENSOR = /poka[\s-]*yoke|sensor/i;
const TBD_DET = 'TBD — definir el control de deteccion de la varilla desalineada en el puesto';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents')
  .select('id, amfe_number, project_name, data').eq('amfe_number', AMFE);
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 1) { console.error(`Esperaba 1 AMFE, vinieron ${rows.length} — abortar`); process.exit(1); }

const row = rows[0];
const antes = typeof row.data === 'string' ? JSON.parse(row.data) : structuredClone(row.data);
const doc = JSON.parse(JSON.stringify(antes));

const op = (doc.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
if (!op) { console.error(`${AMFE}: no existe la OP${OP} — abortar`); process.exit(1); }

let tocadas = 0;
for (const we of (op.workElements ?? [])) for (const fn of (we.functions ?? [])) {
  for (const fm of (fn.failures ?? [])) {
    if (!FM.test(String(fm.description ?? ''))) continue;
    for (const c of (fm.causes ?? [])) {
      const det = String(c.detectionControl ?? '');
      if (!ES_EL_SENSOR.test(det)) continue;   // solo se pisa si de verdad es el sensor
      console.log(`\n  ${AMFE} OP${OP} — FM "${fm.description}" (S=${fm.severity})`);
      console.log(`     causa            : ${c.cause}`);
      console.log(`     deteccion ANTES  : ${det}`);
      console.log(`     deteccion AHORA  : ${TBD_DET}`);
      console.log(`     prevencion       : ${c.preventionControl}   (NO se toca)`);
      console.log(`     S=${fm.severity} O=${c.occurrence} D=${c.detection} AP=${c.actionPriority ?? c.ap}   (NO se tocan)`);
      c.detectionControl = TBD_DET;
      tocadas++;
    }
  }
}

if (!tocadas) { console.log(`\n  ${AMFE}: no se encontro el sensor en la OP${OP} (ya esta limpio).`); process.exit(0); }

// Invariante: no se agrega ni se saca nada, solo cambia un texto.
const cuenta = d => (d.operations ?? []).flatMap(o => o.workElements ?? [])
  .flatMap(w => w.functions ?? []).flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
if (cuenta(antes) !== cuenta(doc)) { console.error('cambio la cantidad de causas — abortar'); process.exit(1); }

const plan = [{ id: row.id, amfeNumber: AMFE, productName: row.project_name, before: antes, after: doc }];

await runWithValidation(plan, APLICAR, async () => {
  const { error: e } = await sb.from('amfe_documents')
    .update({ data: JSON.stringify(doc), updated_at: new Date().toISOString() }).eq('id', row.id);
  if (e) { console.error(e.message); process.exit(1); }

  // Releer de la base: la verdad es lo guardado.
  const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
  const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
  let quedan = 0;
  for (const o of (live.operations ?? [])) for (const we of (o.workElements ?? []))
    for (const fn of (we.functions ?? [])) for (const fm of (fn.failures ?? []))
      for (const c of (fm.causes ?? []))
        if (ES_EL_SENSOR.test(String(c.detectionControl ?? '')) && FM.test(String(fm.description ?? ''))) quedan++;
  if (quedan) { console.error(`quedan ${quedan} menciones del sensor — abortar`); process.exit(1); }
  console.log(`  ${AMFE}: OK — el sensor ya no esta en la OP${OP}`);
});
