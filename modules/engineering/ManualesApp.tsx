/**
 * ManualesApp — Split-panel viewer for engineering manuals (HTML files)
 *
 * Left panel: file list from {engineeringBasePath}/Manuales/
 * Right panel: rendered HTML content
 *
 * Theme: teal
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    ArrowLeft, BookOpen, ExternalLink, WifiOff, Loader2,
    RefreshCw, FileText, Search,
} from 'lucide-react';
import type { EngineeringFileEntry } from './engineeringTypes';
import { logger } from '../../utils/logger';
import { MANUALES_DIR } from './engineeringTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManualesAppProps {
    onBackToLanding: () => void;
}

type ServerStatus = 'connected' | 'disconnected' | 'checking';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ManualesApp: React.FC<ManualesAppProps> = ({ onBackToLanding }) => {
    const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
    const [files, setFiles] = useState<EngineeringFileEntry[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
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
            logger.warn('Manuales', 'Server availability check failed', { error: err instanceof Error ? err.message : String(err) });
            setServerStatus('disconnected');
        }
    }, []);

    // --- Load file list ---
    const loadFiles = useCallback(async () => {
        try {
            const { listEngineeringFiles } = await import('./engineeringServerManager');
            const entries = await listEngineeringFiles(MANUALES_DIR);
            // Filter to HTML files only
            const htmlFiles = entries.filter(e =>
                e.extension.toLowerCase() === '.html' || e.extension.toLowerCase() === '.htm'
            );
            setFiles(htmlFiles);
        } catch (err) {
            logger.warn('Manuales', 'Failed to load file list', { error: err instanceof Error ? err.message : String(err) });
            setFiles([]);
        }
    }, []);

    // --- Load HTML content for a file ---
    const loadHtmlContent = useCallback(async (fileName: string) => {
        setSelectedFile(fileName);
        setIsLoading(true);
        try {
            const { readManualHtml } = await import('./engineeringServerManager');
            const content = await readManualHtml(fileName);
            setHtmlContent(content);
        } catch (err) {
            logger.warn('Manuales', 'Failed to load HTML content', { error: err instanceof Error ? err.message : String(err) });
            setHtmlContent(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // --- Open file with system app ---
    const handleOpenExternal = useCallback(async (filePath: string) => {
        try {
            const opener = await import('@tauri-apps/plugin-opener');
            await opener.openPath(filePath);
        } catch {
            // Silent — only works in Tauri
        }
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
            <span className="flex items-center gap-1 text-[10px] text-teal-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
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
                    <BookOpen size={16} className="text-teal-600" />
                    <h1 className="text-sm font-bold text-teal-700 tracking-wide">
                        Manuales de Ingeniería
                    </h1>
                </div>

                <div className="ml-2">
                    <StatusBadge />
                </div>

                {serverStatus === 'connected' && (
                    <button
                        onClick={loadFiles}
                        className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded transition"
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
                            No se puede acceder a la carpeta de manuales en el servidor.
                        </p>
                        <button
                            onClick={checkServer}
                            className="mt-4 text-xs text-teal-600 hover:text-teal-700 font-medium"
                        >
                            Reintentar conexión
                        </button>
                    </div>
                </div>
            ) : serverStatus === 'checking' ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 size={32} className="mx-auto mb-3 text-teal-400 animate-spin" />
                        <p className="text-sm text-gray-400">Verificando conexion al servidor...</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex overflow-hidden">
                    {/* === LEFT: File list === */}
                    <div className="w-72 border-r border-gray-200 bg-white overflow-y-auto flex-shrink-0">
                        <div className="p-3 border-b border-gray-100">
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">
                                Archivos ({files.length})
                            </p>
                            {files.length > 0 && (
                                <div className="relative">
                                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Buscar manual..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400"
                                    />
                                </div>
                            )}
                        </div>

                        {files.length === 0 ? (
                            <div className="p-6 text-center">
                                <FileText size={28} className="mx-auto mb-2 text-gray-300" />
                                <p className="text-xs text-gray-400">
                                    No hay manuales disponibles.
                                </p>
                                <p className="text-[10px] text-gray-300 mt-1">
                                    Agregue archivos HTML a la carpeta Manuales.
                                </p>
                            </div>
                        ) : filteredFiles.length === 0 ? (
                            <div className="p-6 text-center">
                                <Search size={24} className="mx-auto mb-2 text-gray-200" />
                                <p className="text-xs text-gray-400">
                                    Sin resultados para &ldquo;{searchQuery}&rdquo;
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {filteredFiles.map(file => (
                                    <div
                                        key={file.name}
                                        className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition group ${
                                            selectedFile === file.name
                                                ? 'bg-teal-50 border-l-2 border-teal-500'
                                                : 'hover:bg-gray-50 border-l-2 border-transparent'
                                        }`}
                                    >
                                        <button
                                            onClick={() => loadHtmlContent(file.name)}
                                            className="flex-1 text-left min-w-0"
                                        >
                                            <p className={`text-xs font-medium truncate ${
                                                selectedFile === file.name ? 'text-teal-700' : 'text-gray-700'
                                            }`}>
                                                {file.name}
                                            </p>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenExternal(file.path);
                                            }}
                                            className="flex-shrink-0 p-1 rounded text-gray-300 hover:text-teal-600 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition"
                                            title="Abrir con app del sistema"
                                            aria-label={`Abrir ${file.name} externamente`}
                                        >
                                            <ExternalLink size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* === RIGHT: HTML content === */}
                    <div className="flex-1 overflow-y-auto bg-white">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 size={24} className="text-teal-400 animate-spin" />
                            </div>
                        ) : htmlContent ? (
                            <div className="p-6">
                                <div
                                    className="prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <BookOpen size={40} className="mx-auto mb-3 text-gray-200" />
                                    <p className="text-sm text-gray-400">
                                        Selecciona un manual para ver su contenido
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManualesApp;
