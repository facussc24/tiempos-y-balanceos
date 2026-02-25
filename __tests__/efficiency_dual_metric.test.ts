import { describe, it, expect } from 'vitest';
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task } from '../types';

describe('Dual Efficiency Metrics Integration', () => {
    // Test Scenario:
    // 2 Tasks.
    // Task A: 500s.
    // Task B: 500s.
    // Takt Time: 1000s.
    // Case 1: 2 Stations (1 Task each).
    //   - Station 1: 500s. Station 2: 500s.
    //   - TCR = 500s (Max station time).
    //   - Headcount = 2.
    //   - WorkContent = 1000s.
    //   - Eff (Takt) = 1000 / (2 * 1000) = 50%.
    //   - Eff (Line) = 1000 / (2 * 500) = 100%.

    const mockTasks: Task[] = [
        { id: 'A', description: 'Task A', times: [500], averageTime: 500, standardTime: 500, ratingFactor: 100, fatigueCategory: 'standard', predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' },
        { id: 'B', description: 'Task B', times: [500], averageTime: 500, standardTime: 500, ratingFactor: 100, fatigueCategory: 'standard', predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' }
    ];

    const mockData: ProjectData = {
        meta: {
            name: 'Test',
            date: '2024-01-01',
            client: 'Test',
            version: '1.0',
            engineer: 'QA',
            manualOEE: 1,
            useManualOEE: true,
            dailyDemand: 100,
            activeShifts: 1,
            configuredStations: 1
        },
        tasks: mockTasks,
        assignments: [],
        shifts: [],
        sectors: [],
        stationConfigs: []
    };

    it('should calculate disparate efficiencies when Takt > TCR', () => {
        const nominalSeconds = 1000; // Takt
        const effectiveSeconds = 1000;

        // Run simulation (RPW should assign them to separate stations if we constrain or just native logic)
        // Actually simulateBalance logic fills station until limit.
        // Limit is 1000. 500+500 = 1000.
        // So both fit in Station 1.
        // Result: 1 Station. TCR=1000. HC=1. Eff=100%. LineEff=100%.

        // We need to FORCE separate stations to create the gap.
        // Let's set Takt to 400s (Overload) -> No, we want Takt to be LARGE (Underutilized)
        // Task A=500, B=500. Takt=1000.
        // They fit in 1.

        // Let's use Task A=600, B=600. Takt=1000.
        // They sum 1200 > 1000. Must split.
        // Station 1: 600. Station 2: 600.
        // TCR = 600.
        // HC = 2.
        // Total Work = 1200.
        // Eff (Takt) = 1200 / (2 * 1000) = 60%.
        // Eff (Line) = 1200 / (2 * 600) = 100%.

        const largeTasks = [
            { id: 'A', description: 'Task A', times: [600], averageTime: 600, standardTime: 600, ratingFactor: 100, fatigueCategory: 'standard', predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' },
            { id: 'B', description: 'Task B', times: [600], averageTime: 600, standardTime: 600, ratingFactor: 100, fatigueCategory: 'standard', predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' }
        ] as Task[];

        const testData = { ...mockData, tasks: largeTasks };

        const result = simulateBalance(testData, 'RPW', 'Test', nominalSeconds, effectiveSeconds);

        expect(result.stationsCount).toBe(2);
        expect(result.totalHeadcount).toBe(2);

        // Verify TCR
        expect(result.realCycleTime).toBe(600);

        // Verify Efficiencies
        // PHASE 25: Efficiency (Cumplimiento) = 100% when TCR <= Takt
        expect(result.efficiency).toBe(100); // TCR (600) <= Takt (1000) = Can meet demand
        expect(result.lineEfficiency).toBe(100); // 1200 / 1200
    });

    it('should calculate identical efficiencies when Takt == TCR', () => {
        // Task A=1000. Takt=1000.
        // Station 1: 1000.
        // TCR=1000.
        // Eff (Takt) = 1000 / 1000 = 100%.
        // Eff (Line) = 1000 / 1000 = 100%.

        const perfectTask = [
            { id: 'A', description: 'Task A', times: [1000], averageTime: 1000, standardTime: 1000, ratingFactor: 100, fatigueCategory: 'standard', predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' }
        ] as Task[];

        const testData = { ...mockData, tasks: perfectTask };
        const result = simulateBalance(testData, 'RPW', 'Test', 1000, 1000);

        expect(result.efficiency).toBe(100);
        expect(result.lineEfficiency).toBe(100);
    });
});
