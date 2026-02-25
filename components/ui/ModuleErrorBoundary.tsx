/**
 * Module Error Boundary Component
 * 
 * Provides isolated error handling for individual modules to prevent
 * errors in one module from crashing the entire application.
 * 
 * @module ModuleErrorBoundary
 * @version 1.0.0 - MEJORA-02: Error Boundaries by module
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logger } from '../../utils/logger';

interface Props {
    /** Name of the module being wrapped (for error reporting) */
    moduleName: string;
    /** Child components to render */
    children: ReactNode;
    /** Optional custom fallback UI */
    fallback?: ReactNode;
    /** Optional callback to navigate home */
    onNavigateHome?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary that catches errors in child components and displays
 * a user-friendly error message with recovery options.
 * 
 * @example
 * ```tsx
 * <ModuleErrorBoundary moduleName="VSM" onNavigateHome={() => setView('dashboard')}>
 *   <VSMModule data={data} updateData={updateData} />
 * </ModuleErrorBoundary>
 * ```
 */
export class ModuleErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log the error with module context
        logger.error('ModuleErrorBoundary', `Error in ${this.props.moduleName}`, {
            errorMessage: error.message,
            componentStack: errorInfo.componentStack
        }, error);

        this.setState({ errorInfo });
    }

    handleRetry = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    handleNavigateHome = (): void => {
        if (this.props.onNavigateHome) {
            this.setState({
                hasError: false,
                error: null,
                errorInfo: null
            });
            this.props.onNavigateHome();
        }
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-[400px] flex items-center justify-center p-8">
                    <div className="bg-white rounded-xl border border-red-200 shadow-lg max-w-md w-full p-6 text-center">
                        {/* Error Icon */}
                        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">
                            Error en {this.props.moduleName}
                        </h3>

                        {/* Message */}
                        <p className="text-sm text-slate-600 mb-4">
                            Ocurrió un error inesperado. Puedes intentar nuevamente o volver al inicio.
                        </p>

                        {/* Error Details (collapsed) */}
                        {this.state.error && (
                            <details className="text-left mb-4 bg-slate-50 rounded-lg p-3">
                                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                                    Ver detalles técnicos
                                </summary>
                                <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-32 p-2 bg-red-50 rounded">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reintentar
                            </button>

                            {this.props.onNavigateHome && (
                                <button
                                    onClick={this.handleNavigateHome}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                                >
                                    <Home className="w-4 h-4" />
                                    Ir al Inicio
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ModuleErrorBoundary;
