
import { describe, it, expect } from 'vitest';
import { calculateTaskWeights } from '../utils/graph';
import { Task } from '../types';

describe('Logic Validation: calculateTaskWeights', () => {
    it('should respect a ratingFactor of 0 and NOT reset it to 100', () => {
        // Mock Task with 0 rating
        const mockTask: Task = {
            id: 'TEST01',
            description: 'Test Task',
            times: [10, 10, 10],
            averageTime: 10,
            standardTime: 0,
            ratingFactor: 0, // THE CRITICAL VALUE
            fatigueCategory: 'standard',
            predecessors: [],
            successors: [],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual',
            cycleQuantity: 1
        };

        const result = calculateTaskWeights([mockTask]);
        const processedTask = result[0];

        // If the bug exists, this will be 100.
        // If fixed, this should be 0.
        expect(processedTask.ratingFactor).toBe(0);
    });
});
