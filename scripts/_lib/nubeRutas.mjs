/**
 * nubeRutas.mjs — donde esta la carpeta del cerebro (`Barack-cerebro`) dentro del OneDrive
 * corporativo. La usa `_nube.mjs`; vive aparte para poder probarla con un HOME de mentira.
 *
 * POR QUE NO SE MIRA `Dirent.isDirectory()` (bug del 06/09/2026)
 *
 * En la notebook de Fak `OneDrive - BARACK ARGENTINA SRL` es un REPARSE POINT. Para Node el
 * Dirent que devuelve `readdirSync(home, { withFileTypes: true })` dice `isDirectory() = false`
 * e `isSymbolicLink() = true`, asi que el filtro `d.isDirectory() && /^OneDrive.*BARACK/` la
 * SALTEABA y el script caia al fallback CANONICA, que hoy coincide con el nombre real por
 * casualidad. En otra PC, con otro tenant, no habria encontrado la nube aunque existiera.
 * `statSync` sigue el enlace y mira lo que hay del otro lado: eso es lo que se pregunta.
 * Mismo arreglo que `rutas.mjs` de barack-claude (commit 0ec72ef); tests en
 * `__tests__/scripts/nubeRutas.test.mjs`, con una junction (no pide admin).
 */
import { readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/** Nombre de la carpeta de OneDrive en la notebook de Fak: solo para el fallback. */
export const CANONICA = 'OneDrive - BARACK ARGENTINA SRL';
/** Subcarpeta, dentro de esa OneDrive, donde vive el cerebro. */
export const CARPETA_CEREBRO = 'Barack-cerebro';

/** true si en `p` hay una carpeta, sea directa o del otro lado de un enlace. */
function esCarpeta(p) {
    try { return statSync(p).isDirectory(); } catch { return false; }
}

/**
 * @param {string} [home] carpeta del usuario (por defecto la real)
 * @returns {string} ruta de `Barack-cerebro`: la que existe si hay una; si la OneDrive esta
 *   pero el cerebro todavia no, la ruta adentro de esa OneDrive (para que `--subir --aplicar`
 *   lo cree ahi); y si no hay ninguna OneDrive BARACK, la canonica debajo de `home`.
 */
export function buscarNube(home = homedir()) {
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
