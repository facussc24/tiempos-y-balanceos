/**
 * WorkflowProgress Component
 * 
 * Visual progress indicator showing the current step in the workflow.
 * Displays: Config → Tasks → Balance → Analysis → Reports
 * 
 * @module WorkflowProgress
 * @version 1.1.0 - Enhanced motion (H-09)
 */

import React from 'react';
import { Check, Circle, Loader2 } from 'lucide-react';
import { WorkflowStep, WorkflowStepStatus } from '../../hooks/useWorkflowProgress';
import { Tab } from '../../hooks/useAppNavigation';

interface WorkflowProgressProps {
    steps: WorkflowStep[];
    currentStepIndex: number;
    overallProgress: number;
    onNavigate: (tab: Tab) => void;
    compact?: boolean;
}

/**
 * Step Icon based on status
 */
const StepIcon: React.FC<{ status: WorkflowStepStatus; index: number }> = ({ status, index }) => {
    if (status === 'completed') {
        return (
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm transform transition-transform duration-300 scale-100 animate-in zoom-in-75">
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
            <span className="text-xs font-bold text-slate-500">{index + 1}</span>
        </div>
    );
};

/**
 * Connector line between steps - with smooth width/color animation
 */
const StepConnector: React.FC<{ isCompleted: boolean }> = ({ isCompleted }) => (
    <div className="flex-1 h-0.5 mx-1 relative overflow-hidden bg-slate-200 rounded-full">
        <div
            className={`absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-500 ease-out ${isCompleted ? 'w-full' : 'w-0'
                }`}
        />
    </div>
);

/**
 * WorkflowProgress Component
 */
export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
    steps,
    currentStepIndex,
    overallProgress,
    onNavigate,
    compact = false
}) => {
    return (
        <div className="bg-white border-b border-slate-100 print:hidden">
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="py-3">
                    {/* Progress bar (subtle) */}
                    <div className="h-1 bg-slate-100 rounded-full mb-3 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${overallProgress}%` }}
                        />
                    </div>

                    {/* Steps */}
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => (
                            <React.Fragment key={step.id}>
                                {/* Step */}
                                <button
                                    onClick={() => onNavigate(step.navTarget)}
                                    aria-current={step.status === 'in-progress' ? 'step' : undefined}
                                    className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all group ${step.status === 'in-progress'
                                        ? 'bg-blue-50 ring-1 ring-blue-200'
                                        : 'hover:bg-slate-50'
                                        }`}
                                    title={step.description}
                                >
                                    <StepIcon status={step.status} index={index} />

                                    {!compact && (
                                        <div className="flex flex-col items-start">
                                            <span className={`text-xs font-semibold transition-colors ${step.status === 'completed' ? 'text-emerald-600' :
                                                step.status === 'in-progress' ? 'text-blue-600' :
                                                    'text-slate-400 group-hover:text-slate-600'
                                                }`}>
                                                {step.shortLabel}
                                            </span>
                                            {step.status === 'in-progress' && (
                                                <span className="text-[10px] text-blue-500 hidden sm:block">
                                                    En progreso
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>

                                {/* Connector */}
                                {index < steps.length - 1 && (
                                    <StepConnector isCompleted={step.status === 'completed'} />
                                )}
                            </React.Fragment>
                        ))}

                        {/* Contextual step indicator */}
                        <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
                            <div className="flex flex-col items-end">
                                <span className="text-lg font-bold text-slate-800">
                                    {steps.filter(s => s.status === 'completed').length}/{steps.length}
                                </span>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Pasos</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Compact version for mobile or narrow screens
 */
export const WorkflowProgressCompact: React.FC<WorkflowProgressProps> = (props) => {
    return <WorkflowProgress {...props} compact />;
};

export default WorkflowProgress;
