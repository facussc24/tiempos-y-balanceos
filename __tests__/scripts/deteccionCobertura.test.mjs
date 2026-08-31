/**
 * Tests de los checks de COBERTURA de la deteccion (rules/amfe.md §13).
 *
 * La regla, en orden: la D se califica PRIMERO por cuanto producto pasa por el control y
 * recien despues por con que se hace. Tabla P3 del AIAG-VDA, renglon 9, textual:
 * "Failure is not easily detected. Random audits <100% of product." Y renglon 10: sin
 * metodo establecido, D=10.
 *
 * Origen (31/08/2026): un script llevo a D=7 todo control humano sin instrumento, y trato
 * igual una inspeccion al 100% que un muestreo. Puso 100 causas de muestreo en 7 — mejor de
 * lo que la tabla admite. La auditoria de cliente encontro 298 asi en el lote de Patagonia,
 * mas 36 con el control vacio calificadas D=8.
 *
 * Lo que estos tests protegen es el BORDE, que es donde el check se vuelve inutil:
 *  - si un "100%" explicito lo marca como muestreo, da falsos positivos en masa;
 *  - si el muestreo sigue entrando por el check de deteccion humana, un script lo vuelve
 *    a mandar a 7 y el bug del 31/08 se repite;
 *  - si no marca un muestreo con D baja, no sirve para nada.
 */
import { describe, it, expect } from 'vitest';
import {
    esMuestreoParcial,
    esDeteccionMuestreoOptimista,
    esDeteccionSinControlDeclarado,
    esDeteccionHumanaOptimista,
    validateAmfeDoc,
} from '../../scripts/_lib/amfeValidator.mjs';

/** AMFE minimo valido con un solo control de deteccion, para aislar los checks. */
function docConDeteccion(detectionControl, detection) {
    return {
        operations: [{
            opNumber: '10', operationNumber: '10',
            name: 'RECEPCION DE MATERIA PRIMA', operationName: 'RECEPCION DE MATERIA PRIMA',
            focusElementFunction: 'Funcion Interna: a / Funcion del Cliente: b / Funcion del Usuario Final: c',
            operationFunction: 'Recibir y controlar el material',
            workElements: [{
                name: 'Vinilo PVC (427VIN014COR01)', type: 'Material',
                functions: [{
                    description: 'Aportar el vinilo conforme', functionDescription: 'Aportar el vinilo conforme',
                    failures: [{
                        description: 'Flamabilidad fuera de TL 1010 VW', severity: 6,
                        effectLocal: 'Scrap', effectNextLevel: 'Para linea', effectEndUser: 'Riesgo en cabina',
                        causes: [{
                            cause: 'Lote fuera de norma', description: 'Lote fuera de norma',
                            preventionControl: 'Certificado del proveedor (P-14)',
                            detectionControl, occurrence: 4, detection,
                            ap: 'H', actionPriority: 'H',
                            optimizationAction: 'Pendiente definicion equipo APQP',
                        }],
                    }],
                }],
            }],
        }],
    };
}

const tipos = (doc) => {
    const r = validateAmfeDoc(doc, 'X', 'T');
    return [...r.critical, ...r.warning].map(i => i.type);
};

describe('esMuestreoParcial — la cobertura se lee del texto del control', () => {
    // Textos reales de los AMFE de Patagonia, no inventados para el test.
    it.each([
        'Inspeccion por muestreo segun P-14 en recepcion',
        'Ensayo de flamabilidad por muestreo segun plan de calidad',
        'Verificacion visual de la etiqueta del material, 1 muestra por entrega (P-10/I)',
        'Regla + conteo puntadas 5 pz/turno',
        'Auditoria periodica de trazabilidad por Calidad',
        'Inspeccion visual contra patron de aspecto conforme VW 50180, por lote de entrega (P-10/I)',
    ])('es muestreo: %s', (texto) => {
        expect(esMuestreoParcial(texto)).toBe(true);
    });

    it.each([
        'Inspeccion visual 100% + pieza patron',
        'Inspeccion visual 100%',
        'Lector codigo barras 100%',
    ])('NO es muestreo si cubre el 100%: %s', (texto) => {
        expect(esMuestreoParcial(texto)).toBe(false);
    });

    it('el 100% explicito gana sobre un control por lote aguas abajo', () => {
        // Tiene autocontrol al 100% EN la estacion; el control por lote de Calidad no lo
        // convierte en muestreo parcial.
        expect(esMuestreoParcial('Autocontrol visual 100% + control por Calidad por lote')).toBe(false);
    });

    it('un control vacio no es muestreo (tiene su propio check)', () => {
        expect(esMuestreoParcial('')).toBe(false);
        expect(esMuestreoParcial(null)).toBe(false);
    });
});

describe('DETECCION_MUESTREO_OPTIMISTA', () => {
    it('marca un muestreo calificado por debajo de 9', () => {
        expect(esDeteccionMuestreoOptimista('Inspeccion por muestreo segun P-14', 4)).toBe(true);
        expect(tipos(docConDeteccion('Inspeccion por muestreo segun P-14', 4)))
            .toContain('DETECCION_MUESTREO_OPTIMISTA');
    });

    it('no molesta si ya esta en 9 o mas', () => {
        expect(esDeteccionMuestreoOptimista('Inspeccion por muestreo segun P-14', 9)).toBe(false);
        expect(tipos(docConDeteccion('Inspeccion por muestreo segun P-14', 9)))
            .not.toContain('DETECCION_MUESTREO_OPTIMISTA');
    });

    it('no molesta a un control al 100%', () => {
        expect(tipos(docConDeteccion('Inspeccion visual 100% + pieza patron', 4)))
            .not.toContain('DETECCION_MUESTREO_OPTIMISTA');
    });
});

describe('el muestreo NO entra por el check de deteccion humana — el bug del 31/08', () => {
    it('un muestreo visual con D=4 no se empuja a 7', () => {
        // Si esto vuelve a dar true, un script lo recalifica a 7 y queda MEJOR de lo que
        // la tabla admite, que es exactamente lo que paso el 31/08/2026.
        expect(esDeteccionHumanaOptimista('Verificacion visual de la etiqueta, 1 muestra por entrega', 4)).toBe(false);
    });

    it('pero una inspeccion visual al 100% SI es deteccion humana optimista', () => {
        expect(esDeteccionHumanaOptimista('Inspeccion visual 100% + pieza patron', 4)).toBe(true);
    });
});

describe('DETECCION_SIN_CONTROL_DECLARADO', () => {
    it.each([['', 8], ['-', 8], ['   ', 5], ['TBD', 8]])(
        'marca %s con D=%i porque no hay metodo declarado', (texto, d) => {
            expect(esDeteccionSinControlDeclarado(texto, d)).toBe(true);
        });

    it('no molesta si ya esta declarado como no detectable (D=10)', () => {
        expect(esDeteccionSinControlDeclarado('', 10)).toBe(false);
        expect(tipos(docConDeteccion('', 10))).not.toContain('DETECCION_SIN_CONTROL_DECLARADO');
    });

    it('no molesta a un control que si existe', () => {
        expect(esDeteccionSinControlDeclarado('Inspeccion visual 100%', 7)).toBe(false);
    });
});
