/**
 * DataManager — "Datos y Seguridad" screen
 *
 * Central screen for managing:
 * - Database overview (document counts, size)
 * - Automatic backups (list, create, restore)
 * - Export / Import (.barack files)
 * - Folder sync (shared folder configuration)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Database, Shield, Download, Upload, FolderSync,
    RefreshCw, Trash2, HardDrive, Monitor, Clock, CheckCircle,
    AlertTriangle, Loader2, Plus, FolderOpen, Wifi, WifiOff,
} from 'lucide-react';
import { DataManagerCard } from '../components/ui/DataManagerCard';
import { ImportPreviewModal } from '../components/modals/ImportPreviewModal';
import { ImportConflictModal } from '../components/modals/ImportConflictModal';
import { logger } from '../utils/logger';

// Services
import {
    createBackup, listBackups, restoreFromBackup, getBackupStats,
    isBackupEnabled, setBackupEnabled, writeServerBackup, snapshotDatabase,
    isServerAvailable, getServerBackupStats,
    type BackupInfo, type BackupStats, type ServerBackupStats,
} from '../utils/backupService';
import {
    exportAllData, openAndAnalyzeImport, executeQuickImport, executeFullImport,
} from '../utils/dataExportImport';
import {
    getSyncFolderStatus, configureSyncFolder, pushToSyncFolder,
    pullAnalyze, pullApply, setSyncOnStartup,
    type SyncFolderStatus,
} from '../utils/folderSyncService';
import { getDeviceInfo, setDeviceName } from '../utils/deviceId';
import { getDatabase } from '../utils/database';
import type { MergeResult, ResolvedConflict } from '../utils/mergeEngine';

interface DataManagerProps {
    onBackToLanding: () => void;
}

const DataManager: React.FC<DataManagerProps> = ({ onBackToLanding }) => {
    // ---------------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------------
    const [loading, setLoading] = useState(true);

    // DB stats
    const [docCounts, setDocCounts] = useState<Record<string, number>>({});

    // Backups
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [backupStats, setBackupStats] = useState<BackupStats | null>(null);
    const [isCreatingBackup, setIsCreatingBackup] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [autoBackup, setAutoBackup] = useState(true);

    // Server backup
    const [serverStats, setServerStats] = useState<ServerBackupStats | null>(null);
    const [isServerBackingUp, setIsServerBackingUp] = useState(false);

    // Export/Import
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importAnalysis, setImportAnalysis] = useState<MergeResult | null>(null);
    const [showImportPreview, setShowImportPreview] = useState(false);
    const [showImportConflicts, setShowImportConflicts] = useState(false);

    // Folder sync
    const [syncStatus, setSyncStatus] = useState<SyncFolderStatus | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pullResult, setPullResult] = useState<MergeResult | null>(null);

    // Device
    const [deviceName, setDeviceNameState] = useState('');
    const [editingName, setEditingName] = useState(false);

    // Toast
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ---------------------------------------------------------------------------
    // Load data on mount
    // ---------------------------------------------------------------------------
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // Document counts
                const db = await getDatabase();
                const tables = ['projects', 'amfe_documents', 'cp_documents', 'ho_documents', 'pfd_documents', 'solicitud_documents'];
                const counts: Record<string, number> = {};
                for (const t of tables) {
                    const rows = await db.select<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${t}`);
                    counts[t] = rows[0]?.cnt ?? 0;
                }
                if (!cancelled) setDocCounts(counts);

                // Backups
                const [bList, bStats] = await Promise.all([listBackups(), getBackupStats()]);
                if (!cancelled) { setBackups(bList); setBackupStats(bStats); }

                // Server backup stats
                const sStats = await getServerBackupStats();
                if (!cancelled) setServerStats(sStats);

                // Sync status
                const status = await getSyncFolderStatus();
                if (!cancelled) setSyncStatus(status);

                // Device
                const device = await getDeviceInfo();
                if (!cancelled) setDeviceNameState(device.name);

                // Auto-backup state
                if (!cancelled) setAutoBackup(isBackupEnabled());
            } catch (err) {
                logger.error('DataManager', 'Failed to load', {}, err instanceof Error ? err : undefined);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // ---------------------------------------------------------------------------
    // Handlers: Backup
    // ---------------------------------------------------------------------------
    const handleCreateBackup = async () => {
        setIsCreatingBackup(true);
        try {
            const path = await createBackup();
            if (path) {
                showToast('Backup creado correctamente');
                const [bList, bStats] = await Promise.all([listBackups(), getBackupStats()]);
                setBackups(bList); setBackupStats(bStats);
            } else {
                showToast('No se pudo crear el backup', 'error');
            }
        } finally {
            setIsCreatingBackup(false);
        }
    };

    const handleRestore = async (backup: BackupInfo) => {
        if (!confirm(`Esto va a REEMPLAZAR toda tu data actual con el backup del ${formatDate(backup.createdAt)}.\n\nEstas seguro?`)) return;
        setIsRestoring(true);
        try {
            const ok = await restoreFromBackup(backup.path);
            if (ok) {
                showToast('Base de datos restaurada correctamente');
                // Refresh counts
                const db = await getDatabase();
                const tables = ['projects', 'amfe_documents', 'cp_documents', 'ho_documents', 'pfd_documents', 'solicitud_documents'];
                const counts: Record<string, number> = {};
                for (const t of tables) {
                    const rows = await db.select<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${t}`);
                    counts[t] = rows[0]?.cnt ?? 0;
                }
                setDocCounts(counts);
            } else {
                showToast('Error al restaurar el backup', 'error');
            }
        } finally {
            setIsRestoring(false);
        }
    };

    const handleToggleAutoBackup = () => {
        const next = !autoBackup;
        setAutoBackup(next);
        setBackupEnabled(next);
    };

    const handleForceServerBackup = async () => {
        setIsServerBackingUp(true);
        try {
            const snapshot = await snapshotDatabase();
            const path = await writeServerBackup(snapshot);
            if (path) {
                showToast('Backup al servidor creado correctamente');
                const sStats = await getServerBackupStats();
                setServerStats(sStats);
            } else {
                showToast('No se pudo conectar al servidor', 'error');
            }
        } catch {
            showToast('Error al crear backup en servidor', 'error');
        } finally {
            setIsServerBackingUp(false);
        }
    };

    // ---------------------------------------------------------------------------
    // Handlers: Export/Import
    // ---------------------------------------------------------------------------
    const handleExport = async () => {
        setIsExporting(true);
        try {
            const path = await exportAllData();
            if (path) showToast('Datos exportados correctamente');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async () => {
        setIsImporting(true);
        try {
            const result = await openAndAnalyzeImport();
            if (!result) { setIsImporting(false); return; }
            setImportAnalysis(result.analysis);
            setShowImportPreview(true);
            setIsImporting(false);
        } catch {
            setIsImporting(false);
            showToast('Error al leer el archivo', 'error');
        }
    };

    const handleImportDirect = async () => {
        if (!importAnalysis) return;
        setIsImporting(true);
        try {
            const result = await executeQuickImport(importAnalysis);
            setShowImportPreview(false);
            if (result.success) {
                showToast(`Importacion completada: ${result.applied} registros aplicados`);
            } else {
                showToast('Error durante la importacion', 'error');
            }
        } finally {
            setIsImporting(false);
            setImportAnalysis(null);
        }
    };

    const handleConflictApply = async (resolutions: ResolvedConflict[]) => {
        if (!importAnalysis) return;
        setIsImporting(true);
        try {
            const result = await executeFullImport(importAnalysis, resolutions);
            setShowImportConflicts(false);
            setShowImportPreview(false);
            if (result.success) {
                showToast(`Importacion completada: ${result.applied} registros aplicados`);
            } else {
                showToast('Error durante la importacion', 'error');
            }
        } finally {
            setIsImporting(false);
            setImportAnalysis(null);
        }
    };

    // ---------------------------------------------------------------------------
    // Handlers: Folder Sync
    // ---------------------------------------------------------------------------
    const handleConfigureSync = async () => {
        const path = await configureSyncFolder();
        if (path) {
            showToast('Carpeta de sincronizacion configurada');
            const status = await getSyncFolderStatus();
            setSyncStatus(status);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            // Push first
            await pushToSyncFolder();

            // Then pull and analyze
            const result = await pullAnalyze();
            if (result && (result.mergeResult.added.length > 0 || result.mergeResult.updated.length > 0 || result.mergeResult.conflicts.length > 0)) {
                if (result.mergeResult.conflicts.length > 0) {
                    setPullResult(result.mergeResult);
                    setImportAnalysis(result.mergeResult);
                    setShowImportConflicts(true);
                } else {
                    // Auto-apply non-conflict changes
                    const applyResult = await pullApply(result.mergeResult, []);
                    showToast(`Sincronizacion completada: ${applyResult.applied} cambios aplicados`);
                }
            } else {
                showToast('Todo esta sincronizado');
            }

            // Refresh status
            const status = await getSyncFolderStatus();
            setSyncStatus(status);
        } catch (err) {
            showToast('Error en la sincronizacion', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSyncStartupToggle = async () => {
        if (!syncStatus) return;
        const next = !syncStatus.syncOnStartup;
        await setSyncOnStartup(next);
        setSyncStatus(prev => prev ? { ...prev, syncOnStartup: next } : null);
    };

    // ---------------------------------------------------------------------------
    // Handlers: Device name
    // ---------------------------------------------------------------------------
    const handleSaveDeviceName = async () => {
        if (deviceName.trim()) {
            await setDeviceName(deviceName.trim());
            setEditingName(false);
            showToast('Nombre del dispositivo actualizado');
        }
    };

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------
    const totalDocs = Object.values(docCounts).reduce((a, b) => a + b, 0);

    const TABLE_DISPLAY: Record<string, { label: string; color: string }> = {
        projects: { label: 'Tiempos y Balanceos', color: 'text-blue-400' },
        amfe_documents: { label: 'AMFE VDA', color: 'text-orange-400' },
        cp_documents: { label: 'Planes de Control', color: 'text-green-400' },
        ho_documents: { label: 'Hojas de Operaciones', color: 'text-indigo-400' },
        pfd_documents: { label: 'Diagramas de Flujo', color: 'text-cyan-400' },
        solicitud_documents: { label: 'Solicitudes de Codigo', color: 'text-amber-400' },
    };

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400 text-sm">Cargando datos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in-up ${
                    toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={onBackToLanding}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Shield size={22} className="text-blue-400" />
                            Datos y Seguridad
                        </h1>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Backups, exportar, importar y sincronizar datos
                        </p>
                    </div>
                    <div className="flex-grow" />
                    {/* Device name */}
                    <div className="flex items-center gap-2 text-sm">
                        <Monitor size={14} className="text-slate-400" />
                        {editingName ? (
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    value={deviceName}
                                    onChange={e => setDeviceNameState(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSaveDeviceName()}
                                    className="bg-slate-700 text-white text-sm px-2 py-1 rounded border border-slate-600 w-32"
                                    autoFocus
                                />
                                <button onClick={handleSaveDeviceName} className="text-emerald-400 text-xs hover:underline">OK</button>
                                <button onClick={() => setEditingName(false)} className="text-slate-400 text-xs hover:underline">X</button>
                            </div>
                        ) : (
                            <button onClick={() => setEditingName(true)} className="text-slate-300 hover:text-white transition-colors" title="Cambiar nombre del dispositivo">
                                {deviceName}
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* ===== Section 1: Database Overview ===== */}
                    <DataManagerCard
                        icon={<Database size={18} className="text-blue-400" />}
                        title="Base de Datos"
                        description={`${totalDocs} documentos en total`}
                    >
                        <div className="space-y-2">
                            {Object.entries(TABLE_DISPLAY).map(([table, { label, color }]) => (
                                <div key={table} className="flex items-center justify-between text-sm">
                                    <span className={`${color}`}>{label}</span>
                                    <span className="text-slate-300 font-mono">{docCounts[table] ?? 0}</span>
                                </div>
                            ))}
                        </div>
                    </DataManagerCard>

                    {/* ===== Section 2: Backups ===== */}
                    <DataManagerCard
                        icon={<HardDrive size={18} className="text-emerald-400" />}
                        title="Backups Automaticos"
                        description={backupStats?.lastBackupAt ? `Ultimo: ${formatDate(backupStats.lastBackupAt)}` : 'Sin backups aun'}
                    >
                        <div className="space-y-3">
                            {/* Toggle */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-300">Backup automatico</span>
                                <button
                                    onClick={handleToggleAutoBackup}
                                    className={`relative w-10 h-5 rounded-full transition-colors ${autoBackup ? 'bg-emerald-600' : 'bg-slate-600'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoBackup ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreateBackup}
                                    disabled={isCreatingBackup}
                                    className="flex-1 px-3 py-2 bg-emerald-600/20 text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-600/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {isCreatingBackup ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    Crear backup ahora
                                </button>
                            </div>

                            {/* Backup list */}
                            {backups.length > 0 && (
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {backups.slice(0, 5).map(b => (
                                        <div key={b.filename} className="flex items-center justify-between text-xs bg-slate-700/30 rounded px-3 py-1.5">
                                            <div className="flex items-center gap-2">
                                                <Clock size={12} className="text-slate-400" />
                                                <span className="text-slate-300">{formatDate(b.createdAt)}</span>
                                            </div>
                                            <button
                                                onClick={() => handleRestore(b)}
                                                disabled={isRestoring}
                                                className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
                                                title="Restaurar este backup"
                                            >
                                                <RefreshCw size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {backups.length > 5 && (
                                        <p className="text-xs text-slate-500 text-center">+{backups.length - 5} mas</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </DataManagerCard>

                    {/* ===== Section 2b: Server Backup ===== */}
                    <DataManagerCard
                        icon={serverStats?.available
                            ? <Wifi size={18} className="text-emerald-400" />
                            : <WifiOff size={18} className="text-red-400" />
                        }
                        title="Backup en Servidor"
                        description={serverStats?.available ? 'Servidor conectado' : 'Servidor no disponible'}
                    >
                        <div className="space-y-3">
                            {/* Connection status */}
                            <div className="flex items-center gap-2 text-xs">
                                <div className={`w-2 h-2 rounded-full ${serverStats?.available ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                <span className="text-slate-300">
                                    {serverStats?.available ? 'Conectado al servidor' : 'Sin conexion al servidor'}
                                </span>
                            </div>

                            {/* Stats */}
                            {serverStats?.available && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-400">Ultimo backup:</span>
                                        <span className="text-slate-300">
                                            {serverStats.lastBackupAt ? formatDate(serverStats.lastBackupAt) : 'Ninguno'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-400">Total en servidor:</span>
                                        <span className="text-slate-300 font-mono">{serverStats.totalBackups}</span>
                                    </div>
                                </div>
                            )}

                            {/* Info */}
                            <p className="text-xs text-slate-500">
                                Los backups al servidor se crean automaticamente cada vez que guardas. Si el servidor no esta disponible, se crearan solo localmente.
                            </p>

                            {/* Force backup button */}
                            <button
                                onClick={handleForceServerBackup}
                                disabled={isServerBackingUp || !serverStats?.available}
                                className="w-full px-3 py-2 bg-emerald-600/20 text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-600/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                {isServerBackingUp ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
                                Forzar backup al servidor
                            </button>
                        </div>
                    </DataManagerCard>

                    {/* ===== Section 3: Export / Import ===== */}
                    <DataManagerCard
                        icon={<Download size={18} className="text-violet-400" />}
                        title="Exportar / Importar"
                        description="Compartir datos via archivo .barack"
                    >
                        <div className="space-y-3">
                            <p className="text-xs text-slate-400">
                                Exporta toda tu data a un archivo y compartilo por USB, email o WhatsApp. La otra persona lo importa en su app.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleExport}
                                    disabled={isExporting}
                                    className="flex-1 px-3 py-2.5 bg-violet-600/20 text-violet-400 text-sm font-medium rounded-lg hover:bg-violet-600/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                    Exportar
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={isImporting}
                                    className="flex-1 px-3 py-2.5 bg-blue-600/20 text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-600/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                    Importar
                                </button>
                            </div>
                        </div>
                    </DataManagerCard>

                    {/* ===== Section 4: Folder Sync ===== */}
                    <DataManagerCard
                        icon={<FolderSync size={18} className="text-cyan-400" />}
                        title="Sincronizacion por Carpeta"
                        description={syncStatus?.configured ? 'Carpeta configurada' : 'No configurada'}
                    >
                        <div className="space-y-3">
                            {!syncStatus?.configured ? (
                                <>
                                    <p className="text-xs text-slate-400">
                                        Configura una carpeta compartida (OneDrive, Dropbox, carpeta de red) para sincronizar datos entre computadoras automaticamente.
                                    </p>
                                    <button
                                        onClick={handleConfigureSync}
                                        className="w-full px-3 py-2.5 bg-cyan-600/20 text-cyan-400 text-sm font-medium rounded-lg hover:bg-cyan-600/30 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <FolderOpen size={14} />
                                        Configurar Carpeta
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Path + status */}
                                    <div className="flex items-center gap-2 text-xs">
                                        {syncStatus.accessible ? (
                                            <Wifi size={14} className="text-emerald-400" />
                                        ) : (
                                            <WifiOff size={14} className="text-red-400" />
                                        )}
                                        <span className="text-slate-300 truncate" title={syncStatus.path ?? ''}>
                                            {syncStatus.path}
                                        </span>
                                    </div>

                                    {/* Devices */}
                                    {syncStatus.devices.length > 0 && (
                                        <div className="space-y-1">
                                            <span className="text-xs text-slate-400">Dispositivos:</span>
                                            {syncStatus.devices.map(d => (
                                                <div key={d.deviceId} className="flex items-center justify-between text-xs bg-slate-700/30 rounded px-3 py-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <Monitor size={12} className="text-slate-400" />
                                                        <span className="text-slate-300">{d.deviceName}</span>
                                                    </div>
                                                    <span className="text-slate-500">{d.lastPushAt ? formatDate(d.lastPushAt) : '-'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Sync on startup toggle */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-300">Sincronizar al iniciar</span>
                                        <button
                                            onClick={handleSyncStartupToggle}
                                            className={`relative w-10 h-5 rounded-full transition-colors ${syncStatus.syncOnStartup ? 'bg-cyan-600' : 'bg-slate-600'}`}
                                        >
                                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${syncStatus.syncOnStartup ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                        </button>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSync}
                                            disabled={isSyncing || !syncStatus.accessible}
                                            className="flex-1 px-3 py-2.5 bg-cyan-600/20 text-cyan-400 text-sm font-medium rounded-lg hover:bg-cyan-600/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                            Sincronizar Ahora
                                        </button>
                                        <button
                                            onClick={handleConfigureSync}
                                            className="px-3 py-2.5 bg-slate-700 text-slate-300 text-sm rounded-lg hover:bg-slate-600 transition-colors"
                                            title="Cambiar carpeta"
                                        >
                                            <FolderOpen size={14} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </DataManagerCard>
                </div>
            </div>

            {/* Import Preview Modal */}
            <ImportPreviewModal
                isOpen={showImportPreview}
                onClose={() => { setShowImportPreview(false); setImportAnalysis(null); }}
                onImportDirect={handleImportDirect}
                onReviewConflicts={() => { setShowImportPreview(false); setShowImportConflicts(true); }}
                analysis={importAnalysis}
                isImporting={isImporting}
            />

            {/* Import Conflict Modal */}
            <ImportConflictModal
                isOpen={showImportConflicts}
                onClose={() => { setShowImportConflicts(false); setImportAnalysis(null); }}
                onApply={handleConflictApply}
                conflicts={importAnalysis?.conflicts ?? []}
                autoApplyCount={(importAnalysis?.added.length ?? 0) + (importAnalysis?.updated.length ?? 0)}
                isApplying={isImporting}
            />
        </div>
    );
};

// ---------------------------------------------------------------------------
// Shared date formatter
// ---------------------------------------------------------------------------
function formatDate(ts: string | null): string {
    if (!ts) return '-';
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return ts;
        return d.toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return ts;
    }
}

export default DataManager;
