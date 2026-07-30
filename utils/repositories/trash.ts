/**
 * Papelera de documentos APQP — archivado antes de borrar.
 *
 * POR QUE EXISTE ESTE ARCHIVO (2026-07-30)
 *
 * Hasta hoy los 4 repositorios de documentos hacian, cada uno por su cuenta:
 *
 *     try {
 *         INSERT OR REPLACE INTO deleted_documents (...) SELECT ... FROM x WHERE id = ?
 *     } catch { logger.warn('proceeding with delete') }
 *     DELETE FROM x WHERE id = ?
 *
 * Habia tres fallas encadenadas:
 *
 *  1. La tabla `deleted_documents` NO existia en Supabase. El CREATE TABLE de la
 *     migracion 16 se convierte en no-op en `SupabaseAdapter.execute()`, pero la
 *     migracion se marcaba como aplicada igual.
 *  2. Aun con la tabla creada, ese SQL salia CORTADO: `convertInsertOrReplace()`
 *     busca el final del VALUES con `lastIndexOf(')')`, y como `datetime('now')` ya
 *     habia sido traducido a `NOW()`, el ultimo `)` era el de `NOW()`. Resultado:
 *     se perdia el `FROM ... WHERE id = ?`.
 *  3. El `catch` degradaba el fallo a un warning y el DELETE se ejecutaba igual.
 *
 * O sea: borrar un AMFE era definitivo y silencioso.
 *
 * Este modulo lo invierte: **si el archivado no se puede confirmar, el borrado no
 * ocurre**. Guarda la fila ORIGINAL COMPLETA en `row_json`, porque `amfe_documents`
 * tiene 16 columnas NOT NULL y un restore desde 4 campos fallaria siempre.
 *
 * Para ver y restaurar lo archivado: `node scripts/_trash.mjs --list` / `--restore`.
 */

import type { DbAdapter } from '../database';
import { getCurrentUserEmail } from '../currentUser';
import { logger } from '../logger';

/** Los 4 tipos de documento que la papelera acepta (CHECK constraint en la tabla). */
export type TrashDocType = 'amfe' | 'cp' | 'ho' | 'pfd';

/**
 * Origen de cada tipo. Lista canonica: nunca derivar la tabla concatenando strings.
 *
 * `columnaProyecto` no es la misma en todos: amfe y cp usan `project_name`, pero
 * ho y pfd usan `linked_amfe_project`. Si se lee la columna equivocada, la papelera
 * queda con el nombre de proyecto vacio y el listado es inservible para encontrar
 * lo que borraste.
 */
const ORIGEN: Record<TrashDocType, { tabla: string; columnaProyecto: string }> = {
    amfe: { tabla: 'amfe_documents', columnaProyecto: 'project_name' },
    cp: { tabla: 'cp_documents', columnaProyecto: 'project_name' },
    ho: { tabla: 'ho_documents', columnaProyecto: 'linked_amfe_project' },
    pfd: { tabla: 'pfd_documents', columnaProyecto: 'linked_amfe_project' },
};

export type ResultadoArchivado =
    /** La fila quedo en la papelera y esta confirmada. Se puede borrar. */
    | { estado: 'archivado' }
    /** El documento no existe en la tabla de origen. No hay nada que borrar. */
    | { estado: 'no-existia' };

/**
 * Copia un documento a la papelera y CONFIRMA que quedo guardado.
 *
 * Lanza si no puede confirmar el archivado. El llamador NO debe atrapar el error
 * para seguir borrando: ese era exactamente el bug. Si esto lanza, el documento
 * tiene que quedar donde esta.
 */
export async function archivarEnPapelera(
    db: DbAdapter,
    docType: TrashDocType,
    id: string,
): Promise<ResultadoArchivado> {
    const origen = ORIGEN[docType];
    if (!origen) {
        // Imposible por tipos, pero un docType invalido escribiria en una tabla
        // equivocada o en `undefined`: fallar es la unica opcion segura.
        throw new Error(`archivarEnPapelera: doc_type invalido "${docType}"`);
    }

    const filas = await db.select<Record<string, unknown>>(
        `SELECT * FROM ${origen.tabla} WHERE id = ?`,
        [id],
    );

    if (filas.length === 0) {
        // OJO: `SupabaseAdapter.select()` devuelve [] tanto si no hay filas como si
        // la lectura FALLO. Aca eso es aceptable porque el resultado es no borrar
        // nada (el DELETE de un id inexistente es un no-op), o sea falla del lado
        // seguro. Que `select()` deje de tapar errores es trabajo de la ola 4.
        return { estado: 'no-existia' };
    }

    const fila = filas[0];
    const valorProyecto = fila[origen.columnaProyecto];
    const projectName = typeof valorProyecto === 'string' ? valorProyecto : null;

    await db.execute(
        `INSERT OR REPLACE INTO deleted_documents (id, doc_type, project_name, row_json, deleted_by)
         VALUES (?, ?, ?, ?, ?)`,
        [id, docType, projectName, JSON.stringify(fila), getCurrentUserEmail()],
    );

    // Verificacion post-escritura. Sin esto seguiriamos confiando en que el INSERT
    // hizo algo: `execute()` puede devolver rowsAffected sin que haya escrito nada,
    // y es justo el patron de fallo silencioso que dejo los backups vacios 19 dias.
    const confirmacion = await db.select<{ id: string }>(
        `SELECT id FROM deleted_documents WHERE id = ?`,
        [id],
    );

    if (confirmacion.length === 0) {
        throw new Error(
            `archivarEnPapelera: no se pudo CONFIRMAR el archivado de ${docType} ${id}. ` +
            `El borrado se aborta para no perder el documento.`,
        );
    }

    logger.info('Trash', `${docType} ${id} archivado en la papelera`);
    return { estado: 'archivado' };
}

/**
 * Archiva y despues borra, en ese orden y solo si el archivado se confirmo.
 * Devuelve true si el documento ya no esta en su tabla de origen.
 */
export async function archivarYBorrar(
    db: DbAdapter,
    docType: TrashDocType,
    id: string,
): Promise<boolean> {
    const resultado = await archivarEnPapelera(db, docType, id);

    if (resultado.estado === 'no-existia') {
        logger.info('Trash', `${docType} ${id} no existe: nada que borrar`);
        return true;
    }

    await db.execute(`DELETE FROM ${ORIGEN[docType].tabla} WHERE id = ?`, [id]);
    return true;
}

/**
 * Variante por nombre de proyecto, que puede alcanzar VARIAS filas.
 *
 * Resuelve primero los ids y despues archiva y borra de a uno, para que cada
 * documento tenga su propia fila en la papelera. La version anterior hacia un
 * `DELETE ... WHERE project_name = ?` con un solo INSERT de archivado: si el
 * proyecto tenia mas de un documento, se borraban todos y se archivaba a lo sumo uno.
 *
 * Corta en el primer fallo. Devuelve true si se borraron todos los que existian.
 */
export async function archivarYBorrarPorProyecto(
    db: DbAdapter,
    docType: TrashDocType,
    projectName: string,
): Promise<boolean> {
    const origen = ORIGEN[docType];
    if (!origen) throw new Error(`archivarYBorrarPorProyecto: doc_type invalido "${docType}"`);

    const filas = await db.select<{ id: string }>(
        `SELECT id FROM ${origen.tabla} WHERE ${origen.columnaProyecto} = ?`,
        [projectName],
    );

    if (filas.length === 0) {
        logger.info('Trash', `${docType}: el proyecto "${projectName}" no tiene documentos: nada que borrar`);
        return true;
    }

    for (const { id } of filas) {
        await archivarYBorrar(db, docType, id);
    }

    logger.info('Trash', `${docType}: ${filas.length} documento(s) del proyecto "${projectName}" archivados y borrados`);
    return true;
}
