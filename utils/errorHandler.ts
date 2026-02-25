/**
 * Centralized Error Handling System
 * Provides consistent error handling, logging, and user-friendly messages
 */

export enum ErrorSeverity {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    CRITICAL = 'critical'
}

export interface ErrorContext {
    component?: string;
    action?: string;
    userId?: string;
    timestamp?: number;
    metadata?: Record<string, any>;
}

export class AppError extends Error {
    constructor(
        message: string,
        public code: string,
        public severity: ErrorSeverity = ErrorSeverity.ERROR,
        public context?: ErrorContext,
        public originalError?: Error
    ) {
        super(message);
        this.name = 'AppError';

        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }
}

/**
 * Centralized Error Handler
 */
export class ErrorHandler {
    private static isDevelopment = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;
    private static errorLog: AppError[] = [];
    private static maxLogSize = 100;

    /**
     * Handle an error with appropriate logging and user feedback
     */
    static handle(
        error: Error | AppError,
        context?: ErrorContext
    ): string {
        const appError = error instanceof AppError
            ? error
            : this.wrapError(error, context);

        // Log the error
        this.logError(appError);

        // In development, show detailed errors
        if (this.isDevelopment) {
            console.error('[ErrorHandler]', {
                message: appError.message,
                code: appError.code,
                severity: appError.severity,
                context: appError.context,
                stack: appError.stack,
                originalError: appError.originalError
            });
        }

        // Return user-friendly message
        return this.getUserMessage(appError);
    }

    /**
     * Wrap a generic error into AppError
     */
    private static wrapError(error: Error, context?: ErrorContext): AppError {
        // Try to determine error type
        const code = this.getErrorCode(error);
        const severity = this.getErrorSeverity(error);

        return new AppError(
            error.message,
            code,
            severity,
            {
                ...context,
                timestamp: Date.now()
            },
            error
        );
    }

    /**
     * Get error code from error type
     */
    private static getErrorCode(error: Error): string {
        // Map common error names to codes
        const errorCodeMap: Record<string, string> = {
            'TypeError': 'TYPE_ERROR',
            'ReferenceError': 'REFERENCE_ERROR',
            'SyntaxError': 'SYNTAX_ERROR',
            'QuotaExceededError': 'STORAGE_QUOTA_EXCEEDED',
            'NotAllowedError': 'PERMISSION_DENIED',
            'SecurityError': 'SECURITY_ERROR',
            'NetworkError': 'NETWORK_ERROR',
            'AbortError': 'OPERATION_ABORTED'
        };

        return errorCodeMap[error.name] || 'UNKNOWN_ERROR';
    }

    /**
     * Determine error severity
     */
    private static getErrorSeverity(error: Error): ErrorSeverity {
        const criticalErrors = ['QuotaExceededError', 'SecurityError'];
        const warningErrors = ['AbortError', 'NotAllowedError'];

        if (criticalErrors.includes(error.name)) {
            return ErrorSeverity.CRITICAL;
        }
        if (warningErrors.includes(error.name)) {
            return ErrorSeverity.WARNING;
        }
        return ErrorSeverity.ERROR;
    }

    /**
     * Log error to internal log
     */
    private static logError(error: AppError): void {
        this.errorLog.push(error);

        // Maintain log size
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        // In production, send to telemetry service
        if (!this.isDevelopment) {
            this.sendToTelemetry(error);
        }
    }

    /**
     * Send error to telemetry service (placeholder)
     */
    private static sendToTelemetry(error: AppError): void {
        // TODO: Implement actual telemetry service integration
        // For now, just log to console in a structured format
        if (error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.ERROR) {
            console.error('[Telemetry]', {
                code: error.code,
                message: error.message,
                severity: error.severity,
                context: error.context,
                timestamp: error.context?.timestamp || Date.now()
            });
        }
    }

    /**
     * Get user-friendly error message
     */
    private static getUserMessage(error: AppError): string {
        // Map error codes to user-friendly messages
        const messageMap: Record<string, string> = {
            'STORAGE_QUOTA_EXCEEDED': 'Espacio de almacenamiento insuficiente. Por favor, libere espacio y vuelva a intentar.',
            'PERMISSION_DENIED': 'Permiso denegado. Por favor, otorgue los permisos necesarios.',
            'SECURITY_ERROR': 'Error de seguridad. La operación no está permitida.',
            'NETWORK_ERROR': 'Error de red. Por favor, verifique su conexión a internet.',
            'OPERATION_ABORTED': 'Operación cancelada.',
            'TYPE_ERROR': 'Error en el formato de datos.',
            'REFERENCE_ERROR': 'Error de referencia en la aplicación.',
            'SYNTAX_ERROR': 'Error de sintaxis en los datos.',
            'FILE_NOT_FOUND': 'Archivo no encontrado.',
            'INVALID_INPUT': 'Entrada inválida. Por favor, verifique los datos ingresados.',
            'VALIDATION_ERROR': 'Error de validación. Por favor, corrija los errores indicados.',
            'UNKNOWN_ERROR': 'Ha ocurrido un error inesperado.'
        };

        const baseMessage = messageMap[error.code] || messageMap['UNKNOWN_ERROR'];

        // In development, append error code
        if (this.isDevelopment) {
            return `${baseMessage} (Código: ${error.code})`;
        }

        return baseMessage;
    }

    /**
     * Get error log (for debugging)
     */
    static getErrorLog(): AppError[] {
        return [...this.errorLog];
    }

    /**
     * Clear error log
     */
    static clearErrorLog(): void {
        this.errorLog = [];
    }

    /**
     * Create a validation error
     */
    static validationError(message: string, context?: ErrorContext): AppError {
        return new AppError(
            message,
            'VALIDATION_ERROR',
            ErrorSeverity.WARNING,
            context
        );
    }

    /**
     * Create a file system error
     */
    static fileSystemError(message: string, context?: ErrorContext): AppError {
        return new AppError(
            message,
            'FILE_SYSTEM_ERROR',
            ErrorSeverity.ERROR,
            context
        );
    }

    /**
     * Create a network error
     */
    static networkError(message: string, context?: ErrorContext): AppError {
        return new AppError(
            message,
            'NETWORK_ERROR',
            ErrorSeverity.ERROR,
            context
        );
    }
}

/**
 * Safe async wrapper that handles errors
 */
export async function safeAsync<T>(
    fn: () => Promise<T>,
    context?: ErrorContext
): Promise<[T | null, AppError | null]> {
    try {
        const result = await fn();
        return [result, null];
    } catch (error) {
        const appError = error instanceof AppError
            ? error
            : new AppError(
                (error as Error).message,
                'ASYNC_ERROR',
                ErrorSeverity.ERROR,
                context,
                error as Error
            );

        ErrorHandler.handle(appError);
        return [null, appError];
    }
}

/**
 * Safe sync wrapper that handles errors
 */
export function safeSync<T>(
    fn: () => T,
    context?: ErrorContext
): [T | null, AppError | null] {
    try {
        const result = fn();
        return [result, null];
    } catch (error) {
        const appError = error instanceof AppError
            ? error
            : new AppError(
                (error as Error).message,
                'SYNC_ERROR',
                ErrorSeverity.ERROR,
                context,
                error as Error
            );

        ErrorHandler.handle(appError);
        return [null, appError];
    }
}
