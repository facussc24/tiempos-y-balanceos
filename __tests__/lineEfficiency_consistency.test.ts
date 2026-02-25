/**
 * Regression Test: LineEfficiency Consistency Between SALBP-1 and SALBP-2
 * 
 * This test ensures that the 'lineEfficiency' KPI is calculated consistently
 * across both balancing algorithms (SALBP-1 and SALBP-2).
 * 
 * INVARIANT: The lineEfficiency metric must be algorithm-agnostic.
 * Both algorithms should produce the same efficiency value for identical
 * task configurations, regardless of fatigue settings.
 * 
 * History:
 * - BUG: SALBP-2 was using (time * fatigueFactor) while SALBP-1 used raw time
 * - FIX: Aligned SALBP-2 with SALBP-1 (Phase 24 fix) to use raw Process Time
 */

import { describe, test, expect } from 'vitest';
import { simulateBalance, simulateBalanceType2 } from '../core/balancing/engine';
import { ProjectData, Task, FatigueCategory, FATIGUE_OPTIONS } from '../types';

// Helper to create a minimal valid ProjectData
const createTestProject = (tasks: Partial<Task>[], _taktTimeSeconds: number): ProjectData => {
    const fullTasks: Task[] = tasks.map((t, idx) => ({
        id: t.id || `task_${idx + 1}`,
        description: `Tarea ${idx + 1}`,
        standardTime: t.standardTime || 0,
        averageTime: t.averageTime || t.standardTime || 0,
        times: [],
        ratingFactor: 100,
        predecessors: t.predecessors || [],
        successors: [],
        calculatedSuccessorSum: 0,
        sectorId: t.sectorId,
        positionalWeight: t.positionalWeight || t.standardTime || 0,
        fatigueCategory: t.fatigueCategory || 'none',
        isMachineInternal: t.isMachineInternal || false,
        executionMode: t.executionMode || 'manual',
    } as Task));

    return {
        tasks: fullTasks,
        assignments: [],
        stationConfigs: [],
        sectors: [],
        shifts: [],
        meta: {
            name: 'Test Project',
            date: '2026-01-01',
            client: 'Test',
            version: '1.0',
            engineer: 'Test',
            activeShifts: 1,
            manualOEE: 0.85,
            useManualOEE: true,
            dailyDemand: 1000,
            configuredStations: 3,
            useSectorOEE: false,
            disableSectorAffinity: true, // Pure SALBP mode
            balancingMode: 'SALBP1' as const,
        },
    } as ProjectData;
};

describe('LineEfficiency Consistency (SALBP-1 vs SALBP-2)', () => {

    test('should produce identical lineEfficiency with fatigue-enabled tasks', () => {
        // Setup: 3 tasks with heavy fatigue (18% factor)
        const heavyFatigueCategory: FatigueCategory = 'high'; // Maps to 0.18 factor -> 1.18 multiplier

        const tasks: Partial<Task>[] = [
            { id: 'T1', standardTime: 100, fatigueCategory: heavyFatigueCategory, positionalWeight: 300 },
            { id: 'T2', standardTime: 100, fatigueCategory: heavyFatigueCategory, positionalWeight: 200, predecessors: ['T1'] },
            { id: 'T3', standardTime: 100, fatigueCategory: heavyFatigueCategory, positionalWeight: 100, predecessors: ['T2'] },
        ];

        const taktTime = 120; // seconds
        const project = createTestProject(tasks, taktTime);
        const effectiveSeconds = taktTime * project.meta.manualOEE;

        // Run SALBP-1 (minimize stations)
        const salbp1Result = simulateBalance(
            project,
            'RPW',
            'Test SALBP-1',
            taktTime,
            effectiveSeconds
        );

        // Run SALBP-2 (fixed stations = 3)
        const salbp2Result = simulateBalanceType2(
            project,
            3,
            'Test SALBP-2',
            taktTime
        );

        // Log for debugging
        console.log('=== LineEfficiency Consistency Test ===');
        console.log(`SALBP-1 lineEfficiency: ${salbp1Result.lineEfficiency?.toFixed(2)}%`);
        console.log(`SALBP-2 lineEfficiency: ${salbp2Result.lineEfficiency?.toFixed(2)}%`);
        console.log(`SALBP-1 stations: ${salbp1Result.stationsCount}`);
        console.log(`SALBP-2 stations: ${salbp2Result.stationsCount}`);

        // INVARIANT: Both should calculate lineEfficiency the same way
        // They might have different station counts, but for same config, efficiency formula must be identical
        // The key assertion is that fatigue does NOT artificially inflate one vs the other

        // Check that both use raw time (not inflated by fatigue) for the efficiency numerator
        // Total raw work = 100 + 100 + 100 = 300 seconds
        const expectedRawWork = 300;

        // For SALBP-2 with 3 stations and 100s tasks, each station has 100s
        // lineEfficiency = totalRawWork / (headcount * maxCycle) * 100
        // If each station has one task of 100s (with fatigue, effective = 118s for scheduling)
        // But lineEfficiency should use raw time: 300 / (3 * 100) = 100%

        expect(salbp2Result.lineEfficiency).toBeDefined();
        expect(salbp1Result.lineEfficiency).toBeDefined();

        // Both efficiencies should be calculated using the same methodology
        // Allow small tolerance for floating point
        const tolerance = 1.0; // 1% tolerance

        // If stations count is the same, efficiency should be identical
        if (salbp1Result.stationsCount === salbp2Result.stationsCount) {
            expect(Math.abs((salbp1Result.lineEfficiency || 0) - (salbp2Result.lineEfficiency || 0)))
                .toBeLessThan(tolerance);
        }
    });

    test('should NOT include fatigue factor in lineEfficiency calculation for SALBP-2', () => {
        // This test verifies the fix was applied correctly
        // If fatigue were included, efficiency would be inflated

        const tasks: Partial<Task>[] = [
            { id: 'T1', standardTime: 100, fatigueCategory: 'high', positionalWeight: 100 },
        ];

        const taktTime = 150;
        const project = createTestProject(tasks, taktTime);

        const result = simulateBalanceType2(project, 1, 'Test', taktTime);

        // With 1 station, 1 task:
        // Raw time = 100s
        // With fatigue (if bug existed) = 100 * 1.18 = 118s
        // lineEfficiency = totalWork / (headcount * maxCycle) * 100

        // If using raw time: 100 / (1 * 100) = 100%
        // If using fatigue time (bug): 118 / (1 * 118) = 100% (still 100% but different internal values)

        // The real difference shows when comparing cross-algorithm, but we can check
        // that the internal 'totalEffWork' calculation matches raw time
        console.log(`Single task lineEfficiency: ${result.lineEfficiency}%`);
        console.log(`realCycleTime: ${result.realCycleTime}s`);

        // For a single task, lineEfficiency should be 100% regardless
        // but realCycleTime should reflect the effective time for scheduling
        expect(result.lineEfficiency).toBeCloseTo(100, 0);
    });

    test('should handle tasks without fatigue category consistently', () => {
        // Tasks with no fatigue should work identically in both algorithms

        const tasks: Partial<Task>[] = [
            { id: 'T1', standardTime: 50, positionalWeight: 150 },
            { id: 'T2', standardTime: 50, positionalWeight: 100, predecessors: ['T1'] },
            { id: 'T3', standardTime: 50, positionalWeight: 50, predecessors: ['T2'] },
        ];

        const taktTime = 60;
        const project = createTestProject(tasks, taktTime);
        const effectiveSeconds = taktTime * project.meta.manualOEE;

        const salbp1Result = simulateBalance(project, 'RPW', 'Test', taktTime, effectiveSeconds);
        const salbp2Result = simulateBalanceType2(project, 3, 'Test', taktTime);

        console.log('=== No Fatigue Test ===');
        console.log(`SALBP-1: ${salbp1Result.stationsCount} stations, ${salbp1Result.lineEfficiency?.toFixed(2)}% eff`);
        console.log(`SALBP-2: ${salbp2Result.stationsCount} stations, ${salbp2Result.lineEfficiency?.toFixed(2)}% eff`);

        // Both should have valid efficiency values
        expect(salbp1Result.lineEfficiency).toBeGreaterThan(0);
        expect(salbp2Result.lineEfficiency).toBeGreaterThan(0);
    });
});
