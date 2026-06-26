import { describe, it, expect } from 'vitest';
import { checkHardAssignmentConstraints } from '../core/balancing/assignmentConstraints';
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
