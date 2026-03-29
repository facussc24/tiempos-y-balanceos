import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HeijunkaResult, HeijunkaSlot, ProductSummary } from '../../../modules/heijunka/heijunkaLogic';

// Mock XLSX — must come before import of SUT
const mockWrite = vi.fn().mockReturnValue(new ArrayBuffer(8));
const mockBookNew = vi.fn().mockReturnValue({});
const mockAoaToSheet = vi.fn().mockReturnValue({});
const mockBookAppendSheet = vi.fn();

vi.mock('xlsx-js-style', () => ({
    default: {
        utils: {
            book_new: () => mockBookNew(),
            aoa_to_sheet: (data: unknown) => mockAoaToSheet(data),
            book_append_sheet: (...args: unknown[]) => mockBookAppendSheet(...args),
        },
        write: (...args: unknown[]) => mockWrite(...args),
    },
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Inline re-implementation of sanitizeCellValue to avoid circular mock reference
function realSanitizeCellValue(value: string | number | undefined | null): string | number {
    if (value == null) return '';
    if (typeof value === 'number') return value;
    const s = String(value);
    if (s.length > 0 && '=@+-\t\r\n'.includes(s[0])) return "'" + s;
    return s;
}

const sanitizeSpy = vi.fn(realSanitizeCellValue);
vi.mock('../../../utils/sanitizeCellValue', () => ({
    sanitizeCellValue: (...args: [string | number | undefined | null]) => sanitizeSpy(...args),
}));

// Inline re-implementation of sanitizeFilename (simplified pass-through for testing)
function realSanitizeFilename(filename: string): string {
    if (!filename || filename.trim() === '') return 'unnamed_file';
    let clean = filename.trim();
    clean = clean.replace(/[/\\]/g, '_');
    clean = clean.replace(/[<>:"|?*\x00-\x1f]/g, '_');
    clean = clean.replace(/^[\s.]+|[\s.]+$/g, '');
    if (!clean) clean = 'unnamed_file';
    return clean;
}

const filenameSpy = vi.fn(realSanitizeFilename);
vi.mock('../../../utils/filenameSanitization', () => ({
    sanitizeFilename: (...args: [string]) => filenameSpy(...args),
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
        click: function (this: { href: string; download: string }) {
            clickedAnchors.push({ href: this.href, download: this.download });
        },
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as HTMLElement);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as HTMLElement);

    mockBookNew.mockClear();
    mockAoaToSheet.mockClear();
    mockBookAppendSheet.mockClear();
    mockWrite.mockClear();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
    sanitizeSpy.mockClear();
    filenameSpy.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

// --- Helpers ---

function makeProduct(overrides: Partial<ProductSummary> = {}): ProductSummary {
    return {
        productId: 'prod-1',
        productName: 'Producto A',
        color: '#7C3AED',
        totalDemand: 100,
        totalAssigned: 100,
        avgPerSlot: 4.2,
        ...overrides,
    };
}

function makeSlot(overrides: Partial<HeijunkaSlot> = {}): HeijunkaSlot {
    return {
        slotIndex: 0,
        startTime: '08:00',
        endTime: '08:20',
        assignments: [
            { productId: 'prod-1', productName: 'Producto A', quantity: 5, color: '#7C3AED' },
        ],
        totalUnits: 5,
        materialsToDeliver: [],
        ...overrides,
    };
}

function makeResult(overrides: Partial<HeijunkaResult> = {}): HeijunkaResult {
    return {
        totalSlots: 24,
        pitchMinutes: 20,
        slots: [makeSlot()],
        productSummaries: [makeProduct()],
        capacityAlerts: [],
        isFeasible: true,
        ...overrides,
    };
}

// Import SUT after mocks
import { exportHeijunkaPlanExcel } from '../../../modules/heijunka/heijunkaExport';

// =========================================================================
// P0-6: Browser-safe download (XLSX.write, not XLSX.writeFile)
// =========================================================================
describe('browser-safe download mechanism', () => {
    it('uses XLSX.write with type "array" instead of XLSX.writeFile', () => {
        exportHeijunkaPlanExcel(makeResult(), 'Test', 'Ruta A', '01/01/2026');

        expect(mockWrite).toHaveBeenCalledTimes(1);
        const [, options] = mockWrite.mock.calls[0];
        expect(options).toEqual({ bookType: 'xlsx', type: 'array' });
    });

    it('creates a Blob with the correct MIME type', () => {
        const blobSpy = vi.fn().mockImplementation(
            (parts: BlobPart[], opts?: BlobPropertyBag) => new Blob(parts, opts)
        );
        vi.stubGlobal('Blob', blobSpy);

        exportHeijunkaPlanExcel(makeResult(), 'Test', 'Ruta A', '01/01/2026');

        expect(blobSpy).toHaveBeenCalledTimes(1);
        const [, blobOpts] = blobSpy.mock.calls[0];
        expect(blobOpts.type).toBe(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
    });

    it('creates an anchor element, clicks it, and cleans up', () => {
        exportHeijunkaPlanExcel(makeResult(), 'Test', 'Ruta A', '01/01/2026');

        expect(mockCreateObjectURL).toHaveBeenCalled();
        expect(clickedAnchors.length).toBe(1);
        expect(clickedAnchors[0].href).toBe('blob:mock-url');
        expect(document.body.appendChild).toHaveBeenCalled();
        expect(document.body.removeChild).toHaveBeenCalled();
    });

    it('revokes the object URL after a delay', () => {
        vi.useFakeTimers();
        exportHeijunkaPlanExcel(makeResult(), 'Test', 'Ruta A', '01/01/2026');

        expect(mockRevokeObjectURL).not.toHaveBeenCalled();
        vi.advanceTimersByTime(2000);
        expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        vi.useRealTimers();
    });
});

// =========================================================================
// P1: Formula injection prevention (sanitizeCellValue)
// =========================================================================
describe('formula injection prevention', () => {
    it('sanitizes projectName in title rows', () => {
        exportHeijunkaPlanExcel(makeResult(), '=MALICIOUS', 'Ruta', '01/01/2026');

        // sanitizeCellValue should have been called with a string containing the projectName
        const calls = sanitizeSpy.mock.calls.map((c: unknown[]) => c[0]);
        const projectCalls = calls.filter(
            (v: unknown) => typeof v === 'string' && (v as string).includes('=MALICIOUS')
        );
        expect(projectCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('sanitizes routeName in data rows', () => {
        exportHeijunkaPlanExcel(makeResult(), 'Test', '+cmd|evil', '01/01/2026');

        const calls = sanitizeSpy.mock.calls.map((c: unknown[]) => c[0]);
        const routeCalls = calls.filter((v: unknown) => v === '+cmd|evil');
        expect(routeCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('sanitizes product names in header and summary sheets', () => {
        const result = makeResult({
            productSummaries: [
                makeProduct({ productName: '@INDIRECT(A1)' }),
            ],
        });

        exportHeijunkaPlanExcel(result, 'Test', 'Ruta', '01/01/2026');

        const calls = sanitizeSpy.mock.calls.map((c: unknown[]) => c[0]);
        const productCalls = calls.filter((v: unknown) => v === '@INDIRECT(A1)');
        // Once in header row (Sheet 1) + once in summary row (Sheet 2)
        expect(productCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('sanitizeCellValue is called for all user-provided strings', () => {
        const result = makeResult({
            productSummaries: [makeProduct({ productName: 'Producto X' })],
            slots: [makeSlot()],
        });

        exportHeijunkaPlanExcel(result, 'Mi Proyecto', 'Ruta Beta', '15/02/2026');

        // At minimum: projectName, date, routeName (per slot), productName (header + summary)
        expect(sanitizeSpy).toHaveBeenCalled();
        const callCount = sanitizeSpy.mock.calls.length;
        // projectName(1) + date(1) + routeName(1 per slot) + productName(header+summary=2) = 5 minimum
        expect(callCount).toBeGreaterThanOrEqual(5);
    });
});

// =========================================================================
// P2: Filename sanitization
// =========================================================================
describe('filename sanitization', () => {
    it('passes filename through sanitizeFilename', () => {
        exportHeijunkaPlanExcel(makeResult(), 'Test Project', 'Ruta', '01/01/2026');

        expect(filenameSpy).toHaveBeenCalledTimes(1);
        const [rawFilename] = filenameSpy.mock.calls[0];
        expect(rawFilename).toContain('Test Project');
        expect(rawFilename).toContain('Heijunka');
        expect(rawFilename).toMatch(/\.xlsx$/);
    });

    it('uses sanitized filename in anchor download attribute', () => {
        exportHeijunkaPlanExcel(makeResult(), 'Proyecto<>:Ilegal', 'Ruta', '01-01-2026');

        expect(clickedAnchors.length).toBe(1);
        // sanitizeFilename strips illegal chars, so the download name should be clean
        const downloadName = clickedAnchors[0].download;
        expect(downloadName).not.toContain('<');
        expect(downloadName).not.toContain('>');
        expect(downloadName).not.toContain(':');
    });
});

// =========================================================================
// Workbook structure
// =========================================================================
describe('workbook structure', () => {
    it('creates 3 sheets: Horario, Resumen, Instrucciones', () => {
        exportHeijunkaPlanExcel(makeResult(), 'Test', 'Ruta', '01/01/2026');

        expect(mockBookAppendSheet).toHaveBeenCalledTimes(3);
        const sheetNames = mockBookAppendSheet.mock.calls.map(
            (call: unknown[]) => call[2]
        );
        expect(sheetNames).toEqual([
            'Horario de Retiros',
            'Resumen Productos',
            'Instrucciones',
        ]);
    });

    it('includes product data rows matching the number of slots', () => {
        const slots = [
            makeSlot({ slotIndex: 0, startTime: '08:00', endTime: '08:20' }),
            makeSlot({ slotIndex: 1, startTime: '08:20', endTime: '08:40' }),
            makeSlot({ slotIndex: 2, startTime: '08:40', endTime: '09:00' }),
        ];
        const result = makeResult({ slots });

        exportHeijunkaPlanExcel(result, 'Test', 'Ruta', '01/01/2026');

        // First call to aoa_to_sheet is Sheet 1 (Horario)
        const aoaData = mockAoaToSheet.mock.calls[0][0];
        // Title(1) + Proyecto(1) + Fecha(1) + Pitch(1) + empty(1) + header(1) + 3 slots + total(1) = 10
        expect(aoaData.length).toBe(10);
    });

    it('includes product summary rows in second sheet', () => {
        const result = makeResult({
            productSummaries: [
                makeProduct({ productId: 'p1', productName: 'Alpha' }),
                makeProduct({ productId: 'p2', productName: 'Beta' }),
            ],
        });

        exportHeijunkaPlanExcel(result, 'Test', 'Ruta', '01/01/2026');

        // Second call to aoa_to_sheet is Sheet 2 (Resumen)
        const summaryData = mockAoaToSheet.mock.calls[1][0];
        // Title(1) + empty(1) + header(1) + 2 products = 5
        expect(summaryData.length).toBe(5);
    });

    it('handles empty result with no slots or products', () => {
        const result = makeResult({
            slots: [],
            productSummaries: [],
        });

        exportHeijunkaPlanExcel(result, 'Test', 'Ruta', '01/01/2026');

        expect(mockBookNew).toHaveBeenCalled();
        expect(clickedAnchors.length).toBe(1);
    });
});
