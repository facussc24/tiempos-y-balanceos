/**
 * Settings Modal
 * 
 * Configuration panel with 3 sections:
 * 1. Security - (encryption removed)
 * 2. Diagnostic - export settings and path
 * 3. QA - panel visibility toggle
 */

import { useState, useEffect } from 'react';
import {
    Settings,
    Shield,
    FileSearch,
    FlaskConical,
    X,
    Download,
    FolderOpen,
    ToggleLeft,
    ToggleRight,
    Check,
    ExternalLink
} from 'lucide-react';
import { toast } from '../ui/Toast';
import {
    loadSettings,
    saveSettings,
    isDevMode,
    getDiagnosticExportPath,
    AppSettings
} from '../../utils/settingsStore';
import { isTauri } from '../../utils/unified_fs';
import { exportDiagnosticJSON, logger } from '../../utils/logger';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSettingsChange?: (settings: AppSettings) => void;
}

type TabId = 'security' | 'diagnostic' | 'qa';

export function SettingsModal({ isOpen, onClose, onSettingsChange }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<TabId>('diagnostic');
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Diagnostic state
    const [diagnosticPath, setDiagnosticPath] = useState('');
    const [lastExportPath, setLastExportPath] = useState<string | null>(null);

    // Load settings on open
    useEffect(() => {
        if (isOpen) {
            loadSettingsAsync();
        }
    }, [isOpen]);

    const loadSettingsAsync = async () => {
        setIsLoading(true);
        try {
            const loaded = await loadSettings();
            setSettings(loaded);

            const path = await getDiagnosticExportPath();
            setDiagnosticPath(path);
        } catch (error) {
            logger.error('Settings', 'Load error', {}, error instanceof Error ? error : undefined);
        }
        setIsLoading(false);
    };

    const handleSaveSettings = async (newSettings: Partial<AppSettings>) => {
        if (!settings) return;

        const updated = { ...settings, ...newSettings };
        const success = await saveSettings(updated);

        if (success) {
            setSettings(updated);
            onSettingsChange?.(updated);
            toast.success('Configuración Guardada', 'Los cambios se aplicaron correctamente');
        } else {
            toast.error('Error', 'No se pudo guardar la configuración');
        }
    };

    const handleExportDiagnostic = async () => {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
            const fileName = `diag_${timestamp}.json`;

            if (isTauri()) {
                const tauriFs = await import('../../utils/tauri_fs');

                // Ensure directory exists
                await tauriFs.ensureDir(diagnosticPath);

                const fullPath = `${diagnosticPath}\\${fileName}`;
                const content = exportDiagnosticJSON(null);

                const success = await tauriFs.writeTextFile(fullPath, content);

                if (success) {
                    setLastExportPath(fullPath);
                    toast.success('Diagnóstico Exportado', fullPath);
                } else {
                    toast.error('Error', 'No se pudo guardar el archivo');
                }
            } else {
                // Web mode: download as blob
                const content = exportDiagnosticJSON(null);
                const blob = new Blob([content], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1500);

                toast.success('Diagnóstico Descargado', fileName);
            }
        } catch (error) {
            toast.error('Error al Exportar', String(error));
        }
    };

    const handleOpenFolder = async () => {
        if (!lastExportPath) return;

        try {
            // Extract directory from file path
            const dir = lastExportPath.substring(0, lastExportPath.lastIndexOf('\\'));

            // Use Tauri shell to open explorer
            const shell = await import('@tauri-apps/plugin-shell');
            await shell.open(dir);
        } catch (error) {
            logger.error('Settings', 'Failed to open folder', {}, error instanceof Error ? error : undefined);
            toast.error('Error', 'No se pudo abrir la carpeta');
        }
    };

    const handleSelectDiagnosticPath = async () => {
        try {
            const tauriFs = await import('../../utils/tauri_fs');
            const path = await tauriFs.pickFolder();

            if (path) {
                setDiagnosticPath(path);
                await handleSaveSettings({ diagnosticExportPath: path });
            }
        } catch (error) {
            toast.error('Error', 'No se pudo seleccionar la carpeta');
        }
    };

    const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: 'security', label: 'Seguridad', icon: <Shield size={16} /> },
        { id: 'diagnostic', label: 'Diagnóstico', icon: <FileSearch size={16} /> },
        { id: 'qa', label: 'QA', icon: <FlaskConical size={16} /> }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100 text-slate-600 p-2 rounded-lg">
                            <Settings size={20} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">Ajustes</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {isLoading ? (
                        <div className="text-center text-slate-500 py-8">Cargando...</div>
                    ) : (
                        <>
                            {/* Security Tab */}
                            {activeTab === 'security' && (
                                <div className="space-y-6">
                                    {/* Encryption Disabled Notice */}
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-slate-700">Estado de Cifrado</span>
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-slate-200 text-slate-600">
                                                DESHABILITADO
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            El sistema de encriptación ha sido removido de esta versión.
                                            Los proyectos se guardan en formato JSON sin cifrar.
                                        </p>
                                    </div>

                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-sm text-blue-800">
                                            <strong>Nota:</strong> Si necesita proteger sus archivos, utilice las herramientas de cifrado de su sistema operativo
                                            (BitLocker en Windows o FileVault en macOS).
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Diagnostic Tab */}
                            {activeTab === 'diagnostic' && (
                                <div className="space-y-6">
                                    {/* Export Path */}
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700">
                                            Carpeta de Exportación
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={diagnosticPath}
                                                readOnly
                                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm text-slate-600"
                                            />
                                            {isTauri() && (
                                                <button
                                                    onClick={handleSelectDiagnosticPath}
                                                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                                                >
                                                    <FolderOpen size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Plant Assets Integration Note */}
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-sm text-blue-800 font-medium mb-1">
                                            📦 Catálogo de Planta
                                        </p>
                                        <p className="text-xs text-blue-600">
                                            Las máquinas y sectores ahora se guardan junto con los proyectos.
                                            Usá el indicador de modo en el header (💻/📡) para configurar la ruta
                                            y sincronizar datos entre local y servidor.
                                        </p>
                                    </div>

                                    {/* Export Button */}
                                    <button
                                        onClick={handleExportDiagnostic}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                    >
                                        <Download size={18} /> Exportar Diagnóstico
                                    </button>

                                    {/* Last Export Path */}
                                    {lastExportPath && (
                                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-medium text-green-700 flex items-center gap-1">
                                                        <Check size={14} /> Exportado
                                                    </div>
                                                    <div className="text-xs text-green-600 mt-1 break-all">
                                                        {lastExportPath}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleOpenFolder}
                                                    className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center gap-1 text-sm"
                                                >
                                                    <ExternalLink size={14} /> Abrir
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <p className="text-xs text-slate-500">
                                        El diagnóstico incluye logs del sistema y metadata. No incluye datos sensibles ni contenido de proyectos.
                                    </p>
                                </div>
                            )}

                            {/* QA Tab */}
                            {activeTab === 'qa' && (
                                <div className="space-y-6">
                                    {/* QA Toggle */}
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-slate-700">Habilitar Panel QA</div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Muestra el botón 🧪 en el header para pruebas
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleSaveSettings({ qaEnabled: !settings?.qaEnabled })}
                                                className={`p-1 rounded-full transition-colors ${settings?.qaEnabled ? 'text-blue-600' : 'text-slate-400'
                                                    }`}
                                            >
                                                {settings?.qaEnabled ? (
                                                    <ToggleRight size={32} />
                                                ) : (
                                                    <ToggleLeft size={32} />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Dev Mode Indicator */}
                                    {isDevMode() && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                                            <strong>Modo Desarrollo:</strong> El panel QA siempre está visible en DEV, independientemente de esta configuración.
                                        </div>
                                    )}

                                    {/* Environment Info */}
                                    <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Entorno</span>
                                            <span className="font-mono text-slate-700">
                                                {isDevMode() ? 'Desarrollo' : 'Producción'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Tauri</span>
                                            <span className={`font-mono ${isTauri() ? 'text-green-600' : 'text-slate-400'}`}>
                                                {isTauri() ? 'TRUE' : 'FALSE'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Panel QA</span>
                                            <span className={`font-mono ${settings?.qaEnabled || isDevMode() ? 'text-green-600' : 'text-slate-400'}`}>
                                                {settings?.qaEnabled || isDevMode() ? 'Visible' : 'Oculto'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SettingsModal;
