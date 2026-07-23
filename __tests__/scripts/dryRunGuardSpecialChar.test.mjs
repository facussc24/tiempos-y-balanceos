/**
 * Tests del candado CC/SC en dryRunGuard (pendiente research 2026-07-16, implementado 2026-07-23).
 *
 * Regla protegida: "CC/SC solo las asigna Fak" (core-prohibiciones #2 / amfe.md §2).
 * Un script con --apply NO puede introducir caracteristicas especiales nuevas.
 *
 * Cubre diffSpecialChars (la unidad decidible sin process.exit):
 *  1. ''->CC  => ccDelta 1 (bloquearia el apply)
 *  2. ''->SC  => scDelta 1
 *  3. mover un CC de una causa a otra (renumeracion) => delta 0 (NO bloquea)
 *  4. cambio de texto sin tocar specialChar => delta 0 y sin transiciones
 *  5. quitar un CC => delta negativo (NO bloquea; borrar no es asignar)
 *  6. specialChar en fm legacy (nivel failure) tambien se detecta
 */
import { describe, it, expect } from 'vitest';
import { diffSpecialChars } from '../../scripts/_lib/dryRunGuard.mjs';

const doc = (sc1, sc2, fmSc = '') => ({
    operations: [{
        opNumber: 10, name: 'COSTURA', workElements: [{
            name: 'Maquina de costura', type: 'Machine',
            functions: [{ description: 'Coser', failures: [{
                description: 'Costura torcida', specialChar: fmSc, causes: [
                    { cause: 'Guia floja', description: 'Guia floja', severity: 5, occurrence: 4, detection: 4, specialChar: sc1 },
                    { cause: 'Tension mal regulada', description: 'Tension mal regulada', severity: 5, occurrence: 4, detection: 4, specialChar: sc2 },
                ],
            }] }],
        }],
    }],
});

describe('diffSpecialChars — candado CC/SC', () => {
    it("1. ''->CC introduce ccDelta=1", () => {
        const r = diffSpecialChars(doc('', ''), doc('CC', ''));
        expect(r.ccDelta).toBe(1);
        expect(r.scDelta).toBe(0);
        expect(r.transitions).toHaveLength(1);
    });

    it("2. ''->SC introduce scDelta=1", () => {
        const r = diffSpecialChars(doc('', ''), doc('', 'SC'));
        expect(r.scDelta).toBe(1);
    });

    it('3. mover un CC de causa (renumeracion) NO cuenta como asignacion nueva', () => {
        const r = diffSpecialChars(doc('CC', ''), doc('', 'CC'));
        expect(r.ccDelta).toBe(0);
        expect(r.scDelta).toBe(0);
    });

    it('4. cambio de texto sin tocar specialChar => sin deltas ni transiciones', () => {
        const after = doc('', '');
        after.operations[0].workElements[0].functions[0].failures[0].causes[0].cause = 'Guia desajustada';
        after.operations[0].workElements[0].functions[0].failures[0].causes[0].description = 'Guia desajustada';
        const r = diffSpecialChars(doc('', ''), after);
        expect(r.ccDelta).toBe(0);
        expect(r.transitions).toHaveLength(0);
    });

    it('5. quitar un CC da delta negativo (borrar no es asignar => no bloquea)', () => {
        const r = diffSpecialChars(doc('CC', ''), doc('', ''));
        expect(r.ccDelta).toBe(-1);
    });

    it('6. specialChar en fm legacy (nivel failure) tambien se detecta', () => {
        const r = diffSpecialChars(doc('', '', ''), doc('', '', 'CC'));
        expect(r.ccDelta).toBe(1);
    });
});
