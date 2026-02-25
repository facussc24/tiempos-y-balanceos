/**
 * Scrap Rate Calculation Tests
 * 
 * Tests for the calculateAdjustedDemand function that inflates
 * demand to account for expected scrap/defect rates.
 * 
 * Formula: Adjusted_Demand = Base_Demand / (1 - scrapRate)
 * 
 * @module __tests__/scrap_rate.test
 * @version 1.0.0 - Phase 1 Completion
 */

import { describe, it, expect } from 'vitest';
import { calculateAdjustedDemand } from '../core/balancing/simulation';

describe('Scrap Rate Calculation', () => {
    describe('calculateAdjustedDemand', () => {
        it('should inflate demand correctly with 3% scrap', () => {
            // If we need 1000 good pieces and expect 3% scrap,
            // we need to produce 1000 / 0.97 = 1030.93 pieces
            const result = calculateAdjustedDemand(1000, 0.03);
            expect(result).toBeCloseTo(1030.93, 2);
        });

        it('should inflate demand correctly with 5% scrap', () => {
            // 1000 / 0.95 = 1052.63
            const result = calculateAdjustedDemand(1000, 0.05);
            expect(result).toBeCloseTo(1052.63, 2);
        });

        it('should inflate demand correctly with 10% scrap', () => {
            // 1000 / 0.90 = 1111.11
            const result = calculateAdjustedDemand(1000, 0.10);
            expect(result).toBeCloseTo(1111.11, 2);
        });

        it('should clamp scrap rate to 20% max', () => {
            // Even if user passes 50%, we cap at 20%
            // 1000 / 0.80 = 1250
            const result = calculateAdjustedDemand(1000, 0.50);
            expect(result).toBeCloseTo(1250, 2);
        });

        it('should handle zero scrap gracefully', () => {
            const result = calculateAdjustedDemand(1000, 0);
            expect(result).toBe(1000);
        });

        it('should handle undefined scrap (default to 0)', () => {
            const result = calculateAdjustedDemand(1000);
            expect(result).toBe(1000);
        });

        it('should handle negative scrap (clamp to 0)', () => {
            // Negative scrap makes no sense, treat as 0
            const result = calculateAdjustedDemand(1000, -0.05);
            expect(result).toBe(1000);
        });

        it('should handle small demands correctly', () => {
            // 50 pieces with 2% scrap = 50 / 0.98 = 51.02
            const result = calculateAdjustedDemand(50, 0.02);
            expect(result).toBeCloseTo(51.02, 2);
        });

        it('should handle large demands correctly', () => {
            // 100000 pieces with 1% scrap = 100000 / 0.99 = 101010.10
            const result = calculateAdjustedDemand(100000, 0.01);
            expect(result).toBeCloseTo(101010.10, 2);
        });

        it('should return 0 for zero demand', () => {
            const result = calculateAdjustedDemand(0, 0.05);
            expect(result).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle exactly 20% scrap (boundary)', () => {
            // 1000 / 0.80 = 1250
            const result = calculateAdjustedDemand(1000, 0.20);
            expect(result).toBeCloseTo(1250, 2);
        });

        it('should handle scrap rate as decimal string converted to number', () => {
            // Simulating user input that might come as string
            const scrapAsNumber = Number('0.03');
            const result = calculateAdjustedDemand(1000, scrapAsNumber);
            expect(result).toBeCloseTo(1030.93, 2);
        });

        it('should maintain precision for industrial calculations', () => {
            // Verify we maintain enough precision for production planning
            const result = calculateAdjustedDemand(1234, 0.0325);
            // 1234 / (1 - 0.0325) = 1234 / 0.9675 = 1275.45
            expect(result).toBeCloseTo(1275.45, 2);
        });
    });
});
