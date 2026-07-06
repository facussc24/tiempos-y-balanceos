/**
 * recordAmfeChanges — engancha el diff-on-save al registro amfe_change_log.
 *
 * Fire-and-forget: se llama tras un guardado formal de AMFE (no en el autosave).
 * Diffea el documento viejo vs el nuevo y persiste los cambios como pendientes;
 * al oficializar una revision se marcan consumidos y alimentan la caratula.
 *
 * @module modules/amfe/recordAmfeChanges
 */

import { logger } from '../../utils/logger';
import { getCurrentUserEmail } from '../../utils/currentUser';
import { appendChanges } from '../../utils/repositories/amfeChangeLogRepository';
import { diffAmfeDocs } from './amfeChangeDiff';
import type { AmfeDocument } from './amfeTypes';

const LOG_TAG = 'RecordAmfeChanges';

/**
 * Registra los cambios de contenido de un AMFE recien guardado.
 * @param documentId id del amfe_document
 * @param oldDoc documento previo (null si es creacion)
 * @param newDoc documento nuevo
 * @param by autor opcional (default: usuario actual, tipo 'user')
 */
export function recordAmfeChanges(
    documentId: string,
    oldDoc: AmfeDocument | null,
    newDoc: AmfeDocument,
    by?: { email?: string; type?: string },
): void {
    void (async () => {
        try {
            const entries = diffAmfeDocs(oldDoc, newDoc);
            if (!entries.length) return;
            await appendChanges(documentId, entries, {
                email: by?.email ?? getCurrentUserEmail(),
                type: by?.type ?? 'user',
            });
            logger.debug(LOG_TAG, `Registrados ${entries.length} cambio(s) para ${documentId}`);
        } catch (err) {
            logger.error(LOG_TAG, `Fallo al registrar cambios de ${documentId}`, {}, err instanceof Error ? err : undefined);
        }
    })();
}
