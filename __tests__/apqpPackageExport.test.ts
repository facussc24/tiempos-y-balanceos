import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock xlsx-js-style
vi.mock('xlsx-js-style', () => {
    return {
        default: {
            utils: {
                book_new: () => ({ SheetNames: [] as string[], Sheets: {} as Record<string, any> }),
                book_append_sheet: (wb: any, ws: any, name: string) => {
                    wb.SheetNames.push(name);
                    wb.Sheets[name] = ws;
                },
                aoa_to_sheet: (data: any[][]) => ({
                    '!data': data,
                    '!cols': [],
                    '!merges': [],
                    '!rows': [],
                }),
            },
            write: () => new ArrayBuffer(10),
        },
    };
});

const mockDownloadWorkbook = vi.fn();
vi.mock('../utils/excel', () => ({
    downloadWorkbook: (...args: any[]) => mockDownloadWorkbook(...args),
    generateWorkbookBuffer: vi.fn().mockReturnValue(new Uint8Array(10)),
}));

vi.mock('../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
    buildApqpPackageWorkbook,
    exportApqpPackage,
} from '../modules/family/apqpPackageExport';
import type { ApqpPackageData, ApqpExportOptions } from '../modules/family/apqpPackageExport';
import type { PfdDocument } from '../modules/pfd/pfdTypes';
import type { AmfeDocument } from '../modules/amfe/amfeTypes';
import type { ControlPlanDocument } from '../modules/controlPlan/controlPlanTypes';
import type { HoDocument } from '../modules/hojaOperaciones/hojaOperacionesTypes';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makePfdDoc(): PfdDocument {
    return {
        id: 'pfd-1',
        header: {
            partNumber: 'N 227',
            partName: 'Insert',
            engineeringChangeLevel: '',
            modelYear: '2026',
            documentNumber: 'PFD-001',
            revisionLevel: 'A',
            revisionDate: '2026-03-01',
            companyName: 'Barack Mercosul',
            plantLocation: 'Hurlingham',
            supplierCode: '',
            customerName: 'VWA',
            coreTeam: 'Equipo A',
            keyContact: '',
            processPhase: 'production',
            preparedBy: 'User',
            preparedDate: '2026-03-01',
            approvedBy: 'Admin',
            approvedDate: '2026-03-01',
        },
        steps: [
            {
                id: 's1', stepNumber: 'OP 10', stepType: 'operation',
                description: 'Recepción MP', machineDeviceTool: 'Manual',
                productCharacteristic: 'Aspecto', productSpecialChar: 'none',
                processCharacteristic: 'Visual', processSpecialChar: 'CC',
                reference: '', department: 'Almacén', notes: '',
                isRework: false, isExternalProcess: false, reworkReturnStep: '',
                rejectDisposition: 'none', scrapDescription: '',
                branchId: '', branchLabel: '',
            },
            {
                id: 's2', stepNumber: 'OP 20', stepType: 'inspection',
                description: 'Inspección dimensional', machineDeviceTool: 'Calibre',
                productCharacteristic: 'Diámetro', productSpecialChar: 'CC',
                processCharacteristic: '', processSpecialChar: 'none',
                reference: '', department: 'Calidad', notes: '',
                isRework: false, isExternalProcess: false, reworkReturnStep: '',
                rejectDisposition: 'scrap', scrapDescription: 'Descarte',
                branchId: '', branchLabel: '',
            },
        ],
        createdAt: '2026-03-01T00:00:00Z',
        updatedAt: '2026-03-01T00:00:00Z',
    };
}

function makeAmfeDoc(): AmfeDocument {
    return {
        header: {
            amfeNumber: 'AMFE-001', confidentiality: 'Interna',
            organization: 'Barack Mercosul', client: 'VWA',
            location: 'Hurlingham', partNumber: 'N 227',
            responsible: 'User', processResponsible: 'Admin',
            team: 'Equipo A', modelYear: '2026',
            startDate: '2026-01-01', revDate: '2026-03-01',
            revision: 'A', approvedBy: 'Admin',
            scope: 'Insert', subject: 'Insert AMFE', applicableParts: '',
        },
        operations: [{
            id: 'op1', opNumber: 'OP 10', name: 'Recepción MP',
            focusElementFunction: 'Asegurar calidad MP',
            operationFunction: 'Recibir materia prima',
            workElements: [{
                id: 'we1', type: 'Machine', name: 'Manual',
                functions: [{
                    id: 'f1', description: 'Verificar estado', requirements: '',
                    failures: [{
                        id: 'fail1', description: 'Material dañado',
                        effectLocal: 'Parada', effectNextLevel: 'Rechazo',
                        effectEndUser: 'Insatisfacción', severity: 7,
                        severityLocal: '', severityNextLevel: '', severityEndUser: '',
                        causes: [{
                            id: 'c1', cause: 'Transporte inadecuado',
                            preventionControl: 'Embalaje', detectionControl: 'Visual',
                            occurrence: 3, detection: 4, ap: 'M',
                            characteristicNumber: '1', specialChar: 'CC', filterCode: '',
                            preventionAction: '', detectionAction: '',
                            responsible: '', targetDate: '', status: 'Pendiente',
                            actionTaken: '', completionDate: '',
                            severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
                            observations: '',
                        }],
                    }],
                }],
            }],
        }],
    };
}

function makeCpDoc(): ControlPlanDocument {
    return {
        header: {
            controlPlanNumber: 'CP-001', phase: 'production',
            partNumber: 'N 227', latestChangeLevel: 'A', partName: 'Insert',
            applicableParts: '', organization: 'Barack Mercosul',
            supplier: '', supplierCode: '', keyContactPhone: '',
            date: '2026-03-01', revision: 'A', responsible: 'User',
            approvedBy: 'Admin', client: 'VWA', coreTeam: 'Equipo A',
            customerEngApproval: '', customerQualityApproval: '',
            otherApproval: '', linkedAmfeProject: 'VWA/PATAGONIA/INSERT',
        },
        items: [{
            id: 'cp1', processStepNumber: 'OP 10', processDescription: 'Recepción',
            machineDeviceTool: 'Manual', characteristicNumber: '1',
            productCharacteristic: 'Aspecto', processCharacteristic: 'Visual',
            specialCharClass: 'CC', specification: 'OK', evaluationTechnique: 'Visual',
            sampleSize: '5', sampleFrequency: 'Lote', controlMethod: 'Inspección',
            reactionPlan: 'Rechazar', reactionPlanOwner: 'Calidad', controlProcedure: 'IT-001',
        }],
    };
}

function makeHoDoc(): HoDocument {
    return {
        header: {
            formNumber: 'I-IN-002.4-R01', organization: 'Barack Mercosul',
            client: 'VWA', partNumber: 'N 227', partDescription: 'Insert',
            applicableParts: '', linkedAmfeProject: 'VWA/INSERT', linkedCpProject: '',
        },
        sheets: [{
            id: 'ho1', amfeOperationId: 'op1', operationNumber: 'OP 10',
            operationName: 'Recepción MP', hoNumber: 'HO-OP 10',
            sector: 'Almacén', puestoNumber: 'P1', vehicleModel: 'Taos',
            partCodeDescription: 'N 227', safetyElements: ['anteojos', 'guantes'],
            hazardWarnings: [],
            steps: [
                { id: 'st1', stepNumber: 1, description: 'Verificar', isKeyPoint: true, keyPointReason: 'Evitar daño' },
                { id: 'st2', stepNumber: 2, description: 'Registrar', isKeyPoint: false, keyPointReason: '' },
            ],
            qualityChecks: [{
                id: 'qc1', characteristic: 'Aspecto', specification: 'OK',
                evaluationTechnique: 'Visual', frequency: 'Lote',
                controlMethod: 'Inspección', reactionAction: 'Rechazar',
                reactionContact: 'Calidad', specialCharSymbol: 'CC', registro: 'F-001',
            }],
            reactionPlanText: 'Detener', reactionContact: 'Supervisor',
            visualAids: [], preparedBy: 'User', approvedBy: 'Admin',
            date: '2026-03-01', revision: 'A', status: 'aprobado',
        }],
    };
}

function makeFullData(): ApqpPackageData {
    return {
        familyName: 'Insert VWA', partNumbers: ['N 227', 'N 228'],
        client: 'Volkswagen Argentina', revision: 'A', team: 'Equipo A',
        date: '2026-03-19',
        pfd: makePfdDoc(), amfe: makeAmfeDoc(), cp: makeCpDoc(), ho: makeHoDoc(),
    };
}

function makeAllOptions(): ApqpExportOptions {
    return {
        includePortada: true, includeFlujograma: true,
        includeAmfe: true, includeCp: true, includeHo: true, revision: 'A',
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('APQP Package Export', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('buildApqpPackageWorkbook', () => {
        it('should create workbook with all sections when all data present', () => {
            const wb = buildApqpPackageWorkbook(makeFullData(), makeAllOptions());

            expect(wb.SheetNames).toContain('Portada');
            expect(wb.SheetNames).toContain('Flujograma');
            expect(wb.SheetNames).toContain('AMFE VDA');
            expect(wb.SheetNames).toContain('Plan de Control');
            expect(wb.SheetNames.some(n => n.startsWith('HO '))).toBe(true);
        });

        it('should include Portada with TOC entries', () => {
            const wb = buildApqpPackageWorkbook(makeFullData(), makeAllOptions());
            expect(wb.Sheets['Portada']).toBeDefined();
        });

        it('should skip sections when options are false', () => {
            const options: ApqpExportOptions = {
                includePortada: false, includeFlujograma: false,
                includeAmfe: true, includeCp: true, includeHo: false, revision: 'A',
            };
            const wb = buildApqpPackageWorkbook(makeFullData(), options);

            expect(wb.SheetNames).not.toContain('Portada');
            expect(wb.SheetNames).not.toContain('Flujograma');
            expect(wb.SheetNames).toContain('AMFE VDA');
            expect(wb.SheetNames).toContain('Plan de Control');
            expect(wb.SheetNames.some(n => n.startsWith('HO '))).toBe(false);
        });

        it('should skip sections when documents are null', () => {
            const data = makeFullData();
            data.pfd = null;
            data.amfe = null;
            const wb = buildApqpPackageWorkbook(data, makeAllOptions());

            expect(wb.SheetNames).toContain('Portada');
            expect(wb.SheetNames).not.toContain('Flujograma');
            expect(wb.SheetNames).not.toContain('AMFE VDA');
            expect(wb.SheetNames).toContain('Plan de Control');
        });

        it('should handle empty HO sheets array', () => {
            const data = makeFullData();
            data.ho!.sheets = [];
            const wb = buildApqpPackageWorkbook(data, makeAllOptions());

            expect(wb.SheetNames.some(n => n.startsWith('HO '))).toBe(false);
        });

        it('should produce only Portada when all docs are null', () => {
            const data: ApqpPackageData = {
                familyName: 'Empty', partNumbers: [], client: '',
                revision: 'A', team: '', date: '2026-03-19',
                pfd: null, amfe: null, cp: null, ho: null,
            };
            const wb = buildApqpPackageWorkbook(data, makeAllOptions());

            expect(wb.SheetNames).toEqual(['Portada']);
        });

        it('should generate HO sheet per operation', () => {
            const data = makeFullData();
            // Add a second HO sheet
            data.ho!.sheets.push({ ...data.ho!.sheets[0], id: 'ho2', operationNumber: 'OP 20', operationName: 'Inspección' });
            const wb = buildApqpPackageWorkbook(data, makeAllOptions());

            const hoSheets = wb.SheetNames.filter(n => n.startsWith('HO '));
            expect(hoSheets.length).toBe(2);
        });

        it('should handle duplicate HO sheet names gracefully', () => {
            const data = makeFullData();
            data.ho!.sheets.push({ ...data.ho!.sheets[0], id: 'ho2' });
            const wb = buildApqpPackageWorkbook(data, makeAllOptions());

            const hoSheets = wb.SheetNames.filter(n => n.startsWith('HO '));
            expect(hoSheets.length).toBe(2);
            expect(hoSheets[0]).not.toEqual(hoSheets[1]);
        });

        it('should handle PFD with NG dispositions (scrap/rework/sort)', () => {
            const data = makeFullData();
            data.pfd!.steps[1].rejectDisposition = 'scrap';
            const wb = buildApqpPackageWorkbook(data, makeAllOptions());

            expect(wb.SheetNames).toContain('Flujograma');
        });

        it('should handle PFD with empty steps', () => {
            const data = makeFullData();
            data.pfd!.steps = [];
            const wb = buildApqpPackageWorkbook(data, makeAllOptions());

            expect(wb.SheetNames).toContain('Flujograma');
        });
    });

    describe('exportApqpPackage', () => {
        it('should trigger download with correct filename', () => {
            exportApqpPackage(makeFullData(), makeAllOptions());

            expect(mockDownloadWorkbook).toHaveBeenCalledTimes(1);
            const [, filename] = mockDownloadWorkbook.mock.calls[0];
            expect(filename).toMatch(/Paquete APQP.*Insert VWA/);
            expect(filename).toMatch(/\.xlsx$/);
        });

        it('should sanitize special characters in filename', () => {
            const data = makeFullData();
            data.familyName = 'Insert <VWA> / Test';
            exportApqpPackage(data, makeAllOptions());

            const [, filename] = mockDownloadWorkbook.mock.calls[0];
            expect(filename).not.toContain('<');
            expect(filename).not.toContain('>');
        });

        it('should pass workbook with correct sheets to downloadWorkbook', () => {
            exportApqpPackage(makeFullData(), makeAllOptions());

            const [wb] = mockDownloadWorkbook.mock.calls[0];
            expect(wb.SheetNames.length).toBeGreaterThanOrEqual(5);
        });
    });
});
