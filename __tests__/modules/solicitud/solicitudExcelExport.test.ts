vi.mock('exceljs', () => {
    const mockCell: Record<string, unknown> = { value: '', font: {}, fill: {}, alignment: {}, border: {} };
    const mockRow = { height: 15 };
    const mockWorksheet = {
        columns: [],
        mergeCells: vi.fn(),
        getCell: vi.fn(() => ({ ...mockCell })),
        getRow: vi.fn(() => ({ ...mockRow })),
        addImage: vi.fn(),
        pageSetup: {},
        headerFooter: {},
    };

    class MockWorkbook {
        creator = '';
        created: Date | null = null;
        addWorksheet = vi.fn(() => mockWorksheet);
        addImage = vi.fn(() => 1);
        xlsx = { writeBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) };
    }

    return {
        default: {
            Workbook: MockWorkbook,
        },
    };
});

vi.mock('../../../src/assets/ppe/ppeBase64', () => ({
    getLogoBase64: vi.fn().mockResolvedValue('data:image/png;base64,AAAA'),
}));

vi.mock('../../../utils/excel', () => ({
    downloadExcelJSWorkbook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../utils/sanitizeCellValue', () => ({
    sanitizeCellValue: vi.fn((v: string) => v),
}));

vi.mock('../../../utils/filenameSanitization', () => ({
    sanitizeFilename: vi.fn((v: string) => v),
}));

vi.mock('../../../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { exportSolicitudExcel } from '../../../modules/solicitud/solicitudExcelExport';
import { createEmptySolicitud } from '../../../modules/solicitud/solicitudTypes';
import { downloadExcelJSWorkbook } from '../../../utils/excel';
import type { SolicitudDocument } from '../../../modules/solicitud/solicitudTypes';

function filledProducto(): SolicitudDocument {
    const doc = createEmptySolicitud('producto');
    doc.header.solicitudNumber = 'SGC-001';
    doc.header.solicitante = 'Juan';
    doc.header.areaDepartamento = 'Ingenieria';
    doc.producto = { codigo: 'ABC-123', descripcion: 'Tornillo M8', cliente: 'Toyota' };
    return doc;
}

function filledInsumo(): SolicitudDocument {
    const doc = createEmptySolicitud('insumo');
    doc.header.solicitudNumber = 'SGC-002';
    doc.header.solicitante = 'Maria';
    doc.header.areaDepartamento = 'Compras';
    doc.insumo = { codigo: 'INS-001', descripcion: 'Aceite', unidadMedida: 'lt', requiereGeneracionInterna: true };
    return doc;
}

describe('solicitudExcelExport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls downloadExcelJSWorkbook when exporting', async () => {
        const doc = filledProducto();
        await exportSolicitudExcel(doc);
        expect(downloadExcelJSWorkbook).toHaveBeenCalledTimes(1);
    });

    it('filename contains the solicitud number', async () => {
        const doc = filledProducto();
        await exportSolicitudExcel(doc);

        const [, filename] = (downloadExcelJSWorkbook as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(filename).toContain('SGC-001');
    });

    it('producto export completes without error', async () => {
        const doc = filledProducto();
        await expect(exportSolicitudExcel(doc)).resolves.toBeUndefined();
    });

    it('insumo export completes without error', async () => {
        const doc = filledInsumo();
        await expect(exportSolicitudExcel(doc)).resolves.toBeUndefined();
    });

    it('filename has .xlsx extension', async () => {
        const doc = filledProducto();
        await exportSolicitudExcel(doc);

        const [, filename] = (downloadExcelJSWorkbook as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(filename).toMatch(/\.xlsx$/);
    });

    it('passes workbook to downloadExcelJSWorkbook', async () => {
        const doc = filledProducto();
        await exportSolicitudExcel(doc);

        // The first arg to downloadExcelJSWorkbook should be an ExcelJS workbook instance
        const [wb] = (downloadExcelJSWorkbook as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(wb).toBeDefined();
        expect(wb.addWorksheet).toBeDefined();
    });

    it('empty solicitud exports without error', async () => {
        const doc = createEmptySolicitud('producto');
        await expect(exportSolicitudExcel(doc)).resolves.toBeUndefined();
    });

    it('fallback name used when no solicitud number', async () => {
        const doc = createEmptySolicitud('producto');
        doc.header.solicitudNumber = '';
        doc.producto = { codigo: '', descripcion: '', cliente: '' };
        await exportSolicitudExcel(doc);

        const [, filename] = (downloadExcelJSWorkbook as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(filename).toContain('Solicitud');
        expect(filename).toMatch(/\.xlsx$/);
    });
});
