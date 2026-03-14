import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import {
    HoDocument,
    HojaOperacion,
    EMPTY_HO_HEADER,
    DEFAULT_REACTION_PLAN_TEXT,
    createEmptyHoSheet,
} from '../../../modules/hojaOperaciones/hojaOperacionesTypes';
import { exportHoSheetExcel, exportAllHoSheetsExcel } from '../../../modules/hojaOperaciones/hoExcelExport';

// ============================================================================
// VALID 1×1 PIXEL PNG BASE64 (smallest valid PNG)
// ============================================================================
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRU5ErkJggg==';
const TINY_PNG_DATA_URI = `data:image/png;base64,${TINY_PNG_B64}`;

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('../../../src/assets/ppe/ppeBase64', () => ({
    getLogoBase64: vi.fn().mockResolvedValue(`data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRU5ErkJggg==`),
    getPpeBase64Map: vi.fn().mockResolvedValue({
        anteojos: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRU5ErkJggg==`,
        guantes: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRU5ErkJggg==`,
        zapatos: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRU5ErkJggg==`,
        proteccionAuditiva: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRU5ErkJggg==`,
        delantal: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRU5ErkJggg==`,
        respirador: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRU5ErkJggg==`,
    }),
}));

vi.mock('../../../utils/sanitizeCellValue', () => ({
    sanitizeCellValue: (v: any) => (v == null ? '' : String(v)),
}));

vi.mock('../../../utils/filenameSanitization', () => ({
    sanitizeFilename: (v: string) => v,
}));

vi.mock('../../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Shared state for buffer capture
let lastAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };
let capturedPart: any = null;

beforeEach(() => {
    vi.clearAllMocks();
    capturedPart = null;

    lastAnchor = { href: '', download: '', click: vi.fn() };

    vi.spyOn(document, 'createElement').mockReturnValue(lastAnchor as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();

    // Capture the raw buffer/part that ExcelJS sends to Blob
    globalThis.Blob = vi.fn().mockImplementation(function(this: any, parts: any[], opts: any) {
        if (parts && parts.length > 0) {
            capturedPart = parts[0];
        }
        return { size: 100, type: opts?.type || '' };
    }) as any;
});

// ============================================================================
// HELPERS
// ============================================================================

function makeSheet(overrides: Partial<HojaOperacion> = {}): HojaOperacion {
    const base = createEmptyHoSheet('op-1', '10', 'Soldadura MIG');
    return { ...base, ...overrides };
}

function makeDoc(sheets?: HojaOperacion[]): HoDocument {
    return {
        header: { ...EMPTY_HO_HEADER, organization: 'Barack Mercosul', client: 'VW' },
        sheets: sheets || [makeSheet()],
    };
}

/** Export a single sheet and parse the generated workbook for assertions */
async function buildAndCapture(sheet: HojaOperacion, doc: HoDocument): Promise<ExcelJS.Workbook> {
    capturedPart = null;
    await exportHoSheetExcel(sheet, doc);
    if (!capturedPart) throw new Error('No buffer captured from export');
    const wb = new ExcelJS.Workbook();
    // ExcelJS writeBuffer() returns a Node.js Buffer in jsdom environment.
    // wb.xlsx.load() accepts Buffer directly.
    await wb.xlsx.load(capturedPart);
    return wb;
}

/** Export all sheets and parse the generated workbook for assertions */
async function buildAndCaptureAll(doc: HoDocument): Promise<ExcelJS.Workbook> {
    capturedPart = null;
    await exportAllHoSheetsExcel(doc);
    if (!capturedPart) throw new Error('No buffer captured from export');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(capturedPart);
    return wb;
}

/** Scan worksheet for a cell value (exact or substring match) */
function findCellValue(ws: ExcelJS.Worksheet, target: string | number, maxRow = 60): boolean {
    for (let r = 1; r <= maxRow; r++) {
        for (let c = 1; c <= 10; c++) {
            const val = ws.getCell(r, c).value;
            if (val === target) return true;
            if (typeof target === 'string' && typeof val === 'string' && val.includes(target)) return true;
        }
    }
    return false;
}

// ============================================================================
// exportHoSheetExcel — Basic functionality
// ============================================================================

describe('exportHoSheetExcel', () => {
    it('creates a downloadable Excel file', async () => {
        const sheet = makeSheet();
        const doc = makeDoc([sheet]);

        await exportHoSheetExcel(sheet, doc);

        expect(lastAnchor.click).toHaveBeenCalledTimes(1);
        expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1);
    }, 15000);

    it('generates filename with operation name', async () => {
        const sheet = makeSheet({ operationName: 'Corte Laser' });
        const doc = makeDoc([sheet]);

        await exportHoSheetExcel(sheet, doc);

        expect(lastAnchor.download).toContain('Hoja de Operaciones');
        expect(lastAnchor.download).toContain('Corte Laser');
        expect(lastAnchor.download).toContain('.xlsx');
    }, 15000);

    it('creates one worksheet named HO + operation number', async () => {
        const sheet = makeSheet({ operationNumber: '20' });
        const doc = makeDoc([sheet]);

        const wb = await buildAndCapture(sheet, doc);
        expect(wb.worksheets.length).toBe(1);
        expect(wb.worksheets[0].name).toContain('HO 20');
    }, 15000);

    it('includes HOJA DE OPERACIONES title', async () => {
        const wb = await buildAndCapture(makeSheet(), makeDoc());
        expect(findCellValue(wb.worksheets[0], 'HOJA DE OPERACIONES')).toBe(true);
    }, 15000);

    it('includes HO number', async () => {
        const sheet = makeSheet({ hoNumber: 'HO-10' });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(findCellValue(wb.worksheets[0], 'HO-10')).toBe(true);
    }, 15000);

    it('includes operation name', async () => {
        const sheet = makeSheet({ operationName: 'Ensamble Motor' });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(findCellValue(wb.worksheets[0], 'Ensamble Motor')).toBe(true);
    }, 15000);

    it('includes Realizó and Aprobó metadata', async () => {
        const sheet = makeSheet({ preparedBy: 'Juan P.', approvedBy: 'María G.' });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(findCellValue(wb.worksheets[0], 'Juan P.')).toBe(true);
        expect(findCellValue(wb.worksheets[0], 'María G.')).toBe(true);
    }, 15000);

    it('includes client name', async () => {
        const doc = makeDoc();
        doc.header.client = 'Toyota';
        const wb = await buildAndCapture(doc.sheets[0], doc);
        expect(findCellValue(wb.worksheets[0], 'Toyota')).toBe(true);
    }, 15000);

    it('renders steps', async () => {
        const sheet = makeSheet({
            steps: [
                { id: 's1', stepNumber: 1, description: 'Colocar pieza', isKeyPoint: false, keyPointReason: '' },
                { id: 's2', stepNumber: 2, description: 'Verificar torque', isKeyPoint: true, keyPointReason: 'Seguridad critica' },
            ],
        });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        const ws = wb.worksheets[0];
        expect(findCellValue(ws, 'Colocar pieza')).toBe(true);
        expect(findCellValue(ws, 'Verificar torque')).toBe(true);
        expect(findCellValue(ws, 'Seguridad critica')).toBe(true);
    }, 15000);

    it('marks key points with SI', async () => {
        const sheet = makeSheet({
            steps: [{ id: 's1', stepNumber: 1, description: 'Key', isKeyPoint: true, keyPointReason: 'R' }],
        });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(findCellValue(wb.worksheets[0], 'SI')).toBe(true);
    }, 15000);

    it('renders quality checks', async () => {
        const sheet = makeSheet({
            qualityChecks: [{
                id: 'qc1', characteristic: 'Torque M8', specification: '25 ± 3 Nm',
                evaluationTechnique: 'Torquímetro', frequency: '100%',
                controlMethod: 'Instrumento', reactionAction: 'Segregar',
                reactionContact: 'OP', specialCharSymbol: 'CC', registro: 'Planilla T-101',
            }],
        });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        const ws = wb.worksheets[0];
        expect(findCellValue(ws, 'Torque M8')).toBe(true);
        expect(findCellValue(ws, '25 ± 3 Nm')).toBe(true);
        expect(findCellValue(ws, 'CC')).toBe(true);
        expect(findCellValue(ws, 'Planilla T-101')).toBe(true);
    }, 15000);

    it('renders reaction plan', async () => {
        const sheet = makeSheet({
            reactionPlanText: 'Detener producción y segregar',
            reactionContact: 'Supervisor de línea',
        });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        const ws = wb.worksheets[0];
        expect(findCellValue(ws, 'Detener producción')).toBe(true);
        expect(findCellValue(ws, 'Supervisor de línea')).toBe(true);
    }, 15000);

    it('includes PPE labels', async () => {
        const sheet = makeSheet({ safetyElements: ['anteojos', 'guantes'] });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        const ws = wb.worksheets[0];
        expect(findCellValue(ws, 'Anteojos')).toBe(true);
        expect(findCellValue(ws, 'Guantes')).toBe(true);
    }, 15000);

    it('shows Ninguno when no PPE', async () => {
        const sheet = makeSheet({ safetyElements: [] });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(findCellValue(wb.worksheets[0], 'Ninguno')).toBe(true);
    }, 15000);

    it('includes all section headers', async () => {
        const wb = await buildAndCapture(makeSheet(), makeDoc());
        const ws = wb.worksheets[0];
        expect(findCellValue(ws, 'ELEMENTOS DE SEGURIDAD')).toBe(true);
        expect(findCellValue(ws, 'DESCRIPCIÓN DE LA OPERACIÓN')).toBe(true);
        expect(findCellValue(ws, 'CICLO DE CONTROL')).toBe(true);
        expect(findCellValue(ws, 'PLAN DE REACCIÓN ANTE NO CONFORME')).toBe(true);
    }, 15000);

    it('uses A4 landscape page setup', async () => {
        const wb = await buildAndCapture(makeSheet(), makeDoc());
        const ws = wb.worksheets[0];
        expect(ws.pageSetup.paperSize).toBe(9);
        expect(ws.pageSetup.orientation).toBe('landscape');
        expect(ws.pageSetup.fitToWidth).toBe(1);
    }, 15000);

    it('starts data at row 2, column B (offset)', async () => {
        const wb = await buildAndCapture(makeSheet(), makeDoc());
        const ws = wb.worksheets[0];
        // Row 1 should be empty
        for (let c = 1; c <= 10; c++) expect(ws.getCell(1, c).value).toBeFalsy();
        // Column A should be empty
        expect(ws.getCell(2, 1).value).toBeFalsy();
    }, 15000);

    it('hides gridlines', async () => {
        const wb = await buildAndCapture(makeSheet(), makeDoc());
        const ws = wb.worksheets[0];
        expect(ws.views.length).toBeGreaterThan(0);
        expect(ws.views[0].showGridLines).toBe(false);
    }, 15000);

    it('includes status badge (aprobado)', async () => {
        const sheet = makeSheet({ status: 'aprobado' });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(findCellValue(wb.worksheets[0], 'APROBADO')).toBe(true);
    }, 15000);

    it('includes status badge (borrador)', async () => {
        const sheet = makeSheet({ status: 'borrador' });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(findCellValue(wb.worksheets[0], 'BORRADOR')).toBe(true);
    }, 15000);

    it('includes status badge (pendienteRevision)', async () => {
        const sheet = makeSheet({ status: 'pendienteRevision' });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(findCellValue(wb.worksheets[0], 'PEND. REV.')).toBe(true);
    }, 15000);

    it('handles applicableParts', async () => {
        const doc = makeDoc();
        doc.header.applicableParts = 'P-001\nP-002';
        const wb = await buildAndCapture(doc.sheets[0], doc);
        expect(findCellValue(wb.worksheets[0], 'P-001')).toBe(true);
    }, 15000);

    it('includes visual aids section when aids exist', async () => {
        const sheet = makeSheet({
            visualAids: [{
                id: 'va1', imageData: TINY_PNG_DATA_URI,
                caption: 'Posición correcta', order: 0,
            }],
        });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        const ws = wb.worksheets[0];
        expect(findCellValue(ws, 'AYUDAS VISUALES')).toBe(true);
        expect(findCellValue(ws, 'Posición correcta')).toBe(true);
    }, 15000);

    it('excludes visual aids section when none', async () => {
        const sheet = makeSheet({ visualAids: [] });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(findCellValue(wb.worksheets[0], 'AYUDAS VISUALES')).toBe(false);
    }, 15000);

    it('includes page headers/footers', async () => {
        const sheet = makeSheet({ hoNumber: 'HO-10', revision: 'B' });
        const doc = makeDoc([sheet]);
        doc.header.organization = 'Barack Mercosul';

        const wb = await buildAndCapture(sheet, doc);
        const ws = wb.worksheets[0];
        expect(ws.headerFooter.oddHeader).toContain('Barack Mercosul');
        expect(ws.headerFooter.oddHeader).toContain('HOJA DE OPERACIONES');
        expect(ws.headerFooter.oddHeader).toContain('HO-10');
        expect(ws.headerFooter.oddFooter).toContain('Rev. B');
    }, 15000);
});

// ============================================================================
// exportAllHoSheetsExcel
// ============================================================================

describe('exportAllHoSheetsExcel', () => {
    it('creates one worksheet per sheet', async () => {
        const sheets = [
            makeSheet({ operationNumber: '10' }),
            makeSheet({ operationNumber: '20' }),
            makeSheet({ operationNumber: '30' }),
        ];
        const wb = await buildAndCaptureAll(makeDoc(sheets));
        expect(wb.worksheets.length).toBe(3);
        expect(wb.worksheets[0].name).toContain('HO 10');
        expect(wb.worksheets[1].name).toContain('HO 20');
        expect(wb.worksheets[2].name).toContain('HO 30');
    }, 30000);

    it('creates placeholder for empty doc', async () => {
        const doc: HoDocument = { header: { ...EMPTY_HO_HEADER }, sheets: [] };
        const wb = await buildAndCaptureAll(doc);
        expect(wb.worksheets.length).toBe(1);
        expect(wb.worksheets[0].name).toBe('Vacío');
    }, 15000);

    it('downloads file with correct naming', async () => {
        const doc = makeDoc([makeSheet()]);
        doc.header.partDescription = 'Panel Lateral';
        await exportAllHoSheetsExcel(doc);
        expect(lastAnchor.download).toContain('Hojas de Operaciones');
        expect(lastAnchor.download).toContain('Panel Lateral');
        expect(lastAnchor.download).toContain('.xlsx');
    }, 15000);
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge cases', () => {
    it('handles empty steps, QC, PPE, and visual aids', async () => {
        const sheet = makeSheet({ steps: [], qualityChecks: [], safetyElements: [], visualAids: [] });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(wb.worksheets.length).toBe(1);
    }, 15000);

    it('sheet name is max 31 chars', async () => {
        const sheet = makeSheet({ operationNumber: '999' });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(wb.worksheets[0].name.length).toBeLessThanOrEqual(31);
    }, 15000);

    it('handles special characters in text fields', async () => {
        const sheet = makeSheet({
            operationName: 'Test "quotes" & <angles>',
            steps: [{ id: 's1', stepNumber: 1, description: 'Dim < 10mm & > 5mm', isKeyPoint: false, keyPointReason: '' }],
        });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(wb.worksheets.length).toBe(1);
    }, 15000);

    it('sets workbook creator metadata', async () => {
        const doc = makeDoc([makeSheet()]);
        doc.header.organization = 'Barack Mercosul';
        const wb = await buildAndCapture(doc.sheets[0], doc);
        expect(wb.creator).toBe('Barack Mercosul');
    }, 15000);

    it('includes default reaction plan text', async () => {
        const sheet = makeSheet({ reactionPlanText: DEFAULT_REACTION_PLAN_TEXT });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        expect(findCellValue(wb.worksheets[0], 'DETENGA LA OPERACION')).toBe(true);
    }, 15000);

    it('CC has red fill, SC has amber fill', async () => {
        const sheet = makeSheet({
            qualityChecks: [
                {
                    id: 'qc1', characteristic: 'A', specification: 'B',
                    evaluationTechnique: 'C', frequency: 'D', controlMethod: 'E',
                    reactionAction: 'F', reactionContact: 'OP', specialCharSymbol: 'CC', registro: '',
                },
                {
                    id: 'qc2', characteristic: 'X', specification: 'Y',
                    evaluationTechnique: 'Z', frequency: 'W', controlMethod: 'V',
                    reactionAction: 'U', reactionContact: 'OP', specialCharSymbol: 'SC', registro: '',
                },
            ],
        });
        const wb = await buildAndCapture(sheet, makeDoc([sheet]));
        const ws = wb.worksheets[0];

        let ccFill: string | undefined;
        let scFill: string | undefined;
        for (let r = 1; r <= 50; r++) {
            for (let c = 1; c <= 10; c++) {
                const cell = ws.getCell(r, c);
                if (cell.value === 'CC') ccFill = (cell.fill as ExcelJS.FillPattern)?.fgColor?.argb;
                if (cell.value === 'SC') scFill = (cell.fill as ExcelJS.FillPattern)?.fgColor?.argb;
            }
        }
        expect(ccFill).toContain('DC2626');
        expect(scFill).toContain('F59E0B');
    }, 15000);
});
