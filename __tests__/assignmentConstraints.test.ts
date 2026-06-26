import { describe, it, expect } from 'vitest';
import { checkHardAssignmentConstraints, planBulkMove } from '../core/balancing/assignmentConstraints';
import { ProjectData, Task, MachineType } from '../types';

const task = (id: string, extra: Partial<Task> = {}): Task => ({
    id,
    description: `Task ${id}`,
    predecessors: [],
    successors: [],
    times: [10],
    averageTime: 10,
    standardTime: 10,
    ratingFactor: 100,
    fatigueCategory: 'none',
    positionalWeight: 100,
    calculatedSuccessorSum: 0,
    stdDev: 0,
    executionMode: 'manual',
    ...extra,
});

const project = (over: Partial<ProjectData> = {}): ProjectData => ({
    tasks: [],
    assignments: [],
    sectors: [],
    shifts: [],
    stationConfigs: [],
    meta: { disableSectorAffinity: false } as any,
    ...over,
});

const machines: MachineType[] = [
    { id: 'm1', name: 'Inyectora', availableUnits: 1 } as MachineType,
    { id: 'm2', name: 'Prensa', availableUnits: 1 } as MachineType,
];

describe('checkHardAssignmentConstraints', () => {
    it('allows assignment when there are no constraints', () => {
        const data = project({
            tasks: [task('A'), task('B')],
            assignments: [{ taskId: 'B', stationId: 1 }],
        });
        expect(checkHardAssignmentConstraints('A', 1, data, machines).blocked).toBe(false);
    });

    it('blocks when the station already hosts a different machine type', () => {
        const data = project({
            tasks: [task('A', { requiredMachineId: 'm1' }), task('B', { requiredMachineId: 'm2' })],
            assignments: [{ taskId: 'B', stationId: 1 }],
        });
        const res = checkHardAssignmentConstraints('A', 1, data, machines);
        expect(res.blocked).toBe(true);
        expect(res.title).toBe('Conflicto de Máquina');
        expect(res.message).toContain('Inyectora');
        expect(res.message).toContain('Prensa');
    });

    it('allows when the station hosts the SAME machine type', () => {
        const data = project({
            tasks: [task('A', { requiredMachineId: 'm1' }), task('B', { requiredMachineId: 'm1' })],
            assignments: [{ taskId: 'B', stationId: 1 }],
        });
        expect(checkHardAssignmentConstraints('A', 1, data, machines).blocked).toBe(false);
    });

    it('blocks when target station belongs to a different sector', () => {
        const data = project({
            tasks: [task('A', { sectorId: 's1' }), task('B', { sectorId: 's2' })],
            assignments: [{ taskId: 'B', stationId: 1 }],
            sectors: [{ id: 's1', name: 'Costura' }, { id: 's2', name: 'Inyección' }] as any,
        });
        const res = checkHardAssignmentConstraints('A', 1, data, machines);
        expect(res.blocked).toBe(true);
        expect(res.title).toBe('Restricción de Sector');
    });

    it('ignores sector affinity when disableSectorAffinity is set', () => {
        const data = project({
            tasks: [task('A', { sectorId: 's1' }), task('B', { sectorId: 's2' })],
            assignments: [{ taskId: 'B', stationId: 1 }],
            meta: { disableSectorAffinity: true } as any,
        });
        expect(checkHardAssignmentConstraints('A', 1, data, machines).blocked).toBe(false);
    });

    it('blocks a must_exclude pair landing in the same station', () => {
        const data = project({
            tasks: [task('A'), task('B')],
            assignments: [{ taskId: 'B', stationId: 1 }],
            zoningConstraints: [{ taskA: 'A', taskB: 'B', type: 'must_exclude', reason: 'Calor' }] as any,
        });
        const res = checkHardAssignmentConstraints('A', 1, data, machines);
        expect(res.blocked).toBe(true);
        expect(res.title).toBe('Restricción de Zona');
        expect(res.message).toContain('Calor');
    });

    it('does NOT block a must_exclude pair when the partner is in another station', () => {
        const data = project({
            tasks: [task('A'), task('B')],
            assignments: [{ taskId: 'B', stationId: 2 }],
            zoningConstraints: [{ taskA: 'A', taskB: 'B', type: 'must_exclude' }] as any,
        });
        expect(checkHardAssignmentConstraints('A', 1, data, machines).blocked).toBe(false);
    });

    it('treats must_include as a soft constraint (never blocks here)', () => {
        const data = project({
            tasks: [task('A'), task('B')],
            assignments: [{ taskId: 'B', stationId: 2 }],
            zoningConstraints: [{ taskA: 'A', taskB: 'B', type: 'must_include' }] as any,
        });
        expect(checkHardAssignmentConstraints('A', 1, data, machines).blocked).toBe(false);
    });
});

describe('planBulkMove', () => {
    it('accepts all tasks when there are no constraints and applies them to nextData', () => {
        const data = project({
            tasks: [task('A'), task('B'), task('C')],
            assignments: [{ taskId: 'A', stationId: 5 }],
        });
        const plan = planBulkMove(['A', 'B'], 2, data, machines);
        expect(plan.accepted).toEqual(['A', 'B']);
        expect(plan.blocked).toEqual([]);
        // A moved from station 5 -> 2 (reassignment), B added at 2
        expect(plan.nextData.assignments).toContainEqual({ taskId: 'A', stationId: 2 });
        expect(plan.nextData.assignments).toContainEqual({ taskId: 'B', stationId: 2 });
        expect(plan.nextData.assignments.filter(a => a.taskId === 'A')).toHaveLength(1);
    });

    it('blocks the task that conflicts with an existing machine in the target', () => {
        const data = project({
            tasks: [task('A', { requiredMachineId: 'm2' }), task('B', { requiredMachineId: 'm1' })],
            assignments: [{ taskId: 'B', stationId: 1 }],
        });
        const plan = planBulkMove(['A'], 1, data, machines);
        expect(plan.accepted).toEqual([]);
        expect(plan.blocked).toEqual(['A']);
        expect(plan.nextData).toBe(data); // nothing applied
    });

    it('catches intra-batch conflicts (two different-sector tasks into the same empty station)', () => {
        const data = project({
            tasks: [task('A', { sectorId: 's1' }), task('B', { sectorId: 's2' })],
            assignments: [],
            sectors: [{ id: 's1', name: 'Costura' }, { id: 's2', name: 'Inyección' }] as any,
        });
        const plan = planBulkMove(['A', 'B'], 3, data, machines);
        // A goes in first (station empty), then B conflicts with A's sector.
        expect(plan.accepted).toEqual(['A']);
        expect(plan.blocked).toEqual(['B']);
    });

    it('ignores ids that are not real tasks', () => {
        const data = project({ tasks: [task('A')], assignments: [] });
        const plan = planBulkMove(['A', 'GHOST'], 1, data, machines);
        expect(plan.accepted).toEqual(['A']);
        expect(plan.blocked).toEqual([]);
    });
});
