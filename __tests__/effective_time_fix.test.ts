/**
 * Test de Anti-Regresión: effectiveTime Bug Fix
 * 
 * Verifica que proposedConfigs[i].effectiveTime se calcula correctamente
 * para todas las estaciones, tanto en Caso A (normal) como Caso B (multi-manning).
 */

import { describe, it, expect } from 'vitest';
import { simulateBalance, calculateEffectiveStationTime } from '../core/balancing/engine';
import { ProjectData, Task } from '../types';

const createMinimalProjectData = (tasks: Partial<Task>[]): ProjectData => ({
    meta: {
        name: 'Test',
        date: new Date().toISOString(),
        client: 'Test',
        version: '1.0',
        engineer: 'Test',
        activeShifts: 1,
        manualOEE: 1.0,
        useManualOEE: true,
        dailyDemand: 100,
        configuredStations: 10,
        disableSectorAffinity: true  // Pure SALBP mode for predictable results
    },
    shifts: [{ id: 1, name: 'S1', startTime: '8:00', endTime: '17:00', breaks: [] }],
    sectors: [],
    tasks: tasks.map((t, i) => ({
        id: t.id || `T${i + 1}`,
        description: `Task ${i + 1}`,
        times: [t.standardTime || 10],
        averageTime: t.standardTime || 10,
        standardTime: t.standardTime || 10,
        ratingFactor: 100,
        fatigueCategory: 'none' as const,
        predecessors: t.predecessors || [],
        successors: [],
        positionalWeight: 100 - i,
        calculatedSuccessorSum: 0,
        executionMode: 'manual' as const,
        ...t
    })) as Task[],
    assignments: [],
    stationConfigs: []
});

describe('effectiveTime Bug Fix', () => {

    describe('Caso A: Tareas normales (sin multi-manning)', () => {
        it('debe poblar effectiveTime para todas las estaciones', () => {
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 20, predecessors: [] },
                { id: 'T2', standardTime: 25, predecessors: ['T1'] },
                { id: 'T3', standardTime: 15, predecessors: ['T2'] },
            ]);

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            // Todas las configs deben tener effectiveTime definido
            for (const config of result.proposedConfigs) {
                expect(config.effectiveTime).toBeDefined();
                expect(config.effectiveTime).toBeGreaterThan(0);
            }
        });

        it('la suma de effectiveTimes debe igualar el trabajo total', () => {
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 20, predecessors: [] },
                { id: 'T2', standardTime: 25, predecessors: ['T1'] },
                { id: 'T3', standardTime: 15, predecessors: ['T2'] },
            ]);

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            const totalEffective = result.proposedConfigs.reduce(
                (sum, c) => sum + (c.effectiveTime || 0), 0
            );
            const totalWork = 20 + 25 + 15; // 60

            expect(totalEffective).toBeCloseTo(totalWork, 1);
        });

        it('effectiveTime debe coincidir con cálculo manual desde assignments', () => {
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 28, predecessors: [] },
                { id: 'T2', standardTime: 22, predecessors: [] },
            ]);

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            // Para cada estación, verificar que effectiveTime coincide con la suma de tareas
            for (const config of result.proposedConfigs) {
                const stationTaskIds = result.assignments
                    .filter(a => a.stationId === config.id)
                    .map(a => a.taskId);

                const stationTasks = data.tasks.filter(t => stationTaskIds.includes(t.id));
                const expectedTime = calculateEffectiveStationTime(stationTasks);

                expect(config.effectiveTime).toBeCloseTo(expectedTime, 1);
            }
        });
    });

    describe('Caso B: Tareas con multi-manning', () => {
        it('debe poblar effectiveTime correctamente para estaciones con replicas', () => {
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 100, predecessors: [] }, // > takt de 30
            ]);

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            expect(result.proposedConfigs.length).toBeGreaterThan(0);
            expect(result.proposedConfigs[0].effectiveTime).toBe(100);
            expect(result.proposedConfigs[0].replicas).toBeGreaterThanOrEqual(4); // ceil(100/30) = 4
        });

        it('effectiveTime debe ser el tiempo total, no dividido por replicas', () => {
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 120, predecessors: [] },
            ]);

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            // effectiveTime es el tiempo TOTAL de la estación
            expect(result.proposedConfigs[0].effectiveTime).toBe(120);
            // replicas indica cuántos operadores se necesitan
            expect(result.proposedConfigs[0].replicas).toBeGreaterThanOrEqual(4);
        });
    });

    describe('Integración con Algoritmo Genético', () => {
        it('loads calculados desde effectiveTime deben ser > 0', () => {
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 28, predecessors: [] },
                { id: 'T2', standardTime: 28, predecessors: [] },
                { id: 'T3', standardTime: 10, predecessors: [] },
            ]);

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            // Simular el cálculo que hace geneticAlgorithm.ts:calculateSmoothnessIndex
            const loads = result.proposedConfigs.map(c => c.effectiveTime || 0);

            // Todos los loads deben ser > 0
            for (const load of loads) {
                expect(load).toBeGreaterThan(0);
            }
        });

        it('smoothness debe ser > 0 para distribución desigual', () => {
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 28, predecessors: [] },
                { id: 'T2', standardTime: 28, predecessors: [] },
                { id: 'T3', standardTime: 10, predecessors: [] },
            ]);

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            // Calcular smoothness (stdDev de loads)
            const loads = result.proposedConfigs.map(c => c.effectiveTime || 0);
            const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
            const variance = loads.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / loads.length;
            const stdDev = Math.sqrt(variance);

            // Si hay variación en los tiempos, stdDev debe ser > 0
            // (Este era el bug: stdDev siempre era 0 porque effectiveTime era undefined)
            if (loads.length > 1 && !loads.every(l => l === loads[0])) {
                expect(stdDev).toBeGreaterThan(0);
            }
        });
    });

    describe('Caso C: SALBP-2 con Heijunka Smoothing', () => {
        it('estaciones vacías deben tener effectiveTime = 0 cuando N > tareas', () => {
            // Edge case: 2 tareas pero 5 operadores pedidos
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 20, predecessors: [] },
                { id: 'T2', standardTime: 25, predecessors: ['T1'] },
            ]);
            (data.meta as any).balancingMode = 'SALBP2';
            (data.meta as any).targetOperators = 5;
            (data.meta as any).balancingObjective = 'SMOOTH_WORKLOAD';

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            // Debe haber 5 configs (una por operador solicitado)
            expect(result.proposedConfigs.length).toBe(5);

            // Todas las configs deben tener effectiveTime definido
            for (const config of result.proposedConfigs) {
                expect(config.effectiveTime).toBeDefined();
                expect(typeof config.effectiveTime).toBe('number');
            }

            // Los efectiveTime de estaciones vacías deben ser 0
            const stationsWithTasks = new Set(result.assignments.map(a => a.stationId));
            for (const config of result.proposedConfigs) {
                if (!stationsWithTasks.has(config.id)) {
                    expect(config.effectiveTime).toBe(0);
                }
            }

            // La suma de effectiveTimes debe igualar el trabajo total
            const totalEffective = result.proposedConfigs.reduce(
                (sum, c) => sum + (c.effectiveTime || 0), 0
            );
            expect(totalEffective).toBeCloseTo(20 + 25, 1);
        });

        it('effectiveTime debe coincidir con assignments después del smoothing', () => {
            const data = createMinimalProjectData([
                { id: 'T1', standardTime: 30, predecessors: [] },
                { id: 'T2', standardTime: 30, predecessors: [] },
                { id: 'T3', standardTime: 10, predecessors: [] },
            ]);
            (data.meta as any).balancingMode = 'SALBP2';
            (data.meta as any).targetOperators = 3;
            (data.meta as any).balancingObjective = 'SMOOTH_WORKLOAD';

            const result = simulateBalance(data, 'RPW', 'Test', 30, 30);

            // Verificar que effectiveTime coincide con assignments
            for (const config of result.proposedConfigs) {
                const stationTaskIds = result.assignments
                    .filter(a => a.stationId === config.id)
                    .map(a => a.taskId);
                const stationTasks = data.tasks.filter(t => stationTaskIds.includes(t.id));
                const expectedTime = calculateEffectiveStationTime(stationTasks);
                expect(config.effectiveTime).toBeCloseTo(expectedTime, 1);
            }
        });
    });
});
