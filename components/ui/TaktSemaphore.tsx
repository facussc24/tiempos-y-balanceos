/**
 * TaktSemaphore - Visual indicator of production capability vs demand
 * 
 * Shows a semaphore-style widget indicating whether current production
 * capacity meets customer demand requirements:
 * - GREEN: Capacity >= Demand + 10% margin (safe)
 * - YELLOW: Capacity >= Demand but < 10% margin (tight)
 * - RED: Capacity < Demand (cannot meet)
 * 
 * @module components/ui/TaktSemaphore
 * @version 1.0.0 - Phase 1 Completion
 */
import React, { useMemo } from 'react';
import { CheckCircle, AlertTriangle, XCircle, TrendingUp, TrendingDown } from 'lucide-react';

export interface TaktSemaphoreProps {
    /** Takt time in seconds */
    taktTime: number;
    /** Cycle time of bottleneck station in seconds */
    bottleneckTime: number;
    /** Daily customer demand in pieces */
    dailyDemand: number;
    /** Available production time in seconds per day */
    availableTimeSeconds: number;
    /** Optional: Show compact version without details */
    compact?: boolean;
    /** H-08 UX Audit: Optional action callback for warning/error states */
    onAction?: () => void;
    /** H-08 UX Audit: Action button label (default: 'Ver Opciones') */
    actionLabel?: string;
}

export type SemaphoreStatus = 'green' | 'yellow' | 'red';

export interface SemaphoreResult {
    status: SemaphoreStatus;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ReactNode;
    label: string;
    message: string;
    currentCapacity: number;
    marginPercent: number;
    gap: number; // Positive = surplus, Negative = deficit
}

/**
 * Calculate semaphore status based on capacity vs demand
 * 
 * Logic:
 * - Capacity = AvailableTime / BottleneckTime (or Takt if no bottleneck)
 * - Margin = (Capacity - Demand) / Demand * 100
 * - GREEN: Margin >= 10%
 * - YELLOW: 0% <= Margin < 10%
 * - RED: Margin < 0%
 */
export const calculateSemaphoreStatus = (
    currentCapacity: number,
    dailyDemand: number
): SemaphoreResult => {
    // Handle edge cases
    if (dailyDemand <= 0) {
        return {
            status: 'green',
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
            borderColor: 'border-emerald-200',
            icon: <CheckCircle className="w-6 h-6 text-emerald-600" />,
            label: 'SIN DEMANDA',
            message: 'No hay demanda configurada',
            currentCapacity,
            marginPercent: 100,
            gap: currentCapacity
        };
    }

    if (currentCapacity <= 0) {
        return {
            status: 'red',
            color: 'text-red-600',
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200',
            icon: <XCircle className="w-6 h-6 text-red-600" />,
            label: 'SIN CAPACIDAD',
            message: 'No hay capacidad de producción configurada',
            currentCapacity: 0,
            marginPercent: -100,
            gap: -dailyDemand
        };
    }

    const gap = currentCapacity - dailyDemand;
    const marginPercent = (gap / dailyDemand) * 100;

    // GREEN: >= 10% margin
    if (marginPercent >= 10) {
        return {
            status: 'green',
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
            borderColor: 'border-emerald-200',
            icon: <CheckCircle className="w-6 h-6 text-emerald-600" />,
            label: 'CUMPLE DEMANDA',
            message: `Capacidad: ${Math.round(currentCapacity).toLocaleString()} pz/día (+${marginPercent.toFixed(1)}% margen)`,
            currentCapacity,
            marginPercent,
            gap
        };
    }

    // YELLOW: 0% - 10% margin
    if (marginPercent >= 0) {
        return {
            status: 'yellow',
            color: 'text-amber-600',
            bgColor: 'bg-amber-50',
            borderColor: 'border-amber-200',
            icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
            label: 'MARGEN AJUSTADO',
            message: `Capacidad: ${Math.round(currentCapacity).toLocaleString()} pz/día (+${marginPercent.toFixed(1)}% margen). Poco margen para imprevistos.`,
            currentCapacity,
            marginPercent,
            gap
        };
    }

    // RED: Negative margin (cannot meet demand)
    return {
        status: 'red',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: <XCircle className="w-6 h-6 text-red-600" />,
        label: 'NO CUMPLE DEMANDA',
        message: `Faltan ${Math.abs(Math.round(gap)).toLocaleString()} pz/día. Revisar cuello de botella o agregar capacidad.`,
        currentCapacity,
        marginPercent,
        gap
    };
};

/**
 * Calculate current production capacity from timing parameters
 */
export const calculateCapacity = (
    availableTimeSeconds: number,
    bottleneckTime: number,
    taktTime: number
): number => {
    // Use bottleneck time if available, otherwise use takt
    const effectiveCycleTime = bottleneckTime > 0 ? bottleneckTime : taktTime;

    if (effectiveCycleTime <= 0) return 0;

    return availableTimeSeconds / effectiveCycleTime;
};

export const TaktSemaphore: React.FC<TaktSemaphoreProps> = ({
    taktTime,
    bottleneckTime,
    dailyDemand,
    availableTimeSeconds,
    compact = false,
    onAction,
    actionLabel = 'Ver Opciones'
}) => {
    const result = useMemo(() => {
        const capacity = calculateCapacity(availableTimeSeconds, bottleneckTime, taktTime);
        return calculateSemaphoreStatus(capacity, dailyDemand);
    }, [taktTime, bottleneckTime, dailyDemand, availableTimeSeconds]);

    if (compact) {
        return (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${result.bgColor} ${result.borderColor} border`}>
                {result.icon}
                <span className={`text-sm font-medium ${result.color}`}>
                    {result.label}
                </span>
            </div>
        );
    }

    return (
        <div className={`rounded-lg border-2 ${result.borderColor} ${result.bgColor} p-4`}>
            <div className="flex items-center gap-3 mb-2">
                {result.icon}
                <span className={`text-lg font-bold ${result.color}`}>
                    {result.label}
                </span>
            </div>
            <p className="text-sm text-gray-600">
                {result.message}
            </p>
            {result.gap !== 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                    {result.gap > 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                    <span className={result.gap > 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {result.gap > 0 ? '+' : ''}{Math.round(result.gap).toLocaleString()} pz/día
                    </span>
                </div>
            )}
            {/* H-08 UX Audit: Actionable CTA for warning/error states */}
            {onAction && (result.status === 'yellow' || result.status === 'red') && (
                <button
                    onClick={onAction}
                    className={`mt-3 w-full py-2 px-4 rounded-lg font-medium text-sm transition-all active:scale-95 ${result.status === 'red'
                            ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
                        }`}
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default TaktSemaphore;
