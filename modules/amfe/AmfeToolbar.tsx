import React, { startTransition } from 'react';
import {
    Plus, FileJson, Save,
    FolderOpen, Check, Clock, ArrowLeft, WifiOff, HardDrive,
    BarChart3, FileSpreadsheet, Library, ClipboardCheck,
    Hash, X, MoreHorizontal, Undo2, Redo2, FileText, Shield, Zap, Bot,
    Eye, Pencil, HelpCircle, Copy, Layers,
} from 'lucide-react';
import type { ActiveTab } from './useAmfeTabNavigation';

type ActivePanel = 'none' | 'projects' | 'summary' | 'library' | 'registry' | 'templates';

interface AmfeToolbarProps {
    // Tab navigation
    tabNav: {
        activeTab: ActiveTab;
        setActiveTab: (t: ActiveTab) => void;
        cpInitialData: unknown;
        hoInitialData: unknown;
        handleGenerateControlPlan: () => void;
        handleGenerateHojasOperaciones: () => void;
    };
    // Project info
    projects: {
        currentProject: string | null;
        currentProjectRef: { client: string; project: string; name: string } | null;
        hasUnsavedChanges: boolean;
        networkAvailable: boolean;
        saveStatus: 'idle' | 'saving' | 'saved' | 'error';
        refreshProjects: () => void;
        saveAsProject: () => void;
    };
    // Persistence info
    lastAutoSave: string | null;
    // Confirm dialog
    requestConfirm: (opts: { title: string; message: string; variant?: 'danger' | 'warning' | 'info'; confirmText?: string }) => Promise<boolean>;
    // Navigation
    onBackToLanding: () => void;
    // View mode
    viewMode: 'view' | 'edit';
    setViewMode: React.Dispatch<React.SetStateAction<'view' | 'edit'>>;
    // Panels
    activePanel: ActivePanel;
    showSummary: boolean;
    setShowSummary: (v: boolean) => void;
    showLibrary: boolean;
    setShowLibrary: (v: boolean) => void;
    showProjectPanel: boolean;
    setShowProjectPanel: (v: boolean) => void;
    setShowRegistry: (v: boolean) => void;
    setShowTemplates: (v: boolean) => void;
    showRegistry: boolean;
    showHelp: boolean;
    showChat: boolean;
    setShowChangeAnalysis: (v: boolean) => void;
    setShowAudit: (v: boolean) => void;
    setShowChat: (v: boolean) => void;
    setShowHelp: (v: boolean) => void;
    // History
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    // Save
    onSave: () => void;
    // Export
    amfeExport: {
        isExporting: boolean;
        handleExcelResumenAP: () => void;
        handleExcelPlanAcciones: () => void;
        handlePdfPreview: (template: 'full' | 'summary' | 'actionPlan') => void;
    };
    // Library refresh
    libraryRefresh: () => void;
    // Soft limit warnings count
    softLimitWarningCount: number;
    // Overflow menu
    showOverflowMenu: boolean;
    setShowOverflowMenu: (v: boolean) => void;
}

const AmfeToolbar: React.FC<AmfeToolbarProps> = ({
    tabNav,
    projects,
    lastAutoSave,
    requestConfirm,
    onBackToLanding,
    viewMode,
    setViewMode,
    showSummary,
    setShowSummary,
    showLibrary,
    setShowLibrary,
    showProjectPanel,
    setShowProjectPanel,
    setShowRegistry,
    setShowTemplates,
    showRegistry,
    showHelp,
    showChat,
    setShowChangeAnalysis,
    setShowAudit,
    setShowChat,
    setShowHelp,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onSave,
    amfeExport,
    libraryRefresh,
    softLimitWarningCount,
    showOverflowMenu,
    setShowOverflowMenu,
}) => {
    const isReadOnly = viewMode === 'view';

    const getSaveStatusUI = () => {
        switch (projects.saveStatus) {
            case 'saving': return <span className="text-blue-500 flex items-center gap-1"><Clock size={14} className="animate-spin" /> Guardando...</span>;
            case 'saved': return <span className="text-green-600 flex items-center gap-1"><Check size={14} /> Guardado</span>;
            case 'error': return <span className="text-red-500">Error al guardar</span>;
            default: return projects.hasUnsavedChanges && projects.currentProject ? <span className="text-orange-500 text-xs">Sin guardar</span> : null;
        }
    };

    return (
        <header className="bg-white text-slate-800 border-b border-gray-300 p-3 sticky top-0 z-50">
            {/* Tab row */}
            <div className="flex items-center gap-0 mb-2 -mx-3 -mt-3 px-4 border-b border-gray-200">
                <button
                    onClick={() => tabNav.setActiveTab('amfe')}
                    className="px-4 py-2 text-xs font-medium text-blue-700 border-b-2 border-blue-600 bg-blue-50/50 transition"
                >
                    AMFE VDA
                </button>
                <button
                    onClick={() => tabNav.cpInitialData ? tabNav.setActiveTab('controlPlan') : tabNav.handleGenerateControlPlan()}
                    className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300 transition flex items-center gap-1.5"
                >
                    <ClipboardCheck size={13} />
                    Plan de Control
                </button>
                <button
                    onClick={() => tabNav.hoInitialData ? tabNav.setActiveTab('hojaOperaciones') : tabNav.handleGenerateHojasOperaciones()}
                    className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300 transition flex items-center gap-1.5"
                >
                    <FileText size={13} />
                    Hojas de Operaciones
                </button>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-3">
                {/* Back + Logo + Project Name */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={async () => {
                            if (projects.hasUnsavedChanges) {
                                const ok = await requestConfirm({
                                    title: 'Cambios sin guardar',
                                    message: 'Hay cambios sin guardar. ¿Volver al inicio?',
                                    variant: 'warning',
                                    confirmText: 'Volver',
                                });
                                if (!ok) return;
                            }
                            onBackToLanding();
                        }}
                        className="flex items-center gap-1 text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded hover:bg-slate-100 transition text-xs"
                    >
                        <ArrowLeft size={16} />
                        <span>Inicio</span>
                    </button>

                    <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                        <div className="bg-blue-600 text-white p-1.5 rounded">
                            <FileJson size={18} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800 leading-tight">AMFE VDA Manager</h1>
                            <p className="text-slate-400 text-[10px]">AIAG-VDA | AP Automático</p>
                        </div>
                    </div>
                    {projects.currentProjectRef && (
                        <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200">
                            {projects.currentProjectRef.client ? (
                                <span className="text-sm font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded truncate max-w-[300px]" title={`${projects.currentProjectRef.client}/${projects.currentProjectRef.project}/${projects.currentProjectRef.name}`}>
                                    {projects.currentProjectRef.client}/{projects.currentProjectRef.project}/{projects.currentProjectRef.name}
                                </span>
                            ) : (
                                <span className="text-sm font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{projects.currentProject}</span>
                            )}
                            {getSaveStatusUI()}
                        </div>
                    )}
                    {!projects.currentProjectRef && getSaveStatusUI()}

                    {lastAutoSave && (
                        <div className="flex items-center gap-1 text-gray-400 text-[10px] ml-2">
                            <HardDrive size={10} />
                            <span>Borrador: {lastAutoSave}</span>
                        </div>
                    )}

                    {!projects.networkAvailable && (
                        <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs ml-2">
                            <WifiOff size={14} />
                            <span className="hidden sm:inline">Red no disponible</span>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                    {/* View/Edit Mode Toggle */}
                    <button onClick={() => startTransition(() => setViewMode(prev => prev === 'view' ? 'edit' : 'view'))}
                        className={`flex items-center gap-1.5 border px-3 py-2 rounded transition font-medium text-xs ${isReadOnly ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-emerald-50 border-emerald-300 text-emerald-700'}`}
                        title={isReadOnly ? 'Cambiar a modo Edición (Ctrl+D)' : 'Cambiar a modo Vista (Ctrl+D)'}
                        data-shortcut="Ctrl+D">
                        {isReadOnly ? <Eye size={15} /> : <Pencil size={15} />}
                        <span className="hidden sm:inline">{isReadOnly ? 'Modo Vista' : 'Modo Edición'}</span>
                    </button>

                    {/* Summary Toggle */}
                    <button onClick={() => setShowSummary(!showSummary)}
                        className={`relative flex items-center gap-1.5 border px-3 py-2 rounded transition font-medium text-xs ${showSummary ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-slate-700'}`}
                        data-shortcut="Ctrl+E">
                        <BarChart3 size={15} />
                        <span className="hidden sm:inline">Resumen</span>
                        {softLimitWarningCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                                {softLimitWarningCount}
                            </span>
                        )}
                    </button>

                    {/* Library Toggle */}
                    <button onClick={() => { setShowLibrary(!showLibrary); libraryRefresh(); }}
                        className={`flex items-center gap-1.5 border px-3 py-2 rounded transition font-medium text-xs ${showLibrary ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-slate-700'}`}>
                        <Library size={15} />
                        <span className="hidden sm:inline">Biblioteca</span>
                    </button>

                    {/* Undo / Redo */}
                    <div className="flex border border-gray-300 rounded overflow-hidden">
                        <button
                            onClick={onUndo}
                            disabled={!canUndo}
                            className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2.5 py-2 transition text-slate-700 text-xs disabled:opacity-30 disabled:cursor-not-allowed border-r border-gray-300"
                            title="Deshacer (Ctrl+Z)"
                        >
                            <Undo2 size={15} />
                        </button>
                        <button
                            onClick={onRedo}
                            disabled={!canRedo}
                            className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2.5 py-2 transition text-slate-700 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Rehacer (Ctrl+Y)"
                        >
                            <Redo2 size={15} />
                        </button>
                    </div>

                    {/* Projects Panel Toggle */}
                    <button onClick={() => { setShowProjectPanel(!showProjectPanel); projects.refreshProjects(); }}
                        className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-2 rounded transition text-slate-700 font-medium text-xs">
                        <FolderOpen size={15} />
                        <span className="hidden sm:inline">Proyectos</span>
                    </button>

                    {/* Quick Save */}
                    <button onClick={onSave}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded font-semibold transition shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!projects.networkAvailable || projects.saveStatus === 'saving'}
                        title={projects.currentProjectRef ? `Guardar en ${projects.currentProjectRef.client}/${projects.currentProjectRef.project}/${projects.currentProjectRef.name}` : 'Guardar Como... (Ctrl+S)'}
                        data-shortcut="Ctrl+S">
                        <Save size={15} />
                        <span>{projects.currentProjectRef?.client ? 'Guardar' : 'Guardar Como...'}</span>
                    </button>

                    {/* Save As (only when already saved somewhere) */}
                    {projects.currentProjectRef?.client && (
                        <button onClick={projects.saveAsProject}
                            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-2 rounded transition text-slate-700 text-xs"
                            title="Guardar Como..."
                            disabled={!projects.networkAvailable}>
                            <Copy size={14} />
                        </button>
                    )}

                    {/* Copiloto IA Button */}
                    <button
                        onClick={() => setShowChat(!showChat)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded transition font-medium text-xs ${
                            showChat
                                ? 'bg-violet-100 border border-violet-400 text-violet-700'
                                : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 shadow-sm'
                        }`}
                        title="Copiloto IA (Ctrl+I)"
                        data-shortcut="Ctrl+I"
                    >
                        <Bot size={15} />
                        <span className="hidden sm:inline">Copiloto IA</span>
                    </button>

                    {/* Overflow "Mas" Menu */}
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowOverflowMenu(!showOverflowMenu); }}
                            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-2 rounded transition text-slate-700 font-medium text-xs"
                            title="Más opciones"
                        >
                            <MoreHorizontal size={15} />
                            <span className="hidden sm:inline">Más</span>
                        </button>
                        {showOverflowMenu && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[60] min-w-[220px] max-h-[calc(100vh-120px)] overflow-y-auto pb-2">
                                {/* HERRAMIENTAS Section */}
                                <div className="px-4 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 rounded-t-lg">
                                    Herramientas
                                </div>
                                <button
                                    onClick={() => { setShowOverflowMenu(false); setShowRegistry(!showRegistry); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                >
                                    <Hash size={14} className="text-indigo-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">Registro IATF</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Índice centralizado 16949</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setShowOverflowMenu(false); setShowChangeAnalysis(true); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                >
                                    <Zap size={14} className="text-purple-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">Analizar Cambio</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Impacto de cambio de proceso</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setShowOverflowMenu(false); setShowAudit(true); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                >
                                    <Shield size={14} className="text-blue-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">Auditar AMFE</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Verificar completitud y calidad</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setShowOverflowMenu(false); setShowHelp(!showHelp); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                >
                                    <HelpCircle size={14} className="text-cyan-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">Referencia Rápida</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Escalas AIAG-VDA, atajos, flujo (Ctrl+H)</p>
                                    </div>
                                </button>
                                {/* EXPORTAR Section */}
                                <div className="px-4 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                                    Exportar
                                </div>
                                <button
                                    disabled={amfeExport.isExporting}
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handleExcelResumenAP(); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                >
                                    <FileSpreadsheet size={14} className="text-emerald-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">{amfeExport.isExporting ? 'Exportando...' : 'Excel: Resumen AP'}</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Fallas alta/media prioridad</p>
                                    </div>
                                </button>
                                <button
                                    disabled={amfeExport.isExporting}
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handleExcelPlanAcciones(); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                >
                                    <FileSpreadsheet size={14} className="text-emerald-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">{amfeExport.isExporting ? 'Exportando...' : 'Excel: Plan Acciones'}</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Acciones abiertas para seguimiento</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handlePdfPreview('full'); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                >
                                    <FileText size={14} className="text-red-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">PDF: Tabla VDA Completa</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Sábana completa landscape A3</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handlePdfPreview('summary'); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                >
                                    <FileText size={14} className="text-red-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">PDF: Resumen AP</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Causas alta/media prioridad</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handlePdfPreview('actionPlan'); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                >
                                    <FileText size={14} className="text-red-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">PDF: Plan de Acciones</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Acciones abiertas para seguimiento</p>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default AmfeToolbar;
