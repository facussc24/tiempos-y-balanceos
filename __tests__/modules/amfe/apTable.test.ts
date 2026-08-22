import { describe, it, expect } from 'vitest';
import { calculateAP, isImplausibleRating } from '../../../modules/amfe/apTable';

/**
 * La referencia de este test es la **Figura 3.5-3 "Action Priority for PFMEA"** del
 * AIAG & VDA FMEA Handbook 1st Ed. (2019), leida de las paginas 122-123 del PDF del
 * manual de Barack. Esta escrita aparte, con logica propia, para NO cotejar la tabla
 * contra si misma: hasta el 22/08/2026 este archivo probaba lo que el codigo hacia
 * (bandas 9-10/7-8/4-6/2-3/1) en vez de lo que el manual dice (9-10/5-8/2-4/1), y por
 * eso 281 combinaciones subdeclaraban el riesgo con los tests en verde.
 */
function apSegunManual(s: number, o: number, d: number): 'H' | 'M' | 'L' | 'Error' {
    if (s === 1) return 'L';                                  // sin efecto perceptible
    if (o === 1 && d === 1) return 'L';                       // falla eliminada por prevencion
    if (o === 1) return 'Error';                              // "O=1 implausible without D=1"
    if (d === 1) return 'Error';                              // "D=1 implausible without O=1"

    if (s >= 9) {                                             // banda S 9-10
        if (o >= 6) return 'H';
        if (o >= 4) return d >= 5 ? 'H' : 'M';
        return d >= 7 ? 'H' : d >= 5 ? 'M' : 'L';
    }
    if (s >= 5) {                                             // banda S 5-8
        if (o >= 8) return 'H';
        if (o >= 6) return d >= 5 ? 'H' : 'M';
        if (o >= 4) return d >= 5 ? 'H' : 'M';
        return d >= 5 ? 'M' : 'L';
    }
    // banda S 2-4
    if (o >= 8) return 'H';
    if (o >= 6) return d >= 5 ? 'H' : 'M';
    if (o >= 4) return d >= 7 ? 'H' : d >= 5 ? 'M' : 'L';
    return d >= 7 ? 'M' : 'L';
}

describe('calculateAP — Figura 3.5-3 del AIAG-VDA (PFMEA)', () => {

    it('coincide con la figura en las 1000 combinaciones S/O/D', () => {
        const distintas: string[] = [];
        for (let s = 1; s <= 10; s++)
            for (let o = 1; o <= 10; o++)
                for (let d = 1; d <= 10; d++) {
                    const manual = apSegunManual(s, o, d);
                    const esperado = manual === 'Error' ? '' : manual;
                    if (calculateAP(s, o, d) !== esperado)
                        distintas.push(`S${s} O${o} D${d}: manual=${manual} tabla=${calculateAP(s, o, d)}`);
                }
        expect(distintas).toEqual([]);
    });

    describe('las tres celdas que el codigo tenia mal (auditoria de cliente 22/08/2026)', () => {
        it('S 5-8 · O 4-5 · D 5-6 -> H (daba M, subdeclaraba)', () => {
            expect(calculateAP(7, 4, 6)).toBe('H');
            expect(calculateAP(5, 5, 5)).toBe('H');
            expect(calculateAP(8, 4, 5)).toBe('H');
        });
        it('S 5-8 · O 6-7 · D 2-4 -> M (daba H, sobredeclaraba)', () => {
            expect(calculateAP(7, 6, 4)).toBe('M');
            expect(calculateAP(8, 7, 2)).toBe('M');
        });
        it('S 9-10 · O 4-5 · D 2-4 -> M (daba H, sobredeclaraba)', () => {
            expect(calculateAP(9, 4, 3)).toBe('M');
            expect(calculateAP(10, 5, 4)).toBe('M');
        });
    });

    describe('las bandas de severidad son las del manual: 9-10, 5-8, 2-4, 1', () => {
        it('S=5 y S=6 pertenecen a la banda 5-8, no a una banda baja', () => {
            expect(calculateAP(5, 8, 2)).toBe('H');   // banda 5-8: O 8-10 -> H siempre
            expect(calculateAP(6, 8, 2)).toBe('H');
            expect(calculateAP(6, 2, 8)).toBe('M');   // banda 5-8: O 2-3 / D 7-10 -> M
        });
        it('S=4 pertenece a la banda 2-4', () => {
            expect(calculateAP(4, 4, 6)).toBe('M');   // banda 2-4: O 4-5 / D 5-6 -> M
            expect(calculateAP(4, 8, 2)).toBe('H');   // banda 2-4: O 8-10 -> H
        });
        it('S=2 y S=3 tambien: O 8-10 -> H (antes daba L o M)', () => {
            expect(calculateAP(2, 8, 2)).toBe('H');
            expect(calculateAP(3, 10, 10)).toBe('H');
        });
        it('S=1 siempre L', () => {
            for (let o = 1; o <= 10; o++)
                for (let d = 1; d <= 10; d++)
                    expect(calculateAP(1, o, d)).toBe('L');
        });
    });

    describe('combinaciones que el manual marca "Error"', () => {
        it('O=1 con D>=2 es implausible: sin AP', () => {
            expect(calculateAP(10, 1, 8)).toBe('');
            expect(isImplausibleRating(10, 1, 8)).toBe(true);
            expect(calculateAP(5, 1, 2)).toBe('');
        });
        it('D=1 con O>=2 es implausible: sin AP', () => {
            expect(calculateAP(7, 5, 1)).toBe('');
            expect(isImplausibleRating(7, 5, 1)).toBe(true);
        });
        it('O=1 y D=1 juntos SI son validos: L', () => {
            expect(calculateAP(10, 1, 1)).toBe('L');
            expect(isImplausibleRating(10, 1, 1)).toBe(false);
        });
        it('S=1 nunca es implausible', () => {
            expect(calculateAP(1, 1, 10)).toBe('L');
            expect(isImplausibleRating(1, 1, 10)).toBe(false);
        });
    });

    describe('entradas invalidas', () => {
        it('fuera de rango -> vacio', () => {
            expect(calculateAP(0, 5, 5)).toBe('');
            expect(calculateAP(11, 5, 5)).toBe('');
            expect(calculateAP(5, 0, 5)).toBe('');
            expect(calculateAP(5, 5, 11)).toBe('');
        });
        it('NaN -> vacio', () => {
            expect(calculateAP(NaN, 5, 5)).toBe('');
            expect(calculateAP(5, NaN, 5)).toBe('');
            expect(calculateAP(5, 5, NaN)).toBe('');
        });
        it('isImplausibleRating no se cuelga con entradas invalidas', () => {
            expect(isImplausibleRating(NaN, 5, 5)).toBe(false);
            expect(isImplausibleRating(0, 1, 5)).toBe(false);
        });
    });

    describe('redondeo', () => {
        it('redondea decimales', () => expect(calculateAP(5.4, 5.4, 5.4)).toBe(calculateAP(5, 5, 5)));
        it('redondea 0.5 para arriba', () => expect(calculateAP(0.5, 5, 5)).toBe(calculateAP(1, 5, 5)));
        it('redondea 10.4 a 10', () => expect(calculateAP(10.4, 5, 5)).toBe(calculateAP(10, 5, 5)));
        it('10.6 redondea a 11 y queda invalido', () => expect(calculateAP(10.6, 5, 5)).toBe(''));
    });
});
