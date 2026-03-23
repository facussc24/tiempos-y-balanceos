/**
 * CpToolbar - Top toolbar, projects panel, header form, and filter bar
 *
 * Extracted from ControlPlanApp.tsx to reduce component size.
 * Contains the entire top section above the table.
 */

import React, { startTransition } from 'react';
import { ControlPlanDocument, ControlPlanHeader, ControlPlanItem, CONTROL_PLAN_PHASES } from './controlPlanTypes';
import { CpValidationIssue } from './cpCrossValidation';
import { exportControlPlan } from './controlPlanExcelExport';
import { getExportWarnings } from './controlPlanValidation';
import { CP_COLUMN_GROUP_LABELS, CP_COLUMN_GROUP_COLORS, CpColumnGroupVisibility } from './useCpColumnVisibility';
import {
    ArrowLeft, ClipboardCheck, Save, FolderOpen, FilePlus,
    FileSpreadsheet, Plus, Trash2, FileJson, FileText, Check, Clock,
    WifiOff, HardDrive, LayoutList, ShieldCheck,
    Eye, Pencil, ChevronUp, ChevronDown,
    Search, Filter, Undo2, Redo2, MoreHorizontal, BarChart3, HelpCircle, LayoutTemplate,
    Link2, ExternalLink, GitBranch, Download, Upload,
} from 'lucide-react';
import { logger } from '../../utils/logger';
import ProductSelector from '../../components/ui/ProductSelector';
import type { ProductSelection } from '../../components/ui/ProductSelector';
import { resolveApplicableParts } from '../../utils/productFamilyAutoFill';
import SyncStatusIndicator from '../../components/ui/SyncStatusIndicator';
import ProjectHierarchySelector from '../../components/ui/ProjectHierarchySelector';

interface CpToolbarProps {
    // App state
    embedded?: boolean;
    onBackToLanding?: () => void;
    isReadOnly: boolean;
    viewMode: 'view' | 'edit';
    setViewMode: React.Dispatch<React.SetStateAction<'view' | 'edit'>>;
    // Project state
    currentProject: string | null;
    saveStatus: string;
    hasUnsavedChanges: boolean;
    networkAvailable: boolean;
    lastAutoSave: string | null;
    autoSaveError?: boolean;
    projects: Array<{ filename: string; name: string; header?: { partName?: string; client?: string; linkedAmfeProject?: string } }>;
    saveCurrentProject: () => void;
    refreshProjects: () => void;
    loadSelectedProject: (name: string) => void;
    deleteSelectedProject: (name: string) => void;
    createNewProject: () => void;
    // Client hierarchy filter
    clients?: string[];
    selectedClient?: string;
    onClientChange?: (client: string) => void;
    // Panel toggles
    showProjectPanel: boolean;
    setShowProjectPanel: (v: boolean) => void;
    showSummary: boolean;
    setShowSummary: (v: boolean) => void;
    showOverflowMenu: boolean;
    setShowOverflowMenu: (v: boolean) => void;
    setShowHelp: (v: boolean) => void;
    setShowTemplates: (v: boolean) => void;
    // Undo/Redo
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    // Header
    headerCollapsed: boolean;
    setHeaderCollapsed: (v: boolean) => void;
    headerSummary: string;
    header: ControlPlanHeader;
    onHeaderChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    inputClass: string;
    // Filters
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    filterAp: '' | 'H' | 'M' | 'L';
    setFilterAp: (v: '' | 'H' | 'M' | 'L') => void;
    filterSpecial: '' | 'CC' | 'SC';
    setFilterSpecial: (v: '' | 'CC' | 'SC') => void;
    hasActiveFilters: boolean;
    clearFilters: () => void;
    searchRef: React.RefObject<HTMLInputElement | null>;
    // Column visibility
    colVis: {
        visibility: CpColumnGroupVisibility;
        toggleGroup: (group: keyof CpColumnGroupVisibility) => void;
        isDefault: boolean;
        showAll: () => void;
    };
    // Stats
    totalItems: number;
    filteredCount: number;
    completionPercent: number;
    // Validation
    validationIssues: CpValidationIssue[] | null;
    onRunValidation: () => void;
    // Export
    data: ControlPlanDocument;
    exportToJson: () => void;
    importFromJson?: () => void;
    requestConfirm: (opts: { title: string; message: string; variant?: string; confirmText?: string }) => Promise<boolean>;
    onPdfPreview: (mode: 'full' | 'critical') => void;
    // AMFE link
    onNavigateToAmfe?: () => void;
    linkedAmfeProject?: string;
    // Revision control
    onNewRevision?: () => void;
    currentRevisionLevel?: string;
    // Product catalog
    onProductSelect?: (fields: Partial<ControlPlanHeader>) => void;
    // Auto-validation badge
    autoValidationCount?: number;
    autoValidationHasErrors?: boolean;
    // Sync status
    syncAlertCount?: number;
    onSyncClick?: () => void;
    // Export folder
    onOpenExportFolder?: () => void;
    canOpenExportFolder?: boolean;
}

const CpToolbar: React.FC<CpToolbarProps> = (props) => {
    const {
        embedded, onBackToLanding, isReadOnly, viewMode, setViewMode,
        currentProject, saveStatus, hasUnsavedChanges, networkAvailable, lastAutoSave,
        projects, saveCurrentProject, refreshProjects, loadSelectedProject, deleteSelectedProject, createNewProject,
        showProjectPanel, setShowProjectPanel, showSummary, setShowSummary,
        showOverflowMenu, setShowOverflowMenu, setShowHelp, setShowTemplates,
        canUndo, canRedo, onUndo, onRedo,
        headerCollapsed, setHeaderCollapsed, headerSummary, header, onHeaderChange, inputClass,
        searchQuery, setSearchQuery, filterAp, setFilterAp, filterSpecial, setFilterSpecial,
        hasActiveFilters, clearFilters, searchRef,
        colVis, totalItems, filteredCount, completionPercent,
        validationIssues, onRunValidation,
        data, exportToJson, requestConfirm, onPdfPreview,
        onNavigateToAmfe, linkedAmfeProject,
    } = props;

    const getSaveStatusUI = () => {
        switch (saveStatus) {
            case 'saving': return <span className="text-blue-500 flex items-center gap-1"><Clock size={14} className="animate-spin" /> Guardando...</span>;
            case 'saved': return <span className="text-teal-600 flex items-center gap-1"><Check size={14} /> Guardado</span>;
            case 'error': return <span className="text-red-500">Error al guardar</span>;
            default: return hasUnsavedChanges && currentProject ? <span className="text-orange-500 text-xs">Sin guardar</span> : null;
        }
    };

    const handleExportExcel = async () => {
        setShowOverflowMenu(false);
        const warnings = getExportWarnings(data);
        if (warnings.length > 0) {
            const ok = await requestConfirm({
                title: 'Advertencias de exportación',
                message: `Se detectaron ${warnings.length} advertencia(s):\n\n${warnings.join('\n')}\n\n¿Desea exportar de todos modos?`,
                variant: 'warning',
                confirmText: 'Exportar',
            });
            if (!ok) return;
        }
        try {
            exportControlPlan(data);
        } catch (err) {
            logger.error('ControlPlan', 'Excel export failed', { error: err instanceof Error ? err.message : String(err) });
            await requestConfirm({
                title: 'Error al exportar',
                message: `No se pudo exportar Excel: ${err instanceof Error ? err.message : 'Error desconocido'}`,
                variant: 'danger',
                confirmText: 'Cerrar',
            });
        }
    };

    const handleExportPdf = async (mode: 'full' | 'critical') => {
        setShowOverflowMenu(false);
        const warnings = getExportWarnings(data);
        if (warnings.length > 0) {
            const ok = await requestConfirm({
                title: 'Advertencias de exportación',
                message: `Se detectaron ${warnings.length} advertencia(s):\n\n${warnings.join('\n')}\n\n¿Desea ver la vista previa de todos modos?`,
                variant: 'warning',
                confirmText: 'Ver Vista Previa',
            });
            if (!ok) return;
        }
        onPdfPreview(mode);
    };

    return (
        <>
            {/* Top Toolbar — always visible, even in embedded mode */}
            <header className="bg-white text-slate-800 border-b border-gray-300 p-3 sticky top-0 z-50">
                    <div className="flex flex-wrap justify-between items-center gap-3">
                        <div className="flex items-center gap-3">
                            {onBackToLanding && (
                                <button onClick={onBackToLanding}
                                    className="flex items-center gap-1 text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded hover:bg-slate-100 transition text-xs"
                                    title="Volver al menú principal"
                                    aria-label="Volver al menú principal">
                                    <ArrowLeft size={16} />
                                    <span>Inicio</span>
                                </button>
                            )}
                            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                                <div className="bg-teal-600 text-white p-1.5 rounded">
                                    <ClipboardCheck size={18} />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold text-slate-800 leading-tight">Plan de Control</h1>
                                    <p className="text-slate-400 text-[10px]">AIAG CP 1st Ed 2024</p>
                                </div>
                            </div>
                            {currentProject && (
                                <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200">
                                    <span className="text-sm font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{currentProject}</span>
                                    {getSaveStatusUI()}
                                </div>
                            )}
                            {/* AMFE Link Badge */}
                            {linkedAmfeProject && (
                                <div className="flex items-center gap-1 ml-2 pl-3 border-l border-gray-200">
                                    <Link2 size={12} className="text-orange-500" />
                                    {onNavigateToAmfe ? (
                                        <button
                                            onClick={onNavigateToAmfe}
                                            className="flex items-center gap-1 text-[11px] text-orange-600 bg-orange-50 hover:bg-orange-100 px-2 py-0.5 rounded-full transition font-medium"
                                            title={`Ir al AMFE vinculado: ${linkedAmfeProject}`}
                                        >
                                            <span className="max-w-[120px] truncate" title={`AMFE: ${linkedAmfeProject}`}>AMFE: {linkedAmfeProject}</span>
                                            <ExternalLink size={10} />
                                        </button>
                                    ) : (
                                        <span className="text-[11px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full font-medium max-w-[150px] truncate" title={`AMFE: ${linkedAmfeProject}`}>
                                            AMFE: {linkedAmfeProject}
                                        </span>
                                    )}
                                </div>
                            )}
                            {props.syncAlertCount != null && props.onSyncClick && (
                                <div className="ml-2 pl-3 border-l border-gray-200">
                                    <SyncStatusIndicator alertCount={props.syncAlertCount} onClick={props.onSyncClick} />
                                </div>
                            )}
                            {props.autoSaveError ? (
                                <div className="flex items-center gap-1 text-red-500 text-[10px] ml-2" title="El auto-guardado de borrador falló. Tu trabajo no está siendo respaldado automáticamente.">
                                    <HardDrive size={10} />
                                    <span>Borrador: error</span>
                                </div>
                            ) : lastAutoSave ? (
                                <div className="flex items-center gap-1 text-gray-400 text-[10px] ml-2">
                                    <HardDrive size={10} />
                                    <span>Borrador: {lastAutoSave}</span>
                                </div>
                            ) : null}
                            {!networkAvailable && (
                                <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs ml-2">
                                    <WifiOff size={14} />
                                    <span className="hidden sm:inline">Red no disponible</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 flex-wrap items-center">
                            {/* Persistent validation badge */}
                            <button
                                onClick={onRunValidation}
                                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2.5 py-2 rounded transition text-slate-700 font-medium text-xs relative"
                                title="Validar Plan de Control"
                                aria-label="Validar Plan de Control"
                            >
                                <ShieldCheck size={15} className={
                                    props.autoValidationHasErrors ? 'text-red-500'
                                    : (props.autoValidationCount ?? 0) > 0 ? 'text-amber-500'
                                    : 'text-teal-500'
                                } />
                                {(props.autoValidationCount ?? 0) > 0 && (
                                    <span className={`absolute -top-1 -right-1 text-[9px] font-bold rounded-full px-1 min-w-[16px] text-center ${
                                        props.autoValidationHasErrors ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'
                                    }`}>
                                        {props.autoValidationCount}
                                    </span>
                                )}
                            </button>
                            {/* View/Edit Toggle */}
                            <button onClick={() => startTransition(() => setViewMode(prev => prev === 'view' ? 'edit' : 'view'))}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded font-semibold transition shadow-sm text-xs border ${
                                    isReadOnly
                                        ? 'bg-teal-50 border-teal-300 text-teal-700 hover:bg-teal-100'
                                        : 'bg-white border-gray-300 text-slate-600 hover:bg-gray-50'
                                }`}
                                title={isReadOnly ? 'Cambiar a modo Edicion (Ctrl+D)' : 'Cambiar a modo Vista (Ctrl+D)'} data-testid="toggle-edit-mode" data-shortcut="Ctrl+D">
                                {isReadOnly ? <Eye size={15} /> : <Pencil size={15} />}
                                <span>{isReadOnly ? 'Vista' : 'Editar'}</span>
                            </button>
                            {/* Summary Toggle */}
                            <button onClick={() => setShowSummary(!showSummary)}
                                className={`flex items-center gap-1.5 border px-3 py-2 rounded transition font-medium text-xs ${
                                    showSummary ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-slate-700'
                                }`}
                                title="Resumen (Ctrl+E)" data-shortcut="Ctrl+E">
                                <BarChart3 size={15} />
                                <span className="hidden sm:inline">Resumen</span>
                            </button>
                            <div className="w-px h-6 bg-gray-300 mx-0.5" />
                            {/* Undo/Redo */}
                            <div className="flex border border-gray-300 rounded overflow-hidden">
                                <button onClick={onUndo} disabled={!canUndo}
                                    className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2.5 py-2 transition text-slate-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed border-r border-gray-300"
                                    title="Deshacer (Ctrl+Z)" aria-label="Deshacer" data-shortcut="Ctrl+Z">
                                    <Undo2 size={15} />
                                </button>
                                <button onClick={onRedo} disabled={!canRedo}
                                    className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2.5 py-2 transition text-slate-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Rehacer (Ctrl+Y)" aria-label="Rehacer" data-shortcut="Ctrl+Y">
                                    <Redo2 size={15} />
                                </button>
                            </div>
                            <div className="w-px h-6 bg-gray-300 mx-0.5" />
                            <button onClick={() => { setShowProjectPanel(!showProjectPanel); refreshProjects(); }}
                                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-2 rounded transition text-slate-700 font-medium text-xs"
                                title="Abrir proyectos">
                                <FolderOpen size={15} />
                                <span className="hidden sm:inline">Proyectos</span>
                            </button>
                            <button onClick={() => saveCurrentProject()}
                                className={`relative flex items-center gap-1.5 text-white px-3 py-2 rounded font-semibold transition shadow-sm text-xs ${hasUnsavedChanges ? 'bg-orange-500 hover:bg-orange-600' : 'bg-teal-600 hover:bg-teal-500'}`}
                                disabled={!networkAvailable}
                                title="Guardar (Ctrl+S)"
                                data-shortcut="Ctrl+S">
                                {hasUnsavedChanges && (
                                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-300 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-400" />
                                    </span>
                                )}
                                <Save size={15} />
                                <span>{currentProject ? 'Guardar' : 'Guardar Como...'}</span>
                            </button>
                            {/* Overflow "Mas" Menu */}
                            <div className="relative">
                                <button onClick={(e) => { e.stopPropagation(); setShowOverflowMenu(!showOverflowMenu); }}
                                    className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-2 rounded transition text-slate-700 font-medium text-xs"
                                    title="Más opciones"
                                    aria-haspopup="menu"
                                    aria-expanded={showOverflowMenu}>
                                    <MoreHorizontal size={15} />
                                    <span className="hidden sm:inline">Mas</span>
                                </button>
                                {showOverflowMenu && (
                                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[60] min-w-[220px] pb-2"
                                        onClick={(e) => e.stopPropagation()}>
                                        <div className="px-4 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 rounded-t-lg">
                                            Exportar
                                        </div>
                                        <button onClick={handleExportExcel}
                                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2.5">
                                            <FileSpreadsheet size={14} className="text-emerald-500 flex-shrink-0" />
                                            <div>
                                                <span className="font-bold text-gray-800">Excel</span>
                                                <p className="text-[10px] text-gray-400 mt-0.5">Exportar Plan de Control</p>
                                            </div>
                                        </button>
                                        <button onClick={() => { setShowOverflowMenu(false); exportToJson(); }}
                                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2.5">
                                            <Download size={14} className="text-sky-500 flex-shrink-0" />
                                            <div>
                                                <span className="font-bold text-gray-800">Exportar JSON</span>
                                                <p className="text-[10px] text-gray-400 mt-0.5">Descargar como archivo JSON</p>
                                            </div>
                                        </button>
                                        {props.importFromJson && (
                                            <button onClick={() => { setShowOverflowMenu(false); props.importFromJson!(); }}
                                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2.5">
                                                <Upload size={14} className="text-sky-500 flex-shrink-0" />
                                                <div>
                                                    <span className="font-bold text-gray-800">Importar JSON</span>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Cargar desde archivo JSON</p>
                                                </div>
                                            </button>
                                        )}
                                        <button onClick={() => handleExportPdf('full')}
                                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2.5">
                                            <FileText size={14} className="text-red-500 flex-shrink-0" />
                                            <div>
                                                <span className="font-bold text-gray-800">PDF Completo</span>
                                                <p className="text-[10px] text-gray-400 mt-0.5">Tabla AIAG completa (A3)</p>
                                            </div>
                                        </button>
                                        <button onClick={() => handleExportPdf('critical')}
                                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2.5">
                                            <FileText size={14} className="text-orange-500 flex-shrink-0" />
                                            <div>
                                                <span className="font-bold text-gray-800">PDF Items Criticos</span>
                                                <p className="text-[10px] text-gray-400 mt-0.5">Solo CC/SC y AP Alto (A4)</p>
                                            </div>
                                        </button>
                                        {props.onOpenExportFolder && (
                                            <button
                                                onClick={() => { setShowOverflowMenu(false); props.onOpenExportFolder!(); }}
                                                disabled={!props.canOpenExportFolder}
                                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-amber-50 border-b border-gray-100 flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <FolderOpen size={14} className="text-amber-500 flex-shrink-0" />
                                                <div>
                                                    <span className="font-bold text-gray-800">Abrir Carpeta</span>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Ver archivos exportados en Y:\INGENIERIA</p>
                                                </div>
                                            </button>
                                        )}
                                        <div className="px-4 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                                            Herramientas
                                        </div>
                                        <button onClick={() => { setShowOverflowMenu(false); onRunValidation(); }}
                                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2.5">
                                            <ShieldCheck size={14} className={
                                                validationIssues && validationIssues.some(i => i.severity === 'error') ? 'text-red-500'
                                                : validationIssues && validationIssues.length > 0 ? 'text-amber-500'
                                                : 'text-teal-500'
                                            } />
                                            <div>
                                                <span className="font-bold text-gray-800">Validar Plan</span>
                                                <p className="text-[10px] text-gray-400 mt-0.5">Cross-validation AMFE</p>
                                            </div>
                                        </button>
                                        <button onClick={() => { setShowOverflowMenu(false); setShowTemplates(true); }}
                                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2.5">
                                            <LayoutTemplate size={14} className="text-purple-500 flex-shrink-0" />
                                            <div>
                                                <span className="font-bold text-gray-800">Templates</span>
                                                <p className="text-[10px] text-gray-400 mt-0.5">Agregar items predefinidos</p>
                                            </div>
                                        </button>
                                        <button onClick={() => { setShowOverflowMenu(false); setShowHelp(true); }}
                                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 flex items-center gap-2.5">
                                            <HelpCircle size={14} className="text-cyan-500 flex-shrink-0" />
                                            <div>
                                                <span className="font-bold text-gray-800">Referencia Rapida</span>
                                                <p className="text-[10px] text-gray-400 mt-0.5">Columnas, atajos, fases (Ctrl+H)</p>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="w-px h-6 bg-gray-300 mx-0.5" />
                            {props.onNewRevision && (
                                <button
                                    onClick={props.onNewRevision}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 hover:border-teal-300 transition hover:shadow-sm"
                                    title="Crear nueva revision del documento"
                                >
                                    <GitBranch size={15} />
                                    <span className="hidden sm:inline">Nueva Rev.</span>
                                    <span className="bg-teal-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {props.currentRevisionLevel || 'A'}
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                </header>

            {/* Projects Panel */}
            {showProjectPanel && (
                <div className="bg-white border-b border-gray-300 shadow-lg animate-in">
                    <div className="p-4 max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <FolderOpen size={16} className="text-teal-600" />
                                Planes de Control Guardados
                                <span className="text-gray-400 font-normal text-xs">({projects.length})</span>
                            </h2>
                            <button onClick={createNewProject}
                                className="flex items-center gap-1 text-xs bg-teal-50 hover:bg-teal-100 text-teal-700 px-3 py-1.5 rounded transition font-medium">
                                <FilePlus size={14} /> Nuevo Plan
                            </button>
                        </div>

                        {/* Client hierarchy filter */}
                        {props.clients && props.clients.length > 0 && props.onClientChange && (
                            <ProjectHierarchySelector
                                clients={props.clients}
                                selectedClient={props.selectedClient || ''}
                                onClientChange={props.onClientChange}
                                accentColor="teal"
                                moduleLabel="Plan de Control"
                            />
                        )}

                        {projects.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No hay planes guardados{props.selectedClient ? ` para "${props.selectedClient}"` : ''}.</p>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {projects.map(p => (
                                    <div key={p.filename}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition hover:shadow-sm cursor-pointer ${currentProject === p.name ? 'border-teal-400 bg-teal-50/50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                                        onClick={() => { loadSelectedProject(p.name); setShowProjectPanel(false); }}>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <ClipboardCheck size={14} className="text-teal-500 flex-shrink-0" />
                                                <span className="font-medium text-sm text-gray-800 truncate" title={p.name}>{p.name}</span>
                                                {currentProject === p.name && <span className="text-[10px] bg-teal-500 text-white px-1.5 py-0.5 rounded-full">activo</span>}
                                            </div>
                                            <div className="text-[10px] text-gray-400 ml-6 mt-0.5">
                                                {p.header?.client && <span className="mr-3 font-medium text-gray-500">{p.header.client}</span>}
                                                {p.header?.partName && <span className="mr-3">{p.header.partName}</span>}
                                                {p.header?.linkedAmfeProject && <span className="mr-3">AMFE: {p.header.linkedAmfeProject}</span>}
                                            </div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); deleteSelectedProject(p.name); }}
                                            className="text-gray-300 hover:text-red-500 p-1.5 transition" title="Eliminar">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Header Form -- Collapsible */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-[1800px] mx-auto p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => setHeaderCollapsed(!headerCollapsed)}
                            className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100 transition"
                            title={headerCollapsed ? 'Expandir header' : 'Colapsar header'}
                            aria-label={headerCollapsed ? 'Expandir encabezado' : 'Colapsar encabezado'}
                            aria-expanded={!headerCollapsed}>
                            {headerCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </button>
                        <LayoutList className="text-teal-600" size={18} />
                        <h2 className="text-sm font-bold text-gray-800">Datos del Plan de Control</h2>
                        {headerCollapsed && (
                            <span className="text-xs text-gray-400 ml-3 truncate max-w-[600px]" title={headerSummary}>{headerSummary}</span>
                        )}
                        {headerCollapsed && header.applicableParts?.trim() && (
                            <span className="bg-teal-100 text-teal-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2">Familia</span>
                        )}
                    </div>

                    {!headerCollapsed && (
                        <>
                            {/* Row 1: Document ID + Phase */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                                <div>
                                    <label className="block text-gray-500 font-bold mb-1">Nro. Plan de Control</label>
                                    <input name="controlPlanNumber" value={header.controlPlanNumber} onChange={onHeaderChange} maxLength={30} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-gray-500 font-bold mb-1">Fase</label>
                                    <div className="flex gap-3 items-center h-[38px] flex-wrap">
                                        {CONTROL_PLAN_PHASES.map(p => (
                                            <label key={p.value} className="flex items-center gap-1.5 cursor-pointer text-xs whitespace-nowrap">
                                                <input type="radio" name="phase" value={p.value}
                                                    checked={header.phase === p.value}
                                                    onChange={onHeaderChange}
                                                    className="accent-teal-600" />
                                                {p.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-gray-500 font-bold mb-1">Fecha</label>
                                    <input name="date" type="date" value={header.date} onChange={onHeaderChange} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-gray-500 font-bold mb-1">Revision</label>
                                    <input name="revision" value={header.revision} onChange={onHeaderChange} maxLength={20} className={inputClass} />
                                </div>
                            </div>

                            {/* Row 2: Part identification */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                                <div>
                                    <label className="block text-gray-500 font-bold mb-1">Nro. Pieza</label>
                                    <ProductSelector
                                        name="partNumber"
                                        value={header.partNumber}
                                        onProductSelect={(sel: ProductSelection) => {
                                            props.onProductSelect?.({
                                                partNumber: sel.codigo,
                                                partName: sel.descripcion,
                                                client: sel.lineaName,
                                            });
                                            // Auto-fill applicableParts with family members (or line siblings)
                                            if (sel.isFromCatalog && sel.lineaCode) {
                                                resolveApplicableParts(sel.codigo, sel.lineaCode)
                                                    .then(parts => {
                                                        if (parts) {
                                                            props.onProductSelect?.({ applicableParts: parts });
                                                        }
                                                    })
                                                    .catch(() => {});
                                            }
                                        }}
                                        onTextChange={(val) => {
                                            const synth = { target: { name: 'partNumber', value: val } } as React.ChangeEvent<HTMLInputElement>;
                                            onHeaderChange(synth);
                                        }}
                                        readOnly={isReadOnly}
                                        placeholder="Buscar o escribir nro. pieza..."
                                        maxLength={50}
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-500 font-bold mb-1">Nivel de Cambio</label>
                                    <input name="latestChangeLevel" value={header.latestChangeLevel} onChange={onHeaderChange} maxLength={30} className={inputClass} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-gray-500 font-bold mb-1">Nombre Pieza / Descripción</label>
                                    <input name="partName" value={header.partName} onChange={onHeaderChange} maxLength={150} className={inputClass} />
                                </div>
                                <div className="col-span-4">
                                    <label className="block text-gray-500 font-bold mb-1">Piezas Aplicables</label>
                                    <textarea name="applicableParts" value={header.applicableParts || ''} onChange={onHeaderChange} className={inputClass + ' resize-y'} rows={2} placeholder="Si cubre una familia, listar nros de pieza (uno por línea). Dejar vacío si es pieza única." />
                                    <p className="text-[9px] text-gray-400 mt-0.5">Se hereda del AMFE al generar. Editable para ajustes.</p>
                                </div>
                            </div>

                            {/* Row 3: Organization / Supplier */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                                <div>
                                    <label className="block text-gray-500 font-bold mb-1">Organización / Planta</label>
                                    <input name="organization" value={header.organization} onChange={onHeaderChange} maxLength={100} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-gray-500 font-bold mb-1">Proveedor</label>
                                    <input name="supplier" value={header.supplier} onChange={onHeaderChange} maxLength={100} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-gray-500 font-bold mb-1">Código Proveedor</label>
                                    <input name="supplierCode" value={header.supplierCode} onChange={onHeaderChange} maxLength={30} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-gray-500 font-bold mb-1">Contacto Clave / Teléfono</label>
                                    <input name="keyContactPhone" value={header.keyContactPhone} onChange={onHeaderChange} maxLength={80} className={inputClass} />
                                </div>
                            </div>

                            {/* Row 4: Team */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                                <div>
                                    <label className="block text-gray-500 font-bold mb-1">Cliente</label>
                                    <input name="client" value={header.client} onChange={onHeaderChange} maxLength={100} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-gray-500 font-bold mb-1">Responsable</label>
                                    <input name="responsible" value={header.responsible} onChange={onHeaderChange} maxLength={80} className={inputClass} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-gray-500 font-bold mb-1">Equipo</label>
                                    <input name="coreTeam" value={header.coreTeam} onChange={onHeaderChange} maxLength={300} className={inputClass} />
                                </div>
                            </div>

                            {/* Row 5: Approvals section */}
                            <div className="border-l-4 border-teal-300 pl-3 mt-1">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Aprobaciones</span>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-1">
                                    <div>
                                        <label className="block text-gray-500 font-bold mb-1">Aprobación Proveedor/Planta</label>
                                        <input name="approvedBy" value={header.approvedBy} onChange={onHeaderChange} maxLength={80} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-gray-500 font-bold mb-1">Aprobación Ing. Cliente</label>
                                        <input name="customerEngApproval" value={header.customerEngApproval} onChange={onHeaderChange} maxLength={80} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-gray-500 font-bold mb-1">Aprobación Calidad Cliente</label>
                                        <input name="customerQualityApproval" value={header.customerQualityApproval} onChange={onHeaderChange} maxLength={80} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-gray-500 font-bold mb-1">Otra Aprobación</label>
                                        <input name="otherApproval" value={header.otherApproval} onChange={onHeaderChange} maxLength={80} className={inputClass} />
                                    </div>
                                </div>
                            </div>

                            {/* AMFE link (only shown when linked) */}
                            {header.linkedAmfeProject && (
                                <div className="mt-3 text-xs">
                                    <label className="block text-gray-500 font-bold mb-1">AMFE Vinculado</label>
                                    <input name="linkedAmfeProject" value={header.linkedAmfeProject} onChange={onHeaderChange} className={inputClass} readOnly />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 overflow-x-auto">
                <div className="max-w-[1800px] mx-auto flex items-center gap-3 flex-wrap">
                    <Filter size={14} className="text-gray-400" />
                    {isReadOnly && (
                        <span className="bg-teal-100 text-teal-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                            Modo Vista
                        </span>
                    )}
                    {/* AP filter */}
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500 font-bold">AP:</span>
                        {(['', 'H', 'M', 'L'] as const).map(ap => (
                            <button key={ap || 'all'} onClick={() => setFilterAp(ap)}
                                className={`text-[10px] px-2 py-0.5 rounded border transition ${
                                    filterAp === ap
                                        ? ap === 'H' ? 'bg-red-100 border-red-300 text-red-700 font-bold'
                                        : ap === 'M' ? 'bg-amber-100 border-amber-300 text-amber-700 font-bold'
                                        : ap === 'L' ? 'bg-green-100 border-green-300 text-green-700 font-bold'
                                        : 'bg-teal-100 border-teal-300 text-teal-700 font-bold'
                                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}>
                                {ap || 'Todos'}
                            </button>
                        ))}
                    </div>
                    {/* Special char filter */}
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500 font-bold">Especial:</span>
                        {(['', 'CC', 'SC'] as const).map(sc => (
                            <button key={sc || 'all'} onClick={() => setFilterSpecial(sc)}
                                className={`text-[10px] px-2 py-0.5 rounded border transition ${
                                    filterSpecial === sc
                                        ? sc === 'CC' ? 'bg-red-100 border-red-300 text-red-700 font-bold'
                                        : sc === 'SC' ? 'bg-orange-100 border-orange-300 text-orange-700 font-bold'
                                        : 'bg-teal-100 border-teal-300 text-teal-700 font-bold'
                                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}>
                                {sc || 'Todos'}
                            </button>
                        ))}
                    </div>
                    {/* Search */}
                    <div className="relative flex-1 max-w-xs">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input ref={searchRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar... (Ctrl+F)"
                            aria-label="Buscar en Plan de Control"
                            className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-teal-200 focus:border-teal-300 outline-none"
                            data-shortcut="Ctrl+F" />
                    </div>
                    {hasActiveFilters && (
                        <button onClick={clearFilters}
                            className="text-[10px] text-gray-400 hover:text-gray-600 underline">
                            Limpiar filtros
                        </button>
                    )}
                    {/* Column visibility toggles */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 font-medium">Columnas:</span>
                        {(Object.keys(CP_COLUMN_GROUP_LABELS) as (keyof CpColumnGroupVisibility)[]).map(group => (
                            <button key={group} onClick={() => colVis.toggleGroup(group)}
                                className={`text-[10px] px-2 py-0.5 rounded-full border transition font-medium ${
                                    colVis.visibility[group]
                                        ? `${CP_COLUMN_GROUP_COLORS[group]} border-current`
                                        : 'bg-gray-50 text-gray-300 border-gray-200 line-through'
                                }`}>
                                {CP_COLUMN_GROUP_LABELS[group]}
                            </button>
                        ))}
                        {!colVis.isDefault && (
                            <button onClick={colVis.showAll} className="text-[10px] text-teal-500 hover:text-teal-700 ml-1">
                                Mostrar todas
                            </button>
                        )}
                    </div>
                    {/* Item counter + Progress bar */}
                    <div className="flex items-center gap-2 ml-auto">
                        {totalItems > 0 && (
                            <div className="flex items-center gap-1.5">
                                <div className="w-20 bg-gray-200 rounded-full h-1.5 overflow-hidden" role="progressbar" aria-valuenow={completionPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`Completitud: ${completionPercent}%`}>
                                    <div className={`h-full rounded-full transition-all ${
                                        completionPercent === 100 ? 'bg-teal-500' :
                                        completionPercent > 70 ? 'bg-teal-400' :
                                        completionPercent > 40 ? 'bg-amber-400' : 'bg-red-400'
                                    }`} style={{ width: `${completionPercent}%` }} />
                                </div>
                                <span className="text-[10px] text-gray-400">{completionPercent}%</span>
                            </div>
                        )}
                        <span className="text-[10px] text-gray-400">
                            {hasActiveFilters
                                ? <><strong className="text-teal-600">{filteredCount}</strong> de {totalItems} items</>
                                : <><strong>{totalItems}</strong> items</>}
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CpToolbar;
