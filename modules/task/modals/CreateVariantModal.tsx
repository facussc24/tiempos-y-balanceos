/**
 * CreateVariantModal - UI for creating a child product from template
 * 
 * Allows user to select a parent product and creates a child JSON
 * with minimal structure (parentPath + empty taskOverrides).
 * 
 * @module modules/task/modals/CreateVariantModal
 * @version 9.0.0
 */

import React, { useState, useEffect } from 'react';
import { X, GitBranch, Copy, AlertTriangle } from 'lucide-react';
import { ProjectData } from '../../../types';

interface CreateVariantModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentProject: ProjectData;
    onCreateVariant: (variantName: string, parentPath: string) => Promise<boolean>;
}

export const CreateVariantModal: React.FC<CreateVariantModalProps> = ({
    isOpen,
    onClose,
    currentProject,
    onCreateVariant
}) => {
    const [variantName, setVariantName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const parentName = currentProject.meta?.name || 'Producto';

    const handleCreate = async () => {
        if (!variantName.trim()) {
            setError('El nombre de la variante es requerido');
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            // The parent path will be the current file's path (handled by parent component)
            const success = await onCreateVariant(variantName.trim(), './');

            if (success) {
                onClose();
                setVariantName('');
            } else {
                setError('No se pudo crear la variante');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <GitBranch size={24} />
                            <h2 className="text-xl font-bold">Crear Variante</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Cerrar" aria-label="Cerrar crear variante"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <p className="text-purple-100 text-sm mt-2">
                        Crear un producto hijo que hereda de &ldquo;{parentName}&rdquo;
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                        <div className="flex items-start gap-2">
                            <Copy size={16} className="mt-0.5 flex-shrink-0" />
                            <div>
                                <strong>¿Qué es una variante?</strong>
                                <p className="mt-1">
                                    Una variante hereda todas las tareas del padre pero permite
                                    sobrescribir solo lo necesario: tiempos, materiales, o
                                    desactivar tareas específicas.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Parent Info */}
                    <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                            Padre (Template)
                        </div>
                        <div className="font-semibold text-slate-800">
                            {parentName}
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                            {currentProject.tasks.length} tareas •
                            {currentProject.materials?.length || 0} materiales
                        </div>
                    </div>

                    {/* Variant Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Nombre de la Variante
                        </label>
                        <input
                            type="text"
                            value={variantName}
                            onChange={(e) => setVariantName(e.target.value)}
                            placeholder={`Ej: ${parentName} - Derecho`}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-800 text-sm">
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="border-t border-slate-200 p-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isCreating}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={isCreating || !variantName.trim()}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isCreating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Creando...
                            </>
                        ) : (
                            <>
                                <GitBranch size={18} />
                                Crear Variante
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
