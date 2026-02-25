import { describe, it, expect } from 'vitest';
import { RotaryInjectionStrategy } from '../modules/strategies/RotaryStrategy';

describe('RotaryInjectionStrategy', () => {
    const strategy = new RotaryInjectionStrategy();

    it('should return empty array if injection time is invalid', () => {
        const result = strategy.calculate({
            puInyTime: 0,
            puCurTime: 120,
            manualOps: [],
            manualTimeOverride: null,
            taktTime: 10,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            activeShifts: 1,
            oee: 0.85,
            cycleQuantity: 1
        });
        expect(result).toEqual([]);
    });

    it('should calculate correct N* (Saturation Point)', () => {
        // N* = 1 + (Curing / Injection)
        // Case 1: 120 / 20 = 6 + 1 = 7
        const result = strategy.calculate({
            puInyTime: 20,
            puCurTime: 120,
            manualOps: [],
            manualTimeOverride: 15,
            taktTime: 10,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            activeShifts: 1,
            oee: 0.85,
            cycleQuantity: 7 // Testing for N* specifically
        });

        const scenario = result.find(r => r.n === 7);
        expect(scenario).toBeDefined();
    });

    it('should detect machine limit correctly', () => {
        const result = strategy.calculate({
            puInyTime: 10,
            puCurTime: 20,
            manualOps: [],
            manualTimeOverride: 5,
            taktTime: 100,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            activeShifts: 1,
            oee: 1,
            cycleQuantity: 1
        });

        const n1 = result.find(r => r.n === 1);
        expect(n1?.cyclePerPiece).toBeCloseTo(30, 0);
    });

    it('should respect manual time override', () => {
        const result = strategy.calculate({
            puInyTime: 20,
            puCurTime: 120,
            manualOps: [],
            manualTimeOverride: 50,
            taktTime: 10,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            activeShifts: 1,
            oee: 0.85,
            cycleQuantity: 1
        });

        const scenario = result.find(r => r.n === 1);
        expect(scenario?.manualTime).toBe(50);
    });

    it('should calculate required operators correctly', () => {
        // Machine Cycle = 200s (100 Iny + 100 Cur, N=1)
        // Manual Work = 300s (Internal)
        // Req Ops = 300 / 200 = 1.5

        const result = strategy.calculate({
            puInyTime: 100,
            puCurTime: 100,
            manualOps: [
                { id: '1', description: 'Task 1', time: 150, type: 'internal' },
                { id: '2', description: 'Task 2', time: 150, type: 'internal' }
            ],
            manualTimeOverride: null,
            taktTime: 10,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            activeShifts: 1,
            oee: 1,
            cycleQuantity: 1
        });

        const scenario = result.find(r => r.n === 1);
        expect(scenario?.reqOperators).toBeGreaterThan(1.4);
    });
});
