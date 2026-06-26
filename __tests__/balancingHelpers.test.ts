/**
 * Unit tests para balancingHelpers: helpers visuales/semanticos
 * extraidos en Fase 2 (#9 / #10 / #11).
 */
import { describe, it, expect } from 'vitest';
import {
    isStationOverloaded,
    formatReplicasInfo,
    getSaturationZone,
    isValidOeeInput,
} from '../modules/balancing/balancingHelpers';

describe('isStationOverloaded', () => {
    it('true cuando time > limit', () => {
        expect(isStationOverloaded({ time: 70, limit: 60 })).toBe(true);
    });

    it('false cuando time == limit (limite inclusivo)', () => {
        expect(isStationOverloaded({ time: 60, limit: 60 })).toBe(false);
    });

    it('false cuando time < limit', () => {
        expect(isStationOverloaded({ time: 45, limit: 60 })).toBe(false);
    });
});

describe('formatReplicasInfo', () => {
    it('null cuando replicas == 1 (no hay multi-manning)', () => {
        expect(formatReplicasInfo(90, 1)).toBeNull();
    });

    it('null cuando replicas == 0 (edge case defensivo)', () => {
        expect(formatReplicasInfo(90, 0)).toBeNull();
    });

    it('string descriptivo cuando replicas > 1 (usa formatNumber locale es)', () => {
        // formatNumber devuelve "90,00" (locale es-AR, 2 decimales por default)
        expect(formatReplicasInfo(90, 3)).toMatch(/^\(Total: 90[,.]\d{2}s ÷ 3 ops\)$/);
    });

    it('encapsula el formato: "(Total: Xs ÷ N ops)" independiente de locale', () => {
        const result = formatReplicasInfo(120.5, 2);
        expect(result).toMatch(/^\(Total: .+s ÷ 2 ops\)$/);
    });
});

describe('getSaturationZone', () => {
    it('overload tiene prioridad absoluta', () => {
        expect(
            getSaturationZone({ isOverload: true, isInOeeRiskZone: true, saturationPercent: 100 }),
        ).toBe('overload');
    });

    it('oee-risk cuando no hay overload pero esta en zona OEE', () => {
        expect(
            getSaturationZone({ isOverload: false, isInOeeRiskZone: true, saturationPercent: 95 }),
        ).toBe('oee-risk');
    });

    it('high cuando saturacion > 90 y no hay otras alertas', () => {
        expect(
            getSaturationZone({ isOverload: false, isInOeeRiskZone: false, saturationPercent: 95 }),
        ).toBe('high');
    });

    it('normal cuando saturacion <= 90 y sin alertas', () => {
        expect(
            getSaturationZone({ isOverload: false, isInOeeRiskZone: false, saturationPercent: 80 }),
        ).toBe('normal');
        expect(
            getSaturationZone({ isOverload: false, isInOeeRiskZone: false, saturationPercent: 90 }),
        ).toBe('normal');
    });
});

describe('isValidOeeInput', () => {
    it('acepta fracción 0–1', () => {
        expect(isValidOeeInput('0.85')).toBe(true);
        expect(isValidOeeInput('1')).toBe(true);
    });

    it('acepta porcentaje 1–100 (saveStationConfig lo divide)', () => {
        expect(isValidOeeInput('85')).toBe(true);
        expect(isValidOeeInput('100')).toBe(true);
    });

    it('acepta coma decimal (locale es)', () => {
        expect(isValidOeeInput('0,9')).toBe(true);
    });

    it('rechaza vacío, no numérico, <= 0 y > 100', () => {
        expect(isValidOeeInput('')).toBe(false);
        expect(isValidOeeInput('abc')).toBe(false);
        expect(isValidOeeInput('0')).toBe(false);
        expect(isValidOeeInput('-0.5')).toBe(false);
        expect(isValidOeeInput('120')).toBe(false);
    });
});
