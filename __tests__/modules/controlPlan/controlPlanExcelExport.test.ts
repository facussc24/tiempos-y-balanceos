import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ControlPlanDocument, ControlPlanHeader, ControlPlanItem, EMPTY_CP_HEADER, CP_COLUMNS, CP_COLUMN_GROUPS } from '../../../modules/controlPlan/controlPlanTypes';

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

// Mock DOM
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

function makeHeader(overrides: Partial<ControlPlanHeader> = {}): ControlPlanHeader {
    return {
        ...EMPTY_CP_HEADER,
        controlPlanNumber: 'CP-001',
        partName: 'Pieza Test',
        partNumber: 'PT-123',
        organization: 'BARACK',
        client: 'Toyota',
        responsible: 'Juan',
        phase: 'production',
        ...overrides,
    };
}

function makeItem(overrides: Partial<ControlPlanItem> = {}): ControlPlanItem {
    return {
        id: 'item-1',
        processStepNumber: '10',
        processDescription: 'Soldadura MIG',
        machineDeviceTool: 'Robot MIG',
        characteristicNumber: 'CC-1',
        productCharacteristic: 'Penetracion cordones',
        processCharacteristic: 'Amperaje',
        specialCharClass: 'CC',
        specification: '180-220 A',
        evaluationTechnique: 'Medicion amperimetro',
        sampleSize: '5 piezas',
        sampleFrequency: 'Cada hora',
        controlMethod: 'Hoja de registro',
        reactionPlan: 'Parar y recalibrar',
        reactionPlanOwner: '',
        ...overrides,
    };
}

function makeDoc(overrides: Partial<ControlPlanDocument> = {}): ControlPlanDocument {
    return {
        header: makeHeader(),
        items: [makeItem()],
        ...overrides,
    };
}

// Import after mocks
import { exportControlPlan } from '../../../modules/controlPlan/controlPlanExcelExport';

describe('exportControlPlan', () => {
    it('creates workbook and triggers download', () => {
        const doc = makeDoc();
        exportControlPlan(doc);

        expect(mockBookNew).toHaveBeenCalled();
        expect(mockAoaToSheet).toHaveBeenCalled();
        expect(mockBookAppendSheet).toHaveBeenCalled();
        expect(mockWrite).toHaveBeenCalled();
        expect(clickedAnchors.length).toBe(1);
    });

    it('generates filename with partName and date', () => {
        const doc = makeDoc({ header: makeHeader({ partName: 'Mi Pieza' }) });
        exportControlPlan(doc);

        expect(clickedAnchors[0].download).toContain('PlanDeControl_Mi Pieza');
        expect(clickedAnchors[0].download).toMatch(/\.xlsx$/);
    });

    it('uses "Export" as fallback when partName is empty', () => {
        const doc = makeDoc({ header: makeHeader({ partName: '' }) });
        exportControlPlan(doc);

        expect(clickedAnchors[0].download).toContain('PlanDeControl_Export');
    });

    it('includes title row "PLAN DE CONTROL"', () => {
        const doc = makeDoc();
        exportControlPlan(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        expect(aoaData[0][0].v).toBe('PLAN DE CONTROL');
    });

    it('includes header info with organization and client', () => {
        const doc = makeDoc({ header: makeHeader({ organization: 'BARACK', client: 'VW' }) });
        exportControlPlan(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        const flatValues = aoaData.flat().map((c: any) => typeof c === 'object' ? c.v : c);

        expect(flatValues).toContain('BARACK');
        expect(flatValues).toContain('VW');
    });

    it('includes column group headers', () => {
        const doc = makeDoc();
        exportControlPlan(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        const flatValues = aoaData.flat().map((c: any) => typeof c === 'object' ? c.v : c);

        for (const group of CP_COLUMN_GROUPS) {
            expect(flatValues).toContain(group.label);
        }
    });

    it('includes column headers for all 13 columns', () => {
        const doc = makeDoc();
        exportControlPlan(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        const flatValues = aoaData.flat().map((c: any) => typeof c === 'object' ? c.v : c);

        for (const col of CP_COLUMNS) {
            expect(flatValues).toContain(col.label);
        }
    });

    it('includes data rows for each item', () => {
        const doc = makeDoc({
            items: [
                makeItem({ id: 'i1', processDescription: 'Soldadura' }),
                makeItem({ id: 'i2', processDescription: 'Pintura' }),
            ],
        });

        exportControlPlan(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        const flatValues = aoaData.flat().map((c: any) => typeof c === 'object' ? c.v : c);

        expect(flatValues).toContain('Soldadura');
        expect(flatValues).toContain('Pintura');
    });

    it('handles empty items array', () => {
        const doc = makeDoc({ items: [] });
        exportControlPlan(doc);

        expect(mockBookNew).toHaveBeenCalled();
        expect(clickedAnchors.length).toBe(1);
    });

    it('sanitizes cell values against formula injection in data rows', () => {
        const doc = makeDoc({
            items: [makeItem({ processDescription: '=HYPERLINK("http://evil.com")' })],
        });
        exportControlPlan(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        const flatValues = aoaData.flat().map((c: any) => typeof c === 'object' ? c.v : c);
        expect(flatValues).toContain("'=HYPERLINK(\"http://evil.com\")");
        expect(flatValues).not.toContain('=HYPERLINK("http://evil.com")');
    });

    it('sanitizes header info values against formula injection', () => {
        const doc = makeDoc({ header: makeHeader({ organization: '=CMD("calc")' }) });
        exportControlPlan(doc);

        const aoaData = mockAoaToSheet.mock.calls[0][0];
        const flatValues = aoaData.flat().map((c: any) => typeof c === 'object' ? c.v : c);
        expect(flatValues).toContain("'=CMD(\"calc\")");
    });

    it('creates blob and cleans up after download', () => {
        vi.useFakeTimers();
        const doc = makeDoc();
        exportControlPlan(doc);

        expect(mockCreateObjectURL).toHaveBeenCalled();
        expect(document.body.appendChild).toHaveBeenCalled();
        expect(document.body.removeChild).toHaveBeenCalled();
        // revokeObjectURL is deferred to avoid Firefox download race
        expect(mockRevokeObjectURL).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1500);
        expect(mockRevokeObjectURL).toHaveBeenCalled();
        vi.useRealTimers();
    });
});
