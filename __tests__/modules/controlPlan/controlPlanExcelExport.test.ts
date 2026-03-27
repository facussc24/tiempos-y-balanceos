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
        componentMaterial: '',
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
        controlProcedure: '',
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

/** Get AOA data from last export call */
function getAoaData(): any[][] {
    return mockAoaToSheet.mock.calls[0][0];
}

/** Get all cell values as flat array of strings */
function getFlatValues(): string[] {
    return getAoaData().flat().map((c: any) => typeof c === 'object' ? c.v : c);
}

/** Get worksheet object (for checking !cols, !rows, !merges) */
function getWorksheet(): any {
    return mockAoaToSheet.mock.results[0].value;
}

// Import after mocks
import { exportControlPlan } from '../../../modules/controlPlan/controlPlanExcelExport';

describe('exportControlPlan', () => {
    // ── Basic export flow ──

    it('creates workbook and triggers download', () => {
        exportControlPlan(makeDoc());

        expect(mockBookNew).toHaveBeenCalled();
        expect(mockAoaToSheet).toHaveBeenCalled();
        expect(mockBookAppendSheet).toHaveBeenCalled();
        expect(mockWrite).toHaveBeenCalled();
        expect(clickedAnchors.length).toBe(1);
    });

    it('generates filename with partName', () => {
        exportControlPlan(makeDoc({ header: makeHeader({ partName: 'Mi Pieza' }) }));
        expect(clickedAnchors[0].download).toContain('Plan de Control - Mi Pieza');
        expect(clickedAnchors[0].download).toMatch(/\.xlsx$/);
    });

    it('uses "Documento" as fallback when partName and partNumber are empty', () => {
        exportControlPlan(makeDoc({ header: makeHeader({ partName: '', partNumber: '' }) }));
        expect(clickedAnchors[0].download).toContain('Plan de Control - Documento');
    });

    // ── Title and form reference ──

    it('row 0 is title "PLAN DE CONTROL"', () => {
        exportControlPlan(makeDoc());
        expect(getAoaData()[0][0].v).toBe('PLAN DE CONTROL');
    });

    it('row 1 contains form reference I-AC-005.2', () => {
        exportControlPlan(makeDoc());
        const row1Values = getAoaData()[1].map((c: any) => typeof c === 'object' ? c.v : c);
        expect(row1Values.some((v: string) => v.includes('I-AC-005.2'))).toBe(true);
    });

    // ── Phase checkboxes ──

    it('row 1 contains phase checkboxes with production checked', () => {
        exportControlPlan(makeDoc({ header: makeHeader({ phase: 'production' }) }));
        const row1Values = getAoaData()[1].map((c: any) => typeof c === 'object' ? c.v : c);
        const phaseCell = row1Values.find((v: string) => v.includes('☒'));
        expect(phaseCell).toBeDefined();
        expect(phaseCell).toContain('☒ Producción');
        expect(phaseCell).toContain('☐ Pre-Lanzamiento');
    });

    it('checks correct phase when phase is preLaunch', () => {
        exportControlPlan(makeDoc({ header: makeHeader({ phase: 'preLaunch' }) }));
        const row1Values = getAoaData()[1].map((c: any) => typeof c === 'object' ? c.v : c);
        const phaseCell = row1Values.find((v: string) => v.includes('☒'));
        expect(phaseCell).toContain('☒ Pre-Lanzamiento');
        expect(phaseCell).toContain('☐ Producción');
    });

    // ── Metadata content ──

    it('includes all metadata labels in header rows', () => {
        exportControlPlan(makeDoc());
        const values = getFlatValues();
        const expectedLabels = [
            'Nro. Plan de Control', 'Nro. Pieza', 'Fecha',
            'Pieza', 'Nivel de Cambio', 'Revision',
            'Organizacion / Planta', 'Proveedor', 'Cod. Proveedor',
            'Contacto / Telefono', 'Cliente', 'Responsable',
            'Equipo', 'AMFE Vinculado',
            'Aprob. Planta', 'Aprob. Cliente/Fecha',
        ];
        for (const label of expectedLabels) {
            expect(values).toContain(label);
        }
    });

    it('includes header values: organization and client', () => {
        exportControlPlan(makeDoc({ header: makeHeader({ organization: 'BARACK', client: 'VW' }) }));
        const values = getFlatValues();
        expect(values).toContain('BARACK');
        expect(values).toContain('VW');
    });

    it('includes all header field values', () => {
        const header = makeHeader({
            controlPlanNumber: 'CP-999',
            partNumber: 'PN-555',
            date: '2026-01-15',
            partName: 'Soporte Motor',
            revision: 'B',
            organization: 'BARACK',
            supplier: 'Proveedor X',
            supplierCode: 'PRV-01',
            keyContactPhone: '011-5555',
            client: 'Toyota',
            responsible: 'Maria',
            coreTeam: 'Equipo A',
            linkedAmfeProject: 'AMFE-001',
            otherApproval: 'Ing. Calidad',
            approvedBy: 'Director',
            customerApproval: 'Toyota Eng. / Toyota QA',
        });
        exportControlPlan(makeDoc({ header }));
        const values = getFlatValues();
        expect(values).toContain('CP-999');
        expect(values).toContain('PN-555');
        expect(values).toContain('Soporte Motor');
        expect(values).toContain('Proveedor X');
        expect(values).toContain('AMFE-001');
        expect(values).toContain('Toyota Eng. / Toyota QA');
    });

    // ── Metadata layout ──

    it('left label merges 3 columns (0-2) for wide labels', () => {
        exportControlPlan(makeDoc());
        const aoaData = getAoaData();
        // Row 2 = first metadata row. Label at col 0, empty at 1 and 2 (merged)
        expect(aoaData[2][0].v).toBe('Nro. Plan de Control');
        expect(aoaData[2][0].s.fill?.fgColor?.rgb).toBe('F2F2F2');
        expect(aoaData[2][1].v).toBe(''); // merged cell
        expect(aoaData[2][2].v).toBe(''); // merged cell
        expect(aoaData[2][1].s.fill?.fgColor?.rgb).toBe('F2F2F2'); // same style
    });

    it('left value starts at col 3 (after 3-col label merge)', () => {
        exportControlPlan(makeDoc({ header: makeHeader({ controlPlanNumber: 'CP-001' }) }));
        const aoaData = getAoaData();
        // Value starts at col 3 (META_PAIRS[0].vStart = 3)
        expect(aoaData[2][3].v).toBe('CP-001');
        expect(aoaData[2][3].s.border).toBeDefined();
    });

    it('all metadata cells have borders (no bare {} styles)', () => {
        exportControlPlan(makeDoc());
        const aoaData = getAoaData();
        // Check rows 2-7 (6 metadata rows) — every cell should have border
        for (let r = 2; r <= 7; r++) {
            for (let c = 0; c < 15; c++) {
                const cell = aoaData[r][c];
                expect(cell.s?.border, `Row ${r} Col ${c} missing border`).toBeDefined();
            }
        }
    });

    it('has 6 metadata rows (compact layout with all approvals in 1 row)', () => {
        exportControlPlan(makeDoc());
        const aoaData = getAoaData();
        let metaCount = 0;
        for (let r = 2; r < aoaData.length; r++) {
            if (aoaData[r][0]?.s?.fill?.fgColor?.rgb === 'F2F2F2') metaCount++;
            else break;
        }
        expect(metaCount).toBe(6);
    });

    // ── Row heights ──

    it('sets explicit row heights on worksheet', () => {
        exportControlPlan(makeDoc());
        const ws = getWorksheet();
        expect(ws['!rows']).toBeDefined();
        expect(ws['!rows'][0].hpt).toBe(30);  // Title
        expect(ws['!rows'][1].hpt).toBe(18);  // Form/phase
        expect(ws['!rows'][2].hpt).toBe(18);  // First metadata row
    });

    // ── Column widths ──

    it('sets dedicated column widths', () => {
        exportControlPlan(makeDoc());
        const ws = getWorksheet();
        expect(ws['!cols']).toBeDefined();
        expect(ws['!cols'].length).toBe(15);
        expect(ws['!cols'][0].wch).toBe(12);
    });

    // ── Column group headers ──

    it('includes column group headers', () => {
        exportControlPlan(makeDoc());
        const values = getFlatValues();
        for (const group of CP_COLUMN_GROUPS) {
            expect(values).toContain(group.label);
        }
    });

    // ── Column headers ──

    it('includes column headers for all CP columns (excluding controlProcedure)', () => {
        exportControlPlan(makeDoc());
        const values = getFlatValues();
        for (const col of CP_COLUMNS.filter(c => c.key !== 'controlProcedure')) {
            expect(values).toContain(col.label);
        }
        // controlProcedure (IT column) must NOT appear in export
        expect(values).not.toContain('Plan Reacción ante Descontrol');
    });

    // ── Data rows ──

    it('includes data rows for each item (different processStepNumbers)', () => {
        exportControlPlan(makeDoc({
            items: [
                makeItem({ id: 'i1', processStepNumber: '10', processDescription: 'Soldadura' }),
                makeItem({ id: 'i2', processStepNumber: '20', processDescription: 'Pintura' }),
            ],
        }));
        const values = getFlatValues();
        expect(values).toContain('Soldadura');
        expect(values).toContain('Pintura');
    });

    it('handles empty items array', () => {
        exportControlPlan(makeDoc({ items: [] }));
        expect(mockBookNew).toHaveBeenCalled();
        expect(clickedAnchors.length).toBe(1);
    });

    it('CC badge gets special red styling', () => {
        exportControlPlan(makeDoc({ items: [makeItem({ specialCharClass: 'CC' })] }));
        const aoaData = getAoaData();
        const dataRows = aoaData.slice(-1);
        const ccColIdx = CP_COLUMNS.findIndex(c => c.key === 'specialCharClass');
        const ccCell = dataRows[0][ccColIdx];
        expect(ccCell.s.fill?.fgColor?.rgb).toBe('FFC7CE');
        expect(ccCell.s.font?.color?.rgb).toBe('9C0006');
    });

    it('SC badge gets special amber styling', () => {
        exportControlPlan(makeDoc({ items: [makeItem({ specialCharClass: 'SC' })] }));
        const aoaData = getAoaData();
        const dataRows = aoaData.slice(-1);
        const ccColIdx = CP_COLUMNS.findIndex(c => c.key === 'specialCharClass');
        const scCell = dataRows[0][ccColIdx];
        expect(scCell.s.fill?.fgColor?.rgb).toBe('FFEB9C');
    });

    // ── Vertical merging for process groups ──

    it('merges cols 0-2 for items with same processStepNumber', () => {
        exportControlPlan(makeDoc({
            items: [
                makeItem({ id: 'i1', processStepNumber: '10', processDescription: 'Soldadura', productCharacteristic: 'Penetracion' }),
                makeItem({ id: 'i2', processStepNumber: '10', processDescription: 'Soldadura', productCharacteristic: 'Longitud cordon' }),
                makeItem({ id: 'i3', processStepNumber: '10', processDescription: 'Soldadura', productCharacteristic: 'Porosidad' }),
            ],
        }));
        const ws = getWorksheet();
        const merges: any[] = ws['!merges'];
        // Should have data merges for cols 0, 1, 2 spanning 3 rows
        const dataMerges = merges.filter((m: any) =>
            m.s.c <= 2 && m.e.r - m.s.r === 2 // spans 3 rows
        );
        expect(dataMerges.length).toBe(3); // one per col 0, 1, 2
    });

    it('clears duplicate text in follower rows of merged groups', () => {
        exportControlPlan(makeDoc({
            items: [
                makeItem({ id: 'i1', processStepNumber: '10', processDescription: 'Soldadura', productCharacteristic: 'Penetracion' }),
                makeItem({ id: 'i2', processStepNumber: '10', processDescription: 'Soldadura', productCharacteristic: 'Longitud' }),
            ],
        }));
        const aoaData = getAoaData();
        const dataStart = aoaData.length - 2; // 2 data rows
        // Leader row keeps text
        expect(aoaData[dataStart][0].v).toBe('10');
        expect(aoaData[dataStart][1].v).toBe('Soldadura');
        // Follower row cleared
        expect(aoaData[dataStart + 1][0].v).toBe('');
        expect(aoaData[dataStart + 1][1].v).toBe('');
        // But non-merged cols still have their data
        const prodIdx = CP_COLUMNS.findIndex(c => c.key === 'productCharacteristic');
        expect(aoaData[dataStart][prodIdx].v).toBe('Penetracion');
        expect(aoaData[dataStart + 1][prodIdx].v).toBe('Longitud');
    });

    it('does NOT merge items with different processStepNumbers', () => {
        exportControlPlan(makeDoc({
            items: [
                makeItem({ id: 'i1', processStepNumber: '10', processDescription: 'Soldadura' }),
                makeItem({ id: 'i2', processStepNumber: '20', processDescription: 'Pintura' }),
            ],
        }));
        const ws = getWorksheet();
        const merges: any[] = ws['!merges'];
        // No data merges (header merges exist but data col merges should not)
        const dataMerges = merges.filter((m: any) => {
            const isDataRow = m.s.r >= (getAoaData().length - 2);
            return isDataRow && m.s.c <= 2;
        });
        expect(dataMerges.length).toBe(0);
    });

    it('does NOT merge items with empty processStepNumber', () => {
        exportControlPlan(makeDoc({
            items: [
                makeItem({ id: 'i1', processStepNumber: '', processDescription: 'A' }),
                makeItem({ id: 'i2', processStepNumber: '', processDescription: 'B' }),
            ],
        }));
        const ws = getWorksheet();
        const merges: any[] = ws['!merges'];
        const dataMerges = merges.filter((m: any) => {
            const isDataRow = m.s.r >= (getAoaData().length - 2);
            return isDataRow && m.s.c <= 2;
        });
        expect(dataMerges.length).toBe(0);
    });

    // ── Sanitization ──

    it('sanitizes cell values against formula injection in data rows', () => {
        exportControlPlan(makeDoc({
            items: [makeItem({ processDescription: '=HYPERLINK("http://evil.com")' })],
        }));
        const values = getFlatValues();
        expect(values).toContain("'=HYPERLINK(\"http://evil.com\")");
        expect(values).not.toContain('=HYPERLINK("http://evil.com")');
    });

    it('sanitizes header info values against formula injection', () => {
        exportControlPlan(makeDoc({ header: makeHeader({ organization: '=CMD("calc")' }) }));
        const values = getFlatValues();
        expect(values).toContain("'=CMD(\"calc\")");
    });

    // ── Download cleanup ──

    it('creates blob and cleans up after download', () => {
        vi.useFakeTimers();
        exportControlPlan(makeDoc());

        expect(mockCreateObjectURL).toHaveBeenCalled();
        expect(document.body.appendChild).toHaveBeenCalled();
        expect(document.body.removeChild).toHaveBeenCalled();
        expect(mockRevokeObjectURL).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1500);
        expect(mockRevokeObjectURL).toHaveBeenCalled();
        vi.useRealTimers();
    });
});
