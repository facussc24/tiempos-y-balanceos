import { describe, it, expect } from 'vitest';
import { calculateAP, TABLA_AP_OFICIAL } from '../../../modules/amfe/apTable';

/**
 * La referencia de este test es la tabla **"AP - Prioridad de accion para AMFE de diseño y
 * AMFE de proceso"** del manual AIAG-VDA publicado, version SETEC
 * (`MANUAL AMFE  R06 Julio 2020 Participante.pdf`, paginas 116-118 del PDF). Esta escrita
 * aparte y con OTRA forma —una matriz por banda de S, con las columnas de D en el orden
 * impreso: 7-10, 5-6, 2-4, 1— para NO cotejar la tabla contra si misma.
 *
 * Hasta el 23/09/2026 el codigo y este test copiaban un BORRADOR de 2017 del manual (bandas
 * de S 9-10/5-8/2-4/1 y casilleros "Error"). Decision de Fak: la tabla oficial, ni mas ni menos.
 */
type Fila = ['H' | 'M' | 'L', 'H' | 'M' | 'L', 'H' | 'M' | 'L', 'H' | 'M' | 'L'];
const MANUAL: Record<string, Record<string, Fila>> = {
    //          O 8-10                 O 6-7                  O 4-5                  O 2-3                  O 1
    '9-10': { '8-10': ['H', 'H', 'H', 'H'], '6-7': ['H', 'H', 'H', 'H'], '4-5': ['H', 'H', 'H', 'M'], '2-3': ['H', 'M', 'L', 'L'], '1': ['L', 'L', 'L', 'L'] },
    '7-8':  { '8-10': ['H', 'H', 'H', 'H'], '6-7': ['H', 'H', 'H', 'M'], '4-5': ['H', 'M', 'M', 'M'], '2-3': ['M', 'M', 'L', 'L'], '1': ['L', 'L', 'L', 'L'] },
    '4-6':  { '8-10': ['H', 'H', 'M', 'M'], '6-7': ['M', 'M', 'M', 'L'], '4-5': ['M', 'L', 'L', 'L'], '2-3': ['L', 'L', 'L', 'L'], '1': ['L', 'L', 'L', 'L'] },
    '2-3':  { '8-10': ['M', 'M', 'L', 'L'], '6-7': ['L', 'L', 'L', 'L'], '4-5': ['L', 'L', 'L', 'L'], '2-3': ['L', 'L', 'L', 'L'], '1': ['L', 'L', 'L', 'L'] },
};
const bandaS = (s: number) => (s >= 9 ? '9-10' : s >= 7 ? '7-8' : s >= 4 ? '4-6' : '2-3');
const bandaO = (o: number) => (o >= 8 ? '8-10' : o >= 6 ? '6-7' : o >= 4 ? '4-5' : o >= 2 ? '2-3' : '1');
const columnaD = (d: number) => (d >= 7 ? 0 : d >= 5 ? 1 : d >= 2 ? 2 : 3);
function apSegunManual(s: number, o: number, d: number): 'H' | 'M' | 'L' {
    if (s === 1) return 'L';                                   // "SIN EFECTO": L en toda la fila
    return MANUAL[bandaS(s)][bandaO(o)][columnaD(d)];
}

describe('calculateAP — tabla oficial AIAG-VDA (SETEC pag. 116-118)', () => {

    it('coincide con el manual en las 1000 combinaciones S/O/D', () => {
        const distintas: string[] = [];
        for (let s = 1; s <= 10; s++)
            for (let o = 1; o <= 10; o++)
                for (let d = 1; d <= 10; d++)
                    if (calculateAP(s, o, d) !== apSegunManual(s, o, d))
                        distintas.push(`S${s} O${o} D${d}: manual=${apSegunManual(s, o, d)} tabla=${calculateAP(s, o, d)}`);
        expect(distintas).toEqual([]);
    });

    it('cada combinacion cae en UNA sola fila de la tabla (sin huecos ni solapes)', () => {
        const problemas: string[] = [];
        for (let s = 1; s <= 10; s++)
            for (let o = 1; o <= 10; o++)
                for (let d = 1; d <= 10; d++) {
                    const n = TABLA_AP_OFICIAL.filter(f =>
                        s >= f.s[0] && s <= f.s[1] && o >= f.o[0] && o <= f.o[1] && d >= f.d[0] && d <= f.d[1]).length;
                    if (n !== 1) problemas.push(`S${s} O${o} D${d}: ${n} filas`);
                }
        expect(problemas).toEqual([]);
    });

    describe('las bandas de severidad son las publicadas: 9-10, 7-8, 4-6, 2-3, 1', () => {
        it('S=7 y S=8 comparten banda, S=6 no: O 4-5 · D 5-6', () => {
            expect(calculateAP(8, 4, 6)).toBe('M');
            expect(calculateAP(7, 5, 5)).toBe('M');
            expect(calculateAP(6, 5, 5)).toBe('L');
        });
        it('S=5 con O 4 y D 7-10 es M (el borrador de 2017 daba H)', () => {
            expect(calculateAP(5, 4, 8)).toBe('M');
            expect(calculateAP(5, 4, 7)).toBe('M');
        });
        it('S 4-6 con O 2-3 es L con cualquier D', () => {
            for (let d = 1; d <= 10; d++) expect(calculateAP(5, 3, d)).toBe('L');
        });
        it('S 2-3 solo llega a M con O 8-10 y D 5-10', () => {
            expect(calculateAP(3, 9, 8)).toBe('M');
            expect(calculateAP(2, 8, 5)).toBe('M');
            expect(calculateAP(3, 8, 4)).toBe('L');
            expect(calculateAP(3, 7, 10)).toBe('L');
        });
        it('S=1 siempre L', () => {
            for (let o = 1; o <= 10; o++)
                for (let d = 1; d <= 10; d++)
                    expect(calculateAP(1, o, d)).toBe('L');
        });
    });

    describe('la tabla publicada no tiene casilleros "Error"', () => {
        it('O=1 da L con cualquier D', () => {
            expect(calculateAP(10, 1, 8)).toBe('L');
            expect(calculateAP(5, 1, 2)).toBe('L');
            expect(calculateAP(10, 1, 1)).toBe('L');
        });
        it('D=1 tiene AP propio segun S y O', () => {
            expect(calculateAP(9, 8, 1)).toBe('H');
            expect(calculateAP(10, 4, 1)).toBe('M');
            expect(calculateAP(7, 5, 1)).toBe('M');
            expect(calculateAP(8, 6, 1)).toBe('M');
            expect(calculateAP(5, 7, 1)).toBe('L');
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
    });

    describe('redondeo', () => {
        it('redondea decimales', () => expect(calculateAP(5.4, 5.4, 5.4)).toBe(calculateAP(5, 5, 5)));
        it('redondea 0.5 para arriba', () => expect(calculateAP(0.5, 5, 5)).toBe(calculateAP(1, 5, 5)));
        it('redondea 10.4 a 10', () => expect(calculateAP(10.4, 5, 5)).toBe(calculateAP(10, 5, 5)));
        it('10.6 redondea a 11 y queda invalido', () => expect(calculateAP(10.6, 5, 5)).toBe(''));
    });
});
