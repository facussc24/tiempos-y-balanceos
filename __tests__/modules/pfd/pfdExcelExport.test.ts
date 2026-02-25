vi.mock('xlsx-js-style', () => {
    const mockWs: Record<string, unknown> = {};
    return {
        default: {
            utils: {
                book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
                book_append_sheet: vi.fn(),
                aoa_to_sheet: vi.fn(() => mockWs),
            },
            write: vi.fn(() => new Uint8Array(10)),
            writeFile: vi.fn(),
        },
    };
});

vi.mock('../../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { exportPfdExcel } from '../../../modules/pfd/pfdExcelExport';
import { createEmptyPfdDocument, createEmptyStep } from '../../../modules/pfd/pfdTypes';
import XLSX from 'xlsx-js-style';

describe('pfdExcelExport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock URL and DOM for download
        global.URL.createObjectURL = vi.fn(() => 'blob:test');
        global.URL.revokeObjectURL = vi.fn();
    });

    it('should create a workbook', () => {
        const doc = createEmptyPfdDocument();
        exportPfdExcel(doc);
        expect(XLSX.utils.book_new).toHaveBeenCalled();
    });

    it('should add a sheet named Diagrama de Flujo', () => {
        const doc = createEmptyPfdDocument();
        exportPfdExcel(doc);
        expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Object),
            'Diagrama de Flujo'
        );
    });

    it('should call aoa_to_sheet with data', () => {
        const doc = createEmptyPfdDocument();
        doc.steps[0].stepNumber = 'OP 10';
        doc.steps[0].description = 'Test step';
        exportPfdExcel(doc);
        expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalled();
    });

    it('should handle multiple steps', () => {
        const doc = createEmptyPfdDocument();
        const step2 = createEmptyStep();
        step2.stepNumber = 'OP 20';
        step2.description = 'Second step';
        doc.steps.push(step2);
        exportPfdExcel(doc);
        expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalled();
    });

    it('should include Disposición and Detalle columns (C3-N2)', () => {
        const doc = createEmptyPfdDocument();
        doc.steps[0].rejectDisposition = 'scrap';
        doc.steps[0].scrapDescription = 'Fuera de tolerancia';
        exportPfdExcel(doc);
        const calls = (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const rows = calls[0][0] as unknown[][];
        // Header row is at index 10 (after 10 metadata rows)
        const headerRow = rows[10] as { v: string }[];
        const headers = headerRow.map((c: { v: string }) => c.v);
        expect(headers).toContain('Disposición');
        expect(headers).toContain('Detalle');
        expect(headers).not.toContain('Retrabajo');
    });

    it('should have 14 columns in header row (C3-N2)', () => {
        const doc = createEmptyPfdDocument();
        exportPfdExcel(doc);
        const calls = (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.calls;
        const rows = calls[0][0] as unknown[][];
        const headerRow = rows[10] as { v: string }[];
        expect(headerRow).toHaveLength(14);
    });

    it('should set freeze panes on header row (C4-E1)', () => {
        const doc = createEmptyPfdDocument();
        exportPfdExcel(doc);
        const calls = (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.calls;
        const ws = calls[0]?.[0] ? (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.results[0].value : {};
        // The worksheet should have !freeze set
        expect(ws['!freeze']).toEqual({ xSplit: 0, ySplit: 11, topLeftCell: 'A12' });
    });
});
