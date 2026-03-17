/**
 * Hoja de Operaciones App — Main Shell
 *
 * Can operate embedded in AMFE (as a tab) or standalone.
 * Layout: Navigator sidebar (left) + Sheet editor (right).
 * Theme: Navy blue (matching paper format HO 952 REV.06).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useHojaOperaciones } from './useHojaOperaciones';
import { useHoPersistence } from './useHoPersistence';
import type { HoDocument, HojaOperacion, HoStep, HoVisualAid, PpeItem } from './hojaOperacionesTypes';
import type { HoDocumentListItem } from '../../utils/repositories/hoRepository';
import { getHoSheetPreviewHtml, getHoAllSheetsPreviewHtml, exportHoSheetPdf, exportAllHoSheetsPdf } from './hojaOperacionesPdfExport';
import { exportHoSheetExcel, exportAllHoSheetsExcel } from './hoExcelExport';
import HoSheetNavigator from './HoSheetNavigator';
import HoSheetEditor from './HoSheetEditor';
import PdfPreviewModal from '../../components/modals/PdfPreviewModal';
import { RevisionPromptModal } from '../../components/modals/RevisionPromptModal';
import { CrossDocAlertBanner } from '../../components/ui/CrossDocAlertBanner';
import { RevisionHistoryPanel } from '../../components/layout/RevisionHistoryPanel';
import { ModuleErrorBoundary } from '../../components/ui/ModuleErrorBoundary';
import { useRevisionControl } from '../../hooks/useRevisionControl';
import { useDocumentLock } from '../../hooks/useDocumentLock';
import DocumentLockBanner from '../../components/ui/DocumentLockBanner';
import { useCrossDocAlerts } from '../../hooks/useCrossDocAlerts';
import { getNextRevisionLevel } from '../../utils/revisionUtils';
import { FileText, Download, FileDown, FileSpreadsheet, Loader2, Layers, BookOpen, GitBranch, Undo2, Redo2, Eye, Pencil, FolderOpen, AlertTriangle } from 'lucide-react';
import HoHelpPanel from './HoHelpPanel';
import HoHeaderForm from './HoHeaderForm';
import { useHoHistory } from './useHoHistory';
import { useHoKeyboardShortcuts } from './useHoKeyboardShortcuts';
import { validateHoDocument, getHoExportErrors } from './hojaOperacionesValidation';
import { logger } from '../../utils/logger';
import { toast } from '../../components/ui/Toast';
import { useOpenExportFolder } from '../../hooks/useOpenExportFolder';
import { useHoCpLinkAlerts } from '../../hooks/useHoCpLinkAlerts';
import { HoCpLinkValidationPanel } from '../../components/ui/HoCpLinkValidationPanel';

/** Formal persistence methods exposed when operating standalone (not embedded). */
export interface HoFormalPersistence {
    saveDocument: (id: string, doc: HoDocument) => Promise<boolean>;
    loadDocument: (id: string) => Promise<HoDocument | null>;
    listDocuments: () => Promise<HoDocumentListItem[]>;
    deleteDocument: (id: string) => Promise<boolean>;
    deleteDraft: (key: string) => Promise<void>;
}

interface Props {
    /** When embedded in AMFE, parent provides initial data. */
    embedded?: boolean;
    initialData?: HoDocument;
    /** Callback when data changes (for parent tracking). */
    onDataChange?: (data: HoDocument) => void;
    /** Ref callback to expose formal persistence methods to parent when standalone. */
    onPersistenceReady?: (persistence: HoFormalPersistence) => void;
    /** Revision control */
    onNewRevision?: () => void;
    currentRevisionLevel?: string;
}

const HojaOperacionesApp: React.FC<Props> = ({ embedded, initialData, onDataChange, onPersistenceReady, onNewRevision, currentRevisionLevel }) => {
    const ho = useHojaOperaciones();
    const history = useHoHistory(ho.data);
    const [isFormalSaving, setIsFormalSaving] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [readOnly, setReadOnly] = useState(false);
    const stepSearchRef = useRef<HTMLInputElement>(null);

    // Auto-save drafts + formal persistence methods
    const persistence = useHoPersistence({
        currentData: ho.data,
        currentProject: ho.data.header.linkedAmfeProject || 'untitled',
        isSaving: isFormalSaving,
    });

    // Revision control (HO uses linkedAmfeProject as document ID)
    const hoDocId = ho.data.header.linkedAmfeProject || null;

    // Cross-user edit lock (standalone mode only)
    const documentLock = useDocumentLock(embedded ? null : hoDocId, 'ho');
    const revisionControl = useRevisionControl({
        module: 'ho',
        documentId: hoDocId,
        currentData: ho.data,
        currentRevisionLevel: currentRevisionLevel || 'A',
        onRevisionCreated: () => {
            // HO doesn't have a revision field in its header — parent updates externally
        },
    });

    // Cross-document alerts
    const crossDocAlerts = useCrossDocAlerts('ho', hoDocId);

    // HO → CP link validation
    const hoCpAlerts = useHoCpLinkAlerts(
        ho.data.sheets.length > 0 ? ho.data : null,
        ho.data.header.linkedCpProject || null,
        useCallback((sheetId: string, checkId: string, cpItemId: string | undefined) => {
            ho.updateQualityCheckCpItemId(sheetId, checkId, cpItemId);
        }, [ho.updateQualityCheckCpItemId]),
    );
    const [showHoCpLinkPanel, setShowHoCpLinkPanel] = useState(false);

    // Export folder
    const exportFolder = useOpenExportFolder('ho', ho.data);

    // Expose formal persistence to parent when standalone (not embedded)
    useEffect(() => {
        if (!embedded && onPersistenceReady) {
            onPersistenceReady({
                saveDocument: persistence.saveDocument,
                loadDocument: persistence.loadDocument,
                listDocuments: persistence.listDocuments,
                deleteDocument: persistence.deleteDocument,
                deleteDraft: persistence.deleteDraft,
            });
        }
    }, [embedded, onPersistenceReady, persistence.saveDocument, persistence.loadDocument, persistence.listDocuments, persistence.deleteDocument, persistence.deleteDraft]);

    // Undo/Redo handlers
    const handleUndo = useCallback(() => {
        const prev = history.undo();
        if (prev) {
            ho.loadData(prev);
            toast.success('Deshacer', history.undoCount > 0 ? `${history.undoCount} cambios restantes` : undefined);
        }
    }, [history, ho.loadData]);

    const handleRedo = useCallback(() => {
        const next = history.redo();
        if (next) {
            ho.loadData(next);
            toast.success('Rehacer', history.redoCount > 0 ? `${history.redoCount} cambios restantes` : undefined);
        }
    }, [history, ho.loadData]);

    // Load initial data when provided (from AMFE generator)
    useEffect(() => {
        if (initialData && initialData.sheets.length > 0) {
            ho.loadData(initialData);
            history.resetHistory(initialData);
        }
    }, [initialData]); // eslint-disable-line react-hooks/exhaustive-deps

    // Notify parent of data changes
    useEffect(() => {
        onDataChange?.(ho.data);
    }, [ho.data, onDataChange]);

    // Find active sheet
    const activeSheet = useMemo(
        () => ho.data.sheets.find(s => s.id === ho.activeSheetId) || null,
        [ho.data.sheets, ho.activeSheetId],
    );

    // --- Handlers (bound to active sheet) ---

    const handleUpdateField = useCallback(<K extends keyof HojaOperacion>(field: K, value: HojaOperacion[K]) => {
        if (!ho.activeSheetId) return;
        ho.updateSheetField(ho.activeSheetId, field, value);
    }, [ho.activeSheetId, ho.updateSheetField]);

    const handleAddStep = useCallback(() => {
        if (!ho.activeSheetId) return;
        ho.addStep(ho.activeSheetId);
    }, [ho.activeSheetId, ho.addStep]);

    // Keyboard shortcuts via dedicated hook (matching CP pattern)
    const handleToggleViewMode = useCallback(() => {
        setReadOnly(v => !v);
    }, []);
    const handleFocusStepSearch = useCallback(() => {
        stepSearchRef.current?.focus();
    }, []);
    useHoKeyboardShortcuts({
        onUndo: handleUndo,
        onRedo: handleRedo,
        onToggleHelp: () => setShowHelp(v => !v),
        onAddStep: handleAddStep,
        onToggleViewMode: handleToggleViewMode,
        onFocusStepSearch: handleFocusStepSearch,
        showHelp,
        isReadOnly: readOnly,
        activeSheetId: ho.activeSheetId,
    });

    const handleRemoveStep = useCallback((stepId: string) => {
        if (!ho.activeSheetId) return;
        ho.removeStep(ho.activeSheetId, stepId);
    }, [ho.activeSheetId, ho.removeStep]);

    const handleUpdateStep = useCallback((stepId: string, field: keyof HoStep, value: any) => {
        if (!ho.activeSheetId) return;
        ho.updateStep(ho.activeSheetId, stepId, field, value);
    }, [ho.activeSheetId, ho.updateStep]);

    const handleReorderSteps = useCallback((from: number, to: number) => {
        if (!ho.activeSheetId) return;
        ho.reorderSteps(ho.activeSheetId, from, to);
    }, [ho.activeSheetId, ho.reorderSteps]);

    const handleTogglePpe = useCallback((item: PpeItem) => {
        if (!ho.activeSheetId) return;
        ho.togglePpe(ho.activeSheetId, item);
    }, [ho.activeSheetId, ho.togglePpe]);

    const handleAddVisualAid = useCallback((imageData: string, caption: string) => {
        if (!ho.activeSheetId) return;
        ho.addVisualAid(ho.activeSheetId, imageData, caption);
    }, [ho.activeSheetId, ho.addVisualAid]);

    const handleRemoveVisualAid = useCallback((aidId: string) => {
        if (!ho.activeSheetId) return;
        ho.removeVisualAid(ho.activeSheetId, aidId);
    }, [ho.activeSheetId, ho.removeVisualAid]);

    const handleUpdateVisualAidCaption = useCallback((aidId: string, caption: string) => {
        if (!ho.activeSheetId) return;
        ho.updateVisualAid(ho.activeSheetId, aidId, 'caption', caption);
    }, [ho.activeSheetId, ho.updateVisualAid]);

    const handleUpdateQcRegistro = useCallback((checkId: string, value: string) => {
        if (!ho.activeSheetId) return;
        ho.updateQualityCheckRegistro(ho.activeSheetId, checkId, value);
    }, [ho.activeSheetId, ho.updateQualityCheckRegistro]);

    const handleUpdateReactionPlan = useCallback((text: string) => {
        if (!ho.activeSheetId) return;
        ho.updateReactionPlan(ho.activeSheetId, text);
    }, [ho.activeSheetId, ho.updateReactionPlan]);

    const handleUpdateReactionContact = useCallback((contact: string) => {
        if (!ho.activeSheetId) return;
        ho.updateReactionContact(ho.activeSheetId, contact);
    }, [ho.activeSheetId, ho.updateReactionContact]);

    // --- PDF Preview ---
    const [pdfPreview, setPdfPreview] = useState<{ html: string; mode: 'sheet' | 'all' } | null>(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // FIX: Ref-based mutex prevents concurrent exports even with batched state updates.
    // State flag alone is insufficient because React batches setIsExportingExcel(true)
    // and a rapid second click can still see stale state.
    const exportingExcelRef = useRef(false);

    // FIX: isMounted guard for async preview generation
    const isMountedRef = useRef(true);
    useEffect(() => {
        return () => { isMountedRef.current = false; };
    }, []);

    const warnExportIssues = useCallback(() => {
        const issues = validateHoDocument(ho.data);
        const errors = issues.filter(i => i.severity === 'error');
        if (errors.length > 0) {
            toast.warning('Advertencias de exportación', `${errors.length} problema(s): ${errors.map(e => e.message).join('. ')}`);
        }
    }, [ho.data]);

    const handleExcelSheet = useCallback(async () => {
        if (!activeSheet || exportingExcelRef.current) return;
        const exportErrors = getHoExportErrors(ho.data);
        if (exportErrors.length > 0) {
            toast.error('No se puede exportar', `${exportErrors.length} error(es): ${exportErrors.map(e => e.message).join('. ')}`);
            return;
        }
        warnExportIssues();
        exportingExcelRef.current = true;
        setIsExportingExcel(true);
        try {
            await exportHoSheetExcel(activeSheet, ho.data);
            toast.success('Excel exportado', `Hoja "${activeSheet.operationName || activeSheet.hoNumber}" descargada correctamente.`);
        } catch (err) {
            logger.error('HojaOperaciones', 'Excel sheet export failed', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', 'No se pudo exportar Excel. Intente nuevamente.');
        } finally {
            exportingExcelRef.current = false;
            setIsExportingExcel(false);
        }
    }, [activeSheet, ho.data, warnExportIssues]);

    const handleExcelAll = useCallback(async () => {
        if (exportingExcelRef.current) return;
        const exportErrors = getHoExportErrors(ho.data);
        if (exportErrors.length > 0) {
            toast.error('No se puede exportar', `${exportErrors.length} error(es): ${exportErrors.map(e => e.message).join('. ')}`);
            return;
        }
        warnExportIssues();
        exportingExcelRef.current = true;
        setIsExportingExcel(true);
        try {
            await exportAllHoSheetsExcel(ho.data);
            toast.success('Excel exportado', 'Todas las hojas de operaciones descargadas correctamente.');
        } catch (err) {
            logger.error('HojaOperaciones', 'Excel all sheets export failed', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', 'No se pudo exportar Excel. Intente nuevamente.');
        } finally {
            exportingExcelRef.current = false;
            setIsExportingExcel(false);
        }
    }, [ho.data, warnExportIssues]);

    const handlePreviewSheet = useCallback(async () => {
        if (!activeSheet) return;
        warnExportIssues();
        setIsLoadingPreview(true);
        try {
            const html = await getHoSheetPreviewHtml(activeSheet, ho.data);
            if (isMountedRef.current) setPdfPreview({ html, mode: 'sheet' });
        } catch (err) {
            logger.error('HojaOperaciones', 'Preview generation failed', { error: err instanceof Error ? err.message : String(err) });
        } finally {
            if (isMountedRef.current) setIsLoadingPreview(false);
        }
    }, [activeSheet, ho.data, warnExportIssues]);

    const handlePreviewAll = useCallback(async () => {
        warnExportIssues();
        setIsLoadingPreview(true);
        try {
            const html = await getHoAllSheetsPreviewHtml(ho.data);
            if (isMountedRef.current) setPdfPreview({ html, mode: 'all' });
        } catch (err) {
            logger.error('HojaOperaciones', 'Preview all generation failed', { error: err instanceof Error ? err.message : String(err) });
        } finally {
            if (isMountedRef.current) setIsLoadingPreview(false);
        }
    }, [ho.data, warnExportIssues]);

    const handlePdfExport = useCallback(async () => {
        if (!pdfPreview) return;
        const exportErrors = getHoExportErrors(ho.data);
        if (exportErrors.length > 0) {
            toast.error('No se puede exportar', `${exportErrors.length} error(es): ${exportErrors.map(e => e.message).join('. ')}`);
            return;
        }
        setIsExportingPdf(true);
        try {
            if (pdfPreview.mode === 'sheet' && activeSheet) {
                await exportHoSheetPdf(activeSheet, ho.data);
            } else {
                await exportAllHoSheetsPdf(ho.data);
            }
            toast.success('PDF exportado', 'Hoja de operaciones descargada correctamente.');
        } catch (err) {
            logger.error('HojaOperaciones', 'PDF export error', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', 'No se pudo exportar el PDF. Intente nuevamente.');
        } finally {
            setIsExportingPdf(false);
            setPdfPreview(null);
        }
    }, [pdfPreview, activeSheet, ho.data]);

    // --- Empty state ---
    if (ho.data.sheets.length === 0) {
        return (
            <>
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-16">
                    <FileText size={48} className="mb-4 text-blue-300" />
                    <p className="text-sm font-medium text-gray-500 mb-1">Sin hojas de operaciones</p>
                    <p className="text-xs text-gray-400 max-w-sm text-center">
                        Las Hojas de Operaciones se generan automáticamente desde el AMFE y el Plan de Control.
                        Vuelva a la pestaña AMFE y use "Generar Hojas de Operaciones".
                    </p>
                </div>
                <HoHelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} />
            </>
        );
    }

    return (
        <>
        {!embedded && <DocumentLockBanner otherEditor={documentLock.otherEditor} />}
        <div className="flex flex-1 overflow-hidden">
            {/* Navigator sidebar */}
            <div className="w-52 flex-shrink-0 flex flex-col">
                <HoSheetNavigator
                    sheets={ho.data.sheets}
                    activeSheetId={ho.activeSheetId}
                    onSelect={ho.setActiveSheet}
                />
                {/* PDF Export buttons in sidebar */}
                <div className="p-2 border-t border-slate-200 bg-slate-50 space-y-1">
                    <button
                        onClick={handlePreviewSheet}
                        disabled={!activeSheet || isLoadingPreview}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isLoadingPreview ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                        PDF Hoja Actual
                    </button>
                    <button
                        onClick={handlePreviewAll}
                        disabled={isLoadingPreview}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isLoadingPreview ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        PDF Todas las Hojas
                    </button>
                    <div className="border-t border-slate-200 my-1" />
                    <button
                        onClick={handleExcelSheet}
                        disabled={!activeSheet || isExportingExcel}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isExportingExcel ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                        Excel Hoja Actual
                    </button>
                    <button
                        onClick={handleExcelAll}
                        disabled={isExportingExcel}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isExportingExcel ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                        Excel Todas las Hojas
                    </button>
                    <button
                        onClick={exportFolder.openFolder}
                        disabled={!exportFolder.canOpen || exportFolder.isOpening}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Abrir carpeta de exportacion en Explorador"
                    >
                        <FolderOpen size={14} />
                        Abrir Carpeta
                    </button>
                    <div className="border-t border-slate-200 my-1" />
                    <button
                        onClick={handleToggleViewMode}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium rounded transition ${
                            readOnly
                                ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-100'
                        }`}
                        title="Alternar Vista / Edición (Ctrl+D)"
                    >
                        {readOnly ? <Eye size={14} /> : <Pencil size={14} />}
                        {readOnly ? 'Modo Vista' : 'Modo Edición'}
                    </button>
                    <div className="flex gap-1">
                        <button
                            onClick={handleUndo}
                            disabled={!history.canUndo}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Deshacer (Ctrl+Z)"
                        >
                            <Undo2 size={14} />
                            Deshacer
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={!history.canRedo}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Rehacer (Ctrl+Y)"
                        >
                            <Redo2 size={14} />
                            Rehacer
                        </button>
                    </div>
                    <button
                        onClick={() => setShowHelp(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition"
                        title="Manual de ayuda (F1)"
                    >
                        <BookOpen size={14} />
                        Manual (F1)
                    </button>
                    {hoCpAlerts.validation.totalBroken > 0 && (
                        <button
                            onClick={() => setShowHoCpLinkPanel(v => !v)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium rounded transition ${
                                showHoCpLinkPanel
                                    ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                    : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                            }`}
                            title="Ver vínculos HO → CP rotos"
                        >
                            <AlertTriangle size={14} />
                            CP rotos ({hoCpAlerts.validation.totalBroken})
                        </button>
                    )}
                    {onNewRevision && (
                        <>
                            <div className="border-t border-slate-200 my-1" />
                            <button
                                onClick={onNewRevision}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-100 hover:border-indigo-300 transition"
                                title="Crear nueva revision del documento"
                            >
                                <GitBranch size={14} />
                                Nueva Rev.
                                <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto">
                                    {currentRevisionLevel || 'A'}
                                </span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Editor column (info bar + scrollable editor) */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Cross-document alert banner */}
                <CrossDocAlertBanner
                    alerts={crossDocAlerts.alerts}
                    onDismiss={crossDocAlerts.dismissAlert}
                    onDismissAll={crossDocAlerts.dismissAll}
                />

                {/* Header form (standalone mode only) */}
                {!embedded && (
                    <HoHeaderForm
                        header={ho.data.header}
                        onUpdateHeader={ho.updateHeader}
                    />
                )}

                {/* Family parts info bar (only shown when embedded + applicableParts has content) */}
                {embedded && ho.data.header.applicableParts?.trim() && (
                    <div className="mx-4 mt-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-xs text-slate-700 flex-shrink-0">
                        <Layers size={14} className="text-slate-500 flex-shrink-0" />
                        <span className="font-semibold">Piezas Aplicables:</span>
                        <span className="text-slate-600">{ho.data.header.applicableParts.replace(/\n/g, ' · ')}</span>
                    </div>
                )}

                {/* HO → CP link validation panel */}
                {showHoCpLinkPanel && hoCpAlerts.validation.totalBroken > 0 && (
                    <div className="mx-4 mt-2 flex-shrink-0">
                        <HoCpLinkValidationPanel
                            validation={hoCpAlerts.validation}
                            onUnlinkCheck={hoCpAlerts.unlinkCheck}
                            onRelinkCheck={hoCpAlerts.relinkCheck}
                            cpCandidates={hoCpAlerts.cpCandidates}
                            onClose={() => setShowHoCpLinkPanel(false)}
                        />
                    </div>
                )}

                {/* Editor area */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    {activeSheet ? (
                        <HoSheetEditor
                            sheet={activeSheet}
                            formNumber={ho.data.header.formNumber}
                            clientName={ho.data.header.client || ''}
                            onUpdateField={handleUpdateField}
                            onAddStep={handleAddStep}
                            onRemoveStep={handleRemoveStep}
                            onUpdateStep={handleUpdateStep}
                            onReorderSteps={handleReorderSteps}
                            onTogglePpe={handleTogglePpe}
                            onAddVisualAid={handleAddVisualAid}
                            onRemoveVisualAid={handleRemoveVisualAid}
                            onUpdateVisualAidCaption={handleUpdateVisualAidCaption}
                            onUpdateQualityCheckRegistro={handleUpdateQcRegistro}
                            onUpdateReactionPlan={handleUpdateReactionPlan}
                            onUpdateReactionContact={handleUpdateReactionContact}
                            readOnly={readOnly}
                            stepSearchRef={stepSearchRef}
                            brokenCheckIds={hoCpAlerts.brokenCheckIds}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                            Seleccione una operación del panel izquierdo
                        </div>
                    )}
                </div>
            </div>

            {/* Help Panel */}
            <HoHelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} />

            {/* Revision Prompt Modal */}
            <RevisionPromptModal
                isOpen={revisionControl.showRevisionPrompt}
                onClose={() => revisionControl.setShowRevisionPrompt(false)}
                onConfirm={(desc, by) => revisionControl.confirmRevision(desc, by)}
                currentRevisionLevel={currentRevisionLevel || 'A'}
                nextRevisionLevel={getNextRevisionLevel(currentRevisionLevel || 'A')}
            />

            {/* PDF Preview Modal */}
            {pdfPreview && (
                <PdfPreviewModal
                    html={pdfPreview.html}
                    onExport={handlePdfExport}
                    onClose={() => setPdfPreview(null)}
                    isExporting={isExportingPdf}
                    title="Vista Previa PDF — Hoja de Operaciones"
                    subtitle={pdfPreview.mode === 'sheet' ? `Hoja: ${activeSheet?.operationName || ''}` : `Todas las Hojas (${ho.data.sheets.length})`}
                    maxWidth="210mm"
                    themeColor="navy"
                />
            )}
        </div>
        </>
    );
};

/** Wrapped with ModuleErrorBoundary for production resilience. */
const HojaOperacionesAppWithBoundary: React.FC<Props> = (props) => (
    <ModuleErrorBoundary moduleName="Hoja de Operaciones">
        <HojaOperacionesApp {...props} />
    </ModuleErrorBoundary>
);

export default HojaOperacionesAppWithBoundary;
