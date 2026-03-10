/**
 * Shared helpers for AmfeTableBody — constants, color maps, and small presentational components.
 */
import React from 'react';
import { Monitor, User, Box, Settings, Thermometer, Ruler, AlertTriangle } from 'lucide-react';
import { AmfeOperation, AmfeFailure, ActionPriority, WorkElementType } from './amfeTypes';
import { CauseValidationState } from './amfeValidation';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

/** Icon map for each 6M work element type */
export const WE_ICONS: Record<WorkElementType, React.ReactNode> = {
    Machine: <Monitor size={12} />,
    Man: <User size={12} />,
    Material: <Box size={12} />,
    Method: <Settings size={12} />,
    Environment: <Thermometer size={12} />,
    Measurement: <Ruler size={12} />,
};

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/** Color badge for Action Priority (H/M/L) */
export const getApColor = (ap: string) => {
    switch (ap) {
        case ActionPriority.HIGH: return 'bg-red-500 text-white font-bold';
        case ActionPriority.MEDIUM: return 'bg-yellow-400 text-black font-bold';
        case ActionPriority.LOW: return 'bg-green-500 text-white font-bold';
        default: return 'bg-gray-100 text-gray-400';
    }
};

/** Color coding for S/O/D values based on risk level */
export const getSODColor = (value: number | string): string => {
    const num = Number(value);
    if (isNaN(num) || num === 0) return '';
    if (num >= 9) return 'bg-red-100 text-red-900 font-bold';
    if (num >= 7) return 'bg-orange-100 text-orange-900 font-semibold';
    if (num >= 4) return 'bg-yellow-50 text-yellow-900';
    return 'bg-green-50 text-green-800';
};

/** Left-border color based on AP level for cause rows */
export const getCauseRowBorderClass = (ap: string): string => {
    switch (ap) {
        case 'H': return 'border-l-4 border-l-red-500 bg-red-50/20';
        case 'M': return 'border-l-4 border-l-yellow-400 bg-yellow-50/15';
        case 'L': return 'border-l-4 border-l-green-400 bg-green-50/10';
        default: return '';
    }
};

// ---------------------------------------------------------------------------
// Static class maps for effect tabs
// ---------------------------------------------------------------------------

export const TAB_ACTIVE_CLASSES = ['border-blue-500 text-blue-700 bg-blue-50', 'border-orange-500 text-orange-700 bg-orange-50', 'border-red-500 text-red-700 bg-red-50'] as const;
export const TAB_DOT_CLASSES = ['bg-blue-400', 'bg-orange-400', 'bg-red-400'] as const;
export const TAB_BORDER_CLASSES = ['border-l-blue-400', 'border-l-orange-400', 'border-l-red-400'] as const;
export const TAB_LABEL_CLASSES = ['text-blue-600', 'text-orange-600', 'text-red-600'] as const;
export const TAB_SEV_HIGH_CLASSES = ['border-blue-500 bg-blue-100 font-bold', 'border-orange-500 bg-orange-100 font-bold', 'border-red-500 bg-red-100 font-bold'] as const;

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/** Precompute aggregate stats for a collapsed operation summary */
export function computeOpSummary(op: AmfeOperation) {
    let totalFails = 0;
    let totalCauses = 0;
    let highAP = 0;
    for (const w of op.workElements) {
        for (const f of w.functions) {
            totalFails += f.failures.length;
            for (const fl of f.failures) {
                totalCauses += fl.causes.length;
                for (const ca of fl.causes) {
                    if (ca.ap === 'H') highAP++;
                }
            }
        }
    }
    return { totalWE: op.workElements.length, totalFails, totalCauses, highAP };
}

/** Whether a failure has any sub-severity values (makes main S read-only) */
export const hasSubSeverities = (fail: AmfeFailure): boolean =>
    !!(fail.severityLocal || fail.severityNextLevel || fail.severityEndUser);

// ---------------------------------------------------------------------------
// Small presentational components
// ---------------------------------------------------------------------------

/** Validation icon for cause row (shows AlertTriangle with tooltip on errors/warnings) */
export const CauseValidationIcon: React.FC<{ validation: CauseValidationState }> = ({ validation }) => {
    if (validation.level === 'ok') return null;
    const color = validation.level === 'error' ? 'text-red-500' : 'text-amber-500';
    return (
        <div className="relative group/validation inline-block ml-1">
            <AlertTriangle size={12} className={`${color} cursor-help`} />
            <div className="absolute z-50 hidden group-hover/validation:block bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap max-w-[220px]">
                {validation.messages.map((msg, i) => <div key={i}>• {msg}</div>)}
            </div>
        </div>
    );
};
