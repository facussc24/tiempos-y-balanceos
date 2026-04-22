/**
 * Unit tests para las funciones puras de metricas de balanceo.
 * Extraidas de BalancingMetrics.tsx en Fase 1 #8.
 */
import { describe, it, expect } from 'vitest';
import {
    calculateSmoothnessIndex,
    calculateFeasibilityStatus,
    calculateTheoreticalMinHeadcount,
    getStationTimeStats,
} from '../modules/balancing/balancingMetricsCalc';
import type { SimStation } from '../core/balancing/engine';

const makeStation = (overrides: Partial<SimStation>): SimStation => ({
    id: 1,
    tasks: [],
    effectiveTime: 0,
    limit: 0,
    replicas: 1,
    ...overrides,
});

describe('calculateSmoothnessIndex', () => {
    it('devuelve 0 cuando no hay estaciones', () => {
        expect(calculateSmoothnessIndex([])).toBe(0);
    });

    it('devuelve 0 si todas las estaciones tienen el mismo tiempo (carga perfecta)', () => {
        const stations = [30, 30, 30, 30].map((t, i) => makeStation({ id: i, effectiveTime: t }));
        expect(calculateSmoothnessIndex(stations)).toBe(0);
    });

    it('calcula sqrt(sum((Tmax-Ti)^2)) correctamente', () => {
        // Tmax = 60, diffs = [0, 20, 30] -> sqrt(0 + 400 + 900) = sqrt(1300)
        const stations = [60, 40, 30].map((t, i) => makeStation({ id: i, effectiveTime: t }));
        expect(calculateSmoothnessIndex(stations)).toBeCloseTo(Math.sqrt(1300), 5);
    });

    it('ignora NaN/Infinity defensivamente', () => {
        const stations = [
            makeStation({ id: 1, effectiveTime: 50 }),
            makeStation({ id: 2, effectiveTime: NaN }),
            makeStation({ id: 3, effectiveTime: Infinity }),
            makeStation({ id: 4, effectiveTime: 20 }),
        ];
        // Tmax = 50, diffs validos = [0, 30] -> sqrt(900) = 30
        expect(calculateSmoothnessIndex(stations)).toBe(30);
    });

    it('devuelve 0 si todos los tiempos son invalidos', () => {
        const stations = [
            makeStation({ id: 1, effectiveTime: NaN }),
            makeStation({ id: 2, effectiveTime: Infinity }),
        ];
        expect(calculateSmoothnessIndex(stations)).toBe(0);
    });
});

describe('calculateFeasibilityStatus', () => {
    it('Factible cuando el ciclo real cumple el Takt', () => {
        expect(calculateFeasibilityStatus(50, 60)).toBe('Factible');
        expect(calculateFeasibilityStatus(60, 60)).toBe('Factible');
    });

    it('Riesgo cuando excede Takt pero <= 5% sobre', () => {
        expect(calculateFeasibilityStatus(61, 60)).toBe('Riesgo');
        expect(calculateFeasibilityStatus(63, 60)).toBe('Riesgo'); // ratio 1.05 exacto
    });

    it('No Factible cuando ratio > 1.05', () => {
        expect(calculateFeasibilityStatus(64, 60)).toBe('No Factible');
        expect(calculateFeasibilityStatus(100, 60)).toBe('No Factible');
    });

    it('Factible por convencion si Takt nominal es 0 (proyecto sin demanda)', () => {
        expect(calculateFeasibilityStatus(100, 0)).toBe('Factible');
        expect(calculateFeasibilityStatus(100, -5)).toBe('Factible');
    });
});

describe('calculateTheoreticalMinHeadcount', () => {
    it('redondea hacia arriba: 200s de trabajo / 60s takt = 4 operarios', () => {
        expect(calculateTheoreticalMinHeadcount(200, 60)).toBe(4);
    });

    it('trabajo exacto no agrega operario extra: 180s / 60s = 3', () => {
        expect(calculateTheoreticalMinHeadcount(180, 60)).toBe(3);
    });

    it('devuelve 0 si Takt es 0 (evita division por cero)', () => {
        expect(calculateTheoreticalMinHeadcount(100, 0)).toBe(0);
    });

    it('trabajo 0 devuelve 0', () => {
        expect(calculateTheoreticalMinHeadcount(0, 60)).toBe(0);
    });
});

describe('getStationTimeStats', () => {
    it('min/max correctos con mix de tiempos', () => {
        const stations = [10, 50, 30].map((t, i) => makeStation({ id: i, effectiveTime: t }));
        expect(getStationTimeStats(stations)).toEqual({ min: 10, max: 50, validCount: 3 });
    });

    it('filtra NaN/Infinity del calculo', () => {
        const stations = [
            makeStation({ id: 1, effectiveTime: 20 }),
            makeStation({ id: 2, effectiveTime: NaN }),
            makeStation({ id: 3, effectiveTime: 50 }),
        ];
        expect(getStationTimeStats(stations)).toEqual({ min: 20, max: 50, validCount: 2 });
    });

    it('devuelve zeros con array vacio o todo invalido', () => {
        expect(getStationTimeStats([])).toEqual({ min: 0, max: 0, validCount: 0 });
        expect(
            getStationTimeStats([makeStation({ id: 1, effectiveTime: NaN })]),
        ).toEqual({ min: 0, max: 0, validCount: 0 });
    });
});
