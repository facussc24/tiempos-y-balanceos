import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx-js-style';
import { buildCaratulaSheet, computeRowHeights, normalizeRevisions } from '../../../modules/amfe/amfeCaratulaSheet';
import { buildAmfeOficialWorkbook, assertAmfeExportable } from '../../../modules/amfe/amfeExcelExport';
import type { AmfeDocument, AmfeOperation } from '../../../modules/amfe/amfeTypes';

/** Operacion minima con una causa; sod = [severity, occurrence, detection]. */
function makeOp(sod: [string | number, string | number, string | number]): AmfeOperation {
    const [severity, occurrence, detection] = sod;
    return {
        id: 'op1', opNumber: '10', name: 'COSTURA', workElements: [{
            id: 'we1', type: 'Machine', name: 'Máquina', functions: [{
                id: 'fn1', description: 'Coser', requirements: '', failures: [{
                    id: 'f1', description: 'Costura floja', effectLocal: 'Retrabajo',
                    effectNextLevel: '', effectEndUser: '', severity,
                    causes: [{
                        id: 'c1', cause: 'Tensión mal regulada', preventionControl: '', detectionControl: '',
                        occurrence, detection, ap: '', characteristicNumber: '', specialChar: '', filterCode: '',
                        preventionAction: '', detectionAction: '', responsible: '', targetDate: '', status: '',
                        actionTaken: '', completionDate: '', severityNew: '', occurrenceNew: '', detectionNew: '',
                        apNew: '', observations: '',
                    }],
                }],
            }],
        }],
    } as AmfeOperation;
}

// Documento minimo con header rico (aliases incluidos) para la caratula.
function makeDoc(headerOverrides: Record<string, unknown> = {}): AmfeDocument {
    return {
        header: {
            organization: 'BARACK MERCOSUL', location: 'PLANTA HURLINGHAM', client: 'PWA',
            modelYear: '2026', subject: 'Telas Planas', startDate: '23/06/2015', revDate: '01/06/2026',
            team: '', amfeNumber: '159', responsible: 'Carlos Baptista', confidentiality: 'Confidencial',
            partNumber: '21-6756', processResponsible: 'Carlos Baptista', revision: 'G',
            approvedBy: 'Gonzalo Cal', scope: 'Proceso completo', applicableParts: '',
            ...headerOverrides,
        } as AmfeDocument['header'],
        operations: [],
    };
}

/** Todas las celdas de una hoja como { addr: { v, s } }. */
function cells(ws: XLSX.WorkSheet): Array<{ v: string; s: Record<string, unknown> }> {
    const out: Array<{ v: string; s: Record<string, unknown> }> = [];
    const range = XLSX.utils.decode_range(ws['!ref'] as string);
    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            if (cell && String(cell.v).trim() !== '') out.push({ v: String(cell.v), s: (cell.s ?? {}) as Record<string, unknown> });
        }
    }
    return out;
}

describe('normalizeRevisions', () => {
    it('acepta el shape de scripts/registry {rev,date,description,modifiedBy}', () => {
        const out = normalizeRevisions([{ rev: 'A', date: '2020-01-01', description: 'Emision', modifiedBy: 'FS' }]);
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ rev: 'A', date: '2020-01-01', details: 'Emision', modifiedBy: 'FS' });
    });

    it('acepta el shape legacy {date,reason,revisedBy,description}', () => {
        const out = normalizeRevisions([{ date: '2020-01-01', reason: 'x', revisedBy: 'CB', description: 'Cambio de plano' }]);
        expect(out[0].details).toBe('Cambio de plano');
        expect(out[0].modifiedBy).toBe('CB');
    });

    it('acepta un JSON string y devuelve [] ante entrada invalida', () => {
        expect(normalizeRevisions('[{"rev":"B","date":"x","description":"y"}]')).toHaveLength(1);
        expect(normalizeRevisions('no-json')).toEqual([]);
        expect(normalizeRevisions(null)).toEqual([]);
        expect(normalizeRevisions(undefined)).toEqual([]);
        expect(normalizeRevisions(42)).toEqual([]);
    });
});

describe('buildCaratulaSheet', () => {
    const revs = normalizeRevisions([
        { rev: 'A', date: '2015-06-23', description: 'Emision inicial' },
        { rev: 'G', date: '2026-06-01', description: 'Alineada al PC rev G' },
    ]);

    it('titula PRELIMINAR cuando el estado no es approved', () => {
        const ws = buildCaratulaSheet(makeDoc(), { revisions: revs, status: 'draft' });
        const title = cells(ws).find(c => c.v.startsWith('A.M.F.E.'));
        expect(title?.v).toBe('A.M.F.E. DE PROCESO PRELIMINAR');
    });

    it('titula sin PRELIMINAR cuando el estado es approved', () => {
        const ws = buildCaratulaSheet(makeDoc(), { revisions: revs, status: 'approved' });
        const title = cells(ws).find(c => c.v.startsWith('A.M.F.E.'));
        expect(title?.v).toBe('A.M.F.E. DE PROCESO');
    });

    it('muestra el nivel de revision vigente en ROJO (FF0000)', () => {
        const ws = buildCaratulaSheet(makeDoc({ revision: 'G' }), { revisions: revs, status: 'draft' });
        // El valor "G" del bloque de identificacion va en rojo bold.
        const redG = cells(ws).find(c => c.v === 'G'
            && ((c.s.font as { color?: { rgb?: string } })?.color?.rgb === 'FF0000'));
        expect(redG).toBeTruthy();
    });

    it('incluye la banda REVISIONES con encabezados y >=15 filas de tabla', () => {
        const ws = buildCaratulaSheet(makeDoc(), { revisions: revs, status: 'draft' });
        const all = cells(ws).map(c => c.v);
        expect(all).toContain('REVISIONES');
        expect(all).toContain('ITEM CAMBIADO');
        expect(all).toContain('FECHA PSW');
        // Debe rellenar a un minimo de filas de formulario: la banda REVISIONES esta
        // bastante despues del bloque de identificacion aunque haya solo 2 revisiones.
        const range = XLSX.utils.decode_range(ws['!ref'] as string);
        expect(range.e.r).toBeGreaterThan(20);
    });

    it('lee el equipo desde coreTeam (array) o team (string)', () => {
        const wsArr = buildCaratulaSheet(
            makeDoc({ coreTeam: ['Carlos Baptista (Ingenieria)', 'Manuel Meszaros (Calidad)'] }),
            { revisions: revs, status: 'draft' });
        expect(cells(wsArr).map(c => c.v)).toContain('Carlos Baptista (Ingenieria)');

        const wsStr = buildCaratulaSheet(
            makeDoc({ team: 'Ana Perez (Ingenieria), Luis Gomez (Calidad)' }),
            { revisions: revs, status: 'draft' });
        const vals = cells(wsStr).map(c => c.v);
        expect(vals).toContain('Ana Perez (Ingenieria)');
        expect(vals).toContain('Luis Gomez (Calidad)');
    });

    it('deja los casilleros de firma SIN nombre impreso (se firman a mano)', () => {
        // El formulario I-AC-005.3 real deja INGENIERIA / CALIDAD / CLIENTE en
        // blanco. Imprimir approvedBy en el casillero de CALIDAD hacia figurar a
        // Gonzalo Cal (que firma HO/Planta) como firmante de calidad.
        const ws = buildCaratulaSheet(makeDoc(), { revisions: revs, status: 'approved' });
        const vals = cells(ws).map(c => String(c.v));
        expect(vals.join(' | ')).toContain('FIRMAS DE APROBACION');
        // Las etiquetas estan solas, sin "\nNombre" pegado abajo.
        expect(vals).toContain('INGENIERIA');
        expect(vals).toContain('CALIDAD');
        expect(vals).toContain('CLIENTE');
        expect(vals.some(v => v.startsWith('CALIDAD\n'))).toBe(false);
        expect(vals.some(v => v.startsWith('INGENIERIA\n'))).toBe(false);
    });

    it('lee las fechas y el equipo por sus alias historicos (amfeDate/revisionDate/coreTeam)', () => {
        // Caso real del AMFE 150: el dato existe pero bajo el nombre viejo.
        // Antes de 2026-08-03 la caratula salia sin fecha de inicio ni de revision.
        const ws = buildCaratulaSheet(
            makeDoc({
                startDate: undefined, revDate: undefined, revision: undefined, team: undefined,
                amfeDate: '2025-04-07', revisionDate: '2025-09-23', revisionLevel: 'B',
                coreTeam: ['Paulo Centurion (Ingenieria)', 'Manuel Meszaros (Calidad)'],
            }),
            { revisions: revs, status: 'draft' });
        const vals = cells(ws).map(c => String(c.v));
        // Salen en formato AR y con el dia correcto (el ISO es medianoche UTC).
        expect(vals).toContain('07/04/2025');
        expect(vals).toContain('23/09/2025');
        expect(vals).not.toContain('06/04/2025');
        expect(vals).toContain('B');
        expect(vals).toContain('Paulo Centurion (Ingenieria)');
    });
});

describe('assertAmfeExportable', () => {
    it('no lanza cuando todas las causas tienen S/O/D', () => {
        const doc = { ...makeDoc(), operations: [makeOp([6, 4, 3])] };
        expect(() => assertAmfeExportable(doc)).not.toThrow();
    });

    it('lanza si falta la severidad (del failure)', () => {
        const doc = { ...makeDoc(), operations: [makeOp(['', 4, 3])] };
        expect(() => assertAmfeExportable(doc)).toThrow(/incompleto/i);
    });

    it('lanza si falta occurrence o detection (de la causa)', () => {
        expect(() => assertAmfeExportable({ ...makeDoc(), operations: [makeOp([6, '', 3])] })).toThrow(/incompleto/i);
        expect(() => assertAmfeExportable({ ...makeDoc(), operations: [makeOp([6, 4, ''])] })).toThrow(/incompleto/i);
    });
});

describe('buildAmfeOficialWorkbook', () => {
    it('antepone la Caratula: SheetNames = [Caratula, AMFE]', () => {
        const doc = { ...makeDoc(), operations: [makeOp([6, 4, 3])] };
        const wb = buildAmfeOficialWorkbook(doc, { revisions: [], status: 'draft' });
        expect(wb.SheetNames).toEqual(['Caratula', 'AMFE']);
    });

    it('propaga el throw del guard cuando el AMFE esta incompleto', () => {
        const doc = { ...makeDoc(), operations: [makeOp([6, '', 3])] };
        expect(() => buildAmfeOficialWorkbook(doc, { revisions: [], status: 'draft' })).toThrow(/incompleto/i);
    });
});

describe('computeRowHeights', () => {
    const cols = [20, 20, 20];

    it('da alto suficiente a una celda con texto largo', () => {
        const texto = 'x'.repeat(300);
        const [h] = computeRowHeights([[{ v: texto }]], cols, [], { minPt: 20, maxPt: 400 });
        expect(h.hpt).toBeGreaterThan(20);
    });

    it('reparte el alto de un merge VERTICAL entre sus filas, no lo ignora', () => {
        // Regresion 2026-08-03: el merge vertical se salteaba entero del calculo,
        // asi que las dos filas quedaban en el minimo y el texto salia cortado.
        // Pasaba en 262 filas de los 17 AMFE del servidor (columna Efecto de Falla).
        const largo = 'Interno: riesgo de reproceso o scrap. '.repeat(8);
        const rows = [[{ v: largo }, { v: 'a' }], [{ v: '' }, { v: 'b' }]];
        const merges = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }];
        const alturas = computeRowHeights(rows, cols, merges, { minPt: 20, maxPt: 400 });
        expect(alturas).toHaveLength(2);
        // Las DOS filas del merge reciben alto; ninguna queda en el minimo.
        expect(alturas[0].hpt).toBeGreaterThan(20);
        expect(alturas[1].hpt).toBeGreaterThan(20);
        // Y entre las dos alcanzan para todo el texto.
        const sinMerge = computeRowHeights([[{ v: largo }]], cols, [], { minPt: 20, maxPt: 400 })[0].hpt;
        expect(alturas[0].hpt + alturas[1].hpt).toBeGreaterThanOrEqual(sinMerge);
    });

    it('un merge HORIZONTAL suma el ancho de sus columnas (menos alto, no mas)', () => {
        const texto = 'y'.repeat(150);
        const solo = computeRowHeights([[{ v: texto }]], cols, [], { minPt: 15, maxPt: 400 })[0].hpt;
        const ancho = computeRowHeights([[{ v: texto }, { v: '' }, { v: '' }]], cols,
            [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }], { minPt: 15, maxPt: 400 })[0].hpt;
        expect(ancho).toBeLessThan(solo);
    });

    it('respeta el tope y el minimo, y nunca devuelve NaN', () => {
        const alturas = computeRowHeights(
            [[{ v: 'z'.repeat(99999) }], [{ v: '' }], [null], [{ v: undefined }]],
            cols, [], { minPt: 20, maxPt: 200 });
        expect(alturas[0].hpt).toBe(200);
        for (const a of alturas) {
            expect(Number.isFinite(a.hpt)).toBe(true);
            expect(a.hpt).toBeGreaterThanOrEqual(20);
        }
    });

    it('no rompe con merges que apuntan fuera del rango de columnas', () => {
        const alturas = computeRowHeights([[{ v: 'hola' }]], cols,
            [{ s: { r: 0, c: 0 }, e: { r: 0, c: 99 } }], { minPt: 15, maxPt: 200 });
        expect(Number.isFinite(alturas[0].hpt)).toBe(true);
    });
});
