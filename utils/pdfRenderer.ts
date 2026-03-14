/**
 * PDF Renderer — Reliable HTML → PDF via iframe isolation
 *
 * html2canvas fails when the target element is off-screen (left: -10000px)
 * or invisible (opacity: 0). This module solves it by rendering the HTML
 * inside a same-origin iframe, which provides a clean rendering context
 * at viewport origin (0,0) — guaranteed to be captured by html2canvas.
 *
 * Used by all 4 PDF export modules: AMFE, Control Plan, HO, PFD.
 *
 * contentWidth is auto-calculated from paper size, orientation, and margins
 * to guarantee the rendered content fits exactly within the printable area.
 */

/** Paper dimensions in mm (width × height in portrait orientation) */
const PAPER_DIMS: Record<string, [number, number]> = {
    a3: [297, 420],
    a4: [210, 297],
};

export interface PdfRenderOptions {
    /** PDF filename (with .pdf extension) */
    filename: string;
    /** Paper size: 'a3' | 'a4' */
    paperSize: 'a3' | 'a4';
    /** Paper orientation */
    orientation: 'landscape' | 'portrait';
    /**
     * Content width override in mm.
     * If omitted, auto-calculated from paper size + orientation + margin.
     * Prefer omitting this to let the renderer compute the correct value.
     */
    contentWidth?: string;
    /** Margins [top, left, bottom, right] in mm (html2pdf.js convention) */
    margin?: [number, number, number, number];
}

/**
 * Render HTML content to PDF using an iframe for reliable html2canvas capture.
 *
 * Flow:
 * 1. Create a hidden iframe (fixed, behind app content)
 * 2. Write HTML into the iframe with white background
 * 3. Wait for the browser to paint
 * 4. Use html2pdf.js to capture the iframe body → PDF
 * 5. Clean up the iframe
 */
export async function renderHtmlToPdf(
    htmlContent: string,
    options: PdfRenderOptions,
): Promise<void> {
    const html2pdf = (await import('html2pdf.js')).default;

    // Compute margins and printable content width
    const margin = options.margin || [8, 6, 8, 6]; // [top, left, bottom, right]
    let iframeWidthMm: number;
    if (options.contentWidth) {
        const parsed = parseFloat(options.contentWidth);
        // FIX: Guard against NaN from malformed contentWidth strings.
        // NaN in CSS `width: NaNmm` breaks iframe layout silently.
        if (Number.isFinite(parsed) && parsed > 0) {
            iframeWidthMm = parsed;
        } else {
            // Fall back to auto-calculation
            const dims = PAPER_DIMS[options.paperSize];
            const pageWidthMm = options.orientation === 'landscape' ? dims[1] : dims[0];
            iframeWidthMm = pageWidthMm - margin[1] - margin[3];
        }
    } else {
        // Auto-calculate from paper size, orientation, and margins
        const dims = PAPER_DIMS[options.paperSize]; // [portrait-width, portrait-height]
        const pageWidthMm = options.orientation === 'landscape' ? dims[1] : dims[0];
        iframeWidthMm = pageWidthMm - margin[1] - margin[3]; // subtract left + right margins
    }

    // 1. Create iframe — fixed at (0,0), behind app content, with proper dimensions
    const iframe = document.createElement('iframe');
    iframe.style.cssText = [
        'position: fixed',
        'left: 0',
        'top: 0',
        `width: ${iframeWidthMm}mm`,
        'height: 100vh',
        'border: none',
        'z-index: -1',
        'pointer-events: none',
    ].join('; ');
    document.body.appendChild(iframe);

    try {
        // 2. Write HTML content into the iframe
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error('Could not access iframe document');

        iframeDoc.open();
        iframeDoc.write(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
    body { margin: 0; padding: 0; background: #ffffff; font-family: Arial, sans-serif; overflow: hidden; }
    * { box-sizing: border-box; }
</style></head>
<body>${htmlContent}</body>
</html>`);
        iframeDoc.close();

        // 3. Wait for paint — double rAF + small timeout ensures fonts/images are loaded
        await new Promise<void>(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 100);
                });
            });
        });

        // Resize iframe to actual content height
        iframe.style.height = `${iframeDoc.body.scrollHeight + 20}px`;

        // One more frame for the resize to take effect
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

        // 4. Capture the iframe body with html2pdf.js
        await html2pdf()
            .from(iframeDoc.body)
            .set({
                margin,
                filename: options.filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    backgroundColor: '#ffffff',
                },
                jsPDF: {
                    unit: 'mm',
                    format: options.paperSize,
                    orientation: options.orientation,
                },
                pagebreak: { mode: ['avoid-all', 'css'] },
            })
            .save();
    } finally {
        // 5. Clean up
        document.body.removeChild(iframe);
    }
}

/**
 * Render HTML content to PDF and return as Uint8Array buffer.
 * Same logic as renderHtmlToPdf but returns the buffer instead of triggering download.
 * Used by autoExportService for writing to Y: drive.
 */
export async function renderHtmlToPdfBuffer(
    htmlContent: string,
    options: Omit<PdfRenderOptions, 'filename'>,
): Promise<Uint8Array> {
    const html2pdf = (await import('html2pdf.js')).default;

    const margin = options.margin || [8, 6, 8, 6];
    let iframeWidthMm: number;
    if (options.contentWidth) {
        const parsed = parseFloat(options.contentWidth);
        if (Number.isFinite(parsed) && parsed > 0) {
            iframeWidthMm = parsed;
        } else {
            const dims = PAPER_DIMS[options.paperSize];
            const pageWidthMm = options.orientation === 'landscape' ? dims[1] : dims[0];
            iframeWidthMm = pageWidthMm - margin[1] - margin[3];
        }
    } else {
        const dims = PAPER_DIMS[options.paperSize];
        const pageWidthMm = options.orientation === 'landscape' ? dims[1] : dims[0];
        iframeWidthMm = pageWidthMm - margin[1] - margin[3];
    }

    const iframe = document.createElement('iframe');
    iframe.style.cssText = [
        'position: fixed',
        'left: 0',
        'top: 0',
        `width: ${iframeWidthMm}mm`,
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
</style></head>
<body>${htmlContent}</body>
</html>`);
        iframeDoc.close();

        await new Promise<void>(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 100);
                });
            });
        });

        iframe.style.height = `${iframeDoc.body.scrollHeight + 20}px`;
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

        const arrayBuffer: ArrayBuffer = await html2pdf()
            .from(iframeDoc.body)
            .set({
                margin,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    backgroundColor: '#ffffff',
                },
                jsPDF: {
                    unit: 'mm',
                    format: options.paperSize,
                    orientation: options.orientation,
                },
                pagebreak: { mode: ['avoid-all', 'css'] },
            })
            .outputPdf('arraybuffer');

        return new Uint8Array(arrayBuffer);
    } finally {
        document.body.removeChild(iframe);
    }
}
