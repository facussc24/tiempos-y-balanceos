/**
 * OEE/Setup Mutual Exclusion Tests
 * 
 * V8.2: Validates that the system prevents double penalty by enforcing
 * mutual exclusion between OEE Global and Setup Loss Percent.
 * 
 * @version 8.2.0 - ISO 22400 Compliance
 */

import { describe, it, expect } from 'vitest';
import { calculateTaktTime } from '../core/balancing/simulation';

describe('OEE/Setup Mutual Exclusion (ISO 22400)', () => {
    // 8-hour shift: 06:00 - 14:00 = 480 minutes available
    const shifts = [{
        id: 1,
        name: 'T1',
        startTime: '06:00',
        endTime: '14:00',
        breaks: []
    }];

    // Demand = 480 → Nominal Takt = 480 min * 60 sec / 480 pieces = 60 seconds

    it('Should calculate correctly with OEE only (Setup = 0)', () => {
        // Scenario: Standard configuration - OEE at 85%, no setup loss
        // Available = 480 min, Demand = 480
        // Nominal Takt = 480 * 60 / 480 = 60s
        // Effective Takt = 60 * 0.85 = 51s
        const result = calculateTaktTime(shifts, 1, 480, 0.85, 0);

        expect(result.nominalSeconds).toBeCloseTo(60, 0);
        expect(result.effectiveSeconds).toBeCloseTo(51, 0);
        expect(result.setupLossApplied).toBe(0);
    });

    it('Should calculate correctly with Setup only (OEE = 100%)', () => {
        // Scenario: Advanced configuration - OEE at 100%, 15% setup loss
        // This is valid for Mix/Heijunka where Setup is modeled explicitly
        // Net time = 480 * (1 - 0.15) = 408 min
        // Nominal Takt = 408 * 60 / 480 = 51s
        // Effective = 51 * 1.0 = 51s (OEE is 100%)
        const result = calculateTaktTime(shifts, 1, 480, 1.0, 0.15);

        expect(result.netAvailableMinutes).toBeCloseTo(408, 0);
        expect(result.setupLossApplied).toBeCloseTo(0.15, 2);
        expect(result.nominalSeconds).toBeCloseTo(51, 0);
        expect(result.effectiveSeconds).toBeCloseTo(51, 0);
    });

    it('Should DOUBLE penalize if both active (anti-pattern we prevent in UI)', () => {
        // This test DOCUMENTS the anti-pattern we want to prevent
        // If both OEE < 100% AND setup > 0, the calculation double-penalizes
        // Net time = 480 * (1 - 0.15) = 408 min
        // Nominal Takt = 408 * 60 / 480 = 51s
        // Effective = 51 * 0.85 = 43.35s (WRONG - double penalty!)
        const result = calculateTaktTime(shifts, 1, 480, 0.85, 0.15);

        // Expected: effective should be LESS than 51s (the correct value with either approach alone)
        expect(result.effectiveSeconds).toBeLessThan(51);
        expect(result.effectiveSeconds).toBeCloseTo(43.35, 0);

        // This is the scenario we prevent in useOEELogic.ts
    });

    it('Should clamp setupLossPercent to valid range (0-20%)', () => {
        // Test upper boundary
        const result1 = calculateTaktTime(shifts, 1, 480, 1.0, 0.50);
        expect(result1.setupLossApplied).toBe(0.20); // Clamped to 20%

        // Test lower boundary
        const result2 = calculateTaktTime(shifts, 1, 480, 1.0, -0.10);
        expect(result2.setupLossApplied).toBe(0); // Clamped to 0%
    });

    it('Should handle edge case: zero demand', () => {
        const result = calculateTaktTime(shifts, 1, 0, 0.85, 0.10);

        expect(result.nominalSeconds).toBe(0);
        expect(result.effectiveSeconds).toBe(0);
    });

    it('Should handle edge case: zero available time', () => {
        const emptyShifts = [{
            id: 1,
            name: 'T1',
            startTime: '06:00',
            endTime: '06:00', // Zero duration
            breaks: []
        }];

        const result = calculateTaktTime(emptyShifts, 1, 480, 0.85, 0.10);
        expect(result.nominalSeconds).toBe(0);
    });
});
