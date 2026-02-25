
import { RotaryInjectionStrategy } from '../modules/strategies/RotaryStrategy';
import { InjectionSimulationParams } from '../types';

describe('Phase 15: Dimensional Integrity Verification', () => {
    const strategy = new RotaryInjectionStrategy();

    test('N=17 Scenario: Should calculate Cycle Per Piece correctly using Loop Logic', () => {
        // Scenario from Screenshot
        // Iny = 8s, Cur = 193s
        // N = 17.
        // Manual = 15s (Internal default).

        // CORRECT Logic (Expert Validated):
        // cyclePerPiece = Iny + Cur/N = 8 + 193/17 = 8 + 11.35 = 19.35s
        // machineLoopTime = cyclePerPiece * N = 19.35 * 17 = 329s
        // RealLoop = Max(329, 15) = 329s (Internal absorbed)
        // RealCycle = 329 / 17 = 19.35s

        const params: InjectionSimulationParams = {
            puInyTime: 8,
            puCurTime: 193,
            manualOps: [], // Default 15s Internal
            manualTimeOverride: null,
            taktTime: 69.94,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            activeShifts: 1,
            oee: 0,
            cycleQuantity: 1
        };

        const results = strategy.calculate(params);
        const resultN17 = results.find(r => r.n === 17);

        expect(resultN17).toBeDefined();
        if (resultN17) {
            console.log('N=17 Result:', JSON.stringify(resultN17, null, 2));

            // Check Real Cycle: 8 + 193/17 = 19.353s
            expect(resultN17.realCycle).toBeCloseTo(19.353, 2);

            // Check WaitOp (Slack)
            // machineLoop = 19.353 * 17 = 329s
            // WaitOp Total = 329 - 15 = 314s
            // WaitOp Per Piece = 314 / 17 = 18.47s
            expect(resultN17.waitOp).toBeCloseTo(18.47, 1);
        }
    });

    test('Fatigue Alert Logic (Smart ROI)', () => {
        // Scenario: Machine Limited but Saturation High.
        // Iny=8, Cur=10. Machine Loop = 18.
        // Manual = 17. (Internal).
        // Saturation = 17/18 = 94%.
        // Standard Logic (85%): Req = 17 / (18*0.85) = 1.11 -> 2 Ops.
        // Smart Logic (<95%): Should force 1 Op.

        const params: InjectionSimulationParams = {
            puInyTime: 8,
            puCurTime: 10,
            manualOps: [{ id: '1', description: 'Work', time: 17, type: 'internal' }],
            manualTimeOverride: null,
            taktTime: 100,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            activeShifts: 1,
            oee: 0,
            cycleQuantity: 1
        };

        const results = strategy.calculate(params);
        const res = results.find(r => r.n === 1);

        if (res) {
            expect(res.reqOperators).toBe(1);
            expect(res.isFatigueRisk).toBe(true);
        }
    });
});
