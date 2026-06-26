import { describe, it, expect } from 'vitest';
import {
    isValidSequence,
    runGeneticAlgorithm,
    runGeneticAlgorithmAsync
} from '../core/balancing/geneticAlgorithm';
import { ProjectData, Task } from '../types';

/**
 * Tests for the async, cancellable GA runner (runGeneticAlgorithmAsync).
 *
 * The sync runGeneticAlgorithm is pinned by geneticAlgorithm.test.ts. Here we verify the
 * async variant: it (a) yields a valid result with the same structure, (b) fires onProgress
 * once per generation, and (c) honors an AbortSignal, returning the best-so-far with
 * cancelled:true instead of running to completion.
 */

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
        name: 'GA Async Test',
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

const sampleTasks = (): Task[] => [
    createTask('A', 15, []),
    createTask('B', 20, ['A']),
    createTask('C', 10, []),
    createTask('D', 25, ['B', 'C']),
    createTask('E', 18, ['D']),
    createTask('F', 12, ['E'])
];

describe('runGeneticAlgorithmAsync', () => {
    it('returns a valid result with the same structure as the sync runner', async () => {
        const data = createProjectData(sampleTasks());

        const result = await runGeneticAlgorithmAsync(data, 60, 50, {
            populationSize: 10,
            generations: 15,
            mutationRate: 0.05
        });

        expect(result.bestSequence.length).toBe(6);
        expect(isValidSequence(result.bestSequence, data.tasks)).toBe(true);
        expect(result.bestResult.stationsCount).toBeGreaterThan(0);
        expect(result.generations).toBe(15);
        expect(result.populationSize).toBe(10);
        // Completed normally → not cancelled
        expect(result.cancelled).toBeFalsy();
    });

    it('shares the GAResult shape with the sync runner (same keys)', async () => {
        const data = createProjectData(sampleTasks());
        const cfg = { populationSize: 8, generations: 10, mutationRate: 0.05 };

        const sync = runGeneticAlgorithm(data, 60, 50, cfg);
        const async = await runGeneticAlgorithmAsync(data, 60, 50, cfg);

        // Same top-level contract (keys), so existing consumers work with either runner.
        const syncKeys = Object.keys(sync).sort();
        const asyncKeys = Object.keys(async).filter(k => k !== 'cancelled').sort();
        expect(asyncKeys).toEqual(syncKeys.filter(k => k !== 'cancelled'));

        expect(typeof async.bestFitness).toBe('number');
        expect(Number.isFinite(async.bestFitness)).toBe(true);
    });

    it('invokes onProgress once per generation', async () => {
        const data = createProjectData([
            createTask('T1', 20, []),
            createTask('T2', 25, [])
        ]);

        const progressCalls: number[] = [];
        await runGeneticAlgorithmAsync(data, 60, 50, {
            populationSize: 5,
            generations: 10,
            onProgress: (gen) => { progressCalls.push(gen); }
        });

        expect(progressCalls.length).toBe(10);
        expect(progressCalls[0]).toBe(1);
        expect(progressCalls[progressCalls.length - 1]).toBe(10);
    });

    it('honors an already-aborted signal: returns best-so-far with cancelled=true', async () => {
        const data = createProjectData(sampleTasks());
        const controller = new AbortController();
        controller.abort(); // Aborted before the evolution loop starts

        const result = await runGeneticAlgorithmAsync(data, 60, 50, {
            populationSize: 10,
            generations: 100,
            signal: controller.signal
        });

        expect(result.cancelled).toBe(true);
        // Still returns a usable solution (best of the seeded population)
        expect(result.bestSequence.length).toBe(6);
        expect(isValidSequence(result.bestSequence, data.tasks)).toBe(true);
        expect(result.bestResult.stationsCount).toBeGreaterThan(0);
    });

    it('can be cancelled mid-run and stops early', async () => {
        const data = createProjectData(sampleTasks());
        const controller = new AbortController();

        const progressCalls: number[] = [];
        const promise = runGeneticAlgorithmAsync(data, 60, 50, {
            populationSize: 10,
            generations: 200,
            onProgress: (gen) => {
                progressCalls.push(gen);
                // Abort after the first couple of generations have reported progress.
                if (gen === 2) controller.abort();
            },
            signal: controller.signal
        });

        const result = await promise;

        expect(result.cancelled).toBe(true);
        // Stopped well before the configured 200 generations.
        expect(progressCalls.length).toBeLessThan(200);
        expect(isValidSequence(result.bestSequence, data.tasks)).toBe(true);
    });
});
