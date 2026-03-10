vi.mock('xlsx-js-style', () => {
    return {
        default: {
            utils: {
                book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
                book_append_sheet: vi.fn(),
                aoa_to_sheet: vi.fn(() => ({} as Record<string, unknown>)),
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
        // Header row is at index 11 (after 11 metadata rows: title, form#, 8 data rows, blank)
        const headerRow = rows[11] as { v: string }[];
        const headers = headerRow.map((c: { v: string }) => c.v);
        expect(headers).toContain('Disposición');
        expect(headers).toContain('Detalle');
        expect(headers).not.toContain('Retrabajo');
    });

    it('should have 15 columns in header row (C9-N1: +Línea)', () => {
        const doc = createEmptyPfdDocument();
        exportPfdExcel(doc);
        const calls = (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.calls;
        const rows = calls[0][0] as unknown[][];
        const headerRow = rows[11] as { v: string }[];
        expect(headerRow).toHaveLength(15);
        const headers = headerRow.map((c: { v: string }) => c.v);
        expect(headers).toContain('Línea');
    });

    it('should set freeze panes on header row (C4-E1)', () => {
        const doc = createEmptyPfdDocument();
        exportPfdExcel(doc);
        const calls = (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.calls;
        const ws = calls[0]?.[0] ? (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.results[0].value : {};
        // The worksheet should have !freeze set
        expect(ws['!freeze']).toEqual({ xSplit: 0, ySplit: 12, topLeftCell: 'A13' });
    });

    /** Helper: get all rows from the last aoa_to_sheet call */
    function getRows(): { v: string; s?: unknown }[][] {
        const calls = (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.calls;
        return calls[0][0] as { v: string; s?: unknown }[][];
    }

    /** Helper: get only data/separator rows (after header at index 11) */
    function getDataRows(): { v: string; s?: unknown }[][] {
        const allRows = getRows();
        // Row 11 is the header, data starts at 12
        return allRows.slice(12);
    }

    /** Helper: find all rows containing a specific text prefix in column 0 */
    function findRowsStartingWith(prefix: string): { v: string; s?: unknown }[][] {
        return getDataRows().filter(row => row[0]?.v && typeof row[0].v === 'string' && (row[0].v as string).startsWith(prefix));
    }

    describe('Flow separators (fork/join)', () => {
        it('should add INICIO FLUJO PARALELO separator when entering parallel zone', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), description: 'Recepción' },
                { ...createEmptyStep('OP 20'), branchId: 'A', branchLabel: 'Mecanizado', description: 'Tornear' },
                { ...createEmptyStep('OP 30'), branchId: 'B', branchLabel: 'Soldadura', description: 'Soldar' },
            ];
            exportPfdExcel(doc);
            const forkRows = findRowsStartingWith('INICIO');
            expect(forkRows).toHaveLength(1);
            expect(forkRows[0][0].v).toContain('INICIO FLUJO PARALELO');
            expect(forkRows[0][0].v).toContain('Mecanizado');
            expect(forkRows[0][0].v).toContain('Soldadura');
        });

        it('should add CONVERGENCIA separator when exiting parallel zone', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), description: 'Recepción' },
                { ...createEmptyStep('OP 20'), branchId: 'A', branchLabel: 'Mecanizado', description: 'Tornear' },
                { ...createEmptyStep('OP 30'), description: 'Ensamble' },
            ];
            exportPfdExcel(doc);
            const joinRows = findRowsStartingWith('CONVERGENCIA');
            expect(joinRows).toHaveLength(1);
            expect(joinRows[0][0].v).toContain('CONVERGENCIA');
            expect(joinRows[0][0].v).toContain('Retorno a flujo principal');
        });

        it('should NOT add separators when no parallel flow exists', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), description: 'Step 1' },
                { ...createEmptyStep('OP 20'), description: 'Step 2' },
            ];
            exportPfdExcel(doc);
            const forkRows = findRowsStartingWith('INICIO');
            const joinRows = findRowsStartingWith('CONVERGENCIA');
            expect(forkRows).toHaveLength(0);
            expect(joinRows).toHaveLength(0);
        });

        it('should handle multiple parallel zones', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), description: 'Step 1' },
                { ...createEmptyStep('OP 20'), branchId: 'A', branchLabel: 'Línea A', description: 'Branch A1' },
                { ...createEmptyStep('OP 30'), description: 'Step 3' },
                { ...createEmptyStep('OP 40'), branchId: 'C', branchLabel: 'Línea C', description: 'Branch C1' },
                { ...createEmptyStep('OP 50'), description: 'Step 5' },
            ];
            exportPfdExcel(doc);
            const forkRows = findRowsStartingWith('INICIO');
            const joinRows = findRowsStartingWith('CONVERGENCIA');
            expect(forkRows).toHaveLength(2);
            expect(joinRows).toHaveLength(2);
        });

        it('should handle parallel flow starting at first step', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), branchId: 'A', branchLabel: 'Línea A', description: 'Branch start' },
                { ...createEmptyStep('OP 20'), description: 'Main flow' },
            ];
            exportPfdExcel(doc);
            const forkRows = findRowsStartingWith('INICIO');
            expect(forkRows).toHaveLength(1);
        });

        it('should use branch ID as fallback label when branchLabel is empty', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), description: 'Main' },
                { ...createEmptyStep('OP 20'), branchId: 'A', branchLabel: '', description: 'Branch A' },
            ];
            exportPfdExcel(doc);
            const forkRows = findRowsStartingWith('INICIO');
            expect(forkRows[0][0].v).toContain('Linea A');
        });

        it('separator rows should have 15 cells (colCount)', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), description: 'Main' },
                { ...createEmptyStep('OP 20'), branchId: 'A', branchLabel: 'Mecanizado', description: 'Branch' },
                { ...createEmptyStep('OP 30'), description: 'End' },
            ];
            exportPfdExcel(doc);
            const forkRows = findRowsStartingWith('INICIO');
            const joinRows = findRowsStartingWith('CONVERGENCIA');
            expect(forkRows[0]).toHaveLength(15);
            expect(joinRows[0]).toHaveLength(15);
        });
    });

    describe('NG path annotations', () => {
        it('should add OK/NOK annotation after inspection with rework disposition', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), stepType: 'inspection', rejectDisposition: 'rework', reworkReturnStep: 'OP 05', description: 'Inspección' },
                { ...createEmptyStep('OP 20'), description: 'Next step' },
            ];
            exportPfdExcel(doc);
            const ngRows = findRowsStartingWith('OK:');
            expect(ngRows).toHaveLength(1);
            expect(ngRows[0][0].v).toContain('OK: OP 20');
            expect(ngRows[0][0].v).toContain('NOK: Retrabajo -> OP 05');
        });

        it('should add OK/NOK annotation after inspection with scrap disposition', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), stepType: 'inspection', rejectDisposition: 'scrap', scrapDescription: 'Fuera de tolerancia', description: 'Control' },
                { ...createEmptyStep('OP 20'), description: 'Next' },
            ];
            exportPfdExcel(doc);
            const ngRows = findRowsStartingWith('OK:');
            expect(ngRows).toHaveLength(1);
            expect(ngRows[0][0].v).toContain('NOK: Descarte');
            expect(ngRows[0][0].v).toContain('Fuera de tolerancia');
        });

        it('should add OK/NOK annotation after combined step with sort disposition', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), stepType: 'combined', rejectDisposition: 'sort', scrapDescription: 'Verificar diámetro', description: 'Op+Insp' },
                { ...createEmptyStep('OP 20'), description: 'Next' },
            ];
            exportPfdExcel(doc);
            const ngRows = findRowsStartingWith('OK:');
            expect(ngRows).toHaveLength(1);
            expect(ngRows[0][0].v).toContain('NOK: Seleccion');
        });

        it('should NOT add NG annotation when inspection is the last step', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), stepType: 'inspection', rejectDisposition: 'rework', reworkReturnStep: 'OP 05', description: 'Last inspection' },
            ];
            exportPfdExcel(doc);
            const ngRows = findRowsStartingWith('OK:');
            expect(ngRows).toHaveLength(0);
        });

        it('should NOT add NG annotation for non-inspection steps with disposition', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), stepType: 'operation', rejectDisposition: 'rework', reworkReturnStep: 'OP 05', description: 'Operation' },
                { ...createEmptyStep('OP 20'), description: 'Next' },
            ];
            exportPfdExcel(doc);
            const ngRows = findRowsStartingWith('OK:');
            expect(ngRows).toHaveLength(0);
        });

        it('should truncate long scrapDescription to 40 chars in NG annotation', () => {
            const doc = createEmptyPfdDocument();
            const longDesc = 'A'.repeat(80);
            doc.steps = [
                { ...createEmptyStep('OP 10'), stepType: 'inspection', rejectDisposition: 'scrap', scrapDescription: longDesc, description: 'Control' },
                { ...createEmptyStep('OP 20'), description: 'Next' },
            ];
            exportPfdExcel(doc);
            const ngRows = findRowsStartingWith('OK:');
            // The text should contain only first 40 chars of the description
            expect(ngRows[0][0].v).toContain('A'.repeat(40));
            expect(ngRows[0][0].v).not.toContain('A'.repeat(41));
        });
    });

    describe('Merge cells for separators', () => {
        it('should set !merges on the worksheet for separator rows', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), description: 'Main' },
                { ...createEmptyStep('OP 20'), branchId: 'A', branchLabel: 'Mecanizado', description: 'Branch' },
                { ...createEmptyStep('OP 30'), description: 'End' },
            ];
            exportPfdExcel(doc);
            const ws = (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.results[0].value;
            expect(ws['!merges']).toBeDefined();
            // Filter to data-area merges (row >= 12) that span full width
            const dataMerges = ws['!merges'].filter((m: any) => m.s.r >= 12 && m.s.c === 0 && m.e.c === 14);
            expect(dataMerges.length).toBeGreaterThan(0);
            for (const merge of dataMerges) {
                expect(merge.s.c).toBe(0);
                expect(merge.e.c).toBe(14);
            }
        });

        it('should NOT add data-row merges when no separators exist', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), description: 'Step 1' },
                { ...createEmptyStep('OP 20'), description: 'Step 2' },
            ];
            exportPfdExcel(doc);
            const ws = (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.results[0].value;
            // Merges exist for metadata rows (title, form ref, etc.) but none in data area (row >= 12)
            const dataMerges = (ws['!merges'] || []).filter((m: any) => m.s.r >= 12);
            expect(dataMerges).toHaveLength(0);
        });

        it('should merge fork + join + NG path rows in a complete parallel zone', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), description: 'Main' },
                { ...createEmptyStep('OP 20'), branchId: 'A', branchLabel: 'Mecanizado', stepType: 'inspection', rejectDisposition: 'rework', reworkReturnStep: 'OP 10', description: 'Insp' },
                { ...createEmptyStep('OP 30'), branchId: 'A', branchLabel: 'Mecanizado', description: 'Next in branch' },
                { ...createEmptyStep('OP 40'), description: 'End' },
            ];
            exportPfdExcel(doc);
            const ws = (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.results[0].value;
            // Should have: 1 fork + 1 NG path + 1 join = 3 data-row merges
            const dataMerges = ws['!merges'].filter((m: any) => m.s.r >= 12);
            expect(dataMerges).toHaveLength(3);
        });
    });

    describe('Branch styling', () => {
        it('should use standard cell style for branch steps (no special fill)', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), description: 'Main step' },
                { ...createEmptyStep('OP 20'), branchId: 'A', branchLabel: 'Mecanizado', description: 'Branch A step' },
            ];
            exportPfdExcel(doc);
            const rows = getDataRows();
            const branchRow = rows.find(r =>
                r[0]?.v && typeof r[0].v === 'string' && r.length === 15 && r[3]?.v === 'Mecanizado'
            );
            expect(branchRow).toBeDefined();
            // Branch steps use standard cell style — no special branch-colored fill
            const descCell = branchRow![2] as { v: string; s: { fill?: { fgColor?: { rgb: string } } } };
            expect(descCell.s.fill).toBeUndefined();
        });

        it('should show branch label in Linea column with standard style', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), description: 'Main' },
                { ...createEmptyStep('OP 20'), branchId: 'A', branchLabel: 'Mecanizado', description: 'Branch' },
                { ...createEmptyStep('OP 30'), description: 'End' },
            ];
            exportPfdExcel(doc);
            const rows = getDataRows();
            const branchRow = rows.find(r =>
                r[0]?.v && typeof r[0].v === 'string' && r.length === 15 && r[3]?.v === 'Mecanizado'
            );
            expect(branchRow).toBeDefined();
            // Linea column uses standard cellCenter style (no bold, no special color)
            const lineaCell = branchRow![3] as { v: string; s: { font?: { bold?: boolean } } };
            expect(lineaCell.s.font?.bold).toBeUndefined();
        });

        it('should NOT apply any fill to main flow steps', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), description: 'Main step' },
            ];
            exportPfdExcel(doc);
            const rows = getDataRows();
            const mainRow = rows.find(r => r[0]?.v === 'OP 10');
            expect(mainRow).toBeDefined();
            const descCell = mainRow![2] as { v: string; s: { fill?: { fgColor?: { rgb: string } } } };
            expect(descCell.s.fill).toBeUndefined();
        });

        it('should apply subtle yellow tint to rework/scrap rows', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), stepType: 'operation', rejectDisposition: 'rework', reworkReturnStep: 'OP 05', description: 'Rework op' },
            ];
            exportPfdExcel(doc);
            const rows = getDataRows();
            const reworkRow = rows.find(r => r[0]?.v === 'OP 10');
            expect(reworkRow).toBeDefined();
            const descCell = reworkRow![2] as { v: string; s: { fill?: { fgColor?: { rgb: string } } } };
            expect(descCell.s.fill?.fgColor?.rgb).toBe('FFF2CC');
        });
    });

    describe('Edge cases', () => {
        it('should export without errors for empty steps array', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [];
            expect(() => exportPfdExcel(doc)).not.toThrow();
            const rows = getRows();
            // Should have metadata rows + header + summary + legend
            expect(rows.length).toBeGreaterThan(11);
        });

        it('should handle step with undefined rejectDisposition defensively', () => {
            const doc = createEmptyPfdDocument();
            // Force undefined disposition (simulates old data without normalization)
            (doc.steps[0] as unknown as Record<string, unknown>).rejectDisposition = undefined;
            expect(() => exportPfdExcel(doc)).not.toThrow();
        });

        it('should handle all-parallel document (no main flow)', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [
                { ...createEmptyStep('OP 10'), branchId: 'A', branchLabel: 'Línea A', description: 'All branch A' },
                { ...createEmptyStep('OP 20'), branchId: 'B', branchLabel: 'Línea B', description: 'All branch B' },
            ];
            expect(() => exportPfdExcel(doc)).not.toThrow();
            const forkRows = findRowsStartingWith('INICIO');
            expect(forkRows).toHaveLength(1);
            // No convergence since the flow never returns to main
            const joinRows = findRowsStartingWith('CONVERGENCIA');
            expect(joinRows).toHaveLength(0);
        });

        it('should show Total count matching doc.steps.length', () => {
            const doc = createEmptyPfdDocument();
            const step2 = createEmptyStep('OP 20');
            step2.description = 'Step 2';
            doc.steps.push(step2);
            exportPfdExcel(doc);
            const rows = getRows();
            const totalRow = rows.find(r => r[0]?.v && typeof r[0].v === 'string' && (r[0].v as string).startsWith('Total:'));
            expect(totalRow).toBeDefined();
            expect(totalRow![0].v).toBe('Total: 2 pasos');
        });
    });
});
