import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useAmfe } from './useAmfe';
import { toast } from '../../components/ui/Toast';
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
import { RevisionPromptModal } from '../../components/modals/RevisionPromptModal';
import { CrossDocAlertBanner } from '../../components/ui/CrossDocAlertBanner';
import { RevisionHistoryPanel } from '../../components/layout/RevisionHistoryPanel';
import { useRevisionControl } from '../../hooks/useRevisionControl';
import { useDocumentLock } from '../../hooks/useDocumentLock';
import DocumentLockBanner from '../../components/ui/DocumentLockBanner';
import { useCrossDocAlerts } from '../../hooks/useCrossDocAlerts';
import { LinkValidationPanel } from '../../components/ui/LinkValidationPanel';
import { validatePfdAmfeLinks, getBrokenAmfeOperationIds, getRelinkCandidates } from '../../utils/pfdAmfeLinkValidation';
import { getNextRevisionLevel } from '../../utils/revisionUtils';
import { Plus, Layers, HardDrive, AlertTriangle, X, FileInput } from 'lucide-react';
import { AmfeDocument, AmfeHeaderData } from './amfeTypes';
import { importAmfeOpsFromPfd } from './amfePfdImport';
import { useAmfeRegistry } from './useAmfeRegistry';
import { useAmfeColumnVisibility } from './useAmfeColumnVisibility';
import { AmfeTemplate } from './amfeTemplates';
import { createExampleAmfeDocument, createPatagoniaAmfeDocument } from './amfeExampleModel';
import { createPatagoniaTapizadoTemplate } from '../pfd/pfdTemplates';
import { EMPTY_PFD_HEADER } from '../pfd/pfdTypes';
import { generateControlPlanFromAmfe } from '../controlPlan/controlPlanGenerator';
import { getPatagoniaManualCpItems } from '../controlPlan/controlPlanPatagoniaTemplate';
import { createPatagoniaHoDocument } from '../hojaOperaciones/hojaOperacionesPatagoniaTemplate';
import { ModuleErrorBoundary } from '../../components/ui/ModuleErrorBoundary';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';
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
import { useAmfeTabNavigation, ActiveTab } from './useAmfeTabNavigation';
import { useLinkedDocuments } from './useLinkedDocuments';
import LinkedDocumentsPanel from './LinkedDocumentsPanel';
import { useOpenExportFolder } from '../../hooks/useOpenExportFolder';
import { useInheritanceStatus } from '../../hooks/useInheritanceStatus';
import { detectSyncAlerts, applySyncAlertToCp, type SyncAlert } from '../controlPlan/cpSyncEngine';

const CpSyncPanel = lazy(() => import('../controlPlan/CpSyncPanel'));
const PfdApp = lazy(() => import('../pfd/PfdApp'));
const PfdGenerationWizard = lazy(() => import('../pfd/PfdGenerationWizard'));
const ControlPlanApp = lazy(() => import('../controlPlan/ControlPlanApp'));
const HojaOperacionesApp = lazy(() => import('../hojaOperaciones/HojaOperacionesApp'));

interface AmfeAppProps {
    onBackToLanding: () => void;
    /** Initial tab to show (e.g. 'pfd' when entering PFD from landing page) */
    initialTab?: 'pfd' | 'amfe' | 'controlPlan' | 'hojaOperaciones';
}

/**
 * CRITICAL DESIGN REQUIREMENT:
 * The UI must maintain the "VDA Table" format (Sabana).
 * Do NOT replace this with a Wizard/Step View.
 * The 6M Structure (Work Elements) must be integrated into this table view.
 */
type ActivePanel = 'none' | 'projects' | 'summary' | 'library' | 'registry' | 'templates';

const AmfeApp: React.FC<AmfeAppProps> = ({ onBackToLanding, initialTab }) => {
    const [activePanel, setActivePanel] = useState<ActivePanel>('none');
    const [showOverflowMenu, setShowOverflowMenu] = useState(false);
    const [collapsedOps, setCollapsedOps] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState<AmfeFilterState>(EMPTY_FILTERS);
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
        if (prev) {
            amfe.loadData(prev);
            toast.success('Deshacer', history.undoCount > 0 ? `${history.undoCount} cambios restantes` : undefined);
        }
    }, [history, amfe.loadData]);

    const handleRedo = useCallback(() => {
        const next = history.redo();
        if (next) {
            amfe.loadData(next);
            toast.success('Rehacer', history.redoCount > 0 ? `${history.redoCount} cambios restantes` : undefined);
        }
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

    // Cross-user edit lock
    const documentLock = useDocumentLock(projects.currentProject, 'amfe');

    // 3. Initialize Auto-Save
    const persistence = useAmfePersistence({
        currentData: amfe.data,
        currentProject: projects.currentProject,
        isSaving: projects.saveStatus === 'saving',
    });

    // 3b. Normalize project_names at startup (one-time repair)
    useEffect(() => {
        let cancelled = false;
        import('./amfePathManager').then(async ({ normalizeProjectNames, repairMisplacedProjectSuffix }) => {
            const count1 = await normalizeProjectNames();
            const count2 = await repairMisplacedProjectSuffix();
            if (!cancelled && (count1 + count2) > 0) projects.refreshClients();
        }).catch(err => {
            logger.warn('AmfeApp', 'Project name normalization failed (non-critical)', {
                error: err instanceof Error ? err.message : String(err),
            });
        });
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // 4. Library
    const library = useAmfeLibrary();

    // 4b. Suggestion index (deferred to avoid blocking initial render)
    const [suggestionIndex, setSuggestionIndex] = useState<ReturnType<typeof buildSuggestionIndex> | null>(null);
    const suggestionIndexTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!library.isLoaded) { setSuggestionIndex(null); return; }
        // Defer index building so the table renders first (0ms = next tick, non-blocking)
        suggestionIndexTimerRef.current = setTimeout(() => {
            setSuggestionIndex(buildSuggestionIndex(library.libraryOps));
        }, 0);
        return () => { if (suggestionIndexTimerRef.current) clearTimeout(suggestionIndexTimerRef.current); };
    }, [library.libraryOps, library.isLoaded]);

    // 4c. Soft limit warnings (for badge on summary button)
    const softLimitWarnings = useMemo(() => getSoftLimitWarnings(amfe.data), [amfe.data]);


    // 4e. Revision control
    const revisionControl = useRevisionControl({
        module: 'amfe',
        documentId: projects.currentProject,
        currentData: amfe.data,
        currentRevisionLevel: amfe.data.header.revision || 'A',
        onRevisionCreated: (newLevel) => {
            amfe.updateHeader('revision', newLevel);
        },
    });

    // 4f. Cross-document alerts
    const crossDocAlerts = useCrossDocAlerts('amfe', projects.currentProject);

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
        initialTab,
    });

    // 9a. Linked documents panel (CP, PFD, HO associated with this AMFE project)
    const linkedDocs = useLinkedDocuments(projects.currentProject, amfe.data);

    // 9b. PFD ↔ AMFE link integrity validation (uses in-memory PFD from tab nav)
    const linkValidation = useMemo(
        () => validatePfdAmfeLinks(tabNav.pfdInitialData, amfe.data),
        [tabNav.pfdInitialData, amfe.data],
    );
    const brokenAmfeOpIds = useMemo(() => getBrokenAmfeOperationIds(linkValidation), [linkValidation]);
    const linkCandidates = useMemo(
        () => tabNav.pfdInitialData && amfe.data ? getRelinkCandidates(tabNav.pfdInitialData, amfe.data) : { amfeCandidates: [], pfdCandidates: [] },
        [tabNav.pfdInitialData, amfe.data],
    );
    const [showLinkPanel, setShowLinkPanel] = useState(false);

    // 9c. Inheritance status for variant documents
    const amfeOperationIds = useMemo(() => amfe.data.operations.map(op => op.id), [amfe.data.operations]);
    const inheritanceStatus = useInheritanceStatus(projects.currentProject, amfeOperationIds);

    // 10. Export (PDF + Excel)
    const amfeExport = useAmfeExport({
        data: amfe.data,
        loadData: amfe.loadData,
        resetHistory: history.resetHistory,
        requestConfirm: confirm.requestConfirm,
    });

    // 11. Network toast
    const { networkToast, clearNetworkToast } = useAmfeNetworkToast(projects.networkAvailable);

    // 12. Export folder
    const exportFolder = useOpenExportFolder('amfe', amfe.data);

    // 13. AMFE ↔ CP Sync alerts (rule-based, free, instant)
    const [showSyncPanel, setShowSyncPanel] = useState(false);
    const [dismissedSyncAlerts, setDismissedSyncAlerts] = useState<Set<string>>(new Set());
    const syncAlerts = useMemo(() => {
        if (!tabNav.cpInitialData || !amfe.data.operations.length) return [];
        return detectSyncAlerts(amfe.data, tabNav.cpInitialData);
    }, [amfe.data, tabNav.cpInitialData]);
    const activeSyncAlerts = useMemo(
        () => syncAlerts.filter(a => !dismissedSyncAlerts.has(a.id)),
        [syncAlerts, dismissedSyncAlerts]
    );
    const handleDismissSyncAlert = useCallback((alertId: string) => {
        setDismissedSyncAlerts(prev => new Set([...prev, alertId]));
    }, []);
    const handleDismissAllSyncAlerts = useCallback(() => {
        setDismissedSyncAlerts(new Set(syncAlerts.map(a => a.id)));
    }, [syncAlerts]);
    const handleApplySyncAlert = useCallback((_alert: SyncAlert) => {
        if (_alert.patch && tabNav.cpInitialData) {
            const updated = applySyncAlertToCp(tabNav.cpInitialData, _alert);
            if (updated) {
                tabNav.setCpInitialData(updated);
                toast.success('Corrección aplicada', _alert.suggestedAction || 'CP actualizado.');
                setDismissedSyncAlerts(prev => new Set([...prev, _alert.id]));
                return;
            }
        }
        // Fallback: just dismiss with info
        if (_alert.suggestedAction) {
            toast.info('Acción manual requerida', _alert.suggestedAction);
        }
        setDismissedSyncAlerts(prev => new Set([...prev, _alert.id]));
    }, [tabNav.cpInitialData, tabNav.setCpInitialData]);

    // --- SAVE WITH AP=H COMPLIANCE WARNING ---
    const [apHWarning, setApHWarning] = useState<string | null>(null);
    const apHWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => { if (apHWarningTimerRef.current) clearTimeout(apHWarningTimerRef.current); };
    }, []);

    const saveWithComplianceCheck = useCallback(async () => {
        if (projects.saveStatus === 'saving') return;

        const errors = getDocumentCompletionErrors(amfe.data);
        if (errors.length > 0) {
            setApHWarning(`${errors.length} causa${errors.length > 1 ? 's' : ''} AP=H sin acciones completas. Se recomienda completar antes de cerrar.`);
            if (apHWarningTimerRef.current) clearTimeout(apHWarningTimerRef.current);
            apHWarningTimerRef.current = setTimeout(() => setApHWarning(null), 5000);
        }
        await projects.saveCurrentProject();

        if (projects.currentProject) {
            try {
                await amfeRegistry.registerAmfe(projects.currentProject, amfe.data);
            } catch (err) {
                logger.warn('AMFE', 'Registry update skipped', { error: err instanceof Error ? err.message : String(err) });
            }
        }
    }, [amfe.data, projects.saveCurrentProject, projects.currentProject, projects.saveStatus, amfeRegistry.registerAmfe]);

    // --- IMPORT FROM PFD ---
    const handleUnlinkAmfeOp = useCallback((operationId: string) => {
        amfe.updateOp(operationId, 'linkedPfdStepId', undefined as unknown as string);
    }, [amfe]);

    const handleRelinkAmfeOp = useCallback((operationId: string, newPfdStepId: string) => {
        amfe.updateOp(operationId, 'linkedPfdStepId', newPfdStepId);
    }, [amfe]);

    const handleImportFromPfd = useCallback(async () => {
        if (!tabNav.pfdInitialData) {
            toast.info('Sin PFD', 'Primero genera o importa un Diagrama de Flujo.');
            return;
        }
        const result = importAmfeOpsFromPfd(tabNav.pfdInitialData, amfe.data.operations);
        if (result.operations.length === 0) {
            toast.info('Nada que importar', result.warnings.join(' '));
            return;
        }
        const msg = result.warnings.join('\n') +
            '\n\n¿Importar ' + result.operations.length + ' operación(es)?';
        const ok = await confirm.requestConfirm({
            title: 'Importar desde Diagrama de Flujo',
            message: msg,
            variant: 'info',
            confirmText: 'Importar',
        });
        if (!ok) return;
        amfe.batchAddOperations(result.operations);
        // Set back-references on PFD steps
        const updatedPfd = {
            ...tabNav.pfdInitialData,
            steps: tabNav.pfdInitialData.steps.map(step => {
                const amfeOpId = result.linkMap.get(step.id);
                if (amfeOpId) return { ...step, linkedAmfeOperationId: amfeOpId };
                return step;
            }),
            updatedAt: new Date().toISOString(),
        };
        tabNav.setPfdInitialData(updatedPfd);
        toast.success('Importación completada', result.warnings.join(' '));
    }, [tabNav.pfdInitialData, amfe.data.operations, amfe.batchAddOperations, confirm.requestConfirm, tabNav.setPfdInitialData]);

    // Disable AMFE shortcuts when a child module tab is active (PFD, CP, HO)
    // to prevent Ctrl+S/Ctrl+N/Escape conflicts with child module shortcuts
    useAmfeKeyboardShortcuts({
        onUndo: handleUndo,
        onRedo: handleRedo,
        onSave: saveWithComplianceCheck,
        onAddOperation: amfe.addOperation,
        filters,
        setFilters,
        showTemplates,
        setShowTemplates,
        showHelp,
        setShowHelp,
        showSummary,
        setShowSummary,
        setViewMode,
        disabled: tabNav.activeTab !== 'amfe',
    });

    useAmfeBeforeUnload({ hasUnsavedChanges: projects.hasUnsavedChanges });

    // Auto-save to network drive (2s debounce after change detection)
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        // Only auto-save when: project loaded, changes exist, not already saving, network available
        if (!projects.currentProjectRef || !projects.hasUnsavedChanges ||
            projects.saveStatus === 'saving' || !projects.networkAvailable) {
            return;
        }
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            projects.saveCurrentProject();
        }, 2000);
        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projects.hasUnsavedChanges, projects.currentProjectRef, projects.saveStatus, projects.networkAvailable]);

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

    const handleProductSelect = useCallback((fields: Partial<AmfeHeaderData>) => {
        Object.entries(fields).forEach(([key, value]) => {
            amfe.updateHeader(key as keyof AmfeHeaderData, value as string);
        });
    }, [amfe.updateHeader]);

    // --- LIBRARY HANDLERS ---
    const handleImportFromLibrary = useCallback((libOpId: string) => {
        // Guard: prevent importing a library op that's already linked in this document
        const alreadyLinked = amfe.data.operations.some(op => op.linkedLibraryOpId === libOpId);
        if (alreadyLinked) return;

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

    // Load full example AMFE document (replaces current document)
    const handleLoadFullExample = useCallback(async () => {
        const hasData = amfe.data.operations.length > 0;
        if (hasData) {
            const ok = await confirm.requestConfirm({
                title: 'Cargar AMFE de ejemplo',
                message: 'Se reemplazará el AMFE actual con un documento de ejemplo completo (Subchasis Soldado, 3 operaciones). ¿Continuar?',
                variant: 'warning',
                confirmText: 'Cargar Ejemplo',
            });
            if (!ok) return;
        }
        const exampleDoc = createExampleAmfeDocument();
        amfe.loadData(exampleDoc);
        setShowTemplates(false);
        logger.info('AmfeApp', 'Loaded full example AMFE document');
    }, [amfe.data.operations.length, amfe.loadData, confirm.requestConfirm]);

    // Load PATAGONIA tapizado — ALL 4 documents at once (AMFE + PFD + CP + HO)
    const handleLoadPatagoniaExample = useCallback(async () => {
        const hasData = amfe.data.operations.length > 0;
        if (hasData) {
            const ok = await confirm.requestConfirm({
                title: 'Cargar INSERTO PATAGONIA — VWA (4 documentos)',
                message: 'Se cargarán los 4 documentos APQP del INSERTO PATAGONIA:\n• AMFE (22 operaciones)\n• Diagrama de Flujo (38 pasos)\n• Plan de Control (auto + 9 ítems manuales)\n• Hojas de Operaciones (22 hojas)\n\nSe reemplazará todo el contenido actual. ¿Continuar?',
                variant: 'warning',
                confirmText: 'Cargar INSERTO PATAGONIA',
            });
            if (!ok) return;
        }

        // 1. AMFE — 22 operaciones completas
        const patagoniaDoc = createPatagoniaAmfeDocument();
        amfe.loadData(patagoniaDoc);

        // 2. PFD — 38 pasos con ramas paralelas, decisiones y retrabajo
        const pfdTemplate = createPatagoniaTapizadoTemplate();
        const pfdDoc = {
            id: crypto.randomUUID(),
            header: { ...EMPTY_PFD_HEADER, ...(pfdTemplate.header || {}) },
            steps: pfdTemplate.steps,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        tabNav.setPfdInitialData(pfdDoc);

        // 3. CP — auto-generated from AMFE + 9 manual items
        const { document: cpDoc } = generateControlPlanFromAmfe(patagoniaDoc, 'PATAGONIA - INSERTO');
        const manualItems = getPatagoniaManualCpItems();
        cpDoc.items = [...cpDoc.items, ...manualItems];
        // Sort all items by operation number
        cpDoc.items.sort((a, b) => {
            const numA = parseInt(a.processStepNumber) || 0;
            const numB = parseInt(b.processStepNumber) || 0;
            return numA - numB;
        });
        tabNav.setCpInitialData(cpDoc);

        // 4. HO — 22 sheets (5 with full detail from PDF)
        const hoDoc = createPatagoniaHoDocument();
        tabNav.setHoInitialData(hoDoc);

        setShowTemplates(false);
        logger.info('AmfeApp', 'Loaded PATAGONIA complete APQP package: AMFE + PFD + CP + HO');
    }, [amfe.data.operations.length, amfe.loadData, confirm.requestConfirm, tabNav]);

    // Auto-expand header when creating a new blank document
    useEffect(() => {
        if (!projects.currentProject && amfe.data.operations.length === 0) {
            setHeaderCollapsed(false);
        }
    }, [projects.currentProject, amfe.data.operations.length]);

    // Auto-collapse operations for large documents (>200 total causes) on project load
    const autoCollapseProjectRef = useRef<string | null>(null);
    useEffect(() => {
        const projectKey = projects.currentProject || '';
        if (autoCollapseProjectRef.current === projectKey) return;
        if (!projectKey || amfe.data.operations.length === 0) return;
        autoCollapseProjectRef.current = projectKey;
        let totalCauses = 0;
        for (const op of amfe.data.operations) {
            for (const we of op.workElements) {
                for (const func of we.functions) {
                    for (const fail of func.failures) {
                        totalCauses += fail.causes.length;
                    }
                }
            }
            if (totalCauses > 200) break;
        }
        if (totalCauses > 200) {
            setCollapsedOps(new Set(amfe.data.operations.map(op => op.id)));
        }
    }, [projects.currentProject, amfe.data.operations]);

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

    // Check if a saved CP exists for this AMFE project
    const [hasSavedCp, setHasSavedCp] = useState(false);
    useEffect(() => {
        if (!projects.currentProject) { setHasSavedCp(false); return; }
        let cancelled = false;
        import('../../utils/repositories/cpRepository').then(({ loadCpByAmfeProject }) =>
            loadCpByAmfeProject(projects.currentProject!).then(result => {
                if (!cancelled) setHasSavedCp(!!result);
            })
        ).catch(() => { if (!cancelled) setHasSavedCp(false); });
        return () => { cancelled = true; };
    }, [projects.currentProject]);

    // Project context for the tab bar (shows family/part across all tabs)
    const projectContext = useMemo(() => ({
        projectName: projects.currentProject || undefined,
        clientName: amfe.data.header.client || undefined,
        partName: amfe.data.header.subject || undefined,
        partNumber: amfe.data.header.partNumber || undefined,
    }), [projects.currentProject, amfe.data.header.client, amfe.data.header.subject, amfe.data.header.partNumber]);

    // Common tab bar props
    const tabBarProps = {
        activeTab: tabNav.activeTab,
        onTabChange: tabNav.setActiveTab,
        pfdInitialData: tabNav.pfdInitialData,
        onGeneratePfd: tabNav.handleGeneratePfd,
        onImportPfdFromAmfe: tabNav.handleImportPfdFromAmfe,
        cpInitialData: tabNav.cpInitialData,
        hoInitialData: tabNav.hoInitialData,
        onGenerateControlPlan: tabNav.handleGenerateControlPlan,
        onGenerateHojasOperaciones: tabNav.handleGenerateHojasOperaciones,
        onBackToLanding,
        hasUnsavedChanges: projects.hasUnsavedChanges,
        requestConfirm: confirm.requestConfirm,
        hasSavedCp,
        amfeOperationCount: amfe.data.operations.length,
        projectContext,
        onOpenTemplates: () => setShowTemplates(true),
    };

    const isAmfeActive = tabNav.activeTab === 'amfe';

    // Track visited tabs to keep them mounted via display:none after first visit
    // This eliminates remount cost on subsequent tab switches (<300ms → instant)
    const [mountedTabs, setMountedTabs] = useState<Set<ActiveTab>>(() => new Set(['amfe']));
    useEffect(() => {
        setMountedTabs(prev => {
            if (prev.has(tabNav.activeTab)) return prev;
            return new Set([...prev, tabNav.activeTab]);
        });
    }, [tabNav.activeTab]);

    // Cuando el tab AMFE vuelve a ser visible, disparar evento para que
    // AutoResizeTextarea recalcule alturas (scrollHeight=0 con display:none)
    useEffect(() => {
        if (isAmfeActive) {
            requestAnimationFrame(() => {
                document.dispatchEvent(new Event('amfe-tab-visible'));
            });
        }
    }, [isAmfeActive]);

    return (
        <>
        {/* --- PFD (DIAGRAMA DE FLUJO) TAB --- mount once, then display:none */}
        {(tabNav.activeTab === 'pfd' || mountedTabs.has('pfd')) && (
            <div className="h-screen bg-gray-50 flex flex-col font-sans text-sm overflow-hidden"
                 style={{ display: tabNav.activeTab === 'pfd' ? undefined : 'none' }}>
                <AmfeTabBar {...tabBarProps} />
                <div className="flex-1 overflow-auto">
                    <ModuleErrorBoundary moduleName="Diagrama de Flujo" onNavigateHome={() => tabNav.setActiveTab('amfe')}>
                    <Suspense fallback={<LoadingOverlay message="Cargando Diagrama de Flujo..." accentColor="text-cyan-600" showSkeleton={false} />}>
                        {tabNav.pfdWarnings.length > 0 && (
                            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
                                <div className="max-w-[1800px] mx-auto flex items-start gap-2">
                                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>{tabNav.pfdWarnings.map((w, i) => <p key={i} className="text-xs text-amber-800">{w}</p>)}</div>
                                    <button onClick={() => tabNav.setPfdWarnings([])} className="ml-auto text-amber-400 hover:text-amber-600 transition" aria-label="Cerrar advertencias"><X size={14} /></button>
                                </div>
                            </div>
                        )}
                        <PfdApp embedded initialData={tabNav.pfdInitialData || undefined} />
                    </Suspense>
                    </ModuleErrorBoundary>
                </div>
            </div>
        )}

        {/* --- HOJA DE OPERACIONES TAB --- mount once, then display:none */}
        {(tabNav.activeTab === 'hojaOperaciones' || mountedTabs.has('hojaOperaciones')) && (
            <div className="h-screen bg-gray-50 flex flex-col font-sans text-sm overflow-hidden"
                 style={{ display: tabNav.activeTab === 'hojaOperaciones' ? undefined : 'none' }}>
                <AmfeTabBar {...tabBarProps} />
                <div className="flex-1 overflow-auto">
                    <ModuleErrorBoundary moduleName="Hojas de Operaciones" onNavigateHome={() => tabNav.setActiveTab('amfe')}>
                    <Suspense fallback={<LoadingOverlay message="Cargando Hojas de Operaciones..." accentColor="text-[#1e3a5f]" showSkeleton={false} />}>
                        {tabNav.hoWarnings.length > 0 && (
                            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
                                <div className="max-w-[1800px] mx-auto flex items-start gap-2">
                                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>{tabNav.hoWarnings.map((w, i) => <p key={i} className="text-xs text-amber-800">{w}</p>)}</div>
                                    <button onClick={() => tabNav.setHoWarnings([])} className="ml-auto text-amber-400 hover:text-amber-600 transition" aria-label="Cerrar advertencias"><X size={14} /></button>
                                </div>
                            </div>
                        )}
                        <HojaOperacionesApp embedded initialData={tabNav.hoInitialData || undefined} />
                    </Suspense>
                    </ModuleErrorBoundary>
                </div>
            </div>
        )}

        {/* --- CONTROL PLAN TAB --- mount once, then display:none */}
        {(tabNav.activeTab === 'controlPlan' || mountedTabs.has('controlPlan')) && (
            <div className="h-screen bg-gray-50 flex flex-col font-sans text-sm overflow-hidden"
                 style={{ display: tabNav.activeTab === 'controlPlan' ? undefined : 'none' }}>
                <AmfeTabBar {...tabBarProps} />
                <div className="flex-1 overflow-auto">
                    <ModuleErrorBoundary moduleName="Plan de Control" onNavigateHome={() => tabNav.setActiveTab('amfe')}>
                    <Suspense fallback={<LoadingOverlay message="Cargando Plan de Control..." accentColor="text-green-600" showSkeleton={false} />}>
                        {tabNav.cpWarnings.length > 0 && (
                            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
                                <div className="max-w-[1800px] mx-auto flex items-start gap-2">
                                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>{tabNav.cpWarnings.map((w, i) => <p key={i} className="text-xs text-amber-800">{w}</p>)}</div>
                                    <button onClick={() => tabNav.setCpWarnings([])} className="ml-auto text-amber-400 hover:text-amber-600 transition" aria-label="Cerrar advertencias"><X size={14} /></button>
                                </div>
                            </div>
                        )}
                        {/* Sync alert banner */}
                        {activeSyncAlerts.length > 0 && (
                            <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5">
                                <div className="max-w-[1800px] mx-auto flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-blue-600 flex-shrink-0" />
                                    <p className="text-xs text-blue-800 font-medium">
                                        {activeSyncAlerts.length} cambio{activeSyncAlerts.length !== 1 ? 's' : ''} detectado{activeSyncAlerts.length !== 1 ? 's' : ''} en el AMFE que afectan este Plan de Control.
                                    </p>
                                    <button
                                        onClick={() => setShowSyncPanel(true)}
                                        className="ml-auto text-xs font-medium text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-md transition"
                                    >
                                        Ver detalles
                                    </button>
                                </div>
                            </div>
                        )}
                        <ControlPlanApp embedded initialData={tabNav.cpInitialData || undefined} amfeDoc={amfe.data} />
                    </Suspense>
                    </ModuleErrorBoundary>
                </div>
            </div>
        )}

        {/* --- AMFE TAB — SIEMPRE MONTADO, oculto con display:none cuando otro tab activo --- */}
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-sm" style={{ display: isAmfeActive ? undefined : 'none' }} data-module="amfe" data-mode={viewMode}>
            <AmfeTabBar {...tabBarProps} />
            <DocumentLockBanner otherEditor={documentLock.otherEditor} />
            <AmfeToolbar
                projects={projects}
                lastAutoSave={persistence.lastAutoSave}
                autoSaveError={persistence.autoSaveError}
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
                onLoadExample={handleLoadFullExample}
                onNewRevision={revisionControl.handleNewRevision}
                currentRevisionLevel={amfe.data.header.revision || 'A'}
                onOpenExportFolder={exportFolder.openFolder}
                canOpenExportFolder={exportFolder.canOpen}
            />

            {/* Cross-document alert banner */}
            <CrossDocAlertBanner
                alerts={crossDocAlerts.alerts}
                onDismiss={crossDocAlerts.dismissAlert}
                onDismissAll={crossDocAlerts.dismissAll}
            />

            {/* PFD ↔ AMFE broken link banner */}
            {linkValidation.totalBroken > 0 && !showLinkPanel && (
                <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 no-print animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 text-xs text-orange-800">
                        <AlertTriangle size={14} className="text-orange-500 flex-shrink-0" />
                        <span className="flex-1">
                            {linkValidation.totalBroken} vínculo{linkValidation.totalBroken !== 1 ? 's' : ''} PFD ↔ AMFE roto{linkValidation.totalBroken !== 1 ? 's' : ''} detectado{linkValidation.totalBroken !== 1 ? 's' : ''}
                        </span>
                        <button
                            onClick={() => setShowLinkPanel(true)}
                            className="text-orange-600 hover:text-orange-800 font-medium underline"
                        >
                            Ver detalle
                        </button>
                    </div>
                </div>
            )}

            {/* Revision history panel */}
            <RevisionHistoryPanel
                revisions={revisionControl.revisions}
                onViewSnapshot={(level) => {
                    revisionControl.loadSnapshot(level).then(snap => {
                        if (snap) {
                            amfe.loadData(snap as AmfeDocument);
                            history.resetHistory(snap as AmfeDocument);
                            logger.info('AmfeApp', `Loaded snapshot for Rev. ${level}`);
                        }
                    });
                }}
                isOpen={revisionControl.showRevisionHistory}
                onToggle={() => revisionControl.setShowRevisionHistory(!revisionControl.showRevisionHistory)}
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

            {/* Linked APQP documents panel */}
            {projects.currentProject && (
                <div className="px-4 pt-2">
                    <LinkedDocumentsPanel
                        linkedDocs={linkedDocs}
                        onNavigateToTab={tabNav.setActiveTab}
                    />
                </div>
            )}

            <AmfeHeaderForm
                header={amfe.data.header}
                onHeaderChange={handleHeaderChange}
                onProductSelect={handleProductSelect}
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
                {projects.isLoadingProject ? (
                    <LoadingOverlay message="Cargando AMFE..." accentColor="text-blue-600" />
                ) : !hasActiveFilters(filters) && filteredOperations.length === 0 ? (
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
                                {tabNav.pfdInitialData && (
                                    <button onClick={handleImportFromPfd}
                                        className="flex items-center gap-2 text-cyan-600 hover:text-cyan-800 px-4 py-2 rounded font-medium transition text-sm">
                                        <FileInput size={16} /> Importar desde PFD
                                    </button>
                                )}
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
                                    collapsedOps={collapsedOps}
                                    onToggleCollapse={toggleCollapseOp}
                                    readOnly={isReadOnly}
                                    brokenLinkOpIds={brokenAmfeOpIds}
                                    inheritanceStatusMap={inheritanceStatus.statusMap}
                                />
                            </table>
                        </div>
                    </div>
                )}

                {!isReadOnly && filteredOperations.length > 0 && (
                    <FloatingActionButton config={{
                        primary: { label: 'Agregar Operación', icon: Plus, onClick: amfe.addOperation, color: 'blue' },
                        secondary: [
                            { label: 'Operación Vacía', icon: Plus, onClick: amfe.addOperation, color: 'blue' },
                            { label: 'Desde Template', icon: Layers, onClick: () => setShowTemplates(true), color: 'purple' },
                        ]
                    }} />
                )}

                <ShortcutHintsOverlay isVisible={shortcutHints.hintsVisible} />

                {showLinkPanel && linkValidation && !linkValidation.isValid && (
                    <LinkValidationPanel
                        validation={linkValidation}
                        context="amfe"
                        onUnlinkAmfeOp={handleUnlinkAmfeOp}
                        onRelinkAmfeOp={handleRelinkAmfeOp}
                        pfdCandidates={linkCandidates.pfdCandidates}
                        onClose={() => setShowLinkPanel(false)}
                    />
                )}
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
                    onRemoveFromLibrary={async (libOpId) => {
                        const ok = await confirm.requestConfirm({
                            title: 'Eliminar de biblioteca',
                            message: '¿Eliminar esta operación de la biblioteca? Los AMFEs que la usen no se modifican, pero perderán el vínculo.',
                            variant: 'danger',
                            confirmText: 'Eliminar',
                        });
                        if (ok) library.removeFromLibrary(libOpId);
                    }}
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

            {/* Revision Prompt Modal */}
            <RevisionPromptModal
                isOpen={revisionControl.showRevisionPrompt}
                onClose={() => revisionControl.setShowRevisionPrompt(false)}
                onConfirm={(desc, by) => revisionControl.confirmRevision(desc, by)}
                currentRevisionLevel={amfe.data.header.revision || 'A'}
                nextRevisionLevel={getNextRevisionLevel(amfe.data.header.revision || 'A')}
            />

        </div>

        {/* PFD Generation Wizard — modal overlay */}
        {tabNav.showPfdWizard && (
            <ModuleErrorBoundary moduleName="Asistente PFD" onNavigateHome={() => tabNav.setShowPfdWizard(false)}>
            <Suspense fallback={null}>
                <PfdGenerationWizard
                    amfeDoc={amfe.data}
                    projectName={projects.currentProject || 'Sin nombre'}
                    isOpen={tabNav.showPfdWizard}
                    onComplete={tabNav.handlePfdWizardComplete}
                    onCancel={() => tabNav.setShowPfdWizard(false)}
                />
            </Suspense>
            </ModuleErrorBoundary>
        )}

        {/* Templates modal — global overlay accessible from any tab */}
        {showTemplates && (
            <AmfeTemplatesModal
                onApplyTemplate={handleApplyTemplate}
                onLoadFullExample={handleLoadFullExample}
                onLoadPatagoniaExample={handleLoadPatagoniaExample}
                onClose={() => setShowTemplates(false)}
            />
        )}

        {/* AMFE ↔ CP Sync Panel — side panel for reviewing sync alerts */}
        {showSyncPanel && (
            <Suspense fallback={null}>
                <CpSyncPanel
                    alerts={activeSyncAlerts}
                    onApplyAlert={handleApplySyncAlert}
                    onDismissAlert={handleDismissSyncAlert}
                    onDismissAll={handleDismissAllSyncAlerts}
                    onClose={() => setShowSyncPanel(false)}
                    onRegenerateCp={async () => {
                        setShowSyncPanel(false);
                        setDismissedSyncAlerts(new Set());
                        await tabNav.handleGenerateControlPlan();
                    }}
                />
            </Suspense>
        )}

        {/* Hidden file input for JSON import */}
        <input
            ref={amfeExport.jsonImportRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={amfeExport.handleFileSelected}
        />
        </>
    );
};

/** Wrapped in ErrorBoundary for production resilience */
const AmfeAppWithErrorBoundary: React.FC<AmfeAppProps> = (props) => (
    <ModuleErrorBoundary moduleName="AMFE VDA" onNavigateHome={props.onBackToLanding}>
        <AmfeApp {...props} />
    </ModuleErrorBoundary>
);

export default AmfeAppWithErrorBoundary;
