/**
 * TaktSemaphore Logic Tests
 * 
 * Tests for the semaphore status calculation that determines
 * whether production capacity meets customer demand.
 * 
 * @module __tests__/takt_semaphore.test
 * @version 1.0.0 - Phase 1 Completion
 */

import { describe, it, expect } from 'vitest';
import { calculateSemaphoreStatus, calculateCapacity } from '../components/ui/TaktSemaphore';

describe('TaktSemaphore Logic', () => {
    describe('calculateSemaphoreStatus', () => {
        it('should return GREEN when capacity > demand + 10%', () => {
            // 1200 capacity vs 1000 demand = 20% margin
            const result = calculateSemaphoreStatus(1200, 1000);
            expect(result.status).toBe('green');
            expect(result.label).toBe('CUMPLE DEMANDA');
            expect(result.marginPercent).toBeCloseTo(20, 1);
            expect(result.gap).toBe(200);
        });

        it('should return GREEN at exactly 10% margin', () => {
            // 1100 capacity vs 1000 demand = 10% margin
            const result = calculateSemaphoreStatus(1100, 1000);
            expect(result.status).toBe('green');
            expect(result.marginPercent).toBeCloseTo(10, 1);
        });

        it('should return YELLOW when capacity >= demand but < 10% margin', () => {
            // 1050 capacity vs 1000 demand = 5% margin
            const result = calculateSemaphoreStatus(1050, 1000);
            expect(result.status).toBe('yellow');
            expect(result.label).toBe('MARGEN AJUSTADO');
            expect(result.marginPercent).toBeCloseTo(5, 1);
        });

        it('should return YELLOW at exactly 0% margin', () => {
            // 1000 capacity vs 1000 demand = 0% margin
            const result = calculateSemaphoreStatus(1000, 1000);
            expect(result.status).toBe('yellow');
            expect(result.marginPercent).toBe(0);
        });

        it('should return RED when capacity < demand', () => {
            // 950 capacity vs 1000 demand = -5% margin
            const result = calculateSemaphoreStatus(950, 1000);
            expect(result.status).toBe('red');
            expect(result.label).toBe('NO CUMPLE DEMANDA');
            expect(result.marginPercent).toBeCloseTo(-5, 1);
            expect(result.gap).toBe(-50);
        });

        it('should return RED for severe shortfall', () => {
            // 500 capacity vs 1000 demand = -50% margin
            const result = calculateSemaphoreStatus(500, 1000);
            expect(result.status).toBe('red');
            expect(result.marginPercent).toBeCloseTo(-50, 1);
            expect(result.gap).toBe(-500);
        });

        it('should handle zero demand gracefully', () => {
            const result = calculateSemaphoreStatus(1000, 0);
            expect(result.status).toBe('green');
            expect(result.label).toBe('SIN DEMANDA');
        });

        it('should handle zero capacity', () => {
            const result = calculateSemaphoreStatus(0, 1000);
            expect(result.status).toBe('red');
            expect(result.label).toBe('SIN CAPACIDAD');
        });

        it('should include correct message for green status', () => {
            const result = calculateSemaphoreStatus(1320, 1200);
            expect(result.status).toBe('green');
            // Check message contains the capacity (locale may use . or ,)
            expect(result.message).toMatch(/1[.,]?320/);
            expect(result.message).toContain('+10.0% margen');
        });
    });

    describe('calculateCapacity', () => {
        it('should calculate capacity from available time and bottleneck', () => {
            // 8 hours = 28800 seconds, 60s bottleneck = 480 pieces
            const capacity = calculateCapacity(28800, 60, 50);
            expect(capacity).toBe(480);
        });

        it('should use takt time when bottleneck is 0', () => {
            // No bottleneck, use takt of 50s
            const capacity = calculateCapacity(28800, 0, 50);
            expect(capacity).toBeCloseTo(576, 0);
        });

        it('should return 0 when cycle time is 0', () => {
            const capacity = calculateCapacity(28800, 0, 0);
            expect(capacity).toBe(0);
        });

        it('should handle typical industrial scenario', () => {
            // 14.6 hours net = 52560 seconds
            // Takt = 43.8 seconds
            // Capacity = 52560 / 43.8 = 1200 pieces
            const capacity = calculateCapacity(52560, 43.8, 43.8);
            expect(capacity).toBeCloseTo(1200, 0);
        });
    });

    describe('Integration Scenarios', () => {
        it('should correctly evaluate typical production scenario - GREEN', () => {
            // Scenario: 2 shifts, 8h each, 30min breaks each
            // Net time: 2 * (480 - 30) * 60 = 54000 seconds
            // Demand: 900 pieces
            // Takt: 54000 / 900 = 60 seconds
            // Bottleneck: 55 seconds (good)
            // Capacity: 54000 / 55 = 981 pieces
            // Margin: (981 - 900) / 900 = 9%
            const capacity = calculateCapacity(54000, 55, 60);
            const result = calculateSemaphoreStatus(capacity, 900);

            expect(result.status).toBe('yellow'); // 9% is < 10%
            expect(result.marginPercent).toBeCloseTo(9.1, 0);
        });

        it('should correctly evaluate typical production scenario - RED', () => {
            // Same as above but bottleneck is 65 seconds
            // Capacity: 54000 / 65 = 830 pieces
            // Margin: (830 - 900) / 900 = -7.8%
            const capacity = calculateCapacity(54000, 65, 60);
            const result = calculateSemaphoreStatus(capacity, 900);

            expect(result.status).toBe('red');
            expect(result.marginPercent).toBeCloseTo(-7.7, 0);
        });
    });
});
