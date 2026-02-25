/**
 * Test: Takt Time calculation with multi-shift breaks
 * 
 * Anti-regression test for the bug where MixModeView only used
 * breaks from the first shift but multiplied by N shifts.
 * 
 * @version 5.5.0 - Fix multi-shift breaks calculation
 */
import { calculateTaktTime, calculateShiftNetMinutes } from '../core/balancing/simulation';
import { Shift } from '../types';

describe('Takt calculation with multi-shift breaks', () => {
    const shift1: Shift = {
        id: 1,
        name: 'Turno Mañana',
        startTime: '06:00',
        endTime: '14:00',
        breaks: [{ id: 'b1', name: 'Almuerzo', startTime: '12:00', duration: 30 }]
    };

    const shift2: Shift = {
        id: 2,
        name: 'Turno Tarde',
        startTime: '14:00',
        endTime: '22:00',
        breaks: [{ id: 'b2', name: 'Cena', startTime: '19:00', duration: 60 }]
    };

    test('calculateShiftNetMinutes should calculate breaks per shift', () => {
        // Shift 1: 8h - 30min = 450 min
        expect(calculateShiftNetMinutes(shift1)).toBe(450);
        // Shift 2: 8h - 60min = 420 min
        expect(calculateShiftNetMinutes(shift2)).toBe(420);
    });

    test('should sum breaks from each shift independently', () => {
        const shifts = [shift1, shift2];
        const demand = 600;
        const oee = 0.85;

        const result = calculateTaktTime(shifts, 2, demand, oee);

        // T1: 450 min * 0.85 = 382.5 min = 22,950s
        // T2: 420 min * 0.85 = 357 min = 21,420s
        // Total: 739.5 min = 44,370s
        // Takt: 44,370 / 600 = 73.95s
        expect(result.effectiveSeconds).toBeCloseTo(73.95, 0);

        // Verify total available minutes (before OEE)
        expect(result.totalAvailableMinutes).toBe(870); // 450 + 420
    });

    test('BUG FIX: should NOT use shift 0 breaks for all shifts', () => {
        // This test verifies the fix for the bug where only shift[0].breaks
        // was used but then multiplied by N shifts.
        //
        // Old buggy calculation: 2 * (480 - 30) * 0.85 * 60 / 600 = 76.5s ❌
        // New correct calculation: ((450 + 420) * 0.85 * 60) / 600 = 73.95s ✓

        const shifts = [shift1, shift2];
        const demand = 600;
        const oee = 0.85;

        const result = calculateTaktTime(shifts, 2, demand, oee);

        // The buggy result would be 76.5s
        const BUGGY_RESULT = 76.5;

        // Our result should be different (lower)
        expect(result.effectiveSeconds).not.toBeCloseTo(BUGGY_RESULT, 0);
        expect(result.effectiveSeconds).toBeLessThan(BUGGY_RESULT);
    });

    test('should handle zero demand gracefully', () => {
        const shifts = [shift1];
        const result = calculateTaktTime(shifts, 1, 0, 0.85);
        expect(result.effectiveSeconds).toBe(0);
    });

    test('should handle single shift correctly', () => {
        const shifts = [shift1];
        const result = calculateTaktTime(shifts, 1, 450, 0.85);

        // shift1: 450 min * 0.85 * 60 / 450 = 51s
        expect(result.effectiveSeconds).toBeCloseTo(51, 0);
    });

    test('should apply setup loss percentage', () => {
        const shifts = [shift1];
        const demand = 450;
        const oee = 1.0;
        const setupLossPercent = 0.10; // 10% loss

        const result = calculateTaktTime(shifts, 1, demand, oee, setupLossPercent);

        // 450 min * (1 - 0.10) = 405 min net
        // Takt = 405 * 60 / 450 = 54s
        expect(result.netAvailableMinutes).toBe(405);
        expect(result.effectiveSeconds).toBeCloseTo(54, 0);
    });
});
