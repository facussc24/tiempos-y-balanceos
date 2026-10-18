/**
 * nubeRutas.mjs — donde vive, en la nube, la copia de mi memoria y de la configuracion de Claude.
 * La usa `_nube.mjs`; vive aparte para poder probarla con un HOME de mentira.
 *
 * DESDE EL 01/10/2026 VIVE EN LA NUBE DE INGENIERIA, no en la nube personal de Fak.
 * Regla dura de Fak (`.claude/rules/nube-ingenieria.md`): "no quiero nada en mi nube personal... solo
 * laburamos en la nube de ingenieria". Desde la mudanza del 17/10/2026 la carpeta es
 *     <home>\BARACK ARGENTINA SRL\Ingenieria y Proyecto - General\ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)\
 * y la de antes, en la raiz, se sigue encontrando por el canon `nubeCarpetas.data.json` mientras una PC no baje la mudanza.
 * `buscarNube()` devuelve SIEMPRE una ruta adentro de la biblioteca de Ingenieria, exista o no:
 * nunca vuelve a apuntar a `OneDrive - BARACK ARGENTINA SRL`. `buscarNubeVieja()` queda solo para
 * la mudanza y para avisar si una PC todavia tiene la copia en el lugar viejo.
 *
 * POR QUE NO SE MIRA `Dirent.isDirectory()` (bug del 06/09/2026)
 *
 * En la notebook de Fak `OneDrive - BARACK ARGENTINA SRL` es un REPARSE POINT. Para Node el
 * Dirent que devuelve `readdirSync(home, { withFileTypes: true })` dice `isDirectory() = false`
 * e `isSymbolicLink() = true`, asi que el filtro `d.isDirectory() && /^OneDrive.*BARACK/` la
 * SALTEABA. `statSync` sigue el enlace y mira lo que hay del otro lado: eso es lo que se pregunta.
 * Tests en `__tests__/scripts/nubeRutas.test.mjs`, con una junction (no pide admin).
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/** Primer nivel de la carpeta sincronizada: el nombre de la organizacion. */
export const ORGANIZACION = 'BARACK ARGENTINA SRL';
/** Nombre de la biblioteca de Ingenieria tal como la cuelga Windows al sincronizarla (para el fallback). */
export const BIBLIOTECA_CANONICA = 'Ingeniería y Proyecto - General';

/**
 * CANON DE CARPETAS (mudanza del 17/10/2026). Desde ese dia todo lo del asistente vive adentro de una sola carpeta
 * de la biblioteca, «ASISTENTE INGENIERIA». Cada carpeta (la memoria, los mails, el buzon, los pedidos...) tiene su
 * ruta nueva y sus rutas viejas en `nubeCarpetas.data.json`, y se resuelve con UNA regla: la nueva si existe; si no,
 * la primera vieja que exista; si no existe ninguna, la nueva (lo que crea, crea en el lugar nuevo). Asi el codigo
 * anda antes y despues de mover, y en una PC donde la nube todavia no bajo la mudanza.
 */
export const CANON_CARPETAS = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'nubeCarpetas.data.json'), 'utf8'));
/** La carpeta unica, en la raiz de la biblioteca. */
export const CARPETA_UNICA = CANON_CARPETAS.unica;

/** La entrada del canon de esa clave (`facundo`, `mails`, `buzon`, `pedidos`, `instalar`, `equipo`...). */
export function entradaCarpeta(clave) {
    const e = CANON_CARPETAS.carpetas.find((c) => c.clave === clave);
    if (!e) throw new Error(`nubeRutas: no hay carpeta «${clave}» en nubeCarpetas.data.json`);
    return e;
}

/**
 * Resuelve una carpeta del canon adentro de la biblioteca `bib`.
 * @returns {{ ruta: string, cual: 'nueva'|'vieja'|'ninguna', nueva: string, viejas: string[] }}
 */
export function resolverCarpeta(clave, bib, existe = esCarpeta) {
    const e = entradaCarpeta(clave);
    const nueva = join(bib, ...e.nueva);
    const viejas = e.viejas.map((t) => join(bib, ...t));
    if (existe(nueva)) return { ruta: nueva, cual: 'nueva', nueva, viejas };
    const v = viejas.find((p) => existe(p));
    if (v) return { ruta: v, cual: 'vieja', nueva, viejas };
    return { ruta: nueva, cual: 'ninguna', nueva, viejas };
}

/**
 * La ruta de una carpeta del canon en ESTA PC (o en el `home` de prueba). Sin biblioteca sincronizada, la ruta
 * canonica nueva debajo de `home` (no existe, y el que la usa lo dice).
 */
export function carpetaNube(clave, home = homedir()) {
    const bib = buscarBiblioteca(home) || join(home, ORGANIZACION, BIBLIOTECA_CANONICA);
    return resolverCarpeta(clave, bib).ruta;
}

/** Ruta, relativa a la biblioteca, de la carpeta de mi memoria en el lugar NUEVO (la vieja, en el canon). */
export const CARPETA_EN_INGENIERIA = join(...entradaCarpeta('facundo').nueva);
/** Variable que apunta a una copia de esa carpeta fuera de la nube (un pendrive): ver `buscarNube`. */
export const VARIABLE_CEREBRO = 'BARACK_NUBE_CEREBRO';

/** Nombre de la OneDrive personal en la notebook de Fak y subcarpeta vieja: solo para `buscarNubeVieja`. */
export const CANONICA = 'OneDrive - BARACK ARGENTINA SRL';
export const CARPETA_CEREBRO = 'Barack-cerebro';

/** true si en `p` hay una carpeta, sea directa o del otro lado de un enlace. La usa tambien nubeRegistros.mjs. */
export function esCarpeta(p) {
    try { return statSync(p).isDirectory(); } catch { return false; }
}

/**
 * La biblioteca de Ingenieria sincronizada en esta PC, o null si no esta. Se busca por forma: la
 * carpeta puede venir con o sin tilde segun como la colgo Windows.
 */
export function buscarBiblioteca(home = homedir()) {
    const org = join(home, ORGANIZACION);
    let nombres;
    try { nombres = readdirSync(org); } catch { return null; }
    const cand = nombres.filter((n) => /^Ingenier.{1,2}a y Proyecto - General$/i.test(n)).map((n) => join(org, n)).filter(esCarpeta);
    // Con dos de nombre parecido gana la que tiene la carpeta de Ingenieria adentro.
    return cand.find((p) => esCarpeta(join(p, 'INGENIERIA BARACK (NUNCA BORRAR)'))) || cand[0] || null;
}

/**
 * @param {string} [home] carpeta del usuario (por defecto la real)
 * @returns {string} la carpeta `facundo` del canon (la nueva si existe, si no la vieja): adentro de la biblioteca si esta
 *   PC la tiene sincronizada (exista o no la carpeta, para que `--subir --aplicar` la cree ahi); si no
 *   la tiene, la ruta canonica debajo de `home`, que no existe y hace que `--bajar` lo diga.
 */
export function buscarNube(home = homedir(), env = process.env) {
    // Una PC que se arma desde un pendrive (08/10/2026, notebook de Calidad): la copia de la memoria viaja en una carpeta
    // con la misma forma que la carpeta de la memoria y se dice con esta variable. Solo vale si esa carpeta existe y trae la memoria,
    // y NUNCA si apunta a la nube personal (regla nube-ingenieria.md).
    const forzada = env && env[VARIABLE_CEREBRO];
    if (forzada && esCarpeta(join(forzada, 'claude-memoria')) && !/OneDrive - BARACK/i.test(forzada)) return forzada;
    // Desde la mudanza del 17/10/2026: «5- FACUNDO (memoria y configuracion)» adentro de la carpeta unica, y si esta
    // PC todavia no la tiene, la vieja (canon nubeCarpetas.data.json).
    return carpetaNube('facundo', home);
}

/**
 * El lugar VIEJO (hasta el 01/10/2026): `Barack-cerebro` adentro de la OneDrive personal.
 * @returns {string} la que existe si hay una; si la OneDrive esta pero la carpeta no, la ruta adentro
 *   de esa OneDrive; y si no hay ninguna OneDrive BARACK, la canonica debajo de `home`.
 */
export function buscarNubeVieja(home = homedir()) {
    const canonica = join(home, CANONICA, CARPETA_CEREBRO);
    let entradas;
    try { entradas = readdirSync(home, { withFileTypes: true }); } catch { return canonica; }
    const cand = entradas
        .filter((d) => /^OneDrive.*BARACK/i.test(d.name))
        .map((d) => join(home, d.name))
        // Con stat y no con el Dirent: la OneDrive puede ser un reparse point. El chequeo
        // sigue sacando lo que NO es carpeta (un .lnk con el mismo nombre, por ejemplo).
        .filter(esCarpeta)
        .map((p) => join(p, CARPETA_CEREBRO));
    return cand.find(esCarpeta) || cand[0] || canonica;
}
