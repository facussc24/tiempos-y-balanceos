/**
 * Cross-Document Check Repository
 *
 * Tracks cross-document change alerts (APQP cascade).
 * When a source document is revised, downstream targets get notified.
 *
 * @module crossDocRepository
 */

import { getDatabase } from '../database';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrossDocCheckRow {
    id: number;
    sourceModule: string;
    sourceDocId: string;
    targetModule: string;
    targetDocId: string;
    sourceRevision: string;
    sourceUpdated: string;
    acknowledgedAt: string | null;
}

interface CrossDocDbRow {
    id: number;
    source_module: string;
    source_doc_id: string;
    target_module: string;
    target_doc_id: string;
    source_revision: string;
    source_updated: string;
    acknowledged_at: string | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert or update a cross-document check.
 * Resets acknowledged_at to NULL on update (new alert).
 */
export async function upsertCrossDocCheck(
    sourceModule: string,
    sourceDocId: string,
    targetModule: string,
    targetDocId: string,
    sourceRevision: string,
    sourceUpdated: string,
): Promise<void> {
    try {
        const db = await getDatabase();
        await db.execute(
            `INSERT INTO cross_doc_checks
             (source_module, source_doc_id, target_module, target_doc_id, source_revision, source_updated, acknowledged_at)
             VALUES (?, ?, ?, ?, ?, ?, NULL)
             ON CONFLICT(source_module, source_doc_id, target_module, target_doc_id)
             DO UPDATE SET source_revision = ?, source_updated = ?, acknowledged_at = NULL`,
            [sourceModule, sourceDocId, targetModule, targetDocId, sourceRevision, sourceUpdated, sourceRevision, sourceUpdated],
        );
    } catch (err) {
        logger.error('CrossDocRepo', `Failed to upsert check ${sourceModule}→${targetModule}`, {}, err instanceof Error ? err : undefined);
    }
}

/**
 * Acknowledge (dismiss) a cross-document alert.
 */
export async function acknowledgeCrossDocAlert(
    sourceModule: string,
    sourceDocId: string,
    targetModule: string,
    targetDocId: string,
): Promise<void> {
    try {
        const db = await getDatabase();
        await db.execute(
            `UPDATE cross_doc_checks
             SET acknowledged_at = datetime('now')
             WHERE source_module = ? AND source_doc_id = ? AND target_module = ? AND target_doc_id = ?`,
            [sourceModule, sourceDocId, targetModule, targetDocId],
        );
    } catch (err) {
        logger.error('CrossDocRepo', `Failed to acknowledge alert ${sourceModule}→${targetModule}`, {}, err instanceof Error ? err : undefined);
    }
}

/**
 * Get all pending (unacknowledged) alerts for a given target document.
 */
export async function getPendingAlerts(
    targetModule: string,
    targetDocId: string,
): Promise<CrossDocCheckRow[]> {
    try {
        const db = await getDatabase();
        const rows = await db.select<CrossDocDbRow>(
            `SELECT id, source_module, source_doc_id, target_module, target_doc_id,
                    source_revision, source_updated, acknowledged_at
             FROM cross_doc_checks
             WHERE target_module = ? AND target_doc_id = ? AND acknowledged_at IS NULL`,
            [targetModule, targetDocId],
        );

        return rows.map(r => ({
            id: r.id,
            sourceModule: r.source_module,
            sourceDocId: r.source_doc_id,
            targetModule: r.target_module,
            targetDocId: r.target_doc_id,
            sourceRevision: r.source_revision,
            sourceUpdated: r.source_updated,
            acknowledgedAt: r.acknowledged_at,
        }));
    } catch (err) {
        logger.error('CrossDocRepo', `Failed to get pending alerts for ${targetModule}/${targetDocId}`, {}, err instanceof Error ? err : undefined);
        return [];
    }
}
