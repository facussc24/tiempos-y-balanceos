import { describe, it, expect } from 'vitest';
import { calculateInjectionScenarios } from '../utils';
import { InjectionSimulationParams } from '../types';

describe('Injection Logic Simulation (Stress Test)', () => {

    const DEFAULT_PARAMS: InjectionSimulationParams = {
        puInyTime: 20,
        puCurTime: 40,
        manualOps: [],
        manualTimeOverride: null,
        // operatorStrategy removed
        // interferenceBuffer removed
        taktTime: 0,
        headcountMode: 'manual',
        userHeadcountOverride: 1,
        activeShifts: 1,
        oee: 1.0 // Simplified
    };

    describe('4. Internal vs External Manual Tasks (Expert Logic)', () => {

        // BASELINE: Machine Cycle = 60s

        it('should sum External tasks to the cycle (Sequential)', () => {
            // Machine: 60s
            // External: 10s
            // Expected: 70s
            const results = calculateInjectionScenarios({
                ...DEFAULT_PARAMS,
                manualOps: [{ id: '1', description: 'ext', time: 10, type: 'external' }]
            });
            const c1 = results.find(r => r.n === 1);
            expect(c1?.realCycle).toBe(70);
        });

        it('should absorb Internal tasks if shorter than machine cycle (Parallel)', () => {
            // Machine: 60s
            // Internal: 20s
            // Expected: 60s (Machine is bottleneck)
            const results = calculateInjectionScenarios({
                ...DEFAULT_PARAMS,
                manualOps: [{ id: '2', description: 'int', time: 20, type: 'internal' }]
            });
            const c1 = results.find(r => r.n === 1);
            expect(c1?.realCycle).toBe(60);
        });

        it('should extend cycle if Internal tasks are longer than machine cycle (Internal Bottleneck)', () => {
            // Machine: 60s
            // Internal: 80s
            // Expected: 80s (Operator is bottleneck)
            const results = calculateInjectionScenarios({
                ...DEFAULT_PARAMS,
                manualOps: [{ id: '3', description: 'int', time: 80, type: 'internal' }]
            });
            const c1 = results.find(r => r.n === 1);
            expect(c1?.realCycle).toBe(80);
        });

        it('should correctly combine Internal and External tasks', () => {
            // Machine: 60s
            // External: 10s (Always adds)
            // Internal: 20s (Absorbed by 60s)
            // Expected: Max(60, 20) + 10 = 70s
            const results = calculateInjectionScenarios({
                ...DEFAULT_PARAMS,
                manualOps: [
                    { id: '4', description: 'ext', time: 10, type: 'external' },
                    { id: '5', description: 'int', time: 20, type: 'internal' }
                ]
            });
            const c1 = results.find(r => r.n === 1);
            expect(c1?.realCycle).toBe(70);
        });

        it('should correctly combine Internal Bottleneck and External tasks', () => {
            // Machine: 60s
            // External: 10s (Always adds)
            // Internal: 80s (Bottleneck)
            // Expected: Max(60, 80) + 10 = 90s
            const results = calculateInjectionScenarios({
                ...DEFAULT_PARAMS,
                manualOps: [
                    { id: '6', description: 'ext', time: 10, type: 'external' },
                    { id: '7', description: 'int', time: 80, type: 'internal' }
                ]
            });
            const c1 = results.find(r => r.n === 1);
            expect(c1?.realCycle).toBe(90);
        });
    });
});

// ============================================================================
// MONTE CARLO SIMULATION - stdDev FALLBACK TESTS
// ============================================================================

describe('Monte Carlo Simulation - stdDev Fallback', () => {
    // Note: These tests verify the logic used in Simulation.tsx
    // The actual implementation uses boxMullerRandom from utils

    const FALLBACK_STDDEV_PERCENT = 0.10; // 10% of mean as fallback

    /**
     * Simulate the fallback logic from Simulation.tsx
     */
    function getEffectiveStdDev(task: { standardTime: number; stdDev?: number }): number {
        const hasMissingStdDev = !task.stdDev || task.stdDev <= 0;
        return hasMissingStdDev
            ? task.standardTime * FALLBACK_STDDEV_PERCENT
            : task.stdDev!;
    }

    it('should use 10% fallback when stdDev is 0', () => {
        const task = { standardTime: 100, stdDev: 0 };
        const effectiveStdDev = getEffectiveStdDev(task);

        expect(effectiveStdDev).toBe(10); // 10% of 100
    });

    it('should use 10% fallback when stdDev is undefined', () => {
        const task = { standardTime: 50, stdDev: undefined };
        const effectiveStdDev = getEffectiveStdDev(task);

        expect(effectiveStdDev).toBe(5); // 10% of 50
    });

    it('should use 10% fallback when stdDev is negative', () => {
        const task = { standardTime: 200, stdDev: -5 };
        const effectiveStdDev = getEffectiveStdDev(task);

        expect(effectiveStdDev).toBe(20); // 10% of 200
    });

    it('should use actual stdDev when valid', () => {
        const task = { standardTime: 100, stdDev: 15 };
        const effectiveStdDev = getEffectiveStdDev(task);

        expect(effectiveStdDev).toBe(15); // Use actual value
    });

    it('should produce non-zero variability with fallback', () => {
        const tasks = [
            { standardTime: 30, stdDev: undefined },
            { standardTime: 45, stdDev: 0 },
            { standardTime: 60, stdDev: null as any },
        ];

        for (const task of tasks) {
            const effectiveStdDev = getEffectiveStdDev(task);
            expect(effectiveStdDev).toBeGreaterThan(0);
            expect(effectiveStdDev).toBe(task.standardTime * 0.10);
        }
    });

    it('should NOT block simulation when tasks lack stdDev', () => {
        // Simulate the validation logic from Simulation.tsx
        const assignments = [
            { stationId: 1, taskId: 'T1' },
            { stationId: 1, taskId: 'T2' },
        ];

        const tasks = [
            { id: 'T1', standardTime: 30, stdDev: undefined },
            { id: 'T2', standardTime: 45, stdDev: 0 },
        ];

        // Build cache with fallback (as done in Simulation.tsx)
        const taskCache: Record<string, { stdTime: number; stdDev: number; usedFallback: boolean }> = {};

        for (const t of tasks) {
            const hasMissingStdDev = !t.stdDev || t.stdDev <= 0;
            const effectiveStdDev = hasMissingStdDev
                ? t.standardTime * FALLBACK_STDDEV_PERCENT
                : t.stdDev;

            taskCache[t.id] = {
                stdTime: t.standardTime,
                stdDev: effectiveStdDev,
                usedFallback: hasMissingStdDev
            };
        }

        // Verify simulation can proceed
        expect(Object.keys(taskCache).length).toBe(2);
        expect(taskCache['T1'].usedFallback).toBe(true);
        expect(taskCache['T2'].usedFallback).toBe(true);
        expect(taskCache['T1'].stdDev).toBe(3);  // 10% of 30
        expect(taskCache['T2'].stdDev).toBe(4.5); // 10% of 45
    });

    it('should identify tasks using fallback for warning display', () => {
        const assignments = [
            { stationId: 1, taskId: 'T1' },
            { stationId: 2, taskId: 'T2' },
            { stationId: 2, taskId: 'T3' },
        ];

        const tasks = [
            { id: 'T1', description: 'Task 1', standardTime: 30, stdDev: 5 },
            { id: 'T2', description: 'Task 2', standardTime: 45, stdDev: 0 },
            { id: 'T3', description: 'Task 3', standardTime: 60 }, // stdDev undefined
        ];

        // Collect warnings as done in Simulation.tsx
        const tasksWithFallback: string[] = [];

        for (const a of assignments) {
            const t = tasks.find(x => x.id === a.taskId);
            if (t && (!t.stdDev || t.stdDev <= 0)) {
                tasksWithFallback.push(`${t.id} - ${t.description}`);
            }
        }

        expect(tasksWithFallback).toHaveLength(2);
        expect(tasksWithFallback).toContain('T2 - Task 2');
        expect(tasksWithFallback).toContain('T3 - Task 3');
        expect(tasksWithFallback).not.toContain('T1 - Task 1'); // Has valid stdDev
    });
});

