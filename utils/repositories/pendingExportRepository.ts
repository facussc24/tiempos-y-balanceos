/**
 * Pending Export Repository — SQLite queue for offline export sync
 *
 * When Y: drive is unavailable, exports are stored as BLOBs in the
 * pending_exports table. The exportSyncWorker flushes them when
 * the drive becomes accessible.
 *
 * @module pendingExportRepository
 */

import { getDatabase } from '../database';
import { logger } from '../logger';

// ============================================================================
// Types
// ============================================================================

export interface PendingExportItem {
    id?: number;
    module: string;
    documentId: string;
    revisionLevel: string;
    exportFormat: 'xlsx' | 'pdf' | 'svg';
    filename: string;
    fileData: Uint8Array;
    targetDir: string;
    createdAt?: string;
    retryCount?: number;
    lastError?: string | null;
}

export interface PendingExportRow {
    id: number;
    module: string;
    document_id: string;
    revision_level: string;
    export_format: string;
    filename: string;
    file_data: Uint8Array;
    target_dir: string;
    created_at: string;
    retry_count: number;
    last_error: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRY_COUNT = 3;
const MAX_QUEUE_SIZE = 100;

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Enqueue an export for later sync to Y: drive.
 */
export async function enqueue(item: PendingExportItem): Promise<void> {
    const db = await getDatabase();
    await db.execute(
        `INSERT INTO pending_exports (module, document_id, revision_level, export_format, filename, file_data, target_dir)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.module, item.documentId, item.revisionLevel, item.exportFormat, item.filename, item.fileData, item.targetDir],
    );
    logger.info('PendingExportRepo', 'Export enqueued', {
        module: item.module,
        filename: item.filename,
    });

    // Purge excess items if queue is too large
    await purgeExcess();
}

/**
 * Get all pending exports ordered by creation time (FIFO).
 * Only returns items that haven't exceeded max retries.
 */
export async function dequeueAll(): Promise<PendingExportItem[]> {
    const db = await getDatabase();
    const rows = await db.select<PendingExportRow>(
        `SELECT * FROM pending_exports WHERE retry_count < ? ORDER BY created_at ASC`,
        [MAX_RETRY_COUNT],
    );
    return rows.map(rowToItem);
}

/**
 * Remove a completed export from the queue.
 */
export async function markCompleted(id: number): Promise<void> {
    const db = await getDatabase();
    await db.execute(`DELETE FROM pending_exports WHERE id = ?`, [id]);
}

/**
 * Increment retry count and store the error message.
 */
export async function markFailed(id: number, error: string): Promise<void> {
    const db = await getDatabase();
    await db.execute(
        `UPDATE pending_exports SET retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
        [error, id],
    );
}

/**
 * Get the count of pending exports.
 */
export async function getPendingCount(): Promise<number> {
    const db = await getDatabase();
    const rows = await db.select<{ count: number }>(
        `SELECT COUNT(*) as count FROM pending_exports WHERE retry_count < ?`,
        [MAX_RETRY_COUNT],
    );
    return rows[0]?.count ?? 0;
}

/**
 * Get count of permanently failed exports (exceeded max retries).
 */
export async function getFailedCount(): Promise<number> {
    const db = await getDatabase();
    const rows = await db.select<{ count: number }>(
        `SELECT COUNT(*) as count FROM pending_exports WHERE retry_count >= ?`,
        [MAX_RETRY_COUNT],
    );
    return rows[0]?.count ?? 0;
}

/**
 * Remove permanently failed exports.
 */
export async function purgeFailed(): Promise<number> {
    const db = await getDatabase();
    const rows = await db.select<{ count: number }>(
        `SELECT COUNT(*) as count FROM pending_exports WHERE retry_count >= ?`,
        [MAX_RETRY_COUNT],
    );
    const count = rows[0]?.count ?? 0;
    if (count > 0) {
        await db.execute(`DELETE FROM pending_exports WHERE retry_count >= ?`, [MAX_RETRY_COUNT]);
        logger.info('PendingExportRepo', `Purged ${count} permanently failed exports`);
    }
    return count;
}

/**
 * Remove oldest items if queue exceeds max size.
 */
async function purgeExcess(): Promise<void> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ count: number }>(
            `SELECT COUNT(*) as count FROM pending_exports`,
        );
        const total = rows[0]?.count ?? 0;
        if (total > MAX_QUEUE_SIZE) {
            const excess = total - MAX_QUEUE_SIZE;
            await db.execute(
                `DELETE FROM pending_exports WHERE id IN (
                    SELECT id FROM pending_exports ORDER BY created_at ASC LIMIT ?
                )`,
                [excess],
            );
            logger.warn('PendingExportRepo', `Purged ${excess} oldest exports (queue overflow)`);
        }
    } catch (e) {
        logger.error('PendingExportRepo', 'Error purging excess', {}, e instanceof Error ? e : undefined);
    }
}

// ============================================================================
// Helpers
// ============================================================================

function rowToItem(row: PendingExportRow): PendingExportItem {
    return {
        id: row.id,
        module: row.module,
        documentId: row.document_id,
        revisionLevel: row.revision_level,
        exportFormat: row.export_format as 'xlsx' | 'pdf' | 'svg',
        filename: row.filename,
        fileData: row.file_data,
        targetDir: row.target_dir,
        createdAt: row.created_at,
        retryCount: row.retry_count,
        lastError: row.last_error,
    };
}
