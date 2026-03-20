/**
 * PFD PDF Export — Direct PDF download via html2pdf.js
 *
 * Uses a single-page PDF with custom height to avoid cutting
 * the flowchart diagram across pages. Standard practice for
 * engineering drawings and process flow diagrams.
 *
 * Flow: buildPfdSvg() → strip CSS animations → wrap in HTML →
 *       html2pdf.js with custom page dimensions → download.
 */

import type { PfdDocument } from './pfdTypes';
import { buildPfdSvg } from './pfdSvgExport';
import { getLogoBase64 } from '../../src/assets/ppe/ppeBase64';
import { sanitizeFilename } from '../../utils/filenameSanitization';

/** Page width in mm (A3 landscape width) */
const PAGE_W_MM = 420;
/** Margins [top, left, bottom, right] in mm */
const MARGIN: [number, number, number, number] = [8, 6, 8, 6];

/**
 * Prepare SVG content for PDF capture:
 * - Strip XML declaration (breaks HTML iframe parsing)
 * - Strip CSS arrow animation (html2canvas may capture mid-flight → invisible arrows)
 */
function prepareSvgForPdf(rawSvg: string): string {
    return rawSvg
        .replace(/<\?xml[^?]*\?>\s*/, '')
        .replace(/\.pfd-arrow path\s*\{[^}]*\}/, '.pfd-arrow path { }')
        .replace(/@keyframes dashDraw\s*\{[^}]*\}/, '');
}

/** Extract viewBox dimensions from SVG string */
function parseSvgViewBox(svg: string): { width: number; height: number } | null {
    const match = svg.match(/viewBox=["'](\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)["']/);
    if (!match) return null;
    return { width: parseFloat(match[3]), height: parseFloat(match[4]) };
}

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
    const rawSvg = buildPfdSvg(doc, logoBase64);
    const svgContent = prepareSvgForPdf(rawSvg);

    // Calculate custom page height from SVG aspect ratio
    const viewBox = parseSvgViewBox(rawSvg);
    const contentW = PAGE_W_MM - MARGIN[1] - MARGIN[3]; // printable width
    let pageH: number;
    if (viewBox && viewBox.width > 0) {
        const aspectRatio = viewBox.height / viewBox.width;
        pageH = contentW * aspectRatio + MARGIN[0] + MARGIN[2];
    } else {
        // Fallback: A3 landscape height
        pageH = 297;
    }

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

        iframeDoc.open();
        iframeDoc.write(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
    body { margin: 0; padding: 0; background: #ffffff; font-family: Arial, sans-serif; overflow: hidden; }
    * { box-sizing: border-box; }
    svg { width: 100%; height: auto; max-width: 100%; display: block; }
</style></head>
<body><div style="background: white; width: 100%; padding: 0; margin: 0;">
    ${svgContent}
</div></body>
</html>`);
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
                orientation: 'landscape' as const,
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
