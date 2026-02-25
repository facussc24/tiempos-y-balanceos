import { useState, useCallback } from 'react';
import { AmfeDocument, ActionPriority } from './amfeTypes';
import { getDocumentCompletionErrors, getExportWarnings } from './amfeValidation';
import { exportAmfeResumenAP, exportAmfePlanAcciones } from './amfeExcelExport';
import { exportAmfePdf, getAmfePdfPreviewHtml, PdfTemplate } from './amfePdfExport';
import { logger } from '../../utils/logger';

interface UseAmfeExportParams {
    data: AmfeDocument;
    requestConfirm: (options: {
        title: string;
        message: string;
        variant?: 'danger' | 'warning' | 'info';
        confirmText?: string;
    }) => Promise<boolean>;
}

interface UseAmfeExportReturn {
    pdfPreview: { html: string; template: PdfTemplate } | null;
    isExportingPdf: boolean;
    isExporting: boolean;
    handlePdfPreview: (template: PdfTemplate) => Promise<void>;
    handlePdfExport: () => Promise<void>;
    handleExcelResumenAP: () => Promise<void>;
    handleExcelPlanAcciones: () => Promise<void>;
    clearPdfPreview: () => void;
}

export function useAmfeExport(params: UseAmfeExportParams): UseAmfeExportReturn {
    const { data, requestConfirm } = params;

    const [pdfPreview, setPdfPreview] = useState<{ html: string; template: PdfTemplate } | null>(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handlePdfPreview = useCallback(async (template: PdfTemplate) => {
        // Warn about AP=H causes without actions
        const completionErrors = getDocumentCompletionErrors(data);
        if (completionErrors.length > 0) {
            const ok = await requestConfirm({
                title: 'Advertencia de exportacion',
                message: `${completionErrors.length} causa(s) AP=H sin acciones correctivas. ¿Continuar con la exportacion?`,
            });
            if (!ok) return;
        }
        const html = getAmfePdfPreviewHtml(data, template);
        setPdfPreview({ html, template });
    }, [data, requestConfirm]);

    const handlePdfExport = useCallback(async () => {
        if (!pdfPreview) return;
        setIsExportingPdf(true);
        try {
            await exportAmfePdf(data, pdfPreview.template);
        } catch (err) {
            logger.error('[AMFE] PDF export error:', err);
            alert('Error al exportar PDF. Intente nuevamente.');
        } finally {
            setIsExportingPdf(false);
            setPdfPreview(null);
        }
    }, [data, pdfPreview]);

    const handleExcelResumenAP = useCallback(async () => {
        const hasPriorityCauses = data.operations.some(op =>
            op.workElements.some(we => we.functions.some(f => f.failures.some(fail =>
                fail.causes.some(c => c.ap === ActionPriority.HIGH || c.ap === ActionPriority.MEDIUM)
            )))
        );
        if (!hasPriorityCauses) {
            await requestConfirm({
                title: 'Sin Datos para Exportar',
                message: 'No hay causas con AP Alto (H) o Medio (M) para incluir en el resumen.',
                variant: 'info',
                confirmText: 'Entendido',
            });
            return;
        }
        const warnings = getExportWarnings(data);
        if (warnings.length > 0) {
            const ok = await requestConfirm({
                title: 'Advertencias de Export',
                message: `Se encontraron ${warnings.length} advertencia(s):\n\n${warnings.map(w => '• ' + w).join('\n')}\n\n¿Desea exportar de todas formas?`,
                variant: 'warning',
                confirmText: 'Exportar',
            });
            if (!ok) return;
        }
        setIsExporting(true);
        try { exportAmfeResumenAP(data); } finally {
            setTimeout(() => setIsExporting(false), 300);
        }
    }, [data, requestConfirm]);

    const handleExcelPlanAcciones = useCallback(async () => {
        const warnings = getExportWarnings(data);
        if (warnings.length > 0) {
            const ok = await requestConfirm({
                title: 'Advertencias de Export',
                message: `Se encontraron ${warnings.length} advertencia(s):\n\n${warnings.map(w => '• ' + w).join('\n')}\n\n¿Desea exportar de todas formas?`,
                variant: 'warning',
                confirmText: 'Exportar',
            });
            if (!ok) return;
        }
        setIsExporting(true);
        try { exportAmfePlanAcciones(data); } finally {
            setTimeout(() => setIsExporting(false), 300);
        }
    }, [data, requestConfirm]);

    const clearPdfPreview = useCallback(() => setPdfPreview(null), []);

    return {
        pdfPreview,
        isExportingPdf,
        isExporting,
        handlePdfPreview,
        handlePdfExport,
        handleExcelResumenAP,
        handleExcelPlanAcciones,
        clearPdfPreview,
    };
}
