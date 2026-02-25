/**
 * MixHistoryModal - Modal para ver escenarios Mix guardados
 * 
 * @module MixHistoryModal
 * @version 1.1.0 - Migrado de confirm() nativo a ConfirmModal
 */
import React, { useState } from 'react';
import { X, Trash2, Calendar, Package, Users } from 'lucide-react';
import { MixSavedScenario } from '../../types';
import { ConfirmModal } from '../../components/modals/ConfirmModal';

interface MixHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    scenarios: MixSavedScenario[];
    onDelete: (id: string) => Promise<void>;
    onSelect: (scenario: MixSavedScenario) => void;
}

export const MixHistoryModal: React.FC<MixHistoryModalProps> = ({
    isOpen,
    onClose,
    scenarios,
    onDelete,
    onSelect
}) => {
    // Estado para modal de confirmación de eliminación
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    if (!isOpen) return null;

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setPendingDeleteId(id);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (pendingDeleteId) {
            setIsDeleting(true);
            try {
                await onDelete(pendingDeleteId);
            } finally {
                setIsDeleting(false);
            }
        }
        setDeleteModalOpen(false);
        setPendingDeleteId(null);
    };

    const cancelDelete = () => {
        setDeleteModalOpen(false);
        setPendingDeleteId(null);
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800">
                            📊 Escenarios Mix Guardados
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {scenarios.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <Package size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No hay escenarios guardados</p>
                                <p className="text-sm mt-1">
                                    Calculá un Mix y presioná "Guardar" para guardarlo aquí
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {scenarios.map(scenario => (
                                    <div
                                        key={scenario.id}
                                        onClick={() => onSelect(scenario)}
                                        className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all group"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-slate-800 group-hover:text-blue-700">
                                                    {scenario.name}
                                                </h3>

                                                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={14} />
                                                        {new Date(scenario.createdAt).toLocaleString('es-AR')}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Package size={14} />
                                                        {scenario.selectedProducts.length} productos
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Users size={14} />
                                                        {scenario.result.totalOperators} operarios
                                                    </span>
                                                </div>

                                                <div className="mt-2 text-xs text-slate-400">
                                                    Demanda: {scenario.totalDemand.toLocaleString()} pz/día
                                                </div>
                                            </div>

                                            <button
                                                onClick={(e) => handleDelete(e, scenario.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Eliminar escenario"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>

                                        {/* Status indicator */}
                                        <div className="mt-3 flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${scenario.result.isViable
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                {scenario.result.isViable ? '✅ Viable' : '⚠️ Déficit'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
                        <p className="text-xs text-slate-500 text-center">
                            Se guardan los últimos 20 escenarios
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal de confirmación de eliminación */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={cancelDelete}
                onConfirm={confirmDelete}
                title="Eliminar Escenario"
                message="¿Estás seguro de que deseas eliminar este escenario? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
};

