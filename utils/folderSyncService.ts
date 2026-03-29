/**
 * Folder Sync Service
 *
 * Synchronizes data between multiple computers via a shared folder
 * (OneDrive, Dropbox, Google Drive, network share, USB drive, etc.).
 *
 * Architecture (Tonsky pattern — one file per device):
 *   SharedFolder/BarackMercosul_Sync/
 *     sync_PC-FACUNDO.barack    ← written only by Facundo's PC
 *     sync_PC-JUAN.barack       ← written only by Juan's PC
 *     sync_manifest.json        ← last-sync timestamps
 *
 * Because each device only writes its OWN file, cloud sync services
 * (OneDrive, Dropbox) never encounter write conflicts.
 */

import { snapshotDatabase } from './backupService';
import { executeFullImport } from './dataExportImport';
import { analyzeDatasets, type MergeResult, type ResolvedConflict } from './mergeEngine';
import { getDeviceInfo } from './deviceId';
import { getSetting, setSetting } from './repositories/settingsRepository';
import { logger } from './logger';
import {
    ensureDir, writeTextFile, readTextFile,
    readDir, exists, pickFolder,
} from './unified_fs';

// ---------------------------------------------------------------------------
// Constants & Types
// ---------------------------------------------------------------------------

const SYNC_SUBFOLDER = 'BarackMercosul_Sync';
const SETTINGS_KEY = 'folder_sync_settings';
const MANIFEST_FILE = 'sync_manifest.json';

interface FolderSyncSettings {
    syncFolderPath: string | null;
    syncOnStartup: boolean;
    lastPushAt: string | null;
    lastPullAt: string | null;
}

const DEFAULT_SETTINGS: FolderSyncSettings = {
    syncFolderPath: null,
    syncOnStartup: false,
    lastPushAt: null,
    lastPullAt: null,
};

export interface SyncDeviceInfo {
    deviceId: string;
    deviceName: string;
    filename: string;
    lastPushAt: string;
}

interface SyncManifestEntry {
    deviceId: string;
    deviceName: string;
    lastPushAt: string;
    schemaVersion: number;
}

type SyncManifest = Record<string, SyncManifestEntry>;

export interface SyncFolderStatus {
    configured: boolean;
    path: string | null;
    accessible: boolean;
    devices: SyncDeviceInfo[];
    lastPushAt: string | null;
    lastPullAt: string | null;
    syncOnStartup: boolean;
    /** Number of changes available from other devices (null = not checked yet). */
    pendingChanges: number | null;
}

export interface SyncResult {
    pushed: boolean;
    pulled: boolean;
    mergeResult: MergeResult | null;
    applied: number;
    errors: number;
}

// ---------------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------------

async function loadSettings(): Promise<FolderSyncSettings> {
    const stored = await getSetting<FolderSyncSettings>(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...stored };
}

async function saveSettings(settings: FolderSyncSettings): Promise<void> {
    await setSetting(SETTINGS_KEY, settings);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Let the user pick a shared folder and configure it for sync.
 * Returns the chosen path or null if cancelled.
 */
export async function configureSyncFolder(): Promise<string | null> {
    const folder = await pickFolder();
    if (!folder) return null;

    return setSyncFolderPath(folder);
}

/**
 * Set the sync folder path programmatically (for testing or restore).
 */
async function setSyncFolderPath(folder: string): Promise<string> {
    const syncDir = `${folder}/${SYNC_SUBFOLDER}`;
    await ensureDir(syncDir);

    const settings = await loadSettings();
    settings.syncFolderPath = folder;
    await saveSettings(settings);

    logger.info('FolderSync', 'Sync folder configured', { path: folder });
    return folder;
}

async function isSyncFolderConfigured(): Promise<boolean> {
    const settings = await loadSettings();
    return !!settings.syncFolderPath;
}

async function getSyncFolderPath(): Promise<string | null> {
    const settings = await loadSettings();
    return settings.syncFolderPath;
}

export async function setSyncOnStartup(enabled: boolean): Promise<void> {
    const settings = await loadSettings();
    settings.syncOnStartup = enabled;
    await saveSettings(settings);
}

// ---------------------------------------------------------------------------
// Sync folder path helpers
// ---------------------------------------------------------------------------

async function getSyncDir(): Promise<string | null> {
    const settings = await loadSettings();
    if (!settings.syncFolderPath) return null;
    return `${settings.syncFolderPath}/${SYNC_SUBFOLDER}`;
}

function getDeviceFilename(deviceName: string): string {
    // Sanitize name for filesystem
    const safe = deviceName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `sync_${safe}.barack`;
}

// ---------------------------------------------------------------------------
// Push: write this device's data to the shared folder
// ---------------------------------------------------------------------------

/**
 * Write this device's entire database snapshot to the shared folder.
 */
export async function pushToSyncFolder(): Promise<boolean> {
    const syncDir = await getSyncDir();
    if (!syncDir) {
        logger.warn('FolderSync', 'Push failed: no sync folder configured');
        return false;
    }

    try {
        const isAccessible = await exists(syncDir);
        if (!isAccessible) {
            await ensureDir(syncDir);
        }

        const device = await getDeviceInfo();
        const snapshot = await snapshotDatabase();
        const json = JSON.stringify(snapshot, null, 2);

        const filename = getDeviceFilename(device.name);
        const filePath = `${syncDir}/${filename}`;

        const ok = await writeTextFile(filePath, json);
        if (!ok) {
            logger.error('FolderSync', 'Failed to write sync file');
            return false;
        }

        // Update manifest
        await updateManifest(syncDir, device.id, device.name);

        // Update settings
        const settings = await loadSettings();
        settings.lastPushAt = new Date().toISOString();
        await saveSettings(settings);

        logger.info('FolderSync', 'Push complete', { file: filename });
        return true;
    } catch (err) {
        logger.error('FolderSync', 'Push failed', {}, err instanceof Error ? err : undefined);
        return false;
    }
}

// ---------------------------------------------------------------------------
// Pull: read other devices' data and analyze
// ---------------------------------------------------------------------------

/**
 * Scan the sync folder for files from OTHER devices and analyze differences.
 * Does NOT apply changes — returns the analysis for the UI to review.
 */
export async function pullAnalyze(): Promise<{
    devices: SyncDeviceInfo[];
    mergeResult: MergeResult;
} | null> {
    const syncDir = await getSyncDir();
    if (!syncDir) return null;

    try {
        const accessible = await exists(syncDir);
        if (!accessible) return null;

        const device = await getDeviceInfo();
        const myFilename = getDeviceFilename(device.name);
        const localSnapshot = await snapshotDatabase();

        const entries = await readDir(syncDir);
        const otherFiles = entries.filter(
            e => e.isFile && e.name.endsWith('.barack') && e.name !== myFilename
        );

        if (otherFiles.length === 0) {
            logger.info('FolderSync', 'No other device files found');
            return {
                devices: [],
                mergeResult: { added: [], updated: [], conflicts: [], skipped: 0, summary: 'Sin cambios' },
            };
        }

        // Merge all remote datasets into one combined analysis
        const devices: SyncDeviceInfo[] = [];
        const combinedResult: MergeResult = { added: [], updated: [], conflicts: [], skipped: 0, summary: '' };

        for (const file of otherFiles) {
            const filePath = file.path ?? '';
            if (!filePath) continue;
            const json = await readTextFile(filePath);
            if (!json) continue;

            try {
                const remoteDataset = JSON.parse(json) as import('./mergeEngine').ExportDataset;
                if (!localSnapshot) continue;
                const analysis = analyzeDatasets(localSnapshot, remoteDataset);

                // Accumulate results
                combinedResult.added.push(...analysis.added);
                combinedResult.updated.push(...analysis.updated);
                combinedResult.conflicts.push(...analysis.conflicts);
                combinedResult.skipped += analysis.skipped;

                devices.push({
                    deviceId: remoteDataset.deviceId ?? 'unknown',
                    deviceName: remoteDataset.deviceName ?? file.name.replace('sync_', '').replace('.barack', ''),
                    filename: file.name,
                    lastPushAt: remoteDataset.createdAt,
                });
            } catch {
                logger.warn('FolderSync', `Skipped invalid file: ${file.name}`);
            }
        }

        // Build summary
        const parts: string[] = [];
        if (combinedResult.added.length) parts.push(`${combinedResult.added.length} nuevos`);
        if (combinedResult.updated.length) parts.push(`${combinedResult.updated.length} actualizados`);
        if (combinedResult.conflicts.length) parts.push(`${combinedResult.conflicts.length} conflictos`);
        combinedResult.summary = parts.join(', ') || 'Sin cambios';

        logger.info('FolderSync', 'Pull analysis complete', {
            devices: devices.length,
            summary: combinedResult.summary,
        });

        return { devices, mergeResult: combinedResult };
    } catch (err) {
        logger.error('FolderSync', 'Pull analysis failed', {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Apply a previously analyzed pull with resolved conflicts.
 */
export async function pullApply(
    analysis: MergeResult,
    resolutions: ResolvedConflict[],
): Promise<{ applied: number; errors: number }> {
    const result = await executeFullImport(analysis, resolutions);

    if (result.success) {
        const settings = await loadSettings();
        settings.lastPullAt = new Date().toISOString();
        await saveSettings(settings);
    }

    return { applied: result.applied, errors: result.errors };
}

// ---------------------------------------------------------------------------
// Full bidirectional sync
// ---------------------------------------------------------------------------

/**
 * Push local changes, then pull remote changes.
 * Returns combined results for the UI.
 */
async function syncBidirectional(
    resolutions: ResolvedConflict[] = [],
): Promise<SyncResult> {
    // 1. Push first so others can see our latest
    const pushed = await pushToSyncFolder();

    // 2. Pull and analyze
    const pullResult = await pullAnalyze();
    if (!pullResult || (pullResult.mergeResult.added.length === 0 &&
        pullResult.mergeResult.updated.length === 0 &&
        pullResult.mergeResult.conflicts.length === 0)) {
        return {
            pushed,
            pulled: true,
            mergeResult: pullResult?.mergeResult ?? null,
            applied: 0,
            errors: 0,
        };
    }

    // 3. Apply changes (auto for non-conflicts, user-chosen for conflicts)
    const { applied, errors } = await pullApply(pullResult.mergeResult, resolutions);

    return {
        pushed,
        pulled: true,
        mergeResult: pullResult.mergeResult,
        applied,
        errors,
    };
}

// ---------------------------------------------------------------------------
// Status & device listing
// ---------------------------------------------------------------------------

/**
 * Get the full sync folder status for the UI.
 */
export async function getSyncFolderStatus(): Promise<SyncFolderStatus> {
    const settings = await loadSettings();

    if (!settings.syncFolderPath) {
        return {
            configured: false,
            path: null,
            accessible: false,
            devices: [],
            lastPushAt: null,
            lastPullAt: null,
            syncOnStartup: false,
            pendingChanges: null,
        };
    }

    const syncDir = `${settings.syncFolderPath}/${SYNC_SUBFOLDER}`;
    const accessible = await exists(syncDir);

    let devices: SyncDeviceInfo[] = [];
    if (accessible) {
        devices = await listSyncDevices(syncDir);
    }

    return {
        configured: true,
        path: settings.syncFolderPath,
        accessible,
        devices,
        lastPushAt: settings.lastPushAt,
        lastPullAt: settings.lastPullAt,
        syncOnStartup: settings.syncOnStartup,
        pendingChanges: null, // Caller can run pullAnalyze() for this
    };
}

/**
 * List all devices that have synced to the shared folder.
 */
async function listSyncDevices(syncDir: string): Promise<SyncDeviceInfo[]> {
    try {
        // Try reading manifest first
        const manifestPath = `${syncDir}/${MANIFEST_FILE}`;
        const manifestJson = await readTextFile(manifestPath);
        if (manifestJson) {
            const manifest = JSON.parse(manifestJson) as SyncManifest;
            return Object.values(manifest).map(e => ({
                deviceId: e.deviceId,
                deviceName: e.deviceName,
                filename: getDeviceFilename(e.deviceName),
                lastPushAt: e.lastPushAt,
            }));
        }

        // Fallback: scan directory
        const entries = await readDir(syncDir);
        return entries
            .filter(e => e.isFile && e.name.endsWith('.barack'))
            .map(e => ({
                deviceId: 'unknown',
                deviceName: e.name.replace('sync_', '').replace('.barack', ''),
                filename: e.name,
                lastPushAt: '',
            }));
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// Manifest management
// ---------------------------------------------------------------------------

async function updateManifest(syncDir: string, deviceId: string, deviceName: string): Promise<void> {
    const manifestPath = `${syncDir}/${MANIFEST_FILE}`;

    let manifest: SyncManifest = {};
    try {
        const json = await readTextFile(manifestPath);
        if (json) manifest = JSON.parse(json);
    } catch {
        // Start fresh
    }

    manifest[deviceId] = {
        deviceId,
        deviceName,
        lastPushAt: new Date().toISOString(),
        schemaVersion: 8,
    };

    await writeTextFile(manifestPath, JSON.stringify(manifest, null, 2));
}
