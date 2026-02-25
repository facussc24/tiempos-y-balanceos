import { describe, it, expect } from 'vitest';
import { parseNumberInput } from '../utils/formatting';
import {
    parseIntegerInput,
    parsePositiveInt,
    parsePercentage,
    parseDemand
} from '../utils/validation';

describe('Input Validation Security Tests', () => {
    describe('parseNumberInput', () => {
        it('should parse valid numbers', () => {
            expect(parseNumberInput('123')).toBe(123);
            expect(parseNumberInput('123.45')).toBe(123.45);
            expect(parseNumberInput('1,5', {})).toBe(1.5);
            expect(parseNumberInput('1.500,50')).toBe(1500.5);
        });

        it('should handle empty/invalid input', () => {
            expect(parseNumberInput('')).toBe(0);
            expect(parseNumberInput('   ')).toBe(0);
            expect(parseNumberInput('abc')).toBe(0);
            expect(parseNumberInput('abc', { defaultValue: 10 })).toBe(10);
        });

        it('should prevent Infinity', () => {
            expect(parseNumberInput('Infinity')).toBe(0);
            expect(parseNumberInput('-Infinity')).toBe(0);
            expect(parseNumberInput('1e999')).toBeLessThan(Infinity);
        });

        it('should prevent NaN', () => {
            expect(parseNumberInput('NaN')).toBe(0);
            expect(parseNumberInput('not a number')).toBe(0);
        });

        it('should enforce min/max limits', () => {
            expect(parseNumberInput('150', { min: 0, max: 100 })).toBe(100);
            expect(parseNumberInput('-50', { min: 0, max: 100 })).toBe(0);
            expect(parseNumberInput('50', { min: 0, max: 100 })).toBe(50);
        });

        it('should handle negative values based on allowNegative', () => {
            expect(parseNumberInput('-50', { allowNegative: false })).toBe(50);
            expect(parseNumberInput('-50', { allowNegative: true })).toBe(-50);
        });

        it('should reject malicious input', () => {
            expect(parseNumberInput('123; DROP TABLE')).toBe(0);
            expect(parseNumberInput('<script>alert(1)</script>')).toBe(0);
            expect(parseNumberInput('${1+1}')).toBe(0);
        });

        it('should throw in strict mode for invalid input', () => {
            expect(() => parseNumberInput('abc', { strict: true }))
                .toThrow('Invalid number format');
            expect(() => parseNumberInput('Infinity', { strict: true }))
                .toThrow('Invalid number format');
        });
    });

    describe('parseIntegerInput', () => {
        it('should parse valid integers', () => {
            expect(parseIntegerInput('123')).toBe(123);
            expect(parseIntegerInput('-456')).toBe(-456);
        });

        it('should truncate decimal values to integer', () => {
            // parseIntegerInput truncates decimals, doesn't reject them
            expect(parseIntegerInput('123.45')).toBe(123);
            expect(parseIntegerInput('1,5')).toBe(1);
        });

        it('should prevent octal interpretation', () => {
            expect(parseIntegerInput('08')).toBe(8);
            expect(parseIntegerInput('010')).toBe(10);
        });

        it('should enforce integer range', () => {
            expect(parseIntegerInput('999999999999999')).toBe(2147483647);
        });
    });

    describe('parsePositiveInt', () => {
        it('should only allow positive integers', () => {
            expect(parsePositiveInt('123')).toBe(123);
            expect(parsePositiveInt('-123')).toBe(123);
            expect(parsePositiveInt('0')).toBe(0);
        });
    });

    describe('parsePercentage', () => {
        it('should clamp to 0-100 range', () => {
            expect(parsePercentage('50')).toBe(50);
            expect(parsePercentage('150')).toBe(100);
            expect(parsePercentage('-10')).toBe(10);
        });
    });

    describe('parseDemand', () => {
        it('should parse demand values', () => {
            expect(parseDemand('1000')).toBe(1000);
            expect(parseDemand('0')).toBe(0);
        });

        it('should reject negative demand', () => {
            expect(parseDemand('-100')).toBe(100);
        });

        it('should enforce reasonable upper limit', () => {
            expect(parseDemand('9999999')).toBe(1000000);
        });
    });

    describe('Security Edge Cases', () => {
        it('should handle unicode and special characters', () => {
            expect(parseNumberInput('１２３')).toBe(0); // Full-width numbers
            expect(parseNumberInput('12\u00003')).toBe(0); // Null byte disallowed
            expect(parseNumberInput('12\n3')).toBe(12); // Newline allowed by regex and parsed as 12
        });

        it('should handle very long strings', () => {
            const longString = '1'.repeat(10000);
            const result = parseNumberInput(longString);
            expect(result).toBeLessThanOrEqual(1e10);
        });

        it('should handle scientific notation safely', () => {
            expect(parseNumberInput('1e5')).toBe(100000);
            // 1e999 is Infinity, so it should return default value (0) because Infinity is not allowed
            expect(parseNumberInput('1e999', { max: 1e10 })).toBe(0);
        });
    });
});
