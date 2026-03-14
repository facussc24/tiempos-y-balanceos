/**
 * SolicitudToolbar — Top toolbar bar
 *
 * Horizontal bar with navigation, actions, server status, and save status indicator.
 * Phase 2: Added procedure viewer, mark obsolete, server sync buttons.
 * Phase 2 Fixes: Added delete button, update index button.
 */

import React from 'react';
import {
    ArrowLeft, Plus, Save, FileDown, FileSpreadsheet, Loader2,
    BookOpen, Archive, RefreshCw, Trash2, Table2, ExternalLink, ShieldCheck,
    GitBranch, History, FolderOutput,
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

    return (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
            {/* Left: Back + Title + Status Badge */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 transition font-medium"
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

                {/* Procedure */}
                <button
                    onClick={onShowProcedure}
                    className={`${btnBase} border border-gray-300 text-gray-600 hover:bg-gray-50`}
                    title="Ver procedimiento SGC"
                >
                    <BookOpen size={14} />
                    <span className="hidden lg:inline">Procedimiento</span>
                </button>

                {/* New */}
                <button
                    onClick={onNew}
                    className={`${btnBase} border border-amber-500 text-amber-600 hover:bg-amber-50`}
                >
                    <Plus size={14} />
                    Nueva
                </button>

                {/* Save */}
                <button
                    onClick={onSave}
                    disabled={hasErrors || isSaving}
                    className={`${btnBase} bg-amber-500 hover:bg-amber-600 text-white shadow-sm`}
                >
                    {isSaving ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <Save size={14} />
                    )}
                    Guardar
                </button>

                {/* Revision badge */}
                {revisionLevel && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-violet-700 bg-violet-100 border border-violet-200">
                        Rev {revisionLevel}
                    </span>
                )}

                {/* New Revision */}
                {onNewRevision && (
                    <button
                        onClick={onNewRevision}
                        disabled={hasErrors || status === 'obsoleta'}
                        className={`${btnBase} border border-violet-400 text-violet-600 hover:bg-violet-50`}
                        title="Crear nueva revision (guarda snapshot al servidor)"
                    >
                        <GitBranch size={14} />
                        <span className="hidden lg:inline">Revision</span>
                    </button>
                )}

                {/* Revision History */}
                {onShowHistory && (
                    <button
                        onClick={onShowHistory}
                        className={`${btnBase} border border-gray-300 text-gray-600 hover:bg-gray-50`}
                        title="Ver historial de revisiones"
                    >
                        <History size={14} />
                        <span className="hidden lg:inline">Historial</span>
                    </button>
                )}

                {/* Delete */}
                <button
                    onClick={onDelete}
                    className={`${btnBase} border border-gray-300 text-gray-400 hover:text-red-500 hover:border-red-300 hover:bg-red-50`}
                    title="Eliminar solicitud"
                >
                    <Trash2 size={14} />
                    <span className="hidden lg:inline">Eliminar</span>
                </button>

                {/* Sync to server */}
                <button
                    onClick={onSyncServer}
                    disabled={isSyncing || serverStatus !== 'connected'}
                    className={`${btnBase} border border-blue-400 text-blue-600 hover:bg-blue-50`}
                    title="Sincronizar carpeta y PDF al servidor"
                >
                    {isSyncing ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <RefreshCw size={14} />
                    )}
                    <span className="hidden lg:inline">Sync</span>
                </button>

                {/* Update Index */}
                <button
                    onClick={onUpdateIndex}
                    disabled={serverStatus !== 'connected'}
                    className={`${btnBase} border border-green-400 text-green-600 hover:bg-green-50`}
                    title="Actualizar indice de solicitudes en el servidor"
                >
                    <Table2 size={14} />
                    <span className="hidden lg:inline">Indice</span>
                </button>

                {/* Open Index in Excel */}
                <button
                    onClick={onOpenIndex}
                    disabled={serverStatus !== 'connected'}
                    className={`${btnBase} border border-green-400 text-green-600 hover:bg-green-50`}
                    title="Abrir Indice_Solicitudes.xlsx en Excel"
                >
                    <ExternalLink size={14} />
                    <span className="hidden lg:inline">Abrir Indice</span>
                </button>

                {/* Open Export Folder */}
                {onOpenExportFolder && (
                    <button
                        onClick={onOpenExportFolder}
                        disabled={!canOpenExportFolder}
                        className={`${btnBase} border border-amber-400 text-amber-600 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed`}
                        title="Abrir carpeta de exportacion en Explorador"
                    >
                        <FolderOutput size={14} />
                        <span className="hidden lg:inline">Carpeta</span>
                    </button>
                )}

                {/* Reconcile / Verify server */}
                <button
                    onClick={onReconcile}
                    disabled={serverStatus !== 'connected'}
                    className={`${btnBase} border border-amber-400 text-amber-600 hover:bg-amber-50`}
                    title="Verificar carpetas del servidor vs base de datos"
                >
                    <ShieldCheck size={14} />
                    <span className="hidden lg:inline">Verificar</span>
                </button>

                {/* Export PDF */}
                <button
                    onClick={onExportPdf}
                    className={`${btnBase} border border-gray-300 text-gray-600 hover:bg-gray-50`}
                >
                    <FileDown size={14} />
                    PDF
                </button>

                {/* Export Excel */}
                <button
                    onClick={onExportExcel}
                    className={`${btnBase} border border-gray-300 text-gray-600 hover:bg-gray-50`}
                >
                    <FileSpreadsheet size={14} />
                    Excel
                </button>

                {/* Mark Obsolete */}
                {canMarkObsolete && (
                    <button
                        onClick={onMarkObsolete}
                        className={`${btnBase} border border-gray-300 text-gray-400 hover:text-red-500 hover:border-red-300 hover:bg-red-50`}
                        title="Marcar como obsoleta"
                    >
                        <Archive size={14} />
                        <span className="hidden lg:inline">Obsoleta</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default SolicitudToolbar;
