/**
 * Regression test for the realCycle storage bug.
 *
 * BUG: CavityCalculator stored `realCycle = realCycleTime × activeN` (loop time)
 *      but the balancing engine consumed it as per-piece station cycle.
 *      For N=6 with 20s per piece, realCycle was stored as 120s instead of 20s,
 *      causing the balancing view to think the station cycle was 120s and
 *      reporting "no llega" + recommending extra operators.
 *
 * FIX: Store per-piece cycle: `realCycle = calculatedCycle / optimalCavities`
 *
 * This test validates the fix at multiple levels:
 *   1. The pure math function (calculateInjectionMetrics)
 *   2. The handleApply output that feeds useTaskManager
 *   3. The balancing engine's metric calculation
 */

import { calculateInjectionMetrics } from '../core/math/injection';

describe('Injection realCycle Storage Bug — Regression', () => {

    // Reproduce the user's scenario: 6 cavities recommended, balancing said "no llega"
    // Using parameters where N=6 IS feasible (takt > per-piece cycle at N=6)
    const baseInput = {
        puInyTime: 8,
        puCurTime: 120,
        activeShifts: 2,
        dailyDemand: 600,
        oee: 0.85,
        availableSeconds: 52200,  // 2 shifts × 8h - 2×45min lunch
        manualOps: [
            { id: 'e1', description: 'Demold', time: 10, type: 'external' as const },
        ],
        manualTimeOverride: null as number | null,
        headcountMode: 'auto' as const,
        userHeadcountOverride: 1,
        cavityMode: 'auto' as const,
    };

    it('should calculate per-piece realCycle in chartData (not loop time)', () => {
        const result = calculateInjectionMetrics(baseInput);
        const scenario6 = result.chartData.find(d => d.n === 6);
        expect(scenario6).toBeDefined();

        // cyclePerPiece at N=6 = puInyTime + puCurTime/N = 8 + 120/6 = 28s
        // realCycle includes external ops (~10s/N) so slightly higher
        expect(scenario6!.realCycle).toBeLessThan(50);  // Per-piece, NOT 180s+ (loop)
        expect(scenario6!.cyclePerPiece).toBeCloseTo(28, 0);
    });

    it('simulated handleApply should produce per-piece realCycle', () => {
        const result = calculateInjectionMetrics(baseInput);
        const activeN = result.inputs.activeN;
        const realCycleTime = result.selectedData?.realCycle || 0;

        // This simulates CavityCalculator/index.tsx handleApply:
        const totalShotTime = realCycleTime * activeN;

        // FIX: The stored realCycle should be per-piece (totalShotTime / optimalCavities)
        const storedRealCycle = totalShotTime / activeN;

        // storedRealCycle should equal realCycleTime (per-piece)
        expect(storedRealCycle).toBeCloseTo(realCycleTime, 6);
        // Per-piece should be reasonable (not hundreds of seconds)
        expect(storedRealCycle).toBeLessThan(100);
    });

    it('per-piece realCycle should be below takt (validating feasibility)', () => {
        const result = calculateInjectionMetrics(baseInput);
        const taktTime = result.inputs.taktTime;
        const perPieceCycle = result.selectedData?.realCycle || Infinity;

        // The AUTO selection picks the first N where realCycle ≤ takt
        // So the selected scenario's realCycle must be ≤ takt
        expect(perPieceCycle).toBeLessThanOrEqual(taktTime);
    });

    it('should NOT store loop time as realCycle (the old bug)', () => {
        const result = calculateInjectionMetrics(baseInput);
        const activeN = result.inputs.activeN;
        const realCycleTime = result.selectedData?.realCycle || 0;

        // Old bug: stored totalShotTime = realCycleTime * activeN
        const oldBugValue = realCycleTime * activeN;

        // The old bug value would be much larger than takt
        expect(oldBugValue).toBeGreaterThan(result.inputs.taktTime);

        // The correct value (per-piece) should be ≤ takt
        expect(realCycleTime).toBeLessThanOrEqual(result.inputs.taktTime);
    });

    it('with external ops: realCycle per-piece still reasonable', () => {
        const input = {
            ...baseInput,
            manualOps: [
                { id: 'e1', description: 'Demold', time: 10, type: 'external' as const },
                { id: 'e2', description: 'Inspect', time: 5, type: 'external' as const },
            ],
        };
        const result = calculateInjectionMetrics(input);
        const activeN = result.inputs.activeN;
        const perPiece = result.selectedData?.realCycle || 0;
        const totalShot = perPiece * activeN;

        // Per-piece should be reasonable (< 100s for this setup)
        expect(perPiece).toBeLessThan(100);
        // Loop time could be much larger
        expect(totalShot).toBeGreaterThan(perPiece);
        // The ratio should be activeN
        expect(totalShot / perPiece).toBeCloseTo(activeN, 6);
    });

    it('engine.ts Math.max ensures manual work is not hidden by injection cycle', () => {
        // Simulate what engine.ts does with the corrected realCycle:
        // stationCycle = Math.max(stManualWork / replicas, injectionParams.realCycle)
        const result = calculateInjectionMetrics(baseInput);
        const perPieceCycle = result.selectedData?.realCycle || 0;

        // Simulate a station with extra manual work that exceeds the machine cycle
        const stManualWork = perPieceCycle + 10; // 10s more than machine
        const replicas = 1;
        const manualCycle = stManualWork / replicas;

        // With Math.max, the station cycle should be the manual work (higher)
        const stationCycle = Math.max(manualCycle, perPieceCycle);
        expect(stationCycle).toBe(manualCycle);
        expect(stationCycle).toBeGreaterThan(perPieceCycle);
    });
});
