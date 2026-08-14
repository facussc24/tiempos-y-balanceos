/**
 * copiaVerificada.mjs — copiar y mover archivos comprobando que llegaron enteros.
 *
 * POR QUE EXISTE: el repo tenia el md5 suelto en `_auditarArbolNuevo.mjs` y `copyFileSync`
 * crudo en tres lugares mas, cada uno verificando distinto o nada. `entregar_dxf()` valida
 * el DXF ANTES de copiarlo pero no mira la copia despues.
 *
 * Y el destino que mas importa es el peor: **el pendrive no tiene Papelera**. Lo que se
 * borra ahi no vuelve. Por eso `moverVerificado` copia, compara hash, y RECIEN AHI borra el
 * origen — nunca al reves.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Windows no abre con doble click una ruta de 260+ caracteres: trunca y el programa dice
 *  "invalid name". Un archivo que no abre no es una entrega. */
export const MAX_PATH_WINDOWS = 259;

export const md5 = (p) => createHash('md5').update(fs.readFileSync(p)).digest('hex');

/** Motivos por los que un destino NO sirve. Vacio = se puede escribir ahi. */
export function revisarDestino(destino) {
    const errores = [];
    const abs = path.resolve(destino);
    if (abs.length > MAX_PATH_WINDOWS) {
        errores.push(`la ruta mide ${abs.length} caracteres (tope ${MAX_PATH_WINDOWS}): `
            + 'Windows no la abre con doble click. Acortar el nombre o la carpeta.');
    }
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) errores.push(`no existe la carpeta destino: ${dir}`);
    return errores;
}

/**
 * Copia y comprueba que la copia es identica al original (md5 + bytes).
 * Si no coincide, borra la copia fallada y tira: media copia es peor que ninguna.
 */
export function copiarVerificado(origen, destino) {
    const errores = revisarDestino(destino);
    if (errores.length) throw new Error(`no puedo copiar a "${destino}":\n  - ${errores.join('\n  - ')}`);

    const hOrigen = md5(origen);
    const bytes = fs.statSync(origen).size;
    fs.copyFileSync(origen, destino);

    const hDestino = md5(destino);
    if (hDestino !== hOrigen || fs.statSync(destino).size !== bytes) {
        fs.unlinkSync(destino);
        throw new Error(`la copia de "${path.basename(origen)}" llego distinta (${hOrigen} vs ${hDestino}). `
            + 'Se borro la copia fallada; el original no se toco.');
    }
    return { md5: hOrigen, bytes };
}

/**
 * Mueve comprobando: copia -> verifica -> borra el origen. En ese orden y no en otro.
 * Sirve para sacar del pendrive lo superado sin perderlo: primero queda a salvo en la
 * carpeta de la tarea, y solo entonces se libera el pendrive.
 */
export function moverVerificado(origen, destino) {
    const r = copiarVerificado(origen, destino);
    fs.unlinkSync(origen);   // recien ahora: el contenido ya esta comprobado del otro lado
    return r;
}
