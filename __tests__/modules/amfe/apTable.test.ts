import { describe, it, expect } from 'vitest';
import { calculateAP } from '../../../modules/amfe/apTable';

describe('calculateAP — AIAG-VDA 2019 PFMEA Action Priority', () => {

    describe('valid inputs', () => {
        it('returns H, M, or L for every 1-10 combination', () => {
            for (let s = 1; s <= 10; s++)
                for (let o = 1; o <= 10; o++)
                    for (let d = 1; d <= 10; d++)
                        expect(['H', 'M', 'L']).toContain(calculateAP(s, o, d));
        });
    });

    describe('S=1 — always L', () => {
        it('returns L for every O/D', () => {
            for (let o = 1; o <= 10; o++)
                for (let d = 1; d <= 10; d++)
                    expect(calculateAP(1, o, d)).toBe('L');
        });
    });

    describe('S=2-3', () => {
        it.each([2, 3])('S=%i: O>=8, D>=5 -> M', (s) => {
            expect(calculateAP(s, 8, 5)).toBe('M');
            expect(calculateAP(s, 10, 10)).toBe('M');
        });
        it.each([2, 3])('S=%i: O>=8, D<=4 -> L', (s) => {
            expect(calculateAP(s, 8, 1)).toBe('L');
            expect(calculateAP(s, 8, 4)).toBe('L');
        });
        it.each([2, 3])('S=%i: O<=7 -> L', (s) => {
            expect(calculateAP(s, 1, 1)).toBe('L');
            expect(calculateAP(s, 7, 10)).toBe('L');
        });
    });

    describe('S=4-6', () => {
        it.each([4, 5, 6])('S=%i: O>=8, D>=5 -> H', (s) => {
            expect(calculateAP(s, 8, 5)).toBe('H');
            expect(calculateAP(s, 10, 10)).toBe('H');
        });
        it.each([4, 5, 6])('S=%i: O>=8, D<=4 -> M', (s) => {
            expect(calculateAP(s, 8, 1)).toBe('M');
            expect(calculateAP(s, 10, 4)).toBe('M');
        });
        it.each([4, 5, 6])('S=%i: O=6-7, D>=2 -> M', (s) => {
            expect(calculateAP(s, 6, 2)).toBe('M');
            expect(calculateAP(s, 6, 6)).toBe('M');
            expect(calculateAP(s, 7, 10)).toBe('M');
        });
        it.each([4, 5, 6])('S=%i: O=6-7, D=1 -> L', (s) => {
            expect(calculateAP(s, 6, 1)).toBe('L');
            expect(calculateAP(s, 7, 1)).toBe('L');
        });
        it.each([4, 5, 6])('S=%i: O=4-5, D>=7 -> M', (s) => {
            expect(calculateAP(s, 4, 7)).toBe('M');
            expect(calculateAP(s, 5, 10)).toBe('M');
        });
        it.each([4, 5, 6])('S=%i: O=4-5, D<=6 -> L', (s) => {
            expect(calculateAP(s, 4, 1)).toBe('L');
            expect(calculateAP(s, 5, 5)).toBe('L');
        });
        it.each([4, 5, 6])('S=%i: O<=3 -> L', (s) => {
            expect(calculateAP(s, 1, 1)).toBe('L');
            expect(calculateAP(s, 3, 10)).toBe('L');
        });
    });

    describe('S=7-8', () => {
        it.each([7, 8])('S=%i: O>=8 -> H', (s) => {
            expect(calculateAP(s, 8, 1)).toBe('H');
            expect(calculateAP(s, 10, 5)).toBe('H');
        });
        it.each([7, 8])('S=%i: O=6-7, D>=2 -> H', (s) => {
            expect(calculateAP(s, 6, 2)).toBe('H');
            expect(calculateAP(s, 7, 10)).toBe('H');
        });
        it.each([7, 8])('S=%i: O=6-7, D=1 -> M', (s) => {
            expect(calculateAP(s, 6, 1)).toBe('M');
            expect(calculateAP(s, 7, 1)).toBe('M');
        });
        it.each([7, 8])('S=%i: O=4-5, D>=7 -> H', (s) => {
            expect(calculateAP(s, 4, 7)).toBe('H');
            expect(calculateAP(s, 5, 10)).toBe('H');
        });
        it.each([7, 8])('S=%i: O=4-5, D<=6 -> M', (s) => {
            expect(calculateAP(s, 4, 1)).toBe('M');
            expect(calculateAP(s, 5, 5)).toBe('M');
        });
        it.each([7, 8])('S=%i: O=2-3, D>=5 -> M', (s) => {
            expect(calculateAP(s, 2, 5)).toBe('M');
            expect(calculateAP(s, 3, 10)).toBe('M');
        });
        it.each([7, 8])('S=%i: O=2-3, D<=4 -> L', (s) => {
            expect(calculateAP(s, 2, 1)).toBe('L');
            expect(calculateAP(s, 2, 4)).toBe('L');
        });
        it.each([7, 8])('S=%i: O=1 -> L', (s) => {
            expect(calculateAP(s, 1, 1)).toBe('L');
            expect(calculateAP(s, 1, 10)).toBe('L');
        });
    });

    describe('S=9-10', () => {
        it.each([9, 10])('S=%i: O>=6 -> H', (s) => {
            expect(calculateAP(s, 6, 1)).toBe('H');
            expect(calculateAP(s, 10, 10)).toBe('H');
        });
        it.each([9, 10])('S=%i: O=4-5, D>=2 -> H', (s) => {
            expect(calculateAP(s, 4, 2)).toBe('H');
            expect(calculateAP(s, 5, 10)).toBe('H');
        });
        it.each([9, 10])('S=%i: O=4-5, D=1 -> M', (s) => {
            expect(calculateAP(s, 4, 1)).toBe('M');
            expect(calculateAP(s, 5, 1)).toBe('M');
        });
        it.each([9, 10])('S=%i: O=2-3, D>=7 -> H', (s) => {
            expect(calculateAP(s, 2, 7)).toBe('H');
            expect(calculateAP(s, 3, 10)).toBe('H');
        });
        it.each([9, 10])('S=%i: O=2-3, D=5-6 -> M', (s) => {
            expect(calculateAP(s, 2, 5)).toBe('M');
            expect(calculateAP(s, 3, 6)).toBe('M');
        });
        it.each([9, 10])('S=%i: O=2-3, D<=4 -> L', (s) => {
            expect(calculateAP(s, 2, 1)).toBe('L');
            expect(calculateAP(s, 3, 4)).toBe('L');
        });
        it.each([9, 10])('S=%i: O=1 -> L', (s) => {
            expect(calculateAP(s, 1, 1)).toBe('L');
            expect(calculateAP(s, 1, 10)).toBe('L');
        });
    });

    describe('previously broken edge cases', () => {
        it('S=10,O=1,D=1 -> L (was M)', () => expect(calculateAP(10, 1, 1)).toBe('L'));
        it('S=10,O=1,D=4 -> L (was H)', () => expect(calculateAP(10, 1, 4)).toBe('L'));
        it('S=9,O=1,D=5 -> L (was H)', () => expect(calculateAP(9, 1, 5)).toBe('L'));
        it('S=9,O=2,D=2 -> L (was M)', () => expect(calculateAP(9, 2, 2)).toBe('L'));
        it('S=8,O=6,D=4 -> H (was M)', () => expect(calculateAP(8, 6, 4)).toBe('H'));
        it('S=7,O=6,D=5 -> H (was M)', () => expect(calculateAP(7, 6, 5)).toBe('H'));
        it('S=7,O=1,D=7 -> L (was M)', () => expect(calculateAP(7, 1, 7)).toBe('L'));
        it('S=6,O=8,D=5 -> H (was M)', () => expect(calculateAP(6, 8, 5)).toBe('H'));
        it('S=6,O=4,D=5 -> L (was M)', () => expect(calculateAP(6, 4, 5)).toBe('L'));
        it('S=6,O=6,D=1 -> L (was M)', () => expect(calculateAP(6, 6, 1)).toBe('L'));
        it('S=6,O=6,D=6 -> M', () => expect(calculateAP(6, 6, 6)).toBe('M'));
        it('S=4,O=8,D=5 -> H (was M)', () => expect(calculateAP(4, 8, 5)).toBe('H'));
    });

    describe('invalid inputs', () => {
        it('returns empty for out-of-range', () => {
            expect(calculateAP(0, 5, 5)).toBe('');
            expect(calculateAP(11, 5, 5)).toBe('');
            expect(calculateAP(5, 0, 5)).toBe('');
            expect(calculateAP(5, 5, 11)).toBe('');
        });
        it('returns empty for NaN', () => {
            expect(calculateAP(NaN, 5, 5)).toBe('');
            expect(calculateAP(5, NaN, 5)).toBe('');
            expect(calculateAP(5, 5, NaN)).toBe('');
        });
    });

    describe('rounding', () => {
        it('rounds decimals', () => expect(calculateAP(5.4, 5.4, 5.4)).toBe(calculateAP(5, 5, 5)));
        it('rounds 0.5 up', () => expect(calculateAP(0.5, 5, 5)).toBe(calculateAP(1, 5, 5)));
        it('rounds 10.4 to 10', () => expect(calculateAP(10.4, 5, 5)).toBe(calculateAP(10, 5, 5)));
        it('rounds 10.6 to 11 (invalid)', () => expect(calculateAP(10.6, 5, 5)).toBe(''));
    });
});
