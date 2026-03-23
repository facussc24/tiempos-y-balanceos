/**
 * SolicitudToolbar — Top toolbar bar
 *
 * Horizontal bar with navigation, actions, server status, and save status indicator.
 * Phase 2: Added procedure viewer, mark obsolete, server sync buttons.
 * Phase 2 Fixes: Added delete button, update index button.
 * Phase 3: Overflow menu pattern (same as AmfeToolbar / CpToolbar).
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    ArrowLeft, Plus, Save, FileDown, FileSpreadsheet, Loader2,
    BookOpen, Archive, RefreshCw, Trash2, Table2, ExternalLink, ShieldCheck,
    GitBranch, History, FolderOutput, MoreHorizontal,
} from 'lucide-react';
import type { SolicitudStatus } from './solicitudTypes';
import { STATUS_CONFIG } from './solicitudTypes';
import SolicitudServerStatus from './SolicitudServerStatus';

interface SolicitudToolbarProps {
    onBack: () => void;
    onNew: () => void;
    onSave: () => void;
    onDelete: () => void;
    onExportPdf: () => void;
    onExportExcel: () => void;
    onShowProcedure: () => void;
    onMarkObsolete: () => void;
    onSyncServer: () => void;
    onUpdateIndex: () => void;
    onOpenIndex: () => void;
    onReconcile: () => void;
    status: SolicitudStatus;
    isSaving: boolean;
    isSyncing: boolean;
    lastSavedAt: string | null;
    hasErrors: boolean;
    serverStatus: 'connected' | 'disconnected' | 'checking';
    pendingOps: number;
    onRetryPending: () => void;
    onNewRevision?: () => void;
    onShowHistory?: () => void;
    revisionLevel?: string;
    onOpenExportFolder?: () => void;
    canOpenExportFolder?: boolean;
}

const SolicitudToolbar: React.FC<SolicitudToolbarProps> = ({
    onBack,
    onNew,
    onSave,
    onDelete,
    onExportPdf,
    onExportExcel,
    onShowProcedure,
    onMarkObsolete,
    onSyncServer,
    onUpdateIndex,
    onOpenIndex,
    onReconcile,
    status,
    isSaving,
    isSyncing,
    lastSavedAt,
    hasErrors,
    serverStatus,
    pendingOps,
    onRetryPending,
    onNewRevision,
    onShowHistory,
    revisionLevel,
    onOpenExportFolder,
    canOpenExportFolder,
}) => {
    const btnBase = 'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition disabled:opacity-50 disabled:cursor-not-allowed';

    const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.borrador;
    const canMarkObsolete = status !== 'obsoleta';

    const [showOverflowMenu, setShowOverflowMenu] = useState(false);
    const overflowRef = useRef<HTMLDivElement>(null);

    // Click-outside to close overflow menu
    useEffect(() => {
        if (!showOverflowMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
                setShowOverflowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showOverflowMenu]);

    return (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
            {/* Left: Back + Title + Status Badge */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 transition font-medium"
                    title="Volver al menú principal"
                    aria-label="Volver al menú principal"
                >
                    <ArrowLeft size={16} />
                    Inicio
                </button>

                <div className="h-5 w-px bg-gray-200" />

                <h1 className="text-sm font-bold text-gray-700 tracking-wide">
                    Solicitudes de Código
                </h1>

                {/* Status badge */}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusCfg.color} ${statusCfg.bg}`}>
                    {statusCfg.label}
                </span>

                {/* Server status */}
                <div className="ml-2">
                    <SolicitudServerStatus
                        status={serverStatus}
                        pendingOps={pendingOps}
                        onRetryPending={onRetryPending}
                    />
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                {/* Save status indicator */}
                {isSaving ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-600 mr-2">
                        <Loader2 size={12} className="animate-spin" />
                        Guardando...
                    </span>
                ) : lastSavedAt ? (
                    <span className="text-[10px] text-gray-400 mr-2">
                        Guardado {lastSavedAt}
                    </span>
                ) : null}

                {/* Revision badge */}
                {revisionLevel && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-violet-700 bg-violet-100 border border-violet-200">
                        Rev {revisionLevel}
                    </span>
                )}

                {/* New */}
                <button
                    onClick={onNew}
                    className={`${btnBase} border border-amber-500 text-amber-600 hover:bg-amber-50`}
                    title="Crear nueva solicitud"
                >
                    <Plus size={14} />
                    Nueva
                </button>

                {/* Save */}
                <button
                    onClick={onSave}
                    disabled={hasErrors || isSaving}
                    className={`${btnBase} bg-amber-500 hover:bg-amber-600 text-white shadow-sm`}
                    title="Guardar solicitud (Ctrl+S)"
                >
                    {isSaving ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <Save size={14} />
                    )}
                    Guardar
                </button>

                {/* Export PDF */}
                <button
                    onClick={onExportPdf}
                    className={`${btnBase} border border-gray-300 text-gray-600 hover:bg-gray-50`}
                    title="Exportar PDF"
                >
                    <FileDown size={14} />
                    PDF
                </button>

                {/* Export Excel */}
                <button
                    onClick={onExportExcel}
                    className={`${btnBase} border border-gray-300 text-gray-600 hover:bg-gray-50`}
                    title="Exportar Excel"
                >
                    <FileSpreadsheet size={14} />
                    Excel
                </button>

                {/* Overflow "Más" Menu */}
                <div className="relative" ref={overflowRef}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowOverflowMenu(!showOverflowMenu); }}
                        className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-1.5 rounded transition text-slate-700 font-medium text-xs"
                        title="Más opciones"
                        aria-haspopup="menu"
                        aria-expanded={showOverflowMenu}
                    >
                        <MoreHorizontal size={15} />
                        <span className="hidden sm:inline">Más</span>
                    </button>
                    {showOverflowMenu && (
                        <div
                            className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border z-50"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* HERRAMIENTAS Section */}
                            <div className="px-4 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 rounded-t-lg">
                                Herramientas
                            </div>
                            <button
                                onClick={() => { setShowOverflowMenu(false); onShowProcedure(); }}
                                className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100"
                                title="Ver procedimiento SGC"
                            >
                                <BookOpen size={14} className="text-blue-500 flex-shrink-0" />
                                <span className="text-gray-800 text-xs font-medium">Ver procedimiento SGC</span>
                            </button>
                            {onNewRevision && (
                                <button
                                    onClick={() => { setShowOverflowMenu(false); onNewRevision(); }}
                                    disabled={hasErrors || status === 'obsoleta'}
                                    className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Crear nueva revisión"
                                >
                                    <GitBranch size={14} className="text-violet-500 flex-shrink-0" />
                                    <span className="text-gray-800 text-xs font-medium">Crear nueva revisión</span>
                                </button>
                            )}
                            {onShowHistory && (
                                <button
                                    onClick={() => { setShowOverflowMenu(false); onShowHistory(); }}
                                    className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100"
                                    title="Ver historial de revisiones"
                                >
                                    <History size={14} className="text-gray-500 flex-shrink-0" />
                                    <span className="text-gray-800 text-xs font-medium">Ver historial de revisiones</span>
                                </button>
                            )}

                            {/* SERVIDOR Section */}
                            <div className="px-4 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                                Servidor
                            </div>
                            <button
                                onClick={() => { setShowOverflowMenu(false); onSyncServer(); }}
                                disabled={isSyncing || serverStatus !== 'connected'}
                                className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Sincronizar al servidor"
                            >
                                {isSyncing ? (
                                    <Loader2 size={14} className="text-blue-500 animate-spin flex-shrink-0" />
                                ) : (
                                    <RefreshCw size={14} className="text-blue-500 flex-shrink-0" />
                                )}
                                <span className="text-gray-800 text-xs font-medium">Sincronizar al servidor</span>
                            </button>
                            <button
                                onClick={() => { setShowOverflowMenu(false); onUpdateIndex(); }}
                                disabled={serverStatus !== 'connected'}
                                className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Actualizar índice"
                            >
                                <Table2 size={14} className="text-green-500 flex-shrink-0" />
                                <span className="text-gray-800 text-xs font-medium">Actualizar índice</span>
                            </button>
                            <button
                                onClick={() => { setShowOverflowMenu(false); onOpenIndex(); }}
                                disabled={serverStatus !== 'connected'}
                                className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Abrir índice en Excel"
                            >
                                <ExternalLink size={14} className="text-green-500 flex-shrink-0" />
                                <span className="text-gray-800 text-xs font-medium">Abrir índice en Excel</span>
                            </button>
                            {onOpenExportFolder && (
                                <button
                                    onClick={() => { setShowOverflowMenu(false); onOpenExportFolder(); }}
                                    disabled={!canOpenExportFolder}
                                    className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Abrir carpeta de exportación"
                                >
                                    <FolderOutput size={14} className="text-amber-500 flex-shrink-0" />
                                    <span className="text-gray-800 text-xs font-medium">Abrir carpeta de exportación</span>
                                </button>
                            )}
                            <button
                                onClick={() => { setShowOverflowMenu(false); onReconcile(); }}
                                disabled={serverStatus !== 'connected'}
                                className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Verificar carpetas del servidor"
                            >
                                <ShieldCheck size={14} className="text-amber-500 flex-shrink-0" />
                                <span className="text-gray-800 text-xs font-medium">Verificar carpetas del servidor</span>
                            </button>

                            {/* PELIGROSO Section */}
                            <div className="px-4 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                                Peligroso
                            </div>
                            <button
                                onClick={() => { setShowOverflowMenu(false); onDelete(); }}
                                className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 border-b border-gray-100"
                                title="Eliminar solicitud"
                            >
                                <Trash2 size={14} className="text-red-500 flex-shrink-0" />
                                <span className="text-red-600 text-xs font-medium">Eliminar solicitud</span>
                            </button>
                            {canMarkObsolete && (
                                <button
                                    onClick={() => { setShowOverflowMenu(false); onMarkObsolete(); }}
                                    className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 rounded-b-lg"
                                    title="Marcar como obsoleta"
                                >
                                    <Archive size={14} className="text-red-500 flex-shrink-0" />
                                    <span className="text-red-600 text-xs font-medium">Marcar como obsoleta</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SolicitudToolbar;
