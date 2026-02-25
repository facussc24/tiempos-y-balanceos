import { InjectionScenario } from "../../../types";
import { formatNumber } from "../../../utils";

export interface ImprovementInsight {
    type: 'ADD_OPERATOR' | 'ADD_CAVITY' | 'OPTIMAL' | 'MACHINE_LIMIT';
    title: string;
    description: string;
    impactPercentage: number;
    actionLabel?: string;
}

/**
 * Analyzes the current scenario against all possible scenarios to find the high-ROI "next step".
 * @param currentScenario The currently selected scenario.
 * @param allScenarios List of all simulated scenarios.
 * @param nStar The theoretical maximum cavities (N*).
 */
export const analyzeImprovementOpportunities = (
    currentScenario: InjectionScenario,
    allScenarios: InjectionScenario[],
    nStar: number
): ImprovementInsight | null => {
    if (!currentScenario || !allScenarios.length) return null;

    // 1. Check for Labor Constraints (If we are constrained by manual cycle)
    if (currentScenario.manualLimitCycle > currentScenario.cyclePerPiece + 1) { // +1s buffer
        const currentOp = currentScenario.reqOperators;
        const nextOp = currentOp + 1;

        // Estimate gain with +1 Operator
        const potentialManualCycle = currentScenario.manualLimitCycle * (currentOp / nextOp);
        const potentialRealCycle = Math.max(currentScenario.cyclePerPiece, potentialManualCycle);

        if (potentialRealCycle > 0) {
            const currentHourly = 3600 / currentScenario.realCycle;
            const potentialHourly = 3600 / potentialRealCycle;

            const percentGain = ((potentialHourly - currentHourly) / currentHourly) * 100;

            if (percentGain > 5) {
                return {
                    type: 'ADD_OPERATOR',
                    title: 'Limitado por Mano de Obra',
                    description: `Agregar 1 operario (Total ${nextOp}) aumentaría la producción un ${formatNumber(percentGain)}%.`,
                    impactPercentage: percentGain,
                    actionLabel: `+1 Operario`
                };
            }
        }
    }

    // 2. Check for Cavity Constraints (If Labor is sufficient, look for more cavities)
    if (currentScenario.n < nStar) {
        const nextCavityScenario = allScenarios.find(s => s.n === currentScenario.n + 1);

        if (nextCavityScenario) {
            const currentOutput = currentScenario.dailyOutput;
            const nextOutput = nextCavityScenario.dailyOutput;

            if (currentOutput > 0) {
                const percentGain = ((nextOutput - currentOutput) / currentOutput) * 100;

                if (percentGain > 5) {
                    return {
                        type: 'ADD_CAVITY',
                        title: 'Capacidad de Molde Disponible',
                        description: `Pasar a ${nextCavityScenario.n} cavidades aumentaría la producción un ${formatNumber(percentGain)}%.`,
                        impactPercentage: percentGain,
                        actionLabel: `+1 Cavidad`
                    };
                }
            }
        }
    }

    // 3. Optimal State
    if (currentScenario.n >= nStar && currentScenario.machineStatus === 'optimal') {
        return {
            type: 'OPTIMAL',
            title: 'Configuración Óptima',
            description: 'Estás operando al máximo rendimiento teórico para este ciclo.',
            impactPercentage: 0
        };
    }

    return null;
};
