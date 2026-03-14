/**
 * Solicitud Reconciliation — Server ↔ DB comparison
 *
 * Web-safe stub: all server-scanning operations return empty arrays because
 * direct access to the server filesystem requires the Tauri runtime.
 *
 * The pure reconciliation logic (`reconcile`, `extractSolicitudNumber`) is
 * kept intact so it can be exercised in tests and used when a backend API
 * is eventually added.
 *
 * TODO: Implement server scanning via backend API
 *
 * @module solicitudReconciliation
 */

import { logger } from '../../utils/logger';
import type { SolicitudListItem } from './solicitudTypes';

// ============================================================================
// TYPES
// ============================================================================

const LOG_CAT = 'Reconciliation';

export interface ServerFolderInfo {
    /** Full folder name, e.g. "SGC-001_ABC-123_Cliente" */
    folderName: string;
    /** Extracted solicitud number, e.g. "SGC-001" */
    solicitudNumber: string;
    /** Whether in Productos/ or Insumos/ */
    tipo: 'producto' | 'insumo';
    /** Full path on server */
    fullPath: string;
}

export interface ReconciliationResult {
    /** Folders that match a DB record */
    matched: number;
    /** Folders on server without DB record */
    onlyOnServer: ServerFolderInfo[];
    /** DB records without server folder (excludes obsoletas) */
    onlyInDb: SolicitudListItem[];
    /** ISO timestamp of this check */
    lastCheck: string;
}

// ============================================================================
// SCANNING (web-safe stub)
// ============================================================================

/**
 * Extract solicitud number from folder name.
 * Convention: "{solicitudNumber}_{codigo}[_{cliente}]"
 * e.g. "SGC-001_ABC-123_Toyota" → "SGC-001"
 */
export function extractSolicitudNumber(folderName: string): string {
    const idx = folderName.indexOf('_');
    return idx > 0 ? folderName.substring(0, idx) : folderName;
}

/**
 * Scan both Productos/ and Insumos/ folders on the server.
 *
 * Always returns an empty array in web mode — server filesystem access
 * requires the Tauri runtime.
 *
 * TODO: Implement via backend API
 */
export async function scanServerFolders(_basePath: string): Promise<ServerFolderInfo[]> {
    logger.debug(LOG_CAT, 'scanServerFolders: not supported in web mode');
    return [];
}

// ============================================================================
// RECONCILIATION (pure function — unchanged)
// ============================================================================

/**
 * Compare server folders with DB records.
 * Pure function — no side effects.
 */
export function reconcile(
    serverFolders: ServerFolderInfo[],
    dbItems: SolicitudListItem[],
): ReconciliationResult {
    // Build set of solicitud numbers from server
    const serverNumbers = new Set(serverFolders.map(f => f.solicitudNumber));

    // Build set of solicitud numbers from DB (all statuses)
    const dbNumbers = new Set(dbItems.map(d => d.solicitud_number));

    // Matched: on server AND in DB
    let matched = 0;
    for (const num of serverNumbers) {
        if (dbNumbers.has(num)) matched++;
    }

    // Only on server: folder exists but no DB record
    const onlyOnServer = serverFolders.filter(f => !dbNumbers.has(f.solicitudNumber));

    // Only in DB: record exists but no server folder
    // Exclude obsoletas (their folders are in Obsoletos/, not Productos/Insumos/)
    const onlyInDb = dbItems.filter(
        d => d.status !== 'obsoleta' && !serverNumbers.has(d.solicitud_number),
    );

    return {
        matched,
        onlyOnServer,
        onlyInDb,
        lastCheck: new Date().toISOString(),
    };
}

// ============================================================================
// ORCHESTRATOR (web-safe stub)
// ============================================================================

const SETTINGS_KEY = 'lastReconciliationCheck';

/**
 * Run full reconciliation: scan server → load DB → compare → save timestamp.
 *
 * In web mode the server scan always returns empty, so `onlyOnServer` will
 * always be [] and `onlyInDb` will contain all non-obsolete DB records.
 *
 * TODO: Replace scanServerFolders stub with backend API call
 */
export async function runReconciliation(): Promise<ReconciliationResult> {
    const { listSolicitudes } = await import('../../utils/repositories/solicitudRepository');
    const { setSetting } = await import('../../utils/repositories/settingsRepository');

    logger.info(LOG_CAT, 'Running reconciliation (web mode — server scan skipped)');

    // Server scan not available in web mode — returns []
    const serverFolders = await scanServerFolders('');
    const dbItems = await listSolicitudes();
    const result = reconcile(serverFolders, dbItems);

    // Save timestamp
    await setSetting(SETTINGS_KEY, result.lastCheck);

    logger.info(LOG_CAT, 'Reconciliation complete', {
        matched: result.matched,
        onlyOnServer: result.onlyOnServer.length,
        onlyInDb: result.onlyInDb.length,
    });

    return result;
}
