import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AmfeDocument, AmfeOperation, AmfeWorkElement, AmfeFunction, AmfeFailure, AmfeCause, ActionPriority, AmfeHeaderData } from '../../../modules/amfe/amfeTypes';

// Mock XLSX
const mockWrite = vi.fn().mockReturnValue(new ArrayBuffer(8));
const mockBookNew = vi.fn().mockReturnValue({});
const mockAoaToSheet = vi.fn().mockReturnValue({});
const mockBookAppendSheet = vi.fn();

vi.mock('xlsx-js-style', () => ({
    default: {
        utils: {
            book_new: () => mockBookNew(),
            aoa_to_sheet: (data: any) => mockAoaToSheet(data),
            book_append_sheet: (...args: any[]) => mockBookAppendSheet(...args),
        },
        write: (...args: any[]) => mockWrite(...args),
    },
}));

// Mock DOM for download
let clickedAnchors: { href: string; download: string }[] = [];
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
    clickedAnchors = [];
    vi.stubGlobal('URL', {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
    });

    const mockAnchor = {
        href: '', download: '',
        click: function(this: any) { clickedAnchors.push({ href: this.href, download: this.download }); },
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

    mockBookNew.mockClear();
    mockAoaToSheet.mockClear();
    mockBookAppendSheet.mockClear();
    mockWrite.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// --- Helpers ---

function makeHeader(overrides: Partial<AmfeHeaderData> = {}): AmfeHeaderData {
    return {
        organization: 'BARACK', location: 'HURLINGHAM', client: 'Toyota',
        modelYear: '2024', subject: 'Test AMFE', startDate: '2024-01-01',
        revDate: '', team: 'Equipo A', amfeNumber: 'AMFE-001',
        responsible: 'Juan Perez', confidentiality: '-',
        partNumber: 'ABC-123', processResponsible: 'Pedro',
        revision: '1.0', approvedBy: 'Director', scope: 'Proceso completo',
        ...overrides,
    };
}

function makeCause(overrides: Partial<AmfeCause> = {}): AmfeCause {
    return {
        id: 'cause-1', cause: 'Sensor descalibrado',
        preventionControl: 'Calibracion semanal', detectionControl: 'Visual',
        occurrence: 5, detection: 4, ap: ActionPriority.MEDIUM,
        characteristicNumber: '', specialChar: '', filterCode: '',
        preventionAction: 'Capacitar', detectionAction: 'Inspeccion',
        responsible: 'Juan', targetDate: '2024-06-01', status: 'En Proceso',
        actionTaken: '', completionDate: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
        observations: '',
        ...overrides,
    };
}

function makeFailure(overrides: Partial<AmfeFailure> = {}): AmfeFailure {
    return {
        id: 'fail-1', description: 'No mantiene temp',
        effectLocal: 'Rechazo', effectNextLevel: 'Devolucion',
        effectEndUser: 'Mal func', severity: 8,
        causes: [makeCause()],
        ...overrides,
    };
}

function makeDoc(overrides: Partial<AmfeDocument> = {}): AmfeDocument {
    return {
        header: makeHeader(),
        operations: [{
            id: 'op-1', opNumber: '10', name: 'Soldadura',
            workElements: [{
                id: 'we-1', type: 'Machine' as const, name: 'CNC',
                functions: [{
                    id: 'func-1', description: 'Mantener temp', requirements: '',
                    failures: [makeFailure()],
                }],
            }],
        }],
        ...overrides,
    };
}

// Import after mocks
import { exportAmfeResumenAP, exportAmfePlanAcciones, sanitizeCellValue } from '../../../modules/amfe/amfeExcelExport';

// =========================================================================
// exportAmfeResumenAP
// =========================================================================
describe('exportAmfeResumenAP', () => {
    it('calls XLSX to create workbook and download', () => {
        const doc = makeDoc();
        exportAmfeResumenAP(doc);

        expect(mockBookNew).toHaveBeenCalled();
        expect(mockAoaToSheet).toHaveBeenCalled();
        expect(mockBookAppendSheet).toHaveBeenCalled();
        expect(mockWrite).toHaveBeenCalled();
    });

    it('generates filename with subject and date', () => {
        const doc = makeDoc({ header: makeHeader({ subject: 'Mi Proyecto' }) });
        exportAmfeResumenAP(doc);

        expect(clickedAnchors.length).toBe(1);
        expect(clickedAnchors[0].download).toContain('AMFE_Resumen_Mi Proyecto');
        expect(clickedAnchors[0].download).toMatch(/\.xlsx$/);
    });

    it('uses "Export" as fallback when subject is empty', () => {
        const doc = makeDoc({ header: makeHeader({ subject: '' }) });
        exportAmfeResumenAP(doc);

        expect(clickedAnchors[0].download).toContain('AMFE_Resumen_Export');
    });

    it('includes only H and M causes in priority rows', () => {
        const doc = makeDoc({
            operations: [{
                id: 'op-1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we-1', type: 'Machine' as const, name: 'CNC',
                    functions: [{
                        id: 'func-1', description: 'F', requirements: '',
                        failures: [makeFailure({
                            causes: [
                                makeCause({ id: 'c1', cause: 'A', ap: ActionPriority.HIGH }),
                                makeCause({ id: 'c2', cause: 'B', ap: ActionPriority.MEDIUM }),
                                makeCause({ id: 'c3', cause: 'C', ap: ActionPriority.LOW }),
                            ],
                        })],
                    }],
                }],
            }],
        });

        exportAmfeResumenAP(doc);

        // The aoa data should have been called with rows
        const aoaData = mockAoaToSheet.mock.calls[0][0];
        // Find data rows (after headers) - look for rows with AP value H or M
        const dataRows = aoaData.filter((row: any[]) =>
            row.length >= 11 && row[10] && typeof row[10] === 'object' && (row[10].v === 'H' || row[10].v === 'M')
        );

        expect(dataRows.length).toBe(2); // Only H and M
    });

    it('includes summary counts at the bottom', () => {
        const doc = makeDoc({
            operations: [{
                id: 'op-1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we-1', type: 'Machine' as const, name: 'CNC',
                    functions: [{
                        id: 'func-1', description: 'F', requirements: '',
                        failures: [makeFailure({
                            causes: [
                                makeCause({ id: 'c1', ap: ActionPriority.HIGH }),
                                makeCause({ id: 'c2', ap: ActionPriority.HIGH }),
                                makeCause({ id: 'c3', ap: ActionPriority.MEDIUM }),
                                makeCause({ id: 'c4', ap: ActionPriority.LOW }),
                            ],
                        })],
                    }],
                }],
            }],
        });

        exportAmfeResumenAP(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        const flatValues = aoaData.flat().map((c: any) => typeof c === 'object' ? c.v : c);

        // Check summary rows contain counts
        expect(flatValues).toContain('AP Alto (H):');
        expect(flatValues).toContain('AP Medio (M):');
        expect(flatValues).toContain('AP Bajo (L):');
        expect(flatValues).toContain('Total Causas:');
    });

    it('handles document with no operations', () => {
        const doc = makeDoc({ operations: [] });
        exportAmfeResumenAP(doc);

        expect(mockBookNew).toHaveBeenCalled();
        expect(clickedAnchors.length).toBe(1);
    });

    it('includes header info rows with organization and client', () => {
        const doc = makeDoc({ header: makeHeader({ organization: 'BARACK', client: 'VW' }) });
        exportAmfeResumenAP(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        const flatValues = aoaData.flat().map((c: any) => typeof c === 'object' ? c.v : c);

        expect(flatValues).toContain('BARACK');
        expect(flatValues).toContain('VW');
    });

    it('sorts H causes before M causes', () => {
        const doc = makeDoc({
            operations: [{
                id: 'op-1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we-1', type: 'Machine' as const, name: 'CNC',
                    functions: [{
                        id: 'func-1', description: 'F', requirements: '',
                        failures: [makeFailure({
                            severity: 5,
                            causes: [
                                makeCause({ id: 'c1', cause: 'M first', ap: ActionPriority.MEDIUM }),
                                makeCause({ id: 'c2', cause: 'H second', ap: ActionPriority.HIGH }),
                            ],
                        })],
                    }],
                }],
            }],
        });

        exportAmfeResumenAP(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        const apValues = aoaData
            .filter((row: any[]) => row.length >= 11 && row[10] && typeof row[10] === 'object' && (row[10].v === 'H' || row[10].v === 'M'))
            .map((row: any[]) => row[10].v);

        expect(apValues[0]).toBe('H'); // H first
        expect(apValues[1]).toBe('M'); // Then M
    });
});

// =========================================================================
// exportAmfePlanAcciones
// =========================================================================
describe('exportAmfePlanAcciones', () => {
    it('calls XLSX to create workbook and download', () => {
        const doc = makeDoc({
            operations: [{
                id: 'op-1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we-1', type: 'Machine' as const, name: 'CNC',
                    functions: [{
                        id: 'func-1', description: 'F', requirements: '',
                        failures: [makeFailure({
                            causes: [makeCause({ status: 'Pendiente', preventionAction: 'Do something' })],
                        })],
                    }],
                }],
            }],
        });

        exportAmfePlanAcciones(doc);

        expect(mockBookNew).toHaveBeenCalled();
        expect(mockWrite).toHaveBeenCalled();
        expect(clickedAnchors.length).toBe(1);
    });

    it('generates correct filename', () => {
        const doc = makeDoc({ header: makeHeader({ subject: 'Proyecto X' }) });
        doc.operations[0].workElements[0].functions[0].failures[0].causes[0].status = 'Pendiente';
        doc.operations[0].workElements[0].functions[0].failures[0].causes[0].preventionAction = 'Action';
        exportAmfePlanAcciones(doc);

        expect(clickedAnchors[0].download).toContain('AMFE_Acciones_Proyecto X');
    });

    it('excludes completed and cancelled causes', () => {
        const doc = makeDoc({
            operations: [{
                id: 'op-1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we-1', type: 'Machine' as const, name: 'CNC',
                    functions: [{
                        id: 'func-1', description: 'F', requirements: '',
                        failures: [makeFailure({
                            causes: [
                                makeCause({ id: 'c1', status: 'Pendiente', preventionAction: 'A' }),
                                makeCause({ id: 'c2', status: 'En Proceso', detectionAction: 'B' }),
                                makeCause({ id: 'c3', status: 'Completado', preventionAction: 'C' }),
                                makeCause({ id: 'c4', status: 'Cancelado', detectionAction: 'D' }),
                            ],
                        })],
                    }],
                }],
            }],
        });

        exportAmfePlanAcciones(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        // Count data rows with status (after header rows)
        const statusCells = aoaData
            .filter((row: any[]) => row.length >= 9 && row[8] && typeof row[8] === 'object')
            .filter((row: any[]) => ['Pendiente', 'En Proceso', 'Completado', 'Cancelado'].includes(row[8].v));

        expect(statusCells.length).toBe(2); // Only Pendiente and En Proceso
    });

    it('excludes causes without any actions', () => {
        const doc = makeDoc({
            operations: [{
                id: 'op-1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we-1', type: 'Machine' as const, name: 'CNC',
                    functions: [{
                        id: 'func-1', description: 'F', requirements: '',
                        failures: [makeFailure({
                            causes: [
                                makeCause({ id: 'c1', status: 'Pendiente', preventionAction: 'Has action', detectionAction: '' }),
                                makeCause({ id: 'c2', status: 'Pendiente', preventionAction: '', detectionAction: '' }),
                            ],
                        })],
                    }],
                }],
            }],
        });

        exportAmfePlanAcciones(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        const statusCells = aoaData
            .filter((row: any[]) => row.length >= 9 && row[8] && typeof row[8] === 'object' && row[8].v === 'Pendiente');

        expect(statusCells.length).toBe(1); // Only the one with action
    });

    it('handles document with no open actions', () => {
        const doc = makeDoc({
            operations: [{
                id: 'op-1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we-1', type: 'Machine' as const, name: 'CNC',
                    functions: [{
                        id: 'func-1', description: 'F', requirements: '',
                        failures: [makeFailure({
                            causes: [makeCause({ status: 'Completado', preventionAction: 'Done' })],
                        })],
                    }],
                }],
            }],
        });

        exportAmfePlanAcciones(doc);

        expect(mockBookNew).toHaveBeenCalled();
        expect(clickedAnchors.length).toBe(1);
    });

    it('sorts Pendiente before En Proceso', () => {
        const doc = makeDoc({
            operations: [{
                id: 'op-1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we-1', type: 'Machine' as const, name: 'CNC',
                    functions: [{
                        id: 'func-1', description: 'F', requirements: '',
                        failures: [makeFailure({
                            causes: [
                                makeCause({ id: 'c1', status: 'En Proceso', preventionAction: 'A', cause: 'B' }),
                                makeCause({ id: 'c2', status: 'Pendiente', preventionAction: 'C', cause: 'D' }),
                            ],
                        })],
                    }],
                }],
            }],
        });

        exportAmfePlanAcciones(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        const statusValues = aoaData
            .filter((row: any[]) => row.length >= 9 && row[8] && typeof row[8] === 'object' && ['Pendiente', 'En Proceso'].includes(row[8].v))
            .map((row: any[]) => row[8].v);

        expect(statusValues[0]).toBe('Pendiente');
        expect(statusValues[1]).toBe('En Proceso');
    });
});

// =========================================================================
// flattenCauseRows (tested indirectly through exports)
// =========================================================================
describe('data flattening', () => {
    it('flattens multi-level hierarchy correctly', () => {
        const doc = makeDoc({
            operations: [
                {
                    id: 'op-1', opNumber: '10', name: 'Op1',
                    workElements: [{
                        id: 'we-1', type: 'Machine' as const, name: 'CNC',
                        functions: [{
                            id: 'func-1', description: 'F1', requirements: '',
                            failures: [
                                makeFailure({ description: 'Fail1', causes: [
                                    makeCause({ id: 'c1', ap: ActionPriority.HIGH }),
                                    makeCause({ id: 'c2', ap: ActionPriority.LOW }),
                                ]}),
                                makeFailure({ description: 'Fail2', id: 'fail-2', causes: [
                                    makeCause({ id: 'c3', ap: ActionPriority.MEDIUM }),
                                ]}),
                            ],
                        }],
                    }],
                },
                {
                    id: 'op-2', opNumber: '20', name: 'Op2',
                    workElements: [{
                        id: 'we-2', type: 'Man' as const, name: 'Worker',
                        functions: [{
                            id: 'func-2', description: 'F2', requirements: '',
                            failures: [makeFailure({ description: 'Fail3', id: 'fail-3', causes: [
                                makeCause({ id: 'c4', ap: ActionPriority.HIGH }),
                            ]})],
                        }],
                    }],
                },
            ],
        });

        // Export Resumen AP to test flatten (H and M only = 3 causes)
        exportAmfeResumenAP(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        const dataRows = aoaData.filter((row: any[]) =>
            row.length >= 11 && row[10] && typeof row[10] === 'object' && (row[10].v === 'H' || row[10].v === 'M')
        );

        // 2 H causes + 1 M cause = 3 rows in resumen
        expect(dataRows.length).toBe(3);
    });

    it('handles empty operations array', () => {
        const doc = makeDoc({ operations: [] });
        exportAmfeResumenAP(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        // Should still have header rows but no data rows
        const dataRows = aoaData.filter((row: any[]) =>
            row.length >= 11 && row[10] && typeof row[10] === 'object' && (row[10].v === 'H' || row[10].v === 'M')
        );
        expect(dataRows.length).toBe(0);
    });
});

// =========================================================================
// Download mechanism
// =========================================================================
describe('download mechanism', () => {
    it('creates blob URL and triggers click', () => {
        const doc = makeDoc();
        exportAmfeResumenAP(doc);

        expect(mockCreateObjectURL).toHaveBeenCalled();
        expect(clickedAnchors.length).toBe(1);
        expect(clickedAnchors[0].href).toBe('blob:mock-url');
    });

    it('cleans up after download', () => {
        vi.useFakeTimers();
        const doc = makeDoc();
        exportAmfeResumenAP(doc);

        expect(document.body.appendChild).toHaveBeenCalled();
        expect(document.body.removeChild).toHaveBeenCalled();

        vi.advanceTimersByTime(2000);
        expect(mockRevokeObjectURL).toHaveBeenCalled();
        vi.useRealTimers();
    });
});

// =========================================================================
// Bug fix: Plan Acciones includes causes with empty status
// =========================================================================
describe('Plan de Acciones - empty status handling', () => {
    it('includes causes with empty status that have actions', () => {
        const doc = makeDoc({
            operations: [{
                id: 'op-1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we-1', type: 'Machine' as const, name: 'CNC',
                    functions: [{
                        id: 'func-1', description: 'F', requirements: '',
                        failures: [makeFailure({
                            causes: [
                                makeCause({ id: 'c1', status: '', preventionAction: 'Accion preventiva', ap: ActionPriority.HIGH }),
                                makeCause({ id: 'c2', status: 'En Proceso', preventionAction: 'Otra accion', ap: ActionPriority.MEDIUM }),
                                makeCause({ id: 'c3', status: 'Completado', preventionAction: 'Ya terminada', ap: ActionPriority.HIGH }),
                            ],
                        })],
                    }],
                }],
            }],
        });

        exportAmfePlanAcciones(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        // Find the title row to count action items
        const titleRow = aoaData.find((row: any[]) => row[0]?.v?.includes?.('PLAN DE ACCIONES'));
        expect(titleRow[0].v).toContain('2 items'); // c1 (empty status) + c2 (En Proceso), NOT c3 (Completado)
    });
});

// =========================================================================
// Bug fix: Resumen AP includes characteristicNumber, specialChar, filterCode
// =========================================================================
describe('Resumen AP - traceability columns', () => {
    it('includes characteristicNumber, specialChar, filterCode in export', () => {
        const doc = makeDoc({
            operations: [{
                id: 'op-1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we-1', type: 'Machine' as const, name: 'CNC',
                    functions: [{
                        id: 'func-1', description: 'F', requirements: '',
                        failures: [makeFailure({
                            causes: [makeCause({
                                ap: ActionPriority.HIGH,
                                characteristicNumber: 'C-42',
                                specialChar: 'CC',
                                filterCode: 'F01',
                            })],
                        })],
                    }],
                }],
            }],
        });

        exportAmfeResumenAP(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        // Find the header row (has "Op" as first element)
        const headerRow = aoaData.find((row: any[]) => row[0]?.v === 'Op');
        expect(headerRow).toBeDefined();
        const headerValues = headerRow.map((h: any) => h.v);
        expect(headerValues).toContain('No.Car.');
        expect(headerValues).toContain('Car. Esp.');
        expect(headerValues).toContain('Filtro');

        // Find data row with AP=H
        const dataRow = aoaData.find((row: any[]) =>
            row.length >= 14 && row[10]?.v === 'H'
        );
        expect(dataRow).toBeDefined();
        expect(dataRow[11].v).toBe('C-42');
        expect(dataRow[12].v).toBe('CC');
        expect(dataRow[13].v).toBe('F01');
    });
});

// =========================================================================
// sanitizeCellValue
// =========================================================================
describe('sanitizeCellValue', () => {
    it('escapes leading = sign', () => {
        expect(sanitizeCellValue('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    });

    it('escapes leading @ sign', () => {
        expect(sanitizeCellValue('@INDIRECT(A1)')).toBe("'@INDIRECT(A1)");
    });

    it('escapes leading + sign', () => {
        expect(sanitizeCellValue('+cmd|...')).toBe("'+cmd|...");
    });

    it('escapes leading - sign', () => {
        expect(sanitizeCellValue('-1+1')).toBe("'-1+1");
    });

    it('escapes leading tab', () => {
        expect(sanitizeCellValue('\tformula')).toBe("'\tformula");
    });

    it('passes through normal text unchanged', () => {
        expect(sanitizeCellValue('Normal text')).toBe('Normal text');
    });

    it('passes through numbers unchanged', () => {
        expect(sanitizeCellValue(42)).toBe(42);
    });

    it('handles undefined', () => {
        expect(sanitizeCellValue(undefined)).toBe('');
    });

    it('handles null', () => {
        expect(sanitizeCellValue(null)).toBe('');
    });

    it('handles empty string', () => {
        expect(sanitizeCellValue('')).toBe('');
    });

    it('does not escape = in middle of string', () => {
        expect(sanitizeCellValue('a=b')).toBe('a=b');
    });
});
