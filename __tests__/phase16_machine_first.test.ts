
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task, Shift } from '../types';

describe('Phase 16: Deep Analysis - Machine First Scenario', () => {
    const mockShifts: Shift[] = [{
        id: 1, name: "Turno A", startTime: "06:00", endTime: "14:00",
        breaks: []
    }];

    const createProject = (tasks: Task[]): ProjectData => ({
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
            dailyDemand: 1000,
            activeShifts: 1,
            manualOEE: 0.85,
            useManualOEE: false,
            useSectorOEE: false,
            configuredStations: 0
        }
    });

    test('Scenario 5: Machine assigned FIRST (LCR)', () => {
        // Takt: 50s.
        // Machine: 72s. (Needs 2 Replicas, Limits Station).
        // Ghost: 22s.

        // Machine has LONGER time, so LCR sorts it FIRST.

        const machineTask: Task = {
            id: "M1", description: "Inyeccion", executionMode: "injection",
            times: [72], averageTime: 72, standardTime: 72,
            ratingFactor: 100, fatigueCategory: "standard",
            predecessors: [], successors: [],
            positionalWeight: 50,
            calculatedSuccessorSum: 0
        };

        const internalTask: Task = {
            id: "T1", description: "Refilado", executionMode: "manual",
            times: [22], averageTime: 22, standardTime: 22,
            ratingFactor: 100, fatigueCategory: "standard",
            predecessors: [], successors: [],
            positionalWeight: 50,
            calculatedSuccessorSum: 0,
            concurrentWith: "M1",
            isMachineInternal: true
        };

        // Tasks array in order, but simulateBalance sorts them.
        // LCR = Duration Descending. 72 > 22. So M1 is First.
        const data = createProject([machineTask, internalTask]);

        const result = simulateBalance(data, 'LCR', 'UnitTest', 50, 50 * 0.85);

        // After ghost task fix:
        // 1. M1 (72s) > Limit. Enters Case A. Assigned to Station 1 with replicas=2.
        // 2. T1 (Ghost, isMachineInternal, concurrentWith M1) is absorbed into Station 1
        //    via Case GHOST (runs parallel with machine, 0s effective load).
        // Result: 1 Station, 1 Headcount (replicas handle the machine time).

        console.log(`Algo: LCR, Stations: ${result.stationsCount}, HC: ${result.totalHeadcount}`);

        expect(result.stationsCount).toBe(1);
        expect(result.totalHeadcount).toBe(1);
    });
});
