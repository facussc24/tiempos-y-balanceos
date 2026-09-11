/**
 * apTable.mjs — Versión MJS de modules/amfe/apTable.ts
 * Transcripción literal de la Figura 3.5-3 del AIAG-VDA FMEA Handbook 1st Edition (2019).
 */

export const FIGURA_3_5_3 = [
    // S 9-10
    { s: [9, 10], o: [6, 10], d: [2, 10], ap: 'H' },
    { s: [9, 10], o: [4, 5], d: [7, 10], ap: 'H' },
    { s: [9, 10], o: [4, 5], d: [5, 6], ap: 'H' },
    { s: [9, 10], o: [4, 5], d: [2, 4], ap: 'M' },
    { s: [9, 10], o: [2, 3], d: [7, 10], ap: 'H' },
    { s: [9, 10], o: [2, 3], d: [5, 6], ap: 'M' },
    { s: [9, 10], o: [2, 3], d: [2, 4], ap: 'L' },

    // S 5-8
    { s: [5, 8], o: [8, 10], d: [2, 10], ap: 'H' },
    { s: [5, 8], o: [6, 7], d: [7, 10], ap: 'H' },
    { s: [5, 8], o: [6, 7], d: [5, 6], ap: 'H' },
    { s: [5, 8], o: [6, 7], d: [2, 4], ap: 'M' },
    { s: [5, 8], o: [4, 5], d: [7, 10], ap: 'H' },
    { s: [5, 8], o: [4, 5], d: [5, 6], ap: 'H' },
    { s: [5, 8], o: [4, 5], d: [2, 4], ap: 'M' },
    { s: [5, 8], o: [2, 3], d: [7, 10], ap: 'M' },
    { s: [5, 8], o: [2, 3], d: [5, 6], ap: 'M' },
    { s: [5, 8], o: [2, 3], d: [2, 4], ap: 'L' },

    // S 2-4
    { s: [2, 4], o: [8, 10], d: [2, 10], ap: 'H' },
    { s: [2, 4], o: [6, 7], d: [7, 10], ap: 'H' },
    { s: [2, 4], o: [6, 7], d: [5, 6], ap: 'H' },
    { s: [2, 4], o: [6, 7], d: [2, 4], ap: 'M' },
    { s: [2, 4], o: [4, 5], d: [7, 10], ap: 'H' },
    { s: [2, 4], o: [4, 5], d: [5, 6], ap: 'M' },
    { s: [2, 4], o: [4, 5], d: [2, 4], ap: 'L' },
    { s: [2, 4], o: [2, 3], d: [7, 10], ap: 'M' },
    { s: [2, 4], o: [2, 3], d: [5, 6], ap: 'L' },
    { s: [2, 4], o: [2, 3], d: [2, 4], ap: 'L' },

    // Especiales
    { s: [2, 10], o: [1, 1], d: [1, 1], ap: 'L' },
    { s: [1, 1], o: [1, 10], d: [1, 10], ap: 'L' },
    { s: [2, 10], o: [1, 1], d: [2, 10], ap: 'Error' },
    { s: [2, 10], o: [2, 10], d: [1, 1], ap: 'Error' },
];

const enRango = (v, [min, max]) => v >= min && v <= max;

function buscarFila(s, o, d) {
    return FIGURA_3_5_3.find(f => enRango(s, f.s) && enRango(o, f.o) && enRango(d, f.d));
}

function normalizar(s, o, d) {
    if (isNaN(s) || isNaN(o) || isNaN(d)) return null;
    const sInt = Math.round(s);
    const oInt = Math.round(o);
    const dInt = Math.round(d);
    if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return null;
    return [sInt, oInt, dInt];
}

export function calculateAP(s, o, d) {
    const v = normalizar(s, o, d);
    if (!v) return '';
    const fila = buscarFila(...v);
    if (!fila || fila.ap === 'Error') return '';
    return fila.ap;
}
