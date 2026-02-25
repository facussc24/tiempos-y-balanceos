/**
 * StandardWorkSheet Tests - Phase 10
 * 
 * Tests for the Standard Work Sheet generation functions.
 */
import { describe, it, expect } from 'vitest';
import { extractStationWorkData, generateStandardWorkSheetHTML } from '../components/reports/StandardWorkSheet';
import { ProjectData, Task, Assignment } from '../types';

// Helper to create minimal ProjectData
const createTestProjectData = (
    tasks: Partial<Task>[],
    assignments: Assignment[]
): ProjectData => ({
    meta: {
        name: 'Test Project',
        date: '2026-01-16',
        client: 'Test Client',
        version: '1.0',
        engineer: 'Test',
        activeShifts: 1,
        manualOEE: 0.85,
        useManualOEE: true,
        dailyDemand: 100,
        configuredStations: 4
    },
    shifts: [],
    sectors: [
        { id: 'sector-1', name: 'Ensamble', color: '#3b82f6', targetOee: 0.85 }
    ],
    tasks: tasks.map((t, i) => ({
        id: t.id || `task-${i}`,
        description: t.description || `Task ${i}`,
        standardTime: t.standardTime || 10,
        averageTime: t.averageTime || t.standardTime || 10,
        predecessors: [],
        positionalWeight: 1,
        executionMode: 'manual',
        sectorId: 'sector-1',
        ...t
    })) as Task[],
    assignments,
    stationConfigs: [
        { id: 1, oeeTarget: 0.85, replicas: 1 }
    ]
});

describe('StandardWorkSheet (Phase 10)', () => {
    describe('extractStationWorkData', () => {
        it('should extract data for a station with assignments', () => {
            const data = createTestProjectData(
                [
                    { id: 't1', description: 'Instalar tornillo', standardTime: 15 },
                    { id: 't2', description: 'Ajustar pieza', standardTime: 20 }
                ],
                [
                    { taskId: 't1', stationId: 1 },
                    { taskId: 't2', stationId: 1 }
                ]
            );

            const result = extractStationWorkData(data, 1);

            expect(result).not.toBeNull();
            expect(result?.stationId).toBe(1);
            expect(result?.tasks.length).toBe(2);
            expect(result?.totalTime).toBe(35);
        });

        it('should return null for station without assignments', () => {
            const data = createTestProjectData(
                [{ id: 't1', standardTime: 10 }],
                [{ taskId: 't1', stationId: 1 }]
            );

            const result = extractStationWorkData(data, 99);

            expect(result).toBeNull();
        });

        it('should calculate total time excluding machine internal tasks', () => {
            const data = createTestProjectData(
                [
                    { id: 't1', standardTime: 20, isMachineInternal: false },
                    { id: 't2', standardTime: 30, isMachineInternal: true }
                ],
                [
                    { taskId: 't1', stationId: 1 },
                    { taskId: 't2', stationId: 1 }
                ]
            );

            const result = extractStationWorkData(data, 1);

            expect(result?.totalTime).toBe(20); // Only manual task
        });
    });

    describe('generateStandardWorkSheetHTML', () => {
        it('should generate valid HTML with station info', () => {
            const stationData = {
                stationId: 1,
                stationName: 'Estación 1',
                sectorName: 'Ensamble',
                sectorColor: '#3b82f6',
                tasks: [
                    { id: 't1', description: 'Tarea 1', standardTime: 20, executionMode: 'manual' }
                ] as Task[],
                totalTime: 20,
                replicas: 1,
                oeeTarget: 0.85,
                machineNames: []
            };

            const html = generateStandardWorkSheetHTML(
                stationData,
                { name: 'Test', client: 'Client', date: '2026-01-16' } as any,
                60
            );

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('Estación 1');
            expect(html).toContain('Takt Time');
            expect(html).toContain('Tarea 1');
        });

        it('should show machine names when present', () => {
            const stationData = {
                stationId: 1,
                stationName: 'Estación 1',
                sectorName: 'Inyección',
                sectorColor: '#059669',
                tasks: [] as Task[],
                totalTime: 45,
                replicas: 2,
                oeeTarget: 0.85,
                machineNames: ['Inyectora A', 'Prensa B']
            };

            const html = generateStandardWorkSheetHTML(
                stationData,
                { name: 'Test', client: 'Client', date: '2026-01-16' } as any,
                60
            );

            expect(html).toContain('Inyectora A');
            expect(html).toContain('Prensa B');
            expect(html).toContain('Equipos');
        });

        it('should calculate saturation correctly', () => {
            const stationData = {
                stationId: 1,
                stationName: 'Est 1',
                sectorName: 'Test',
                sectorColor: '#000',
                tasks: [] as Task[],
                totalTime: 50,
                replicas: 1,
                oeeTarget: 0.85,
                machineNames: []
            };

            const html = generateStandardWorkSheetHTML(
                stationData,
                { name: 'Test', client: 'Client', date: '2026-01-16' } as any,
                100 // Takt = 100s, Cycle = 50s => 50% saturation
            );

            expect(html).toContain('50'); // Should show 50% somewhere
        });
    });
});
