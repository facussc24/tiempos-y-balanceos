/**
 * MediaMigrationPanel — Slide-in panel for migrating media files from local PC to server
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Upload, Film, CheckCircle, XCircle, AlertTriangle, Trash2, Loader2, FolderOpen, HardDrive } from 'lucide-react';
import { scanLocalMedia, buildMigrationPlan, migrateMediaToServer } from '../utils/mediaManager';
import type { LocalMediaFile, MediaMigrationItem, MediaMigrationResult, MediaMigrationProgress } from '../utils/mediaManager';
import { toast } from '../components/ui/Toast';

interface MediaMigrationPanelProps {
    onClose: () => void;
    onMigrationComplete?: () => void;
}

type Phase = 'scanning' | 'ready' | 'migrating' | 'done';

export const MediaMigrationPanel: React.FC<MediaMigrationPanelProps> = ({ onClose, onMigrationComplete }) => {
    const [phase, setPhase] = useState<Phase>('scanning');
    const [localFiles, setLocalFiles] = useState<LocalMediaFile[]>([]);
    const [items, setItems] = useState<MediaMigrationItem[]>([]);
    const [progress, setProgress] = useState<MediaMigrationProgress | null>(null);
    const [result, setResult] = useState<MediaMigrationResult | null>(null);
    const [deleteLocal, setDeleteLocal] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => () => { mountedRef.current = false; }, []);

    // Scan on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const files = await scanLocalMedia();
                if (cancelled) return;
                setLocalFiles(files);

                const plan = await buildMigrationPlan(files);
                if (cancelled) return;
                setItems(plan);
                setPhase('ready');
            } catch (e) {
                if (!cancelled) {
                    toast.error('Error de Escaneo', `No se pudieron escanear los archivos multimedia: ${e}`);
                    setPhase('ready');
                }
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleMigrate = useCallback(async () => {
        setPhase('migrating');
        try {
            const migrationResult = await migrateMediaToServer(
                items,
                deleteLocal,
                (p) => { if (mountedRef.current) setProgress(p); }
            );

            if (!mountedRef.current) return;

            // Update items state with cloned+mutated items from migration
            setItems(migrationResult.updatedItems);
            setResult(migrationResult);
            setPhase('done');

            if (migrationResult.migrated > 0) {
                toast.success(
                    'Migración Completada',
                    `${migrationResult.migrated} archivo(s) migrados al servidor.`
                );
                onMigrationComplete?.();
            }
            if (migrationResult.failed > 0) {
                toast.warning(
                    'Migración Parcial',
                    `${migrationResult.failed} archivo(s) no pudieron ser migrados.`
                );
            }
        } catch (e) {
            if (!mountedRef.current) return;
            toast.error('Error de Migración', String(e));
            setPhase('ready');
        }
    }, [items, deleteLocal, onMigrationComplete]);

    // Block close during migration
    const canClose = phase !== 'migrating';
    const handleClose = useCallback(() => {
        if (canClose) onClose();
    }, [canClose, onClose]);

    // Escape key to close (only when not migrating)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && canClose) onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [canClose, onClose]);

    // Group files by project
    const groupedFiles = localFiles.reduce<Record<string, LocalMediaFile[]>>((acc, file) => {
        const key = `${file.client} / ${file.projectName}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(file);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="media-migration-title">
            {/* Backdrop — disabled during migration */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                onClick={handleClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div className="relative w-full max-w-md bg-slate-900 text-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <Film size={20} className="text-orange-400" />
                        </div>
                        <div>
                            <h2 id="media-migration-title" className="font-bold text-lg">Migrar Multimedia</h2>
                            <p className="text-xs text-slate-400">Local → Servidor</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={!canClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Cerrar panel de migración"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {phase === 'scanning' && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Loader2 size={32} className="animate-spin mb-4" />
                            <p>Escaneando archivos multimedia locales...</p>
                        </div>
                    )}

                    {phase === 'ready' && localFiles.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <CheckCircle size={40} className="mb-4 text-emerald-400" />
                            <p className="font-medium text-emerald-300">Sin archivos pendientes</p>
                            <p className="text-sm mt-2">No hay archivos multimedia en almacenamiento local.</p>
                        </div>
                    )}

                    {(phase === 'ready' || phase === 'migrating') && localFiles.length > 0 && (
                        <>
                            {/* Summary */}
                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-orange-300 mb-1">
                                    <AlertTriangle size={16} />
                                    <span className="font-medium">{localFiles.length} archivo(s) en almacenamiento local</span>
                                </div>
                                <p className="text-xs text-slate-400">
                                    Estos archivos se copiarán a la carpeta 02_MEDIA del servidor.
                                </p>
                            </div>

                            {/* File list grouped by project */}
                            {Object.entries(groupedFiles).map(([projectKey, files]) => (
                                <div key={projectKey} className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <FolderOpen size={14} className="text-blue-400" />
                                        <span className="font-medium">{projectKey}</span>
                                        <span className="text-slate-500">({files.length})</span>
                                    </div>
                                    {files.map(file => {
                                        const item = items.find(i => i.localFile.localPath === file.localPath);
                                        return (
                                            <div
                                                key={file.localPath}
                                                className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2 text-sm"
                                            >
                                                <Film size={14} className="text-slate-500 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="truncate text-slate-200">{file.filename}</p>
                                                    <p className="text-[10px] text-slate-500 truncate">
                                                        → {file.client}/{file.part}/
                                                    </p>
                                                </div>
                                                {item?.status === 'done' && <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />}
                                                {item?.status === 'error' && <span title={item.error}><XCircle size={14} className="text-red-400 flex-shrink-0" /></span>}
                                                {item?.status === 'copying' && <Loader2 size={14} className="text-blue-400 animate-spin flex-shrink-0" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}

                            {/* Delete toggle */}
                            <label className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-4 py-3 cursor-pointer hover:bg-slate-800 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={deleteLocal}
                                    onChange={e => setDeleteLocal(e.target.checked)}
                                    disabled={phase === 'migrating'}
                                    className="rounded border-slate-600 text-orange-500 focus:ring-orange-500"
                                />
                                <div className="flex items-center gap-2">
                                    <Trash2 size={14} className="text-slate-400" />
                                    <span className="text-sm text-slate-300">Eliminar copias locales después de migrar</span>
                                </div>
                            </label>

                            {/* Progress bar */}
                            {phase === 'migrating' && progress && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Migrando: {progress.currentFile}</span>
                                        <span>{progress.current}/{progress.total}</span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-orange-500 transition-all duration-300 rounded-full"
                                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {phase === 'done' && result && (
                        <div className="space-y-4">
                            <div className={`rounded-lg p-4 ${result.failed === 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    {result.failed === 0 ? (
                                        <CheckCircle size={20} className="text-emerald-400" />
                                    ) : (
                                        <AlertTriangle size={20} className="text-amber-400" />
                                    )}
                                    <span className="font-bold text-lg">
                                        {result.failed === 0 ? 'Migración Exitosa' : 'Migración Parcial'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <HardDrive size={14} className="text-emerald-400" />
                                        <span>{result.migrated} migrados</span>
                                    </div>
                                    {result.failed > 0 && (
                                        <div className="flex items-center gap-2">
                                            <XCircle size={14} className="text-red-400" />
                                            <span>{result.failed} fallidos</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {result.errors.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-400 font-medium">Errores:</p>
                                    {result.errors.map((err, i) => (
                                        <div key={i} className="text-xs text-red-400 bg-red-500/10 rounded px-3 py-1.5">
                                            {err.file}: {err.error}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700 flex gap-3">
                    {(phase === 'ready' && localFiles.length > 0) && (
                        <button
                            onClick={handleMigrate}
                            className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                            <Upload size={16} /> Migrar al Servidor ({localFiles.length})
                        </button>
                    )}
                    {phase === 'migrating' && (
                        <div className="flex-1 py-2.5 bg-slate-700 text-slate-400 rounded-lg font-medium text-sm flex items-center justify-center gap-2">
                            <Loader2 size={16} className="animate-spin" /> Migrando...
                        </div>
                    )}
                    <button
                        onClick={handleClose}
                        disabled={!canClose}
                        className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {phase === 'done' ? 'Cerrar' : 'Cancelar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
