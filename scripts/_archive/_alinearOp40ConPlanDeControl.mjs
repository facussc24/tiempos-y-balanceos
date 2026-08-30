/**
 * _alinearOp40ConPlanDeControl.mjs — la OP40 pasa a llamarse como la llama el Plan de Control,
 * y en el delantero el EPP queda en el momento en que de verdad se coloca.
 *
 * POR QUE
 * Fak, 24/08/2026, despues de preguntar en la planta: *"ya me dijeron que el EPP se pone con
 * la varilla antes de enfundar, o sea al principio; se pone la varilla con el EPP
 * manualmente"*. El AMFE 151 decia lo contrario: que el operario *"inserta el inserto EPP y
 * posiciona la funda antes del cierre de molde"*, o sea el EPP metido dentro del enfundado.
 *
 * POR QUE VA ADENTRO DE LA OP40 Y NO COMO OPERACION NUEVA (decision de Fak)
 * Porque **el Plan de Control ya lo agrupa asi**. Verificado en los tres PdC L1-L2-L3 del
 * legajo (`...\Headrest\APQP\12-Plan de Control\`):
 *   - FRONT    -> operacion "Asta + Insert + Enfundado", con 3 caracteristicas: correcta
 *                 colocacion de Inserto en Funda, correcta colocacion de Asta en Funda, y
 *                 correcta clipar Asta con Inserto en interior de Funda.
 *   - REAR CEN -> "Asta + Enfundado"    (sin Insert)
 *   - REAR OUT -> "Asta + Enfundado"    (sin Insert)
 * El documento del que Calidad saca la informacion ya considera armar el asta con el insert y
 * enfundar como UNA operacion. Alinear el AMFE con eso ademas deja el numero 40 quieto, asi
 * que nada de lo que ya recibio Calidad el 24/08 queda desfasado por numeracion.
 *
 * LOS TRASEROS VAN SIN "INSERT" — no llevan EPP. Confirmado por cuatro fuentes independientes:
 * BOM Barack V3 (12/12 hojas: "EPP CORE" 2HC.881.915 solo en las variantes del delantero),
 * Estructura de Producto Rev.A, el PdC de cada pieza y el Layout PIP Rev.A (hay contenedor
 * "EPP_Front" y ninguno para los traseros).
 *
 * QUE NO TOCA
 *  - La causa "Inserto colocado sin guia, se mueve al cerrar el molde" y su control de
 *    prevencion (la guia fisica DENTRO DEL MOLDE) quedan: esa guia es del molde PIP, que si
 *    existe, y no de la prensa de incrustacion que Patagonia no usa. La falla se manifiesta al
 *    cerrar el molde aunque el EPP se haya colocado antes.
 *  - Las OP40 del 153 y el 155 estan COMPLETAMENTE VACIAS (0 work elements). Solo se les
 *    cambia el nombre; llenarlas va con la tanda de los 17 huecos (decision de Fak, 24/08).
 *  - S/O/D no se tocan.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();

const OP = '40';

/** Nombre nuevo por AMFE, tomado literal de la denominacion del Plan de Control. */
const NOMBRE = {
  'AMFE-HF-PAT': 'ENSAMBLE ASTA + INSERT + ENFUNDADO',
  'AMFE-HRC-PAT': 'ENSAMBLE ASTA + ENFUNDADO',
  'AMFE-HRO-PAT': 'ENSAMBLE ASTA + ENFUNDADO',
};

/** Solo el delantero cambia texto: es el unico con EPP. */
const FUNCION_OP_151 = 'Ensamblar a mano el inserto EPP sobre el asta y calzar la funda sobre el conjunto, sin pliegues y centrada';
const FUNCION_WE_151 = 'Ensamblar a mano el inserto EPP sobre el asta y calzar la funda sobre el conjunto';
const VIEJO_WE_151 = /Insertar inserto EPP y posicionar la funda antes del cierre de molde/i;

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents')
  .select('id, amfe_number, project_name, data').in('amfe_number', Object.keys(NOMBRE));
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 3) { console.error(`Esperaba 3 AMFE, vinieron ${rows.length} — abortar`); process.exit(1); }

const plan = [], pendientes = [];

for (const row of rows.sort((a, b) => a.amfe_number.localeCompare(b.amfe_number))) {
  const antes = typeof row.data === 'string' ? JSON.parse(row.data) : structuredClone(row.data);
  const doc = JSON.parse(JSON.stringify(antes));
  const op = (doc.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
  if (!op) { console.error(`${row.amfe_number}: no existe la OP${OP} — abortar`); process.exit(1); }

  const cambios = [];
  const nuevo = NOMBRE[row.amfe_number];

  if (String(op.name ?? '') !== nuevo) {
    cambios.push(`nombre: "${op.name}" -> "${nuevo}"`);
    op.name = nuevo;
    op.operationName = nuevo;   // alias: los dos tienen que ir juntos o el export lee el vacio
  }

  if (row.amfe_number === 'AMFE-HF-PAT') {
    if (String(op.operationFunction ?? '') !== FUNCION_OP_151) {
      cambios.push(`operationFunction: "${op.operationFunction}"\n                    -> "${FUNCION_OP_151}"`);
      op.operationFunction = FUNCION_OP_151;
    }
    for (const we of (op.workElements ?? [])) for (const fn of (we.functions ?? [])) {
      if (!VIEJO_WE_151.test(String(fn.description ?? '')) && !VIEJO_WE_151.test(String(fn.functionDescription ?? ''))) continue;
      cambios.push(`funcion del WE: "${fn.description}"\n                    -> "${FUNCION_WE_151}"`);
      fn.description = FUNCION_WE_151;
      fn.functionDescription = FUNCION_WE_151;   // alias
    }
  }

  if (!cambios.length) { console.log(`\n  ${row.amfe_number}: ya esta alineado.`); continue; }

  // Invariantes: no se agrega ni se saca nada de la estructura.
  const cuentaOps = d => (d.operations ?? []).length;
  const cuentaCausas = d => (d.operations ?? []).flatMap(o => o.workElements ?? [])
    .flatMap(w => w.functions ?? []).flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
  if (cuentaOps(antes) !== cuentaOps(doc) || cuentaCausas(antes) !== cuentaCausas(doc)) {
    console.error(`${row.amfe_number}: cambio la estructura — abortar`); process.exit(1);
  }

  console.log(`\n  ${row.amfe_number} OP${OP}`);
  cambios.forEach(c => console.log(`     ${c}`));

  plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
  pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(doc), esperado: nuevo });
}

if (!plan.length) { console.log('\n  Nada que cambiar.'); process.exit(0); }

await runWithValidation(plan, APLICAR, async () => {
  for (const p of pendientes) {
    const { error: e } = await sb.from('amfe_documents')
      .update({ data: p.data, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }

    // Releer de la base: la verdad es lo guardado, no lo planificado.
    const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', p.id).single();
    const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
    const op = (live.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
    if (op.name !== p.esperado || op.operationName !== p.esperado) {
      console.error(`${p.amfeNumber}: el nombre quedo "${op.name}" / "${op.operationName}"`); process.exit(1);
    }
    console.log(`  ${p.amfeNumber}: OK — OP${OP} "${op.name}"`);
  }
});
