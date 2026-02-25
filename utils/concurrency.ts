/**
 * Concurrency Utilities
 * 
 * Provides atomic write patterns, lockfile management, and conflict resolution
 * for safe file operations on shared network drives.
 * 
 * @module concurrency
 */

// H-07 Fix: Import centralized crypto utilities
import { generateChecksum as _generateChecksum } from './crypto';
import { logger } from './logger';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Information about a lock on a file
 */
export interface LockInfo {
    user: string;
    timestamp: number;
    ttlMs: number;  // Time-to-live in milliseconds
    machine?: string;
}

/**
 * Structured conflict error with resolution options
 */
export interface SaveConflict {
    type: 'version_conflict';
    diskVersion: string;
    diskTimestamp: number;
    diskChecksum: string;
    localChecksum: string;
    options: ConflictResolution[];
}

export type ConflictResolution = 'reload' | 'force_save' | 'save_as_new' | 'cancel';

/**
 * Custom error class for version conflicts
 */
export class ConflictError extends Error {
    diskChecksum: string;
    localChecksum: string;
    diskTimestamp: number;
    diskVersion: string;

    constructor(
        diskChecksum: string,
        localChecksum: string,
        diskTimestamp: number,
        diskVersion: string = 'unknown'
    ) {
        super('CONFLICT: El archivo ha sido modificado por otro usuario o proceso');
        this.name = 'ConflictError';
        this.diskChecksum = diskChecksum;
        this.localChecksum = localChecksum;
        this.diskTimestamp = diskTimestamp;
        this.diskVersion = diskVersion;
    }

    /**
     * Get the conflict info as a SaveConflict object
     */
    get conflict(): SaveConflict {
        return this.toConflict();
    }

    /**
     * Convert to structured conflict info for UI
     */
    toConflict(): SaveConflict {
        return {
            type: 'version_conflict',
            diskVersion: this.diskVersion,
            diskTimestamp: this.diskTimestamp,
            diskChecksum: this.diskChecksum,
            localChecksum: this.localChecksum,
            options: ['reload', 'save_as_new', 'cancel']
        };
    }
}

// ============================================================================
// CONSTANTS (imported from centralized config)
// ============================================================================

import {
    LOCK_TTL_MS as DEFAULT_LOCK_TTL_MS,
    LOCK_HEARTBEAT_MS,
    LOCK_MAX_RETRIES as DEFAULT_MAX_RETRIES
} from '../config';

// Re-export for backward compatibility
export const LOCK_HEARTBEAT_INTERVAL_MS = LOCK_HEARTBEAT_MS;

const DEFAULT_BACKOFF_MS = [100, 500, 1000];
const LOCK_FILE_SUFFIX = '.lock';

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Delay execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get a machine identifier for lock ownership
 * Uses a simple random ID stored in sessionStorage
 */
export function getMachineId(): string {
    // H-08 Fix: Use localStorage instead of sessionStorage to ensure consistent machineId
    // across all tabs/windows. sessionStorage is isolated per-tab, causing self-locks
    // when the same user opens multiple windows of the application.
    let machineId = localStorage.getItem('_barack_machine_id');
    if (!machineId) {
        machineId = `machine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('_barack_machine_id', machineId);
    }
    return machineId;
}

/**
 * Get current user name for lock attribution
 */
export function getCurrentUser(): string {
    // Try to get from localStorage (set in settings)
    const userName = localStorage.getItem('_barack_user_name');
    if (userName) return userName;

    // Fallback to a default
    return 'Usuario Desconocido';
}

/**
 * Set the current user name
 */
export function setCurrentUser(name: string): void {
    localStorage.setItem('_barack_user_name', name);
}

// ============================================================================
// LOCKFILE MANAGEMENT
// ============================================================================

/**
 * Create lock file content
 */
function createLockContent(ttlMs: number = DEFAULT_LOCK_TTL_MS): LockInfo {
    return {
        user: getCurrentUser(),
        timestamp: Date.now(),
        ttlMs: ttlMs,
        machine: getMachineId()
    };
}

/**
 * Check if a lock is expired
 */
export function isLockExpired(lock: LockInfo): boolean {
    const now = Date.now();
    return now > (lock.timestamp + lock.ttlMs);
}

/**
 * Check if we own the lock
 */
export function isOurLock(lock: LockInfo): boolean {
    return lock.machine === getMachineId();
}

/**
 * Acquire a lock on a file (File System Access API version)
 * Returns true if lock acquired, false if another user has it
 * H-01 Fix: No longer silently degrades - distinguishes transient vs permanent errors
 */
export async function acquireLock(
    dirHandle: FileSystemDirectoryHandle,
    filename: string,
    ttlMs: number = DEFAULT_LOCK_TTL_MS
): Promise<{ acquired: boolean; existingLock?: LockInfo; degraded?: boolean; error?: string }> {
    const lockFilename = `${filename}${LOCK_FILE_SUFFIX}`;

    try {
        // Try to read existing lock
        try {
            const lockHandle = await dirHandle.getFileHandle(lockFilename);
            const file = await lockHandle.getFile();
            const content = await file.text();
            const existingLock = JSON.parse(content) as LockInfo;

            // Check if lock is expired
            if (isLockExpired(existingLock)) {
                // Expired lock - we can take over
                await writeLockFile(dirHandle, lockFilename, ttlMs);
                return { acquired: true };
            }

            // Check if it's our lock (same machine)
            if (isOurLock(existingLock)) {
                // Refresh our own lock
                await writeLockFile(dirHandle, lockFilename, ttlMs);
                return { acquired: true };
            }

            // Someone else has the lock
            return { acquired: false, existingLock };
        } catch (e) {
            // Lock file doesn't exist - create it
            await writeLockFile(dirHandle, lockFilename, ttlMs);
            return { acquired: true };
        }
    } catch (error) {
        // H-01 Fix: Distinguish transient vs permanent errors
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
        const isTransient = errorMessage.includes('network') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('temporarily') ||
            errorMessage.includes('busy');

        if (isTransient) {
            // Transient error - allow operation but warn user
            logger.warn('Concurrency', 'Transient error acquiring lock, proceeding with degraded mode', { error: String(error) });
            return { acquired: true, degraded: true };
        }

        // Permanent error - don't silently proceed, fail visibly
        logger.error('Concurrency', 'Failed to acquire lock', {}, error instanceof Error ? error : undefined);
        return {
            acquired: false,
            error: 'No se pudo verificar el bloqueo del archivo. Verifique los permisos.'
        };
    }
}

/**
 * Write a lock file
 */
async function writeLockFile(
    dirHandle: FileSystemDirectoryHandle,
    lockFilename: string,
    ttlMs: number
): Promise<void> {
    const lockHandle = await dirHandle.getFileHandle(lockFilename, { create: true });
    const writable = await lockHandle.createWritable();
    await writable.write(JSON.stringify(createLockContent(ttlMs)));
    await writable.close();
}

/**
 * Release a lock on a file
 */
export async function releaseLock(
    dirHandle: FileSystemDirectoryHandle,
    filename: string
): Promise<void> {
    const lockFilename = `${filename}${LOCK_FILE_SUFFIX}`;

    try {
        // First verify it's our lock
        try {
            const lockHandle = await dirHandle.getFileHandle(lockFilename);
            const file = await lockHandle.getFile();
            const content = await file.text();
            const existingLock = JSON.parse(content) as LockInfo;

            // Only delete if it's ours
            if (!isOurLock(existingLock)) {
                logger.warn('Concurrency', 'Attempted to release lock owned by another machine');
                return;
            }
        } catch {
            // Lock doesn't exist, nothing to release
            return;
        }

        // @ts-ignore - removeEntry is available
        await dirHandle.removeEntry(lockFilename);
    } catch (error) {
        // Ignore errors releasing lock
        logger.warn('Concurrency', 'Error releasing lock', { error: String(error) });
    }
}

/**
 * Check if a file is locked by someone else
 */
export async function checkLock(
    dirHandle: FileSystemDirectoryHandle,
    filename: string
): Promise<LockInfo | null> {
    const lockFilename = `${filename}${LOCK_FILE_SUFFIX}`;

    try {
        const lockHandle = await dirHandle.getFileHandle(lockFilename);
        const file = await lockHandle.getFile();
        const content = await file.text();
        const lock = JSON.parse(content) as LockInfo;

        // Return null if expired or ours
        if (isLockExpired(lock) || isOurLock(lock)) {
            return null;
        }

        return lock;
    } catch {
        return null; // No lock exists
    }
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Execute a function with retry and exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options?: {
        maxRetries?: number;
        backoffMs?: number[];
        shouldRetry?: (error: any) => boolean;
    }
): Promise<T> {
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const backoffMs = options?.backoffMs ?? DEFAULT_BACKOFF_MS;
    const shouldRetry = options?.shouldRetry ?? (() => true);

    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry ConflictErrors
            if (error instanceof ConflictError) {
                throw error;
            }

            // Check if we should retry
            if (!shouldRetry(error)) {
                throw error;
            }

            // Wait before retry (if not last attempt)
            if (attempt < maxRetries - 1) {
                const delayTime = backoffMs[Math.min(attempt, backoffMs.length - 1)];
                await delay(delayTime);
            }
        }
    }

    throw lastError;
}

// ============================================================================
// CHECKSUM UTILITIES (H-07 Fix: Re-exported from centralized module)
// ============================================================================

// H-07 Fix: Use centralized crypto utilities to avoid duplication
export { generateChecksum, verifyChecksum } from './crypto';

// ============================================================================
// ATOMIC WRITE HELPERS
// ============================================================================

/**
 * Perform an atomic write operation
 * Writes to temp file first, then replaces original
 * 
 * Note: File System Access API doesn't have true atomic rename,
 * so we simulate it by:
 * 1. Write to temp file
 * 2. Read temp content
 * 3. Write to original
 * 4. Delete temp
 */
export async function atomicWrite(
    dirHandle: FileSystemDirectoryHandle,
    fileHandle: FileSystemFileHandle,
    content: string,
    options?: {
        tempPrefix?: string;
        validateAfterWrite?: boolean;
    }
): Promise<{ success: boolean; checksum: string }> {
    const tempPrefix = options?.tempPrefix ?? '.tmp_';
    const validateAfterWrite = options?.validateAfterWrite ?? true;

    // Generate temp filename
    const originalName = fileHandle.name;
    const tempName = `${tempPrefix}${Date.now()}_${originalName}`;

    // Pre-compute checksum once for validation and return value
    const contentChecksum = await _generateChecksum(content);

    try {
        // 1. Write to temp file
        const tempHandle = await dirHandle.getFileHandle(tempName, { create: true });
        const tempWritable = await tempHandle.createWritable();
        await tempWritable.write(content);
        await tempWritable.close();

        // 2. Validate temp file was written correctly
        if (validateAfterWrite) {
            const tempFile = await tempHandle.getFile();
            const tempContent = await tempFile.text();
            const tempChecksum = await _generateChecksum(tempContent);

            if (tempChecksum !== contentChecksum) {
                // Temp write failed - clean up and throw
                await dirHandle.removeEntry(tempName);
                throw new Error('Temp file verification failed');
            }
        }

        // 3. Write to original file
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        // 4. Delete temp file
        try {
            await dirHandle.removeEntry(tempName);
        } catch {
            // Ignore temp cleanup errors
        }

        // 5. Return pre-computed checksum
        return { success: true, checksum: contentChecksum };
    } catch (error) {
        // Cleanup temp file on error
        try {
            // @ts-ignore
            await dirHandle.removeEntry(tempName);
        } catch {
            // Ignore cleanup errors
        }
        throw error;
    }
}

// ============================================================================
// CONFLICT RESOLUTION UI HELPERS
// ============================================================================

/**
 * Format a timestamp for display
 */
export function formatConflictTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('es-AR', {
        dateStyle: 'short',
        timeStyle: 'medium'
    });
}

/**
 * Format lock info for display
 */
export function formatLockMessage(lock: LockInfo): string {
    const lockTime = formatConflictTimestamp(lock.timestamp);
    const expiresIn = Math.max(0, Math.round((lock.timestamp + lock.ttlMs - Date.now()) / 1000));

    return `Archivo bloqueado por ${lock.user} desde ${lockTime}. ` +
        `El bloqueo expira en ${expiresIn} segundos.`;
}

/**
 * Create user-friendly conflict message
 */
export function formatConflictMessage(conflict: SaveConflict): string {
    const diskTime = formatConflictTimestamp(conflict.diskTimestamp);

    return `⚠️ CONFLICTO DE VERSIONES\n\n` +
        `El archivo fue modificado el ${diskTime}.\n` +
        `Versión en disco: ${conflict.diskVersion}\n\n` +
        `Opciones:\n` +
        `• Recargar - Cargar la versión del disco (perder cambios locales)\n` +
        `• Guardar como nueva - Crear una copia con tus cambios\n` +
        `• Cancelar - Mantener tu sesión actual sin guardar`;
}
