/**
 * `_sacarPlaceholderProhibido.mjs` vacia una celda solo si su texto ENTERO es el placeholder
 * prohibido el 21/09/2026 (amfe.md §4). Si la frase esta adentro de un texto mas largo, no la
 * toca: la reporta para que la mire una persona.
 */
import { describe, it, expect } from 'vitest';
import { esPlaceholder, vaciarPlaceholder } from '../../scripts/_sacarPlaceholderProhibido.mjs';

describe('esPlaceholder', () => {
    it.each([
        'Pendiente definicion equipo APQP',
        'Pendiente definición equipo APQP',
        '  pendiente definicion equipo apqp.  ',
        'TBD — Pendiente definicion con equipo APQP',
        'TBD - Pendiente definición con el equipo APQP',
    ])('ROJO: "%s" es el placeholder', (v) => {
        expect(esPlaceholder(v)).toBe(true);
    });

    it.each([
        '',
        'TBD',
        'Calibre digital, 3% del lote (P-10/I)',
        'Revisar con Carlos. Pendiente definicion equipo APQP hasta el PPAP',
        null,
        42,
    ])('VERDE: %s no se vacia', (v) => {
        expect(esPlaceholder(v)).toBe(false);
    });
});

describe('vaciarPlaceholder', () => {
    it('vacia las celdas que son solo el placeholder y reporta las que lo llevan adentro', () => {
        const doc = {
            operations: [{
                workElements: [{
                    name: 'Maquina de coser',
                    functions: [{
                        failures: [{
                            preventionControl: 'Pendiente definicion equipo APQP',
                            causes: [
                                { optimizationAction: 'Pendiente definición equipo APQP', ap: 'H', severity: 8 },
                                { optimizationAction: 'Calibrar la maquina cada turno', ap: 'H' },
                                { observations: 'Ver con Calidad; Pendiente definicion equipo APQP' },
                            ],
                        }],
                    }],
                }],
            }],
        };
        const r = vaciarPlaceholder(doc);
        const falla = doc.operations[0].workElements[0].functions[0].failures[0];
        expect(r.vaciadas).toHaveLength(2);
        expect(falla.preventionControl).toBe('');
        expect(falla.causes[0].optimizationAction).toBe('');
        expect(falla.causes[0].ap).toBe('H');
        expect(falla.causes[0].severity).toBe(8);
        expect(falla.causes[1].optimizationAction).toBe('Calibrar la maquina cada turno');
        expect(r.adentroDeTexto).toHaveLength(1);
        expect(falla.causes[2].observations).toBe('Ver con Calidad; Pendiente definicion equipo APQP');
    });

    it('en un control concatenado con " + " saca solo el pedazo del placeholder (caso real, maestro PU y 3 apoyacabezas)', () => {
        const falla = { preventionControl: 'Pendiente definicion equipo APQP + Sensores cilindros mixhead con barreras Zener CSB519-EX22 + Sensores cilindros mixhead con barreras Zener CSB536-EX' };
        const r = vaciarPlaceholder(falla);
        expect(falla.preventionControl).toBe('Sensores cilindros mixhead con barreras Zener CSB519-EX22 + Sensores cilindros mixhead con barreras Zener CSB536-EX');
        expect(r.vaciadas).toEqual([{ ruta: 'preventionControl', recortada: true }]);
        expect(r.adentroDeTexto).toHaveLength(0);
    });
});
