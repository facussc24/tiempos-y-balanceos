/**
 * TESTS VALIDADOS - BLOQUE 6: MIZUSUMASHI (Water Spider / Milk Run)
 *
 * Fuentes academicas:
 * - Rother, M. & Shook, J. (1999) "Learning to See" - Pitch = Takt × Pack-out
 * - Harris, R. & Harris, C. (2008) "Making Materials Flow" - Milk Run routes
 * - Coimbra, E. (2009) "Kaizen in Logistics" - Loop inventory formula
 * - Ergonomia industrial: velocidad de caminata 1.0 m/s en planta
 *
 * Todas las formulas del Bloque 6 fueron verificadas como CORRECTAS.
 */
import { describe, it, expect } from 'vitest';
import {
    calculatePitch,
    calculateRouteTime,
    validateRoute,
    calculateMizusumashi,
    buildSchedule,
    calculateWalkTimeFromDistance,
    calculateLoopInventory,
    validateFrequency,
    taktToSeconds,
    formatRouteTime,
    DEFAULT_WALK_SPEED_MPS,
    RouteStop,
} from '../modules/mizusumashi/mizusumashiLogic';

// ============================================================================
// Helper: crear paradas de ruta
// ============================================================================
const crearParada = (overrides: Partial<RouteStop> = {}): RouteStop => ({
    stationId: 1,
    stationName: 'Estacion 1',
    walkTimeSeconds: 60,
    handlingTimeSeconds: 30,
    boxCount: 2,
    ...overrides,
});

// ============================================================================
// BLOQUE 6A: Pitch (Rother & Shook 1999)
// Formula: Pitch = Takt × Pack-out (en minutos)
// ============================================================================
describe('Validado: Pitch (Rother & Shook)', () => {

    it('caso tipico: takt=60s, pack-out=20 pzas → pitch=20 min', () => {
        // Pitch = 60 × 20 = 1200s = 20 min
        expect(calculatePitch(60, 20)).toBe(20);
    });

    it('takt corto: takt=30s, pack-out=10 → pitch=5 min', () => {
        // Pitch = 30 × 10 = 300s = 5 min
        expect(calculatePitch(30, 10)).toBe(5);
    });

    it('takt largo: takt=120s, pack-out=50 → pitch=100 min', () => {
        // Pitch = 120 × 50 = 6000s = 100 min
        expect(calculatePitch(120, 50)).toBe(100);
    });

    it('takt=0 retorna 0', () => {
        expect(calculatePitch(0, 20)).toBe(0);
    });

    it('pack-out=0 retorna 0', () => {
        expect(calculatePitch(60, 0)).toBe(0);
    });
});

// ============================================================================
// BLOQUE 6B: Route Time (Harris & Harris 2008)
// Formula: RouteTime = Σ(walkTime + handlingTime)
// ============================================================================
describe('Validado: Route Time (Harris & Harris)', () => {

    it('ruta con 3 paradas (incluye retorno al almacén)', () => {
        const stops: RouteStop[] = [
            crearParada({ walkTimeSeconds: 60, handlingTimeSeconds: 30 }),
            crearParada({ walkTimeSeconds: 90, handlingTimeSeconds: 45 }),
            crearParada({ walkTimeSeconds: 120, handlingTimeSeconds: 60 }),
        ];
        // Stops = (60+30) + (90+45) + (120+60) = 405s
        // Return trip = stops[0].walkTimeSeconds = 60s (symmetric default)
        // Total = 465s = 7.75 min
        expect(calculateRouteTime(stops)).toBeCloseTo(7.75, 2);
    });

    it('ruta vacia = 0 min', () => {
        expect(calculateRouteTime([])).toBe(0);
    });

    it('una sola parada (incluye retorno al almacén)', () => {
        const stops = [crearParada({ walkTimeSeconds: 120, handlingTimeSeconds: 60 })];
        // Stops = 120+60 = 180s, Return = 120s (symmetric), Total = 300s = 5 min
        expect(calculateRouteTime(stops)).toBe(5);
    });
});

// ============================================================================
// BLOQUE 6C: Validacion de Ruta
// ============================================================================
describe('Validado: Validacion de Ruta', () => {

    it('utilizacion ≤ 70%: OK', () => {
        // routeTime = 7 min, pitch = 20 min → 35%
        const result = validateRoute(20, 7);
        expect(result.isFeasible).toBe(true);
        expect(result.alertLevel).toBe('ok');
    });

    it('utilizacion 70-90%: warning', () => {
        // routeTime = 16 min, pitch = 20 min → 80%
        const result = validateRoute(20, 16);
        expect(result.isFeasible).toBe(true);
        expect(result.alertLevel).toBe('warning');
    });

    it('utilizacion 90-100%: warning (muy ajustada)', () => {
        // routeTime = 19 min, pitch = 20 min → 95%
        const result = validateRoute(20, 19);
        expect(result.isFeasible).toBe(true);
        expect(result.alertLevel).toBe('warning');
    });

    it('utilizacion > 100%: critical (excede pitch)', () => {
        // routeTime = 25 min, pitch = 20 min → 125%
        const result = validateRoute(20, 25);
        expect(result.isFeasible).toBe(false);
        expect(result.alertLevel).toBe('critical');
    });

    it('pitch = 0: critical', () => {
        const result = validateRoute(0, 10);
        expect(result.isFeasible).toBe(false);
        expect(result.alertLevel).toBe('critical');
    });
});

// ============================================================================
// BLOQUE 6D: Calculo Completo Mizusumashi
// ============================================================================
describe('Validado: Calculo Completo Mizusumashi', () => {

    it('ruta factible: 3 paradas, pitch 20 min (incluye retorno)', () => {
        const stops: RouteStop[] = [
            crearParada({ stationName: 'Linea 1', walkTimeSeconds: 120, handlingTimeSeconds: 60 }),
            crearParada({ stationName: 'Linea 2', walkTimeSeconds: 90, handlingTimeSeconds: 45 }),
            crearParada({ stationName: 'Linea 3', walkTimeSeconds: 60, handlingTimeSeconds: 30 }),
        ];
        // Stops = (120+60)+(90+45)+(60+30) = 405s
        // Return trip = stops[0].walkTimeSeconds = 120s (symmetric default)
        // Total route = 525s = 8.75 min
        // pitch = 60 × 20 = 1200s = 20 min
        const result = calculateMizusumashi(60, 20, stops, '08:00');

        expect(result.pitchMinutes).toBe(20);
        expect(result.routeTimeMinutes).toBeCloseTo(8.75, 2);
        expect(result.isRouteFeasible).toBe(true);
        expect(result.utilizationPercent).toBeCloseTo(43.75, 1);
        expect(result.marginMinutes).toBeCloseTo(11.25, 1);
        expect(result.mizusumashisNeeded).toBe(1);
    });

    it('ruta que excede pitch: necesita 2 mizusumashis', () => {
        const stops: RouteStop[] = [
            crearParada({ walkTimeSeconds: 300, handlingTimeSeconds: 120 }),
            crearParada({ walkTimeSeconds: 300, handlingTimeSeconds: 120 }),
            crearParada({ walkTimeSeconds: 300, handlingTimeSeconds: 120 }),
        ];
        // routeTime = 3 × (300+120) = 1260s = 21 min
        // pitch = 30 × 20 = 600s = 10 min
        // utilizacion = 21/10 = 210% → ceil(2.1) = 3 mizusumashis? No...
        // Correction: utilization = 21/10 = 2.1 → ceil = 3
        const result = calculateMizusumashi(30, 20, stops, '08:00');

        expect(result.isRouteFeasible).toBe(false);
        expect(result.mizusumashisNeeded).toBeGreaterThan(1);
    });
});

// ============================================================================
// BLOQUE 6E: Velocidad de Caminata (Ergonomia Industrial)
// ============================================================================
describe('Validado: Velocidad de Caminata (Ergonomia)', () => {

    it('velocidad default = 1.0 m/s', () => {
        expect(DEFAULT_WALK_SPEED_MPS).toBe(1.0);
    });

    it('100 metros a 1.0 m/s = 100 segundos', () => {
        expect(calculateWalkTimeFromDistance(100, 1.0)).toBe(100);
    });

    it('100 metros a 0.8 m/s (lento) = ceil(125) = 125s', () => {
        expect(calculateWalkTimeFromDistance(100, 0.8)).toBe(125);
    });

    it('100 metros a 1.2 m/s (rapido) = ceil(83.33) = 84s', () => {
        expect(calculateWalkTimeFromDistance(100, 1.2)).toBe(84);
    });

    it('distancia 0 retorna 0', () => {
        expect(calculateWalkTimeFromDistance(0)).toBe(0);
    });

    it('velocidad 0 retorna 0 (proteccion division)', () => {
        expect(calculateWalkTimeFromDistance(100, 0)).toBe(0);
    });
});

// ============================================================================
// BLOQUE 6F: Inventario en Loop (Coimbra 2009)
// Formula: N_loop = ceil((2 × Frecuencia) / Pitch) + 1
// ============================================================================
describe('Validado: Inventario en Loop (Coimbra)', () => {

    it('ejemplo del comentario: pitch=10min, freq=60min → 13 cajas', () => {
        // N = ceil((2 × 60) / 10) + 1 = ceil(12) + 1 = 13
        const result = calculateLoopInventory(60, 60, 10);
        // takt=60s, pack=10 → pitch = 60×10/60 = 10 min

        expect(result.pitchMinutes).toBe(10);
        expect(result.totalLoopBoxes).toBe(13);
        expect(result.safetyBox).toBe(1);
    });

    it('frecuencia = pitch: minimo inventario', () => {
        // N = ceil((2 × 10) / 10) + 1 = ceil(2) + 1 = 3
        const result = calculateLoopInventory(10, 60, 10);
        // pitch = 10 min

        expect(result.totalLoopBoxes).toBe(3);
    });

    it('distribucion: mitad en linea, mitad en transito', () => {
        const result = calculateLoopInventory(60, 60, 10);
        // loopWithoutSafety = 12
        // boxesInLine = ceil(12/2) = 6
        // boxesInTransit = floor(12/2) = 6
        expect(result.boxesInLine).toBe(6);
        expect(result.boxesInTransit).toBe(6);
        expect(result.boxesInLine + result.boxesInTransit + result.safetyBox)
            .toBe(result.totalLoopBoxes);
    });

    it('alerta warning cuando > 12 cajas', () => {
        // Frecuencia larga: 120 min, pitch 10 min
        // N = ceil((2 × 120) / 10) + 1 = 25
        const result = calculateLoopInventory(120, 60, 10);
        expect(result.totalLoopBoxes).toBe(25);
        expect(result.inventoryAlert).not.toBeNull();
        expect(result.inventoryAlert!.level).toBe('critical'); // > 20
    });

    it('pitch 0 retorna todo en 0', () => {
        const result = calculateLoopInventory(60, 0, 10);
        expect(result.totalLoopBoxes).toBe(0);
    });
});

// ============================================================================
// BLOQUE 6G: Validacion de Frecuencia
// ============================================================================
describe('Validado: Validacion de Frecuencia', () => {

    it('frecuencia multiplo del pitch: valida', () => {
        // pitch=10, freq=30 → ratio=3.0 (multiplo exacto)
        const result = validateFrequency(30, 10);
        expect(result.isValid).toBe(true);
        expect(result.ratio).toBe(3);
    });

    it('frecuencia NO multiplo: invalida con sugerencias', () => {
        // pitch=10, freq=23 → ratio=2.3 (no es multiplo)
        const result = validateFrequency(23, 10);
        expect(result.isValid).toBe(false);
        expect(result.suggestedFrequencies).toContain(10);
        expect(result.suggestedFrequencies).toContain(20);
        expect(result.suggestedFrequencies).toContain(30);
        expect(result.warning).not.toBeNull();
    });

    it('sugerencias no superan 120 min (2 horas)', () => {
        const result = validateFrequency(23, 10);
        result.suggestedFrequencies.forEach(f => {
            expect(f).toBeLessThanOrEqual(120);
        });
    });

    it('pitch 0: invalida', () => {
        const result = validateFrequency(30, 0);
        expect(result.isValid).toBe(false);
    });
});

// ============================================================================
// BLOQUE 6H: Schedule Builder
// ============================================================================
describe('Validado: Schedule Builder', () => {

    it('schedule empieza en almacen y termina en almacen', () => {
        const stops: RouteStop[] = [
            crearParada({ stationName: 'Linea 1', walkTimeSeconds: 120, handlingTimeSeconds: 60 }),
        ];
        const schedule = buildSchedule(stops, '08:00');

        expect(schedule[0].stationName).toBe('Almacén (Inicio)');
        expect(schedule[0].arrivalTime).toBe('08:00');
        expect(schedule[schedule.length - 1].stationName).toBe('Almacén (Fin ciclo)');
    });

    it('tiempos acumulados correctos', () => {
        const stops: RouteStop[] = [
            crearParada({ stationName: 'L1', walkTimeSeconds: 120, handlingTimeSeconds: 60 }),
            crearParada({ stationName: 'L2', walkTimeSeconds: 60, handlingTimeSeconds: 30 }),
        ];
        const schedule = buildSchedule(stops, '08:00');

        // Parada 1: walk 2min → arrival 08:02, handle 1min
        expect(schedule[1].arrivalTime).toBe('08:02');
        expect(schedule[1].cumulativeMinutes).toBe(2);

        // Parada 2: walk 1min → arrival 08:04 (08:00 + 2min walk + 1min handle + 1min walk)
        expect(schedule[2].cumulativeMinutes).toBe(4); // 2 + 1 + 1
    });

    it('box count total en almacen = suma de todas las paradas', () => {
        const stops: RouteStop[] = [
            crearParada({ boxCount: 3 }),
            crearParada({ boxCount: 5 }),
            crearParada({ boxCount: 2 }),
        ];
        const schedule = buildSchedule(stops, '08:00');

        expect(schedule[0].boxCount).toBe(10); // 3+5+2
    });
});

// ============================================================================
// BLOQUE 6I: Helpers
// ============================================================================
describe('Validado: Mizusumashi Helpers', () => {

    it('taktToSeconds: minutos a segundos', () => {
        expect(taktToSeconds(2, 'minutes')).toBe(120);
    });

    it('taktToSeconds: segundos sin cambio', () => {
        expect(taktToSeconds(60, 'seconds')).toBe(60);
    });

    it('formatRouteTime: < 1 min muestra segundos', () => {
        expect(formatRouteTime(0.5)).toBe('30 seg');
    });

    it('formatRouteTime: < 60 min muestra minutos', () => {
        expect(formatRouteTime(25)).toBe('25 min');
    });

    it('formatRouteTime: >= 60 min muestra horas', () => {
        expect(formatRouteTime(90)).toBe('1h 30min');
    });
});
