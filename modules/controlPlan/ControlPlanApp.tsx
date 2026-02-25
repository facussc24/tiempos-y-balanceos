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
import { ControlPlanDocument, ControlPlanHeader, ControlPlanItem, CONTROL_PLAN_PHASES, CP_COLUMNS } from './controlPlanTypes';
import { CpSuggestionField, CpSuggestionContext } from './cpSuggestionTypes';
import { createCpQueryFn } from './cpSuggestionEngine';
import { SuggestionQueryFn } from '../amfe/SuggestableTextarea';
import { validateCpAgainstAmfe, CpValidationIssue } from './cpCrossValidation';
import { CP_TEMPLATES } from './controlPlanTemplates';
import ControlPlanStickyHeader from './ControlPlanStickyHeader';
import ControlPlanTable from './ControlPlanTable';
import CpToolbar from './CpToolbar';
import CpValidationPanel from './CpValidationPanel';
import CpTemplateModal from './CpTemplateModal';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { PromptModal } from '../../components/modals/PromptModal';
import { ModuleErrorBoundary } from '../../components/ui/ModuleErrorBoundary';
import { Plus, XCircle, Sparkles } from 'lucide-react';
import { useShortcutHints } from '../../hooks/useShortcutHints';
import { ShortcutHintsOverlay } from '../../components/ui/ShortcutHintsOverlay';
import { useCpColumnVisibility } from './useCpColumnVisibility';
import { AmfeDocument } from '../amfe/amfeTypes';
import { logger } from '../../utils/logger';
import { useCpKeyboardShortcuts } from './useCpKeyboardShortcuts';
import { useCpFilters } from './useCpFilters';
import { useCpDraftRecovery } from './useCpDraftRecovery';

const CpChatPanel = lazy(() => import('./CpChatPanel'));
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
}

const ControlPlanApp: React.FC<Props> = ({ onBackToLanding, embedded, initialData, onDataChange, amfeDoc }) => {
    const [showProjectPanel, setShowProjectPanel] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [showOverflowMenu, setShowOverflowMenu] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [validationIssues, setValidationIssues] = useState<CpValidationIssue[] | null>(null);
    const [viewMode, setViewMode] = useState<'view' | 'edit'>('edit');
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
        if (prev) cp.loadData(prev);
    }, [history, cp.loadData]);

    const handleRedo = useCallback(() => {
        const next = history.redo();
        if (next) cp.loadData(next);
    }, [history, cp.loadData]);

    const projects = useControlPlanProjects(
        cp.data,
        cp.loadData,
        cp.resetData,
        confirm.requestConfirm
    );

    const persistence = useControlPlanPersistence({
        currentData: cp.data,
        currentProject: projects.currentProject,
        isSaving: projects.saveStatus === 'saving',
    });

    // Load initial data if provided (from AMFE generator)
    useEffect(() => {
        if (initialData) {
            cp.loadData(initialData);
            history.resetHistory(initialData);
        }
    }, [initialData]);

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

    // Keyboard shortcuts (extracted hook)
    useCpKeyboardShortcuts({
        onSave: projects.saveCurrentProject,
        onToggleChat: useCallback(() => setShowChat(prev => !prev), []),
        onToggleViewMode: useCallback(() => setViewMode(prev => prev === 'view' ? 'edit' : 'view'), []),
        onFocusSearch: useCallback(() => searchRef.current?.focus(), [searchRef]),
        onAddItem: cp.addItem,
        onUndo: handleUndo,
        onRedo: handleRedo,
        onToggleSummary: useCallback(() => setShowSummary(prev => !prev), []),
        onToggleHelp: useCallback(() => setShowHelp(prev => !prev), []),
        showChat, validationIssues, showSummary, showHelp, showTemplates,
        isReadOnly, setValidationIssues, setShowChat, setShowSummary, setShowHelp, setShowTemplates,
        showOverflowMenu, setShowOverflowMenu,
    });

    // AI suggestions state (reads global Gemini settings)
    const [aiEnabled, setAiEnabled] = useState(false);
    useEffect(() => {
        import('../../utils/settingsStore').then(({ loadSettings }) =>
            loadSettings().then(s => setAiEnabled(s.geminiEnabled && !!s.geminiApiKey))
        ).catch(err => logger.warn('[CP] Failed to load AI settings:', err));
    }, []);

    // Completion progress bar stats
    const completionStats = useMemo(() => {
        const requiredFields: (keyof ControlPlanItem)[] = [
            'processStepNumber', 'processDescription', 'productCharacteristic',
            'sampleSize', 'controlMethod', 'reactionPlan', 'reactionPlanOwner'
        ];
        const total = cp.data.items.length * requiredFields.length;
        if (total === 0) return { percent: 0, filled: 0, total: 0 };
        const filled = cp.data.items.reduce((acc, item) => {
            return acc + requiredFields.filter(f => ((item[f] as string) || '').trim() !== '').length;
        }, 0);
        return { percent: Math.round((filled / total) * 100), filled, total };
    }, [cp.data.items]);

    // Factory to create queryFn closures for each CP item + field.
    const phaseRef = useRef(cp.data.header.phase);
    phaseRef.current = cp.data.header.phase;

    const buildQueryFn = useCallback((item: ControlPlanItem, field: CpSuggestionField): SuggestionQueryFn => {
        const context: CpSuggestionContext = {
            processDescription: item.processDescription,
            machineDeviceTool: item.machineDeviceTool,
            productCharacteristic: item.productCharacteristic,
            processCharacteristic: item.processCharacteristic,
            specialCharClass: item.specialCharClass,
            specification: item.specification,
            controlMethod: item.controlMethod,
            evaluationTechnique: item.evaluationTechnique,
            amfeAp: item.amfeAp,
            amfeSeverity: item.amfeSeverity,
            phase: phaseRef.current,
            operationCategory: item.operationCategory,
        };
        return createCpQueryFn(field, context);
    }, []);

    const handleHeaderChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        cp.updateHeader(name as keyof ControlPlanHeader, value);
    }, [cp.updateHeader]);

    const handleChatApply = useCallback((newDoc: ControlPlanDocument) => {
        cp.loadData(newDoc);
        history.resetHistory(newDoc);
    }, [cp.loadData, history]);

    const handleApplyTemplate = useCallback((templateId: string) => {
        const template = CP_TEMPLATES.find(t => t.id === templateId);
        if (!template) return;
        const newItems = template.create();
        const updatedDoc: ControlPlanDocument = {
            ...cp.data,
            items: [...cp.data.items, ...newItems],
        };
        cp.loadData(updatedDoc);
        setShowTemplates(false);
    }, [cp.data, cp.loadData]);

    const handleJumpToItem = useCallback((itemId?: string) => {
        if (!itemId) return;
        const el = document.querySelector(`[data-item-id="${itemId}"]`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-amber-400');
        setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 2000);
    }, []);

    const handleRunValidation = useCallback(() => {
        try {
            const issues = validateCpAgainstAmfe(cp.data, amfeDoc);
            setValidationIssues(issues);
        } catch (error) {
            logger.error('[CP] Validation failed:', error);
            setValidationIssues([{
                severity: 'error',
                code: 'VALIDATION_ERROR',
                message: `Error al validar: ${error instanceof Error ? error.message : 'Error desconocido'}`,
            }]);
        }
    }, [cp.data, amfeDoc]);

    const inputClass = "w-full border border-gray-300 bg-gray-50 p-2 rounded focus:ring-2 focus:ring-teal-100 focus:border-teal-400 outline-none transition";

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
            setTimeout(() => URL.revokeObjectURL(href), 1500);
        } catch (err) {
            logger.error('[CP] JSON export failed:', err);
            alert('Error al exportar JSON.');
        }
    }, [cp.data]);

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
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-sm">
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
                setShowChat={setShowChat}
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
                requestConfirm={confirm.requestConfirm}
            />

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
                <div className="bg-white shadow-lg rounded border border-gray-300">
                    <div className={`overflow-x-auto overflow-y-auto ${tableMaxH}`} style={{ scrollbarGutter: 'stable' }}>
                        <table className="border-collapse table-fixed" style={{ width: '1794px' }}>
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
                                onRemoveItem={cp.removeItem}
                                onMoveItem={cp.moveItem}
                                aiEnabled={aiEnabled}
                                buildQueryFn={buildQueryFn}
                                readOnly={isReadOnly}
                                columnVisibility={colVis.visibility}
                            />
                        </table>
                    </div>
                </div>

                {/* Validation Results Panel */}
                {validationIssues && (
                    <CpValidationPanel
                        issues={validationIssues}
                        onClose={() => setValidationIssues(null)}
                        onJumpToItem={handleJumpToItem}
                    />
                )}

                {/* FABs */}
                <div className="fixed bottom-14 right-8 z-40 flex flex-col gap-3 items-end">
                    {embedded && (
                        <button onClick={() => setShowChat(true)}
                            className="bg-teal-600 hover:bg-teal-500 text-white rounded-full p-3 shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
                            title="Copiloto IA (Ctrl+I)">
                            <Sparkles size={20} />
                            <span className="font-bold pr-1 text-sm">Copiloto</span>
                        </button>
                    )}
                    {!isReadOnly && (
                        <button onClick={cp.addItem}
                            className="bg-teal-600 hover:bg-teal-500 text-white rounded-full p-3 shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
                            data-shortcut="Ctrl+N">
                            <Plus size={20} />
                            <span className="font-bold pr-1 text-sm">Agregar Item</span>
                        </button>
                    )}
                </div>

                {/* Footer */}
                {!embedded && (
                    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t p-2 text-center text-xs text-gray-500 z-30">
                        <strong>{cp.data.items.length}</strong> items · {completionStats.percent}% completo |
                        Mantene <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Alt</kbd> para ver atajos
                        {projects.currentProject && <span className="ml-4 text-gray-400">Proyecto: <strong className="text-teal-600">{projects.currentProject}</strong></span>}
                    </div>
                )}
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

            {/* Load Error Toast */}
            {projects.loadError && (
                <div className="fixed bottom-4 left-4 z-50 bg-red-50 border border-red-300 rounded-lg shadow-lg p-3 max-w-sm animate-in slide-in-from-bottom-4">
                    <div className="flex items-start gap-2">
                        <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700">{projects.loadError}</p>
                    </div>
                </div>
            )}

            {/* CP Chat Copilot */}
            {showChat && (
                <ModuleErrorBoundary moduleName="Chat Copilot" fallback={
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl p-6 max-w-sm text-center shadow-xl">
                            <XCircle size={32} className="text-red-400 mx-auto mb-3" />
                            <p className="text-sm text-gray-700 mb-4">Error al cargar el Chat Copilot.</p>
                            <button onClick={() => setShowChat(false)}
                                className="px-4 py-2 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition">
                                Cerrar
                            </button>
                        </div>
                    </div>
                }>
                    <Suspense fallback={null}>
                        <CpChatPanel
                            doc={cp.data}
                            amfeDoc={amfeDoc}
                            onApplyChanges={handleChatApply}
                            onClose={() => setShowChat(false)}
                            onSettingsChanged={(enabled) => setAiEnabled(enabled)}
                        />
                    </Suspense>
                </ModuleErrorBoundary>
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

            {/* Shortcut Hints Overlay */}
            <ShortcutHintsOverlay isVisible={shortcutHints.hintsVisible} />
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
