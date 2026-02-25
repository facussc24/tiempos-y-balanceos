/**
 * FIX 7: Buffer Dimensioning Logic Tests
 * 
 * Tests for the saturation-based buffer recommendation algorithm.
 */

import {
    calculateBufferSize,
    analyzeBufferNeeds,
    isManMachineTransition,
    calculateStationSaturations,
    FRAGILE_LINE_EFFICIENCY_THRESHOLD,
    CRITICAL_SATURATION_THRESHOLD,
    HIGH_SATURATION_THRESHOLD,
    BUFFER_SIZE_CRITICAL,
    BUFFER_SIZE_STANDARD,
    StationSaturationInfo
} from '../core/balancing/bufferLogic';

import { Task, StationConfig, Assignment } from '../types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTask(id: string, standardTime: number, executionMode: 'manual' | 'machine' | 'injection' = 'manual'): Task {
    return {
        id,
        description: `Task ${id}`,
        standardTime,
        averageTime: standardTime,
        times: [standardTime],
        ratingFactor: 100,
        fatigueCategory: 'standard' as const,
        predecessors: [],
        successors: [],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        executionMode,
        isMachineInternal: false
    };
}

function createStation(id: number, name?: string): StationConfig {
    return {
        id,
        name: name || `Estación ${id}`,
        oeeTarget: 0.85,
        replicas: 1
    };
}

function createAssignment(stationId: number, taskId: string): Assignment {
    return { stationId, taskId };
}

// =============================================================================
// calculateBufferSize TESTS
// =============================================================================

describe('calculateBufferSize', () => {
    describe('saturation thresholds', () => {
        it('returns 0 for saturation < 85%', () => {
            const result = calculateBufferSize(0.80, false);
            expect(result.size).toBe(0);
        });

        it('returns 0 for saturation at exactly 85%', () => {
            const result = calculateBufferSize(0.85, false);
            expect(result.size).toBe(0);
        });

        it('returns 1 for saturation between 85-92%', () => {
            const result = calculateBufferSize(0.88, false);
            expect(result.size).toBe(BUFFER_SIZE_STANDARD);
            expect(result.reason).toBe('high_saturation');
        });

        it('returns 1 for saturation at 90%', () => {
            const result = calculateBufferSize(0.90, false);
            expect(result.size).toBe(BUFFER_SIZE_STANDARD);
        });

        it('returns 2 for saturation > 92%', () => {
            const result = calculateBufferSize(0.95, false);
            expect(result.size).toBe(BUFFER_SIZE_CRITICAL);
            expect(result.reason).toBe('bottleneck');
        });

        it('returns 2 for saturation at 100%', () => {
            const result = calculateBufferSize(1.0, false);
            expect(result.size).toBe(BUFFER_SIZE_CRITICAL);
        });
    });

    describe('man-machine interface', () => {
        it('returns 2 for man-machine interface regardless of low saturation', () => {
            const result = calculateBufferSize(0.50, true);
            expect(result.size).toBe(BUFFER_SIZE_CRITICAL);
            expect(result.reason).toBe('man_machine_interface');
        });

        it('returns 2 for man-machine interface with high saturation', () => {
            const result = calculateBufferSize(0.95, true);
            expect(result.size).toBe(BUFFER_SIZE_CRITICAL);
            expect(result.reason).toBe('man_machine_interface');
        });
    });
});

// =============================================================================
// isManMachineTransition TESTS
// =============================================================================

describe('isManMachineTransition', () => {
    it('returns true for Machine → Manual transition', () => {
        const machineStation: StationSaturationInfo = {
            stationId: 1,
            stationName: 'Inyección',
            saturation: 0.85,
            cycleTime: 45,
            isBottleneck: false,
            hasMachineTasks: true,
            hasManualTasks: false
        };

        const manualStation: StationSaturationInfo = {
            stationId: 2,
            stationName: 'Ensamble',
            saturation: 0.80,
            cycleTime: 42,
            isBottleneck: false,
            hasMachineTasks: false,
            hasManualTasks: true
        };

        expect(isManMachineTransition(machineStation, manualStation)).toBe(true);
    });

    it('returns true for Manual → Machine transition', () => {
        const manualStation: StationSaturationInfo = {
            stationId: 1,
            stationName: 'Preparación',
            saturation: 0.80,
            cycleTime: 42,
            isBottleneck: false,
            hasMachineTasks: false,
            hasManualTasks: true
        };

        const machineStation: StationSaturationInfo = {
            stationId: 2,
            stationName: 'Inyección',
            saturation: 0.85,
            cycleTime: 45,
            isBottleneck: false,
            hasMachineTasks: true,
            hasManualTasks: false
        };

        expect(isManMachineTransition(manualStation, machineStation)).toBe(true);
    });

    it('returns false for Manual → Manual transition', () => {
        const station1: StationSaturationInfo = {
            stationId: 1,
            stationName: 'Estación 1',
            saturation: 0.80,
            cycleTime: 42,
            isBottleneck: false,
            hasMachineTasks: false,
            hasManualTasks: true
        };

        const station2: StationSaturationInfo = {
            stationId: 2,
            stationName: 'Estación 2',
            saturation: 0.85,
            cycleTime: 45,
            isBottleneck: false,
            hasMachineTasks: false,
            hasManualTasks: true
        };

        expect(isManMachineTransition(station1, station2)).toBe(false);
    });

    it('returns false for hybrid stations', () => {
        const hybridStation: StationSaturationInfo = {
            stationId: 1,
            stationName: 'Híbrida',
            saturation: 0.80,
            cycleTime: 42,
            isBottleneck: false,
            hasMachineTasks: true,
            hasManualTasks: true // Has both
        };

        const manualStation: StationSaturationInfo = {
            stationId: 2,
            stationName: 'Manual',
            saturation: 0.85,
            cycleTime: 45,
            isBottleneck: false,
            hasMachineTasks: false,
            hasManualTasks: true
        };

        expect(isManMachineTransition(hybridStation, manualStation)).toBe(false);
    });

    it('returns false if next station is null', () => {
        const station: StationSaturationInfo = {
            stationId: 1,
            stationName: 'Estación 1',
            saturation: 0.80,
            cycleTime: 42,
            isBottleneck: false,
            hasMachineTasks: true,
            hasManualTasks: false
        };

        expect(isManMachineTransition(station, null)).toBe(false);
    });
});

// =============================================================================
// analyzeBufferNeeds TESTS
// =============================================================================

describe('analyzeBufferNeeds', () => {
    const TAKT_TIME = 50; // seconds

    describe('fragile line detection', () => {
        it('detects fragile line (efficiency > 90%, no existing buffers)', () => {
            const stations: StationConfig[] = [
                createStation(1, 'E1'),
                createStation(2, 'E2'),
                createStation(3, 'E3')
            ];

            const tasks: Task[] = [
                createTask('T1', 47),
                createTask('T2', 46),
                createTask('T3', 48)
            ];

            const assignments: Assignment[] = [
                createAssignment(1, 'T1'),
                createAssignment(2, 'T2'),
                createAssignment(3, 'T3')
            ];

            const result = analyzeBufferNeeds(stations, tasks, assignments, TAKT_TIME);

            expect(result.isFragileLine).toBe(true);
            expect(result.lineEfficiency).toBeGreaterThan(FRAGILE_LINE_EFFICIENCY_THRESHOLD);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0]).toContain('Riesgo Operativo Alto');
        });

        it('does not flag fragile line with existing buffers', () => {
            const stations: StationConfig[] = [
                { ...createStation(1, 'E1'), wipBuffer: { size: 1, reason: 'high_saturation' } },
                createStation(2, 'E2'),
                createStation(3, 'E3')
            ];

            const tasks: Task[] = [
                createTask('T1', 47),
                createTask('T2', 46),
                createTask('T3', 48)
            ];

            const assignments: Assignment[] = [
                createAssignment(1, 'T1'),
                createAssignment(2, 'T2'),
                createAssignment(3, 'T3')
            ];

            const result = analyzeBufferNeeds(stations, tasks, assignments, TAKT_TIME);

            expect(result.isFragileLine).toBe(false);
        });

        it('does not flag fragile line with low efficiency', () => {
            const stations: StationConfig[] = [
                createStation(1, 'E1'),
                createStation(2, 'E2'),
                createStation(3, 'E3')
            ];

            const tasks: Task[] = [
                createTask('T1', 35),
                createTask('T2', 32),
                createTask('T3', 38)
            ];

            const assignments: Assignment[] = [
                createAssignment(1, 'T1'),
                createAssignment(2, 'T2'),
                createAssignment(3, 'T3')
            ];

            const result = analyzeBufferNeeds(stations, tasks, assignments, TAKT_TIME);

            expect(result.isFragileLine).toBe(false);
            expect(result.lineEfficiency).toBeLessThan(FRAGILE_LINE_EFFICIENCY_THRESHOLD);
        });
    });

    describe('buffer recommendations', () => {
        it('recommends buffer after bottleneck station', () => {
            const stations: StationConfig[] = [
                createStation(1, 'E1'),
                createStation(2, 'Bottleneck'),
                createStation(3, 'E3')
            ];

            const tasks: Task[] = [
                createTask('T1', 40),
                createTask('T2', 48), // High saturation (96%)
                createTask('T3', 42)
            ];

            const assignments: Assignment[] = [
                createAssignment(1, 'T1'),
                createAssignment(2, 'T2'),
                createAssignment(3, 'T3')
            ];

            const result = analyzeBufferNeeds(stations, tasks, assignments, TAKT_TIME);

            const bottleneckRec = result.recommendations.find(r => r.afterStationId === 2);
            expect(bottleneckRec).toBeDefined();
            expect(bottleneckRec?.reason).toBe('bottleneck');
            expect(bottleneckRec?.recommendedSize).toBe(BUFFER_SIZE_CRITICAL);
        });

        it('recommends buffer for high saturation stations', () => {
            const stations: StationConfig[] = [
                createStation(1, 'E1'),
                createStation(2, 'E2'),
                createStation(3, 'E3')
            ];

            const tasks: Task[] = [
                createTask('T1', 44), // 88% saturation
                createTask('T2', 40),
                createTask('T3', 42)
            ];

            const assignments: Assignment[] = [
                createAssignment(1, 'T1'),
                createAssignment(2, 'T2'),
                createAssignment(3, 'T3')
            ];

            const result = analyzeBufferNeeds(stations, tasks, assignments, TAKT_TIME);

            const highSatRec = result.recommendations.find(r => r.afterStationId === 1);
            expect(highSatRec).toBeDefined();
            expect(highSatRec?.reason).toBe('high_saturation');
            expect(highSatRec?.recommendedSize).toBe(BUFFER_SIZE_STANDARD);
        });

        it('does not recommend buffer for low saturation stations', () => {
            const stations: StationConfig[] = [
                createStation(1, 'E1'),
                createStation(2, 'E2'),
                createStation(3, 'E3')
            ];

            const tasks: Task[] = [
                createTask('T1', 35),
                createTask('T2', 38),
                createTask('T3', 36)
            ];

            const assignments: Assignment[] = [
                createAssignment(1, 'T1'),
                createAssignment(2, 'T2'),
                createAssignment(3, 'T3')
            ];

            const result = analyzeBufferNeeds(stations, tasks, assignments, TAKT_TIME);

            expect(result.recommendations).toHaveLength(0);
        });

        it('respects user manual overrides', () => {
            const stations: StationConfig[] = [
                { ...createStation(1, 'E1'), wipBuffer: { size: 5, reason: 'bottleneck', isManual: true } },
                createStation(2, 'E2'),
                createStation(3, 'E3')
            ];

            const tasks: Task[] = [
                createTask('T1', 48), // Would normally trigger buffer
                createTask('T2', 40),
                createTask('T3', 42)
            ];

            const assignments: Assignment[] = [
                createAssignment(1, 'T1'),
                createAssignment(2, 'T2'),
                createAssignment(3, 'T3')
            ];

            const result = analyzeBufferNeeds(stations, tasks, assignments, TAKT_TIME);

            // Should not recommend for station 1 (user override)
            const station1Rec = result.recommendations.find(r => r.afterStationId === 1);
            expect(station1Rec).toBeUndefined();
        });
    });

    describe('edge cases', () => {
        it('handles empty stations array', () => {
            const result = analyzeBufferNeeds([], [], [], TAKT_TIME);
            expect(result.isFragileLine).toBe(false);
            expect(result.recommendations).toHaveLength(0);
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it('handles zero takt time', () => {
            const stations: StationConfig[] = [createStation(1)];
            const result = analyzeBufferNeeds(stations, [], [], 0);
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it('handles single station (no recommendations)', () => {
            const stations: StationConfig[] = [createStation(1)];
            const tasks: Task[] = [createTask('T1', 48)];
            const assignments: Assignment[] = [createAssignment(1, 'T1')];

            const result = analyzeBufferNeeds(stations, tasks, assignments, TAKT_TIME);

            // Only 1 station = no transitions = no buffer recommendations
            expect(result.recommendations).toHaveLength(0);
        });
    });
});

// =============================================================================
// CONSTANTS VALIDATION
// =============================================================================

describe('Buffer Logic Constants', () => {
    it('has correct threshold values', () => {
        expect(FRAGILE_LINE_EFFICIENCY_THRESHOLD).toBe(0.90);
        expect(CRITICAL_SATURATION_THRESHOLD).toBe(0.92);
        expect(HIGH_SATURATION_THRESHOLD).toBe(0.85);
        expect(BUFFER_SIZE_CRITICAL).toBe(2);
        expect(BUFFER_SIZE_STANDARD).toBe(1);
    });

    it('thresholds are in correct order', () => {
        expect(HIGH_SATURATION_THRESHOLD).toBeLessThan(CRITICAL_SATURATION_THRESHOLD);
        expect(CRITICAL_SATURATION_THRESHOLD).toBeLessThan(1);
    });
});
