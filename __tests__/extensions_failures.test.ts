
import { describe, it, expect } from 'vitest';
import { createDESEngine, DESConfig } from '../modules/flow-simulator/desSimulationEngine';

describe('Phase 12: OEE Failure Simulation', () => {

    const BASE_CONFIG: DESConfig = {
        stations: [
            { id: 1, name: 'S1', cycleTime: 10, operators: 1, bufferCapacity: 50 }, // Cycle 10s = 6 ppm
            { id: 2, name: 'S2', cycleTime: 10, operators: 1, bufferCapacity: 50 },
        ],
        wipLimit: 20,
        totalPieces: 500, // Enough to stabilize
    };

    it('reduces throughput when failures are enabled', () => {
        // 1. Run Baseline (No Failures)
        const engineBaseline = createDESEngine(BASE_CONFIG);
        const resultBaseline = engineBaseline.runInstant();

        // 2. Run With Failures
        // MTBF = 10 min (600s), MTTR = 5 min (300s) -> Availability approx 66%
        // High failure rate to ensure impact in short sim
        const failureConfig = {
            ...BASE_CONFIG,
            stations: BASE_CONFIG.stations.map(s => ({
                ...s,
                failureConfig: { mtbfMinutes: 10, mttrMinutes: 5 }
            }))
        };

        const engineFailures = createDESEngine(failureConfig);
        const resultFailures = engineFailures.runInstant();

        console.log('Baseline Throughput:', resultBaseline.throughput);
        console.log('Failure Throughput:', resultFailures.throughput);

        // Throughput should be significantly lower
        expect(resultFailures.throughput).toBeLessThan(resultBaseline.throughput * 0.9);

        // Elapsed time should be longer
        expect(resultFailures.elapsedTime).toBeGreaterThan(resultBaseline.elapsedTime);
    });

    it('records downtime as idle time (or distinct metric)', () => {
        const failureConfig = {
            ...BASE_CONFIG,
            stations: BASE_CONFIG.stations.map(s => ({
                ...s,
                failureConfig: { mtbfMinutes: 5, mttrMinutes: 2 }
            }))
        };

        const engine = createDESEngine(failureConfig);
        const result = engine.runInstant();

        // Check if we have significant idle/down time
        const s1Idle = result.kpis.stationIdleTime[0];

        // With failures, S1 goes DOWN.
        expect(s1Idle).toBeGreaterThan(0);
    });

    it('works with zero failures (sanity check)', () => {
        const engine = createDESEngine(BASE_CONFIG);
        const result = engine.runInstant();

        // Just verify it completes successfully
        expect(result.completedCount).toBe(500);
    });
});
