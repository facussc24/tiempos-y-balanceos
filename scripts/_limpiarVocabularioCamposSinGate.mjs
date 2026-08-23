/**
 * _limpiarVocabularioCamposSinGate.mjs — saca las palabras que el candado nunca miro.
 *
 * POR QUE EXISTE
 * Fak, 19/08/2026, sobre los AMFE que estaban por irse a Calidad: "sigo viendo palabras
 * extranas que nadie en esta empresa usaria como 'enrase', 'chirridos'". Las dos estaban
 * en ENGLISH_RANDOM_TERMS desde el 19/08 y el validador daba FORBIDDEN_VOCABULARY = 0.
 *
 * El motivo, medido el 23/08: `pushForbiddenIssues` se llamaba en 9 lugares de
 * amfeValidator.mjs y ninguno cubria el texto de la causa ni el modo de falla con sus
 * 3 efectos. El texto que Fak veia impreso vivia justo ahi. Con el candado ampliado a
 * esos 6 campos aparecen 14 ocurrencias / 9 textos / 4 AMFE. Este script las limpia.
 *
 * DE DONDE SALEN LAS PALABRAS DE REEMPLAZO (no se eligieron a ojo)
 * Se contaron sobre `.mail-cache/mails.jsonl` — 5.144 mails reales de Barack, 2023-2026:
 *     enrase                    0 hits      flush                     0 hits
 *     alineacion / alineación 101 hits      especificacion          598 hits
 * O sea: "enrase" no lo escribio nadie nunca; "alineacion" y "especificacion" son las
 * palabras de la casa. (El corpus estaba con sync PARCIAL, 2.759 de 5.144 cuerpos
 * bajados: los conteos son piso, no techo — y para 0 vs 101 alcanza.)
 *
 * QUE NO SE TOCA
 * `checklist` (9 usos), `setup` (22) y `stock` (48) SE QUEDAN — decision de Fak del
 * 23/08/2026: son vocabulario que Barack usa de verdad, como SCRAP. No estan en ninguna
 * lista prohibida y este script no los mira.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { scanForbidden } from './_lib/forbiddenContent.mjs';

const { apply: APLICAR } = parseSafeArgs();

// [regex, reemplazo, AMFEs a los que aplica (null = todos)]
const REEMPLAZOS = [
  // "fuera de spec" -> la palabra que Barack escribe 598 veces en sus mails.
  // 5 textos en el maestro de PU (lote de ISO, aceite hidraulico, ratio A:B, calibracion
  // del flujometro). El sentido no cambia: sigue diciendo que el valor no cumple.
  [/fuera de spec\b/gi, 'fuera de especificacion', ['AMFE-MAESTRO-PU-001']],

  // "Gap & Flush NOK" -> el efecto en el vehiculo, dicho en castellano.
  // La purga del 19-20/08 lo habia traducido como "luz y enrase"; "enrase" es
  // justamente la palabra que Fak marco, asi que va "alineacion".
  [/Gap\s*&\s*Flush\s+NOK/gi, 'luz y alineacion fuera de especificacion', ['AMFE-MAESTRO-INY-001']],

  // "el enrase de las lineas" -> "la alineacion de las lineas" (cambia el articulo).
  // Mismo texto en los dos AMFE de telas planas, OP15.
  [/\bel enrase\b/gi, 'la alineacion', ['AMFE-1', '160']],
];

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const AFECTADOS = ['AMFE-MAESTRO-PU-001', 'AMFE-MAESTRO-INY-001', 'AMFE-1', '160'];

const { data: rows, error } = await sb.from('amfe_documents')
  .select('id, amfe_number, project_name, data').in('amfe_number', AFECTADOS);
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== AFECTADOS.length) {
  console.error(`Esperaba ${AFECTADOS.length} AMFE, vinieron ${rows.length} — abortar`);
  process.exit(1);
}

const plan = [], pendientes = [];

for (const row of rows.sort((a, b) => a.amfe_number.localeCompare(b.amfe_number))) {
  const original = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
  let texto = original;
  const detalle = [];

  for (const [re, rep, docs] of REEMPLAZOS) {
    if (docs && !docs.includes(row.amfe_number)) continue;
    const n = (texto.match(re) || []).length;
    if (n) { texto = texto.replace(re, rep); detalle.push(`${n}x /${re.source}/ -> "${rep}"`); }
  }

  if (texto === original) continue;

  // Invariantes: el JSON sigue valido y la estructura no se movio.
  const antes = JSON.parse(original), despues = JSON.parse(texto);
  const cuentaOps = d => (d.operations ?? []).length;
  const cuentaCausas = d => (d.operations ?? []).flatMap(o => o.workElements ?? [])
    .flatMap(w => w.functions ?? []).flatMap(f => f.failures ?? [])
    .flatMap(fm => fm.causes ?? []).length;
  if (cuentaOps(antes) !== cuentaOps(despues) || cuentaCausas(antes) !== cuentaCausas(despues)) {
    console.error(`${row.amfe_number}: cambio la estructura (ops o causas) — abortar`);
    process.exit(1);
  }

  console.log(`\n  ${row.amfe_number}  (${row.project_name})`);
  detalle.forEach(d => console.log(`     ${d}`));

  plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name,
              before: antes, after: despues });
  pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: texto });
}

if (!plan.length) { console.log('\n  Nada que cambiar.'); process.exit(0); }

await runWithValidation(plan, APLICAR, async () => {
  for (const p of pendientes) {
    const { error: e } = await sb.from('amfe_documents')
      .update({ data: p.data, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }

    // Releer de la base y comprobar que no quedo ninguna palabra prohibida en los
    // 6 campos que antes nadie escaneaba (verificar contra la fuente, no contra el plan).
    const { data: check } = await sb.from('amfe_documents').select('data').eq('id', p.id).single();
    const doc = typeof check.data === 'string' ? JSON.parse(check.data) : check.data;
    if (!Array.isArray(doc.operations)) { console.error(`${p.amfeNumber}: operations no es array`); process.exit(1); }

    let quedan = 0;
    for (const op of doc.operations) for (const we of (op.workElements ?? []))
      for (const fn of (we.functions ?? [])) for (const fm of (fn.failures ?? [])) {
        for (const k of ['description', 'effectLocal', 'effectNextLevel', 'effectEndUser'])
          quedan += scanForbidden(String(fm[k] ?? '')).forbidden.length;
        for (const c of (fm.causes ?? [])) for (const k of ['cause', 'description'])
          quedan += scanForbidden(String(c[k] ?? '')).forbidden.length;
      }
    if (quedan > 0) { console.error(`${p.amfeNumber}: quedan ${quedan} palabras prohibidas`); process.exit(1); }
    console.log(`  ${p.amfeNumber}: OK (${doc.operations.length} operaciones, 0 palabras prohibidas)`);
  }
});
