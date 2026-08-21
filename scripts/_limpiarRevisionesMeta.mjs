/**
 * _limpiarRevisionesMeta.mjs — saca del log de REVISIONES lo que no es un cambio de ingenieria.
 *
 * POR QUE EXISTE (Fak, 20/08/2026, sobre la entrada "SE REESCRIBEN EN ESPANOL... LOS TERMINOS
 * EN INGLES"): *"no podes poner esto como revision en un AMFE, parece una burla... esas cosas
 * se ocultan, nunca tuvieron que haber estado en ingles... esas trampitas debes tener criterio
 * para detectarlas y no escracharme"*.
 *
 * EL CRITERIO: el log de revisiones de un AMFE es parte del documento que ve el CLIENTE y la
 * auditoria. Registra QUE CAMBIO DEL PROCESO O DEL ANALISIS, no como se redacto ni quien se
 * equivoco. Una correccion de estilo/idioma/typo del redactor se aplica en silencio: dejarla
 * escrita (a) le pone un cartel a un defecto que nadie iba a notar, (b) delata como se armo el
 * documento, (c) queda como una burla en un papel que firma Fak.
 *
 *   VA al log     -> operacion nueva, renumeracion, S/O/D o controles que cambian, alineacion
 *                    con flujograma/plan de control, hallazgo de auditoria, cambio de proceso.
 *   NO VA al log  -> traduccion, ortografia, vocabulario, formato, "replicado de tal AMFE",
 *                    notas internas ("decision Fak", "para no pisar la costura"), y en general
 *                    cualquier frase que hable del REDACTOR y no de la PIEZA.
 *
 * Solo toca la columna `revisions`. El `checksum` se calcula sobre `data` (amfeRepository.ts),
 * asi que no se toca. Dry-run por defecto; --apply para escribir.
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();

// Entradas a BORRAR (match por texto exacto del campo details).
const BORRAR = [
  'SE REESCRIBEN EN ESPANOL, CON EL VOCABULARIO DE LA PLANTA, LOS TERMINOS EN INGLES DE FUNCIONES, EFECTOS Y CONTROLES.',
  'SE REESCRIBEN EN ESPANOL LOS TERMINOS EN INGLES DE FUNCIONES, EFECTOS Y CONTROLES (LUZ Y ENRASE, RUIDOS Y CHIRRIDOS, AJUSTE Y TERMINACION).',
];

// Entradas a REESCRIBIR: el cambio es legitimo, el texto delataba como se hizo.
const REESCRIBIR = [
  ['SE AGREGA LA OPERACION 61 CONTROL DE PIEZA INYECTADA, REPLICADA DEL AMFE DE IP PADS (DECISION FAK 20/08). EL FLUJOGRAMA LA DECLARA COMO 51: SE NUMERA 61 PARA NO PISAR LA COSTURA DOBLE.',
   'SE AGREGA LA OPERACION 61 CONTROL DE PIEZA INYECTADA.'],
  ['SE AGREGA EL CONTROL DE PIEZA INYECTADA DENTRO DE LA OPERACION 70, REPLICADO DEL AMFE DE IP PADS (DECISION FAK 20/08).',
   'SE AGREGA EL CONTROL DE PIEZA INYECTADA EN LA OPERACION 70.'],
  ['SE AGREGA EL CONTROL DE PIEZA INYECTADA DENTRO DE LA OPERACION 10, REPLICADO DEL AMFE DE IP PADS (DECISION FAK 20/08).',
   'SE AGREGA EL CONTROL DE PIEZA INYECTADA EN LA OPERACION 10.'],
];

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

// Se trae `data` ademas de `revisions` solo para el gate: el validador compara before/after
// del contenido y aca tiene que dar 0 cambios, porque este script NO toca `data`.
const { data: rows, error } = await sb.from('amfe_documents')
  .select('id, amfe_number, project_name, data, revisions').ilike('project_name', '%patagonia%');
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 8) { console.error(`Esperaba 8 documentos de Patagonia, hay ${rows.length}`); process.exit(1); }

let borradas = 0, reescritas = 0, tocados = 0;
const plan = [];
const pendientes = [];

for (const row of rows.sort((a, b) => a.project_name.localeCompare(b.project_name))) {
  const revs = typeof row.revisions === 'string' ? JSON.parse(row.revisions) : (row.revisions || []);
  const antes = revs.length;
  const nuevas = [];
  let cambio = false;

  for (const r of revs) {
    const texto = (r.details || r.description || '').trim();
    if (BORRAR.some(b => texto === b)) {
      console.log(`  ${row.amfe_number}: BORRA  "${texto.slice(0, 70)}..."`);
      borradas++; cambio = true;
      continue;
    }
    const rw = REESCRIBIR.find(([viejo]) => texto === viejo);
    if (rw) {
      console.log(`  ${row.amfe_number}: REESCRIBE`);
      console.log(`      antes:   ${rw[0]}`);
      console.log(`      despues: ${rw[1]}`);
      nuevas.push({ ...r, details: rw[1] });
      reescritas++; cambio = true;
      continue;
    }
    nuevas.push(r);
  }

  if (!cambio) continue;
  tocados++;
  // Una revision nunca puede quedar sin historial: si el filtro se comiera todo, abortar.
  if (nuevas.length === 0) { console.error(`${row.amfe_number}: quedaria SIN revisiones — abortar`); process.exit(1); }

  const doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name,
              before: doc, after: doc });   // `data` no cambia: el gate tiene que dar 0 issues nuevos
  pendientes.push({ id: row.id, amfeNumber: row.amfe_number, antes, nuevas });
}

console.log(`\n=== ${tocados} documentos | ${borradas} entradas borradas | ${reescritas} reescritas ===`);

// Gate obligatorio (regla amfe.md §14): aunque este script solo toca `revisions`, pasa por
// el validador igual — asi queda probado que el contenido tecnico no se movio ni un byte.
await runWithValidation(plan, APLICAR, async () => {
  for (const p of pendientes) {
    const { error: e } = await sb.from('amfe_documents')
      .update({ revisions: JSON.stringify(p.nuevas), updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }
    const { data: check } = await sb.from('amfe_documents').select('revisions').eq('id', p.id).single();
    const post = JSON.parse(check.revisions);
    if (post.length !== p.nuevas.length) { console.error(`${p.amfeNumber}: verificacion fallo`); process.exit(1); }
    console.log(`  ${p.amfeNumber}: ${p.antes} -> ${post.length} revisiones (verificado)`);
  }
});
