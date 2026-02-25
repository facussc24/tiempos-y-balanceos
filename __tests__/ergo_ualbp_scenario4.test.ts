import { describe, it, expect } from 'vitest';
import { simulateBalance } from '../core/balancing/engine';
import { Task, ProjectData } from '../types';

describe('Scenario 4: UALBP-C (Complex Precedence)', () => {
    // Definición de tareas del Escenario 4
    // Nota: Se incluye la propiedad 'actions' como metadato, aunque el simulador actual no la procese nativamente sin modificación.
    const tasks: (Task & { actions?: number })[] = [
        { id: 'T1', description: 'Task 1', executionMode: 'manual', times: [18], averageTime: 18, standardTime: 18, actions: 9, predecessors: [], successors: [], ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0 },
        { id: 'T2', description: 'Task 2', executionMode: 'manual', times: [6], averageTime: 6, standardTime: 6, actions: 25, predecessors: ['T1'], successors: [], ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0 },
        { id: 'T3', description: 'Task 3', executionMode: 'manual', times: [15], averageTime: 15, standardTime: 15, actions: 10, predecessors: ['T1'], successors: [], ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0 },
        { id: 'T4', description: 'Task 4', executionMode: 'manual', times: [21], averageTime: 21, standardTime: 21, actions: 11, predecessors: ['T2', 'T3'], successors: [], ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0 },
        { id: 'T5', description: 'Task 5', executionMode: 'manual', times: [45], averageTime: 45, standardTime: 45, actions: 26, predecessors: ['T4'], successors: [], ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0 },
        { id: 'T6', description: 'Task 6', executionMode: 'manual', times: [9], averageTime: 9, standardTime: 9, actions: 27, predecessors: ['T4'], successors: [], ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0 },
        { id: 'T7', description: 'Task 7', executionMode: 'manual', times: [12], averageTime: 12, standardTime: 12, actions: 10, predecessors: ['T5'], successors: [], ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0 },
        { id: 'T8', description: 'Task 8', executionMode: 'manual', times: [14], averageTime: 14, standardTime: 14, actions: 22, predecessors: ['T5'], successors: [], ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0 },
        { id: 'T9', description: 'Task 9', executionMode: 'manual', times: [22], averageTime: 22, standardTime: 22, actions: 20, predecessors: ['T6', 'T8'], successors: [], ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0 },
        { id: 'T10', description: 'Task 10', executionMode: 'manual', times: [5], averageTime: 5, standardTime: 5, actions: 23, predecessors: ['T7', 'T9'], successors: [], ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0 },
        { id: 'T11', description: 'Task 11', executionMode: 'manual', times: [13], averageTime: 13, standardTime: 13, actions: 12, predecessors: ['T9'], successors: [], ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0 },
        { id: 'T12', description: 'Task 12', executionMode: 'manual', times: [4], averageTime: 4, standardTime: 4, actions: 17, predecessors: ['T10', 'T11'], successors: [], ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0 },
    ];

    const projectData: ProjectData = {
        meta: {
            name: 'Scenario 4',
            date: '2023-10-27',
            client: 'UALBP Test',
            version: '1.0',
            engineer: 'Tester',
            manualOEE: 1,
            activeShifts: 1,
            dailyDemand: 1000,
            configuredStations: 10,
            useSectorOEE: false,
            useManualOEE: false
        },
        shifts: [],
        tasks: tasks,
        assignments: [],
        stationConfigs: [],
        sectors: []
    };

    it('should calculate Theoretical Minimum (SALBP-1) correctly', () => {
        const totalTime = tasks.reduce((sum, t) => sum + t.standardTime, 0);
        const cycleTime = 60;
        const nMin = Math.ceil(totalTime / cycleTime);

        // CORRECTION: User specified 179s, but sum of task times is actually 184s.
        // 18+6+15+21+45+9+12+14+22+5+13+4 = 184.
        // Lead to N_min = 4.
        expect(totalTime).toBe(184);
        expect(nMin).toBe(4);
    });

    it('should assign stations based on time-based logic', () => {
        const result = simulateBalance(
            projectData,
            'RPW', // Use valid heuristic type
            'UALBP Baseline',
            60, // Nominal Seconds (Cycle Time)
            60  // Effective Seconds
        );

        // Report Assigned Stations
        const usedStations = new Set(result.assignments.map(a => a.stationId));
        console.log(`\n\n--- REPORT SCENARIO 4 ---`);
        console.log(`Theoretical Min Stations: 4`);
        console.log(`Actual Assigned Stations: ${usedStations.size}`);
        console.log(`Efficiency: ${result.efficiency.toFixed(2)}%`);

        // Validation:
        // The software produces the time-optimal minimum of 4 stations.
        expect(usedStations.size).toBe(4);
    });
});
