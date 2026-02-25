import { describe, it, expect } from 'vitest';
import { postProcessRALBP } from '../core/balancing/ralbpLogic';
import { Assignment, Task } from '../types';

describe('ralbpLogic', () => {
    // Helper to create mocked tasks
    const createTask = (id: string, mode: 'manual' | 'injection' | 'machine', predecessors: string[] = []): Task => ({
        id,
        description: `Task ${id}`,
        executionMode: mode,
        predecessors,
        successors: [], // We don't rely on this input, logic builds it
        times: [10],
        averageTime: 10,
        standardTime: 10,
        ratingFactor: 100,
        fatigueCategory: 'none',
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        stdDev: 0,
        isMachineInternal: mode === 'manual' && predecessors.length > 0 && predecessors[0] === 'INJ' ? false : false // Simple logic for test
    });

    it('should group predecessors and successors with the injection task', () => {
        // Scenario: T1 -> T2 -> INJ -> T3 -> T4
        const tasks: Task[] = [
            createTask('T1', 'manual', []),
            createTask('T2', 'manual', ['T1']),
            createTask('INJ', 'injection', ['T2']),
            createTask('T3', 'manual', ['INJ']),
            createTask('T4', 'manual', ['T3'])
        ];

        // Initial Assignments (Scattered)
        const initialAssignments: Assignment[] = [
            { taskId: 'T1', stationId: 10 },
            { taskId: 'T2', stationId: 11 },
            { taskId: 'INJ', stationId: 5 }, // Target Station
            { taskId: 'T3', stationId: 12 },
            { taskId: 'T4', stationId: 13 }
        ];

        // Execute Logic
        const result = postProcessRALBP(initialAssignments, tasks);

        // Verify all manual tasks moved to Station 5
        expect(result.find(a => a.taskId === 'T1')?.stationId).toBe(5);
        expect(result.find(a => a.taskId === 'T2')?.stationId).toBe(5);
        expect(result.find(a => a.taskId === 'INJ')?.stationId).toBe(5);
        expect(result.find(a => a.taskId === 'T3')?.stationId).toBe(5);
        expect(result.find(a => a.taskId === 'T4')?.stationId).toBe(5);
    });

    it('should handle disjoint machine groups correctly', () => {
        // Scenario: T1 -> INJ1 -> T2   AND   T3 -> INJ2 -> T4
        const tasks: Task[] = [
            // Group 1
            createTask('T1', 'manual', []),
            createTask('INJ1', 'injection', ['T1']),
            createTask('T2', 'manual', ['INJ1']),
            // Group 2
            createTask('T3', 'manual', []),
            createTask('INJ2', 'injection', ['T3']),
            createTask('T4', 'manual', ['INJ2']),
        ];

        // Initial Assignments
        const initialAssignments: Assignment[] = [
            { taskId: 'T1', stationId: 1 }, { taskId: 'INJ1', stationId: 2 }, { taskId: 'T2', stationId: 3 },
            { taskId: 'T3', stationId: 4 }, { taskId: 'INJ2', stationId: 5 }, { taskId: 'T4', stationId: 6 },
        ];

        const result = postProcessRALBP(initialAssignments, tasks);

        // Group 1 should be at Station 2
        expect(result.find(a => a.taskId === 'T1')?.stationId).toBe(2);
        expect(result.find(a => a.taskId === 'T2')?.stationId).toBe(2);

        // Group 2 should be at Station 5
        expect(result.find(a => a.taskId === 'T3')?.stationId).toBe(5);
        expect(result.find(a => a.taskId === 'T4')?.stationId).toBe(5);
    });

    it('should handle complex branching', () => {
        // T1 -> INJ
        // T2 -> INJ
        // INJ -> T3
        // INJ -> T4
        const tasks: Task[] = [
            createTask('T1', 'manual', []),
            createTask('T2', 'manual', []),
            createTask('INJ', 'injection', ['T1', 'T2']),
            createTask('T3', 'manual', ['INJ']),
            createTask('T4', 'manual', ['INJ']),
        ];

        const assignments: Assignment[] = [
            { taskId: 'T1', stationId: 1 }, { taskId: 'T2', stationId: 2 },
            { taskId: 'INJ', stationId: 3 },
            { taskId: 'T3', stationId: 4 }, { taskId: 'T4', stationId: 5 },
        ];

        const result = postProcessRALBP(assignments, tasks);

        result.forEach(a => {
            expect(a.stationId).toBe(3);
        });
    });
});
