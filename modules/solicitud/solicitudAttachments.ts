/**
 * Solicitud Attachments
 *
 * Handles file selection and attachment metadata management.
 * In web/browser mode, file selection uses a hidden <input type="file"> element.
 * Server-side upload and filesystem operations are not available in web mode.
 *
 * @module solicitudAttachments
 */

import { logger } from '../../utils/logger';
import { getFilename } from '../../utils/networkUtils';
import type { SolicitudAttachment } from './solicitudTypes';
import { BLOCKED_ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_SIZE_BYTES } from './solicitudTypes';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_CAT = 'SolicitudAttachments';

// ============================================================================
// TYPES
// ============================================================================

export interface AttachmentUploadResult {
    success: boolean;
    attachment?: SolicitudAttachment;
    error?: string;
}

export interface AttachmentValidation {
    valid: boolean;
    error?: string;
}

// ============================================================================
// FILE SELECTION
// ============================================================================

/**
 * Open a file picker for attachment selection using a hidden file input.
 * Returns an array of file names (pseudo-paths in browser mode).
 */
export async function selectAttachmentFiles(): Promise<string[]> {
    return selectViaBrowser();
}

/**
 * Browser file selection via a hidden file input element.
 * Returns File.name as pseudo-paths (caller must handle accordingly).
 */
function selectViaBrowser(): Promise<string[]> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.style.display = 'none';

        input.addEventListener('change', () => {
            const files = input.files;
            if (!files || files.length === 0) {
                resolve([]);
            } else {
                const paths: string[] = [];
                for (let i = 0; i < files.length; i++) {
                    paths.push(files[i].name);
                }
                resolve(paths);
            }
            // Cleanup
            document.body.removeChild(input);
        });

        // Handle cancel (user closes dialog without selecting)
        input.addEventListener('cancel', () => {
            resolve([]);
            document.body.removeChild(input);
        });

        document.body.appendChild(input);
        input.click();
    });
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Extract the file extension from a path (lowercase, without dot).
 */
function getExtension(filePath: string): string {
    const name = getFilename(filePath);
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex < 0 || dotIndex === name.length - 1) return '';
    return name.substring(dotIndex + 1).toLowerCase();
}

/**
 * Validate an attachment file before upload.
 *
 * Checks:
 * 1. Extension is not in the blocked list (executables, scripts, etc.)
 * 2. File size does not exceed MAX_ATTACHMENT_SIZE_BYTES (50 MB)
 */
export function validateAttachment(filePath: string, fileSize: number): AttachmentValidation {
    // Check blocked extensions
    const ext = getExtension(filePath);
    if (ext && (BLOCKED_ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext)) {
        return {
            valid: false,
            error: `Tipo de archivo no permitido: .${ext}. Archivos ejecutables y scripts estan bloqueados por seguridad.`,
        };
    }

    // Check file size
    if (fileSize > MAX_ATTACHMENT_SIZE_BYTES) {
        const maxMB = Math.round(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024));
        const fileMB = (fileSize / (1024 * 1024)).toFixed(1);
        return {
            valid: false,
            error: `El archivo excede el tamano maximo permitido (${fileMB} MB > ${maxMB} MB).`,
        };
    }

    // Check for empty files
    if (fileSize === 0) {
        return {
            valid: false,
            error: 'El archivo esta vacio (0 bytes).',
        };
    }

    return { valid: true };
}

// ============================================================================
// UPLOAD (web-safe stub)
// ============================================================================

/**
 * Upload a single attachment to the server adjuntos directory.
 *
 * Not available in web mode — server filesystem access requires the Tauri runtime.
 * Returns an error result indicating the operation is not supported.
 *
 * TODO: Implement via backend API
 */
export async function uploadAttachment(
    sourcePath: string,
    _adjuntosDir: string,
    _uploadedBy: string
): Promise<AttachmentUploadResult> {
    logger.warn(LOG_CAT, 'uploadAttachment: not supported in web mode', { sourcePath });
    return {
        success: false,
        error: 'La carga de archivos al servidor no esta disponible en modo web.',
    };
}

// ============================================================================
// LISTING (web-safe stub)
// ============================================================================

/**
 * List all attachment files present in the server adjuntos directory.
 *
 * Not available in web mode — server filesystem access requires the Tauri runtime.
 *
 * TODO: Implement via backend API
 */
export async function listServerAttachments(_adjuntosDir: string): Promise<SolicitudAttachment[]> {
    logger.debug(LOG_CAT, 'listServerAttachments: not supported in web mode');
    return [];
}

// ============================================================================
// DELETION (web-safe stub)
// ============================================================================

/**
 * Delete a single attachment file from the server adjuntos directory.
 *
 * Not available in web mode — server filesystem access requires the Tauri runtime.
 *
 * TODO: Implement via backend API
 */
export async function deleteServerAttachment(
    _adjuntosDir: string,
    fileName: string
): Promise<boolean> {
    logger.warn(LOG_CAT, 'deleteServerAttachment: not supported in web mode', { fileName });
    return false;
}

// ============================================================================
// OPEN FILE (web-safe stub)
// ============================================================================

/**
 * Open an attachment file with the system default application.
 *
 * Not available in web mode — opening local server paths requires the Tauri runtime.
 *
 * TODO: Implement via backend API or signed download URL
 */
export async function openAttachmentFile(filePath: string): Promise<void> {
    logger.warn(LOG_CAT, 'openAttachmentFile: not supported in web mode', { filePath });
    throw new Error('La apertura de archivos del servidor solo esta disponible en la aplicacion de escritorio.');
}
