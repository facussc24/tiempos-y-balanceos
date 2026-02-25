/**
 * Settings Store
 *
 * Manages persistent application settings.
 * Delegates to SQLite via settingsRepository.
 * Maintains the same public API for backward compatibility.
 *
 * @module settingsStore
 */

import { isTauri } from './unified_fs';
import {
    loadAppSettings as repoLoadSettings,
    saveAppSettings as repoSaveSettings,
    updateAppSetting as repoUpdateSetting,
} from './repositories/settingsRepository';
import type { AppSettings as RepoAppSettings } from './repositories/settingsRepository';

// Re-export the type (same shape — defined in repository now)
export type AppSettings = RepoAppSettings;

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

/**
 * Check if running in development mode
 */
export function isDevMode(): boolean {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env.DEV === true || import.meta.env.MODE === 'development';
    }
    if (typeof window !== 'undefined') {
        return window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
    }
    return false;
}

// ============================================================================
// SETTINGS PERSISTENCE (delegated to SQLite repository)
// ============================================================================

/**
 * Load settings from persistent storage
 */
export async function loadSettings(): Promise<AppSettings> {
    return repoLoadSettings();
}

/**
 * Save settings to persistent storage
 */
export async function saveSettings(settings: AppSettings): Promise<boolean> {
    return repoSaveSettings(settings);
}

/**
 * Update a single setting
 */
export async function updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
): Promise<boolean> {
    return repoUpdateSetting(key, value);
}

// ============================================================================
// DIAGNOSTIC PATHS
// ============================================================================

/**
 * Get the default diagnostic export path
 */
export async function getDefaultDiagnosticPath(): Promise<string> {
    if (isTauri()) {
        try {
            const tauriPath = await import('@tauri-apps/api/path');
            const docs = await tauriPath.documentDir();
            return `${docs}BarackMercosul\\Diagnostics`;
        } catch {
            return 'C:\\BarackMercosul\\Diagnostics';
        }
    }
    return 'Descargas';
}

/**
 * Get the configured or default diagnostic path
 */
export async function getDiagnosticExportPath(): Promise<string> {
    const settings = await loadSettings();
    if (settings.diagnosticExportPath) {
        return settings.diagnosticExportPath;
    }
    return getDefaultDiagnosticPath();
}

// ============================================================================
// QA VISIBILITY
// ============================================================================

/**
 * Check if QA panel should be visible
 */
export async function isQAVisible(): Promise<boolean> {
    if (isDevMode()) return true;
    const settings = await loadSettings();
    return settings.qaEnabled;
}

// ============================================================================
// PLANT ASSETS PATH
// ============================================================================

export const DEFAULT_PLANT_ASSETS_PATH =
    'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\15. Tiempos\\00_CONFIG\\assets.json';

/**
 * Get the configured or default plant assets path
 */
export async function getPlantAssetsPath(): Promise<string> {
    const settings = await loadSettings();
    return settings.plantAssetsPath || DEFAULT_PLANT_ASSETS_PATH;
}
