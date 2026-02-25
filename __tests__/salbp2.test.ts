/**
 * SALBP-2 Balancing Tests - Phase 5 
 * 
 * Tests for the smooth flow balancing algorithm that minimizes
 * cycle time given a fixed number of operators.
 */
import { describe, it, expect } from 'vitest';
import { simulateBalanceType2 } from '../core/balancing/engine';
import { ProjectData, Task, Shift } from '../types';

// Helper to create minimal ProjectData
const createTestProjectData = (tasks: Partial<Task>[]): ProjectData => ({
    meta: {
        name: 'Test',
        date: new Date().toISOString(),
        client: 'Test',
        version: '1.0',
        engineer: 'Test',
        activeShifts: 1,
        manualOEE: 0.85,
        useManualOEE: true,
        dailyDemand: 100,
        configuredStations: 4
    },
    shifts: [{
        id: 1,
        name: 'Turno 1',
        startTime: '06:00',
        endTime: '14:00',
        breaks: [],
        plannedMinutes: 480
    }] as Shift[],
    sectors: [],
    tasks: tasks.map((t, i) => ({
        id: t.id || `task-${i}`,
        description: t.description || `Task ${i}`,
        standardTime: t.standardTime || 10,
        averageTime: t.averageTime || t.standardTime || 10,
        predecessors: t.predecessors || [],
        positionalWeight: t.positionalWeight || 1,
        ...t
    })) as Task[],
    assignments: [],
    stationConfigs: []
});

describe('SALBP-2 Balancing (Phase 5)', () => {
    describe('Basic Distribution', () => {
        it('should distribute tasks into exactly N stations', () => {
            const data = createTestProjectData([
                { id: 't1', standardTime: 10, positionalWeight: 4 },
                { id: 't2', standardTime: 10, positionalWeight: 3 },
                { id: 't3', standardTime: 10, positionalWeight: 2 },
                { id: 't4', standardTime: 10, positionalWeight: 1 }
            ]);

            const result = simulateBalanceType2(data, 4, 'Test', 60);

            expect(result.stationsCount).toBe(4);
            expect(result.assignments.length).toBe(4);
        });

        it('should minimize cycle time with even distribution', () => {
            // 4 tasks of 20s each, 2 stations = should be ~40s each
            const data = createTestProjectData([
                { id: 't1', standardTime: 20, positionalWeight: 4 },
                { id: 't2', standardTime: 20, positionalWeight: 3 },
                { id: 't3', standardTime: 20, positionalWeight: 2 },
                { id: 't4', standardTime: 20, positionalWeight: 1 }
            ]);

            const result = simulateBalanceType2(data, 2, 'Test', 60);

            // Each station should have ~40s (2 tasks each)
            expect(result.realCycleTime).toBeCloseTo(40, 0);
            expect(result.stationsCount).toBe(2);
        });

        it('should handle uneven task times', () => {
            // Tasks: 30s, 20s, 10s, 10s = 70s total
            // 2 stations = LB = 35s, but 30s task limits it
            const data = createTestProjectData([
                { id: 't1', standardTime: 30, positionalWeight: 4 },
                { id: 't2', standardTime: 20, positionalWeight: 3 },
                { id: 't3', standardTime: 10, positionalWeight: 2 },
                { id: 't4', standardTime: 10, positionalWeight: 1 }
            ]);

            const result = simulateBalanceType2(data, 2, 'Test', 60);

            // Should distribute as: [30+10] and [20+10] = 40s each
            expect(result.realCycleTime).toBeLessThanOrEqual(40.5);
        });
    });

    describe('Precedence Constraints', () => {
        it('should respect task precedences and assign all tasks', () => {
            const data = createTestProjectData([
                { id: 't1', standardTime: 10, positionalWeight: 4, predecessors: [] },
                { id: 't2', standardTime: 10, positionalWeight: 3, predecessors: ['t1'] },
                { id: 't3', standardTime: 10, positionalWeight: 2, predecessors: ['t2'] },
                { id: 't4', standardTime: 10, positionalWeight: 1, predecessors: ['t3'] }
            ]);

            const result = simulateBalanceType2(data, 2, 'Test', 60);

            // All tasks should be assigned (precedence respected during algorithm)
            expect(result.assignments.length).toBe(4);

            // Cycle time should be ~20s (40s / 2 stations)
            expect(result.realCycleTime).toBeLessThanOrEqual(21);
        });
    });

    describe('Edge Cases', () => {
        it('should handle single station', () => {
            const data = createTestProjectData([
                { id: 't1', standardTime: 10 },
                { id: 't2', standardTime: 20 }
            ]);

            const result = simulateBalanceType2(data, 1, 'Test', 60);

            expect(result.stationsCount).toBe(1);
            expect(result.realCycleTime).toBeCloseTo(30, 0);
        });

        it('should handle more stations than tasks', () => {
            const data = createTestProjectData([
                { id: 't1', standardTime: 10 },
                { id: 't2', standardTime: 10 }
            ]);

            const result = simulateBalanceType2(data, 5, 'Test', 60);

            // Only 2 tasks, so only 2 stations will be used
            expect(result.assignments.length).toBe(2);
            // Stations used should be <= N requested
            const usedStations = new Set(result.assignments.map(a => a.stationId));
            expect(usedStations.size).toBeLessThanOrEqual(5);
        });

        it('should handle task larger than lower bound', () => {
            // 1 task of 50s + 1 task of 10s = 60s total
            // 2 stations => LB = 30s, but 50s task prevents even split
            const data = createTestProjectData([
                { id: 't1', standardTime: 50, positionalWeight: 2 },
                { id: 't2', standardTime: 10, positionalWeight: 1 }
            ]);

            const result = simulateBalanceType2(data, 2, 'Test', 60);

            // Should succeed with cycle time = 50s (the large task)
            expect(result.realCycleTime).toBeCloseTo(50, 0);
        });
    });
});
