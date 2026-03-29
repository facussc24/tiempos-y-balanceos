/**
 * Professional Logger for Tauri Desktop
 * 
 * Provides structured logging with:
 * - Multiple log levels (debug/info/warn/error)
 * - In-memory log buffer with size limits
 * - Log export functionality
 * - Integration with Toast for user-visible errors
 * - Diagnostic report generation (without sensitive data)
 * 
 * @module logger
 */

// Variable global inyectada por Vite en build time
declare const __APP_VERSION__: string;

// ============================================================================
// TYPES
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    category: string;
    message: string;
    details?: Record<string, any>;
    stack?: string;
}

export interface DiagnosticReport {
    generatedAt: string;
    appVersion: string;
    platform: string;
    projectPath: string | null;
    logs: LogEntry[];
    systemInfo: {
        userAgent: string;
        language: string;
        timezone: string;
        screenSize: string;
    };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_LOG_ENTRIES = 500;
const LOG_ROTATION_THRESHOLD = 400; // When to start dropping old entries

// ============================================================================
// LOG STORE
// ============================================================================

class LogStore {
    private entries: LogEntry[] = [];
    private listeners: Set<(entry: LogEntry) => void> = new Set();

    add(entry: LogEntry): void {
        // Rotate if needed
        if (this.entries.length >= MAX_LOG_ENTRIES) {
            this.entries = this.entries.slice(-LOG_ROTATION_THRESHOLD);
        }

        this.entries.push(entry);

        // Notify listeners
        this.listeners.forEach(listener => {
            try {
                listener(entry);
            } catch {
                // Ignore listener errors
            }
        });
    }

    getAll(): LogEntry[] {
        return [...this.entries];
    }

    getRecent(count: number = 50): LogEntry[] {
        return this.entries.slice(-count);
    }

    getByLevel(level: LogLevel): LogEntry[] {
        return this.entries.filter(e => e.level === level);
    }

    getByCategory(category: string): LogEntry[] {
        return this.entries.filter(e => e.category === category);
    }

    clear(): void {
        this.entries = [];
    }

    subscribe(listener: (entry: LogEntry) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    count(): number {
        return this.entries.length;
    }
}

// Singleton instance
const logStore = new LogStore();

// ============================================================================
// LOGGER IMPLEMENTATION
// ============================================================================

const levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

let minLevel: LogLevel = 'info'; // Default minimum level

function formatTimestamp(): string {
    return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
    return levelPriority[level] >= levelPriority[minLevel];
}

function createEntry(
    level: LogLevel,
    category: string,
    message: string,
    details?: Record<string, any>,
    error?: Error
): LogEntry {
    return {
        timestamp: formatTimestamp(),
        level,
        category,
        message,
        details: details ? sanitizeDetails(details) : undefined,
        stack: error?.stack
    };
}

/**
 * Remove sensitive data from log details
 */
function sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['password', 'passphrase', 'secret', 'token', 'apikey', 'api_key'];
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(details)) {
        const lowerKey = key.toLowerCase();

        if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeDetails(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

function log(
    level: LogLevel,
    category: string,
    message: string,
    details?: Record<string, any>,
    error?: Error
): void {
    if (!shouldLog(level)) return;

    const entry = createEntry(level, category, message, details, error);
    logStore.add(entry);

    // Also log to console in development
    const consoleMsg = `[${entry.timestamp}] [${level.toUpperCase()}] [${category}] ${message}`;

    switch (level) {
        case 'debug':
            console.debug(consoleMsg, details || '');
            break;
        case 'info':
            console.info(consoleMsg, details || '');
            break;
        case 'warn':
            console.warn(consoleMsg, details || '');
            break;
        case 'error':
            console.error(consoleMsg, details || '', error || '');
            break;
    }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export const logger = {
    debug: (category: string, message: string, details?: Record<string, any>) =>
        log('debug', category, message, details),

    info: (category: string, message: string, details?: Record<string, any>) =>
        log('info', category, message, details),

    warn: (category: string, message: string, details?: Record<string, any>, error?: Error) =>
        log('warn', category, message, details, error),

    error: (category: string, message: string, details?: Record<string, any>, error?: Error) =>
        log('error', category, message, details, error),

    /**
     * Set minimum log level
     */
    setLevel: (level: LogLevel) => {
        minLevel = level;
    },

    /**
     * Get all log entries
     */
    getAll: () => logStore.getAll(),

    /**
     * Get recent log entries
     */
    getRecent: (count?: number) => logStore.getRecent(count),

    /**
     * Get errors only
     */
    getErrors: () => logStore.getByLevel('error'),

    /**
     * Clear all logs
     */
    clear: () => logStore.clear(),

    /**
     * Subscribe to new log entries
     */
    subscribe: (listener: (entry: LogEntry) => void) => logStore.subscribe(listener),

    /**
     * Get log count
     */
    count: () => logStore.count()
};

// ============================================================================
// DIAGNOSTIC EXPORT
// ============================================================================

/**
 * Generate a diagnostic report (sanitized, no sensitive data)
 */
function generateDiagnosticReport(projectPath?: string | null): DiagnosticReport {
    return {
        generatedAt: new Date().toISOString(),
        appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '5.0.0',
        platform: navigator.platform || 'unknown',
        projectPath: projectPath ? redactPath(projectPath) : null,
        logs: logStore.getAll(),
        systemInfo: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screenSize: `${window.screen.width}x${window.screen.height}`
        }
    };
}

/**
 * Redact sensitive parts of a path
 * Keeps structure but removes user-identifying folder names
 */
function redactPath(path: string): string {
    // Replace user folder names with [USER]
    return path
        .replace(/\\Users\\[^\\]+/gi, '\\Users\\[USER]')
        .replace(/\/Users\/[^/]+/gi, '/Users/[USER]')
        .replace(/C:\\Users\\[^\\]+/gi, 'C:\\Users\\[USER]');
}

/**
 * Export diagnostic report as JSON string
 */
export function exportDiagnosticJSON(projectPath?: string | null): string {
    const report = generateDiagnosticReport(projectPath);
    return JSON.stringify(report, null, 2);
}

/**
 * Format logs for display
 */
function formatLogsForDisplay(entries: LogEntry[]): string {
    return entries
        .map(e => {
            let line = `[${e.timestamp}] [${e.level.toUpperCase()}] [${e.category}] ${e.message}`;
            if (e.details) {
                line += `\n  Details: ${JSON.stringify(e.details)}`;
            }
            if (e.stack) {
                line += `\n  Stack: ${e.stack.split('\n').slice(0, 3).join('\n    ')}`;
            }
            return line;
        })
        .join('\n\n');
}

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Log an error and return a formatted user message
 */
function logErrorForUser(
    category: string,
    error: unknown,
    context?: Record<string, any>
): { message: string; details: string } {
    const err = error instanceof Error ? error : new Error(String(error));

    logger.error(category, err.message, context, err);

    return {
        message: err.message,
        details: formatLogsForDisplay(logStore.getRecent(10))
    };
}

export default logger;
