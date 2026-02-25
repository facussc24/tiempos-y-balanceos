/**
 * Unit tests for math utilities.
 */
import { describe, it, expect } from 'vitest';
import { calculateStandardDeviation, isOutlier } from '../utils/math';

describe('calculateStandardDeviation', () => {
    it('should return 0 for arrays with less than 2 valid values', () => {
        expect(calculateStandardDeviation([])).toBe(0);
        expect(calculateStandardDeviation([null])).toBe(0);
        expect(calculateStandardDeviation([10])).toBe(0);
        expect(calculateStandardDeviation([null, null])).toBe(0);
    });

    it('should calculate correct standard deviation for known values', () => {
        // For [10, 20, 30], mean=20, variance=100 (sample), stdDev=10
        const result = calculateStandardDeviation([10, 20, 30]);
        expect(result).toBeCloseTo(10, 1);
    });

    it('should ignore null and zero values', () => {
        const result = calculateStandardDeviation([10, null, 20, 0, 30]);
        expect(result).toBeCloseTo(10, 1);
    });
});

describe('isOutlier', () => {
    it('should identify values outside 2 stdDev', () => {
        // mean=100, stdDev=10 -> range [80, 120]
        expect(isOutlier(79, 100, 10)).toBe(true);
        expect(isOutlier(121, 100, 10)).toBe(true);
        expect(isOutlier(90, 100, 10)).toBe(false);
        expect(isOutlier(110, 100, 10)).toBe(false);
    });

    it('should return false for zero or negative values', () => {
        expect(isOutlier(0, 100, 10)).toBe(false);
        expect(isOutlier(-5, 100, 10)).toBe(false);
    });
});
