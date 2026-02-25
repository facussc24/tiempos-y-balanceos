/**
 * Mix Balancing Logic Tests
 * 
 * Tests for core MMALBP (Mixed-Model Assembly Line Balancing) functions:
 * - calculateWeightedTimes
 * - validateMixBalance  
 * - validateModelVariability
 * - generateHeijunkaSequence
 */
import { describe, it, expect } from 'vitest';
import {
    calculateWeightedTimes,
    generateHeijunkaSequence,
    validateMixBalance,
    validateModelVariability,
    MIN_SATURATION_THRESHOLD
} from '../core/balancing/mixBalancing';
import { FatigueCategory } from '../types';

// Helper factory para crear mocks de MixTask con todos los campos requeridos
const createMockTask = (overrides: {
    id: string;
    description: string;
    standardTime: number;
    predecessors: string[];
    successors: string[];
    _multiProductTimes?: Array<{ productId: string; time: number; demand: number }>;
}) => ({
    times: [] as (number | null)[],
    averageTime: 0,
    ratingFactor: 100,
    fatigueCategory: 'standard' as FatigueCategory,
    positionalWeight: 0,
    calculatedSuccessorSum: 0,
    ...overrides
});

describe('Mix Balancing Logic', () => {

    describe('calculateWeightedTimes', () => {
        it('should calculate weighted average for two products with equal demand', () => {
            const tasks = [createMockTask({
                id: 'T1',
                description: 'Assembly',
                standardTime: 0,
                predecessors: [],
                successors: [],
                _multiProductTimes: [
                    { productId: 'ProductA', time: 40, demand: 500 },
                    { productId: 'ProductB', time: 60, demand: 500 }
                ]
            })];

            const totalDemand = 1000;
            const result = calculateWeightedTimes(tasks, totalDemand);

            // Weighted = (40 × 0.5) + (60 × 0.5) = 50
            expect(result[0].standardTime).toBe(50);
            expect(result[0]._weightedTime).toBe(50);
        });

        it('should calculate weighted average with unequal demand (2:1 ratio)', () => {
            const tasks = [createMockTask({
                id: 'T1',
                description: 'Assembly',
                standardTime: 0,
                predecessors: [],
                successors: [],
                _multiProductTimes: [
                    { productId: 'ProductA', time: 45, demand: 600 },
                    { productId: 'ProductB', time: 60, demand: 300 }
                ]
            })];

            const totalDemand = 900;
            const result = calculateWeightedTimes(tasks, totalDemand);

            // Weighted = (45 × 0.67) + (60 × 0.33) = 30.15 + 19.8 = 49.95 ≈ 50
            expect(result[0].standardTime).toBeCloseTo(50, 0);
        });

        it('should mark low-weight tasks when below threshold', () => {
            const tasks = [createMockTask({
                id: 'T1',
                description: 'Small task',
                standardTime: 0,
                predecessors: [],
                successors: [],
                _multiProductTimes: [
                    { productId: 'ProductA', time: 5, demand: 500 }
                ]
            })];

            const totalDemand = 500;
            const taktTime = 60; // 5s is less than 15% of 60s (9s threshold)
            const result = calculateWeightedTimes(tasks, totalDemand, taktTime);

            expect(result[0]._isLowWeight).toBe(true);
        });

        it('should return tasks unchanged when demand is 0', () => {
            const tasks = [createMockTask({
                id: 'T1',
                description: 'Test',
                standardTime: 30,
                predecessors: [],
                successors: [],
                _multiProductTimes: [
                    { productId: 'ProductA', time: 30, demand: 0 }
                ]
            })];

            const result = calculateWeightedTimes(tasks, 0);
            expect(result[0].standardTime).toBe(30); // Unchanged
        });
    });

    describe('generateHeijunkaSequence', () => {
        it('should generate batch sequence for 2:1 ratio (V8.2)', () => {
            const products = [
                { name: 'Alfa', demand: 200 },
                { name: 'Beta', demand: 100 }
            ];

            const result = generateHeijunkaSequence(products);

            // V8.2: Now generates batch format instead of A-A-B
            expect(result.sequence).toContain('Lote');
            expect(result.rationale).toContain('Producción por lotes');
        });

        it('should return batch format for one product', () => {
            const products = [
                { name: 'Single', demand: 500 }
            ];

            const result = generateHeijunkaSequence(products);

            expect(result.sequence).toContain('Lote Single');
            expect(result.rationale).toContain('un solo modelo');
        });

        it('should return empty for no products', () => {
            const result = generateHeijunkaSequence([]);

            expect(result.sequence).toBe('');
            expect(result.rationale).toContain('No hay productos');
        });

        it('should handle equal demand products (V8.2 batch format)', () => {
            const products = [
                { name: 'Prod1', demand: 300 },
                { name: 'Prod2', demand: 300 }
            ];

            const result = generateHeijunkaSequence(products);

            // V8.2: Batch format with cambio between
            expect(result.sequence).toContain('Cambio');
            expect(result.sequence).toContain('Lote');
        });
    });

    describe('validateModelVariability', () => {
        it('should flag critical alert when model exceeds Takt', () => {
            const tasks = [createMockTask({
                id: 'T1',
                description: 'Bottleneck task',
                standardTime: 80,
                predecessors: [],
                successors: [],
                _multiProductTimes: [
                    { productId: 'SlowModel', time: 80, demand: 500 }
                ]
            })];

            const taktTime = 60;
            const totalDemand = 500;

            const result = validateModelVariability(tasks, taktTime, totalDemand);

            expect(result.valid).toBe(false);
            expect(result.alerts.length).toBeGreaterThan(0);
            expect(result.alerts[0].severity).toBe('critical');
            expect(result.alerts[0].excessSeconds).toBe(20);
        });

        it('should flag warning when model is 90-100% of Takt', () => {
            const tasks = [createMockTask({
                id: 'T1',
                description: 'Tight task',
                standardTime: 57,
                predecessors: [],
                successors: [],
                _multiProductTimes: [
                    { productId: 'TightModel', time: 57, demand: 500 }
                ]
            })];

            const taktTime = 60;
            const totalDemand = 500;

            const result = validateModelVariability(tasks, taktTime, totalDemand);

            expect(result.valid).toBe(true); // Not critical
            expect(result.alerts.length).toBeGreaterThan(0);
            expect(result.alerts[0].severity).toBe('warning');
        });

        it('should be valid when all models are under Takt', () => {
            const tasks = [createMockTask({
                id: 'T1',
                description: 'Normal task',
                standardTime: 40,
                predecessors: [],
                successors: [],
                _multiProductTimes: [
                    { productId: 'FastModel', time: 40, demand: 500 }
                ]
            })];

            const taktTime = 60;
            const totalDemand = 500;

            const result = validateModelVariability(tasks, taktTime, totalDemand);

            expect(result.valid).toBe(true);
            expect(result.alerts.filter(a => a.severity === 'critical').length).toBe(0);
        });

        it('should track worst case model', () => {
            const tasks = [createMockTask({
                id: 'T1',
                description: 'Multi-model task',
                standardTime: 0,
                predecessors: [],
                successors: [],
                _multiProductTimes: [
                    { productId: 'Fast', time: 30, demand: 300 },
                    { productId: 'Slow', time: 55, demand: 300 }
                ]
            })];

            const result = validateModelVariability(tasks, 60, 600);

            expect(result.worstCase).not.toBeNull();
            expect(result.worstCase?.modelId).toBe('Slow');
            expect(result.worstCase?.maxTime).toBe(55);
        });
    });

    describe('MIN_SATURATION_THRESHOLD constant', () => {
        it('should be 15%', () => {
            expect(MIN_SATURATION_THRESHOLD).toBe(0.15);
        });
    });
});
