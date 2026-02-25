import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../../../utils/logger';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class CalculationErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logger.error('CavityCalculator', 'Uncaught error in Calculation', { componentStack: errorInfo?.componentStack }, error instanceof Error ? error : undefined);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
        // Optional: Trigger a state reset if possible, but simplest is just re-render children
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 bg-red-50 border border-red-200 rounded-xl flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                    <div className="bg-red-100 p-3 rounded-full mb-4">
                        <AlertTriangle className="text-red-600 w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-red-800 mb-2">Error de Cálculo</h3>
                    <p className="text-red-600 mb-6 max-w-sm text-sm">
                        Ocurrió un algo inesperado al procesar los datos.<br />
                        <span className="opacity-75 italic text-xs mt-1 block font-mono bg-red-100/50 p-1 rounded">
                            {this.state.error?.message || "Error desconocido"}
                        </span>
                    </p>
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors text-sm"
                    >
                        <RefreshCw size={16} /> Reintentar
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
