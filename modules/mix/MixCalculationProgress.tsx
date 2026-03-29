/**
 * MixCalculationProgress - V5.1 Skeleton Loader with Steps
 * 
 * Shows visual progress during Mix calculation:
 * 1. Cargando productos...
 * 2. Calculando tiempos ponderados...
 * 3. Generando análisis por sector...
 */
import React from 'react';
import { Loader2, CheckCircle, Circle } from 'lucide-react';

export type CalculationStep =
    | 'idle'
    | 'loading-products'
    | 'calculating-times'
    | 'generating-analysis'
    | 'complete';

interface MixCalculationProgressProps {
    currentStep: CalculationStep;
    productCount: number;
}

const STEPS = [
    { key: 'loading-products', label: 'Cargando productos', icon: '📦' },
    { key: 'calculating-times', label: 'Calculando tiempos ponderados', icon: '⏱️' },
    { key: 'generating-analysis', label: 'Generando análisis', icon: '📊' }
] as const;

export const MixCalculationProgress: React.FC<MixCalculationProgressProps> = ({
    currentStep,
    productCount
}) => {
    if (currentStep === 'idle' || currentStep === 'complete') {
        return null;
    }

    const currentIndex = STEPS.findIndex(s => s.key === currentStep);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
                <Loader2 className="animate-spin text-indigo-600" size={24} />
                <h3 className="font-semibold text-slate-800">
                    Calculando balance para {productCount} productos...
                </h3>
            </div>

            <div className="space-y-3">
                {STEPS.map((step, index) => {
                    const isComplete = index < currentIndex;
                    const isCurrent = index === currentIndex;

                    return (
                        <div key={step.key} className="flex items-center gap-3">
                            {/* Status Icon */}
                            {isComplete ? (
                                <CheckCircle className="text-emerald-500" size={20} />
                            ) : isCurrent ? (
                                <Loader2 className="animate-spin text-indigo-600" size={20} />
                            ) : (
                                <Circle className="text-slate-300" size={20} />
                            )}

                            {/* Label */}
                            <span className={`text-sm ${isComplete ? 'text-emerald-600' :
                                    isCurrent ? 'text-indigo-700 font-medium' :
                                        'text-slate-400'
                                }`}>
                                {step.icon} {step.label}
                            </span>

                            {/* Progress indicator for current step */}
                            {isCurrent && (
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden ml-2">
                                    <div className="h-full bg-indigo-500 rounded-full animate-pulse"
                                        style={{ width: '60%' }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Step counter */}
            <div className="mt-4 text-right text-xs text-slate-400">
                Paso {currentIndex + 1} de {STEPS.length}
            </div>
        </div>
    );
};

/**
 * Skeleton placeholder for results while loading
 */
export const MixResultsSkeleton: React.FC = () => {
    return (
        <div className="space-y-4 animate-pulse">
            {/* KPIs Skeleton */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6">
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="space-y-2">
                            <div className="h-3 bg-slate-700 rounded w-20" />
                            <div className="h-8 bg-slate-700 rounded w-16" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Chart Skeleton */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="h-4 bg-slate-200 rounded w-48 mb-6" />
                <div className="flex items-end gap-4 h-48 justify-center">
                    {[80, 65, 90, 45, 70, 55].map((h, i) => (
                        <div
                            key={i}
                            className="bg-slate-200 rounded-t w-12"
                            style={{ height: `${h}%` }}
                        />
                    ))}
                </div>
            </div>

            {/* Table Skeleton */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="h-4 bg-slate-200 rounded w-32 mb-4" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-4 py-3 border-b border-slate-100">
                        <div className="h-4 bg-slate-200 rounded w-24" />
                        <div className="h-4 bg-slate-200 rounded w-16" />
                        <div className="h-4 bg-slate-200 rounded w-16" />
                        <div className="h-4 bg-slate-200 rounded w-16" />
                    </div>
                ))}
            </div>
        </div>
    );
};
