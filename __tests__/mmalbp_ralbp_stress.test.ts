
import { describe, it, expect } from 'vitest';
import { Task, ProductModel } from '../types';
import { calculateTaskWeights } from '../utils/graph';

/**
 * MMALBP + RALBP Stress Test (Multi-Operator Scenario)
 * Based on Expert Validation Protocol - Scenario 2
 * 
 * Configuration:
 * - Takt Time: 60 seconds
 * - Machine Curing Time (TCR): 45 seconds
 * - Mix: Model A (50%), Model B (50%)
 * 
 * Key Validation:
 * - External load forces 2 operators (50s / 45s = 2)
 * - T3 weighted average: 30s * 0.5 = 15s
 */

const MODELS: ProductModel[] = [
    { id: 'A', name: 'Modelo A', percentage: 0.50, units: 480, color: '#3B82F6' },
    { id: 'B', name: 'Modelo B', percentage: 0.50, units: 480, color: '#F59E0B' }
];

const TAKT_TIME = 60;
const MACHINE_CURING_TIME = 45; // TCR

const createStressTestTasks = (): Task[] => [
    {
        id: 'T1',
        description: 'Preparación de Molde',
        times: [15, 15, 15],
        averageTime: 15,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: [],
        successors: ['INJ'],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        isMachineInternal: false, // EXTERNAL
        modelApplicability: { 'A': true, 'B': true }
    } as Task,
    {
        id: 'T2',
        description: 'Aplicación de Desmoldante',
        times: [20, 20, 20],
        averageTime: 20,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: [],
        successors: ['INJ'],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        isMachineInternal: false, // EXTERNAL
        modelApplicability: { 'A': true, 'B': true }
    } as Task,
    {
        id: 'T3',
        description: 'Control de Calidad (CC) - SOLO Modelo B',
        times: [30, 30, 30], // 30s base time
        averageTime: 30,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: ['INJ'],
        successors: [],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        isMachineInternal: false, // EXTERNAL (Post-INJ quality check)
        modelApplicability: { 'A': false, 'B': true } // ONLY Model B
    } as Task,
    {
        id: 'INJ',
        description: 'Inyección + Curado',
        times: [45, 45, 45],
        averageTime: 45,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'low',
        predecessors: ['T1', 'T2'],
        successors: ['T3', 'T4', 'T5'],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'injection',
        modelApplicability: { 'A': true, 'B': true }
    } as Task,
    {
        id: 'T4',
        description: 'Retiro y Desmolde',
        times: [10, 10, 10],
        averageTime: 10,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: ['INJ'],
        successors: [],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        isMachineInternal: true, // INTERNAL (during curing)
        modelApplicability: { 'A': true, 'B': true }
    } as Task,
    {
        id: 'T5',
        description: 'Embalaje Final y Sellado',
        times: [25, 25, 25],
        averageTime: 25,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: ['T4'],
        successors: [],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        isMachineInternal: true, // INTERNAL (during curing)
        modelApplicability: { 'A': true, 'B': true }
    } as Task
];

describe('MMALBP + RALBP Stress Test (Multi-Operator)', () => {

    describe('Test 1: Weighted Average for Mixed Tasks', () => {

        it('T3 (CC): Should calculate T_avg = 15s (30s * 50% for Model B only)', () => {
            const tasks = createStressTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);
            const t3 = processed.find(t => t.id === 'T3')!;

            // Expected: (0s * 0.50) + (30s * 0.50) = 0 + 15 = 15s
            console.log(`[T3] Base: 30s, Weighted: ${t3.standardTime}s`);
            expect(t3.standardTime).toBeCloseTo(15, 0);
        });

        it('T1, T2 should remain at full time (apply to both models)', () => {
            const tasks = createStressTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const t1 = processed.find(t => t.id === 'T1')!;
            const t2 = processed.find(t => t.id === 'T2')!;

            console.log(`[T1] ${t1.standardTime}s, [T2] ${t2.standardTime}s`);
            expect(t1.standardTime).toBeCloseTo(15, 0);
            expect(t2.standardTime).toBeCloseTo(20, 0);
        });
    });

    describe('Test 2: External Load and Minimum Operators (RALBP)', () => {

        it('Total External Manual Load = 50s (T1 + T2 + T3)', () => {
            const tasks = createStressTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            // External tasks (NOT during curing)
            const externalTasks = processed.filter(t =>
                t.executionMode === 'manual' && !t.isMachineInternal
            );

            const externalLoad = externalTasks.reduce((sum, t) => sum + t.standardTime, 0);

            console.log(`[External Load] ${externalTasks.map(t => `${t.id}:${t.standardTime}s`).join(' + ')} = ${externalLoad}s`);
            // T1 (15s) + T2 (20s) + T3 (15s) = 50s
            expect(externalLoad).toBeCloseTo(50, 0);
        });

        it('Minimum Operators = 2 (⌈50s / 45s⌉)', () => {
            const tasks = createStressTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const externalTasks = processed.filter(t =>
                t.executionMode === 'manual' && !t.isMachineInternal
            );
            const externalLoad = externalTasks.reduce((sum, t) => sum + t.standardTime, 0);

            const minOperators = Math.ceil(externalLoad / MACHINE_CURING_TIME);

            console.log(`[Min Operators] ⌈${externalLoad}s / ${MACHINE_CURING_TIME}s⌉ = ${minOperators}`);
            expect(minOperators).toBe(2);
        });
    });

    describe('Test 3: Total Work Content and Overload Detection', () => {

        it('Internal Load = 35s (T4 + T5)', () => {
            const tasks = createStressTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const internalTasks = processed.filter(t =>
                t.executionMode === 'manual' && t.isMachineInternal === true
            );

            const internalLoad = internalTasks.reduce((sum, t) => sum + t.standardTime, 0);

            console.log(`[Internal Load] ${internalTasks.map(t => `${t.id}:${t.standardTime}s`).join(' + ')} = ${internalLoad}s`);
            // T4 (10s) + T5 (25s) = 35s
            expect(internalLoad).toBeCloseTo(35, 0);
        });

        it('Total Work Content (TWC) = 85s (External 50s + Internal 35s)', () => {
            const tasks = createStressTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const manualTasks = processed.filter(t => t.executionMode === 'manual');
            const twc = manualTasks.reduce((sum, t) => sum + t.standardTime, 0);

            console.log(`[TWC] Total = ${twc}s`);
            expect(twc).toBeCloseTo(85, 0);
        });

        it('OVERLOAD ALERT: 1 Operator cannot handle TWC=85s (> Takt 60s)', () => {
            const tasks = createStressTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const manualTasks = processed.filter(t => t.executionMode === 'manual');
            const twc = manualTasks.reduce((sum, t) => sum + t.standardTime, 0);

            const singleOperatorOverloaded = twc > TAKT_TIME;

            console.log(`[Overload Check] TWC ${twc}s vs Takt ${TAKT_TIME}s -> ${singleOperatorOverloaded ? '🔴 OVERLOADED' : '🟢 OK'}`);
            expect(singleOperatorOverloaded).toBe(true);
        });

        it('2 Operators can handle TWC=85s (capacity 120s)', () => {
            const tasks = createStressTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const manualTasks = processed.filter(t => t.executionMode === 'manual');
            const twc = manualTasks.reduce((sum, t) => sum + t.standardTime, 0);

            const twoOperatorCapacity = TAKT_TIME * 2; // 120s
            const twoOperatorsCanHandle = twc <= twoOperatorCapacity;

            console.log(`[2 Operators] TWC ${twc}s vs Capacity ${twoOperatorCapacity}s -> ${twoOperatorsCanHandle ? '🟢 FEASIBLE' : '🔴 NOT ENOUGH'}`);
            expect(twoOperatorsCanHandle).toBe(true);
        });

        it('Load per Operator = ~42.5s (balanced)', () => {
            const tasks = createStressTestTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const manualTasks = processed.filter(t => t.executionMode === 'manual');
            const twc = manualTasks.reduce((sum, t) => sum + t.standardTime, 0);

            const avgLoadPerOperator = twc / 2;

            console.log(`[Balanced Load] ${twc}s / 2 operators = ${avgLoadPerOperator}s per operator`);
            expect(avgLoadPerOperator).toBeLessThanOrEqual(TAKT_TIME);
        });
    });
});
