/**
 * Phase 25: Injection Efficiency Bug Fix
 * 
 * This test validates that injection stations correctly calculate
 * demand fulfillment based on TCR (machine cycle), not manual work sum.
 */

import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task, Shift } from '../types';

describe('Phase 25: Injection Station Efficiency', () => {
    const mockShifts: Shift[] = [{
        id: 1, name: "Turno A", startTime: "06:00", endTime: "14:00",
        breaks: []
    }];

    const createProject = (tasks: Task[], dailyDemand: number): ProjectData => ({
        shifts: mockShifts,
        tasks: tasks,
        assignments: [],
        sectors: [],
        stationConfigs: [],
        meta: {
            name: "Test Project",
            date: "2024-01-01",
            client: "Test",
            version: "1.0",
            engineer: "QA",
            dailyDemand: dailyDemand,
            activeShifts: 1,
            manualOEE: 0.85,
            useManualOEE: false,
            useSectorOEE: false,
            configuredStations: 0
        }
    });

    test('Injection station with TCR < Takt should have 100% fulfillment', () => {
        /**
         * Scenario (from bug report):
         * - Takt Nominal = 76s (based on demand)
         * - TCR (Machine Cycle) = 37.57s
         * - Manual Work = 46s
         * 
         * Expected: Fulfillment >= 100% (machine can keep up)
         * Bug: Was showing 61% because it used manual work / takt
         */

        // Create injection task with realCycle stored
        const injectionTask: Task = {
            id: "INJ1",
            description: "Inyección PU",
            executionMode: "injection",
            times: [37.57],
            averageTime: 37.57,
            standardTime: 37.57,
            ratingFactor: 100,
            fatigueCategory: "standard",
            predecessors: [],
            successors: [],
            positionalWeight: 100,
            calculatedSuccessorSum: 0,
            injectionParams: {
                pInyectionTime: 10,
                pCuringTime: 100,
                optimalCavities: 7,
                productionVolume: 379,
                investmentRatio: 0,
                headcountMode: 'manual',
                userHeadcount: 1,
                realCycle: 37.57  // THIS is the actual output cycle
            }
        };

        // Manual tasks (internal to injection)
        const manualTasks: Task[] = [
            { id: "T1", description: "Carga", executionMode: "manual", times: [5], averageTime: 5, standardTime: 5, ratingFactor: 100, fatigueCategory: "standard", predecessors: [], successors: [], positionalWeight: 90, calculatedSuccessorSum: 0, concurrentWith: "INJ1", isMachineInternal: true },
            { id: "T2", description: "Descarga", executionMode: "manual", times: [3], averageTime: 3, standardTime: 3, ratingFactor: 100, fatigueCategory: "standard", predecessors: [], successors: [], positionalWeight: 80, calculatedSuccessorSum: 0, concurrentWith: "INJ1", isMachineInternal: true },
        ];

        const taktNominal = 76; // seconds
        const data = createProject([injectionTask, ...manualTasks], 379); // 379 pcs/day @ 8h = ~76s takt

        const result = simulateBalance(data, 'RPW', 'Phase25Test', taktNominal, taktNominal * 0.85);

        console.log(`TCR: ${result.realCycleTime}s, Takt: ${taktNominal}s`);
        console.log(`Efficiency (Fulfillment): ${result.efficiency}%`);
        console.log(`Line Efficiency: ${result.lineEfficiency}%`);

        // Key assertion: If TCR (37.57) < Takt (76), fulfillment should be >= 100%
        expect(result.efficiency).toBeGreaterThanOrEqual(100);
    });

    test('Injection station with TCR > Takt should show deficit', () => {
        /**
         * Scenario: Machine slower than demand
         * - Takt = 30s
         * - TCR = 50s
         * 
         * Expected: Fulfillment = 30/50 * 100 = 60%
         */

        const injectionTask: Task = {
            id: "INJ2",
            description: "Inyección Lenta",
            executionMode: "injection",
            times: [50],
            averageTime: 50,
            standardTime: 50,
            ratingFactor: 100,
            fatigueCategory: "standard",
            predecessors: [],
            successors: [],
            positionalWeight: 100,
            calculatedSuccessorSum: 0,
            injectionParams: {
                pInyectionTime: 15,
                pCuringTime: 150,
                optimalCavities: 4,
                productionVolume: 960,
                investmentRatio: 0,
                headcountMode: 'manual',
                userHeadcount: 1,
                realCycle: 50
            }
        };

        const taktNominal = 30;
        const data = createProject([injectionTask], 960); // ~30s takt

        const result = simulateBalance(data, 'RPW', 'Phase25Test', taktNominal, taktNominal * 0.85);

        console.log(`TCR: ${result.realCycleTime}s, Takt: ${taktNominal}s`);
        console.log(`Efficiency (Fulfillment): ${result.efficiency}%`);

        // If TCR (50) > Takt (30), fulfillment = 30/50 = 60%
        expect(result.efficiency).toBeLessThan(100);
        expect(result.efficiency).toBeCloseTo(60, 0); // ~60%
    });
});
