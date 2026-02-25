import { describe, it, expect } from 'vitest';
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task, Shift } from '../types';

describe('RALBP-2 Scenario 3: Deep Injection (Verification)', () => {
    // A. Datos de Entrada
    // Tp = 27000, P = 450
    // Creq = 27000 / 450 = 60s

    // B. Tareas
    // T1(30) -> T2(35) -> T3(40) -> T4(15, Int) -> INJ(300) -> T5(10) -> T6(5)

    const tasks: Task[] = [
        {
            id: 'T1', description: 'Manual Ext 1', executionMode: 'manual',
            times: [30], averageTime: 30, standardTime: 30, predecessors: [], successors: ['T2'],
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        },
        {
            id: 'T2', description: 'Manual Ext 2', executionMode: 'manual',
            times: [35], averageTime: 35, standardTime: 35, predecessors: ['T1'], successors: ['T3'],
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        },
        {
            id: 'T3', description: 'Manual Ext 3', executionMode: 'manual',
            times: [40], averageTime: 40, standardTime: 40, predecessors: ['T2'], successors: ['T4'],
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        },
        {
            id: 'T4', description: 'Manual Int (Absorbed)', executionMode: 'manual',
            times: [15], averageTime: 15, standardTime: 15, predecessors: ['T3'], successors: ['INJ'],
            isMachineInternal: true, concurrentWith: 'INJ',
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        },
        {
            id: 'INJ', description: 'Injection Deep', executionMode: 'injection',
            times: [300], averageTime: 300, standardTime: 300, predecessors: ['T4'], successors: ['T5'],
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        },
        {
            id: 'T5', description: 'Manual Ext 4', executionMode: 'manual',
            times: [10], averageTime: 10, standardTime: 10, predecessors: ['INJ'], successors: ['T6'],
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        },
        {
            id: 'T6', description: 'Manual Ext 5', executionMode: 'manual',
            times: [5], averageTime: 5, standardTime: 5, predecessors: ['T5'], successors: [],
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        }
    ];

    const mockShift: Shift = {
        id: 1, name: "Turno Estándar", startTime: "08:00", endTime: "16:00", breaks: [],
        plannedMinutes: 450, // 27000 seconds
        performanceFactor: 1.0
    };

    const projectData: ProjectData = {
        meta: {
            name: 'Scenario 3', date: '2025-12-07', client: 'Validation', version: '1.0', engineer: 'AI',
            activeShifts: 1, manualOEE: 1.0, useManualOEE: true, dailyDemand: 450, configuredStations: 0
        },
        shifts: [mockShift], sectors: [], tasks: tasks, assignments: [], stationConfigs: []
    };

    // Theoretical Calculations
    const Tp = 27000;
    const P = 450;
    const Creq = Tp / P; // 60s
    // Cavity calc done in UI usually, but simulateBalance might use nominalSeconds if provided correctly
    // Actually simulateBalance takes nominalSeconds as input.
    // For this test, we simulate the "inputs" that the UI would calculate.

    // T_cure = 300. Creq = 60. MinCavs = 300/60 = 5.
    // TCR_machine = 300/5 = 60s.
    // We pass Creq (60) as the target cycle time to simulateBalance.

    it('debe calcular y reportar los valores correctos para Escenario 3', () => {
        // Run simulation with Cycle Time = 60s
        const result = simulateBalance(projectData, 'RPW', 'Scenario 3', Creq, Creq);

        // 1. Grouping verification
        const stationIds = new Set(result.assignments.map(a => a.stationId));
        const injAssignment = result.assignments.find(a => a.taskId === 'INJ');
        const targetStation = injAssignment?.stationId;

        console.log('\n--- REPORT VALUES ---');
        console.log(`C_req (Input): ${Creq}`);
        console.log(`Station Count: ${result.stationsCount}`);
        console.log(`Headcount (N_op): ${result.totalHeadcount}`);
        console.log(`Efficiency (E): ${result.efficiency.toFixed(2)}%`);
        console.log(`Assignments:`);
        result.assignments.forEach(a => {
            console.log(`  ${a.taskId} -> Station ${a.stationId}`);
        });

        // Verify Grouping
        expect(result.stationsCount).toBe(1); // Should all be pulled into 1 station
        result.assignments.forEach(a => {
            expect(a.stationId).toBe(targetStation);
        });

        // Verify Manual Work Calculation (Internal T4 excluded?)
        // Manual External = 30+35+40+10+5 = 120s.
        // Station Load (from simulateBalance logic) should be 120s (if T4 is excluded correctly).
        // Let's manually sum the "standardTime" of tasks in the station excluding internal
        // NOTE: Our simulateBalance efficiency logic NOW excludes internal tasks from the "Work" sum.
        // Total Contabilizable Work for Efficiency = ManualExternal + Machine?
        // Wait, balancingUtils code:
        // const stManualWork = stTasks.reduce((sum, t) => {
        //    if (t.isMachineInternal) return sum;
        //    return sum + t.standardTime;
        // }, 0);
        // So totalEffWork calculated by code is ONLY Manual External (120s) OR does it include Machine?
        // Code check:
        // if (t.isMachineInternal) return sum;
        // return sum + (t.standardTime || ...);
        // If INJ is 'injection', it is NOT 'isMachineInternal' (usually false for the machine itself).
        // So INJ time (300) IS included in stManualWork sum in the current code?
        // Let's check the task definition: INJ has executionMode 'injection'. isMachineInternal defaults false.
        // So code sums 120 (Manual) + 300 (INJ) = 420.
        // Then Efficiency = 420 / (Headcount * 60).

        // Headcount Expected:
        // Manual Work = 120s. Machine TCR = 60s.
        // Headcount should be determined by Max(TaskTime, ManualSum) vs Limit?
        // The greedy algorithm assigns tasks.
        // Station Limit is 60s.
        // INJ is 300s. It fits with replicas?
        // We DISABLED auto-replicas for injection. So INJ gets replicas=1.
        // Manual tasks (120s total) are also assigned to this station.
        // Total Station Time (effective) = 300 + 120 = 420s ??
        // Note: Graph is linear. T1..T3 -> T4 -> INJ -> T5..T6.
        // They are all sequential essentially.
        // Can they parallelize? No, strictly sequential in this list.
        // So Station Cycle Time = Sum(Times) = 420s.
        // Assigned to 1 operator (Headcount=1).
        // Actual Cycle = 420s.
        // Required Cycle = 60s.
        // We are massively overloaded.
        // Recommended Headcount logic (alert) should say: 420 / 60 = 7 operators?
        // Wait. User formula for N_op_min:
        // N_op_min = Ceil( Sum Manual External / TCR_machine ) ??
        // User said: N_op_min = Ceil( 120 / 60 ) = 2.
        // Why divide by TCR_machine (60)?
        // Because "Manual load must meet Machine TCR".
        // This implies the 2 operators ONLY do the manual work?
        // And the machine runs "automatically"?
        // If the machine is automatic (300s, 5 cavities -> 60s cycle), it doesn't need an operator for 300s.
        // It needs an operator for Loading/Unloading/Service.
        // INJ task in our model: usually represents the "Service" time if Setup, or the "Machine" time?
        // If INJ is 300s "Curing", effectively it's 0s operator time if automatic.
        // But in our `simulateBalance` code, we are summing `t.standardTime` for INJ into `totalEffWork`.
        // IF INJ is automatic, we should probably NOT include it in Operator Work load?
        // Discrepancy:
        // User says: "Efficiency = (Sum Accountable) / ...". Accountable includes Curado.
        // So User wants us to count 300s in the numerator.
        // But for N_op_min, user says "Sum Manual External / TCR". (120/60 = 2).
        // If N_op_min = 2.
        // And E = 420 / (2 * 60) = 3.5.
        // Our code will calculate:
        // Work = 300 (INJ) + 120 (Manual) = 420.
        // Headcount = 1 (Since we forced replicas=1).
        // Efficiency = 420 / (1 * 60) = 7.0 (700%).
        // This is what the code will output currently.

        // Verification:
        // The user asks "Does the alert show N_op_min?".
        // If our efficiency is 700%, the alert will definitely show.
        // But will it recommend 2 operators or 7?
        // OverloadRecommendation logic (in StationCard, not tested here, but we can verify calculation).
        // Recommendation is usually: `Math.ceil(StationWork / Takt)`.
        // If StationWork = 420, Takt = 60. Recommendation = 7.
        // BUT user formulation implies Machine Time shouldn't count for OP requirement if it's auto.
        // If INJ is "Machine" mode, does it consume Operator Time?
        // In `simulateBalance`, we sum it:
        // `if (t.isMachineInternal) return sum; return sum + t.standardTime;`
        // We do NOT check `t.executionMode === 'injection'`.
        // So we currently treat Injection as Operator Work.
        // THIS MAY BE WRONG based on "N_op_min = 2" expectation.
        // If N_op_min=2, then only 120s is Operator Work.
        // 300s is Machine Work.
        // If so, INJ should NOT contribute to totalEffWork for Headcount calculation.
        // BUT it IS contributing to Efficiency numerator ("Tareas contabilizables").

        // Paradox:
        // Efficiency Numerator = 300 + 120 = 420.
        // Operator Requirement = 120 / 60 = 2.
        // Denominator = 2 * 60 = 120.
        // 420 / 120 = 350%.

        // Current Code Behavior:
        // Work = 420.
        // Headcount = 1.
        // Eff = 700%.
        // Recommendation = 420/60 = 7 operators.

        // If I strictly follow the user's N_op_min formula (Sum Manual / TCR), I need to know if the code distinguishes Manual vs Machine for Load.
        // User prompts verify: "Total Manual External Work... N_op_min... Efficiency".
        // I will report what the system calculates. If it calculates 7 operators, I will report 7.
        // If the user expects 2, then the logic "Injection counts as Operator Work" is what they might want to change, OR they configured INJ wrong (maybe time should be 0 and Curing is separate?).
        // But INJ is 300 tasks.

        // Let's rely on what the code DOES now, which has been validated to match "Efficiency needs to include Machine Time" (Phase 24 fix).
        // Phase 24 fix said: "User requires Line Efficiency... So Machine Time IS included."
        // So Work = 420 is correct for E.
        // But for N_op_min?
        // If N_op_min is based on "Station Load", then it's 7.
        // If User expects 2, they implicitly want to exclude Machine from "Operator Load" but include in "Efficiency Work".
        // Our `detectOverloadAndRecommend` function (which I can't check easily right now without reading `StationCard` or `balancingUtils` import) likely uses the same `effectiveTime` (420).

        // I will adhere to accurately reporting the test results.
        // I'll add logs to see exactly what `totalEffWork` is and if I can separate Manual from Total in the test.
    });
});
