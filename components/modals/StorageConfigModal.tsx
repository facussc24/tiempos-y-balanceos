/**
 * Storage Configuration Modal
 * 
 * Modal for initial setup and configuration of storage paths.
 * Allows users to configure local and shared storage locations.
 * 
 * @module StorageConfigModal
 */

import React, { useState, useEffect } from 'react';
import {
    X,
    Monitor,
    Wifi,
    FolderOpen,
    Save,
    AlertCircle,
    CheckCircle,
    Settings,
    HardDrive
} from 'lucide-react';
import {
    loadStorageSettings,
    updateStorageConfig,
    getDefaultLocalPath,
    isPathAccessible,
    type StorageSettings
} from '../../utils/storageManager';
import { getPathConfig } from '../../utils/pathManager';
import { pickFolder } from '../../utils/tauri_fs';
import { toast } from '../ui/Toast';

// ============================================================================
// TYPES
// ============================================================================

interface StorageConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: () => void;
    isInitialSetup?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StorageConfigModal({
    isOpen,
    onClose,
    onSave,
    isInitialSetup = false
}: StorageConfigModalProps) {
    const [localPath, setLocalPath] = useState('');
    const [sharedPath, setSharedPath] = useState('');
    const [autoDetect, setAutoDetect] = useState(true);
    const [syncMedia, setSyncMedia] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [localValid, setLocalValid] = useState<boolean | null>(null);
    const [sharedValid, setSharedValid] = useState<boolean | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    // Load current settings
    useEffect(() => {
        if (isOpen) {
            loadCurrentSettings();
        }
    }, [isOpen]);

    async function loadCurrentSettings() {
        const settings = await loadStorageSettings();
        const defaultLocal = await getDefaultLocalPath();

        setLocalPath(settings.localStoragePath || defaultLocal);
        setSharedPath(settings.sharedStoragePath || getPathConfig().basePath);
        setAutoDetect(settings.autoDetectNetwork);
        setSyncMedia(settings.syncMediaFiles);

        // Validate paths
        validatePaths(
            settings.localStoragePath || defaultLocal,
            settings.sharedStoragePath || getPathConfig().basePath
        );
    }

    async function validatePaths(local: string, shared: string) {
        setIsValidating(true);
        const [localOk, sharedOk] = await Promise.all([
            isPathAccessible(local),
            isPathAccessible(shared)
        ]);
        setLocalValid(localOk);
        setSharedValid(sharedOk);
        setIsValidating(false);
    }

    async function handleBrowseLocal() {
        const path = await pickFolder();
        if (path) {
            setLocalPath(path);
            setLocalValid(null);
            validatePaths(path, sharedPath);
        }
    }

    async function handleBrowseShared() {
        const path = await pickFolder();
        if (path) {
            setSharedPath(path);
            setSharedValid(null);
            validatePaths(localPath, path);
        }
    }

    async function handleSave() {
        setIsSaving(true);
        try {
            const success = await updateStorageConfig({
                localPath,
                sharedPath,
                autoDetect,
                syncMediaFiles: syncMedia
            });

            if (success) {
                toast.success('Configuración guardada', 'Las rutas de almacenamiento han sido actualizadas');
                onSave?.();
                onClose();
            } else {
                toast.error('Error', 'No se pudo guardar la configuración');
            }
        } catch (error) {
            toast.error('Error', 'Error al guardar configuración');
        } finally {
            setIsSaving(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Settings size={20} />
                        {isInitialSetup ? 'Configurar Almacenamiento' : 'Configuración de Rutas'}
                    </h2>
                    {!isInitialSetup && (
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-5 space-y-5 overflow-auto max-h-[60vh]">
                    {/* Initial Setup Message */}
                    {isInitialSetup && (
                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm">
                            <p className="font-medium mb-1">¡Bienvenido!</p>
                            <p className="text-blue-200/80">
                                Configura las rutas de almacenamiento local y del servidor para comenzar a usar la aplicación.
                            </p>
                        </div>
                    )}

                    {/* Local Path */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Monitor size={16} className="text-blue-400" />
                            Ruta de Almacenamiento Local
                        </label>
                        <p className="text-xs text-slate-500">
                            Carpeta donde se guardarán los proyectos cuando trabajes sin conexión al servidor.
                        </p>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={localPath}
                                    onChange={(e) => {
                                        setLocalPath(e.target.value);
                                        setLocalValid(null);
                                    }}
                                    onBlur={() => validatePaths(localPath, sharedPath)}
                                    className={`
                                        w-full px-3 py-2.5 pr-10 rounded-lg bg-slate-900 border text-slate-200 text-sm
                                        focus:outline-none focus:ring-2 focus:ring-blue-500
                                        ${localValid === false ? 'border-red-500' :
                                            localValid === true ? 'border-emerald-500' : 'border-slate-600'}
                                    `}
                                    placeholder="C:\Users\...\BarackMercosul"
                                />
                                {localValid !== null && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {localValid ? (
                                            <CheckCircle size={16} className="text-emerald-400" />
                                        ) : (
                                            <AlertCircle size={16} className="text-red-400" />
                                        )}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={handleBrowseLocal}
                                className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                            >
                                <FolderOpen size={18} />
                            </button>
                        </div>
                        {localValid === false && (
                            <p className="text-xs text-red-400">
                                La ruta no existe o no es accesible. Se creará al guardar.
                            </p>
                        )}
                    </div>

                    {/* Shared Path */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Wifi size={16} className="text-emerald-400" />
                            Ruta del Servidor Compartido
                        </label>
                        <p className="text-xs text-slate-500">
                            Carpeta en la unidad de red donde se almacenan los proyectos del equipo.
                        </p>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={sharedPath}
                                    onChange={(e) => {
                                        setSharedPath(e.target.value);
                                        setSharedValid(null);
                                    }}
                                    onBlur={() => validatePaths(localPath, sharedPath)}
                                    className={`
                                        w-full px-3 py-2.5 pr-10 rounded-lg bg-slate-900 border text-slate-200 text-sm
                                        focus:outline-none focus:ring-2 focus:ring-emerald-500
                                        ${sharedValid === false ? 'border-amber-500' :
                                            sharedValid === true ? 'border-emerald-500' : 'border-slate-600'}
                                    `}
                                    placeholder="Y:\Ingenieria\..."
                                />
                                {sharedValid !== null && !isValidating && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {sharedValid ? (
                                            <CheckCircle size={16} className="text-emerald-400" />
                                        ) : (
                                            <AlertCircle size={16} className="text-amber-400" />
                                        )}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={handleBrowseShared}
                                className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                            >
                                <FolderOpen size={18} />
                            </button>
                        </div>
                        {sharedValid === false && (
                            <p className="text-xs text-amber-400">
                                El servidor no está disponible actualmente. Podrás conectarte cuando tengas acceso a la red.
                            </p>
                        )}
                    </div>

                    {/* Options */}
                    <div className="space-y-3 pt-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={autoDetect}
                                onChange={(e) => setAutoDetect(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            <div>
                                <p className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                    Detectar automáticamente según conexión de red
                                </p>
                                <p className="text-xs text-slate-500">
                                    Cambia a modo local si el servidor no está disponible al iniciar
                                </p>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={syncMedia}
                                onChange={(e) => setSyncMedia(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            <div>
                                <p className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                    Sincronizar archivos multimedia
                                </p>
                                <p className="text-xs text-slate-500">
                                    Incluir fotos y videos en la sincronización (puede ser lento)
                                </p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700 bg-slate-800/50">
                    {!isInitialSetup && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isValidating}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
                    >
                        <Save size={16} />
                        {isSaving ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default StorageConfigModal;
