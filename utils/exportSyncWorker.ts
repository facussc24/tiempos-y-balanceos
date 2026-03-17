/**
 * Export Sync Worker — Background poller that flushes pending exports to Y: drive
 *
 * Runs on a configurable interval (default 60s). When Y: drive becomes
 * available, writes all queued exports from the pending_exports SQLite table.
 *
 * @module exportSyncWorker
 */

import { isTauri } from './unified_fs';
import { logger } from './logger';
import { isPathAccessible } from './storageManager';
import { getExportBasePath, DEFAULT_EXPORT_BASE_PATH, UNC_EXPORT_FALLBACK } from './exportPathManager';
import { updateManifestEntry } from './syncManifest';
import {
    dequeueAll,
    markCompleted,
    markFailed,
    getPendingCount,
    purgeFailed,
} from './repositories/pendingExportRepository';

// ============================================================================
// State
// ============================================================================

let intervalId: ReturnType<typeof setInterval> | null = null;
let isFlushing = false;
let lastPurgeTime = 0;
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Callback for UI notifications */
type SyncCallback = (event: { type: 'flushed' | 'error'; count: number; errors?: string[] }) => void;
let onSyncEvent: SyncCallback | null = null;

// ============================================================================
// Public API
// ============================================================================

/**
 * Start the background sync worker.
 * @param intervalMs - Polling interval in milliseconds (default 60000 = 60s)
 * @param callback - Optional callback for UI notifications
 */
export function startExportSyncWorker(intervalMs: number = 60_000, callback?: SyncCallback): void {
    if (intervalId !== null) return; // Already running
    if (!isTauri()) return; // No filesystem in web mode

    onSyncEvent = callback ?? null;

    intervalId = setInterval(async () => {
        await flushPendingExports();
    }, intervalMs);

    logger.info('ExportSyncWorker', `Started with ${intervalMs}ms interval`);
}

/**
 * Stop the background sync worker.
 */
export function stopExportSyncWorker(): void {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
        onSyncEvent = null;
        logger.info('ExportSyncWorker', 'Stopped');
    }
}

/**
 * Check if the worker is currently running.
 */
export function isWorkerRunning(): boolean {
    return intervalId !== null;
}

/**
 * Manually trigger a flush of pending exports.
 * Can be called from UI ("Sync Now" button).
 */
export async function flushPendingExports(): Promise<{ flushed: number; errors: string[] }> {
    if (isFlushing) return { flushed: 0, errors: ['Flush already in progress'] };
    isFlushing = true;

    const result = { flushed: 0, errors: [] as string[] };

    try {
        // 1. Quick check: any pending items?
        const count = await getPendingCount();
        if (count === 0) return result;

        // 2. Check if Y: drive is available
        const basePath = await resolveAvailablePath();
        if (!basePath) {
            logger.debug('ExportSyncWorker', 'Y: drive not available, skipping flush');
            return result;
        }

        // 3. Get all pending items
        const items = await dequeueAll();
        if (items.length === 0) return result;

        logger.info('ExportSyncWorker', `Flushing ${items.length} pending exports`);

        const fs = await import('./unified_fs');

        for (const item of items) {
            try {
                // Rebase targetDir if the available base path differs from what was stored
                const targetDir = rebaseTargetDir(item.targetDir, basePath);

                // Ensure target directory exists
                await fs.ensureDir(targetDir);

                // Write the file
                const fullPath = `${targetDir}\\${item.filename}`;
                await fs.writeFile(fullPath, item.fileData);

                // Mark as completed (delete from queue)
                await markCompleted(item.id!);
                result.flushed++;

                // Update sync manifest (best-effort, non-blocking)
                if (item.documentId) {
                    updateManifestEntry(
                        item.module as import('./exportPathManager').ExportDocModule,
                        item.documentId,
                        '', '', '', // client/piece/pieceName not stored in queue
                        item.revisionLevel,
                        [item.filename],
                        basePath,
                    ).catch(() => { /* non-critical */ });
                }

                logger.info('ExportSyncWorker', `Synced: ${item.filename}`);
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                result.errors.push(`${item.filename}: ${errMsg}`);
                await markFailed(item.id!, errMsg);
                logger.warn('ExportSyncWorker', `Failed to sync: ${item.filename}`, { error: errMsg });
            }
        }

        // Purge permanently failed exports (>3 retries) every 24 hours
        if (Date.now() - lastPurgeTime > PURGE_INTERVAL_MS) {
            try {
                const purged = await purgeFailed();
                if (purged > 0) {
                    logger.info('ExportSyncWorker', `Purged ${purged} permanently failed exports`);
                }
                lastPurgeTime = Date.now();
            } catch {
                // Non-critical
            }
        }

        // Notify UI
        if (onSyncEvent && result.flushed > 0) {
            onSyncEvent({ type: 'flushed', count: result.flushed });
        }
        if (onSyncEvent && result.errors.length > 0) {
            onSyncEvent({ type: 'error', count: result.errors.length, errors: result.errors });
        }
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(errMsg);
        logger.error('ExportSyncWorker', 'Error during flush', {}, err instanceof Error ? err : undefined);
    } finally {
        isFlushing = false;
    }

    return result;
}

/**
 * Get the current count of pending exports (for UI badge).
 */
export { getPendingCount } from './repositories/pendingExportRepository';

// ============================================================================
// Helpers
// ============================================================================

async function resolveAvailablePath(): Promise<string | null> {
    const configured = await getExportBasePath();
    if (await isPathAccessible(configured, 2000)) return configured;
    if (await isPathAccessible(UNC_EXPORT_FALLBACK, 3000)) return UNC_EXPORT_FALLBACK;
    return null;
}

/**
 * Rebase a stored targetDir to use the currently available base path.
 * Handles the case where items were queued with Y: but only UNC is available (or vice versa).
 */
export function rebaseTargetDir(originalDir: string, availableBase: string): string {
    const knownBases = [DEFAULT_EXPORT_BASE_PATH, UNC_EXPORT_FALLBACK];
    for (const base of knownBases) {
        if (originalDir.startsWith(base) && base !== availableBase) {
            return availableBase + originalDir.slice(base.length);
        }
    }
    return originalDir;
}
