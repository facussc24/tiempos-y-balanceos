import { describe, it, expect } from 'vitest';
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task, Shift } from '../types';

describe('RALBP-2 Complex: Injection with Internal Task & Multi-Manning', () => {
    const mockShift: Shift = {
        id: 1,
        name: "Turno Único",
        startTime: "08:00",
        endTime: "16:00",
        breaks: []
    };

    // Escenario Complejo: T1 → T2 (internal) → INJ → T3 → T4 → T5
    const tasks: Task[] = [
        {
            id: 'T1',
            description: 'Carga Cavidad',
            times: [25],
            averageTime: 25,
            standardTime: 25,
            ratingFactor: 100,
            fatigueCategory: 'none',
            predecessors: [],
            successors: ['T2'],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual'
        },
        {
            id: 'T2',
            description: 'Ajuste Interno (durante curado)',
            times: [15],
            averageTime: 15,
            standardTime: 15,
            ratingFactor: 100,
            fatigueCategory: 'none',
            predecessors: ['T1'],
            successors: ['INJ'],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual',
            isMachineInternal: true,  // Absorbed during cure time
            concurrentWith: 'INJ'
        },
        {
            id: 'INJ',
            description: 'Inyección PU',
            times: [210],
            averageTime: 210,
            standardTime: 210,
            ratingFactor: 100,
            fatigueCategory: 'none',
            predecessors: ['T2'],
            successors: ['T3'],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'injection',
            cycleQuantity: 3  // 3 cavities → TCR = 210/3 = 70s
        },
        {
            id: 'T3',
            description: 'Descarga',
            times: [30],
            averageTime: 30,
            standardTime: 30,
            ratingFactor: 100,
            fatigueCategory: 'none',
            predecessors: ['INJ'],
            successors: ['T4'],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual'
        },
        {
            id: 'T4',
            description: 'Inspección',
            times: [20],
            averageTime: 20,
            standardTime: 20,
            ratingFactor: 100,
            fatigueCategory: 'none',
            predecessors: ['T3'],
            successors: ['T5'],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual'
        },
        {
            id: 'T5',
            description: 'Embalaje',
            times: [20],
            averageTime: 20,
            standardTime: 20,
            ratingFactor: 100,
            fatigueCategory: 'none',
            predecessors: ['T4'],
            successors: [],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual'
        }
    ];

    const projectData: ProjectData = {
        meta: {
            name: 'RALBP-2 Complex',
            date: '2025-12-07',
            client: 'Test',
            version: '1.0',
            engineer: 'QA',
            activeShifts: 1,
            manualOEE: 1.0,
            useManualOEE: true,
            dailyDemand: 300,  // 300 units
            configuredStations: 0
        },
        shifts: [mockShift],
        sectors: [],
        tasks: tasks,
        assignments: [],
        stationConfigs: []
    };

    // Theoretical calculations
    const Tp = 27000; // 7.5 hours
    const P = 300; // units
    const Creq = Tp / P; // 90 seconds/unit
    const Tcurado = 210; // seconds
    const minCavities = Math.ceil(Tcurado / Creq); // ceil(210/90) = 3
    const TCRmaquina = Tcurado / 3; // 70 seconds
    const manualExternalWork = 25 + 30 + 20 + 20; // T1 + T3 + T4 + T5 = 95s
    const minOperators = Math.ceil(manualExternalWork / TCRmaquina); // ceil(95/70) = 2
    const totalContableWork = Tcurado + manualExternalWork; // 210 + 95 = 305s
    const expectedEfficiency = (totalContableWork / (minOperators * Creq)) * 100; // (305 / (2 * 90)) * 100 = 169.44%

    it('debe calcular correctamente los parámetros teóricos', () => {
        expect(Creq).toBe(90);
        expect(minCavities).toBe(3);
        expect(TCRmaquina).toBe(70);
        expect(manualExternalWork).toBe(95);
        expect(minOperators).toBe(2);
        expect(totalContableWork).toBe(305);
        expect(expectedEfficiency).toBeCloseTo(169.44, 1);
    });

    it('debe agrupar TODAS las tareas (T1, T2, T3, T4, T5, INJ) en 1 estación', () => {
        const result = simulateBalance(projectData, 'RPW', 'RALBP-2 Complex', Creq, Creq);

        // Debug
        console.log('\n=== ASIGNACIONES ===');
        result.assignments.forEach(a => {
            const task = tasks.find(t => t.id === a.taskId);
            console.log(`${a.taskId}: Estación ${a.stationId} (${task?.executionMode})`);
        });
        console.log(`Estaciones totales: ${result.stationsCount}`);

        const injStation = result.assignments.find(a => a.taskId === 'INJ')?.stationId;
        const t1Station = result.assignments.find(a => a.taskId === 'T1')?.stationId;
        const t2Station = result.assignments.find(a => a.taskId === 'T2')?.stationId;
        const t3Station = result.assignments.find(a => a.taskId === 'T3')?.stationId;
        const t4Station = result.assignments.find(a => a.taskId === 'T4')?.stationId;
        const t5Station = result.assignments.find(a => a.taskId === 'T5')?.stationId;

        // All tasks must be in the same station as INJ
        expect(injStation).toBeDefined();
        expect(t1Station).toBe(injStation); // Predecessor
        expect(t2Station).toBe(injStation); // Predecessor (internal)
        expect(t3Station).toBe(injStation); // Successor
        expect(t4Station).toBe(injStation); // Successor
        expect(t5Station).toBe(injStation); // Successor

        // Should be exactly 1 station
        expect(result.stationsCount).toBe(1);
    });

    it('debe excluir T2 (tarea interna) del cálculo de eficiencia', () => {
        const result = simulateBalance(projectData, 'RPW', 'RALBP-2 Complex', Creq, Creq);

        // Efficiency calculation should use:
        // - Curado: 210s (INJ)
        // - Manual External: 95s (T1 + T3 + T4 + T5)
        // - Total: 305s
        // - With 1 operator (default): 305 / (1 * 90) = 338.89%
        // (Note: System won't auto-assign operators, this validates formula excludes T2)

        // PHASE 25: Efficiency (Cumplimiento) = Takt/TCR when TCR > Takt
        // TCR = 152.5s (from 305s work / 2 headcount), Takt = 90s
        // Since TCR (152.5) > Takt (90), efficiency = 90/152.5 ≈ 59%
        expect(result.efficiency).toBeCloseTo(59, 0);
    });
});
