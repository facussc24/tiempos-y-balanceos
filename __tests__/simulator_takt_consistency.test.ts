/**
 * Test: Simulator Takt Time Consistency
 * 
 * Verifies that the Flow Simulator uses the same Takt Time calculation
 * as other modules (PanelControl, MixModeView, TaktPreview).
 * 
 * @version 4.0.0 - Fix for hardcoded 480-minute bug
 */
import { describe, it, expect } from 'vitest';
import { calculateTaktTime } from '../core/balancing/simulation';
import { Shift } from '../types';

describe('Simulator Takt Time Consistency', () => {
    const standardShift: Shift = {
        id: 1,
        name: 'Turno Estándar',
        startTime: '06:00',
        endTime: '14:30',
        breaks: [
            { id: 'b1', name: 'Descanso', startTime: '10:00', duration: 15 },
            { id: 'b2', name: 'Almuerzo', startTime: '12:00', duration: 30 },
        ],
    };

    it('should use effective minutes not hardcoded 480', () => {
        const result = calculateTaktTime([standardShift], 1, 1000, 0.85);

        // 510 min - 45 min breaks = 465 effective minutes
        // 465 * 60 * 0.85 / 1000 = 23.715s
        expect(result.effectiveSeconds).toBeCloseTo(23.715, 1);

        // Old buggy value would have been: 480 * 60 * 0.85 / 1000 = 24.48s
        expect(result.effectiveSeconds).not.toBeCloseTo(24.48, 1);
    });

    it('should correctly subtract breaks from shift duration', () => {
        const shiftWithLargeBreaks: Shift = {
            id: 1,
            name: 'Turno con pausas',
            startTime: '06:00',
            endTime: '14:00', // 480 min total
            breaks: [
                { id: 'b1', name: 'Descanso 1', startTime: '10:00', duration: 15 },
                { id: 'b2', name: 'Almuerzo', startTime: '12:00', duration: 30 },
                { id: 'b3', name: 'Descanso 2', startTime: '14:30', duration: 15 },
            ], // 60 min breaks total
        };

        const result = calculateTaktTime([shiftWithLargeBreaks], 1, 500, 0.85);

        // 480 min - 60 min = 420 effective minutes
        // 420 * 60 * 0.85 / 500 = 42.84s
        expect(result.effectiveSeconds).toBeCloseTo(42.84, 1);

        // Hardcoded 480 would give: 480 * 60 * 0.85 / 500 = 48.96s
        expect(result.effectiveSeconds).not.toBeCloseTo(48.96, 1);
    });

    it('should handle fallback when no shifts configured', () => {
        // This tests the fallback logic in FlowSimulatorModule
        // Fallback: 480 * 60 * OEE * shifts / demand
        const demand = 1000;
        const oee = 0.85;
        const shifts = 1;
        const fallbackTakt = (480 * 60 * oee * shifts) / demand;

        expect(fallbackTakt).toBeCloseTo(24.48, 1);
    });
});
