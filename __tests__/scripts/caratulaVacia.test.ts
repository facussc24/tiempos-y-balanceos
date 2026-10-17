/**
 * caratulaVacia — la caratula del AMFE exportado, mirada en el libro RELEIDO (tanda 12, 17/10/2026).
 *
 * ROJO: el error que dio origen a la skill amfe-export-oficial (25/06/2026, AMFE 128/129 Amarok: caratula vacia;
 * Fak: "asi no me podes entregar un AMFE"). VERDE: una caratula completa, armada por el mismo generador que usa el
 * export oficial y releida desde el buffer escrito, como hace `_exportAmfeOficial.ts`.
 */
import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx-js-style';
import { buildAmfeOficialWorkbook } from '../../modules/amfe/amfeExcelExport';
import type { AmfeDocument, AmfeOperation } from '../../modules/amfe/amfeTypes';
import { rotulosVacios, ROTULOS_CARATULA } from '../../scripts/_lib/caratulaVacia.mjs';

function makeOp(): AmfeOperation {
    return {
        id: 'op1', opNumber: '10', name: 'COSTURA', workElements: [{
            id: 'we1', type: 'Machine', name: 'Maquina de coser', functions: [{
                id: 'fn1', description: 'Coser', requirements: '', failures: [{
                    id: 'f1', description: 'Costura floja', effectLocal: 'Retrabajo',
                    effectNextLevel: 'Retrabajo', effectEndUser: 'Apariencia', severity: 5,
                    causes: [{
                        id: 'c1', cause: 'Tension mal regulada', preventionControl: 'Set up', detectionControl: 'Visual',
                        occurrence: 4, detection: 8, ap: 'M', characteristicNumber: '', specialChar: '', filterCode: '',
                        preventionAction: '', detectionAction: '', responsible: '', targetDate: '', status: '',
                        actionTaken: '', completionDate: '', severityNew: '', occurrenceNew: '', detectionNew: '',
                        apNew: '', observations: '',
                    }],
                }],
            }],
        }],
    } as AmfeOperation;
}

function makeDoc(header: Record<string, unknown> = {}): AmfeDocument {
    return {
        header: {
            organization: 'BARACK MERCOSUL', location: 'PLANTA HURLINGHAM', client: 'VW ARGENTINA',
            modelYear: '2026', subject: 'Apoyacabezas', startDate: '01/06/2026', revDate: '01/10/2026',
            team: 'C. Baptista / F. Santoro', amfeNumber: '151', responsible: 'Carlos Baptista', confidentiality: 'Confidencial',
            partNumber: '2HC.885.900', processResponsible: 'Carlos Baptista', revision: 'A',
            approvedBy: 'Carlos Baptista', scope: 'Proceso completo', applicableParts: '',
            ...header,
        } as AmfeDocument['header'],
        operations: [makeOp()],
    };
}

/** Escribe y relee, como el export oficial. */
const releer = (doc: AmfeDocument) => {
    const wb = buildAmfeOficialWorkbook(doc, { revisions: [], status: 'draft' });
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    return XLSX.read(Buffer.from(buf), { type: 'buffer' });
};

describe('rotulosVacios (caratula del AMFE exportado)', () => {
    it('VERDE: una caratula completa no tiene rotulos vacios', () => {
        expect(rotulosVacios(releer(makeDoc()).Sheets['Caratula'])).toEqual([]);
    });
    it('ROJO: sin cliente ni fecha de inicio dice cuales y en que celda', () => {
        const v = rotulosVacios(releer(makeDoc({ client: '', startDate: '' })).Sheets['Caratula']);
        expect(v.map((x: { rotulo: string }) => x.rotulo).sort()).toEqual(['FECHA DE INICIO', 'NOMBRE DEL CLIENTE']);
        for (const x of v) expect(x.celda).toMatch(/^[A-Z]+\d+$/);
    });
    it('ROJO: un libro sin la hoja Caratula', () => {
        expect(rotulosVacios(undefined)).toHaveLength(1);
    });
    it('ROJO: una hoja que no es la del formulario (sin los rotulos)', () => {
        expect(rotulosVacios({ A1: { v: 'PLAN DE CONTROL' } })).toHaveLength(ROTULOS_CARATULA.length);
    });
    it('el alias viejo del header (customerName) tambien llena el cliente', () => {
        expect(rotulosVacios(releer(makeDoc({ client: '', customerName: 'VW ARGENTINA' })).Sheets['Caratula'])).toEqual([]);
    });
});
