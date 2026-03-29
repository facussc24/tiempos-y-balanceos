import { logger } from './logger';

/**
 * Network Utilities for Tauri Desktop
 * 
 * Handles path normalization, network error classification,
 * smart retry logic, and orphan file cleanup for network drives.
 * 
 * @module networkUtils
 */

// ============================================================================
// PATH NORMALIZATION (Windows Network Drives)
// ============================================================================

/**
 * Normalize a Windows path for consistent handling
 * - Converts forward slashes to backslashes
 * - Handles UNC paths (\\server\share)
 * - Removes trailing slashes
 * - Collapses multiple slashes
 */
export function normalizePath(path: string): string {
    if (!path) return path;

    // Detect UNC path (starts with \\)
    const isUNC = path.startsWith('\\\\') || path.startsWith('//');

    // Normalize slashes to backslash for Windows
    let normalized = path.replace(/\//g, '\\');

    // Collapse multiple consecutive backslashes (but preserve UNC prefix)
    if (isUNC) {
        // Keep the leading \\ for UNC, normalize the rest
        normalized = '\\\\' + normalized.slice(2).replace(/\\{2,}/g, '\\');
    } else {
        normalized = normalized.replace(/\\{2,}/g, '\\');
    }

    // Remove trailing slash UNLESS it's a root path
    // Drive root: exactly 3 chars like "C:\"
    const isDriveRoot = normalized.length === 3 && normalized[1] === ':' && normalized[2] === '\\';
    // UNC root: short paths like \\server\share
    const isUNCRoot = isUNC && normalized.split('\\').filter(Boolean).length <= 2;

    if (!isDriveRoot && !isUNCRoot && normalized.length > 1 && normalized.endsWith('\\')) {
        normalized = normalized.slice(0, -1);
    }

    return normalized;
}

/**
 * Join path segments safely
 */
export function joinPath(...segments: string[]): string {
    const joined = segments
        .filter(Boolean)
        .map((s, i) => i === 0 ? s : s.replace(/^[/\\]+/, ''))
        .join('\\');
    return normalizePath(joined);
}

/**
 * Get parent directory of a path
 */
export function getParentDir(path: string): string {
    const normalized = normalizePath(path);
    const lastSep = normalized.lastIndexOf('\\');

    // If no separator or at root, return original
    if (lastSep <= 0) return normalized;

    // Special case: C:\ - return as-is since we're at root
    if (lastSep === 2 && normalized[1] === ':') {
        return normalized; // Already at root drive
    }

    return normalized.substring(0, lastSep);
}

/**
 * Get filename from path
 */
export function getFilename(path: string): string {
    const normalized = normalizePath(path);
    const lastSep = normalized.lastIndexOf('\\');
    return lastSep >= 0 ? normalized.substring(lastSep + 1) : normalized;
}

// ============================================================================
// NETWORK ERROR CLASSIFICATION
// ============================================================================

/**
 * Network error codes that are transient (retry-able)
 */
const TRANSIENT_ERROR_CODES = [
    'ETIMEDOUT',    // Connection timeout
    'ECONNRESET',   // Connection reset
    'ECONNREFUSED', // Connection refused (network down)
    'ENOTCONN',     // Not connected
    'ENETUNREACH',  // Network unreachable
    'EHOSTUNREACH', // Host unreachable
    'EAGAIN',       // Resource temporarily unavailable
    'EBUSY',        // Device or resource busy (file in use)
    'EIO',          // I/O error (network glitch)
    'ESRCH',        // No such process (lock held by dead process)
];

/**
 * Windows-specific network error codes (BUG-05 Fix)
 * These appear in error messages as "os error XX"
 */
const WINDOWS_NETWORK_ERROR_CODES = [
    '53',    // Network path not found
    '64',    // Network name was deleted  
    '67',    // Network name cannot be found
    '1231',  // Network location cannot be reached
    '1232',  // Network service unavailable
    '1203',  // No network provider accepted the given path
    '1222',  // Network is not present or not started
];

/**
 * Permanent error codes (don't retry)
 */
const PERMANENT_ERROR_CODES = [
    'ENOENT',       // File not found
    'EEXIST',       // File already exists
    'EPERM',        // Operation not permitted
    'EACCES',       // Permission denied
    'EROFS',        // Read-only filesystem
    'ENOSPC',       // No space left
    'EINVAL',       // Invalid argument
];

/**
 * Extract Windows OS error code from error message
 * Matches patterns like "os error 53" or "(os error 67)"
 */
function extractWindowsErrorCode(message: string): string | null {
    const match = message.match(/os error (\d+)/i);
    return match ? match[1] : null;
}

/**
 * Error classification result
 */
export interface ErrorClassification {
    isTransient: boolean;
    isPermanent: boolean;
    isLockError: boolean;
    isPermissionError: boolean;
    isNetworkError: boolean;
    isNetworkPathError: boolean;
    code: string | null;
    message: string;
    userMessage: string;
    suggestedAction: string;
}

/**
 * Classify an error for retry decision
 */
export function classifyError(error: unknown): ErrorClassification {
    const err = error as Record<string, unknown> | null;
    const code = (err?.code || err?.errno || null) as string | null;
    const message = (typeof err?.message === 'string' ? err.message : String(error));

    // Check for Windows network errors in message (BUG-05 Fix)
    const windowsErrorCode = extractWindowsErrorCode(message);
    const isWindowsNetworkError = windowsErrorCode !== null &&
        WINDOWS_NETWORK_ERROR_CODES.includes(windowsErrorCode);

    // Check for our custom ConflictError
    const isConflictError = err?.name === 'ConflictError' || message.includes('ConflictError');

    // Check for lock-related errors
    const isLockError =
        message.toLowerCase().includes('lock') ||
        message.toLowerCase().includes('bloqueado') ||
        code === 'EBUSY';

    // Check for permission errors
    const isPermissionError =
        code === 'EPERM' ||
        code === 'EACCES' ||
        message.toLowerCase().includes('permission') ||
        message.toLowerCase().includes('permiso');

    // Check for network errors (expanded to include Windows codes)
    const isNetworkError =
        TRANSIENT_ERROR_CODES.includes(code) ||
        isWindowsNetworkError ||
        message.toLowerCase().includes('network') ||
        message.toLowerCase().includes('connection') ||
        message.toLowerCase().includes('ruta de acceso de la red');

    // Specific flag for network path accessibility issues
    const isNetworkPathError = isWindowsNetworkError ||
        message.toLowerCase().includes('ruta de acceso de la red') ||
        message.toLowerCase().includes('network path');

    // Determine if transient (retry-able)
    // Network path errors are NOT transient - they require user action
    const isTransient =
        !isConflictError &&
        !isLockError &&
        !isNetworkPathError &&
        (TRANSIENT_ERROR_CODES.includes(code) || (isNetworkError && !isNetworkPathError));

    // Determine if permanent (don't retry)
    const isPermanent =
        isConflictError ||
        isLockError ||
        isPermissionError ||
        isNetworkPathError ||
        PERMANENT_ERROR_CODES.includes(code);

    // Generate user-friendly message + suggested action for non-technical users
    let userMessage = 'Error desconocido. Intente de nuevo en unos segundos.';
    let suggestedAction = 'Esperar unos segundos e intentar de nuevo.';

    if (isNetworkPathError) {
        userMessage = 'No hay conexión al servidor. Tus cambios se guardan localmente.';
        suggestedAction = 'Verificar que el cable de red esté conectado o que haya WiFi.';
    } else if (isPermissionError) {
        userMessage = 'No tienes permiso para acceder a este archivo.';
        suggestedAction = 'Pedir acceso a la carpeta al administrador de sistemas.';
    } else if (isLockError) {
        userMessage = 'Otro usuario está editando este archivo. Espera un momento.';
        suggestedAction = 'Esperar 30 segundos e intentar de nuevo.';
    } else if (isNetworkError) {
        userMessage = 'Se perdió la conexión al servidor. Tus cambios se guardan localmente.';
        suggestedAction = 'Verificar la conexión de red. Se sincronizará automáticamente al volver.';
    } else if (code === 'ENOENT') {
        userMessage = 'No se encontró el archivo o carpeta.';
        suggestedAction = 'Verificar que el proyecto no haya sido movido o eliminado.';
    } else if (code === 'ENOSPC') {
        userMessage = 'No hay espacio en el disco. Libera espacio e intenta de nuevo.';
        suggestedAction = 'Borrar archivos innecesarios del disco o pedir más espacio.';
    }

    return {
        isTransient,
        isPermanent,
        isLockError,
        isPermissionError,
        isNetworkError,
        isNetworkPathError,
        code: windowsErrorCode || code,
        message,
        userMessage,
        suggestedAction,
    };
}

// ============================================================================
// SMART RETRY WITH BACKOFF + JITTER
// ============================================================================

export interface RetryConfig {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitterFactor: number; // 0-1, how much randomness to add
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 200,
    maxDelayMs: 5000,
    jitterFactor: 0.3
};

/**
 * Calculate delay with exponential backoff + jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff: base * 2^attempt
    const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);

    // Cap at max
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

    // Add jitter (random variation)
    const jitter = cappedDelay * config.jitterFactor * Math.random();

    return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with smart retry
 * Only retries for transient errors, not for conflicts or locks
 */
export async function withSmartRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    onRetry?: (attempt: number, error: ErrorClassification, delayMs: number) => void
): Promise<T> {
    const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };

    let lastError: unknown;

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const classification = classifyError(error);

            // Don't retry permanent errors
            if (classification.isPermanent) {
                throw error;
            }

            // Don't retry if we've exhausted attempts
            if (attempt >= cfg.maxRetries) {
                throw error;
            }

            // Only retry transient errors
            if (!classification.isTransient) {
                throw error;
            }

            // Calculate delay and wait
            const delayMs = calculateDelay(attempt, cfg);

            if (onRetry) {
                onRetry(attempt + 1, classification, delayMs);
            }

            await sleep(delayMs);
        }
    }

    throw lastError;
}

// ============================================================================
// ORPHAN FILE CLEANUP
// ============================================================================

const ORPHAN_AGE_MINUTES = 30; // Files older than this are considered orphans

/**
 * Check if a file is an orphan temp file
 */
export function isOrphanTempFile(filename: string, modifiedTime: Date): boolean {
    // Must be a temp file
    if (!filename.endsWith('.tmp') && !filename.startsWith('.')) {
        return false;
    }

    // Must be old enough
    const ageMs = Date.now() - modifiedTime.getTime();
    const ageMinutes = ageMs / (1000 * 60);

    return ageMinutes > ORPHAN_AGE_MINUTES;
}

/**
 * Check if a lock file is orphaned (expired)
 */
export function isOrphanLockFile(
    filename: string,
    modifiedTime: Date,
    lockTTLMs: number = 30000
): boolean {
    if (!filename.endsWith('.lock')) {
        return false;
    }

    const ageMs = Date.now() - modifiedTime.getTime();

    // Lock is orphan if it's older than 2x TTL
    return ageMs > lockTTLMs * 2;
}

/**
 * Patterns for temp/orphan files to clean up
 */
const CLEANUP_PATTERNS = {
    tempFiles: /\.(tmp|temp)$/i,
    lockFiles: /\.lock$/i,
    hiddenTemp: /^\.[^.]+\.(json|tmp)\.tmp$/i, // e.g., .proceso.json.tmp
};

/**
 * Get cleanup candidates from a list of files
 */
export function getCleanupCandidates(
    files: Array<{ name: string; path: string; modifiedTime?: Date }>
): Array<{ path: string; reason: string }> {
    const candidates: Array<{ path: string; reason: string }> = [];

    for (const file of files) {
        const modified = file.modifiedTime || new Date(0);

        if (CLEANUP_PATTERNS.tempFiles.test(file.name)) {
            if (isOrphanTempFile(file.name, modified)) {
                candidates.push({ path: file.path, reason: 'Archivo temporal huérfano' });
            }
        } else if (CLEANUP_PATTERNS.lockFiles.test(file.name)) {
            if (isOrphanLockFile(file.name, modified)) {
                candidates.push({ path: file.path, reason: 'Archivo de bloqueo expirado' });
            }
        } else if (CLEANUP_PATTERNS.hiddenTemp.test(file.name)) {
            if (isOrphanTempFile(file.name, modified)) {
                candidates.push({ path: file.path, reason: 'Archivo de escritura atómica huérfano' });
            }
        }
    }

    return candidates;
}

// ============================================================================
// LOCK HEARTBEAT
// ============================================================================

/**
 * Lock heartbeat manager for long operations
 */
export class LockHeartbeat {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private readonly lockPath: string;
    private readonly updateFn: () => Promise<void>;
    private readonly intervalMs: number;
    private readonly onHeartbeatFailed?: () => void;
    private consecutiveFailures = 0;
    private static readonly MAX_FAILURES = 2;

    constructor(
        lockPath: string,
        updateFn: () => Promise<void>,
        intervalMs: number = 10000,
        onHeartbeatFailed?: () => void,
    ) {
        this.lockPath = lockPath;
        this.updateFn = updateFn;
        this.intervalMs = intervalMs;
        this.onHeartbeatFailed = onHeartbeatFailed;
    }

    start(): void {
        if (this.intervalId) return;

        this.intervalId = setInterval(async () => {
            // Retry up to 2 times per heartbeat tick
            let success = false;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    await this.updateFn();
                    success = true;
                    this.consecutiveFailures = 0;
                    break;
                } catch (err) {
                    if (attempt === 0) {
                        // Wait briefly before retry
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
            }

            if (!success) {
                this.consecutiveFailures++;
                logger.warn('Network', 'LockHeartbeat: consecutive failures', {
                    failures: this.consecutiveFailures,
                    lockPath: this.lockPath,
                });

                if (this.consecutiveFailures >= LockHeartbeat.MAX_FAILURES && this.onHeartbeatFailed) {
                    this.onHeartbeatFailed();
                }
            }
        }, this.intervalMs);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Format file size for display
 */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
}
