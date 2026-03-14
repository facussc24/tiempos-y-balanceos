/**
 * Settings Store
 *
 * Manages persistent application settings.
 * Delegates to SQLite via settingsRepository.
 * Maintains the same public API for backward compatibility.
 *
 * @module settingsStore
 */

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
async function getDefaultDiagnosticPath(): Promise<string> {
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
