/**
 * AMFE VDA 7-Step Progress Bar
 *
 * Visual indicator showing completion of each AIAG-VDA methodology step.
 * Renders between the header and filters in AmfeApp.
 * Compact by default — click to expand the full 7-step detail.
 */

import React, { useMemo, useState } from 'react';
import { Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { AmfeDocument } from './amfeTypes';
import { computeAmfeStepProgress, computeOverallProgress, AmfeStepStatus } from './amfeStepProgress';

interface Props {
    doc: AmfeDocument;
}

/** Step icon based on completion status */
const StepIcon: React.FC<{ status: AmfeStepStatus['status']; step: number }> = ({ status, step }) => {
    if (status === 'completed') {
        return (
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                <Check size={14} className="text-white" strokeWidth={3} />
            </div>
        );
    }
    if (status === 'in-progress') {
        return (
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow-sm animate-pulse">
                <Loader2 size={14} className="text-white animate-spin" />
            </div>
        );
    }
    return (
        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
            <span className="text-xs font-bold text-slate-500">{step}</span>
        </div>
    );
};

/** Connector line between steps */
const StepConnector: React.FC<{ isCompleted: boolean }> = ({ isCompleted }) => (
    <div className="flex-1 h-0.5 mx-0.5 relative overflow-hidden bg-slate-200 rounded-full">
        <div
            className={`absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-500 ease-out ${isCompleted ? 'w-full' : 'w-0'}`}
        />
    </div>
);

const AmfeStepProgressBar: React.FC<Props> = ({ doc }) => {
    const steps = useMemo(() => computeAmfeStepProgress(doc), [doc]);
    const overall = useMemo(() => computeOverallProgress(steps), [steps]);
    const completedCount = steps.filter(s => s.status === 'completed').length;
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="bg-white border-b border-slate-100">
            {/* Compact bar (always visible) — clickable to expand */}
            <button
                onClick={() => setExpanded(prev => !prev)}
                className="w-full flex items-center gap-3 px-4 py-1.5 hover:bg-gray-50 transition text-left"
                title="Progreso AIAG-VDA 7 pasos — click para expandir"
                aria-label={`Progreso metodología AMFE: ${completedCount} de ${steps.length} pasos completados (${completedCount === 0 && overall < 5 ? 0 : Math.round(overall)}%)`}
                aria-expanded={expanded}
            >
                {/* Thin gradient progress bar */}
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${overall}%` }}
                    />
                </div>
                <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
                    {completedCount === 0 && overall < 5 ? 0 : Math.round(overall)}%
                </span>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {completedCount}/{steps.length} pasos
                </span>
                {expanded ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
            </button>

            {/* Expanded 7-step detail */}
            {expanded && (
                <div className="px-4 pb-2">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => (
                            <React.Fragment key={step.step}>
                                <div className="flex items-center gap-1.5 min-w-0" title={`Paso ${step.step}: ${step.label} (${step.completionPercent}%)`}>
                                    <StepIcon status={step.status} step={step.step} />
                                    <div className="hidden sm:flex flex-col items-start min-w-0">
                                        <span className={`text-[10px] font-semibold truncate ${
                                            step.status === 'completed' ? 'text-emerald-600'
                                            : step.status === 'in-progress' ? 'text-blue-600'
                                            : 'text-slate-400'
                                        }`}>
                                            {step.shortLabel}
                                        </span>
                                        <span className="text-[8px] text-slate-400">{step.completionPercent}%</span>
                                    </div>
                                </div>

                                {index < steps.length - 1 && (
                                    <StepConnector isCompleted={step.status === 'completed'} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AmfeStepProgressBar;
