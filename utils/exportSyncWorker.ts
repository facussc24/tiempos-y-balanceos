/**
 * Export Sync Worker
 *
 * Historically a background poller that flushed queued exports to the Y:
 * network drive on the Tauri desktop build. The web build has no local queue
 * or shared drive, so the public API is kept as no-op stubs.
 *
 * @module exportSyncWorker
 */

// ============================================================================
// Public API — Web-mode stubs
// ============================================================================

type SyncCallback = (event: { type: 'flushed' | 'error'; count: number; errors?: string[] }) => void;

/** Web mode: nothing to poll — does nothing. */
export function startExportSyncWorker(_intervalMs: number = 60_000, _callback?: SyncCallback): void {
    /* no-op */
}

/** Web mode: nothing to stop. */
export function stopExportSyncWorker(): void {
    /* no-op */
}

/** Web mode: worker never runs. */
export function isWorkerRunning(): boolean {
    return false;
}

/** Web mode: no queue to flush. */
export async function flushPendingExports(): Promise<{ flushed: number; errors: string[] }> {
    return { flushed: 0, errors: [] };
}

/** Re-export for UI badge (repository returns 0 in web mode). */
export { getPendingCount } from './repositories/pendingExportRepository';

/**
 * Web mode: no target dir rebasing needed — returns input unchanged.
 * Kept exported because tests reference it.
 */
export function rebaseTargetDir(originalDir: string, _availableBase: string): string {
    return originalDir;
}
