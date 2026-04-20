/**
 * Tests del modulo Gate 3 — verifican las formulas contra los valores
 * del ejemplo oficial documentado en el template VW Gate_3_Capacity Check.xlsx.
 */

import { describe, expect, it } from 'vitest';
import {
    calcAcceptanceCapacity,
    calcNominatedQuantities,
    calcOEE,
    calcPlannedCapacity,
    calcProtocolResult,
    calcStationResult,
    calcWeeklyCapacity,
    getBottleneck,
} from '../calculations';
import { VW_FLEXIBILITY, VW_WEEKS_PER_YEAR } from '../constants';
import type { Gate3Station, ProtocolSFN1 } from '../types';

const baseStation = (overrides: Partial<Gate3Station> = {}): Gate3Station => ({
    id: 's1',
    name: 'Mesa de corte',
    observationTimeMin: 480,
    cycleTimeSec: 300,
    cavities: 12,
    downtimeMin: 30,
    okParts: 979,
    nokParts: 3,
    shiftsPerWeek: 7.5,
    hoursPerShift: 8,
    reservationPct: 0.14,
    machines: 2,
    ...overrides,
});

describe('calcOEE', () => {
    it('reproduce el ejemplo oficial VW (OEE = 84.98%)', () => {
        const r = calcOEE(baseStation());
        expect(r.targetUnits).toBeCloseTo(1152, 1); // 480*60/300*12
        expect(r.availability).toBeCloseTo(0.9375, 4); // (480-30)/480
        expect(r.performance).toBeCloseTo(0.9093, 3); // 982/1080
        expect(r.quality).toBeCloseTo(0.9969, 3); // 979/982
        expect(r.oee).toBeCloseTo(0.8498, 3);
    });

    it('devuelve 0 sin division por cero cuando cycleTimeSec = 0', () => {
        const r = calcOEE(baseStation({ cycleTimeSec: 0 }));
        expect(r.targetUnits).toBe(0);
        expect(r.performance).toBe(0);
    });

    it('quality = 0 cuando no hay piezas producidas', () => {
        const r = calcOEE(baseStation({ okParts: 0, nokParts: 0 }));
        expect(r.quality).toBe(0);
    });
});

describe('calcWeeklyCapacity', () => {
    it('reproduce capacidad ejemplo VW (~2055.9 piezas/sem con reserva 14%)', () => {
        const s = baseStation();
        const oee = calcOEE(s).oee;
        const weekly = calcWeeklyCapacity(s, oee);
        expect(weekly).toBeCloseTo(2055.9, 0);
    });

    it('devuelve 0 si machines = 0', () => {
        expect(calcWeeklyCapacity(baseStation({ machines: 0 }), 0.85)).toBe(0);
    });

    it('devuelve 0 si cavities = 0', () => {
        expect(calcWeeklyCapacity(baseStation({ cavities: 0 }), 0.85)).toBe(0);
    });

    it('devuelve 0 si OEE = 0', () => {
        expect(calcWeeklyCapacity(baseStation(), 0)).toBe(0);
    });
});

describe('calcStationResult / status semaforo', () => {
    it('GREEN cuando capacidad >= demanda max (normal*1.15)', () => {
        const r = calcStationResult(baseStation(), 1500);
        expect(r.status).toBe('green');
    });

    it('AMBER cuando capacidad esta entre normal y max', () => {
        const r = calcStationResult(baseStation(), 2000); // max=2300, weekly~2055
        expect(r.status).toBe('amber');
    });

    it('RED cuando capacidad < demanda normal', () => {
        const r = calcStationResult(baseStation(), 5000);
        expect(r.status).toBe('red');
    });
});

describe('getBottleneck', () => {
    it('retorna estacion de menor capacidad (>0)', () => {
        const r1 = calcStationResult(baseStation({ id: 'a' }), 1000);
        const r2 = calcStationResult(baseStation({ id: 'b', machines: 1 }), 1000); // mitad de capacidad
        const bn = getBottleneck([r1, r2]);
        expect(bn?.station.id).toBe('b');
    });

    it('null si todas tienen capacidad 0', () => {
        const r = calcStationResult(baseStation({ cycleTimeSec: 0 }), 1000);
        expect(getBottleneck([r])).toBeNull();
    });
});

describe('calcNominatedQuantities', () => {
    it('aplica 48 semanas/anio y 15% flex', () => {
        const r = calcNominatedQuantities(1166);
        expect(r.nominatedAnnual).toBe(1166 * VW_WEEKS_PER_YEAR);
        expect(r.flexAnnual).toBeCloseTo(1166 * 48 * (1 + VW_FLEXIBILITY), 2);
        expect(r.flexWeekly).toBeCloseTo(1166 * (1 + VW_FLEXIBILITY), 4);
    });
});

const baseProtocol = (overrides: Partial<ProtocolSFN1> = {}): ProtocolSFN1 => ({
    nominatedWeekly: 1166,
    acceptanceParts: 280,
    capacityVwGroupPct: 1,
    capacityFamilyPct: 0.20,
    parallelLines: 1,
    minPerShift: 450,
    cycleTimeMinPiece: 1.083,
    rejectRate: 0.02,
    shiftsPerWeek: 15,
    maxShiftsPerWeek: 17,
    plannedOEE: 0.85,
    linesInAcceptance: 1,
    acceptanceDurationMin: 480,
    totalPartsProduced: 1200,
    reworkParts: 0,
    rejectParts: 12,
    includeAvailability: false, // metodo 2 (prueba >= 1 turno)
    ...overrides,
});

describe('calcPlannedCapacity', () => {
    it('reproduce capacidad planificada normal del ejemplo VW (~1038 piezas/sem)', () => {
        const p = baseProtocol();
        expect(calcPlannedCapacity(p, p.shiftsPerWeek)).toBeCloseTo(1038.37, 1);
    });

    it('reproduce capacidad max con turnos maximos (~1176 piezas/sem)', () => {
        const p = baseProtocol();
        expect(calcPlannedCapacity(p, p.maxShiftsPerWeek)).toBeCloseTo(1176.81, 1);
    });

    it('devuelve 0 si cycleTimeMinPiece = 0', () => {
        expect(calcPlannedCapacity(baseProtocol({ cycleTimeMinPiece: 0 }), 15)).toBe(0);
    });
});

describe('calcAcceptanceCapacity', () => {
    it('metodo 2 sin OEE reproduce ejemplo PCA2/3 del doc VW (~13365 piezas/sem)', () => {
        // Valores del ejemplo de la hoja Acceptance_PCA2_3 del template:
        // (1188/1)*1/480*480*15*1*0.75 = 13365
        const p = baseProtocol({
            includeAvailability: false,
            minPerShift: 480,
            capacityFamilyPct: 0.75,
        });
        expect(calcAcceptanceCapacity(p, p.shiftsPerWeek)).toBeCloseTo(13365, 0);
    });

    it('metodo 1 con OEE multiplica por plannedOEE', () => {
        const sinOEE = calcAcceptanceCapacity(
            baseProtocol({ includeAvailability: false, minPerShift: 480, capacityFamilyPct: 0.75 }),
            15,
        );
        const conOEE = calcAcceptanceCapacity(
            baseProtocol({ includeAvailability: true, minPerShift: 480, capacityFamilyPct: 0.75 }),
            15,
        );
        expect(conOEE).toBeCloseTo(sinOEE * 0.85, 2);
    });
});

describe('calcProtocolResult', () => {
    it('arma todo el resultado coherente', () => {
        const r = calcProtocolResult(baseProtocol());
        expect(r.okPartsDirect).toBe(1188); // 1200-0-12
        expect(r.okPartsTotal).toBe(1188);
        expect(r.firstPassRate).toBeCloseTo(0.99, 2);
        expect(r.rejectRate).toBeCloseTo(0.01, 2);
        expect(r.nominatedAnnual).toBe(1166 * 48);
    });
});
