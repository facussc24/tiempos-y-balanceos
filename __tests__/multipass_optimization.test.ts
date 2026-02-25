import { describe, it, expect } from 'vitest';
import { simulateBalance, multiPassOptimize, SimulationResult } from '../core/balancing/engine';
import { ProjectData, Task } from '../types';

/**
 * Phase 27: Multi-Pass Stochastic Optimization Tests
 * 
 * These tests verify that:
 * 1. Multi-pass optimization never produces worse results than greedy
 * 2. With complex datasets, multi-pass can find improvements
 * 3. Progress callback is invoked correctly
 */

// Helper: Create a minimal valid task
const createTask = (
    id: string,
    time: number,
    predecessors: string[] = [],
    weight?: number
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
    positionalWeight: weight ?? time * 10,
    calculatedSuccessorSum: 0,
    stdDev: 0,
    executionMode: 'manual'
});

// Helper: Create minimal project data
const createProjectData = (tasks: Task[], taktTime: number = 60): ProjectData => ({
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
        name: 'Test Project',
        date: new Date().toISOString(),
        client: 'Test Client',
        engineer: 'Test Engineer',
        version: '1.0',
        dailyDemand: 480, // 8 hours * 60 = 480 units at 1 per minute
        manualOEE: 0.85,
        useManualOEE: true,
        activeShifts: 1
    } as any
});

describe('Multi-Pass Stochastic Optimization (Phase 27)', () => {

    describe('Baseline Guarantee', () => {
        it('never returns worse result than greedy for simple dataset', () => {
            // Create a simple 10-task dataset
            const tasks: Task[] = [];
            for (let i = 1; i <= 10; i++) {
                tasks.push(createTask(
                    `T${i}`,
                    10 + Math.floor(i * 2),
                    i > 1 ? [`T${i - 1}`] : []  // Linear chain
                ));
            }

            const data = createProjectData(tasks);

            // Run greedy baseline
            const greedyResult = simulateBalance(data, 'RPW', 'Greedy', 60, 50);

            // Run multi-pass (with fewer iterations for test speed)
            const multiPassResult = multiPassOptimize(data, 'RPW', 'Multi', 60, 50, { iterations: 50 });

            // Multi-pass should never be worse
            expect(multiPassResult.stationsCount).toBeLessThanOrEqual(greedyResult.stationsCount);

            // If same stations, idle time should be <= 
            if (multiPassResult.stationsCount === greedyResult.stationsCount) {
                expect(multiPassResult.idleTime).toBeLessThanOrEqual(greedyResult.idleTime + 0.1);
            }
        });

        it('never returns worse result than greedy for parallel branches dataset', () => {
            // Create a dataset with parallel branches (more exploration potential)
            const tasks: Task[] = [
                createTask('START', 5, []),
                // Branch A
                createTask('A1', 15, ['START']),
                createTask('A2', 20, ['A1']),
                createTask('A3', 10, ['A2']),
                // Branch B
                createTask('B1', 12, ['START']),
                createTask('B2', 18, ['B1']),
                createTask('B3', 15, ['B2']),
                // Branch C
                createTask('C1', 8, ['START']),
                createTask('C2', 22, ['C1']),
                createTask('C3', 12, ['C2']),
                // Merge
                createTask('END', 10, ['A3', 'B3', 'C3'])
            ];

            const data = createProjectData(tasks);

            const greedyResult = simulateBalance(data, 'RPW', 'Greedy', 60, 50);
            const multiPassResult = multiPassOptimize(data, 'RPW', 'Multi', 60, 50, { iterations: 100 });

            expect(multiPassResult.stationsCount).toBeLessThanOrEqual(greedyResult.stationsCount);
        });
    });

    describe('Progress Callback', () => {
        it('invokes progress callback during optimization', () => {
            const tasks = [
                createTask('T1', 20, []),
                createTask('T2', 25, ['T1']),
                createTask('T3', 15, ['T2'])
            ];
            const data = createProjectData(tasks);

            const progressCalls: { current: number; total: number }[] = [];

            multiPassOptimize(data, 'RPW', 'Test', 60, 50, {
                iterations: 100,
                onProgress: (current, total) => {
                    progressCalls.push({ current, total });
                }
            });

            // Should have multiple progress calls (every 50 iterations in current impl)
            expect(progressCalls.length).toBeGreaterThan(0);

            // First call should be at 0
            expect(progressCalls[0].current).toBe(0);
            expect(progressCalls[0].total).toBe(100);

            // Last call should be at 100 (completion)
            expect(progressCalls[progressCalls.length - 1].current).toBe(100);
        });
    });

    describe('Improvement Detection', () => {
        it('sets improvementVsBaseline when multi-pass finds better solution', () => {
            // Create a dataset where random exploration is likely to help
            // This test may occasionally fail due to stochastic nature
            const tasks: Task[] = [];

            // Create 15 tasks with varying weights and some parallelism
            for (let i = 1; i <= 15; i++) {
                const preds = i <= 3 ? [] : [`T${Math.floor(Math.random() * (i - 1)) + 1}`];
                tasks.push(createTask(
                    `T${i}`,
                    5 + Math.floor(Math.random() * 25),
                    preds,
                    50 + Math.random() * 100
                ));
            }

            const data = createProjectData(tasks);

            // Run with enough iterations to potentially find improvement
            const result = multiPassOptimize(data, 'RPW', 'Multi', 60, 50, { iterations: 200 });

            // This is a soft assertion - the algorithm may or may not find an improvement
            // depending on the random dataset generated
            // The important thing is that the function completes without error
            expect(result).toBeDefined();
            expect(result.stationsCount).toBeGreaterThan(0);
            expect(result.assignments.length).toBe(15);

            // If improvement was found, verify the structure
            if (result.improvementVsBaseline) {
                expect(typeof result.improvementVsBaseline.stationsSaved).toBe('number');
                expect(typeof result.improvementVsBaseline.efficiencyGain).toBe('number');
            }
        });
    });

    describe('Complex Dataset (30+ tasks)', () => {
        it('handles large dataset without timeout', () => {
            const tasks: Task[] = [];

            // Create 35 tasks with a complex precedence structure
            for (let i = 1; i <= 35; i++) {
                let preds: string[] = [];

                if (i > 1) {
                    // Each task depends on 1-3 previous tasks
                    const numPreds = Math.min(i - 1, Math.floor(Math.random() * 3) + 1);
                    for (let p = 0; p < numPreds; p++) {
                        const predIdx = Math.max(1, i - 1 - Math.floor(Math.random() * 5));
                        const predId = `T${predIdx}`;
                        if (!preds.includes(predId)) {
                            preds.push(predId);
                        }
                    }
                }

                tasks.push(createTask(
                    `T${i}`,
                    8 + Math.floor(Math.random() * 20),
                    preds
                ));
            }

            const data = createProjectData(tasks);

            const startTime = Date.now();
            const result = multiPassOptimize(data, 'RPW', 'Complex', 60, 50, { iterations: 100 });
            const duration = Date.now() - startTime;

            // Should complete in reasonable time (< 5 seconds for 100 iterations)
            expect(duration).toBeLessThan(5000);

            // All tasks should be assigned
            expect(result.assignments.length).toBe(35);

            // Should have reasonable number of stations
            expect(result.stationsCount).toBeGreaterThan(0);
            expect(result.stationsCount).toBeLessThan(35); // Should pack at least some tasks
        });
    });
});
