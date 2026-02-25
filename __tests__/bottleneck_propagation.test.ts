/**
 * Integration Test: Bottleneck Propagation
 * 
 * Verifies that the real cycle time (bottleneck) is correctly used
 * in capacity calculations, not the theoretical Takt×OEE value.
 * 
 * @module __tests__/bottleneck_propagation.test
 * @version 1.0.0 - Hallazgo #4 Implementation
 */

import { describe, it, expect } from 'vitest';
import { calculateCapacity, calculateSemaphoreStatus } from '../components/ui/TaktSemaphore';

describe('Bottleneck Propagation Integration', () => {
    describe('calculateCapacity with real bottleneck', () => {
        it('should use bottleneck time when it exceeds takt', () => {
            // Scenario: Takt = 60s, but bottleneck station takes 75s
            const availableTime = 28800; // 8 hours in seconds
            const bottleneckTime = 75;   // Real bottleneck (slowest station)
            const taktTime = 60;         // Expected by customer

            const capacity = calculateCapacity(availableTime, bottleneckTime, taktTime);

            // Should use bottleneck (384 pieces), not takt (480 pieces)
            // 28800 / 75 = 384
            expect(capacity).toBeCloseTo(384, 0);
        });

        it('should use takt when bottleneck is faster than takt', () => {
            // Good balance: bottleneck is under takt time
            const availableTime = 28800;
            const bottleneckTime = 50;   // Bottleneck is faster than takt
            const taktTime = 60;

            const capacity = calculateCapacity(availableTime, bottleneckTime, taktTime);

            // Should use bottleneck since it's valid and > 0
            // 28800 / 50 = 576
            expect(capacity).toBeCloseTo(576, 0);
        });

        it('should fall back to takt when bottleneck is 0', () => {
            // No assignments yet, bottleneck is 0
            const availableTime = 28800;
            const bottleneckTime = 0;
            const taktTime = 60;

            const capacity = calculateCapacity(availableTime, bottleneckTime, taktTime);

            // Should fall back to takt: 28800 / 60 = 480
            expect(capacity).toBeCloseTo(480, 0);
        });
    });

    describe('Semaphore status with bottleneck consideration', () => {
        it('should show RED when bottleneck exceeds takt with high demand', () => {
            // Scenario: Customer demands 450 pieces, but bottleneck limits us to 384
            const availableTime = 28800;
            const bottleneckTime = 75;   // 75s bottleneck
            const taktTime = 60;
            const demand = 450;          // Requires 60s takt, but we have 75s

            const capacity = calculateCapacity(availableTime, bottleneckTime, taktTime);
            const status = calculateSemaphoreStatus(capacity, demand);

            expect(status.status).toBe('red');
            expect(status.marginPercent).toBeLessThan(0);
        });

        it('should show GREEN when bottleneck is well under demand', () => {
            // Scenario: Good balance, plenty of capacity
            const availableTime = 28800;
            const bottleneckTime = 50;
            const taktTime = 60;
            const demand = 400;          // We can produce 576, demand is 400

            const capacity = calculateCapacity(availableTime, bottleneckTime, taktTime);
            const status = calculateSemaphoreStatus(capacity, demand);

            expect(status.status).toBe('green');
            expect(status.marginPercent).toBeGreaterThan(10);
        });

        it('should show YELLOW when capacity is tight', () => {
            // Scenario: Capacity barely meets demand
            const availableTime = 28800;
            const bottleneckTime = 55;   // 28800/55 = 523 capacity
            const taktTime = 60;
            const demand = 510;          // 2.6% margin

            const capacity = calculateCapacity(availableTime, bottleneckTime, taktTime);
            const status = calculateSemaphoreStatus(capacity, demand);

            expect(status.status).toBe('yellow');
        });
    });

    describe('Edge cases', () => {
        it('should handle zero demand gracefully', () => {
            const capacity = calculateCapacity(28800, 60, 60);
            const status = calculateSemaphoreStatus(capacity, 0);

            expect(status.status).toBe('green');
            expect(status.label).toBe('SIN DEMANDA');
        });

        it('should handle zero available time', () => {
            const capacity = calculateCapacity(0, 60, 60);

            expect(capacity).toBe(0);
        });
    });
});
