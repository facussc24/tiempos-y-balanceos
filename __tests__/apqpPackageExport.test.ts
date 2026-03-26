import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('xlsx-js-style', () => ({
    default: {
        utils: {
            book_new: () => ({ SheetNames: [] as string[], Sheets: {} as Record<string, any> }),
            book_append_sheet: (wb: any, ws: any, name: string) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
            aoa_to_sheet: (data: any[][]) => ({ '!data': data, '!cols': [], '!merges': [], '!rows': [] }),
            decode_cell: (ref: string) => { const m = ref.match(/^([A-Z]+)(\d+)$/); if (!m) return { r: 0, c: 0 }; return { r: parseInt(m[2]) - 1, c: m[1].charCodeAt(0) - 65 }; },
            encode_cell: (c: { r: number; c: number }) => String.fromCharCode(65 + c.c) + (c.r + 1),
            decode_range: (ref: string) => ({ s: { r: 0, c: 0 }, e: { r: 10, c: 10 } }),
            encode_range: (rng: any) => `${String.fromCharCode(65 + rng.s.c)}${rng.s.r + 1}:${String.fromCharCode(65 + rng.e.c)}${rng.e.r + 1}`,
        },
        write: () => new ArrayBuffer(10),
    },
}));

const mockDownloadWorkbook = vi.fn();
vi.mock('../utils/excel', () => ({
    downloadWorkbook: (...args: any[]) => mockDownloadWorkbook(...args),
    generateWorkbookBuffer: vi.fn().mockReturnValue(new Uint8Array(10)),
}));
vi.mock('../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { buildApqpPackageWorkbook, exportApqpPackage } from '../modules/family/apqpPackageExport';
import type { ApqpPackageData, ApqpExportOptions } from '../modules/family/apqpPackageExport';

function makePfdDoc(): any {
    return {
        id: 'pfd-1',
        header: { partNumber: 'N 227', partName: 'Insert', revisionLevel: 'A', engineeringChangeLevel: '', modelYear: '', documentNumber: '', revisionDate: '', companyName: '', plantLocation: '', supplierCode: '', customerName: '', coreTeam: '', keyContact: '', processPhase: '', preparedBy: '', preparedDate: '', approvedBy: '', approvedDate: '' },
        steps: [
            { id: 's1', stepNumber: 'OP 10', stepType: 'operation', description: 'Recepcion MP', machineDeviceTool: 'Manual', productCharacteristic: 'Aspecto', productSpecialChar: 'none', processCharacteristic: 'Visual', processSpecialChar: 'CC', reference: '', department: '', notes: '', isRework: false, isExternalProcess: false, reworkReturnStep: '', rejectDisposition: 'none', scrapDescription: '', branchId: '', branchLabel: '' },
            { id: 's2', stepNumber: 'OP 20', stepType: 'inspection', description: 'Inspeccion', machineDeviceTool: 'Calibre', productCharacteristic: 'Diametro', productSpecialChar: 'CC', processCharacteristic: '', processSpecialChar: 'none', reference: '', department: '', notes: '', isRework: false, isExternalProcess: false, reworkReturnStep: '', rejectDisposition: 'scrap', scrapDescription: '', branchId: '', branchLabel: '' },
        ],
        createdAt: '', updatedAt: '',
    };
}

function makeAmfeDoc(): any {
    return {
        header: { amfeNumber: 'A1', confidentiality: '', organization: '', client: '', location: '', partNumber: '', responsible: '', processResponsible: '', team: 'Equipo A', modelYear: '', startDate: '', revDate: '', revision: 'A', approvedBy: '', scope: '', subject: 'Test', applicableParts: '' },
        operations: [{ id: 'op1', opNumber: 'OP 10', name: 'Test', focusElementFunction: '', operationFunction: '', workElements: [{ id: 'w1', type: 'Machine', name: 'M', functions: [{ id: 'f1', description: 'F', requirements: '', failures: [{ id: 'fl1', description: 'Fail', effectLocal: '', effectNextLevel: '', effectEndUser: '', severity: 7, severityLocal: '', severityNextLevel: '', severityEndUser: '', causes: [{ id: 'c1', cause: 'C', preventionControl: '', detectionControl: '', occurrence: 3, detection: 4, ap: 'M', characteristicNumber: '', specialChar: '', filterCode: '', preventionAction: '', detectionAction: '', responsible: '', targetDate: '', status: '', actionTaken: '', completionDate: '', severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '', observations: '' }] }] }] }] }],
    };
}

function makeCpDoc(): any {
    return {
        header: { controlPlanNumber: 'CP1', phase: 'production', partNumber: 'N 227', latestChangeLevel: '', partName: 'Insert', applicableParts: '', organization: '', supplier: '', supplierCode: '', keyContactPhone: '', date: '', revision: 'A', responsible: '', approvedBy: '', client: '', coreTeam: 'Equipo A', customerApproval: '', otherApproval: '', linkedAmfeProject: '' },
        items: [{ id: 'cp1', processStepNumber: 'OP 10', processDescription: 'Test', machineDeviceTool: '', characteristicNumber: '', productCharacteristic: '', processCharacteristic: '', specialCharClass: 'CC', specification: '', evaluationTechnique: '', sampleSize: '', sampleFrequency: '', controlMethod: '', reactionPlan: '', reactionPlanOwner: '', controlProcedure: '' }],
    };
}

function makeData(): ApqpPackageData {
    return { familyName: 'Insert VWA', partNumbers: ['N 227'], client: 'VWA', revision: 'A', team: 'Equipo A', date: '2026-03-19', pfd: makePfdDoc(), amfe: makeAmfeDoc(), cp: makeCpDoc() };
}
function makeOpts(): ApqpExportOptions {
    return { includePortada: true, includeFlujograma: true, includeAmfe: true, includeCp: true, revision: 'A' };
}

describe('APQP Package Export', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('buildApqpPackageWorkbook', () => {
        it('should create all 4 sections when all data present', () => {
            const wb = buildApqpPackageWorkbook(makeData(), makeOpts());
            expect(wb.SheetNames).toContain('Portada');
            expect(wb.SheetNames).toContain('Flujograma');
            expect(wb.SheetNames).toContain('AMFE VDA');
            expect(wb.SheetNames).toContain('Plan de Control');
            expect(wb.SheetNames.some(n => n.startsWith('HO '))).toBe(false);
        });

        it('should skip sections when options are false', () => {
            const opts: ApqpExportOptions = { includePortada: false, includeFlujograma: false, includeAmfe: true, includeCp: true, revision: 'A' };
            const wb = buildApqpPackageWorkbook(makeData(), opts);
            expect(wb.SheetNames).not.toContain('Portada');
            expect(wb.SheetNames).not.toContain('Flujograma');
            expect(wb.SheetNames).toContain('AMFE VDA');
            expect(wb.SheetNames).toContain('Plan de Control');
        });

        it('should skip sections when documents are null', () => {
            const data = makeData(); data.pfd = null; data.amfe = null;
            const wb = buildApqpPackageWorkbook(data, makeOpts());
            expect(wb.SheetNames).toContain('Portada');
            expect(wb.SheetNames).not.toContain('Flujograma');
            expect(wb.SheetNames).not.toContain('AMFE VDA');
            expect(wb.SheetNames).toContain('Plan de Control');
        });

        it('should produce only Portada when all docs are null', () => {
            const data: ApqpPackageData = { familyName: 'Empty', partNumbers: [], client: '', revision: 'A', team: '', date: '2026-03-19', pfd: null, amfe: null, cp: null };
            const wb = buildApqpPackageWorkbook(data, makeOpts());
            expect(wb.SheetNames).toEqual(['Portada']);
        });

        it('should handle PFD with NG dispositions', () => {
            const data = makeData(); data.pfd!.steps[1].rejectDisposition = 'scrap';
            const wb = buildApqpPackageWorkbook(data, makeOpts());
            expect(wb.SheetNames).toContain('Flujograma');
        });

        it('should handle empty PFD steps', () => {
            const data = makeData(); data.pfd!.steps = [];
            const wb = buildApqpPackageWorkbook(data, makeOpts());
            expect(wb.SheetNames).toContain('Flujograma');
        });
    });

    describe('exportApqpPackage', () => {
        it('should call downloadWorkbook with correct filename', () => {
            exportApqpPackage(makeData(), makeOpts());
            expect(mockDownloadWorkbook).toHaveBeenCalledTimes(1);
            const [, filename] = mockDownloadWorkbook.mock.calls[0];
            expect(filename).toMatch(/Paquete APQP.*Insert VWA.*\.xlsx$/);
        });

        it('should sanitize special characters in filename', () => {
            const data = makeData(); data.familyName = 'Insert <VWA> / Test';
            exportApqpPackage(data, makeOpts());
            const [, filename] = mockDownloadWorkbook.mock.calls[0];
            expect(filename).not.toContain('<');
            expect(filename).not.toContain('>');
        });
    });
});
