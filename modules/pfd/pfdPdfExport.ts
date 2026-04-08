/**
 * PFD PDF Export — Direct PDF download via html2pdf.js
 *
 * Uses a single-page PDF with custom height to avoid cutting
 * the flowchart diagram across pages. Standard practice for
 * engineering drawings and process flow diagrams.
 *
 * Flow: buildPfdSvg() → standalone HTML → iframe → html2pdf.js
 *       with custom page dimensions → download.
 */

import type { PfdDocument } from './pfdTypes';
import { buildPfdSvg } from './pfdSvgExport';
import { getLogoBase64 } from '../../src/assets/ppe/ppeBase64';
import { sanitizeFilename } from '../../utils/filenameSanitization';

/** Page width in mm (A3 landscape width) */
const PAGE_W_MM = 420;
/** Margins [top, left, bottom, right] in mm */
const MARGIN: [number, number, number, number] = [8, 6, 8, 6];

/** Build filename: PFD_{partName}_{date}.pdf */
function buildFilename(doc: PfdDocument): string {
    const nameSource = doc.header.partName || doc.header.partNumber || doc.header.documentNumber || 'Documento';
    const safeName = sanitizeFilename(nameSource, { allowSpaces: true });
    const date = new Date().toISOString().split('T')[0];
    return `PFD_${safeName}_${date}.pdf`;
}

/**
 * Core render: create iframe, write HTML, capture with html2pdf.js.
 * Returns either void (saves file) or ArrayBuffer (for buffer export).
 */
async function renderPfdPdf(
    doc: PfdDocument,
    mode: 'save',
    filename: string,
): Promise<void>;
async function renderPfdPdf(
    doc: PfdDocument,
    mode: 'buffer',
): Promise<Uint8Array>;
async function renderPfdPdf(
    doc: PfdDocument,
    mode: 'save' | 'buffer',
    filename?: string,
): Promise<void | Uint8Array> {
    const html2pdf = (await import('html2pdf.js')).default;

    const logoBase64 = await getLogoBase64();
    const htmlContent = buildPfdSvg(doc, logoBase64, { skipNotes: true });

    const contentW = PAGE_W_MM - MARGIN[1] - MARGIN[3]; // printable width in mm

    // Create iframe for reliable html2canvas capture
    const iframe = document.createElement('iframe');
    iframe.style.cssText = [
        'position: fixed',
        'left: 0',
        'top: 0',
        `width: ${contentW}mm`,
        'height: 100vh',
        'border: none',
        'z-index: -1',
        'pointer-events: none',
    ].join('; ');
    document.body.appendChild(iframe);

    try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error('Could not access iframe document');

        // The htmlContent is already a complete HTML document, write it directly
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        // Wait for paint — double rAF + timeout ensures fonts/images loaded
        await new Promise<void>(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 100);
                });
            });
        });

        // Resize iframe to actual content height
        iframe.style.height = `${iframeDoc.body.scrollHeight + 20}px`;
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

        // Calculate page height from rendered content height
        const contentHeightPx = iframeDoc.body.scrollHeight;
        // Convert px to mm: assume 96 DPI → 1mm ≈ 3.7795px
        const PX_PER_MM = 96 / 25.4;
        const contentHeightMm = contentHeightPx / PX_PER_MM;
        const pageH = contentHeightMm + MARGIN[0] + MARGIN[2];

        const pdfOptions = {
            margin: MARGIN,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                letterRendering: true,
                backgroundColor: '#ffffff',
            },
            jsPDF: {
                unit: 'mm' as const,
                format: [PAGE_W_MM, pageH],
            },
            pagebreak: { mode: ['avoid-all', 'css'] as string[] },
        };

        if (mode === 'save') {
            await html2pdf()
                .from(iframeDoc.body)
                .set({ ...pdfOptions, filename })
                .save();
        } else {
            const arrayBuffer: ArrayBuffer = await html2pdf()
                .from(iframeDoc.body)
                .set(pdfOptions)
                .outputPdf('arraybuffer');
            return new Uint8Array(arrayBuffer);
        }
    } finally {
        document.body.removeChild(iframe);
    }
}

/**
 * Export PFD as PDF — direct browser download.
 * Single-page PDF with custom height to fit entire diagram.
 */
export async function exportPfdPdf(doc: PfdDocument): Promise<void> {
    await renderPfdPdf(doc, 'save', buildFilename(doc));
}

/**
 * Generate PFD PDF as Uint8Array buffer (for auto-export to filesystem).
 */
export async function generatePfdPdfBuffer(doc: PfdDocument): Promise<Uint8Array> {
    return renderPfdPdf(doc, 'buffer') as Promise<Uint8Array>;
}
