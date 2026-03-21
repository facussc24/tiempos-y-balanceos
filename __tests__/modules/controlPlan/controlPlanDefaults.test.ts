import { describe, it, expect } from 'vitest';
import { getControlPlanDefaults, validateControlPlanForExport } from '../../../modules/controlPlan/controlPlanDefaults';

describe('getControlPlanDefaults', () => {
    describe('AP Alto (H)', () => {
        it('sets 100% sample size and 100% frequency', () => {
            const result = getControlPlanDefaults({ ap: 'H', severity: 8, phase: 'production' });
            expect(result.sampleSize).toBe('100%');
            expect(result.sampleFrequency).toBe('100%');
        });

        it('marks sampleSize and sampleFrequency as auto-filled', () => {
            const result = getControlPlanDefaults({ ap: 'H', severity: 5, phase: 'production' });
            expect(result.autoFilledFields).toContain('sampleSize');
            expect(result.autoFilledFields).toContain('sampleFrequency');
        });
    });

    describe('AP Medio (M)', () => {
        it('uses shift start/end frequency for severity >= 9', () => {
            const result = getControlPlanDefaults({ ap: 'M', severity: 9, phase: 'production' });
            expect(result.sampleSize).toBe('1 pieza');
            expect(result.sampleFrequency).toBe('Inicio y fin de turno');
        });

        it('uses lot-based frequency for severity < 9', () => {
            const result = getControlPlanDefaults({ ap: 'M', severity: 6, phase: 'production' });
            expect(result.sampleSize).toBe('1 pieza');
            expect(result.sampleFrequency).toBe('Cada lote');
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

    describe('AP Low — no SC/CC', () => {
        it('returns empty sample fields for AP=L with severity < 5 (no SC/CC)', () => {
            const result = getControlPlanDefaults({ ap: 'L', severity: 3, phase: 'production' });
            expect(result.sampleSize).toBe('');
            expect(result.sampleFrequency).toBe('');
        });

        it('returns empty sample fields for empty AP', () => {
            const result = getControlPlanDefaults({ ap: '', severity: 5, phase: 'production' });
            expect(result.sampleSize).toBe('');
            expect(result.sampleFrequency).toBe('');
        });
    });

    describe('AP Low — SC/CC (IATF 16949 §8.3.3.3)', () => {
        it('S=9 (CC) → 1 pieza, Cada lote', () => {
            const result = getControlPlanDefaults({ ap: 'L', severity: 9, phase: 'production' });
            expect(result.sampleSize).toBe('1 pieza');
            expect(result.sampleFrequency).toBe('Cada lote');
        });

        it('S=10 (CC) → 1 pieza, Cada lote', () => {
            const result = getControlPlanDefaults({ ap: 'L', severity: 10, phase: 'production' });
            expect(result.sampleSize).toBe('1 pieza');
            expect(result.sampleFrequency).toBe('Cada lote');
        });

        it('S=5 (SC lower bound) → 1 pieza, Cada lote', () => {
            const result = getControlPlanDefaults({ ap: 'L', severity: 5, phase: 'production' });
            expect(result.sampleSize).toBe('1 pieza');
            expect(result.sampleFrequency).toBe('Cada lote');
        });

        it('S=6 (SC) → 1 pieza, Cada lote', () => {
            const result = getControlPlanDefaults({ ap: 'L', severity: 6, phase: 'production' });
            expect(result.sampleSize).toBe('1 pieza');
            expect(result.sampleFrequency).toBe('Cada lote');
        });

        it('S=8 (SC) → 1 pieza, Cada lote', () => {
            const result = getControlPlanDefaults({ ap: 'L', severity: 8, phase: 'production' });
            expect(result.sampleSize).toBe('1 pieza');
            expect(result.sampleFrequency).toBe('Cada lote');
        });

        it('reactionPlan is severity-based even for AP=L (consequence unchanged)', () => {
            const r9 = getControlPlanDefaults({ ap: 'L', severity: 9, phase: 'production' });
            const r6 = getControlPlanDefaults({ ap: 'L', severity: 6, phase: 'production' });
            const r3 = getControlPlanDefaults({ ap: 'L', severity: 3, phase: 'production' });
            // S=9 → stop line (severity determines consequence, not AP)
            expect(r9.reactionPlan).toContain('Detener');
            // S=6 → adjust process
            expect(r6.reactionPlan).toContain('Ajustar');
            // S=3 → no reaction plan (severity too low)
            expect(r3.reactionPlan).toBe('');
        });

        it('autoFilledFields includes sampleSize+sampleFrequency when SC/CC', () => {
            const result = getControlPlanDefaults({ ap: 'L', severity: 9, phase: 'production' });
            expect(result.autoFilledFields).toContain('sampleSize');
            expect(result.autoFilledFields).toContain('sampleFrequency');
            // reactionPlan also auto-filled because severity >= 9 (independent of AP)
            expect(result.autoFilledFields).toContain('reactionPlan');
        });

        it('autoFilledFields empty when S<5 (no SC/CC)', () => {
            const result = getControlPlanDefaults({ ap: 'L', severity: 3, phase: 'production' });
            expect(result.autoFilledFields).toHaveLength(0);
        });
    });

    describe('Reaction Plan based on Severity', () => {
        it('suggests stop line for severity >= 9', () => {
            const result = getControlPlanDefaults({ ap: 'H', severity: 10, phase: 'production' });
            expect(result.reactionPlan).toContain('Detener línea');
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
