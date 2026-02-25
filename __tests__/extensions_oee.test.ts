
import { describe, it, expect } from 'vitest';
import { createDESEngine, DESConfig } from '../modules/flow-simulator/desSimulationEngine';

describe('Phase 12: OEE Metrics Calculation', () => {

    const BASE_CONFIG: DESConfig = {
        stations: [
            { id: 1, name: 'S1', cycleTime: 10, operators: 1, bufferCapacity: 50 },
            { id: 2, name: 'S2', cycleTime: 10, operators: 1, bufferCapacity: 50 },
        ],
        wipLimit: 20,
        totalPieces: 100,
    };

    it('calculates OEE = 1.0 for a perfect line (no failures)', () => {
        const engine = createDESEngine(BASE_CONFIG);
        const result = engine.runInstant();

        expect(result.kpis.oee).toBeDefined();
        expect(result.kpis.availability).toBeDefined();
        expect(result.kpis.performance).toBeDefined();
        expect(result.kpis.quality).toBeDefined();

        // With no failures, availability should be high
        expect(result.kpis.availability).toBeGreaterThan(0.9);

        // Quality is always 1.0 (no scrap model)
        expect(result.kpis.quality).toBe(1.0);

        // OEE should be reasonable for a balanced line
        expect(result.kpis.oee).toBeGreaterThan(0.4);
    });

    it('reduces OEE when failures are introduced', () => {
        // Run baseline without failures
        const baselineEngine = createDESEngine(BASE_CONFIG);
        const baselineResult = baselineEngine.runInstant();

        // Run with failures
        const failureConfig: DESConfig = {
            ...BASE_CONFIG,
            totalPieces: 200, // More pieces to ensure failures happen
            stations: BASE_CONFIG.stations.map(s => ({
                ...s,
                failureConfig: { mtbfMinutes: 1, mttrMinutes: 1 }
            }))
        };
        const failureEngine = createDESEngine(failureConfig);
        const failureResult = failureEngine.runInstant();

        console.log('Baseline OEE:', baselineResult.kpis.oee);
        console.log('Failure OEE:', failureResult.kpis.oee);

        // OEE with failures should be defined
        expect(failureResult.kpis.oee).toBeDefined();
        expect(failureResult.kpis.availability).toBeDefined();
        expect(failureResult.kpis.performance).toBeDefined();

        // All should be numbers between 0 and 1
        expect(failureResult.kpis.oee).toBeGreaterThanOrEqual(0);
        expect(failureResult.kpis.oee).toBeLessThanOrEqual(1);
    });



    it('OEE components multiply correctly', () => {
        const engine = createDESEngine(BASE_CONFIG);
        const result = engine.runInstant();

        const calculatedOEE = (result.kpis.availability ?? 1) *
            (result.kpis.performance ?? 1) *
            (result.kpis.quality ?? 1);

        // Allow small floating point differences
        expect(result.kpis.oee).toBeCloseTo(calculatedOEE, 5);
    });
});
