/**
 * SuggestToMasterModal - Modal para sugerir un hallazgo de variante al maestro
 *
 * Permite al usuario enviar una propuesta de adicion desde un AMFE variante
 * hacia el documento maestro de la familia, con nota justificativa.
 *
 * @module SuggestToMasterModal
 */
import React, { useState, useEffect } from 'react';
import { X, ArrowUpCircle, Loader2 } from 'lucide-react';
import { createProposal } from '../../utils/repositories/familyDocumentRepository';
import toast from '../../components/ui/Toast';

interface SuggestToMasterModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** The item being suggested (operation, failure, cause, etc.) */
    itemDescription: string;
    itemType: string; // 'operation' | 'failure' | 'cause' etc.
    itemId: string;
    itemData: string; // JSON serialized item
    /** Family context */
    familyId: number;
    masterDocId: string;
    variantFamilyDocId: number;
}

export const SuggestToMasterModal: React.FC<SuggestToMasterModalProps> = ({
    isOpen,
    onClose,
    itemDescription,
    itemType,
    itemId,
    itemData,
    familyId,
    masterDocId,
    variantFamilyDocId,
}) => {
    const [nota, setNota] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setNota('');
            setSubmitting(false);
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !submitting) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, submitting, onClose]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await createProposal({
                familyId,
                module: 'amfe',
                masterDocId,
                targetFamilyDocId: variantFamilyDocId,
                changeType: 'suggested_addition',
                itemType,
                itemId,
                newData: itemData,
                oldData: nota || undefined,
            });
            toast.success('Sugerencia enviada al maestro');
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            toast.error(`Error al enviar sugerencia: ${message}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40"
                onClick={!submitting ? onClose : undefined}
            />

            {/* Modal card */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="suggest-master-title"
                className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    disabled={submitting}
                    className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Cerrar"
                    aria-label="Cerrar"
                >
                    <X size={20} />
                </button>

                <div className="p-6">
                    {/* Icon */}
                    <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ArrowUpCircle size={28} className="text-blue-600" />
                    </div>

                    {/* Title */}
                    <h2
                        id="suggest-master-title"
                        className="text-xl font-bold text-slate-800 text-center mb-2"
                    >
                        Sugerir al maestro
                    </h2>

                    <p className="text-sm text-slate-500 text-center mb-4">
                        Este elemento se propondra como adicion al documento maestro de la familia.
                    </p>

                    {/* Item description (readonly) */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Elemento ({itemType})
                        </label>
                        <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 break-words">
                            {itemDescription}
                        </div>
                    </div>

                    {/* Justification textarea */}
                    <div className="mb-6">
                        <label
                            htmlFor="suggest-nota"
                            className="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Nota / justificacion
                        </label>
                        <textarea
                            id="suggest-nota"
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                            placeholder="Explica por que este elemento deberia estar en el maestro..."
                            rows={3}
                            disabled={submitting}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={submitting}
                            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Enviando...</span>
                                </>
                            ) : (
                                <>
                                    <ArrowUpCircle size={18} />
                                    <span>Enviar Sugerencia</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuggestToMasterModal;
