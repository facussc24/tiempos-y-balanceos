/**
 * _corregirControlesVarillaTraseros.mjs — saca de la OP41 unos controles que son de EMBALAJE.
 *
 * QUE ESTA MAL (verificado contra Supabase live el 23/08/2026)
 * En los AMFE 153 y 155 (apoyacabezas traseros), la OP41 INSERCION DE VARILLA tiene el modo
 * de falla "2- Varilla desalineada" con estos dos controles:
 *
 *     prevencion: "Estandar visual con foto de referencia indicando la CANTIDAD POR MEDIO,
 *                  visible en el puesto de trabajo."
 *     deteccion : "Verificacion visual del MEDIO COMPLETO antes del cierre"
 *
 * Eso no detecta una varilla desalineada: es control de EMBALAJE (cuantas piezas entran por
 * medio). Y no hay que deducirlo — el MISMO texto, palabra por palabra, esta en la OP80
 * EMBALAJE Y ETIQUETADO de los dos AMFE, en el modo de falla "Colocacion de mayor o menor
 * cantidad de piezas por medio", que es donde corresponde. En la OP41 es un copy-paste
 * filtrado.
 *
 * POR QUE VA TBD Y NO EL CONTROL DEL DELANTERO
 * El AMFE 151 tiene para la misma falla: prevencion "Uso de guias de posicionamiento" y
 * deteccion "Poka-Yoke preventivo en estacion (Sensor verifica alineacion...)". Copiarlo
 * seria inventar dos veces: (a) nadie confirmo que el puesto de los traseros tenga esas
 * guias, y (b) el propio sensor del delantero esta sin confirmar — su deteccion quedo en
 * D=5, que es alta para un poka-yoke, asi que o el sensor no existe o la D esta mal.
 *
 * Un control equivocado es un DATO FALSO en un documento que va al cliente; un TBD es un
 * hueco visible. Entre los dos gana el hueco (regla core-prohibiciones §1, leccion del
 * 21/08: "un control incompleto es un hueco; uno con alcance inventado es un dato falso").
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();

const AFECTADOS = ['AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const OP = '41';
const FM = /varilla desalineada/i;

const TBD_PREV = 'TBD — definir el control de prevencion de la alineacion de la varilla en el puesto';
const TBD_DET = 'TBD — definir el control de deteccion de la varilla desalineada en el puesto';

// Lo que tiene que estar HOY para pisarlo (chequeo anti-escritura a ciegas).
const ES_DE_EMBALAJE = /cantidad por medio|medio completo/i;

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents')
  .select('id, amfe_number, project_name, data').in('amfe_number', AFECTADOS);
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 2) { console.error(`Esperaba 2 AMFE, vinieron ${rows.length} — abortar`); process.exit(1); }

const plan = [], pendientes = [];

for (const row of rows.sort((a, b) => a.amfe_number.localeCompare(b.amfe_number))) {
  const antes = typeof row.data === 'string' ? JSON.parse(row.data) : structuredClone(row.data);
  const doc = JSON.parse(JSON.stringify(antes));

  const op = (doc.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
  if (!op) { console.error(`${row.amfe_number}: no existe la OP${OP} — abortar`); process.exit(1); }

  let tocadas = 0;
  for (const we of (op.workElements ?? [])) for (const fn of (we.functions ?? [])) {
    for (const fm of (fn.failures ?? [])) {
      if (!FM.test(String(fm.description ?? ''))) continue;
      for (const c of (fm.causes ?? [])) {
        const prev = String(c.preventionControl ?? ''), det = String(c.detectionControl ?? '');
        // Solo se pisa si de verdad es el texto de embalaje. Si alguien ya lo arreglo, no toco.
        if (!ES_DE_EMBALAJE.test(prev) && !ES_DE_EMBALAJE.test(det)) continue;
        console.log(`\n  ${row.amfe_number} OP${OP} — FM "${fm.description}" (S=${fm.severity})`);
        console.log(`     prevencion ANTES : ${prev}`);
        console.log(`     prevencion AHORA : ${TBD_PREV}`);
        console.log(`     deteccion  ANTES : ${det}`);
        console.log(`     deteccion  AHORA : ${TBD_DET}`);
        c.preventionControl = TBD_PREV;
        c.detectionControl = TBD_DET;
        tocadas++;
      }
    }
  }

  if (!tocadas) { console.log(`\n  ${row.amfe_number}: nada que corregir (ya esta limpio)`); continue; }

  // Invariante: no se agrega ni se saca nada, solo cambia el texto de 2 campos por causa.
  const cuenta = d => (d.operations ?? []).flatMap(o => o.workElements ?? [])
    .flatMap(w => w.functions ?? []).flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
  if (cuenta(antes) !== cuenta(doc)) { console.error(`${row.amfe_number}: cambio la cantidad de causas — abortar`); process.exit(1); }

  plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
  pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(doc) });
}

if (!plan.length) { console.log('\n  Nada que cambiar.'); process.exit(0); }

await runWithValidation(plan, APLICAR, async () => {
  for (const p of pendientes) {
    const { error: e } = await sb.from('amfe_documents')
      .update({ data: p.data, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }

    // Releer de la base: la verdad es lo guardado, no lo planificado.
    const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', p.id).single();
    const doc = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
    const op = (doc.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
    const quedan = (op.workElements ?? []).flatMap(w => w.functions ?? [])
      .flatMap(f => f.failures ?? []).filter(fm => FM.test(String(fm.description ?? '')))
      .flatMap(fm => fm.causes ?? [])
      .filter(c => ES_DE_EMBALAJE.test(`${c.preventionControl ?? ''} ${c.detectionControl ?? ''}`)).length;
    if (quedan) { console.error(`${p.amfeNumber}: quedan ${quedan} controles de embalaje en la OP${OP}`); process.exit(1); }
    console.log(`  ${p.amfeNumber}: OK — OP${OP} sin controles de embalaje`);
  }
});
