/**
 * Tests for Hill Climbing Precedence Constraints
 * 
 * Verifies that `optimizeWorkloadSmoothing` respects task precedence
 * relationships when moving tasks between stations for load balancing.
 * 
 * The function `isMoveValid` (engine.ts:248-264) ensures:
 * - Predecessors must be in stations with ID ≤ destination
 * - Successors must be in stations with ID ≥ destination
 */

import { describe, it, expect } from 'vitest';
import { simulateBalance, calculateEffectiveStationTime } from '../core/balancing/engine';
import { ProjectData, Task, Assignment } from '../types';

const createMinimalProjectData = (tasks: Partial<Task>[]): ProjectData => ({
    meta: {
        name: 'Precedence Test',
        date: new Date().toISOString(),
        client: 'Test',
        version: '1.0',
        engineer: 'Test',
        activeShifts: 1,
        manualOEE: 1.0,
        useManualOEE: true,
        dailyDemand: 100,
        configuredStations: 10,
        disableSectorAffinity: true  // Pure SALBP mode
    },
    shifts: [{ id: 1, name: 'S1', startTime: '8:00', endTime: '17:00', breaks: [] }],
    sectors: [],
    tasks: tasks.map((t, i) => ({
        id: t.id || `T${i + 1}`,
        description: `Task ${t.id || i + 1}`,
        times: [t.standardTime || 10],
        averageTime: t.standardTime || 10,
        standardTime: t.standardTime || 10,
        ratingFactor: 100,
        fatigueCategory: 'none' as const,
        predecessors: t.predecessors || [],
        successors: [],
        positionalWeight: 100 - i,
        calculatedSuccessorSum: 0,
        executionMode: 'manual' as const,
        ...t
    })) as Task[],
    assignments: [],
    stationConfigs: []
});

/**
 * Helper to verify precedence constraints in assignments
 * Returns true if all predecessors are in stations with ID ≤ task's station
 */
const verifyPrecedenceConstraints = (assignments: Assignment[], tasks: Task[]): boolean => {
    const taskStationMap = new Map<string, number>();
    for (const a of assignments) {
        taskStationMap.set(a.taskId, a.stationId);
    }

    for (const task of tasks) {
        const taskStation = taskStationMap.get(task.id);
        if (taskStation === undefined) continue;

        for (const predId of task.predecessors) {
            const predStation = taskStationMap.get(predId);
            if (predStation === undefined) continue;

            // Predecessor must be in same or earlier station
            if (predStation > taskStation) {
                console.error(`Precedence violation: ${predId} (St${predStation}) should be ≤ ${task.id} (St${taskStation})`);
                return false;
            }
        }
    }
    return true;
};

describe('Hill Climbing Precedence Constraints', () => {

    describe('Test 1: Predecessor Constraint', () => {
        it('should respect precedence when T1 → T2 chain exists', () => {
            // Chain: T1 → T2 → T3
            // With SALBP-2 + SMOOTH_WORKLOAD, the algorithm will try to balance
            // but must maintain T1 ≤ T2 ≤ T3 in station order
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 20, predecessors: [] },
                { id: 'T2', standardTime: 30, predecessors: ['T1'] },
                { id: 'T3', standardTime: 10, predecessors: ['T2'] },
            ]);

            // SALBP-2 with smoothing on 3 target operators
            (data.meta as any).balancingMode = 'SALBP2';
            (data.meta as any).targetOperators = 3;
            (data.meta as any).balancingObjective = 'SMOOTH_WORKLOAD';

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            // Verify precedence is maintained
            expect(verifyPrecedenceConstraints(result.assignments, data.tasks)).toBe(true);

            // Verify T1 station ≤ T2 station ≤ T3 station
            const stationMap = new Map<string, number>();
            result.assignments.forEach(a => stationMap.set(a.taskId, a.stationId));

            const t1Station = stationMap.get('T1')!;
            const t2Station = stationMap.get('T2')!;
            const t3Station = stationMap.get('T3')!;

            expect(t1Station).toBeLessThanOrEqual(t2Station);
            expect(t2Station).toBeLessThanOrEqual(t3Station);
        });

        it('should not move a task before its predecessor', () => {
            // Setup: Unbalanced initial state that would benefit from moving T2 backward
            // Total work: 60s, 3 stations → target 20s each
            // Initial (from greedy): likely [T1,T2] in St1 (50s), [T3] in St2 (10s)
            // Moving T2 to St2 would help (30s each) but only if precedence allows
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 20, predecessors: [] },
                { id: 'T2', standardTime: 30, predecessors: ['T1'] },
                { id: 'T3', standardTime: 10, predecessors: ['T2'] },
            ]);

            (data.meta as any).balancingMode = 'SALBP2';
            (data.meta as any).targetOperators = 3;
            (data.meta as any).balancingObjective = 'SMOOTH_WORKLOAD';

            const result = simulateBalance(data, 'RPW', 'Test', 60, 60);

            // Regardless of optimization, precedence must hold
            expect(verifyPrecedenceConstraints(result.assignments, data.tasks)).toBe(true);
        });
    });

    describe('Test 2: Successor Constraint', () => {
        it('should not move a task to a station after its successor', () => {
            // Chain: T1 → T2 → T3 → T4
            // If T2 is in St2 and T3 is in St2, we cannot move T2 to St3
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 10, predecessors: [] },
                { id: 'T2', standardTime: 10, predecessors: ['T1'] },
                { id: 'T3', standardTime: 10, predecessors: ['T2'] },
                { id: 'T4', standardTime: 30, predecessors: ['T3'] },
            ]);

            (data.meta as any).balancingMode = 'SALBP2';
            (data.meta as any).targetOperators = 4;
            (data.meta as any).balancingObjective = 'SMOOTH_WORKLOAD';

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            // Verify precedence chain is maintained
            expect(verifyPrecedenceConstraints(result.assignments, data.tasks)).toBe(true);

            const stationMap = new Map<string, number>();
            result.assignments.forEach(a => stationMap.set(a.taskId, a.stationId));

            // Verify complete chain order
            expect(stationMap.get('T1')!).toBeLessThanOrEqual(stationMap.get('T2')!);
            expect(stationMap.get('T2')!).toBeLessThanOrEqual(stationMap.get('T3')!);
            expect(stationMap.get('T3')!).toBeLessThanOrEqual(stationMap.get('T4')!);
        });

        it('should maintain strict order with diverging branches', () => {
            // Diamond pattern: T1 → T2, T1 → T3, T2 → T4, T3 → T4
            //      T1
            //     /  \
            //   T2    T3
            //     \  /
            //      T4
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 10, predecessors: [] },
                { id: 'T2', standardTime: 15, predecessors: ['T1'] },
                { id: 'T3', standardTime: 15, predecessors: ['T1'] },
                { id: 'T4', standardTime: 20, predecessors: ['T2', 'T3'] },
            ]);

            (data.meta as any).balancingMode = 'SALBP2';
            (data.meta as any).targetOperators = 3;
            (data.meta as any).balancingObjective = 'SMOOTH_WORKLOAD';

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            expect(verifyPrecedenceConstraints(result.assignments, data.tasks)).toBe(true);

            const stationMap = new Map<string, number>();
            result.assignments.forEach(a => stationMap.set(a.taskId, a.stationId));

            // T4 must be after both T2 and T3
            expect(stationMap.get('T4')!).toBeGreaterThanOrEqual(stationMap.get('T2')!);
            expect(stationMap.get('T4')!).toBeGreaterThanOrEqual(stationMap.get('T3')!);
            // T2 and T3 must be after T1
            expect(stationMap.get('T2')!).toBeGreaterThanOrEqual(stationMap.get('T1')!);
            expect(stationMap.get('T3')!).toBeGreaterThanOrEqual(stationMap.get('T1')!);
        });
    });

    describe('Test 3: Tasks Without Precedences', () => {
        it('should freely distribute independent tasks for optimal balance', () => {
            // Three independent tasks - should distribute evenly
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 30, predecessors: [] },
                { id: 'T2', standardTime: 30, predecessors: [] },
                { id: 'T3', standardTime: 30, predecessors: [] },
            ]);

            (data.meta as any).balancingMode = 'SALBP2';
            (data.meta as any).targetOperators = 3;
            (data.meta as any).balancingObjective = 'SMOOTH_WORKLOAD';

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            // 3 tasks of 30s each on 3 stations → perfect balance is 30s each
            // Check that distribution is relatively even
            const loads = result.proposedConfigs.map(c => c.effectiveTime || 0);
            const nonZeroLoads = loads.filter(l => l > 0);

            // All non-zero loads should be close to 30s (perfect balance)
            for (const load of nonZeroLoads) {
                expect(load).toBeCloseTo(30, 0);
            }
        });

        it('should achieve lower variance than unbalanced distribution', () => {
            // Uneven task times - smoothing should balance them
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 40, predecessors: [] },
                { id: 'T2', standardTime: 20, predecessors: [] },
                { id: 'T3', standardTime: 30, predecessors: [] },
            ]);

            (data.meta as any).balancingMode = 'SALBP2';
            (data.meta as any).targetOperators = 3;
            (data.meta as any).balancingObjective = 'SMOOTH_WORKLOAD';

            const result = simulateBalance(data, 'RPW', 'Test', 45, 45);

            // Total: 90s, 3 stations → target 30s each
            const loads = result.proposedConfigs
                .filter(c => (c.effectiveTime || 0) > 0)
                .map(c => c.effectiveTime!);

            if (loads.length > 1) {
                // Calculate variance
                const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
                const variance = loads.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / loads.length;

                // With smoothing enabled, variance should be minimized
                // Maximum possible variance would be if all work was in one station
                // Expect reasonably low variance
                expect(variance).toBeLessThan(100); // Reasonable threshold
            }

            // Precedence still holds (trivially, since none exist)
            expect(verifyPrecedenceConstraints(result.assignments, data.tasks)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle single task correctly', () => {
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 30, predecessors: [] },
            ]);

            (data.meta as any).balancingMode = 'SALBP2';
            (data.meta as any).targetOperators = 1;
            (data.meta as any).balancingObjective = 'SMOOTH_WORKLOAD';

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            expect(result.assignments.length).toBe(1);
            expect(result.assignments[0].taskId).toBe('T1');
        });

        it('should handle complex precedence graph', () => {
            // Complex graph with multiple paths
            //   T1 → T3 → T5
            //    ↓       ↓
            //   T2 → T4 → T6
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 10, predecessors: [] },
                { id: 'T2', standardTime: 10, predecessors: ['T1'] },
                { id: 'T3', standardTime: 10, predecessors: ['T1'] },
                { id: 'T4', standardTime: 10, predecessors: ['T2'] },
                { id: 'T5', standardTime: 10, predecessors: ['T3'] },
                { id: 'T6', standardTime: 10, predecessors: ['T4', 'T5'] },
            ]);

            (data.meta as any).balancingMode = 'SALBP2';
            (data.meta as any).targetOperators = 4;
            (data.meta as any).balancingObjective = 'SMOOTH_WORKLOAD';

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            // Verify all precedence constraints
            expect(verifyPrecedenceConstraints(result.assignments, data.tasks)).toBe(true);

            const stationMap = new Map<string, number>();
            result.assignments.forEach(a => stationMap.set(a.taskId, a.stationId));

            // T6 must be last (after T4 and T5)
            expect(stationMap.get('T6')!).toBeGreaterThanOrEqual(stationMap.get('T4')!);
            expect(stationMap.get('T6')!).toBeGreaterThanOrEqual(stationMap.get('T5')!);
        });
    });
});
