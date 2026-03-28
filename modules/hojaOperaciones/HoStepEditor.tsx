/**
 * Step Editor — Compact numbered list of process steps per TWI methodology.
 * Each step has: number, description, key point flag, key point reason.
 * Per TWI: Key Points explain the "trick" or critical detail.
 */

import React, { useState, useCallback } from 'react';
import { HoStep } from './hojaOperacionesTypes';
import { Plus, Trash2, Star, ListChecks, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { InheritanceBadge } from '../../components/ui/InheritanceBadge';
import type { InheritanceStatus } from '../../components/ui/InheritanceBadge';
import type { InheritanceStatusMap } from '../../hooks/useInheritanceStatus';

interface Props {
    steps: HoStep[];
    onAdd: () => void;
    onRemove: (stepId: string) => void;
    onUpdate: (stepId: string, field: keyof HoStep, value: string | number | boolean) => void;
    onReorder: (fromIndex: number, toIndex: number) => void;
    readOnly?: boolean;
    disableDrag?: boolean;
    highlightQuery?: string;
    /** Inheritance status map for variant documents (null = not a variant) */
    inheritanceStatusMap?: InheritanceStatusMap | null;
}

/* ──────── Sortable Step Row Wrapper ──────── */

interface SortableStepRowProps {
    step: HoStep;
    index: number;
    stepsLength: number;
    readOnly?: boolean;
    disableDrag?: boolean;
    highlightQuery?: string;
    onUpdate: (stepId: string, field: keyof HoStep, value: string | number | boolean) => void;
    onReorder: (fromIndex: number, toIndex: number) => void;
    confirmDeleteId: string | null;
    onDelete: (stepId: string) => void;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
    inheritanceStatus?: InheritanceStatus | null;
}

const SortableStepRow: React.FC<SortableStepRowProps> = ({
    step, index, stepsLength, readOnly, disableDrag, highlightQuery,
    onUpdate, onReorder, confirmDeleteId, onDelete, onConfirmDelete, onCancelDelete,
    inheritanceStatus,
}) => {
    const dragDisabled = readOnly || disableDrag;
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: step.id, disabled: dragDisabled });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
    };

    const q = highlightQuery?.toLowerCase().trim() || '';
    const descMatch = q && (step.description || '').toLowerCase().includes(q);
    const reasonMatch = q && (step.keyPointReason || '').toLowerCase().includes(q);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex gap-2 items-start p-2 rounded border transition ${
                step.isKeyPoint
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-100 hover:border-gray-200'
            }`}
        >
            {/* Drag handle + Reorder + step number */}
            <div className="flex flex-col items-center gap-0.5 pt-1 min-w-[2rem]">
                {!readOnly && !disableDrag && (
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-0.5 rounded hover:bg-gray-100 transition"
                        title="Arrastrar para reordenar"
                    >
                        <GripVertical size={14} />
                    </div>
                )}
                {!readOnly && !disableDrag && (
                    <div className="flex flex-col gap-0.5">
                        <button
                            type="button"
                            onClick={() => index > 0 && onReorder(index, index - 1)}
                            disabled={index === 0}
                            className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
                            title="Mover arriba"
                            aria-label={`Mover paso ${step.stepNumber} arriba`}
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => index < stepsLength - 1 && onReorder(index, index + 1)}
                            disabled={index === stepsLength - 1}
                            className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
                            title="Mover abajo"
                            aria-label={`Mover paso ${step.stepNumber} abajo`}
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                )}
                <span className={`text-sm font-bold ${step.isKeyPoint ? 'text-blue-700' : 'text-gray-400'}`}>
                    {step.stepNumber}
                </span>
                {inheritanceStatus && (
                    <InheritanceBadge status={inheritanceStatus} compact />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-1">
                <textarea
                    value={step.description}
                    onChange={e => onUpdate(step.id, 'description', e.target.value)}
                    placeholder="Descripción del paso..."
                    readOnly={readOnly}
                    rows={2}
                    className={`w-full px-2 py-1.5 text-xs border rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 ${
                        descMatch ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                    }`}
                />
                {step.isKeyPoint && (
                    <textarea
                        value={step.keyPointReason}
                        onChange={e => onUpdate(step.id, 'keyPointReason', e.target.value)}
                        placeholder="Razon del punto clave (Por que es importante?)"
                        readOnly={readOnly}
                        rows={1}
                        className={`w-full px-2 py-1 text-xs border rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 italic ${
                            reasonMatch ? 'border-yellow-400 bg-yellow-50' : 'border-blue-200 bg-blue-50'
                        }`}
                    />
                )}
            </div>

            {/* Actions */}
            {!readOnly && (
                <div className="flex flex-col gap-1 pt-1">
                    <button
                        type="button"
                        onClick={() => onUpdate(step.id, 'isKeyPoint', !step.isKeyPoint)}
                        className={`p-1.5 rounded transition ${
                            step.isKeyPoint
                                ? 'text-blue-600 bg-blue-100'
                                : 'text-gray-300 hover:text-blue-500'
                        }`}
                        title={step.isKeyPoint ? 'Quitar punto clave' : 'Marcar como punto clave'}
                        aria-label={step.isKeyPoint ? 'Quitar punto clave' : 'Marcar como punto clave'}
                    >
                        <Star size={14} fill={step.isKeyPoint ? 'currentColor' : 'none'} />
                    </button>
                    {confirmDeleteId === step.id ? (
                        <div className="flex items-center gap-1 bg-white rounded shadow-md border border-red-200 px-1.5 py-1">
                            <span className="text-[9px] text-red-600 font-medium whitespace-nowrap">Paso {step.stepNumber}?</span>
                            <button
                                type="button"
                                onClick={onConfirmDelete}
                                className="px-1.5 py-0.5 text-[9px] bg-red-500 text-white rounded hover:bg-red-600 transition font-medium"
                            >
                                Sí
                            </button>
                            <button
                                type="button"
                                onClick={onCancelDelete}
                                className="px-1.5 py-0.5 text-[9px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition font-medium"
                            >
                                No
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onDelete(step.id)}
                            className="p-1.5 rounded text-gray-300 hover:text-red-500 transition"
                            title="Eliminar paso"
                            aria-label={`Eliminar paso ${step.stepNumber}`}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

/* ──────── Main Component ──────── */

const HoStepEditor: React.FC<Props> = ({ steps, onAdd, onRemove, onUpdate, onReorder, readOnly, disableDrag, highlightQuery, inheritanceStatusMap }) => {
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const handleDelete = useCallback((stepId: string) => {
        setConfirmDeleteId(stepId);
    }, []);

    const confirmDelete = useCallback(() => {
        if (confirmDeleteId) {
            onRemove(confirmDeleteId);
            setConfirmDeleteId(null);
        }
    }, [confirmDeleteId, onRemove]);

    const cancelDelete = useCallback(() => {
        setConfirmDeleteId(null);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = steps.findIndex(s => s.id === active.id);
        const newIndex = steps.findIndex(s => s.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
            onReorder(oldIndex, newIndex);
        }
    }, [steps, onReorder]);

    return (
        <div className="space-y-1">
            <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
                <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    {steps.map((step, index) => (
                        <SortableStepRow
                            key={step.id}
                            step={step}
                            index={index}
                            stepsLength={steps.length}
                            readOnly={readOnly}
                            disableDrag={disableDrag}
                            highlightQuery={highlightQuery}
                            onUpdate={onUpdate}
                            onReorder={onReorder}
                            confirmDeleteId={confirmDeleteId}
                            onDelete={handleDelete}
                            onConfirmDelete={confirmDelete}
                            onCancelDelete={cancelDelete}
                            inheritanceStatus={inheritanceStatusMap?.items.get(step.id) ?? null}
                        />
                    ))}
                </SortableContext>
            </DndContext>

            {!readOnly && (
                <button
                    type="button"
                    onClick={onAdd}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 px-2 py-1.5 rounded hover:bg-blue-50 transition"
                >
                    <Plus size={14} />
                    Agregar paso
                </button>
            )}

            {steps.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
                    <ListChecks size={28} className="text-gray-300" />
                    <p className="text-xs">No hay pasos definidos. Agregue pasos para describir la operación.</p>
                </div>
            )}
        </div>
    );
};

export default HoStepEditor;
