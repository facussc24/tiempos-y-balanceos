/**
 * Sync Panel Module
 * 
 * Full-featured synchronization panel showing:
 * - Current mode and connection status
 * - List of projects with sync status
 * - Sync controls and progress
 * - Conflict resolution UI
 * 
 * @module SyncPanel
 */

import React, { useState, useEffect } from 'react';
import {
    RefreshCw,
    Upload,
    Download,
    ArrowLeftRight,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Clock,
    FolderOpen,
    Settings,
    Wifi,
    WifiOff,
    Monitor,
    HardDrive,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import {
    getCurrentMode,
    isServerAvailable,
    isSyncRecommended,
    getLastSyncTimestamp,
    type StorageMode
} from '../utils/storageManager';
import {
    getSyncStatus,
    syncAll,
    type SyncItem,
    type SyncDirection,
    type SyncProgress,
    type ConflictResolution
} from '../utils/syncEngine';
import { toast } from '../components/ui/Toast';
import { logger } from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

interface SyncPanelProps {
    onClose?: () => void;
    onOpenConfig?: () => void;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: SyncItem['status'] }) {
    const config = {
        synced: { icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/20', label: 'Sincronizado' },
        pending: { icon: Clock, color: 'text-amber-400 bg-amber-500/20', label: 'Pendiente' },
        conflict: { icon: AlertTriangle, color: 'text-red-400 bg-red-500/20', label: 'Conflicto' },
        syncing: { icon: RefreshCw, color: 'text-blue-400 bg-blue-500/20', label: 'Sincronizando' },
        error: { icon: XCircle, color: 'text-red-400 bg-red-500/20', label: 'Error' },
    }[status];

    const Icon = config.icon;

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
            <Icon size={12} className={status === 'syncing' ? 'animate-spin' : ''} />
            {config.label}
        </span>
    );
}

function ProjectItem({ item, expanded, onToggle }: {
    item: SyncItem;
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="border border-slate-700 rounded-lg overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-800/50 transition-colors text-left"
            >
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <FolderOpen size={18} className="text-slate-400" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                        {item.client} / {item.project}
                    </p>
                    <p className="text-xs text-slate-500">{item.part}</p>
                </div>
                <StatusBadge status={item.status} />
            </button>

            {expanded && (
                <div className="px-4 pb-3 pt-1 border-t border-slate-700/50 bg-slate-900/30">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                            <p className="text-slate-500 mb-1">📁 Local</p>
                            {item.localPath ? (
                                <>
                                    <p className="text-slate-400 truncate" title={item.localPath}>
                                        {item.localPath.split('\\').slice(-3).join('\\')}
                                    </p>
                                    {item.localModified && (
                                        <p className="text-slate-500 mt-1">
                                            Mod: {isNaN(new Date(item.localModified).getTime()) ? '—' : new Date(item.localModified).toLocaleString()}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className="text-slate-500 italic">No existe</p>
                            )}
                        </div>
                        <div>
                            <p className="text-slate-500 mb-1">📡 Servidor</p>
                            {item.serverPath ? (
                                <>
                                    <p className="text-slate-400 truncate" title={item.serverPath}>
                                        {item.serverPath.split('\\').slice(-3).join('\\')}
                                    </p>
                                    {item.serverModified && (
                                        <p className="text-slate-500 mt-1">
                                            Mod: {isNaN(new Date(item.serverModified).getTime()) ? '—' : new Date(item.serverModified).toLocaleString()}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className="text-slate-500 italic">No existe</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ProgressBar({ progress }: { progress: SyncProgress }) {
    const percentage = (progress.current / progress.total) * 100;

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
                <span>{progress.phase === 'scanning' ? 'Escaneando...' :
                    progress.phase === 'comparing' ? 'Comparando...' :
                        progress.phase === 'syncing' ? 'Sincronizando...' : 'Completo'}</span>
                <span>{Math.round(percentage)}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {progress.currentItem && (
                <p className="text-xs text-slate-500 truncate">
                    {progress.currentItem}
                </p>
            )}
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SyncPanel({ onClose: _onClose, onOpenConfig }: SyncPanelProps) {
    const [mode, setMode] = useState<StorageMode>('shared');
    const [items, setItems] = useState<SyncItem[]>([]);
    const [serverOnline, setServerOnline] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [lastSync, setLastSync] = useState<number | null>(null);
    const [needsSync, setNeedsSync] = useState(false);

    // Load data on mount
    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setIsLoading(true);
        try {
            const [currentMode, online, syncItems, lastSyncTs, syncRecommended] = await Promise.all([
                getCurrentMode(),
                isServerAvailable(),
                getSyncStatus(),
                getLastSyncTimestamp(),
                isSyncRecommended()
            ]);

            setMode(currentMode);
            setServerOnline(online);
            setItems(syncItems);
            setLastSync(lastSyncTs);
            setNeedsSync(syncRecommended);
        } catch (error) {
            logger.error('SyncPanel', 'Failed to load sync data', {}, error instanceof Error ? error : undefined);
            toast.error('Error', 'No se pudo cargar el estado de sincronización');
        } finally {
            setIsLoading(false);
        }
    }

    // P4: Conflict resolution state
    const [pendingConflicts, setPendingConflicts] = useState<SyncItem[]>([]);
    const [conflictResolutions, setConflictResolutions] = useState<Map<string, ConflictResolution>>(new Map());
    const [conflictResolver, setConflictResolver] = useState<{
        conflicts: SyncItem[];
        resolve: (resolutions: Map<string, ConflictResolution>) => void;
    } | null>(null);

    async function handleSync(direction: SyncDirection) {
        if (!serverOnline && direction !== 'toLocal') {
            toast.warning('Sin conexión', 'El servidor no está disponible');
            return;
        }

        setIsSyncing(true);
        setSyncProgress({ current: 0, total: 100, currentItem: '', phase: 'scanning' });

        try {
            const result = await syncAll(
                direction,
                (progress) => setSyncProgress(progress),
                async (conflicts) => {
                    // P4: Show conflict resolution UI and wait for user decisions
                    return new Promise<Map<string, ConflictResolution>>((resolve) => {
                        setPendingConflicts(conflicts);
                        setConflictResolutions(new Map());
                        setConflictResolver({ conflicts, resolve });
                    });
                }
            );

            if (result.success) {
                toast.success(
                    'Sincronización completada',
                    `${result.itemsSynced} proyectos sincronizados`
                );
            } else if (result.conflicts.length > 0) {
                toast.warning(
                    'Sincronización parcial',
                    `${result.itemsSynced} sincronizados, ${result.conflicts.length} conflictos`
                );
            } else {
                toast.error(
                    'Error en sincronización',
                    result.errors[0]?.error || 'Error desconocido'
                );
            }

            // Reload data
            await loadData();
        } catch (error) {
            toast.error('Error', 'La sincronización falló');
        } finally {
            setIsSyncing(false);
            setSyncProgress(null);
        }
    }

    function handleConflictChoice(id: string, resolution: ConflictResolution) {
        setConflictResolutions(prev => {
            const next = new Map(prev);
            next.set(id, resolution);
            return next;
        });
    }

    function submitConflictResolutions() {
        if (!conflictResolver) return;
        // Fill any unresolved conflicts with 'skip'
        const finalResolutions = new Map(conflictResolutions);
        for (const c of conflictResolver.conflicts) {
            if (!finalResolutions.has(c.id)) {
                finalResolutions.set(c.id, 'skip');
            }
        }
        conflictResolver.resolve(finalResolutions);
        setConflictResolver(null);
        setPendingConflicts([]);
    }

    function toggleExpanded(id: string) {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    // Categorize items
    const syncedItems = items.filter(i => i.status === 'synced');
    const pendingItems = items.filter(i => i.status === 'pending');
    const conflictItems = items.filter(i => i.status === 'conflict');

    return (
        <div className="flex flex-col h-full bg-slate-900">
            {/* Header */}
            <div className="p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <RefreshCw size={20} />
                    Centro de Sincronización
                </h2>
            </div>

            {/* Status Bar */}
            <div className="p-4 bg-slate-800/50 border-b border-slate-700">
                <div className="flex items-center gap-4">
                    {/* Current Mode */}
                    <div className="flex items-center gap-2">
                        {mode === 'local' ? (
                            <Monitor size={18} className="text-blue-400" />
                        ) : serverOnline ? (
                            <Wifi size={18} className="text-emerald-400" />
                        ) : (
                            <WifiOff size={18} className="text-red-400" />
                        )}
                        <span className="text-sm text-slate-300">
                            {mode === 'local' ? 'Modo Local' :
                                serverOnline ? 'Servidor Conectado' : 'Servidor Desconectado'}
                        </span>
                    </div>

                    <div className="flex-1" />

                    {/* Last Sync */}
                    {lastSync && (
                        <div className="text-xs text-slate-500">
                            Última sync: {isNaN(new Date(lastSync).getTime()) ? '—' : new Date(lastSync).toLocaleDateString()}
                        </div>
                    )}

                    {/* Refresh Button */}
                    <button
                        onClick={loadData}
                        disabled={isLoading || isSyncing}
                        className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Sync Recommendation */}
                {needsSync && !isSyncing && (
                    <div className="mt-3 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                        ⏰ Se recomienda sincronizar - Han pasado más de 24 horas desde la última sincronización.
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <RefreshCw className="animate-spin text-slate-500" size={24} />
                    </div>
                ) : isSyncing && syncProgress ? (
                    <div className="py-8">
                        <ProgressBar progress={syncProgress} />
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <HardDrive size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No hay proyectos para sincronizar</p>
                        <p className="text-sm mt-1">Crea o abre un proyecto para comenzar</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* P4: Active Conflict Resolution UI */}
                        {conflictResolver && pendingConflicts.length > 0 && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                                <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                                    <AlertTriangle size={14} />
                                    Resolver Conflictos ({pendingConflicts.length})
                                </h3>
                                <p className="text-xs text-slate-400 mb-3">
                                    Estos proyectos fueron modificados tanto localmente como en el servidor. Elige qué versión conservar:
                                </p>
                                <div className="space-y-3">
                                    {pendingConflicts.map(c => (
                                        <div key={c.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                                            <p className="text-sm text-slate-200 font-medium mb-1">{c.client} / {c.project} / {c.part}</p>
                                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-2">
                                                <span>Local: {c.localModified ? new Date(c.localModified).toLocaleString() : '—'}</span>
                                                <span>Servidor: {c.serverModified ? new Date(c.serverModified).toLocaleString() : '—'}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleConflictChoice(c.id, 'keepLocal')}
                                                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${conflictResolutions.get(c.id) === 'keepLocal' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                                >
                                                    Usar Local
                                                </button>
                                                <button
                                                    onClick={() => handleConflictChoice(c.id, 'keepServer')}
                                                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${conflictResolutions.get(c.id) === 'keepServer' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                                >
                                                    Usar Servidor
                                                </button>
                                                <button
                                                    onClick={() => handleConflictChoice(c.id, 'skip')}
                                                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${conflictResolutions.get(c.id) === 'skip' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                                >
                                                    Omitir
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={submitConflictResolutions}
                                    className="w-full mt-3 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                                >
                                    Aplicar Resoluciones
                                </button>
                            </div>
                        )}

                        {/* Conflicts Section */}
                        {conflictItems.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                                    <AlertTriangle size={14} />
                                    Conflictos ({conflictItems.length})
                                </h3>
                                <div className="space-y-2">
                                    {conflictItems.map(item => (
                                        <ProjectItem
                                            key={item.id}
                                            item={item}
                                            expanded={expandedItems.has(item.id)}
                                            onToggle={() => toggleExpanded(item.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pending Section */}
                        {pendingItems.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-2">
                                    <Clock size={14} />
                                    Pendientes ({pendingItems.length})
                                </h3>
                                <div className="space-y-2">
                                    {pendingItems.map(item => (
                                        <ProjectItem
                                            key={item.id}
                                            item={item}
                                            expanded={expandedItems.has(item.id)}
                                            onToggle={() => toggleExpanded(item.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Synced Section */}
                        {syncedItems.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
                                    <CheckCircle size={14} />
                                    Sincronizados ({syncedItems.length})
                                </h3>
                                <div className="space-y-2">
                                    {syncedItems.map(item => (
                                        <ProjectItem
                                            key={item.id}
                                            item={item}
                                            expanded={expandedItems.has(item.id)}
                                            onToggle={() => toggleExpanded(item.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-slate-700 bg-slate-800/30">
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => handleSync('toLocal')}
                        disabled={isSyncing || !serverOnline}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download size={16} />
                        <span className="text-sm">Descargar</span>
                    </button>

                    <button
                        onClick={() => handleSync('toServer')}
                        disabled={isSyncing || !serverOnline}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Upload size={16} />
                        <span className="text-sm">Subir</span>
                    </button>

                    <button
                        onClick={() => handleSync('bidirectional')}
                        disabled={isSyncing || !serverOnline}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowLeftRight size={16} />
                        <span className="text-sm">Sync</span>
                    </button>
                </div>

                {/* Config Link */}
                {onOpenConfig && (
                    <button
                        onClick={onOpenConfig}
                        className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-700/50 text-slate-400 text-sm transition-colors"
                    >
                        <Settings size={14} />
                        Configurar rutas de almacenamiento
                    </button>
                )}
            </div>
        </div>
    );
}

export default SyncPanel;
