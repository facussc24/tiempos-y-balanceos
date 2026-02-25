
import { describe, it, expect } from 'vitest';
import { Task, ProductModel } from '../types';
import { calculateTaskWeights } from '../utils/graph';

/**
 * MMALBP Edge Cases Test Suite
 * Tests scenarios not covered by main validation tests
 */

describe('MMALBP Edge Cases', () => {

    it('Should handle task with orphan modelApplicability IDs (deleted model)', () => {
        const models: ProductModel[] = [
            { id: 'A', name: 'Modelo A', percentage: 1.0, units: 100, color: '#000' }
        ];

        const task: Task = {
            id: 'T1',
            description: 'Test',
            times: [10, 10, 10],
            averageTime: 10,
            standardTime: 0,
            ratingFactor: 100,
            fatigueCategory: 'none',
            predecessors: [],
            successors: [],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            executionMode: 'manual',
            modelApplicability: { 'A': true, 'DELETED_MODEL': false } // Orphan ID
        } as Task;

        const result = calculateTaskWeights([task], models);
        // Should not crash and should only consider active model 'A'
        // With 1 model, no weighting is applied (returns averageTime)
        expect(result[0].standardTime).toBeCloseTo(10, 0);
    });

    it('Should handle empty times array gracefully', () => {
        const models: ProductModel[] = [];
        const task: Task = {
            id: 'T1',
            description: 'Test',
            times: [],
            averageTime: 0,
            standardTime: 0,
            ratingFactor: 100,
            fatigueCategory: 'none',
            predecessors: [],
            successors: [],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            executionMode: 'manual',
            modelApplicability: {}
        } as Task;

        const result = calculateTaskWeights([task], models);
        expect(result[0].standardTime).toBe(0);
    });

    it('Should handle all models set to NOT applicable (0% effective time)', () => {
        const models: ProductModel[] = [
            { id: 'A', name: 'Modelo A', percentage: 0.5, units: 50, color: '#000' },
            { id: 'B', name: 'Modelo B', percentage: 0.5, units: 50, color: '#000' }
        ];

        const task: Task = {
            id: 'T1',
            description: 'Test',
            times: [10, 10, 10],
            averageTime: 10,
            standardTime: 0,
            ratingFactor: 100,
            fatigueCategory: 'none',
            predecessors: [],
            successors: [],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            executionMode: 'manual',
            modelApplicability: { 'A': false, 'B': false }
        } as Task;

        const result = calculateTaskWeights([task], models);
        // 0s * 0.5 + 0s * 0.5 = 0
        expect(result[0].standardTime).toBe(0);
    });

    it('Should handle undefined modelApplicability (default all true)', () => {
        const models: ProductModel[] = [
            { id: 'A', name: 'Modelo A', percentage: 0.5, units: 50, color: '#000' },
            { id: 'B', name: 'Modelo B', percentage: 0.5, units: 50, color: '#000' }
        ];

        const task: Task = {
            id: 'T1',
            description: 'Test',
            times: [10, 10, 10],
            averageTime: 10,
            standardTime: 0,
            ratingFactor: 100,
            fatigueCategory: 'none',
            predecessors: [],
            successors: [],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            executionMode: 'manual'
            // No modelApplicability defined - should default to all true
        } as Task;

        const result = calculateTaskWeights([task], models);
        // 10s * 0.5 + 10s * 0.5 = 10s (full time)
        expect(result[0].standardTime).toBeCloseTo(10, 0);
    });

    it('Should handle single model (no weighting applied)', () => {
        const models: ProductModel[] = [
            { id: 'A', name: 'Modelo A', percentage: 1.0, units: 100, color: '#000' }
        ];

        const task: Task = {
            id: 'T1',
            description: 'Test',
            times: [20, 20, 20],
            averageTime: 20,
            standardTime: 0,
            ratingFactor: 100,
            fatigueCategory: 'none',
            predecessors: [],
            successors: [],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            executionMode: 'manual',
            modelApplicability: { 'A': true }
        } as Task;

        const result = calculateTaskWeights([task], models);
        // Single model = no weighting, use averageTime directly
        expect(result[0].standardTime).toBeCloseTo(20, 0);
    });
});
