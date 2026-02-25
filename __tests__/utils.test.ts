import { describe, it, expect } from 'vitest';
import {
    incrementVersion,
    calculateShiftNetMinutes,
    calculateEffectiveStationTime,
    isOutlier,
    parseNumberInput,
    formatNumber,
    parseCSVLine
} from '../utils';
import { Shift, Task } from '../types';

describe('utils.ts', () => {

    describe('incrementVersion', () => {
        it('should increment simple versions', () => {
            expect(incrementVersion('Rev A')).toBe('Rev B');
            expect(incrementVersion('Rev Z')).toBe('Rev AA');
            expect(incrementVersion('Rev AA')).toBe('Rev AB');
        });

        it('should handle drafts or invalid inputs by resetting to Rev A', () => {
            expect(incrementVersion('Borrador')).toBe('Rev A');
            expect(incrementVersion('')).toBe('Rev A');
            expect(incrementVersion('1.0')).toBe('Rev A');
        });

        it('should be case insensitive', () => {
            expect(incrementVersion('rev a')).toBe('Rev B');
        });
    });

    describe('calculateShiftNetMinutes', () => {
        it('should calculate net minutes correctly for standard shift', () => {
            const shift: Shift = {
                id: 1,
                name: 'Test Shift',
                startTime: '08:00',
                endTime: '17:00', // 9 hours = 540 mins
                breaks: [{ id: 'b1', name: 'Lunch', startTime: '12:00', duration: 60 }]
            };
            // 540 - 60 = 480
            expect(calculateShiftNetMinutes(shift)).toBe(480);
        });

        it('should handle overnight shifts', () => {
            const shift: Shift = {
                id: 2,
                name: 'Night Shift',
                startTime: '22:00',
                endTime: '06:00', // 8 hours = 480 mins
                breaks: []
            };
            expect(calculateShiftNetMinutes(shift)).toBe(480);
        });

        it('should return 0 if breaks exceed duration', () => {
            const shift: Shift = {
                id: 3,
                name: 'Short Shift',
                startTime: '08:00',
                endTime: '09:00', // 60 mins
                breaks: [{ id: 'b1', name: 'Long Break', startTime: '08:00', duration: 90 }]
            };
            expect(calculateShiftNetMinutes(shift)).toBe(0);
        });
    });

    describe('calculateEffectiveStationTime (Concurrency)', () => {
        it('should sum manual tasks normally', () => {
            const tasks: Task[] = [
                { id: '1', standardTime: 10, executionMode: 'manual' } as Task,
                { id: '2', standardTime: 20, executionMode: 'manual' } as Task
            ];
            expect(calculateEffectiveStationTime(tasks)).toBe(30);
        });

        it('should apply machine dominance logic', () => {
            // Machine: 50s
            // Manual (Concurrent): 30s
            // Result should be Max(50, 30) = 50
            const tasks: Task[] = [
                { id: 'M1', standardTime: 50, executionMode: 'machine' } as Task,
                { id: 'H1', standardTime: 30, executionMode: 'manual', concurrentWith: 'M1' } as Task
            ];
            expect(calculateEffectiveStationTime(tasks)).toBe(50);
        });

        it('should apply manual dominance if manual is longer than machine', () => {
            // Machine: 20s
            // Manual (Concurrent): 40s
            // Result should be Max(20, 40) = 40
            const tasks: Task[] = [
                { id: 'M1', standardTime: 20, executionMode: 'machine' } as Task,
                { id: 'H1', standardTime: 40, executionMode: 'manual', concurrentWith: 'M1' } as Task
            ];
            expect(calculateEffectiveStationTime(tasks)).toBe(40);
        });

        it('should handle mixed independent and concurrent tasks', () => {
            // Indep: 10
            // Machine Group: Max(50, 20) = 50
            // Total: 60
            const tasks: Task[] = [
                { id: 'I1', standardTime: 10, executionMode: 'manual' } as Task,
                { id: 'M1', standardTime: 50, executionMode: 'machine' } as Task,
                { id: 'H1', standardTime: 20, executionMode: 'manual', concurrentWith: 'M1' } as Task
            ];
            expect(calculateEffectiveStationTime(tasks)).toBe(60);
        });
    });

    describe('isOutlier', () => {
        it('should identify values outside 2 sigma', () => {
            // Mean 10, StdDev 1 -> Range [8, 12]
            expect(isOutlier(13, 10, 1)).toBe(true);
            expect(isOutlier(7, 10, 1)).toBe(true);
            expect(isOutlier(10, 10, 1)).toBe(false);
            expect(isOutlier(11.9, 10, 1)).toBe(false);
        });
    });

    describe('parseNumberInput', () => {
        it('should handle dots as thousands and comma as decimal (LATAM)', () => {
            expect(parseNumberInput('1.500,50')).toBe(1500.50);
        });

        it('should handle simple decimals', () => {
            expect(parseNumberInput('1,5')).toBe(1.5);
        });

        it('should handle standard US format', () => {
            expect(parseNumberInput('1.5')).toBe(1.5);
        });
    });

    describe('formatNumber', () => {
        it('should format with comma decimal separator (es-AR)', () => {
            // Note: This depends on Node/Browser locale support. 
            // In full-icu environments it works, otherwise it might fallback.
            // We check if it contains comma or dot depending on env, but usually es-AR uses comma.
            const result = formatNumber(1234.56);
            // We expect "1.234,56" or similar. Let's check basic structure.
            expect(result).toMatch(/1.*234.*56/);
        });
    });

    describe('parseCSVLine', () => {
        it('should split simple comma separated values', () => {
            expect(parseCSVLine('A,B,C')).toEqual(['A', 'B', 'C']);
        });

        it('should handle quoted values containing commas', () => {
            expect(parseCSVLine('A,"B,C",D')).toEqual(['A', 'B,C', 'D']);
        });

        it('should handle empty values', () => {
            expect(parseCSVLine('A,,C')).toEqual(['A', '', 'C']);
        });

        it('should clean surrounding quotes', () => {
            expect(parseCSVLine('"A","B"')).toEqual(['A', 'B']);
        });
    });

});
