/**
 * FormatosApp — File explorer for standard engineering formats/templates
 *
 * Lists files from {engineeringBasePath}/Formatos Estandar/
 * Opens files with the system default application.
 *
 * Theme: purple/violet
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    ArrowLeft, FolderOpen, ExternalLink, WifiOff, Loader2,
    RefreshCw, FileSpreadsheet, FileText, File, Search,
} from 'lucide-react';
import type { EngineeringFileEntry, FileTypeCategory } from './engineeringTypes';
import { logger } from '../../utils/logger';
import { classifyFileType, FILE_TYPE_COLORS, FORMATOS_DIR } from './engineeringTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormatosAppProps {
    onBackToLanding: () => void;
}

type ServerStatus = 'connected' | 'disconnected' | 'checking';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map file type category to a Lucide icon component */
function getFileIcon(category: FileTypeCategory): React.FC<{ size?: number; className?: string }> {
    switch (category) {
        case 'excel': return FileSpreadsheet;
        case 'pdf': return FileText;
        case 'word': return FileText;
        case 'html': return FileText;
        default: return File;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const FormatosApp: React.FC<FormatosAppProps> = ({ onBackToLanding }) => {
    const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
    const [files, setFiles] = useState<EngineeringFileEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const lastLoadRef = useRef(0);

    // --- Server availability check ---
    const checkServer = useCallback(async () => {
        setServerStatus('checking');
        try {
            const { isEngineeringServerAvailable } = await import('./engineeringServerManager');
            const available = await isEngineeringServerAvailable();
            setServerStatus(available ? 'connected' : 'disconnected');
        } catch (err) {
            logger.warn('Formatos', 'Server availability check failed', { error: err instanceof Error ? err.message : String(err) });
            setServerStatus('disconnected');
        }
    }, []);

    // --- Load file list ---
    const loadFiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const { listEngineeringFiles } = await import('./engineeringServerManager');
            const entries = await listEngineeringFiles(FORMATOS_DIR);
            setFiles(entries);
        } catch (err) {
            logger.warn('Formatos', 'Failed to load file list', { error: err instanceof Error ? err.message : String(err) });
            setFiles([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // --- Open file (web: not supported, files live on the server) ---
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleOpenFile = useCallback((_filePath: string) => {
        // Opening local paths with system apps is only possible in native mode.
        // In web mode the user can access files through the engineering server directly.
    }, []);

    // --- Filtered files ---
    const filteredFiles = useMemo(() => {
        if (!searchQuery.trim()) return files;
        const q = searchQuery.toLowerCase();
        return files.filter(f => f.name.toLowerCase().includes(q));
    }, [files, searchQuery]);

    // --- Lifecycle ---
    useEffect(() => {
        checkServer();
        const interval = setInterval(checkServer, 60_000);
        return () => clearInterval(interval);
    }, [checkServer]);

    useEffect(() => {
        if (serverStatus === 'connected') {
            loadFiles();
            lastLoadRef.current = Date.now();
        }
    }, [serverStatus, loadFiles]);

    // Auto-refresh when tab becomes visible after 30s
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && serverStatus === 'connected') {
                if (Date.now() - lastLoadRef.current > 30_000) {
                    loadFiles();
                    lastLoadRef.current = Date.now();
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [serverStatus, loadFiles]);

    // --- Server status indicator ---
    const StatusBadge: React.FC = () => {
        if (serverStatus === 'checking') {
            return (
                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Loader2 size={10} className="animate-spin" />
                    Verificando...
                </span>
            );
        }
        if (serverStatus === 'disconnected') {
            return (
                <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Desconectado
                </span>
            );
        }
        return (
            <span className="flex items-center gap-1 text-[10px] text-purple-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                Conectado
            </span>
        );
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* ===== TOOLBAR ===== */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
                <button
                    onClick={onBackToLanding}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 transition font-medium"
                >
                    <ArrowLeft size={16} />
                    Inicio
                </button>

                <div className="h-5 w-px bg-gray-200" />

                <div className="flex items-center gap-2">
                    <FolderOpen size={16} className="text-purple-600" />
                    <h1 className="text-sm font-bold text-purple-700 tracking-wide">
                        Formatos Estándar
                    </h1>
                </div>

                <div className="ml-2">
                    <StatusBadge />
                </div>

                {serverStatus === 'connected' && (
                    <button
                        onClick={loadFiles}
                        className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition"
                        title="Recargar lista"
                    >
                        <RefreshCw size={12} />
                    </button>
                )}
            </div>

            {/* ===== MAIN CONTENT ===== */}
            {serverStatus === 'disconnected' ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <WifiOff size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500 font-medium">Servidor no disponible</p>
                        <p className="text-xs text-gray-400 mt-1">
                            No se puede acceder a la carpeta de formatos en el servidor.
                        </p>
                        <button
                            onClick={checkServer}
                            className="mt-4 text-xs text-purple-600 hover:text-purple-700 font-medium"
                        >
                            Reintentar conexión
                        </button>
                    </div>
                </div>
            ) : serverStatus === 'checking' ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 size={32} className="mx-auto mb-3 text-purple-400 animate-spin" />
                        <p className="text-sm text-gray-400">Verificando conexion al servidor...</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-3xl mx-auto">
                        {/* Search */}
                        {files.length > 0 && (
                            <div className="relative mb-4">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Buscar formato..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                                />
                            </div>
                        )}

                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={24} className="text-purple-400 animate-spin" />
                            </div>
                        ) : files.length === 0 ? (
                            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                                <FolderOpen size={40} className="mx-auto mb-3 text-gray-200" />
                                <p className="text-sm text-gray-400">
                                    No hay formatos disponibles.
                                </p>
                                <p className="text-xs text-gray-300 mt-1">
                                    Agregue archivos a la carpeta Formatos Estándar en el servidor.
                                </p>
                            </div>
                        ) : filteredFiles.length === 0 ? (
                            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                                <Search size={32} className="mx-auto mb-3 text-gray-200" />
                                <p className="text-sm text-gray-400">
                                    Sin resultados para &ldquo;{searchQuery}&rdquo;
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
                                {filteredFiles.map(file => {
                                    const category = classifyFileType(file.extension);
                                    const colors = FILE_TYPE_COLORS[category];
                                    const Icon = getFileIcon(category);
                                    return (
                                        <button
                                            key={file.name}
                                            onClick={() => handleOpenFile(file.path)}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left group"
                                            title={`Abrir ${file.name}`}
                                        >
                                            <div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                                                <Icon size={18} className={colors.text} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate" title={file.name}>
                                                    {file.name}
                                                </p>
                                                <p className="text-[10px] text-gray-400 uppercase">
                                                    {file.extension.replace(/^\./, '')}
                                                </p>
                                            </div>
                                            <ExternalLink
                                                size={14}
                                                className="text-gray-300 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FormatosApp;
