/**
 * Sync Engine Module
 *
 * Historically handled bidirectional sync between local disk and a shared
 * network drive (Tauri desktop build). The web build keeps the public API
 * as no-op stubs so the SyncPanel UI renders without errors; actual
 * persistence is handled by Supabase repositories.
 *
 * @module syncEngine
 */

// ============================================================================
// TYPES
// ============================================================================

export type SyncDirection = 'toLocal' | 'toServer' | 'bidirectional';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'error';
export type ConflictResolution = 'keepLocal' | 'keepServer' | 'createCopy' | 'skip';

export interface SyncItem {
    id: string;
    client: string;
    project: string;
    part: string;
    localPath: string;
    serverPath: string;
    status: SyncStatus;
    localModified?: number;
    serverModified?: number;
    localChecksum?: string;
    serverChecksum?: string;
    error?: string;
}

export interface SyncResult {
    success: boolean;
    itemsSynced: number;
    itemsFailed: number;
    conflicts: SyncItem[];
    errors: Array<{ item: SyncItem; error: string }>;
    duration: number;
}

export interface SyncProgress {
    current: number;
    total: number;
    currentItem: string;
    phase: 'scanning' | 'comparing' | 'syncing' | 'complete';
}

export type SyncProgressCallback = (progress: SyncProgress) => void;

// ============================================================================
// PUBLIC API — Web-mode stubs
// ============================================================================

/**
 * Synchronize a single project.
 * Web mode: no-op (Supabase handles persistence).
 */
export async function syncProject(
    _item: SyncItem,
    _direction: SyncDirection,
    _resolution?: ConflictResolution,
): Promise<{ success: boolean; error?: string }> {
    return { success: true };
}

/**
 * Synchronize all projects.
 * Web mode: completes immediately with zero items.
 */
export async function syncAll(
    _direction: SyncDirection,
    onProgress?: SyncProgressCallback,
    _resolveConflicts?: (conflicts: SyncItem[]) => Promise<Map<string, ConflictResolution>>,
): Promise<SyncResult> {
    onProgress?.({ current: 100, total: 100, currentItem: 'Complete', phase: 'complete' });
    return {
        success: true,
        itemsSynced: 0,
        itemsFailed: 0,
        conflicts: [],
        errors: [],
        duration: 0,
    };
}

/**
 * Get sync status for all projects without performing sync.
 * Web mode: always empty (nothing to sync).
 */
export async function getSyncStatus(_onProgress?: SyncProgressCallback): Promise<SyncItem[]> {
    return [];
}

/**
 * Quick check if any sync is needed.
 * Web mode: always false.
 */
export async function needsSync(): Promise<boolean> {
    return false;
}
