import { describe, it, expect } from 'vitest';
import { simulateBalance, SimulationResult } from '../core/balancing/engine';
import { ProjectData, Task } from '../types';

/**
 * Phase 28: Parallelism Bottleneck Tests
 * 
 * Critical test for Genetic Algorithm preparation:
 * Verifies that tasks exceeding Takt Time are handled gracefully
 * by auto-creating parallel stations instead of throwing errors.
 * 
 * Formula: P = ceil(TaskTime / TaktTime)
 */

// Helper: Create a minimal valid task
const createTask = (
    id: string,
    time: number,
    predecessors: string[] = []
): Task => ({
    id,
    description: `Task ${id}`,
    predecessors,
    successors: [],
    times: [time],
    averageTime: time,
    standardTime: time,
    ratingFactor: 100,
    fatigueCategory: 'none',
    positionalWeight: time * 10,
    calculatedSuccessorSum: 0,
    stdDev: 0,
    executionMode: 'manual'
});

// Helper: Create minimal project data
const createProjectData = (tasks: Task[]): ProjectData => ({
    tasks,
    assignments: [],
    sectors: [],
    shifts: [{
        id: 1,
        name: 'Turno 1',
        startTime: '08:00',
        endTime: '17:00',
        breaks: []
    }],
    stationConfigs: [],
    meta: {
        name: 'Parallelism Test',
        date: new Date().toISOString(),
        client: 'Test Client',
        engineer: 'Test Engineer',
        version: '1.0',
        dailyDemand: 480,
        manualOEE: 0.85,
        useManualOEE: true,

        activeShifts: 1
    } as any
});

describe('Parallelism Bottleneck (Prep for Genetic Algorithm)', () => {

    it('handles task > takt time by creating parallel station with 2 operators', () => {
        // Scenario: Task of 100s with Takt Time of 60s
        // Expected: P = ceil(100/60) = ceil(1.67) = 2 operators
        const data = createProjectData([
            createTask('GIANT', 100, [])
        ]);

        // Run with Takt Time = 60s
        const result = simulateBalance(data, 'RPW', 'Bottleneck Test', 60, 50);

        // Should NOT throw error
        expect(result.assignments.length).toBe(1);
        expect(result.stationsCount).toBe(1);

        // Should create station with 2 operators (replicas)
        const config = result.proposedConfigs[0];
        expect(config).toBeDefined();
        expect(config.replicas).toBe(2);

        // Effective cycle should be ~50s (100/2), under takt of 60s
        expect(result.realCycleTime).toBeLessThanOrEqual(60);
    });

    it('calculates correct parallelism factor for various ratios', () => {
        // Test the main scenario: 100s task with 50s takt
        // P = ceil(100/50) = 2
        const data = createProjectData([
            createTask('TASK', 100, [])
        ]);

        const result = simulateBalance(data, 'RPW', 'Factor Test', 50, 50);

        // Should have 2 replicas
        expect(result.proposedConfigs[0]?.replicas).toBe(2);

        // Cycle time should be within takt (100/2 = 50s)
        expect(result.realCycleTime).toBeLessThanOrEqual(50 + 1); // +1 for rounding tolerance
    });

    it('handles multiple oversized tasks correctly', () => {
        // Multiple tasks that each exceed takt
        const data = createProjectData([
            createTask('BIG1', 80, []),
            createTask('BIG2', 90, ['BIG1']),
            createTask('NORMAL', 30, ['BIG2'])
        ]);

        // Takt of 50s
        const result = simulateBalance(data, 'RPW', 'Multi-Big Test', 50, 42);

        // All tasks should be assigned
        expect(result.assignments.length).toBe(3);

        // System should handle without error
        expect(result.stationsCount).toBeGreaterThan(0);

        // Should have parallel stations for BIG1 and BIG2
        expect(result.totalHeadcount).toBeGreaterThan(result.stationsCount);
    });

    it('machine tasks do not get parallelized (P=1 always)', () => {
        // Machine/injection tasks should not be parallelized even if > takt
        const data = createProjectData([{
            id: 'MACHINE',
            description: 'Machine Task',
            predecessors: [],
            successors: [],
            times: [100],
            averageTime: 100,
            standardTime: 100,
            ratingFactor: 100,
            fatigueCategory: 'none',
            positionalWeight: 1000,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'machine' // Machine task
        }]);

        const result = simulateBalance(data, 'RPW', 'Machine Test', 60, 50);

        // Machine tasks get P=1 (they run in parallel with other work)
        expect(result.assignments.length).toBe(1);
        // Replicas should be 1 for machine tasks
        const config = result.proposedConfigs[0];
        if (config) {
            expect(config.replicas).toBe(1);
        }
    });
});
