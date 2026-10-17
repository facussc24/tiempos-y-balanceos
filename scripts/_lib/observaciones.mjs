/**
 * observaciones.mjs — el LIBRO DE OBSERVACIONES RECIBIDAS: lo que le marcaron a un documento de Fak (Carlos, Calidad,
 * VW en BeOn, Motherson), convertido en lo que se mira ANTES de mandar el proximo documento de ese tipo. Logica pura:
 * la usan `scripts/_observaciones.mjs` y su test.
 *
 * Tanda 13, item 5 (equipo «fuera de la caja», 15/10/2026): «lo que ya te marcaron una vez no vuelve en el proximo
 * documento». Caso con el que nace: los dos rechazos internos de Carlos Baptista al AMFE de ductos (10/08 y 20/08/2026,
 * `docs/ductos-amfe-hallazgos.md`). Molde: la D7 de la tanda 9 (`correccionGuard.reapariciones`): una observacion de una
 * CLASE que ya se habia cerrado y vuelve es un chequeo que no alcanzo, y se dice.
 *
 * Los datos viven en la memoria `project_observaciones_recibidas.md` (bloque ```json "observaciones"), no en el repo:
 *   { id, fecha: 'AAAA-MM-DD', de, documento, pieza?, que, clase, estado: 'abierta'|'cerrada'|'sin-confirmar',
 *     chequeo: 'que se mira antes de mandar', gate: null | 'el control que la caza solo', gate_parcial?: true,
 *     fuente, cerrada?: { fecha, como } }
 */
import { aFecha } from './seguimientos.mjs';

export const CLAVE = 'observaciones';
export const ESTADOS = ['abierta', 'cerrada', 'sin-confirmar'];

export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

export function lista(datos) {
  if (!datos || !Array.isArray(datos[CLAVE])) throw new Error(`el bloque json no tiene la lista "${CLAVE}"`);
  return datos[CLAVE];
}

/** Tira si una observacion esta mal escrita. */
export function validar(o) {
  if (!o || typeof o !== 'object') throw new Error('hay una observacion vacia');
  const id = o.id || '(sin id)';
  for (const c of ['id', 'de', 'documento', 'que', 'clase', 'chequeo']) {
    if (!o[c] || !String(o[c]).trim()) throw new Error(`la observacion "${id}" no tiene "${c}"`);
  }
  aFecha(o.fecha);
  if (!ESTADOS.includes(o.estado)) throw new Error(`la observacion "${id}" tiene un estado que no existe: "${o.estado}" (van ${ESTADOS.join(', ')})`);
  if (o.estado === 'cerrada') aFecha(o.cerrada?.fecha);
}

/** 'auto' (un control la caza solo), 'parcial' (la caza a medias) o 'manual' (hay que mirarla). */
export const cobertura = (o) => (o.gate ? (o.gate_parcial ? 'parcial' : 'auto') : 'manual');

/** Lo que se mira antes de mandar un documento de ese tipo: primero lo que hay que mirar a mano. Mal escritas, aparte. */
export function antesDeMandar(datos, documento) {
  const d = norm(documento);
  const orden = { manual: 0, parcial: 1, auto: 2 };
  const ok = []; const rotas = [];
  for (const o of lista(datos)) {
    if (norm(o?.documento) !== d) continue;
    try { validar(o); ok.push(o); } catch (e) { rotas.push({ o, error: e.message }); }
  }
  ok.sort((a, b) => orden[cobertura(a)] - orden[cobertura(b)] || a.fecha.localeCompare(b.fecha));
  return { observaciones: ok, rotas };
}

/** Por tipo de documento: total, cuantas caza un control solo, a medias o ninguno, y cuantas siguen abiertas. */
export function resumen(datos) {
  const r = {};
  for (const o of lista(datos)) {
    const k = norm(o?.documento) || '(sin documento)';
    const x = (r[k] ||= { total: 0, auto: 0, parcial: 0, manual: 0, abiertas: 0, rotas: 0 });
    x.total++;
    try { validar(o); } catch { x.rotas++; continue; }
    x[cobertura(o)]++;
    if (o.estado !== 'cerrada') x.abiertas++;
  }
  return r;
}

/**
 * Anota una observacion nueva. Valida antes de tocar los datos. Devuelve { obs, volvio }: `volvio` son las de la MISMA
 * clase que ya estaban cerradas (el chequeo que se armo no alcanzo: eso se dice, molde D7 de la tanda 9).
 */
export function anotar(datos, campos, { hoy } = {}) {
  const l = lista(datos);
  const fecha = campos.fecha || hoy;
  const id = campos.id || `${norm(campos.documento).replace(/[^a-z0-9]+/g, '-')}-${fecha}-${l.length + 1}`;
  if (l.some((o) => o?.id === id)) throw new Error(`ya hay una observacion "${id}"`);
  const obs = {
    id, fecha, de: campos.de, documento: campos.documento, ...(campos.pieza ? { pieza: campos.pieza } : {}),
    que: campos.que, clase: campos.clase, estado: 'abierta', chequeo: campos.chequeo || campos.que,
    gate: campos.gate || null, ...(campos.fuente ? { fuente: campos.fuente } : {}),
  };
  validar(obs);
  if (hoy && obs.fecha > hoy) throw new Error(`la fecha ${obs.fecha} es futura (hoy es ${hoy})`);
  const volvio = l.filter((o) => o && o.estado === 'cerrada' && norm(o.clase) === norm(obs.clase));
  l.push(obs);
  return { obs, volvio };
}

export function cerrar(datos, id, { fecha, como, chequeo, gate }) {
  const o = lista(datos).find((x) => x?.id === id);
  if (!o) throw new Error(`no hay una observacion "${id}"`);
  if (!como || String(como).startsWith('--')) throw new Error('falta --como: que se hizo para que no vuelva');
  aFecha(fecha);
  o.estado = 'cerrada';
  o.cerrada = { fecha, como: String(como) };
  if (chequeo) o.chequeo = String(chequeo);
  if (gate) { o.gate = String(gate); delete o.gate_parcial; }
  return o;
}

const ETIQUETA = { manual: 'A MANO', parcial: 'a medias', auto: 'lo caza solo' };

/** Texto del «antes de mandar» para la consola. */
export function textoAntesDeMandar(datos, documento) {
  const { observaciones, rotas } = antesDeMandar(datos, documento);
  if (!observaciones.length && !rotas.length) return `No hay observaciones recibidas sobre «${documento}».`;
  const l = [`Antes de mandar un ${documento}: ${observaciones.length} observacion(es) recibidas sobre ese tipo de documento.`];
  for (const o of observaciones) {
    const c = cobertura(o);
    l.push(`- [${ETIQUETA[c]}] ${o.chequeo}  (${o.de}, ${o.fecha}${o.pieza ? `, ${o.pieza}` : ''}: «${o.que}»)${o.gate ? `\n    control: ${o.gate}` : ''}`);
  }
  for (const r of rotas) l.push(`- ${r.o?.id || '(sin id)'}: ESTA MAL ESCRITA en la memoria (${r.error}). Arreglarla.`);
  return l.join('\n');
}
