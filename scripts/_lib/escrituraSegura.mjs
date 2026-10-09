/**
 * escrituraSegura.mjs — la UNICA puerta de escritura de la noche de Claude (candado 1, hecho codigo).
 *
 * POR QUE EXISTE (08/10/2026). La regla dice que la noche "no toca el repo": lee y deja archivos solo
 * en carpetas ignoradas por git. Hasta hoy eso era una promesa: `escribirAtomico(ruta, texto)` aceptaba
 * CUALQUIER ruta, asi que un error de codigo (una variable mal armada, un `..` de mas) podia pisar un
 * archivo versionado a las 06:30 sin que ningun hook lo viera (los hooks de Claude Code no corren para
 * el `node` del Programador de tareas). Ahora todo lo que la noche escribe pasa por aca, y esta
 * funcion rechaza cualquier ruta que no caiga adentro de:
 *
 *   <repo>/.claude/state     <repo>/.sgc-cache     <repo>/reports/staging
 *   o la carpeta que indique BARACK_API_DIR, BARACK_PREAUDITORIA_DIR, BARACK_NOVEDADES_DIR o BARACK_PRECIOS_DIR
 *   (las usan los tests con carpetas temporales y quien quiera mover el cache a otro disco).
 *
 * La lista se arma en CADA llamada leyendo el entorno en ese momento (no al importar): un test que
 * fija la variable en `beforeEach` y la saca en `afterEach` no deja nada pegado.
 *
 * Dos cuidados con esas variables, porque abren la lista:
 *   - una que apunte a la raiz de un disco, al repo o a una carpeta que CONTIENE al repo se ignora
 *     (dejaria escribir en el repo entero);
 *   - una que apunte adentro del repo pero fuera de las tres carpetas ignoradas tambien se ignora
 *     (`BARACK_API_DIR=scripts` no habilita `scripts/`).
 * Ademas se compara la ruta REAL (con los enlaces resueltos): una carpeta de .sgc-cache que sea un
 * enlace hacia afuera no sirve de puerta trasera.
 *
 * Se prueba en __tests__/scripts/escrituraSegura.test.mjs. `candadosNocturno.test.mjs` falla si un
 * archivo de la noche escribe con `fs` directo en vez de pasar por aca.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Las carpetas del repo donde la noche puede dejar archivos (todas estan en .gitignore). */
export const CARPETAS_DEL_REPO = Object.freeze([
  ['.claude', 'state'],
  ['.sgc-cache'],
  ['reports', 'staging'],
]);

/** Variables de entorno que apuntan a una carpeta de trabajo de la noche. */
export const VARIABLES_DE_CARPETA = Object.freeze(['BARACK_API_DIR', 'BARACK_PREAUDITORIA_DIR', 'BARACK_NOVEDADES_DIR', 'BARACK_PRECIOS_DIR']);

/** ¿`ruta` esta ESTRICTAMENTE adentro de `base`? (la propia base no cuenta: no es un archivo). */
function adentro(base, ruta) {
  const rel = path.relative(base, ruta);
  if (rel === '') return false;
  if (path.isAbsolute(rel)) return false;           // otro disco
  return rel !== '..' && !rel.startsWith(`..${path.sep}`);
}

/** La ruta con los enlaces resueltos hasta donde exista; lo que todavia no existe se agrega tal cual. */
function rutaReal(ruta) {
  let actual = path.resolve(ruta);
  const resto = [];
  while (!fs.existsSync(actual)) {
    const padre = path.dirname(actual);
    if (padre === actual) break;
    resto.unshift(path.basename(actual));
    actual = padre;
  }
  try { actual = fs.realpathSync(actual); } catch { /* se queda con la lexica */ }
  return path.join(actual, ...resto);
}

/**
 * Las carpetas permitidas ahora mismo: las tres del repo mas las del entorno que sean validas.
 * Devuelve [{ base, origen }] para poder decir de donde sale cada una.
 */
export function carpetasPermitidas({ env = process.env, raiz = RAIZ } = {}) {
  const repo = path.resolve(raiz);
  const lista = CARPETAS_DEL_REPO.map((partes) => ({ base: path.join(repo, ...partes), origen: partes.join('/') }));
  const delRepo = lista.map((c) => c.base);
  for (const nombre of VARIABLES_DE_CARPETA) {
    const v = String(env?.[nombre] ?? '').trim();
    if (!v) continue;
    const base = path.resolve(v);
    if (path.parse(base).root === base) continue;                       // la raiz de un disco
    if (base === repo || adentro(base, repo)) continue;                 // el repo o algo que lo contiene
    const enElRepo = adentro(repo, base);
    if (enElRepo && !delRepo.some((r) => base === r || adentro(r, base))) continue;   // adentro del repo pero versionado
    lista.push({ base, origen: nombre });
  }
  return lista;
}

/**
 * ¿Puede la noche escribir en `ruta`? Pura (no escribe). Devuelve { ok, motivo, base }.
 * `base` dice de donde sale la carpeta permitida que la cubre.
 */
export function rutaPermitida(ruta, { env = process.env, raiz = RAIZ } = {}) {
  if (typeof ruta !== 'string' || !ruta.trim()) return { ok: false, motivo: 'la ruta esta vacia', base: null };
  if (ruta.includes('\0')) return { ok: false, motivo: 'la ruta tiene un caracter nulo', base: null };
  const abs = path.resolve(ruta);
  let sale = false;
  for (const { base, origen } of carpetasPermitidas({ env, raiz })) {
    if (!adentro(base, abs)) continue;
    // la ruta lexica cae adentro; falta ver que los enlaces no la saquen
    if (adentro(rutaReal(base), rutaReal(abs))) return { ok: true, motivo: '', base: origen };
    sale = true;
  }
  return {
    ok: false,
    motivo: sale
      ? 'cae adentro de una carpeta permitida pero un enlace la lleva afuera'
      : 'no cae adentro de .claude/state, .sgc-cache, reports/staging ni de una carpeta BARACK_*_DIR',
    base: null,
  };
}

function exigirPermitida(ruta, opciones) {
  const r = rutaPermitida(ruta, opciones);
  if (!r.ok) {
    throw new Error(`escrituraSegura: no escribo en "${ruta}": ${r.motivo}. La noche de Claude solo deja archivos en carpetas ignoradas por git.`);
  }
  return path.resolve(ruta);
}

/**
 * Escribe `texto` en `ruta` sin dejar nunca un archivo a medias: va a `<ruta>.tmp` y se renombra.
 * Tira un Error claro, ANTES de crear nada, si la ruta no esta permitida. Si el renombrado falla,
 * el `.tmp` queda (la proxima escritura lo pisa) y el archivo anterior sigue entero.
 */
export function escribirSeguro(ruta, texto, opciones = {}) {
  const abs = exigirPermitida(ruta, opciones);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp`;
  fs.writeFileSync(tmp, texto, 'utf8');
  fs.renameSync(tmp, abs);
  return abs;
}

/** Agrega `texto` al final de `ruta` (logs, ledger). Mismo candado que `escribirSeguro`. */
export function agregarSeguro(ruta, texto, opciones = {}) {
  const abs = exigirPermitida(ruta, opciones);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.appendFileSync(abs, texto, 'utf8');
  return abs;
}
