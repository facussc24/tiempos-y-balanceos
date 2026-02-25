import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useAmfe } from './useAmfe';
import { useAmfeProjects } from './useAmfeProjects';
import { useAmfePersistence } from './useAmfePersistence';
import { useAmfeConfirm } from './useAmfeConfirm';
import { useAmfeLibrary } from './useAmfeLibrary';
import { getDocumentCompletionErrors, getSoftLimitWarnings } from './amfeValidation';
import StickyColumnHeader from './StickyColumnHeader';
import AmfeTableBody from './AmfeTableBody';
import AmfeStepProgressBar from './AmfeStepProgressBar';
import AmfeFilters, { AmfeFilterState, EMPTY_FILTERS, applyFilters, hasActiveFilters } from './AmfeFilters';
import AmfeLibraryPanel from './AmfeLibraryPanel';
import AmfeTabBar from './AmfeTabBar';
import AmfeHeaderForm from './AmfeHeaderForm';
import AmfeSideDrawer from './AmfeSideDrawer';
import AmfeModals from './AmfeModals';
import AmfeToolbar from './AmfeToolbar';
import AmfeTemplatesModal from './AmfeTemplatesModal';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { Plus, Layers, HardDrive, AlertTriangle, X } from 'lucide-react';
import { AmfeDocument, AmfeHeaderData } from './amfeTypes';
import { useAmfeRegistry } from './useAmfeRegistry';
import { useAmfeColumnVisibility } from './useAmfeColumnVisibility';
import { AmfeTemplate } from './amfeTemplates';
import { ModuleErrorBoundary } from '../../components/ui/ModuleErrorBoundary';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';
import { buildSuggestionIndex } from './amfeSuggestionEngine';
import { logger } from '../../utils/logger';

import { useShortcutHints } from '../../hooks/useShortcutHints';
import { ShortcutHintsOverlay } from '../../components/ui/ShortcutHintsOverlay';
import { useAmfeHistory } from './useAmfeHistory';
import { useAmfeKeyboardShortcuts, useAmfeBeforeUnload } from './useAmfeKeyboardShortcuts';
import { useAmfeDraftRecovery } from './useAmfeDraftRecovery';
import { useAmfeNetworkToast } from './useAmfeNetworkToast';
import { useAmfeExport } from './useAmfeExport';
import { useAmfeTabNavigation } from './useAmfeTabNavigation';

const ControlPlanApp = lazy(() => import('../controlPlan/ControlPlanApp'));
const HojaOperacionesApp = lazy(() => import('../hojaOperaciones/HojaOperacionesApp'));

interface AmfeAppProps {
    onBackToLanding: () => void;
}

/**
 * CRITICAL DESIGN REQUIREMENT:
 * The UI must maintain the "VDA Table" format (Sabana).
 * Do NOT replace this with a Wizard/Step View.
 * The 6M Structure (Work Elements) must be integrated into this table view.
 */
type ActivePanel = 'none' | 'projects' | 'summary' | 'library' | 'registry' | 'templates';

const AmfeApp: React.FC<AmfeAppProps> = ({ onBackToLanding }) => {
    const [activePanel, setActivePanel] = useState<ActivePanel>('none');
    const [showOverflowMenu, setShowOverflowMenu] = useState(false);
    const [collapsedOps, setCollapsedOps] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState<AmfeFilterState>(EMPTY_FILTERS);
    const [showChangeAnalysis, setShowChangeAnalysis] = useState(false);
    const [showAudit, setShowAudit] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [viewMode, setViewMode] = useState<'view' | 'edit'>('edit');
    const isReadOnly = viewMode === 'view';
    const [headerCollapsed, setHeaderCollapsed] = useState(() => {
        try { return localStorage.getItem('amfe-header-collapsed') === 'true'; } catch { return false; }
    });
    const shortcutHints = useShortcutHints();

    // Panel convenience accessors
    const showProjectPanel = activePanel === 'projects';
    const showSummary = activePanel === 'summary';
    const showLibrary = activePanel === 'library';
    const showRegistry = activePanel === 'registry';
    const showTemplates = activePanel === 'templates';
    const setShowProjectPanel = (v: boolean) => setActivePanel(v ? 'projects' : 'none');
    const setShowSummary = (v: boolean) => setActivePanel(v ? 'summary' : 'none');
    const setShowLibrary = (v: boolean) => setActivePanel(v ? 'library' : 'none');
    const setShowRegistry = (v: boolean) => setActivePanel(v ? 'registry' : 'none');
    const setShowTemplates = (v: boolean) => setActivePanel(v ? 'templates' : 'none');

    // 1. Initialize AMFE Logic
    const amfe = useAmfe();

    // 1b. Undo/Redo history
    const history = useAmfeHistory(amfe.data);

    const handleUndo = useCallback(() => {
        const prev = history.undo();
        if (prev) amfe.loadData(prev);
    }, [history, amfe.loadData]);

    const handleRedo = useCallback(() => {
        const next = history.redo();
        if (next) amfe.loadData(next);
    }, [history, amfe.loadData]);

    // Confirmation modal state
    const confirm = useAmfeConfirm();

    // 2. Initialize Project Logic (wrap loadData to also reset undo history)
    const loadDataWithHistoryReset = useCallback((doc: AmfeDocument) => {
        amfe.loadData(doc);
        history.resetHistory(doc);
    }, [amfe.loadData, history]);

    const projects = useAmfeProjects(
        amfe.data,
        loadDataWithHistoryReset,
        amfe.resetData,
        confirm.requestConfirm
    );

    // 3. Initialize Auto-Save
    const persistence = useAmfePersistence({
        currentData: amfe.data,
        currentProject: projects.currentProject,
        isSaving: projects.saveStatus === 'saving',
    });

    // 4. Library
    const library = useAmfeLibrary();

    // 4b. Suggestion index (built from library for autocomplete)
    const suggestionIndex = useMemo(
        () => library.isLoaded ? buildSuggestionIndex(library.libraryOps) : null,
        [library.libraryOps, library.isLoaded]
    );

    // 4c. Soft limit warnings (for badge on summary button)
    const softLimitWarnings = useMemo(() => getSoftLimitWarnings(amfe.data), [amfe.data]);

    // 4d. AI suggestions enabled (read from settings on mount)
    const [aiEnabled, setAiEnabled] = useState(false);

    useEffect(() => {
        import('../../utils/settingsStore').then(({ loadSettings }) =>
            loadSettings().then(s => setAiEnabled(s.geminiEnabled && !!s.geminiApiKey))
        );
    }, []);

    // 5. Registry (IATF 16949 centralized index)
    const amfeRegistry = useAmfeRegistry();

    // 6. Column visibility toggles
    const colVis = useAmfeColumnVisibility();

    // 7. Draft recovery
    const { draftRecovery, handleRecoverDraft, handleDiscardDraft } = useAmfeDraftRecovery({
        currentProject: projects.currentProject,
        loadData: amfe.loadData,
        resetHistory: history.resetHistory,
        requestConfirm: confirm.requestConfirm,
    });

    // 8. Apply filters to operations
    const filteredOperations = useMemo(
        () => applyFilters(amfe.data.operations, filters),
        [amfe.data.operations, filters]
    );

    // 9. Tab navigation (CP + HO generation)
    const tabNav = useAmfeTabNavigation({
        data: amfe.data,
        currentProject: projects.currentProject,
        requestConfirm: confirm.requestConfirm,
    });

    // 10. Export (PDF + Excel)
    const amfeExport = useAmfeExport({
        data: amfe.data,
        requestConfirm: confirm.requestConfirm,
    });

    // 11. Network toast
    const { networkToast, clearNetworkToast } = useAmfeNetworkToast(projects.networkAvailable);

    // --- SAVE WITH AP=H COMPLIANCE WARNING ---
    const [apHWarning, setApHWarning] = useState<string | null>(null);

    const saveWithComplianceCheck = useCallback(async () => {
        if (projects.saveStatus === 'saving') return;

        const errors = getDocumentCompletionErrors(amfe.data);
        if (errors.length > 0) {
            setApHWarning(`${errors.length} causa${errors.length > 1 ? 's' : ''} AP=H sin acciones completas. Se recomienda completar antes de cerrar.`);
            setTimeout(() => setApHWarning(null), 5000);
        }
        await projects.saveCurrentProject();

        if (projects.currentProject) {
            try {
                await amfeRegistry.registerAmfe(projects.currentProject, amfe.data);
            } catch (err) {
                logger.warn('[AMFE] Registry update skipped:', err);
            }
        }
    }, [amfe.data, projects.saveCurrentProject, projects.currentProject, projects.saveStatus, amfeRegistry.registerAmfe]);

    useAmfeKeyboardShortcuts({
        onUndo: handleUndo,
        onRedo: handleRedo,
        onSave: saveWithComplianceCheck,
        onAddOperation: amfe.addOperation,
        filters,
        setFilters,
        showTemplates,
        setShowTemplates,
        showChat,
        setShowChat,
        showHelp,
        setShowHelp,
        showSummary,
        setShowSummary,
        setViewMode,
    });

    useAmfeBeforeUnload({ hasUnsavedChanges: projects.hasUnsavedChanges });

    // Close overflow menu on outside click
    useEffect(() => {
        if (!showOverflowMenu) return;
        const handleClick = () => setShowOverflowMenu(false);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [showOverflowMenu]);

    // --- HEADER UPDATES ---
    const handleHeaderChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        amfe.updateHeader(name as keyof AmfeHeaderData, value);
    }, [amfe.updateHeader]);

    // --- LIBRARY HANDLERS ---
    const handleImportFromLibrary = useCallback((libOpId: string) => {
        const newOp = library.importFromLibrary(libOpId);
        if (newOp) {
            const updated = { ...amfe.data, operations: [...amfe.data.operations, newOp] };
            amfe.loadData(updated);
        }
    }, [library.importFromLibrary, amfe.data, amfe.loadData]);

    const handleSyncOperation = useCallback((opId: string) => {
        const op = amfe.data.operations.find(o => o.id === opId);
        if (!op) return;
        const merged = library.syncFromLibrary(op);
        if (merged) {
            const updated = { ...amfe.data, operations: amfe.data.operations.map(o => o.id === opId ? merged : o) };
            amfe.loadData(updated);
        }
    }, [amfe.data, amfe.loadData, library.syncFromLibrary]);

    // --- TEMPLATE HANDLERS ---
    const handleApplyTemplate = useCallback(async (template: AmfeTemplate) => {
        const ok = await confirm.requestConfirm({
            title: 'Aplicar template',
            message: `Se agregará la operación "${template.name}" al AMFE. ¿Continuar?`,
            variant: 'info',
            confirmText: 'Aplicar',
        });
        if (!ok) return;
        const newOp = template.create();
        const updated = { ...amfe.data, operations: [...amfe.data.operations, newOp] };
        amfe.loadData(updated);
        setShowTemplates(false);
    }, [amfe.data, amfe.loadData, confirm.requestConfirm]);

    // --- UI HELPERS ---
    const toggleHeaderCollapsed = useCallback(() => {
        setHeaderCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem('amfe-header-collapsed', String(next)); } catch { /* ignore */ }
            return next;
        });
    }, []);

    const toggleCollapseOp = useCallback((opId: string) => {
        setCollapsedOps(prev => { const next = new Set(prev); if (next.has(opId)) next.delete(opId); else next.add(opId); return next; });
    }, []);
    const collapseAll = useCallback(() => {
        setCollapsedOps(new Set(amfe.data.operations.map(op => op.id)));
    }, [amfe.data.operations]);
    const expandAll = useCallback(() => setCollapsedOps(new Set()), []);

    // Common tab bar props
    const tabBarProps = {
        activeTab: tabNav.activeTab,
        onTabChange: tabNav.setActiveTab,
        cpInitialData: tabNav.cpInitialData,
        hoInitialData: tabNav.hoInitialData,
        onGenerateControlPlan: tabNav.handleGenerateControlPlan,
        onGenerateHojasOperaciones: tabNav.handleGenerateHojasOperaciones,
        onBackToLanding,
        hasUnsavedChanges: projects.hasUnsavedChanges,
        requestConfirm: confirm.requestConfirm,
    };

    // --- HOJA DE OPERACIONES TAB ---
    if (tabNav.activeTab === 'hojaOperaciones') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-sm">
                <AmfeTabBar {...tabBarProps} regenerateButton={{ label: 'Regenerar desde AMFE + CP', onClick: tabNav.handleGenerateHojasOperaciones, color: 'amber' }} />
                <Suspense fallback={<div className="flex-1 flex items-center justify-center text-gray-400"><div className="text-center"><div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-3" /><p className="text-xs">Cargando Hojas de Operaciones...</p></div></div>}>
                    {tabNav.hoWarnings.length > 0 && (
                        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
                            <div className="max-w-[1800px] mx-auto flex items-start gap-2">
                                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>{tabNav.hoWarnings.map((w, i) => <p key={i} className="text-xs text-amber-800">{w}</p>)}</div>
                                <button onClick={() => tabNav.setHoWarnings([])} className="ml-auto text-amber-400 hover:text-amber-600"><X size={14} /></button>
                            </div>
                        </div>
                    )}
                    <HojaOperacionesApp embedded initialData={tabNav.hoInitialData || undefined} />
                </Suspense>
                <ConfirmModal isOpen={confirm.confirmState.isOpen} onClose={confirm.handleCancel} onConfirm={confirm.handleConfirm} title={confirm.confirmState.title} message={confirm.confirmState.message} variant={confirm.confirmState.variant} confirmText={confirm.confirmState.confirmText} />
            </div>
        );
    }

    // --- CONTROL PLAN TAB ---
    if (tabNav.activeTab === 'controlPlan') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-sm">
                <AmfeTabBar {...tabBarProps} regenerateButton={{ label: 'Regenerar desde AMFE', onClick: tabNav.handleGenerateControlPlan, color: 'teal' }} />
                <Suspense fallback={<div className="flex-1 flex items-center justify-center text-gray-400"><div className="text-center"><div className="w-8 h-8 border-3 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-3" /><p className="text-xs">Cargando Plan de Control...</p></div></div>}>
                    {tabNav.cpWarnings.length > 0 && (
                        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
                            <div className="max-w-[1800px] mx-auto flex items-start gap-2">
                                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>{tabNav.cpWarnings.map((w, i) => <p key={i} className="text-xs text-amber-800">{w}</p>)}</div>
                                <button onClick={() => tabNav.setCpWarnings([])} className="ml-auto text-amber-400 hover:text-amber-600"><X size={14} /></button>
                            </div>
                        </div>
                    )}
                    <ControlPlanApp embedded initialData={tabNav.cpInitialData || undefined} amfeDoc={amfe.data} />
                </Suspense>
                <ConfirmModal isOpen={confirm.confirmState.isOpen} onClose={confirm.handleCancel} onConfirm={confirm.handleConfirm} title={confirm.confirmState.title} message={confirm.confirmState.message} variant={confirm.confirmState.variant} confirmText={confirm.confirmState.confirmText} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-sm">
            <AmfeToolbar
                tabNav={tabNav}
                projects={projects}
                lastAutoSave={persistence.lastAutoSave}
                requestConfirm={confirm.requestConfirm}
                onBackToLanding={onBackToLanding}
                viewMode={viewMode}
                setViewMode={setViewMode}
                activePanel={activePanel}
                showSummary={showSummary}
                setShowSummary={setShowSummary}
                showLibrary={showLibrary}
                setShowLibrary={setShowLibrary}
                showProjectPanel={showProjectPanel}
                setShowProjectPanel={setShowProjectPanel}
                setShowRegistry={setShowRegistry}
                setShowTemplates={setShowTemplates}
                showRegistry={showRegistry}
                showHelp={showHelp}
                showChat={showChat}
                setShowChangeAnalysis={setShowChangeAnalysis}
                setShowAudit={setShowAudit}
                setShowChat={setShowChat}
                setShowHelp={setShowHelp}
                canUndo={history.canUndo}
                canRedo={history.canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onSave={saveWithComplianceCheck}
                amfeExport={amfeExport}
                libraryRefresh={library.refresh}
                softLimitWarningCount={softLimitWarnings.length}
                showOverflowMenu={showOverflowMenu}
                setShowOverflowMenu={setShowOverflowMenu}
            />

            <AmfeSideDrawer
                activePanel={activePanel}
                setActivePanel={setActivePanel}
                projects={projects}
                data={amfe.data}
            />

            {/* Draft Recovery Banner */}
            {draftRecovery && (
                <div className="bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-blue-800">
                        <HardDrive size={14} className="text-blue-500" />
                        <span>Se encontro un borrador de <strong>"{draftRecovery.name}"</strong></span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleRecoverDraft}
                            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded font-medium transition">
                            Recuperar
                        </button>
                        <button onClick={handleDiscardDraft}
                            className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded font-medium transition">
                            Descartar
                        </button>
                    </div>
                </div>
            )}

            <AmfeStepProgressBar doc={amfe.data} />

            <AmfeHeaderForm
                header={amfe.data.header}
                onHeaderChange={handleHeaderChange}
                headerCollapsed={headerCollapsed}
                onToggleCollapsed={toggleHeaderCollapsed}
                readOnly={isReadOnly}
            />

            <AmfeFilters
                filters={filters}
                onFiltersChange={setFilters}
                operations={amfe.data.operations}
                columnVisibility={colVis.visibility}
                onToggleColumn={colVis.toggleGroup}
                isColumnDefault={colVis.isDefault}
                onShowAllColumns={colVis.showAll}
                hasCollapsed={collapsedOps.size > 0}
                onCollapseAll={collapseAll}
                onExpandAll={expandAll}
                readOnly={isReadOnly}
            />

            {/* Main Grid Area */}
            <div className="flex-grow p-4 pb-8">
                {!hasActiveFilters(filters) && filteredOperations.length === 0 ? (
                    <div className="bg-white shadow-lg rounded border border-gray-300 p-12 text-center">
                        <div className="max-w-md mx-auto">
                            <h3 className="text-lg font-bold text-gray-600 mb-2">Comenzar el AMFE</h3>
                            <p className="text-sm text-gray-400 mb-6">
                                Paso 2 AIAG-VDA: Definir la estructura del proceso agregando operaciones
                            </p>
                            <div className="flex flex-col gap-3 items-center">
                                <button onClick={amfe.addOperation}
                                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:bg-blue-700 transition text-sm">
                                    <Plus size={18} /> Agregar Primera Operación
                                </button>
                                <button onClick={() => setShowTemplates(true)}
                                    className="flex items-center gap-2 text-purple-600 hover:text-purple-800 px-4 py-2 rounded font-medium transition text-sm">
                                    <Layers size={16} /> Usar un Template
                                </button>
                            </div>
                        </div>
                    </div>
                ) : hasActiveFilters(filters) && filteredOperations.length === 0 ? (
                    <div className="bg-white shadow-lg rounded border border-gray-300 p-12 text-center text-gray-400">
                        <p className="text-sm">No se encontraron resultados con los filtros actuales.</p>
                    </div>
                ) : (
                    <div className="bg-white shadow-lg rounded border border-gray-300">
                        <div className={`overflow-x-auto overflow-y-auto ${isReadOnly ? 'max-h-[calc(100vh-200px)]' : 'max-h-[calc(100vh-220px)]'}`} style={{ scrollbarGutter: 'stable' }}>
                            <table className="border-collapse" style={{ minWidth: isReadOnly ? '2600px' : '2800px' }}>
                                <StickyColumnHeader visibility={colVis.visibility} />
                                <AmfeTableBody
                                    operations={filteredOperations}
                                    amfe={amfe}
                                    requestConfirm={confirm.requestConfirm}
                                    columnVisibility={colVis.visibility}
                                    suggestionIndex={suggestionIndex}
                                    aiEnabled={aiEnabled}
                                    collapsedOps={collapsedOps}
                                    onToggleCollapse={toggleCollapseOp}
                                    readOnly={isReadOnly}
                                />
                            </table>
                        </div>
                    </div>
                )}

                {!isReadOnly && (
                    <FloatingActionButton config={{
                        primary: { label: 'Agregar Operación', icon: Plus, onClick: amfe.addOperation, color: 'blue' },
                        secondary: [
                            { label: 'Operación Vacía', icon: Plus, onClick: amfe.addOperation, color: 'blue' },
                            { label: 'Desde Template', icon: Layers, onClick: () => setShowTemplates(true), color: 'purple' },
                        ]
                    }} />
                )}

                {showTemplates && (
                    <AmfeTemplatesModal
                        onApplyTemplate={handleApplyTemplate}
                        onClose={() => setShowTemplates(false)}
                    />
                )}

                <ShortcutHintsOverlay isVisible={shortcutHints.hintsVisible} />
            </div>

            {/* Library Side Panel */}
            {showLibrary && (
                <AmfeLibraryPanel
                    libraryOps={library.libraryOps}
                    filteredOps={library.filteredOps}
                    searchQuery={library.searchQuery}
                    onSearchChange={library.setSearchQuery}
                    categoryFilter={library.categoryFilter}
                    onCategoryChange={library.setCategoryFilter}
                    isLoaded={library.isLoaded}
                    networkAvailable={library.networkAvailable}
                    currentOperations={amfe.data.operations}
                    onImportFromLibrary={handleImportFromLibrary}
                    onSaveToLibrary={(op, desc, cat, tags) => library.saveToLibrary(op, desc, cat, tags)}
                    onUpdateInLibrary={(libOpId, op) => library.updateInLibrary(libOpId, op)}
                    onRemoveFromLibrary={(libOpId) => library.removeFromLibrary(libOpId)}
                    onSyncOperation={handleSyncOperation}
                    onScanImpact={library.scanImpact}
                    onBatchSync={library.batchSync}
                    isScanning={library.isScanning}
                    isSyncing={library.isSyncing}
                    onRefresh={library.refresh}
                    onClose={() => setShowLibrary(false)}
                />
            )}

            <AmfeModals
                confirmState={confirm.confirmState}
                onConfirm={confirm.handleConfirm}
                onCancel={confirm.handleCancel}
                showChangeAnalysis={showChangeAnalysis}
                setShowChangeAnalysis={setShowChangeAnalysis}
                showAudit={showAudit}
                setShowAudit={setShowAudit}
                showChat={showChat}
                setShowChat={setShowChat}
                onApplyChanges={(newDoc) => amfe.loadData(newDoc)}
                onSettingsChanged={setAiEnabled}
                showHelp={showHelp}
                setShowHelp={setShowHelp}
                promptState={projects.promptState}
                saveAsState={projects.saveAsState}
                pdfPreview={amfeExport.pdfPreview}
                isExportingPdf={amfeExport.isExportingPdf}
                onPdfExport={amfeExport.handlePdfExport}
                onClearPdfPreview={amfeExport.clearPdfPreview}
                loadError={projects.loadError}
                apHWarning={apHWarning}
                onClearApHWarning={() => setApHWarning(null)}
                networkToast={networkToast}
                onClearNetworkToast={clearNetworkToast}
                data={amfe.data}
            />
        </div>
    );
};

/** Wrapped in ErrorBoundary for production resilience */
const AmfeAppWithErrorBoundary: React.FC<AmfeAppProps> = (props) => (
    <ModuleErrorBoundary moduleName="AMFE VDA" onNavigateHome={props.onBackToLanding}>
        <AmfeApp {...props} />
    </ModuleErrorBoundary>
);

export default AmfeAppWithErrorBoundary;
