/**
 * Sync Engine Module
 * 
 * Handles bidirectional synchronization between local and shared storage.
 * Provides conflict detection, resolution, and progress tracking.
 * 
 * @module syncEngine
 */

import { isTauri } from './unified_fs';
import { loadStorageSettings, isPathAccessible, updateLastSyncTimestamp, type StorageMode } from './storageManager';
import { getPathConfig } from './pathManager';
import { generateChecksum } from './crypto';
import { logger } from './logger';

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
// CONSTANTS
// ============================================================================

const MASTER_FILE_NAME = 'master.json';
const BACKUP_SUFFIX = '_backup';

// ============================================================================
// FILE SCANNING
// ============================================================================

/**
 * Scan a directory for projects (client/project/part structure)
 */
async function scanProjects(basePath: string): Promise<Map<string, { path: string; modified: number }>> {
    const projects = new Map<string, { path: string; modified: number }>();

    if (!isTauri()) {
        return projects; // Can't scan in web mode
    }

    try {
        const tauriFs = await import('./tauri_fs');
        const pathConfig = getPathConfig();
        const dataPath = `${basePath}\\${pathConfig.dataFolder}`;

        // Check if data directory exists
        if (!await tauriFs.exists(dataPath)) {
            return projects;
        }

        // Scan clients
        const clients = await tauriFs.readDir(dataPath);

        for (const client of clients) {
            if (!client.isDirectory) continue;

            const clientPath = `${dataPath}\\${client.name}`;
            const projectDirs = await tauriFs.readDir(clientPath);

            for (const project of projectDirs) {
                if (!project.isDirectory) continue;

                const projectPath = `${clientPath}\\${project.name}`;
                const parts = await tauriFs.readDir(projectPath);

                for (const part of parts) {
                    if (!part.isDirectory) continue;

                    const partPath = `${projectPath}\\${part.name}`;
                    const masterPath = `${partPath}\\${MASTER_FILE_NAME}`;

                    // Check if master.json exists
                    if (await tauriFs.exists(masterPath)) {
                        const id = `${client.name}/${project.name}/${part.name}`;

                        // Get modification time from file content (lastModified field)
                        let modified = Date.now();
                        try {
                            const content = await tauriFs.readTextFile(masterPath);
                            if (content) {
                                const data = JSON.parse(content);
                                modified = data.lastModified || Date.now();
                            }
                        } catch (readError) {
                            // BUG-04 FIX: Log warning instead of silently using fallback
                            logger.warn('SyncEngine', 'Could not read file modification time, using current', {
                                masterPath,
                                fallbackTime: modified
                            });
                        }

                        projects.set(id, { path: partPath, modified });
                    }
                }
            }
        }
    } catch (error) {
        logger.error('SyncEngine', 'Error scanning projects', {}, error instanceof Error ? error : undefined);
    }

    return projects;
}

/**
 * Get checksum of a file
 */
async function getFileChecksum(filePath: string): Promise<string | null> {
    if (!isTauri()) return null;

    try {
        const tauriFs = await import('./tauri_fs');
        const content = await tauriFs.readTextFile(filePath);
        if (content) {
            return await generateChecksum(content);
        }
    } catch (error) {
        logger.debug('SyncEngine', 'Failed to get checksum', { filePath });
    }

    return null;
}

// ============================================================================
// SYNC COMPARISON
// ============================================================================

/**
 * Compare local and server projects to determine sync actions
 */
async function compareProjects(
    localProjects: Map<string, { path: string; modified: number }>,
    serverProjects: Map<string, { path: string; modified: number }>,
    onProgress?: SyncProgressCallback
): Promise<SyncItem[]> {
    const items: SyncItem[] = [];
    const allIds = new Set([...localProjects.keys(), ...serverProjects.keys()]);
    let processed = 0;

    for (const id of allIds) {
        const [client, project, part] = id.split('/');
        const local = localProjects.get(id);
        const server = serverProjects.get(id);

        const item: SyncItem = {
            id,
            client,
            project,
            part,
            localPath: local?.path || '',
            serverPath: server?.path || '',
            status: 'pending',
            localModified: local?.modified,
            serverModified: server?.modified,
        };

        // Determine status
        if (local && !server) {
            // Only exists locally - needs to go to server
            item.status = 'pending';
        } else if (!local && server) {
            // Only exists on server - needs to come local
            item.status = 'pending';
        } else if (local && server) {
            // Exists in both - check if different
            const localChecksum = await getFileChecksum(`${local.path}\\${MASTER_FILE_NAME}`);
            const serverChecksum = await getFileChecksum(`${server.path}\\${MASTER_FILE_NAME}`);

            item.localChecksum = localChecksum || undefined;
            item.serverChecksum = serverChecksum || undefined;

            if (localChecksum === serverChecksum) {
                item.status = 'synced';
            } else {
                // Different content - potential conflict
                item.status = 'conflict';
            }
        }

        items.push(item);
        processed++;

        onProgress?.({
            current: processed,
            total: allIds.size,
            currentItem: id,
            phase: 'comparing'
        });
    }

    return items;
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Copy a project from source to destination
 */
async function copyProject(
    sourcePath: string,
    destPath: string,
    includeMedia: boolean
): Promise<{ success: boolean; error?: string }> {
    if (!isTauri()) {
        return { success: false, error: 'Not in Tauri environment' };
    }

    try {
        const tauriFs = await import('./tauri_fs');

        // Ensure destination directory exists
        await tauriFs.ensureDir(destPath);

        // Read source directory
        const entries = await tauriFs.readDir(sourcePath);

        for (const entry of entries) {
            const srcFile = `${sourcePath}\\${entry.name}`;
            const destFile = `${destPath}\\${entry.name}`;

            // Skip media if not included
            if (!includeMedia && entry.name.toLowerCase().includes('media')) {
                continue;
            }

            if (entry.isDirectory) {
                // Recursively copy directory
                await tauriFs.ensureDir(destFile);
                const result = await copyProject(srcFile, destFile, includeMedia);
                if (!result.success) {
                    return result;
                }
            } else {
                // Copy file
                const success = await tauriFs.copyFile(srcFile, destFile);
                if (!success) {
                    return { success: false, error: `Failed to copy ${entry.name}` };
                }
            }
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Create a backup copy of a project
 */
async function createBackup(projectPath: string, projectId: string): Promise<string | null> {
    if (!isTauri()) return null;

    try {
        const tauriFs = await import('./tauri_fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${projectPath}${BACKUP_SUFFIX}_${timestamp}`;

        const result = await copyProject(projectPath, backupPath, true);
        if (result.success) {
            logger.info('SyncEngine', 'Created backup', { projectId, backupPath });
            return backupPath;
        }
    } catch (error) {
        logger.error('SyncEngine', 'Failed to create backup', { projectId }, error instanceof Error ? error : undefined);
    }

    return null;
}

// ============================================================================
// MAIN SYNC FUNCTIONS
// ============================================================================

/**
 * Synchronize a single project
 */
export async function syncProject(
    item: SyncItem,
    direction: SyncDirection,
    resolution?: ConflictResolution
): Promise<{ success: boolean; error?: string }> {
    const settings = await loadStorageSettings();
    const includeMedia = settings.syncMediaFiles;

    try {
        if (item.status === 'synced') {
            return { success: true }; // Already synced
        }

        if (item.status === 'conflict' && !resolution) {
            return { success: false, error: 'Conflict requires resolution' };
        }

        // Determine source and destination
        let sourcePath: string;
        let destPath: string;

        if (item.status === 'conflict') {
            switch (resolution) {
                case 'keepLocal':
                    sourcePath = item.localPath;
                    destPath = item.serverPath;
                    break;
                case 'keepServer':
                    sourcePath = item.serverPath;
                    destPath = item.localPath;
                    break;
                case 'createCopy':
                    // Create backup of local, then sync from server
                    await createBackup(item.localPath, item.id);
                    sourcePath = item.serverPath;
                    destPath = item.localPath;
                    break;
                case 'skip':
                    return { success: true };
                default:
                    return { success: false, error: 'Invalid resolution' };
            }
        } else if (item.localPath && !item.serverPath) {
            // Local only - copy to server
            if (direction === 'toLocal') {
                return { success: true }; // Nothing to do
            }
            sourcePath = item.localPath;
            destPath = buildProjectPath(settings.sharedStoragePath || getPathConfig().basePath, item);
        } else if (!item.localPath && item.serverPath) {
            // Server only - copy to local
            if (direction === 'toServer') {
                return { success: true }; // Nothing to do
            }
            sourcePath = item.serverPath;
            destPath = buildProjectPath(settings.localStoragePath || 'C:\\BarackMercosul', item);
        } else {
            return { success: false, error: 'Invalid sync state' };
        }

        // Perform the copy
        const result = await copyProject(sourcePath, destPath, includeMedia);

        if (result.success) {
            logger.info('SyncEngine', 'Project synced', { id: item.id, direction });
        }

        return result;
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Build a full project path from a base directory and sync item identifiers.
 * Unified from the previous buildLocalPath/buildServerPath which were 95% identical.
 */
function buildProjectPath(basePath: string, item: SyncItem): string {
    const pathConfig = getPathConfig();
    return `${basePath}\\${pathConfig.dataFolder}\\${item.client}\\${item.project}\\${item.part}`;
}

/**
 * Synchronize all projects
 */
export async function syncAll(
    direction: SyncDirection,
    onProgress?: SyncProgressCallback,
    resolveConflicts?: (conflicts: SyncItem[]) => Promise<Map<string, ConflictResolution>>
): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
        success: true,
        itemsSynced: 0,
        itemsFailed: 0,
        conflicts: [],
        errors: [],
        duration: 0
    };

    try {
        const settings = await loadStorageSettings();
        const localPath = settings.localStoragePath;
        const serverPath = settings.sharedStoragePath || getPathConfig().basePath;

        if (!localPath || !serverPath) {
            throw new Error('Storage paths not configured');
        }

        // Check server availability
        onProgress?.({ current: 0, total: 100, currentItem: 'Checking server...', phase: 'scanning' });

        const serverAvailable = await isPathAccessible(serverPath);
        if (!serverAvailable && direction !== 'toLocal') {
            throw new Error('Server not available');
        }

        // Scan both locations
        onProgress?.({ current: 10, total: 100, currentItem: 'Scanning local...', phase: 'scanning' });
        const localProjects = await scanProjects(localPath);

        onProgress?.({ current: 30, total: 100, currentItem: 'Scanning server...', phase: 'scanning' });
        const serverProjects = serverAvailable ? await scanProjects(serverPath) : new Map();

        // Compare projects
        onProgress?.({ current: 50, total: 100, currentItem: 'Comparing...', phase: 'comparing' });
        const items = await compareProjects(localProjects, serverProjects);

        // Handle conflicts
        const conflicts = items.filter(i => i.status === 'conflict');
        if (conflicts.length > 0 && resolveConflicts) {
            const resolutions = await resolveConflicts(conflicts);

            for (const conflict of conflicts) {
                const resolution = resolutions.get(conflict.id);
                if (resolution) {
                    const syncResult = await syncProject(conflict, direction, resolution);
                    if (syncResult.success) {
                        result.itemsSynced++;
                    } else {
                        result.itemsFailed++;
                        result.errors.push({ item: conflict, error: syncResult.error || 'Unknown error' });
                    }
                } else {
                    result.conflicts.push(conflict);
                }
            }
        } else {
            result.conflicts = conflicts;
        }

        // Sync non-conflict items
        const toSync = items.filter(i => i.status === 'pending');
        let synced = 0;

        for (const item of toSync) {
            onProgress?.({
                current: 60 + (synced / toSync.length) * 35,
                total: 100,
                currentItem: item.id,
                phase: 'syncing'
            });

            const syncResult = await syncProject(item, direction);
            if (syncResult.success) {
                result.itemsSynced++;
            } else {
                result.itemsFailed++;
                result.errors.push({ item, error: syncResult.error || 'Unknown error' });
            }
            synced++;
        }

        // Update last sync timestamp
        await updateLastSyncTimestamp();

        onProgress?.({ current: 100, total: 100, currentItem: 'Complete', phase: 'complete' });

    } catch (error) {
        result.success = false;
        logger.error('SyncEngine', 'Sync failed', {}, error instanceof Error ? error : undefined);
    }

    result.duration = Date.now() - startTime;
    result.success = result.success && result.errors.length === 0 && result.conflicts.length === 0;

    return result;
}

/**
 * Get sync status for all projects (without performing sync)
 */
export async function getSyncStatus(onProgress?: SyncProgressCallback): Promise<SyncItem[]> {
    const settings = await loadStorageSettings();
    const localPath = settings.localStoragePath;
    const serverPath = settings.sharedStoragePath || getPathConfig().basePath;

    if (!localPath) {
        return [];
    }

    onProgress?.({ current: 0, total: 100, currentItem: 'Scanning...', phase: 'scanning' });

    const localProjects = await scanProjects(localPath);
    const serverAvailable = await isPathAccessible(serverPath);
    const serverProjects = serverAvailable ? await scanProjects(serverPath) : new Map();

    return compareProjects(localProjects, serverProjects, onProgress);
}

/**
 * Quick check if any sync is needed
 */
export async function needsSync(): Promise<boolean> {
    try {
        const items = await getSyncStatus();
        return items.some(i => i.status !== 'synced');
    } catch (error) {
        // BUG-04 FIX: Log error instead of silently returning false
        logger.debug('SyncEngine', 'Error checking sync status', { error: String(error) });
        return false;
    }
}
