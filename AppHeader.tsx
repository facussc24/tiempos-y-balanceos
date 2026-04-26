/**
 * AppHeader - Main application header extracted from App.tsx
 * Contains logo, status chip, project breadcrumb, undo/redo, save, nav, and sub-nav.
 *
 * Rediseno UI 2026-04-26 (Etapa 2/3):
 * - Status chip unificado (conexion + dirty + lock) reemplaza 4 badges separados
 * - ProjectSwitcher se renderiza al frente como breadcrumb del proyecto
 * - Save es el unico primario azul con atajo Ctrl+S visible
 * - "Nueva Revision" se movio a un menu overflow accesible por boton vertical-dots
 * - Sub-nav aplanada: 5 tabs visibles + dropdown "Mas" con el resto
 */
import React, { useState, useRef, useEffect } from 'react';
import barackLogo from './src/assets/barack_logo.png';
import { Save, LayoutDashboard, ListTodo, BarChart2, FileText, Network, CircleHelp, Gauge, GitBranch, AlertTriangle, History, RefreshCw, ArrowLeft, Factory, Layers, FolderOutput, MoreVertical, GitCommit } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DropdownNav } from './components/navigation/DropdownNav';
import { UndoRedoControls } from './components/ui/UndoRedoControls';
import { ProjectSwitcher } from './components/navigation/ProjectSwitcher';
import { toast } from './components/ui/Toast';
import type { Tab } from './hooks/useAppNavigation';
import type { useProjectPersistence } from './hooks/useProjectPersistence';
import type { useSessionLock } from './hooks/useSessionLock';
import type { useUndoRedo } from './hooks/useUndoRedo';
import type { useShortcutHints } from './hooks/useShortcutHints';
import type { useAppModals } from './hooks/useAppModals';
import type { NetworkHealth } from './hooks/useNetworkHealth';

interface AppHeaderProps {
    onBackToLanding?: () => void;
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
        className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all duration-200 whitespace-nowrap text-sm font-medium active:scale-95 ${activeTab === id
            ? 'border-slate-900 text-slate-900'
            : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        <Icon size={16} className={`transition-transform duration-200 ${activeTab === id ? 'scale-110' : ''}`} />
        {label}
    </button>
);

/**
 * Status chip unificado — reemplaza 4 badges separados (CONECTADO/SIN_CONEXION/VERIFICANDO/SOLO_LECTURA/Sin_guardar).
 * Solo se muestra cuando hay algo importante que reportar. CONECTADO+limpio = no chip (silencio = todo OK).
 *
 * Prioridad (de mas critico a menos):
 * 1. SIN CONEXION (rojo, animate-pulse)
 * 2. SOLO LECTURA (ambar, animate-pulse) — bloqueo del usuario
 * 3. VERIFICANDO (ambar, sin pulse)
 * 4. Sin guardar (ambar, sin pulse)
 * 5. (silencio) — conectado + sincronizado + editable = no chip
 */
const StatusChip: React.FC<{
    online: boolean;
    checking: boolean;
    isDirty: boolean;
    isReadOnly: boolean;
    lockOwner?: string | null;
    lastSaved?: string | null;
}> = ({ online, checking, isDirty, isReadOnly, lockOwner, lastSaved }) => {
    if (!online) {
        return (
            <span
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md animate-pulse"
                title="Sin conexion al servidor. Los cambios se guardan localmente."
            >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Sin conexion
            </span>
        );
    }
    if (isReadOnly) {
        return (
            <span
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md animate-pulse"
                title={lockOwner ? `Bloqueado por ${lockOwner}` : 'Documento en solo lectura'}
            >
                <AlertTriangle size={11} />
                Solo lectura{lockOwner ? ` (${lockOwner})` : ''}
            </span>
        );
    }
    if (checking) {
        return (
            <span
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md"
                title="Verificando conexion al servidor..."
            >
                <RefreshCw size={11} className="animate-spin" />
                Verificando
            </span>
        );
    }
    if (isDirty) {
        return (
            <span
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md"
                title="Hay cambios sin guardar. Ctrl+S para guardar rapido."
            >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Sin guardar
            </span>
        );
    }
    if (lastSaved) {
        return (
            <span
                className="inline-flex items-center gap-1.5 text-[10px] text-slate-400 hidden lg:inline-flex"
                title={`Ultimo guardado: ${lastSaved}`}
            >
                Guardado · {lastSaved}
            </span>
        );
    }
    return null;
};

export const AppHeader: React.FC<AppHeaderProps> = ({
    onBackToLanding,
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
    const hasProject = !!persistence.data.fileHandle;
    const online = networkHealth?.isOnline ?? true;
    const checking = networkHealth?.isChecking ?? false;

    // Overflow menu state
    const [overflowOpen, setOverflowOpen] = useState(false);
    const overflowRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!overflowOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
                setOverflowOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [overflowOpen]);

    return (
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-header print:hidden transition-all">
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                {/* ===== Fila 1: contexto + acciones primarias ===== */}
                <div className="flex justify-between h-14 items-center">
                    <div className="flex items-center gap-3 min-w-0">
                        {onBackToLanding && (
                            <button
                                onClick={onBackToLanding}
                                className="flex items-center gap-1 text-slate-400 hover:text-slate-700 px-1.5 py-1 rounded hover:bg-slate-100 transition text-xs"
                                title="Volver al menu principal"
                                aria-label="Volver al menu principal"
                            >
                                <ArrowLeft size={16} />
                                <span className="hidden sm:inline">Inicio</span>
                            </button>
                        )}
                        <div className="h-5 w-px bg-slate-200" />
                        <button
                            className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0 flex-shrink-0"
                            onClick={() => navigation.setActiveTab('dashboard')}
                            aria-label="Ir al Inicio"
                        >
                            <img src={barackLogo} alt="Barack Mercosul" className="h-8 w-auto" />
                            {!hasProject && (
                                <span className="font-medium text-slate-700 text-sm hidden sm:inline">
                                    Tiempos y Balanceos
                                </span>
                            )}
                        </button>

                        {/* Breadcrumb del proyecto al frente — se renderiza solo cuando hay proyecto cargado */}
                        {hasProject && (
                            <ProjectSwitcher
                                currentProjectName={persistence.data.meta?.name || null}
                                currentClient={persistence.data.meta?.client}
                                currentProject={persistence.data.meta?.project}
                                onSwitch={async (_studyPath) => {
                                    toast.info('Cambio de proyecto', 'Usa el Dashboard para abrir otro estudio');
                                }}
                                onClose={handleCloseProject}
                                onNavigateToDashboard={() => navigation.setActiveTab('dashboard')}
                            />
                        )}

                        {/* Status chip unificado */}
                        {hasProject && (
                            <StatusChip
                                online={online}
                                checking={checking}
                                isDirty={persistence.isDirty}
                                isReadOnly={sessionLock.isReadOnly}
                                lockOwner={sessionLock.lockOwner}
                                lastSaved={persistence.lastSaved}
                            />
                        )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2">
                        {/* History (solo en modo Tauri) */}
                        {hasProject && typeof persistence.data.fileHandle === 'string' && (
                            <button
                                onClick={() => modals.setShowRevisionHistory(true)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                                title="Historial de Revisiones"
                                aria-label="Historial de Revisiones"
                            >
                                <History size={16} />
                            </button>
                        )}
                        {/* Export Folder */}
                        {exportFolder && hasProject && (
                            <button
                                onClick={exportFolder.openFolder}
                                disabled={!exportFolder.canOpen || exportFolder.isOpening}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Abrir carpeta de exportacion en Explorador"
                                aria-label="Abrir carpeta de exportacion"
                            >
                                <FolderOutput size={16} />
                            </button>
                        )}

                        {/* Undo/Redo */}
                        {hasProject && (
                            <div className="flex items-center pr-1 border-r border-slate-200 mr-1">
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

                        {/* Help */}
                        <button
                            onClick={() => modals.setShowShortcutsHelp(true)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            title="Ayuda y Atajos (F1)"
                            aria-label="Ayuda y Atajos de teclado"
                        >
                            <CircleHelp size={16} />
                        </button>

                        {/* Save (unico primario con atajo visible) */}
                        {hasProject && (
                            <button
                                onClick={persistence.handleQuickSave}
                                disabled={persistence.isSaving || sessionLock.isReadOnly}
                                data-shortcut="Ctrl+S"
                                className={`px-3 py-1.5 rounded-md inline-flex items-center gap-2 text-xs font-medium transition-all ${sessionLock.isReadOnly
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
                                    }`}
                                title={persistence.isDirty ? 'Cambios sin guardar — Guardar (Ctrl+S)' : 'Guardar (Ctrl+S)'}
                                aria-label="Guardar"
                            >
                                {persistence.isSaving ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span className="hidden sm:inline">Guardando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} />
                                        <span className="hidden sm:inline">Guardar</span>
                                        <span className="hidden md:inline text-[10px] text-slate-400 font-mono ml-1">Ctrl+S</span>
                                    </>
                                )}
                            </button>
                        )}

                        {/* Overflow menu — Nueva Revision y otras acciones secundarias */}
                        {hasProject && (
                            <div className="relative" ref={overflowRef}>
                                <button
                                    onClick={() => setOverflowOpen(o => !o)}
                                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                                    title="Mas acciones"
                                    aria-label="Mas acciones"
                                    aria-haspopup="menu"
                                    aria-expanded={overflowOpen}
                                >
                                    <MoreVertical size={16} />
                                </button>
                                {overflowOpen && (
                                    <div
                                        role="menu"
                                        className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-50"
                                    >
                                        <button
                                            role="menuitem"
                                            onClick={() => {
                                                setOverflowOpen(false);
                                                if (!sessionLock.isReadOnly) persistence.handleSave();
                                            }}
                                            disabled={persistence.isSaving || sessionLock.isReadOnly}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                            title={sessionLock.isReadOnly ? `Bloqueado por ${sessionLock.lockOwner}` : 'Crea backup + nueva version'}
                                        >
                                            <GitCommit size={14} className="text-slate-500" />
                                            <span>Nueva Revision</span>
                                        </button>
                                        {typeof persistence.data.fileHandle === 'string' && (
                                            <button
                                                role="menuitem"
                                                onClick={() => {
                                                    setOverflowOpen(false);
                                                    modals.setShowRevisionHistory(true);
                                                }}
                                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                            >
                                                <History size={14} className="text-slate-500" />
                                                <span>Historial de Revisiones</span>
                                            </button>
                                        )}
                                        <div className="my-1 border-t border-slate-100" />
                                        <button
                                            role="menuitem"
                                            onClick={() => {
                                                setOverflowOpen(false);
                                                modals.setShowShortcutsHelp(true);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                        >
                                            <CircleHelp size={14} className="text-slate-500" />
                                            <span>Atajos de teclado</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ===== Fila 2: Sub-nav (tabs planas + Mas) ===== */}
                <nav className="flex items-center -mb-px gap-0.5" aria-label="Navegacion principal">
                    <NavItem id="dashboard" icon={LayoutDashboard} label="Inicio" shortcut="Alt+H" activeTab={navigation.activeTab} onNavigate={navigation.setActiveTab} />
                    {(persistence.data.fileHandle || persistence.data.meta?.name) && (
                        <>
                            {/* Tabs planas — los 4 destinos mas usados */}
                            <NavItem id="panel" icon={LayoutDashboard} label="Panel" activeTab={navigation.activeTab} onNavigate={navigation.setActiveTab} />
                            <NavItem id="oee" icon={Gauge} label="Validacion OEE" activeTab={navigation.activeTab} onNavigate={navigation.setActiveTab} />
                            <NavItem id="balance" icon={BarChart2} label="Balanceo" activeTab={navigation.activeTab} onNavigate={navigation.setActiveTab} />
                            <NavItem id="summary" icon={FileText} label="Resumen" activeTab={navigation.activeTab} onNavigate={navigation.setActiveTab} />

                            {/* Mas — agrupa el resto en un dropdown */}
                            <DropdownNav
                                label="Mas"
                                icon={Layers}
                                items={[
                                    { id: 'plant', label: 'Configuracion Planta', icon: Factory },
                                    { id: 'tasks', label: 'Tareas', icon: ListTodo },
                                    { id: 'graph', label: 'Mapa Procesos', icon: Network },
                                    { id: 'mix', label: 'Mix Multi-Modelo', icon: Layers },
                                    { id: 'vsm', label: 'Simulador de Flujo', icon: GitBranch },
                                ]}
                                activeTab={navigation.activeTab}
                                onNavigate={navigation.setActiveTab}
                            />
                        </>
                    )}
                    {/* Help al final */}
                    <div className="ml-auto">
                        <button
                            onClick={() => navigation.setActiveTab('help')}
                            title="Centro de Ayuda"
                            aria-label="Centro de Ayuda"
                            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all whitespace-nowrap text-sm font-medium ${navigation.activeTab === 'help'
                                ? 'border-slate-900 text-slate-900'
                                : 'border-transparent text-slate-400 hover:text-slate-900 hover:border-slate-200'
                                }`}
                        >
                            <CircleHelp size={16} />
                            <span className="hidden sm:inline">Ayuda</span>
                        </button>
                    </div>
                </nav>
            </div>
        </header>
    );
};
