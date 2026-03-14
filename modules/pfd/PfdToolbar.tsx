/**
 * PFD Toolbar — Action bar for the PFD module
 *
 * Contains: back, save, new/open project, export, print, view mode toggle.
 * Cyan/teal color theme.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    ArrowLeft, Save, FolderOpen, FilePlus,
    Eye, Edit3, AlertTriangle, Undo2, Redo2, Copy, ChevronDown, Hash, GitBranch, Image, FolderOutput,
} from 'lucide-react';
import SyncStatusIndicator from '../../components/ui/SyncStatusIndicator';

interface Props {
    onBackToLanding?: () => void;
    onSave: () => void;
    onSaveAs?: () => void;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    hasUnsavedChanges: boolean;
    currentProject: string;
    lastAutoSave: string;
    onToggleProjectPanel: () => void;
    onNewProject: () => void;
    onExportSvg: () => void;
    onExportPdf?: () => void;
    viewMode: 'view' | 'edit';
    onToggleViewMode: () => void;
    onValidate: () => void;
    validationCount?: number;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    stepCount: number;
    onLoadBasicTemplate?: () => void;
    onLoadManufacturingTemplate?: () => void;
    onLoadTapizadoTemplate?: () => void;
    onRenumber?: () => void;
    onNewRevision?: () => void;
    currentRevisionLevel?: string;
    syncAlertCount?: number;
    onSyncClick?: () => void;
    onOpenExportFolder?: () => void;
    canOpenExportFolder?: boolean;
}

const btnClass = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";

const PfdToolbar: React.FC<Props> = ({
    onBackToLanding, onSave, onSaveAs, saveStatus, hasUnsavedChanges, currentProject, lastAutoSave,
    onToggleProjectPanel, onNewProject,
    onExportSvg, onExportPdf,
    viewMode, onToggleViewMode,
    onValidate, validationCount,
    onUndo, onRedo, canUndo, canRedo,
    stepCount,
    onLoadBasicTemplate, onLoadManufacturingTemplate, onLoadTapizadoTemplate,
    onRenumber,
    onNewRevision, currentRevisionLevel,
    syncAlertCount, onSyncClick,
    onOpenExportFolder, canOpenExportFolder,
}) => {
    const saveLabel = saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? 'Guardado' : saveStatus === 'error' ? 'Error al guardar' : 'Guardar';
    const [newMenuOpen, setNewMenuOpen] = useState(false);
    const newMenuRef = useRef<HTMLDivElement>(null);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        if (!newMenuOpen && !exportMenuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (newMenuOpen && newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
                setNewMenuOpen(false);
            }
            if (exportMenuOpen && exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
                setExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [newMenuOpen, exportMenuOpen]);

    return (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap no-print">
            {onBackToLanding && (
                <button onClick={onBackToLanding} className={`${btnClass} text-gray-600 hover:bg-gray-100`} title="Volver al inicio">
                    <ArrowLeft size={16} />
                    <span className="hidden sm:inline">Inicio</span>
                </button>
            )}

            <div className="w-px h-6 bg-gray-200" />

            {/* Nuevo button with dropdown for templates */}
            <div className="relative" ref={newMenuRef}>
                <div className="flex items-center">
                    <button onClick={onNewProject} className={`${btnClass} text-cyan-700 hover:bg-cyan-50 rounded-r-none`} title="Nuevo documento vacío">
                        <FilePlus size={16} />
                        <span className="hidden sm:inline">Nuevo</span>
                    </button>
                    {(onLoadBasicTemplate || onLoadManufacturingTemplate || onLoadTapizadoTemplate) && (
                        <button
                            onClick={() => setNewMenuOpen(prev => !prev)}
                            className={`${btnClass} text-cyan-700 hover:bg-cyan-50 rounded-l-none px-1 border-l border-cyan-200`}
                            title="Opciones de nuevo documento"
                            aria-haspopup="true"
                            aria-expanded={newMenuOpen}
                        >
                            <ChevronDown size={14} />
                        </button>
                    )}
                </div>
                {newMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[220px] py-1">
                        <button
                            onClick={() => { onNewProject(); setNewMenuOpen(false); }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 transition"
                        >
                            Documento vacío
                        </button>
                        {onLoadBasicTemplate && (
                            <button
                                onClick={() => { onLoadBasicTemplate(); setNewMenuOpen(false); }}
                                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 transition"
                            >
                                Plantilla básica (8 pasos)
                            </button>
                        )}
                        {onLoadManufacturingTemplate && (
                            <button
                                onClick={() => { onLoadManufacturingTemplate(); setNewMenuOpen(false); }}
                                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 transition"
                            >
                                Plantilla manufactura (12 pasos)
                            </button>
                        )}
                        {onLoadTapizadoTemplate && (
                            <>
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                    onClick={() => { onLoadTapizadoTemplate(); setNewMenuOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-xs text-cyan-700 hover:bg-cyan-50 font-semibold transition"
                                >
                                    INSERTO PATAGONIA — VWA (35 pasos)
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
            <button onClick={onToggleProjectPanel} className={`${btnClass} text-cyan-700 hover:bg-cyan-50`} title="Abrir documento">
                <FolderOpen size={16} />
                <span className="hidden sm:inline">Abrir</span>
            </button>
            <button
                onClick={onSave}
                disabled={saveStatus === 'saving'}
                className={`relative ${btnClass} ${saveStatus === 'error' ? 'bg-red-600 text-white hover:bg-red-700' : hasUnsavedChanges ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'text-cyan-700 hover:bg-cyan-50'}`}
                title="Guardar (Ctrl+S)"
            >
                {hasUnsavedChanges && saveStatus !== 'error' && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
                    </span>
                )}
                <Save size={16} />
                <span className="hidden sm:inline">{saveLabel}</span>
            </button>
            {onSaveAs && (
                <button onClick={onSaveAs} className={`${btnClass} text-cyan-700 hover:bg-cyan-50`} title="Guardar como... (copia con nuevo nombre)">
                    <Copy size={16} />
                    <span className="hidden md:inline">Guardar como</span>
                </button>
            )}

            {onNewRevision && (
                <button
                    onClick={onNewRevision}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100 hover:border-cyan-300 transition hover:shadow-sm"
                    title="Crear nueva revision del documento"
                >
                    <GitBranch size={15} />
                    <span className="hidden sm:inline">Nueva Rev.</span>
                    <span className="bg-cyan-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {currentRevisionLevel || 'A'}
                    </span>
                </button>
            )}

            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button onClick={onUndo} disabled={!canUndo} className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 transition text-gray-600 text-xs disabled:opacity-50 disabled:cursor-not-allowed border-r border-gray-300" title="Deshacer (Ctrl+Z)">
                    <Undo2 size={15} />
                </button>
                <button onClick={onRedo} disabled={!canRedo} className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 transition text-gray-600 text-xs disabled:opacity-50 disabled:cursor-not-allowed" title="Rehacer (Ctrl+Y)">
                    <Redo2 size={15} />
                </button>
            </div>
            {onRenumber && (
                <button onClick={onRenumber} disabled={stepCount === 0} className={`${btnClass} text-gray-600 hover:bg-gray-100`} title="Renumerar pasos secuencialmente (OP 10, OP 20, ...)">
                    <Hash size={16} />
                    <span className="hidden md:inline">Renumerar</span>
                </button>
            )}

            <div className="w-px h-6 bg-gray-200" />

            <button onClick={onToggleViewMode} className={`${btnClass} ${viewMode === 'view' ? 'bg-cyan-100 text-cyan-800' : 'text-gray-600 hover:bg-gray-100'}`} title="Alternar vista/edición">
                {viewMode === 'view' ? <Eye size={16} /> : <Edit3 size={16} />}
                <span className="hidden sm:inline">{viewMode === 'view' ? 'Solo lectura' : 'Editar'}</span>
            </button>

            <button
                onClick={onValidate}
                className={`${btnClass} ${validationCount != null && validationCount > 0 ? 'text-amber-700 hover:bg-amber-50' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Validar documento"
            >
                <AlertTriangle size={16} />
                <span className="hidden sm:inline">Validar</span>
                {validationCount != null && validationCount > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {validationCount}
                    </span>
                )}
            </button>

            {syncAlertCount != null && onSyncClick && (
                <SyncStatusIndicator alertCount={syncAlertCount} onClick={onSyncClick} />
            )}

            <div className="w-px h-6 bg-gray-200" />

            <div className="relative" ref={exportMenuRef}>
                <div className="flex items-center">
                    <button onClick={onExportSvg} className={`${btnClass} text-gray-600 hover:bg-gray-100 rounded-r-none`} title="Exportar SVG editable (Visio/Inkscape)">
                        <Image size={16} />
                        <span className="hidden sm:inline">Exportar</span>
                    </button>
                    {onExportPdf && (
                        <button
                            onClick={() => setExportMenuOpen(prev => !prev)}
                            className={`${btnClass} text-gray-600 hover:bg-gray-100 rounded-l-none px-1 border-l border-gray-300`}
                            title="Opciones de exportación"
                            aria-haspopup="true"
                            aria-expanded={exportMenuOpen}
                        >
                            <ChevronDown size={14} />
                        </button>
                    )}
                </div>
                {exportMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[240px] py-1">
                        <button
                            onClick={() => { onExportSvg(); setExportMenuOpen(false); }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 transition flex items-center gap-2"
                        >
                            <Image size={14} />
                            Exportar SVG editable (Visio/Inkscape)
                        </button>
                        {onExportPdf && (
                            <button
                                onClick={() => { onExportPdf(); setExportMenuOpen(false); }}
                                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 transition flex items-center gap-2"
                            >
                                <FilePlus size={14} />
                                Exportar PDF (imprimir)
                            </button>
                        )}
                    </div>
                )}
            </div>

            {onOpenExportFolder && (
                <button
                    onClick={onOpenExportFolder}
                    disabled={!canOpenExportFolder}
                    className={`${btnClass} text-gray-600 hover:bg-amber-50 hover:text-amber-700`}
                    title="Abrir carpeta de exportacion en Explorador"
                >
                    <FolderOutput size={16} />
                    <span className="hidden sm:inline">Carpeta</span>
                </button>
            )}

            <div className="flex-1" />

            <div className="flex items-center gap-3 text-xs text-gray-400">
                {currentProject && <span>Proyecto: <strong className="text-cyan-600">{currentProject}</strong></span>}
                <span>{stepCount} {stepCount === 1 ? 'paso' : 'pasos'}</span>
                {lastAutoSave && <span className="text-green-500">Auto-save: {lastAutoSave}</span>}
            </div>
        </div>
    );
};

export default PfdToolbar;
