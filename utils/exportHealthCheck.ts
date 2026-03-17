/**
 * Export Health Check — Validates and optionally repairs the export folder structure on Y:
 *
 * Checks that the 6 numbered module folders exist under the configured export base path.
 * Migrates legacy unnumbered folders (e.g. "Solicitudes de Codigo" → "06_Solicitudes_de_Codigo").
 * Reports missing folders and accessibility issues. Offers repair (mkdir) for missing ones.
 *
 * @module exportHealthCheck
 */

import { isTauri } from './unified_fs';
import { isPathAccessible } from './storageManager';
import { logger } from './logger';
import {
    MODULE_FOLDER_NAMES,
    LEGACY_FOLDER_NAME,
    type ExportDocModule,
    getExportBasePath,
    UNC_EXPORT_FALLBACK,
} from './exportPathManager';

// ============================================================================
// Types
// ============================================================================

export interface HealthCheckResult {
    /** Whether the full structure is healthy (all folders exist + accessible) */
    healthy: boolean;
    /** Whether the base path (Y:\INGENIERIA or UNC fallback) is reachable */
    accessible: boolean;
    /** Which base path was actually checked (Y: or UNC or null if neither) */
    resolvedBasePath: string | null;
    /** Module folders that are missing */
    missing: MissingFolder[];
    /** Informational message for the user */
    message: string;
}

export interface MissingFolder {
    /** Module key (amfe, cp, ho, pfd, tiempos, solicitud) */
    module: ExportDocModule;
    /** Full folder name (e.g. '01_AMFE') */
    folderName: string;
    /** Full expected path */
    expectedPath: string;
}

export interface RepairResult {
    /** Folders that were successfully created */
    created: string[];
    /** Folders that failed to create (with error messages) */
    errors: Array<{ path: string; error: string }>;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate the export folder structure exists and is accessible.
 *
 * 1. Resolves the best available base path (configured → default Y: → UNC)
 * 2. Migrates legacy unnumbered folders (e.g. "Solicitudes de Codigo" → "06_Solicitudes_de_Codigo")
 * 3. Checks each of the 6 numbered module folders exists
 * 4. Reports missing folders
 *
 * Does NOT repair — use `repairExportStructure()` for that.
 */
export async function validateExportStructure(basePath?: string): Promise<HealthCheckResult> {
    if (!isTauri()) {
        return {
            healthy: true,
            accessible: false,
            resolvedBasePath: null,
            missing: [],
            message: 'Modo web — validación de estructura no aplica',
        };
    }

    // 1. Resolve base path
    const resolved = basePath ?? (await resolveHealthCheckBasePath());
    if (!resolved) {
        return {
            healthy: false,
            accessible: false,
            resolvedBasePath: null,
            missing: [],
            message: 'No se puede acceder a Y:\\INGENIERIA ni a la ruta UNC. Las exportaciones se encolarán localmente.',
        };
    }

    // 2. Migrate legacy unnumbered folders to numbered names.
    //    e.g. "Solicitudes de Codigo" → "06_Solicitudes_de_Codigo"
    await migrateLegacyFolders(resolved);

    // 3. Check each module folder
    const missing: MissingFolder[] = [];

    const modules = Object.keys(MODULE_FOLDER_NAMES) as ExportDocModule[];
    for (const mod of modules) {
        const folderName = MODULE_FOLDER_NAMES[mod];
        const expectedPath = `${resolved}\\${folderName}`;
        const exists = await isPathAccessible(expectedPath, 2000);
        if (!exists) {
            missing.push({ module: mod, folderName, expectedPath });
        }
    }

    // 3. Build result
    const healthy = missing.length === 0;
    let message: string;
    if (healthy) {
        message = 'Estructura de exportación verificada correctamente.';
    } else {
        const names = missing.map(m => m.folderName).join(', ');
        message = `Faltan ${missing.length} carpeta(s) de exportación: ${names}`;
    }

    return {
        healthy,
        accessible: true,
        resolvedBasePath: resolved,
        missing,
        message,
    };
}

// ============================================================================
// Repair
// ============================================================================

/**
 * Create missing export folders (module folders + _Legacy subfolders).
 *
 * Only creates folders that are in the `missing` list — does not touch existing folders.
 */
export async function repairExportStructure(
    missing: MissingFolder[],
    basePath?: string,
): Promise<RepairResult> {
    const result: RepairResult = { created: [], errors: [] };

    if (!isTauri() || missing.length === 0) return result;

    const resolved = basePath ?? missing[0]?.expectedPath?.split('\\').slice(0, -1).join('\\') ?? null;
    if (!resolved) return result;

    try {
        const fs = await import('./unified_fs');

        for (const item of missing) {
            try {
                // Create the module folder
                await fs.ensureDir(item.expectedPath);
                result.created.push(item.expectedPath);

                // Also create _Legacy subfolder
                const legacyPath = `${item.expectedPath}\\${LEGACY_FOLDER_NAME}`;
                await fs.ensureDir(legacyPath);
                result.created.push(legacyPath);

                logger.info('ExportHealthCheck', `Created: ${item.expectedPath} + ${LEGACY_FOLDER_NAME}`);
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                result.errors.push({ path: item.expectedPath, error: errMsg });
                logger.error('ExportHealthCheck', `Failed to create: ${item.expectedPath}`, { error: errMsg });
            }
        }
    } catch (err) {
        logger.error('ExportHealthCheck', 'Repair failed', {}, err instanceof Error ? err : undefined);
    }

    return result;
}

// ============================================================================
// Full Health Check (convenience)
// ============================================================================

/**
 * Run a full health check: validate structure, return actionable result.
 * This is the main entry point called from App.tsx at startup.
 */
export async function runExportHealthCheck(): Promise<HealthCheckResult> {
    return validateExportStructure();
}

/**
 * Validate + Repair in one call. Returns the repair result.
 * Called when user clicks "Crear carpetas" in the toast action.
 */
export async function validateAndRepair(): Promise<RepairResult> {
    const check = await validateExportStructure();

    if (!check.accessible) {
        return { created: [], errors: [{ path: 'Y:\\INGENIERIA', error: 'Red no disponible' }] };
    }

    if (check.healthy) {
        return { created: [], errors: [] };
    }

    return repairExportStructure(check.missing, check.resolvedBasePath ?? undefined);
}

// ============================================================================
// Legacy Folder Migration
// ============================================================================

/**
 * Map of old unnumbered folder names → numbered module keys.
 * Only folders that historically existed without the numbered prefix need mapping.
 */
const LEGACY_UNNUMBERED_FOLDERS: Record<string, ExportDocModule> = {
    'Solicitudes de Codigo': 'solicitud',
};

/**
 * Migrate legacy unnumbered folders by renaming them to the numbered name.
 * e.g. basePath\Solicitudes de Codigo → basePath\06_Solicitudes_de_Codigo
 *
 * Only renames if:
 * - The legacy (unnumbered) folder exists
 * - The target (numbered) folder does NOT exist
 *
 * This avoids data loss: if both exist, the user must decide manually.
 */
async function migrateLegacyFolders(basePath: string): Promise<void> {
    try {
        const fs = await import('./unified_fs');

        for (const [legacyName, mod] of Object.entries(LEGACY_UNNUMBERED_FOLDERS)) {
            const numberedName = MODULE_FOLDER_NAMES[mod];
            const legacyPath = `${basePath}\\${legacyName}`;
            const numberedPath = `${basePath}\\${numberedName}`;

            const legacyExists = await isPathAccessible(legacyPath, 2000);
            if (!legacyExists) continue;

            const numberedExists = await isPathAccessible(numberedPath, 2000);
            if (numberedExists) {
                // Both exist — don't touch, log for manual resolution
                logger.warn('ExportHealthCheck', 'Both legacy and numbered folders exist, skipping migration', {
                    legacyPath,
                    numberedPath,
                });
                continue;
            }

            // Rename legacy → numbered
            const renamed = await fs.rename(legacyPath, numberedPath);
            if (renamed) {
                logger.info('ExportHealthCheck', `Migrated legacy folder: "${legacyName}" → "${numberedName}"`, {
                    from: legacyPath,
                    to: numberedPath,
                });
            } else {
                logger.warn('ExportHealthCheck', 'Legacy folder rename returned false', {
                    from: legacyPath,
                    to: numberedPath,
                });
            }
        }
    } catch (err) {
        // Migration failure is non-fatal — the health check will still report missing folders
        logger.warn('ExportHealthCheck', 'Legacy folder migration failed', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resolve the best available base path for health checking.
 * Same logic as autoExportService but isolated.
 */
async function resolveHealthCheckBasePath(): Promise<string | null> {
    const configured = await getExportBasePath();

    if (await isPathAccessible(configured, 2000)) {
        return configured;
    }

    if (await isPathAccessible(UNC_EXPORT_FALLBACK, 3000)) {
        return UNC_EXPORT_FALLBACK;
    }

    return null;
}
