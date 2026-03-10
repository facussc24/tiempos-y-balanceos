/**
 * SolicitudServerStatus — Compact toolbar status indicator
 *
 * Shows server connection state and pending operations count.
 * Fits inline in the SolicitudToolbar.
 */

import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SolicitudServerStatusProps {
    status: 'connected' | 'disconnected' | 'checking';
    pendingOps: number;
    onRetryPending: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SolicitudServerStatus: React.FC<SolicitudServerStatusProps> = ({
    status,
    pendingOps,
    onRetryPending,
}) => {
    return (
        <div className="flex items-center gap-2 text-xs select-none">
            {/* Connection indicator */}
            {status === 'connected' && (
                <span className="flex items-center gap-1.5 text-green-600">
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <Wifi size={12} />
                    <span className="hidden sm:inline font-medium">Servidor</span>
                </span>
            )}

            {status === 'disconnected' && (
                <span className="flex items-center gap-1.5 text-red-500">
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <WifiOff size={12} />
                    <span className="hidden sm:inline font-medium">Sin conexión</span>
                </span>
            )}

            {status === 'checking' && (
                <span className="flex items-center gap-1.5 text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse flex-shrink-0" />
                    <RefreshCw size={12} className="animate-spin" />
                    <span className="hidden sm:inline font-medium">Verificando...</span>
                </span>
            )}

            {/* Pending operations badge */}
            {pendingOps > 0 && (
                <button
                    type="button"
                    onClick={onRetryPending}
                    className="relative flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold hover:bg-amber-600 transition focus:outline-none focus:ring-2 focus:ring-amber-300"
                    title={`${pendingOps} operacion${pendingOps > 1 ? 'es' : ''} pendiente${pendingOps > 1 ? 's' : ''} — clic para reintentar`}
                    aria-label={`${pendingOps} operaciones pendientes, reintentar`}
                >
                    {pendingOps > 99 ? '99+' : pendingOps}
                </button>
            )}
        </div>
    );
};

export default SolicitudServerStatus;
