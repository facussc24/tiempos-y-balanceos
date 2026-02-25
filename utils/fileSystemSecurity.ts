/**
 * File System Security Utilities
 * Validates directory access and prevents access to system directories
 * 
 * NOTE: The File System Access API only exposes folder NAME (not full path)
 * for security reasons. All validation is based on folder names only.
 */

/**
 * Forbidden folder names - these should not be used as working directories.
 * Includes Windows, Unix/Mac system folders.
 */
const FORBIDDEN_FOLDER_NAMES = [
    // Windows system folders
    'windows',
    'system32',
    'syswow64',
    'program files',
    'program files (x86)',
    'programdata',
    'boot',
    'recovery',
    '$recycle.bin',
    'system volume information',
    // Unix/Mac system folders
    'bin',
    'sbin',
    'etc',
    'var',
    'tmp',
    'dev',
    'proc',
    'sys',
    'root',
    'lib',
    'lib64',
    'opt',
    'usr'
];

/**
 * Check if a folder name is a known system/dangerous folder
 * @param folderName - The folder name to check (not full path)
 * @returns true if the folder name matches a forbidden system folder
 */
export function isForbiddenFolderName(folderName: string): boolean {
    if (!folderName) return false;

    const normalizedName = folderName.toLowerCase().trim();

    // Exact match against forbidden names
    return FORBIDDEN_FOLDER_NAMES.includes(normalizedName);
}

/**
 * Validate directory handle for safety
 * @param handle - Directory handle to validate
 * @returns Object with validation result and message
 */
export async function validateDirectoryHandle(
    handle: FileSystemDirectoryHandle
): Promise<{ valid: boolean; message?: string }> {
    try {
        const folderName = handle.name || '';

        // Check if folder name is forbidden
        if (isForbiddenFolderName(folderName)) {
            return {
                valid: false,
                message:
                    '⚠️ Carpeta del Sistema No Permitida\n\n' +
                    `No se puede usar "${folderName}" por razones de seguridad.\n\n` +
                    '✅ Creá una carpeta específica y seleccioná esa:\n\n' +
                    'Ejemplos recomendados:\n' +
                    '• C:\\BarackProyectos\n' +
                    '• C:\\Usuarios\\TuNombre\\Documentos\\BarackMercosul\n' +
                    '• Z:\\Ingeniería\\Barack\n' +
                    '• D:\\Proyectos\\\n\n' +
                    'TIP: Podés crear la carpeta desde el Explorador de Windows.'
            };
        }

        return { valid: true };
    } catch (error) {
        // Log technical error (no sensitive data)
        console.warn('[Security] Directory validation error:', error instanceof Error ? error.name : 'Unknown');
        return {
            valid: false,
            message: '❌ Error al validar el directorio. Intente con otra ubicación.'
        };
    }
}

/**
 * Confirm destructive operation with user
 * @param operation - Description of the operation
 * @param details - Additional details
 * @returns true if user confirms
 */
export function confirmDestructiveOperation(
    operation: string,
    details?: string
): boolean {
    const message = details
        ? `⚠️ OPERACIÓN DESTRUCTIVA\n\n${operation}\n\n${details}\n\n¿Está seguro de que desea continuar?\n\nEsta acción NO se puede deshacer.`
        : `⚠️ OPERACIÓN DESTRUCTIVA\n\n${operation}\n\n¿Está seguro?\n\nEsta acción NO se puede deshacer.`;

    return confirm(message);
}

/**
 * Validate file operation safety
 * @param operation - Type of operation (delete, overwrite, etc.)
 * @param fileName - Name of file
 * @returns true if operation should proceed
 */
export function validateFileOperation(
    operation: 'delete' | 'overwrite' | 'move',
    fileName: string
): boolean {
    const messages = {
        delete: `Eliminar archivo: "${fileName}"`,
        overwrite: `Sobrescribir archivo: "${fileName}"`,
        move: `Mover archivo: "${fileName}" a carpeta Obsoletos`
    };

    return confirmDestructiveOperation(
        messages[operation],
        operation === 'delete'
            ? 'El archivo será eliminado permanentemente del disco.'
            : undefined
    );
}
