/**
 * La revision de un AMFE va en LETRA y cada fila del log dice QUE cambio y DONDE.
 * Origen: 21/09/2026, el historial del AMFE 131 venia numerado REV 1 a 7 contra el I-AC-008
 * rev.B §5.2 ("Nivel de Revision: digito alfabetico"), y una de sus filas decia solo
 * "Revision general del documento". Fak: *"no dice que item cambia, no dice ni que cambia"*.
 * Regla: .claude/rules/amfe.md §4bis.
 */
import { describe, it, expect } from 'vitest';
import { validateRevisiones } from '../../scripts/_lib/amfeValidator.mjs';

const tipos = (out) => out.map((i) => i.type);

describe('validateRevisiones — letra, no numero (I-AC-008 §5.2)', () => {
    it('marca CRITICAL el nivel de revision numerico del encabezado', () => {
        const out = validateRevisiones({ header: { revision: '7' } }, [], '131');
        expect(tipos(out)).toContain('HEADER_REVISION_NUMERICA');
        expect(out[0].severity).toBe('CRITICAL');
    });

    it('marca CRITICAL una fila del log numerada', () => {
        const out = validateRevisiones({ header: { revision: 'D' } },
            [{ rev: '6', date: '2024-10-09', item: '30', description: 'Se incorpora el reclamo N 1085861.' }], '131');
        expect(tipos(out)).toEqual(['HEADER_REVISION_NUMERICA']);
    });

    it('acepta la letra y no se queja de una fila completa', () => {
        const out = validateRevisiones({ header: { revision: 'D' } },
            [{ rev: 'D', date: '2026-09-21', item: '60', description: 'Se incorpora el modo de falla de recorte de vinilo.' }], '131');
        expect(out).toEqual([]);
    });

    it('acepta "Rev. B" y variantes con prefijo', () => {
        const out = validateRevisiones({ header: { revisionLevel: 'Rev. B' } }, [], '131');
        expect(out).toEqual([]);
    });
});

describe('validateRevisiones — cada fila dice QUE cambio y DONDE', () => {
    it('marca la fila vaga que motivo la regla', () => {
        const out = validateRevisiones({ header: { revision: 'B' } },
            [{ rev: 'B', date: '2024-06-25', item: '', description: 'Revision general del documento' }], '131');
        expect(tipos(out)).toContain('REVISION_VAGA');
        expect(tipos(out)).toContain('REVISION_SIN_ITEM');
    });

    it('marca las otras formas de no decir nada', () => {
        for (const texto of ['Actualizacion del documento', 'Se revisa todo', 'Revisión completa del AMFE']) {
            const out = validateRevisiones({}, [{ rev: 'B', date: '2024-01-01', item: '30', description: texto }], '131');
            expect(tipos(out), texto).toContain('REVISION_VAGA');
        }
    });

    it('la emision inicial puede no traer item', () => {
        const out = validateRevisiones({ header: { revision: 'A' } },
            [{ rev: 'A', date: '2024-05-13', item: '', description: 'EMISION INICIAL.' }], '131');
        expect(out).toEqual([]);
    });

    it('no explota con revisiones vacias o mal formadas', () => {
        expect(validateRevisiones({}, null, '131')).toEqual([]);
        expect(validateRevisiones(null, [{}], '131').map((i) => i.type)).toEqual(['REVISION_SIN_ITEM']);
    });
});
