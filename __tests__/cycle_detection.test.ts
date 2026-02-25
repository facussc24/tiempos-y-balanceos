/**
 * FIX 3: Tests for Cycle Detection
 * 
 * Validates that circular dependencies in task precedences are detected
 * and reported before crashing the balancing algorithm.
 */

import {
    detectPrecedenceCycles,
    validateNoCycles,
    PrecedenceCycleError,
    topologicalSortWithCycleCheck
} from '../core/balancing/detectCycles';
import { Task } from '../types';

// Helper to create minimal task for testing
const createTask = (id: string, predecessors: string[] = []): Task => ({
    id,
    description: `Task ${id}`,
    times: [10],
    averageTime: 10,
    standardTime: 10,
    ratingFactor: 100,
    fatigueCategory: 'none',
    predecessors,
    successors: [],
    positionalWeight: 0,
    calculatedSuccessorSum: 0
});

describe('Cycle Detection (FIX 3)', () => {
    describe('detectPrecedenceCycles', () => {
        test('returns empty array for acyclic graph (linear chain)', () => {
            const tasks = [
                createTask('A', []),
                createTask('B', ['A']),
                createTask('C', ['B']),
                createTask('D', ['C'])
            ];

            const cycles = detectPrecedenceCycles(tasks);
            expect(cycles).toHaveLength(0);
        });

        test('returns empty array for acyclic graph (diamond shape)', () => {
            //     A
            //    / \
            //   B   C
            //    \ /
            //     D
            const tasks = [
                createTask('A', []),
                createTask('B', ['A']),
                createTask('C', ['A']),
                createTask('D', ['B', 'C'])
            ];

            const cycles = detectPrecedenceCycles(tasks);
            expect(cycles).toHaveLength(0);
        });

        test('detects simple 2-node cycle (A→B→A)', () => {
            const tasks = [
                createTask('A', ['B']),
                createTask('B', ['A'])
            ];

            const cycles = detectPrecedenceCycles(tasks);
            expect(cycles.length).toBeGreaterThan(0);
            // Cycle should contain both A and B
            const firstCycle = cycles[0];
            expect(firstCycle).toContain('A');
            expect(firstCycle).toContain('B');
        });

        test('detects 3-node cycle (A→B→C→A)', () => {
            const tasks = [
                createTask('A', ['C']),
                createTask('B', ['A']),
                createTask('C', ['B'])
            ];

            const cycles = detectPrecedenceCycles(tasks);
            expect(cycles.length).toBeGreaterThan(0);
            const firstCycle = cycles[0];
            expect(firstCycle).toContain('A');
            expect(firstCycle).toContain('B');
            expect(firstCycle).toContain('C');
        });

        test('detects self-loop (A→A)', () => {
            const tasks = [
                createTask('A', ['A'])
            ];

            const cycles = detectPrecedenceCycles(tasks);
            expect(cycles.length).toBeGreaterThan(0);
        });

        test('handles graph with multiple independent chains (no cycles)', () => {
            const tasks = [
                // Chain 1
                createTask('A1', []),
                createTask('A2', ['A1']),
                createTask('A3', ['A2']),
                // Chain 2 (independent)
                createTask('B1', []),
                createTask('B2', ['B1'])
            ];

            const cycles = detectPrecedenceCycles(tasks);
            expect(cycles).toHaveLength(0);
        });

        test('detects cycle in one branch while other is valid', () => {
            const tasks = [
                // Valid chain
                createTask('A', []),
                createTask('B', ['A']),
                // Cyclic branch
                createTask('X', ['Y']),
                createTask('Y', ['X'])
            ];

            const cycles = detectPrecedenceCycles(tasks);
            expect(cycles.length).toBeGreaterThan(0);
            // Should detect X-Y cycle but not flag A-B
        });
    });

    describe('validateNoCycles', () => {
        test('does not throw for acyclic graph', () => {
            const tasks = [
                createTask('A', []),
                createTask('B', ['A']),
                createTask('C', ['B'])
            ];

            expect(() => validateNoCycles(tasks)).not.toThrow();
        });

        test('throws PrecedenceCycleError for cyclic graph', () => {
            const tasks = [
                createTask('A', ['B']),
                createTask('B', ['A'])
            ];

            expect(() => validateNoCycles(tasks)).toThrow(PrecedenceCycleError);
        });

        test('error message contains cycle path', () => {
            const tasks = [
                createTask('A', ['B']),
                createTask('B', ['A'])
            ];

            try {
                validateNoCycles(tasks);
                expect.fail('Should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(PrecedenceCycleError);
                const error = e as PrecedenceCycleError;
                expect(error.message).toContain('Lógica Circular');
                expect(error.cycles.length).toBeGreaterThan(0);
            }
        });
    });

    describe('topologicalSortWithCycleCheck', () => {
        test('returns sorted array for acyclic graph', () => {
            const tasks = [
                createTask('A', []),
                createTask('B', ['A']),
                createTask('C', ['A']),
                createTask('D', ['B', 'C'])
            ];

            const sorted = topologicalSortWithCycleCheck(tasks);
            expect(sorted).not.toBeNull();
            expect(sorted).toHaveLength(4);

            // A must come before B, C, D
            const positions = new Map(sorted!.map((id, idx) => [id, idx]));
            expect(positions.get('A')).toBeLessThan(positions.get('B')!);
            expect(positions.get('A')).toBeLessThan(positions.get('C')!);
            expect(positions.get('B')).toBeLessThan(positions.get('D')!);
            expect(positions.get('C')).toBeLessThan(positions.get('D')!);
        });

        test('returns null for cyclic graph', () => {
            const tasks = [
                createTask('A', ['B']),
                createTask('B', ['A'])
            ];

            const sorted = topologicalSortWithCycleCheck(tasks);
            expect(sorted).toBeNull();
        });
    });
});
