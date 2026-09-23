/**
 * Tests del check CONTROL_CON_VALOR (rules/amfe.md §11, decidido el 2026-08-16).
 *
 * La regla: en `preventionControl` / `detectionControl` va METODO + INSTRUMENTO +
 * FRECUENCIA + de que documento sale el criterio. El VALOR no va — vive en la columna
 * "Especificacion tolerancia" del Plan de Control, que es el formulario que la tiene
 * (el de AMFE no) y el unico de los dos que Barack distribuye.
 *
 * Lo que este test protege es el BORDE, que es donde el check se puede volver inutil:
 *  - si marca la frecuencia de muestreo ("3% del lote"), da falsos positivos en masa
 *    y se termina ignorando;
 *  - si marca los codigos de norma o procedimiento (MI-IG-08-04, VW 50106, P-10/I),
 *    empuja a sacar del control justo la trazabilidad que SI tiene que estar;
 *  - si no marca una cota, no sirve para nada.
 *
 * Origen: el 16/08/2026 los 3 AMFE de apoyacabezas se cargaron con las cotas adentro
 * del control detectivo — los unicos 27 casos de los 17 AMFE, contra el 98,4% que no
 * lleva numero. Se corrigieron y quedo este gate para que no vuelva a pasar.
 */
import { describe, it, expect } from 'vitest';
import { validateAmfeDoc } from '../../scripts/_lib/amfeValidator.mjs';

/** AMFE minimo valido con un solo control, para aislar el check. */
function docConControl(preventionControl, detectionControl) {
    return {
        operations: [{
            opNumber: '10',
            operationNumber: '10',
            name: 'RECEPCION DE MATERIA PRIMA',
            operationName: 'RECEPCION DE MATERIA PRIMA',
            workElements: [{
                name: 'Vinilo PVC Titan Black (codigo 427VIN014COR01)',
                type: 'Material',
                functions: [{
                    description: 'Aportar el vinilo especificado',
                    functionDescription: 'Aportar el vinilo especificado',
                    failures: [{
                        description: 'Espesor del vinilo fuera de tolerancia',
                        effectLocal: 'Lote segregado en recepcion',
                        effectNextLevel: 'Variacion en el tapizado',
                        effectEndUser: 'Arrugas visibles en la pieza',
                        causes: [{
                            cause: 'Variacion del laminado en el proveedor',
                            description: 'Variacion del laminado en el proveedor',
                            severity: 5, occurrence: 3, detection: 5,
                            ap: 'L', actionPriority: 'L',
                            preventionControl, detectionControl,
                        }],
                    }],
                }],
            }],
        }],
    };
}

const marca = (prev, det) => validateAmfeDoc(docConControl(prev, det), 'TEST')
    .all.some(i => i.type === 'CONTROL_CON_VALOR');

const P14 = 'Verificacion segun P-14';

describe('CONTROL_CON_VALOR — marca la especificacion metida en el control', () => {
    it('cota con unidad', () => {
        expect(marca(P14, 'Calibre digital, 3% del lote (P-10/I). Cotas: diametro 90 mm')).toBe(true);
    });

    it('tolerancia con +/-', () => {
        expect(marca(P14, 'Certificado del fabricante. 1,2 +/- 0,05 gr/cm3')).toBe(true);
    });

    it('tolerancia con simbolo ±', () => {
        expect(marca(P14, 'Calibre. Diametro 7 mm ± 0,1 mm')).toBe(true);
    });

    it('gramaje', () => {
        expect(marca(P14, 'Balanza. Minimo 800 - maximo 1000 GMS/MT2')).toBe(true);
    });

    it('velocidad de quemado', () => {
        expect(marca(P14, 'Certificado. Menor a 100 mm/min segun el plan 1063')).toBe(true);
    });

    it('tambien en el control preventivo, no solo en el detectivo', () => {
        expect(marca('Configuracion de la maquina. Largo puntada 4mm', 'Inspeccion visual')).toBe(true);
    });
});

describe('CONTROL_CON_VALOR — NO marca lo que si debe estar en el control', () => {
    it('frecuencia de muestreo por porcentaje', () => {
        expect(marca(P14, 'Calibre digital, 3% del lote por entrega (P-10/I, plan de recepcion 1064)')).toBe(false);
    });

    it('frecuencia de muestreo por unidades', () => {
        expect(marca(P14, 'Visual con patron de color, 1 muestra por lote (P-10/I, plan 1043)')).toBe(false);
    });

    it('codigo de procedimiento interno con guiones y numeros', () => {
        expect(marca('Certificado del proveedor por lote (P-14)',
            'Certificado del fabricante segun MI-IG-08-04, 1 muestra por lote (P-10/I y ARB, plan 818)')).toBe(false);
    });

    it('norma del cliente', () => {
        expect(marca('Certificado del proveedor por lote (P-14)',
            'Certificado del proveedor conforme Norma VW 50106, anual (P-10/I y ARB, plan 1043)')).toBe(false);
    });

    it('norma ASTM', () => {
        expect(marca(P14, 'Certificado del fabricante segun ASTM D5155, 1 muestra por lote (P-10/I y ARB)')).toBe(false);
    });

    it('control cualitativo puro, que es la forma dominante en los 17 AMFE', () => {
        expect(marca(P14, 'Inspeccion visual 100% + pieza patron')).toBe(false);
    });

    it('control vacio no explota', () => {
        expect(marca('', '')).toBe(false);
    });
});

describe('CONTROL_CON_VALOR — severidad', () => {
    it('es WARNING, no CRITICAL: no puede bloquear un --apply por deuda preexistente', () => {
        const r = validateAmfeDoc(docConControl(P14, 'Calibre. Cota 130 mm'), 'TEST');
        expect(r.warning.some(i => i.type === 'CONTROL_CON_VALOR')).toBe(true);
        expect(r.critical.some(i => i.type === 'CONTROL_CON_VALOR')).toBe(false);
    });

    it('el detalle dice que campo fue y que valor encontro', () => {
        const issue = validateAmfeDoc(docConControl(P14, 'Calibre. Cota 130 mm'), 'TEST')
            .all.find(i => i.type === 'CONTROL_CON_VALOR');
        expect(issue.detail).toContain('detectionControl');
        expect(issue.detail).toContain('130 mm');
    });
});

// CONTROL_CON_CITA — Fak, 23/09/2026, sobre el AMFE 173 que iba al cliente: "hay demasiadas
// aclaraciones... (OP 21; HO mesa de corte, hoja 28) esa esta al pedo, molestan".
const cita = (prev, det) => validateAmfeDoc(docConControl(prev, det), 'TEST')
    .all.filter(i => i.type === 'CONTROL_CON_CITA');

describe('CONTROL_CON_CITA — marca la fuente citada entre parentesis', () => {
    it('el caso real del 173: (OP 21; HO mesa de corte, hoja 28)', () => {
        expect(cita(P14, 'Control de forma contra la plantilla mylar (OP 21; HO mesa de corte, hoja 28)')).toHaveLength(1);
    });
    it('hoja de operaciones, set up y manual', () => {
        expect(cita('Guia en el pie de la maquina (HO 927 REV6, hoja 50)', 'Visual')).toHaveLength(1);
        expect(cita('Programa verificado (SET UP Mesa de corte Rev.G, item 1 J)', 'Visual')).toHaveLength(1);
        expect(cita('Presion de vacio (manual YIN, p.44)', 'Visual')).toHaveLength(1);
    });
    it('NO marca el parentesis que es parte de lo controlado', () => {
        expect(cita('Corte al borde (+2 / -0)', 'Etiqueta de la mano (RH / LH)')).toHaveLength(0);
        expect(cita('Hilo especificado (BX138 / 12124E)', 'Visual')).toHaveLength(0);
    });
    it('NO marca el instructivo que ES el control, sin parentesis', () => {
        expect(cita('Instructivo IO-19 con las zonas a cubrir, en el puesto', 'Visual')).toHaveLength(0);
    });
    it('es WARNING: no frena un --apply por deuda de otros AMFE', () => {
        const r = validateAmfeDoc(docConControl('Guia (HO 927 REV6, hoja 50)', 'Visual'), 'TEST');
        expect(r.warning.some(i => i.type === 'CONTROL_CON_CITA')).toBe(true);
        expect(r.critical.some(i => i.type === 'CONTROL_CON_CITA')).toBe(false);
    });
});
