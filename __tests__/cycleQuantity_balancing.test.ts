/**
 * Bug 1 Regression: cycleQuantity != 1 with machine tasks should NOT produce all-zero results.
 * Tests the full flow: calculateTaskWeights → simulateBalance
 */
import { describe, it, expect } from 'vitest';
import { calculateTaskWeights } from '../utils/graph';
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task, Shift } from '../types';

const makeTask = (overrides: Partial<Task>): Task => ({
    id: 'T1',
    description: 'Test Task',
    times: [30, 30, 30, 30, 30],
    averageTime: 0,
    standardTime: 0,
    ratingFactor: 100,
    fatigueCategory: 'none',
    predecessors: [],
    successors: [],
    positionalWeight: 0,
    calculatedSuccessorSum: 0,
    stdDev: 0,
    executionMode: 'manual',
    ...overrides
});

const defaultShift: Shift = {
    id: 1,
    name: 'Turno 1',
    startTime: '06:00',
    endTime: '14:00',
    breaks: [{ id: 'b1', name: 'Almuerzo', startTime: '12:00', duration: 30 }]
};

const makeProjectData = (tasks: Task[], overrides?: Partial<ProjectData>): ProjectData => ({
    meta: {
        name: 'Bug1 Test',
        date: '2026-01-01',
        client: 'Test',
        version: '1.0',
        engineer: 'Test',
        dailyDemand: 500,
        activeShifts: 1,
        configuredStations: 8,
        manualOEE: 0.85,
        useManualOEE: true,
        balancingMode: 'SALBP1',
        ...overrides?.meta
    },
    shifts: overrides?.shifts || [defaultShift],
    tasks,
    assignments: [],
    stationConfigs: [],
    sectors: overrides?.sectors || [],
    zoningConstraints: [],
    ...overrides
});

describe('Bug 1: cycleQuantity + Machine Mode Balancing', () => {

    it('calculateTaskWeights normalizes machine task times by cycleQuantity', () => {
        const task = makeTask({
            id: 'MAQ1',
            times: [90, 90, 90, 90, 90], // 90s total cycle for 3 pieces
            executionMode: 'machine',
            cycleQuantity: 3
        });

        const [result] = calculateTaskWeights([task]);

        // averageTime should be 90/3 = 30
        expect(result.averageTime).toBeCloseTo(30, 1);
        // Machine mode: rating=100%, fatigue=0%
        expect(result.standardTime).toBeCloseTo(30, 1);
        expect(result.standardTime).toBeGreaterThan(0);
    });

    it('machine task with cycleQuantity=3 passes optimization filter (time > 0)', () => {
        const task = makeTask({
            id: 'MAQ1',
            times: [90, 88, 92, 91, 89],
            executionMode: 'machine',
            cycleQuantity: 3
        });

        const [processed] = calculateTaskWeights([task]);
        const time = processed.standardTime || processed.averageTime || 0;

        expect(time).toBeGreaterThan(0);
    });

    it('mixed manual + machine tasks with cycleQuantity > 1 produce non-zero optimization', () => {
        const rawTasks: Task[] = [
            makeTask({ id: 'T1', description: 'Corte', times: [25, 26, 24, 25, 25], executionMode: 'manual' }),
            makeTask({ id: 'T2', description: 'Costura', times: [35, 34, 36, 35, 35], executionMode: 'manual', predecessors: ['T1'] }),
            makeTask({
                id: 'T3', description: 'Tapizado automático',
                times: [90, 88, 92, 91, 89], // ~90s total for 3 pieces
                executionMode: 'machine',
                cycleQuantity: 3,
                predecessors: ['T2']
            }),
            makeTask({ id: 'T4', description: 'Empaque', times: [20, 21, 19, 20, 20], executionMode: 'manual', predecessors: ['T3'] })
        ];

        // Normalize via calculateTaskWeights
        const tasks = calculateTaskWeights(rawTasks);

        // Verify normalization
        const maq = tasks.find(t => t.id === 'T3')!;
        expect(maq.standardTime).toBeGreaterThan(0);
        expect(maq.standardTime).toBeLessThan(40); // Should be ~30s, not 90s

        // Build project data
        const data = makeProjectData(tasks);

        // Run optimization (SALBP-1 via greedy)
        // Takt time = (450min * 60s) / 500pcs = 54s nominal, ~45.9s effective (0.85 OEE)
        const nominalSeconds = (450 * 60) / 500; // 54s
        const effectiveSeconds = nominalSeconds * 0.85; // 45.9s

        const result = simulateBalance(data, 'RPW', 'Test', nominalSeconds, effectiveSeconds);

        // Optimization must produce non-zero results
        expect(result.stationsCount).toBeGreaterThan(0);
        expect(result.totalHeadcount).toBeGreaterThan(0);
        expect(result.assignments.length).toBe(4); // All 4 tasks assigned
        expect(result.realCycleTime).toBeGreaterThan(0);

        // All stations must have non-zero effective time
        result.proposedConfigs.forEach(cfg => {
            expect(cfg.effectiveTime).toBeGreaterThan(0);
        });
    });

    it('all-machine tasks with cycleQuantity > 1 still produce valid optimization', () => {
        const rawTasks: Task[] = [
            makeTask({
                id: 'M1', description: 'Máquina A',
                times: [60, 60, 60, 60, 60],
                executionMode: 'machine',
                cycleQuantity: 2 // 60/2 = 30s per unit
            }),
            makeTask({
                id: 'M2', description: 'Máquina B',
                times: [120, 120, 120, 120, 120],
                executionMode: 'machine',
                cycleQuantity: 4, // 120/4 = 30s per unit
                predecessors: ['M1']
            }),
            makeTask({
                id: 'M3', description: 'Máquina C',
                times: [150, 150, 150, 150, 150],
                executionMode: 'machine',
                cycleQuantity: 5, // 150/5 = 30s per unit
                predecessors: ['M2']
            })
        ];

        const tasks = calculateTaskWeights(rawTasks);

        // All standardTimes should be ~30s
        tasks.forEach(t => {
            expect(t.standardTime).toBeCloseTo(30, 1);
        });

        const data = makeProjectData(tasks);
        const nominalSeconds = 60;
        const effectiveSeconds = 51;

        const result = simulateBalance(data, 'RPW', 'Test', nominalSeconds, effectiveSeconds);

        expect(result.stationsCount).toBeGreaterThan(0);
        expect(result.assignments.length).toBe(3);
        expect(result.realCycleTime).toBeGreaterThan(0);
    });

    it('cycleQuantity=1 vs cycleQuantity>1 produce proportionally correct standardTimes', () => {
        const taskQ1 = makeTask({
            id: 'A', times: [30, 30, 30, 30, 30],
            executionMode: 'machine', cycleQuantity: 1
        });
        const taskQ3 = makeTask({
            id: 'B', times: [90, 90, 90, 90, 90],
            executionMode: 'machine', cycleQuantity: 3
        });

        const [resultQ1] = calculateTaskWeights([taskQ1]);
        const [resultQ3] = calculateTaskWeights([taskQ3]);

        // Both should yield the same per-unit standardTime
        expect(resultQ1.standardTime).toBeCloseTo(resultQ3.standardTime, 1);
        expect(resultQ1.standardTime).toBeCloseTo(30, 1);
        expect(resultQ3.standardTime).toBeCloseTo(30, 1);
    });
});
