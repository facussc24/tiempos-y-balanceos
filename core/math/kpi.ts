import { Task } from '../../types';

/**
 * CORE/MATH/KPI.TS
 * 
 * Central Repository for "Expert" Formulas.
 * Use these functions instead of manual implementation to ensure consistency across modules.
 */

/**
 * Calculates total manual work excluding machine/injection tasks.
 * Used for Saturation/Efficiency calculations where machine time should not penalize operator workload.
 */
export const calculateTotalManualWork = (tasks: Task[]): number => {
    return tasks.reduce((sum, t) => {
        // Exclude Machine/Injection types
        if (t.executionMode === 'injection' || t.executionMode === 'machine') return sum;
        // Exclude tasks marked explicitly as internal machine time if schema supports it (future proof)
        // if (t.isMachineInternal) return sum; 
        return sum + (t.standardTime || 0);
    }, 0);
};

/**
 * Calculates Operator Saturation (Efficiency Line).
 * Formula: Total Manual Work / (Total Headcount * Real Cycle Time)
 */
export const calculateLineSaturation = (totalManualWork: number, totalHeadcount: number, realCycleTime: number): number => {
    if (totalHeadcount <= 0 || realCycleTime <= 0) return 0;
    return (totalManualWork / (totalHeadcount * realCycleTime)) * 100;
};

/**
 * Calculates Available Capacity (Slack) vs Takt Time.
 * Positive value = Time Available (Buffer).
 * Negative value = Deficit (Bottleneck vs Demand).
 * Formula: Takt Time - Real Cycle Time
 */
export const calculateAvailableTimeVsTakt = (taktTime: number, realCycleTime: number): number => {
    // Note: We return raw difference. 
    // UI logic should decide if negative is shown as "Loss" or "Deficit".
    return taktTime - realCycleTime;
};

/**
 * Calculates Efficiency vs Takt (Satisfaction of Demand).
 * Formula: Total Manual Work / (Total Headcount * Takt Time)
 * This represents the "Theoretical Best" saturation if the line ran perfectly at Takt.
 */
export const calculateSaturationVsTakt = (totalManualWork: number, totalHeadcount: number, taktTime: number): number => {
    if (totalHeadcount <= 0 || taktTime <= 0) return 0;
    return (totalManualWork / (totalHeadcount * taktTime)) * 100;
};
