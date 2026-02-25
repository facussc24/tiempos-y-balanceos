import { describe, it, expect, vi } from 'vitest';
import { mergeWithLibrary } from '../../../modules/amfe/amfeLibraryMerge';
import { AmfeOperation, AmfeWorkElement, AmfeFunction, AmfeFailure, AmfeCause, ActionPriority } from '../../../modules/amfe/amfeTypes';
import { AmfeLibraryOperation } from '../../../modules/amfe/amfeLibraryTypes';

// Mock uuid to return predictable IDs for clone tests
vi.mock('uuid', () => {
    let counter = 0;
    return {
        v4: () => `mock-uuid-${++counter}`,
    };
});

// --- Helpers ---

function makeCause(overrides: Partial<AmfeCause> = {}): AmfeCause {
    return {
        id: 'cause-1',
        cause: 'Sensor descalibrado',
        preventionControl: 'Calibracion semanal',
        detectionControl: 'Inspeccion visual',
        occurrence: 5, detection: 4, ap: ActionPriority.MEDIUM,
        characteristicNumber: '', specialChar: '', filterCode: '',
        preventionAction: 'Capacitar operador', detectionAction: 'Agregar control',
        responsible: 'Juan', targetDate: '2024-06-01', status: 'En Proceso',
        actionTaken: 'Se capacito', completionDate: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
        observations: 'Nota local',
        ...overrides,
    };
}

function makeFailure(overrides: Partial<AmfeFailure> = {}): AmfeFailure {
    return {
        id: 'fail-1',
        description: 'No mantiene temperatura',
        effectLocal: 'Rechazo interno',
        effectNextLevel: 'Devolucion',
        effectEndUser: 'Mal funcionamiento',
        severity: 8,
        causes: [makeCause()],
        ...overrides,
    };
}

function makeFunction(overrides: Partial<AmfeFunction> = {}): AmfeFunction {
    return {
        id: 'func-1',
        description: 'Mantener temperatura',
        requirements: 'ISO 1234',
        failures: [makeFailure()],
        ...overrides,
    };
}

function makeWorkElement(overrides: Partial<AmfeWorkElement> = {}): AmfeWorkElement {
    return {
        id: 'we-1',
        type: 'Machine',
        name: 'CNC Machine',
        functions: [makeFunction()],
        ...overrides,
    };
}

function makeOperation(overrides: Partial<AmfeOperation> = {}): AmfeOperation {
    return {
        id: 'op-local-1',
        opNumber: '10',
        name: 'Soldadura',
        workElements: [makeWorkElement()],
        ...overrides,
    };
}

function makeLibraryOperation(overrides: Partial<AmfeLibraryOperation> = {}): AmfeLibraryOperation {
    return {
        id: 'lib-op-1',
        opNumber: 'LIB-10',
        name: 'Soldadura Base',
        workElements: [makeWorkElement({ id: 'lib-we-1' })],
        lastModified: '2024-01-01T00:00:00Z',
        version: 1,
        ...overrides,
    };
}

// =========================================================================
// mergeWithLibrary
// =========================================================================
describe('mergeWithLibrary', () => {
    it('updates operation name from base but preserves local opNumber', () => {
        const local = makeOperation({ opNumber: '20', name: 'Local Name' });
        const base = makeLibraryOperation({ name: 'Base Name' });

        const result = mergeWithLibrary(local, base);

        expect(result.name).toBe('Base Name');
        expect(result.opNumber).toBe('20');
        expect(result.id).toBe(local.id);
    });

    it('preserves local operation id', () => {
        const local = makeOperation({ id: 'my-local-id' });
        const base = makeLibraryOperation();

        const result = mergeWithLibrary(local, base);
        expect(result.id).toBe('my-local-id');
    });

    it('adds new work elements from base that do not exist locally', () => {
        const local = makeOperation({
            workElements: [makeWorkElement({ type: 'Machine' })],
        });
        const base = makeLibraryOperation({
            workElements: [
                makeWorkElement({ type: 'Machine', id: 'lib-we-machine' }),
                makeWorkElement({ type: 'Man', id: 'lib-we-man', name: 'Operator' }),
            ],
        });

        const result = mergeWithLibrary(local, base);

        expect(result.workElements.length).toBe(2);
        const types = result.workElements.map(we => we.type);
        expect(types).toContain('Machine');
        expect(types).toContain('Man');
    });

    it('keeps local-only work elements not present in base', () => {
        const local = makeOperation({
            workElements: [
                makeWorkElement({ type: 'Machine' }),
                makeWorkElement({ type: 'Material', id: 'local-material', name: 'Steel' }),
            ],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({ type: 'Machine' })],
        });

        const result = mergeWithLibrary(local, base);

        expect(result.workElements.length).toBe(2);
        const types = result.workElements.map(we => we.type);
        expect(types).toContain('Machine');
        expect(types).toContain('Material');
    });

    it('merges matching work elements by type', () => {
        const localFunc = makeFunction({ description: 'Mantener temperatura', requirements: 'Local req' });
        const local = makeOperation({
            workElements: [makeWorkElement({ type: 'Machine', functions: [localFunc] })],
        });
        const baseFunc = makeFunction({ description: 'Mantener temperatura', requirements: 'Base req' });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({ type: 'Machine', functions: [baseFunc] })],
        });

        const result = mergeWithLibrary(local, base);

        expect(result.workElements.length).toBe(1);
        expect(result.workElements[0].type).toBe('Machine');
        // Functions should be merged (same description)
        expect(result.workElements[0].functions.length).toBe(1);
    });

    it('handles empty local operation', () => {
        const local = makeOperation({ workElements: [] });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({ type: 'Machine' })],
        });

        const result = mergeWithLibrary(local, base);

        // New WE from base is added (cloned)
        expect(result.workElements.length).toBe(1);
        expect(result.workElements[0].type).toBe('Machine');
        // Cloned IDs should be different from base
        expect(result.workElements[0].id).not.toBe('lib-we-1');
    });

    it('handles empty base operation', () => {
        const local = makeOperation({
            workElements: [makeWorkElement({ type: 'Machine' })],
        });
        const base = makeLibraryOperation({ workElements: [] });

        const result = mergeWithLibrary(local, base);

        // Local WEs are kept
        expect(result.workElements.length).toBe(1);
        expect(result.workElements[0].type).toBe('Machine');
    });
});

// =========================================================================
// Function merge (tested through mergeWithLibrary)
// =========================================================================
describe('function merge (via mergeWithLibrary)', () => {
    it('adds new functions from base not present locally', () => {
        const localFunc = makeFunction({ description: 'Func A' });
        const baseFunc1 = makeFunction({ description: 'Func A' });
        const baseFunc2 = makeFunction({ description: 'Func B', id: 'func-b' });

        const local = makeOperation({
            workElements: [makeWorkElement({ type: 'Machine', functions: [localFunc] })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({ type: 'Machine', functions: [baseFunc1, baseFunc2] })],
        });

        const result = mergeWithLibrary(local, base);
        const funcs = result.workElements[0].functions;

        expect(funcs.length).toBe(2);
        const descs = funcs.map(f => f.description);
        expect(descs).toContain('Func A');
        expect(descs).toContain('Func B');
    });

    it('keeps local-only functions not in base', () => {
        const localFunc1 = makeFunction({ description: 'Func A' });
        const localFunc2 = makeFunction({ description: 'Func LOCAL', id: 'func-local' });

        const local = makeOperation({
            workElements: [makeWorkElement({ type: 'Machine', functions: [localFunc1, localFunc2] })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({ type: 'Machine', functions: [makeFunction({ description: 'Func A' })] })],
        });

        const result = mergeWithLibrary(local, base);
        const funcs = result.workElements[0].functions;

        expect(funcs.length).toBe(2);
        const descs = funcs.map(f => f.description);
        expect(descs).toContain('Func A');
        expect(descs).toContain('Func LOCAL');
    });

    it('matches functions case-insensitively', () => {
        const localFunc = makeFunction({ description: '  Mantener Temperatura  ', requirements: 'local req' });
        const baseFunc = makeFunction({ description: 'mantener temperatura', requirements: 'base req' });

        const local = makeOperation({
            workElements: [makeWorkElement({ type: 'Machine', functions: [localFunc] })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({ type: 'Machine', functions: [baseFunc] })],
        });

        const result = mergeWithLibrary(local, base);
        const funcs = result.workElements[0].functions;

        // Should merge into 1 function (matched)
        expect(funcs.length).toBe(1);
        // Requirements updated from base
        expect(funcs[0].requirements).toBe('base req');
    });

    it('updates requirements from base when available', () => {
        const localFunc = makeFunction({ description: 'Test func', requirements: '' });
        const baseFunc = makeFunction({ description: 'Test func', requirements: 'New base requirement' });

        const local = makeOperation({
            workElements: [makeWorkElement({ type: 'Machine', functions: [localFunc] })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({ type: 'Machine', functions: [baseFunc] })],
        });

        const result = mergeWithLibrary(local, base);
        expect(result.workElements[0].functions[0].requirements).toBe('New base requirement');
    });

    it('preserves local requirements when base has none', () => {
        const localFunc = makeFunction({ description: 'Test func', requirements: 'Local requirement' });
        const baseFunc = makeFunction({ description: 'Test func', requirements: '' });

        const local = makeOperation({
            workElements: [makeWorkElement({ type: 'Machine', functions: [localFunc] })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({ type: 'Machine', functions: [baseFunc] })],
        });

        const result = mergeWithLibrary(local, base);
        expect(result.workElements[0].functions[0].requirements).toBe('Local requirement');
    });
});

// =========================================================================
// Failure merge
// =========================================================================
describe('failure merge (via mergeWithLibrary)', () => {
    it('adds new failures from base', () => {
        const localFail = makeFailure({ description: 'Falla A' });
        const baseFail1 = makeFailure({ description: 'Falla A' });
        const baseFail2 = makeFailure({ description: 'Falla B', id: 'fail-b' });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({ description: 'Func', failures: [localFail] })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({ description: 'Func', failures: [baseFail1, baseFail2] })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const fails = result.workElements[0].functions[0].failures;

        expect(fails.length).toBe(2);
        const descs = fails.map(f => f.description);
        expect(descs).toContain('Falla A');
        expect(descs).toContain('Falla B');
    });

    it('keeps local-only failures', () => {
        const localFail1 = makeFailure({ description: 'Falla A' });
        const localFail2 = makeFailure({ description: 'Falla LOCAL', id: 'fail-local' });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({ description: 'Func', failures: [localFail1, localFail2] })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({ description: 'Func', failures: [makeFailure({ description: 'Falla A' })] })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const fails = result.workElements[0].functions[0].failures;

        expect(fails.length).toBe(2);
        expect(fails.map(f => f.description)).toContain('Falla LOCAL');
    });

    it('preserves local severity when merging matching failures', () => {
        const localFail = makeFailure({ description: 'Falla X', severity: 9 });
        const baseFail = makeFailure({ description: 'Falla X', severity: 6 });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({ description: 'Func', failures: [localFail] })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({ description: 'Func', failures: [baseFail] })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const mergedFail = result.workElements[0].functions[0].failures[0];

        expect(mergedFail.severity).toBe(9); // Local preserved
    });

    it('updates effects from base when available', () => {
        const localFail = makeFailure({
            description: 'Falla',
            effectLocal: '',
            effectEndUser: 'Local effect',
        });
        const baseFail = makeFailure({
            description: 'Falla',
            effectLocal: 'Base local effect',
            effectEndUser: 'Base end user effect',
        });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({ description: 'Func', failures: [localFail] })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({ description: 'Func', failures: [baseFail] })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const mergedFail = result.workElements[0].functions[0].failures[0];

        expect(mergedFail.effectLocal).toBe('Base local effect');
        expect(mergedFail.effectEndUser).toBe('Base end user effect');
    });

    it('matches failures case-insensitively with trimming', () => {
        const localFail = makeFailure({ description: '  NO mantiene Temp  ', severity: 8 });
        const baseFail = makeFailure({ description: 'no mantiene temp', severity: 5 });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({ description: 'Func', failures: [localFail] })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({ description: 'Func', failures: [baseFail] })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const fails = result.workElements[0].functions[0].failures;

        // Should merge (matched case-insensitive)
        expect(fails.length).toBe(1);
        expect(fails[0].severity).toBe(8); // Local severity preserved
    });
});

// =========================================================================
// Cause merge
// =========================================================================
describe('cause merge (via mergeWithLibrary)', () => {
    it('adds new causes from base', () => {
        const localCause = makeCause({ cause: 'Causa A' });
        const baseCause1 = makeCause({ cause: 'Causa A' });
        const baseCause2 = makeCause({ cause: 'Causa B', id: 'cause-b' });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [localCause] })],
                })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [baseCause1, baseCause2] })],
                })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const causes = result.workElements[0].functions[0].failures[0].causes;

        expect(causes.length).toBe(2);
        expect(causes.map(c => c.cause)).toContain('Causa A');
        expect(causes.map(c => c.cause)).toContain('Causa B');
    });

    it('keeps local-only causes', () => {
        const localCause1 = makeCause({ cause: 'Causa A' });
        const localCause2 = makeCause({ cause: 'Causa LOCAL', id: 'cause-local' });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [localCause1, localCause2] })],
                })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [makeCause({ cause: 'Causa A' })] })],
                })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const causes = result.workElements[0].functions[0].failures[0].causes;

        expect(causes.length).toBe(2);
        expect(causes.map(c => c.cause)).toContain('Causa LOCAL');
    });

    it('preserves local O/D/AP when merging matching causes', () => {
        const localCause = makeCause({
            cause: 'Sensor descalibrado',
            occurrence: 7, detection: 3, ap: ActionPriority.HIGH,
        });
        const baseCause = makeCause({
            cause: 'Sensor descalibrado',
            occurrence: 2, detection: 2, ap: ActionPriority.LOW,
        });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [localCause] })],
                })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [baseCause] })],
                })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const mergedCause = result.workElements[0].functions[0].failures[0].causes[0];

        expect(mergedCause.occurrence).toBe(7); // Local
        expect(mergedCause.detection).toBe(3); // Local
        expect(mergedCause.ap).toBe(ActionPriority.HIGH); // Local
    });

    it('preserves local actions, responsible, dates, status when merging', () => {
        const localCause = makeCause({
            cause: 'Test Cause',
            preventionAction: 'Local action', detectionAction: 'Local detect',
            responsible: 'Local person', targetDate: '2024-12-01',
            status: 'En Proceso', actionTaken: 'Already done',
            completionDate: '2024-11-15', observations: 'Local notes',
        });
        const baseCause = makeCause({
            cause: 'Test Cause',
            preventionAction: 'Base action', detectionAction: 'Base detect',
            responsible: 'Base person', targetDate: '2025-01-01',
            status: 'Pendiente', actionTaken: '', completionDate: '',
            observations: 'Base notes',
        });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [localCause] })],
                })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [baseCause] })],
                })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const mc = result.workElements[0].functions[0].failures[0].causes[0];

        // ALL local action data preserved
        expect(mc.preventionAction).toBe('Local action');
        expect(mc.detectionAction).toBe('Local detect');
        expect(mc.responsible).toBe('Local person');
        expect(mc.targetDate).toBe('2024-12-01');
        expect(mc.status).toBe('En Proceso');
        expect(mc.actionTaken).toBe('Already done');
        expect(mc.completionDate).toBe('2024-11-15');
        expect(mc.observations).toBe('Local notes');
    });

    it('updates controls from base when available', () => {
        const localCause = makeCause({
            cause: 'Test',
            preventionControl: '', detectionControl: 'Old detection',
        });
        const baseCause = makeCause({
            cause: 'Test',
            preventionControl: 'New prevention', detectionControl: 'New detection',
        });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [localCause] })],
                })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [baseCause] })],
                })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const mc = result.workElements[0].functions[0].failures[0].causes[0];

        expect(mc.preventionControl).toBe('New prevention');
        expect(mc.detectionControl).toBe('New detection');
    });

    it('preserves local controls when base has empty controls', () => {
        const localCause = makeCause({
            cause: 'Test',
            preventionControl: 'Local PC', detectionControl: 'Local DC',
        });
        const baseCause = makeCause({
            cause: 'Test',
            preventionControl: '', detectionControl: '',
        });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [localCause] })],
                })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [baseCause] })],
                })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const mc = result.workElements[0].functions[0].failures[0].causes[0];

        expect(mc.preventionControl).toBe('Local PC');
        expect(mc.detectionControl).toBe('Local DC');
    });

    it('matches causes case-insensitively with trimming', () => {
        const localCause = makeCause({ cause: '  Sensor DESCALIBRADO  ', occurrence: 8 });
        const baseCause = makeCause({ cause: 'sensor descalibrado', occurrence: 2 });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [localCause] })],
                })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [baseCause] })],
                })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const causes = result.workElements[0].functions[0].failures[0].causes;

        expect(causes.length).toBe(1); // Merged
        expect(causes[0].occurrence).toBe(8); // Local preserved
    });

    it('merges empty causes positionally (local empty cause preserved)', () => {
        const localCause = makeCause({ cause: '', id: 'local-empty', occurrence: 5 });
        const baseCause = makeCause({ cause: '', id: 'base-empty', occurrence: 2 });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [localCause] })],
                })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [baseCause] })],
                })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const causes = result.workElements[0].functions[0].failures[0].causes;

        // Empty causes are matched positionally: the local empty cause at index 0
        // merges with the base empty cause at index 0. Local risk data is preserved.
        expect(causes.length).toBe(1);
        expect(causes[0].occurrence).toBe(5); // Local risk data preserved
    });

    it('handles failure with no causes gracefully', () => {
        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [] })],
                })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [makeCause({ cause: 'New cause' })] })],
                })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const causes = result.workElements[0].functions[0].failures[0].causes;

        expect(causes.length).toBe(1);
        expect(causes[0].cause).toBe('New cause');
    });
});

// =========================================================================
// Clone helpers (new IDs)
// =========================================================================
describe('clone helpers (new IDs at every level)', () => {
    it('clones a work element with new IDs at all levels', () => {
        const local = makeOperation({ workElements: [] });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                id: 'original-we-id',
                type: 'Machine',
                functions: [makeFunction({
                    id: 'original-func-id',
                    description: 'Func',
                    failures: [makeFailure({
                        id: 'original-fail-id',
                        description: 'Falla',
                        causes: [makeCause({ id: 'original-cause-id', cause: 'Test cause' })],
                    })],
                })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const we = result.workElements[0];

        // All IDs should be mock-uuid-* (new)
        expect(we.id).toMatch(/^mock-uuid-/);
        expect(we.functions[0].id).toMatch(/^mock-uuid-/);
        expect(we.functions[0].failures[0].id).toMatch(/^mock-uuid-/);
        expect(we.functions[0].failures[0].causes[0].id).toMatch(/^mock-uuid-/);

        // Original IDs should NOT be present
        expect(we.id).not.toBe('original-we-id');
        expect(we.functions[0].id).not.toBe('original-func-id');
        expect(we.functions[0].failures[0].id).not.toBe('original-fail-id');
        expect(we.functions[0].failures[0].causes[0].id).not.toBe('original-cause-id');
    });

    it('preserves all data fields when cloning', () => {
        const local = makeOperation({ workElements: [] });
        const causeFull = makeCause({
            cause: 'Full cause',
            preventionControl: 'PC', detectionControl: 'DC',
            occurrence: 5, detection: 3, ap: ActionPriority.MEDIUM,
            preventionAction: 'PA', detectionAction: 'DA',
            responsible: 'Person', targetDate: '2024-01-01',
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Man',
                name: 'Operator',
                functions: [makeFunction({
                    description: 'Inspect part',
                    requirements: 'VDI 3456',
                    failures: [makeFailure({
                        description: 'Part not inspected',
                        effectLocal: 'Scrap',
                        effectEndUser: 'Injury',
                        severity: 9,
                        causes: [causeFull],
                    })],
                })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const we = result.workElements[0];

        expect(we.type).toBe('Man');
        expect(we.name).toBe('Operator');

        const func = we.functions[0];
        expect(func.description).toBe('Inspect part');
        expect(func.requirements).toBe('VDI 3456');

        const fail = func.failures[0];
        expect(fail.description).toBe('Part not inspected');
        expect(fail.effectLocal).toBe('Scrap');
        expect(fail.severity).toBe(9);

        const cause = fail.causes[0];
        expect(cause.cause).toBe('Full cause');
        expect(cause.preventionControl).toBe('PC');
        expect(cause.occurrence).toBe(5);
        expect(cause.ap).toBe(ActionPriority.MEDIUM);
    });
});

// =========================================================================
// Edge cases
// =========================================================================
describe('edge cases', () => {
    it('handles both local and base being completely empty', () => {
        const local = makeOperation({ workElements: [] });
        const base = makeLibraryOperation({ workElements: [] });

        const result = mergeWithLibrary(local, base);

        expect(result.workElements).toEqual([]);
        expect(result.id).toBe(local.id);
    });

    it('handles multiple work elements of different types', () => {
        const local = makeOperation({
            workElements: [
                makeWorkElement({ type: 'Machine', id: 'local-machine' }),
                makeWorkElement({ type: 'Man', id: 'local-man' }),
                makeWorkElement({ type: 'Material', id: 'local-material' }),
            ],
        });
        const base = makeLibraryOperation({
            workElements: [
                makeWorkElement({ type: 'Machine', id: 'base-machine' }),
                makeWorkElement({ type: 'Environment', id: 'base-env' }),
            ],
        });

        const result = mergeWithLibrary(local, base);
        const types = result.workElements.map(we => we.type);

        // Machine (merged), Environment (new from base), Man (local-only), Material (local-only)
        expect(types).toContain('Machine');
        expect(types).toContain('Environment');
        expect(types).toContain('Man');
        expect(types).toContain('Material');
        expect(result.workElements.length).toBe(4);
    });

    it('preserves local cause id when merging (no ID replacement)', () => {
        const localCause = makeCause({ id: 'my-precious-id', cause: 'Test cause' });
        const baseCause = makeCause({ id: 'base-id', cause: 'Test cause' });

        const local = makeOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [localCause] })],
                })],
            })],
        });
        const base = makeLibraryOperation({
            workElements: [makeWorkElement({
                type: 'Machine',
                functions: [makeFunction({
                    description: 'Func',
                    failures: [makeFailure({ description: 'Falla', causes: [baseCause] })],
                })],
            })],
        });

        const result = mergeWithLibrary(local, base);
        const mc = result.workElements[0].functions[0].failures[0].causes[0];

        // Local ID is preserved in merge (spread ...localCause)
        expect(mc.id).toBe('my-precious-id');
    });

    // =========================================================================
    // Empty cause deduplication
    // =========================================================================
    describe('empty cause deduplication', () => {
        it('local empty cause preserved when base has no empty causes', () => {
            const localEmpty = makeCause({ cause: '', id: 'local-empty', occurrence: 3 });
            const localSensor = makeCause({ cause: 'Sensor', id: 'local-sensor' });
            const baseSensor = makeCause({ cause: 'Sensor', id: 'base-sensor' });

            const local = makeOperation({
                workElements: [makeWorkElement({
                    type: 'Machine',
                    functions: [makeFunction({
                        description: 'Func',
                        failures: [makeFailure({ description: 'Falla', causes: [localEmpty, localSensor] })],
                    })],
                })],
            });
            const base = makeLibraryOperation({
                workElements: [makeWorkElement({
                    type: 'Machine',
                    functions: [makeFunction({
                        description: 'Func',
                        failures: [makeFailure({ description: 'Falla', causes: [baseSensor] })],
                    })],
                })],
            });

            const result = mergeWithLibrary(local, base);
            const causes = result.workElements[0].functions[0].failures[0].causes;

            expect(causes.length).toBe(2);
            expect(causes.some(c => c.cause === '')).toBe(true);
            expect(causes.some(c => c.cause === 'Sensor')).toBe(true);
        });

        it('multiple empty causes matched positionally', () => {
            const localEmpty1 = makeCause({ cause: '', id: 'local-e1', occurrence: 3 });
            const localEmpty2 = makeCause({ cause: '', id: 'local-e2', occurrence: 9 });
            const baseEmpty1 = makeCause({ cause: '', id: 'base-e1', occurrence: 1 });

            const local = makeOperation({
                workElements: [makeWorkElement({
                    type: 'Machine',
                    functions: [makeFunction({
                        description: 'Func',
                        failures: [makeFailure({ description: 'Falla', causes: [localEmpty1, localEmpty2] })],
                    })],
                })],
            });
            const base = makeLibraryOperation({
                workElements: [makeWorkElement({
                    type: 'Machine',
                    functions: [makeFunction({
                        description: 'Func',
                        failures: [makeFailure({ description: 'Falla', causes: [baseEmpty1] })],
                    })],
                })],
            });

            const result = mergeWithLibrary(local, base);
            const causes = result.workElements[0].functions[0].failures[0].causes;

            // First local empty merges with base empty (positional match),
            // second local empty kept as local-only.
            expect(causes.length).toBe(2);
            expect(causes[0].occurrence).toBe(3); // Local risk data preserved from first match
            expect(causes[1].occurrence).toBe(9); // Second local empty kept as-is
        });

        it('whitespace-only cause treated as empty', () => {
            const localCause = makeCause({ cause: '   ', id: 'local-ws', occurrence: 4 });
            const baseCause = makeCause({ cause: '', id: 'base-empty', occurrence: 1 });

            const local = makeOperation({
                workElements: [makeWorkElement({
                    type: 'Machine',
                    functions: [makeFunction({
                        description: 'Func',
                        failures: [makeFailure({ description: 'Falla', causes: [localCause] })],
                    })],
                })],
            });
            const base = makeLibraryOperation({
                workElements: [makeWorkElement({
                    type: 'Machine',
                    functions: [makeFunction({
                        description: 'Func',
                        failures: [makeFailure({ description: 'Falla', causes: [baseCause] })],
                    })],
                })],
            });

            const result = mergeWithLibrary(local, base);
            const causes = result.workElements[0].functions[0].failures[0].causes;

            // Whitespace-only and empty string are both treated as empty,
            // so they merge positionally into a single cause.
            expect(causes.length).toBe(1);
        });

        it('empty cause preserves local risk data during merge', () => {
            const localCause = makeCause({
                cause: '', id: 'local-risk',
                occurrence: 7, detection: 3, ap: ActionPriority.HIGH,
            });
            const baseCause = makeCause({
                cause: '', id: 'base-risk',
                occurrence: 2, detection: 2, ap: ActionPriority.LOW,
            });

            const local = makeOperation({
                workElements: [makeWorkElement({
                    type: 'Machine',
                    functions: [makeFunction({
                        description: 'Func',
                        failures: [makeFailure({ description: 'Falla', causes: [localCause] })],
                    })],
                })],
            });
            const base = makeLibraryOperation({
                workElements: [makeWorkElement({
                    type: 'Machine',
                    functions: [makeFunction({
                        description: 'Func',
                        failures: [makeFailure({ description: 'Falla', causes: [baseCause] })],
                    })],
                })],
            });

            const result = mergeWithLibrary(local, base);
            const mc = result.workElements[0].functions[0].failures[0].causes[0];

            expect(mc.occurrence).toBe(7);
            expect(mc.detection).toBe(3);
            expect(mc.ap).toBe(ActionPriority.HIGH);
        });

        it('extra empty causes from base added as new', () => {
            const baseEmpty1 = makeCause({ cause: '', id: 'base-e1', occurrence: 2 });
            const baseEmpty2 = makeCause({ cause: '', id: 'base-e2', occurrence: 6 });

            const local = makeOperation({
                workElements: [makeWorkElement({
                    type: 'Machine',
                    functions: [makeFunction({
                        description: 'Func',
                        failures: [makeFailure({ description: 'Falla', causes: [] })],
                    })],
                })],
            });
            const base = makeLibraryOperation({
                workElements: [makeWorkElement({
                    type: 'Machine',
                    functions: [makeFunction({
                        description: 'Func',
                        failures: [makeFailure({ description: 'Falla', causes: [baseEmpty1, baseEmpty2] })],
                    })],
                })],
            });

            const result = mergeWithLibrary(local, base);
            const causes = result.workElements[0].functions[0].failures[0].causes;

            // Local has 0 empty causes, base has 2 — both added as new.
            expect(causes.length).toBe(2);
        });
    });
});
