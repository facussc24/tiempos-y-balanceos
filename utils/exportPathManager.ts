/**
 * Export Path Manager — Builds hierarchical export paths for Y: drive
 *
 * Structure (Module-first):
 *   {basePath}/{MODULE_NUM}/{CLIENT}/{PIECE}/
 *
 * Folders in INGENIERIA are numbered for priority ordering:
 *   01_AMFE, 02_Plan_de_Control, 03_Hojas_de_Operaciones,
 *   04_Diagramas_de_Flujo, 05_Tiempos_y_Balanceos
 *
 * Used by autoExportService to determine where to write exported files.
 *
 * @module exportPathManager
 */

import { isTauri } from './unified_fs';
import { getSetting } from './repositories/settingsRepository';
import { logger } from './logger';
import type { AmfeDocument } from '../modules/amfe/amfeTypes';
import type { ControlPlanDocument } from '../modules/controlPlan/controlPlanTypes';
import type { HoDocument } from '../modules/hojaOperaciones/hojaOperacionesTypes';
import type { PfdDocument } from '../modules/pfd/pfdTypes';
import type { ProjectData } from '../types';
import type { SolicitudDocument } from '../modules/solicitud/solicitudTypes';

// ============================================================================
// Types
// ============================================================================

export type ExportDocModule = 'amfe' | 'cp' | 'ho' | 'pfd' | 'tiempos' | 'solicitud';

export interface ExportMetadata {
    client: string;
    piece: string;      // partNumber — used for folder name
    pieceName: string;   // descriptive name — used for filename
}

export interface ExportFileInfo {
    dir: string;
    filename: string;
    fullPath: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Base path — Y:\INGENIERIA (the engineer navigates here directly) */
export const DEFAULT_EXPORT_BASE_PATH = 'Y:\\INGENIERIA';
export const UNC_EXPORT_FALLBACK = '\\\\server\\compartido\\INGENIERIA';

/**
 * Numbered module folders — sorted by priority in Windows Explorer.
 * Engineers see: 01_AMFE, 02_Plan_de_Control, ... when opening Y:\INGENIERIA
 */
export const MODULE_FOLDER_NAMES: Record<ExportDocModule, string> = {
    amfe: '01_AMFE',
    cp: '02_Plan_de_Control',
    ho: '03_Hojas_de_Operaciones',
    pfd: '04_Diagramas_de_Flujo',
    tiempos: '05_Tiempos_y_Balanceos',
    solicitud: '06_Solicitudes_de_Codigo',
};

/** Legacy subfolder name (sorts to top via underscore prefix) */
export const LEGACY_FOLDER_NAME = '_Legacy';

const MODULE_FILE_PREFIXES: Record<ExportDocModule, string> = {
    amfe: 'AMFE',
    cp: 'Plan de Control',
    ho: 'HO',
    pfd: 'PFD',
    tiempos: 'Balanceo',
    solicitud: 'Solicitud',
};

const SETTINGS_KEY_EXPORT_BASE = 'export_base_path';

/** Sync manifest filename — stored at basePath root */
export const SYNC_MANIFEST_FILENAME = '_sync_manifest.json';

// ============================================================================
// Path Building
// ============================================================================

/**
 * Get the configured export base path from settings, or use default.
 */
export async function getExportBasePath(): Promise<string> {
    try {
        const stored = await getSetting<string>(SETTINGS_KEY_EXPORT_BASE);
        if (stored) return stored;
    } catch {
        // Settings not available — use default
    }
    return DEFAULT_EXPORT_BASE_PATH;
}

/**
 * Build the full directory path for a module's exports.
 * Structure: basePath\MODULE\CLIENT\PIECE (module-first)
 *
 * @example
 * buildExportDir('amfe', 'FORD', 'P-001', 'Y:\\INGENIERIA')
 * // => 'Y:\\INGENIERIA\\01_AMFE\\FORD\\P-001'
 */
export function buildExportDir(
    module: ExportDocModule,
    client: string,
    piece: string,
    basePath: string,
): string {
    const folder = MODULE_FOLDER_NAMES[module];

    if (module === 'solicitud') {
        // Solicitudes: client = "Productos"/"Insumos" (preserve case, not uppercased)
        // piece = folder name (already formatted by extractDocMetadata)
        const c = client || 'Productos';
        const pi = sanitizePathSegment(piece) || 'SIN_SOLICITUD';
        return `${basePath}\\${folder}\\${c}\\${pi}`;
    }

    const c = sanitizePathSegment(client) || 'SIN_CLIENTE';
    const pi = sanitizePathSegment(piece) || 'SIN_PIEZA';
    return `${basePath}\\${folder}\\${c}\\${pi}`;
}

/**
 * Build the export filename with revision level and date.
 *
 * @example
 * buildExportFilename('amfe', 'Asiento Conductor', 'B', 'xlsx')
 * // => 'AMFE - Asiento Conductor - Rev B (2026-03-10).xlsx'
 */
export function buildExportFilename(
    module: ExportDocModule,
    docName: string,
    revisionLevel: string,
    extension: 'xlsx' | 'pdf' | 'svg',
): string {
    const prefix = MODULE_FILE_PREFIXES[module];
    const name = sanitizeFileName(docName) || 'Documento';
    const date = new Date().toISOString().slice(0, 10);
    return `${prefix} - ${name} - Rev ${revisionLevel} (${date}).${extension}`;
}

/**
 * Build full export file info (directory + filename + full path).
 */
export function buildExportFileInfo(
    module: ExportDocModule,
    metadata: ExportMetadata,
    revisionLevel: string,
    extension: 'xlsx' | 'pdf' | 'svg',
    basePath: string,
): ExportFileInfo {
    const dir = buildExportDir(module, metadata.client, metadata.piece, basePath);
    const filename = buildExportFilename(module, metadata.pieceName, revisionLevel, extension);
    return { dir, filename, fullPath: `${dir}\\${filename}` };
}

/**
 * Build path for the sync manifest file.
 */
export function buildManifestPath(basePath: string): string {
    return `${basePath}\\${SYNC_MANIFEST_FILENAME}`;
}

// ============================================================================
// Metadata Extraction
// ============================================================================

/**
 * Extract client/piece/pieceName metadata from any document type.
 */
export function extractDocMetadata(module: ExportDocModule, doc: unknown): ExportMetadata {
    switch (module) {
        case 'amfe': {
            const d = doc as AmfeDocument;
            return {
                client: d.header?.client || '',
                piece: d.header?.partNumber || '',
                pieceName: d.header?.subject || d.header?.partNumber || '',
            };
        }
        case 'cp': {
            const d = doc as ControlPlanDocument;
            return {
                client: d.header?.client || '',
                piece: d.header?.partNumber || '',
                pieceName: d.header?.partName || d.header?.partNumber || '',
            };
        }
        case 'ho': {
            const d = doc as HoDocument;
            return {
                client: d.header?.client || '',
                piece: d.header?.partNumber || '',
                pieceName: d.header?.partDescription || d.header?.partNumber || '',
            };
        }
        case 'pfd': {
            const d = doc as PfdDocument;
            return {
                client: d.header?.customerName || '',
                piece: d.header?.partNumber || '',
                pieceName: d.header?.partName || d.header?.partNumber || '',
            };
        }
        case 'tiempos': {
            const d = doc as ProjectData;
            return {
                client: d.meta?.client || '',
                piece: d.meta?.name || '',
                pieceName: d.meta?.name || '',
            };
        }
        case 'solicitud': {
            const d = doc as SolicitudDocument;
            const tipoFolder = d.tipo === 'insumo' ? 'Insumos' : 'Productos';
            const numero = d.header?.solicitudNumber || 'SIN-NUM';
            let folderName: string;
            if (d.tipo === 'producto' && d.producto) {
                const codigo = d.producto.codigo || 'SIN-COD';
                const cliente = d.producto.cliente || '';
                folderName = cliente
                    ? `${numero}_${codigo}_${cliente}`
                    : `${numero}_${codigo}`;
            } else {
                const codigo = d.insumo?.codigo || 'SIN-COD';
                folderName = `${numero}_${codigo}`;
            }
            return {
                client: tipoFolder,
                piece: folderName,
                pieceName: d.header?.solicitudNumber || '',
            };
        }
        default:
            return { client: '', piece: '', pieceName: '' };
    }
}

/**
 * Get the human-readable document name for filenames.
 */
export function getDocDisplayName(module: ExportDocModule, doc: unknown): string {
    switch (module) {
        case 'amfe': {
            const d = doc as AmfeDocument;
            return d.header?.subject || d.header?.partNumber || '';
        }
        case 'cp': {
            const d = doc as ControlPlanDocument;
            return d.header?.partName || d.header?.partNumber || '';
        }
        case 'ho': {
            const d = doc as HoDocument;
            return d.header?.partDescription || d.header?.partNumber || '';
        }
        case 'pfd': {
            const d = doc as PfdDocument;
            return d.header?.partName || d.header?.partNumber || '';
        }
        case 'tiempos': {
            const d = doc as ProjectData;
            return d.meta?.name || '';
        }
        case 'solicitud': {
            const d = doc as SolicitudDocument;
            return d.header?.solicitudNumber || '';
        }
        default:
            return '';
    }
}

// ============================================================================
// Folder Creation
// ============================================================================

/**
 * Ensure the complete export folder hierarchy exists for a document.
 */
export async function ensureExportDirs(
    module: ExportDocModule,
    metadata: ExportMetadata,
    basePath: string,
): Promise<boolean> {
    if (!isTauri()) return false;

    try {
        const tauriFs = await import('./tauri_fs');
        const dir = buildExportDir(module, metadata.client, metadata.piece, basePath);
        await tauriFs.ensureDir(dir);
        return true;
    } catch (e) {
        logger.error('ExportPathManager', 'Failed to create export dirs', {}, e instanceof Error ? e : undefined);
        return false;
    }
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Resolve the best available export base path.
 * Tries: configured path → default Y: → UNC fallback.
 * Returns null if no path is accessible.
 */
export async function resolveExportBasePath(): Promise<string | null> {
    if (!isTauri()) return null;

    const { isPathAccessible } = await import('./storageManager');
    const configured = await getExportBasePath();

    // Try configured/default path
    if (await isPathAccessible(configured, 2000)) {
        return configured;
    }

    // Try UNC fallback
    if (await isPathAccessible(UNC_EXPORT_FALLBACK, 3000)) {
        return UNC_EXPORT_FALLBACK;
    }

    return null;
}

// ============================================================================
// Path Sanitization
// ============================================================================

/**
 * Sanitize a string for use as a folder name in the path hierarchy.
 * - Converts to uppercase
 * - Replaces spaces with underscores
 * - Removes invalid characters
 */
export function sanitizePathSegment(name: string): string {
    if (!name) return '';
    return name
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[<>:"/|?*\\]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .trim();
}

/**
 * Sanitize a string for use in filenames (keeps mixed case, allows spaces).
 */
export function sanitizeFileName(name: string): string {
    if (!name) return '';
    return name
        .replace(/[<>:"/|?*\\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
