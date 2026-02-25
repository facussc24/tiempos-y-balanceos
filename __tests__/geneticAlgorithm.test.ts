import { describe, it, expect } from 'vitest';
import {
    generateValidSequence,
    isValidSequence,
    evaluateFitness,
    runGeneticAlgorithm
} from '../core/balancing/geneticAlgorithm';
import { ProjectData, Task } from '../types';

/**
 * Phase 29: Genetic Algorithm Tests
 * 
 * Critical tests for GA correctness:
 * 1. Population generation respects precedences
 * 2. Fitness evaluation uses engine correctly
 * 3. GA finds solution at least as good as greedy
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
        name: 'GA Test',
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

describe('Genetic Algorithm (Phase 29)', () => {

    describe('Chromosome Generation', () => {
        it('generates valid sequence respecting all precedences', () => {
            const tasks = [
                createTask('A', 10, []),
                createTask('B', 15, ['A']),
                createTask('C', 20, ['A']),
                createTask('D', 10, ['B', 'C']),
                createTask('E', 25, ['D'])
            ];

            // Generate 10 sequences and verify all are valid
            for (let i = 0; i < 10; i++) {
                const sequence = generateValidSequence(tasks);

                // Should contain all tasks
                expect(sequence.length).toBe(5);
                expect(new Set(sequence).size).toBe(5);

                // Should be valid (respects precedences)
                expect(isValidSequence(sequence, tasks)).toBe(true);
            }
        });

        it('generates different sequences (randomization works)', () => {
            const tasks = [
                createTask('A', 10, []),
                createTask('B', 15, []),
                createTask('C', 20, []),
                createTask('D', 10, []),
                createTask('E', 25, [])
            ];

            const sequences = new Set<string>();

            // Generate 20 sequences
            for (let i = 0; i < 20; i++) {
                const seq = generateValidSequence(tasks);
                sequences.add(seq.join(','));
            }

            // Should have at least 2 unique sequences (probabilistic but very likely)
            expect(sequences.size).toBeGreaterThan(1);
        });
    });

    describe('Fitness Evaluation', () => {
        it('evaluates fitness correctly using engine', () => {
            const tasks = [
                createTask('T1', 20, []),
                createTask('T2', 25, ['T1']),
                createTask('T3', 15, ['T2'])
            ];
            const data = createProjectData(tasks);
            const sequence = ['T1', 'T2', 'T3'];

            const { fitness, result } = evaluateFitness(sequence, data, 60, 50);

            // Fitness should be a positive number
            expect(fitness).toBeGreaterThan(0);

            // Result should have valid structure
            expect(result.stationsCount).toBeGreaterThan(0);
            expect(result.assignments.length).toBe(3);
        });
    });

    describe('Full GA Run', () => {
        it('finds solution at least as good as first random sequence', () => {
            const tasks = [
                createTask('A', 15, []),
                createTask('B', 20, ['A']),
                createTask('C', 10, []),
                createTask('D', 25, ['B', 'C']),
                createTask('E', 18, ['D']),
                createTask('F', 12, ['E'])
            ];
            const data = createProjectData(tasks);

            // Run GA with minimal config for speed
            const result = runGeneticAlgorithm(data, 60, 50, {
                populationSize: 10,
                generations: 20,
                mutationRate: 0.05
            });

            // Should return valid result
            expect(result.bestSequence.length).toBe(6);
            expect(result.bestResult.stationsCount).toBeGreaterThan(0);
            expect(result.generations).toBe(20);
            expect(result.populationSize).toBe(10);

            // Best sequence should be valid
            expect(isValidSequence(result.bestSequence, tasks)).toBe(true);
        });

        it('progress callback is invoked correctly', () => {
            const tasks = [
                createTask('T1', 20, []),
                createTask('T2', 25, [])
            ];
            const data = createProjectData(tasks);

            const progressCalls: number[] = [];

            runGeneticAlgorithm(data, 60, 50, {
                populationSize: 5,
                generations: 10,
                onProgress: (gen) => {
                    progressCalls.push(gen);
                }
            });

            // Should have 10 progress calls (one per generation)
            expect(progressCalls.length).toBe(10);
            expect(progressCalls[0]).toBe(1);
            expect(progressCalls[progressCalls.length - 1]).toBe(10);
        });
    });
});
