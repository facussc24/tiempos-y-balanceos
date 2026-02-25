
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task, Shift, Assignment } from '../types';

describe('Phase 16: Ghost Tasks (Exclusión de Balanceo)', () => {
    // Mock Data Setup
    const mockShifts: Shift[] = [{
        id: 1, name: "Turno A", startTime: "06:00", endTime: "14:00",
        breaks: [{ id: "b1", name: "Almuerzo", duration: 30, startTime: "10:00" }]
    }];

    // Helper to create basic project data
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

    test('Scenario 1: Internal Task should NOT create new station (Ghosting)', () => {
        const machineTask: Task = {
            id: "M1", description: "Inyeccion", executionMode: "injection",
            times: [50], averageTime: 50, standardTime: 50,
            ratingFactor: 100, fatigueCategory: "standard",
            predecessors: [], successors: [], positionalWeight: 100,
            calculatedSuccessorSum: 0
        };

        const internalTask: Task = {
            id: "T1", description: "Refilado (Internal)", executionMode: "manual",
            times: [15], averageTime: 15, standardTime: 15,
            ratingFactor: 100, fatigueCategory: "standard",
            predecessors: [], successors: [], positionalWeight: 10,
            calculatedSuccessorSum: 0,
            concurrentWith: "M1",
            isMachineInternal: true // THIS IS THE KEY FLAG
        };

        const data = createProject([machineTask, internalTask]);

        console.log("DEBUG DATA TASKS:", data.tasks ? data.tasks.length : "UNDEFINED");
        console.log("DEBUG DATA ARRAY?:", Array.isArray(data.tasks));

        // Run Logic
        const result = simulateBalance(data, 'RPW', 'UnitTest', 27, 27 * 0.85);

        // Machine (50s injection) with internal ghost task (15s) = 1 station
        // Ghost task is absorbed into machine station (adds 0s effective load)
        // Injection task: replicas = 1 (machine can't be sped up by adding operators)
        expect(result.assignments.length).toBe(2); // Both M1 and T1 assigned
        expect(result.stationsCount).toBe(1); // Single station with machine + ghost
        expect(result.totalHeadcount).toBe(1); // 1 operator runs machine + ghost concurrently

    });

    test('Scenario 2: Ghost Task > Machine Time (Bottleneck)', () => {
        const machineTask: Task = {
            id: "M1", description: "Inyeccion", executionMode: "injection",
            times: [50], averageTime: 50, standardTime: 50,
            ratingFactor: 100, fatigueCategory: "standard",
            predecessors: [], successors: [], positionalWeight: 100,
            calculatedSuccessorSum: 0
        };

        const hugeInternalTask: Task = {
            id: "T1", description: "Refilado Lento", executionMode: "manual",
            times: [70], averageTime: 70, standardTime: 70, // 70s!!
            ratingFactor: 100, fatigueCategory: "standard",
            predecessors: [], successors: [], positionalWeight: 10,
            calculatedSuccessorSum: 0,
            concurrentWith: "M1",
            isMachineInternal: true
        };

        const data = createProject([machineTask, hugeInternalTask]);
        const result = simulateBalance(data, 'RPW', 'UnitTest', 27, 27 * 0.85);
        // Ghost task (70s) is absorbed into machine station even though it's > machine time (50s)
        // Ghost adds 0s effective load → 1 station, 1 operator
        expect(result.totalHeadcount).toBe(1);
    });

    test('Scenario 3: Normal External Task (Control Group)', () => {
        const machineTask: Task = {
            id: "M1", description: "Inyeccion", executionMode: "injection",
            times: [20], averageTime: 20, standardTime: 20, // < Takt (27)
            ratingFactor: 100, fatigueCategory: "standard",
            predecessors: [], successors: [], positionalWeight: 100,
            calculatedSuccessorSum: 0
        };

        const externalTask: Task = {
            id: "T1", description: "Empaque", executionMode: "manual",
            times: [10], averageTime: 10, standardTime: 10,
            ratingFactor: 100, fatigueCategory: "standard",
            predecessors: ["M1"], successors: [], positionalWeight: 10,
            calculatedSuccessorSum: 0,
            isMachineInternal: false // EXTERNAL
        };

        const data = createProject([machineTask, externalTask]);
        const result = simulateBalance(data, 'RPW', 'UnitTest', 27, 27 * 0.85);

        // Machine (20s) + External Manual (10s) = 30s total > 27s Takt
        // These are sequential (T1 is successor, not concurrent/internal)
        // The algorithm correctly separates them into 2 stations to meet Takt
        expect(result.stationsCount).toBe(2);
    });

});
