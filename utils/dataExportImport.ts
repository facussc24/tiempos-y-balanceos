/**
 * Data Export / Import Service
 *
 * Handles exporting the entire database to a .barack file (JSON)
 * and importing .barack files with merge/conflict resolution.
 *
 * .barack files use the same ExportDataset format as backups.
 */

import { snapshotDatabase } from './backupService';
import {
    analyzeDatasets, resolveMerge,
    type ExportDataset, type MergeResult, type ResolvedConflict, type MergeAction,
} from './mergeEngine';
import { getDatabase } from './database';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Export all data to a .barack file via browser download.
 * Returns a synthetic filename on success, or null on failure.
 */
export async function exportAllData(): Promise<string | null> {
    try {
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const filename = `BarackMercosul_Export_${dateStr}.barack`;

        const snapshot = await snapshotDatabase();
        const json = JSON.stringify(snapshot, null, 2);

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        logger.info('ExportImport', 'Data exported via browser download', { filename });
        return filename;
    } catch (err) {
        logger.error('ExportImport', 'Export failed', {}, err instanceof Error ? err : undefined);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Import: read & analyze
// ---------------------------------------------------------------------------

/**
 * Open a .barack file via browser file picker and return its parsed contents + analysis.
 * Does NOT modify the database — call executeImportActions() to apply.
 */
export async function openAndAnalyzeImport(): Promise<{
    filePath: string;
    dataset: ExportDataset;
    analysis: MergeResult;
} | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.barack,.json';

        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
                resolve(null);
                return;
            }

            try {
                const text = await file.text();
                const dataset = JSON.parse(text) as ExportDataset;

                if (!dataset.version || !dataset.tables) {
                    logger.error('ExportImport', 'Invalid .barack file format');
                    resolve(null);
                    return;
                }

                const localSnapshot = await snapshotDatabase();
                const analysis = analyzeDatasets(localSnapshot, dataset);

                logger.info('ExportImport', 'Import analysis complete', {
                    file: file.name,
                    summary: analysis.summary,
                });

                resolve({ filePath: file.name, dataset, analysis });
            } catch (err) {
                logger.error('ExportImport', 'File analysis failed', {}, err instanceof Error ? err : undefined);
                resolve(null);
            }
        };

        // Handle cancel (no file selected)
        input.oncancel = () => resolve(null);

        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    });
}

/**
 * Analyze a .barack file at a known path (used by folder sync too).
 * In web mode this always returns null since filesystem paths are not accessible.
 * TODO: Implement via backend API when a server-side proxy is available.
 */
export async function analyzeImportFile(filePath: string): Promise<{
    filePath: string;
    dataset: ExportDataset;
    analysis: MergeResult;
} | null> {
    try {
        // Filesystem access is not available in web mode.
        logger.warn('ExportImport', 'analyzeImportFile called with path in web mode — no filesystem access', { path: filePath });
        const json: string | null = null;
        if (!json) {
            logger.error('ExportImport', 'Could not read file', { path: filePath });
            return null;
        }

        const dataset = JSON.parse(json) as ExportDataset;

        // Validate basic structure
        if (!dataset.version || !dataset.tables) {
            logger.error('ExportImport', 'Invalid .barack file format');
            return null;
        }

        // Snapshot current DB for comparison
        const localSnapshot = await snapshotDatabase();

        // Analyze differences
        const analysis = analyzeDatasets(localSnapshot, dataset);

        logger.info('ExportImport', 'Import analysis complete', {
            file: filePath,
            summary: analysis.summary,
        });

        return { filePath, dataset, analysis };
    } catch (err) {
        logger.error('ExportImport', 'File analysis failed', {}, err instanceof Error ? err : undefined);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Import: apply changes
// ---------------------------------------------------------------------------

/** Whitelist of tables that can be written during import. */
const IMPORTABLE_TABLES = new Set([
    'projects', 'settings', 'drafts',
    'amfe_documents', 'amfe_library_operations',
    'cp_documents', 'ho_documents', 'pfd_documents',
    'product_families', 'product_family_members',
    'family_documents', 'family_document_overrides', 'family_change_proposals',
    'document_revisions', 'cross_doc_checks',
]);

/**
 * Apply resolved merge actions to the database.
 * This inserts new records and updates existing ones individually
 * (unlike restore which wipes everything).
 */
export async function executeImportActions(actions: MergeAction[]): Promise<{
    success: boolean;
    applied: number;
    errors: number;
}> {
    const db = await getDatabase();
    let applied = 0;
    let errors = 0;

    try {
        await db.execute('BEGIN TRANSACTION', []);

        for (const action of actions) {
            try {
                if (!IMPORTABLE_TABLES.has(action.table)) {
                    logger.warn('ExportImport', `Skipping unknown table: ${action.table}`);
                    errors++;
                    continue;
                }
                const columns = Object.keys(action.record);
                const placeholders = columns.map(() => '?').join(', ');
                const values = columns.map(c => {
                    const v = (action.record as Record<string, unknown>)[c];
                    if (v !== null && typeof v === 'object') return JSON.stringify(v);
                    return v;
                });

                await db.execute(
                    `INSERT OR REPLACE INTO ${action.table} (${columns.join(', ')}) VALUES (${placeholders})`,
                    values,
                );
                applied++;
            } catch (err) {
                logger.warn('ExportImport', `Failed to apply record in ${action.table}`, { error: String(err) });
                errors++;
            }
        }

        await db.execute('COMMIT', []);
        logger.info('ExportImport', 'Import applied', { applied, errors });
        return { success: true, applied, errors };
    } catch (err) {
        try { await db.execute('ROLLBACK', []); } catch { /* best effort */ }
        logger.error('ExportImport', 'Import transaction failed', {}, err instanceof Error ? err : undefined);
        return { success: false, applied: 0, errors: actions.length };
    }
}

/**
 * Full import flow: analyze + resolve + apply.
 * For use when the user has already chosen their conflict resolutions.
 */
export async function executeFullImport(
    analysis: MergeResult,
    resolutions: ResolvedConflict[],
): Promise<{ success: boolean; applied: number; errors: number }> {
    const actions = resolveMerge(analysis, resolutions);

    if (actions.length === 0) {
        return { success: true, applied: 0, errors: 0 };
    }

    return executeImportActions(actions);
}

/**
 * Quick import: no conflicts, just apply all new + updated records.
 * Use when analysis.conflicts is empty.
 */
export async function executeQuickImport(
    analysis: MergeResult,
): Promise<{ success: boolean; applied: number; errors: number }> {
    return executeFullImport(analysis, []);
}

// ---------------------------------------------------------------------------
// Preview (for ImportPreviewModal)
// ---------------------------------------------------------------------------

export { countByTable } from './mergeEngine';
