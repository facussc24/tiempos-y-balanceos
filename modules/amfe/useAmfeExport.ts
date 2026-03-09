import { useState, useCallback, useRef } from 'react';
import { AmfeDocument, ActionPriority } from './amfeTypes';
import { getDocumentCompletionErrors, getExportWarnings, validateAmfeDocument, migrateAmfeDocument } from './amfeValidation';
import { exportAmfeCompleto, exportAmfeResumenAP, exportAmfePlanAcciones } from './amfeExcelExport';
import { exportAmfePdf, getAmfePdfPreviewHtml, PdfTemplate } from './amfePdfExport';
import { logger } from '../../utils/logger';
import { toast } from '../../components/ui/Toast';

const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // 10 MB

interface UseAmfeExportParams {
    data: AmfeDocument;
    loadData: (doc: AmfeDocument) => void;
    resetHistory: (doc: AmfeDocument) => void;
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
    handleExcelCompleto: () => Promise<void>;
    handleExcelResumenAP: () => Promise<void>;
    handleExcelPlanAcciones: () => Promise<void>;
    handleExportJson: () => void;
    handleImportJson: () => void;
    handleFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
    jsonImportRef: React.RefObject<HTMLInputElement | null>;
    clearPdfPreview: () => void;
}

export function useAmfeExport(params: UseAmfeExportParams): UseAmfeExportReturn {
    const { data, loadData, resetHistory, requestConfirm } = params;

    const [pdfPreview, setPdfPreview] = useState<{ html: string; template: PdfTemplate } | null>(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handlePdfPreview = useCallback(async (template: PdfTemplate) => {
        // Warn about AP=H causes without actions
        const completionErrors = getDocumentCompletionErrors(data);
        if (completionErrors.length > 0) {
            const ok = await requestConfirm({
                title: 'Advertencia de exportación',
                message: `${completionErrors.length} causa(s) AP=H sin acciones correctivas. ¿Continuar con la exportación?`,
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
            toast.success('PDF exportado', 'El documento AMFE se descargó correctamente.');
        } catch (err) {
            logger.error('AMFE', 'PDF export error', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', 'No se pudo exportar el PDF. Intente nuevamente.');
        } finally {
            setIsExportingPdf(false);
            setPdfPreview(null);
        }
    }, [data, pdfPreview]);

    const handleExcelCompleto = useCallback(async () => {
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
        try {
            exportAmfeCompleto(data);
            toast.success('Excel exportado', 'AMFE Completo descargado correctamente.');
        } catch (err: unknown) {
            logger.error('AMFE', 'Excel Completo export error', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', 'No se pudo exportar Excel. Intente nuevamente.');
        } finally {
            setTimeout(() => setIsExporting(false), 300);
        }
    }, [data, requestConfirm]);

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
        try {
            exportAmfeResumenAP(data);
            toast.success('Excel exportado', 'Resumen de AP descargado correctamente.');
        } catch (err: unknown) {
            logger.error('AMFE', 'Excel ResumenAP export error', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', 'No se pudo exportar Excel. Intente nuevamente.');
        } finally {
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
        try {
            exportAmfePlanAcciones(data);
            toast.success('Excel exportado', 'Plan de Acciones descargado correctamente.');
        } catch (err: unknown) {
            logger.error('AMFE', 'Excel PlanAcciones export error', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', 'No se pudo exportar Excel. Intente nuevamente.');
        } finally {
            setTimeout(() => setIsExporting(false), 300);
        }
    }, [data, requestConfirm]);

    const clearPdfPreview = useCallback(() => setPdfPreview(null), []);

    // --- JSON Export ---
    const jsonBlobTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleExportJson = useCallback(() => {
        try {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const href = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = href;
            link.download = `AMFE_${data.header.subject || 'Export'}_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            if (jsonBlobTimerRef.current) clearTimeout(jsonBlobTimerRef.current);
            jsonBlobTimerRef.current = setTimeout(() => URL.revokeObjectURL(href), 1500);
            toast.success('JSON exportado', 'AMFE exportado como JSON.');
        } catch (err) {
            logger.error('AMFE', 'JSON export failed', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', 'No se pudo exportar el JSON.');
        }
    }, [data]);

    // --- JSON Import ---
    const jsonImportRef = useRef<HTMLInputElement | null>(null);
    const handleImportJson = useCallback(() => {
        jsonImportRef.current?.click();
    }, []);

    const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset input so same file can be re-selected
        e.target.value = '';

        if (file.size > MAX_IMPORT_SIZE) {
            toast.error('Archivo muy grande', `El archivo supera el límite de ${MAX_IMPORT_SIZE / 1024 / 1024} MB.`);
            return;
        }

        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const validation = validateAmfeDocument(parsed);
            if (!validation.valid) {
                toast.error('JSON inválido', `El archivo no es un AMFE válido:\n${validation.errors.slice(0, 3).join('\n')}`);
                return;
            }

            const hasData = data.operations.length > 0;
            if (hasData) {
                const ok = await requestConfirm({
                    title: 'Importar AMFE',
                    message: 'Se reemplazará el documento actual con el contenido del archivo JSON. Esta acción se puede deshacer con Ctrl+Z.',
                    variant: 'warning',
                    confirmText: 'Importar',
                });
                if (!ok) return;
            }

            const migrated = migrateAmfeDocument(parsed);
            loadData(migrated);
            resetHistory(migrated);
            toast.success('AMFE importado', `Se cargaron ${migrated.operations.length} operaciones desde "${file.name}".`);
        } catch (err) {
            logger.error('AMFE', 'JSON import failed', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de importación', 'No se pudo leer el archivo JSON. Verifique el formato.');
        }
    }, [data.operations.length, loadData, resetHistory, requestConfirm]);

    return {
        pdfPreview,
        isExportingPdf,
        isExporting,
        handlePdfPreview,
        handlePdfExport,
        handleExcelCompleto,
        handleExcelResumenAP,
        handleExcelPlanAcciones,
        handleExportJson,
        handleImportJson,
        handleFileSelected,
        jsonImportRef,
        clearPdfPreview,
    };
}
