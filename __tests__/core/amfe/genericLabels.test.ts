/**
 * Tests para core/amfe/genericLabels.ts (L1 source of truth).
 *
 * Valida:
 *  - isGeneric6MLabel: detecta correctamente etiquetas 6M genéricas
 *  - normalize: trim + lowercase + NFD
 *  - classifyWeNameVsType: detecta name = type traducido + patrones MaterialShouldBeMachine
 *  - isTextDescriptive: longitud + heurística de mayúsculas
 *  - extractForeignOpNumber: detecta residuos de renumeración
 *
 * Plan: ~/.claude/plans/witty-shimmying-mochi.md Fase 1E
 */
import { describe, it, expect } from 'vitest';
import {
    GENERIC_LABELS,
    MIN_FN_DESCRIPTION_LENGTH,
    normalize,
    isGeneric6MLabel,
    classifyWeNameVsType,
    isTextDescriptive,
    extractForeignOpNumber,
} from '../../../core/amfe/genericLabels';

describe('genericLabels — JSON shared loaded correctly', () => {
    it('GENERIC_LABELS contains expected 6M variants', () => {
        expect(GENERIC_LABELS).toContain('material');
        expect(GENERIC_LABELS).toContain('maquina');
        expect(GENERIC_LABELS).toContain('method');
        expect(GENERIC_LABELS).toContain('medio ambiente');
        expect(GENERIC_LABELS.length).toBeGreaterThanOrEqual(20);
    });

    it('MIN_FN_DESCRIPTION_LENGTH is a positive number', () => {
        expect(MIN_FN_DESCRIPTION_LENGTH).toBeGreaterThanOrEqual(20);
    });
});

describe('normalize', () => {
    it('lowercases and removes diacritics', () => {
        expect(normalize('Máquina')).toBe('maquina');
        expect(normalize('MEDICIÓN')).toBe('medicion');
        expect(normalize('  Método  ')).toBe('metodo');
    });

    it('handles empty / null / undefined', () => {
        expect(normalize('')).toBe('');
        expect(normalize(null)).toBe('');
        expect(normalize(undefined)).toBe('');
    });
});

describe('isGeneric6MLabel', () => {
    it('detects all 6M label variants (case + diacritic insensitive)', () => {
        expect(isGeneric6MLabel('Material')).toBe(true);
        expect(isGeneric6MLabel('Máquina')).toBe(true);
        expect(isGeneric6MLabel('MAQUINA')).toBe(true);
        expect(isGeneric6MLabel('  método  ')).toBe(true);
        expect(isGeneric6MLabel('Medio Ambiente')).toBe(true);
        expect(isGeneric6MLabel('Mano de Obra')).toBe(true);
        expect(isGeneric6MLabel('measurement')).toBe(true);
    });

    it('does NOT flag specific resource names', () => {
        expect(isGeneric6MLabel('Máquina de coser industrial')).toBe(false);
        expect(isGeneric6MLabel('Procedimiento de recepción P-14')).toBe(false);
        expect(isGeneric6MLabel('Autoelevador')).toBe(false);
        expect(isGeneric6MLabel('Cuchilla de corte')).toBe(false);
    });

    it('handles empty / null', () => {
        expect(isGeneric6MLabel('')).toBe(false);
        expect(isGeneric6MLabel(null)).toBe(false);
    });
});

describe('classifyWeNameVsType', () => {
    it('detects name = type traducido (placeholder copy-paste)', () => {
        const r = classifyWeNameVsType('Material', 'Material');
        expect(r.ok).toBe(false);
        expect(r.issue).toContain('copia');
    });

    it('detects MaterialShouldBeMachine (cuchilla en Material)', () => {
        const r = classifyWeNameVsType('Cuchilla de corte', 'Material');
        expect(r.ok).toBe(false);
        expect(r.issue).toContain('MaterialShouldBeMachine');
    });

    it('detects troquel en Material', () => {
        const r = classifyWeNameVsType('Troquel de espuma', 'Material');
        expect(r.ok).toBe(false);
    });

    it('detects MachineShouldBeMethod (procedimiento en Machine)', () => {
        const r = classifyWeNameVsType('Procedimiento de inspeccion', 'Machine');
        expect(r.ok).toBe(false);
        expect(r.issue).toContain('MachineShouldBeMethod');
    });

    it('passes valid combinations', () => {
        expect(classifyWeNameVsType('Cuchilla de corte', 'Machine').ok).toBe(true);
        expect(classifyWeNameVsType('Procedimiento P-14', 'Method').ok).toBe(true);
        expect(classifyWeNameVsType('Autoelevador', 'Machine').ok).toBe(true);
        expect(classifyWeNameVsType('Hilo de costura', 'Material').ok).toBe(true);
    });

    it('handles empty / null params', () => {
        expect(classifyWeNameVsType('', 'Material').ok).toBe(true);
        expect(classifyWeNameVsType('Material', '').ok).toBe(true);
        expect(classifyWeNameVsType(null, null).ok).toBe(true);
    });
});

describe('isTextDescriptive', () => {
    it('flags texts shorter than minLen', () => {
        const r = isTextDescriptive('COSTURA UNION');
        expect(r.ok).toBe(false);
        // Cualquiera de las dos razones es válida (longitud o mayúsculas)
        expect(r.reason).toBeTruthy();
    });

    it('flags short uppercase-only labels', () => {
        expect(isTextDescriptive('ESPUMADO').ok).toBe(false);
        expect(isTextDescriptive('CORTE DE PANELES').ok).toBe(false);
    });

    it('passes descriptive texts of sufficient length', () => {
        const r = isTextDescriptive('Realizar costura de unión entre paneles textiles con tensión controlada');
        expect(r.ok).toBe(true);
    });

    it('passes mixed-case texts even if short-ish', () => {
        const r = isTextDescriptive('Garantizar la estabilidad y la integridad fisica del material');
        expect(r.ok).toBe(true);
    });
});

describe('extractForeignOpNumber', () => {
    it('detects foreign op number in WE.name (renumeration residue)', () => {
        expect(extractForeignOpNumber('Proceso Op 60', 50)).toBe(60);
        expect(extractForeignOpNumber('residuo OP 20', 30)).toBe(20);
    });

    it('returns null when op number matches current', () => {
        expect(extractForeignOpNumber('Proceso Op 50', 50)).toBe(null);
    });

    it('returns null when no op number found', () => {
        expect(extractForeignOpNumber('Autoelevador', 10)).toBe(null);
        expect(extractForeignOpNumber('', 10)).toBe(null);
    });
});
