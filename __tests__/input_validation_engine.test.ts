/**
 * Input Validation Tests for Balancing and DES Engines
 *
 * Covers all identified validation issues:
 * - Engine entry point structural validation (throw)
 * - Engine entry point numeric edge cases (empty result)
 * - Division-by-zero guards
 * - Empty array crash guards
 * - DES constructor validation
 * - DES edge cases (deadlock, instant completion)
 */
import { describe, it, expect } from 'vitest';
import {
    simulateBalance,
    simulateBalanceType2,
    BalancingInputError,
} from '../core/balancing/engine';
import {
    createDESEngine,
    DESConfigError,
    DESConfig,
} from '../modules/flow-simulator/desSimulationEngine';
import { ProjectData, Task, Shift } from '../types';

// =========================================================
// HELPERS
// =========================================================

const createTask = (
    id: string,
    standardTime: number,
    overrides: Partial<Task> = {}
): Task => ({
    id,
    description: `Task ${id}`,
    times: [standardTime],
    averageTime: standardTime,
    standardTime,
    ratingFactor: 100,
    fatigueCategory: 'none',
    predecessors: [],
    successors: [],
    positionalWeight: 0,
    calculatedSuccessorSum: 0,
    executionMode: 'manual',
    ...overrides,
});

const createShift = (): Shift => ({
    id: 1,
    name: 'Turno 1',
    startTime: '06:00',
    endTime: '14:00',
    breaks: [],
});

const createMinimalProjectData = (
    overrides: Partial<ProjectData> = {}
): ProjectData => ({
    meta: {
        name: 'Validation Test',
        date: '2026-01-01',
        client: 'Test',
        version: '1.0',
        engineer: 'Test',
        activeShifts: 1,
        manualOEE: 0.85,
        useManualOEE: true,
        useSectorOEE: false,
        dailyDemand: 1000,
        configuredStations: 1,
    } as ProjectData['meta'],
    shifts: [createShift()],
    sectors: [],
    tasks: [
        createTask('T1', 10),
        createTask('T2', 15),
        createTask('T3', 20),
    ],
    assignments: [],
    stationConfigs: [],
    ...overrides,
} as ProjectData);

const createMinimalDESConfig = (
    overrides: Partial<DESConfig> = {}
): DESConfig => ({
    stations: [
        { id: 1, name: 'ST-1', cycleTime: 10, operators: 1, bufferCapacity: 5 },
        { id: 2, name: 'ST-2', cycleTime: 12, operators: 1, bufferCapacity: 5 },
    ],
    wipLimit: 5,
    totalPieces: 100,
    ...overrides,
});

// =========================================================
// A. ENGINE ENTRY POINT VALIDATION
// =========================================================

describe('Balancing Engine Input Validation', () => {
    describe('A1: Structural validation (should throw BalancingInputError)', () => {
        it('throws when data.tasks is empty', () => {
            const data = createMinimalProjectData({ tasks: [] });
            expect(() => simulateBalance(data, 'RPW', 'Test', 30, 25))
                .toThrow(BalancingInputError);
        });

        it('throws when data.tasks is undefined', () => {
            const data = createMinimalProjectData();
            (data as any).tasks = undefined;
            expect(() => simulateBalance(data, 'RPW', 'Test', 30, 25))
                .toThrow(BalancingInputError);
        });

        it('throws when data.meta is missing', () => {
            const data = createMinimalProjectData();
            (data as any).meta = undefined;
            expect(() => simulateBalance(data, 'RPW', 'Test', 30, 25))
                .toThrow(BalancingInputError);
        });

        it('error contains the field name for debugging', () => {
            const data = createMinimalProjectData({ tasks: [] });
            try {
                simulateBalance(data, 'RPW', 'Test', 30, 25);
                expect.unreachable('Should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(BalancingInputError);
                expect((e as BalancingInputError).field).toBe('data.tasks');
            }
        });
    });

    describe('A2: Numeric edge cases (should return empty result, not crash)', () => {
        it('returns empty result when nominalSeconds is 0', () => {
            const data = createMinimalProjectData();
            const result = simulateBalance(data, 'RPW', 'Test', 0, 0);
            expect(result.assignments).toHaveLength(0);
            expect(result.stationsCount).toBe(0);
            expect(result.efficiency).toBe(0);
        });

        it('returns empty result when nominalSeconds is negative', () => {
            const data = createMinimalProjectData();
            const result = simulateBalance(data, 'RPW', 'Test', -10, -8.5);
            expect(result.assignments).toHaveLength(0);
        });

        it('returns empty result when effectiveSeconds is 0 but nominal > 0', () => {
            const data = createMinimalProjectData();
            const result = simulateBalance(data, 'RPW', 'Test', 30, 0);
            expect(result.assignments).toHaveLength(0);
        });

        it('returns empty result when nominalSeconds is NaN', () => {
            const data = createMinimalProjectData();
            const result = simulateBalance(data, 'RPW', 'Test', NaN, NaN);
            expect(result.assignments).toHaveLength(0);
        });

        it('returns empty result when nominalSeconds is Infinity', () => {
            const data = createMinimalProjectData();
            const result = simulateBalance(data, 'RPW', 'Test', Infinity, Infinity);
            expect(result.assignments).toHaveLength(0);
        });

        it('empty result preserves sortedTasks for UI display', () => {
            const data = createMinimalProjectData();
            const result = simulateBalance(data, 'RPW', 'Test', 0, 0);
            expect(result.sortedTasks).toHaveLength(data.tasks.length);
        });
    });

    // =========================================================
    // B. DIVISION-BY-ZERO GUARDS
    // =========================================================

    describe('B: Division-by-zero guards (should not produce Infinity/NaN)', () => {
        it('handles tasks where all are isMachineInternal (maxTaskTime = 0)', () => {
            const data = createMinimalProjectData({
                tasks: [
                    createTask('M1', 10, { executionMode: 'machine' }),
                    createTask('G1', 10, { isMachineInternal: true, concurrentWith: 'M1' }),
                ],
            });
            const result = simulateBalance(data, 'RPW', 'Test', 30, 25);
            expect(isFinite(result.efficiency)).toBe(true);
            expect(isFinite(result.realCycleTime || 0)).toBe(true);
        });

        it('SALBP-2 does not crash on empty tasks', () => {
            const data = createMinimalProjectData({ tasks: [] });
            const result = simulateBalanceType2(data, 3, 'Test', 30);
            expect(result.assignments).toHaveLength(0);
        });

        it('SALBP-2 with targetStations=0 clamps to 1', () => {
            const data = createMinimalProjectData();
            const result = simulateBalanceType2(data, 0, 'Test', 30);
            expect(result.stationsCount).toBeGreaterThanOrEqual(0);
            expect(isFinite(result.efficiency)).toBe(true);
        });

        it('efficiency does not become NaN when only ghost tasks exist', () => {
            const data = createMinimalProjectData({
                tasks: [
                    createTask('M1', 10, { executionMode: 'machine' }),
                    createTask('G1', 5, { isMachineInternal: true, concurrentWith: 'M1' }),
                ],
            });
            const result = simulateBalance(data, 'RPW', 'Test', 30, 25);
            expect(Number.isNaN(result.efficiency)).toBe(false);
            expect(Number.isNaN(result.lineEfficiency || 0)).toBe(false);
        });

        it('handles nominalSeconds=0 in SALBP-2 efficiency calculation', () => {
            const data = createMinimalProjectData();
            const result = simulateBalanceType2(data, 2, 'Test', 0);
            expect(isFinite(result.efficiency)).toBe(true);
        });

        it('replicas division is safe and produces finite results', () => {
            const data = createMinimalProjectData({
                tasks: [createTask('T1', 10), createTask('T2', 15)],
            });
            const result = simulateBalance(data, 'RPW', 'Test', 30, 25);
            expect(isFinite(result.realCycleTime || 0)).toBe(true);
            expect(isFinite(result.idleTime)).toBe(true);
        });
    });

    // =========================================================
    // C. EMPTY ARRAY CRASH GUARDS
    // =========================================================

    describe('C: Empty array guards (Math.max spread)', () => {
        it('Math.max does not return -Infinity when all tasks are ghost tasks', () => {
            const data = createMinimalProjectData({
                tasks: [
                    createTask('G1', 10, { isMachineInternal: true }),
                ],
            });
            const result = simulateBalance(data, 'RPW', 'Test', 30, 25);
            expect(result.realCycleTime).not.toBe(-Infinity);
            expect(isFinite(result.realCycleTime || 0)).toBe(true);
        });

        it('SALBP-2 Math.max does not return -Infinity with ghost tasks', () => {
            const data = createMinimalProjectData({
                tasks: [
                    createTask('G1', 10, { isMachineInternal: true }),
                ],
            });
            const result = simulateBalanceType2(data, 2, 'Test', 30);
            expect(result.realCycleTime).not.toBe(-Infinity);
        });
    });

    // =========================================================
    // D. SALBP-2 SPECIFIC VALIDATION
    // =========================================================

    describe('D: SALBP-2 mode specific edge cases', () => {
        it('targetOperators=0 in meta falls back gracefully', () => {
            const data = createMinimalProjectData();
            (data.meta as any).balancingMode = 'SALBP2';
            (data.meta as any).targetOperators = 0;
            const result = simulateBalance(data, 'RPW', 'Test', 30, 25);
            expect(isFinite(result.efficiency)).toBe(true);
            expect(result.stationsCount).toBeGreaterThanOrEqual(0);
        });

        it('targetOperators negative in meta falls back gracefully', () => {
            const data = createMinimalProjectData();
            (data.meta as any).balancingMode = 'SALBP2';
            (data.meta as any).targetOperators = -3;
            const result = simulateBalance(data, 'RPW', 'Test', 30, 25);
            expect(isFinite(result.efficiency)).toBe(true);
        });
    });

    // =========================================================
    // E. LCR HEURISTIC EDGE CASE
    // =========================================================

    describe('E: LCR heuristic with edge cases', () => {
        it('LCR with zero-time tasks does not hang', () => {
            const data = createMinimalProjectData({
                tasks: [
                    createTask('T1', 0),
                    createTask('T2', 0),
                    createTask('T3', 10),
                ],
            });
            const result = simulateBalance(data, 'LCR', 'Test', 30, 25);
            expect(result.assignments.length).toBeGreaterThan(0);
        });
    });
});

// =========================================================
// DES ENGINE VALIDATION
// =========================================================

describe('DES Simulation Engine Input Validation', () => {
    describe('F1: Constructor structural validation (should throw DESConfigError)', () => {
        it('throws when stations array is empty', () => {
            expect(() => createDESEngine({
                stations: [],
                wipLimit: 5,
                totalPieces: 100,
            })).toThrow(DESConfigError);
        });

        it('throws when stations is undefined', () => {
            expect(() => createDESEngine({
                stations: undefined as any,
                wipLimit: 5,
                totalPieces: 100,
            })).toThrow(DESConfigError);
        });

        it('throws when totalPieces is 0', () => {
            expect(() => createDESEngine(
                createMinimalDESConfig({ totalPieces: 0 })
            )).toThrow(DESConfigError);
        });

        it('throws when totalPieces is negative', () => {
            expect(() => createDESEngine(
                createMinimalDESConfig({ totalPieces: -10 })
            )).toThrow(DESConfigError);
        });

        it('throws when wipLimit is 0', () => {
            expect(() => createDESEngine(
                createMinimalDESConfig({ wipLimit: 0 })
            )).toThrow(DESConfigError);
        });

        it('throws when wipLimit is negative', () => {
            expect(() => createDESEngine(
                createMinimalDESConfig({ wipLimit: -1 })
            )).toThrow(DESConfigError);
        });

        it('error contains the field name for debugging', () => {
            try {
                createDESEngine({ stations: [], wipLimit: 5, totalPieces: 100 });
                expect.unreachable('Should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(DESConfigError);
                expect((e as DESConfigError).field).toBe('stations');
            }
        });
    });

    describe('F2: Station-level clamping (defensive defaults)', () => {
        it('clamps cycleTime=0 to minimum 0.01s', () => {
            const config = createMinimalDESConfig({
                stations: [
                    { id: 1, name: 'ST-1', cycleTime: 0, operators: 1, bufferCapacity: 5 },
                ],
            });
            const engine = createDESEngine(config);
            const result = engine.runInstant();
            expect(result.completedCount).toBe(config.totalPieces);
            expect(result.avgCycleTime).toBeGreaterThan(0);
        });

        it('clamps operators=0 to minimum 1', () => {
            const config = createMinimalDESConfig({
                stations: [
                    { id: 1, name: 'ST-1', cycleTime: 10, operators: 0, bufferCapacity: 5 },
                ],
            });
            const engine = createDESEngine(config);
            const result = engine.runInstant();
            expect(result.completedCount).toBeGreaterThan(0);
        });

        it('clamps negative cycleTime to minimum 0.01s', () => {
            const config = createMinimalDESConfig({
                stations: [
                    { id: 1, name: 'ST-1', cycleTime: -5, operators: 1, bufferCapacity: 5 },
                ],
            });
            const engine = createDESEngine(config);
            const result = engine.runInstant();
            expect(result.completedCount).toBe(config.totalPieces);
        });

        it('clamps negative operators to minimum 1', () => {
            const config = createMinimalDESConfig({
                stations: [
                    { id: 1, name: 'ST-1', cycleTime: 10, operators: -3, bufferCapacity: 5 },
                ],
            });
            const engine = createDESEngine(config);
            const result = engine.runInstant();
            expect(result.completedCount).toBeGreaterThan(0);
        });
    });

    describe('F3: Simulation runs to completion with edge configs', () => {
        it('single station completes all pieces', () => {
            const config = createMinimalDESConfig({
                stations: [
                    { id: 1, name: 'ST-1', cycleTime: 1, operators: 1, bufferCapacity: 10 },
                ],
                totalPieces: 10,
                wipLimit: 5,
            });
            const engine = createDESEngine(config);
            const result = engine.runInstant();
            expect(result.completedCount).toBe(10);
        });

        it('totalPieces=1 completes correctly', () => {
            const config = createMinimalDESConfig({ totalPieces: 1 });
            const engine = createDESEngine(config);
            const result = engine.runInstant();
            expect(result.completedCount).toBe(1);
        });

        it('wipLimit=1 does not deadlock (serialized flow)', () => {
            const config = createMinimalDESConfig({ wipLimit: 1, totalPieces: 5 });
            const engine = createDESEngine(config);
            const result = engine.runInstant();
            expect(result.completedCount).toBe(5);
        });

        it('variabilityPercent is clamped to 0-100 range', () => {
            const config = createMinimalDESConfig({
                variabilityPercent: 150,
                totalPieces: 10,
            });
            const engine = createDESEngine(config);
            const result = engine.runInstant();
            expect(result.completedCount).toBe(10);
        });

        it('negative variabilityPercent is clamped to 0', () => {
            const config = createMinimalDESConfig({
                variabilityPercent: -20,
                totalPieces: 10,
            });
            const engine = createDESEngine(config);
            const result = engine.runInstant();
            expect(result.completedCount).toBe(10);
        });
    });

    describe('F4: KPI calculations do not produce NaN/Infinity', () => {
        it('bottleneck metrics are finite', () => {
            const config = createMinimalDESConfig({ totalPieces: 50 });
            const engine = createDESEngine(config);
            const result = engine.runInstant();

            expect(isFinite(result.throughput)).toBe(true);
            expect(isFinite(result.avgCycleTime)).toBe(true);
            expect(isFinite(result.kpis.oee)).toBe(true);
            expect(isFinite(result.kpis.availability)).toBe(true);
            expect(isFinite(result.kpis.performance)).toBe(true);
        });

        it('OEE is within valid range [0, 1]', () => {
            const config = createMinimalDESConfig({ totalPieces: 50 });
            const engine = createDESEngine(config);
            const result = engine.runInstant();

            expect(result.kpis.oee).toBeGreaterThanOrEqual(0);
            expect(result.kpis.oee).toBeLessThanOrEqual(1.01); // Allow tiny float overshoot
        });
    });
});
