import React, { useState, useCallback } from 'react';
import { CheckCircle2, Split, Square, CheckSquare } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { formatNumber } from '../../../utils';
import { Task, Sector } from '../../../types';

interface UnassignedTaskListProps {
    unassignedTasks: Task[];
    sectorsList: Sector[];
    performAssignment: (taskId: string, stationId: number) => void;
    performBulkAssignment?: (taskIds: string[], stationId: number) => void;
    selectedTaskIds?: Set<string>;
    onToggleTaskSelection?: (taskId: string) => void;
}

const NOOP = () => { /* stable no-op default for optional selection handler */ };

const DraggableUnassignedTask: React.FC<{
    task: Task;
    sectorsList: Sector[];
    formatNumber: (n: number) => string;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
}> = ({ task, sectorsList, formatNumber, isSelected, onToggleSelect }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task.id,
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 999 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`relative bg-white border border-slate-200 p-3 rounded-md shadow-sm cursor-grab hover:shadow-md hover:border-accent group active:cursor-grabbing transition-all ${isDragging ? 'opacity-50' : ''} ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
            style={{ ...style, borderLeftColor: sectorsList.find(s => s.id === task.sectorId)?.color || undefined, borderLeftWidth: task.sectorId ? 4 : 1 }}
            aria-label={`Tarea ${task.id}, ${formatNumber(task.standardTime || task.averageTime)} segundos${isSelected ? ', seleccionada' : ''}. Arrastrar a una estación para asignar.`}
            aria-roledescription="elemento arrastrable"
        >
            {/* Selection checkbox (bulk move) — stops propagation so it never starts a drag */}
            <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleSelect(task.id); }}
                aria-pressed={isSelected}
                aria-label={isSelected ? `Quitar selección de tarea ${task.id}` : `Seleccionar tarea ${task.id}`}
                title={isSelected ? 'Quitar de la selección' : 'Seleccionar para mover en bloque'}
                className={`absolute -top-2 -left-2 bg-white rounded p-0.5 border border-slate-200 shadow-sm transition-opacity z-10 ${isSelected ? 'opacity-100 text-blue-600' : 'opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-blue-600'}`}
            >
                {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
            </button>
            <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-slate-800 text-sm font-mono">{task.id}</span>
                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                    {formatNumber(task.standardTime || task.averageTime)}s
                </span>
            </div>
            <p className="text-xs text-slate-500 line-clamp-2 leading-snug">{task.description}</p>
            {task.sectorId && (
                <div
                    className="mt-1.5 text-xs px-1.5 py-0.5 rounded inline-flex items-center gap-1 font-medium"
                    style={{
                        backgroundColor: (sectorsList.find(s => s.id === task.sectorId)?.color || '#64748b') + '15',
                        color: sectorsList.find(s => s.id === task.sectorId)?.color || '#64748b'
                    }}
                >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sectorsList.find(s => s.id === task.sectorId)?.color || '#64748b' }}></span>
                    {sectorsList.find(s => s.id === task.sectorId)?.name || 'Sin sector'}
                </div>
            )}
            {task.concurrentWith && (
                <div className="mt-2 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded flex items-center gap-1 border border-purple-100">
                    <Split size={10} /> Durante {task.concurrentWith}
                </div>
            )}
        </div>
    );
};

export const UnassignedTaskList: React.FC<UnassignedTaskListProps> = ({
    unassignedTasks,
    sectorsList,
    performAssignment,
    performBulkAssignment,
    selectedTaskIds,
    onToggleTaskSelection
}) => {
    const [showAssignAllConfirm, setShowAssignAllConfirm] = useState(false);

    const handleAssignAll = useCallback(() => {
        setShowAssignAllConfirm(true);
    }, []);

    const confirmAssignAll = useCallback(() => {
        // FIX: Use bulk assignment to avoid stale state from forEach + setState
        if (performBulkAssignment) {
            performBulkAssignment(unassignedTasks.map(t => t.id), 1);
        } else {
            // Fallback for backwards compatibility
            unassignedTasks.forEach(t => performAssignment(t.id, 1));
        }
        setShowAssignAllConfirm(false);
    }, [unassignedTasks, performAssignment, performBulkAssignment]);

    const cancelAssignAll = useCallback(() => {
        setShowAssignAllConfirm(false);
    }, []);

    return (
        <div className="bg-white border border-slate-200 rounded-md p-4 shadow-sm sticky top-24 max-h-[calc(100vh-150px)] flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700">Tareas Sin Asignar ({unassignedTasks.length})</h3>
            </div>
            <div className="overflow-y-auto pr-1 flex-1 space-y-2">
                {unassignedTasks.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                        <CheckCircle2 size={32} className="mx-auto mb-2 text-slate-200" />
                        <p className="text-sm font-medium">Todas las tareas asignadas</p>
                    </div>
                )}
                {unassignedTasks.map(task => (
                    <DraggableUnassignedTask
                        key={task.id}
                        task={task}
                        sectorsList={sectorsList}
                        formatNumber={formatNumber}
                        isSelected={selectedTaskIds?.has(task.id) ?? false}
                        onToggleSelect={onToggleTaskSelection ?? NOOP}
                    />
                ))}
            </div>
            {unassignedTasks.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                    {showAssignAllConfirm ? (
                        <div className="flex flex-col items-center gap-2">
                            <p className="text-xs text-gray-500">
                                Asignar {unassignedTasks.length} tarea(s) a Estación 1?
                            </p>
                            <p className="text-xs text-amber-600">
                                No valida restricciones de sector, máquina ni zona.
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={confirmAssignAll}
                                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition font-medium"
                                >
                                    Sí, asignar
                                </button>
                                <button
                                    type="button"
                                    onClick={cancelAssignAll}
                                    className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition font-medium"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleAssignAll}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                        >
                            Asignar todo a Estación 1
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
