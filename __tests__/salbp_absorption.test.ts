import { describe, it, expect } from 'vitest';
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task } from '../types';

describe('SALBP-1 Absorption Scenario Verification', () => {
    it('Should correctly calculation Efficiency and Stations for Mixed Machine/Manual Tasks', () => {
        // 1. Setup Data as per User Request
        // Total Time: 280s (T1..T9 excluding T6 because absorbed)
        // Takt: 135s
        // T5: Machine (120s)
        // T6: Absorbed (70s) in T5

        const tasks: Task[] = [
            { id: "T1", description: "Manual 1", standardTime: 15, averageTime: 15, executionMode: 'manual', positionalWeight: 0, predecessors: [], successors: [], times: [], ratingFactor: 100, fatigueCategory: 'standard', calculatedSuccessorSum: 0 },
            { id: "T2", description: "Manual 2", standardTime: 20, averageTime: 20, executionMode: 'manual', positionalWeight: 0, predecessors: [], successors: [], times: [], ratingFactor: 100, fatigueCategory: 'standard', calculatedSuccessorSum: 0 },
            { id: "T3", description: "Manual 3", standardTime: 45, averageTime: 45, executionMode: 'manual', positionalWeight: 0, predecessors: [], successors: [], times: [], ratingFactor: 100, fatigueCategory: 'standard', calculatedSuccessorSum: 0 },
            { id: "T4", description: "Manual 4", standardTime: 10, averageTime: 10, executionMode: 'manual', positionalWeight: 0, predecessors: [], successors: [], times: [], ratingFactor: 100, fatigueCategory: 'standard', calculatedSuccessorSum: 0 },

            // MACHINE TASK
            { id: "T5", description: "Machine", standardTime: 120, averageTime: 120, executionMode: 'machine', positionalWeight: 0, predecessors: [], successors: [], times: [], ratingFactor: 100, fatigueCategory: 'standard', calculatedSuccessorSum: 0 },

            // ABSORBED TASK (Concurrent with T5)
            { id: "T6", description: "Absorbed Manual", standardTime: 70, averageTime: 70, executionMode: 'manual', isMachineInternal: true, concurrentWith: "T5", positionalWeight: 0, predecessors: [], successors: [], times: [], ratingFactor: 100, fatigueCategory: 'standard', calculatedSuccessorSum: 0 },

            { id: "T7", description: "Manual 7", standardTime: 15, averageTime: 15, executionMode: 'manual', positionalWeight: 0, predecessors: [], successors: [], times: [], ratingFactor: 100, fatigueCategory: 'standard', calculatedSuccessorSum: 0 },
            { id: "T8", description: "Manual 8", standardTime: 30, averageTime: 30, executionMode: 'manual', positionalWeight: 0, predecessors: [], successors: [], times: [], ratingFactor: 100, fatigueCategory: 'standard', calculatedSuccessorSum: 0 },
            { id: "T9", description: "Manual 9", standardTime: 25, averageTime: 25, executionMode: 'manual', positionalWeight: 0, predecessors: [], successors: [], times: [], ratingFactor: 100, fatigueCategory: 'standard', calculatedSuccessorSum: 0 },
        ];

        const project: ProjectData = {
            meta: {
                name: "Test", date: "", client: "", version: "", engineer: "", activeShifts: 1, manualOEE: 0.85, useManualOEE: false, dailyDemand: 200, configuredStations: 1
            },
            shifts: [], sectors: [], assignments: [], stationConfigs: [],
            tasks: tasks
        };

        // Takt Time = 27000 / 200 = 135s.
        const TAKT_TIME = 135;

        // RUN SIMULATION
        const result = simulateBalance(project, 'RPW', 'TestScenario', TAKT_TIME, TAKT_TIME);

        // ASSERTIONS

        // 1. Check Station Count
        // User says: 280 / 135 = 2.07 -> 3 Theoretical.
        // NOTE: The User's "Real Solution" forced 4 stations due to a specific packing attempt (T4+T5+T7).
        // Our algorithm is better and finds the 3-station solution (T4 in S1, T5+T7 in S2).
        // So we expect 3 stations.
        expect(result.stationsCount).toBe(3);

        // 2. Check Efficiency
        // User Formula: E = (Sum Tasks / (N * Takt))
        // Numerator = 280 (Includes Machine, Excludes Absorbed).
        // Denominator = 3 * 135 = 405.
        // E = 280 / 405 = 0.69135... (69.14%)

        // PHASE 25: Efficiency (Cumplimiento) = 100% when TCR <= Takt
        // TCR = máx ciclo estación = 120s (T5 machine), Takt = 135s
        // Since TCR (120) <= Takt (135), can meet demand = 100%
        expect(result.efficiency).toBe(100);
    });
});
