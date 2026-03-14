import { SimulationStrategy } from "./SimulationStrategy";
import { InjectionSimulationParams, InjectionScenario } from "../../types";

export class RotaryInjectionStrategy implements SimulationStrategy {
    name = "Inyección Rotativa (Carrousel)";
    description = "Simula máquinas rotativas donde el tiempo de curado se absorbe con múltiples moldes (N*).";

    calculate(params: InjectionSimulationParams): InjectionScenario[] {
        const {
            puInyTime, puCurTime,
            manualOps, manualTimeOverride,
            taktTime, headcountMode, userHeadcountOverride, activeShifts, oee,
            cycleQuantity = 1,
            availableSeconds
        } = params;

        // FIX Bug #4: Use real shift seconds or fallback to 8h constant
        const shiftSeconds = availableSeconds ?? (8 * 3600);

        if (puInyTime <= 0 || puCurTime < 0) {
            return [];
        }

        const data: InjectionScenario[] = [];

        // NORMALIZE INPUTS (User enters Total for Batch, we need Unit Times)
        // FIX: Guard against cycleQuantity=0 to prevent Infinity propagation
        const safeCycleQty = cycleQuantity > 0 ? cycleQuantity : 1;
        const unitInyTime = puInyTime / safeCycleQty;
        const unitCurTime = puCurTime / safeCycleQty;

        // N* Calculation (Ratio remains same regardless of normalization)
        const nStar = Math.ceil(1 + (unitCurTime / (unitInyTime || 1)));
        const maxSim = Math.max(16, Math.min(32, nStar + 2));

        for (let n = 1; n <= maxSim; n++) {
            let totalShotTime = 0;
            let cyclePerPiece = 0;
            let machineStatus = 'optimal';

            // ---------------------------------------------------------
            // PHASE 15: ROTARY STRATEGY LOGIC
            // ---------------------------------------------------------

            // 1. Cycle Per Piece (Theoretical Machine Limit)
            // Rotary Logic: Injection + Distributed Curing (Sequential Process)
            // N* Logic: When N >= N*, distributedCure <= puInyTime, so cycle approaches Iny floor
            const distributedCure = puCurTime / n;
            cyclePerPiece = puInyTime + distributedCure;

            // 2. Machine Loop Time (Time to produce N pieces / 1 Revolution)
            const machineLoopTime = cyclePerPiece * n;

            // 3. Manual Time Breakdown
            let totalInternalTime = 0;
            let totalExternalTime = 0;
            let simEffectiveManualTime = 0;

            if (manualTimeOverride !== null) {
                // Fix Phase 16: Override is treated as INTERNAL (Absorbed) by default for Rotary.
                // Operators work while the table rotates/cures.
                totalInternalTime = manualTimeOverride;
                simEffectiveManualTime = manualTimeOverride;
            } else if (manualOps.length === 0) {
                // Default 15s is Internal (Absorbed)
                totalInternalTime = 15;
                simEffectiveManualTime = 15;
            } else {
                manualOps.forEach(op => {
                    // op.time is Total Per Shot (as input by user or calculated in hook)
                    if (op.type === 'internal') {
                        totalInternalTime += op.time;
                    } else {
                        totalExternalTime += op.time;
                    }
                });
                simEffectiveManualTime = totalExternalTime + totalInternalTime;
            }

            // 4. Real Loop Calculation (Absorbed)
            // If Manual Internal starts dominating the Machine Loop
            const internalConstraint = Math.max(machineLoopTime, totalInternalTime);

            // External Manual always adds to the loop
            const realLoopTime = internalConstraint + totalExternalTime;

            // 5. Real Cycle Per Piece (Simulating Constraints)
            // Logic: (Max(MachineLoop, Internal) + External) / N
            const realCycle = realLoopTime / n;

            const isSingleMachineFeasible = taktTime > 0 ? cyclePerPiece <= taktTime : true;

            // 6. Slacks (Per Shot)
            // Operator Slack: Amount of time Operator waits for Machine
            const waitOp = Math.max(0, machineLoopTime - totalInternalTime);

            // Machine Slack: Amount of time Machine waits for Operator
            const waitMachine = Math.max(0, totalInternalTime - machineLoopTime);

            // 7. Bottleneck Analysis
            const isBottleneckLabor = (totalInternalTime > machineLoopTime);

            // 8. Capacity & Headcount (Smart ROI)
            const totalManualWork = totalInternalTime + totalExternalTime;
            let reqOperators = 1;
            let isFatigueRisk = false;

            if (headcountMode === 'manual') {
                reqOperators = userHeadcountOverride;
            } else {
                const fatigueFactor = 0.85;
                // Req = Work Content / (Availability * Efficiency)
                // Availability = realLoopTime (The machine cycle sets the pace)
                const rawReq = (realLoopTime > 0)
                    ? totalManualWork / (realLoopTime * fatigueFactor)
                    : 1;

                reqOperators = Math.ceil(rawReq);

                // Smart ROI Tolerance (Phase 14)
                if (reqOperators > 1) {
                    const sat = totalManualWork / realLoopTime;
                    if (Math.floor(rawReq) >= 1 && (sat / Math.floor(rawReq)) <= 0.95) {
                        reqOperators = Math.floor(rawReq);
                        isFatigueRisk = true;
                    }
                }
            }

            // 9. Simulation with Active Headcount
            const activeOps = Math.ceil(headcountMode === 'manual' ? (userHeadcountOverride || 1) : reqOperators);

            // If multiple operators, they split the manual work.
            // Human Limit (Per Shot)
            const humanLoopLimit = (totalManualWork === 0)
                ? 0
                : (activeOps > 0 ? (totalManualWork / activeOps) : 999999);

            // Re-eval Real Loop with Human Limit
            // If Human Limit (adjusted) > Machine Loop, then Cycle Extends.
            const adjInternal = totalInternalTime / activeOps;
            const adjExternal = totalExternalTime / activeOps;

            // Sim Real Loop
            const simRealLoop = Math.max(machineLoopTime, adjInternal) + adjExternal;
            totalShotTime = simRealLoop;
            const simRealCycle = simRealLoop / n;

            // Update output variables to use Simulated values
            const finalRealCycle = simRealCycle;

            // Wait Time for UI (Per Piece scaling)
            const waitOpPerPiece = waitOp / n;

            // Metric: machineStatus
            if (isBottleneckLabor) machineStatus = 'waiting'; // Machine waiting for Op
            else if (n < nStar) machineStatus = 'waiting'; // Machine waiting for Cure (Optimal N not reached)
            else machineStatus = 'optimal'; // Running fast

            // Manual Limit Cycle for Data
            const humanCycleLimit = humanLoopLimit / n;

            let barColor = '#6366f1'; // Indigo
            if (!isSingleMachineFeasible) {
                barColor = '#ef4444'; // Red (Takt Violation)
            } else if (n < nStar) {
                barColor = '#0ea5e9'; // Sky (Under saturation)
            } else {
                barColor = '#10b981'; // Emerald (Optimal)
            }

            // D. CAPACITY CALCULATION
            const machinesNeeded = (taktTime > 0 && finalRealCycle > taktTime)
                ? Math.ceil(finalRealCycle / taktTime)
                : 1;

            // E. ZERO CAPEX LOGIC
            const loopTime = puInyTime + unitCurTime; // Fallback for pure machine sizing?
            // Actually, for Rotary, the reqCavities logic is: TargetCycle <= Takt.
            // Max(Iny, Cur/N) <= Takt.
            // So Cur/N <= Takt => N >= Cur/Takt.
            // AND Iny <= Takt (Hard limit).
            const reqCavities = (taktTime > 0) ? Math.ceil(unitCurTime / taktTime) : 1;

            data.push({
                n,
                totalShotTime,
                cyclePerPiece,
                manualLimitCycle: humanCycleLimit,
                waitOp: waitOpPerPiece,
                realCycle: finalRealCycle,
                isFeasible: true,
                isSingleMachineFeasible,
                barColor,
                machineStatus,
                reqOperators,
                machinesNeeded,
                reqCavities,
                dailyOutput: (shiftSeconds * oee) / finalRealCycle,
                manualTime: simEffectiveManualTime,
                isOversaturated: n > nStar,
                isFatigueRisk,
                nStar
            });
        }

        return data;
    }
}
