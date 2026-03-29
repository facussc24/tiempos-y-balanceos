/**
 * Revision History Component
 * 
 * Displays list of backup revisions from Obsoletos folder.
 * Allows preview and restore of previous versions.
 */

import { useState, useEffect } from 'react';
import { History, FileJson, Eye, RotateCcw, Loader2, Calendar, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
    RevisionInfo,
    listRevisions,
    loadRevisionPreview,
    restoreRevision,
    getObsoletosPath
} from '../../utils/revisionHistory';
import { ProjectData } from '../../types';
import { toast } from '../ui/Toast';
import { ConfirmModal } from './ConfirmModal';

interface RevisionHistoryProps {
    directoryPath: string;
    currentFilePath: string;
    onRestore?: (restoredData: ProjectData) => void;
}

export function RevisionHistory({ directoryPath, currentFilePath, onRestore }: RevisionHistoryProps) {
    const [revisions, setRevisions] = useState<RevisionInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errors, setErrors] = useState<string[]>([]);
    const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<ProjectData | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [expandedSection, setExpandedSection] = useState<'list' | 'preview' | null>('list');
    // Estado para modal de confirmación de restauración
    const [restoreConfirm, setRestoreConfirm] = useState<RevisionInfo | null>(null);

    // Load revisions on mount
    useEffect(() => {
        loadRevisions();
    }, [directoryPath]);

    const loadRevisions = async () => {
        setIsLoading(true);
        const obsoletosPath = getObsoletosPath(directoryPath);
        const result = await listRevisions(obsoletosPath);
        setRevisions(result.revisions);
        setErrors(result.errors);
        setIsLoading(false);
    };

    const handlePreview = async (revision: RevisionInfo) => {
        setSelectedRevision(revision.path);
        setExpandedSection('preview');

        const result = await loadRevisionPreview(revision.path);
        if (result.data) {
            setPreviewData(result.data);
        } else {
            toast.error('Error al cargar vista previa', result.error);
        }
    };

    // Solicitar confirmación de restauración (abre modal)
    const handleRestoreRequest = (revision: RevisionInfo) => {
        setRestoreConfirm(revision);
    };

    // Ejecutar restauración confirmada
    const executeRestore = async () => {
        if (!restoreConfirm) return;

        const revision = restoreConfirm;
        setRestoreConfirm(null);
        setIsRestoring(true);

        const obsoletosPath = getObsoletosPath(directoryPath);
        const result = await restoreRevision(revision.path, currentFilePath, obsoletosPath);

        if (result.success) {
            toast.success('Versión restaurada', `Se restauró la versión ${revision.version}`);
            loadRevisions(); // Refresh list

            // Reload the restored data
            const loadResult = await loadRevisionPreview(currentFilePath);
            if (loadResult.data && onRestore) {
                onRestore(loadResult.data);
            }
        } else {
            toast.error('Error al restaurar', result.error);
        }

        setIsRestoring(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8 text-slate-400">
                <Loader2 className="animate-spin mr-2" size={20} />
                Cargando historial...
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                {/* Header */}
                <div className="flex items-center gap-3 p-4 border-b border-slate-200 bg-slate-50">
                    <History className="text-blue-600" size={20} />
                    <h3 className="font-semibold text-slate-800">Historial de Revisiones</h3>
                    <span className="ml-auto text-sm text-slate-500">
                        {revisions.length} revisión{revisions.length !== 1 ? 'es' : ''} encontrada{revisions.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Errors */}
                {errors.length > 0 && (
                    <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
                        <AlertCircle size={14} className="inline mr-1" />
                        {errors.length} archivo(s) no pudieron parsearse
                    </div>
                )}

                {/* Revision List */}
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {revisions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <FileJson size={40} className="mx-auto mb-2 opacity-50" />
                            <p>No hay revisiones guardadas</p>
                            <p className="text-xs mt-1">Las versiones anteriores aparecerán aquí al guardar</p>
                        </div>
                    ) : (
                        revisions.map((rev, i) => (
                            <div
                                key={rev.path}
                                className={`p-4 hover:bg-slate-50 transition-colors ${selectedRevision === rev.path ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <FileJson className="text-emerald-500 mt-0.5 flex-shrink-0" size={18} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-slate-800 truncate" title={rev.projectName}>
                                                {rev.projectName}
                                            </span>
                                            <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono text-slate-600">
                                                v{rev.version}
                                            </span>
                                            {i === 0 && (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                                    Más reciente
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={12} />
                                                {rev.timestampStr}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handlePreview(rev)}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Vista previa"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleRestoreRequest(rev)}
                                            disabled={isRestoring}
                                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Restaurar esta versión"
                                        >
                                            <RotateCcw size={16} className={isRestoring ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Preview Panel */}
                {previewData && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                        <button
                            onClick={() => setExpandedSection(expandedSection === 'preview' ? 'list' : 'preview')}
                            className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3"
                        >
                            {expandedSection === 'preview' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            Vista Previa
                        </button>

                        {expandedSection === 'preview' && (
                            <div className="bg-white rounded border border-slate-200 p-4 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-slate-500">Nombre:</span>
                                        <p className="font-medium">{previewData.meta.name}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Versión:</span>
                                        <p className="font-medium">{previewData.meta.version}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Cliente:</span>
                                        <p className="font-medium">{previewData.meta.client || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Ingeniero:</span>
                                        <p className="font-medium">{previewData.meta.engineer || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Tareas:</span>
                                        <p className="font-medium">{previewData.tasks?.length || 0}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Modificado por:</span>
                                        <p className="font-medium">{previewData.meta.modifiedBy || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de confirmación de restauración */}
            <ConfirmModal
                isOpen={restoreConfirm !== null}
                onClose={() => setRestoreConfirm(null)}
                onConfirm={executeRestore}
                title="Restaurar Versión"
                message={`¿Restaurar la versión ${restoreConfirm?.version} del ${restoreConfirm?.timestampStr}?\n\nEl archivo actual se moverá a Obsoletos.`}
                confirmText="Sí, Restaurar"
                variant="warning"
                isLoading={isRestoring}
            />
        </>
    );
}

export default RevisionHistory;
