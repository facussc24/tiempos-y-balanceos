
import { describe, it, expect } from 'vitest';
import { Task, ProductModel } from '../types';

// Mock Recalc Function (Mirroring useTaskManager.ts logic)
const recalcWeightedTime = (task: Task, activeModels: ProductModel[], overrideUpdates: Partial<Task> = {}) => {
    const updatedTask = { ...task, ...overrideUpdates };
    const base = updatedTask.baseTime ?? (updatedTask.averageTime || 0);

    if (!activeModels || activeModels.length <= 1) {
        return base;
    }

    let weightedSum = 0;
    activeModels.forEach((m) => {
        // Default to TRUE if not defined (backward compatibility/safety)
        const isApplicable = updatedTask.modelApplicability?.[m.id] !== false;
        if (isApplicable) {
            weightedSum += base * m.percentage;
        }
    });

    return parseFloat(weightedSum.toFixed(2));
};

describe('MMALBP v2.1 Logic Verification', () => {

    it('Should return Base Time if only 1 model exists', () => {
        const task: Task = {
            id: 'T1', description: 'Test', times: [], averageTime: 10, baseTime: 10,
            ratingFactor: 100, fatigueCategory: 'standard', executionMode: 'manual',
            predecessors: [], successors: [], modelApplicability: {}
        } as any;

        const models = [{ id: 'M1', name: 'Std', percentage: 1.0, units: 100, color: '#000' }];

        const result = recalcWeightedTime(task, models);
        expect(result).toBe(10);
    });

    it('Should calculate weighted average for 2 models (Both Applicable)', () => {
        const task: Task = {
            id: 'T1', description: 'Test', times: [], averageTime: 0, baseTime: 10,
            modelApplicability: { 'M1': true, 'M2': true }
        } as any;

        const models = [
            { id: 'M1', name: 'Std', percentage: 0.8, units: 80 },
            { id: 'M2', name: 'New', percentage: 0.2, units: 20 }
        ] as any;

        // 10 * 0.8 + 10 * 0.2 = 10
        const result = recalcWeightedTime(task, models);
        expect(result).toBe(10);
    });

    it('Should calculate weighted average when one model does NOT apply', () => {
        // This simulates the User's Scenario: 12s * 0.83 + 0 * 0.17
        const task: Task = {
            id: 'T1', description: 'Test', times: [], averageTime: 0, baseTime: 12,
            modelApplicability: { 'M1': true, 'M2': false }
        } as any;

        const models = [
            { id: 'M1', name: 'Standard', percentage: 0.83, units: 83 }, // 83%
            { id: 'M2', name: 'New', percentage: 0.17, units: 17 }      // 17%
        ] as any;

        // Expected: 12 * 0.83 = 9.96
        const result = recalcWeightedTime(task, models);
        expect(result).toBe(9.96);
    });

    it('Should default to applicable if applicability is undefined', () => {
        const task: Task = {
            id: 'T1', description: 'Test', times: [], averageTime: 0, baseTime: 10,
            modelApplicability: {} // Undefined
        } as any;

        const models = [
            { id: 'M1', percentage: 0.5 },
            { id: 'M2', percentage: 0.5 }
        ] as any;

        // Should assume True for both -> 10 * 0.5 + 10 * 0.5 = 10
        const result = recalcWeightedTime(task, models);
        expect(result).toBe(10);
    });

    it('Should handle mixed applicability states (True/False/Undefined)', () => {
        const task: Task = {
            id: 'T1', description: 'Test', times: [], averageTime: 0, baseTime: 20,
            modelApplicability: { 'M1': true, 'M2': false } // M3 undefined -> True
        } as any;

        const models = [
            { id: 'M1', percentage: 0.4 }, // 20 * 0.4 = 8
            { id: 'M2', percentage: 0.4 }, // 0 (False)
            { id: 'M3', percentage: 0.2 }  // 20 * 0.2 = 4 (Undefined=True)
        ] as any;

        // Total = 12
        const result = recalcWeightedTime(task, models);
        expect(result).toBe(12);
    });
});
