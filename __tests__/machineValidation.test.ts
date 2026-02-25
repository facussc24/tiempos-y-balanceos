import { describe, it, expect } from 'vitest';
import {
    calculateStationMachineRequirements,
    validateMachineInventory,
    validateMachineResources,
    validateProcessConstraints
} from '../core/balancing/machineValidation';
import { Task, Assignment, MachineType } from '../types';

describe('Machine Validation (RC-ALBP)', () => {

    describe('calculateStationMachineRequirements', () => {

        it('should count 1 machine per station even with multiple tasks requiring same machine', () => {
            const assignments: Assignment[] = [
                { stationId: 1, taskId: 'T1' },
                { stationId: 1, taskId: 'T2' },
                { stationId: 1, taskId: 'T3' }
            ];
            const tasks = [
                { id: 'T1', requiredMachineId: 'OVERLOCK' },
                { id: 'T2', requiredMachineId: 'OVERLOCK' },
                { id: 'T3', requiredMachineId: 'OVERLOCK' }
            ] as Task[];
            const machines = [{ id: 'OVERLOCK', name: 'Overlock', availableUnits: 5 }] as MachineType[];

            const result = calculateStationMachineRequirements(assignments, tasks, machines);

            expect(result).toHaveLength(1);
            expect(result[0].requiredMachineIds).toHaveLength(1);
            expect(result[0].requiredMachineIds[0]).toBe('OVERLOCK');
            expect(result[0].hasConflict).toBe(false);
        });

        it('should detect conflict when station has tasks requiring different machine types', () => {
            const assignments: Assignment[] = [
                { stationId: 1, taskId: 'T1' },
                { stationId: 1, taskId: 'T2' }
            ];
            const tasks = [
                { id: 'T1', requiredMachineId: 'OVERLOCK' },
                { id: 'T2', requiredMachineId: 'RECTA' }
            ] as Task[];
            const machines = [
                { id: 'OVERLOCK', name: 'Overlock', availableUnits: 2 },
                { id: 'RECTA', name: 'Recta', availableUnits: 2 }
            ] as MachineType[];

            const result = calculateStationMachineRequirements(assignments, tasks, machines);

            expect(result[0].hasConflict).toBe(true);
            expect(result[0].requiredMachineIds).toHaveLength(2);
            expect(result[0].conflictMessage).toContain('Conflicto');
        });

        it('should handle stations with no machine requirements', () => {
            const assignments: Assignment[] = [
                { stationId: 1, taskId: 'T1' },
                { stationId: 2, taskId: 'T2' }
            ];
            const tasks = [
                { id: 'T1', requiredMachineId: undefined },
                { id: 'T2', requiredMachineId: 'OVERLOCK' }
            ] as Task[];
            const machines = [{ id: 'OVERLOCK', name: 'Overlock', availableUnits: 1 }] as MachineType[];

            const result = calculateStationMachineRequirements(assignments, tasks, machines);

            expect(result).toHaveLength(2);
            expect(result[0].requiredMachineIds).toHaveLength(0); // Station 1 has no machine req
            expect(result[1].requiredMachineIds).toHaveLength(1); // Station 2 needs OVERLOCK
        });
    });

    describe('validateMachineInventory', () => {

        it('should calculate deficit correctly when more stations than machines', () => {
            const requirements = [
                { stationId: 1, requiredMachineIds: ['OV1'], hasConflict: false },
                { stationId: 2, requiredMachineIds: ['OV1'], hasConflict: false },
                { stationId: 3, requiredMachineIds: ['OV1'], hasConflict: false }
            ];
            const machines = [
                { id: 'OV1', name: 'Overlock', availableUnits: 2 }
            ] as MachineType[];

            const balance = validateMachineInventory(requirements, machines);

            expect(balance[0].consumed).toBe(3);
            expect(balance[0].available).toBe(2);
            expect(balance[0].balance).toBe(-1);
            expect(balance[0].isDeficit).toBe(true);
        });

        it('should show surplus when more machines than stations', () => {
            const requirements = [
                { stationId: 1, requiredMachineIds: ['OV1'], hasConflict: false }
            ];
            const machines = [
                { id: 'OV1', name: 'Overlock', availableUnits: 5 }
            ] as MachineType[];

            const balance = validateMachineInventory(requirements, machines);

            expect(balance[0].consumed).toBe(1);
            expect(balance[0].balance).toBe(4);
            expect(balance[0].isDeficit).toBe(false);
        });
    });

    describe('validateMachineResources (Full Pipeline)', () => {

        it('should correctly validate the expert scenario (3 tasks, 1 station, 2 machines)', () => {
            // Expert example: 3 tasks of 15s each requiring Overlock, assigned to 1 station
            // Inventory: 2 Overlock machines
            // Expected: 1 machine consumed, 1 surplus

            const assignments: Assignment[] = [
                { stationId: 1, taskId: 'T1' },
                { stationId: 1, taskId: 'T2' },
                { stationId: 1, taskId: 'T3' }
            ];
            const tasks = [
                { id: 'T1', requiredMachineId: 'OVERLOCK', standardTime: 15 },
                { id: 'T2', requiredMachineId: 'OVERLOCK', standardTime: 15 },
                { id: 'T3', requiredMachineId: 'OVERLOCK', standardTime: 15 }
            ] as Task[];
            const machines = [
                { id: 'OVERLOCK', name: 'Overlock Industrial', availableUnits: 2 }
            ] as MachineType[];

            const result = validateMachineResources(assignments, tasks, machines);

            // Station 1 consumes only 1 Overlock (not 3!)
            expect(result.stationRequirements[0].requiredMachineIds).toHaveLength(1);
            expect(result.machineBalance[0].consumed).toBe(1);
            expect(result.machineBalance[0].balance).toBe(1); // 2 - 1 = 1 surplus
            expect(result.hasDeficit).toBe(false);
        });

        it('should detect deficit in costura scenario (0 machines configured)', () => {
            // Scenario: Task requires "Máquina de Costura Programable" but inventory is 0

            const assignments: Assignment[] = [
                { stationId: 1, taskId: 'COSTURA' }
            ];
            const tasks = [
                { id: 'COSTURA', requiredMachineId: 'COSTURA_PROG', standardTime: 180 }
            ] as Task[];
            const machines = [
                { id: 'COSTURA_PROG', name: 'Máquina de Costura Programable', availableUnits: 0 }
            ] as MachineType[];

            const result = validateMachineResources(assignments, tasks, machines);

            expect(result.hasDeficit).toBe(true);
            expect(result.machineBalance[0].consumed).toBe(1);
            expect(result.machineBalance[0].available).toBe(0);
            expect(result.machineBalance[0].balance).toBe(-1);
            expect(result.totalDeficit).toBe(1);
        });
    });

    // =========================================================================
    // V8.1: Process Constraint Validation Tests
    // =========================================================================
    describe('validateProcessConstraints (V8.1)', () => {

        it('should return valid when no process constraints exist', () => {
            const tasks = [
                { id: 'T1', standardTime: 50 },
                { id: 'T2', standardTime: 40 }
            ] as Task[];

            const result = validateProcessConstraints(tasks, 60);

            expect(result.valid).toBe(true);
            expect(result.violations).toHaveLength(0);
        });

        it('should return valid when process-constrained tasks fit within Takt', () => {
            const tasks = [{
                id: 'INJ-001',
                standardTime: 30,
                isProcessConstraint: true,
                machineTimeFixed: 30
            }] as Task[];

            const result = validateProcessConstraints(tasks, 60);

            expect(result.valid).toBe(true);
            expect(result.violations).toHaveLength(0);
        });

        it('should detect violation when process time exceeds Takt', () => {
            const tasks = [{
                id: 'CURE-001',
                description: 'Curado PU',
                standardTime: 40,
                isProcessConstraint: true,
                machineTimeFixed: 40
            }] as Task[];

            const taktTime = 30;
            const result = validateProcessConstraints(tasks, taktTime);

            expect(result.valid).toBe(false);
            expect(result.violations).toHaveLength(1);

            const violation = result.violations[0];
            expect(violation.taskId).toBe('CURE-001');
            expect(violation.processTime).toBe(40);
            expect(violation.taktTime).toBe(30);
            expect(violation.deficit).toBe(10);
            expect(violation.requiredMachines).toBe(2); // ceil(40/30) = 2
            expect(violation.severity).toBe('fatal');
            expect(violation.message).toContain('BLOQUEO FÍSICO');
        });

        it('should use machineTimeFixed over standardTime when available', () => {
            const tasks = [{
                id: 'INJ-001',
                standardTime: 20, // This should be ignored
                isProcessConstraint: true,
                machineTimeFixed: 45 // This is the real process time
            }] as Task[];

            const result = validateProcessConstraints(tasks, 30);

            expect(result.valid).toBe(false);
            expect(result.violations[0].processTime).toBe(45);
            expect(result.violations[0].requiredMachines).toBe(2); // ceil(45/30) = 2
        });

        it('should not flag non-constrained tasks even if they exceed Takt', () => {
            const tasks = [
                {
                    id: 'MANUAL-001',
                    standardTime: 80, // Exceeds Takt
                    isProcessConstraint: false // But NOT a process constraint
                },
                {
                    id: 'CURE-001',
                    standardTime: 40,
                    isProcessConstraint: true // Process constraint, exceeds Takt
                }
            ] as Task[];

            const result = validateProcessConstraints(tasks, 30);

            // Only the process-constrained task should be flagged
            expect(result.violations).toHaveLength(1);
            expect(result.violations[0].taskId).toBe('CURE-001');
        });

        it('should calculate correct number of required machines for large exceedance', () => {
            const tasks = [{
                id: 'SLOW-CURE',
                standardTime: 180, // 3 minutes
                isProcessConstraint: true
            }] as Task[];

            const result = validateProcessConstraints(tasks, 30);

            // Need 6 parallel molds/machines: ceil(180/30) = 6
            expect(result.violations[0].requiredMachines).toBe(6);
        });
    });
});
