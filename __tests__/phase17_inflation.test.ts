
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task, Shift } from '../types';

describe('Phase 17: Exploratory - Efficiency Inflation Analysis', () => {
    const mockShifts: Shift[] = [{
        id: 1, name: "Turno A", startTime: "06:00", endTime: "14:00",
        breaks: []
    }];

    const createProject = (tasks: Task[]): ProjectData => ({
        id: 1,
        shifts: mockShifts,
        tasks: tasks,
        assignments: [],
        sectors: [],
        stationConfigs: [],
        meta: {
            dailyDemand: 1000,
            activeShifts: 1,
            manualOEE: 0.85,
            useManualOEE: false,
            useSectorOEE: false,
            configuredStations: 0,
            name: "Test", date: "2024", client: "Test", version: "1", engineer: "Test"
        },
    });

    test('Hypothesis: Efficiency reflects ONLY Manual Work (Actual Operator Load)', () => {
        // Machine runs for 100s.
        // Internal Task takes 10s.
        // Takt is 100s.
        // Station should have 1 Operator.

        // Phase 17 Requirement: Efficiency uses strictly Manual Time.
        // Work = 10s. Loop = 100s.
        // Expected Efficiency: 10%.

        const machineTask: Task = {
            id: "M1", description: "Inyeccion", executionMode: "injection",
            times: [100], averageTime: 100, standardTime: 100,
            ratingFactor: 100, fatigueCategory: "standard",
            predecessors: [], successors: [],
            positionalWeight: 10,
            stdDev: 0, calculatedSuccessorSum: 0
        };

        const internalTask: Task = {
            id: "T1", description: "Clean", executionMode: "manual",
            times: [10], averageTime: 10, standardTime: 10,
            ratingFactor: 100, fatigueCategory: "standard",
            predecessors: [], successors: [],
            positionalWeight: 10,
            stdDev: 0, calculatedSuccessorSum: 0,
            concurrentWith: "M1",
            isMachineInternal: true
        };

        const data = createProject([machineTask, internalTask]);

        // Target 100s Takt
        const result = simulateBalance(data, 'RPW', 'UnitTest', 100, 100);

        console.log(`Station Count: ${result.stationsCount}`);
        console.log(`Efficiency Reported: ${result.efficiency.toFixed(2)}% (Target ~10%)`);

        // PHASE 24 UPDATE: Logic changed to include Machine Time in efficiency (Line Efficiency).
        // So expected efficiency is 100% (100s machine / 100s cycle).
        expect(result.efficiency).toBeGreaterThan(95);
        expect(result.efficiency).toBeLessThan(105);
    });
});
