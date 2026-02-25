
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task, Shift } from '../types';

describe('Phase 19: Exploratory - Mixed OEE Anomaly', () => {
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

    test('Hypothesis: Differentiated OEE - Machine uses Takt, Manual uses Effective Limit', () => {
        // Takt Time: 100s.
        // Input to Balance: Takt * ManualOEE = 100 * 0.85 = 85s.

        // Machine Task: 90s.
        // Old Logic: 90 > 85 -> Multi Manning (HC 2).
        // New Logic: Machine uses Takt (100) or explicit Machine OEE. 
        // 90 < 100 -> Fits (HC 1).

        const machineTask: Task = {
            id: "M1", description: "Inyeccion", executionMode: "injection",
            times: [90], averageTime: 90, standardTime: 90,
            ratingFactor: 100, fatigueCategory: "standard",
            predecessors: [], successors: [], positionalWeight: 100,
            calculatedSuccessorSum: 0
        };

        const data = createProject([machineTask]);

        // Simulating the call where we pass "Effective Seconds" derived from Manual OEE
        const result = simulateBalance(data, 'RPW', 'UnitTest', 100, 85);

        console.log(`Station Count: ${result.stationsCount}`);
        console.log(`Headcount: ${result.totalHeadcount}`);

        // Expect Success with New Logic
        expect(result.totalHeadcount).toBe(1);
    });
});
