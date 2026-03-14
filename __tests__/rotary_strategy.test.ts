
import { RotaryInjectionStrategy } from '../modules/strategies/RotaryStrategy';
import { InjectionSimulationParams } from '../types';

describe('RotaryInjectionStrategy Logic', () => {
    const strategy = new RotaryInjectionStrategy();

    it('should calculate cycle time using sequential logic (Iny + Cur/N)', () => {
        // Scenario from User Report:
        // Injection: 20s
        // Curing: 300s
        // Cavities (Stations): 7
        // Manual External: 0s (implied for pure machine test)

        // CORRECT Logic (Expert Validated): Iny + Cur/N
        // 20 + 300/7 = 20 + 42.857 = 62.857s

        // OLD (Buggy) Logic was: Max(Iny, Cur/N) = 42.857s (WRONG)
        // Injection and Curing are SEQUENTIAL, not parallel

        const params: InjectionSimulationParams = {
            puInyTime: 20,
            puCurTime: 300,
            manualOps: [], // No manual load to isolate machine math
            manualTimeOverride: 0,
            taktTime: 45,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            activeShifts: 1,
            oee: 1,
            cycleQuantity: 1 // Internal logic handles N iteration
        };

        const results = strategy.calculate(params);

        // Find result for N=7
        const resultN7 = results.find(r => r.n === 7);
        expect(resultN7).toBeDefined();

        // CORRECT: Iny + Cur/N = 20 + 42.857 = 62.857
        expect(resultN7?.cyclePerPiece).toBeCloseTo(62.857, 2);
    });

    it('should add external manual time correctly to the cycle', () => {
        // Same scenario + 15s External Manual Time
        // Base Machine Cycle = 20 + 300/7 = 62.857s
        // External adds: 15/7 = 2.14s
        // Total = 62.857 + 2.14 = 65s (approx)

        const params: InjectionSimulationParams = {
            puInyTime: 20,
            puCurTime: 300,
            manualOps: [{ id: 'm1', description: 'Ext', time: 15, type: 'external' }],
            manualTimeOverride: null, // use ops
            taktTime: 45,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            activeShifts: 1,
            oee: 1,
            cycleQuantity: 1
        };

        const results = strategy.calculate(params);
        const resultN7 = results.find(r => r.n === 7);

        // Expected: BaseMachine (62.857) + External(15/7 = 2.14) = 65.00s
        expect(resultN7?.realCycle).toBeCloseTo(65.00, 1);
    });

    it('should treat manualTimeOverride as INTERNAL (absorbed) by default', () => {
        // Phase 16 Fix: The generic "Carga Operador" input (override) should be treated 
        // as Internal work for Rotary machines, as operators typically work during the cycle.

        const params: InjectionSimulationParams = {
            puInyTime: 20,
            puCurTime: 300,
            manualOps: [],
            manualTimeOverride: 15, // THE OVERRIDE -> Should be Internal
            taktTime: 45, // Takt is 45s
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            activeShifts: 1,
            oee: 1,
            cycleQuantity: 1
        };

        const results = strategy.calculate(params);
        const resultN7 = results.find(r => r.n === 7);

        // Analysis with CORRECT logic:
        // Machine Cycle per piece = Iny + Cur/N = 20 + 300/7 = 62.857s
        // Manual Internal per piece = 15 (for full shot) - absorbed by machine loop
        // Since Internal (15) < MachineLoop (62.857*7 = 440), it's absorbed
        // Result = 62.857s

        expect(resultN7?.realCycle).toBeCloseTo(62.857, 2);
    });
});
