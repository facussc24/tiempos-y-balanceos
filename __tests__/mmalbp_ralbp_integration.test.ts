
import { describe, it, expect } from 'vitest';
import { Task, ProductModel } from '../types';
import { calculateTaskWeights } from '../utils/graph';

/**
 * MMALBP + RALBP Integration Test
 * Based on Expert Validation Protocol
 * 
 * Configuration:
 * - Daily Demand: 960 units
 * - Productive Time: 960 min (2 shifts)
 * - Takt Time: 60 seconds
 * - Mix: Model A (60%), Model B (40%)
 * - Curing Time (RALBP): 45 seconds
 */

// --- TEST CONFIGURATION ---
const MODELS: ProductModel[] = [
    { id: 'A', name: 'Modelo A (Estándar)', percentage: 0.60, units: 576, color: '#3B82F6' },
    { id: 'B', name: 'Modelo B (Complejo)', percentage: 0.40, units: 384, color: '#F59E0B' }
];

const TAKT_TIME = 60; // seconds

// Create mock tasks based on expert's protocol
const createMockTasks = (): Task[] => [
    {
        id: 'T1',
        description: 'Preparación Molde',
        times: [15, 15, 15], // 15s base time
        averageTime: 15,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: [],
        successors: ['INJ'],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        modelApplicability: { 'A': true, 'B': true } // Applies to BOTH
    } as Task,
    {
        id: 'T2',
        description: 'Costura Vista (SOLO Modelo B)',
        times: [120, 120, 120], // 120s base time
        averageTime: 120,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: ['INJ'],
        successors: ['T3'],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        modelApplicability: { 'A': false, 'B': true } // ONLY Model B
    } as Task,
    {
        id: 'T3',
        description: 'Ensamble Final',
        times: [30, 30, 30], // 30s base time
        averageTime: 30,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: ['T2'],
        successors: [],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        modelApplicability: { 'A': true, 'B': true } // Applies to BOTH
    } as Task,
    {
        id: 'T4',
        description: 'Desmoldar/Limpiar',
        times: [20, 20, 20], // 20s base time
        averageTime: 20,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'none',
        predecessors: ['INJ'],
        successors: [],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'manual',
        modelApplicability: { 'A': true, 'B': true } // Applies to BOTH
    } as Task,
    {
        id: 'INJ',
        description: 'Inyección/Curado (Máquina Rotativa)',
        times: [45, 45, 45], // 45s machine cycle
        averageTime: 45,
        standardTime: 0,
        ratingFactor: 100,
        fatigueCategory: 'low', // Machines have 0 fatigue
        predecessors: ['T1'],
        successors: ['T2', 'T4'],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode: 'injection', // Machine mode
        modelApplicability: { 'A': true, 'B': true } // Machine applies to all
    } as Task
];

describe('MMALBP + RALBP Integration Test (Expert Protocol)', () => {

    describe('Test 1: Weighted Average Time (T_avg) Validation', () => {

        it('T1 (Preparación Molde): Should calculate T_avg = 15s (Applies to both models)', () => {
            const tasks = createMockTasks();
            const processed = calculateTaskWeights(tasks, MODELS);
            const t1 = processed.find(t => t.id === 'T1')!;

            // Expected: (15s * 0.60) + (15s * 0.40) = 9 + 6 = 15s
            // With no fatigue (none) and rating 100%: standardTime = 15s
            console.log(`[T1] averageTime: ${t1.averageTime}, standardTime: ${t1.standardTime}`);
            expect(t1.standardTime).toBeCloseTo(15, 0);
        });

        it('T2 (Costura Vista): Should calculate T_avg = 48s (CRITICAL - Only Model B)', () => {
            const tasks = createMockTasks();
            const processed = calculateTaskWeights(tasks, MODELS);
            const t2 = processed.find(t => t.id === 'T2')!;

            // Expected: (0s * 0.60) + (120s * 0.40) = 0 + 48 = 48s
            console.log(`[T2] averageTime: ${t2.averageTime}, standardTime: ${t2.standardTime}`);
            expect(t2.standardTime).toBeCloseTo(48, 0);
        });

        it('T3 (Ensamble Final): Should calculate T_avg = 30s', () => {
            const tasks = createMockTasks();
            const processed = calculateTaskWeights(tasks, MODELS);
            const t3 = processed.find(t => t.id === 'T3')!;

            // Expected: (30s * 0.60) + (30s * 0.40) = 18 + 12 = 30s
            console.log(`[T3] averageTime: ${t3.averageTime}, standardTime: ${t3.standardTime}`);
            expect(t3.standardTime).toBeCloseTo(30, 0);
        });

        it('T4 (Desmoldar/Limpiar): Should calculate T_avg = 20s', () => {
            const tasks = createMockTasks();
            const processed = calculateTaskWeights(tasks, MODELS);
            const t4 = processed.find(t => t.id === 'T4')!;

            // Expected: (20s * 0.60) + (20s * 0.40) = 12 + 8 = 20s
            console.log(`[T4] averageTime: ${t4.averageTime}, standardTime: ${t4.standardTime}`);
            expect(t4.standardTime).toBeCloseTo(20, 0);
        });

        it('Total Work Content (TWC) should be 113 seconds', () => {
            const tasks = createMockTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            // Only manual tasks (exclude INJ machine time)
            const manualTasks = processed.filter(t => t.executionMode === 'manual');
            const twc = manualTasks.reduce((sum, t) => sum + t.standardTime, 0);

            console.log(`[TWC] Total Manual Work Content: ${twc}s`);
            // Expected: 15 + 48 + 30 + 20 = 113s
            expect(twc).toBeCloseTo(113, 0);
        });
    });

    describe('Test 2: Minimum Stations and Overload Detection', () => {

        it('Minimum theoretical stations should be 2 (TWC=113s / Takt=60s)', () => {
            const tasks = createMockTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const manualTasks = processed.filter(t => t.executionMode === 'manual');
            const twc = manualTasks.reduce((sum, t) => sum + t.standardTime, 0);

            const minStations = Math.ceil(twc / TAKT_TIME);

            console.log(`[Stations] TWC: ${twc}s, Takt: ${TAKT_TIME}s, Min Stations: ${minStations}`);
            expect(minStations).toBe(2);
        });

        it('Station 1 (Rotary Cell) external load should be 35s (T1 + T4)', () => {
            const tasks = createMockTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const t1 = processed.find(t => t.id === 'T1')!;
            const t4 = processed.find(t => t.id === 'T4')!;

            const station1ExternalLoad = t1.standardTime + t4.standardTime;

            console.log(`[Station 1] External Load: ${station1ExternalLoad}s (T1: ${t1.standardTime}s + T4: ${t4.standardTime}s)`);
            // Expected: 15s + 20s = 35s
            expect(station1ExternalLoad).toBeCloseTo(35, 0);
        });

        it('Station 1 should NOT overload (External Load 35s < Curing Time 45s)', () => {
            const tasks = createMockTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const t1 = processed.find(t => t.id === 'T1')!;
            const t4 = processed.find(t => t.id === 'T4')!;
            const curingTime = 45; // INJ machine cycle

            const externalLoad = t1.standardTime + t4.standardTime;
            const isOverloaded = externalLoad > curingTime;

            console.log(`[Station 1 Overload Check] External: ${externalLoad}s vs Curing: ${curingTime}s -> ${isOverloaded ? 'OVERLOADED' : 'OK'}`);
            expect(isOverloaded).toBe(false);
        });

        it('Station 2 load should be 78s (T2 + T3) - EXCEEDS TAKT TIME', () => {
            const tasks = createMockTasks();
            const processed = calculateTaskWeights(tasks, MODELS);

            const t2 = processed.find(t => t.id === 'T2')!;
            const t3 = processed.find(t => t.id === 'T3')!;

            const station2Load = t2.standardTime + t3.standardTime;
            const exceedsTakt = station2Load > TAKT_TIME;

            console.log(`[Station 2] Load: ${station2Load}s (T2: ${t2.standardTime}s + T3: ${t3.standardTime}s)`);
            console.log(`[Station 2 ALERT] Load ${station2Load}s ${exceedsTakt ? 'EXCEEDS' : 'OK for'} Takt Time ${TAKT_TIME}s`);

            // Expected: 48s + 30s = 78s > 60s Takt Time
            expect(station2Load).toBeCloseTo(78, 0);
            expect(exceedsTakt).toBe(true);
        });
    });
});
