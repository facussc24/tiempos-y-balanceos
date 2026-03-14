/**
 * Settings Repository
 *
 * Key-value store for app settings, storage settings, and path config.
 * Replaces: settingsStore.ts localStorage/config.json, storageManager localStorage, pathManager localStorage.
 */

import { getDatabase } from '../database';
import { logger } from '../logger';

export interface AppSettings {
    diagnosticExportPath: string | null;
    qaEnabled: boolean;
    lastProjectPath: string | null;
    plantAssetsPath: string | null;
    amfeBasePath: string | null;
    cpBasePath: string | null;
    hoBasePath: string | null;
    pfdBasePath: string | null;
    solicitudBasePath: string | null;
    engineeringBasePath: string | null;
    geminiApiKey: string | null;
    geminiEnabled: boolean;
    lastReconciliationCheck: string | null;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
    diagnosticExportPath: null,
    qaEnabled: false,
    lastProjectPath: null,
    plantAssetsPath: null,
    amfeBasePath: null,
    cpBasePath: null,
    hoBasePath: null,
    pfdBasePath: null,
    solicitudBasePath: null,
    engineeringBasePath: null,
    geminiApiKey: null,
    geminiEnabled: false,
    lastReconciliationCheck: null,
};

/**
 * Get a setting by key. Returns null if not found.
 */
export async function getSetting<T>(key: string): Promise<T | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
        if (rows.length === 0) return null;
        return JSON.parse(rows[0].value) as T;
    } catch (err) {
        logger.warn('SettingsRepository', `Failed to get setting: ${key}`, { error: String(err) });
        return null;
    }
}

/**
 * Set a setting by key (upsert).
 */
export async function setSetting<T>(key: string, value: T): Promise<void> {
    try {
        const db = await getDatabase();
        const json = JSON.stringify(value);
        await db.execute(
            `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
            [key, json]
        );
    } catch (err) {
        logger.error('SettingsRepository', `Failed to set setting: ${key}`, {}, err instanceof Error ? err : undefined);
    }
}

/**
 * Load the app settings object.
 */
export async function loadAppSettings(): Promise<AppSettings> {
    const stored = await getSetting<Partial<AppSettings>>('app_settings');
    return { ...DEFAULT_APP_SETTINGS, ...stored };
}

/**
 * Save the app settings object.
 */
export async function saveAppSettings(settings: AppSettings): Promise<boolean> {
    try {
        await setSetting('app_settings', settings);
        return true;
    } catch {
        return false;
    }
}

/**
 * Update a single app setting.
 */
export async function updateAppSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
): Promise<boolean> {
    const settings = await loadAppSettings();
    settings[key] = value;
    return saveAppSettings(settings);
}
