/**
 * GlobalStatusSemaphore Tests - Phase 9
 * 
 * Tests for the global production status semaphore widget.
 */
import { describe, it, expect } from 'vitest';
import { calculateGlobalStatus, SemaphoreStatus } from '../components/ui/GlobalStatusSemaphore';

describe('GlobalStatusSemaphore (Phase 9)', () => {
    describe('calculateGlobalStatus', () => {
        it('should return green when TCR is significantly below Takt', () => {
            // TCR = 40s, Takt = 60s => ratio = 0.67 (33% under)
            const result = calculateGlobalStatus(40, 60);

            expect(result.status).toBe('green');
            expect(result.percentage).toBeGreaterThan(0);
            expect(result.message).toContain('OK');
        });

        it('should return green when TCR is exactly 90% of Takt', () => {
            // TCR = 54s, Takt = 60s => ratio = 0.90 (exactly 10% margin)
            const result = calculateGlobalStatus(54, 60);

            expect(result.status).toBe('green');
        });

        it('should return yellow when TCR is between 90-100% of Takt', () => {
            // TCR = 57s, Takt = 60s => ratio = 0.95 (5% margin)
            const result = calculateGlobalStatus(57, 60);

            expect(result.status).toBe('yellow');
            expect(result.message).toContain('justa');
        });

        it('should return yellow when TCR equals Takt exactly', () => {
            // TCR = 60s, Takt = 60s => ratio = 1.0
            const result = calculateGlobalStatus(60, 60);

            expect(result.status).toBe('yellow');
        });

        it('should return red when TCR exceeds Takt', () => {
            // TCR = 70s, Takt = 60s => ratio = 1.17 (17% over)
            const result = calculateGlobalStatus(70, 60);

            expect(result.status).toBe('red');
            expect(result.message).toContain('Déficit');
        });

        it('should return unknown when Takt is zero', () => {
            const result = calculateGlobalStatus(60, 0);

            expect(result.status).toBe('unknown');
        });

        it('should return unknown when TCR is zero', () => {
            const result = calculateGlobalStatus(0, 60);

            expect(result.status).toBe('unknown');
        });

        it('should calculate correct percentage for green status', () => {
            // TCR = 50s, Takt = 100s => 50% under
            const result = calculateGlobalStatus(50, 100);

            expect(result.status).toBe('green');
            expect(result.percentage).toBe(50);
        });

        it('should calculate correct negative percentage for red status', () => {
            // TCR = 120s, Takt = 100s => -20% (20% over)
            const result = calculateGlobalStatus(120, 100);

            expect(result.status).toBe('red');
            expect(result.percentage).toBe(-20);
        });
    });
});
