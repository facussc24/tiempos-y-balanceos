/**
 * _corregirEvidentesPatagonia.mjs — arregla lo OBJETIVAMENTE incorrecto de los 8 AMFE.
 *
 * Fak, 21/08/2026: *"si encontrás un error 100% evidente corregilo... necesito que vayas
 * tomando cada vez más decisiones para darme una mano"*. Y en el mismo mensaje mantuvo el
 * limite: *"me parece bien que vos no toques lo de CC y SC"*.
 *
 * EL CRITERIO PARA ENTRAR ACA — "evidente" es lo que se puede DERIVAR de una fuente que ya
 * existe, sin criterio de dominio ni dato de planta:
 *
 *   1. AP declarado != calculateAP(S,O,D). La tabla AIAG-VDA es la unica fuente valida
 *      (amfe.md §4): si no coincide, esta mal y se recalcula. Si al recalcular sube a H y
 *      no hay accion, se pone el placeholder que Fak ya autorizo.
 *   2. `header.revDate` mas viejo que la ultima fila del log de revisiones. La caratula se
 *      contradecia sola: "FECHA DE REVISION 13/02/2026" arriba de una revision del 20/08.
 *   3. MODELO-ANO / PLATAFORMA vacio. Se completa con la plataforma real, que ya esta en el
 *      nombre del proyecto y en las carpetas del servidor (VW427-1LA_K-PATAGONIA).
 *      Los que YA tienen dato no se pisan.
 *   4. `data._meta` del importador de xlsx (source_file, parser_version, avisos) — andamiaje
 *      interno adentro de un documento oficial.
 *   5. "Mariana Vera" -> "Marianna Vera": la misma persona escrita de dos formas en el mismo
 *      equipo multifuncional (organigrama).
 *
 * LO QUE NO ENTRA, aunque el auditor lo marco (va al reporte para Fak):
 *   - CC/SC: las asigna Fak (core-prohibiciones §2). Las 63 filas con S>=9 sin CC se avisan
 *     con un check nuevo, no se tocan.
 *   - Los 118 controles que dicen solo "Visual": incompletos, si — pero completarlos a
 *     "Inspeccion visual 100%" AFIRMA un alcance que puede ser falso si el puesto muestrea.
 *     Un control incompleto es un hueco; uno con alcance inventado es un dato falso.
 *   - Causas de "error humano" y valores de especificacion dentro del modo de falla:
 *     reescribirlos bien necesita saber por que pasa realmente / que dice el Plan de Control.
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { calculateAP } from './_lib/amfeIo.mjs';

const { apply: APLICAR } = parseSafeArgs();
const PLATAFORMA = 'VW427-1LA_K - PATAGONIA';
const PLACEHOLDER = 'Pendiente definicion equipo APQP';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents')
  .select('id, amfe_number, project_name, data, revisions').ilike('project_name', '%patagonia%');
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 8) { console.error(`Esperaba 8, hay ${rows.length}`); process.exit(1); }

const plan = [], pendientes = [];
let apTotal = 0, phTotal = 0;

for (const row of rows.sort((a, b) => a.amfe_number.localeCompare(b.amfe_number))) {
  const before = JSON.parse(row.data);
  const doc = JSON.parse(row.data);          // copia independiente para modificar
  const revs = JSON.parse(row.revisions || '[]');
  const cambios = [];

  // 1. AP contra la tabla oficial
  let ap = 0, ph = 0;
  for (const op of doc.operations ?? [])
    for (const we of op.workElements ?? [])
      for (const fn of we.functions ?? [])
        for (const f of fn.failures ?? [])
          for (const c of f.causes ?? []) {
            const s = +c.severity, o = +c.occurrence, d = +c.detection;
            if (!(s && o && d)) continue;
            const esperado = calculateAP(s, o, d);
            const declarado = String(c.ap ?? c.actionPriority ?? '').trim().toUpperCase();
            if (!declarado || declarado === esperado) continue;
            c.ap = esperado; c.actionPriority = esperado; ap++;
            // Un AP=H sin accion es bloqueo IATF: se pone el placeholder autorizado (amfe.md §4).
            if (esperado === 'H') {
              const accion = String(c.optimizationAction ?? '').trim();
              if (!accion) { c.optimizationAction = PLACEHOLDER; ph++; }
            }
          }
  if (ap) { cambios.push(`AP recalculado en ${ap} causas (${ph} con placeholder por pasar a H)`); apTotal += ap; phTotal += ph; }

  // 2. fecha de revision de la caratula = la de la ultima revision real
  const h = doc.header ?? (doc.header = {});
  if (revs.length) {
    const ultima = revs[revs.length - 1].date;                       // DD/MM/AAAA
    const norm = (v) => String(v ?? '').includes('-')
      ? String(v).split('-').reverse().join('/') : String(v ?? '');  // ISO -> DD/MM/AAAA
    if (norm(h.revDate) !== ultima) {
      cambios.push(`revDate "${h.revDate}" -> "${ultima}" (ultima revision real)`);
      h.revDate = ultima;
    }
  }

  // 3. plataforma solo si esta VACIA (no se pisa un dato existente)
  const modeloActual = String(h.modelYear ?? '').trim();
  if (!modeloActual) { h.modelYear = PLATAFORMA; cambios.push(`MODELO-ANO/PLATAFORMA vacio -> "${PLATAFORMA}"`); }

  // 4. andamiaje del importador
  if (doc._meta) { delete doc._meta; cambios.push('se saca data._meta (source_file / parser_version del importador)'); }

  // 5. la misma persona, escrita de dos formas
  let txt = JSON.stringify(doc);
  const nMV = (txt.match(/Mariana Vera/g) || []).length;
  if (nMV) { txt = txt.replace(/Mariana Vera/g, 'Marianna Vera'); cambios.push(`${nMV}x "Mariana Vera" -> "Marianna Vera"`); }
  const after = JSON.parse(txt);

  if (!cambios.length) { console.log(`  ${row.amfe_number}: sin cambios`); continue; }
  console.log(`\n  ${row.amfe_number}:`);
  cambios.forEach(c => console.log(`     ${c}`));

  plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before, after });
  pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(after) });
}

console.log(`\n=== ${plan.length} documentos | ${apTotal} AP recalculados | ${phTotal} placeholders ===`);

await runWithValidation(plan, APLICAR, async () => {
  for (const p of pendientes) {
    const { error: e } = await sb.from('amfe_documents')
      .update({ data: p.data, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }
    const { data: check } = await sb.from('amfe_documents').select('data').eq('id', p.id).single();
    const doc = JSON.parse(check.data);
    if (!Array.isArray(doc.operations)) { console.error(`${p.amfeNumber}: operations no es array`); process.exit(1); }
    if (doc._meta) { console.error(`${p.amfeNumber}: _meta sigue ahi`); process.exit(1); }
    console.log(`  ${p.amfeNumber}: OK (${doc.operations.length} ops, JSON valido)`);
  }
});
