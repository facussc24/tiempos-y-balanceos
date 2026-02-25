/**
 * User-Friendly Error Messages
 * 
 * Centralized dictionary that maps technical errors to clear,
 * actionable messages in Spanish for non-technical users.
 * 
 * @module errorMessages
 * @version 1.0.0
 */

export interface FriendlyError {
    title: string;
    message: string;
    suggestion?: string;
    severity: 'error' | 'warning' | 'info';
    retryable: boolean;
}

/**
 * Error patterns and their friendly translations
 */
const ERROR_PATTERNS: Array<{
    patterns: RegExp[];
    error: FriendlyError;
}> = [
        // ==================== FILE SYSTEM ERRORS ====================
        {
            patterns: [
                /ENOENT/i,
                /file not found/i,
                /no such file/i,
                /archivo no encontrado/i
            ],
            error: {
                title: 'Archivo No Encontrado',
                message: 'El archivo que intentas abrir no existe o fue movido.',
                suggestion: 'Verifica la ruta del archivo o selecciónalo nuevamente.',
                severity: 'error',
                retryable: true
            }
        },
        {
            patterns: [
                /EACCES/i,
                /permission denied/i,
                /acceso denegado/i
            ],
            error: {
                title: 'Acceso Denegado',
                message: 'No tienes permiso para acceder a este archivo o carpeta.',
                suggestion: 'Cierra otros programas que puedan estar usando el archivo, o ejecuta la aplicación como administrador.',
                severity: 'error',
                retryable: true
            }
        },
        {
            patterns: [
                /EBUSY/i,
                /resource busy/i,
                /archivo en uso/i,
                /locked by another/i
            ],
            error: {
                title: 'Archivo en Uso',
                message: 'El archivo está siendo usado por otro programa.',
                suggestion: 'Cierra Excel u otros programas que puedan tener el archivo abierto.',
                severity: 'warning',
                retryable: true
            }
        },
        {
            patterns: [
                /ENOSPC/i,
                /no space/i,
                /disk full/i,
                /espacio en disco/i
            ],
            error: {
                title: 'Disco Lleno',
                message: 'No hay espacio suficiente en el disco para completar la operación.',
                suggestion: 'Libera espacio eliminando archivos innecesarios.',
                severity: 'error',
                retryable: false
            }
        },

        // ==================== DATA VALIDATION ERRORS ====================
        {
            patterns: [
                /division by zero/i,
                /divide by zero/i,
                /infinity/i,
                /NaN/i
            ],
            error: {
                title: 'Error de Cálculo',
                message: 'Hay un problema con los datos ingresados que genera un cálculo inválido.',
                suggestion: 'Revisa que la demanda diaria y los turnos estén configurados correctamente.',
                severity: 'error',
                retryable: false
            }
        },
        {
            patterns: [
                /takt.*violation/i,
                /exceeds.*takt/i,
                /sobrecarga/i
            ],
            error: {
                title: 'Violación de Takt Time',
                message: 'Una o más estaciones superan el tiempo máximo permitido.',
                suggestion: 'Agrega operarios a las estaciones sobrecargadas o redistribuye las tareas.',
                severity: 'warning',
                retryable: false
            }
        },
        {
            patterns: [
                /no tasks/i,
                /sin tareas/i,
                /empty.*tasks/i
            ],
            error: {
                title: 'Sin Tareas',
                message: 'No hay tareas cargadas en el estudio.',
                suggestion: 'Ve a la sección "Tareas" para importar videos o crear tareas manualmente.',
                severity: 'info',
                retryable: false
            }
        },

        // ==================== NETWORK ERRORS ====================
        {
            patterns: [
                /network/i,
                /ENETUNREACH/i,
                /ECONNREFUSED/i,
                /fetch failed/i,
                /conexión/i
            ],
            error: {
                title: 'Error de Conexión',
                message: 'No se pudo establecer conexión con el servidor.',
                suggestion: 'Verifica tu conexión a internet y vuelve a intentar.',
                severity: 'error',
                retryable: true
            }
        },
        {
            patterns: [
                /timeout/i,
                /tiempo agotado/i
            ],
            error: {
                title: 'Tiempo Agotado',
                message: 'La operación tardó demasiado y fue cancelada.',
                suggestion: 'Intenta de nuevo. Si el problema persiste, el servidor puede estar sobrecargado.',
                severity: 'warning',
                retryable: true
            }
        },

        // ==================== JSON/PARSING ERRORS ====================
        {
            patterns: [
                /JSON.*parse/i,
                /unexpected token/i,
                /syntax.*error/i,
                /invalid.*json/i
            ],
            error: {
                title: 'Archivo Corrupto',
                message: 'El archivo del proyecto parece estar dañado o incompleto.',
                suggestion: 'Intenta restaurar desde una versión anterior usando el Historial de Revisiones.',
                severity: 'error',
                retryable: false
            }
        },

        // ==================== SESSION/LOCK ERRORS ====================
        {
            patterns: [
                /lock.*conflict/i,
                /already.*locked/i,
                /session.*active/i,
                /bloqueado/i
            ],
            error: {
                title: 'Proyecto Bloqueado',
                message: 'El proyecto está siendo editado en otra sesión.',
                suggestion: 'Cierra la otra instancia o espera a que finalice.',
                severity: 'warning',
                retryable: true
            }
        },

        // ==================== MEMORY ERRORS ====================
        {
            patterns: [
                /out of memory/i,
                /heap/i,
                /allocation failed/i
            ],
            error: {
                title: 'Memoria Insuficiente',
                message: 'La aplicación se quedó sin memoria para completar la operación.',
                suggestion: 'Cierra otras aplicaciones y reinicia el programa.',
                severity: 'error',
                retryable: false
            }
        },

        // ==================== IMPORT ERRORS ====================
        {
            patterns: [
                /import.*failed/i,
                /video.*error/i,
                /formato.*no.*soportado/i
            ],
            error: {
                title: 'Error de Importación',
                message: 'No se pudo importar el archivo.',
                suggestion: 'Verifica que el formato del archivo sea compatible (MP4, AVI, Excel).',
                severity: 'error',
                retryable: true
            }
        }
    ];

/**
 * Default error for unknown errors
 */
const DEFAULT_ERROR: FriendlyError = {
    title: 'Error Inesperado',
    message: 'Ocurrió un error que no pudimos identificar.',
    suggestion: 'Intenta la operación de nuevo. Si el problema persiste, contacta a soporte.',
    severity: 'error',
    retryable: true
};

/**
 * Get a user-friendly error message from a technical error
 * 
 * @param error - The error object, string, or unknown value
 * @returns FriendlyError object with translated message
 */
export function getUserFriendlyError(error: unknown): FriendlyError {
    // Convert error to string for pattern matching
    let errorString = '';

    if (error instanceof Error) {
        errorString = `${error.name}: ${error.message}`;
    } else if (typeof error === 'string') {
        errorString = error;
    } else if (error && typeof error === 'object') {
        errorString = JSON.stringify(error);
    }

    // Search for matching pattern
    for (const { patterns, error: friendlyError } of ERROR_PATTERNS) {
        for (const pattern of patterns) {
            if (pattern.test(errorString)) {
                return friendlyError;
            }
        }
    }

    // Return default if no pattern matched
    return {
        ...DEFAULT_ERROR,
        // Include original error in message for debugging
        message: `${DEFAULT_ERROR.message} (${errorString.slice(0, 100)})`
    };
}

/**
 * Format error for display in UI
 * Returns JSX-ready object
 */
export function formatErrorForToast(error: unknown): {
    title: string;
    description: string;
    type: 'error' | 'warning' | 'info';
} {
    const friendly = getUserFriendlyError(error);

    let description = friendly.message;
    if (friendly.suggestion) {
        description += ` ${friendly.suggestion}`;
    }

    return {
        title: friendly.title,
        description,
        type: friendly.severity
    };
}

/**
 * Wrap an async function with friendly error handling
 * Automatically shows toast on error
 */
export async function withFriendlyError<T>(
    operation: () => Promise<T>,
    toastFn: (title: string, message: string) => void
): Promise<T | null> {
    try {
        return await operation();
    } catch (error) {
        const friendly = getUserFriendlyError(error);
        toastFn(friendly.title, friendly.suggestion
            ? `${friendly.message} ${friendly.suggestion}`
            : friendly.message
        );
        return null;
    }
}

/**
 * Hook-friendly error handler
 * Use this to create a consistent error handler across components
 */
export function createErrorHandler(toastError: (title: string, msg: string) => void) {
    return (error: unknown, context?: string) => {
        const friendly = getUserFriendlyError(error);
        const message = friendly.suggestion
            ? `${friendly.message} ${friendly.suggestion}`
            : friendly.message;

        console.error(`[${context || 'Error'}]`, error);
        toastError(friendly.title, message);

        return friendly;
    };
}
