/**
 * Media Manager — Unified media handling with local↔server migration
 *
 * Media files (photos/videos of time studies) are stored locally in AppData.
 * This module provides scanning, migration to server, and dual-location loading.
 *
 * @module mediaManager
 */

import { logger } from './logger';

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
    localPath: string;       // full absolute path in AppData
    mediaRef: string;        // relative ref stored in task: "media/{filename}"
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
// LAZY IMPORTS (avoid top-level Tauri deps for test compatibility)
// ============================================================================

async function getTauriFs() {
    return await import('./tauri_fs');
}

async function getPathManager() {
    return await import('./pathManager');
}

async function getStorageManager() {
    return await import('./storageManager');
}

// ============================================================================
// HELPERS
// ============================================================================

/** Reject filenames with path traversal or separator characters */
function isSafeFilename(name: string): boolean {
    if (!name || name === '.' || name === '..') return false;
    return !/[/\\]|\.\./.test(name);
}

// ============================================================================
// SCANNING — Find local media files
// ============================================================================

/**
 * Scan AppData\projects\ for all media files across all projects.
 * Reads data.json from each project to get metadata (client/project/part).
 */
export async function scanLocalMedia(): Promise<LocalMediaFile[]> {
    const tauriFs = await getTauriFs();
    if (!tauriFs.isTauri()) return [];

    const projectsDir = await tauriFs.getProjectsDir();
    if (!projectsDir) return [];

    const results: LocalMediaFile[] = [];

    try {
        const projectEntries = await tauriFs.readDir(projectsDir);

        for (const projectEntry of projectEntries) {
            if (!projectEntry.isDirectory) continue;

            const projectId = projectEntry.name;
            const mediaDir = `${projectEntry.path}/media`;

            // Check if media/ exists
            const mediaExists = await tauriFs.exists(mediaDir);
            if (!mediaExists) continue;

            // Read project metadata
            const dataPath = `${projectEntry.path}/data.json`;
            const json = await tauriFs.readTextFile(dataPath);
            if (!json) continue;

            let meta = { name: projectId, client: '', project: '', part: '' };
            try {
                const data = JSON.parse(json);
                meta = {
                    name: data.meta?.name || projectId,
                    client: data.meta?.client || '',
                    project: data.meta?.project || '',
                    part: data.meta?.name || '',
                };
            } catch {
                // Skip projects with invalid JSON
                continue;
            }

            // Skip projects without client metadata (can't map to server path)
            if (!meta.client) continue;

            // Read media files
            const mediaEntries = await tauriFs.readDir(mediaDir);
            for (const mediaEntry of mediaEntries) {
                if (mediaEntry.isDirectory) continue;
                if (!isSafeFilename(mediaEntry.name)) continue;

                const ext = mediaEntry.name.split('.').pop()?.toLowerCase() || '';
                results.push({
                    projectId,
                    projectName: meta.name,
                    client: meta.client,
                    project: meta.project,
                    part: meta.part,
                    filename: mediaEntry.name,
                    localPath: mediaEntry.path,
                    mediaRef: `media/${mediaEntry.name}`,
                    extension: ext,
                });
            }
        }
    } catch (e) {
        logger.error('MediaManager', 'Failed to scan local media', {}, e instanceof Error ? e : undefined);
    }

    return results;
}

/**
 * Quick count of local media files (for badge display).
 * Filters by meta.client to match scanLocalMedia behavior.
 */
export async function countLocalMediaFiles(): Promise<number> {
    const tauriFs = await getTauriFs();
    if (!tauriFs.isTauri()) return 0;

    const projectsDir = await tauriFs.getProjectsDir();
    if (!projectsDir) return 0;

    let count = 0;

    try {
        const projectEntries = await tauriFs.readDir(projectsDir);
        for (const entry of projectEntries) {
            if (!entry.isDirectory) continue;

            const mediaDir = `${entry.path}/media`;
            const mediaExists = await tauriFs.exists(mediaDir);
            if (!mediaExists) continue;

            // Read project metadata — skip projects without client (same as scanLocalMedia)
            const dataPath = `${entry.path}/data.json`;
            try {
                const json = await tauriFs.readTextFile(dataPath);
                if (!json) continue;
                const data = JSON.parse(json);
                if (!data.meta?.client) continue;
            } catch {
                continue;
            }

            const mediaEntries = await tauriFs.readDir(mediaDir);
            count += mediaEntries.filter(e => !e.isDirectory).length;
        }
    } catch (e) {
        logger.debug('MediaManager', 'Error counting local media', { error: String(e) });
    }

    return count;
}

// ============================================================================
// MIGRATION — Move files from local AppData → server
// ============================================================================

/**
 * Build migration plan: maps each local file to its server destination.
 */
export async function buildMigrationPlan(
    localFiles: LocalMediaFile[]
): Promise<MediaMigrationItem[]> {
    const pathManager = await getPathManager();

    return localFiles.map(file => {
        const serverPath = pathManager.buildPath(
            'media',
            file.client,
            file.project || file.client,
            file.part,
            file.filename
        );

        return {
            localFile: file,
            serverDestination: serverPath,
            status: 'pending' as const,
        };
    });
}

/**
 * Migrate media files from local AppData to server.
 * Copies file by file with progress reporting. Resilient to partial failures.
 * Works on deep-cloned items — does NOT mutate the input array.
 * Returns result + updated items array for React state.
 */
export async function migrateMediaToServer(
    items: MediaMigrationItem[],
    deleteAfterMigration: boolean,
    onProgress?: (progress: MediaMigrationProgress) => void
): Promise<MediaMigrationResult & { updatedItems: MediaMigrationItem[] }> {
    const tauriFs = await getTauriFs();
    const storageManager = await getStorageManager();

    // Deep-clone items to avoid mutating React state
    const workItems: MediaMigrationItem[] = items.map(item => ({
        ...item,
        localFile: { ...item.localFile },
    }));

    const result: MediaMigrationResult & { updatedItems: MediaMigrationItem[] } = {
        totalFiles: workItems.length,
        migrated: 0,
        failed: 0,
        errors: [],
        updatedItems: workItems,
    };

    // Verify server is available before starting
    const serverUp = await storageManager.isServerAvailable();
    if (!serverUp) {
        result.failed = workItems.length;
        result.errors = [{ file: '*', error: 'Servidor no disponible' }];
        return result;
    }

    for (let i = 0; i < workItems.length; i++) {
        const item = workItems[i];
        item.status = 'copying';

        onProgress?.({
            current: i + 1,
            total: workItems.length,
            currentFile: item.localFile.filename,
            phase: 'copying',
        });

        try {
            // Ensure destination directory exists
            const destDir = item.serverDestination.substring(
                0,
                Math.max(item.serverDestination.lastIndexOf('\\'), item.serverDestination.lastIndexOf('/'))
            );
            await tauriFs.ensureDir(destDir);

            // Check if file already exists on server (skip copy, still count as migrated)
            const alreadyExists = await tauriFs.exists(item.serverDestination);
            if (!alreadyExists) {
                // Copy local → server
                const success = await tauriFs.copyFile(
                    item.localFile.localPath,
                    item.serverDestination
                );

                if (!success) {
                    throw new Error('copyFile returned false');
                }

                // Verify copy exists
                const verified = await tauriFs.exists(item.serverDestination);
                if (!verified) {
                    throw new Error('File not found after copy');
                }
            }

            item.status = 'done';
            result.migrated++;

            // Delete local copy if requested (also for files already on server)
            if (deleteAfterMigration) {
                await tauriFs.remove(item.localFile.localPath);
            }
        } catch (e) {
            item.status = 'error';
            item.error = e instanceof Error ? e.message : String(e);
            result.failed++;
            result.errors.push({
                file: item.localFile.filename,
                error: item.error,
            });
            logger.error('MediaManager', 'Migration failed for file', {
                file: item.localFile.filename,
                error: item.error,
            });
        }
    }

    onProgress?.({
        current: workItems.length,
        total: workItems.length,
        currentFile: '',
        phase: 'complete',
    });

    return result;
}

// ============================================================================
// DUAL-LOCATION MEDIA LOADING
// ============================================================================

/**
 * Load a media file. Tries local AppData first, then server.
 * Returns blob URL or null.
 */
export async function loadMedia(
    projectId: string,
    mediaRef: string
): Promise<string | null> {
    const tauriFs = await getTauriFs();
    if (!tauriFs.isTauri() || !mediaRef) return null;

    // 1. Try local AppData
    const localUrl = await tauriFs.loadMediaFile(projectId, mediaRef);
    if (localUrl) return localUrl;

    // 2. Try server location (need project metadata to build path)
    try {
        const projectsDir = await tauriFs.getProjectsDir();
        if (!projectsDir) return null;

        const dataPath = `${projectsDir}/${projectId}/data.json`;
        const json = await tauriFs.readTextFile(dataPath);
        if (!json) return null;

        const data = JSON.parse(json);
        const client = data.meta?.client;
        const project = data.meta?.project || client;
        const part = data.meta?.name;

        if (!client || !part) return null;

        const filename = mediaRef.replace(/^media\//, '');
        const pathManager = await getPathManager();
        const serverPath = pathManager.buildPath('media', client, project, part, filename);

        const content = await tauriFs.readBinaryFile(serverPath);
        if (!content) return null;

        // Build blob URL from server file
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const mimeTypes: Record<string, string> = {
            'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime',
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
        };
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        const arrayBuffer = content.buffer.slice(
            content.byteOffset,
            content.byteOffset + content.byteLength
        ) as ArrayBuffer;
        const blob = new Blob([arrayBuffer], { type: mimeType });
        return URL.createObjectURL(blob);
    } catch (e) {
        logger.debug('MediaManager', 'Server media load failed', { projectId, mediaRef, error: String(e) });
        return null;
    }
}

/**
 * Save media file locally, with optional server copy.
 * Always writes to AppData first (fast, reliable).
 * If server is available and project has metadata, also copies to server.
 */
export async function saveMedia(
    projectId: string,
    taskId: string,
    file: File,
    meta?: { client: string; project?: string; name: string }
): Promise<{ localRef: string; savedToServer: boolean } | null> {
    const tauriFs = await getTauriFs();
    if (!tauriFs.isTauri()) return null;

    // 1. Save locally (always)
    const localRef = await tauriFs.saveMediaFile(projectId, taskId, file);
    if (!localRef) return null;

    // 2. Attempt server copy if metadata available
    let savedToServer = false;
    if (meta?.client) {
        try {
            const storageManager = await getStorageManager();
            const serverUp = await storageManager.isServerAvailable();
            if (serverUp) {
                const pathManager = await getPathManager();
                const filename = localRef.replace(/^media\//, '');
                const serverPath = pathManager.buildPath(
                    'media',
                    meta.client,
                    meta.project || meta.client,
                    meta.name,
                    filename
                );

                // Ensure dir + copy
                const destDir = serverPath.substring(0, Math.max(serverPath.lastIndexOf('\\'), serverPath.lastIndexOf('/')));
                await tauriFs.ensureDir(destDir);

                const projectsDir = await tauriFs.getProjectsDir();
                if (projectsDir) {
                    const localPath = `${projectsDir}/${projectId}/${localRef}`;
                    savedToServer = await tauriFs.copyFile(localPath, serverPath);
                }
            }
        } catch (e) {
            logger.debug('MediaManager', 'Server copy failed (non-fatal)', { error: String(e) });
        }
    }

    return { localRef, savedToServer };
}
