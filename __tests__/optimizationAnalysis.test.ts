import { analyzeImprovementOpportunities } from '../modules/CavityCalculator/logic/optimizationAnalysis';

describe('analyzeImprovementOpportunities', () => {
    // Helper to create mock scenarios
    // Updated to match InjectionScenario interface (approx)
    const createScenario = (n: number, reqOperators: number, dailyOutput: number, manualLimitCycle: number, cyclePerPiece: number, machineStatus: string = 'optimal'): any => ({
        n,
        reqOperators,
        dailyOutput,
        manualLimitCycle,
        cyclePerPiece, // Machine Cycle
        realCycle: Math.max(manualLimitCycle, cyclePerPiece),
        machineStatus,
        isFeasible: true
    });

    it('should suggest adding an operator when labor constrained', () => {
        // N=2, 1 Op. Machine Cycle 30s. Manual Limit 60s (Bottleneck). Output derived from 60s cycle.
        const current = createScenario(2, 1, 1000, 60, 30);
        // We don't need "betterLabor" in the array anymore, logic derives it.
        const all = [current];

        const result = analyzeImprovementOpportunities(current, all, 4);

        expect(result).not.toBeNull();
        expect(result?.type).toBe('ADD_OPERATOR');
        // Gain calculation:
        // Current: 60s cycle.
        // New Manual: 60 * 1/2 = 30s.
        // New Real: max(30, 30) = 30s.
        // Speed x2 (+100%).
        expect(result?.impactPercentage).toBeCloseTo(100);
        expect(result?.description).toContain('Agregar 1 operario');
    });

    it('should suggest adding a cavity when Labor OK but N < N*', () => {
        // N=2, 2 Ops. MnL 30s. Mch 30s. Output 2000.
        const current = createScenario(2, 2, 2000, 30, 30);
        // N=3, 2 Ops. MnL 30s. Mch 30s. Output 3000 (roughly).
        const nextCavity = createScenario(3, 2, 3000, 30, 30);
        const all = [current, nextCavity];

        const result = analyzeImprovementOpportunities(current, all, 4);

        expect(result).not.toBeNull();
        expect(result?.type).toBe('ADD_CAVITY');
        expect(result?.impactPercentage).toBeCloseTo(50);
        expect(result?.description).toContain('Pasar a 3 cavidades');
    });

    it('should return OPTIMAL when at N* and not labor bound', () => {
        const current = createScenario(4, 3, 4000, 30, 30);
        const all = [current];

        const result = analyzeImprovementOpportunities(current, all, 4);

        expect(result?.type).toBe('OPTIMAL');
    });
});
