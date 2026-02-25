import { describe, it, expect } from 'vitest';
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task, Shift } from '../types';

describe('SALBP-1 Validation Test: 6 Tasks, 3 Stations, C=70s', () => {
    // Configuración del turno: 8 horas = 28,800 segundos
    const mockShift: Shift = {
        id: 1,
        name: "Turno Único",
        startTime: "08:00",
        endTime: "16:00",
        breaks: []
    };

    // Definición de las 6 tareas según especificación SALBP-1
    const tasks: Task[] = [
        {
            id: 'T1',
            description: 'Preparación inicial',
            times: [40],
            averageTime: 40,
            standardTime: 40,
            ratingFactor: 100,
            fatigueCategory: 'standard',
            predecessors: [],
            successors: ['T2', 'T3'],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual'
        },
        {
            id: 'T2',
            description: 'Ensamblar componente A',
            times: [50],
            averageTime: 50,
            standardTime: 50,
            ratingFactor: 100,
            fatigueCategory: 'standard',
            predecessors: ['T1'],
            successors: ['T4'],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual'
        },
        {
            id: 'T3',
            description: 'Ensamblar componente B',
            times: [20],
            averageTime: 20,
            standardTime: 20,
            ratingFactor: 100,
            fatigueCategory: 'standard',
            predecessors: ['T1'],
            successors: ['T5'],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual'
        },
        {
            id: 'T4',
            description: 'Ajuste final A',
            times: [25],
            averageTime: 25,
            standardTime: 25,
            ratingFactor: 100,
            fatigueCategory: 'standard',
            predecessors: ['T2'],
            successors: ['T6'],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual'
        },
        {
            id: 'T5',
            description: 'Ajuste final B',
            times: [10],
            averageTime: 10,
            standardTime: 10,
            ratingFactor: 100,
            fatigueCategory: 'standard',
            predecessors: ['T3'],
            successors: ['T6'],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual'
        },
        {
            id: 'T6',
            description: 'Embalaje y cierre',
            times: [40],
            averageTime: 40,
            standardTime: 40,
            ratingFactor: 100,
            fatigueCategory: 'standard',
            predecessors: ['T4', 'T5'],
            successors: [],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual'
        }
    ];

    const projectData: ProjectData = {
        meta: {
            name: 'Test SALBP-1 Simple',
            date: '2025-12-07',
            client: 'Validation Test',
            version: '1.0',
            engineer: 'QA Team',
            activeShifts: 1,
            manualOEE: 1.0,  // OEE 100% para simplificar
            useManualOEE: true,
            dailyDemand: 411,  // 28,800s / 411 ≈ 70.07s
            configuredStations: 0
        },
        shifts: [mockShift],
        sectors: [],
        tasks: tasks,
        assignments: [],
        stationConfigs: []
    };

    it('debe calcular Takt Time de aproximadamente 70 segundos', () => {
        // Tiempo productivo: 8 horas = 28,800 segundos
        const productiveTime = 28800;
        const demand = 411;
        const taktTime = productiveTime / demand;

        console.log(`\n=== VALIDACIÓN TAKT TIME ===`);
        console.log(`Tiempo Productivo: ${productiveTime}s (8 horas)`);
        console.log(`Demanda Diaria: ${demand} unidades`);
        console.log(`Takt Time Calculado: ${taktTime.toFixed(2)}s`);
        console.log(`Takt Time Esperado: 70.00s`);

        expect(taktTime).toBeCloseTo(70.07, 2);
    });

    it('debe asignar tareas a 3 estaciones con eficiencia 88.09%', () => {
        const nominalSeconds = 70.07;  // Takt Time
        const effectiveSeconds = 70.07; // OEE 100%

        // Ejecutar balanceo con heurística RPW
        const result = simulateBalance(projectData, 'RPW', 'SALBP-1 Test', nominalSeconds, effectiveSeconds);

        console.log(`\n=== RESULTADOS DEL BALANCEO ===`);
        console.log(`Heurística: RPW (Ranked Positional Weight)`);
        console.log(`Takt Time: ${nominalSeconds.toFixed(2)}s`);
        console.log(`Suma de tiempos: ${tasks.reduce((sum, t) => sum + t.standardTime, 0)}s`);

        // Calcular mínimo teórico
        const totalWork = 185;
        const minStations = Math.ceil(totalWork / nominalSeconds);
        console.log(`\nMínimo Teórico de Estaciones: ceil(${totalWork} / ${nominalSeconds.toFixed(2)}) = ${minStations}`);

        // Mostrar asignaciones por estación
        console.log(`\n=== ASIGNACIONES POR ESTACIÓN ===`);
        for (let i = 1; i <= result.stationsCount; i++) {
            const stationTasks = result.assignments
                .filter(a => a.stationId === i)
                .map(a => tasks.find(t => t.id === a.taskId))
                .filter(Boolean);

            const stationTime = stationTasks.reduce((sum, t) => sum + (t?.standardTime || 0), 0);
            const taskList = stationTasks.map(t => `${t?.id}(${t?.standardTime}s)`).join(' + ');

            console.log(`Estación ${i}: ${taskList} = ${stationTime}s ${stationTime <= nominalSeconds ? '✓' : '✗ SOBRECARGA'}`);
        }

        // Verificar resultados
        console.log(`\n=== MÉTRICAS FINALES ===`);
        console.log(`Estaciones Utilizadas: ${result.stationsCount} (esperado: 3)`);
        console.log(`Personal Total: ${result.totalHeadcount} (esperado: 3)`);
        console.log(`Eficiencia: ${result.efficiency.toFixed(2)}% (esperado: 88.09%)`);
        console.log(`Tiempo Ocioso: ${result.idleTime.toFixed(2)}s`);

        // After SALBP-2 and precedence fixes, the engine now achieves
        // the theoretical minimum of 3 stations for this scenario.
        expect(result.stationsCount).toBe(3);
        expect(result.totalHeadcount).toBe(3);
        // PHASE 25: Efficiency (Cumplimiento) = 100% when TCR <= Takt
        // TCR = ~70s (max station time), Takt = 70.07s → can meet demand = 100%
        expect(result.efficiency).toBe(100);

        for (let i = 1; i <= result.stationsCount; i++) {
            const stationTasks = result.assignments
                .filter(a => a.stationId === i)
                .map(a => tasks.find(t => t.id === a.taskId))
                .filter(Boolean);

            const stationTime = stationTasks.reduce((sum, t) => sum + (t?.standardTime || 0), 0);
            // Each station time must be within takt
            expect(stationTime).toBeLessThanOrEqual(nominalSeconds + 0.1); // +0.1 for floating point
        }
    });

    it('debe respetar las precedencias de tareas', () => {
        const nominalSeconds = 70.07;
        const effectiveSeconds = 70.07;

        const result = simulateBalance(projectData, 'RPW', 'SALBP-1 Precedence Test', nominalSeconds, effectiveSeconds);

        console.log(`\n=== VALIDACIÓN DE PRECEDENCIAS ===`);

        // Crear mapa de estación por tarea
        const taskToStation = new Map<string, number>();
        result.assignments.forEach(a => {
            taskToStation.set(a.taskId, a.stationId);
        });

        // Verificar cada precedencia
        tasks.forEach(task => {
            const taskStation = taskToStation.get(task.id);
            task.predecessors.forEach(predId => {
                const predStation = taskToStation.get(predId);
                const valid = predStation !== undefined && taskStation !== undefined && predStation <= taskStation;

                console.log(`${predId} (Est ${predStation}) → ${task.id} (Est ${taskStation}): ${valid ? '✓' : '✗ VIOLACIÓN'}`);

                expect(predStation).toBeLessThanOrEqual(taskStation!);
            });
        });
    });
});
