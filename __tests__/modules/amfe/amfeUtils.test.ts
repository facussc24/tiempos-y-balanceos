import { describe, it, expect } from 'vitest';
import { deepCloneCause, deepCloneFailure, deepCloneFunction, deepCloneWorkElement, deepCloneOperation } from '../../../modules/amfe/amfeUtils';
import { AmfeCause, AmfeFailure, AmfeFunction, AmfeWorkElement, AmfeOperation } from '../../../modules/amfe/amfeTypes';

const makeCause = (id = 'cause-1'): AmfeCause => ({
    id,
    cause: 'Electrodo gastado',
    preventionControl: 'Mantenimiento',
    detectionControl: 'Visual',
    occurrence: 5,
    detection: 6,
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
    observations: 'test obs',
});

const makeFailure = (id = 'fail-1'): AmfeFailure => ({
    id,
    description: 'No suelda',
    effectLocal: '',
    effectNextLevel: '',
    effectEndUser: 'Pieza defectuosa',
    severity: 8,
    causes: [makeCause('cause-1'), makeCause('cause-2')],
});

const makeFunction = (id = 'func-1'): AmfeFunction => ({
    id,
    description: 'Soldar piezas',
    requirements: 'Penetracion > 2mm',
    failures: [makeFailure('fail-1'), makeFailure('fail-2')],
});

const makeWorkElement = (id = 'we-1'): AmfeWorkElement => ({
    id,
    type: 'Machine',
    name: 'Robot Soldador',
    functions: [makeFunction('func-1'), makeFunction('func-2')],
});

const makeOperation = (id = 'op-1'): AmfeOperation => ({
    id,
    opNumber: '10',
    name: 'Soldadura MIG',
    workElements: [makeWorkElement('we-1'), makeWorkElement('we-2')],
});

describe('deepCloneCause', () => {
    it('generates a new UUID', () => {
        const original = makeCause();
        const clone = deepCloneCause(original);
        expect(clone.id).not.toBe(original.id);
    });

    it('preserves all data fields', () => {
        const original = makeCause();
        const clone = deepCloneCause(original);
        expect(clone.cause).toBe(original.cause);
        expect(clone.occurrence).toBe(original.occurrence);
        expect(clone.ap).toBe(original.ap);
        expect(clone.observations).toBe(original.observations);
    });

    it('is independent from original', () => {
        const original = makeCause();
        const clone = deepCloneCause(original);
        clone.cause = 'Changed';
        expect(original.cause).toBe('Electrodo gastado');
    });
});

describe('deepCloneFailure', () => {
    it('generates a new UUID', () => {
        const original = makeFailure();
        const clone = deepCloneFailure(original);
        expect(clone.id).not.toBe(original.id);
    });

    it('generates new UUIDs for all causes', () => {
        const original = makeFailure();
        const clone = deepCloneFailure(original);
        expect(clone.causes).toHaveLength(2);
        expect(clone.causes[0].id).not.toBe(original.causes[0].id);
        expect(clone.causes[1].id).not.toBe(original.causes[1].id);
    });

    it('preserves all data fields', () => {
        const original = makeFailure();
        const clone = deepCloneFailure(original);
        expect(clone.description).toBe(original.description);
        expect(clone.severity).toBe(original.severity);
        expect(clone.causes[0].ap).toBe(original.causes[0].ap);
    });

    it('is independent from original', () => {
        const original = makeFailure();
        const clone = deepCloneFailure(original);
        clone.description = 'Changed';
        expect(original.description).toBe('No suelda');
    });
});

describe('deepCloneFunction', () => {
    it('generates a new UUID for the function', () => {
        const original = makeFunction();
        const clone = deepCloneFunction(original);
        expect(clone.id).not.toBe(original.id);
    });

    it('generates new UUIDs for all failures', () => {
        const original = makeFunction();
        const clone = deepCloneFunction(original);
        expect(clone.failures).toHaveLength(2);
        expect(clone.failures[0].id).not.toBe(original.failures[0].id);
        expect(clone.failures[1].id).not.toBe(original.failures[1].id);
    });

    it('preserves failure data', () => {
        const original = makeFunction();
        const clone = deepCloneFunction(original);
        expect(clone.failures[0].description).toBe(original.failures[0].description);
    });
});

describe('deepCloneWorkElement', () => {
    it('generates new UUIDs at all levels', () => {
        const original = makeWorkElement();
        const clone = deepCloneWorkElement(original);

        expect(clone.id).not.toBe(original.id);
        expect(clone.functions[0].id).not.toBe(original.functions[0].id);
        expect(clone.functions[0].failures[0].id).not.toBe(original.functions[0].failures[0].id);
    });

    it('preserves the type', () => {
        const original = makeWorkElement();
        const clone = deepCloneWorkElement(original);
        expect(clone.type).toBe('Machine');
        expect(clone.name).toBe('Robot Soldador');
    });
});

describe('deepCloneOperation', () => {
    it('generates new UUIDs at every level of the hierarchy', () => {
        const original = makeOperation();
        const clone = deepCloneOperation(original);

        // Operation level
        expect(clone.id).not.toBe(original.id);

        // Work element level
        expect(clone.workElements[0].id).not.toBe(original.workElements[0].id);
        expect(clone.workElements[1].id).not.toBe(original.workElements[1].id);

        // Function level
        expect(clone.workElements[0].functions[0].id).not.toBe(original.workElements[0].functions[0].id);

        // Failure level
        expect(clone.workElements[0].functions[0].failures[0].id).not.toBe(original.workElements[0].functions[0].failures[0].id);
    });

    it('preserves top-level data', () => {
        const original = makeOperation();
        const clone = deepCloneOperation(original);
        expect(clone.opNumber).toBe('10');
        expect(clone.name).toBe('Soldadura MIG');
    });

    it('all generated IDs are unique across the clone', () => {
        const clone = deepCloneOperation(makeOperation());
        const ids = new Set<string>();
        ids.add(clone.id);
        for (const we of clone.workElements) {
            expect(ids.has(we.id)).toBe(false);
            ids.add(we.id);
            for (const f of we.functions) {
                expect(ids.has(f.id)).toBe(false);
                ids.add(f.id);
                for (const fail of f.failures) {
                    expect(ids.has(fail.id)).toBe(false);
                    ids.add(fail.id);
                    for (const cause of fail.causes) {
                        expect(ids.has(cause.id)).toBe(false);
                        ids.add(cause.id);
                    }
                }
            }
        }
    });

    it('editing clone does not affect original', () => {
        const original = makeOperation();
        const clone = deepCloneOperation(original);
        clone.name = 'Changed';
        clone.workElements[0].name = 'Changed WE';
        expect(original.name).toBe('Soldadura MIG');
        expect(original.workElements[0].name).toBe('Robot Soldador');
    });
});
