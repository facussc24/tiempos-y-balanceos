import { describe, it, expect } from 'vitest';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';

describe('sanitizeCellValue', () => {
    it('returns empty string for null', () => {
        expect(sanitizeCellValue(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
        expect(sanitizeCellValue(undefined)).toBe('');
    });

    it('passes through numbers unchanged', () => {
        expect(sanitizeCellValue(42)).toBe(42);
        expect(sanitizeCellValue(0)).toBe(0);
        expect(sanitizeCellValue(-5)).toBe(-5);
    });

    it('passes through normal strings unchanged', () => {
        expect(sanitizeCellValue('Hello World')).toBe('Hello World');
        expect(sanitizeCellValue('SPC')).toBe('SPC');
        expect(sanitizeCellValue('10±0.5mm')).toBe('10±0.5mm');
    });

    it('prefixes strings starting with = to prevent formula injection', () => {
        expect(sanitizeCellValue('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
        expect(sanitizeCellValue('=HYPERLINK("http://evil.com")')).toBe("'=HYPERLINK(\"http://evil.com\")");
    });

    it('prefixes strings starting with @', () => {
        expect(sanitizeCellValue('@mention')).toBe("'@mention");
    });

    it('prefixes strings starting with +', () => {
        expect(sanitizeCellValue('+1234')).toBe("'+1234");
    });

    it('prefixes strings starting with -', () => {
        expect(sanitizeCellValue('-danger')).toBe("'-danger");
    });

    it('prefixes strings starting with tab character', () => {
        expect(sanitizeCellValue('\tvalue')).toBe("'\tvalue");
    });

    it('prefixes strings starting with carriage return', () => {
        expect(sanitizeCellValue('\rvalue')).toBe("'\rvalue");
    });

    it('prefixes strings starting with newline', () => {
        expect(sanitizeCellValue('\nvalue')).toBe("'\nvalue");
    });

    it('does not prefix empty string', () => {
        expect(sanitizeCellValue('')).toBe('');
    });

    it('does not prefix strings with dangerous chars in the middle', () => {
        expect(sanitizeCellValue('a=b')).toBe('a=b');
        expect(sanitizeCellValue('foo+bar')).toBe('foo+bar');
        expect(sanitizeCellValue('hello@world')).toBe('hello@world');
    });
});
