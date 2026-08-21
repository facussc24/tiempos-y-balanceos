/**
 * La fila que se imprime en el AMFE oficial tiene que poder auditarse sola: si alguien
 * agarra la S, la O y la D de un renglon y las busca en la tabla AIAG-VDA, tiene que
 * salirle el AP que figura al lado. Es lo primero que recalcula un auditor.
 *
 * La S que se imprime es la del MODO DE FALLA, no la de la causa: es la severidad del
 * efecto y la comparten todas sus causas. La UI la edita una sola vez, con rowSpan sobre
 * las filas de causa (`AmfeTableBody`, celda `data-field="severity"`), y `AmfeCause` ni
 * siquiera tiene el campo — su comentario lo dice: *"AP (calculated from parent's S +
 * this O + this D)"*.
 *
 * El 21/08/2026 un script recalculo el AP leyendo una `cause.severity` suelta que habia
 * quedado de una importacion, y bajo 9 filas del AMFE 162 de M a L: subdeclaro riesgo en
 * un PDF que estaba por salir al cliente. Este test fija la relacion correcta.
 */
import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx-js-style';
import { buildAmfeOficialWorkbook } from '../modules/amfe/amfeExcelExport';
import { calculateAP } from '../modules/amfe/apTable';
import type { AmfeDocument } from '../modules/amfe/amfeTypes';

// Indices de columna en la hoja AMFE (ver AMFE_COL_HEADERS del export).
const COL = { S: 9, O: 11, D: 13, AP: 14 } as const;

/**
 * AMFE minimo con una causa. `sevFantasma` simula el resto de importacion: una S propia
 * en la causa, distinta de la del modo de falla, que ningun campo de la app escribe.
 */
function doc(sevFalla: number, o: number, d: number, sevFantasma?: number): AmfeDocument {
    return {
        header: {
            amfeNumber: '162', confidentiality: 'Confidencial',
            organization: 'BARACK MERCOSUL', client: 'VWA',
            location: 'PLANTA HURLINGHAM', partNumber: 'N 216',
            responsible: 'Carlos Baptista', processResponsible: 'Carlos Baptista',
            modelYear: 'VW427-1LA_K - PATAGONIA', startDate: '12/02/2026', revDate: '20/08/2026',
            revision: 'A', approvedBy: '', scope: 'TOP ROLL', subject: 'TOP ROLL',
            applicableParts: '',
        },
        operations: [{
            opNumber: '10', operationNumber: '10',
            name: 'INYECCION DE PIEZA PLASTICA', operationName: 'INYECCION DE PIEZA PLASTICA',
            focusElementFunction: 'Funcion Interna: proveer el sustrato / Funcion del Cliente: montar sin interferencia / Funcion del Usuario Final: durabilidad',
            operationFunction: 'Inyectar el sustrato conforme a la hoja de parametros',
            workElements: [{
                name: 'Maquina inyectora de plastico', type: 'Machine',
                functions: [{
                    description: 'Aportar presion y temperatura estables durante el ciclo',
                    functionDescription: 'Aportar presion y temperatura estables durante el ciclo',
                    failures: [{
                        description: 'Llenado incompleto de pieza',
                        severity: sevFalla,
                        effectLocal: 'Scrap de la pieza',
                        effectNextLevel: 'Faltante de componente en la linea',
                        effectEndUser: 'Pieza ausente en el habitaculo',
                        causes: [{
                            description: 'Dosificacion corta', cause: 'Dosificacion corta',
                            preventionControl: 'Hoja de parametros validada',
                            detectionControl: 'Autocontrol con calibre',
                            occurrence: o, detection: d,
                            ap: calculateAP(sevFalla, o, d), actionPriority: calculateAP(sevFalla, o, d),
                            ...(sevFantasma == null ? {} : { severity: sevFantasma }),
                        }],
                    }],
                }],
            }],
        }],
    } as unknown as AmfeDocument;
}

/** Lee las filas de datos de la hoja AMFE como {s,o,d,ap}. */
function filasImpresas(d: AmfeDocument) {
    const ws = buildAmfeOficialWorkbook(d).Sheets['AMFE'];
    const rango = XLSX.utils.decode_range(ws['!ref'] as string);
    const celda = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v;
    // La cantidad de filas de metadata varia, asi que la fila de encabezados se busca.
    let encabezados = -1;
    for (let r = 0; r <= rango.e.r && encabezados < 0; r++) {
        if (String(celda(r, 0) ?? '').trim() === 'Nro. Op.') encabezados = r;
    }
    expect(encabezados, 'no se encontro la fila de encabezados de la hoja AMFE').toBeGreaterThanOrEqual(0);

    const filas: { s: number; o: number; d: number; ap: string }[] = [];
    for (let r = encabezados + 1; r <= rango.e.r; r++) {
        const s = celda(r, COL.S);
        if (s === undefined || s === '') continue;
        filas.push({
            s: Number(s), o: Number(celda(r, COL.O)),
            d: Number(celda(r, COL.D)), ap: String(celda(r, COL.AP) ?? ''),
        });
    }
    return filas;
}

describe('la S que se imprime es la del modo de falla', () => {
    it('el caso real del AMFE 162: fm.severity=7 con una S fantasma de 6 en la causa => imprime 7', () => {
        const filas = filasImpresas(doc(7, 2, 6, 6));
        expect(filas).toHaveLength(1);
        expect(filas[0].s).toBe(7);
    });

    it('y ese renglon da M en la tabla, no L', () => {
        expect(filasImpresas(doc(7, 2, 6, 6))[0].ap).toBe('M');
    });

    it('la S fantasma de la causa no cambia nada de lo impreso', () => {
        const conFantasma = filasImpresas(doc(7, 2, 6, 3))[0];
        const sinFantasma = filasImpresas(doc(7, 2, 6))[0];
        expect(conFantasma).toEqual(sinFantasma);
    });

    it('barrido S x O x D: ninguna fila impresa queda fuera de la tabla AIAG-VDA', () => {
        for (let s = 1; s <= 10; s++) {
            for (let o = 1; o <= 10; o++) {
                for (let d = 1; d <= 10; d++) {
                    const [f] = filasImpresas(doc(s, o, d, s === 1 ? 10 : 1));
                    expect(f.s, `S=${s} O=${o} D=${d}`).toBe(s);
                    expect(calculateAP(f.s, f.o, f.d), `S=${s} O=${o} D=${d}`).toBe(f.ap);
                }
            }
        }
    });
});
