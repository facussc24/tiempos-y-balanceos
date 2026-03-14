/**
 * Lock Conflict Modal
 * 
 * Displays when a project is already open in another tab/window.
 * Extracted from App.tsx for consistency with other modals.
 */

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface LockConflictModalProps {
    onCancel: () => void;
    onForceLock: () => void;
}

export function LockConflictModal({ onCancel, onForceLock }: LockConflictModalProps) {
    const modalRef = useFocusTrap(true);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onCancel]);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="presentation" onClick={onCancel}>
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="lock-conflict-modal-title"
                className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-amber-100 text-amber-600 p-2 rounded-lg">
                        <AlertTriangle size={24} />
                    </div>
                    <h3 id="lock-conflict-modal-title" className="text-lg font-bold text-slate-800">Proyecto en Uso</h3>
                </div>

                {/* Message */}
                <p className="text-slate-600 mb-6">
                    Este proyecto está abierto en otra pestaña o ventana.
                    Abrir el mismo proyecto en múltiples lugares puede causar pérdida de datos.
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onForceLock}
                        className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                    >
                        Forzar Apertura
                    </button>
                </div>

                {/* Footer note */}
                <p className="mt-4 text-xs text-slate-400 text-center">
                    Al forzar la apertura, la otra pestaña pasará a modo de solo lectura.
                </p>
            </div>
        </div>
    );
}

export default LockConflictModal;
