/**
 * AIAG-VDA FMEA Action Priority (AP) — AMFE de diseño y de proceso
 *
 * Transcripcion literal de la tabla **"AP - Prioridad de accion para AMFE de diseño y AMFE de
 * proceso"** del manual AIAG-VDA publicado (Handbook 1° edicion, junio de 2019), en la version
 * licenciada de SETEC: `4- MANUALES\AMFE\MANUAL AMFE  R06 Julio 2020 Participante.pdf`,
 * **paginas 116, 117 y 118 del PDF** (laminas 231 a 235). Es la tabla oficial: decision de Fak
 * del 23/09/2026, *"vamos a usar la tabla oficial ni mas ni menos"*.
 *
 * Bandas de la tabla oficial:
 *   - Severidad:  9-10 · 7-8 · 4-6 · 2-3 · 1
 *   - Ocurrencia: 8-10 · 6-7 · 4-5 · 2-3 · 1
 *   - Deteccion:  7-10 · 5-6 · 2-4 · 1
 *   - O = 1 da L con cualquier D, y S = 1 da L siempre. La tabla NO tiene casilleros "Error".
 *
 * 🔴 Entre el 22/08 y el 23/09/2026 este archivo copiaba la Figura 3.5-3 de
 * `446076670-FMEA-AIAG-VDA-First-Edition-pdf.pdf`, que resulto ser un BORRADOR del manual
 * (un Word del 05/12/2017, anterior a la publicacion): bandas de S 9-10 / 5-8 / 2-4 / 1 y
 * combinaciones marcadas "Error" que el manual publicado no tiene. Con esa tabla, 100 de las
 * 118 causas del AMFE 173 daban H. Memoria `project_tabla_ap_de_la_casa_es_el_borrador_2017`.
 *
 * La tabla se escribe como FILAS en el orden impreso, para poder cotejarla con las paginas
 * sin leer logica. El test (`__tests__/modules/amfe/apTable.test.ts`) la compara contra una
 * transcripcion hecha aparte, en forma de matriz, en las 1000 combinaciones.
 */

type AP = 'H' | 'M' | 'L';

/** Una fila de la tabla oficial: rangos de S, O y D -> AP. */
interface FilaAP {
    s: [number, number];
    o: [number, number];
    d: [number, number];
    ap: AP;
}

const D_7_10: [number, number] = [7, 10];
const D_5_6: [number, number] = [5, 6];
const D_2_4: [number, number] = [2, 4];
const D_1: [number, number] = [1, 1];
const D_TODAS: [number, number] = [1, 10];

/** Tabla oficial, fila por fila y en el orden del manual (SETEC pag. 116-118). */
export const TABLA_AP_OFICIAL: readonly FilaAP[] = [
    // ── S 9-10: efecto muy alto en el producto o la planta (pag. 116, lamina 232) ──
    { s: [9, 10], o: [8, 10], d: D_7_10, ap: 'H' },
    { s: [9, 10], o: [8, 10], d: D_5_6, ap: 'H' },
    { s: [9, 10], o: [8, 10], d: D_2_4, ap: 'H' },
    { s: [9, 10], o: [8, 10], d: D_1, ap: 'H' },
    { s: [9, 10], o: [6, 7], d: D_7_10, ap: 'H' },
    { s: [9, 10], o: [6, 7], d: D_5_6, ap: 'H' },
    { s: [9, 10], o: [6, 7], d: D_2_4, ap: 'H' },
    { s: [9, 10], o: [6, 7], d: D_1, ap: 'H' },
    { s: [9, 10], o: [4, 5], d: D_7_10, ap: 'H' },
    { s: [9, 10], o: [4, 5], d: D_5_6, ap: 'H' },
    { s: [9, 10], o: [4, 5], d: D_2_4, ap: 'H' },
    { s: [9, 10], o: [4, 5], d: D_1, ap: 'M' },
    { s: [9, 10], o: [2, 3], d: D_7_10, ap: 'H' },
    { s: [9, 10], o: [2, 3], d: D_5_6, ap: 'M' },
    { s: [9, 10], o: [2, 3], d: D_2_4, ap: 'L' },
    { s: [9, 10], o: [2, 3], d: D_1, ap: 'L' },
    { s: [9, 10], o: [1, 1], d: D_TODAS, ap: 'L' },

    // ── S 7-8: efecto alto en el producto o la planta (pag. 117, lamina 233) ──
    { s: [7, 8], o: [8, 10], d: D_7_10, ap: 'H' },
    { s: [7, 8], o: [8, 10], d: D_5_6, ap: 'H' },
    { s: [7, 8], o: [8, 10], d: D_2_4, ap: 'H' },
    { s: [7, 8], o: [8, 10], d: D_1, ap: 'H' },
    { s: [7, 8], o: [6, 7], d: D_7_10, ap: 'H' },
    { s: [7, 8], o: [6, 7], d: D_5_6, ap: 'H' },
    { s: [7, 8], o: [6, 7], d: D_2_4, ap: 'H' },
    { s: [7, 8], o: [6, 7], d: D_1, ap: 'M' },
    { s: [7, 8], o: [4, 5], d: D_7_10, ap: 'H' },
    { s: [7, 8], o: [4, 5], d: D_5_6, ap: 'M' },
    { s: [7, 8], o: [4, 5], d: D_2_4, ap: 'M' },
    { s: [7, 8], o: [4, 5], d: D_1, ap: 'M' },
    { s: [7, 8], o: [2, 3], d: D_7_10, ap: 'M' },
    { s: [7, 8], o: [2, 3], d: D_5_6, ap: 'M' },
    { s: [7, 8], o: [2, 3], d: D_2_4, ap: 'L' },
    { s: [7, 8], o: [2, 3], d: D_1, ap: 'L' },
    { s: [7, 8], o: [1, 1], d: D_TODAS, ap: 'L' },

    // ── S 4-6: efecto moderado en el producto o la planta (pag. 117, lamina 234) ──
    { s: [4, 6], o: [8, 10], d: D_7_10, ap: 'H' },
    { s: [4, 6], o: [8, 10], d: D_5_6, ap: 'H' },
    { s: [4, 6], o: [8, 10], d: D_2_4, ap: 'M' },
    { s: [4, 6], o: [8, 10], d: D_1, ap: 'M' },
    { s: [4, 6], o: [6, 7], d: D_7_10, ap: 'M' },
    { s: [4, 6], o: [6, 7], d: D_5_6, ap: 'M' },
    { s: [4, 6], o: [6, 7], d: D_2_4, ap: 'M' },
    { s: [4, 6], o: [6, 7], d: D_1, ap: 'L' },
    { s: [4, 6], o: [4, 5], d: D_7_10, ap: 'M' },
    { s: [4, 6], o: [4, 5], d: D_5_6, ap: 'L' },
    { s: [4, 6], o: [4, 5], d: D_2_4, ap: 'L' },
    { s: [4, 6], o: [4, 5], d: D_1, ap: 'L' },
    { s: [4, 6], o: [2, 3], d: D_TODAS, ap: 'L' },
    { s: [4, 6], o: [1, 1], d: D_TODAS, ap: 'L' },

    // ── S 2-3: efecto bajo en el producto o la planta (pag. 118, lamina 235) ──
    { s: [2, 3], o: [8, 10], d: D_7_10, ap: 'M' },
    { s: [2, 3], o: [8, 10], d: D_5_6, ap: 'M' },
    { s: [2, 3], o: [8, 10], d: D_2_4, ap: 'L' },
    { s: [2, 3], o: [8, 10], d: D_1, ap: 'L' },
    { s: [2, 3], o: [1, 7], d: D_TODAS, ap: 'L' },

    // ── S 1: sin efecto (pag. 118, lamina 235) ──
    { s: [1, 1], o: [1, 10], d: D_TODAS, ap: 'L' },
];

const enRango = (v: number, [min, max]: [number, number]) => v >= min && v <= max;

function buscarFila(s: number, o: number, d: number): FilaAP | undefined {
    return TABLA_AP_OFICIAL.find(f => enRango(s, f.s) && enRango(o, f.o) && enRango(d, f.d));
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
 * Calcula el Action Priority segun la tabla oficial del AIAG-VDA (SETEC pag. 116-118).
 * Devuelve '' solo cuando los valores estan fuera de rango (1 a 10) o no son numeros.
 */
export function calculateAP(s: number, o: number, d: number): 'H' | 'M' | 'L' | '' {
    const v = normalizar(s, o, d);
    if (!v) return '';
    return buscarFila(...v)?.ap ?? '';
}
