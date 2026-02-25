/**
 * GlobalStatusSemaphore - Phase 9: Dashboard Global Status Widget
 * 
 * A traffic light indicator showing the overall health status of a study:
 * - GREEN: TCR <= Takt (demand can be met)
 * - YELLOW: TCR is within 10% of Takt (at risk)
 * - RED: TCR > Takt (demand cannot be met)
 * 
 * Can be used in Dashboard or any overview screen.
 */
import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, TrendingUp } from 'lucide-react';

export type SemaphoreStatus = 'green' | 'yellow' | 'red' | 'unknown';

interface GlobalStatusSemaphoreProps {
    /** Current real cycle time (seconds) */
    realCycleTime: number;
    /** Target Takt time (seconds) */
    taktTime: number;
    /** Whether to show compact mode (just icon) */
    compact?: boolean;
    /** Optional className for styling */
    className?: string;
}

/**
 * Calculate the semaphore status based on TCR vs Takt
 */
export const calculateGlobalStatus = (
    realCycleTime: number,
    taktTime: number
): { status: SemaphoreStatus; message: string; percentage: number } => {
    if (taktTime <= 0 || realCycleTime <= 0) {
        return {
            status: 'unknown',
            message: 'Sin datos suficientes',
            percentage: 0
        };
    }

    const ratio = realCycleTime / taktTime;
    const percentage = Math.round((1 - (realCycleTime / taktTime)) * 100);

    if (ratio <= 0.90) {
        // TCR is at least 10% under Takt - comfortable margin
        return {
            status: 'green',
            message: `✓ Cumplimiento OK (+${Math.abs(percentage)}% margen)`,
            percentage
        };
    } else if (ratio <= 1.0) {
        // TCR is within 10% of Takt - at risk
        return {
            status: 'yellow',
            message: `⚠ Capacidad justa (${Math.abs(percentage)}% margen)`,
            percentage
        };
    } else {
        // TCR exceeds Takt - cannot meet demand
        return {
            status: 'red',
            message: `✗ Déficit de capacidad (${Math.abs(percentage)}% sobre)`,
            percentage
        };
    }
};

export const GlobalStatusSemaphore: React.FC<GlobalStatusSemaphoreProps> = ({
    realCycleTime,
    taktTime,
    compact = false,
    className = ''
}) => {
    const { status, message, percentage } = calculateGlobalStatus(realCycleTime, taktTime);

    const statusConfig = {
        green: {
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            text: 'text-emerald-700',
            icon: CheckCircle2,
            iconColor: 'text-emerald-500',
            glow: 'shadow-emerald-200'
        },
        yellow: {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-700',
            icon: AlertCircle,
            iconColor: 'text-amber-500',
            glow: 'shadow-amber-200'
        },
        red: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-700',
            icon: XCircle,
            iconColor: 'text-red-500',
            glow: 'shadow-red-200'
        },
        unknown: {
            bg: 'bg-slate-50',
            border: 'border-slate-200',
            text: 'text-slate-500',
            icon: TrendingUp,
            iconColor: 'text-slate-400',
            glow: ''
        }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    if (compact) {
        return (
            <div
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${config.bg} ${config.border} border-2 ${config.glow} shadow-sm ${className}`}
                title={message}
            >
                <Icon size={16} className={config.iconColor} />
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${config.bg} ${config.border} ${config.glow} shadow-sm ${className}`}>
            <div className={`p-2 rounded-full ${config.bg} border ${config.border}`}>
                <Icon size={24} className={config.iconColor} />
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${config.text}`}>
                        Estado de Producción
                    </span>
                </div>
                <p className={`text-xs ${config.text} opacity-80`}>
                    {message}
                </p>
            </div>
            {status !== 'unknown' && (
                <div className="text-right">
                    <span className={`text-lg font-bold ${config.text}`}>
                        {realCycleTime.toFixed(1)}s
                    </span>
                    <span className="text-xs text-slate-400 block">
                        vs {taktTime.toFixed(1)}s Takt
                    </span>
                </div>
            )}
        </div>
    );
};

export default GlobalStatusSemaphore;
