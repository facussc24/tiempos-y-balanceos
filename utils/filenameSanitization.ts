/**
 * Filename sanitization utilities for secure file operations
 */

// Windows reserved filenames
const RESERVED_NAMES = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
];

const MAX_FILENAME_LENGTH = 200; // Leave margin for timestamps and extensions

/**
 * Sanitizes a filename to be safe for Windows/Linux/Mac filesystems
 * @param filename - The filename to sanitize
 * @param options - Configuration options
 * @returns Safe filename
 */
export const sanitizeFilename = (
    filename: string,
    options: {
        replacement?: string;
        maxLength?: number;
        allowSpaces?: boolean;
    } = {}
): string => {
    const {
        replacement = '_',
        maxLength = MAX_FILENAME_LENGTH,
        allowSpaces = true
    } = options;

    if (!filename || filename.trim() === '') {
        return 'unnamed_file';
    }

    let clean = filename.trim();

    // Remove path separators to prevent directory traversal
    clean = clean.replace(/[/\\]/g, replacement);

    // Remove or replace forbidden characters
    // Windows: < > : " / \ | ? *
    // Also remove control characters (0x00-0x1F) — intencional en sanitizacion.
    // eslint-disable-next-line no-control-regex
    clean = clean.replace(/[<>:"|?*\x00-\x1f]/g, replacement);

    // Optionally replace spaces
    if (!allowSpaces) {
        clean = clean.replace(/\s+/g, replacement);
    }

    // Normalize Unicode (decompose then remove combining marks)
    clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Remove leading/trailing dots and spaces (Windows doesn't allow these)
    clean = clean.replace(/^[\s.]+|[\s.]+$/g, '');

    // Limit length
    if (clean.length > maxLength) {
        // Try to preserve extension
        const lastDot = clean.lastIndexOf('.');
        if (lastDot > 0 && lastDot > maxLength - 10) {
            const ext = clean.substring(lastDot);
            const base = clean.substring(0, maxLength - ext.length);
            clean = base + ext;
        } else {
            clean = clean.substring(0, maxLength);
        }
    }

    // Check for reserved names (Windows)
    const baseName = clean.split('.')[0].toUpperCase();
    if (RESERVED_NAMES.includes(baseName)) {
        clean = replacement + clean;
    }

    // Final safety check
    // If empty, or just replacement, or ONLY replacements (e.g. "______")
    const isOnlyReplacements = clean.split('').every(c => c === replacement);
    if (!clean || clean === replacement || isOnlyReplacements) {
        clean = 'unnamed_file';
    }

    return clean;
};

/**
 * Validates if a filename is safe
 * @param filename - Filename to validate
 * @returns true if safe, false otherwise
 */
export const isValidFilename = (filename: string): boolean => {
    if (!filename || filename.trim() === '') return false;

    // Check for path separators
    if (/[/\\]/.test(filename)) return false;

    // Check for forbidden characters (control chars intencional en sanitizacion)
    // eslint-disable-next-line no-control-regex
    if (/[<>:"|?*\x00-\x1f]/.test(filename)) return false;

    // Check for reserved names
    const baseName = filename.split('.')[0].toUpperCase();
    if (RESERVED_NAMES.includes(baseName)) return false;

    // Check length
    if (filename.length > MAX_FILENAME_LENGTH) return false;

    // Check for leading/trailing dots or spaces
    if (/^[\s.]|[\s.]$/.test(filename)) return false;

    return true;
};

/**
 * Generates a unique filename by appending a counter if file exists
 * @param baseFilename - Base filename
 * @param existingFiles - Array of existing filenames
 * @returns Unique filename
 */
export const makeUniqueFilename = (
    baseFilename: string,
    existingFiles: string[]
): string => {
    const sanitized = sanitizeFilename(baseFilename);

    if (!existingFiles.includes(sanitized)) {
        return sanitized;
    }

    const lastDot = sanitized.lastIndexOf('.');
    const name = lastDot > 0 ? sanitized.substring(0, lastDot) : sanitized;
    const ext = lastDot > 0 ? sanitized.substring(lastDot) : '';

    let counter = 1;
    let uniqueName = `${name}_${counter}${ext}`;

    while (existingFiles.includes(uniqueName) && counter < 1000) {
        counter++;
        uniqueName = `${name}_${counter}${ext}`;
    }

    return uniqueName;
};

/**
 * Sanitizes a directory path
 * @param path - Path to sanitize
 * @returns Sanitized path
 */
export const sanitizePath = (path: string): string => {
    if (!path) return '';

    // Split by path separator
    const parts = path.split(new RegExp('[\\\\/]'));

    // Sanitize each part
    const sanitizedParts = parts
        .filter(part => part && part !== '.' && part !== '..')
        .map(part => sanitizeFilename(part, { allowSpaces: false }));

    return sanitizedParts.join('/');
};
