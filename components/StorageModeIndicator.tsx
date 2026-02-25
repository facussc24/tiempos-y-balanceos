/**
 * Storage Mode Indicator Component
 * 
 * Displays the current storage mode (local/shared) in the header with a dropdown
 * to switch modes and access configuration. Shows connection status visually.
 * 
 * @module StorageModeIndicator
 */

import React, { useState, useEffect, useRef } from 'react';
import { Monitor, Wifi, WifiOff, ChevronDown, Settings, RefreshCw, HardDrive } from 'lucide-react';
import {
    getCurrentMode,
    setStorageMode,
    getStorageModeInfo,
    isServerAvailable,
    type StorageMode,
    type StorageModeInfo
} from '../utils/storageManager';
import { toast } from './ui/Toast';
import { logger } from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

interface StorageModeIndicatorProps {
    onOpenConfig?: () => void;
    onOpenSync?: () => void;
    compact?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StorageModeIndicator({
    onOpenConfig,
    onOpenSync,
    compact = false
}: StorageModeIndicatorProps) {
    const [mode, setMode] = useState<StorageMode>('shared');
    const [modeInfo, setModeInfo] = useState<{ local: StorageModeInfo; shared: StorageModeInfo } | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [serverOnline, setServerOnline] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load initial state
    useEffect(() => {
        loadModeInfo();

        // Check server status periodically
        const interval = setInterval(checkServerStatus, 30000); // Every 30s
        return () => clearInterval(interval);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    async function loadModeInfo() {
        try {
            const currentMode = await getCurrentMode();
            const info = await getStorageModeInfo();
            setMode(currentMode);
            setModeInfo(info);
            setServerOnline(info.shared.isAvailable);
        } catch (error) {
            logger.error('StorageModeIndicator', 'Failed to load storage mode info', {}, error instanceof Error ? error : undefined);
        }
    }

    async function checkServerStatus() {
        const available = await isServerAvailable();
        setServerOnline(available);

        // Update mode info if server status changed
        if (available !== serverOnline) {
            loadModeInfo();
        }
    }

    async function handleModeChange(newMode: StorageMode) {
        if (newMode === mode) {
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            // Check if target is available
            if (newMode === 'shared' && !serverOnline) {
                toast.warning(
                    'Servidor no disponible',
                    'No se puede cambiar a modo compartido sin conexión al servidor.'
                );
                return;
            }

            const success = await setStorageMode(newMode);
            if (success) {
                setMode(newMode);
                toast.success(
                    'Modo cambiado',
                    newMode === 'local'
                        ? 'Ahora trabajando en modo local (casa)'
                        : 'Ahora conectado al servidor compartido'
                );
                await loadModeInfo();
            }
        } catch (error) {
            toast.error('Error', 'No se pudo cambiar el modo de almacenamiento');
        } finally {
            setIsLoading(false);
            setIsOpen(false);
        }
    }

    // Mode display properties
    const modeDisplay = mode === 'local'
        ? {
            icon: Monitor,
            label: 'LOCAL',
            color: 'bg-blue-50 text-blue-600 border-blue-200',
            hoverColor: 'hover:bg-blue-100'
        }
        : serverOnline
            ? {
                icon: Wifi,
                label: 'SERVIDOR',
                color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                hoverColor: 'hover:bg-emerald-100'
            }
            : {
                icon: WifiOff,
                label: 'DESCONECTADO',
                color: 'bg-red-50 text-red-600 border-red-200',
                hoverColor: 'hover:bg-red-100'
            };

    const Icon = modeDisplay.icon;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Main Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isLoading}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm
                    transition-all duration-200 select-none hover:shadow-md
                    ${modeDisplay.color} ${modeDisplay.hoverColor}
                    ${isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                `}
            >
                <Icon size={16} className={isLoading ? 'animate-pulse' : ''} />
                {!compact && (
                    <>
                        <span className="text-sm font-medium">{modeDisplay.label}</span>
                        <ChevronDown
                            size={14}
                            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                    </>
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 rounded-lg border border-slate-700 shadow-xl z-[100] overflow-hidden animate-fade-in">
                    {/* Mode Options */}
                    <div className="p-2">
                        <p className="px-2 py-1 text-xs text-slate-500 uppercase tracking-wider">
                            Modo de Almacenamiento
                        </p>

                        {/* Local Mode */}
                        <button
                            onClick={() => handleModeChange('local')}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-md
                                transition-colors text-left
                                ${mode === 'local'
                                    ? 'bg-slate-700 text-blue-400 shadow-sm border border-slate-600'
                                    : 'hover:bg-slate-700 text-slate-300'
                                }
                            `}
                        >
                            <Monitor size={18} />
                            <div className="flex-1">
                                <p className="text-sm font-medium">Modo Local</p>
                                <p className="text-xs text-slate-500">Para trabajar desde casa</p>
                            </div>
                            {mode === 'local' && (
                                <span className="w-2 h-2 rounded-full bg-blue-400" />
                            )}
                        </button>

                        {/* Shared Mode */}
                        <button
                            onClick={() => handleModeChange('shared')}
                            disabled={!serverOnline}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-md
                                transition-colors text-left
                                ${!serverOnline ? 'opacity-50 cursor-not-allowed' : ''}
                                ${mode === 'shared'
                                    ? 'bg-slate-700 text-emerald-400 shadow-sm border border-slate-600'
                                    : 'hover:bg-slate-700 text-slate-300'
                                }
                            `}
                        >
                            {serverOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                            <div className="flex-1">
                                <p className="text-sm font-medium">Modo Compartido</p>
                                <p className="text-xs text-slate-500">
                                    {serverOnline ? 'Conectado al servidor' : 'Servidor no disponible'}
                                </p>
                            </div>
                            {mode === 'shared' && serverOnline && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            )}
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-700" />

                    {/* Actions */}
                    <div className="p-2">
                        {onOpenSync && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onOpenSync();
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-700 text-slate-300 transition-colors"
                            >
                                <RefreshCw size={16} />
                                <span className="text-sm">Sincronizar archivos</span>
                            </button>
                        )}

                        {onOpenConfig && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onOpenConfig();
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-700 text-slate-300 transition-colors"
                            >
                                <Settings size={16} />
                                <span className="text-sm">Configurar rutas...</span>
                            </button>
                        )}
                    </div>

                    {/* Path Info Footer */}
                    {modeInfo && (
                        <>
                            <div className="border-t border-slate-700" />
                            <div className="p-3 bg-slate-900">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <HardDrive size={12} />
                                    <span className="truncate">
                                        {mode === 'local'
                                            ? modeInfo.local.path
                                            : modeInfo.shared.path
                                        }
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )
            }
        </div >
    );
}

export default StorageModeIndicator;
