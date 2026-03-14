/**
 * Engineering Server Manager — Web Stub
 *
 * In the web/browser build, access to the server filesystem (Y:\Ingenieria)
 * is not available. All functions return safe empty/false values so that
 * callers can check availability and degrade gracefully.
 *
 * TODO: Implement via backend API when a server-side proxy is available.
 *
 * @module engineeringServerManager
 */

import { normalizePath } from '../../utils/networkUtils';
import { loadAppSettings } from '../../utils/repositories/settingsRepository';
import { logger } from '../../utils/logger';
import { DEFAULT_ENGINEERING_BASE_PATH } from './engineeringTypes';
import type { EngineeringFileEntry } from './engineeringTypes';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_CAT = 'EngineeringServer';

// ============================================================================
// BASE PATH
// ============================================================================

/**
 * Get the configured engineering base path from settings.
 * Falls back to DEFAULT_ENGINEERING_BASE_PATH if not configured.
 */
export async function getEngineeringBasePath(): Promise<string> {
    try {
        const settings = await loadAppSettings();
        const configured = settings.engineeringBasePath;
        if (configured && configured.trim().length > 0) {
            return normalizePath(configured.trim());
        }
    } catch (err) {
        logger.warn(LOG_CAT, 'Failed to load settings for engineering base path, using default', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    return normalizePath(DEFAULT_ENGINEERING_BASE_PATH);
}

// ============================================================================
// SERVER AVAILABILITY
// ============================================================================

/**
 * Check if the engineering server is reachable.
 * Always returns false in web mode — no filesystem access available.
 * TODO: Implement via backend API
 */
export async function isEngineeringServerAvailable(): Promise<boolean> {
    logger.debug(LOG_CAT, 'Server availability check skipped — web mode, no filesystem access');
    return false;
}

// ============================================================================
// FOLDER STRUCTURE
// ============================================================================

/**
 * Ensure the engineering folder hierarchy exists on the server.
 * No-op in web mode — returns false.
 * TODO: Implement via backend API
 */
export async function ensureEngineeringStructure(): Promise<boolean> {
    logger.debug(LOG_CAT, 'ensureEngineeringStructure skipped — web mode, no filesystem access');
    return false;
}

// ============================================================================
// FILE LISTING
// ============================================================================

/**
 * List files in a subdirectory of the engineering base path.
 * Returns empty array in web mode — no filesystem access available.
 * TODO: Implement via backend API
 */
export async function listEngineeringFiles(
    _subdirectory: string
): Promise<EngineeringFileEntry[]> {
    logger.debug(LOG_CAT, 'listEngineeringFiles skipped — web mode, no filesystem access');
    return [];
}

// ============================================================================
// MANUAL HTML READER
// ============================================================================

/**
 * Read an HTML file from the Manuales directory.
 * Returns null in web mode — no filesystem access available.
 * TODO: Implement via backend API
 */
export async function readManualHtml(_fileName: string): Promise<string | null> {
    logger.debug(LOG_CAT, 'readManualHtml skipped — web mode, no filesystem access');
    return null;
}
