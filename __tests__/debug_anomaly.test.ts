import { describe, it, expect } from 'vitest';
import { ProjectData, Task, Shift } from '../types';
import { simulateBalance } from '../core/balancing/engine';
import { calculateTaktTime } from '../core/balancing/simulation';

describe('Debug: Optimization Anomaly (User Report)', () => {

    // DATA FROM IMAGES
    // Demand: 1600
    // OEE: 90% (0.9)
    // Shift: 1 Turno (We assume standard 8h or calculated to match Takt 18s)
    // Tasks:
    // 1. Refilado: 9.75s
    // 2. Costura unión: 18.00s
    // 3. Costura vista: 18.75s
    // Total Work: 46.5s

    // Target Takt: 18.00s.
    // Expected Stations: 46.5 / 18 = 2.58 -> 3 Stations.
    // User Reported: 1 Station (Efficiency 100%, Idle 8.25s).

    // Reverse Engineer User Report:
    // If 1 Station, Cycle = 46.5s.
    // If Efficiency = 100%, then Takt used by algo must be >= 46.5s.
    // Idle 8.25s -> Limit - Cycle = 8.25? -> Limit = 46.5 + 8.25 = 54.75s?

    const mockTasks: Task[] = [
        {
            id: '1',
            description: 'Refilado',
            executionMode: 'manual',
            standardTime: 9.75,
            averageTime: 9.75,
            times: [9.75],
            ratingFactor: 100,
            predecessors: [],
            successors: ['2'],
            positionalWeight: 46.5,
            calculatedSuccessorSum: 0,
            fatigueCategory: 'none'
        },
        {
            id: '2',
            description: 'Costura unión',
            executionMode: 'manual',
            standardTime: 18.00,
            averageTime: 18.00,
            times: [18.00],
            ratingFactor: 100,
            predecessors: ['1'],
            successors: ['3'],
            positionalWeight: 36.75,
            calculatedSuccessorSum: 0,
            fatigueCategory: 'none'
        },
        {
            id: '3',
            description: 'Costura vista',
            executionMode: 'manual',
            standardTime: 18.75,
            averageTime: 18.75,
            times: [18.75],
            ratingFactor: 100,
            predecessors: ['2'],
            successors: [],
            positionalWeight: 18.75,
            calculatedSuccessorSum: 0,
            fatigueCategory: 'none'
        }
    ];

    const mockShift: Shift = {
        id: 1,
        name: 'Turno 1',
        startTime: '06:00',
        endTime: '14:00', // 8h
        breaks: [] // No breaks mentioned, let's assume 0 for clean 480m
    };
    // 8h = 480m = 28800s.
    // Demand 1600.
    // Takt = 28800 / 1600 = 18s. PERFECT MATCH.

    const mockData: ProjectData = {
        meta: {
            name: 'DEBUG',
            dailyDemand: 1600,
            manualOEE: 0.9,
            activeShifts: 1,
            configuredStations: 1,
            useManualOEE: false, // Default from checks
            useSectorOEE: false,
            date: '', version: '', client: '', engineer: ''
        },
        shifts: [mockShift],
        tasks: mockTasks,
        assignments: [],
        sectors: [],
        stationConfigs: []
    };

    it('Should calculate Takt Time correctly as 18s', () => {
        const { nominalSeconds, effectiveSeconds } = calculateTaktTime(
            mockData.shifts,
            mockData.meta.activeShifts,
            mockData.meta.dailyDemand,
            mockData.meta.manualOEE
        );
        expect(nominalSeconds).toBe(18);
        expect(effectiveSeconds).toBeCloseTo(16.2);
    });

    it('Should propose 3 Stations with correct Takt (18s)', () => {
        const { nominalSeconds, effectiveSeconds } = calculateTaktTime(
            mockData.shifts,
            mockData.meta.activeShifts,
            mockData.meta.dailyDemand,
            mockData.meta.manualOEE
        );

        const result = simulateBalance(
            mockData,
            'RPW',
            'Test',
            nominalSeconds,
            effectiveSeconds
        );

        console.log("Result Stations:", result.stationsCount);
        console.log("Result Configs:", JSON.stringify(result.proposedConfigs, null, 2));

        expect(result.stationsCount).toBeGreaterThanOrEqual(3);
    });

    it('Should reproduce the anomaly IF demand is missing (0)', () => {
        // Hypothesis: If Demand is 0, Takt calculation might default or return 0, 
        // and engine might behave oddly if not protected.

        const { nominalSeconds, effectiveSeconds } = calculateTaktTime(
            mockData.shifts,
            mockData.meta.activeShifts,
            0, // DEMAND 0
            mockData.meta.manualOEE
        );

        // nominalSeconds should be 0.

        // If we pass 0 to simulateBalance...
        const result = simulateBalance(
            mockData,
            'RPW',
            'Test',
            nominalSeconds, // 0
            effectiveSeconds // 0
        );

        console.log("Result with 0 Demand:", result.stationsCount);
        // If it handles 0 by defaulting to 1s limit...
        // Tasks (9, 18, 18) > 1s -> each needs replicas?
        // Or if it sees 0 as Infinite?
    });
});
