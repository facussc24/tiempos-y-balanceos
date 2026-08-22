/**
 * AIAG-VDA FMEA Action Priority (AP) — PFMEA
 *
 * Transcripcion literal de la **Figura 3.5-3 "Action Priority for PFMEA"** del
 * AIAG & VDA FMEA Handbook, 1st Edition (June 2019), paginas 122-123 del PDF del
 * manual de Barack (`4- MANUALES\AMFE\FMEA-AMFE-VDA-AIAG\`).
 *
 * El manual agrupa la severidad en CUATRO bandas: **9-10, 5-8, 2-4 y 1**.
 *
 * 🔴 Hasta el 22/08/2026 este archivo usaba las bandas 9-10 / 7-8 / 4-6 / 2-3 / 1, que
 * NO son las del manual, y ademas se apartaba de la figura en tres celdas (S5-8 O4-5
 * D5-6, S5-8 O6-7 D2-4 y S9-10 O4-5 D2-4). Resultado: 305 de las 838 combinaciones
 * validas daban distinto y 281 de ellas SUBDECLARABAN el riesgo. Lo encontro una
 * auditoria con la norma delante; los tests que decian "verificado 1000/1000" estaban
 * escritos a partir de este codigo, no del manual, asi que fijaban el error.
 * Por eso la tabla ahora se escribe como FILAS, en el mismo orden en que estan
 * impresas: cada fila se puede cotejar con el manual sin leer logica.
 */

type AP = 'H' | 'M' | 'L';

/** Una fila de la Figura 3.5-3: rangos de S, O y D -> AP (o 'Error'). */
interface FilaAP {
    s: [number, number];
    o: [number, number];
    d: [number, number];
    ap: AP | 'Error';
}

/**
 * Figura 3.5-3, fila por fila y en el orden del manual.
 * Las cuatro ultimas son las filas especiales impresas al pie de la figura.
 */
export const FIGURA_3_5_3: readonly FilaAP[] = [
    // ── S 9-10: efectos de seguridad y/o reglamentarios ──────────────────────
    { s: [9, 10], o: [6, 10], d: [2, 10], ap: 'H' },
    { s: [9, 10], o: [4, 5], d: [7, 10], ap: 'H' },
    { s: [9, 10], o: [4, 5], d: [5, 6], ap: 'H' },
    { s: [9, 10], o: [4, 5], d: [2, 4], ap: 'M' },
    { s: [9, 10], o: [2, 3], d: [7, 10], ap: 'H' },
    { s: [9, 10], o: [2, 3], d: [5, 6], ap: 'M' },
    { s: [9, 10], o: [2, 3], d: [2, 4], ap: 'L' },

    // ── S 5-8: perdida o degradacion de funcion / disrupcion de fabricacion ──
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

    // ── S 2-4: calidad percibida (aspecto, ruido, tacto) ─────────────────────
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

    // ── Filas especiales al pie de la figura ─────────────────────────────────
    // "Low priority due to the failure being virtually eliminated through prevention controls"
    { s: [2, 10], o: [1, 1], d: [1, 1], ap: 'L' },
    // "Low priority due to no discernible effect"
    { s: [1, 1], o: [1, 10], d: [1, 10], ap: 'L' },
    // "O=1 implausible without D=1"
    { s: [2, 10], o: [1, 1], d: [2, 10], ap: 'Error' },
    // "D=1 implausible without O=1"
    { s: [2, 10], o: [2, 10], d: [1, 1], ap: 'Error' },
];

const enRango = (v: number, [min, max]: [number, number]) => v >= min && v <= max;

function buscarFila(s: number, o: number, d: number): FilaAP | undefined {
    return FIGURA_3_5_3.find(f => enRango(s, f.s) && enRango(o, f.o) && enRango(d, f.d));
}

function normalizar(s: number, o: number, d: number): [number, number, number] | null {
    if (isNaN(s) || isNaN(o) || isNaN(d)) return null;
    const sInt = Math.round(s);
    const oInt = Math.round(o);
    const dInt = Math.round(d);
    if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return null;
    return [sInt, oInt, dInt];
}

/**
 * Calcula el Action Priority segun la Figura 3.5-3 del AIAG-VDA (PFMEA).
 *
 * Devuelve '' cuando los valores estan fuera de rango y tambien cuando la figura
 * marca la combinacion como **Error** (O=1 sin D=1, o D=1 sin O=1): ahi el manual no
 * asigna prioridad, dice que la calificacion es implausible y el equipo tiene que
 * revisarla. Para distinguir un caso del otro: `isImplausibleRating()`.
 */
export function calculateAP(s: number, o: number, d: number): 'H' | 'M' | 'L' | '' {
    const v = normalizar(s, o, d);
    if (!v) return '';
    const fila = buscarFila(...v);
    if (!fila || fila.ap === 'Error') return '';
    return fila.ap;
}

/**
 * true si la Figura 3.5-3 marca la combinacion como "Error": O=1 sin D=1, o D=1 sin
 * O=1. No es un AP bajo: es una calificacion que el manual considera implausible.
 */
export function isImplausibleRating(s: number, o: number, d: number): boolean {
    const v = normalizar(s, o, d);
    if (!v) return false;
    return buscarFila(...v)?.ap === 'Error';
}
