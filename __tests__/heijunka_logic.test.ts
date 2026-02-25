/**
 * Unit Tests for Heijunka Logic
 * Phase 4: Lean Logistics Suite
 */

import { describe, it, expect } from 'vitest';
import {
    calculateSlots,
    calculateQuantityPerSlot,
    euclideanDistribute,
    validateCapacity,
    calculateHeijunka,
    getProductColor,
    ProductDemand
} from '../modules/heijunka/heijunkaLogic';

describe('Heijunka Logic', () => {
    describe('calculateSlots', () => {
        it('calculates slots correctly (Available / Pitch)', () => {
            // 480 min / 20 min pitch = 24 slots
            const slots = calculateSlots(480, 20);
            expect(slots).toBe(24);
        });

        it('calculates with different values', () => {
            // 600 min / 30 min = 20 slots
            expect(calculateSlots(600, 30)).toBe(20);
        });

        it('returns 0 for invalid inputs', () => {
            expect(calculateSlots(0, 20)).toBe(0);
            expect(calculateSlots(480, 0)).toBe(0);
            expect(calculateSlots(-1, 20)).toBe(0);
        });
    });

    describe('calculateQuantityPerSlot', () => {
        it('calculates quantity per slot', () => {
            // 300 demand / 24 slots = 12.5
            const qty = calculateQuantityPerSlot(300, 24);
            expect(qty).toBeCloseTo(12.5);
        });

        it('returns 0 for zero slots', () => {
            expect(calculateQuantityPerSlot(300, 0)).toBe(0);
        });
    });

    describe('euclideanDistribute', () => {
        it('distributes uniformly (equal division)', () => {
            // 24 items across 6 slots = 4 each
            const result = euclideanDistribute(24, 6);
            expect(result).toEqual([4, 4, 4, 4, 4, 4]);
        });

        it('distributes uniformly with remainder', () => {
            // 7 items across 3 slots = 2, 2, 3 or similar uniform pattern
            const result = euclideanDistribute(7, 3);
            expect(result.reduce((a, b) => a + b, 0)).toBe(7);
            // Check distribution is relatively even
            expect(Math.max(...result) - Math.min(...result)).toBeLessThanOrEqual(1);
        });

        it('distributes low-volume items uniformly', () => {
            // 3 items across 6 slots should spread every 2 slots
            const result = euclideanDistribute(3, 6);
            expect(result.reduce((a, b) => a + b, 0)).toBe(3);
            // Items should be spread out, not clumped
            expect(result.filter(x => x > 0).length).toBe(3);
        });

        it('returns zeros for zero items', () => {
            const result = euclideanDistribute(0, 5);
            expect(result).toEqual([0, 0, 0, 0, 0]);
        });
    });

    describe('validateCapacity', () => {
        const products: ProductDemand[] = [
            { productId: 'A', productName: 'Modelo A', dailyDemand: 300, cycleTimeSeconds: 600, color: '#3B82F6' },
            { productId: 'B', productName: 'Modelo B', dailyDemand: 150, cycleTimeSeconds: 1500, color: '#10B981' }
        ];

        it('returns OK for cycle time well under pitch', () => {
            // Product A: 600s cycle, 1200s pitch = 50% utilization
            const alerts = validateCapacity(products, 1200);
            const alertA = alerts.find(a => a.productId === 'A');
            expect(alertA?.severity).toBe('ok');
        });

        it('returns critical for cycle time exceeding pitch', () => {
            // Product B: 1500s cycle > 1200s pitch
            const alerts = validateCapacity(products, 1200);
            const alertB = alerts.find(a => a.productId === 'B');
            expect(alertB?.severity).toBe('critical');
        });

        it('returns warning for tight capacity (90-100%)', () => {
            const tightProducts: ProductDemand[] = [
                { productId: 'T', productName: 'Tight', dailyDemand: 100, cycleTimeSeconds: 950, color: '#F59E0B' }
            ];
            // 950s / 1000s pitch = 95%
            const alerts = validateCapacity(tightProducts, 1000);
            expect(alerts[0].severity).toBe('warning');
        });
    });

    describe('calculateHeijunka', () => {
        const products: ProductDemand[] = [
            { productId: 'A', productName: 'Modelo A', dailyDemand: 300, cycleTimeSeconds: 60, color: '#3B82F6' },
            { productId: 'B', productName: 'Modelo B', dailyDemand: 150, cycleTimeSeconds: 90, color: '#10B981' },
            { productId: 'C', productName: 'Modelo C', dailyDemand: 50, cycleTimeSeconds: 120, color: '#F59E0B' }
        ];

        it('calculates complete heijunka result', () => {
            const result = calculateHeijunka(products, 480, 20, '08:00');

            expect(result.totalSlots).toBe(24);
            expect(result.pitchMinutes).toBe(20);
            expect(result.slots.length).toBe(24);
        });

        it('distributes total demand correctly', () => {
            const result = calculateHeijunka(products, 480, 20, '08:00');

            const summaryA = result.productSummaries.find(s => s.productId === 'A');
            const summaryB = result.productSummaries.find(s => s.productId === 'B');
            const summaryC = result.productSummaries.find(s => s.productId === 'C');

            expect(summaryA?.totalAssigned).toBe(300);
            expect(summaryB?.totalAssigned).toBe(150);
            expect(summaryC?.totalAssigned).toBe(50);
        });

        it('builds schedule with correct times', () => {
            const result = calculateHeijunka(products, 480, 20, '08:00');

            expect(result.slots[0].startTime).toBe('08:00');
            expect(result.slots[0].endTime).toBe('08:20');
            expect(result.slots[1].startTime).toBe('08:20');
            expect(result.slots[1].endTime).toBe('08:40');
        });

        it('detects capacity issues', () => {
            const problemProducts: ProductDemand[] = [
                { productId: 'P', productName: 'Problem', dailyDemand: 100, cycleTimeSeconds: 2000, color: '#EF4444' }
            ];

            // Pitch = 20 min = 1200 sec, cycle = 2000 sec > pitch
            const result = calculateHeijunka(problemProducts, 480, 20, '08:00');

            expect(result.isFeasible).toBe(false);
            expect(result.capacityAlerts.some(a => a.severity === 'critical')).toBe(true);
        });
    });

    describe('getProductColor', () => {
        it('returns consistent colors for same index', () => {
            expect(getProductColor(0)).toBe('#3B82F6'); // Blue
            expect(getProductColor(1)).toBe('#10B981'); // Green
        });

        it('cycles through colors for high indices', () => {
            // Should cycle after 8 colors
            expect(getProductColor(8)).toBe(getProductColor(0));
        });
    });
});
