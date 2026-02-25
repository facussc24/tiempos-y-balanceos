/**
 * Unit Tests for Mizusumashi Logic
 * Phase 3: Lean Logistics Suite
 */

import { describe, it, expect } from 'vitest';
import {
    calculatePitch,
    calculateRouteTime,
    validateRoute,
    calculateMizusumashi,
    buildSchedule,
    formatRouteTime,
    RouteStop,
    calculateWalkTimeFromDistance,
    DEFAULT_WALK_SPEED_MPS
} from '../modules/mizusumashi/mizusumashiLogic';

describe('Mizusumashi Logic', () => {
    describe('calculatePitch', () => {
        it('calculates pitch correctly (Takt × PackOut)', () => {
            // Takt = 60 sec, PackOut = 20 pieces → Pitch = 20 min
            const pitch = calculatePitch(60, 20);
            expect(pitch).toBe(20);
        });

        it('calculates pitch with different values', () => {
            // Takt = 30 sec, PackOut = 10 pieces → Pitch = 5 min
            const pitch = calculatePitch(30, 10);
            expect(pitch).toBe(5);
        });

        it('returns 0 for invalid inputs', () => {
            expect(calculatePitch(0, 20)).toBe(0);
            expect(calculatePitch(60, 0)).toBe(0);
            expect(calculatePitch(-1, 20)).toBe(0);
        });
    });

    describe('calculateRouteTime', () => {
        it('calculates total route time correctly', () => {
            const stops: RouteStop[] = [
                { stationId: 1, stationName: 'E1', walkTimeSeconds: 60, handlingTimeSeconds: 30, boxCount: 2 },
                { stationId: 2, stationName: 'E2', walkTimeSeconds: 90, handlingTimeSeconds: 30, boxCount: 3 },
                { stationId: 3, stationName: 'E3', walkTimeSeconds: 60, handlingTimeSeconds: 30, boxCount: 1 }
            ];
            // Total = (60+30) + (90+30) + (60+30) = 300 sec = 5 min
            const routeTime = calculateRouteTime(stops);
            expect(routeTime).toBe(5);
        });

        it('returns 0 for empty stops', () => {
            expect(calculateRouteTime([])).toBe(0);
        });

        it('handles stops with zero times', () => {
            const stops: RouteStop[] = [
                { stationId: 1, stationName: 'E1', walkTimeSeconds: 0, handlingTimeSeconds: 0, boxCount: 1 }
            ];
            expect(calculateRouteTime(stops)).toBe(0);
        });
    });

    describe('validateRoute', () => {
        it('returns OK for route well under pitch', () => {
            const validation = validateRoute(20, 10);
            expect(validation.isFeasible).toBe(true);
            expect(validation.alertLevel).toBe('ok');
        });

        it('returns warning for tight route (70-90%)', () => {
            const validation = validateRoute(20, 16);
            expect(validation.isFeasible).toBe(true);
            expect(validation.alertLevel).toBe('warning');
        });

        it('returns warning for very tight route (90-100%)', () => {
            const validation = validateRoute(20, 19);
            expect(validation.isFeasible).toBe(true);
            expect(validation.alertLevel).toBe('warning');
        });

        it('returns critical for route exceeding pitch', () => {
            const validation = validateRoute(20, 25);
            expect(validation.isFeasible).toBe(false);
            expect(validation.alertLevel).toBe('critical');
            expect(validation.suggestions.length).toBeGreaterThan(0);
        });

        it('returns critical for zero pitch', () => {
            const validation = validateRoute(0, 10);
            expect(validation.isFeasible).toBe(false);
            expect(validation.alertLevel).toBe('critical');
        });
    });

    describe('calculateMizusumashi', () => {
        it('calculates complete result', () => {
            const stops: RouteStop[] = [
                { stationId: 1, stationName: 'E1', walkTimeSeconds: 60, handlingTimeSeconds: 30, boxCount: 2 },
                { stationId: 2, stationName: 'E2', walkTimeSeconds: 60, handlingTimeSeconds: 30, boxCount: 1 }
            ];

            const result = calculateMizusumashi(60, 20, stops, '08:00');

            expect(result.pitchMinutes).toBe(20);
            expect(result.routeTimeMinutes).toBe(3); // 180 sec = 3 min
            expect(result.isRouteFeasible).toBe(true);
            expect(result.utilizationPercent).toBeCloseTo(15); // 3/20 = 15%
            expect(result.mizusumashisNeeded).toBe(1);
        });

        it('calculates mizusumashis needed when route exceeds pitch', () => {
            const stops: RouteStop[] = [
                { stationId: 1, stationName: 'E1', walkTimeSeconds: 600, handlingTimeSeconds: 300, boxCount: 2 },
                { stationId: 2, stationName: 'E2', walkTimeSeconds: 600, handlingTimeSeconds: 300, boxCount: 1 }
            ];

            const result = calculateMizusumashi(60, 20, stops, '08:00');

            expect(result.routeTimeMinutes).toBe(30); // 1800 sec = 30 min
            expect(result.isRouteFeasible).toBe(false);
            expect(result.mizusumashisNeeded).toBe(2); // 30/20 = 1.5 → 2
        });
    });

    describe('buildSchedule', () => {
        it('builds schedule with correct arrival times', () => {
            const stops: RouteStop[] = [
                { stationId: 1, stationName: 'Estación 1', walkTimeSeconds: 300, handlingTimeSeconds: 60, boxCount: 2 }
            ];

            const schedule = buildSchedule(stops, '08:00');

            expect(schedule.length).toBe(3); // Start + 1 stop + End
            expect(schedule[0].arrivalTime).toBe('08:00');
            expect(schedule[0].stationName).toBe('Almacén (Inicio)');
            expect(schedule[1].arrivalTime).toBe('08:05'); // +5 min walk
            expect(schedule[1].stationName).toBe('Estación 1');
            expect(schedule[2].stationName).toContain('Fin ciclo');
        });
    });

    describe('formatRouteTime', () => {
        it('formats seconds correctly', () => {
            expect(formatRouteTime(0.5)).toBe('30 seg');
        });

        it('formats minutes correctly', () => {
            expect(formatRouteTime(15)).toBe('15 min');
        });

        it('formats hours and minutes correctly', () => {
            expect(formatRouteTime(90)).toBe('1h 30min');
        });
    });

    // v3.0: Distance to Walk Time Calculator tests
    describe('calculateWalkTimeFromDistance', () => {
        it('calculates walk time at default speed (1 m/s)', () => {
            // 60 meters at 1 m/s = 60 seconds
            expect(calculateWalkTimeFromDistance(60)).toBe(60);
        });

        it('calculates walk time at custom speed', () => {
            // 100 meters at 0.8 m/s = 125 seconds
            expect(calculateWalkTimeFromDistance(100, 0.8)).toBe(125);
        });

        it('rounds up partial seconds', () => {
            // 50 meters at 1 m/s = 50 seconds
            expect(calculateWalkTimeFromDistance(50)).toBe(50);
            // 55 meters at 2 m/s = 27.5, rounds to 28
            expect(calculateWalkTimeFromDistance(55, 2)).toBe(28);
        });

        it('returns 0 for invalid inputs', () => {
            expect(calculateWalkTimeFromDistance(0)).toBe(0);
            expect(calculateWalkTimeFromDistance(-10)).toBe(0);
            expect(calculateWalkTimeFromDistance(50, 0)).toBe(0);
        });

        it('exports default speed constant', () => {
            expect(DEFAULT_WALK_SPEED_MPS).toBe(1.0);
        });
    });
});
