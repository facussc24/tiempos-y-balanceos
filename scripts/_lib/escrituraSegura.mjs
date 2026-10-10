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

/** ¿Son la misma carpeta? (en Windows `path.relative` no distingue mayusculas) */
const misma = (a, b) => path.relative(a, b) === '';

/**
 * La ruta con los enlaces resueltos hasta donde exista; lo que todavia no existe se agrega tal cual.
 * Usa `realpathSync.native` (09/10/2026, cola H16): el `realpathSync` comun de Node NO expande el nombre
 * corto 8.3 de Windows (`C:\Dev\BARACK~1` quedaba tal cual, medido en esta PC) y una variable que nombrara
 * el repo por su nombre corto pasaba por "carpeta de afuera". El nativo lo lleva al nombre largo y resuelve
 * junctions y mayusculas.
 */
function rutaReal(ruta) {
  let actual = path.resolve(ruta);
  const resto = [];
  while (!fs.existsSync(actual)) {
    const padre = path.dirname(actual);
    if (padre === actual) break;
    resto.unshift(path.basename(actual));
    actual = padre;
  }
  try { actual = fs.realpathSync.native(actual); } catch {
    try { actual = fs.realpathSync(actual); } catch { /* se queda con la lexica */ }
  }
  return path.join(actual, ...resto);
}

/**
 * La identidad de una carpeta o archivo en el disco (dispositivo + numero de archivo), o null si no existe o el sistema
 * no la da (ino 0). Es la misma por `C:\...`, por el nombre corto 8.3 y por `\\localhost\C$\...` (medido el 09/10/2026
 * por el auditor): la ruta escrita puede disfrazarse, la identidad no.
 */
function identidad(p) {
  try { const s = fs.statSync(p, { bigint: true }); return s.ino ? `${s.dev}:${s.ino}` : null; } catch { return null; }
}
/** Las identidades de `p` (si existe) y de cada carpeta que la contiene, hasta la raiz. */
function identidadesHaciaArriba(p) {
  const out = [];
  let a = path.resolve(p);
  for (;;) {
    const id = identidad(a);
    if (id) out.push(id);
    const padre = path.dirname(a);
    if (padre === a) break;
    a = padre;
  }
  return out;
}

/**
 * Las carpetas permitidas ahora mismo: las tres del repo mas las del entorno que sean validas.
 * Devuelve [{ base, origen }] para poder decir de donde sale cada una.
 */
export function carpetasPermitidas({ env = process.env, raiz = RAIZ } = {}) {
  const repo = path.resolve(raiz);
  const lista = CARPETAS_DEL_REPO.map((partes) => ({ base: path.join(repo, ...partes), origen: partes.join('/') }));
  // las comparaciones van por la ruta REAL: `C:\Dev\BARACK~1\scripts` es el repo aunque no lo parezca
  const repoReal = rutaReal(repo);
  const delRepoReal = lista.map((c) => rutaReal(c.base));
  // por identidad de disco (cubre lo que una ruta disfraza: recurso administrativo, subst, otra letra)
  const idRepo = identidad(repo);
  const idsDelRepo = lista.map((c) => identidad(c.base)).filter(Boolean);
  const idsSobreElRepo = identidadesHaciaArriba(repo);                    // el repo y las carpetas que lo contienen
  for (const nombre of VARIABLES_DE_CARPETA) {
    const v = String(env?.[nombre] ?? '').trim();
    if (!v) continue;
    const base = path.resolve(v);
    const baseReal = rutaReal(base);
    if (path.parse(base).root === base || path.parse(baseReal).root === baseReal) continue;   // la raiz de un disco
    // un recurso de red o del sistema (`\\localhost\C$\...`, `\\?\UNC\...`): la noche trabaja en discos locales, y por
    // ahi el repo se podia nombrar sin que se notara (auditor 09/10/2026)
    if (baseReal.startsWith('\\\\') || base.startsWith('\\\\')) continue;
    if (misma(base, repo) || adentro(base, repo) || misma(baseReal, repoReal) || adentro(baseReal, repoReal)) continue;   // el repo o algo que lo contiene
    const idBase = identidad(baseReal);
    if (idBase && idsSobreElRepo.includes(idBase)) continue;              // idem, por identidad
    const arriba = identidadesHaciaArriba(baseReal);
    const enElRepo = adentro(repo, base) || adentro(repoReal, baseReal) || (idRepo != null && arriba.includes(idRepo));
    const enIgnorada = delRepoReal.some((r) => misma(baseReal, r) || adentro(r, baseReal)) || arriba.some((id) => idsDelRepo.includes(id));
    if (enElRepo && !enIgnorada) continue;                                 // adentro del repo pero versionado
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
  const absReal = rutaReal(abs);
  let sale = false;
  for (const { base, origen } of carpetasPermitidas({ env, raiz })) {
    // decide la ruta REAL (enlaces, junctions y nombre corto resueltos); la lexica solo sirve para explicar el rechazo
    if (adentro(rutaReal(base), absReal)) return { ok: true, motivo: '', base: origen };
    if (adentro(base, abs)) sale = true;
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
