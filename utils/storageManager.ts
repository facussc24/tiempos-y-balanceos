/**
 * Storage Manager Module
 *
 * Manages dual storage modes (local vs shared/server).
 * Path detection, switching, and network availability.
 * Settings persistence delegated to SQLite via settingsRepository.
 *
 * @module storageManager
 */

import { isTauri } from './unified_fs';
import { getSetting, setSetting } from './repositories/settingsRepository';
import { getPathConfig, setPathConfig } from './pathManager';
import { logger } from './logger';

// ============================================================================
// TYPES
// ============================================================================

export type StorageMode = 'local' | 'shared';

export interface StorageModeInfo {
    mode: StorageMode;
    path: string;
    isAvailable: boolean;
    label: string;
    icon: string;
}

export interface StorageConfig {
    localPath: string;
    sharedPath: string;
    autoDetect: boolean;
    syncMediaFiles: boolean;
}

export interface StorageSettings {
    storageMode: StorageMode;
    localStoragePath: string | null;
    sharedStoragePath: string | null;
    lastSyncTimestamp: number | null;
    autoDetectNetwork: boolean;
    syncMediaFiles: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_LOCAL_FOLDER = 'Barack_Mercosul_Data';
const SERVER_CHECK_TIMEOUT_MS = 3000;
const SETTINGS_KEY = 'storage_settings';

// ============================================================================
// SETTINGS PERSISTENCE (SQLite)
// ============================================================================

export async function getDefaultLocalPath(): Promise<string> {
    if (isTauri()) {
        try {
            const tauriPath = await import('@tauri-apps/api/path');
            const docs = await tauriPath.documentDir();
            const separator = docs.endsWith('\\') || docs.endsWith('/') ? '' : '\\';
            return `${docs}${separator}${DEFAULT_LOCAL_FOLDER}`;
        } catch {
            return `C:\\Users\\User\\Documents\\${DEFAULT_LOCAL_FOLDER}`;
        }
    }
    return `Documents/${DEFAULT_LOCAL_FOLDER}`;
}

export async function loadStorageSettings(): Promise<StorageSettings> {
    try {
        const stored = await getSetting<StorageSettings>(SETTINGS_KEY);
        if (stored) return stored;
    } catch (error) {
        logger.warn('StorageManager', 'Failed to load storage settings', { error });
    }

    const defaultLocal = await getDefaultLocalPath();
    return {
        storageMode: 'shared',
        localStoragePath: defaultLocal,
        sharedStoragePath: getPathConfig().basePath,
        lastSyncTimestamp: null,
        autoDetectNetwork: true,
        syncMediaFiles: false,
    };
}

export async function saveStorageSettings(settings: StorageSettings): Promise<boolean> {
    try {
        await setSetting(SETTINGS_KEY, settings);
        return true;
    } catch (error) {
        logger.error('StorageManager', 'Failed to save storage settings', {}, error instanceof Error ? error : undefined);
        return false;
    }
}

// ============================================================================
// MODE DETECTION
// ============================================================================

export async function isPathAccessible(path: string, timeoutMs: number = SERVER_CHECK_TIMEOUT_MS): Promise<boolean> {
    if (!isTauri()) return false;
    try {
        const tauriFs = await import('./tauri_fs');
        const checkPromise = tauriFs.exists(path);
        const timeoutPromise = new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        );
        return await Promise.race([checkPromise, timeoutPromise]);
    } catch {
        return false;
    }
}

export async function isServerAvailable(): Promise<boolean> {
    const settings = await loadStorageSettings();
    const serverPath = settings.sharedStoragePath || getPathConfig().basePath;
    return isPathAccessible(serverPath);
}

export async function detectBestMode(): Promise<StorageMode> {
    const settings = await loadStorageSettings();
    if (!settings.autoDetectNetwork) return settings.storageMode;

    const serverAvailable = await isServerAvailable();
    if (serverAvailable) {
        logger.info('StorageManager', 'Server available, using shared mode');
        return 'shared';
    }
    logger.info('StorageManager', 'Server not available, falling back to local mode');
    return 'local';
}

// ============================================================================
// MODE MANAGEMENT
// ============================================================================

export async function getCurrentMode(): Promise<StorageMode> {
    const settings = await loadStorageSettings();
    return settings.storageMode;
}

export async function setStorageMode(mode: StorageMode): Promise<boolean> {
    const settings = await loadStorageSettings();
    const oldMode = settings.storageMode;
    settings.storageMode = mode;
    const saved = await saveStorageSettings(settings);

    if (saved) {
        logger.info('StorageManager', 'Storage mode changed', { from: oldMode, to: mode });
        const basePath = mode === 'local' ? settings.localStoragePath : settings.sharedStoragePath;
        if (basePath) setPathConfig({ basePath });
    }
    return saved;
}

export async function getActiveBasePath(): Promise<string> {
    const settings = await loadStorageSettings();
    if (settings.storageMode === 'local') {
        return settings.localStoragePath || await getDefaultLocalPath();
    }
    return settings.sharedStoragePath || getPathConfig().basePath;
}

export async function getStorageModeInfo(): Promise<{ local: StorageModeInfo; shared: StorageModeInfo; current: StorageMode }> {
    const settings = await loadStorageSettings();
    const localPath = settings.localStoragePath || await getDefaultLocalPath();
    const sharedPath = settings.sharedStoragePath || getPathConfig().basePath;

    const [localAvailable, sharedAvailable] = await Promise.all([
        isPathAccessible(localPath),
        isPathAccessible(sharedPath)
    ]);

    return {
        local: { mode: 'local', path: localPath, isAvailable: localAvailable, label: 'Modo Local (Casa)', icon: '💻' },
        shared: { mode: 'shared', path: sharedPath, isAvailable: sharedAvailable, label: 'Modo Compartido (Servidor)', icon: '📡' },
        current: settings.storageMode
    };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export async function updateStorageConfig(config: Partial<StorageConfig>): Promise<boolean> {
    const settings = await loadStorageSettings();

    if (config.localPath !== undefined) settings.localStoragePath = config.localPath;
    if (config.sharedPath !== undefined) settings.sharedStoragePath = config.sharedPath;
    if (config.autoDetect !== undefined) settings.autoDetectNetwork = config.autoDetect;
    if (config.syncMediaFiles !== undefined) settings.syncMediaFiles = config.syncMediaFiles;

    const saved = await saveStorageSettings(settings);
    if (saved) {
        const basePath = settings.storageMode === 'local' ? settings.localStoragePath : settings.sharedStoragePath;
        if (basePath) {
            setPathConfig({ basePath });
            logger.info('StorageManager', 'Updated pathManager basePath', { mode: settings.storageMode, basePath });
        }
    }
    return saved;
}

export async function isStorageConfigured(): Promise<boolean> {
    const stored = await getSetting<StorageSettings>(SETTINGS_KEY);
    return stored !== null;
}

// ============================================================================
// PATH UTILITIES
// ============================================================================

export async function ensureLocalStorageDir(): Promise<boolean> {
    if (!isTauri()) return false;
    try {
        const tauriFs = await import('./tauri_fs');
        const localPath = await getActiveBasePath();
        return await tauriFs.ensureDir(localPath);
    } catch (error) {
        logger.error('StorageManager', 'Failed to create local storage directory', {}, error instanceof Error ? error : undefined);
        return false;
    }
}

export async function getProjectPath(client: string, project: string, part: string): Promise<string> {
    const basePath = await getActiveBasePath();
    const pathConfig = getPathConfig();
    return `${basePath}\\${pathConfig.dataFolder}\\${client}\\${project}\\${part}`;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export async function initializeStorageManager(): Promise<StorageMode> {
    logger.info('StorageManager', 'Initializing storage manager');

    const isConfigured = await isStorageConfigured();
    if (!isConfigured) {
        const defaults = await loadStorageSettings();
        await saveStorageSettings(defaults);
        logger.info('StorageManager', 'Created default storage configuration');
    }

    const detectedMode = await detectBestMode();
    await setStorageMode(detectedMode);

    if (detectedMode === 'local') {
        await ensureLocalStorageDir();
    }

    return detectedMode;
}

// ============================================================================
// SYNC STATUS
// ============================================================================

export async function getLastSyncTimestamp(): Promise<number | null> {
    const settings = await loadStorageSettings();
    return settings.lastSyncTimestamp;
}

export async function updateLastSyncTimestamp(): Promise<boolean> {
    const settings = await loadStorageSettings();
    settings.lastSyncTimestamp = Date.now();
    return saveStorageSettings(settings);
}

export async function isSyncRecommended(): Promise<boolean> {
    const settings = await loadStorageSettings();
    if (!settings.lastSyncTimestamp) return true;
    const hoursSinceSync = (Date.now() - settings.lastSyncTimestamp) / (1000 * 60 * 60);
    return hoursSinceSync > 24;
}
