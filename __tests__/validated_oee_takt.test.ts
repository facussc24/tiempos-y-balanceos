/**
 * TESTS VALIDADOS - BLOQUE 3: OEE Y TAKT TIME
 *
 * Fuentes academicas:
 * - Nakajima (1984) "Introduction to TPM" - Formula OEE
 * - Toyota Production System (Monden 1983) - Takt Time
 * - OEE clase mundial: 85% = 90% disponibilidad x 95% rendimiento x 99% calidad
 *
 * Todas las formulas del Bloque 3 fueron verificadas como CORRECTAS.
 * Estos tests validan los calculos con numeros reales de planta.
 */
import { describe, it, expect } from 'vitest';
import {
    calculateTaktTime,
    calculateShiftNetMinutes,
    calculateWeightedLineOEE,
    calculateAdjustedDemand,
} from '../core/balancing/simulation';
import { ProjectData, Sector, Task } from '../types';

// ============================================================================
// Ayudante: crea una tarea minima
// ============================================================================
const crearTarea = (id: string, tiempoEstandar: number, sectorId?: string): Task => ({
    id,
    description: `Tarea ${id}`,
    times: [],
    averageTime: tiempoEstandar,
    standardTime: tiempoEstandar,
    ratingFactor: 100,
    fatigueCategory: 'none',
    predecessors: [],
    successors: [],
    positionalWeight: 0,
    calculatedSuccessorSum: 0,
    executionMode: 'manual',
    sectorId,
});

// ============================================================================
// Ayudante: crea un turno con descansos
// ============================================================================
const crearTurno = (inicio: string, fin: string, descansos: { name: string; duration: number }[]) => ({
    startTime: inicio,
    endTime: fin,
    breaks: descansos,
});

// ============================================================================
// BLOQUE 3A: Takt Time (Toyota / Monden 1983)
// Formula: Takt = Tiempo Disponible / Demanda
// Takt Efectivo = Takt Nominal x OEE
// ============================================================================
describe('Validado: Takt Time (Toyota Production System)', () => {

    it('caso tipico: 1 turno 8h, 50min descanso, 500 pzas, OEE 85%', () => {
        // Disponible = 480 - 30 - 10 - 10 = 430 min
        // Takt nominal = (430 x 60) / 500 = 51.6s
        // Takt efectivo = 51.6 x 0.85 = 43.86s
        const turno = crearTurno('06:00', '14:00', [
            { name: 'Almuerzo', duration: 30 },
            { name: 'Pausa 1', duration: 10 },
            { name: 'Pausa 2', duration: 10 },
        ]);

        const resultado = calculateTaktTime([turno as any], 1, 500, 0.85);

        expect(resultado.totalAvailableMinutes).toBe(430);
        expect(resultado.nominalSeconds).toBeCloseTo(51.6, 1);
        expect(resultado.effectiveSeconds).toBeCloseTo(43.86, 1);
    });

    it('OEE 100%: takt efectivo = takt nominal', () => {
        const turno = crearTurno('08:00', '16:00', []);
        // 480 min, 1000 pzas, OEE 100%
        // Takt = (480 x 60) / 1000 = 28.8s
        const resultado = calculateTaktTime([turno as any], 1, 1000, 1.0);

        expect(resultado.nominalSeconds).toBeCloseTo(28.8, 2);
        expect(resultado.effectiveSeconds).toBeCloseTo(28.8, 2);
    });

    it('demanda 0: retorna 0 sin error (estado valido de UX)', () => {
        const turno = crearTurno('06:00', '14:00', []);
        const resultado = calculateTaktTime([turno as any], 1, 0, 0.85);

        expect(resultado.nominalSeconds).toBe(0);
        expect(resultado.effectiveSeconds).toBe(0);
    });

    it('setup loss 5%: reduce tiempo disponible antes del calculo', () => {
        // 480 min sin descansos, 5% setup loss
        // Neto = 480 x 0.95 = 456 min
        // Takt = (456 x 60) / 1000 = 27.36s
        const turno = crearTurno('06:00', '14:00', []);
        const resultado = calculateTaktTime([turno as any], 1, 1000, 1.0, 0.05);

        expect(resultado.netAvailableMinutes).toBeCloseTo(456, 0);
        expect(resultado.nominalSeconds).toBeCloseTo(27.36, 1);
        expect(resultado.setupLossApplied).toBeCloseTo(0.05, 4);
    });

    it('setup loss > 20% se limita a 20% (tope de seguridad)', () => {
        const turno = crearTurno('06:00', '14:00', []);
        const resultado = calculateTaktTime([turno as any], 1, 1000, 1.0, 0.50);

        // Se limita a 20%: neto = 480 x 0.80 = 384 min
        expect(resultado.setupLossApplied).toBeCloseTo(0.20, 4);
        expect(resultado.netAvailableMinutes).toBeCloseTo(384, 0);
    });

    it('turno nocturno 22:00 a 06:00 con 30min comida', () => {
        const turno = crearTurno('22:00', '06:00', [
            { name: 'Comida', duration: 30 },
        ]);

        // 8h = 480 min - 30 = 450 min
        const minutosNetos = calculateShiftNetMinutes(turno as any);
        expect(minutosNetos).toBe(450);

        const resultado = calculateTaktTime([turno as any], 1, 500, 0.85);
        // Takt = (450 x 60) / 500 = 54s nominal
        expect(resultado.nominalSeconds).toBeCloseTo(54, 1);
    });
});

// ============================================================================
// BLOQUE 3B: OEE Ponderado por Sector
// Formula: OEE_linea = Σ(OEE_sector x peso_sector)
// donde peso = tiempo_estandar_sector / tiempo_total
// ============================================================================
describe('Validado: OEE Ponderado por Sector (Nakajima 1984)', () => {

    it('2 sectores con distinto OEE: ponderado por tiempo', () => {
        // Sector A: OEE 90%, tareas suman 60s (60% del total)
        // Sector B: OEE 80%, tareas suman 40s (40% del total)
        // Ponderado = 0.90 x 0.60 + 0.80 x 0.40 = 0.54 + 0.32 = 0.86
        const datos: Partial<ProjectData> = {
            meta: {
                name: 'Test', date: '', client: '', version: '', engineer: '',
                activeShifts: 1, manualOEE: 0.85, useManualOEE: false,
                useSectorOEE: true,
                dailyDemand: 100, configuredStations: 4,
            } as any,
            sectors: [
                { id: 'sa', name: 'Inyeccion', color: '#ff0000', targetOee: 0.90 },
                { id: 'sb', name: 'Costura', color: '#00ff00', targetOee: 0.80 },
            ],
            tasks: [
                crearTarea('T1', 30, 'sa'),
                crearTarea('T2', 30, 'sa'),
                crearTarea('T3', 25, 'sb'),
                crearTarea('T4', 15, 'sb'),
            ],
            assignments: [],
            stationConfigs: [],
        };

        const oee = calculateWeightedLineOEE(datos as ProjectData);
        expect(oee).toBeCloseTo(0.86, 2);
    });

    it('sin sectores activos: retorna OEE global', () => {
        const datos: Partial<ProjectData> = {
            meta: {
                name: 'Test', date: '', client: '', version: '', engineer: '',
                activeShifts: 1, manualOEE: 0.85, useManualOEE: true,
                useSectorOEE: false,
                dailyDemand: 100, configuredStations: 4,
            } as any,
            sectors: [],
            tasks: [crearTarea('T1', 50)],
            assignments: [],
            stationConfigs: [],
        };

        const oee = calculateWeightedLineOEE(datos as ProjectData);
        expect(oee).toBe(0.85);
    });

    it('sector sin OEE propio: usa OEE global como respaldo', () => {
        // Sector A: OEE 90%, 50s
        // Sector B: sin targetOee (usa global 0.85), 50s
        // Ponderado = 0.90 x 0.50 + 0.85 x 0.50 = 0.45 + 0.425 = 0.875
        const datos: Partial<ProjectData> = {
            meta: {
                name: 'Test', date: '', client: '', version: '', engineer: '',
                activeShifts: 1, manualOEE: 0.85, useManualOEE: false,
                useSectorOEE: true,
                dailyDemand: 100, configuredStations: 4,
            } as any,
            sectors: [
                { id: 'sa', name: 'Inyeccion', color: '#ff0000', targetOee: 0.90 },
                { id: 'sb', name: 'Costura', color: '#00ff00' }, // sin targetOee
            ] as Sector[],
            tasks: [
                crearTarea('T1', 50, 'sa'),
                crearTarea('T2', 50, 'sb'),
            ],
            assignments: [],
            stationConfigs: [],
        };

        const oee = calculateWeightedLineOEE(datos as ProjectData);
        expect(oee).toBeCloseTo(0.875, 3);
    });

    it('tarea sin sector va al grupo "general" (usa OEE global)', () => {
        // Sector A: OEE 90%, 40s
        // Sin sector: 60s (usa global 0.85)
        // Ponderado = 0.90 x 0.40 + 0.85 x 0.60 = 0.36 + 0.51 = 0.87
        const datos: Partial<ProjectData> = {
            meta: {
                name: 'Test', date: '', client: '', version: '', engineer: '',
                activeShifts: 1, manualOEE: 0.85, useManualOEE: false,
                useSectorOEE: true,
                dailyDemand: 100, configuredStations: 4,
            } as any,
            sectors: [
                { id: 'sa', name: 'Inyeccion', color: '#ff0000', targetOee: 0.90 },
            ],
            tasks: [
                crearTarea('T1', 40, 'sa'),
                crearTarea('T2', 60), // sin sectorId
            ],
            assignments: [],
            stationConfigs: [],
        };

        const oee = calculateWeightedLineOEE(datos as ProjectData);
        expect(oee).toBeCloseTo(0.87, 2);
    });

    it('sin tareas: retorna OEE global', () => {
        const datos: Partial<ProjectData> = {
            meta: {
                name: 'Test', date: '', client: '', version: '', engineer: '',
                activeShifts: 1, manualOEE: 0.85, useManualOEE: false,
                useSectorOEE: true,
                dailyDemand: 100, configuredStations: 4,
            } as any,
            sectors: [
                { id: 'sa', name: 'Inyeccion', color: '#ff0000', targetOee: 0.90 },
            ],
            tasks: [],
            assignments: [],
            stationConfigs: [],
        };

        const oee = calculateWeightedLineOEE(datos as ProjectData);
        expect(oee).toBe(0.85);
    });
});

// ============================================================================
// BLOQUE 3C: Constantes OEE (Nakajima 1984)
// ============================================================================
describe('Validado: Constantes OEE (Nakajima 1984)', () => {

    it('OEE clase mundial = 85% = 90% x 95% x 99%', () => {
        const disponibilidad = 0.90;
        const rendimiento = 0.95;
        const calidad = 0.99;
        const oee = disponibilidad * rendimiento * calidad;

        // 0.90 x 0.95 x 0.99 = 0.84645 ≈ 85%
        expect(oee).toBeCloseTo(0.8465, 3);
        // Redondeado es el 85% que usa el software
        expect(Math.round(oee * 100)).toBe(85);
    });

    it('OEE perfecto = 100% (solo referencia, nunca en la realidad)', () => {
        expect(1.0 * 1.0 * 1.0).toBe(1.0);
    });
});

// ============================================================================
// BLOQUE 3D: Demanda Ajustada por Scrap (ya testeada en Bloque 2)
// Solo tests adicionales de precision
// ============================================================================
describe('Validado: Demanda Ajustada - Tests adicionales de precision', () => {

    it('formula divisiva es mas precisa que multiplicativa para scrap alto', () => {
        // Con 15% de scrap:
        // Divisiva: 1000 / 0.85 = 1176.47
        // Multiplicativa: 1000 x 1.15 = 1150.00
        // Diferencia: 26.47 piezas (la multiplicativa queda corta)
        const divisiva = calculateAdjustedDemand(1000, 0.15);
        const multiplicativa = 1000 * (1 + 0.15);

        expect(divisiva).toBeCloseTo(1176.47, 0);
        expect(multiplicativa).toBeCloseTo(1150.00, 0);
        expect(divisiva).toBeGreaterThan(multiplicativa);
    });

    it('con 1% de scrap la diferencia es minima', () => {
        // Divisiva: 1000 / 0.99 = 1010.10
        // Multiplicativa: 1000 x 1.01 = 1010.00
        const divisiva = calculateAdjustedDemand(1000, 0.01);
        expect(divisiva).toBeCloseTo(1010.10, 0);
    });
});
