vi.mock('html2pdf.js', () => ({
    default: vi.fn(() => ({
        from: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        save: vi.fn().mockResolvedValue(undefined),
    })),
}));

import { getPfdPdfPreviewHtml } from '../../../modules/pfd/pfdPdfExport';
import { createEmptyPfdDocument } from '../../../modules/pfd/pfdTypes';

describe('pfdPdfExport', () => {
    describe('getPfdPdfPreviewHtml', () => {
        it('should generate HTML with title', () => {
            const doc = createEmptyPfdDocument();
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('DIAGRAMA DE FLUJO DEL PROCESO');
        });

        it('should include company name', () => {
            const doc = createEmptyPfdDocument();
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('Barack Mercosul');
        });

        it('should include header columns', () => {
            const doc = createEmptyPfdDocument();
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('Nº Op.');
            expect(html).toContain('Descripción');
            expect(html).toContain('Máquina/Dispositivo');
        });

        it('should render step data', () => {
            const doc = createEmptyPfdDocument();
            doc.steps[0].stepNumber = 'OP 10';
            doc.steps[0].description = 'Inyección de cubierta';
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('OP 10');
            expect(html).toContain('Inyección de cubierta');
        });

        it('should render CC/SC badges', () => {
            const doc = createEmptyPfdDocument();
            doc.steps[0].productSpecialChar = 'CC';
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('CC');
        });

        it('should mark rework steps with disposition column (C3-N2)', () => {
            const doc = createEmptyPfdDocument();
            doc.steps[0].isRework = true;
            doc.steps[0].rejectDisposition = 'rework';
            const html = getPfdPdfPreviewHtml(doc);
            // C3-N2: Disposition column with Retrabajo badge
            expect(html).toContain('Disposición');
            expect(html).toContain('Retrabajo');
            expect(html).toContain('FEF2F2'); // rework bg color
        });

        it('should mark external process steps', () => {
            const doc = createEmptyPfdDocument();
            doc.steps[0].isExternalProcess = true;
            const html = getPfdPdfPreviewHtml(doc);
            // Externo column header + "Sí" cell + external row background
            expect(html).toContain('Externo');
            expect(html).toContain('EFF6FF'); // external bg color
        });

        it('should escape HTML special characters', () => {
            const doc = createEmptyPfdDocument();
            doc.steps[0].description = '<script>alert("xss")</script>';
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });

        it('should include supplierCode, coreTeam, keyContact in header (N5)', () => {
            const doc = createEmptyPfdDocument();
            doc.header.supplierCode = 'SUP-123';
            doc.header.coreTeam = 'Equipo Alpha';
            doc.header.keyContact = 'Ing. López';
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('Cód. Proveedor');
            expect(html).toContain('SUP-123');
            expect(html).toContain('Equipo');
            expect(html).toContain('Equipo Alpha');
            expect(html).toContain('Contacto');
            expect(html).toContain('Ing. López');
        });

        it('should render CC/SC left border on rows (E3)', () => {
            const doc = createEmptyPfdDocument();
            doc.steps[0].productSpecialChar = 'CC';
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('border-left:4px solid #EF4444');
        });

        it('should render SC left border on rows', () => {
            const doc = createEmptyPfdDocument();
            doc.steps[0].processSpecialChar = 'SC';
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('border-left:4px solid #F59E0B');
        });

        it('should render scrap disposition (C3-N2)', () => {
            const doc = createEmptyPfdDocument();
            doc.steps[0].rejectDisposition = 'scrap';
            doc.steps[0].scrapDescription = 'Dimensional fuera de tol.';
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('Descarte');
            expect(html).toContain('Dimensional fuera de tol.');
        });

        it('should render sort disposition (C3-N2)', () => {
            const doc = createEmptyPfdDocument();
            doc.steps[0].rejectDisposition = 'sort';
            doc.steps[0].scrapDescription = 'Verificar diámetro';
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('Selección');
            expect(html).toContain('Verificar diámetro');
        });

        it('should render rework with return step in detail column (C3-N2)', () => {
            const doc = createEmptyPfdDocument();
            doc.steps[0].rejectDisposition = 'rework';
            doc.steps[0].reworkReturnStep = 'OP 20';
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('Retrabajo');
            expect(html).toContain('Retorno a: OP 20');
        });

        it('should use larger SVGs in legend (C3-E1)', () => {
            const doc = createEmptyPfdDocument();
            const html = getPfdPdfPreviewHtml(doc);
            // Legend should have 20x20 SVGs and 9px font
            expect(html).toContain('width="20" height="20"');
            expect(html).toContain('font-size:9px;');
        });

        it('should include Detalle column header (C3-N2)', () => {
            const doc = createEmptyPfdDocument();
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('Detalle');
            expect(html).toContain('Disposición');
        });

        it('should include part identification in footer area (C4-N3)', () => {
            const doc = createEmptyPfdDocument();
            doc.header.partNumber = 'P-001';
            doc.header.partName = 'Cubierta izquierda';
            // Footer is added via jsPDF, not in HTML preview — but the HTML includes summary
            const html = getPfdPdfPreviewHtml(doc);
            // The part info is in the header section of HTML
            expect(html).toContain('P-001');
            expect(html).toContain('Cubierta izquierda');
        });

        it('should use SVG arrows between rows instead of text characters (C4-V1)', () => {
            const doc = createEmptyPfdDocument();
            const step2 = { ...doc.steps[0], id: 'step-2', stepNumber: 'OP 20', description: 'Second step' };
            doc.steps.push(step2);
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('<svg');
            expect(html).toContain('stroke="#0891B2"');
            expect(html).not.toContain('>↓<');
        });

        it('should include step type summary (C4-E2)', () => {
            const doc = createEmptyPfdDocument();
            doc.steps[0].stepType = 'operation';
            doc.steps[0].stepNumber = 'OP 10';
            doc.steps[0].description = 'Corte';
            const step2 = { ...doc.steps[0], id: 'step-2', stepNumber: 'OP 20', stepType: 'inspection' as const, description: 'Inspección' };
            doc.steps.push(step2);
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('Resumen');
            expect(html).toContain('2 pasos');
        });

        it('should include CC/SC counts in summary (C4-E2)', () => {
            const doc = createEmptyPfdDocument();
            doc.steps[0].productSpecialChar = 'CC';
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).toContain('1 CC');
        });

        it('should not render summary for empty document (C4-E2)', () => {
            const doc = createEmptyPfdDocument();
            doc.steps = [];
            const html = getPfdPdfPreviewHtml(doc);
            expect(html).not.toContain('Resumen');
        });
    });
});
