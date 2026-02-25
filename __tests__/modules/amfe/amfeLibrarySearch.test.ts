import { describe, it, expect } from 'vitest';
import { buildSearchableText, LIBRARY_CATEGORIES, AmfeLibraryOperation } from '../../../modules/amfe/amfeLibraryTypes';

/** Helper to build a minimal library operation for testing */
function makeLibOp(overrides: Partial<AmfeLibraryOperation> = {}): AmfeLibraryOperation {
    return {
        id: 'lib-1',
        opNumber: '10',
        name: 'Corte Laser',
        workElements: [],
        lastModified: '2024-01-01T00:00:00.000Z',
        version: 1,
        ...overrides,
    };
}

describe('buildSearchableText', () => {
    it('includes operation name', () => {
        const text = buildSearchableText(makeLibOp({ name: 'Soldadura MIG' }));
        expect(text).toContain('soldadura mig');
    });

    it('includes description if present', () => {
        const text = buildSearchableText(makeLibOp({ description: 'Proceso de corte CNC automatico' }));
        expect(text).toContain('proceso de corte cnc automatico');
    });

    it('includes tags', () => {
        const text = buildSearchableText(makeLibOp({ tags: ['CNC', 'laser', '6mm'] }));
        expect(text).toContain('cnc');
        expect(text).toContain('laser');
        expect(text).toContain('6mm');
    });

    it('includes work element names and types', () => {
        const text = buildSearchableText(makeLibOp({
            workElements: [{
                id: 'we-1',
                type: 'Machine',
                name: 'Inyectora Engel 200T',
                functions: [],
            }],
        }));
        expect(text).toContain('machine');
        expect(text).toContain('inyectora engel 200t');
    });

    it('includes function descriptions', () => {
        const text = buildSearchableText(makeLibOp({
            workElements: [{
                id: 'we-1',
                type: 'Method',
                name: 'Corte',
                functions: [{
                    id: 'f-1',
                    description: 'Garantizar dimension dentro de tolerancia',
                    requirements: '',
                    failures: [],
                }],
            }],
        }));
        expect(text).toContain('garantizar dimension dentro de tolerancia');
    });

    it('includes failure descriptions and severity context', () => {
        const text = buildSearchableText(makeLibOp({
            workElements: [{
                id: 'we-1',
                type: 'Method',
                name: 'Corte',
                functions: [{
                    id: 'f-1',
                    description: '',
                    requirements: '',
                    failures: [{
                        id: 'fl-1',
                        description: 'Pieza fuera de dimension',
                        severity: '8',
                        effectLocal: 'Retrabajo',
                        effectNextLevel: 'Retraso en ensamble',
                        effectEndUser: 'Falla funcional',
                        causes: [],
                    }],
                }],
            }],
        }));
        expect(text).toContain('pieza fuera de dimension');
        expect(text).toContain('retrabajo');
        expect(text).toContain('retraso en ensamble');
        expect(text).toContain('falla funcional');
    });

    it('includes cause texts and controls', () => {
        const text = buildSearchableText(makeLibOp({
            workElements: [{
                id: 'we-1',
                type: 'Method',
                name: 'Corte',
                functions: [{
                    id: 'f-1',
                    description: '',
                    requirements: '',
                    failures: [{
                        id: 'fl-1',
                        description: '',
                        severity: '5',
                        effectLocal: '',
                        effectNextLevel: '',
                        effectEndUser: '',
                        causes: [{
                            id: 'c-1',
                            cause: 'Desgaste de herramienta',
                            occurrence: '4',
                            detection: '6',
                            preventionControl: 'Mantenimiento preventivo cada 500 ciclos',
                            detectionControl: 'Inspeccion visual cada hora',
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
                        }],
                    }],
                }],
            }],
        }));
        expect(text).toContain('desgaste de herramienta');
        expect(text).toContain('mantenimiento preventivo cada 500 ciclos');
        expect(text).toContain('inspeccion visual cada hora');
    });

    it('returns lowercase text', () => {
        const text = buildSearchableText(makeLibOp({ name: 'SOLDADURA TIG', tags: ['ACERO', 'INOX'] }));
        expect(text).toBe(text.toLowerCase());
    });

    it('handles empty operation gracefully', () => {
        const text = buildSearchableText(makeLibOp({ name: '', workElements: [], tags: [] }));
        // name overridden to '', no WEs, no tags, no description → all filtered out
        expect(text).toBe('');
    });
});

describe('LIBRARY_CATEGORIES', () => {
    it('has expected standard categories', () => {
        const values = LIBRARY_CATEGORIES.map(c => c.value);
        expect(values).toContain('corte');
        expect(values).toContain('soldadura');
        expect(values).toContain('ensamble');
        expect(values).toContain('mecanizado');
        expect(values).toContain('pintura');
        expect(values).toContain('inyeccion');
        expect(values).toContain('inspeccion');
        expect(values).toContain('embalaje');
        expect(values).toContain('otro');
    });

    it('has Spanish labels for all categories', () => {
        for (const cat of LIBRARY_CATEGORIES) {
            expect(cat.label).toBeTruthy();
            expect(cat.label.length).toBeGreaterThan(2);
        }
    });
});
