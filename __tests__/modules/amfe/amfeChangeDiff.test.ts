/**
 * Tests del motor de diff de contenido AMFE (modules/amfe/amfeChangeDiff.ts).
 *
 * Cubre: creacion del documento, sin cambios, header (con exclusiones revision/revDate),
 * causa modificada/agregada/eliminada, falla agregada, operacion agregada/eliminada,
 * y el cap MAX_ENTRIES → colapso a entrada 'document'.
 *
 * Docs minimos construidos inline con ids fijos para forzar el matching por id.
 */

import { diffAmfeDocs, MAX_ENTRIES } from '../../../modules/amfe/amfeChangeDiff';
import { createEmptyCause } from '../../../modules/amfe/amfeTypes';
import type {
    AmfeDocument, AmfeHeaderData, AmfeOperation, AmfeWorkElement,
    AmfeFunction, AmfeFailure, AmfeCause,
} from '../../../modules/amfe/amfeTypes';

// ---------------------------------------------------------------------------
// Helpers: constructores minimos con ids fijos.
// ---------------------------------------------------------------------------

function makeHeader(over: Partial<AmfeHeaderData> = {}): AmfeHeaderData {
    return {
        organization: 'Barack', location: 'Pilar', client: 'VWA',
        modelYear: '2026', subject: 'Insert', startDate: '2026-01-01',
        revDate: '2026-01-01', team: 'APQP', amfeNumber: 'AMFE-1',
        responsible: 'Facundo', confidentiality: 'Interno',
        partNumber: 'PN-1', processResponsible: 'Carlos', revision: 'A',
        approvedBy: 'Leonardo', scope: 'Proceso', applicableParts: 'PN-1',
        ...over,
    };
}

function makeCause(id: string, over: Partial<AmfeCause> = {}): AmfeCause {
    return { ...createEmptyCause(), id, cause: `Causa ${id}`, ...over };
}

function makeFailure(id: string, causes: AmfeCause[] = [], over: Partial<AmfeFailure> = {}): AmfeFailure {
    return {
        id,
        description: `Falla ${id}`,
        effectLocal: 'Efecto local', effectNextLevel: 'Efecto planta', effectEndUser: 'Efecto usuario',
        severity: 7,
        causes,
        ...over,
    };
}

function makeFunction(id: string, failures: AmfeFailure[] = [], over: Partial<AmfeFunction> = {}): AmfeFunction {
    return { id, description: `Funcion ${id}`, requirements: '', failures, ...over };
}

function makeWorkElement(id: string, functions: AmfeFunction[] = [], over: Partial<AmfeWorkElement> = {}): AmfeWorkElement {
    return { id, type: 'Machine', name: `Elemento ${id}`, functions, ...over };
}

function makeOp(id: string, opNumber: string, workElements: AmfeWorkElement[] = [], over: Partial<AmfeOperation> = {}): AmfeOperation {
    return { id, opNumber, name: `Operacion ${opNumber}`, workElements, ...over };
}

function makeDoc(operations: AmfeOperation[] = [], header: AmfeHeaderData = makeHeader()): AmfeDocument {
    return { header, operations };
}

/** Deep clone via JSON — mantiene ids, seguro para docs planos sin funciones. */
function clone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
}

/** Doc estandar de 1 op / 1 WE / 1 funcion / 1 falla / 1 causa, todos con ids fijos. */
function baseDoc(): AmfeDocument {
    const cause = makeCause('c1', { occurrence: 6, detection: 4 });
    const failure = makeFailure('f1', [cause]);
    const fn = makeFunction('fn1', [failure]);
    const we = makeWorkElement('we1', [fn]);
    const op = makeOp('op1', '30', [we], { name: 'COSTURA' });
    return makeDoc([op]);
}

// ---------------------------------------------------------------------------
// 1. Creacion del documento (oldDoc null)
// ---------------------------------------------------------------------------

describe('diffAmfeDocs — creacion del documento', () => {
    it('oldDoc null devuelve exactamente 1 entrada document/added con summary de creacion', () => {
        const entries = diffAmfeDocs(null, baseDoc());
        expect(entries).toHaveLength(1);
        expect(entries[0].scope).toBe('document');
        expect(entries[0].changeType).toBe('added');
        expect(entries[0].summary).toBe('Creación del documento');
    });
});

// ---------------------------------------------------------------------------
// 2. Sin cambios
// ---------------------------------------------------------------------------

describe('diffAmfeDocs — sin cambios', () => {
    it('mismo doc clonado devuelve arreglo vacio', () => {
        const doc = baseDoc();
        expect(diffAmfeDocs(clone(doc), doc)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 3. Header
// ---------------------------------------------------------------------------

describe('diffAmfeDocs — header', () => {
    it('cambiar subject genera 1 entrada header con Caratula y viejo→nuevo', () => {
        const oldDoc = baseDoc();
        const newDoc = clone(oldDoc);
        newDoc.header.subject = 'Armrest';

        const entries = diffAmfeDocs(oldDoc, newDoc);
        expect(entries).toHaveLength(1);
        const e = entries[0];
        expect(e.scope).toBe('header');
        expect(e.changeType).toBe('modified');
        expect(e.field).toBe('subject');
        expect(e.oldValue).toBe('Insert');
        expect(e.newValue).toBe('Armrest');
        expect(e.summary).toContain('Carátula');
        expect(e.summary).toContain('Insert');
        expect(e.summary).toContain('Armrest');
    });

    it('cambiar revision NO genera entrada (excluido)', () => {
        const oldDoc = baseDoc();
        const newDoc = clone(oldDoc);
        newDoc.header.revision = 'B';
        expect(diffAmfeDocs(oldDoc, newDoc)).toEqual([]);
    });

    it('cambiar revDate NO genera entrada (excluido)', () => {
        const oldDoc = baseDoc();
        const newDoc = clone(oldDoc);
        newDoc.header.revDate = '2026-12-31';
        expect(diffAmfeDocs(oldDoc, newDoc)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 4. Causa modificada
// ---------------------------------------------------------------------------

describe('diffAmfeDocs — causa modificada', () => {
    it('cambiar occurrence 6→4 en causa existente genera 1 entrada cause/occurrence', () => {
        const oldDoc = baseDoc();
        const newDoc = clone(oldDoc);
        newDoc.operations[0].workElements[0].functions[0].failures[0].causes[0].occurrence = 4;

        const entries = diffAmfeDocs(oldDoc, newDoc);
        expect(entries).toHaveLength(1);
        const e = entries[0];
        expect(e.scope).toBe('cause');
        expect(e.changeType).toBe('modified');
        expect(e.field).toBe('occurrence');
        expect(e.oldValue).toBe('6');
        expect(e.newValue).toBe('4');
        expect(e.summary).toContain('Ocurrencia');
        expect(e.summary).toContain('6');
        expect(e.summary).toContain('4');
    });
});

// ---------------------------------------------------------------------------
// 5. Causa agregada / eliminada
// ---------------------------------------------------------------------------

describe('diffAmfeDocs — causa agregada / eliminada', () => {
    it('causa con id nuevo genera entrada cause/added', () => {
        const oldDoc = baseDoc();
        const newDoc = clone(oldDoc);
        newDoc.operations[0].workElements[0].functions[0].failures[0].causes.push(
            makeCause('c2', { cause: 'Dosificacion corta' }),
        );

        const entries = diffAmfeDocs(oldDoc, newDoc);
        expect(entries).toHaveLength(1);
        expect(entries[0].scope).toBe('cause');
        expect(entries[0].changeType).toBe('added');
        expect(entries[0].newValue).toBe('Dosificacion corta');
    });

    it('causa eliminada genera entrada cause/removed', () => {
        const oldDoc = baseDoc();
        const newDoc = clone(oldDoc);
        newDoc.operations[0].workElements[0].functions[0].failures[0].causes = [];

        const entries = diffAmfeDocs(oldDoc, newDoc);
        expect(entries).toHaveLength(1);
        expect(entries[0].scope).toBe('cause');
        expect(entries[0].changeType).toBe('removed');
        expect(entries[0].oldValue).toBe('Causa c1');
    });
});

// ---------------------------------------------------------------------------
// 6. Falla agregada / operacion agregada / operacion eliminada
// ---------------------------------------------------------------------------

describe('diffAmfeDocs — falla y operacion', () => {
    it('falla agregada genera entrada failure/added con nueva falla y S=', () => {
        const oldDoc = baseDoc();
        const newDoc = clone(oldDoc);
        newDoc.operations[0].workElements[0].functions[0].failures.push(
            makeFailure('f2', [makeCause('c9')], { description: 'Costura torcida', severity: 5 }),
        );

        const entries = diffAmfeDocs(oldDoc, newDoc);
        expect(entries).toHaveLength(1);
        const e = entries[0];
        expect(e.scope).toBe('failure');
        expect(e.changeType).toBe('added');
        expect(e.summary).toContain('nueva falla');
        expect(e.summary).toContain('S=');
    });

    it('operacion agregada genera entrada operation/added con Nueva operacion', () => {
        const oldDoc = baseDoc();
        const newDoc = clone(oldDoc);
        newDoc.operations.push(makeOp('op2', '40', [], { name: 'TROQUELADO' }));

        const entries = diffAmfeDocs(oldDoc, newDoc);
        expect(entries).toHaveLength(1);
        const e = entries[0];
        expect(e.scope).toBe('operation');
        expect(e.changeType).toBe('added');
        expect(e.summary).toContain('Nueva operación');
    });

    it('operacion eliminada genera entrada operation/removed con Se eliminó la operación', () => {
        const oldDoc = baseDoc();
        const newDoc = clone(oldDoc);
        newDoc.operations = [];

        const entries = diffAmfeDocs(oldDoc, newDoc);
        expect(entries).toHaveLength(1);
        const e = entries[0];
        expect(e.scope).toBe('operation');
        expect(e.changeType).toBe('removed');
        expect(e.summary).toContain('Se eliminó la operación');
    });
});

// ---------------------------------------------------------------------------
// 7. Cap MAX_ENTRIES → colapso a document
// ---------------------------------------------------------------------------

describe('diffAmfeDocs — cap anti-flood', () => {
    it('mas de MAX_ENTRIES cambios colapsan a 1 entrada document con Reestructuración masiva', () => {
        // Construimos > MAX_ENTRIES causas en una op, cada una con un cambio de occurrence.
        const n = MAX_ENTRIES + 50;
        const causes: AmfeCause[] = [];
        for (let i = 0; i < n; i++) {
            causes.push(makeCause(`c${i}`, { occurrence: 6 }));
        }
        const failure = makeFailure('f1', causes);
        const fn = makeFunction('fn1', [failure]);
        const we = makeWorkElement('we1', [fn]);
        const op = makeOp('op1', '30', [we], { name: 'COSTURA' });
        const oldDoc = makeDoc([op]);

        const newDoc = clone(oldDoc);
        // Cambiar occurrence en todas las causas → un cambio por causa.
        for (const c of newDoc.operations[0].workElements[0].functions[0].failures[0].causes) {
            c.occurrence = 4;
        }

        const entries = diffAmfeDocs(oldDoc, newDoc);
        expect(entries).toHaveLength(1);
        const e = entries[0];
        expect(e.scope).toBe('document');
        expect(e.summary).toContain('Reestructuración masiva');
    });
});
