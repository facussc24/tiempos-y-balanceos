/**
 * Media Manager
 *
 * Historically scanned local AppData for time-study photos/videos and
 * migrated them to the shared drive (Tauri desktop build). The web build
 * keeps the public API as no-op stubs; media persistence is handled by
 * Supabase Storage via repositories.
 *
 * @module mediaManager
 */

// ============================================================================
// TYPES
// ============================================================================

export interface LocalMediaFile {
    projectId: string;
    projectName: string;
    client: string;
    project: string;
    part: string;
    filename: string;
    localPath: string;
    mediaRef: string;
    extension: string;
}

export interface MediaMigrationItem {
    localFile: LocalMediaFile;
    serverDestination: string;
    status: 'pending' | 'copying' | 'done' | 'error';
    error?: string;
}

export interface MediaMigrationResult {
    totalFiles: number;
    migrated: number;
    failed: number;
    errors: Array<{ file: string; error: string }>;
}

export interface MediaMigrationProgress {
    current: number;
    total: number;
    currentFile: string;
    phase: 'scanning' | 'copying' | 'verifying' | 'complete';
}

// ============================================================================
// PUBLIC API — Web-mode stubs
// ============================================================================

/** Web mode: no local filesystem — always empty. */
export async function scanLocalMedia(): Promise<LocalMediaFile[]> {
    return [];
}

/** Web mode: no local filesystem — always zero. */
export async function countLocalMediaFiles(): Promise<number> {
    return 0;
}

/** Web mode: nothing to migrate — always empty plan. */
export async function buildMigrationPlan(
    _localFiles: LocalMediaFile[],
): Promise<MediaMigrationItem[]> {
    return [];
}

/** Web mode: no migration needed — reports zero progress and completes. */
export async function migrateMediaToServer(
    items: MediaMigrationItem[],
    _deleteAfterMigration: boolean,
    onProgress?: (progress: MediaMigrationProgress) => void,
): Promise<MediaMigrationResult & { updatedItems: MediaMigrationItem[] }> {
    onProgress?.({ current: 0, total: 0, currentFile: '', phase: 'complete' });
    return {
        totalFiles: items.length,
        migrated: 0,
        failed: 0,
        errors: [],
        updatedItems: items,
    };
}

/** Web mode: no local media — always null. Callers must use Supabase media refs directly. */
export async function loadMedia(
    _projectId: string,
    _mediaRef: string,
): Promise<string | null> {
    return null;
}

/** Web mode: no local media write. Returns null; callers must persist via Supabase. */
export async function saveMedia(
    _projectId: string,
    _taskId: string,
    _file: File,
    _meta?: { client: string; project?: string; name: string },
): Promise<{ localRef: string; savedToServer: boolean } | null> {
    return null;
}
