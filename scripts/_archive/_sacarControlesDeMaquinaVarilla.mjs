/**
 * _sacarControlesDeMaquinaVarilla.mjs — la insercion de varilla en Patagonia es MANUAL.
 *
 * EL HECHO, DE FAK (24/08/2026)
 * *"hay una maquina que hace todo eso que por ahora en Patagonia no se usa"*, *"en el
 * delantero, que es el unico proceso donde importa eso hoy en dia, nosotros ponemos la
 * varilla con el EPP, lo hacemos nosotros... no tenemos la maquina, es todo manual"*.
 *
 * O sea: los controles de la OP41 que describen equipamiento automatico o utillaje de
 * posicionamiento NO existen en este proceso. Un control que nombra un dispositivo que no
 * esta en el puesto es un dato falso en un documento que se certifica ante VW.
 *
 * QUE SACA
 * En los tres apoyacabezas (151, 153, 155), OP41 INSERCION DE VARILLA, modo de falla
 * "2- Varilla desalineada": cualquier control de prevencion o deteccion que nombre
 * poka-yoke, sensor, guias de posicionamiento, dispositivo o automatismo -> TBD.
 *
 * Al 24/08 ya se habian sacado, en dos pasadas anteriores:
 *   - 153 y 155: los dos controles eran de EMBALAJE (`_corregirControlesVarillaTraseros.mjs`)
 *   - 151 deteccion: el poka-yoke con sensor (`_sacarPokaYokeVarilla151.mjs`)
 * Queda la prevencion del 151, "Uso de guias de posicionamiento". Este script cierra eso y
 * ademas deja los tres iguales, que es lo que pidio Fak ("de esa forma los 3").
 *
 * NO SE INVENTA EL REEMPLAZO. Cual es el control real de un puesto manual lo define Fak.
 * S/O/D NO se tocan: la D=5 de la causa venia justificada por el poka-yoke y hay que
 * recalibrarla, pero ponerle un numero sin saber el control real seria inventarlo.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();

const AFECTADOS = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const OP = '41';
const FM = /varilla desalineada/i;

/** Lo que delata un control que depende de equipamiento que este puesto no tiene. */
const ES_DE_MAQUINA = /poka[\s-]*yoke|sensor|gu[ií]as? de posicionamiento|dispositivo|autom[aá]tic|utillaje|fixture/i;

/**
 * Un TBD de una pasada anterior que todavia no aclara que la operacion es manual.
 * Los tres apoyacabezas tienen que decir lo MISMO: Fak, 24/08 — *"de esa forma los 3"*, y
 * antes — *"mientras esten los 3 alineados bien estamos bien, no vaya a ser que uno tenga
 * el reproceso y los otros 2 no"*. Que uno diga "(operacion manual)" y los otros no es la
 * misma clase de desprolijidad, y se ve en el PDF que lee el cliente.
 */
const TBD_SIN_ACLARAR = /^TBD\b(?!.*operacion manual)/i;

const TBD = {
  preventionControl: 'TBD — definir el control de prevencion de la alineacion de la varilla en el puesto (operacion manual)',
  detectionControl: 'TBD — definir el control de deteccion de la varilla desalineada en el puesto (operacion manual)',
};

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
if (rows.length !== 3) { console.error(`Esperaba 3 AMFE, vinieron ${rows.length} — abortar`); process.exit(1); }

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
        for (const campo of ['preventionControl', 'detectionControl']) {
          const v = String(c[campo] ?? '');
          if (!ES_DE_MAQUINA.test(v) && !TBD_SIN_ACLARAR.test(v)) continue;
          console.log(`\n  ${row.amfe_number} OP${OP} — ${campo}`);
          console.log(`     ANTES : ${v}`);
          console.log(`     AHORA : ${TBD[campo]}`);
          c[campo] = TBD[campo];
          tocadas++;
        }
      }
    }
  }

  if (!tocadas) { console.log(`\n  ${row.amfe_number}: sin controles de maquina en la OP${OP} (ya esta limpio).`); continue; }

  const cuenta = d => (d.operations ?? []).flatMap(o => o.workElements ?? [])
    .flatMap(w => w.functions ?? []).flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
  if (cuenta(antes) !== cuenta(doc)) { console.error(`${row.amfe_number}: cambio la cantidad de causas — abortar`); process.exit(1); }

  plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
  pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(doc) });
}

if (!plan.length) { console.log('\n  Nada que cambiar: los tres ya estan sin controles de maquina.'); process.exit(0); }

await runWithValidation(plan, APLICAR, async () => {
  for (const p of pendientes) {
    const { error: e } = await sb.from('amfe_documents')
      .update({ data: p.data, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }

    const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', p.id).single();
    const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
    const op = (live.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
    const quedan = (op.workElements ?? []).flatMap(w => w.functions ?? [])
      .flatMap(f => f.failures ?? []).filter(fm => FM.test(String(fm.description ?? '')))
      .flatMap(fm => fm.causes ?? [])
      .filter(c => ES_DE_MAQUINA.test(`${c.preventionControl ?? ''} ${c.detectionControl ?? ''}`)).length;
    if (quedan) { console.error(`${p.amfeNumber}: quedan ${quedan} controles de maquina`); process.exit(1); }
    console.log(`  ${p.amfeNumber}: OK — OP${OP} sin controles de maquina`);
  }
});
