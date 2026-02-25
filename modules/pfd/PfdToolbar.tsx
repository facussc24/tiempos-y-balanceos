/**
 * PFD Toolbar — Action bar for the PFD module
 *
 * Contains: back, save, new/open project, export, print, view mode toggle.
 * Cyan/teal color theme.
 */

import React from 'react';
import {
    ArrowLeft, Save, FolderOpen, FilePlus, FileDown, FileSpreadsheet, Printer,
    Eye, Edit3, AlertTriangle, Undo2, Redo2, Copy,
} from 'lucide-react';

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
    onExportPdf: () => void;
    onExportExcel: () => void;
    onPrint: () => void;
    viewMode: 'view' | 'edit';
    onToggleViewMode: () => void;
    onValidate: () => void;
    validationCount?: number;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    stepCount: number;
}

const btnClass = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed";

const PfdToolbar: React.FC<Props> = ({
    onBackToLanding, onSave, onSaveAs, saveStatus, hasUnsavedChanges, currentProject, lastAutoSave,
    onToggleProjectPanel, onNewProject,
    onExportPdf, onExportExcel, onPrint,
    viewMode, onToggleViewMode,
    onValidate, validationCount,
    onUndo, onRedo, canUndo, canRedo,
    stepCount,
}) => {
    const saveLabel = saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? 'Guardado' : saveStatus === 'error' ? 'Error al guardar' : 'Guardar';

    return (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap no-print">
            {onBackToLanding && (
                <button onClick={onBackToLanding} className={`${btnClass} text-gray-600 hover:bg-gray-100`} title="Volver al inicio">
                    <ArrowLeft size={16} />
                    <span className="hidden sm:inline">Inicio</span>
                </button>
            )}

            <div className="w-px h-6 bg-gray-200" />

            <button onClick={onNewProject} className={`${btnClass} text-cyan-700 hover:bg-cyan-50`} title="Nuevo documento">
                <FilePlus size={16} />
                <span className="hidden sm:inline">Nuevo</span>
            </button>
            <button onClick={onToggleProjectPanel} className={`${btnClass} text-cyan-700 hover:bg-cyan-50`} title="Abrir documento">
                <FolderOpen size={16} />
                <span className="hidden sm:inline">Abrir</span>
            </button>
            <button
                onClick={onSave}
                disabled={saveStatus === 'saving'}
                className={`${btnClass} ${saveStatus === 'error' ? 'bg-red-600 text-white hover:bg-red-700' : hasUnsavedChanges ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'text-cyan-700 hover:bg-cyan-50'}`}
                title="Guardar (Ctrl+S)"
            >
                <Save size={16} />
                <span className="hidden sm:inline">{saveLabel}</span>
            </button>
            {onSaveAs && (
                <button onClick={onSaveAs} className={`${btnClass} text-cyan-700 hover:bg-cyan-50`} title="Guardar como... (copia con nuevo nombre)">
                    <Copy size={16} />
                    <span className="hidden md:inline">Guardar como</span>
                </button>
            )}

            <button onClick={onUndo} disabled={!canUndo} className={`${btnClass} text-gray-600 hover:bg-gray-100`} title="Deshacer (Ctrl+Z)">
                <Undo2 size={16} />
            </button>
            <button onClick={onRedo} disabled={!canRedo} className={`${btnClass} text-gray-600 hover:bg-gray-100`} title="Rehacer (Ctrl+Y)">
                <Redo2 size={16} />
            </button>

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

            <div className="w-px h-6 bg-gray-200" />

            <button onClick={onExportPdf} className={`${btnClass} text-gray-600 hover:bg-gray-100`} title="Exportar PDF">
                <FileDown size={16} />
                <span className="hidden sm:inline">PDF</span>
            </button>
            <button onClick={onExportExcel} className={`${btnClass} text-gray-600 hover:bg-gray-100`} title="Exportar Excel">
                <FileSpreadsheet size={16} />
                <span className="hidden sm:inline">Excel</span>
            </button>
            <button onClick={onPrint} className={`${btnClass} text-gray-600 hover:bg-gray-100`} title="Imprimir">
                <Printer size={16} />
                <span className="hidden sm:inline">Imprimir</span>
            </button>

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
