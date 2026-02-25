/**
 * Balancing Integration Tests (Phase 11)
 * 
 * Tests for the balancing adapter functions that parse ProjectData
 * into simulator configuration and handle delta synchronization.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    parseShiftsToCalendar,
    parseDemandConfig,
    parseStationsFromBalancing,
    parseProjectToSimulator,
    SimulatorConfig,
} from '../modules/flow-simulator/balancingAdapter';
import { ProjectData, Shift, Task, StationConfig, Sector, Assignment } from '../types';

// Helper to create minimal ProjectData for testing
function createTestProjectData(overrides: Partial<ProjectData> = {}): ProjectData {
    return {
        meta: {
            name: 'Test Project',
            date: '2026-01-29',
            client: 'Test Client',
            version: '1.0.0',
            engineer: 'Test Engineer',
            activeShifts: 1,
            manualOEE: 0.85,
            useManualOEE: true,
            dailyDemand: 1000,
            configuredStations: 3,
        },
        shifts: [
            {
                id: 1,
                name: 'Turno Mañana',
                startTime: '06:00',
                endTime: '14:30',
                breaks: [
                    { id: 'break-1', name: 'Descanso', startTime: '10:00', duration: 15 },
                    { id: 'break-2', name: 'Almuerzo', startTime: '12:00', duration: 30 },
                ],
            },
        ],
        sectors: [
            { id: 'COSTURA', name: 'Costura', color: '#8B5CF6' },
            { id: 'ENSAMBLE', name: 'Ensamble', color: '#10B981' },
        ],
        tasks: [
            { id: 'OP-001', description: 'Tarea 1', times: [30], averageTime: 30, standardTime: 30, ratingFactor: 100, fatigueCategory: 'standard', predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, sectorId: 'COSTURA' },
            { id: 'OP-002', description: 'Tarea 2', times: [25], averageTime: 25, standardTime: 25, ratingFactor: 100, fatigueCategory: 'standard', predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, sectorId: 'COSTURA' },
            { id: 'OP-003', description: 'Tarea 3', times: [35], averageTime: 35, standardTime: 35, ratingFactor: 100, fatigueCategory: 'standard', predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, sectorId: 'ENSAMBLE' },
        ],
        assignments: [
            { stationId: 1, taskId: 'OP-001' },
            { stationId: 1, taskId: 'OP-002' },
            { stationId: 2, taskId: 'OP-003' },
        ],
        stationConfigs: [
            { id: 1, name: 'Estación 1', oeeTarget: 0.85 },
            { id: 2, name: 'Estación 2', oeeTarget: 0.85 },
            { id: 3, name: 'Estación 3', oeeTarget: 0.85 },
        ],
        ...overrides,
    } as ProjectData;
}

describe('Balancing Integration (Phase 11)', () => {
    describe('parseShiftsToCalendar', () => {
        it('should parse shifts to ShiftCalendar correctly', () => {
            const data = createTestProjectData();
            const calendar = parseShiftsToCalendar(data.shifts, 1);

            expect(calendar.shiftDurationMinutes).toBe(510); // 8.5 hours
            expect(calendar.startTime).toBe('06:00');
            expect(calendar.breaks.length).toBe(2);
        });

        it('should calculate effective minutes accounting for breaks', () => {
            const data = createTestProjectData();
            const calendar = parseShiftsToCalendar(data.shifts, 1);

            // 510 total - 15 - 30 = 465 effective minutes
            expect(calendar.effectiveMinutes).toBe(465);
        });

        it('should handle empty shifts with defaults', () => {
            const calendar = parseShiftsToCalendar([], 1);

            expect(calendar.shiftDurationMinutes).toBe(510);
            expect(calendar.effectiveMinutes).toBe(450);
        });

        it('should parse break start minutes correctly', () => {
            const data = createTestProjectData();
            const calendar = parseShiftsToCalendar(data.shifts, 1);

            // 10:00 - 06:00 = 4 hours = 240 minutes
            expect(calendar.breaks[0].startMinute).toBe(240);
            // 12:00 - 06:00 = 6 hours = 360 minutes
            expect(calendar.breaks[1].startMinute).toBe(360);
        });
    });

    describe('parseDemandConfig', () => {
        it('should calculate correct takt from demand and shifts', () => {
            const data = createTestProjectData();
            const demandConfig = parseDemandConfig(data);

            expect(demandConfig.dailyDemand).toBe(1000);
            expect(demandConfig.shiftCount).toBe(1);
            expect(demandConfig.effectiveMinutesPerShift).toBe(465);

            // Available time = 465 min * 60 sec * 0.85 OEE = 23715 seconds
            // Takt = 23715 / 1000 = 23.715 seconds
            expect(demandConfig.calculatedTakt).toBeCloseTo(23.715, 1);
        });

        it('should handle multiple shifts', () => {
            const data = createTestProjectData({
                meta: {
                    ...createTestProjectData().meta,
                    activeShifts: 2,
                    dailyDemand: 2000,
                },
            });
            const demandConfig = parseDemandConfig(data);

            expect(demandConfig.shiftCount).toBe(2);
            expect(demandConfig.demandPerShift).toBe(1000);
        });

        it('should apply OEE factor to available time', () => {
            const data = createTestProjectData({
                meta: {
                    ...createTestProjectData().meta,
                    manualOEE: 1.0, // 100% OEE = no reduction
                    useManualOEE: true,
                    dailyDemand: 1000,
                },
            });
            const demandConfig = parseDemandConfig(data);

            // 465 min * 60 = 27900 seconds / 1000 = 27.9 seconds
            expect(demandConfig.calculatedTakt).toBeCloseTo(27.9, 1);
        });
    });

    describe('parseStationsFromBalancing', () => {
        it('should parse stations with correct cycle times from tasks', () => {
            const data = createTestProjectData();
            const stations = parseStationsFromBalancing(data);

            // Station 1 has OP-001 (30s) + OP-002 (25s) = 55s
            const station1 = stations.find(s => s.id === 1);
            expect(station1?.cycleTimeSeconds).toBe(55);

            // Station 2 has OP-003 (35s)
            const station2 = stations.find(s => s.id === 2);
            expect(station2?.cycleTimeSeconds).toBe(35);
        });

        it('should assign correct sector colors', () => {
            const data = createTestProjectData();
            const stations = parseStationsFromBalancing(data);

            const station1 = stations.find(s => s.id === 1);
            expect(station1?.sectorColor).toBe('#8B5CF6'); // COSTURA color

            const station2 = stations.find(s => s.id === 2);
            expect(station2?.sectorColor).toBe('#10B981'); // ENSAMBLE color
        });

        it('should use cycleTimeOverride when provided', () => {
            const data = createTestProjectData({
                stationConfigs: [
                    { id: 1, name: 'Override Station', oeeTarget: 0.85, cycleTimeOverride: 40 },
                ],
            });
            const stations = parseStationsFromBalancing(data);

            const station1 = stations.find(s => s.id === 1);
            expect(station1?.cycleTimeSeconds).toBe(40);
        });

        it('should handle station with no assignments', () => {
            const data = createTestProjectData();
            const stations = parseStationsFromBalancing(data);

            // Station 3 has no tasks assigned
            const station3 = stations.find(s => s.id === 3);
            expect(station3?.cycleTimeSeconds).toBe(30); // Default
        });
    });

    describe('parseProjectToSimulator', () => {
        it('should produce complete SimulatorConfig', () => {
            const data = createTestProjectData();
            const config = parseProjectToSimulator({ projectData: data });

            expect(config.stations).toHaveLength(3);
            expect(config.shiftCalendar).toBeDefined();
            expect(config.demandConfig).toBeDefined();
        });

        it('should link all components correctly', () => {
            const data = createTestProjectData();
            const config = parseProjectToSimulator({ projectData: data });

            // Verify takt calculation matches demand config
            expect(config.demandConfig.calculatedTakt).toBeGreaterThan(0);

            // Verify shift calendar effective minutes
            expect(config.shiftCalendar.effectiveMinutes).toBe(465);
        });
    });
});
