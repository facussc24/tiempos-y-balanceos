/**
 * _propagarMylarApoyacabezasDelantero.mjs — cierra la OP28 vacia del apoyacabezas delantero.
 *
 * POR QUE EXISTE
 * Fak, 19/08/2026: "lo de los huecos no podes resolverlo vos?". Los "huecos" son 18
 * operaciones sin una sola causa, todas en los tres apoyacabezas de Patagonia — que son
 * 3 de los 8 AMFE que van a Calidad. Medido contra Supabase live el 23/08/2026.
 *
 * De esas 18, esta es la unica que se cierra con dato REAL y sin ninguna ambiguedad:
 *   - AMFE-HF-PAT  OP28 CONTROL CON PLANTILLA MYLAR -> workElements = [] (vacia)
 *   - AMFE-HRO-PAT OP28 y AMFE-HRC-PAT OP28 -> 3 WE / 4 causas, y son IDENTICAS entre si
 *     (comparadas campo por campo ignorando los ids). Misma familia de producto, mismo
 *     nombre de operacion, mismo control.
 *
 * QUE SE COPIA Y QUE NO
 * Se copian SOLO los workElements y el operationFunction, que hablan del control con Mylar
 * y no del producto ("Verificar conformidad dimensional de componentes cortados contra
 * patron Mylar de referencia"). NO se toca el focusElementFunction: el delantero ya tiene
 * el suyo, con su descripcion de producto correcta. Asi no cruza ningun dato de una pieza
 * a otra (regla amfe-cookbook: propagar por nombre normalizado, nunca por parecido).
 *
 * LO QUE ESTE SCRIPT NO HACE — y por que
 * Las otras 17 operaciones vacias NO se tocan aca:
 *   - OP40 ENFUNDADO (HRO, HRC): la unica fuente es HF OP40, y su contenido es del
 *     inserto EPP, que solo existe en el delantero. Copiarlo meteria en los traseros un
 *     componente que no llevan.
 *   - OP70 REPROCESO HILO SOBRANTE (los 3) y OP60 CONTROL FINAL (HRO): tienen fuente
 *     posible pero la decision es de Fak (ver el reporte de la sesion del 23/08).
 *   - OP11, OP71, OP72, OP42, OP50, OP51: no existen desarrolladas en ningun AMFE de
 *     Supabase. Van TBD; el contenido lo tiene que dar Fak o la planta.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();

const DESTINO = 'AMFE-HF-PAT';
const FUENTES = ['AMFE-HRO-PAT', 'AMFE-HRC-PAT'];
const OP = '28';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents')
  .select('id, amfe_number, project_name, data').in('amfe_number', [DESTINO, ...FUENTES]);
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 3) { console.error(`Esperaba 3 AMFE, vinieron ${rows.length} — abortar`); process.exit(1); }

const parse = r => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
const buscarOp = d => (d.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);

// ── Gate 1: las dos fuentes tienen que decir lo mismo ────────────────────────
const sinIds = o => JSON.stringify(o, (k, v) => (k === 'id' ? undefined : v));
const docsFuente = FUENTES.map(n => ({ n, doc: parse(rows.find(r => r.amfe_number === n)) }));
const opsFuente = docsFuente.map(({ n, doc }) => {
  const op = buscarOp(doc);
  if (!op || !(op.workElements ?? []).length) { console.error(`${n} OP${OP}: sin contenido — abortar`); process.exit(1); }
  return { n, op };
});
if (sinIds(opsFuente[0].op.workElements) !== sinIds(opsFuente[1].op.workElements)) {
  console.error(`Las fuentes ${FUENTES.join(' y ')} NO son identicas en OP${OP} — abortar, lo define Fak`);
  process.exit(1);
}
const fuente = opsFuente[0].op;

// ── Gate 2: el destino tiene que estar realmente vacio ───────────────────────
const rowDestino = rows.find(r => r.amfe_number === DESTINO);
const docDestino = parse(rowDestino);
const opDestino = buscarOp(docDestino);
if (!opDestino) { console.error(`${DESTINO}: no existe la OP${OP} — abortar`); process.exit(1); }
if ((opDestino.workElements ?? []).length > 0) {
  console.error(`${DESTINO} OP${OP} ya tiene ${opDestino.workElements.length} workElements — abortar, no piso nada`);
  process.exit(1);
}

// ── El cambio: ids nuevos, focusElementFunction del destino intacto ──────────
const conIdsNuevos = nodo => JSON.parse(JSON.stringify(nodo), (k, v) => (k === 'id' ? randomUUID() : v));

const antes = JSON.parse(JSON.stringify(docDestino));
opDestino.workElements = conIdsNuevos(fuente.workElements);
if (!String(opDestino.operationFunction ?? '').trim()) {
  opDestino.operationFunction = fuente.operationFunction;
}
const despues = docDestino;

const causas = (opDestino.workElements ?? []).flatMap(w => w.functions ?? [])
  .flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []);

console.log(`\n  ${DESTINO} OP${OP} "${opDestino.name ?? opDestino.operationName}"`);
console.log(`     fuente: ${FUENTES.join(' y ')} (identicas entre si)`);
console.log(`     workElements: 0 -> ${opDestino.workElements.length}   causas: 0 -> ${causas.length}`);
console.log(`     operationFunction: "${opDestino.operationFunction}"`);
console.log(`     focusElementFunction: SIN TOCAR (el del delantero)`);
for (const we of opDestino.workElements) {
  console.log(`     · [${we.type}] ${we.name}`);
  for (const fn of (we.functions ?? [])) for (const fm of (fn.failures ?? []))
    for (const c of (fm.causes ?? []))
      console.log(`         FM "${fm.description}" (S=${fm.severity}) <- causa "${c.cause}" [O=${c.occurrence} D=${c.detection} AP=${c.actionPriority ?? c.ap}]`);
}

const plan = [{ id: rowDestino.id, amfeNumber: DESTINO, productName: rowDestino.project_name, before: antes, after: despues }];

await runWithValidation(plan, APLICAR, async () => {
  const { error: e } = await sb.from('amfe_documents')
    .update({ data: JSON.stringify(despues), updated_at: new Date().toISOString() })
    .eq('id', rowDestino.id);
  if (e) { console.error(e.message); process.exit(1); }

  // Releer de la base: la verdad es lo que quedo guardado, no lo que planifique.
  const { data: check } = await sb.from('amfe_documents').select('data').eq('id', rowDestino.id).single();
  const doc = typeof check.data === 'string' ? JSON.parse(check.data) : check.data;
  const op = buscarOp(doc);
  const n = (op.workElements ?? []).flatMap(w => w.functions ?? [])
    .flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
  if (n !== causas.length) { console.error(`releido: ${n} causas, esperaba ${causas.length}`); process.exit(1); }
  console.log(`  ${DESTINO}: OK — OP${OP} quedo con ${op.workElements.length} WE y ${n} causas`);
});
