import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../../utils/logger';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logger.error('GlobalErrorBoundary', 'Uncaught application error', { componentStack: errorInfo?.componentStack }, error);
        this.setState({
            error,
            errorInfo
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8 border-2 border-red-100">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-red-100 p-3 rounded-full">
                                <AlertTriangle className="text-red-600" size={32} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-red-900">Error Crítico de Aplicación</h1>
                                <p className="text-red-600 text-sm mt-1">La aplicación encontró un error inesperado</p>
                            </div>
                        </div>

                        {this.state.error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                                <h3 className="font-bold text-red-800 mb-2">Detalles del Error:</h3>
                                <p className="text-red-700 text-sm font-mono">{this.state.error.toString()}</p>
                            </div>
                        )}

                        {this.state.errorInfo && (
                            <details className="mb-6">
                                <summary className="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-800">
                                    Ver Stack Trace (Información Técnica)
                                </summary>
                                <pre className="mt-2 text-xs bg-slate-100 p-3 rounded overflow-auto max-h-64 text-slate-700">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-all"
                            >
                                <RefreshCw size={18} />
                                Intentar Recuperar
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-lg font-medium transition-all"
                            >
                                Recargar Página
                            </button>
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs text-blue-800">
                                <strong>Sugerencia:</strong> Si el error persiste, intente:
                            </p>
                            <ul className="text-xs text-blue-700 mt-2 ml-4 list-disc space-y-1">
                                <li>Guardar su trabajo y recargar la página</li>
                                <li>Verificar que todos los datos estén completos</li>
                                <li>Contactar al soporte técnico con el error mostrado arriba</li>
                            </ul>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
