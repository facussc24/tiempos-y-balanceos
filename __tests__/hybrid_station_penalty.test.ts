/**
 * Hybrid Station Penalty Tests - Phase 4 Completion
 * 
 * Tests for the configurable penalty when mixing different machine types
 * in the same station.
 */
import { describe, it, expect } from 'vitest';
import {
    canAssignToStationRC,
    SimStation,
    ResourceValidationStatus
} from '../core/balancing/engine';
import { Task } from '../types';

// Helper to create minimal SimStation for testing
const createTestStation = (overrides: Partial<SimStation> = {}): SimStation => ({
    id: 1,
    tasks: [],
    effectiveTime: 0,
    limit: 100,
    replicas: 1,
    ...overrides
});

// Helper to create minimal Task for testing
const createTestTask = (requiredMachineId?: string): Task => ({
    id: 'task-1',
    description: 'Test Task',
    standardTime: 10,
    averageTime: 10,
    predecessors: [],
    positionalWeight: 1,
    requiredMachineId
} as unknown as Task);

describe('Hybrid Station Penalty (Phase 4)', () => {
    const emptyUsageMap = new Map<string, number>();
    const inventoryMap = new Map<string, number>([
        ['machine-a', 5],
        ['machine-b', 3]
    ]);

    describe('Default Behavior (Block)', () => {
        it('should return LOCAL_CONFLICT when mixing machines by default', () => {
            const station = createTestStation({ machineId: 'machine-a' });
            const task = createTestTask('machine-b');

            const result = canAssignToStationRC(
                task,
                station,
                emptyUsageMap,
                inventoryMap,
                false, // allowHybridStations = false (default)
                5
            );

            expect(result.status).toBe('LOCAL_CONFLICT');
            expect(result.penalty).toBeUndefined();
        });

        it('should return OK when same machine type', () => {
            const station = createTestStation({ machineId: 'machine-a' });
            const task = createTestTask('machine-a');

            const result = canAssignToStationRC(
                task,
                station,
                emptyUsageMap,
                inventoryMap,
                false,
                5
            );

            expect(result.status).toBe('OK');
            expect(result.stationMachineId).toBe('machine-a');
        });
    });

    describe('Hybrid Stations Enabled', () => {
        it('should return OK_WITH_PENALTY when mixing machines with allowHybridStations=true', () => {
            const station = createTestStation({ machineId: 'machine-a' });
            const task = createTestTask('machine-b');

            const result = canAssignToStationRC(
                task,
                station,
                emptyUsageMap,
                inventoryMap,
                true, // allowHybridStations = true
                5
            );

            expect(result.status).toBe('OK_WITH_PENALTY');
            expect(result.stationMachineId).toBe('machine-b');
            expect(result.penalty).toBe(5);
        });

        it('should use custom penalty value', () => {
            const station = createTestStation({ machineId: 'machine-a' });
            const task = createTestTask('machine-b');

            const result = canAssignToStationRC(
                task,
                station,
                emptyUsageMap,
                inventoryMap,
                true,
                10 // Custom penalty
            );

            expect(result.status).toBe('OK_WITH_PENALTY');
            expect(result.penalty).toBe(10);
        });

        it('should still return OK when same machine even with hybrid enabled', () => {
            const station = createTestStation({ machineId: 'machine-a' });
            const task = createTestTask('machine-a');

            const result = canAssignToStationRC(
                task,
                station,
                emptyUsageMap,
                inventoryMap,
                true,
                5
            );

            expect(result.status).toBe('OK');
            expect(result.penalty).toBeUndefined();
        });
    });

    describe('Tasks Without Machine Requirement', () => {
        it('should return OK for task without machine requirement', () => {
            const station = createTestStation({ machineId: 'machine-a' });
            const task = createTestTask(undefined); // No machine required

            const result = canAssignToStationRC(
                task,
                station,
                emptyUsageMap,
                inventoryMap,
                false,
                5
            );

            expect(result.status).toBe('OK');
        });
    });

    describe('Global Deficit', () => {
        it('should return GLOBAL_DEFICIT when inventory exhausted', () => {
            const station = createTestStation(); // No machine assigned yet
            const task = createTestTask('machine-c'); // Not in inventory

            const result = canAssignToStationRC(
                task,
                station,
                emptyUsageMap,
                new Map(), // Empty inventory
                false,
                5
            );

            expect(result.status).toBe('GLOBAL_DEFICIT');
        });
    });
});
