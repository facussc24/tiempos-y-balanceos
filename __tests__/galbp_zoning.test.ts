import { describe, it, expect } from 'vitest';
import { runGeneticAlgorithm } from '../core/balancing/geneticAlgorithm';
import { ProjectData, Task, Assignment, MachineType } from '../types';

/**
 * Phase 30: GALBP (General Assembly Line Balancing Problem) Tests
 * 
 * Verifies "Hard Constraints" implementation:
 * 1. Zoning: Tasks must be assigned to compatible stations (or penalized)
 * 2. Resources: Single-unit machines cannot be in parallel stations
 */

// Helper to create minimal project data
const createData = (tasks: Task[], sectors: any[] = []): ProjectData => ({
    tasks,
    assignments: [],
    sectors,
    shifts: [{
        id: 1,
        name: 'Turno 1',
        startTime: '08:00',
        endTime: '17:00',
        breaks: []
    }],
    stationConfigs: [], // Will be filled dynamically by engine
    meta: {
        name: 'GALBP Test',
        date: new Date().toISOString(),
        client: 'Test Client',
        engineer: 'Test Engineer',
        version: '1.0',
        dailyDemand: 480,
        manualOEE: 0.85,
        useManualOEE: true,

        activeShifts: 1
    } as any
});

const createTask = (id: string, time: number, zoning?: string, machineId?: string): Task => ({
    id,
    description: `Task ${id}`,
    times: [time],
    averageTime: time,
    standardTime: time,
    ratingFactor: 100,
    fatigueCategory: 'none',
    predecessors: [],
    successors: [],
    positionalWeight: 0,
    calculatedSuccessorSum: 0,
    executionMode: machineId ? 'machine' : 'manual',
    sectorId: zoning,
    requiredMachineId: machineId
});

describe('GALBP Constraints (Phase 30)', () => {

    // Test 1: The "Immovable Oven" Scenario
    it('forces zoned task to stay with other tasks of same zone to avoid station mixing', () => {
        // We simulate this by checking if the penalty logic works.
        // Since `simulateBalance` assigns stations blindly based on order, 
        // the GA must reorder tasks such that tasks of the same zone end up together
        // if they are to share a station. 
        // Note: The current engine doesn't explicitly support "Station Zones".
        // Instead, the penalty checks if a *station* contains mixed zones.
        // So the GA should group "ZONE_A" tasks together.

        const tasks = [
            createTask('T1', 20, 'ZONE_A'),
            createTask('T2', 20, 'ZONE_A'), // Should be with T1
            createTask('T3', 20, 'ZONE_B'), // Should separate
            createTask('T4', 20, 'ZONE_B')
        ];

        const data = createData(tasks, [
            { id: 'ZONE_A', name: 'Horno' },
            { id: 'ZONE_B', name: 'Empaque' }
        ]);

        // Takt time = 45s (allow 2 tasks per station)
        // Ideal: St1 [T1, T2] (Zone A), St2 [T3, T4] (Zone B)
        // Bad: St1 [T1, T3] (Mixed) -> Penalty

        const result = runGeneticAlgorithm(data, 60, 45, {
            populationSize: 20,
            generations: 30
        });

        // Get the assignments for the best result
        const stations = new Map<number, Set<string>>();
        result.bestResult.assignments.forEach(a => {
            if (!stations.has(a.stationId)) stations.set(a.stationId, new Set());
            const task = tasks.find(t => t.id === a.taskId);
            if (task?.sectorId) stations.get(a.stationId)!.add(task.sectorId);
        });

        // Verify no station has mixed zones (Set size == 1)
        for (const [stId, zones] of stations) {
            expect(zones.size).toBe(1); // Station should not have mixed zones
        }
    });

    // Test 2: Single Resource Constraint
    it('prevents single machine being used in parallel stations', () => {
        // Machine M1 has 1 unit
        const machine: MachineType = {
            id: 'M1',
            name: 'Inyectora',
            availableUnits: 1,
            sectorId: 'INJ',
            oeeBase: 0.9
        };

        // Task A takes 50s (needs M1)
        // Task B takes 50s (needs M1)
        // Takt Time = 40s
        // Without constraint: Engine would put them in parallel stations (2 operators)
        // With constraint: Engine might still put them parallel, BUT GA should penalize it
        // wait, GA optimizes sequence. Engine does allocation.
        // If engine puts them parallel, GA sees penalty.
        // GA tries to sequence them such that... actually engine enforces Takt. 
        // If both > Takt, engine mandates parallel. 
        // If parallel stations need M1 and we only have 1 M1 -> Penalty.

        // This test verifies that the GA reports high fitness (bad) for impossible config
        // or tries to serialize them if possible (but here time > takt).
        // Actually, if T_task > Takt, we MUST parallelize. 
        // If we have 1 machine, this is physically impossible. 
        // The GA should return a result with the penalty included in fitness, logic-wise.

        const tasks = [
            createTask('TA', 50, undefined, 'M1'),
            createTask('TB', 50, undefined, 'M1')
        ];

        const data = createData(tasks);

        // Run GA with passing the machine inventory
        const result = runGeneticAlgorithm(data, 60, 40, {
            populationSize: 10,
            generations: 10,
            machines: [machine]
        });

        // If impossible, fitness should be very high due to penalty
        // Penalty = 500,000 * 1
        expect(result.bestFitness).toBeGreaterThan(500_000);
    });

    // =============================================================================
    // FIX 3: Must-Include / Must-Exclude Constraints (Hard Constraints)
    // =============================================================================

    describe('FIX 3: Zoning Constraints (Hard)', () => {
        it('must_include: forces two tasks to same station or rejects', () => {
            // T1 and T2 MUST be together. They are both 20s, Takt = 50s, so it's possible.
            const tasks = [
                createTask('T1', 20),
                createTask('T2', 20),
                createTask('T3', 30) // Unrelated
            ];

            const data = createData(tasks);
            data.zoningConstraints = [
                {
                    id: 'zc-1',
                    taskA: 'T1',
                    taskB: 'T2',
                    type: 'must_include',
                    reason: 'Comparten máquina costosa'
                }
            ];

            const result = runGeneticAlgorithm(data, 60, 50, {
                populationSize: 30,
                generations: 50
            });

            // Check that T1 and T2 are in the same station
            const t1Station = result.bestResult.assignments.find(a => a.taskId === 'T1')?.stationId;
            const t2Station = result.bestResult.assignments.find(a => a.taskId === 'T2')?.stationId;

            expect(t1Station).toBe(t2Station);
        });

        it('must_exclude: prevents two tasks from sharing a station', () => {
            // T1 and T2 MUST NOT be together. Each is 25s, Takt = 60s.
            // Together they'd fit one station, but must_exclude forces separation.
            const tasks = [
                createTask('T1', 25),
                createTask('T2', 25),
                createTask('T3', 25)
            ];

            const data = createData(tasks);
            data.zoningConstraints = [
                {
                    id: 'zc-2',
                    taskA: 'T1',
                    taskB: 'T2',
                    type: 'must_exclude',
                    reason: 'Seguridad - chispas cerca de pintura'
                }
            ];

            const result = runGeneticAlgorithm(data, 60, 60, {
                populationSize: 30,
                generations: 50
            });

            // Check that T1 and T2 are NOT in the same station
            const t1Station = result.bestResult.assignments.find(a => a.taskId === 'T1')?.stationId;
            const t2Station = result.bestResult.assignments.find(a => a.taskId === 'T2')?.stationId;

            expect(t1Station).not.toBe(t2Station);
        });

        it('rejects solution with fitness=Infinity when must_include is impossible', () => {
            // T1=45s, T2=45s. Takt = 50s. Together they'd exceed, so can't be in same station.
            // But must_include says they MUST be together → impossible
            const tasks = [
                createTask('T1', 45),
                createTask('T2', 45)
            ];

            const data = createData(tasks);
            data.zoningConstraints = [
                {
                    id: 'zc-impossible',
                    taskA: 'T1',
                    taskB: 'T2',
                    type: 'must_include'
                }
            ];

            const result = runGeneticAlgorithm(data, 60, 50, {
                populationSize: 10,
                generations: 20
            });

            // When constraint is impossible, all solutions get rejected → Infinity fitness
            expect(result.bestFitness).toBe(Infinity);
        });
    });
});
