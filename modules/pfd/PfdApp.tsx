/**
 * PFD App — Main shell for the Process Flow Diagram module
 *
 * Manages document state, persistence, project CRUD, validation, and export.
 * Cyan/teal color theme.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePfdDocument } from './usePfdDocument';
import { usePfdPersistence, listPfdDraftKeys, loadPfdDraft, deletePfdDraft, deleteUnsavedDraft } from './usePfdPersistence';
import { validatePfdDocument, ValidationIssue } from './pfdValidation';
import { exportPfdPdf } from './pfdPdfExport';
import { exportPfdExcel } from './pfdExcelExport';
import { PFD_COLUMNS, PfdDocumentListItem, createEmptyPfdDocument } from './pfdTypes';
import { createBasicProcessTemplate, createManufacturingProcessTemplate } from './pfdTemplates';
import PfdToolbar from './PfdToolbar';
import PfdHeaderComponent from './PfdHeader';
import PfdTable from './PfdTable';
import PfdSymbolLegend from './PfdSymbolLegend';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { PromptModal } from '../../components/modals/PromptModal';
import { ModuleErrorBoundary } from '../../components/ui/ModuleErrorBoundary';
import {
    listPfdDocuments,
    loadPfdDocument,
    savePfdDocument,
    deletePfdDocument,
} from '../../utils/repositories/pfdRepository';
import { logger } from '../../utils/logger';
import { Plus, XCircle, AlertTriangle, CheckCircle, Info, ArrowRight, ArrowDown } from 'lucide-react';

interface Props {
    onBackToLanding?: () => void;
}

const PfdApp: React.FC<Props> = ({ onBackToLanding }) => {
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
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[] | null>(null);
    // C5-U3: Toggle flow arrows between rows
    const [showFlowArrows, setShowFlowArrows] = useState(() => {
        try {
            const stored = localStorage.getItem('pfd_flow_arrows');
            return stored !== null ? stored === 'true' : true; // Default: arrows shown
        } catch { return true; }
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

    // Track unsaved changes (skip initial render)
    useEffect(() => {
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            return;
        }
        setHasUnsavedChanges(true);
    }, [pfd.data]);

    // Persist header collapse
    useEffect(() => {
        try { localStorage.setItem('pfd_header_collapsed', String(headerCollapsed)); } catch {}
    }, [headerCollapsed]);

    // C5-U3: Persist flow arrows toggle
    useEffect(() => {
        try { localStorage.setItem('pfd_flow_arrows', String(showFlowArrows)); } catch {}
    }, [showFlowArrows]);

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

    // Draft recovery on mount
    useEffect(() => {
        (async () => {
            try {
                const keys = await listPfdDraftKeys();
                if (keys.length === 0) return;
                const draft = await loadPfdDraft(keys[0]);
                if (!draft || !draft.steps || !draft.header) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // C3-B1: Extracted shared save logic to avoid duplication
    const executeSave = useCallback(async () => {
        setSaveStatus('saving');
        const ok = await savePfdDocument(pfd.data.id, pfd.data);
        setSaveStatus(ok ? 'saved' : 'error');
        if (!ok) {
            setToastMessage('Error al guardar. Intente nuevamente.');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
        if (ok) {
            setHasUnsavedChanges(false);
            refreshProjects();
            deleteUnsavedDraft();
            setTimeout(() => setSaveStatus('idle'), 2000);
        }
    }, [pfd.data, refreshProjects]);

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
    const handleSaveAs = useCallback(() => {
        setPromptState({
            isOpen: true,
            title: 'Guardar como...',
            message: 'Ingrese un nuevo nombre para la copia:',
            defaultValue: pfd.data.header.partName ? `${pfd.data.header.partName} (copia)` : '',
            onClose: () => setPromptState(prev => ({ ...prev, isOpen: false })),
            onSubmit: async (name: string) => {
                setPromptState(prev => ({ ...prev, isOpen: false }));
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
                setSaveStatus('saving');
                const ok = await savePfdDocument(newId, newDoc);
                setSaveStatus(ok ? 'saved' : 'error');
                if (ok) {
                    setHasUnsavedChanges(false);
                    refreshProjects();
                    setToastMessage(`Copia guardada como "${name}"`);
                    setTimeout(() => setSaveStatus('idle'), 2000);
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
                setHasUnsavedChanges(false);
                setShowProjectPanel(false);
                setLoadError('');
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
        if (hasUnsavedChanges) {
            setConfirmState({
                isOpen: true,
                title: 'Cambios sin guardar',
                message: 'Hay cambios sin guardar. ¿Desea continuar sin guardar?',
                variant: 'warning',
                confirmText: 'Continuar',
                onConfirm: () => {
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    pfd.resetData();
                    setCurrentProject('');
                    setHasUnsavedChanges(false);
                    setValidationIssues(null);
                },
            });
        } else {
            pfd.resetData();
            setCurrentProject('');
            setHasUnsavedChanges(false);
            setValidationIssues(null);
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

    // Exports — C5-U1: toast on success/error
    const handleExportPdf = useCallback(async () => {
        try {
            await exportPfdPdf(pfd.data);
            setToastMessage('PDF exportado correctamente');
        } catch (err) {
            logger.error('PfdApp', 'PDF export failed', {}, err instanceof Error ? err : undefined);
            setToastMessage('Error al exportar PDF');
        }
    }, [pfd.data]);

    const handleExportExcel = useCallback(() => {
        try {
            exportPfdExcel(pfd.data);
            setToastMessage('Excel exportado correctamente');
        } catch (err) {
            logger.error('PfdApp', 'Excel export failed', {}, err instanceof Error ? err : undefined);
            setToastMessage('Error al exportar Excel');
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
    const handleLoadTemplate = useCallback((templateFn: () => ReturnType<typeof createBasicProcessTemplate> = createBasicProcessTemplate) => {
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
                    pfd.setSteps(templateFn());
                },
            });
        } else {
            pfd.setSteps(templateFn());
        }
    }, [pfd.data.steps, pfd.setSteps]);

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
            message: `¿Eliminar el paso "${label}"? Esta acción no se puede deshacer.`,
            variant: 'danger',
            confirmText: 'Eliminar',
            onConfirm: () => {
                setConfirmState(prev => ({ ...prev, isOpen: false }));
                pfd.removeStep(stepId);
            },
        });
    }, [pfd.data.steps, pfd.removeStep]);

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
            // C5-U2: Ctrl+P for print
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                window.print();
            }
            if (e.key === 'Escape') {
                if (validationIssues) setValidationIssues(null);
                else if (showProjectPanel) setShowProjectPanel(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleSave, handleAddStep, pfd.undo, pfd.redo, validationIssues, showProjectPanel]);

    // Table total width
    const tableWidth = useMemo(() => {
        const cols = PFD_COLUMNS.reduce((sum, col) => sum + parseInt(col.width), 0);
        return cols + (isReadOnly ? 0 : 110); // 110px for actions column (5 buttons)
    }, [isReadOnly]);

    const errorCount = validationIssues?.filter(i => i.severity === 'error').length;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-sm">
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
                onExportPdf={handleExportPdf}
                onExportExcel={handleExportExcel}
                onPrint={() => window.print()}
                viewMode={viewMode}
                onToggleViewMode={() => setViewMode(prev => prev === 'view' ? 'edit' : 'view')}
                onValidate={handleValidate}
                validationCount={errorCount}
                onUndo={pfd.undo}
                onRedo={pfd.redo}
                canUndo={pfd.canUndo}
                canRedo={pfd.canRedo}
                stepCount={pfd.data.steps.length}
            />

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
                                        <div className="text-sm font-medium text-gray-800 truncate">{p.part_name || p.document_number || 'Sin nombre'}</div>
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

            {/* Table */}
            <div className="flex-grow p-4 pb-20">
                <div className="bg-white shadow-lg rounded border border-gray-300">
                    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]" style={{ scrollbarGutter: 'stable' }}>
                        <table className="border-collapse table-fixed" style={{ width: `${tableWidth}px` }}>
                            <colgroup>
                                {PFD_COLUMNS.map(col => (
                                    <col key={col.key} style={{ width: col.width }} />
                                ))}
                                {!isReadOnly && <col style={{ width: '110px' }} />}
                            </colgroup>
                            <PfdTable
                                steps={pfd.data.steps}
                                onUpdateStep={pfd.updateStep}
                                onBatchUpdateStep={pfd.updateStepFields}
                                onRemoveStep={handleRemoveStep}
                                onMoveStep={pfd.moveStep}
                                onInsertAfter={pfd.insertStepAfter}
                                onDuplicate={pfd.duplicateStep}
                                onAddStep={handleAddStep}
                                onLoadTemplate={handleLoadTemplate}
                                onLoadManufacturingTemplate={() => handleLoadTemplate(createManufacturingProcessTemplate)}
                                showFlowArrows={showFlowArrows}
                                readOnly={isReadOnly}
                            />
                        </table>
                    </div>
                </div>

                {/* Symbol Legend */}
                <PfdSymbolLegend />

                {/* Validation Results Panel */}
                {validationIssues && (
                    <div className="mt-4 bg-white border border-gray-200 rounded-lg shadow-sm p-4 no-print">
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
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t p-2 text-center text-xs text-gray-500 z-30 no-print">
                    <strong>{pfd.data.steps.length}</strong> {pfd.data.steps.length === 1 ? 'paso' : 'pasos'}
                    {pfd.data.steps.length > 0 && (() => {
                        const counts: Record<string, number> = {};
                        for (const s of pfd.data.steps) counts[s.stepType] = (counts[s.stepType] || 0) + 1;
                        const labels: Record<string, string> = { operation: 'Op', transport: 'Transp', inspection: 'Insp', storage: 'Alm', delay: 'Demora', decision: 'Dec', combined: 'Op+Insp' };
                        const parts = Object.entries(counts).map(([k, v]) => `${v} ${labels[k] || k}`);
                        return <span className="text-gray-400 ml-1">({parts.join(' · ')})</span>;
                    })()}
                    {' | '}
                    <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+Z</kbd> Deshacer · <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+S</kbd> Guardar
                    {' · '}
                    <button
                        onClick={() => setShowFlowArrows(!showFlowArrows)}
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition ${showFlowArrows ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-500'}`}
                        title="Mostrar/ocultar flechas de flujo entre pasos"
                    >
                        <ArrowDown size={10} />
                        Flechas
                    </button>
                    {currentProject && <span className="ml-4 text-gray-400">Proyecto: <strong className="text-cyan-600">{currentProject}</strong></span>}
                </div>
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

            {/* Toast notification */}
            {toastMessage && (
                <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-cyan-700 text-white text-xs font-medium rounded-lg shadow-lg px-4 py-2 animate-fade-in">
                    {toastMessage}
                </div>
            )}

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
