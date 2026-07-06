/**
 * AMFE Change Log Repository
 *
 * CRUD del registro de cambios de contenido de un AMFE (tabla amfe_change_log).
 * Cada guardado formal agrega entradas (diff-on-save); al oficializar una revision
 * se marcan como consumidas. Alimenta el panel de cambios pendientes y el resumen
 * de la caratula.
 *
 * @module amfeChangeLogRepository
 */

import { getDatabase } from '../database';
import { logger } from '../logger';
import type { AmfeChangeEntry } from '../../modules/amfe/amfeChangeDiff';

export interface AmfeChangeLogRow {
    id: number;
    documentId: string;
    opNumber: string;
    scope: string;
    changeType: string;
    itemLabel: string;
    field: string;
    oldValue: string;
    newValue: string;
    summary: string;
    changedBy: string;
    changedByType: string;
    consumedInRev: string | null;
    createdAt: string;
}

interface RawRow {
    id: number;
    document_id: string;
    op_number: string;
    scope: string;
    change_type: string;
    item_label: string;
    field: string;
    old_value: string;
    new_value: string;
    summary: string;
    changed_by: string;
    changed_by_type: string;
    consumed_in_rev: string | null;
    created_at: string;
}

function rowToEntry(r: RawRow): AmfeChangeLogRow {
    return {
        id: r.id,
        documentId: r.document_id,
        opNumber: r.op_number,
        scope: r.scope,
        changeType: r.change_type,
        itemLabel: r.item_label,
        field: r.field,
        oldValue: r.old_value,
        newValue: r.new_value,
        summary: r.summary,
        changedBy: r.changed_by,
        changedByType: r.changed_by_type,
        consumedInRev: r.consumed_in_rev,
        createdAt: r.created_at,
    };
}

/**
 * Agrega en batch las entradas de cambio de un guardado.
 * @param docId id del amfe_document
 * @param entries cambios detectados por diffAmfeDocs
 * @param by autor (email o etiqueta) y tipo (user|ai)
 */
export async function appendChanges(
    docId: string,
    entries: AmfeChangeEntry[],
    by: { email?: string; type?: string } = {},
): Promise<boolean> {
    if (!entries.length) return true;
    try {
        const db = await getDatabase();
        const changedBy = by.email ?? '';
        const changedByType = by.type ?? 'user';
        for (const e of entries) {
            await db.execute(
                `INSERT INTO amfe_change_log
                     (document_id, op_number, scope, change_type, item_label, field,
                      old_value, new_value, summary, changed_by, changed_by_type)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    docId, e.opNumber, e.scope, e.changeType, e.itemLabel, e.field,
                    e.oldValue, e.newValue, e.summary, changedBy, changedByType,
                ],
            );
        }
        return true;
    } catch (err) {
        logger.error('AmfeChangeLogRepo', `Failed to append ${entries.length} changes for ${docId}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/** Lista los cambios aun no consumidos por una revision (los pendientes). */
export async function listPendingChanges(docId: string): Promise<AmfeChangeLogRow[]> {
    try {
        const db = await getDatabase();
        const rows = await db.select<RawRow>(
            `SELECT id, document_id, op_number, scope, change_type, item_label, field,
                    old_value, new_value, summary, changed_by, changed_by_type,
                    consumed_in_rev, created_at
             FROM amfe_change_log
             WHERE document_id = ? AND consumed_in_rev IS NULL
             ORDER BY created_at ASC, id ASC`,
            [docId],
        );
        return rows.map(rowToEntry);
    } catch (err) {
        logger.error('AmfeChangeLogRepo', `Failed to list pending changes for ${docId}`, {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/** Cuenta los cambios pendientes (para el badge del panel). */
export async function countPendingChanges(docId: string): Promise<number> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ n: number }>(
            `SELECT COUNT(*) AS n FROM amfe_change_log WHERE document_id = ? AND consumed_in_rev IS NULL`,
            [docId],
        );
        return rows.length > 0 ? Number(rows[0].n) : 0;
    } catch (err) {
        logger.error('AmfeChangeLogRepo', `Failed to count pending changes for ${docId}`, {}, err instanceof Error ? err : undefined);
        return 0;
    }
}

/** Marca todos los cambios pendientes de un documento como consumidos por una revision. */
export async function markConsumed(docId: string, rev: string): Promise<boolean> {
    try {
        const db = await getDatabase();
        await db.execute(
            `UPDATE amfe_change_log SET consumed_in_rev = ?
             WHERE document_id = ? AND consumed_in_rev IS NULL`,
            [rev, docId],
        );
        return true;
    } catch (err) {
        logger.error('AmfeChangeLogRepo', `Failed to mark changes consumed for ${docId} rev ${rev}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}
