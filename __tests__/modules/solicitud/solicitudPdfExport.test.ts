vi.mock('../../../utils/pdfRenderer', () => ({
    renderHtmlToPdf: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../src/assets/ppe/ppeBase64', () => ({
    getLogoBase64: vi.fn().mockResolvedValue('data:image/png;base64,FAKE'),
}));

import { getSolicitudPdfPreviewHtml, exportSolicitudPdf } from '../../../modules/solicitud/solicitudPdfExport';
import { createEmptySolicitud } from '../../../modules/solicitud/solicitudTypes';
import { renderHtmlToPdf } from '../../../utils/pdfRenderer';
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

describe('solicitudPdfExport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getSolicitudPdfPreviewHtml', () => {
        it('contains the title SOLICITUD DE GENERACIÓN DE CÓDIGO', async () => {
            const doc = filledProducto();
            const html = await getSolicitudPdfPreviewHtml(doc);
            expect(html).toContain('SOLICITUD DE GENERACIÓN');
            expect(html).toContain('DE CÓDIGO');
        });

        it('contains form number F-ING-001', async () => {
            const doc = filledProducto();
            const html = await getSolicitudPdfPreviewHtml(doc);
            expect(html).toContain('F-ING-001');
        });

        it('contains DOCUMENTO INTERNO', async () => {
            const doc = filledProducto();
            const html = await getSolicitudPdfPreviewHtml(doc);
            expect(html).toContain('DOCUMENTO INTERNO');
        });

        it('producto solicitud contains DATOS DEL PRODUCTO section', async () => {
            const doc = filledProducto();
            const html = await getSolicitudPdfPreviewHtml(doc);
            expect(html).toContain('DATOS DEL PRODUCTO');
            expect(html).toContain('ABC-123');
            expect(html).toContain('Tornillo M8');
            expect(html).toContain('Toyota');
        });

        it('insumo solicitud contains DATOS DEL INSUMO section', async () => {
            const doc = filledInsumo();
            const html = await getSolicitudPdfPreviewHtml(doc);
            expect(html).toContain('DATOS DEL INSUMO');
            expect(html).toContain('INS-001');
            expect(html).toContain('Aceite');
        });

        it('insumo solicitud contains PPAP notice text', async () => {
            const doc = filledInsumo();
            const html = await getSolicitudPdfPreviewHtml(doc);
            expect(html).toContain('AVISO CALIDAD');
            expect(html).toContain('PPAP');
        });

        it('escapes special characters in HTML output', async () => {
            const doc = filledProducto();
            doc.producto!.codigo = '<script>alert("xss")</script>';
            const html = await getSolicitudPdfPreviewHtml(doc);
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });
    });

    describe('exportSolicitudPdf', () => {
        it('calls renderHtmlToPdf with correct params', async () => {
            const doc = filledProducto();
            await exportSolicitudPdf(doc);
            expect(renderHtmlToPdf).toHaveBeenCalledTimes(1);

            const [html, opts] = (renderHtmlToPdf as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(typeof html).toBe('string');
            expect(html).toContain('SOLICITUD DE GENERACIÓN');
            expect(opts.paperSize).toBe('a4');
            expect(opts.orientation).toBe('portrait');
            expect(opts.filename).toContain('Solicitud');
            expect(opts.filename).toContain('SGC-001');
            expect(opts.filename).toMatch(/\.pdf$/);
        });
    });
});
