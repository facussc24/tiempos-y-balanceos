/**
 * cierreIncremental.mjs — el registro de la sesion se lee de a tramos entre un cierre y el siguiente (plan P9, C1).
 *
 * Por que (medido el 12/10/2026, `.sgc-cache/auditorias/P9_C1_tiempos_ANTES_2026-10-12.json`): en 116 cierres reales
 * releer el registro fue el 65 % del tiempo del control de cierre, y crece con la charla: 1,3 s con 39 MB, 10 s con una
 * de 280 MB + 474 MB de subagentes. Y no lo relee uno solo: `dev-server-guard.sh` (via `archivosSesion.mjs`) hace la
 * misma pasada en paralelo. Los dos comparten el estado guardado aca.
 *
 * Que hace: guarda, por registro y por repo, hasta que byte leyo cada archivo (el principal y los de sus subagentes) y el
 * estado acumulado de la pasada (`st` de cierreGuard.mjs, entero, con `v8.serialize`: conserva Map, Set, Infinity y las
 * referencias compartidas entre `miradasPorId` y las listas de miradas, hueco H2 del plan). En el cierre siguiente lee
 * solo lo nuevo, renglon por renglon con la MISMA funcion que la pasada completa (`procesarLinea`).
 *
 * Cuando NO confia en lo guardado y hace la pasada completa (huecos del plan §6.1):
 *   - el estado no existe, no se puede leer o es de otra version del codigo o de los canones (H4: la version es una huella
 *     de nombre, tamaño y fecha de todo `scripts/_lib/*.mjs` y `*.data.json`)
 *   - un archivo ya leido achico, desaparecio, o cambio su principio o el tramo que termina donde se leyo (H5: compactacion,
 *     fork, --resume, otra sesion con el mismo id)
 *   - cualquier error en el camino: se lee entero como siempre (`relevarTranscript`), y lo guardado no se toca
 *   - existe `<tmp>/claude-cierre-guard/OFF` (apagado en 10 segundos, plan §6.5)
 * Lo que lee: renglones COMPLETOS, contando BYTES (H3). Un ultimo renglon sin su `\n` (Claude Code escribiendo) no avanza
 * lo guardado; se aplica sobre una COPIA del estado para que la respuesta sea la misma que la de la pasada completa.
 * Escribe con un temporal y `rename` (H9): un estado guardado es siempre coherente consigo mismo; si dos procesos escriben
 * a la vez gana el ultimo, y los dos son validos (a lo sumo el proximo cierre lee un poco mas).
 *
 * Adentro de vitest, sin `CIERRE_ESTADO_DIR`, no guarda nada (como el medidor de tiempos): una prueba no ensucia el TEMP.
 * Prueba de igualdad contra la pasada completa sobre registros reales: `scripts/_cierreIncrementalIgualdad.mjs`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  REPO, relevarTranscript, nuevoEstadoRelevamiento, procesarLinea, subagentesDe, resultadoRelevamiento, podarParaGuardar,
} from './cierreGuard.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FORMATO = 1;                    // sube si cambia la forma de lo guardado
const HUELLA_BYTES = 4096;
const TRAMO_BYTES = 8 * 1048576;

/** Carpeta del estado. null = no se guarda (vitest sin carpeta propia, o variable en "off"). */
export function dirEstado(env = process.env) {
  const v = String(env.CIERRE_ESTADO_DIR || '').trim();
  if (v.toLowerCase() === 'off') return null;
  if (v) return v;
  return env.VITEST ? null : path.join(os.tmpdir(), 'claude-cierre-guard');
}

/** Huella del codigo y los canones: si cambia cualquiera, lo guardado se descarta (H4). Nombre, tamaño y fecha. */
let versionCache = null;
export function versionCodigo(dir = AQUI) {
  if (versionCache && versionCache.dir === dir) return versionCache.v;
  const h = crypto.createHash('sha1').update(`f${FORMATO}|${process.versions.node}`);
  const nombres = fs.readdirSync(dir).filter((f) => /\.(mjs|data\.json)$/i.test(f)).sort();
  for (const n of nombres) { const s = fs.statSync(path.join(dir, n)); h.update(`|${n}:${s.size}:${Math.round(s.mtimeMs)}`); }
  versionCache = { dir, v: h.digest('hex') };
  return versionCache.v;
}

const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

function leerRango(fd, desde, largo) {
  const b = Buffer.alloc(largo);
  let n = 0;
  while (n < largo) { const r = fs.readSync(fd, b, n, largo - n, desde + n); if (!r) break; n += r; }
  return n === largo ? b : b.subarray(0, n);
}

/** Lo que identifica lo ya leido de un archivo: el principio y el tramo que termina en `leido`. */
function huella(fd, leido) {
  const cab = Math.min(HUELLA_BYTES, leido);
  const col = Math.min(HUELLA_BYTES, leido);
  return { cabeza: sha1(leerRango(fd, 0, cab)), cola: sha1(leerRango(fd, leido - col, col)) };
}

/**
 * Lee de `desde` hasta el final los renglones completos y los pasa a `alRenglon`. Devuelve el nuevo `leido` (byte
 * siguiente al ultimo `\n`), la cola sin terminar (texto) y los bytes leidos.
 */
function leerRenglones(fd, desde, tamano, alRenglon) {
  let pos = desde; let resto = Buffer.alloc(0); let leido = desde;
  while (pos < tamano) {
    const trozo = leerRango(fd, pos, Math.min(TRAMO_BYTES, tamano - pos));
    if (!trozo.length) break;
    pos += trozo.length;
    const buf = resto.length ? Buffer.concat([resto, trozo]) : trozo;
    let ini = 0; let i;
    while ((i = buf.indexOf(0x0a, ini)) >= 0) {
      let fin = i;
      if (fin > ini && buf[fin - 1] === 0x0d) fin--;               // \r\n, como readline con crlfDelay
      alRenglon(buf.toString('utf8', ini, fin));
      ini = i + 1;
    }
    leido = pos - (buf.length - ini);
    resto = buf.subarray(ini);
  }
  return { leido, cola: resto.length ? resto.toString('utf8') : '', bytes: pos - desde };
}

const claveEstado = (transcriptPath, repo) => sha1(`${path.resolve(transcriptPath)}\0${path.resolve(repo)}`).slice(0, 24);

function cargar(archivoEstado) {
  try { return v8.deserialize(fs.readFileSync(archivoEstado)); } catch { return null; }
}

function guardar(archivoEstado, dato) {
  const tmp = `${archivoEstado}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.mkdirSync(path.dirname(archivoEstado), { recursive: true });
    fs.writeFileSync(tmp, v8.serialize(dato));
    for (let i = 0; i < 4; i++) {
      try { fs.renameSync(tmp, archivoEstado); return true; } catch (e) { if (e.code !== 'EPERM' && e.code !== 'EBUSY' && e.code !== 'EACCES') break; }
    }
  } catch { /* abajo */ }
  try { fs.unlinkSync(tmp); } catch { /* no quedo */ }
  return false;
}

/** Los estados de registros que no se tocan hace 7 dias se van (uno cada tanto: no en cada cierre). */
function limpiarViejos(dir, ahora = Date.now()) {
  try {
    const n = fs.readdirSync(dir);
    if (n.length < 200) return;
    for (const f of n) { const p = path.join(dir, f); try { if (ahora - fs.statSync(p).mtimeMs > 7 * 86400000) fs.unlinkSync(p); } catch { /* otro lo borro */ } }
  } catch { /* sin carpeta */ }
}

/** Lo que paso en la ultima llamada (lo anota el medidor de tiempos): modo y bytes leidos de verdad. */
let ultima = { modo: null, bytes: 0, motivo: '' };
export function ultimaLectura() { return { ...ultima }; }

/**
 * Lo mismo que `relevarTranscript(transcriptPath, { repo })`, leyendo solo lo nuevo desde el cierre anterior.
 * Nunca tira: ante cualquier problema, la pasada completa de siempre.
 */
export async function relevarIncremental(transcriptPath, { repo = REPO, env = process.env } = {}) {
  const completa = async (motivo) => {
    const r = await relevarTranscript(transcriptPath, { repo });
    ultima = { modo: 'completa', bytes: NaN, motivo };
    return r;
  };
  const dir = dirEstado(env);
  if (!dir || !transcriptPath) return completa(dir ? 'sin registro' : 'apagado');
  try {
    if (fs.existsSync(path.join(dir, 'OFF'))) return completa('OFF');
    if (!fs.existsSync(transcriptPath)) return completa('sin registro');
    return await incremental(transcriptPath, repo, dir);
  } catch (e) {
    return completa(`error: ${String(e?.message || e).slice(0, 80)}`);
  }
}

async function incremental(transcriptPath, repo, dir, intento = 0) {
  const archivoEstado = path.join(dir, `${claveEstado(transcriptPath, repo)}.bin`);
  const version = versionCodigo();
  const viejo = cargar(archivoEstado);
  const valido = viejo && viejo.formato === FORMATO && viejo.version === version
    && viejo.transcript === path.resolve(transcriptPath) && viejo.repo === path.resolve(repo) && viejo.st && viejo.archivos;
  const st = valido ? viejo.st : nuevoEstadoRelevamiento();
  const archivos = valido ? viejo.archivos : {};
  const motivo = valido ? 'de a tramos' : (viejo ? 'estado de otra version' : 'sin estado');
  // lo guardado no sirve: se borra y se lee desde cero por este mismo camino (una sola vez), asi queda guardado de nuevo
  const deCero = async (porque) => {
    for (const x of abiertos) if (x.fd != null) { try { fs.closeSync(x.fd); } catch { /* ya cerrado */ } x.fd = null; }
    try { fs.unlinkSync(archivoEstado); } catch { /* no estaba */ }
    if (intento) throw new Error(`de cero dos veces: ${porque}`);
    const r = await incremental(transcriptPath, repo, dir, 1);
    ultima = { ...ultima, modo: 'completa', motivo: porque };
    return r;
  };
  const abiertos = [];

  // el principal primero y despues los subagentes, como la pasada completa (H6 hizo que el orden no cambie la respuesta)
  const lista = [{ ruta: path.resolve(transcriptPath), completa: true }, ...subagentesDe(transcriptPath).map((r) => ({ ruta: path.resolve(r), completa: false }))];
  // un archivo que estaba y ya no esta: lo suyo sigue adentro de st, no se puede sacar -> de cero
  if (valido && Object.keys(archivos).some((r) => !lista.some((x) => x.ruta === r))) return deCero('desaparecio un archivo');

  // primero se valida TODO lo guardado; recien despues se lee (si algo no cierra, de cero sin haber mutado st)
  try {
    for (const a of lista) {
      const prev = archivos[a.ruta];
      const s = fs.statSync(a.ruta);
      if (prev && s.size === prev.leido + (prev.colaBytes || 0) && Math.round(s.mtimeMs) === prev.mtime) { abiertos.push({ a, prev, s, fd: null, igual: true }); continue; }
      const fd = fs.openSync(a.ruta, 'r');
      abiertos.push({ a, prev, s, fd, igual: false });
      if (prev) {
        if (s.size < prev.leido) return deCero('un archivo achico');
        const h = huella(fd, prev.leido);
        if (h.cabeza !== prev.cabeza || h.cola !== prev.cola) return deCero('un archivo cambio lo ya leido');
      }
    }
    let bytes = 0;
    const colas = [];
    const nuevos = {};
    for (const x of abiertos) {
      const { a, prev, s } = x;
      if (x.igual) { nuevos[a.ruta] = prev; if (prev.pendiente) colas.push({ texto: prev.pendiente, completa: a.completa }); continue; }
      const desde = prev ? prev.leido : 0;
      const r = leerRenglones(x.fd, desde, s.size, (linea) => procesarLinea(linea, st, { completa: a.completa, repo }));
      bytes += r.bytes;
      const h = huella(x.fd, r.leido);
      nuevos[a.ruta] = { leido: r.leido, cabeza: h.cabeza, cola: h.cola, mtime: Math.round(s.mtimeMs), colaBytes: s.size - r.leido, pendiente: r.cola };
      if (r.cola) colas.push({ texto: r.cola, completa: a.completa });
    }
    // lo que se devuelve incluye el renglon a medio escribir (si ya es un JSON entero), sobre una copia: no se guarda
    let paraResponder = st;
    if (colas.length) {
      paraResponder = v8.deserialize(v8.serialize(st));
      for (const c of colas) procesarLinea(c.texto, paraResponder, { completa: c.completa, repo });
    }
    const respuesta = resultadoRelevamiento(paraResponder);
    podarParaGuardar(st);
    guardar(archivoEstado, { formato: FORMATO, version, transcript: path.resolve(transcriptPath), repo: path.resolve(repo), archivos: nuevos, st });
    limpiarViejos(dir);
    ultima = { modo: motivo === 'de a tramos' ? 'incremental' : 'completa', bytes, motivo };
    return respuesta;
  } finally {
    for (const x of abiertos) if (x.fd != null) { try { fs.closeSync(x.fd); } catch { /* ya cerrado */ } }
  }

}
