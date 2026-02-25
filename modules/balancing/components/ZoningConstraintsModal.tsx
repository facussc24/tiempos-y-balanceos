import React, { useState, useMemo } from 'react';
import { Link, Unlink, X, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { ProjectData, ZoningConstraint, Task } from '../../../types';
import { toast } from '../../../components/ui/Toast';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    data: ProjectData;
    updateData: (data: ProjectData) => void;
}

/**
 * FIX 3: Modal for managing zoning constraints (Must-Include / Must-Exclude)
 * 
 * Accessible from both TaskManager and LineBalancing modules.
 * Allows users to define hard constraints between task pairs:
 * - Must-Include: Tasks MUST be in the same station (e.g., share expensive machine)
 * - Must-Exclude: Tasks MUST NOT be in the same station (e.g., safety concerns)
 */
export const ZoningConstraintsModal: React.FC<Props> = ({ isOpen, onClose, data, updateData }) => {
    const [newTaskA, setNewTaskA] = useState<string>('');
    const [newTaskB, setNewTaskB] = useState<string>('');
    const [newType, setNewType] = useState<'must_include' | 'must_exclude'>('must_exclude');
    const [newReason, setNewReason] = useState<string>('');

    // Get task list for selectors
    const tasks = useMemo(() => data.tasks || [], [data.tasks]);
    const constraints = useMemo(() => data.zoningConstraints || [], [data.zoningConstraints]);

    // UX: Filter task B options to exclude selected task A (avoid self-reference)
    const taskBOptions = useMemo(() => {
        if (!newTaskA) return tasks;
        return tasks.filter(t => t.id !== newTaskA);
    }, [tasks, newTaskA]);

    // When task A changes, reset task B if it was the same
    const handleTaskAChange = (value: string) => {
        setNewTaskA(value);
        if (newTaskB === value) {
            setNewTaskB('');
        }
    };

    if (!isOpen) return null;

    const addConstraint = () => {
        if (!newTaskA || !newTaskB) return;

        // Check for duplicates (same pair regardless of order)
        const exists = constraints.some(c =>
            (c.taskA === newTaskA && c.taskB === newTaskB) ||
            (c.taskA === newTaskB && c.taskB === newTaskA)
        );

        if (exists) {
            toast.warning('Restricción Duplicada', 'Esta restricción ya existe entre estas tareas.');
            return;
        }

        const newConstraint: ZoningConstraint = {
            id: `zc-${Date.now()}`,
            taskA: newTaskA,
            taskB: newTaskB,
            type: newType,
            reason: newReason.trim() || undefined
        };

        updateData({
            ...data,
            zoningConstraints: [...constraints, newConstraint]
        });

        // Reset form
        setNewTaskA('');
        setNewTaskB('');
        setNewReason('');
    };

    const deleteConstraint = (id: string) => {
        updateData({
            ...data,
            zoningConstraints: constraints.filter(c => c.id !== id)
        });
    };

    // Helper to get task description for display
    const getTaskLabel = (taskId: string): string => {
        const task = tasks.find(t => t.id === taskId);
        return task ? `${task.id} - ${task.description?.substring(0, 30) || 'Sin descripción'}` : taskId;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <AlertTriangle size={20} className="text-amber-500" />
                        Restricciones de Zonificación
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {/* Info Banner */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-700">
                        <strong>¿Qué son las restricciones de zona?</strong>
                        <ul className="mt-1 ml-4 list-disc text-xs">
                            <li><strong>Must-Include (🔗):</strong> Tareas que deben estar en la misma estación (ej: comparten máquina costosa)</li>
                            <li><strong>Must-Exclude (🚫):</strong> Tareas que NO pueden estar juntas (ej: seguridad, suciedad)</li>
                        </ul>
                    </div>

                    {/* Add New Constraint Form */}
                    <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
                        <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                            <Plus size={16} /> Nueva Restricción
                        </h4>

                        <div className="grid grid-cols-12 gap-3">
                            {/* Task A Selector */}
                            <div className="col-span-4">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Tarea A
                                </label>
                                <select
                                    value={newTaskA}
                                    onChange={(e) => handleTaskAChange(e.target.value)}
                                    className="w-full border-2 border-slate-200 p-2 rounded text-sm text-slate-900 bg-white focus:border-blue-500 focus:ring-0 outline-none"
                                >
                                    <option value="">Seleccionar...</option>
                                    {tasks.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.id} - {t.description?.substring(0, 25) || 'Sin desc.'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Constraint Type */}
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Tipo
                                </label>
                                <select
                                    value={newType}
                                    onChange={(e) => setNewType(e.target.value as 'must_include' | 'must_exclude')}
                                    className="w-full border-2 border-slate-200 p-2 rounded text-sm bg-white focus:border-blue-500 focus:ring-0 outline-none font-bold"
                                >
                                    <option value="must_exclude">🚫 Separar</option>
                                    <option value="must_include">🔗 Juntar</option>
                                </select>
                            </div>

                            {/* Task B Selector (filtered) */}
                            <div className="col-span-4">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Tarea B
                                </label>
                                <select
                                    value={newTaskB}
                                    onChange={(e) => setNewTaskB(e.target.value)}
                                    disabled={!newTaskA}
                                    className="w-full border-2 border-slate-200 p-2 rounded text-sm text-slate-900 bg-white focus:border-blue-500 focus:ring-0 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                >
                                    <option value="">Seleccionar...</option>
                                    {taskBOptions.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.id} - {t.description?.substring(0, 25) || 'Sin desc.'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Add Button */}
                            <div className="col-span-2 flex items-end">
                                <button
                                    onClick={addConstraint}
                                    disabled={!newTaskA || !newTaskB}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white p-2 rounded shadow-sm transition-colors flex items-center justify-center gap-1 font-bold text-sm"
                                >
                                    <Plus size={16} /> Agregar
                                </button>
                            </div>
                        </div>

                        {/* Reason Field */}
                        <div className="mt-3">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Razón (Opcional)
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: Seguridad - chispas cerca de pintura"
                                value={newReason}
                                onChange={(e) => setNewReason(e.target.value)}
                                className="w-full border-2 border-slate-200 p-2 rounded text-sm text-slate-900 bg-white focus:border-blue-500 focus:ring-0 outline-none"
                            />
                        </div>
                    </div>

                    {/* Existing Constraints List */}
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        <h4 className="font-bold text-slate-700 text-sm mb-2">
                            Restricciones Activas ({constraints.length})
                        </h4>

                        {constraints.length === 0 && (
                            <p className="text-sm text-slate-400 italic text-center py-4 border-2 border-dashed border-slate-200 rounded-lg">
                                No hay restricciones definidas.
                            </p>
                        )}

                        {constraints.map(c => (
                            <div
                                key={c.id}
                                className={`flex justify-between items-center p-3 rounded-lg border ${c.type === 'must_include'
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-red-50 border-red-200'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Icon */}
                                    <div className={`p-2 rounded-full ${c.type === 'must_include'
                                        ? 'bg-green-100 text-green-600'
                                        : 'bg-red-100 text-red-600'
                                        }`}>
                                        {c.type === 'must_include' ? <Link size={16} /> : <Unlink size={16} />}
                                    </div>

                                    {/* Task Names */}
                                    <div>
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                            <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                                                {c.taskA}
                                            </span>
                                            <span className={c.type === 'must_include' ? 'text-green-600' : 'text-red-600'}>
                                                {c.type === 'must_include' ? '↔' : '↮'}
                                            </span>
                                            <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                                                {c.taskB}
                                            </span>
                                        </div>
                                        {c.reason && (
                                            <p className="text-xs text-slate-500 mt-1">
                                                💬 {c.reason}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Delete Button */}
                                <button
                                    onClick={() => deleteConstraint(c.id)}
                                    className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                                    title="Eliminar restricción"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded font-bold text-sm transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
