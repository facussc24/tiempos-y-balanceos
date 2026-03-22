/**
 * PFD Flow Map — Visual process flow diagram panel
 *
 * Renders a compact visual flowchart showing the process structure at a glance.
 * Shows ASME symbols, parallel branches as side-by-side lanes, fork/join points,
 * rework returns, and NG dispositions. Clickable steps scroll to the table row.
 *
 * Validated with NotebookLM (AIAG APQP + CP 2024):
 * - "Puntos de salida y entrada" must be explicit for interdependent processes
 * - Visual identification of CC/SC on affected steps
 * - Rework return loops must be visible
 */

import React, { useMemo } from 'react';
import { Map, ArrowDown, GitBranch, GitMerge, CornerDownLeft, XOctagon, Filter, ChevronUp, ChevronDown } from 'lucide-react';
import type { PfdStep, PfdStepType, RejectDisposition } from './pfdTypes';
import { getBranchColor } from './pfdTypes';
import { PfdSymbol } from './PfdSymbols';

interface Props {
    steps: PfdStep[];
    isOpen: boolean;
    onToggle: () => void;
}

/** Group consecutive steps by branch for layout */
interface FlowGroup {
    type: 'main' | 'parallel';
    steps: PfdStep[];
    branches?: { branchId: string; label: string; steps: PfdStep[] }[];
}

function groupStepsByFlow(steps: PfdStep[]): FlowGroup[] {
    const groups: FlowGroup[] = [];
    let i = 0;

    while (i < steps.length) {
        const step = steps[i];

        if (!step.branchId) {
            // Main flow step — collect consecutive main-flow steps
            const mainSteps: PfdStep[] = [];
            while (i < steps.length && !steps[i].branchId) {
                mainSteps.push(steps[i]);
                i++;
            }
            groups.push({ type: 'main', steps: mainSteps });
        } else {
            // Parallel branch — collect ALL consecutive branch steps, grouped by branchId
            const branchMap: Record<string, PfdStep[]> = {};
            const branchOrder: string[] = [];
            while (i < steps.length && steps[i].branchId) {
                const bid = steps[i].branchId;
                if (!branchMap[bid]) {
                    branchMap[bid] = [];
                    branchOrder.push(bid);
                }
                branchMap[bid].push(steps[i]);
                i++;
            }
            const branches = branchOrder.map(bid => ({
                branchId: bid,
                label: branchMap[bid][0].branchLabel || `Línea ${bid}`,
                steps: branchMap[bid],
            }));
            groups.push({ type: 'parallel', steps: [], branches });
        }
    }

    return groups;
}

/** Disposition icons */
const DISP_ICONS: Record<Exclude<RejectDisposition, 'none'>, typeof XOctagon> = {
    rework: CornerDownLeft,
    scrap: XOctagon,
    sort: Filter,
};
const DISP_LABELS: Record<Exclude<RejectDisposition, 'none'>, string> = {
    rework: 'Retrabajo',
    scrap: 'Descarte',
    sort: 'Selección',
};

/** Single step card in the flow map */
function StepCard({ step, compact }: { step: PfdStep; compact?: boolean }) {
    const hasCC = step.productSpecialChar === 'CC' || step.processSpecialChar === 'CC';
    const hasSC = !hasCC && (step.productSpecialChar === 'SC' || step.processSpecialChar === 'SC');
    const hasDisp = step.rejectDisposition !== 'none';
    const isInspectionDisp = hasDisp && (step.stepType === 'inspection' || step.stepType === 'combined');

    const scrollToStep = () => {
        const row = document.querySelector(`[data-step-id="${step.id}"]`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('ring-2', 'ring-cyan-400', 'bg-cyan-50/50');
            setTimeout(() => row.classList.remove('ring-2', 'ring-cyan-400', 'bg-cyan-50/50'), 2500);
        }
    };

    const ccBorder = hasCC ? 'ring-2 ring-red-400' : hasSC ? 'ring-2 ring-amber-400' : '';

    return (
        <button
            onClick={scrollToStep}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-cyan-50 hover:border-cyan-300 transition-all cursor-pointer text-left group w-full max-w-md ${ccBorder} ${compact ? 'py-0.5' : ''}`}
            title={`${step.stepNumber} — ${step.description}${hasCC ? ' [CC]' : hasSC ? ' [SC]' : ''}\nClic para ir al paso en la tabla`}
        >
            <PfdSymbol type={step.stepType} size={compact ? 14 : 18} />
            <div className="min-w-0 flex-1">
                <span className={`font-mono font-bold text-gray-700 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
                    {step.stepNumber}
                </span>
                <span className={`ml-1 text-gray-600 whitespace-normal break-words block ${compact ? 'text-[9px] max-w-[200px]' : 'text-xs max-w-xs'}`}>
                    {step.description}
                </span>
            </div>
            {hasCC && <span className="text-[8px] font-bold text-red-600 bg-red-50 border border-red-200 px-1 rounded">CC</span>}
            {hasSC && <span className="text-[8px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded">SC</span>}
            {step.isExternalProcess && <span className="text-[8px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1 rounded">EXT</span>}
            {isInspectionDisp && (() => {
                const disp = step.rejectDisposition as Exclude<RejectDisposition, 'none'>;
                const Icon = DISP_ICONS[disp];
                return (
                    <span className="flex items-center gap-0.5 text-[8px] font-bold text-red-500">
                        <Icon size={10} />
                        {disp === 'rework' && step.reworkReturnStep ? `→${step.reworkReturnStep}` : DISP_LABELS[disp]}
                    </span>
                );
            })()}
        </button>
    );
}

/** Flow arrow between groups */
function FlowArrowDown({ label, color }: { label?: string; color?: string }) {
    return (
        <div className="flex flex-col items-center py-0.5">
            {label && (
                <span className={`text-[9px] font-semibold ${color || 'text-cyan-500'}`}>{label}</span>
            )}
            <ArrowDown size={14} className={color || 'text-cyan-400'} strokeWidth={2.5} />
        </div>
    );
}

const PfdFlowMap: React.FC<Props> = ({ steps, isOpen, onToggle }) => {
    const groups = useMemo(() => groupStepsByFlow(steps), [steps]);

    if (steps.length === 0) return null;

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 no-print">
            {/* Toggle header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors rounded-t-lg"
            >
                <div className="flex items-center gap-2">
                    <Map size={16} className="text-cyan-600" />
                    <span className="text-sm font-semibold text-gray-700">MAPA DE FLUJO</span>
                    <span className="text-[10px] text-gray-400 font-normal">
                        {steps.length} pasos
                        {groups.some(g => g.type === 'parallel') && ' · con flujo paralelo'}
                    </span>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>

            {/* Flow map content */}
            {isOpen && (
                <div className="px-4 pb-4 pt-1">
                    <div className="flex flex-col items-center gap-0">
                        {groups.map((group, gi) => (
                            <React.Fragment key={gi}>
                                {/* Arrow between groups */}
                                {gi > 0 && (
                                    <FlowArrowDown />
                                )}

                                {group.type === 'main' ? (
                                    /* Main flow group — vertical list of steps */
                                    <div className="flex flex-col items-center gap-0">
                                        {group.steps.map((step, si) => (
                                            <React.Fragment key={step.id}>
                                                {si > 0 && <FlowArrowDown />}
                                                <StepCard step={step} />
                                            </React.Fragment>
                                        ))}
                                    </div>
                                ) : (
                                    /* Parallel flow group — side-by-side lanes */
                                    <div className="flex flex-col items-center gap-0 w-full">
                                        {/* Fork indicator */}
                                        <div className="flex items-center gap-2 py-1">
                                            <GitBranch size={14} className="text-cyan-600" />
                                            <span className="text-[10px] font-bold text-cyan-700">FLUJO PARALELO</span>
                                            {group.branches!.map(b => {
                                                const color = getBranchColor(b.branchId);
                                                return (
                                                    <span
                                                        key={b.branchId}
                                                        className={`${color.badge} border text-[9px] font-bold px-1.5 py-0.5 rounded`}
                                                    >
                                                        {b.label}
                                                    </span>
                                                );
                                            })}
                                        </div>

                                        {/* Parallel lanes */}
                                        <div className="flex gap-3 justify-center w-full">
                                            {group.branches!.map(branch => {
                                                const color = getBranchColor(branch.branchId);
                                                return (
                                                    <div
                                                        key={branch.branchId}
                                                        className={`flex flex-col items-center gap-0 px-3 py-2 rounded-lg border-2 ${color.border} ${color.bg} min-w-[180px] flex-1 max-w-md`}
                                                    >
                                                        <div className={`text-[10px] font-bold ${color.text} mb-1`}>
                                                            {branch.label}
                                                        </div>
                                                        {branch.steps.map((step, si) => (
                                                            <React.Fragment key={step.id}>
                                                                {si > 0 && (
                                                                    <ArrowDown size={12} className={color.text} strokeWidth={2} />
                                                                )}
                                                                <StepCard step={step} compact />
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Join indicator */}
                                        <div className="flex items-center gap-2 py-1">
                                            <GitMerge size={14} className="text-teal-600" />
                                            <span className="text-[10px] font-bold text-teal-700">CONVERGENCIA</span>
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Click hint */}
                    <p className="text-center text-[10px] text-gray-400 mt-2">
                        Hacé clic en cualquier paso para ir a su posición en la tabla
                    </p>
                </div>
            )}
        </div>
    );
};

export default React.memo(PfdFlowMap);
