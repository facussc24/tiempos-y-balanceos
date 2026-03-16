/**
 * Control Plan App - Main Shell
 *
 * Standalone module for managing Control Plans (AIAG format).
 * Can operate independently from Landing page or embedded in AMFE as a tab.
 *
 * Refactored: hooks extracted to useCpKeyboardShortcuts, useCpFilters, useCpDraftRecovery.
 * Sub-components: CpToolbar, CpValidationPanel, CpTemplateModal.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useControlPlan } from './useControlPlan';
import { useCpHistory } from './useCpHistory';
import { useControlPlanProjects } from './useControlPlanProjects';
import { useControlPlanPersistence } from './useControlPlanPersistence';
import { useAmfeConfirm } from '../amfe/useAmfeConfirm';
import { ControlPlanDocument, ControlPlanHeader, ControlPlanItem, CONTROL_PLAN_PHASES, CP_COLUMNS, EMPTY_CP_DOCUMENT, normalizeControlPlanDocument } from './controlPlanTypes';
import { validateCpAgainstAmfe, CpValidationIssue } from './cpCrossValidation';
import { CP_TEMPLATES } from './controlPlanTemplates';
import ControlPlanStickyHeader from './ControlPlanStickyHeader';
import ControlPlanTable from './ControlPlanTable';
import CpToolbar from './CpToolbar';
import CpValidationPanel from './CpValidationPanel';
import CpTemplateModal from './CpTemplateModal';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { PromptModal } from '../../components/modals/PromptModal';
import { RevisionPromptModal } from '../../components/modals/RevisionPromptModal';
import { CrossDocAlertBanner } from '../../components/ui/CrossDocAlertBanner';
import { RevisionHistoryPanel } from '../../components/layout/RevisionHistoryPanel';
import PdfPreviewModal from '../../components/modals/PdfPreviewModal';
import { ModuleErrorBoundary } from '../../components/ui/ModuleErrorBoundary';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';
import { getCpPdfPreviewHtml, exportCpPdf, CpPdfTemplate } from './controlPlanPdfExport';
import { useRevisionControl } from '../../hooks/useRevisionControl';
import { useDocumentLock } from '../../hooks/useDocumentLock';
import DocumentLockBanner from '../../components/ui/DocumentLockBanner';
import { useCrossDocAlerts } from '../../hooks/useCrossDocAlerts';
import { getNextRevisionLevel } from '../../utils/revisionUtils';
import { Plus, XCircle, Eye } from 'lucide-react';
import { useShortcutHints } from '../../hooks/useShortcutHints';
import { toast } from '../../components/ui/Toast';
import { ShortcutHintsOverlay } from '../../components/ui/ShortcutHintsOverlay';
import { useCpColumnVisibility } from './useCpColumnVisibility';
import { AmfeDocument } from '../amfe/amfeTypes';
import { logger } from '../../utils/logger';
import { useCpKeyboardShortcuts } from './useCpKeyboardShortcuts';
import { useCpFilters } from './useCpFilters';
import { useCpDraftRecovery } from './useCpDraftRecovery';
import { useOpenExportFolder } from '../../hooks/useOpenExportFolder';

const ControlPlanSummary = lazy(() => import('./ControlPlanSummary'));
const CpHelpPanel = lazy(() => import('./CpHelpPanel'));

interface Props {
    onBackToLanding?: () => void;
    /** When embedded in AMFE, the parent provides initial data and hides the back button */
    embedded?: boolean;
    initialData?: ControlPlanDocument;
    onDataChange?: (data: ControlPlanDocument) => void;
    /** AMFE document for cross-context AI and validation (passed when embedded in AMFE) */
    amfeDoc?: AmfeDocument;
    /** Navigate to the linked AMFE module (standalone mode only) */
    onNavigateToAmfe?: () => void;
}

const ControlPlanApp: React.FC<Props> = ({ onBackToLanding, embedded, initialData, onDataChange, amfeDoc, onNavigateToAmfe }) => {
    const [showProjectPanel, setShowProjectPanel] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [showOverflowMenu, setShowOverflowMenu] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [validationIssues, setValidationIssues] = useState<CpValidationIssue[] | null>(null);
    const [autoValidationCount, setAutoValidationCount] = useState(0);
    const [autoValidationHasErrors, setAutoValidationHasErrors] = useState(false);
    const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [viewMode, setViewMode] = useState<'view' | 'edit'>('edit');
    const [pdfPreview, setPdfPreview] = useState<{ html: string; template: CpPdfTemplate } | null>(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [headerCollapsed, setHeaderCollapsed] = useState(() => {
        try { return localStorage.getItem('cp_header_collapsed') === 'true'; } catch { return false; }
    });

    const cp = useControlPlan();
    const history = useCpHistory(cp.data);
    const confirm = useAmfeConfirm();
    const shortcutHints = useShortcutHints();
    const colVis = useCpColumnVisibility();
    const isReadOnly = viewMode === 'view';

    // Filters (extracted hook)
    const {
        searchQuery, setSearchQuery, filterAp, setFilterAp,
        filterSpecial, setFilterSpecial, filteredItems, hasActiveFilters,
        searchRef, clearFilters,
    } = useCpFilters({ items: cp.data.items });

    // Undo/Redo handlers
    const handleUndo = useCallback(() => {
        const prev = history.undo();
        if (prev) {
            cp.loadData(prev);
            toast.success('Deshacer', history.undoCount > 0 ? `${history.undoCount} cambios restantes` : undefined);
        }
    }, [history, cp.loadData]);

    const handleRedo = useCallback(() => {
        const next = history.redo();
        if (next) {
            cp.loadData(next);
            toast.success('Rehacer', history.redoCount > 0 ? `${history.redoCount} cambios restantes` : undefined);
        }
    }, [history, cp.loadData]);

    // Wrap loadData to also reset undo history when loading a project
    const handleLoadProject = useCallback((data: ControlPlanDocument) => {
        cp.loadData(data);
        history.resetHistory(data);
    }, [cp.loadData, history]);

    // Wrap resetData to also reset undo history when creating a new project
    const handleResetProject = useCallback(() => {
        cp.resetData();
        history.resetHistory(EMPTY_CP_DOCUMENT);
    }, [cp.resetData, history]);

    const projects = useControlPlanProjects(
        cp.data,
        handleLoadProject,
        handleResetProject,
        confirm.requestConfirm
    );

    // Cross-user edit lock (standalone mode only)
    const documentLock = useDocumentLock(
        embedded ? null : projects.currentProject,
        'cp',
    );

    const persistence = useControlPlanPersistence({
        currentData: cp.data,
        currentProject: projects.currentProject,
        isSaving: projects.saveStatus === 'saving',
    });

    // Revision control
    const revisionControl = useRevisionControl({
        module: 'cp',
        documentId: projects.currentProject,
        currentData: cp.data,
        currentRevisionLevel: cp.data.header.revision || 'A',
        onRevisionCreated: (newLevel) => {
            cp.updateHeader('revision', newLevel);
        },
    });

    // Cross-document alerts
    const crossDocAlerts = useCrossDocAlerts('cp', projects.currentProject);

    // Export folder
    const exportFolder = useOpenExportFolder('cp', cp.data);

    // Load initial data if provided (from AMFE generator)
    useEffect(() => {
        if (initialData) {
            cp.loadData(initialData);
            history.resetHistory(initialData);
        }
    }, [initialData]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            if (blobTimerRef.current) clearTimeout(blobTimerRef.current);
            if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
        };
    }, []);

    // Draft recovery on mount (extracted hook)
    useCpDraftRecovery({
        embedded,
        currentProject: projects.currentProject,
        loadData: cp.loadData,
        requestConfirm: confirm.requestConfirm,
    });

    // Notify parent of changes when embedded
    useEffect(() => {
        if (embedded && onDataChange) {
            onDataChange(cp.data);
        }
    }, [cp.data, embedded, onDataChange]);

    // Persist header collapse state
    useEffect(() => {
        try { localStorage.setItem('cp_header_collapsed', String(headerCollapsed)); } catch {}
    }, [headerCollapsed]);

    // Auto-validate CP against AMFE with 2-second debounce
    useEffect(() => {
        if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
        validationTimerRef.current = setTimeout(() => {
            if (amfeDoc) {
                const issues = validateCpAgainstAmfe(cp.data, amfeDoc);
                setAutoValidationCount(issues.length);
                setAutoValidationHasErrors(issues.some(i => i.severity === 'error'));
            }
        }, 2000);
        return () => { if (validationTimerRef.current) clearTimeout(validationTimerRef.current); };
    }, [cp.data.items, amfeDoc]);

    // Keyboard shortcuts (extracted hook)
    useCpKeyboardShortcuts({
        onSave: projects.saveCurrentProject,
        onToggleViewMode: useCallback(() => setViewMode(prev => prev === 'view' ? 'edit' : 'view'), []),
        onFocusSearch: useCallback(() => searchRef.current?.focus(), [searchRef]),
        onAddItem: cp.addItem,
        onUndo: handleUndo,
        onRedo: handleRedo,
        onToggleSummary: useCallback(() => setShowSummary(prev => !prev), []),
        onToggleHelp: useCallback(() => setShowHelp(prev => !prev), []),
        validationIssues, showSummary, showHelp, showTemplates,
        isReadOnly, setValidationIssues, setShowSummary, setShowHelp, setShowTemplates,
        showOverflowMenu, setShowOverflowMenu,
    });

    // Completion progress bar stats — context-aware by row type (process vs product)
    const completionStats = useMemo(() => {
        const FIELDS_PER_ROW = 7;
        const total = cp.data.items.length * FIELDS_PER_ROW;
        if (total === 0) return { percent: 0, filled: 0, total: 0 };
        const filled = cp.data.items.reduce((acc, item) => {
            const hasProcess = ((item.processCharacteristic as string) || '').trim() !== '';
            const hasProduct = ((item.productCharacteristic as string) || '').trim() !== '';
            const isProcess = hasProcess && !hasProduct;
            const fields: (keyof ControlPlanItem)[] = isProcess
                ? ['processStepNumber', 'processDescription', 'processCharacteristic', 'sampleSize', 'controlMethod', 'reactionPlan', 'reactionPlanOwner']
                : ['processStepNumber', 'processDescription', 'productCharacteristic', 'sampleSize', 'evaluationTechnique', 'reactionPlan', 'reactionPlanOwner'];
            return acc + fields.filter(f => ((item[f] as string) || '').trim() !== '').length;
        }, 0);
        return { percent: Math.round((filled / total) * 100), filled, total };
    }, [cp.data.items]);

    const handleRemoveItem = useCallback(async (itemId: string) => {
        const idx = cp.data.items.findIndex(i => i.id === itemId);
        const item = idx >= 0 ? cp.data.items[idx] : undefined;
        const desc = item?.processDescription?.trim() || `Fila #${idx + 1 || '?'}`;
        const ok = await confirm.requestConfirm({
            title: 'Eliminar fila',
            message: `¿Eliminar "${desc.slice(0, 60)}" del Plan de Control? Esta accion se puede deshacer con Ctrl+Z.`,
            variant: 'danger',
            confirmText: 'Eliminar',
        });
        if (ok) cp.removeItem(itemId);
    }, [cp.data.items, cp.removeItem, confirm.requestConfirm]);

    const handleHeaderChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        cp.updateHeader(name as keyof ControlPlanHeader, value);
    }, [cp.updateHeader]);

    const handleProductSelect = useCallback((fields: Partial<ControlPlanHeader>) => {
        Object.entries(fields).forEach(([key, val]) => {
            cp.updateHeader(key as keyof ControlPlanHeader, val as string);
        });
    }, [cp.updateHeader]);

    // FIX: Added history.resetHistory to prevent undo from removing template items
    const handleApplyTemplate = useCallback((templateId: string) => {
        const template = CP_TEMPLATES.find(t => t.id === templateId);
        if (!template) return;
        const newItems = template.create();
        const updatedDoc: ControlPlanDocument = {
            ...cp.data,
            items: [...cp.data.items, ...newItems],
        };
        cp.loadData(updatedDoc);
        history.resetHistory(updatedDoc);
        setShowTemplates(false);
    }, [cp.data, cp.loadData, history]);

    const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleJumpToItem = useCallback((itemId?: string) => {
        if (!itemId) return;
        const el = document.querySelector(`[data-item-id="${itemId}"]`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-amber-400');
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 2000);
    }, []);

    const handleRunValidation = useCallback(() => {
        try {
            const issues = validateCpAgainstAmfe(cp.data, amfeDoc);
            setValidationIssues(issues);
        } catch (error) {
            logger.error('ControlPlan', 'Validation failed', { error: error instanceof Error ? error.message : String(error) });
            setValidationIssues([{
                severity: 'error',
                code: 'VALIDATION_ERROR',
                message: `Error al validar: ${error instanceof Error ? error.message : 'Error desconocido'}`,
            }]);
        }
    }, [cp.data, amfeDoc]);

    // Bulk fill: apply a value from one item to all items in the same operation group
    const handleBulkFill = useCallback((sourceItemId: string, field: string, value: string) => {
        const sourceItem = cp.data.items.find(i => i.id === sourceItemId);
        if (!sourceItem) return;
        const stepNumber = sourceItem.processStepNumber;
        cp.data.items
            .filter(i => i.processStepNumber === stepNumber && i.id !== sourceItemId)
            .forEach(i => cp.updateItem(i.id, field as keyof ControlPlanItem, value));
    }, [cp.data.items, cp.updateItem]);

    const inputClass = "w-full border border-gray-300 bg-gray-50 p-2 rounded focus:ring-2 focus:ring-teal-100 focus:border-teal-400 outline-none transition";

    const blobTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const exportToJson = useCallback(() => {
        try {
            const blob = new Blob([JSON.stringify(cp.data, null, 2)], { type: 'application/json' });
            const href = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = href;
            link.download = `PlanDeControl_${cp.data.header.partName || 'Export'}_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            if (blobTimerRef.current) clearTimeout(blobTimerRef.current);
            blobTimerRef.current = setTimeout(() => URL.revokeObjectURL(href), 1500);
            toast.success('JSON exportado', 'Plan de Control exportado como JSON.');
        } catch (err) {
            logger.error('ControlPlan', 'JSON export failed', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', 'No se pudo exportar el JSON.');
        }
    }, [cp.data]);

    // --- JSON Import ---
    const jsonImportRef = useRef<HTMLInputElement | null>(null);
    const handleImportJson = useCallback(() => {
        jsonImportRef.current?.click();
    }, []);
    const handleCpFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Archivo muy grande', 'El archivo supera el límite de 10 MB.');
            return;
        }
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!parsed || !parsed.header || !Array.isArray(parsed.items)) {
                toast.error('JSON inválido', 'El archivo no es un Plan de Control válido (falta header o items).');
                return;
            }
            const hasData = cp.data.items.length > 0;
            if (hasData) {
                const ok = await confirm.requestConfirm({
                    title: 'Importar Plan de Control',
                    message: 'Se reemplazará el documento actual con el contenido del archivo JSON. Esta acción se puede deshacer con Ctrl+Z.',
                    variant: 'warning',
                    confirmText: 'Importar',
                });
                if (!ok) return;
            }
            const normalized = normalizeControlPlanDocument(parsed);
            cp.loadData(normalized);
            history.resetHistory(normalized);
            toast.success('Plan de Control importado', `Se cargaron ${normalized.items.length} ítems desde "${file.name}".`);
        } catch (err) {
            logger.error('ControlPlan', 'JSON import failed', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de importación', 'No se pudo leer el archivo JSON. Verifique el formato.');
        }
    }, [cp.data.items.length, cp.loadData, history, confirm]);

    const handlePdfPreview = useCallback((mode: CpPdfTemplate) => {
        const html = getCpPdfPreviewHtml(cp.data, mode);
        setPdfPreview({ html, template: mode });
    }, [cp.data]);

    const handlePdfExport = useCallback(async () => {
        if (!pdfPreview) return;
        setIsExportingPdf(true);
        try {
            await exportCpPdf(cp.data, pdfPreview.template);
            toast.success('PDF exportado', 'Plan de Control descargado correctamente.');
        } catch (err) {
            logger.error('ControlPlan', 'PDF export error', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', 'No se pudo exportar el PDF. Intente nuevamente.');
        } finally {
            setIsExportingPdf(false);
            setPdfPreview(null);
        }
    }, [cp.data, pdfPreview]);

    // Header summary for collapsed mode
    const headerSummary = useMemo(() => {
        const h = cp.data.header;
        const parts: string[] = [];
        if (h.controlPlanNumber) parts.push(`Plan #${h.controlPlanNumber}`);
        if (h.partName) parts.push(h.partName);
        if (h.phase) {
            const phaseLabel = CONTROL_PLAN_PHASES.find(p => p.value === h.phase)?.label || h.phase;
            parts.push(phaseLabel);
        }
        if (h.client) parts.push(h.client);
        if (h.organization) parts.push(h.organization);
        return parts.join('  •  ') || 'Sin datos del plan';
    }, [cp.data.header]);

    // Dynamic max-h for table
    const tableMaxH = useMemo(() => {
        if (embedded) return 'max-h-[calc(100vh-160px)]';
        return headerCollapsed ? 'max-h-[calc(100vh-220px)]' : 'max-h-[calc(100vh-420px)]';
    }, [embedded, headerCollapsed]);

    return (
        <div data-module="controlPlan" data-mode={viewMode} className="min-h-screen bg-gray-50 flex flex-col font-sans text-sm">
            {!embedded && <DocumentLockBanner otherEditor={documentLock.otherEditor} />}
            <CpToolbar
                embedded={embedded}
                onBackToLanding={onBackToLanding}
                isReadOnly={isReadOnly}
                viewMode={viewMode}
                setViewMode={setViewMode}
                currentProject={projects.currentProject}
                saveStatus={projects.saveStatus}
                hasUnsavedChanges={projects.hasUnsavedChanges}
                networkAvailable={projects.networkAvailable}
                lastAutoSave={persistence.lastAutoSave}
                autoSaveError={persistence.autoSaveError}
                projects={projects.projects}
                saveCurrentProject={projects.saveCurrentProject}
                refreshProjects={projects.refreshProjects}
                loadSelectedProject={projects.loadSelectedProject}
                deleteSelectedProject={projects.deleteSelectedProject}
                createNewProject={projects.createNewProject}
                showProjectPanel={showProjectPanel}
                setShowProjectPanel={setShowProjectPanel}
                showSummary={showSummary}
                setShowSummary={setShowSummary}
                showOverflowMenu={showOverflowMenu}
                setShowOverflowMenu={setShowOverflowMenu}
                setShowHelp={setShowHelp}
                setShowTemplates={setShowTemplates}
                canUndo={history.canUndo}
                canRedo={history.canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
                headerCollapsed={headerCollapsed}
                setHeaderCollapsed={setHeaderCollapsed}
                headerSummary={headerSummary}
                header={cp.data.header}
                onHeaderChange={handleHeaderChange}
                inputClass={inputClass}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filterAp={filterAp}
                setFilterAp={setFilterAp}
                filterSpecial={filterSpecial}
                setFilterSpecial={setFilterSpecial}
                hasActiveFilters={hasActiveFilters}
                clearFilters={clearFilters}
                searchRef={searchRef}
                colVis={colVis}
                totalItems={cp.data.items.length}
                filteredCount={filteredItems.length}
                completionPercent={completionStats.percent}
                validationIssues={validationIssues}
                onRunValidation={handleRunValidation}
                data={cp.data}
                exportToJson={exportToJson}
                importFromJson={handleImportJson}
                requestConfirm={confirm.requestConfirm}
                onPdfPreview={handlePdfPreview}
                onNavigateToAmfe={onNavigateToAmfe}
                linkedAmfeProject={cp.data.header.partName || cp.data.header.linkedAmfeProject}
                onNewRevision={revisionControl.handleNewRevision}
                currentRevisionLevel={cp.data.header.revision || 'A'}
                onProductSelect={handleProductSelect}
                autoValidationCount={autoValidationCount}
                autoValidationHasErrors={autoValidationHasErrors}
                onOpenExportFolder={exportFolder.openFolder}
                canOpenExportFolder={exportFolder.canOpen}
            />

            {/* Cross-document alert banner */}
            <CrossDocAlertBanner
                alerts={crossDocAlerts.alerts}
                onDismiss={crossDocAlerts.dismissAlert}
                onDismissAll={crossDocAlerts.dismissAll}
            />

            {/* Revision history panel */}
            <RevisionHistoryPanel
                revisions={revisionControl.revisions}
                onViewSnapshot={(level) => {
                    revisionControl.loadSnapshot(level).then(snap => {
                        if (snap) {
                            cp.loadData(snap as ControlPlanDocument);
                            history.resetHistory(snap as ControlPlanDocument);
                            logger.info('ControlPlanApp', `Loaded snapshot for Rev. ${level}`);
                        }
                    });
                }}
                isOpen={revisionControl.showRevisionHistory}
                onToggle={() => revisionControl.setShowRevisionHistory(!revisionControl.showRevisionHistory)}
            />

            {/* Read-only mode indicator */}
            {isReadOnly && (
                <div className="bg-teal-50 border-b border-teal-200 px-4 py-1.5 flex items-center gap-2 text-xs text-teal-700 no-print animate-in fade-in duration-200">
                    <Eye size={13} />
                    <span className="font-medium">Modo solo lectura</span>
                    <span className="text-teal-500">— Presiona Ctrl+D para editar</span>
                </div>
            )}

            {/* Summary Panel */}
            {showSummary && (
                <ModuleErrorBoundary moduleName="Resumen CP" onNavigateHome={() => setShowSummary(false)}>
                    <Suspense fallback={<div className="p-4 text-center text-gray-400 text-xs">Cargando resumen...</div>}>
                        <ControlPlanSummary data={cp.data} filteredItems={hasActiveFilters ? filteredItems : undefined} />
                    </Suspense>
                </ModuleErrorBoundary>
            )}

            {/* Table */}
            <div className="flex-grow p-4 pb-20">
                {projects.isLoadingProject ? (
                    <LoadingOverlay message="Cargando Plan de Control..." accentColor="text-green-600" />
                ) : (
                <div className="bg-white shadow-lg rounded border border-gray-300">
                    <div className={`overflow-x-auto overflow-y-auto ${tableMaxH}`} style={{ scrollbarGutter: 'stable' }}>
                        <table className="border-collapse table-fixed" style={{ minWidth: '1794px' }}>
                            <colgroup>
                                {CP_COLUMNS.map(col => (
                                    <col key={col.key} style={{ width: col.width }} />
                                ))}
                                <col style={{ width: '64px' }} />
                            </colgroup>
                            <ControlPlanStickyHeader columnVisibility={colVis.visibility} />
                            <ControlPlanTable
                                items={filteredItems}
                                onUpdateItem={cp.updateItem}
                                onRemoveItem={handleRemoveItem}
                                onMoveItem={cp.moveItem}
                                onDuplicateItem={cp.duplicateItem}
                                readOnly={isReadOnly}
                                columnVisibility={colVis.visibility}
                                onBulkFill={handleBulkFill}
                            />
                        </table>
                    </div>
                </div>
                )}

                {/* Validation Results Panel */}
                {validationIssues && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <CpValidationPanel
                            issues={validationIssues}
                            onClose={() => setValidationIssues(null)}
                            onJumpToItem={handleJumpToItem}
                        />
                    </div>
                )}

                {/* FABs */}
                <div className="fixed bottom-14 right-8 z-40 flex flex-col gap-3 items-end">
                    {!isReadOnly && (
                        <button onClick={cp.addItem}
                            className="bg-teal-600 hover:bg-teal-500 text-white rounded-full p-3 shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
                            title="Agregar item (Ctrl+N)"
                            data-shortcut="Ctrl+N">
                            <Plus size={20} />
                            <span className="font-bold pr-1 text-sm">Agregar Item</span>
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t p-2 text-center text-xs text-gray-500 z-30">
                    <strong>{cp.data.items.length}</strong> items · {completionStats.percent}% completo |
                    Mantene <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Alt</kbd> para ver atajos
                    {projects.currentProject && <span className="ml-4 text-gray-400">Proyecto: <strong className="text-teal-600">{projects.currentProject}</strong></span>}
                </div>
            </div>

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirm.confirmState.isOpen}
                onClose={confirm.handleCancel}
                onConfirm={confirm.handleConfirm}
                title={confirm.confirmState.title}
                message={confirm.confirmState.message}
                variant={confirm.confirmState.variant}
                confirmText={confirm.confirmState.confirmText}
            />

            {/* Project Name Prompt Modal */}
            <PromptModal
                isOpen={projects.promptState.isOpen}
                onClose={projects.promptState.onClose}
                onSubmit={projects.promptState.onSubmit}
                title={projects.promptState.title}
                message={projects.promptState.message}
                defaultValue={projects.promptState.defaultValue}
                placeholder="Nombre del plan"
                required
            />

            {/* Revision Prompt Modal */}
            <RevisionPromptModal
                isOpen={revisionControl.showRevisionPrompt}
                onClose={() => revisionControl.setShowRevisionPrompt(false)}
                onConfirm={(desc, by) => revisionControl.confirmRevision(desc, by)}
                currentRevisionLevel={cp.data.header.revision || 'A'}
                nextRevisionLevel={getNextRevisionLevel(cp.data.header.revision || 'A')}
            />

            {/* Load Error Toast */}
            {projects.loadError && (
                <div className="fixed bottom-4 left-4 z-50 bg-red-50 border border-red-300 rounded-lg shadow-lg p-3 max-w-sm animate-in slide-in-from-bottom-4">
                    <div className="flex items-start gap-2">
                        <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700">{projects.loadError}</p>
                    </div>
                </div>
            )}

            {/* Help Panel */}
            {showHelp && (
                <ModuleErrorBoundary moduleName="Referencia CP" onNavigateHome={() => setShowHelp(false)}>
                    <Suspense fallback={null}>
                        <CpHelpPanel onClose={() => setShowHelp(false)} />
                    </Suspense>
                </ModuleErrorBoundary>
            )}

            {/* Template Selector Modal */}
            <CpTemplateModal
                isOpen={showTemplates}
                onClose={() => setShowTemplates(false)}
                onApplyTemplate={handleApplyTemplate}
            />

            {/* PDF Preview Modal */}
            {pdfPreview && (
                <PdfPreviewModal
                    html={pdfPreview.html}
                    onExport={handlePdfExport}
                    onClose={() => setPdfPreview(null)}
                    isExporting={isExportingPdf}
                    title="Vista Previa PDF — Plan de Control"
                    subtitle={pdfPreview.template === 'full' ? 'Tabla AIAG Completa' : 'Items Criticos'}
                    maxWidth={pdfPreview.template === 'full' ? '420mm' : '297mm'}
                    themeColor="teal"
                />
            )}

            {/* Shortcut Hints Overlay */}
            <ShortcutHintsOverlay isVisible={shortcutHints.hintsVisible} />

            {/* Hidden file input for JSON import */}
            <input
                ref={jsonImportRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleCpFileSelected}
            />
        </div>
    );
};

/** Wrapped in ErrorBoundary for production resilience */
const ControlPlanAppWithErrorBoundary: React.FC<Props> = (props) => (
    <ModuleErrorBoundary moduleName="Plan de Control" onNavigateHome={props.onBackToLanding}>
        <ControlPlanApp {...props} />
    </ModuleErrorBoundary>
);

export default ControlPlanAppWithErrorBoundary;
