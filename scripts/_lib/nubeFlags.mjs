/**
 * Construccion de los flags de robocopy para `_nube.mjs`.
 *
 * Vive aparte del script para poder probarla: el 03/09/2026 un auditor encontro que
 * `/XO` se estaba colando en la SUBIDA de los archivos sueltos, y el bug nunca se
 * habia ejercitado porque no habia con que.
 *
 * LAS TRES DECISIONES SON INDEPENDIENTES — mezclarlas fue justamente el bug:
 *
 *   1. QUE se recorre. Un archivo suelto va sin /E ni /MIR: con recursion robocopy
 *      encuentra el mismo nombre en subcarpetas (los worktrees de .claude tienen su
 *      propio .env.example) y copia de mas.
 *   2. Si se ESPEJA. Solo la subida de carpetas: /MIR borra en la nube lo que ya no
 *      existe local. Nunca sobre un archivo suelto — /MIR ahi borraria el resto de la
 *      carpeta destino.
 *   3. Si se protege lo NUEVO del destino. /XO ("excluir mas antiguos") va SOLO en la
 *      bajada, para que traer de la nube no pise un archivo local mas nuevo. En la
 *      subida /XO es un bug: si la copia de la nube tiene fecha igual o posterior
 *      (reloj corrido entre PCs, o un --bajar previo que preserva el timestamp), el
 *      archivo editado NO sube, no da error, y el resumen lo muestra igual que
 *      "no habia nada que subir".
 */

/**
 * @param {object} o
 * @param {string} o.origen
 * @param {string} o.destino
 * @param {'subir'|'bajar'} o.direccion
 * @param {string} [o.soloArchivo]  nombre de un archivo suelto, en vez de una carpeta
 * @param {boolean} [o.listar]      /L: enumera lo que haria, sin tocar nada
 * @returns {string[]} argumentos para spawnSync('robocopy', ...)
 */
export function construirFlags({ origen, destino, direccion, soloArchivo, listar }) {
    if (direccion !== 'subir' && direccion !== 'bajar') {
        throw new Error(`direccion invalida: ${JSON.stringify(direccion)} (esperaba 'subir' o 'bajar')`);
    }
    const flags = [origen, destino];

    if (soloArchivo) {
        flags.push(soloArchivo);          // (1) un solo archivo, sin recursion
    } else {
        // (2) espejo solo al subir carpetas: la PC es la fuente de verdad
        flags.push(direccion === 'subir' ? '/MIR' : '/E');
    }

    // (3) proteger lo mas nuevo del destino, en la bajada y para todo tipo de origen
    if (direccion === 'bajar') flags.push('/XO');

    flags.push('/NFL', '/NDL', '/NJH', '/R:2', '/W:2', '/XD', 'node_modules', '__pycache__');
    if (listar) flags.push('/L');
    return flags;
}
