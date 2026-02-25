import { describe, it, expect } from 'vitest';
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task } from '../types';

/**
 * Resource-Aware Multi-Manning (Case A.5) Tests
 * 
 * Validates that when tasks share a SCARCE machine, the engine groups them
 * into fewer stations with more operators, instead of opening new stations
 * that would cause machine deficit alerts.
 */

// Helper to build minimal ProjectData
const buildProject = (
    tasks: Partial<Task>[],
    machines: { id: string; name: string; availableUnits: number }[],
    dailyDemand: number = 350,
    sectorId: string = 'S1'
): ProjectData => {
    const fullTasks: Task[] = tasks.map((t, i) => ({
        id: t.id || `T${i + 1}`,
        description: t.description || `Task ${i + 1}`,
        times: [t.standardTime || t.averageTime || 10],
        averageTime: t.averageTime || t.standardTime || 10,
        standardTime: t.standardTime || t.averageTime || 10,
        predecessors: t.predecessors || [],
        successors: t.successors || [],
        positionalWeight: t.positionalWeight || 0,
        calculatedSuccessorSum: 0,
        fatigueCategory: 'standard' as const,
        ratingFactor: 100,
        requiredMachineId: t.requiredMachineId,
        executionMode: t.executionMode || 'manual',
        sectorId: t.sectorId || sectorId,
        ...t
    }));

    return {
        meta: {
            name: 'RA-MM Test',
            date: '2026-02-10',
            client: 'Test',
            version: '1.0',
            engineer: 'AI',
            activeShifts: 1,
            manualOEE: 1.0,        // No OEE penalty for clean math
            useManualOEE: true,
            dailyDemand,
            configuredStations: 1
        },
        shifts: [],
        sectors: [{ id: sectorId, name: 'Test Sector', color: '#3b82f6' }],
        tasks: fullTasks,
        assignments: [],
        stationConfigs: [],
        plantConfig: {
            version: 1,
            lastModified: Date.now(),
            sectors: [],
            machines: machines.map(m => ({
                ...m,
                sectorId: sectorId,
                isDefault: false
            }))
        }
    };
};


describe('Resource-Aware Multi-Manning (Case A.5)', () => {

    it('Scenario 1 (Horno APC): 3 tasks × 60s, 1 machine → should create 1 station with 3 operators', () => {
        // 3 tasks of 60s each, all requiring "HORNO", only 1 horno available
        // Takt = 60s → Total work = 180s → needs 3 operators on 1 station
        // WITHOUT fix: would create 3 stations, each consuming 1 horno → deficit of 2
        // WITH fix: should create 1 station with 3 replicas, consuming 1 horno → no deficit

        const project = buildProject(
            [
                { id: 'H1', standardTime: 60, requiredMachineId: 'HORNO', predecessors: [] },
                { id: 'H2', standardTime: 60, requiredMachineId: 'HORNO', predecessors: ['H1'] },
                { id: 'H3', standardTime: 60, requiredMachineId: 'HORNO', predecessors: ['H2'] },
            ],
            [{ id: 'HORNO', name: 'Horno APC', availableUnits: 1 }],
            480  // dailyDemand → Takt = 28800/480 = 60s
        );

        const taktTime = 60;
        const result = simulateBalance(project, 'RPW', 'Horno APC Test', taktTime, taktTime);

        console.log(`Stations: ${result.stationsCount}, Headcount: ${result.totalHeadcount}, Resource Gaps: ${result.resourceGaps?.length || 0}`);
        console.log('Configs:', result.proposedConfigs.map(c => `St${c.id}: ${c.replicas} ops`));

        // KEY ASSERTIONS
        expect(result.stationsCount).toBe(1);
        expect(result.totalHeadcount).toBe(3);
        expect(result.resourceGaps).toBeUndefined(); // No deficit!
    });

    it('Scenario 2 (Abundant Machine): 3 tasks × 60s, 10 machines → should use normal multi-station', () => {
        // Same tasks but machine is abundant (10 units)
        // Opening new stations is fine — no need to force multi-manning

        const project = buildProject(
            [
                { id: 'H1', standardTime: 60, requiredMachineId: 'HORNO', predecessors: [] },
                { id: 'H2', standardTime: 60, requiredMachineId: 'HORNO', predecessors: ['H1'] },
                { id: 'H3', standardTime: 60, requiredMachineId: 'HORNO', predecessors: ['H2'] },
            ],
            [{ id: 'HORNO', name: 'Horno APC', availableUnits: 10 }],
            480
        );

        const taktTime = 60;
        const result = simulateBalance(project, 'RPW', 'Abundant Machine Test', taktTime, taktTime);

        console.log(`Stations: ${result.stationsCount}, Headcount: ${result.totalHeadcount}`);

        // With abundant machines, the engine is free to use multiple stations
        // It should NOT force multi-manning since machines are plentiful
        expect(result.resourceGaps).toBeUndefined(); // No deficit either way
    });

    it('Scenario 3 (Mixed): horno tasks + manual tasks → only horno tasks group', () => {
        // 2 horno tasks (60s each) + 2 manual tasks (30s each), 1 horno
        // Horno tasks should be grouped together (multi-manning)
        // Manual tasks should be distributed normally

        const project = buildProject(
            [
                { id: 'H1', standardTime: 60, requiredMachineId: 'HORNO', predecessors: [] },
                { id: 'H2', standardTime: 60, requiredMachineId: 'HORNO', predecessors: ['H1'] },
                { id: 'M1', standardTime: 30, predecessors: ['H2'] },
                { id: 'M2', standardTime: 30, predecessors: ['M1'] },
            ],
            [{ id: 'HORNO', name: 'Horno APC', availableUnits: 1 }],
            480
        );

        const taktTime = 60;
        const result = simulateBalance(project, 'RPW', 'Mixed Test', taktTime, taktTime);

        console.log(`Stations: ${result.stationsCount}, Headcount: ${result.totalHeadcount}`);
        console.log('Assignments:', result.assignments.map(a => `${a.taskId}→St${a.stationId}`));

        // Horno tasks (H1, H2) should be in the same station
        const hornoStation = result.assignments.find(a => a.taskId === 'H1')?.stationId;
        const h2Station = result.assignments.find(a => a.taskId === 'H2')?.stationId;
        expect(hornoStation).toBe(h2Station);

        // No resource deficit
        expect(result.resourceGaps).toBeUndefined();
    });

    it('Scenario 4 (Process Constraint): injection task must NOT use multi-manning', () => {
        // Injection tasks represent physical processes (curing, molding) that cannot
        // be accelerated by adding more operators.
        // The fix should NOT apply to them.

        const project = buildProject(
            [
                { id: 'INJ1', standardTime: 60, requiredMachineId: 'MOLD', executionMode: 'injection', predecessors: [] },
                { id: 'INJ2', standardTime: 60, requiredMachineId: 'MOLD', executionMode: 'injection', predecessors: ['INJ1'] },
            ],
            [{ id: 'MOLD', name: 'Molde Inyección', availableUnits: 1 }],
            480
        );

        const taktTime = 60;
        const result = simulateBalance(project, 'RPW', 'Injection Test', taktTime, taktTime);

        console.log(`Stations: ${result.stationsCount}, Headcount: ${result.totalHeadcount}`);

        // Injection tasks should NOT be grouped via multi-manning
        // They may still end up in separate stations (with deficit), 
        // because physics can't be overridden by adding operators
        expect(result.stationsCount).toBeGreaterThanOrEqual(1);

        // Verify no station has replicas > 1 for injection tasks
        // (injection stations should always have replicas=1)
        for (const config of result.proposedConfigs) {
            const stationTasks = result.assignments
                .filter(a => a.stationId === config.id)
                .map(a => project.tasks.find(t => t.id === a.taskId))
                .filter(Boolean);

            const hasOnlyInjection = stationTasks.every(
                t => t!.executionMode === 'injection' || t!.executionMode === 'machine'
            );

            if (hasOnlyInjection && stationTasks.length > 0) {
                expect(config.replicas).toBe(1);
            }
        }
    });
});
