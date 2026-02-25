/**
 * Tauri Smart Save Module
 * 
 * Industrial-grade save functionality for Tauri desktop app using string paths.
 * Includes: Atomic writes, Lock management, Smart retry, Versioning.
 * Enhanced for network drives with path normalization and error handling.
 * 
 * @module tauri_smart_save
 */

import { ProjectData } from '../types';
import { incrementVersion } from '../utils';
import * as tauriFs from './tauri_fs';
import {
    normalizePath,
    joinPath,
    getFilename,
    classifyError,
    withSmartRetry,
    LockHeartbeat
} from './networkUtils';
import { logger } from './logger';
import { generateChecksum } from './crypto'; // H-07 Fix: Use centralized crypto

// ============================================================================
// TYPES
// ============================================================================

export interface TauriSaveResult {
    success: boolean;
    data: ProjectData;
    error?: string;
}

export interface TauriLockInfo {
    user: string;
    timestamp: number;
    machineId: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LOCK_TTL_MS = 60000; // 60 seconds (extended for slow networks)
const LOCK_HEARTBEAT_MS = 15000; // 15 seconds (TTL/4 ratio for reliability)

// ============================================================================
// LOCK MANAGEMENT (Tauri Path-Based)
// ============================================================================

/**
 * Get machine ID for lock attribution
 */
function getMachineId(): string {
    let id = sessionStorage.getItem('_machine_id');
    if (!id) {
        id = `machine_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem('_machine_id', id);
    }
    return id;
}

/**
 * Get current user name
 */
function getCurrentUser(): string {
    return localStorage.getItem('_current_user') || 'Usuario';
}

/**
 * Get lock file path for a project file (using Windows separators)
 */
function getLockPath(filePath: string): string {
    const normalized = normalizePath(filePath);
    const lastSep = normalized.lastIndexOf('\\');
    const dir = normalized.substring(0, lastSep);
    const name = normalized.substring(lastSep + 1);
    return joinPath(dir, `.${name}.lock`);
}

/**
 * Check if a lock exists and is valid
 */
async function checkLock(filePath: string): Promise<TauriLockInfo | null> {
    const lockPath = getLockPath(filePath);
    const content = await tauriFs.readTextFile(lockPath);

    if (!content) return null;

    try {
        const lock = JSON.parse(content) as TauriLockInfo;
        const age = Date.now() - lock.timestamp;

        // Lock expired?
        if (age > LOCK_TTL_MS) {
            // Remove stale lock
            logger.info('TauriSave', 'Removing stale lock', { age, lockPath });
            await tauriFs.remove(lockPath);
            return null;
        }

        // Own lock?
        if (lock.machineId === getMachineId()) {
            return null; // Own lock doesn't count as blocking
        }

        return lock;
    } catch {
        return null;
    }
}

/**
 * Acquire a lock on a file
 */
async function acquireLock(filePath: string): Promise<{ acquired: boolean; existingLock?: TauriLockInfo }> {
    const existingLock = await checkLock(filePath);
    if (existingLock) {
        logger.warn('TauriSave', 'Lock exists, cannot acquire', { user: existingLock.user });
        return { acquired: false, existingLock };
    }

    const lockPath = getLockPath(filePath);
    const lockData: TauriLockInfo = {
        user: getCurrentUser(),
        timestamp: Date.now(),
        machineId: getMachineId()
    };

    try {
        await tauriFs.writeTextFile(lockPath, JSON.stringify(lockData, null, 2));
        logger.info('TauriSave', 'Lock acquired', { lockPath });
        return { acquired: true };
    } catch (err) {
        // Graceful degradation - proceed without lock
        const classification = classifyError(err);
        logger.warn('TauriSave', 'Could not acquire lock, proceeding anyway', {
            error: classification.code,
            isTransient: classification.isTransient
        });
        return { acquired: true };
    }
}

/**
 * Update lock timestamp (heartbeat)
 */
async function updateLock(filePath: string): Promise<void> {
    const lockPath = getLockPath(filePath);
    const lockData: TauriLockInfo = {
        user: getCurrentUser(),
        timestamp: Date.now(),
        machineId: getMachineId()
    };
    await tauriFs.writeTextFile(lockPath, JSON.stringify(lockData, null, 2));
}

/**
 * Release a lock
 */
async function releaseLock(filePath: string): Promise<void> {
    const lockPath = getLockPath(filePath);
    try {
        await tauriFs.remove(lockPath);
        logger.info('TauriSave', 'Lock released', { lockPath });
    } catch {
        // Ignore cleanup errors
    }
}

// ============================================================================
// CHECKSUM & VERIFICATION (H-07 Fix: Uses centralized crypto module)
// ============================================================================

// generateChecksum is imported from ./crypto

// ============================================================================
// BACKUP MANAGEMENT
// ============================================================================

/**
 * Create backup of current file in Obsoletos folder
 */
async function createBackup(
    filePath: string,
    dirPath: string,
    content: string,
    projectName: string,
    version: string
): Promise<boolean> {
    try {
        const obsoletosDir = joinPath(normalizePath(dirPath), 'Obsoletos');
        await tauriFs.ensureDir(obsoletosDir);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const cleanName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanVersion = version.replace(/[^a-zA-Z0-9._-]/g, '_');
        const backupName = `${cleanName}_${cleanVersion}_${timestamp}.json`;

        await tauriFs.writeTextFile(joinPath(obsoletosDir, backupName), content);
        logger.info('TauriSave', 'Backup created', { backupName });
        return true;
    } catch (err) {
        const classification = classifyError(err);
        logger.warn('TauriSave', 'Backup creation failed', {
            error: classification.message,
            code: classification.code
        });
        return false;
    }
}

// ============================================================================
// SMART SAVE (Main Function)
// ============================================================================

/**
 * Smart Save for Tauri (Desktop) mode
 * 
 * Features:
 * - Lock acquisition with heartbeat for long saves
 * - Atomic write (temp file → replace)
 * - Smart retry with backoff+jitter for transient errors
 * - Backup to Obsoletos folder
 * - Version increment
 * 
 * @param filePath - Full path to the project .json file
 * @param dirPath - Directory containing the file
 * @param data - Project data to save
 * @returns Updated project data with new version
 */
export async function smartSaveProjectTauri(
    filePath: string,
    dirPath: string,
    data: ProjectData
): Promise<ProjectData> {
    // Normalize paths for Windows/network
    let normalizedFilePath = normalizePath(filePath);
    let normalizedDirPath = normalizePath(dirPath);

    logger.info('TauriSave', 'Starting save', {
        file: getFilename(normalizedFilePath)
    });

    // PRE-VALIDATION: Check if the save path is accessible (BUG-01 Fix)
    let pathAccessible = await tauriFs.exists(normalizedDirPath);

    // BUG-04 Fix: If path is not accessible, check if we're in LOCAL mode and redirect
    if (!pathAccessible) {
        try {
            const { getCurrentMode, getActiveBasePath } = await import('./storageManager');
            const { ensureStudyStructure, setPathConfig } = await import('./pathManager');
            const currentMode = await getCurrentMode();

            if (currentMode === 'local') {
                // Extract project structure from original path to reconstruct in local
                // Path format: basePath\\01_DATA\\CLIENT\\PROJECT\\PART\\master.json
                const pathParts = normalizedDirPath.split('\\');
                const partIndex = pathParts.length - 1; // Last folder is PART
                const projectIndex = pathParts.length - 2; // PROJECT
                const clientIndex = pathParts.length - 3; // CLIENT (adjusted for simpler logic)

                const part = pathParts[partIndex] || 'PROYECTO';
                const project = pathParts[projectIndex] || 'PROYECTO';
                const client = pathParts[clientIndex] || 'LOCAL';

                const localBasePath = await getActiveBasePath();

                // Update path config to use local base path
                setPathConfig({ basePath: localBasePath });

                // Create complete folder structure (01_DATA, 02_MEDIA, 04_REPORTES)
                const structureResult = await ensureStudyStructure(client, project, part);

                if (structureResult.success) {
                    normalizedDirPath = joinPath(localBasePath, '01_DATA', client, project, part);
                    normalizedFilePath = joinPath(normalizedDirPath, getFilename(normalizedFilePath));
                    pathAccessible = true;

                    logger.info('TauriSave', 'Redirected to local storage', {
                        from: dirPath,
                        to: normalizedDirPath,
                        folders: structureResult.createdPaths
                    });
                } else {
                    logger.warn('TauriSave', 'Failed to create local structure', {
                        error: structureResult.error
                    });
                }
            }
        } catch (e) {
            logger.warn('TauriSave', 'Could not redirect to local storage', { error: String(e) });
        }
    }

    if (!pathAccessible) {
        // Extract drive letter or UNC path for clearer messaging
        const driveLetter = normalizedDirPath.match(/^([A-Z]:)/)?.[1] ||
            normalizedDirPath.match(/^(\\\\[^\\]+\\[^\\]+)/)?.[1] ||
            'ruta de red';

        logger.error('TauriSave', 'Save path not accessible', {
            path: normalizedDirPath,
            drive: driveLetter
        });

        throw new Error(
            `❌ La ruta de guardado no es accesible:\n${normalizedDirPath}\n\n` +
            `Posible causa: La unidad ${driveLetter} no está disponible.\n\n` +
            `Sugerencia: Configure una ruta local válida en Configuración → Almacenamiento.`
        );
    }

    // 0. CHECK FOR EXISTING LOCK
    const existingLock = await checkLock(normalizedFilePath);
    if (existingLock) {
        logger.warn('TauriSave', 'File locked by another user', { user: existingLock.user });
        throw new Error(
            `⚠️ Archivo bloqueado por ${existingLock.user}\n\n` +
            `Bloqueado hace ${Math.round((Date.now() - existingLock.timestamp) / 1000)} segundos.\n\n` +
            `Opciones:\n` +
            `• Espere a que termine el otro usuario\n` +
            `• Recargue para ver cambios recientes`
        );
    }

    // 0.1 ACQUIRE LOCK
    const lockResult = await acquireLock(normalizedFilePath);
    if (!lockResult.acquired && lockResult.existingLock) {
        throw new Error(`Archivo bloqueado por ${lockResult.existingLock.user}`);
    }

    // Start lock heartbeat for long saves
    const heartbeat = new LockHeartbeat(
        normalizedFilePath,
        () => updateLock(normalizedFilePath),
        LOCK_HEARTBEAT_MS
    );
    heartbeat.start();

    try {
        // 1. PREPARE NEW DATA
        const newVersion = incrementVersion(data.meta.version);
        let newData: ProjectData = {
            ...data,
            meta: { ...data.meta, version: newVersion },
            lastModified: Date.now()
        };

        // Remove encryption metadata if present (cleanup)
        delete newData.encryption;

        // 2. SERIALIZE (Remove transient fields)
        const { fileHandle: _, directoryHandle: __, _loadedTimestamp: ___, _checksum: ____, ...serializableData } = newData;
        const newContent = JSON.stringify(serializableData, null, 2);

        // 4. READ CURRENT FILE FOR BACKUP/CONFLICT CHECK
        const currentContent = await tauriFs.readTextFile(normalizedFilePath);

        // 5. ATOMIC WRITE WITH SMART RETRY
        const tempPath = joinPath(normalizedDirPath, `.${getFilename(normalizedFilePath)}.tmp`);

        await withSmartRetry(
            async () => {
                // Write to temp file (BUG-02/BUG-03 Fix: Check write success explicitly)
                const writeSuccess = await tauriFs.writeTextFile(tempPath, newContent);
                if (!writeSuccess) {
                    throw new Error(
                        `Error al escribir archivo temporal.\n` +
                        `Ruta: ${tempPath}\n\n` +
                        `Verifique permisos y conectividad de red.`
                    );
                }

                // Verify temp file
                const tempContent = await tauriFs.readTextFile(tempPath);
                if (!tempContent) {
                    throw new Error(
                        `No se pudo verificar el archivo temporal después de escribir.\n` +
                        `Ruta: ${tempPath}\n\n` +
                        `Posible problema de red o permisos.`
                    );
                }

                const tempChecksum = await generateChecksum(tempContent);
                const expectedChecksum = await generateChecksum(newContent);

                if (tempChecksum !== expectedChecksum) {
                    await tauriFs.remove(tempPath);
                    throw new Error(
                        `Verificación de integridad fallida.\n` +
                        `El archivo escrito no coincide con los datos originales.\n\n` +
                        `Posible causa: Problema de red durante la escritura.`
                    );
                }
            },
            { maxRetries: 3, baseDelayMs: 200 },
            (attempt, error, delay) => {
                logger.warn('TauriSave', `Retry attempt ${attempt}`, {
                    error: error.code,
                    delayMs: delay
                });
            }
        );

        // 6. CREATE BACKUP
        if (currentContent) {
            await createBackup(normalizedFilePath, normalizedDirPath, currentContent, data.meta.name, data.meta.version);
        }

        // 7. REPLACE ORIGINAL WITH TEMP (Safe Atomic Swap - H-02 Fix)
        // Order: rename original → rename temp → delete backup
        // This ensures we never lose data even on crash between operations
        const backupPath = `${normalizedFilePath}.bak`;
        let originalRenamed = false;

        try {
            // Step 1: Rename original to .bak (preserves data)
            if (currentContent) {
                await tauriFs.rename(normalizedFilePath, backupPath);
                originalRenamed = true;
            }

            // Step 2: Rename temp to original
            await tauriFs.rename(tempPath, normalizedFilePath);

            // Step 3: Delete backup only after successful rename
            if (originalRenamed) {
                try {
                    await tauriFs.remove(backupPath);
                } catch {
                    // Backup cleanup failure is non-critical
                    logger.warn('TauriSave', 'Could not remove backup file', { backupPath });
                }
            }
        } catch (swapError) {
            // Recovery: If temp rename failed but original was renamed, restore it
            if (originalRenamed) {
                try {
                    await tauriFs.rename(backupPath, normalizedFilePath);
                    logger.info('TauriSave', 'Restored original file from backup after swap failure');
                } catch (restoreError) {
                    logger.error('TauriSave', 'CRITICAL: Could not restore backup', {}, restoreError instanceof Error ? restoreError : undefined);
                }
            }

            // Fallback: Direct write (last resort)
            logger.warn('TauriSave', 'Atomic swap failed, using fallback write');
            await tauriFs.writeTextFile(normalizedFilePath, newContent);

            // Clean up temp file
            try {
                await tauriFs.remove(tempPath);
            } catch {
                // Ignore temp cleanup failure
            }
        }

        // 8. STOP HEARTBEAT & RELEASE LOCK
        heartbeat.stop();
        await releaseLock(normalizedFilePath);

        // 9. UPDATE CONCURRENCY MARKERS
        const savedContent = await tauriFs.readTextFile(normalizedFilePath);
        const finalChecksum = await generateChecksum(savedContent || '');

        logger.info('TauriSave', 'Save completed successfully', { version: newVersion });

        return {
            ...newData,
            fileHandle: normalizedFilePath,
            directoryHandle: normalizedDirPath,
            _checksum: finalChecksum,
            _loadedTimestamp: Date.now()
        };

    } catch (error) {
        // Always stop heartbeat and release lock on error
        heartbeat.stop();
        await releaseLock(normalizedFilePath);

        const classification = classifyError(error);
        logger.error('TauriSave', 'Save failed', {
            code: classification.code,
            isTransient: classification.isTransient
        }, error instanceof Error ? error : undefined);

        throw error;
    }
}

// ============================================================================
// QUICK SAVE (Lightweight - No version, no backup, no encryption)
// ============================================================================

/**
 * Quick Save for Tauri - Fast, lightweight save for work-in-progress
 * 
 * Skips:
 * - Lock management
 * - Encryption prompts
 * - Checksum verification
 * - Backup creation
 * - Version increment
 * 
 * Use for frequent saves during work. Use smartSaveProjectTauri for formal revisions.
 * 
 * @param filePath - Full path to the project .json file
 * @param data - Project data to save
 */
export async function quickSaveTauri(
    filePath: string,
    data: ProjectData
): Promise<void> {
    const normalizedPath = normalizePath(filePath);

    logger.info('QuickSave', 'Starting quick save', { file: getFilename(normalizedPath) });

    try {
        // Remove transient fields and serialize
        const {
            fileHandle: _,
            directoryHandle: __,
            _loadedTimestamp: ___,
            _checksum: ____,
            ...serializableData
        } = data;

        // Update lastModified
        const dataToSave = {
            ...serializableData,
            lastModified: Date.now()
        };

        const content = JSON.stringify(dataToSave, null, 2);

        // Direct write - no temp file, no swap
        const success = await tauriFs.writeTextFile(normalizedPath, content);

        if (!success) {
            throw new Error('Write operation returned false');
        }

        logger.info('QuickSave', 'Quick save completed');
    } catch (error) {
        const classification = classifyError(error);
        logger.error('QuickSave', 'Quick save failed', {
            code: classification.code,
            message: classification.message
        });
        throw new Error(`Error al guardar: ${classification.message}`);
    }
}

// ============================================================================
// HELPER: CHECK IF TAURI SAVE SHOULD BE USED
// ============================================================================

/**
 * Determine if we should use Tauri save
 */
export function shouldUseTauriSave(fileHandle: any): boolean {
    return tauriFs.isTauri() && typeof fileHandle === 'string';
}


