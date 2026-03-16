/**
 * PFD App — Main shell for the Process Flow Diagram module
 *
 * Manages document state, persistence, project CRUD, validation, and SVG export.
 * Cyan/teal color theme.
 *
 * The primary editing interface is PfdFlowEditor + PfdStepDetailPanel.
 * Export is SVG-only (editable in Visio/Inkscape).
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePfdDocument } from './usePfdDocument';
import { usePfdPersistence, listPfdDraftKeys, loadPfdDraft, deletePfdDraft, deleteUnsavedDraft } from './usePfdPersistence';
import { usePfdSelection } from './usePfdSelection';
import { validatePfdDocument, ValidationIssue } from './pfdValidation';
import { exportPfdSvg } from './pfdSvgExport';
import { exportPfdPdf } from './pfdPdfExport';
import type { PfdDocument, PfdStep, PfdHeader } from './pfdTypes';
import { PfdDocumentListItem, createEmptyPfdDocument } from './pfdTypes';
import { createBasicProcessTemplate, createManufacturingProcessTemplate, createPatagoniaTapizadoTemplate, type PfdTemplateResult } from './pfdTemplates';
import PfdToolbar from './PfdToolbar';
import PfdHeaderComponent from './PfdHeader';
import PfdFlowEditor from './PfdFlowEditor';
import PfdStepDetailPanel from './PfdStepDetailPanel';
import PfdSymbolLegend from './PfdSymbolLegend';
import PfdHelpPanel from './PfdHelpPanel';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { PromptModal } from '../../components/modals/PromptModal';
import { RevisionPromptModal } from '../../components/modals/RevisionPromptModal';
import { CrossDocAlertBanner } from '../../components/ui/CrossDocAlertBanner';
import { toast } from '../../components/ui/Toast';
import { RevisionHistoryPanel } from '../../components/layout/RevisionHistoryPanel';
import { ModuleErrorBoundary } from '../../components/ui/ModuleErrorBoundary';
import { useRevisionControl } from '../../hooks/useRevisionControl';
import { useDocumentLock } from '../../hooks/useDocumentLock';
import DocumentLockBanner from '../../components/ui/DocumentLockBanner';
import { useCrossDocAlerts } from '../../hooks/useCrossDocAlerts';
import { getNextRevisionLevel } from '../../utils/revisionUtils';
import {
    listPfdDocuments,
    loadPfdDocument,
    savePfdDocument,
    deletePfdDocument,
} from '../../utils/repositories/pfdRepository';
import { logger } from '../../utils/logger';
import { useOpenExportFolder } from '../../hooks/useOpenExportFolder';
import {
    Plus, XCircle, AlertTriangle, CheckCircle, Info, ArrowRight,
    HelpCircle, Save, FileText, FolderOpen, Check, Clock,
    Undo2, Redo2, Eye, Edit3, Hash, GitBranch, Image, ChevronDown,
} from 'lucide-react';

interface Props {
    onBackToLanding?: () => void;
    /** When true, hides back button and project panel (used inside AmfeApp) */
    embedded?: boolean;
    /** Pre-loaded document from wizard (used when generating PFD from AMFE) */
    initialData?: PfdDocument;
}

const LS_LAST_PROJECT = 'pfd_lastProjectId';
const LS_LAST_PROJECT_NAME = 'pfd_lastProjectName';

const PfdApp: React.FC<Props> = ({ onBackToLanding, embedded, initialData }) => {
    // Document state
    const pfd = usePfdDocument();

    // Project management
    const [currentProject, setCurrentProject] = useState('');
    const [projects, setProjects] = useState<PfdDocumentListItem[]>([]);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [toastMessage, setToastMessage] = useState('');

    // UI state
    const [viewMode, setViewMode] = useState<'view' | 'edit'>('edit');
    const [headerCollapsed, setHeaderCollapsed] = useState(() => {
        try {
            const stored = localStorage.getItem('pfd_header_collapsed');
            return stored !== null ? stored === 'true' : false; // Default expanded for new users
        } catch { return false; }
    });
    const [showProjectPanel, setShowProjectPanel] = useState(false);
    const [embeddedNewMenuOpen, setEmbeddedNewMenuOpen] = useState(false);
    const embeddedNewMenuRef = useRef<HTMLDivElement>(null);
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[] | null>(null);
    // C9-U2: Help panel
    const [showHelp, setShowHelp] = useState(false);

    // Phase B: Flow editor open/collapsed state (persisted)
    const [flowEditorOpen, setFlowEditorOpen] = useState(() => {
        try {
            const stored = localStorage.getItem('pfd_flow_editor_open');
            return stored !== null ? stored === 'true' : true; // Default: open
        } catch { return true; }
    });

    // Close embedded new-menu on outside click
    useEffect(() => {
        if (!embeddedNewMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (embeddedNewMenuRef.current && !embeddedNewMenuRef.current.contains(e.target as Node)) setEmbeddedNewMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [embeddedNewMenuOpen]);

    // PFD flow search state
    const [pfdSearch, setPfdSearch] = useState('');
    const pfdSearchRef = useRef<HTMLInputElement>(null);

    // Phase B: Step selection + keyboard nav
    const selection = usePfdSelection({
        steps: pfd.data.steps,
        onRemoveStep: undefined, // Delete handled via confirm modal below
    });

    // Confirm modal
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean; title: string; message: string;
        variant: 'danger' | 'warning' | 'info'; confirmText: string;
        onConfirm: () => void;
        onCancel?: () => void;
    }>({ isOpen: false, title: '', message: '', variant: 'info', confirmText: 'Aceptar', onConfirm: () => {} });

    // Prompt modal (new project name)
    const [promptState, setPromptState] = useState<{
        isOpen: boolean; title: string; message: string; defaultValue: string;
        onSubmit: (value: string) => void; onClose: () => void;
    }>({ isOpen: false, title: '', message: '', defaultValue: '', onSubmit: () => {}, onClose: () => {} });

    // Persistence
    const persistence = usePfdPersistence({
        currentData: pfd.data,
        currentProject,
        isSaving: saveStatus === 'saving',
    });

    const isReadOnly = viewMode === 'view';
    const isFirstRenderRef = useRef(true);
    /** Snapshot of pfd.data at last save/load (for unsaved changes comparison) */
    const savedSnapshotRef = useRef('');
    const changeDetectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cross-user edit lock (standalone mode only)
    const documentLock = useDocumentLock(
        embedded ? null : (pfd.data.id || null),
        'pfd',
    );

    // Revision control
    const revisionControl = useRevisionControl({
        module: 'pfd',
        documentId: pfd.data.id || null,
        currentData: pfd.data,
        currentRevisionLevel: pfd.data.header.revisionLevel || 'A',
        onRevisionCreated: (newLevel) => {
            pfd.updateHeader('revisionLevel', newLevel);
        },
    });

    // Cross-document alerts
    const crossDocAlerts = useCrossDocAlerts('pfd', pfd.data.id || null);

    // Export folder
    const exportFolder = useOpenExportFolder('pfd', pfd.data);

    // Track unsaved changes via snapshot comparison (debounced to avoid expensive JSON.stringify per keystroke).
    // This correctly resets hasUnsavedChanges when user undoes back to saved state.
    useEffect(() => {
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            return;
        }
        // No saved snapshot means no project loaded yet — nothing to compare against
        if (!savedSnapshotRef.current) {
            setHasUnsavedChanges(true);
            return;
        }
        // Debounced JSON.stringify comparison (same pattern as useControlPlanProjects)
        if (changeDetectionTimerRef.current) clearTimeout(changeDetectionTimerRef.current);
        changeDetectionTimerRef.current = setTimeout(() => {
            setHasUnsavedChanges(JSON.stringify(pfd.data) !== savedSnapshotRef.current);
        }, 800);
        return () => {
            if (changeDetectionTimerRef.current) clearTimeout(changeDetectionTimerRef.current);
        };
    }, [pfd.data]);

    // Load initialData when provided (embedded mode from AMFE wizard)
    // Track reference to detect regeneration while component stays mounted
    const prevInitialDataRef = useRef<typeof initialData>(undefined);
    useEffect(() => {
        if (initialData && initialData !== prevInitialDataRef.current) {
            prevInitialDataRef.current = initialData;
            pfd.loadData(initialData);
            isFirstRenderRef.current = true;
            setTimeout(() => { isFirstRenderRef.current = false; }, 0);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData]);

    // Persist header collapse
    useEffect(() => {
        try { localStorage.setItem('pfd_header_collapsed', String(headerCollapsed)); } catch {}
    }, [headerCollapsed]);

    // Phase B: Persist flow editor collapse
    useEffect(() => {
        try { localStorage.setItem('pfd_flow_editor_open', String(flowEditorOpen)); } catch {}
    }, [flowEditorOpen]);

    // Load projects list
    const refreshProjects = useCallback(async () => {
        try {
            const docs = await listPfdDocuments();
            setProjects(docs);
        } catch (err) {
            logger.error('PfdApp', 'Failed to list projects', {}, err instanceof Error ? err : undefined);
        }
    }, []);

    useEffect(() => { refreshProjects(); }, [refreshProjects]);

    // Draft recovery on mount (skip in embedded mode)
    // FIX: Added cancelled flag to prevent state updates after unmount
    // (matching useCpDraftRecovery / useAmfeDraftRecovery pattern)
    useEffect(() => {
        if (embedded) return;
        let cancelled = false;
        (async () => {
            try {
                const keys = await listPfdDraftKeys();
                if (cancelled || keys.length === 0) return;
                const draft = await loadPfdDraft(keys[0]);
                if (cancelled || !draft || !draft.steps || !draft.header) return;
                const draftKey = keys[0];
                setConfirmState({
                    isOpen: true,
                    title: 'Borrador encontrado',
                    message: `Se encontró un borrador sin guardar (${draft.header.partName || 'sin nombre'}, ${draft.steps.length} pasos). ¿Desea recuperarlo o descartarlo?`,
                    variant: 'info',
                    confirmText: 'Recuperar',
                    onConfirm: () => {
                        setConfirmState(prev => ({ ...prev, isOpen: false }));
                        pfd.loadData(draft);
                        isFirstRenderRef.current = true;
                        setTimeout(() => { isFirstRenderRef.current = false; }, 0);
                        logger.info('PfdApp', 'Draft recovered', { steps: draft.steps.length });
                    },
                    // C6-B3: Explicit discard — deletes draft and shows toast
                    onCancel: async () => {
                        try {
                            await deletePfdDraft(draftKey);
                            setToastMessage('Borrador descartado');
                            logger.info('PfdApp', 'Draft discarded by user', { key: draftKey });
                        } catch (err) {
                            logger.warn('PfdApp', 'Failed to delete draft', { error: String(err) });
                        }
                    },
                });
            } catch (err) {
                logger.warn('PfdApp', 'Draft recovery failed', { error: String(err) });
            }
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-load last project on mount (matching AMFE useAmfeProjects pattern)
    useEffect(() => {
        if (initialData) return; // Skip if wizard provided data
        let cancelled = false;
        const lastId = (() => { try { return localStorage.getItem(LS_LAST_PROJECT); } catch { return null; } })();
        if (!lastId) return;
        (async () => {
            try {
                const doc = await loadPfdDocument(lastId);
                if (cancelled) return;
                if (doc) {
                    pfd.loadData(doc);
                    const savedName = (() => { try { return localStorage.getItem(LS_LAST_PROJECT_NAME); } catch { return null; } })();
                    const name = savedName || doc.header?.partName || doc.header?.documentNumber || '';
                    setCurrentProject(name);
                    savedSnapshotRef.current = JSON.stringify(doc);
                    setHasUnsavedChanges(false);
                    logger.info('PfdApp', 'Auto-loaded last project', { id: lastId, name });
                } else {
                    // Project no longer exists — clean up
                    try { localStorage.removeItem(LS_LAST_PROJECT); } catch { /* noop */ }
                }
            } catch (err) {
                logger.warn('PfdApp', 'Auto-load failed', { error: String(err) });
                try { localStorage.removeItem(LS_LAST_PROJECT); } catch { /* noop */ }
            }
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // C3-B1: Extracted shared save logic to avoid duplication
    // FIX: Added savingRef mutex to prevent concurrent saves (matching AMFE/CP pattern)
    const savingRef = useRef(false);
    const executeSave = useCallback(async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        // Capture snapshot BEFORE async (matches AMFE/CP pattern — snapshot reflects what was persisted)
        const snapshotAtSaveTime = JSON.stringify(pfd.data);
        try {
            setSaveStatus('saving');
            const ok = await savePfdDocument(pfd.data.id, pfd.data);
            setSaveStatus(ok ? 'saved' : 'error');
            if (!ok) {
                toast.error('Error al guardar', 'Intente nuevamente.');
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
            if (ok) {
                savedSnapshotRef.current = snapshotAtSaveTime;
                setHasUnsavedChanges(false);
                refreshProjects();
                deleteUnsavedDraft();
                // Persist last project ID + name for auto-load
                try {
                    localStorage.setItem(LS_LAST_PROJECT, pfd.data.id);
                    localStorage.setItem(LS_LAST_PROJECT_NAME, currentProject || pfd.data.header.partName || '');
                } catch { /* noop */ }
                toast.success('Guardado', currentProject || pfd.data.header.partName || 'Documento guardado correctamente');
                setTimeout(() => setSaveStatus('idle'), 2000);
            }
        } finally {
            savingRef.current = false;
        }
    }, [pfd.data, refreshProjects, currentProject]);

    const handleSave = useCallback(async () => {
        if (!currentProject) {
            setPromptState({
                isOpen: true,
                title: 'Guardar Diagrama de Flujo',
                message: 'Ingrese un nombre para el documento:',
                defaultValue: pfd.data.header.partName || '',
                onClose: () => setPromptState(prev => ({ ...prev, isOpen: false })),
                onSubmit: async (name: string) => {
                    setPromptState(prev => ({ ...prev, isOpen: false }));
                    setCurrentProject(name);
                    if (!pfd.data.header.partName) {
                        pfd.updateHeader('partName', name);
                    }
                    await executeSave();
                },
            });
            return;
        }
        await executeSave();
    }, [currentProject, pfd.data.header.partName, pfd.updateHeader, executeSave]);

    // C4-U1: Save As — duplicate with new name and ID
    // FIX: Added savingRef mutex + deleteUnsavedDraft to match executeSave pattern
    const handleSaveAs = useCallback(() => {
        setPromptState({
            isOpen: true,
            title: 'Guardar como...',
            message: 'Ingrese un nuevo nombre para la copia:',
            defaultValue: pfd.data.header.partName ? `${pfd.data.header.partName} (copia)` : '',
            onClose: () => setPromptState(prev => ({ ...prev, isOpen: false })),
            onSubmit: async (name: string) => {
                setPromptState(prev => ({ ...prev, isOpen: false }));
                if (savingRef.current) return; // Mutex: prevent concurrent saves
                savingRef.current = true;
                try {
                    // Generate new ID for the copy
                    const newId = crypto.randomUUID();
                    const now = new Date().toISOString();
                    const newDoc = {
                        ...pfd.data,
                        id: newId,
                        header: { ...pfd.data.header, partName: name },
                        createdAt: now,
                        updatedAt: now,
                    };
                    pfd.loadData(newDoc);
                    setCurrentProject(name);
                    savedSnapshotRef.current = JSON.stringify(newDoc);
                    setSaveStatus('saving');
                    const ok = await savePfdDocument(newId, newDoc);
                    setSaveStatus(ok ? 'saved' : 'error');
                    if (ok) {
                        setHasUnsavedChanges(false);
                        refreshProjects();
                        deleteUnsavedDraft(); // FIX: Clean up orphan draft
                        try {
                            localStorage.setItem(LS_LAST_PROJECT, newId);
                            localStorage.setItem(LS_LAST_PROJECT_NAME, name);
                        } catch { /* noop */ }
                        toast.success('Copia guardada', `"${name}"`);
                        setTimeout(() => setSaveStatus('idle'), 2000);
                    }
                } finally {
                    savingRef.current = false;
                }
            },
        });
    }, [pfd.data, pfd.loadData, refreshProjects]);

    // Load project
    const handleLoadProject = useCallback(async (id: string) => {
        try {
            const doc = await loadPfdDocument(id);
            if (doc) {
                pfd.loadData(doc);
                const proj = projects.find(p => p.id === id);
                setCurrentProject(proj?.part_name || proj?.document_number || id);
                savedSnapshotRef.current = JSON.stringify(doc);
                setHasUnsavedChanges(false);
                setShowProjectPanel(false);
                setLoadError('');
                try {
                    localStorage.setItem(LS_LAST_PROJECT, id);
                    localStorage.setItem(LS_LAST_PROJECT_NAME, proj?.part_name || proj?.document_number || id);
                } catch { /* noop */ }
            } else {
                setLoadError('No se pudo cargar el documento.');
            }
        } catch (err) {
            logger.error('PfdApp', 'Failed to load project', {}, err instanceof Error ? err : undefined);
            setLoadError('Error al cargar el documento.');
        }
    }, [pfd.loadData, projects]);

    // New project
    const handleNewProject = useCallback(() => {
        const doReset = () => {
            pfd.resetData();
            setCurrentProject('');
            savedSnapshotRef.current = '';
            setHasUnsavedChanges(false);
            setValidationIssues(null);
        };
        if (hasUnsavedChanges) {
            setConfirmState({
                isOpen: true,
                title: 'Cambios sin guardar',
                message: 'Hay cambios sin guardar. ¿Desea continuar sin guardar?',
                variant: 'warning',
                confirmText: 'Continuar',
                onConfirm: () => {
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    doReset();
                },
            });
        } else {
            doReset();
        }
    }, [hasUnsavedChanges, pfd.resetData]);

    // Delete project
    const handleDeleteProject = useCallback(async (id: string) => {
        setConfirmState({
            isOpen: true,
            title: 'Eliminar documento',
            message: '¿Está seguro de que desea eliminar este documento? Esta acción no se puede deshacer.',
            variant: 'danger',
            confirmText: 'Eliminar',
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, isOpen: false }));
                await deletePfdDocument(id);
                refreshProjects();
                if (pfd.data.id === id) {
                    pfd.resetData();
                    setCurrentProject('');
                }
            },
        });
    }, [pfd.data.id, pfd.resetData, refreshProjects]);

    // Validation
    const handleValidate = useCallback(() => {
        const issues = validatePfdDocument(pfd.data);
        setValidationIssues(issues);
    }, [pfd.data]);

    // Export — SVG
    const handleExportSvg = useCallback(async () => {
        try {
            await exportPfdSvg(pfd.data);
            setToastMessage('SVG exportado correctamente');
        } catch (err) {
            logger.error('PfdApp', 'SVG export failed', {}, err instanceof Error ? err : undefined);
            setToastMessage('Error al exportar SVG');
        }
    }, [pfd.data]);

    // Export — PDF (via print dialog)
    const handleExportPdf = useCallback(async () => {
        try {
            await exportPfdPdf(pfd.data);
            setToastMessage('Diálogo de impresión abierto — seleccione "Guardar como PDF"');
        } catch (err) {
            logger.error('PfdApp', 'PDF export failed', {}, err instanceof Error ? err : undefined);
            setToastMessage('Error al exportar PDF');
        }
    }, [pfd.data]);

    // Confirm before navigating back with unsaved changes
    const handleBackToLanding = useCallback(() => {
        if (!onBackToLanding) return;
        if (hasUnsavedChanges) {
            setConfirmState({
                isOpen: true,
                title: 'Cambios sin guardar',
                message: 'Hay cambios sin guardar. ¿Desea volver al inicio sin guardar?',
                variant: 'warning',
                confirmText: 'Volver sin guardar',
                onConfirm: () => {
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    onBackToLanding();
                },
            });
        } else {
            onBackToLanding();
        }
    }, [onBackToLanding, hasUnsavedChanges]);

    // C3-U3: Load basic/manufacturing process template
    // C4-B3: Confirm before replacing existing steps with template
    const handleLoadTemplate = useCallback((templateFn: () => PfdStep[] | PfdTemplateResult = createBasicProcessTemplate) => {
        /** Apply template: set steps + optionally fill header fields */
        const applyTemplate = () => {
            const result = templateFn();
            // If result has { steps, header } shape → full template (e.g., PATAGONIA)
            if (result && 'steps' in result && Array.isArray(result.steps)) {
                const tmpl = result as PfdTemplateResult;
                pfd.setSteps(tmpl.steps);
                if (tmpl.header) {
                    for (const [key, value] of Object.entries(tmpl.header)) {
                        if (value !== undefined && value !== '') {
                            pfd.updateHeader(key as keyof PfdHeader, value as string);
                        }
                    }
                }
            } else {
                // Plain PfdStep[] (basic/manufacturing templates)
                pfd.setSteps(result as PfdStep[]);
            }
        };

        const hasUserData = pfd.data.steps.length > 1 || pfd.data.steps.some(s => s.description.trim() !== '' && s.description !== 'Recepción de materia prima');
        if (hasUserData) {
            setConfirmState({
                isOpen: true,
                title: 'Cargar plantilla',
                message: `Se reemplazarán los ${pfd.data.steps.length} pasos actuales con la plantilla. ¿Continuar?`,
                variant: 'warning',
                confirmText: 'Reemplazar',
                onConfirm: () => {
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    applyTemplate();
                },
            });
        } else {
            applyTemplate();
        }
    }, [pfd.data.steps, pfd.setSteps, pfd.updateHeader]);

    // Auto-dismiss toasts
    useEffect(() => {
        if (!loadError) return;
        const timer = setTimeout(() => setLoadError(''), 5000);
        return () => clearTimeout(timer);
    }, [loadError]);
    useEffect(() => {
        if (!toastMessage) return;
        const timer = setTimeout(() => setToastMessage(''), 3000);
        return () => clearTimeout(timer);
    }, [toastMessage]);

    // Confirm before deleting a step
    const handleRemoveStep = useCallback((stepId: string) => {
        const step = pfd.data.steps.find(s => s.id === stepId);
        const label = step ? `${step.stepNumber || '(sin nº)'} — ${step.description || '(sin descripción)'}` : stepId;
        setConfirmState({
            isOpen: true,
            title: 'Eliminar paso',
            message: `¿Eliminar el paso "${label}"? Puede deshacerlo con Ctrl+Z.`,
            variant: 'danger',
            confirmText: 'Eliminar',
            onConfirm: () => {
                setConfirmState(prev => ({ ...prev, isOpen: false }));
                pfd.removeStep(stepId);
            },
        });
    }, [pfd.data.steps, pfd.removeStep]);

    // C10-UX3: Sync branchLabel across steps when label changes (single undo entry)
    const handleUpdateStep = useCallback((stepId: string, field: keyof typeof pfd.data.steps[0], value: string | boolean) => {
        if (field === 'branchLabel' && typeof value === 'string') {
            const step = pfd.data.steps.find(s => s.id === stepId);
            if (step?.branchId) {
                const updates = pfd.data.steps
                    .filter(s => s.branchId === step.branchId)
                    .map(s => ({ stepId: s.id, field: 'branchLabel' as keyof typeof pfd.data.steps[0], value }));
                pfd.updateMultipleSteps(updates);
                return;
            }
        }
        pfd.updateStep(stepId, field, value);
    }, [pfd.updateStep, pfd.updateMultipleSteps, pfd.data.steps]);

    // C10-UX3: Auto-inherit branchLabel when assigning step to existing branch
    const handleBatchUpdateStep = useCallback((stepId: string, updates: Partial<typeof pfd.data.steps[0]>) => {
        if (updates.branchId && !updates.branchLabel) {
            const existingLabel = pfd.data.steps.find(
                s => s.branchId === updates.branchId && s.id !== stepId && s.branchLabel
            )?.branchLabel;
            if (existingLabel) {
                updates = { ...updates, branchLabel: existingLabel };
            }
        }
        pfd.updateStepFields(stepId, updates);
    }, [pfd.updateStepFields, pfd.data.steps]);

    // C4-B4: Scroll to last step after adding
    const scrollToLastStep = useCallback(() => {
        setTimeout(() => {
            const rows = document.querySelectorAll('[data-step-id]');
            const last = rows[rows.length - 1];
            if (last) {
                last.scrollIntoView({ behavior: 'smooth', block: 'center' });
                last.classList.add('ring-2', 'ring-cyan-400', 'bg-cyan-50/50');
                setTimeout(() => last.classList.remove('ring-2', 'ring-cyan-400', 'bg-cyan-50/50'), 2000);
            }
        }, 50);
    }, []);

    const handleAddStep = useCallback(() => {
        pfd.addStep();
        scrollToLastStep();
    }, [pfd.addStep, scrollToLastStep]);

    // C3-U4: Scroll to and highlight a validation issue's step
    const scrollToStep = useCallback((stepId: string | undefined) => {
        if (!stepId) return;
        const row = document.querySelector(`[data-step-id="${stepId}"]`);
        if (!row) return;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('ring-2', 'ring-amber-400', 'bg-amber-50/50');
        setTimeout(() => row.classList.remove('ring-2', 'ring-amber-400', 'bg-amber-50/50'), 2500);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
                if (e.key === 'Escape') { (e.target as HTMLElement).blur(); return; }
                if (!e.ctrlKey) return; // C5-B3: Allow Ctrl+combos (save, undo) even when form element focused
            }

            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
            // Ctrl+F: Focus flow search
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                pfdSearchRef.current?.focus();
            }
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                pfd.undo();
            }
            if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                pfd.redo();
            }
            // C3-B2: Changed from Ctrl+N (conflicts with browser new window) to Ctrl+Shift+N
            if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                handleAddStep();
            }
            // Ctrl+D: Toggle view/edit mode
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                setViewMode(prev => prev === 'view' ? 'edit' : 'view');
            }
            // C9-U2: F1 opens/closes help panel
            if (e.key === 'F1') {
                e.preventDefault();
                setShowHelp(prev => !prev);
            }
            if (e.key === 'Escape') {
                // Phase B: deselect step first, then close panels
                if (selection.selectedStepId) { selection.selectStep(null); return; }
                if (showHelp) setShowHelp(false);
                else if (validationIssues) setValidationIssues(null);
                else if (showProjectPanel) setShowProjectPanel(false);
            }
            // Phase B: Arrow key navigation for flow editor
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (flowEditorOpen && !e.ctrlKey && !e.shiftKey) {
                    selection.handleKeyDown(e);
                }
            }
            // Phase B: Delete selected step
            if (e.key === 'Delete' && selection.selectedStepId) {
                handleRemoveStep(selection.selectedStepId);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleSave, handleAddStep, pfd.undo, pfd.redo, validationIssues, showProjectPanel, showHelp, selection, flowEditorOpen, handleRemoveStep]);

    const errorCount = validationIssues?.filter(i => i.severity === 'error').length;

    // Phase B: Selected step for detail panel
    const selectedStep = useMemo(
        () => selection.selectedStepId ? pfd.data.steps.find(s => s.id === selection.selectedStepId) ?? null : null,
        [selection.selectedStepId, pfd.data.steps],
    );

    return (
        <div className={`${embedded ? 'flex flex-col h-full' : 'min-h-screen'} bg-gray-50 flex flex-col font-sans text-sm`} data-module="pfd" data-mode={viewMode}>
            {/* C3-E2: Print-friendly CSS */}
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { font-size: 9pt; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; }
                    thead { display: table-header-group; }
                }
            `}</style>

            {!embedded && <DocumentLockBanner otherEditor={documentLock.otherEditor} />}

            {/* Toolbar — full in standalone, compact in embedded */}
            {!embedded ? (
                <PfdToolbar
                    onBackToLanding={handleBackToLanding}
                    onSave={handleSave}
                    onSaveAs={handleSaveAs}
                    saveStatus={saveStatus}
                    hasUnsavedChanges={hasUnsavedChanges}
                    currentProject={currentProject}
                    lastAutoSave={persistence.lastAutoSave}
                    onToggleProjectPanel={() => setShowProjectPanel(!showProjectPanel)}
                    onNewProject={handleNewProject}
                    onExportSvg={handleExportSvg}
                    onExportPdf={handleExportPdf}
                    viewMode={viewMode}
                    onToggleViewMode={() => setViewMode(prev => prev === 'view' ? 'edit' : 'view')}
                    onValidate={handleValidate}
                    validationCount={errorCount}
                    onUndo={pfd.undo}
                    onRedo={pfd.redo}
                    canUndo={pfd.canUndo}
                    canRedo={pfd.canRedo}
                    stepCount={pfd.data.steps.length}
                    onLoadBasicTemplate={() => handleLoadTemplate()}
                    onLoadManufacturingTemplate={() => handleLoadTemplate(createManufacturingProcessTemplate)}
                    onLoadTapizadoTemplate={() => handleLoadTemplate(createPatagoniaTapizadoTemplate)}
                    onRenumber={pfd.renumber}
                    onNewRevision={revisionControl.handleNewRevision}
                    currentRevisionLevel={pfd.data.header.revisionLevel || 'A'}
                    onOpenExportFolder={exportFolder.openFolder}
                    canOpenExportFolder={exportFolder.canOpen}
                />
            ) : (
                /* Compact embedded toolbar — essential actions only */
                <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex items-center gap-2 flex-wrap no-print">
                    <button onClick={pfd.undo} disabled={!pfd.canUndo} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50" title="Deshacer (Ctrl+Z)">
                        <Undo2 size={14} />
                    </button>
                    <button onClick={pfd.redo} disabled={!pfd.canRedo} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50" title="Rehacer (Ctrl+Y)">
                        <Redo2 size={14} />
                    </button>
                    <div className="w-px h-5 bg-gray-200" />
                    <button
                        onClick={() => { refreshProjects(); setShowProjectPanel(prev => !prev); }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
                            showProjectPanel ? 'bg-cyan-100 text-cyan-800' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="Documentos guardados"
                    >
                        <FolderOpen size={14} />
                        <span className="hidden sm:inline">Proyectos</span>
                        {projects.length > 0 && (
                            <span className="text-[9px] bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5">{projects.length}</span>
                        )}
                    </button>
                    <div className="relative" ref={embeddedNewMenuRef}>
                        <button
                            onClick={() => setEmbeddedNewMenuOpen(prev => !prev)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-cyan-700 hover:bg-cyan-50 transition"
                            title="Nuevo documento o cargar template"
                        >
                            <Plus size={14} />
                            <span className="hidden sm:inline">Nuevo</span>
                            <ChevronDown size={12} />
                        </button>
                        {embeddedNewMenuOpen && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[230px] py-1">
                                <button onClick={() => { handleNewProject(); setEmbeddedNewMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 transition">Documento vacío</button>
                                <button onClick={() => { handleLoadTemplate(); setEmbeddedNewMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 transition">Plantilla básica (8 pasos)</button>
                                <button onClick={() => { handleLoadTemplate(createManufacturingProcessTemplate); setEmbeddedNewMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 transition">Plantilla manufactura (12 pasos)</button>
                                <div className="border-t border-gray-100 my-1" />
                                <button onClick={() => { handleLoadTemplate(createPatagoniaTapizadoTemplate); setEmbeddedNewMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-cyan-700 hover:bg-cyan-50 font-semibold transition">INSERTO PATAGONIA — VWA (35 pasos)</button>
                            </div>
                        )}
                    </div>
                    <div className="w-px h-5 bg-gray-200" />
                    <button onClick={() => setViewMode(prev => prev === 'view' ? 'edit' : 'view')} className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${viewMode === 'view' ? 'bg-cyan-100 text-cyan-800' : 'text-gray-600 hover:bg-gray-100'}`} title="Alternar vista/edicion" data-testid="toggle-edit-mode">
                        {viewMode === 'view' ? <Eye size={14} /> : <Edit3 size={14} />}
                        <span className="hidden sm:inline">{viewMode === 'view' ? 'Vista' : 'Editar'}</span>
                    </button>
                    <button onClick={handleValidate} className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${errorCount ? 'text-amber-700 hover:bg-amber-50' : 'text-gray-600 hover:bg-gray-100'}`} title="Validar">
                        <AlertTriangle size={14} />
                        {errorCount != null && errorCount > 0 && <span className="bg-amber-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">{errorCount}</span>}
                    </button>
                    {pfd.renumber && (
                        <button onClick={pfd.renumber} disabled={pfd.data.steps.length === 0} className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50" title="Renumerar">
                            <Hash size={14} />
                        </button>
                    )}
                    <div className="w-px h-5 bg-gray-200" />
                    <button
                        onClick={handleSave}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
                            hasUnsavedChanges
                                ? 'text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="Guardar (Ctrl+S)"
                    >
                        <Save size={14} />
                        <span className="hidden sm:inline">Guardar</span>
                        {hasUnsavedChanges && <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />}
                    </button>
                    <div className="w-px h-5 bg-gray-200" />
                    <button onClick={handleExportSvg} className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-gray-600 hover:bg-gray-100" title="Exportar SVG editable">
                        <Image size={14} />
                        <span className="hidden sm:inline">SVG</span>
                    </button>
                    <button onClick={handleExportPdf} className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-gray-600 hover:bg-gray-100" title="Exportar PDF (imprimir)">
                        <FileText size={14} />
                        <span className="hidden sm:inline">PDF</span>
                    </button>
                    <div className="w-px h-5 bg-gray-200" />
                    <button
                        onClick={revisionControl.handleNewRevision}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100 transition"
                        title="Crear nueva revision del documento"
                    >
                        <GitBranch size={14} />
                        Nueva Rev.
                        <span className="bg-cyan-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {pfd.data.header.revisionLevel || 'A'}
                        </span>
                    </button>
                    <div className="flex-1" />
                    {/* Project name badge + save status indicator */}
                    <div className="flex items-center gap-2">
                        {currentProject && (
                            <span className="text-xs font-medium text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded truncate max-w-[250px]" title={currentProject}>
                                {currentProject}
                            </span>
                        )}
                        {saveStatus === 'saving' && (
                            <span className="text-blue-500 flex items-center gap-1 text-[11px]">
                                <Clock size={12} className="animate-spin" /> Guardando...
                            </span>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="text-green-600 flex items-center gap-1 text-[11px]">
                                <Check size={12} /> Guardado
                            </span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="text-red-500 text-[11px]">Error al guardar</span>
                        )}
                        {saveStatus === 'idle' && hasUnsavedChanges && currentProject && (
                            <span className="text-orange-500 text-[11px]">Sin guardar</span>
                        )}
                        <span className="text-[10px] text-gray-400">{pfd.data.steps.length} pasos</span>
                    </div>
                </div>
            )}

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
                            pfd.loadData(snap as PfdDocument);
                            logger.info('PfdApp', `Loaded snapshot for Rev. ${level}`);
                        }
                    });
                }}
                isOpen={revisionControl.showRevisionHistory}
                onToggle={() => revisionControl.setShowRevisionHistory(!revisionControl.showRevisionHistory)}
            />

            {/* Read-only mode indicator */}
            {isReadOnly && (
                <div className="bg-cyan-50 border-b border-cyan-200 px-4 py-1.5 flex items-center gap-2 text-xs text-cyan-700 no-print animate-in fade-in duration-200">
                    <Eye size={13} />
                    <span className="font-medium">Modo solo lectura</span>
                    <span className="text-cyan-500">— Presiona Ctrl+D para editar</span>
                </div>
            )}

            {/* Project panel (slide-in) */}
            {showProjectPanel && (
                <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm no-print">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-cyan-700">Documentos guardados</h3>
                        <button onClick={() => setShowProjectPanel(false)} className="text-gray-400 hover:text-gray-600">
                            <XCircle size={16} />
                        </button>
                    </div>
                    {projects.length === 0 ? (
                        <p className="text-xs text-gray-400">No hay documentos guardados.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                            {projects.map(p => (
                                <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 hover:border-cyan-300 transition">
                                    <button onClick={() => handleLoadProject(p.id)} className="text-left flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-800 truncate" title={p.part_name || p.document_number || 'Sin nombre'}>{p.part_name || p.document_number || 'Sin nombre'}</div>
                                        <div className="text-[10px] text-gray-400">{p.customer_name} · {p.step_count} pasos · Rev. {p.revision_level}</div>
                                    </button>
                                    <button onClick={() => handleDeleteProject(p.id)} className="ml-2 text-gray-300 hover:text-red-500 transition" title="Eliminar">
                                        <XCircle size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Header */}
            <PfdHeaderComponent
                header={pfd.data.header}
                onChange={pfd.updateHeader}
                collapsed={headerCollapsed}
                onToggleCollapse={() => setHeaderCollapsed(!headerCollapsed)}
                readOnly={isReadOnly}
            />

            {/* Main content area */}
            <div className="flex-grow p-4 pb-20">

                {/* ═══ Phase B: Flow Editor + Detail Panel (primary editing) ═══ */}
                <div className="flex gap-0 mb-4 no-print" onClick={() => {
                    // Click on empty area deselects (but not when clicking inside panels)
                }}>
                    {/* Flow Editor — takes remaining width */}
                    <div className={`${selectedStep ? 'flex-1 min-w-0' : 'w-full'} transition-all`}>
                        <PfdFlowEditor
                            steps={pfd.data.steps}
                            selectedStepId={selection.selectedStepId}
                            onSelectStep={selection.selectStep}
                            onInsertAfter={pfd.insertStepAfter}
                            onRemoveStep={handleRemoveStep}
                            onMoveStep={pfd.moveStep}
                            onUpdateStep={handleUpdateStep}
                            onDuplicateStep={pfd.duplicateStep}
                            readOnly={isReadOnly}
                            isOpen={flowEditorOpen}
                            onToggle={() => setFlowEditorOpen(prev => !prev)}
                            searchQuery={pfdSearch}
                            onSearchChange={setPfdSearch}
                        />
                    </div>

                    {/* Detail Panel — fixed 320px right side, shown when a step is selected */}
                    {selectedStep && (
                        <PfdStepDetailPanel
                            step={selectedStep}
                            onUpdateStep={handleUpdateStep}
                            onBatchUpdateStep={handleBatchUpdateStep}
                            onClose={() => selection.selectStep(null)}
                            readOnly={isReadOnly}
                        />
                    )}
                </div>

                {/* Symbol Legend */}
                <PfdSymbolLegend />

                {/* Validation Results Panel */}
                {validationIssues && (
                    <div className="mt-4 bg-white border border-gray-200 rounded-lg shadow-sm p-4 no-print animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-700">
                                Resultado de validación ({validationIssues.length} {validationIssues.length === 1 ? 'hallazgo' : 'hallazgos'})
                            </h3>
                            <button onClick={() => setValidationIssues(null)} className="text-gray-400 hover:text-gray-600">
                                <XCircle size={16} />
                            </button>
                        </div>
                        {validationIssues.length === 0 ? (
                            <div className="flex items-center gap-2 text-green-600 text-sm">
                                <CheckCircle size={16} />
                                <span>Sin hallazgos. El documento está completo.</span>
                            </div>
                        ) : (
                            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                                {validationIssues.map((issue, i) => (
                                    <li
                                        key={i}
                                        className={`flex items-start gap-2 text-xs rounded px-1 py-0.5 ${issue.stepId ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                                        onClick={() => scrollToStep(issue.stepId)}
                                    >
                                        {issue.severity === 'error' && <XCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />}
                                        {issue.severity === 'warning' && <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />}
                                        {issue.severity === 'info' && <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />}
                                        <span className="text-gray-700 flex-1">[{issue.rule}] {issue.message}</span>
                                        {issue.stepId && <ArrowRight size={12} className="text-gray-300 flex-shrink-0 mt-0.5" />}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* FAB: Add Step */}
                {!isReadOnly && (
                    <div className="fixed bottom-14 right-8 z-40 no-print">
                        <button
                            onClick={handleAddStep}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-full p-3 shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
                            title="Agregar paso (Ctrl+Shift+N)"
                        >
                            <Plus size={20} />
                            <span className="font-bold pr-1 text-sm">Agregar Paso</span>
                        </button>
                    </div>
                )}

                {/* Footer */}
                {!embedded && (
                    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t p-2 text-center text-xs text-gray-500 z-30 no-print">
                        <strong>{pfd.data.steps.length}</strong> {pfd.data.steps.length === 1 ? 'paso' : 'pasos'}
                        {pfd.data.steps.length > 0 && (() => {
                            const counts: Record<string, number> = {};
                            for (const s of pfd.data.steps) counts[s.stepType] = (counts[s.stepType] || 0) + 1;
                            const labels: Record<string, string> = { operation: 'Op', transport: 'Transp', inspection: 'Insp', storage: 'Alm', delay: 'Demora', decision: 'Dec', combined: 'Op+Insp' };
                            const parts = Object.entries(counts).map(([k, v]) => `${v} ${labels[k] || k}`);
                            const branches = new Set(pfd.data.steps.filter(s => s.branchId).map(s => s.branchId));
                            if (branches.size > 0) parts.push(`${branches.size} líneas ∥`);
                            return <span className="text-gray-400 ml-1">({parts.join(' · ')})</span>;
                        })()}
                        {' | '}
                        <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+Z</kbd> Deshacer · <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+Y</kbd> Rehacer · <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+S</kbd> Guardar · <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+Shift+N</kbd> Nuevo paso
                        {' · '}
                        <button
                            onClick={() => setShowHelp(true)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition bg-gray-100 text-gray-500 hover:bg-cyan-100 hover:text-cyan-700"
                            title="Manual de ayuda (F1)"
                        >
                            <HelpCircle size={10} />
                            Ayuda
                        </button>
                        {currentProject && <span className="ml-4 text-gray-400">Proyecto: <strong className="text-cyan-600">{currentProject}</strong></span>}
                    </div>
                )}
            </div>

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={() => {
                    confirmState.onCancel?.();
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                }}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                variant={confirmState.variant}
                confirmText={confirmState.confirmText}
            />

            {/* Prompt Modal */}
            <PromptModal
                isOpen={promptState.isOpen}
                onClose={promptState.onClose}
                onSubmit={promptState.onSubmit}
                title={promptState.title}
                message={promptState.message}
                defaultValue={promptState.defaultValue}
                placeholder="Nombre del documento"
                required
            />

            {/* Revision Prompt Modal */}
            <RevisionPromptModal
                isOpen={revisionControl.showRevisionPrompt}
                onClose={() => revisionControl.setShowRevisionPrompt(false)}
                onConfirm={(desc, by) => revisionControl.confirmRevision(desc, by)}
                currentRevisionLevel={pfd.data.header.revisionLevel || 'A'}
                nextRevisionLevel={getNextRevisionLevel(pfd.data.header.revisionLevel || 'A')}
            />

            {/* Toast notification */}
            {toastMessage && (
                <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-cyan-700 text-white text-xs font-medium rounded-lg shadow-lg px-4 py-2 animate-fade-in">
                    {toastMessage}
                </div>
            )}

            {/* C9-U2: Help Panel */}
            <PfdHelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} />

            {/* Load Error Toast */}
            {loadError && (
                <div className="fixed bottom-4 left-4 z-50 bg-red-50 border border-red-300 rounded-lg shadow-lg p-3 max-w-sm">
                    <div className="flex items-start gap-2">
                        <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700 flex-1">{loadError}</p>
                        <button onClick={() => setLoadError('')} className="text-red-400 hover:text-red-600 flex-shrink-0" title="Cerrar">
                            <XCircle size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const PfdAppWithErrorBoundary: React.FC<Props> = (props) => (
    <ModuleErrorBoundary moduleName="Diagrama de Flujo" onNavigateHome={props.onBackToLanding}>
        <PfdApp {...props} />
    </ModuleErrorBoundary>
);

export default PfdAppWithErrorBoundary;
