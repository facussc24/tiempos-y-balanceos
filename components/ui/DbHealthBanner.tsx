/**
 * DbHealthBanner — aviso global cuando una lectura a la base de datos falla.
 *
 * Complementa el cambio de SupabaseAdapter.select() (lanza en vez de devolver
 * []): aunque el modulo que hizo la lectura solo la registre en el logger,
 * este banner garantiza que el usuario SE ENTERE de que lo que ve puede estar
 * incompleto. Desaparece solo cuando una lectura vuelve a andar.
 */
import React, { useSyncExternalStore, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { subscribeDbHealth, getDbHealth } from '../../utils/dbHealth';

export const DbHealthBanner: React.FC = () => {
    const health = useSyncExternalStore(subscribeDbHealth, getDbHealth);
    // Timestamp del error que el usuario descarto: solo tapa ESE error puntual.
    // Un error nuevo trae otro `at` (Date.now()) y el banner reaparece solo.
    const [dismissedAt, setDismissedAt] = useState<number | null>(null);

    if (health.lastReadError === null || health.at === dismissedAt) return null;

    return (
        <div
            role="alert"
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] max-w-xl w-[calc(100%-2rem)]
                       flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 shadow-lg"
        >
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800">
                    No se pudo leer la base de datos
                </p>
                <p className="text-xs text-red-700 mt-0.5">
                    Lo que se muestra en pantalla puede estar incompleto. No guardes cambios
                    importantes hasta recargar. Detalle: {health.lastReadError}
                </p>
            </div>
            <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-1 flex-shrink-0 rounded-md bg-red-600 hover:bg-red-700
                           text-white text-xs font-medium px-2.5 py-1.5 transition-colors"
            >
                <RefreshCw size={13} />
                Recargar
            </button>
            <button
                onClick={() => setDismissedAt(health.at)}
                aria-label="Descartar aviso"
                className="flex-shrink-0 text-red-400 hover:text-red-700 transition-colors p-0.5"
            >
                <X size={16} />
            </button>
        </div>
    );
};
