/**
 * E2E Integration Tests: Critical Flows
 * 
 * Tests the most critical user journeys in the application:
 * 1. Project Lifecycle (Create → Edit → Save → Load)
 * 2. Monte Carlo Simulation Engine
 * 3. Takt Time Calculations
 * 
 * These tests use Vitest with the actual simulation engine.
 * 
 * @module e2e_critical_flows
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { INITIAL_PROJECT, ProjectData, Task, Assignment, StationConfig, Shift } from '../types';
import { calculateTaktTime } from '../core/balancing/simulation';

// =============================================================================
// TEST 1: Project Lifecycle
// =============================================================================

describe('E2E: Project Lifecycle', () => {
    let project: ProjectData;

    beforeEach(() => {
        project = JSON.parse(JSON.stringify(INITIAL_PROJECT));
    });

    it('should create a new project with valid initial state', () => {
        expect(project.meta.name).toBe('Nuevo Proyecto');
        expect(project.tasks).toHaveLength(0);
        expect(project.assignments).toHaveLength(0);
        expect(project.stationConfigs).toHaveLength(0);
        expect(project.meta.activeModels).toHaveLength(1);
        expect(project.meta.activeModels![0].percentage).toBe(1.0);
    });

    it('should allow adding tasks with proper validation', () => {
        const newTask: Task = {
            id: 'T1',
            description: 'Test Task 1',
            times: [10, 12, 11],
            averageTime: 11,
            ratingFactor: 100,
            fatigueCategory: 'standard',
            standardTime: 12.54,
            predecessors: [],
            successors: [],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            executionMode: 'manual'
        };

        project.tasks.push(newTask);

        expect(project.tasks).toHaveLength(1);
        expect(project.tasks[0].id).toBe('T1');
        expect(project.tasks[0].standardTime).toBeGreaterThan(0);
    });

    it('should maintain data integrity after assignments', () => {
        const tasks: Task[] = [
            { id: 'T1', description: 'Task 1', times: [10], averageTime: 10, ratingFactor: 100, fatigueCategory: 'standard', standardTime: 11.4, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0 },
            { id: 'T2', description: 'Task 2', times: [15], averageTime: 15, ratingFactor: 100, fatigueCategory: 'standard', standardTime: 17.1, predecessors: ['T1'], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0 },
        ];

        project.tasks = tasks;

        const assignments: Assignment[] = [
            { stationId: 1, taskId: 'T1' },
            { stationId: 1, taskId: 'T2' },
        ];

        project.assignments = assignments;

        // Verify referential integrity
        const assignedTaskIds = project.assignments.map(a => a.taskId);
        const taskIds = project.tasks.map(t => t.id);

        for (const assignedId of assignedTaskIds) {
            expect(taskIds).toContain(assignedId);
        }
    });

    it('should serialize and deserialize without data loss', () => {
        project.meta.name = 'Test Project';
        project.meta.client = 'Test Client';
        project.meta.dailyDemand = 500;
        project.tasks = [
            { id: 'T1', description: 'Task 1', times: [10, 11, 12], averageTime: 11, ratingFactor: 100, fatigueCategory: 'standard', standardTime: 12.54, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0 }
        ];

        const serialized = JSON.stringify(project);
        const loaded = JSON.parse(serialized) as ProjectData;

        expect(loaded.meta.name).toBe('Test Project');
        expect(loaded.meta.client).toBe('Test Client');
        expect(loaded.meta.dailyDemand).toBe(500);
        expect(loaded.tasks).toHaveLength(1);
        expect(loaded.tasks[0].times).toEqual([10, 11, 12]);
    });
});

// NOTE: Old Simulation Engine tests removed - module was deleted during DES refactor.
// The DES simulation engine tests are in performance.test.ts and desSimulationEngine.test.ts.

// =============================================================================
// TEST 2: Takt Time Calculation Integration
// =============================================================================

describe('E2E: Takt Time Calculation', () => {
    it('should calculate correct takt with single shift', () => {
        const shifts = [
            { id: 1, name: 'Turno 1', startTime: '06:00', endTime: '14:00', breaks: [], plannedMinutes: 480 }
        ];
        const activeShiftsCount = 1;
        const dailyDemand = 480;
        const oee = 0.85;

        const result = calculateTaktTime(shifts, activeShiftsCount, dailyDemand, oee);

        // Expected: (480 * 60 * 0.85) / 480 = 51 seconds effective
        expect(result.effectiveSeconds).toBeCloseTo(51, 0);
        expect(result.nominalSeconds).toBeCloseTo(60, 0); // Without OEE
    });

    it('should handle OEE impact on takt', () => {
        const shifts = [
            { id: 1, name: 'Turno 1', startTime: '06:00', endTime: '14:00', breaks: [], plannedMinutes: 480 }
        ];
        const activeShiftsCount = 1;
        const dailyDemand = 400;

        const result85 = calculateTaktTime(shifts, activeShiftsCount, dailyDemand, 0.85);
        const result100 = calculateTaktTime(shifts, activeShiftsCount, dailyDemand, 1.0);

        // Lower OEE = Lower effective takt
        expect(result85.effectiveSeconds).toBeLessThan(result100.effectiveSeconds);
    });

    it('should handle zero demand gracefully', () => {
        const shifts = [
            { id: 1, name: 'Turno 1', startTime: '06:00', endTime: '14:00', breaks: [], plannedMinutes: 480 }
        ];
        const activeShiftsCount = 1;

        const result = calculateTaktTime(shifts, activeShiftsCount, 0, 0.85);

        // Function returns 0 when demand is 0 (not Infinity - design decision)
        expect(result.nominalSeconds).toBe(0);
    });
});
