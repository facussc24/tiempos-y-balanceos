/**
 * PFD Table — Main interactive table for Process Flow Diagram steps
 *
 * C3-U3: Empty state with template quick-start button.
 * Sticky header, inline editing, symbol picker, CC/SC badges.
 * Flow arrows between rows to visualize process direction (AIAG).
 * C9-N1: Enhanced flow arrows with fork/join for parallel flows,
 *         NG-path annotations for inspection dispositions,
 *         and rework return indicators.
 */

import React from 'react';
import { ArrowDown, Plus, FileText, Factory, GitBranch, GitMerge, CornerDownLeft, XOctagon, Filter } from 'lucide-react';
import type { PfdStep, PfdColumnDef, RejectDisposition } from './pfdTypes';
import { PFD_COLUMNS, getBranchColor, collectForkBranches } from './pfdTypes';
import PfdTableRow from './PfdTableRow';
import type { InheritanceStatusMap } from '../../hooks/useInheritanceStatus';

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
    /** Phase C: Filtered columns to render (when provided, overrides PFD_COLUMNS) */
    visibleColumns?: PfdColumnDef[];
    /** Step IDs with broken AMFE links (for visual warning) */
    brokenLinkStepIds?: Set<string>;
    /** Inheritance status map for variant documents (null = not a variant) */
    inheritanceStatusMap?: InheritanceStatusMap | null;
}

/** C9-N1: Disposition labels in Spanish */
const DISPOSITION_LABELS: Record<Exclude<RejectDisposition, 'none'>, string> = {
    rework: 'Retrabajo',
    scrap: 'Descarte',
    sort: 'Selección',
    rework_or_scrap: 'Retrabajo / Descarte',
};
const DISPOSITION_ICONS: Record<Exclude<RejectDisposition, 'none'>, typeof XOctagon> = {
    rework: CornerDownLeft,
    scrap: XOctagon,
    sort: Filter,
    rework_or_scrap: CornerDownLeft,
};

/**
 * C9-N1: Render the flow arrow area between two consecutive rows.
 * Shows different indicators depending on the flow transition:
 * - Normal: simple down arrow
 * - Fork: branching arrows showing parallel flow start
 * - Join: merging arrows showing parallel flow end
 * - NG path: inspection disposition annotation
 * - Rework return: return arrow to previous step
 */
function FlowArrow({
    current,
    next,
    steps,
    currentIndex,
    colCount,
}: {
    current: PfdStep;
    next: PfdStep;
    steps: PfdStep[];
    currentIndex: number;
    colCount: number;
}) {
    const curBranch = current.branchId || '';
    const nextBranch = next.branchId || '';

    // Detect transition type
    const isFork = !curBranch && !!nextBranch;
    const isJoin = !!curBranch && !nextBranch;
    const isBranchSwitch = !!curBranch && !!nextBranch && curBranch !== nextBranch;

    // NG path info from current step
    const hasDisposition = current.rejectDisposition !== 'none';
    const isInspection = current.stepType === 'inspection' || current.stepType === 'combined';
    const showNgPath = hasDisposition && isInspection;

    // Rework return info
    const isRework = current.rejectDisposition === 'rework' && current.reworkReturnStep;

    // Fork: collect all branches that start after this point
    const forkBranches = isFork ? collectForkBranches(steps, currentIndex) : [];

    // Branch color for continuation
    const branchColor = curBranch ? getBranchColor(curBranch) : null;

    return (
        <tr className="flow-arrow-row" aria-hidden="true">
            <td colSpan={colCount} className="py-0 text-center border-0 bg-gray-50/30">
                <div className="flex flex-col items-center gap-0">
                    {/* Fork indicator — compact */}
                    {isFork && (
                        <div className="flex items-center justify-center py-0.5">
                            <div className="flex items-center gap-1 px-2 py-px bg-cyan-50 border border-cyan-200 rounded-full">
                                <GitBranch size={10} className="text-cyan-600" />
                                <span className="text-[9px] font-semibold text-cyan-700">FLUJO PARALELO</span>
                                {forkBranches.map(b => {
                                    const color = getBranchColor(b);
                                    const label = steps.find(s => s.branchId === b)?.branchLabel || `Línea ${b}`;
                                    return (
                                        <span key={b} className={`inline-block ${color.badge} border text-[8px] font-bold px-1 py-0 rounded`}>
                                            {label}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Join indicator — compact */}
                    {isJoin && (
                        <div className="flex items-center justify-center py-0.5">
                            <div className="flex items-center gap-1 px-2 py-px bg-teal-50 border border-teal-200 rounded-full">
                                <GitMerge size={11} className="text-teal-600" />
                                <span className="text-[9px] font-semibold text-teal-700">CONVERGENCIA</span>
                            </div>
                        </div>
                    )}

                    {/* Branch switch indicator */}
                    {isBranchSwitch && (
                        <div className="flex items-center justify-center gap-1 py-0.5">
                            {(() => {
                                const fromColor = getBranchColor(curBranch);
                                const toColor = getBranchColor(nextBranch);
                                const toLabel = next.branchLabel || `Línea ${nextBranch}`;
                                return (
                                    <>
                                        <span className={`inline-block ${fromColor.badge} border text-[9px] px-1 rounded`}>{curBranch}</span>
                                        <ArrowDown size={12} className="text-gray-400" />
                                        <span className={`inline-block ${toColor.badge} border text-[9px] font-bold px-1 rounded`}>{toLabel}</span>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* Reject path annotation for inspection with disposition */}
                    {showNgPath && (
                        <div className="flex items-center justify-center gap-2 py-0.5">
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-medium text-green-600">OK ↓</span>
                                <span className="text-gray-300 text-[10px]">|</span>
                                {(() => {
                                    const disp = current.rejectDisposition as Exclude<RejectDisposition, 'none'>;
                                    const Icon = DISPOSITION_ICONS[disp];
                                    const label = DISPOSITION_LABELS[disp];
                                    const detail = isRework
                                        ? `→ ${current.reworkReturnStep}`
                                        : current.scrapDescription
                                            ? `: ${current.scrapDescription.slice(0, 30)}`
                                            : '';
                                    return (
                                        <span className="flex items-center gap-0.5 text-[10px] font-medium text-red-600">
                                            <span className="text-red-400">NOK</span>
                                            <Icon size={10} />
                                            <span>{label}{detail}</span>
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Rework return indicator (for non-inspection steps with rework) */}
                    {!showNgPath && isRework && (
                        <div className="flex items-center justify-center gap-1 py-0.5">
                            <CornerDownLeft size={10} className="text-red-400" />
                            <span className="text-[10px] font-medium text-red-600">
                                Retrabajo → {current.reworkReturnStep}
                            </span>
                        </div>
                    )}

                    {/* Normal flow arrow — compact */}
                    {!isFork && !isJoin && (
                        <div className="flex justify-center py-px">
                            <ArrowDown size={14} className={`${branchColor ? branchColor.text : 'text-cyan-400'}`} strokeWidth={2} />
                        </div>
                    )}

                    {/* Fork/Join also gets a small arrow */}
                    {(isFork || isJoin) && (
                        <div className="flex justify-center py-px">
                            <ArrowDown size={12} className="text-cyan-400" strokeWidth={2} />
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
}

const PfdTable: React.FC<Props> = ({ steps, onUpdateStep, onBatchUpdateStep, onRemoveStep, onMoveStep, onInsertAfter, onDuplicate, onAddStep, onLoadTemplate, onLoadManufacturingTemplate, showFlowArrows = true, readOnly, visibleColumns, brokenLinkStepIds, inheritanceStatusMap }) => {
    const columnsToRender = visibleColumns || PFD_COLUMNS;
    const colCount = columnsToRender.length + (readOnly ? 0 : 1);

    return (
        <>
            <thead className="sticky top-0 z-20">
                <tr className="bg-gradient-to-r from-cyan-600 to-teal-600">
                    {columnsToRender.map((col, ci) => {
                        // C7-U1: First 3 columns are sticky (Nº Op., Símbolo, Descripción)
                        const isSticky = ci < 3;
                        const stickyLeft = ci === 0 ? 0 : ci === 1 ? 80 : ci === 2 ? 140 : 0;
                        return (
                            <th
                                key={col.key}
                                scope="col"
                                className={`px-2 py-2.5 text-xs font-semibold text-white text-center border-r border-cyan-500/30 whitespace-nowrap ${isSticky ? 'sticky z-30 bg-cyan-600 shadow-[2px_0_4px_rgba(0,0,0,0.1)]' : ''} ${col.tooltip ? 'cursor-help' : ''}`}
                                style={{ width: col.width, ...(isSticky ? { left: `${stickyLeft}px` } : {}) }}
                                title={col.tooltip}
                            >
                                {col.label}
                                {col.required && <span className="text-cyan-200 ml-0.5">*</span>}
                            </th>
                        );
                    })}
                    {!readOnly && (
                        <th scope="col" className="px-2 py-2.5 text-xs font-semibold text-white text-center sticky right-0 z-30 bg-teal-600 shadow-[-2px_0_4px_rgba(0,0,0,0.1)]" style={{ width: '90px' }}>
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
                                                Plantilla manufactura (12 pasos)
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
                                visibleColumns={visibleColumns}
                                hasBrokenLink={brokenLinkStepIds?.has(step.id)}
                                inheritanceStatus={inheritanceStatusMap?.items.get(step.id) ?? null}
                            />
                            {/* C9-N1: Enhanced flow arrows with fork/join/NG-path */}
                            {showFlowArrows && index < steps.length - 1 && (
                                <FlowArrow
                                    current={step}
                                    next={steps[index + 1]}
                                    steps={steps}
                                    currentIndex={index}
                                    colCount={colCount}
                                />
                            )}
                        </React.Fragment>
                    ))
                )}
            </tbody>
        </>
    );
};

export default PfdTable;
