/**
 * parametrosMaquina.mjs — los PARAMETROS de una maquina en el tiempo, con la marca de cuando cambiaron. Logica pura: la
 * usan `scripts/_parametrosMaquina.mjs` y su test.
 *
 * Tanda 13, item 9 (equipo «fuera de la caja», 15/10/2026): la ficha de maquina de la tanda 1.4 tiene campos fijos y no
 * la historia. Caso que lo origino: en la laminadora hot melt la consigna de los rodillos paso de 195 a 185 °C el
 * 26/08/2026 entre dos videos, y el reloj de la pantalla marcaba 2012/1/5 (memoria `reference_maquina_hotmelt_parametros`).
 *
 * Los datos viven en la FICHA de cada maquina (la memoria `reference_maquina_*`), en un bloque ```json:
 *   { "parametros": [ { "campo": "consigna de los rodillos", "pantalla": "设定温度", "unidad": "°C",
 *                       "lecturas": [ { "fecha": "2026-08-26", "valor": 195, "fuente": "video IMG_0383" }, ... ] } ] }
 * La FECHA es la del video o la foto, nunca la del panel (el HMI de la hot melt estuvo en 2012). Dentro del mismo dia
 * manda el orden en que se anotaron (el numero de video), no una hora que nadie leyo. Cada lectura lleva su fuente: un
 * valor sin su captura no se compara con nada.
 */
import { aFecha, leerBloque, escribirBloque } from './seguimientos.mjs';

export const CLAVE = 'parametros';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

/** Mismo valor: los numeros por valor (185 = 185,0), los textos sin mayusculas ni espacios de mas («tpo» = «TPO»). */
export function mismoValor(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  return norm(a) === norm(b);
}

/** Texto -> valor: «185», «185,0» o «0,25» son numeros; lo demas («tpo», «kp1») queda texto. */
export function leerValor(t) {
  const s = String(t ?? '').trim();
  if (!s) throw new Error('falta el valor');
  return /^-?\d+([.,]\d+)?$/.test(s) ? Number(s.replace(',', '.')) : s;
}

/** Tira si el parametro esta mal escrito: sin campo, sin lecturas, o una lectura sin fecha valida, valor o fuente. */
export function validarParametro(p) {
  if (!p || typeof p !== 'object') throw new Error('hay un parametro vacio');
  if (!p.campo) throw new Error('hay un parametro sin "campo"');
  if (!Array.isArray(p.lecturas)) throw new Error(`"${p.campo}" no tiene la lista "lecturas"`);
  p.lecturas.forEach((l, i) => {
    try { aFecha(l?.fecha); } catch (e) { throw new Error(`"${p.campo}", lectura ${i + 1}: ${e.message}`); }
    if (l.valor === undefined || l.valor === null || l.valor === '') throw new Error(`"${p.campo}", lectura ${i + 1}: falta el valor`);
    if (!l.fuente) throw new Error(`"${p.campo}", lectura ${i + 1} (${l.fecha}): falta la fuente (el video o la foto de donde se leyo)`);
  });
}

/** Las lecturas en orden (fecha, y dentro del dia el orden en que se anotaron), cada una con `cambio` si difiere de la anterior. */
export function historia(p) {
  validarParametro(p);
  const orden = p.lecturas.map((l, i) => ({ ...l, _i: i }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a._i - b._i));
  let previa = null;
  return orden.map(({ _i, ...l }) => {
    const cambio = previa && !mismoValor(previa.valor, l.valor) ? { de: previa.valor, a: l.valor, antes: previa } : null;
    previa = l;
    return { ...l, cambio };
  });
}

export function listaParametros(datos) {
  if (!datos || !Array.isArray(datos[CLAVE])) throw new Error(`el bloque json no tiene la lista "${CLAVE}"`);
  return datos[CLAVE];
}

/** Cada parametro con su historia o, si esta mal escrito, con el error (nunca se calla: se dice). */
export function revisar(datos) {
  return listaParametros(datos).map((p) => {
    try { return { p, hist: historia(p), error: null }; } catch (e) { return { p, hist: null, error: e.message }; }
  });
}

/**
 * Anota una lectura. Valida antes de tocar nada; si el campo no existe lo crea (con su unidad, si viene). La misma
 * lectura dos veces (fecha, fuente y valor iguales) no se anota. Devuelve la lectura con `cambio` contra la anterior
 * en el tiempo: ese es el aviso.
 */
export function anotarLectura(datos, campo, { fecha, valor, fuente, unidad }) {
  const lista = listaParametros(datos);
  aFecha(fecha);
  if (!fuente || String(fuente).startsWith('--')) throw new Error('falta --fuente: el video o la foto de donde se leyo (la fecha es la del video, no la del panel)');
  const v = typeof valor === 'number' ? valor : leerValor(valor);
  let p = lista.find((x) => x && norm(x.campo) === norm(campo));
  if (p) validarParametro(p);
  if (p && p.lecturas.some((l) => l.fecha === fecha && norm(l.fuente) === norm(fuente) && mismoValor(l.valor, v))) {
    throw new Error(`esa lectura ya esta anotada en "${p.campo}" (${fecha}, ${fuente})`);
  }
  if (!p) {
    p = { campo: String(campo), ...(unidad ? { unidad: String(unidad) } : {}), lecturas: [] };
    lista.push(p);
  }
  p.lecturas.push({ fecha, valor: v, fuente: String(fuente) });
  const h = historia(p);
  const nueva = h.filter((l) => l.fecha === fecha && norm(l.fuente) === norm(fuente) && mismoValor(l.valor, v)).pop();
  return { parametro: p, lectura: nueva };
}

const fechaCorta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const conUnidad = (v, u) => `${typeof v === 'number' ? String(v).replace('.', ',') : v}${u ? ` ${u}` : ''}`;

/** Una linea de aviso por cada cambio. */
export function lineaCambio(p, l) {
  return `CAMBIO «${p.campo}»: ${conUnidad(l.cambio.de, p.unidad)} -> ${conUnidad(l.cambio.a, p.unidad)} el ${fechaCorta(l.fecha)} (${l.fuente}; antes, ${fechaCorta(l.cambio.antes.fecha)}, ${l.cambio.antes.fuente})`;
}

/** El informe de UNA maquina: primero los cambios, despues la historia de cada parametro. */
export function informe(nombre, datos) {
  const rev = revisar(datos);
  const l = [`== ${nombre}: ${rev.length} parametro(s)`];
  const cambios = [];
  for (const { p, hist } of rev) for (const x of hist || []) if (x.cambio) cambios.push(lineaCambio(p, x));
  const rotos = rev.filter((r) => r.error);
  for (const r of rotos) l.push(`ESTA MAL ESCRITO: ${r.error}`);
  l.push(cambios.length ? `${cambios.length} cambio(s):` : 'Sin cambios entre lecturas.');
  for (const c of cambios) l.push(`  ${c}`);
  for (const { p, hist } of rev) {
    if (!hist) continue;
    l.push(`\n${p.campo}${p.pantalla ? ` (pantalla: ${p.pantalla})` : ''}${p.unidad ? `, ${p.unidad}` : ''}`);
    for (const x of hist) l.push(`  ${fechaCorta(x.fecha)}  ${conUnidad(x.valor, '')}  ${x.fuente}${x.cambio ? `  << CAMBIO (antes ${conUnidad(x.cambio.de, '')})` : ''}`);
  }
  return l.join('\n');
}

export { leerBloque, escribirBloque };
