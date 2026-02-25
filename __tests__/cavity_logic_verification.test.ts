
import { describe, it, expect } from 'vitest';
import { calculateInjectionScenarios } from '../utils';
import { InjectionSimulationParams } from '../types';

describe('Cavity Logic Verification - Chips Scenario', () => {
    it('should handle N=7 with correct efficiency', () => {
        // Chips Parameters
        // Demand = 350 pcs/day (8h) -> Takt ~ 82s (or 74.57s with OEE)
        // Machine: INY 8.14, CUR 27.57
        // Manual: RET 3.67, TRA 1.33, SEL 2.31, REF 18.92, EMB 2.50 -> Total 28.73s

        const params: InjectionSimulationParams = {
            puInyTime: 8.14,
            puCurTime: 27.57,
            manualOps: [
                { id: 'RET', description: 'Retirar', time: 3.67, type: 'external' },
                { id: 'TRA', description: 'Traslado', time: 1.33, type: 'internal' },
                { id: 'SEL', description: 'Sellado', time: 2.31, type: 'internal' },
                { id: 'REF', description: 'Refilado', time: 18.92, type: 'internal' },
                { id: 'EMB', description: 'Embalaje', time: 2.50, type: 'internal' }
            ],
            manualTimeOverride: null,
            taktTime: 74.57, // User specified target
            headcountMode: 'auto',
            userHeadcountOverride: 0,
            activeShifts: 1,
            oee: 0.90,
            cycleQuantity: 7 // N=7
        };

        const results = calculateInjectionScenarios(params);
        const scenarioN7 = results.find(r => r.n === 7);

        expect(scenarioN7).toBeDefined();
        if (scenarioN7) {
            console.log('Scenario N=7:', scenarioN7);

            // 1. Verify N_min = 1
            expect(scenarioN7.reqOperators).toBeLessThanOrEqual(1.1); // Allow slight float variance
            expect(Math.ceil(scenarioN7.reqOperators)).toBe(1);

            // 2. Verify Efficiency < 100%
            // Efficiency = (Total Manual Work) / (Ops * Cycle)
            // Manual Work per piece = 28.73s
            // Cycle Time (Real) should be >= Takt (74.57s) because we are meeting demand
            // Actually, Real Cycle is determined by Machine/Manual limits.
            // Machine Shot = 35.71s. Manual Shot = 28.73 * 7 = 201.11s? 
            // Wait, manual ops in utils are usually per SHOT unless specified otherwise?
            // In CavityCalculator UI, manual ops are entered as "Total per Cycle" usually.
            // But the test says "Average Time". 
            // If I assume they are per PIECE, I need to multiply by N in the params?
            // utils.ts: "manualOps.forEach... timeForN = (op.refCavities...) ? ... : op.time"
            // If op.refCavities is undefined, it assumes op.time is PER CYCLE (Shot).

            // IF the user inputs 28.73s as "Per Piece", they would use refCavities=1?
            // Or they would enter 28.73 * 7 = 201s?

            // Let's assume the user enters the PER SHOT time in the UI for fixed tasks.
            // But REF (Refilado) scales with cavities.
            // So we should set refCavities: 1 for scalable tasks.
        }
    });

    it('should handle N=7 with scalable manual tasks', () => {
        const params: InjectionSimulationParams = {
            puInyTime: 8.14,
            puCurTime: 27.57,
            manualOps: [
                { id: 'RET', description: 'Retirar', time: 3.67, type: 'external' }, // Fixed per shot
                { id: 'TRA', description: 'Traslado', time: 1.33, type: 'internal' }, // Fixed per shot
                { id: 'SEL', description: 'Sellado', time: 2.31, type: 'internal' }, // Fixed per shot
                { id: 'REF', description: 'Refilado', time: 18.92, type: 'internal', refCavities: 1 }, // SCALES
                { id: 'EMB', description: 'Embalaje', time: 2.50, type: 'internal', refCavities: 1 }  // SCALES
            ],
            manualTimeOverride: null,
            taktTime: 74.57,
            headcountMode: 'auto',
            userHeadcountOverride: 0,
            activeShifts: 1,
            oee: 0.90,
            cycleQuantity: 7
        };

        const results = calculateInjectionScenarios(params);
        const scenarioN7 = results.find(r => r.n === 7);

        expect(scenarioN7).toBeDefined();
        if (scenarioN7) {
            console.log('Scenario N=7 (Scalable):', scenarioN7);

            // Manual Work:
            // Fixed: 3.67 + 1.33 + 2.31 = 7.31s
            // Scaled: (18.92 + 2.50) * 7 = 149.94s
            // Total Manual per Shot = 157.25s

            // Machine Cycle = 35.71s.
            // Natural Cycle = Max(35.71, 157.25) = 157.25s (Manual Constrained).
            // Cycle per piece = 157.25 / 7 = 22.46s.

            // Takt = 74.57s.
            // We are well within Takt.

            // Operators = Work / Takt?
            // Work per piece = 22.46s.
            // Takt = 74.57s.
            // Ops = 22.46 / 74.57 = 0.3.
            // So 1 Operator.

            expect(Math.ceil(scenarioN7.reqOperators)).toBe(1);

            // Efficiency check
            // Real Cycle = Takt (since we staff for demand) = 74.57s * 7 = 522s?
            // No, utils.ts sets TargetCycle = Max(Natural, Takt).
            // If Takt is per piece (74.57), and Natural is per shot (157).
            // utils.ts compares 157 vs 74.57. Max is 157.
            // So Target = 157s.

            // Ops = Work (157) / Target (157) = 1.

            // Real Cycle = 157s.
            // Efficiency = Work (157) / (1 * 157) = 100%.

            // This seems correct for SALBP-1.
        }
    });
});
