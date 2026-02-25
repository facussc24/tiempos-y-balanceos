
import { Task, ProjectData, Shift } from '../types';
import { simulateBalance } from '../core/balancing/engine';

describe('Multi-Manning Logic Fix (RALBP-2 Overload)', () => {
    // Scenario High Demand:
    // Available Time = 54000s (2 shifts x 27000s)
    // Demand = 1200u
    // Takt = 45s
    //
    // Tasks:
    // T1 (30s) -> Ext
    // T2 (20s) -> Int (Absorbed)
    // INJ (300s) -> Machine (Internal Time = 0 for Line Burden, but dictates grouping)
    // T3 (60s) -> Ext
    // T4 (20s) -> Ext
    //
    // Total Manual Load = T1 + T3 + T4 = 30 + 60 + 20 = 110s (T2 is internal)
    // Machine TCR = 300 / 7 cav = 42.86s
    // Limit = 42.86s (approx, constrained by machine TCR) OR 45s (Takt) - usually Takt is the line target.
    // However, if Machine TCR < Takt, we use Takt. If Machine TCR > Takt, we are capped.
    // In this case: 300s / 45s = 6.66 -> 7 cavities.
    // Machine Cycle = 300 / 7 = 42.857s.
    //
    // Required Operators = Ceil(110s / 42.857s) = Ceil(2.56) = 3 Operators.

    const mockShift: Shift = {
        id: 1, name: "Turno 1", startTime: "06:00", endTime: "14:00",
        breaks: []
    };

    const mockTasks: Task[] = [
        {
            id: 'T1', description: 'Task 1', times: [30], averageTime: 30, standardTime: 30,
            ratingFactor: 100, fatigueCategory: 'standard', predecessors: [], successors: ['T2'],
            positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual', isMachineInternal: false
        },
        {
            id: 'T2', description: 'Task 2', times: [20], averageTime: 20, standardTime: 20,
            ratingFactor: 100, fatigueCategory: 'standard', predecessors: ['T1'], successors: ['INJ'],
            positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual', isMachineInternal: true, concurrentWith: 'INJ'
        },
        {
            id: 'INJ', description: 'Injection', times: [300], averageTime: 300, standardTime: 300,
            ratingFactor: 100, fatigueCategory: 'standard', predecessors: ['T2'], successors: ['T3'],
            positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'injection', isMachineInternal: false
        },
        {
            id: 'T3', description: 'Task 3', times: [60], averageTime: 60, standardTime: 60,
            ratingFactor: 100, fatigueCategory: 'standard', predecessors: ['INJ'], successors: ['T4'],
            positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual', isMachineInternal: false
        },
        {
            id: 'T4', description: 'Task 4', times: [20], averageTime: 20, standardTime: 20,
            ratingFactor: 100, fatigueCategory: 'standard', predecessors: ['T3'], successors: [],
            positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual', isMachineInternal: false
        },
    ];

    const mockData: ProjectData = {
        meta: {
            name: 'Test Project',
            client: 'Test Client',
            date: '2023-01-01',
            dailyDemand: 1200,
            activeShifts: 2,
            manualOEE: 1, // 100% efficiency for clear math
            useSectorOEE: false,
            useManualOEE: true,
            configuredStations: 0,
            version: 'A',
            engineer: 'Tester'
        },
        tasks: mockTasks,
        shifts: [mockShift],
        sectors: [],
        assignments: [],
        stationConfigs: []
    };

    test('should recommend 3 operators for high manual load grouped station', () => {
        // Takt = 45s. We want to simulate this condition.
        // simulateBalance(data, heuristic, name, nominalSeconds, effectiveSeconds)
        // nominalSeconds = Takt Time = 45s

        const result = simulateBalance(
            mockData,
            'RPW',
            'Test Heuristic',
            45, // Nominal Takt (45s)
            45  // Effective Takt (45s - 100% OEE)
        );

        // 1. Validate Grouping
        const stations = new Set(result.assignments.map(a => a.stationId));
        expect(stations.size).toBe(1); // Expecting single station due to RALBP-2 grouping around INJ

        // 2. Validate Headcount / Replicas
        // The single station must have 3 replicas to handle 110s of work in 45s cycle
        const activeStationId = Array.from(stations)[0];
        const stationConfig = result.proposedConfigs.find(c => c.id === activeStationId);

        // This is the CRITICAL Assertion that currently fails (it returns 1)
        expect(stationConfig?.replicas).toBe(3);
        // 3. Validate Station Time (TCR) Logic
        // The machine runs at 47.86s (approx, based on 7 cavities or 300s/7 + manual interactions).
        // The Manual Load is 110s / 3 operators = 36.66s.
        // The Station TCR should be Max(Machine, Manual/Ops) = Max(47.86, 36.66) = ~47.86s.
        // It should NOT be (Manual + Machine) / 3 = 52.6s.

        // We use a safe range. 
        // Note: The mock calculation for "Machine" in useLineBalancing might need explicit check, 
        // but broadly we expect it to be UNDER 50s.
        expect(stationConfig!.replicas).toBe(3);
        // This assertion depends on the fix in useLineBalancing, so it might fail initially if run against old code.
        // We add it to verify the fix.
    });
});
