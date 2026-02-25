/**
 * ProgressIndicator Component
 * 
 * Shows visual feedback during long-running operations.
 * Displays step-by-step progress with animations.
 * 
 * @module ProgressIndicator
 * @version 1.0.0
 */

import React from 'react';
import { Loader2, Check, Circle } from 'lucide-react';

export interface ProgressStep {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
}

interface ProgressIndicatorProps {
    /** Array of steps to display */
    steps: ProgressStep[];
    /** Current overall progress 0-100 */
    progress?: number;
    /** Title to show above the progress */
    title?: string;
    /** Optional message for current step */
    message?: string;
    /** Size variant */
    variant?: 'default' | 'compact' | 'inline';
}

/**
 * Step Icon based on status
 */
const StepIcon: React.FC<{ status: ProgressStep['status'] }> = ({ status }) => {
    switch (status) {
        case 'completed':
            return (
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check size={12} className="text-white" strokeWidth={3} />
                </div>
            );
        case 'active':
            return (
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                    <Loader2 size={12} className="text-white animate-spin" />
                </div>
            );
        case 'error':
            return (
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">!</span>
                </div>
            );
        default:
            return (
                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
                    <Circle size={8} className="text-slate-400" />
                </div>
            );
    }
};

/**
 * ProgressIndicator Component
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
    steps,
    progress,
    title,
    message,
    variant = 'default'
}) => {
    const completedCount = steps.filter(s => s.status === 'completed').length;
    const calculatedProgress = progress ?? Math.round((completedCount / steps.length) * 100);

    if (variant === 'inline') {
        // Inline variant: Just spinner + message
        const activeStep = steps.find(s => s.status === 'active');
        return (
            <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 size={16} className="animate-spin text-blue-500" />
                <span>{activeStep?.label || message || 'Procesando...'}</span>
            </div>
        );
    }

    if (variant === 'compact') {
        // Compact variant: Progress bar + current step
        const activeStep = steps.find(s => s.status === 'active');
        return (
            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">
                        {activeStep?.label || 'Procesando...'}
                    </span>
                    <span className="text-xs text-slate-500">{calculatedProgress}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${calculatedProgress}%` }}
                    />
                </div>
            </div>
        );
    }

    // Default variant: Full step display
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
            {/* Header */}
            {title && (
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800">{title}</h3>
                    <span className="text-sm font-mono text-blue-600">{calculatedProgress}%</span>
                </div>
            )}

            {/* Progress Bar */}
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                <div
                    className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${calculatedProgress}%` }}
                />
            </div>

            {/* Steps */}
            <div className="space-y-3">
                {steps.map((step, index) => (
                    <div
                        key={step.id}
                        className={`flex items-center gap-3 transition-all duration-200 ${step.status === 'active' ? 'scale-[1.02]' : ''
                            } ${step.status === 'pending' ? 'opacity-50' : ''}`}
                    >
                        <StepIcon status={step.status} />
                        <span className={`text-sm ${step.status === 'active' ? 'font-semibold text-blue-700' :
                            step.status === 'completed' ? 'text-emerald-700' :
                                step.status === 'error' ? 'text-red-700' :
                                    'text-slate-500'
                            }`}>
                            {step.label}
                        </span>
                        {step.status === 'active' && (
                            <span className="text-xs text-blue-500 animate-pulse ml-auto">
                                En progreso...
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* Message */}
            {message && (
                <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 text-center">
                    {message}
                </p>
            )}
        </div>
    );
};

/**
 * Overlay version that covers the entire container
 */
interface ProgressOverlayProps extends ProgressIndicatorProps {
    isVisible: boolean;
}

export const ProgressOverlay: React.FC<ProgressOverlayProps> = ({
    isVisible,
    ...props
}) => {
    if (!isVisible) return null;

    return (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-40 flex items-center justify-center animate-in fade-in duration-200">
            <div className="w-full max-w-sm">
                <ProgressIndicator {...props} />
            </div>
        </div>
    );
};

/**
 * Hook for managing progress state
 */
export function useProgressSteps(stepLabels: string[]) {
    const [currentStep, setCurrentStep] = React.useState(-1);
    const [error, setError] = React.useState<string | null>(null);

    const steps: ProgressStep[] = stepLabels.map((label, index) => ({
        id: `step-${index}`,
        label,
        status: error && index === currentStep ? 'error' :
            index < currentStep ? 'completed' :
                index === currentStep ? 'active' :
                    'pending'
    }));

    const start = () => {
        setCurrentStep(0);
        setError(null);
    };

    const next = () => {
        setCurrentStep(prev => Math.min(prev + 1, stepLabels.length));
    };

    const complete = () => {
        setCurrentStep(stepLabels.length);
    };

    const fail = (errorMessage: string) => {
        setError(errorMessage);
    };

    const reset = () => {
        setCurrentStep(-1);
        setError(null);
    };

    const isRunning = currentStep >= 0 && currentStep < stepLabels.length;
    const isComplete = currentStep >= stepLabels.length;

    return {
        steps,
        currentStep,
        isRunning,
        isComplete,
        error,
        start,
        next,
        complete,
        fail,
        reset
    };
}

export default ProgressIndicator;
