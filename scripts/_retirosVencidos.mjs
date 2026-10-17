/**
 * _retirosVencidos.mjs — que hooks, reglas y retiros decididos tocan revisar (tanda 9, pieza 7).
 *
 * La casa solo agregaba controles (51 hooks, una leccion por incidente); la guia oficial de evals lo llama sobreajuste.
 * Cada pieza tiene en scripts/_lib/retiros.data.json la fecha en que se revisa y la razon por la que existe. Este
 * script lista:
 *   - los VENCIDOS (revisar <= hoy) y los que vencen en los proximos 7 dias;
 *   - los que estan en el disco y no tienen renglon (una pieza nueva entra con su fecha y su razon);
 *   - los renglones cuyo archivo ya no existe;
 *   - con --disparos: cuantas veces aparecio cada hook en los registros de las sesiones desde --desde (30 dias por
 *     defecto), con el aviso de que 0 disparos no es inutil (se mide con casos plantados).
 *
 *   node scripts/_retirosVencidos.mjs [--hoy AAAA-MM-DD] [--disparos [--desde AAAA-MM-DD]] [--json]
 *
 * Solo lee. Sale con 0 siempre (es un aviso; lo nombra _cierreSesion.mjs los viernes).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
export const DATOS = path.join(AQUI, '_lib', 'retiros.data.json');

/** Las piezas que hay en el disco: hooks (sin los .test.sh) y reglas. */
export function piezasEnDisco(raiz = RAIZ) {
  const hooks = fs.readdirSync(path.join(raiz, '.claude', 'hooks')).filter((f) => f.endsWith('.sh') && !f.endsWith('.test.sh')).map((f) => `hook:${f.replace(/\.sh$/, '')}`);
  const reglas = fs.readdirSync(path.join(raiz, '.claude', 'rules')).filter((f) => f.endsWith('.md')).map((f) => `regla:${f.replace(/\.md$/, '')}`);
  return [...hooks, ...reglas].sort();
}

const dias = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400e3);

/** Puro: cruza el registro con el disco y la fecha. */
export function evaluarRetiros(datos, enDisco, hoy) {
  const todas = { ...(datos.piezas || {}) };
  const decididos = datos.retiros_decididos || {};
  const filas = [
    ...Object.entries(todas).map(([id, p]) => ({ id, tipo: 'pieza', ...p })),
    ...Object.entries(decididos).map(([id, p]) => ({ id, tipo: 'retiro decidido', ...p })),
  ].map((f) => ({ ...f, faltan: f.revisar ? dias(f.revisar, hoy) : null }));
  return {
    vencidos: filas.filter((f) => f.faltan != null && f.faltan <= 0),
    proximos: filas.filter((f) => f.faltan != null && f.faltan > 0 && f.faltan <= 7),
    sinRenglon: enDisco.filter((id) => !todas[id]),
    sinArchivo: Object.keys(todas).filter((id) => !enDisco.includes(id)),
    sinRazon: filas.filter((f) => !f.justifica || /^TBD/.test(f.justifica)).map((f) => f.id),
    // Auditor 17/10: el plan pide «justifica: <numero o incidente>»; una razon sin un digito (fecha, numero, conteo) es texto
    // de cabecera, no una justificacion medida. Se lista para completarla al revisar la pieza.
    sinNumero: filas.filter((f) => f.justifica && !/^TBD/.test(f.justifica) && !/d/.test(f.justifica)).map((f) => f.id),
    total: filas.length,
  };
}

/** La etiqueta con que un hook firma lo que dice (escritorio-guard → ESCRITORIO-GUARD). */
export const etiquetaDe = (id) => id.replace(/^hook:/, '').replace(/[^a-z0-9-]/gi, '').toUpperCase();

/**
 * Cuenta en un texto cuantas veces firmo cada hook. Puro, para el test. Formas de firmar medidas en los registros el
 * 17/10/2026: «[ESCRITORIO-GUARD …», «CIERRE-GUARD: …», «AVISO (agentes-guard, P5)» y la etiqueta corta sin «-GUARD»
 * entre corchetes («[COMMIT-RUTAS]»). Limite conocido: un hook que solo registra (no le dice nada a la sesion) da 0, y
 * una firma con otro nombre (el dispatcher firma por sus guardianes, p. ej. [SCRIPT-INLINE-GUARD]) no se le cuenta.
 */
export function contarFirmas(texto, ids) {
  const out = Object.fromEntries(ids.map((id) => [id, 0]));
  const t = String(texto);
  for (const id of ids) {
    const et = etiquetaDe(id);
    if (et.length < 6) continue;
    const nombre = id.replace(/^hook:/, '');
    const corta = et.replace(/-GUARD$/, '');
    const formas = [`[\\[ ]${et}\\b`, `\\(${nombre}[,)]`];
    if (corta !== et && corta.length >= 6) formas.push(`\\[${corta}\\]`);
    out[id] = (t.match(new RegExp(formas.join('|'), 'g')) || []).length;
  }
  return out;
}

function disparos(ids, desde) {
  const base = path.join(os.homedir(), '.claude', 'projects');
  const total = Object.fromEntries(ids.map((id) => [id, 0]));
  let archivos = 0;
  for (const d of fs.existsSync(base) ? fs.readdirSync(base) : []) {
    if (!d.startsWith('C--Dev-BarackMercosul')) continue;
    for (const f of fs.readdirSync(path.join(base, d))) {
      if (!f.endsWith('.jsonl')) continue;
      const p = path.join(base, d, f);
      if (fs.statSync(p).mtime.toISOString().slice(0, 10) < desde) continue;
      archivos += 1;
      const c = contarFirmas(fs.readFileSync(p, 'utf8'), ids);
      for (const id of ids) total[id] += c[id];
    }
  }
  return { total, archivos };
}

function main(argv) {
  const arg = (n, def) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
  const hoy = arg('--hoy', new Date().toISOString().slice(0, 10));
  const datos = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
  const r = evaluarRetiros(datos, piezasEnDisco(), hoy);
  let d = null;
  if (argv.includes('--disparos')) {
    const desde = arg('--desde', new Date(Date.parse(`${hoy}T00:00:00Z`) - 30 * 86400e3).toISOString().slice(0, 10));
    const hooks = Object.keys(datos.piezas || {}).filter((id) => id.startsWith('hook:'));
    d = { desde, ...disparos(hooks, desde) };
  }
  if (argv.includes('--json')) { console.log(JSON.stringify({ hoy, ...r, disparos: d }, null, 2)); return 0; }
  const linea = (f) => `  · ${f.id} (${f.tipo}) — revisar ${f.revisar}${f.faltan > 0 ? `, faltan ${f.faltan} dias` : ''}: ${(f.que || f.justifica || '').slice(0, 160)}`;
  console.log(`RETIROS CON VENCIMIENTO · ${hoy} · ${r.total} renglones`);
  console.log(`Vencidos (${r.vencidos.length}):`); r.vencidos.forEach((f) => console.log(linea(f)));
  console.log(`Vencen en los proximos 7 dias (${r.proximos.length}):`); r.proximos.forEach((f) => console.log(linea(f)));
  console.log(`En el disco sin renglon (${r.sinRenglon.length}): ${r.sinRenglon.join(', ') || '-'}`);
  console.log(`Renglon sin archivo (${r.sinArchivo.length}): ${r.sinArchivo.join(', ') || '-'}`);
  console.log(`Sin razon escrita (${r.sinRazon.length}): ${r.sinRazon.join(', ') || '-'}`);
  console.log(`Razon sin numero, fecha ni incidente (${r.sinNumero.length}): se completa al revisar cada pieza`);
  if (d) {
    const ceros = Object.entries(d.total).filter(([, n]) => n === 0).map(([id]) => id);
    console.log(`Disparos desde ${d.desde} en ${d.archivos} registros (cuenta la firma del hook, p. ej. [ESCRITORIO-GUARD]):`);
    for (const [id, n] of Object.entries(d.total).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${id}`);
    console.log(`Con 0 disparos (${ceros.length}). OJO: 0 disparos no es inutil — un hook que no firma (solo registra) o que frena lo que casi nunca pasa da 0; se mide con un caso plantado antes de retirar nada.`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
