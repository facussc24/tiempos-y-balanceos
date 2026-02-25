/**
 * Conflict Resolution Modal
 * 
 * Displays save conflict details and provides actionable resolution options.
 * Used when ConflictError is thrown during save operations.
 */

import { useState } from 'react';
import { AlertTriangle, RefreshCw, FilePlus, X, Clock, User, Hash } from 'lucide-react';
import { SaveConflict } from '../../utils/concurrency';

interface ConflictModalProps {
    conflict: SaveConflict;
    onReload: () => void;
    onSaveAsNew: () => void;
    onCancel: () => void;
}

export function ConflictModal({ conflict, onReload, onSaveAsNew, onCancel }: ConflictModalProps) {
    const [isLoading, setIsLoading] = useState(false);

    const formatTimestamp = (ts: number) => {
        return new Date(ts).toLocaleString('es-AR', {
            dateStyle: 'short',
            timeStyle: 'medium'
        });
    };

    const handleAction = async (action: () => void) => {
        setIsLoading(true);
        try {
            await action();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center gap-3 p-6 border-b border-slate-200">
                    <div className="bg-amber-100 text-amber-600 p-3 rounded-lg">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Conflicto de Versión</h2>
                        <p className="text-sm text-slate-500">El archivo fue modificado por otro usuario</p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="ml-auto text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Conflict Details */}
                <div className="p-6 space-y-4">
                    <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Detalles del Conflicto</h3>

                        {conflict.diskTimestamp && (
                            <div className="flex items-center gap-3 text-sm">
                                <Clock size={16} className="text-slate-400" />
                                <span className="text-slate-600">Modificado en disco:</span>
                                <span className="font-mono text-slate-800">{formatTimestamp(conflict.diskTimestamp)}</span>
                            </div>
                        )}

                        {conflict.diskVersion && (
                            <div className="flex items-center gap-3 text-sm">
                                <Hash size={16} className="text-slate-400" />
                                <span className="text-slate-600">Versión en disco:</span>
                                <span className="font-mono text-slate-800">{conflict.diskVersion}</span>
                            </div>
                        )}

                        {conflict.diskChecksum && (
                            <div className="flex items-center gap-3 text-sm">
                                <Hash size={16} className="text-slate-400" />
                                <span className="text-slate-600">Checksum:</span>
                                <span className="font-mono text-xs text-slate-500">{conflict.diskChecksum.substring(0, 16)}...</span>
                            </div>
                        )}

                        {conflict.localChecksum && conflict.diskChecksum && conflict.localChecksum !== conflict.diskChecksum && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                Los checksums no coinciden. Hay cambios no guardados que se perderán si recarga.
                            </div>
                        )}
                    </div>

                    <p className="text-sm text-slate-600">
                        Tu versión local tiene cambios que podrían perderse. ¿Cómo deseas proceder?
                    </p>
                </div>

                {/* Actions */}
                <div className="p-6 bg-slate-50 rounded-b-xl space-y-3">
                    <button
                        onClick={() => handleAction(onReload)}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                        Recargar (Perder cambios locales)
                    </button>

                    <button
                        onClick={() => handleAction(onSaveAsNew)}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                        <FilePlus size={18} />
                        Guardar como Nueva Revisión
                    </button>

                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        <X size={18} />
                        Cancelar (Mantener cambios locales)
                    </button>

                    <p className="text-xs text-slate-500 text-center mt-2">
                        Si cancelas, tus cambios permanecen en memoria pero no se guardan.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ConflictModal;
