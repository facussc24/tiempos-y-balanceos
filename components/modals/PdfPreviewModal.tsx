/**
 * PdfPreviewModal — Shared PDF preview modal for all modules.
 *
 * Shows the generated HTML in an isolated iframe (srcdoc) so the user
 * can verify the content before downloading the PDF.
 * Also offers a "Print" fallback that opens a native print dialog,
 * guaranteeing a non-blank PDF even if html2pdf.js fails.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, Printer, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface PdfPreviewModalProps {
    /** Raw HTML content to preview (inline styles, no external CSS) */
    html: string;
    /** Called when the user clicks "Exportar PDF" */
    onExport: () => void;
    /** Close the modal */
    onClose: () => void;
    /** Whether the export is currently in progress */
    isExporting?: boolean;
    /** Modal header title */
    title?: string;
    /** Modal header subtitle (template name, etc.) */
    subtitle?: string;
    /** Max width for the preview content area (e.g. '420mm', '297mm', '210mm') */
    maxWidth?: string;
    /** Theme color for the header gradient (tailwind class like 'blue', 'teal', 'navy') */
    themeColor?: 'blue' | 'teal' | 'navy' | 'cyan';
    /** Optional: Called when the user clicks "Exportar Excel" (shows extra green button) */
    onExportExcel?: () => void;
    /** Whether the Excel export is in progress */
    isExportingExcel?: boolean;
}

const THEME_STYLES: Record<string, { gradient: string; icon: string; btn: string }> = {
    blue: { gradient: 'from-blue-50 to-gray-50', icon: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-500' },
    teal: { gradient: 'from-teal-50 to-gray-50', icon: 'text-teal-600', btn: 'bg-teal-600 hover:bg-teal-500' },
    navy: { gradient: 'from-slate-100 to-gray-50', icon: 'text-slate-700', btn: 'bg-slate-700 hover:bg-slate-600' },
    cyan: { gradient: 'from-cyan-50 to-gray-50', icon: 'text-cyan-600', btn: 'bg-cyan-600 hover:bg-cyan-500' },
};

const ZOOM_LEVELS = [50, 75, 100, 125, 150];

const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
    html,
    onExport,
    onClose,
    isExporting = false,
    title = 'Vista Previa PDF',
    subtitle,
    maxWidth = '297mm',
    themeColor = 'blue',
    onExportExcel,
    isExportingExcel = false,
}) => {
    const [zoom, setZoom] = useState(100);
    const theme = THEME_STYLES[themeColor] || THEME_STYLES.blue;
    const modalRef = useFocusTrap(true);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isExporting) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isExporting, onClose]);

    // Build a complete HTML document for the iframe srcdoc
    const iframeSrc = useMemo(() => {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { background: #f3f4f6; }
        body {
            background: white;
            max-width: ${maxWidth};
            margin: 16px auto;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
            transform: scale(${zoom / 100});
            transform-origin: top center;
        }
        @media print {
            html { background: white; }
            body { margin: 0; padding: 0; box-shadow: none; transform: none; }
        }
    </style>
</head>
<body>${html}</body>
</html>`;
    }, [html, maxWidth, zoom]);

    const handlePrint = useCallback(() => {
        const printWindow = window.open('', '_blank', 'width=1200,height=900');
        if (!printWindow) return;
        printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
        @page { margin: 8mm 6mm; }
        body { margin: 0; padding: 0; }
    </style>
</head>
<body>${html}</body>
</html>`);
        printWindow.document.close();
        // Give the browser time to render before printing
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }, [html, title]);

    const zoomIn = () => setZoom(z => {
        const idx = ZOOM_LEVELS.indexOf(z);
        return idx < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[idx + 1] : z;
    });

    const zoomOut = () => setZoom(z => {
        const idx = ZOOM_LEVELS.indexOf(z);
        return idx > 0 ? ZOOM_LEVELS[idx - 1] : z;
    });

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pdf-preview-modal-title"
                className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[95vw] h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gradient-to-r ${theme.gradient} flex-shrink-0`}>
                    <div className="flex items-center gap-2">
                        <FileText size={18} className={theme.icon} />
                        <div>
                            <h3 id="pdf-preview-modal-title" className="text-sm font-bold text-gray-800">{title}</h3>
                            {subtitle && <p className="text-[10px] text-gray-500">{subtitle}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Zoom controls */}
                        <div className="flex items-center gap-1 bg-white/60 rounded px-2 py-1 border border-gray-200">
                            <button onClick={zoomOut} disabled={zoom <= ZOOM_LEVELS[0]}
                                className="p-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                title="Reducir zoom" aria-label="Reducir zoom">
                                <ZoomOut size={14} />
                            </button>
                            <span className="text-[10px] font-mono text-gray-600 w-8 text-center">{zoom}%</span>
                            <button onClick={zoomIn} disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                                className="p-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                title="Aumentar zoom" aria-label="Aumentar zoom">
                                <ZoomIn size={14} />
                            </button>
                        </div>
                        {/* Print button */}
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded font-medium transition text-xs"
                            title="Imprimir / Guardar como PDF (recomendado si el PDF sale en blanco)"
                        >
                            <Printer size={14} /> Imprimir
                        </button>
                        {/* Excel export button (optional) */}
                        {onExportExcel && (
                            <button
                                onClick={onExportExcel}
                                disabled={isExportingExcel}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-semibold transition shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isExportingExcel ? (
                                    <><Loader2 size={14} className="animate-spin" /> Exportando...</>
                                ) : (
                                    <><FileSpreadsheet size={14} /> Exportar Excel</>
                                )}
                            </button>
                        )}
                        {/* PDF Export button */}
                        <button
                            onClick={onExport}
                            disabled={isExporting}
                            className={`flex items-center gap-1.5 ${theme.btn} text-white px-4 py-2 rounded font-semibold transition shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isExporting ? (
                                <><Loader2 size={14} className="animate-spin" /> Generando...</>
                            ) : (
                                <><Download size={14} /> Exportar PDF</>
                            )}
                        </button>
                        <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Preview content via iframe */}
                <div className="flex-1 overflow-hidden bg-gray-100">
                    <iframe
                        srcDoc={iframeSrc}
                        className="w-full h-full border-none"
                        title="PDF Preview"
                        sandbox="allow-same-origin"
                    />
                </div>
            </div>
        </div>
    );
};

export default PdfPreviewModal;
