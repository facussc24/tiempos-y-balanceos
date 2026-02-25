import { describe, it, expect } from 'vitest';
import { calculateAP } from '../../../modules/amfe/apTable';

describe('calculateAP', () => {
    describe('valid inputs', () => {
        it('returns a valid AP for any 1-10 combination', () => {
            for (let s = 1; s <= 10; s++) {
                for (let o = 1; o <= 10; o++) {
                    for (let d = 1; d <= 10; d++) {
                        const result = calculateAP(s, o, d);
                        expect(['H', 'M', 'L']).toContain(result);
                    }
                }
            }
        });
    });

    describe('Severity 10 (Safety/Regulatory)', () => {
        it('returns H for most combinations', () => {
            expect(calculateAP(10, 5, 5)).toBe('H');
            expect(calculateAP(10, 10, 10)).toBe('H');
            expect(calculateAP(10, 3, 3)).toBe('H');
        });

        it('returns M for very low O and D', () => {
            expect(calculateAP(10, 1, 1)).toBe('M');
            expect(calculateAP(10, 2, 2)).toBe('M');
            expect(calculateAP(10, 1, 3)).toBe('M');
        });

        it('never returns L', () => {
            for (let o = 1; o <= 10; o++) {
                for (let d = 1; d <= 10; d++) {
                    expect(calculateAP(10, o, d)).not.toBe('L');
                }
            }
        });
    });

    describe('Severity 9 (Safety with warning)', () => {
        it('returns H for most combinations', () => {
            expect(calculateAP(9, 5, 5)).toBe('H');
            expect(calculateAP(9, 10, 10)).toBe('H');
        });

        it('returns M for low O and D', () => {
            expect(calculateAP(9, 1, 1)).toBe('M');
            expect(calculateAP(9, 2, 3)).toBe('M');
            expect(calculateAP(9, 3, 2)).toBe('M');
        });

        it('never returns L', () => {
            for (let o = 1; o <= 10; o++) {
                for (let d = 1; d <= 10; d++) {
                    expect(calculateAP(9, o, d)).not.toBe('L');
                }
            }
        });
    });

    describe('Severity 1 (No effect)', () => {
        it('always returns L', () => {
            for (let o = 1; o <= 10; o++) {
                for (let d = 1; d <= 10; d++) {
                    expect(calculateAP(1, o, d)).toBe('L');
                }
            }
        });
    });

    describe('Severity 2 (Very low)', () => {
        it('returns L for most combinations', () => {
            expect(calculateAP(2, 1, 1)).toBe('L');
            expect(calculateAP(2, 5, 5)).toBe('L');
            expect(calculateAP(2, 8, 8)).toBe('L');
        });

        it('returns M only for O=10, D=10', () => {
            expect(calculateAP(2, 10, 10)).toBe('M');
        });
    });

    describe('Severity 3 (Low)', () => {
        it('returns L for most combinations', () => {
            expect(calculateAP(3, 1, 1)).toBe('L');
            expect(calculateAP(3, 5, 5)).toBe('L');
        });

        it('returns M for very high O and D', () => {
            expect(calculateAP(3, 10, 10)).toBe('M');
            expect(calculateAP(3, 9, 9)).toBe('M');
        });
    });

    describe('Mid-range severity (5-7)', () => {
        it('S=5 with low O/D returns L', () => {
            expect(calculateAP(5, 2, 2)).toBe('L');
            expect(calculateAP(5, 4, 4)).toBe('L');
        });

        it('S=5 with moderate O/D returns M', () => {
            expect(calculateAP(5, 6, 6)).toBe('M');
        });

        it('S=7 with high O/D returns H', () => {
            expect(calculateAP(7, 8, 8)).toBe('H');
            expect(calculateAP(7, 9, 5)).toBe('H');
        });

        it('S=7 with low O/D returns L', () => {
            expect(calculateAP(7, 1, 1)).toBe('L');
            expect(calculateAP(7, 2, 3)).toBe('L');
        });
    });

    describe('invalid inputs', () => {
        it('returns empty string for S < 1', () => {
            expect(calculateAP(0, 5, 5)).toBe('');
        });

        it('returns empty string for S > 10', () => {
            expect(calculateAP(11, 5, 5)).toBe('');
        });

        it('returns empty string for O < 1', () => {
            expect(calculateAP(5, 0, 5)).toBe('');
        });

        it('returns empty string for D > 10', () => {
            expect(calculateAP(5, 5, 11)).toBe('');
        });

        it('returns empty string for NaN', () => {
            expect(calculateAP(NaN, 5, 5)).toBe('');
            expect(calculateAP(5, NaN, 5)).toBe('');
            expect(calculateAP(5, 5, NaN)).toBe('');
        });
    });

    describe('rounding', () => {
        it('rounds decimal values to nearest integer', () => {
            // 5.4 rounds to 5, 5.6 rounds to 6
            const result1 = calculateAP(5, 5, 5);
            const result2 = calculateAP(5.4, 5.4, 5.4);
            expect(result2).toBe(result1);
        });

        it('rounds 0.5 up (to 1) and treats as valid', () => {
            const result = calculateAP(0.5, 5, 5);
            // 0.5 rounds to 1 which is valid
            expect(result).toBe(calculateAP(1, 5, 5));
        });

        it('rounds 10.4 to 10 and treats as valid', () => {
            const result = calculateAP(10.4, 5, 5);
            expect(result).toBe(calculateAP(10, 5, 5));
        });

        it('rounds 10.6 to 11 and returns empty', () => {
            expect(calculateAP(10.6, 5, 5)).toBe('');
        });
    });
});
