/**
 * TaskConflictModal
 * 
 * V4.3: Displays when two products have tasks with the same ID
 * but different descriptions, allowing the user to decide whether
 * they are the same physical resource or different ones.
 * 
 * @module mix
 * @version 4.3.0
 */
import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';

export interface TaskConflict {
    taskId: string;
    descriptions: string[];
    products: string[];
}

interface TaskConflictModalProps {
    conflicts: TaskConflict[];
    onResolve: (resolutions: Map<string, 'merge' | 'separate'>) => void;
    onCancel: () => void;
}

export const TaskConflictModal: React.FC<TaskConflictModalProps> = ({
    conflicts,
    onResolve,
    onCancel
}) => {
    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onCancel]);

    // Track user decisions: 'merge' = same machine, 'separate' = different machines
    const [decisions, setDecisions] = useState<Map<string, 'merge' | 'separate'>>(
        new Map(conflicts.map(c => [c.taskId, 'merge']))
    );

    const handleDecision = (taskId: string, decision: 'merge' | 'separate') => {
        setDecisions(new Map(decisions).set(taskId, decision));
    };

    const handleConfirm = () => {
        onResolve(decisions);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-amber-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <AlertTriangle size={24} className="text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">
                                Tareas con Mismo Nombre Detectadas
                            </h3>
                            <p className="text-sm text-slate-600">
                                Confirma si estas tareas usan el mismo recurso físico
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
                    {conflicts.map((conflict) => (
                        <div
                            key={conflict.taskId}
                            className="border border-slate-200 rounded-lg p-4"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <HelpCircle size={18} className="text-amber-500" />
                                <span className="font-medium text-slate-700">
                                    Tarea &ldquo;{conflict.taskId}&rdquo;
                                </span>
                            </div>

                            {/* Show descriptions from each product */}
                            <div className="space-y-2 mb-4">
                                {conflict.descriptions.map((desc, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm">
                                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                                            {conflict.products[idx]}
                                        </span>
                                        <span className="text-slate-500">→</span>
                                        <span className="text-slate-700">{desc}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Decision buttons */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleDecision(conflict.taskId, 'merge')}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${decisions.get(conflict.taskId) === 'merge'
                                            ? 'bg-green-50 border-green-300 text-green-700'
                                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <CheckCircle size={16} />
                                    <span className="text-sm font-medium">
                                        Mismo Recurso (Fusionar)
                                    </span>
                                </button>
                                <button
                                    onClick={() => handleDecision(conflict.taskId, 'separate')}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${decisions.get(conflict.taskId) === 'separate'
                                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <XCircle size={16} />
                                    <span className="text-sm font-medium">
                                        Recursos Distintos (Separar)
                                    </span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        Confirmar y Continuar
                    </button>
                </div>
            </div>
        </div>
    );
};
