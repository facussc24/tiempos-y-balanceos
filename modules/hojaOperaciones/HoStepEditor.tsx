/**
 * Step Editor — Compact numbered list of process steps per TWI methodology.
 * Each step has: number, description, key point flag, key point reason.
 * Per TWI: Key Points explain the "trick" or critical detail.
 */

import React from 'react';
import { HoStep } from './hojaOperacionesTypes';
import { Plus, Trash2, Star } from 'lucide-react';

interface Props {
    steps: HoStep[];
    onAdd: () => void;
    onRemove: (stepId: string) => void;
    onUpdate: (stepId: string, field: keyof HoStep, value: any) => void;
    onReorder: (fromIndex: number, toIndex: number) => void;
    readOnly?: boolean;
}

const HoStepEditor: React.FC<Props> = ({ steps, onAdd, onRemove, onUpdate, onReorder, readOnly }) => {
    return (
        <div className="space-y-1">
            {steps.map((step, index) => (
                <div
                    key={step.id}
                    className={`group flex gap-2 items-start p-2 rounded border transition ${
                        step.isKeyPoint
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                >
                    {/* Reorder + step number */}
                    <div className="flex flex-col items-center gap-0.5 pt-1 min-w-[2rem]">
                        {!readOnly && (
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
                                    onClick={() => index < steps.length - 1 && onReorder(index, index + 1)}
                                    disabled={index === steps.length - 1}
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
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-1">
                        <textarea
                            value={step.description}
                            onChange={e => onUpdate(step.id, 'description', e.target.value)}
                            placeholder="Descripcion del paso..."
                            readOnly={readOnly}
                            rows={2}
                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                        {step.isKeyPoint && (
                            <textarea
                                value={step.keyPointReason}
                                onChange={e => onUpdate(step.id, 'keyPointReason', e.target.value)}
                                placeholder="Razon del punto clave (Por que es importante?)"
                                readOnly={readOnly}
                                rows={1}
                                className="w-full px-2 py-1 text-xs border border-blue-200 rounded resize-none bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400 italic"
                            />
                        )}
                    </div>

                    {/* Actions */}
                    {!readOnly && (
                        <div className="flex flex-col gap-1 pt-1">
                            <button
                                type="button"
                                onClick={() => onUpdate(step.id, 'isKeyPoint', !step.isKeyPoint)}
                                className={`p-1 rounded transition ${
                                    step.isKeyPoint
                                        ? 'text-blue-600 bg-blue-100'
                                        : 'text-gray-300 hover:text-blue-500'
                                }`}
                                title={step.isKeyPoint ? 'Quitar punto clave' : 'Marcar como punto clave'}
                            >
                                <Star size={14} fill={step.isKeyPoint ? 'currentColor' : 'none'} />
                            </button>
                            <button
                                type="button"
                                onClick={() => onRemove(step.id)}
                                className="p-1 rounded text-gray-300 hover:text-red-500 transition"
                                title="Eliminar paso"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}
                </div>
            ))}

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
                <p className="text-xs text-gray-400 italic px-2 py-3">
                    No hay pasos definidos. Agregue pasos para describir la operacion.
                </p>
            )}
        </div>
    );
};

export default HoStepEditor;
