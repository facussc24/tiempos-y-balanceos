/**
 * Solicitud Server Manager
 *
 * Web-safe stub: all server filesystem operations return null/false/[]
 * because direct access to the Y: drive requires the Tauri runtime.
 *
 * TODO: Implement via backend API
 *
 * @module solicitudServerManager
 */

import { loadAppSettings } from '../../utils/repositories/settingsRepository';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { normalizePath, joinPath } from '../../utils/networkUtils';
import { logger } from '../../utils/logger';
import type { SolicitudDocument } from './solicitudTypes';
import { DEFAULT_SOLICITUD_BASE_PATH } from './solicitudTypes';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_CAT = 'SolicitudServer';

/** Maximum length for folder names on Windows (conservative) */
const MAX_FOLDER_NAME_LENGTH = 100;

/** Subfolder names on the server */
const FOLDER_PRODUCTOS = 'Productos';
const FOLDER_INSUMOS = 'Insumos';

// ============================================================================
// TYPES
// ============================================================================

export interface SolicitudFolderResult {
    success: boolean;
    folderPath: string;
    adjuntosPath: string;
    error?: string;
}

export interface ServerSyncResult {
    success: boolean;
    folderPath: string | null;
    pdfCopied: boolean;
    error?: string;
}

// ============================================================================
// BASE PATH
// ============================================================================

/**
 * Get the configured solicitud base path from settings.
 * Falls back to DEFAULT_SOLICITUD_BASE_PATH if not configured.
 */
export async function getSolicitudBasePath(): Promise<string> {
    try {
        const settings = await loadAppSettings();
        const configured = settings.solicitudBasePath;
        if (configured && configured.trim().length > 0) {
            return normalizePath(configured.trim());
        }
    } catch (err) {
        logger.warn(LOG_CAT, 'Failed to load settings for base path, using default', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    return normalizePath(DEFAULT_SOLICITUD_BASE_PATH);
}

// ============================================================================
// SERVER AVAILABILITY (web-safe stub)
// ============================================================================

/**
 * Check if the solicitud server is reachable.
 *
 * Always returns false in web mode — direct server access requires Tauri runtime.
 *
 * TODO: Implement via backend API (e.g. health-check endpoint)
 */
export async function isSolicitudServerAvailable(): Promise<boolean> {
    logger.debug(LOG_CAT, 'isSolicitudServerAvailable: not supported in web mode');
    return false;
}

// ============================================================================
// BASE STRUCTURE (web-safe stub)
// ============================================================================

/**
 * Ensure the base folder hierarchy exists on the server.
 *
 * Always returns false in web mode — filesystem creation requires Tauri runtime.
 *
 * TODO: Implement via backend API
 */
export async function ensureBaseStructure(): Promise<boolean> {
    logger.debug(LOG_CAT, 'ensureBaseStructure: not supported in web mode');
    return false;
}

// ============================================================================
// FOLDER NAME BUILDING
// ============================================================================

/**
 * Build the folder name for a solicitud document.
 *
 * - Productos: `{solicitudNumber}_{codigo}_{cliente}`
 * - Insumos:   `{solicitudNumber}_{codigo}`
 *
 * All parts are sanitized and the total is truncated to MAX_FOLDER_NAME_LENGTH chars.
 */
export function buildFolderName(doc: SolicitudDocument): string {
    const number = doc.header.solicitudNumber || 'SIN-NUM';

    if (doc.tipo === 'producto' && doc.producto) {
        const codigo = doc.producto.codigo || 'SIN-COD';
        const cliente = doc.producto.cliente || 'SIN-CLIENTE';
        const raw = `${number}_${codigo}_${cliente}`;
        return sanitizeFilename(raw, {
            allowSpaces: false,
            maxLength: MAX_FOLDER_NAME_LENGTH,
        });
    }

    // Insumo
    const codigo = doc.insumo?.codigo || 'SIN-COD';
    const raw = `${number}_${codigo}`;
    return sanitizeFilename(raw, {
        allowSpaces: false,
        maxLength: MAX_FOLDER_NAME_LENGTH,
    });
}

/**
 * Build the full server path for a solicitud folder.
 *
 * basePath + (Productos|Insumos) + folderName
 */
export async function buildFolderPath(doc: SolicitudDocument): Promise<string> {
    const basePath = await getSolicitudBasePath();
    const typeFolder = doc.tipo === 'producto' ? FOLDER_PRODUCTOS : FOLDER_INSUMOS;
    const folderName = buildFolderName(doc);
    return joinPath(basePath, typeFolder, folderName);
}

// ============================================================================
// FOLDER CREATION (web-safe stub)
// ============================================================================

/**
 * Ensure the solicitud folder and its adjuntos subfolder exist on the server.
 *
 * Always returns failure in web mode — filesystem creation requires Tauri runtime.
 *
 * TODO: Implement via backend API
 */
export async function ensureSolicitudFolder(
    doc: SolicitudDocument
): Promise<SolicitudFolderResult> {
    const folderPath = await buildFolderPath(doc);
    const adjuntosPath = joinPath(folderPath, 'adjuntos');

    logger.debug(LOG_CAT, 'ensureSolicitudFolder: not supported in web mode', { folderPath });
    return {
        success: false,
        folderPath,
        adjuntosPath,
        error: 'La creacion de carpetas en el servidor no esta disponible en modo web.',
    };
}

// ============================================================================
// MOVE TO OBSOLETOS (web-safe stub)
// ============================================================================

/**
 * Move a solicitud folder to the Obsoletos archive.
 *
 * Always returns false in web mode — filesystem operations require Tauri runtime.
 *
 * TODO: Implement via backend API
 */
export async function moveSolicitudToObsoletos(
    doc: SolicitudDocument
): Promise<boolean> {
    logger.debug(LOG_CAT, 'moveSolicitudToObsoletos: not supported in web mode', {
        docId: doc.id,
    });
    return false;
}

// ============================================================================
// SERVER SYNC (web-safe stub)
// ============================================================================

/**
 * Full sync of a solicitud to the server.
 *
 * Always returns failure in web mode — server filesystem access requires Tauri runtime.
 *
 * TODO: Implement via backend API
 */
export async function syncSolicitudToServer(
    doc: SolicitudDocument,
    _pdfBytes?: Uint8Array
): Promise<ServerSyncResult> {
    logger.debug(LOG_CAT, 'syncSolicitudToServer: not supported in web mode', {
        docId: doc.id,
        solicitudNumber: doc.header.solicitudNumber,
    });
    return {
        success: false,
        folderPath: null,
        pdfCopied: false,
        error: 'La sincronizacion con el servidor no esta disponible en modo web.',
    };
}

// ============================================================================
// PROCEDURE DOCUMENT EXPORT (web-safe stub)
// ============================================================================

/**
 * Export the SGC procedure document (P-ING-001) as an HTML file to the server.
 *
 * Always returns false in web mode — filesystem writes require Tauri runtime.
 *
 * TODO: Implement via backend API
 */
export async function exportProcedureToServer(): Promise<boolean> {
    logger.debug(LOG_CAT, 'exportProcedureToServer: not supported in web mode');
    return false;
}
