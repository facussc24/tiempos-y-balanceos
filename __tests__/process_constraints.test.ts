/**
 * Process Constraints Validation Tests
 * 
 * Tests for V8.2 validateProcessConstraints() function
 * 
 * Per expert: "If software recommends 'add operator' for a chemical
 * curing time, it loses all technical credibility immediately."
 * 
 * @module process_constraints.test
 * @version 8.2
 */
import { describe, it, expect } from 'vitest';
import { validateProcessConstraints } from '../core/balancing/mixBalancing';
import { Task, PlantConfig } from '../types';

// Helper to create minimal task with process constraint
function createTask(
    id: string,
    time: number,
    isProcessConstraint: boolean = false,
    machineId?: string
): Task {
    return {
        id,
        description: `Task ${id}`,
        times: [time],
        averageTime: time,
        standardTime: time,
        ratingFactor: 100,
        fatigueCategory: 'standard',
        executionMode: 'machine',
        predecessors: [],
        successors: [],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        modelApplicability: {},
        isProcessConstraint,
        requiredMachineId: machineId
    } as Task;
}

describe('validateProcessConstraints (V8.2)', () => {

    it('should return valid when no tasks have isProcessConstraint flag', () => {
        const tasks = [
            createTask('T1', 50, false),
            createTask('T2', 60, false)
        ];
        const taktTime = 45;

        const result = validateProcessConstraints(tasks, taktTime);

        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.fatalMessage).toBeNull();
    });

    it('should return valid when process-constrained task is under Takt', () => {
        const tasks = [
            createTask('INJ-01', 40, true, 'MACHINE_A')  // Under takt of 60
        ];
        const taktTime = 60;

        const result = validateProcessConstraints(tasks, taktTime);

        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
    });

    it('should detect violation when process-constrained task exceeds Takt', () => {
        const tasks = [
            createTask('INJ-01', 120, true, 'MACHINE_A')  // 120s > 60s Takt
        ];
        const taktTime = 60;

        const result = validateProcessConstraints(tasks, taktTime);

        expect(result.valid).toBe(false);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].taskId).toBe('INJ-01');
        expect(result.violations[0].processTime).toBe(120);
        expect(result.violations[0].requiredMachines).toBe(2);  // ceil(120/60) = 2
    });

    it('should NOT flag normal task that exceeds Takt (can use operators)', () => {
        const tasks = [
            createTask('MAN-01', 120, false)  // NOT a process constraint
        ];
        const taktTime = 60;

        const result = validateProcessConstraints(tasks, taktTime);

        // Should be valid because this task can be parallelized with operators
        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
    });

    it('should calculate deficit correctly with plantConfig', () => {
        const tasks = [
            createTask('INJ-01', 180, true, 'PRESS_A')  // Needs ceil(180/60) = 3 machines
        ];
        const taktTime = 60;
        const plantConfig: PlantConfig = {
            version: 1,
            lastModified: Date.now(),
            sectors: [],
            machines: [
                { id: 'PRESS_A', name: 'Press A', availableUnits: 1, category: 'inyeccion', sectorId: 'SEC1' }
            ]
        };

        const result = validateProcessConstraints(tasks, taktTime, plantConfig);

        expect(result.valid).toBe(false);
        expect(result.violations[0].requiredMachines).toBe(3);
        expect(result.violations[0].availableMachines).toBe(1);
        expect(result.violations[0].deficit).toBe(2);  // 3 needed - 1 available
    });

    it('should generate fatal message when deficit exists', () => {
        const tasks = [
            createTask('INJ-01', 120, true, 'PRESS_A')
        ];
        const plantConfig: PlantConfig = {
            version: 1,
            lastModified: Date.now(),
            sectors: [],
            machines: [
                { id: 'PRESS_A', name: 'Press A', availableUnits: 1, category: 'inyeccion', sectorId: 'SEC1' }
            ]
        };

        const result = validateProcessConstraints(tasks, 60, plantConfig);

        expect(result.fatalMessage).not.toBeNull();
        expect(result.fatalMessage).toContain('BLOQUEO DE PROCESO');
        expect(result.fatalMessage).toContain('NO resuelve');
    });

    it('should handle multiple process-constrained tasks', () => {
        const tasks = [
            createTask('INJ-01', 120, true),  // Needs 2 machines
            createTask('CURE-01', 180, true), // Needs 3 machines
            createTask('MAN-01', 200, false)  // Normal task (not a constraint)
        ];
        const taktTime = 60;

        const result = validateProcessConstraints(tasks, taktTime);

        expect(result.valid).toBe(false);
        expect(result.violations).toHaveLength(2);  // Only the process-constrained ones
        expect(result.violations.map(v => v.taskId)).toContain('INJ-01');
        expect(result.violations.map(v => v.taskId)).toContain('CURE-01');
    });

    it('should have no deficit when enough machines are available', () => {
        const tasks = [
            createTask('INJ-01', 120, true, 'PRESS_A')  // Needs 2 machines
        ];
        const plantConfig: PlantConfig = {
            version: 1,
            lastModified: Date.now(),
            sectors: [],
            machines: [
                { id: 'PRESS_A', name: 'Press A', availableUnits: 5, category: 'inyeccion', sectorId: 'SEC1' }
            ]
        };

        const result = validateProcessConstraints(tasks, 60, plantConfig);

        expect(result.valid).toBe(false);  // Still invalid (exceeds takt)
        expect(result.violations[0].deficit).toBe(0);  // But no deficit
        expect(result.fatalMessage).toBeNull();  // No fatal message
    });
});
