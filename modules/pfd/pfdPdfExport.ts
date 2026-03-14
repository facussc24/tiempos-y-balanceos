/**
 * PFD PDF Export — Print-to-PDF via hidden iframe
 *
 * Uses the browser's native print dialog to generate PDF.
 * Flow: buildPfdSvg() → inject into hidden iframe → window.print() → cleanup.
 * No external dependencies required.
 *
 * The user selects "Save as PDF" in the OS print dialog.
 * CSS @media print is configured for A3 landscape for best results.
 */

import type { PfdDocument } from './pfdTypes';
import { buildPfdSvg } from './pfdSvgExport';
import { getLogoBase64 } from '../../src/assets/ppe/ppeBase64';

/**
 * Export PFD as PDF via print dialog.
 * Opens the browser print dialog with the SVG rendered in an iframe.
 */
export async function exportPfdPdf(doc: PfdDocument): Promise<void> {
    const logoBase64 = await getLogoBase64();
    const svgContent = buildPfdSvg(doc, logoBase64);

    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '1200px';
    iframe.style.height = '900px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
        document.body.removeChild(iframe);
        throw new Error('No se pudo crear el iframe para exportar PDF');
    }

    const title = `PFD — ${doc.header.partName || doc.header.partNumber || 'Documento'}`;

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8"/>
    <title>${title}</title>
    <style>
        @page {
            size: A3 landscape;
            margin: 10mm;
        }
        @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { margin: 0; padding: 0; }
        }
        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            background: white;
        }
        svg {
            width: 100%;
            height: auto;
            max-width: 100%;
        }
    </style>
</head>
<body>
    ${svgContent}
</body>
</html>`);
    iframeDoc.close();

    // Wait for images to load (logo base64), then print
    setTimeout(() => {
        try {
            iframe.contentWindow?.print();
        } catch (err) {
            console.error('PFD PDF export: print failed', err);
        }
        // Cleanup after print dialog closes
        setTimeout(() => {
            try { document.body.removeChild(iframe); } catch { /* already removed */ }
        }, 2000);
    }, 500);
}
