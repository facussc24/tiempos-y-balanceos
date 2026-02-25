
import { describe, it, expect } from 'vitest';
import { Task, ProductModel } from '../types';
import { calculateTaskWeights } from '../utils/graph';

/**
 * MMALBP Final Validation: Precedence + Saturation Limit
 * Based on Expert Protocol #3
 * 
 * Configuration:
 * - Takt Time: 60 seconds
 * - Mix: Model A (50%), Model B (50%)
 * 
 * Key Validations:
 * - T3 (100s, only B) → 50s weighted
 * - TWC = 170s → Min 3 stations
 * - T2 = 80s causes saturation (> 60s Takt)
 * - Recommends 4 stations for valid balance
 */

const MODELS: ProductModel[] = [
    { id: 'A', name: 'Modelo A (Estándar)', percentage: 0.50, units: 480, color: '#3B82F6' },
    { id: 'B', name: 'Modelo B (Complejo)', percentage: 0.50, units: 480, color: '#F59E0B' }
];

const TAKT_TIME = 60;

const createPrecedenceTestTasks = (): Task[] => [
    {
        id: 'T1',
        description: 'Preparación Inicial',
        times: [10, 10, 10],
        averageTime: 10,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: [],
        successors: ['T2', 'T3'],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        modelApplicability: { 'A': true, 'B': true }
    } as Task,
    {
        id: 'T2',
        description: 'Instalación Estructural (LARGA - 80s)',
        times: [80, 80, 80], // 80s - CRITICAL COMMON TASK
        averageTime: 80,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: ['T1'],
        successors: ['T4'],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        modelApplicability: { 'A': true, 'B': true } // BOTH models
    } as Task,
    {
        id: 'T3',
        description: 'Costura Especial (MUY LARGA - 100s, SOLO B)',
        times: [100, 100, 100], // 100s base - CRITICAL MMALBP TASK
        averageTime: 100,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: ['T1'],
        successors: ['T4'],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        modelApplicability: { 'A': false, 'B': true } // ONLY Model B
    } as Task,
    {
        id: 'T4',
        description: 'Inspección y Sellado',
        times: [10, 10, 10],
        averageTime: 10,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: ['T2', 'T3'], // REQUIRES BOTH T2 and T3 to complete
        successors: ['T5'],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        modelApplicability: { 'A': true, 'B': true }
    } as Task,
    {
        id: 'T5',
        description: 'Empaque Final',
        times: [20, 20, 20],
        averageTime: 20,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: ['T4'],
        successors: [],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        modelApplicability: { 'A': true, 'B': true }
    } as Task
];

describe('MMALBP Final Validation (Precedence + Saturation)', () => {

    describe('Test 1: Weighted Average Times ($T_{avg}$)', () => {

        it('T1: Should be 10s (applies to both models)', () => {
            const tasks = createPrecedenceTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);
            const t1 = processed.find(t => t.id === 'T1')!;

            console.log(`[T1] ${t1.standardTime}s`);
            expect(t1.standardTime).toBeCloseTo(10, 0);
        });

        it('T2: Should be 80s (applies to both models - CRITICAL COMMON)', () => {
            const tasks = createPrecedenceTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);
            const t2 = processed.find(t => t.id === 'T2')!;

            console.log(`[T2] ${t2.standardTime}s (CRITICAL - exceeds Takt 60s)`);
            expect(t2.standardTime).toBeCloseTo(80, 0);
        });

        it('T3: Should be 50s (100s * 50% for Model B only - CRITICAL MMALBP)', () => {
            const tasks = createPrecedenceTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);
            const t3 = processed.find(t => t.id === 'T3')!;

            // Expected: (0s * 0.50) + (100s * 0.50) = 50s
            console.log(`[T3] Base: 100s, Weighted: ${t3.standardTime}s`);
            expect(t3.standardTime).toBeCloseTo(50, 0);
        });

        it('T4: Should be 10s (applies to both models)', () => {
            const tasks = createPrecedenceTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);
            const t4 = processed.find(t => t.id === 'T4')!;

            console.log(`[T4] ${t4.standardTime}s`);
            expect(t4.standardTime).toBeCloseTo(10, 0);
        });

        it('T5: Should be 20s (applies to both models)', () => {
            const tasks = createPrecedenceTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);
            const t5 = processed.find(t => t.id === 'T5')!;

            console.log(`[T5] ${t5.standardTime}s`);
            expect(t5.standardTime).toBeCloseTo(20, 0);
        });

        it('Total Work Content (TWC) should be 170s', () => {
            const tasks = createPrecedenceTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const twc = processed.reduce((sum, t) => sum + t.standardTime, 0);

            console.log(`[TWC] 10 + 80 + 50 + 10 + 20 = ${twc}s`);
            expect(twc).toBeCloseTo(170, 0);
        });
    });

    describe('Test 2: Minimum Stations Calculation (SALBP-1)', () => {

        it('Minimum stations = 3 (⌈170s / 60s⌉)', () => {
            const tasks = createPrecedenceTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const twc = processed.reduce((sum, t) => sum + t.standardTime, 0);
            const minStations = Math.ceil(twc / TAKT_TIME);

            console.log(`[Min Stations] ⌈${twc}s / ${TAKT_TIME}s⌉ = ${minStations}`);
            expect(minStations).toBe(3);
        });
    });

    describe('Test 3: Saturation Detection (SALBP-2)', () => {

        it('T2 (80s) causes Station 2 OVERLOAD (80s > Takt 60s)', () => {
            const tasks = createPrecedenceTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);
            const t2 = processed.find(t => t.id === 'T2')!;

            const station2Overloaded = t2.standardTime > TAKT_TIME;

            console.log(`[Station 2 Alert] T2 = ${t2.standardTime}s vs Takt ${TAKT_TIME}s -> ${station2Overloaded ? '🔴 OVERLOAD' : '🟢 OK'}`);
            expect(station2Overloaded).toBe(true);
        });

        it('Station 1 can fit T1 (10s) + T3 (50s) = 60s exactly', () => {
            const tasks = createPrecedenceTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const t1 = processed.find(t => t.id === 'T1')!;
            const t3 = processed.find(t => t.id === 'T3')!;

            const station1Load = t1.standardTime + t3.standardTime;
            const fitsInTakt = station1Load <= TAKT_TIME;

            console.log(`[Station 1] T1(${t1.standardTime}s) + T3(${t3.standardTime}s) = ${station1Load}s <= ${TAKT_TIME}s -> ${fitsInTakt ? '🟢 OK' : '🔴 FAIL'}`);
            expect(station1Load).toBe(60);
            expect(fitsInTakt).toBe(true);
        });

        it('System should recommend 4 stations for valid balance', () => {
            const tasks = createPrecedenceTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            // T2 alone is 80s, which exceeds 60s Takt
            // This means we need extra capacity
            // With 4 stations: 240s capacity > 170s TWC
            // Possible assignment: St1=60s, St2=80s (overload), St3=20s, St4=10s
            // OR with overtime tolerance: St1=60s, St2=60s, St3=50s (reassign parts)

            // The key insight: T2 is INDIVISIBLE at 80s, so we NEED overtime or multi-manning
            const t2 = processed.find(t => t.id === 'T2')!;
            const needsExtraCapacity = t2.standardTime > TAKT_TIME;

            // For a valid balance, we need either:
            // a) 4 stations with overtime allowed on St2
            // b) Multi-manning on St2
            const twc = processed.reduce((sum, t) => sum + t.standardTime, 0);
            const stationsNeededIfT2Split = Math.ceil((twc) / TAKT_TIME); // 3
            const actualStationsNeeded = needsExtraCapacity ? 4 : stationsNeededIfT2Split;

            console.log(`[Recommendation] TWC=${twc}s, T2=${t2.standardTime}s > Takt -> Need ${actualStationsNeeded} stations`);
            expect(actualStationsNeeded).toBe(4);
        });
    });

    describe('Test 4: Positional Weight Validation (RPW)', () => {

        it('T1 should have highest positional weight (starts all predecessors)', () => {
            const tasks = createPrecedenceTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const t1 = processed.find(t => t.id === 'T1')!;

            // T1 weight = T1 + all descendants (T2, T3, T4, T5)
            // = 10 + 80 + 50 + 10 + 20 = 170
            console.log(`[T1 Positional Weight] ${t1.positionalWeight}s`);
            expect(t1.positionalWeight).toBeCloseTo(170, 0);
        });

        it('T5 should have lowest positional weight (terminal task)', () => {
            const tasks = createPrecedenceTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const t5 = processed.find(t => t.id === 'T5')!;

            // T5 weight = T5 only (no successors) = 20
            console.log(`[T5 Positional Weight] ${t5.positionalWeight}s`);
            expect(t5.positionalWeight).toBeCloseTo(20, 0);
        });
    });
});
