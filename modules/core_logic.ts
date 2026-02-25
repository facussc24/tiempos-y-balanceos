
/**
 * Core Logic for RALBP Calculation
 * Contains critical formulas for Takt Time, Minimum Cavities, and Operator Limits.
 */

/**
 * Calculates Takt Time (Rhythm of the Customer)
 * @param availableSeconds Total productive seconds available per day
 * @param demand Daily demand in units
 * @returns Takt Time in seconds per unit
 */
export const calculateTaktTime = (availableSeconds: number, demand: number): number => {
    if (demand <= 0) return 0;
    return availableSeconds / demand;
};

/**
 * Calculates Minimum Cavities required to meet Takt Time given Curing Time constraint.
 * N_cav_min = Ceil(Curing Time / Takt Time)
 * @param curingTime Time in seconds for the curing process (chemical constraint)
 * @param taktTime Takt Time in seconds per unit
 * @returns Minimum integer number of cavities
 */
export const calculateMinCavities = (curingTime: number, taktTime: number): number => {
    if (taktTime <= 0) return 1;
    return Math.max(1, Math.ceil(curingTime / taktTime));
};

/**
 * Calculates Theoretical Minimum Operators required (SALBP-1)
 * N_op_min = Ceil(Total Manual Work / Target Cycle)
 * Where Target Cycle is usually Takt Time (unless machine is bottleneck, but for planning we use Takt)
 * @param totalManualWork Total manual labor time per unit in seconds
 * @param targetCycle Target Cycle Time (usually Takt Time) in seconds
 * @returns Minimum integer number of operators
 */
export const calculateMinOperators = (totalManualWork: number, targetCycle: number): number => {
    if (targetCycle <= 0) return 1;
    return Math.max(1, Math.ceil(totalManualWork / targetCycle));
};
