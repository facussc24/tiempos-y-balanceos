/**
 * datosNubeSubir.mjs — la direccion archivos de la nube -> Supabase. APAGADA.
 *
 * Escribir filas en Supabase a partir de archivos es de las cosas que el contrato de autonomia marca
 * "confirmar": espera el si de Fak (plan P55 §5, fila P55 de docs/COLA_CAMBIOS_CODIGO.md). Queda diseñada
 * para que prenderla sea una decision y no un desarrollo:
 *
 *   - `planificarSubida()` (funcion pura, se puede correr siempre): de los pendientes de la base local, cuales
 *     subirian y cuales no, con el motivo.
 *   - `subir()`: tira mientras `HABILITADA` sea false. No hay variable de entorno ni argumento que la prenda:
 *     se prende cambiando la constante en un commit, con el si de Fak escrito en el mensaje.
 *
 * Reglas de diseño (revision independiente del 10/10/2026, plan §7):
 *   - solo suben los documentos de `TABLAS_QUE_SUBEN` y solo por su guardador de `amfeIo.mjs`: va `data`, y
 *     los contadores derivados se recalculan. Nunca la fila del archivo.
 *   - nunca crea una fila: un archivo sin fila en Supabase NO se agrega (asi un documento borrado en la app
 *     no resucita). Tampoco borra.
 *   - `drafts`, `document_locks` y los catalogos de archivo unico no suben nunca.
 *   - solo sube lo que cambio de un lado solo (`solo_nube`, `solo_archivo`); un `conflicto` o un `sin_base`
 *     los resuelve una persona.
 *
 * Ni la noche ni `_datosSincronizar.mjs` importan este archivo (lo mira el test).
 */
export const HABILITADA = false;

/** Tabla -> nombre del guardador de `amfeIo.mjs` por el que subiria. */
export const TABLAS_QUE_SUBEN = Object.freeze({
    amfe_documents: 'saveAmfe',
    cp_documents: 'saveCp',
    ho_documents: 'saveHo',
    pfd_documents: 'savePfd',
});
export const TIPOS_QUE_SUBEN = Object.freeze(['solo_nube', 'solo_archivo']);

/**
 * @param {Record<string, {tipo: string}>} pendientes  los de la base local (`.claude/state/datos-nube-<huella>.json`)
 * @param {Record<string, string[]>|null} [vivas] por tabla, los id que existen en Supabase
 * @returns {{suben: {ruta: string, tabla: string, id: string, por: string}[], noSuben: {ruta: string, motivo: string}[]}}
 */
export function planificarSubida(pendientes = {}, vivas = null) {
    const suben = [];
    const noSuben = [];
    Object.entries(pendientes).forEach(([ruta, p]) => {
        const m = /^([a-z_]+)\/([^/]+)\.json$/.exec(ruta);
        if (!m) { noSuben.push({ ruta, motivo: 'catalogo de archivo unico: solo baja' }); return; }
        const [, tabla, id] = m;
        if (!TABLAS_QUE_SUBEN[tabla]) { noSuben.push({ ruta, motivo: `la tabla ${tabla} no sube nunca` }); return; }
        if (!TIPOS_QUE_SUBEN.includes(p?.tipo)) { noSuben.push({ ruta, motivo: `${p?.tipo}: lo resuelve una persona` }); return; }
        if (vivas && !(vivas[tabla] || []).includes(id)) { noSuben.push({ ruta, motivo: 'no hay fila en Supabase: no se crea (un documento borrado no resucita)' }); return; }
        suben.push({ ruta, tabla, id, por: TABLAS_QUE_SUBEN[tabla] });
    });
    return { suben, noSuben };
}

/** Apagada: tira siempre mientras HABILITADA sea false. */
export async function subir() {
    if (!HABILITADA) {
        throw new Error('subir de la nube a Supabase esta APAGADO: escribir filas desde archivos espera el si de Fak (fila P55 de docs/COLA_CAMBIOS_CODIGO.md)');
    }
    throw new Error('subir(): sin implementar. Al habilitarla, cada documento va por su guardador de amfeIo.mjs con el `data` del archivo, y los AMFE por el escritor validado');
}
