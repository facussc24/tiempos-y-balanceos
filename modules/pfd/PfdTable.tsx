/**
 * PFD Table — Main interactive table for Process Flow Diagram steps
 *
 * C3-U3: Empty state with template quick-start button.
 * Sticky header, inline editing, symbol picker, CC/SC badges.
 * Flow arrows between rows to visualize process direction (AIAG).
 */

import React from 'react';
import { ArrowDown, Plus, FileText, Factory } from 'lucide-react';
import type { PfdStep } from './pfdTypes';
import { PFD_COLUMNS } from './pfdTypes';
import PfdTableRow from './PfdTableRow';

interface Props {
    steps: PfdStep[];
    onUpdateStep: (stepId: string, field: keyof PfdStep, value: string | boolean) => void;
    /** C5-B1: Batch update multiple fields atomically (single undo entry) */
    onBatchUpdateStep?: (stepId: string, updates: Partial<PfdStep>) => void;
    onRemoveStep: (stepId: string) => void;
    onMoveStep: (stepId: string, direction: 'up' | 'down') => void;
    onInsertAfter?: (stepId: string) => void;
    onDuplicate?: (stepId: string) => void;
    onAddStep?: () => void;
    onLoadTemplate?: () => void;
    onLoadManufacturingTemplate?: () => void;
    /** C5-U3: Toggle flow arrows between rows */
    showFlowArrows?: boolean;
    readOnly?: boolean;
}

const PfdTable: React.FC<Props> = ({ steps, onUpdateStep, onBatchUpdateStep, onRemoveStep, onMoveStep, onInsertAfter, onDuplicate, onAddStep, onLoadTemplate, onLoadManufacturingTemplate, showFlowArrows = true, readOnly }) => {
    const colCount = PFD_COLUMNS.length + (readOnly ? 0 : 1);

    return (
        <>
            <thead className="sticky top-0 z-10">
                <tr className="bg-gradient-to-r from-cyan-600 to-teal-600">
                    {PFD_COLUMNS.map(col => (
                        <th
                            key={col.key}
                            className="px-2 py-2.5 text-xs font-semibold text-white text-center border-r border-cyan-500/30 whitespace-nowrap"
                            style={{ width: col.width }}
                        >
                            {col.label}
                            {col.required && <span className="text-cyan-200 ml-0.5">*</span>}
                        </th>
                    ))}
                    {!readOnly && (
                        <th className="px-2 py-2.5 text-xs font-semibold text-white text-center" style={{ width: '110px' }}>
                            Acciones
                        </th>
                    )}
                </tr>
            </thead>
            <tbody>
                {steps.length === 0 ? (
                    <tr>
                        <td colSpan={colCount} className="text-center py-12">
                            <div className="flex flex-col items-center gap-3 text-gray-400">
                                <p className="text-sm">No hay pasos definidos.</p>
                                {!readOnly && (
                                    <div className="flex gap-2">
                                        {onAddStep && (
                                            <button
                                                onClick={onAddStep}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 transition"
                                            >
                                                <Plus size={14} />
                                                Agregar paso vacío
                                            </button>
                                        )}
                                        {onLoadTemplate && (
                                            <button
                                                onClick={onLoadTemplate}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition"
                                            >
                                                <FileText size={14} />
                                                Plantilla básica (8 pasos)
                                            </button>
                                        )}
                                        {onLoadManufacturingTemplate && (
                                            <button
                                                onClick={onLoadManufacturingTemplate}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 transition"
                                            >
                                                <Factory size={14} />
                                                Plantilla manufactura (11 pasos)
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </td>
                    </tr>
                ) : (
                    steps.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <PfdTableRow
                                step={step}
                                index={index}
                                totalSteps={steps.length}
                                onUpdate={onUpdateStep}
                                onBatchUpdate={onBatchUpdateStep}
                                onRemove={onRemoveStep}
                                onMove={onMoveStep}
                                onInsertAfter={onInsertAfter}
                                onDuplicate={onDuplicate}
                                readOnly={readOnly}
                            />
                            {/* C5-U3: Flow arrow between rows (toggleable) */}
                            {showFlowArrows && index < steps.length - 1 && (
                                <tr className="flow-arrow-row" aria-hidden="true">
                                    <td colSpan={colCount} className="py-0 text-center border-0 bg-gray-50/30">
                                        <div className="flex flex-col items-center">
                                            <div className="w-px h-1 bg-cyan-300" />
                                            <ArrowDown size={18} className="text-cyan-500 -my-0.5" strokeWidth={2.5} />
                                            <div className="w-px h-1 bg-cyan-300" />
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))
                )}
            </tbody>
        </>
    );
};

export default PfdTable;
