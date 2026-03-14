/**
 * Solicitud Pending Operations Queue
 *
 * Manages a retry queue for server operations that failed due to
 * network issues. Operations are persisted in the SQLite `settings`
 * table under key `solicitud_pending_ops` as a JSON array.
 *
 * On next app start (or manual trigger), `processPendingOps()` drains
 * the queue by retrying each operation against the server.
 *
 * @module solicitudPendingOps
 */

import { getSetting, setSetting } from '../../utils/repositories/settingsRepository';
import { logger } from '../../utils/logger';
import {
    isSolicitudServerAvailable,
    ensureSolicitudFolder,
    moveSolicitudToObsoletos,
    syncSolicitudToServer,
} from './solicitudServerManager';
import type { SolicitudDocument } from './solicitudTypes';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_CAT = 'SolicitudPendingOps';
const SETTINGS_KEY = 'solicitud_pending_ops';

/** Maximum retries before an operation is considered dead */
const MAX_RETRY_COUNT = 5;

// ============================================================================
// TYPES
// ============================================================================

export type PendingOpType = 'createFolder' | 'updateIndex' | 'moveToObsoletos' | 'exportPdf';

export interface PendingOperation {
    id: string;
    type: PendingOpType;
    solicitudId: string;
    payload: Record<string, unknown>;
    createdAt: string;
    retryCount: number;
    lastError?: string;
}

export interface ProcessResult {
    processed: number;
    failed: number;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Read the queue from settings. Returns empty array on any error.
 */
async function readQueue(): Promise<PendingOperation[]> {
    try {
        const stored = await getSetting<PendingOperation[]>(SETTINGS_KEY);
        if (Array.isArray(stored)) return stored;
        return [];
    } catch (err) {
        logger.warn(LOG_CAT, 'Failed to read pending ops queue', {
            error: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}

/**
 * Persist the queue to settings.
 */
async function writeQueue(ops: PendingOperation[]): Promise<void> {
    try {
        await setSetting(SETTINGS_KEY, ops);
    } catch (err) {
        logger.error(LOG_CAT, 'Failed to persist pending ops queue', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Add a new operation to the pending queue.
 */
export async function enqueueOp(
    type: PendingOpType,
    solicitudId: string,
    payload: Record<string, unknown> = {}
): Promise<void> {
    const op: PendingOperation = {
        id: crypto.randomUUID(),
        type,
        solicitudId,
        payload,
        createdAt: new Date().toISOString(),
        retryCount: 0,
    };

    const queue = await readQueue();
    queue.push(op);
    await writeQueue(queue);

    logger.info(LOG_CAT, 'Operation enqueued', {
        id: op.id,
        type: op.type,
        solicitudId: op.solicitudId,
    });
}

/**
 * Get all pending operations.
 */
export async function getPendingOps(): Promise<PendingOperation[]> {
    return readQueue();
}

/**
 * Remove a single operation from the queue by id.
 */
export async function removeOp(id: string): Promise<void> {
    const queue = await readQueue();
    const filtered = queue.filter((op) => op.id !== id);

    if (filtered.length !== queue.length) {
        await writeQueue(filtered);
        logger.debug(LOG_CAT, 'Operation removed', { id });
    }
}

/**
 * Increment retryCount and set lastError on a queued operation.
 */
export async function updateOpError(id: string, error: string): Promise<void> {
    const queue = await readQueue();
    const op = queue.find((o) => o.id === id);

    if (!op) return;

    op.retryCount += 1;
    op.lastError = error;

    await writeQueue(queue);
    logger.debug(LOG_CAT, 'Operation error updated', {
        id,
        retryCount: op.retryCount,
        error,
    });
}

/**
 * Return the total count of pending operations.
 */
export async function getPendingOpCount(): Promise<number> {
    const queue = await readQueue();
    return queue.length;
}

// ============================================================================
// PROCESSING
// ============================================================================

/**
 * Attempt to execute a single pending operation.
 * Returns true if the operation succeeded and should be removed from the queue.
 */
async function executeOp(op: PendingOperation): Promise<boolean> {
    const doc = op.payload.doc as SolicitudDocument | undefined;

    switch (op.type) {
        case 'createFolder': {
            if (!doc) {
                logger.warn(LOG_CAT, 'createFolder op missing doc payload', { id: op.id });
                return false;
            }
            const result = await ensureSolicitudFolder(doc);
            return result.success;
        }

        case 'moveToObsoletos': {
            if (!doc) {
                logger.warn(LOG_CAT, 'moveToObsoletos op missing doc payload', { id: op.id });
                return false;
            }
            return moveSolicitudToObsoletos(doc);
        }

        case 'exportPdf': {
            if (!doc) {
                logger.warn(LOG_CAT, 'exportPdf op missing doc payload', { id: op.id });
                return false;
            }
            const result = await syncSolicitudToServer(doc);
            return result.success;
        }

        case 'updateIndex': {
            // updateIndex is a placeholder for future server-side index file updates.
            // For now, treat as success (no-op) since folder creation is the real work.
            logger.debug(LOG_CAT, 'updateIndex is a no-op, marking as processed', { id: op.id });
            return true;
        }

        default: {
            logger.warn(LOG_CAT, 'Unknown pending op type', { id: op.id, type: op.type });
            return false;
        }
    }
}

/**
 * Process all pending operations.
 *
 * 1. Checks server availability first (early-exit if offline).
 * 2. Iterates the queue in FIFO order.
 * 3. Successful ops are removed; failed ops get retryCount bumped.
 * 4. Operations that exceed MAX_RETRY_COUNT are discarded with a warning.
 *
 * @returns `{ processed, failed }` counts.
 */
export async function processPendingOps(): Promise<ProcessResult> {
    const queue = await readQueue();

    if (queue.length === 0) {
        return { processed: 0, failed: 0 };
    }

    // Quick check: is the server reachable at all?
    const serverUp = await isSolicitudServerAvailable();
    if (!serverUp) {
        logger.info(LOG_CAT, 'Server not available, skipping pending ops processing', {
            queueLength: queue.length,
        });
        return { processed: 0, failed: queue.length };
    }

    let processed = 0;
    let failed = 0;
    const toRemove: string[] = [];

    for (const op of queue) {
        // Discard operations that have exceeded max retries
        if (op.retryCount >= MAX_RETRY_COUNT) {
            logger.warn(LOG_CAT, 'Operation exceeded max retries, discarding', {
                id: op.id,
                type: op.type,
                retryCount: op.retryCount,
                lastError: op.lastError,
            });
            toRemove.push(op.id);
            failed += 1;
            continue;
        }

        try {
            const success = await executeOp(op);

            if (success) {
                toRemove.push(op.id);
                processed += 1;
                logger.info(LOG_CAT, 'Pending op processed successfully', {
                    id: op.id,
                    type: op.type,
                });
            } else {
                op.retryCount += 1;
                op.lastError = 'Operation returned false';
                failed += 1;
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            op.retryCount += 1;
            op.lastError = errMsg;
            failed += 1;
            logger.warn(LOG_CAT, 'Pending op failed during processing', {
                id: op.id,
                type: op.type,
                retryCount: op.retryCount,
                error: errMsg,
            });
        }
    }

    // Persist updated queue (remove successful/dead ops, keep updated retry counts)
    const remaining = queue.filter((op) => !toRemove.includes(op.id));
    await writeQueue(remaining);

    logger.info(LOG_CAT, 'Pending ops processing complete', {
        processed,
        failed,
        remaining: remaining.length,
    });

    return { processed, failed };
}
