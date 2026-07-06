import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx-js-style';
import { buildCaratulaSheet, normalizeRevisions } from '../../../modules/amfe/amfeCaratulaSheet';
import type { AmfeDocument } from '../../../modules/amfe/amfeTypes';

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

    it('incluye las firmas de aprobacion con responsable y aprobador', () => {
        const ws = buildCaratulaSheet(makeDoc(), { revisions: revs, status: 'approved' });
        const joined = cells(ws).map(c => c.v).join(' | ');
        expect(joined).toContain('FIRMAS DE APROBACION');
        expect(joined).toContain('Carlos Baptista'); // INGENIERIA = responsible
        expect(joined).toContain('Gonzalo Cal');       // CALIDAD = approvedBy
    });
});
