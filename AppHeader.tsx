/**
 * AppHeader - Main application header extracted from App.tsx
 * Contains logo, storage indicators, project switcher, undo/redo, save buttons, nav, and sub-nav.
 */
import React from 'react';
import barackLogo from './src/assets/barack_logo.png';
import { Save, LayoutDashboard, ListTodo, BarChart2, FileText, Network, HardDrive, CircleHelp, Gauge, GitBranch, AlertTriangle, History, Settings, RefreshCw, ArrowLeft, Film, Factory, Layers, FolderOutput } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isTauri } from './utils/unified_fs';
import { buildMasterJsonPath, buildPath } from './utils/pathManager';
import { DropdownNav } from './components/navigation/DropdownNav';
import { UndoRedoControls } from './components/ui/UndoRedoControls';
import { ProjectSwitcher } from './components/navigation/ProjectSwitcher';
import { logger } from './utils/logger';
import { toast } from './components/ui/Toast';
import type { Tab } from './hooks/useAppNavigation';
import type { useProjectPersistence } from './hooks/useProjectPersistence';
import type { useSessionLock } from './hooks/useSessionLock';
import type { useUndoRedo } from './hooks/useUndoRedo';
import type { useShortcutHints } from './hooks/useShortcutHints';
import type { useAppModals } from './hooks/useAppModals';
import type { NetworkHealth } from './hooks/useNetworkHealth';
import type { ProjectData } from './types';

interface AppHeaderProps {
    onBackToLanding?: () => void;
    localMediaCount?: number;
    onMediaMigrationClick?: () => void;
    navigation: {
        activeTab: Tab;
        setActiveTab: (tab: Tab) => void;
    };
    persistence: ReturnType<typeof useProjectPersistence>;
    sessionLock: ReturnType<typeof useSessionLock>;
    undoRedo: ReturnType<typeof useUndoRedo>;
    isUndoingRef: React.MutableRefObject<boolean>;
    shortcutHints: ReturnType<typeof useShortcutHints>;
    modals: ReturnType<typeof useAppModals>;
    networkHealth?: NetworkHealth;
    exportFolder?: { openFolder: () => Promise<void>; isOpening: boolean; canOpen: boolean };
}

const NavItem = ({ id, icon: Icon, label, disabled = false, shortcut, activeTab, onNavigate }: {
    id: Tab;
    icon: LucideIcon;
    label: string;
    disabled?: boolean;
    shortcut?: string;
    activeTab: Tab;
    onNavigate: (tab: Tab) => void;
}) => (
    <button
        onClick={() => onNavigate(id)}
        disabled={disabled}
        data-shortcut={shortcut}
        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all duration-200 whitespace-nowrap text-sm font-medium active:scale-95 ${activeTab === id
            ? 'border-blue-600 text-blue-600 bg-blue-50/50'
            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        <Icon size={18} className={`transition-transform duration-200 ${activeTab === id ? 'scale-110' : ''}`} />
        {label}
    </button>
);

export const AppHeader: React.FC<AppHeaderProps> = ({
    onBackToLanding,
    localMediaCount,
    onMediaMigrationClick,
    navigation,
    persistence,
    sessionLock,
    undoRedo,
    isUndoingRef,
    modals,
    networkHealth,
    exportFolder,
}) => {
    const handleCloseProject = modals.handleCloseProject;

    return (
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 print:hidden shadow-sm transition-all">
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex items-center gap-3">
                        {onBackToLanding && (
                            <button
                                onClick={onBackToLanding}
                                className="flex items-center gap-1 text-slate-400 hover:text-slate-700 px-2 py-1.5 rounded hover:bg-slate-100 transition text-xs border-r border-slate-200 pr-3 mr-1"
                                title="Volver al menú principal"
                                aria-label="Volver al menú principal"
                            >
                                <ArrowLeft size={16} />
                                <span className="hidden sm:inline">Inicio</span>
                            </button>
                        )}
                        <button
                            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0"
                            onClick={() => navigation.setActiveTab('dashboard')}
                            aria-label="Ir al Inicio"
                        >
                            <img src={barackLogo} alt="Barack Mercosul" className="h-10 w-auto" />
                            <span className="font-medium text-slate-600 text-sm hidden sm:inline">Tiempos y Balanceos</span>
                        </button>

                        {persistence.data.fileHandle && (() => {
                            const online = networkHealth?.isOnline ?? true;
                            const checking = networkHealth?.isChecking ?? false;
                            if (!online) {
                                return (
                                    <span className="ml-2 sm:ml-4 text-[10px] font-bold bg-red-100 text-red-700 px-1.5 sm:px-2 py-1 rounded-full border border-red-200 flex items-center gap-1 shadow-sm animate-pulse"
                                        title="Sin conexión al servidor. Los cambios se guardan localmente.">
                                        <Network size={10} /><span className="hidden sm:inline">SIN CONEXIÓN</span>
                                    </span>
                                );
                            }
                            if (checking) {
                                return (
                                    <span className="ml-2 sm:ml-4 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 sm:px-2 py-1 rounded-full border border-amber-200 flex items-center gap-1 shadow-sm"
                                        title="Verificando conexión al servidor...">
                                        <RefreshCw size={10} className="animate-spin" /><span className="hidden sm:inline">VERIFICANDO...</span>
                                    </span>
                                );
                            }
                            return (
                                <span className="ml-2 sm:ml-4 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 sm:px-2 py-1 rounded-full border border-emerald-200 flex items-center gap-1 shadow-sm"
                                    title="Conectado al servidor">
                                    <HardDrive size={10} /><span className="hidden sm:inline">CONECTADO</span>
                                </span>
                            );
                        })()}


                        {/* H-02 Fix: READ-ONLY Mode Banner */}
                        {sessionLock.isReadOnly && (
                            <span className="ml-2 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 sm:px-2 py-1 rounded-full border border-amber-200 flex items-center gap-1 shadow-sm animate-pulse">
                                <AlertTriangle size={10} /><span className="hidden sm:inline">SOLO LECTURA ({sessionLock.lockOwner})</span>
                            </span>
                        )}

                        {localMediaCount != null && localMediaCount > 0 && (
                            <button
                                onClick={onMediaMigrationClick}
                                className="ml-2 text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 sm:px-2 py-1 rounded-full border border-orange-200 flex items-center gap-1 shadow-sm hover:bg-orange-200 transition-colors cursor-pointer"
                                title={`${localMediaCount} archivo(s) multimedia en almacenamiento local. Click para migrar al servidor.`}
                            >
                                <Film size={10} /><span className="hidden sm:inline">{localMediaCount} MEDIA LOCAL</span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">

                        <span className={`text-[10px] hidden lg:inline mr-2 font-mono uppercase tracking-wider ${persistence.isDirty ? 'text-orange-500 font-bold' : 'text-slate-400'}`}>
                            {persistence.isDirty
                                ? 'Cambios sin guardar'
                                : persistence.lastSaved ? `Guardado: ${persistence.lastSaved}` : ''}
                        </span>

                        {/* Quick Switch Project Button - replaces old Close button */}
                        {persistence.data.fileHandle && (
                            <ProjectSwitcher
                                currentProjectName={persistence.data.meta?.name || null}
                                currentClient={persistence.data.meta?.client}
                                currentProject={persistence.data.meta?.project}
                                onSwitch={async (studyPath) => {
                                    // studyPath format: "CLIENT/PROJECT/PART"
                                    const [client, project, part] = studyPath.split('/');
                                    const masterPath = buildMasterJsonPath(client, project, part);
                                    const dataPath = buildPath('data', client, project, part);

                                    try {
                                        if (isTauri()) {
                                            const tauriFs = await import('./utils/tauri_fs');
                                            const content = await tauriFs.readTextFile(masterPath);

                                            if (content) {
                                                const projectData = JSON.parse(content);
                                                const fullData = {
                                                    ...projectData,
                                                    fileHandle: masterPath,
                                                    directoryHandle: dataPath
                                                };
                                                persistence.setData(fullData);
                                                undoRedo.resetHistory(fullData);
                                                navigation.setActiveTab('panel');
                                                toast.success('Proyecto Cargado', projectData.meta?.name || part);
                                            }
                                        }
                                    } catch (e) {
                                        logger.error('App', 'Error switching project', {}, e instanceof Error ? e : undefined);
                                        toast.error('Error', 'No se pudo cambiar al proyecto');
                                    }
                                }}
                                onClose={handleCloseProject}
                                onNavigateToDashboard={() => navigation.setActiveTab('dashboard')}
                            />
                        )}

                        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                        {/* History Button (Only in Tauri mode) */}
                        {persistence.data.fileHandle && typeof persistence.data.fileHandle === 'string' && (
                            <button
                                onClick={() => modals.setShowRevisionHistory(true)}
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Historial de Revisiones"
                                aria-label="Historial de Revisiones"
                            >
                                <History size={18} />
                            </button>
                        )}
                        {/* Export Folder Button */}
                        {exportFolder && persistence.data.fileHandle && (
                            <button
                                onClick={exportFolder.openFolder}
                                disabled={!exportFolder.canOpen || exportFolder.isOpening}
                                className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Abrir carpeta de exportacion en Explorador"
                                aria-label="Abrir carpeta de exportacion"
                            >
                                <FolderOutput size={18} />
                            </button>
                        )}
                        {persistence.data.fileHandle && (
                            <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-2">
                                <UndoRedoControls
                                    canUndo={undoRedo.canUndo}
                                    canRedo={undoRedo.canRedo}
                                    undoCount={undoRedo.undoCount}
                                    redoCount={undoRedo.redoCount}
                                    onUndo={() => {
                                        if (undoRedo.canUndo) {
                                            isUndoingRef.current = true;
                                            const { state: prevState, context } = undoRedo.undo();

                                            if (prevState) {
                                                // SMART UNDO: Navigate to context if different
                                                if (context?.tab && context.tab !== navigation.activeTab) {
                                                    navigation.setActiveTab(context.tab as Tab);
                                                    toast.info('Deshacer', `Regresando a ${context.tab.toUpperCase()} para deshacer cambios`);
                                                }
                                                persistence.setData({ ...persistence.data, ...prevState });
                                            }
                                        }
                                    }}
                                    onRedo={() => {
                                        if (undoRedo.canRedo) {
                                            isUndoingRef.current = true;
                                            const { state: nextState, context } = undoRedo.redo();

                                            if (nextState) {
                                                // SMART REDO: Navigate to context
                                                if (context?.tab && context.tab !== navigation.activeTab) {
                                                    navigation.setActiveTab(context.tab as Tab);
                                                    toast.info('Rehacer', `Regresando a ${context.tab.toUpperCase()} para rehacer cambios`);
                                                }
                                                persistence.setData({ ...persistence.data, ...nextState });
                                            }
                                        }
                                    }}
                                />
                            </div>
                        )}

                        {/* P4: HELP */}
                        <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-2">
                            <button
                                onClick={() => modals.setShowShortcutsHelp(true)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-95"
                                title="Ayuda y Atajos (F1)"
                                aria-label="Ayuda y Atajos de teclado"
                            >
                                <CircleHelp size={20} />
                            </button>
                        </div>

                        {/* Dual Save System */}
                        {persistence.data.fileHandle && (
                            <div className="flex items-center gap-1">
                                {/* Quick Save Button - Ctrl+S */}
                                <div className="relative">
                                    <button
                                        onClick={persistence.handleQuickSave}
                                        disabled={persistence.isSaving || sessionLock.isReadOnly}
                                        data-shortcut="Ctrl+S"
                                        className={`p-2 rounded-lg transition-all ${sessionLock.isReadOnly
                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                            : 'bg-slate-600 text-white hover:bg-slate-700 active:scale-95'
                                            }`}
                                        title={persistence.isDirty ? "Cambios sin guardar - Guardar rápido (Ctrl+S)" : "Guardar rápido (Ctrl+S) - sin crear revisión"}
                                        aria-label="Guardar rápido"
                                    >
                                        <Save size={18} />
                                    </button>
                                    {persistence.isDirty && !sessionLock.isReadOnly && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white shadow-sm animate-pulse" />
                                    )}
                                </div>

                                {/* Formal Save Button - Nueva Revisión */}
                                <button
                                    onClick={persistence.handleSave}
                                    disabled={persistence.isSaving || sessionLock.isReadOnly}
                                    className={`px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all ${sessionLock.isReadOnly
                                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700 btn-glow active:scale-95'
                                        }`}
                                    title={sessionLock.isReadOnly ? `Bloqueado por ${sessionLock.lockOwner}` : 'Nueva Revisión (backup + versión)'}
                                >
                                    {persistence.isSaving ? (
                                        <>
                                            <RefreshCw size={16} className="animate-spin" />
                                            <span className="hidden sm:inline">Guardando...</span>
                                        </>
                                    ) : sessionLock.isReadOnly ? (
                                        <><span className="hidden sm:inline">Bloqueado</span><span className="sm:hidden">🔒</span></>
                                    ) : (
                                        <><Save size={16} className="sm:hidden" /><span className="hidden sm:inline">Nueva Revisión</span></>
                                    )}
                                </button>
                            </div>
                        )}

                    </div>
                </div>

                <nav className="flex flex-wrap -mb-px gap-1" aria-label="Navegación principal">
                    <NavItem id="dashboard" icon={LayoutDashboard} label="Inicio" shortcut="Alt+H" activeTab={navigation.activeTab} onNavigate={navigation.setActiveTab} />
                    {(persistence.data.fileHandle || persistence.data.meta?.name) && (
                        <>
                            {/* P3: Dropdown Datos */}
                            <DropdownNav
                                label="Datos"
                                icon={LayoutDashboard}
                                items={[
                                    { id: 'plant', label: 'Configuración Planta', icon: Factory },
                                    { id: 'panel', label: 'Panel Control', icon: LayoutDashboard },
                                    { id: 'tasks', label: 'Tareas', icon: ListTodo },
                                    { id: 'oee', label: 'Validación OEE', icon: Gauge },
                                    { id: 'graph', label: 'Mapa Procesos', icon: Network },
                                ]}
                                activeTab={navigation.activeTab}
                                onNavigate={navigation.setActiveTab}
                            />
                            {/* P3: Dropdown Análisis */}
                            <DropdownNav
                                label="Análisis"
                                icon={BarChart2}
                                items={[
                                    { id: 'balance', label: 'Balanceo', icon: BarChart2 },
                                    { id: 'mix', label: 'Mix Multi-Modelo', icon: Layers },
                                    { id: 'vsm', label: 'Simulador de Flujo', icon: GitBranch },
                                    { id: 'summary', label: 'Resumen Ejecutivo', icon: FileText },
                                ]}
                                activeTab={navigation.activeTab}
                                onNavigate={navigation.setActiveTab}
                            />

                        </>
                    )}
                    {/* Help Tab - Always visible */}
                    <div className="ml-auto border-l border-slate-200 pl-2">
                        <button
                            onClick={() => navigation.setActiveTab('help')}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap text-sm font-medium ${navigation.activeTab === 'help'
                                ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50'
                                : 'border-transparent text-slate-400 hover:text-indigo-600 hover:bg-slate-50'
                                }`}
                        >
                            <CircleHelp size={18} />
                            <span className="hidden sm:inline">Ayuda</span>
                        </button>
                    </div>
                </nav>
            </div>

        </header>
    );
};
