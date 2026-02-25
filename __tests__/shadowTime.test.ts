import { RotaryInjectionStrategy } from '../modules/strategies/RotaryStrategy';
import { ManualOperation } from '../types';

describe('RotaryStrategy - Shadow Time Logic', () => {
    const strategy = new RotaryInjectionStrategy();

    // Helper to create basic params
    const createParams = (puIny: number, puCur: number, manualOps: ManualOperation[]) => ({
        puInyTime: puIny,
        puCurTime: puCur,
        manualOps: manualOps,
        manualTimeOverride: null,
        taktTime: 60,
        headcountMode: 'manual' as const,
        userHeadcountOverride: 1,
        activeShifts: 1,
        oee: 1,
        cycleQuantity: 1
    });

    it('Scenario A: Absorption (Machine Time Dominant)', () => {
        // Machine Cycle = Iny(10) + Cur(50) = 60s
        // Manual Internal = 20s
        // Expected: Real Cycle = 60s (Manual absorbed), Op Wait = 40s

        const manualOps: ManualOperation[] = [
            { id: '1', description: 'Internal Task', time: 20, type: 'internal' }
        ];

        const results = strategy.calculate(createParams(10, 50, manualOps));

        // Find N=1 scenario
        const scenario = results.find(r => r.n === 1);

        expect(scenario).toBeDefined();
        // Since N=1 < N*=6, machine cycle is loop time = 60s.
        expect(scenario?.realCycle).toBe(60);
        expect(scenario?.waitOp).toBe(40); // 60 - 20
    });

    it('Scenario B: Bottleneck (Manual Time Dominant)', () => {
        // Machine Cycle = 60s
        // Manual Internal = 70s
        // Expected: Real Cycle = 70s (Machine waits 10s), Op Wait = 0s

        const manualOps: ManualOperation[] = [
            { id: '1', description: 'Heavy Internal Task', time: 70, type: 'internal' }
        ];

        const results = strategy.calculate(createParams(10, 50, manualOps));
        const scenario = results.find(r => r.n === 1);

        expect(scenario).toBeDefined();
        expect(scenario?.realCycle).toBe(70);
        expect(scenario?.waitOp).toBe(0);
    });

    it('Scenario C: External Time Adds Linearly', () => {
        // Machine Cycle = 60s
        // Manual Internal = 10s
        // Manual External = 10s
        // Expected: 
        //   Effective Machine = Max(60, 10) = 60s
        //   Real Cycle = 60 + 10 = 70s

        const manualOps: ManualOperation[] = [
            { id: '1', description: 'Internal', time: 10, type: 'internal' },
            { id: '2', description: 'External', time: 10, type: 'external' }
        ];

        const results = strategy.calculate(createParams(10, 50, manualOps));
        const scenario = results.find(r => r.n === 1);

        expect(scenario).toBeDefined();
        expect(scenario?.realCycle).toBe(70);
    });
});
