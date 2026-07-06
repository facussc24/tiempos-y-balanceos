/**
 * Regresión del fix de cavidades del export VW Gate 3 (2026-07).
 *
 * Bug: el adapter `buildGate3FromProjectData` alimentaba `cycleTimeSec` con el tiempo
 * POR PIEZA de la estación de inyección (times[] se normaliza dividiendo por
 * cycleQuantity = cavidades en utils/graph.ts → standardTime queda por-pieza), mientras
 * la fórmula VW (CapacitySFN!G12) multiplica cavidades como factor aparte. Resultado:
 * capacidad reportada inflada × cavidades. Ref: docs/TODO_GATE3_INVESTIGAR.md.
 *
 * El fix convierte el ciclo por-pieza al ciclo COMPLETO DEL MOLDE (× cavidades) antes de
 * exportar, de modo que la fórmula VW da la capacidad real.
 */
import { describe, it, expect } from 'vitest';
import { buildGate3FromProjectData } from '../modules/gate3/gate3FromBalancing';
import { calcWeeklyCapacity } from '../core/gate3/calculations';
import type { ProjectData } from '../types';

/** Proyecto mínimo: una estación de inyección (Inserto Delantero, molde 60s, 4 cavidades). */
function injectionProject(): ProjectData {
    return {
        meta: {
            name: 'Inserto Delantero',
            date: '2026-07-06',
            client: 'VWA',
            version: '1.0.0',
            engineer: 'Test',
            activeShifts: 3,
            manualOEE: 0.85,
            useManualOEE: true,
            dailyDemand: 1400,
            configuredStations: 1,
        },
        shifts: [
            { id: 1, name: 'T1', startTime: '06:00', endTime: '11:00', breaks: [] },
            { id: 2, name: 'T2', startTime: '11:00', endTime: '16:00', breaks: [] },
            { id: 3, name: 'T3', startTime: '16:00', endTime: '21:00', breaks: [] },
        ],
        sectors: [{ id: 'INY', name: 'Inyeccion', color: '#000000' }],
        tasks: [
            {
                id: 'OP-INY',
                description: 'Inyeccion Inserto Delantero',
                times: [60, 60],
                // standardTime = tiempo POR PIEZA (60 de molde / 4 cavidades), tal como lo
                // deja calculateTaskWeights tras normalizar por cycleQuantity = 4.
                averageTime: 15,
                standardTime: 15,
                cycleQuantity: 4,
                ratingFactor: 100,
                fatigueCategory: 'standard',
                predecessors: [],
                successors: [],
                positionalWeight: 0,
                calculatedSuccessorSum: 0,
                sectorId: 'INY',
                executionMode: 'injection',
                injectionParams: {
                    productionVolume: 1400,
                    investmentRatio: 0,
                    optimalCavities: 4,
                    realCycle: 15,
                },
            },
        ],
        assignments: [{ stationId: 1, taskId: 'OP-INY' }],
        stationConfigs: [{ id: 1, name: 'Inyectora 750T', oeeTarget: 0.85 }],
    } as ProjectData;
}

describe('Gate3 export — cavidades no se cuentan dos veces (fix 2026-07)', () => {
    it('cycleTimeSec es el ciclo COMPLETO del molde (60s), no el por-pieza (15s)', () => {
        const g = buildGate3FromProjectData(injectionProject());
        const st = g.stations[0];
        expect(st.processType).toBe('inyeccion');
        expect(st.cavities).toBe(4);
        // Sin el fix daría 15 (por-pieza) → la fórmula VW lo multiplicaría por 4 otra vez.
        expect(st.cycleTimeSec).toBe(60);
    });

    it('la capacidad semanal NO queda inflada × cavidades', () => {
        const g = buildGate3FromProjectData(injectionProject());
        const st = { ...g.stations[0], shiftsPerWeek: 15, hoursPerShift: 5, reservationPct: 1, machines: 1 };
        // 15 turnos × 5h × 3600 / 60 × 0.85 × 4 cav = 4500 × 0.85 × 4 = 15.300 (NO 61.200)
        expect(Math.round(calcWeeklyCapacity(st, 0.85))).toBe(15300);
    });

    it('location = Hurlingham (no Zarate)', () => {
        expect(buildGate3FromProjectData(injectionProject()).location).toBe('Hurlingham, Buenos Aires, Argentina');
    });
});
