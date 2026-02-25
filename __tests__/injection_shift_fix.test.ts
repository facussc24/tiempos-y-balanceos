/**
 * Bug #3 Regression Test: Injection Shift Configuration Fix
 * 
 * This test verifies that calculateInjectionMetrics uses the provided
 * availableSeconds parameter instead of hardcoded SECONDS_IN_SHIFT (8 hours).
 */
import { calculateInjectionMetrics } from '../core/math/injection';

describe('Bug #3 Fix: Injection uses real shift config', () => {
    const baseParams = {
        puInyTime: 20,
        puCurTime: 120,
        activeShifts: 1,
        dailyDemand: 500,
        oee: 0.85,
        manualOps: [],
        manualTimeOverride: null,
        headcountMode: 'auto' as const,
        userHeadcountOverride: 1,
        cavityMode: 'auto' as const
    };

    it('should use availableSeconds when provided (7-hour shift)', () => {
        const result = calculateInjectionMetrics({
            ...baseParams,
            availableSeconds: 25200, // 7 hours (7 * 3600 = 25200), not 8!
        });

        // Takt = 25200 * 0.85 / 500 = 42.84s
        // With 8h hardcoded: 28800 * 0.85 / 500 = 48.96s
        expect(result.inputs.taktTime).toBeCloseTo(42.84, 1);
    });

    it('should fallback to 8-hour constant when availableSeconds not provided', () => {
        const result = calculateInjectionMetrics({
            ...baseParams,
            // No availableSeconds - should fallback
        });

        // Takt = 28800 * 0.85 / 500 = 48.96s (fallback to 8 hours)
        expect(result.inputs.taktTime).toBeCloseTo(48.96, 1);
    });

    it('should calculate correct N* with real shift config (shorter shifts need more cavities)', () => {
        // With 7h shift (shorter), takt is lower, so we might need more cavities
        const shortShiftResult = calculateInjectionMetrics({
            ...baseParams,
            availableSeconds: 25200, // 7 hours
        });

        const defaultResult = calculateInjectionMetrics({
            ...baseParams,
            // 8 hours default
        });

        // Shorter shift = lower takt = potentially more cavities needed
        // N_min = ceil(curingTime / taktTime)
        // Short: ceil(120 / 42.84) = 3
        // Default: ceil(120 / 48.96) = 3
        // (In this case both are 3, but the takt times differ)
        expect(shortShiftResult.inputs.taktTime).toBeLessThan(defaultResult.inputs.taktTime);
    });

    it('should handle edge case: availableSeconds = 0 (division by zero protection)', () => {
        const result = calculateInjectionMetrics({
            ...baseParams,
            availableSeconds: 0,
        });

        // With 0 available seconds, takt should be 0 (handled gracefully)
        expect(result.inputs.taktTime).toBe(0);
    });

    it('should integrate correctly in the full calculation chain', () => {
        const result = calculateInjectionMetrics({
            ...baseParams,
            availableSeconds: 21600, // 6 hours (extreme case)
        });

        // Takt = 21600 * 0.85 / 500 = 36.72s
        expect(result.inputs.taktTime).toBeCloseTo(36.72, 1);

        // With such a short takt, we'd need more cavities to keep up
        // N_min = ceil(120 / 36.72) = 4
        expect(result.inputs.activeN).toBeGreaterThanOrEqual(4);
    });
});

/**
 * Bug #4 Regression Test: RotaryStrategy dailyOutput Fix
 * 
 * This test verifies that RotaryStrategy uses availableSeconds
 * for dailyOutput calculation instead of hardcoded 8 hours.
 */
describe('Bug #4 Fix: RotaryStrategy uses real shift config for dailyOutput', () => {
    const baseParams = {
        puInyTime: 20,
        puCurTime: 120,
        activeShifts: 1,
        dailyDemand: 500,
        oee: 0.85,
        manualOps: [],
        manualTimeOverride: null,
        headcountMode: 'auto' as const,
        userHeadcountOverride: 1,
        cavityMode: 'auto' as const
    };

    it('should calculate lower dailyOutput with shorter shift (7h vs 8h)', () => {
        const shortShiftResult = calculateInjectionMetrics({
            ...baseParams,
            availableSeconds: 25200, // 7 hours
        });

        const defaultResult = calculateInjectionMetrics({
            ...baseParams,
            // 8 hours (fallback)
        });

        // chartData contains scenarios with dailyOutput
        const shortShiftScenario = shortShiftResult.chartData[0];
        const defaultScenario = defaultResult.chartData[0];

        // With 7h shift, dailyOutput should be lower than 8h
        // dailyOutput = (shiftSeconds * activeShifts * oee) / realCycle
        expect(shortShiftScenario.dailyOutput).toBeLessThan(defaultScenario.dailyOutput);
    });

    it('should use correct dailyOutput formula with availableSeconds', () => {
        const result = calculateInjectionMetrics({
            ...baseParams,
            availableSeconds: 21600, // 6 hours
        });

        const scenario = result.chartData[0];
        const realCycle = scenario.realCycle;

        // Expected: (21600 * 1 * 0.85) / realCycle
        const expectedDailyOutput = (21600 * 1 * 0.85) / realCycle;
        expect(scenario.dailyOutput).toBeCloseTo(expectedDailyOutput, 0);
    });
});
