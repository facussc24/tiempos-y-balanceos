import React, { startTransition } from 'react';
import {
    FileJson, Save,
    FolderOpen, Check, Clock, WifiOff, HardDrive,
    BarChart3, FileSpreadsheet, Library, Loader2,
    Hash, MoreHorizontal, Undo2, Redo2, FileText,
    Eye, Pencil, HelpCircle, Copy, BookOpen, GitBranch, Download, Upload,
} from 'lucide-react';

type ActivePanel = 'none' | 'projects' | 'summary' | 'library' | 'registry' | 'templates';

interface AmfeToolbarProps {
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
    autoSaveError?: boolean;
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
        isExportingPdf: boolean;
        handleExcelCompleto: () => void;
        handleExcelResumenAP: () => void;
        handleExcelPlanAcciones: () => void;
        handlePdfPreview: (template: 'full' | 'summary' | 'actionPlan') => void;
        handleExportJson: () => void;
        handleImportJson: () => void;
    };
    // Library refresh
    libraryRefresh: () => void;
    // Soft limit warnings count
    softLimitWarningCount: number;
    // Overflow menu
    showOverflowMenu: boolean;
    setShowOverflowMenu: (v: boolean) => void;
    // Load example
    onLoadExample?: () => void;
    // Revision control
    onNewRevision?: () => void;
    currentRevisionLevel?: string;
    // Export folder
    onOpenExportFolder?: () => void;
    canOpenExportFolder?: boolean;
}

const AmfeToolbar: React.FC<AmfeToolbarProps> = ({
    projects,
    lastAutoSave,
    autoSaveError,
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
    onLoadExample,
    onNewRevision,
    currentRevisionLevel,
    onOpenExportFolder,
    canOpenExportFolder,
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
        <header className="bg-white text-slate-800 border-b border-gray-300 px-3 py-2 z-40">
            <div className="flex flex-wrap justify-between items-center gap-3">
                {/* Logo + Project Name */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
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

                    {autoSaveError ? (
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
                        data-shortcut="Ctrl+D"
                        data-testid="toggle-edit-mode">
                        {isReadOnly ? <Eye size={15} /> : <Pencil size={15} />}
                        <span className="hidden sm:inline">{isReadOnly ? 'Modo Vista' : 'Modo Edición'}</span>
                    </button>

                    {/* Summary Toggle */}
                    <button onClick={() => setShowSummary(!showSummary)}
                        className={`relative flex items-center gap-1.5 border px-3 py-2 rounded transition font-medium text-xs ${showSummary ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-slate-700'}`}
                        title="Resumen del AMFE (Ctrl+E)"
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
                        className={`flex items-center gap-1.5 border px-3 py-2 rounded transition font-medium text-xs ${showLibrary ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-slate-700'}`}
                        title="Biblioteca de operaciones">
                        <Library size={15} />
                        <span className="hidden sm:inline">Biblioteca</span>
                    </button>

                    {/* Undo / Redo */}
                    <div className="flex border border-gray-300 rounded overflow-hidden">
                        <button
                            onClick={onUndo}
                            disabled={!canUndo}
                            className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2.5 py-2 transition text-slate-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed border-r border-gray-300"
                            title="Deshacer (Ctrl+Z)"
                        >
                            <Undo2 size={15} />
                        </button>
                        <button
                            onClick={onRedo}
                            disabled={!canRedo}
                            className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2.5 py-2 transition text-slate-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className={`relative flex items-center gap-1.5 text-white px-3 py-2 rounded font-semibold transition shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed ${projects.hasUnsavedChanges ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-500'}`}
                        disabled={!projects.networkAvailable || projects.saveStatus === 'saving'}
                        title={projects.currentProjectRef ? `Guardar en ${projects.currentProjectRef.client}/${projects.currentProjectRef.project}/${projects.currentProjectRef.name}` : 'Guardar Como... (Ctrl+S)'}
                        data-shortcut="Ctrl+S">
                        {projects.hasUnsavedChanges && (
                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-300 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-400" />
                            </span>
                        )}
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

                    {/* Revision Button */}
                    {onNewRevision && (
                        <button
                            onClick={onNewRevision}
                            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition hover:shadow-sm"
                            title="Crear nueva revision del documento"
                        >
                            <GitBranch size={15} />
                            <span className="hidden sm:inline">Nueva Rev.</span>
                            <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {currentRevisionLevel || 'A'}
                            </span>
                        </button>
                    )}

                    {/* Overflow "Mas" Menu */}
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowOverflowMenu(!showOverflowMenu); }}
                            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-2 rounded transition text-slate-700 font-medium text-xs"
                            title="Más opciones"
                            aria-haspopup="menu"
                            aria-expanded={showOverflowMenu}
                        >
                            <MoreHorizontal size={15} />
                            <span className="hidden sm:inline">Más</span>
                        </button>
                        {showOverflowMenu && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[60] min-w-[220px] max-h-[calc(100vh-200px)] overflow-y-auto pb-4">
                                {/* HERRAMIENTAS Section */}
                                <div className="px-4 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 rounded-t-lg">
                                    Herramientas
                                </div>
                                {onLoadExample && (
                                    <button
                                        onClick={() => { setShowOverflowMenu(false); onLoadExample(); }}
                                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-emerald-50 border-b border-gray-100 flex items-center gap-2"
                                    >
                                        <BookOpen size={14} className="text-emerald-500" />
                                        <div>
                                            <span className="font-bold text-emerald-700">Ejemplo Completo</span>
                                            <p className="text-[10px] text-gray-400 mt-0.5">AMFE modelo con 3 operaciones</p>
                                        </div>
                                    </button>
                                )}
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
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handleExcelCompleto(); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {amfeExport.isExporting ? <Loader2 size={14} className="text-emerald-500 animate-spin" /> : <FileSpreadsheet size={14} className="text-emerald-500" />}
                                    <div>
                                        <span className="font-bold text-gray-800">{amfeExport.isExporting ? 'Exportando...' : 'Excel: AMFE Completo'}</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Formulario I-AC-005.3 completo</p>
                                    </div>
                                </button>
                                <button
                                    disabled={amfeExport.isExporting}
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handleExcelResumenAP(); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {amfeExport.isExporting ? <Loader2 size={14} className="text-emerald-500 animate-spin" /> : <FileSpreadsheet size={14} className="text-emerald-500" />}
                                    <div>
                                        <span className="font-bold text-gray-800">{amfeExport.isExporting ? 'Exportando...' : 'Excel: Resumen AP'}</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Fallas alta/media prioridad</p>
                                    </div>
                                </button>
                                <button
                                    disabled={amfeExport.isExporting}
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handleExcelPlanAcciones(); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {amfeExport.isExporting ? <Loader2 size={14} className="text-emerald-500 animate-spin" /> : <FileSpreadsheet size={14} className="text-emerald-500" />}
                                    <div>
                                        <span className="font-bold text-gray-800">{amfeExport.isExporting ? 'Exportando...' : 'Excel: Plan Acciones'}</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Acciones abiertas para seguimiento</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handlePdfPreview('full'); }}
                                    disabled={amfeExport.isExportingPdf}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {amfeExport.isExportingPdf ? <Loader2 size={14} className="text-red-500 animate-spin" /> : <FileText size={14} className="text-red-500" />}
                                    <div>
                                        <span className="font-bold text-gray-800">{amfeExport.isExportingPdf ? 'Generando PDF...' : 'PDF: Tabla VDA Completa'}</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Sábana completa landscape A3</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handlePdfPreview('summary'); }}
                                    disabled={amfeExport.isExportingPdf}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FileText size={14} className="text-red-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">PDF: Resumen AP</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Causas alta/media prioridad</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handlePdfPreview('actionPlan'); }}
                                    disabled={amfeExport.isExportingPdf}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FileText size={14} className="text-red-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">PDF: Plan de Acciones</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Acciones abiertas para seguimiento</p>
                                    </div>
                                </button>
                                {onOpenExportFolder && (
                                    <button
                                        onClick={() => { setShowOverflowMenu(false); onOpenExportFolder(); }}
                                        disabled={!canOpenExportFolder}
                                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-amber-50 border-b border-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FolderOpen size={14} className="text-amber-500" />
                                        <div>
                                            <span className="font-bold text-gray-800">Abrir Carpeta</span>
                                            <p className="text-[10px] text-gray-400 mt-0.5">Ver archivos exportados en Y:\INGENIERIA</p>
                                        </div>
                                    </button>
                                )}
                                {/* JSON Import/Export */}
                                <div className="px-4 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                                    Intercambio JSON
                                </div>
                                <button
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handleExportJson(); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                >
                                    <Download size={14} className="text-sky-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">Exportar JSON</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Descargar AMFE como archivo JSON</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setShowOverflowMenu(false); amfeExport.handleImportJson(); }}
                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                >
                                    <Upload size={14} className="text-sky-500" />
                                    <div>
                                        <span className="font-bold text-gray-800">Importar JSON</span>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Cargar AMFE desde archivo JSON</p>
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
