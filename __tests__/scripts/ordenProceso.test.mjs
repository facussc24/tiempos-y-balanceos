/**
 * Tests de scripts/_lib/ordenProceso.mjs — el guard contra el swap silencioso.
 *
 * El fixture central NO esta inventado: es el plan real de
 * `scripts/_alinearAmfesPatagonia.mjs` (PLAN_TRASEROS, lineas 79-80) que el 18/08/2026
 * a las 16:47 mapeo `INSERCION DE VARILLA 50 -> 41` y `ENFUNDADO 60 -> 40`, invirtiendo
 * el par que se habia fijado a las 12:40 con lo que Fak dijo del puesto.
 */
import { describe, it, expect } from 'vitest';
import { ordenInvertido, secuenciaDeCadena, CADENAS_DE_PROCESO } from '../../scripts/_lib/ordenProceso.mjs';

const op = (n, nombre) => ({ opNumber: String(n), operationNumber: String(n), name: nombre, operationName: nombre });

/** Traseros como quedaron a las 12:40 del 18/08 (varilla 50, funda 60, PU 70). */
const TRASEROS_1240 = [
    op(10, 'RECEPCION DE MATERIA PRIMA'),
    op(50, 'INSERCION DE VARILLA'),
    op(60, 'ENFUNDADO'),
    op(70, 'INYECCION DE PU'),
    op(80, 'CONTROL FINAL DE CALIDAD'),
];

/** Los mismos, despues del alineador de las 16:47 (funda 40, varilla 41, PU 52). */
const TRASEROS_1647 = [
    op(10, 'RECEPCION DE MATERIA PRIMA'),
    op(40, 'ENFUNDADO'),
    op(41, 'INSERCION DE VARILLA'),
    op(52, 'INYECCION DE PU'),
    op(60, 'CONTROL FINAL DE CALIDAD'),
];

describe('ordenProceso — el caso real del 18/08/2026', () => {
    it('caza la inversion varilla/funda que hizo la renumeracion de las 16:47', () => {
        const h = ordenInvertido(TRASEROS_1240, TRASEROS_1647, 'AMFE 153');
        expect(h).toHaveLength(1);
        expect(h[0].cadena).toBe('APOYACABEZAS_PU');
        expect(h[0].antes).toEqual(['VARILLA', 'ENFUNDADO', 'PU']);
        expect(h[0].despues).toEqual(['ENFUNDADO', 'VARILLA', 'PU']);
        expect(h[0].detalle).toContain('AMFE 153');
    });

    it('una renumeracion que NO toca el orden relativo pasa limpia', () => {
        // mismo orden, todos los numeros corridos: es lo que hace una renumeracion legitima
        const corridos = TRASEROS_1240.map((o) => op(Number(o.opNumber) - 5, o.name));
        expect(ordenInvertido(TRASEROS_1240, corridos, 'AMFE 153')).toHaveLength(0);
    });

    it('no opina si el orden ya estaba mal antes y sigue igual despues', () => {
        // A proposito: este modulo compara antes vs despues, no dictamina cual es el correcto.
        expect(ordenInvertido(TRASEROS_1647, TRASEROS_1647, 'AMFE 153')).toHaveLength(0);
    });
});

describe('ordenProceso — pasos ausentes y bordes', () => {
    it('ignora los pasos que el documento no tiene (traseros sin bolsa/molde)', () => {
        const soloDos = [op(40, 'ENFUNDADO'), op(52, 'INYECCION DE PU')];
        expect(secuenciaDeCadena(soloDos, CADENAS_DE_PROCESO[0])).toEqual(['ENFUNDADO', 'PU']);
    });

    it('el delantero, con bolsa y cierre de molde en el medio, no molesta', () => {
        const delantero = [
            op(40, 'ENFUNDADO'), op(41, 'INSERCION DE VARILLA'),
            op(42, 'COLOCACION DE PRECINTO CON PISTOLA ETIQUETADORA'),
            op(50, 'COLOCACION DE BOLSA Y CARGA DEL APOYACABEZAS EN EL MOLDE'),
            op(51, 'CIERRE DEL MOLDE Y COLOCACION DE BOQUILLA'),
            op(52, 'INYECCION DE PU'),
        ];
        expect(ordenInvertido(delantero, delantero, 'AMFE 151')).toHaveLength(0);
    });

    it('con menos de dos pasos presentes no hay orden que comparar', () => {
        const uno = [op(52, 'INYECCION DE PU')];
        expect(ordenInvertido(uno, uno, 'x')).toHaveLength(0);
    });

    it('un numero de operacion no numerico se ignora sin romper', () => {
        const raro = [{ opNumber: '', name: 'ENFUNDADO' }, op(52, 'INYECCION DE PU')];
        expect(() => ordenInvertido(raro, raro, 'x')).not.toThrow();
        expect(secuenciaDeCadena(raro, CADENAS_DE_PROCESO[0])).toEqual(['PU']);
    });

    it('agregar una operacion nueva no se reporta como inversion', () => {
        const antes = [op(40, 'ENFUNDADO'), op(52, 'INYECCION DE PU')];
        const despues = [op(40, 'ENFUNDADO'), op(41, 'INSERCION DE VARILLA'), op(52, 'INYECCION DE PU')];
        expect(ordenInvertido(antes, despues, 'x')).toHaveLength(0);
    });

    it('tambien caza la inversion funda/PU (el error original de los traseros)', () => {
        const bien = [op(40, 'ENFUNDADO'), op(52, 'INYECCION DE PU')];
        const mal = [op(60, 'ENFUNDADO'), op(50, 'INYECCION DE PU')];
        const h = ordenInvertido(bien, mal, 'AMFE 155');
        expect(h).toHaveLength(1);
        expect(h[0].despues).toEqual(['PU', 'ENFUNDADO']);
    });
});
