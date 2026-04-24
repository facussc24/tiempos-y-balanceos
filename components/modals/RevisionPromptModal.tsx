/**
 * RevisionPromptModal - Modal for creating a new document revision
 *
 * Collects a description (min 10 chars) and "revised by" name,
 * shows the current revision level and the next one.
 *
 * @module RevisionPromptModal
 */
import React, { useState, useEffect, useRef } from 'react';
import { GitBranch, X, ArrowRight } from 'lucide-react';
import { formatRevisionLabel } from '../../utils/revisionUtils';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface RevisionPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (description: string, revisedBy: string) => void;
    currentRevisionLevel: string;
    nextRevisionLevel: string;
    defaultRevisedBy?: string;
}

export const RevisionPromptModal: React.FC<RevisionPromptModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    currentRevisionLevel,
    nextRevisionLevel,
    defaultRevisedBy = '',
}) => {
    const [description, setDescription] = useState('');
    const [revisedBy, setRevisedBy] = useState(defaultRevisedBy);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const modalRef = useFocusTrap(isOpen);

    // Auto-focus el textarea al abrir. Los setState de reset no hacen falta
    // porque el componente retorna null cuando !isOpen (linea 53) — se desmonta
    // y al reabrir useState reinicializa con los defaults. Evita el
    // anti-pattern react-hooks/set-state-in-effect.
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => textareaRef.current?.focus(), 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const isValid = description.trim().length >= 10 && revisedBy.trim().length >= 2;

    const handleConfirm = () => {
        if (!isValid) return;
        onConfirm(description.trim(), revisedBy.trim());
    };

    return (
        <div className="fixed inset-0 z-modal-backdrop flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="revision-modal-title"
                className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-fade-in-up overflow-hidden"
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="p-6">
                    {/* Icon */}
                    <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <GitBranch size={28} className="text-indigo-600" />
                    </div>

                    {/* Title */}
                    <h2 id="revision-modal-title" className="text-xl font-bold text-slate-800 text-center mb-2">
                        Nueva Revisión
                    </h2>

                    {/* Revision badges */}
                    <div className="flex items-center justify-center gap-3 mb-5">
                        <span className="bg-gray-100 text-gray-600 text-sm font-bold px-3 py-1 rounded-full">
                            {formatRevisionLabel(currentRevisionLevel)}
                        </span>
                        <ArrowRight size={16} className="text-gray-400" />
                        <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-3 py-1 rounded-full">
                            {formatRevisionLabel(nextRevisionLevel)}
                        </span>
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                        <label htmlFor="revision-description" className="block text-xs font-bold text-gray-500 mb-1">
                            Descripción del cambio <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            id="revision-description"
                            ref={textareaRef}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Describí qué cambió en esta revisión..."
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm resize-none"
                        />
                        <p className={`text-[10px] mt-0.5 ${description.trim().length < 10 ? 'text-gray-400' : 'text-green-500'}`}>
                            {description.trim().length < 10
                                ? `Faltan ${10 - description.trim().length} caracteres (mínimo 10)`
                                : '✓ Mínimo alcanzado'}
                        </p>
                    </div>

                    {/* Revised By */}
                    <div className="mb-6">
                        <label htmlFor="revision-revised-by" className="block text-xs font-bold text-gray-500 mb-1">
                            Revisado por <span className="text-red-400">*</span>
                        </label>
                        <input
                            id="revision-revised-by"
                            type="text"
                            value={revisedBy}
                            onChange={e => setRevisedBy(e.target.value)}
                            placeholder="Nombre del responsable"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!isValid}
                            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <GitBranch size={16} />
                            Crear Revisión
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RevisionPromptModal;
