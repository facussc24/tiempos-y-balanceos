import { describe, it, expect } from 'vitest';
import { getControlPlanDefaults, validateControlPlanForExport } from '../../../modules/controlPlan/controlPlanDefaults';

describe('getControlPlanDefaults', () => {
    describe('AP Alto (H)', () => {
        it('sets 100% sample size and every piece frequency', () => {
            const result = getControlPlanDefaults({ ap: 'H', severity: 8, phase: 'production' });
            expect(result.sampleSize).toBe('100%');
            expect(result.sampleFrequency).toBe('Cada pieza');
        });

        it('marks sampleSize and sampleFrequency as auto-filled', () => {
            const result = getControlPlanDefaults({ ap: 'H', severity: 5, phase: 'production' });
            expect(result.autoFilledFields).toContain('sampleSize');
            expect(result.autoFilledFields).toContain('sampleFrequency');
        });
    });

    describe('AP Medio (M)', () => {
        it('uses higher frequency for severity >= 9', () => {
            const result = getControlPlanDefaults({ ap: 'M', severity: 9, phase: 'production' });
            expect(result.sampleSize).toBe('5 piezas');
            expect(result.sampleFrequency).toBe('Cada hora');
        });

        it('uses standard frequency for severity < 9', () => {
            const result = getControlPlanDefaults({ ap: 'M', severity: 6, phase: 'production' });
            expect(result.sampleSize).toBe('5 piezas');
            expect(result.sampleFrequency).toBe('Cada turno');
        });

        it('uses 100% in Safe Launch phase regardless of severity', () => {
            const result = getControlPlanDefaults({ ap: 'M', severity: 5, phase: 'safeLaunch' });
            expect(result.sampleSize).toBe('100%');
            expect(result.sampleFrequency).toContain('Safe Launch');
        });
    });

    describe('Prototype phase', () => {
        it('uses 100% for AP=M in Prototype phase', () => {
            const result = getControlPlanDefaults({ ap: 'M', severity: 5, phase: 'prototype' });
            expect(result.sampleSize).toBe('100%');
            expect(result.sampleFrequency).toContain('Prototipo');
        });

        it('still uses 100% for AP=H in Prototype (same as production)', () => {
            const result = getControlPlanDefaults({ ap: 'H', severity: 5, phase: 'prototype' });
            expect(result.sampleSize).toBe('100%');
            expect(result.sampleFrequency).toBe('Cada pieza');
        });
    });

    describe('Pre-Launch phase', () => {
        it('uses 100% for AP=M in Pre-Launch phase', () => {
            const result = getControlPlanDefaults({ ap: 'M', severity: 5, phase: 'preLaunch' });
            expect(result.sampleSize).toBe('100%');
            expect(result.sampleFrequency).toContain('Pre-Lanzamiento');
        });

        it('marks sampleSize and sampleFrequency as auto-filled', () => {
            const result = getControlPlanDefaults({ ap: 'M', severity: 5, phase: 'preLaunch' });
            expect(result.autoFilledFields).toContain('sampleSize');
            expect(result.autoFilledFields).toContain('sampleFrequency');
        });
    });

    describe('AP Low or empty', () => {
        it('returns empty sample fields for AP=L', () => {
            const result = getControlPlanDefaults({ ap: 'L', severity: 5, phase: 'production' });
            expect(result.sampleSize).toBe('');
            expect(result.sampleFrequency).toBe('');
        });

        it('returns empty sample fields for empty AP', () => {
            const result = getControlPlanDefaults({ ap: '', severity: 5, phase: 'production' });
            expect(result.sampleSize).toBe('');
            expect(result.sampleFrequency).toBe('');
        });
    });

    describe('Reaction Plan based on Severity', () => {
        it('suggests stop line for severity >= 9', () => {
            const result = getControlPlanDefaults({ ap: 'H', severity: 10, phase: 'production' });
            expect(result.reactionPlan).toContain('Detener linea');
            expect(result.reactionPlan).toContain('Segregar');
            expect(result.autoFilledFields).toContain('reactionPlan');
        });

        it('suggests contain for severity 7-8', () => {
            const result = getControlPlanDefaults({ ap: 'M', severity: 7, phase: 'production' });
            expect(result.reactionPlan).toContain('Contener');
        });

        it('suggests adjust for severity 4-6', () => {
            const result = getControlPlanDefaults({ ap: 'M', severity: 5, phase: 'production' });
            expect(result.reactionPlan).toContain('Ajustar proceso');
        });

        it('leaves empty for severity < 4', () => {
            const result = getControlPlanDefaults({ ap: 'M', severity: 2, phase: 'production' });
            expect(result.reactionPlan).toBe('');
            expect(result.autoFilledFields).not.toContain('reactionPlan');
        });
    });
});

describe('validateControlPlanForExport', () => {
    it('returns no issues when all owners are filled', () => {
        const items = [
            { reactionPlanOwner: 'Juan Perez', reactionPlan: 'Parar', sampleSize: '100%', controlMethod: 'Visual' },
        ];
        expect(validateControlPlanForExport(items)).toEqual([]);
    });

    it('returns issue when owners are missing', () => {
        const items = [
            { reactionPlanOwner: '', reactionPlan: 'Parar', sampleSize: '100%', controlMethod: 'Visual' },
            { reactionPlanOwner: '  ', reactionPlan: 'Parar', sampleSize: '100%', controlMethod: 'Visual' },
            { reactionPlanOwner: 'Maria', reactionPlan: 'Parar', sampleSize: '100%', controlMethod: 'Visual' },
        ];
        const issues = validateControlPlanForExport(items);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toContain('2 item(s)');
        expect(issues[0]).toContain('Responsable de Reaccion');
    });

    it('returns empty for empty items array', () => {
        expect(validateControlPlanForExport([])).toEqual([]);
    });
});
