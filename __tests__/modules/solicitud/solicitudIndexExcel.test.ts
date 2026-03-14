import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockCells: Record<string, any> = {};

/** Shared worksheet mock — reset in beforeEach */
const mockWorksheet: Record<string, any> = {
    getCell: vi.fn((r: number, c: number) => {
        const key = `${r},${c}`;
        if (!mockCells[key]) {
            mockCells[key] = {
                value: null,
                font: {},
                fill: {},
                alignment: {},
                border: {},
            };
        }
        return mockCells[key];
    }),
    mergeCells: vi.fn(),
    addImage: vi.fn(),
    getRow: vi.fn(() => ({ height: 20 })),
    columns: [] as any[],
    pageSetup: {} as any,
    autoFilter: null as any,
    headerFooter: null as any,
};

// ExcelJS mock — class defined inside factory to avoid hoisting issues.
vi.mock('exceljs', () => {
    class MockWorkbook {
        creator = '';
        created: Date | null = null;
        addWorksheet = vi.fn(() => mockWorksheet);
        addImage = vi.fn(() => 1);
        xlsx = { writeBuffer: vi.fn(async () => new ArrayBuffer(100)) };
    }
    return { default: { Workbook: MockWorkbook } };
});

vi.mock('../../../src/assets/ppe/ppeBase64', () => ({
    getLogoBase64: vi.fn().mockResolvedValue('data:image/png;base64,TESTLOGO'),
}));

vi.mock('../../../utils/sanitizeCellValue', () => ({
    sanitizeCellValue: vi.fn((v: any) => (v == null ? '' : String(v))),
}));

vi.mock('../../../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockListSolicitudes = vi.fn();
const mockLoadSolicitud = vi.fn();
vi.mock('../../../utils/repositories/solicitudRepository', () => ({
    listSolicitudes: (...args: any[]) => mockListSolicitudes(...args),
    loadSolicitud: (...args: any[]) => mockLoadSolicitud(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
    formatDateForIndex,
    buildIndexWorkbook,
    updateSolicitudIndex,
} from '../../../modules/solicitud/solicitudIndexExcel';
import type { SolicitudListItem } from '../../../modules/solicitud/solicitudTypes';
import { logger } from '../../../utils/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeListItem(overrides: Partial<SolicitudListItem> = {}): SolicitudListItem {
    return {
        id: 'sol-001',
        solicitud_number: 'SGC-001',
        tipo: 'producto',
        codigo: 'ABC-123',
        descripcion: 'Test producto',
        solicitante: 'Juan',
        area_departamento: 'Ingenieria',
        status: 'borrador',
        fecha_solicitud: '2026-03-01',
        updated_at: '2026-03-01T10:30:00',
        server_folder_path: 'Y:\\Ingenieria\\ABC-123',
        attachment_count: 0,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    // Clear cell cache
    for (const key of Object.keys(mockCells)) {
        delete mockCells[key];
    }
    mockWorksheet.columns = [];
    mockWorksheet.pageSetup = {} as any;
    mockWorksheet.autoFilter = null;
    mockWorksheet.headerFooter = null;
});

// ─────────────────────────────────────────────────────────────────────────────
// formatDateForIndex
// ─────────────────────────────────────────────────────────────────────────────

describe('formatDateForIndex', () => {
    it('returns empty string for empty input', () => {
        expect(formatDateForIndex('')).toBe('');
    });

    it('formats an ISO date-only string to DD/MM/YYYY', () => {
        expect(formatDateForIndex('2026-03-01')).toBe('01/03/2026');
    });

    it('formats an ISO datetime string to DD/MM/YYYY HH:MM', () => {
        expect(formatDateForIndex('2026-03-01T10:30:00')).toBe('01/03/2026 10:30');
    });

    it('handles SQLite datetime format with space separator', () => {
        expect(formatDateForIndex('2026-03-01 14:45:20')).toBe('01/03/2026 14:45');
    });

    it('returns the original string if the date part does not have 3 dash-separated parts', () => {
        // Only 2 parts — can't form DD/MM/YYYY
        expect(formatDateForIndex('invalid-date')).toBe('invalid-date');
        // Single token
        expect(formatDateForIndex('nope')).toBe('nope');
    });

    it('handles datetime with only hours (no minutes)', () => {
        // timePart = "10", so mm defaults to "00"
        expect(formatDateForIndex('2026-03-01T10')).toBe('01/03/2026 10:00');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildIndexWorkbook
// ─────────────────────────────────────────────────────────────────────────────

describe('buildIndexWorkbook', () => {
    it('creates a workbook with creator and creation date set', async () => {
        const wb = await buildIndexWorkbook([], 'data:image/png;base64,ABC');
        expect(wb.creator).toBe('Barack Mercosul');
        expect(wb.created).toBeInstanceOf(Date);
    });

    it('adds a worksheet named Indice', async () => {
        const wb = await buildIndexWorkbook([], '');
        expect(wb.addWorksheet).toHaveBeenCalledWith('Indice', expect.any(Object));
    });

    it('sets column widths on the worksheet', async () => {
        await buildIndexWorkbook([], '');
        // 1 blank offset + 11 data columns = 12 entries
        expect(mockWorksheet.columns.length).toBe(12);
        // First column is the blank offset (width 2)
        expect(mockWorksheet.columns[0]).toEqual({ width: 2 });
    });

    it('adds a logo image when logoBase64 is provided', async () => {
        const wb = await buildIndexWorkbook([], 'data:image/png;base64,TESTLOGO');
        expect(wb.addImage).toHaveBeenCalledWith(
            expect.objectContaining({
                base64: 'TESTLOGO',
                extension: 'png',
            }),
        );
        expect(mockWorksheet.addImage).toHaveBeenCalled();
    });

    it('falls back to text header when logoBase64 is empty', async () => {
        const wb = await buildIndexWorkbook([], '');
        // addImage on the workbook should NOT be called when logo is empty
        expect(wb.addImage).not.toHaveBeenCalled();
        // Verify a cell at the logo position (row 2, col B=2) has the fallback text
        const logoCell = mockCells['2,2'];
        expect(logoCell).toBeDefined();
        expect(logoCell.value).toBe('BARACK MERCOSUL');
    });

    it('writes data rows with correct values for each item', async () => {
        const items = [makeListItem({ status: 'aprobada', tipo: 'producto' })];
        await buildIndexWorkbook(items, '');

        // Data starts at row 6 (header rows 2-3, separator 4, column headers 5, data 6)
        // Check that getCell was called for data rows
        const calls = mockWorksheet.getCell.mock.calls;
        const dataRowCalls = calls.filter(([r]: [number]) => r >= 6);
        expect(dataRowCalls.length).toBeGreaterThan(0);
    });

    it('writes the footer with the correct item count', async () => {
        const items = [makeListItem(), makeListItem({ id: 'sol-002', solicitud_number: 'SGC-002' })];
        await buildIndexWorkbook(items, '');

        // Check that mergeCells was called for the footer
        expect(mockWorksheet.mergeCells).toHaveBeenCalled();

        // Footer should contain "Total: 2 solicitud(es)"
        const allCells = Object.values(mockCells);
        const footerCell = allCells.find(
            (c: any) => typeof c.value === 'string' && c.value.includes('Total: 2'),
        );
        expect(footerCell).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateSolicitudIndex — browser download path
// ─────────────────────────────────────────────────────────────────────────────

describe('updateSolicitudIndex', () => {
    // Mock browser download APIs
    let mockCreateObjectURL: ReturnType<typeof vi.fn>;
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
    let mockAppendChild: ReturnType<typeof vi.fn>;
    let mockRemoveChild: ReturnType<typeof vi.fn>;
    let mockClick: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
        mockRevokeObjectURL = vi.fn();
        mockClick = vi.fn();
        mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el) as any;
        mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el) as any;

        // Mock URL methods
        vi.stubGlobal('URL', {
            createObjectURL: mockCreateObjectURL,
            revokeObjectURL: mockRevokeObjectURL,
        });

        // Spy on anchor click
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click') as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clickSpy.mockImplementation(() => { (mockClick as any)(); });

        mockListSolicitudes.mockResolvedValue([
            makeListItem({ id: 'sol-001', tipo: 'producto' }),
        ]);
        mockLoadSolicitud.mockResolvedValue({
            tipo: 'producto',
            producto: { cliente: 'VW' },
            insumo: null,
        });
    });

    it('returns true and triggers a browser download on success', async () => {
        const result = await updateSolicitudIndex('Y:\\Ingenieria\\Solicitudes');

        expect(result).toBe(true);
        expect(mockListSolicitudes).toHaveBeenCalled();
        expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        expect(mockClick).toHaveBeenCalled();
        expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        expect(logger.info).toHaveBeenCalledWith(
            'SolicitudIndex',
            expect.stringContaining('download triggered'),
            expect.any(Object),
        );
    });

    it('enriches producto items with cliente field (best-effort)', async () => {
        mockLoadSolicitud.mockResolvedValue({
            tipo: 'producto',
            producto: { cliente: 'Ford' },
            insumo: null,
        });

        const result = await updateSolicitudIndex('');
        expect(result).toBe(true);
        expect(mockLoadSolicitud).toHaveBeenCalledWith('sol-001');
    });

    it('handles enrichment failure gracefully and still succeeds', async () => {
        mockLoadSolicitud.mockRejectedValue(new Error('not found'));

        const result = await updateSolicitudIndex('');
        expect(result).toBe(true);
    });

    it('returns false and logs error on unexpected exception', async () => {
        mockListSolicitudes.mockRejectedValue(new Error('DB down'));

        const result = await updateSolicitudIndex('');
        expect(result).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(
            'SolicitudIndex',
            'Error generating index',
            expect.objectContaining({ error: 'DB down' }),
        );
    });

    it('continues without logo when getLogoBase64 throws', async () => {
        const { getLogoBase64 } = await import('../../../src/assets/ppe/ppeBase64');
        vi.mocked(getLogoBase64).mockRejectedValueOnce(new Error('no logo'));

        const result = await updateSolicitudIndex('');
        expect(result).toBe(true);
        expect(logger.warn).toHaveBeenCalledWith(
            'SolicitudIndex',
            expect.stringContaining('Could not load logo'),
        );
    });

    it('ignores basePath parameter (uses browser download instead of server write)', async () => {
        // Regardless of the basePath passed, the function should trigger a download
        // rather than writing to disk
        const result = await updateSolicitudIndex('Y:\\any\\path\\here');
        expect(result).toBe(true);
        expect(mockCreateObjectURL).toHaveBeenCalled();
    });
});
