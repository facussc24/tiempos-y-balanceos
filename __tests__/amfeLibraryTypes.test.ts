/**
 * Tests for modules/amfe/amfeLibraryTypes.ts
 *
 * Covers buildSearchableText, LIBRARY_CATEGORIES, and EMPTY_LIBRARY.
 */

import { buildSearchableText, LIBRARY_CATEGORIES, EMPTY_LIBRARY } from '../modules/amfe/amfeLibraryTypes';
import type { AmfeLibraryOperation } from '../modules/amfe/amfeLibraryTypes';

function makeMinimalOperation(overrides: Partial<AmfeLibraryOperation> = {}): AmfeLibraryOperation {
    return {
        id: 'op-1',
        opNumber: '10',
        name: 'Soldadura MIG',
        workElements: [],
        lastModified: '2026-01-01T00:00:00Z',
        version: 1,
        ...overrides,
    };
}

describe('buildSearchableText', () => {
    it('includes the operation name in lowercase', () => {
        const op = makeMinimalOperation({ name: 'Corte Laser CNC' });
        const text = buildSearchableText(op);
        expect(text).toContain('corte laser cnc');
    });

    it('includes the description when present', () => {
        const op = makeMinimalOperation({ description: 'Template para CHAPA FINA' });
        const text = buildSearchableText(op);
        expect(text).toContain('template para chapa fina');
    });

    it('includes tags in the searchable text', () => {
        const op = makeMinimalOperation({ tags: ['CNC', 'Mesa de Corte', 'Laser'] });
        const text = buildSearchableText(op);
        expect(text).toContain('cnc');
        expect(text).toContain('mesa de corte');
        expect(text).toContain('laser');
    });

    it('includes work element names and types', () => {
        const op = makeMinimalOperation({
            workElements: [
                {
                    id: 'we-1',
                    name: 'Máquina CNC',
                    type: 'Machine',
                    functions: [],
                },
            ],
        });
        const text = buildSearchableText(op);
        expect(text).toContain('máquina cnc');
        expect(text).toContain('machine');
    });

    it('includes function descriptions from work elements', () => {
        const op = makeMinimalOperation({
            workElements: [
                {
                    id: 'we-1',
                    name: 'Operador',
                    type: 'Man',
                    functions: [
                        {
                            id: 'fn-1',
                            description: 'Mantener temperatura estable',
                            requirements: '',
                            failures: [],
                        },
                    ],
                },
            ],
        });
        const text = buildSearchableText(op);
        expect(text).toContain('mantener temperatura estable');
    });

    it('includes failure descriptions and effects', () => {
        const op = makeMinimalOperation({
            workElements: [
                {
                    id: 'we-1',
                    name: 'Material',
                    type: 'Material',
                    functions: [
                        {
                            id: 'fn-1',
                            description: 'Proveer resistencia',
                            requirements: '',
                            failures: [
                                {
                                    id: 'f-1',
                                    description: 'Fractura por fatiga',
                                    effectLocal: 'Rechazo interno',
                                    effectNextLevel: 'Devolución del cliente',
                                    effectEndUser: 'Falla en servicio',
                                    severity: 8,
                                    causes: [],
                                },
                            ],
                        },
                    ],
                },
            ],
        });
        const text = buildSearchableText(op);
        expect(text).toContain('fractura por fatiga');
        expect(text).toContain('rechazo interno');
        expect(text).toContain('devolución del cliente');
        expect(text).toContain('falla en servicio');
    });

    it('includes cause text and controls', () => {
        const op = makeMinimalOperation({
            workElements: [
                {
                    id: 'we-1',
                    name: 'Método',
                    type: 'Method',
                    functions: [
                        {
                            id: 'fn-1',
                            description: 'Seguir instrucción',
                            requirements: '',
                            failures: [
                                {
                                    id: 'f-1',
                                    description: 'Omisión de paso',
                                    effectLocal: '',
                                    effectNextLevel: '',
                                    effectEndUser: '',
                                    severity: 5,
                                    causes: [
                                        {
                                            id: 'c-1',
                                            cause: 'Falta de capacitación',
                                            preventionControl: 'Entrenamiento mensual',
                                            detectionControl: 'Auditoría de proceso',
                                            occurrence: 4,
                                            detection: 3,
                                            ap: 'M',
                                            characteristicNumber: '',
                                            specialChar: '',
                                            filterCode: '',
                                            preventionAction: '',
                                            detectionAction: '',
                                            responsible: '',
                                            targetDate: '',
                                            status: '',
                                            actionTaken: '',
                                            completionDate: '',
                                            severityNew: '',
                                            occurrenceNew: '',
                                            detectionNew: '',
                                            apNew: '',
                                            observations: '',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });
        const text = buildSearchableText(op);
        expect(text).toContain('falta de capacitación');
        expect(text).toContain('entrenamiento mensual');
        expect(text).toContain('auditoría de proceso');
    });

    it('filters out empty strings and joins with spaces', () => {
        const op = makeMinimalOperation({ description: '', tags: undefined });
        const text = buildSearchableText(op);
        // Should not have double spaces from empty parts
        expect(text).not.toMatch(/  /);
        expect(text.length).toBeGreaterThan(0);
    });

    it('handles an operation with no work elements', () => {
        const op = makeMinimalOperation({ workElements: [] });
        const text = buildSearchableText(op);
        expect(text).toBe('soldadura mig');
    });
});

describe('LIBRARY_CATEGORIES', () => {
    it('contains at least 8 categories', () => {
        expect(LIBRARY_CATEGORIES.length).toBeGreaterThanOrEqual(8);
    });

    it('each category has value and label strings', () => {
        for (const cat of LIBRARY_CATEGORIES) {
            expect(typeof cat.value).toBe('string');
            expect(typeof cat.label).toBe('string');
            expect(cat.value.length).toBeGreaterThan(0);
            expect(cat.label.length).toBeGreaterThan(0);
        }
    });

    it('includes "otro" as a catch-all category', () => {
        const otro = LIBRARY_CATEGORIES.find(c => c.value === 'otro');
        expect(otro).toBeDefined();
        expect(otro!.label).toBe('Otro');
    });
});

describe('EMPTY_LIBRARY', () => {
    it('has an empty operations array', () => {
        expect(EMPTY_LIBRARY.operations).toEqual([]);
    });

    it('has a valid ISO date string for lastModified', () => {
        expect(() => new Date(EMPTY_LIBRARY.lastModified)).not.toThrow();
        expect(new Date(EMPTY_LIBRARY.lastModified).getTime()).not.toBeNaN();
    });
});
