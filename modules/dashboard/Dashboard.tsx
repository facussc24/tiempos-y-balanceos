/**
 * Dashboard - V4.1 Home Screen with Project Browser
 * 
 * Central hub for managing studies with:
 * - Quick stats
 * - Client/Project/Part filters
 * - Live project browser (scan from disk)
 * - New study + Open existing buttons
 * 
 * @module Dashboard
 * @version 4.1.1
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Plus, FileText, Users, FolderOpen, Search,
    TrendingUp, Sparkles, Filter, ChevronDown,
    RefreshCw, Loader2, ExternalLink, Layers, Settings, Trash2
} from 'lucide-react';
import { HeroSection } from '../../components/landing/HeroSection';
import { StatCard } from '../../components/landing/StatCard';
import { logger } from '../../utils/logger';
import { toast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/modals/ConfirmModal';

interface Study {
    name: string;
    client: string;
    project: string;
    part: string;
    path: string;
    lastModified?: string;
}

interface DashboardProps {
    onNewStudy: () => void;
    onOpenProject: (path: string) => void;
    onNavigateToMix?: (products?: Array<{ path: string; demand: number }>) => void;
    onConfigPlant?: () => void;  // P3: Acceso a Planta desde Dashboard
    onDeleteStudy?: (path: string) => Promise<void>;  // V5: Eliminar estudio
    onDeleteProject?: (client: string, project: string) => Promise<void>;
    onDeleteClient?: (client: string) => Promise<void>;
    // Functions to scan real file system
    listClientsFunc?: () => Promise<string[]>;
    listProjectsFunc?: (client: string) => Promise<string[]>;
    listPartsFunc?: (client: string, project: string) => Promise<string[]>;
    buildPathFunc?: (client: string, project: string, part: string) => string;
    storageReady?: boolean;  // Wait for storage initialization before loading
    storageVersion?: number; // Increment to force data reload after config change
}

export const Dashboard: React.FC<DashboardProps> = ({
    onNewStudy,
    onOpenProject,
    onNavigateToMix,
    onConfigPlant,
    onDeleteStudy,
    onDeleteProject,
    onDeleteClient,
    listClientsFunc,
    listProjectsFunc,
    listPartsFunc,
    buildPathFunc,
    storageReady = true,  // Default to true for backwards compatibility
    storageVersion = 0    // Reload trigger
}) => {
    // State
    // FIX: Use ref counter to prevent premature spinner hide when multiple
    // async loads overlap (loadClients, loadProjects, loadParts share this flag)
    const loadingCountRef = useRef(0);
    const [isLoading, setIsLoading] = useState(false);
    const [clients, setClients] = useState<string[]>([]);
    const [projects, setProjects] = useState<string[]>([]);
    const [parts, setParts] = useState<string[]>([]);
    const [studies, setStudies] = useState<Study[]>([]);

    // Filters - FIX: Iniciar vacío para evitar parpadeo de valores inválidos
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [filtersValidated, setFiltersValidated] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Multi-selection for Mix
    const [selectedForMix, setSelectedForMix] = useState<Set<string>>(new Set());

    // Confirmation modal state
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{
        type: 'study' | 'project' | 'client';
        path?: string;
        name: string;
        client?: string;
        project?: string;
    } | null>(null);

    // Estado para confirmar limpieza de selección Mix
    const [showClearSelectionConfirm, setShowClearSelectionConfirm] = useState(false);
    const [pendingFilterChange, setPendingFilterChange] = useState<{
        type: 'client' | 'project' | 'clear';
        value: string;
    } | null>(null);

    // MEJORA 3: Estado para prevenir doble-click en "Crear Mix"
    const [isCreatingMix, setIsCreatingMix] = useState(false);

    // Load clients when storage is ready or version changes
    useEffect(() => {
        if (storageReady) {
            loadClients();
        }
    }, [storageReady, storageVersion, listClientsFunc]);

    // Persist filter selections to localStorage for UX continuity
    // FIX: Solo persistir DESPUÉS de validar para evitar guardar valores vacíos iniciales
    useEffect(() => {
        if (filtersValidated) {
            try {
                localStorage.setItem('dashboard_selectedClient', selectedClient);
                localStorage.setItem('dashboard_selectedProject', selectedProject);
            } catch { /* FIX: non-critical persistence */ }
        }
    }, [selectedClient, selectedProject, filtersValidated]);

    // UX Mejora #3: Persist Mix selection to sessionStorage
    // Using sessionStorage (not localStorage) because selection is temporary per session
    useEffect(() => {
        try {
            if (selectedForMix.size > 0) {
                sessionStorage.setItem('dashboard_mixSelection', JSON.stringify(Array.from(selectedForMix)));
            } else {
                sessionStorage.removeItem('dashboard_mixSelection');
            }
        } catch { /* FIX: non-critical persistence */ }
    }, [selectedForMix]);

    // UX Mejora #3: Restore Mix selection on mount after filters are validated
    useEffect(() => {
        if (filtersValidated) {
            try {
                const saved = sessionStorage.getItem('dashboard_mixSelection');
                if (saved) {
                    try {
                        const paths = JSON.parse(saved) as string[];
                        setSelectedForMix(new Set(paths));
                    } catch {
                        sessionStorage.removeItem('dashboard_mixSelection');
                    }
                }
            } catch { /* FIX: sessionStorage inaccessible */ }
        }
    }, [filtersValidated]);

    // FIX: Cargar filtros de localStorage DESPUÉS de validar contra clientes reales
    // Esto evita el parpadeo de un cliente que ya no existe
    useEffect(() => {
        if (clients.length > 0 && !filtersValidated) {
            let savedClient = '';
            try { savedClient = localStorage.getItem('dashboard_selectedClient') || ''; } catch { /* FIX */ }

            if (savedClient && clients.includes(savedClient)) {
                setSelectedClient(savedClient);
            } else if (savedClient) {
                try { localStorage.removeItem('dashboard_selectedClient'); localStorage.removeItem('dashboard_selectedProject'); } catch { /* FIX */ }
            }
            setFiltersValidated(true);
        }
    }, [clients, filtersValidated]);

    // FIX: Cargar proyecto guardado de localStorage después de validar
    useEffect(() => {
        if (filtersValidated && projects.length > 0 && !selectedProject) {
            let savedProject = '';
            try { savedProject = localStorage.getItem('dashboard_selectedProject') || ''; } catch { /* FIX */ }
            if (savedProject && projects.includes(savedProject)) {
                setSelectedProject(savedProject);
            } else if (savedProject) {
                try { localStorage.removeItem('dashboard_selectedProject'); } catch { /* FIX */ }
            }
        }
    }, [projects, filtersValidated, selectedProject]);

    // Load projects when client changes
    useEffect(() => {
        if (selectedClient && listProjectsFunc) {
            loadProjects(selectedClient);
        } else {
            setProjects([]);
            setSelectedProject('');
        }
    }, [selectedClient, listProjectsFunc]);

    // Load parts when project changes
    useEffect(() => {
        if (selectedClient && selectedProject && listPartsFunc) {
            loadParts(selectedClient, selectedProject);
        } else {
            setParts([]);
        }
    }, [selectedClient, selectedProject, listPartsFunc]);

    // Build studies list from parts
    useEffect(() => {
        if (parts.length > 0 && selectedClient && selectedProject) {
            const newStudies: Study[] = parts.map(part => ({
                name: part,
                client: selectedClient,
                project: selectedProject,
                part: part,
                path: buildPathFunc ? buildPathFunc(selectedClient, selectedProject, part) : ''
            }));
            setStudies(newStudies);
        } else if (selectedClient && !selectedProject) {
            // Show all projects for client
            setStudies([]);
        } else {
            setStudies([]);
        }
    }, [parts, selectedClient, selectedProject]);

    // FIX: Helpers to manage shared loading counter — spinner stays visible
    // until ALL concurrent async loads finish, preventing premature hide.
    const startLoading = () => {
        loadingCountRef.current++;
        setIsLoading(true);
    };
    const stopLoading = () => {
        loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);
        if (loadingCountRef.current === 0) setIsLoading(false);
    };

    const loadClients = async () => {
        if (!listClientsFunc) return;
        startLoading();
        try {
            const result = await listClientsFunc();
            setClients(result);
        } catch (e) {
            logger.error('Dashboard', 'Error loading clients', { error: String(e) });
            toast.error('Error al cargar clientes', 'Verifica tu conexión e intenta de nuevo');
            setClients([]);
        } finally {
            stopLoading();
        }
    };

    const loadProjects = async (client: string) => {
        if (!listProjectsFunc) return;
        startLoading();
        try {
            const result = await listProjectsFunc(client);
            setProjects(result);
        } catch (e) {
            logger.error('Dashboard', 'Error loading projects', { error: String(e) });
            toast.error('Error al cargar proyectos', 'Verifica tu conexión e intenta de nuevo');
            setProjects([]);
        } finally {
            stopLoading();
        }
    };

    const loadParts = async (client: string, project: string) => {
        if (!listPartsFunc) return;
        startLoading();
        try {
            const result = await listPartsFunc(client, project);
            setParts(result);
        } catch (e) {
            logger.error('Dashboard', 'Error loading parts', { error: String(e) });
            toast.error('Error al cargar piezas', 'Verifica tu conexión e intenta de nuevo');
            setParts([]);
        } finally {
            stopLoading();
        }
    };

    // Handler para cambio de cliente con confirmación
    const handleClientChange = (newClient: string) => {
        if (selectedForMix.size > 0 && newClient !== selectedClient) {
            setPendingFilterChange({ type: 'client', value: newClient });
            setShowClearSelectionConfirm(true);
        } else {
            executeClientChange(newClient);
        }
    };

    const executeClientChange = (client: string) => {
        setSelectedClient(client);
        setSelectedProject('');  // FIX: Reset project when client changes to avoid stale filter
        setParts([]);
        setStudies([]);
        setSelectedForMix(new Set());
    };

    // Handler para cambio de proyecto con confirmación
    const handleProjectChange = (newProject: string) => {
        if (selectedForMix.size > 0 && newProject !== selectedProject) {
            setPendingFilterChange({ type: 'project', value: newProject });
            setShowClearSelectionConfirm(true);
        } else {
            executeProjectChange(newProject);
        }
    };

    const executeProjectChange = (project: string) => {
        setSelectedProject(project);
        setSelectedForMix(new Set());
    };

    const clearFilters = () => {
        if (selectedForMix.size > 0) {
            setPendingFilterChange({ type: 'clear', value: '' });
            setShowClearSelectionConfirm(true);
            return;
        }
        executeClearFilters();
    };

    const executeClearFilters = () => {
        setSelectedClient('');
        setSelectedProject('');
        setSearchQuery('');
        setParts([]);
        setStudies([]);
        setSelectedForMix(new Set());
        // Also clear localStorage to ensure fresh start
        try { localStorage.removeItem('dashboard_selectedClient'); localStorage.removeItem('dashboard_selectedProject'); } catch { /* FIX */ }
    };

    // Handlers para confirmar/cancelar limpieza de selección
    const confirmClearSelection = () => {
        if (!pendingFilterChange) return;

        if (pendingFilterChange.type === 'client') {
            executeClientChange(pendingFilterChange.value);
        } else if (pendingFilterChange.type === 'project') {
            executeProjectChange(pendingFilterChange.value);
        } else {
            executeClearFilters();
        }

        setShowClearSelectionConfirm(false);
        setPendingFilterChange(null);
    };

    const cancelClearSelection = useCallback(() => {
        setShowClearSelectionConfirm(false);
        setPendingFilterChange(null);
    }, []);

    // Toggle selection for Mix
    const toggleMixSelection = useCallback((studyPath: string) => {
        setSelectedForMix(prev => {
            const newSet = new Set(prev);
            if (newSet.has(studyPath)) {
                newSet.delete(studyPath);
            } else {
                newSet.add(studyPath);
            }
            return newSet;
        });
    }, []);

    // V5: Request delete confirmation (opens modal)
    const requestDeleteStudy = (path: string, name: string) => {
        setPendingDelete({ type: 'study', path, name });
        setShowConfirmModal(true);
    };

    const requestDeleteProject = (client: string, project: string) => {
        setPendingDelete({ type: 'project', name: project, client, project });
        setShowConfirmModal(true);
    };

    const requestDeleteClient = (client: string) => {
        setPendingDelete({ type: 'client', name: client, client });
        setShowConfirmModal(true);
    };

    // Execute confirmed delete
    const executeConfirmedDelete = async () => {
        if (!pendingDelete) return;

        setIsDeleting(true);
        try {
            if (pendingDelete.type === 'study' && pendingDelete.path) {
                await onDeleteStudy?.(pendingDelete.path);
                if (selectedClient && selectedProject) {
                    loadParts(selectedClient, selectedProject);
                }
                toast.success('Estudio Eliminado', `"${pendingDelete.name}" fue eliminado correctamente.`);
            } else if (pendingDelete.type === 'project' && pendingDelete.client && pendingDelete.project) {
                await onDeleteProject?.(pendingDelete.client, pendingDelete.project);
                if (listProjectsFunc) {
                    const result = await listProjectsFunc(pendingDelete.client);
                    setProjects(result);
                    if (pendingDelete.project === selectedProject) {
                        setSelectedProject('');
                    }
                }
                toast.success('Proyecto Eliminado', `"${pendingDelete.name}" y todo su contenido fue eliminado.`);
            } else if (pendingDelete.type === 'client' && pendingDelete.client) {
                await onDeleteClient?.(pendingDelete.client);
                if (listClientsFunc) {
                    const result = await listClientsFunc();
                    setClients(result);
                    if (pendingDelete.client === selectedClient) {
                        setSelectedClient('');
                        setSelectedProject('');
                    }
                }
                toast.success('Cliente Eliminado', `"${pendingDelete.name}" y todos sus proyectos fueron eliminados.`);
            }
        } catch (e: unknown) {
            logger.error('Dashboard', `Error deleting ${pendingDelete.type}`, { error: String(e) });
            toast.error(`Error al Eliminar`, e instanceof Error ? e.message : String(e));
        } finally {
            setIsDeleting(false);
            setShowConfirmModal(false);
            setPendingDelete(null);
        }
    };

    const cancelDelete = useCallback(() => {
        setShowConfirmModal(false);
        setPendingDelete(null);
    }, []);

    // Filter studies by search
    const filteredStudies = studies.filter(s =>
        searchQuery === '' ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.project.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Stats
    const stats = {
        totalStudies: studies.length,
        clients: clients.length,
        projects: projects.length,
        parts: parts.length
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header with New Study Button */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--gray-800)] flex items-center gap-2">
                        <Sparkles size={24} className="text-blue-500" />
                        Gestión de Estudios
                    </h1>
                    <p className="text-[var(--gray-500)] text-sm mt-1">
                        Selecciona Cliente → Proyecto → Pieza para ver estudios existentes
                    </p>
                </div>
                {/* Toolbar Derecha */}
                <div className="flex items-center gap-4">
                    {/* Grupo Utilidades - Rediseñado */}
                    {(onConfigPlant || onNavigateToMix) && (
                        <div className="flex items-center gap-1.5">
                            {onConfigPlant && (
                                <button
                                    onClick={onConfigPlant}
                                    className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 rounded-lg transition-all border border-slate-200 hover:border-slate-300 hover:shadow-sm"
                                    title="Configuración de Planta"
                                >
                                    <Settings size={16} className="opacity-70" />
                                    <span className="hidden sm:inline text-sm font-medium">Planta</span>
                                </button>
                            )}
                            {onNavigateToMix && (
                                <button
                                    onClick={() => onNavigateToMix?.()}
                                    className="flex items-center gap-2 px-3 py-2 text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 rounded-lg transition-all border border-indigo-200/50 hover:border-indigo-300 hover:shadow-sm"
                                    title="Ir a Modo Mix"
                                >
                                    <Layers size={16} />
                                    <span className="hidden sm:inline text-sm font-semibold">Modo Mix</span>
                                </button>
                            )}
                            <div className="w-px h-6 bg-slate-200 mx-2"></div>
                        </div>
                    )}

                    {/* Acción Principal */}
                    <button
                        onClick={onNewStudy}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 group"
                        title="Crear nuevo estudio (Ctrl+N)"
                    >
                        <Plus size={20} />
                        Nuevo Estudio
                        <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 ml-1 text-[10px] font-mono bg-blue-500/50 rounded opacity-70 group-hover:opacity-100 transition-opacity">
                            Ctrl+N
                        </kbd>
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white rounded-xl border border-[var(--gray-200)] shadow-sm p-4">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={18} className="text-[var(--gray-500)]" />
                    <span className="font-medium text-[var(--gray-700)]">Filtrar por Jerarquía</span>
                    <button
                        onClick={clearFilters}
                        disabled={!selectedClient && !searchQuery}
                        className={`ml-auto text-xs px-2 py-1 rounded-md transition-all ${selectedClient || searchQuery
                            ? 'text-[var(--primary-600)] hover:text-[var(--primary-700)] hover:bg-[var(--primary-50)]'
                            : 'text-slate-300 cursor-not-allowed'
                            }`}
                    >
                        Limpiar filtros
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Client Filter */}
                    <div className="relative">
                        <label className="block text-xs font-medium text-[var(--gray-500)] mb-1 flex items-center gap-2">
                            Cliente
                            {!selectedClient && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-600 rounded animate-pulse">
                                    ← Comienza aquí
                                </span>
                            )}
                        </label>
                        <select
                            value={selectedClient}
                            onChange={(e) => handleClientChange(e.target.value)}
                            className="w-full px-3 py-2.5 border border-[var(--gray-200)] rounded-lg focus:ring-2 focus:ring-[var(--primary-500)] focus:border-[var(--primary-500)] bg-white appearance-none cursor-pointer"
                        >
                            <option value="">Todos los clientes</option>
                            {clients.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-8 text-[var(--gray-400)] pointer-events-none" />
                    </div>

                    {/* Project Filter */}
                    <div className="relative">
                        <label className="block text-xs font-medium text-[var(--gray-500)] mb-1">Proyecto</label>
                        <select
                            value={selectedProject}
                            onChange={(e) => handleProjectChange(e.target.value)}
                            disabled={!selectedClient}
                            className="w-full px-3 py-2.5 border border-[var(--gray-200)] rounded-lg focus:ring-2 focus:ring-[var(--primary-500)] focus:border-[var(--primary-500)] bg-white appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                        >
                            <option value="">{selectedClient ? 'Todos los proyectos' : '← Selecciona cliente primero'}</option>
                            {projects.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-8 text-[var(--gray-400)] pointer-events-none" />
                    </div>

                    {/* Search */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-[var(--gray-500)] mb-1">Buscar</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gray-400)]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={selectedClient && selectedProject ? 'Buscar por nombre de pieza...' : 'Selecciona cliente y proyecto primero'}
                                disabled={!selectedClient || !selectedProject}
                                className="w-full pl-10 pr-4 py-2.5 border border-[var(--gray-200)] rounded-lg focus:ring-2 focus:ring-[var(--primary-500)] focus:border-[var(--primary-500)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Row - Solo visible cuando hay cliente seleccionado (evita "0" ruidosos en onboarding) */}
            {selectedClient && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={Users} label="Clientes" value={stats.clients} gradient="blue" style={{ animationDelay: '0ms' }} />
                    <StatCard icon={FolderOpen} label="Proyectos" value={stats.projects} gradient="purple" style={{ animationDelay: '60ms' }} />
                    <StatCard icon={FileText} label="Piezas" value={stats.parts} gradient="emerald" style={{ animationDelay: '120ms' }} />
                    <StatCard icon={TrendingUp} label="En Vista" value={filteredStudies.length} gradient="amber" style={{ animationDelay: '180ms' }} />
                </div>
            )}

            {/* Studies Grid */}
            <div className="bg-white rounded-xl border border-[var(--gray-200)] shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--gray-100)] flex items-center justify-between bg-[var(--gray-50)]">
                    <span className="font-medium text-[var(--gray-700)] flex items-center gap-2">
                        {selectedClient && selectedProject ? (
                            <>
                                <span className="text-slate-400">{selectedClient}</span>
                                <span className="text-slate-300">/</span>
                                <span className="text-slate-600">{selectedProject}</span>
                                <span className="text-slate-300">→</span>
                                <span className="font-semibold text-slate-800">Estudios</span>
                            </>
                        ) : selectedClient ? (
                            <>
                                <span className="text-slate-400">{selectedClient}</span>
                                <span className="text-slate-300">→</span>
                                <span className="font-semibold text-slate-800">Proyectos</span>
                            </>
                        ) : (
                            <span className="text-slate-500 italic">Selecciona un cliente para comenzar</span>
                        )}
                        {/* Contador badge */}
                        {selectedClient && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                                {selectedProject
                                    ? `${filteredStudies.length} ${filteredStudies.length === 1 ? 'estudio' : 'estudios'}`
                                    : `${projects.length} ${projects.length === 1 ? 'proyecto' : 'proyectos'}`
                                }
                            </span>
                        )}
                    </span>
                    <div className="flex items-center gap-2">
                        {selectedClient && !selectedProject && onDeleteClient && (
                            <button
                                onClick={() => requestDeleteClient(selectedClient)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title={`Eliminar Cliente ${selectedClient} y todos sus contenidos`}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        <button
                            onClick={loadClients}
                            disabled={isLoading}
                            className="p-2 text-[var(--gray-400)] hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all group"
                            title="Recargar datos"
                        >
                            <RefreshCw size={16} className={`transition-transform duration-300 ${isLoading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-12 flex flex-col items-center justify-center text-[var(--gray-400)]">
                        <Loader2 size={32} className="animate-spin mb-2" />
                        <span>Cargando...</span>
                    </div>
                ) : !selectedClient ? (
                    <div className="welcome-gradient rounded-b-xl">
                        <HeroSection onNewStudy={onNewStudy} />
                    </div>
                ) : selectedClient && !selectedProject ? (
                    // FIX: Manejar tanto cliente CON proyectos como SIN proyectos
                    projects.length > 0 ? (
                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {projects.map((proj, index) => (
                                <div
                                    key={proj}
                                    className="group relative animate-fade-in-up"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <button
                                        onClick={() => setSelectedProject(proj)}
                                        className="w-full p-4 bg-[var(--gray-50)] hover:bg-[var(--primary-50)] border border-[var(--gray-200)] hover:border-[var(--primary-200)] rounded-lg text-left transition-all hover:shadow-md hover:-translate-y-0.5"
                                        title={`Abrir ${proj} de ${selectedClient}`}
                                    >
                                        <FolderOpen size={24} className="text-[var(--gray-400)] group-hover:text-[var(--primary-500)] mb-2 transition-colors" />
                                        <h3 className="font-medium text-[var(--gray-700)] group-hover:text-[var(--primary-600)] transition-colors">{proj}</h3>
                                        <p className="text-xs text-[var(--gray-400)] mt-1">Click para ver estudios →</p>
                                    </button>
                                    {onDeleteProject && (
                                        <button
                                            onClick={() => requestDeleteProject(selectedClient, proj)}
                                            className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all z-10"
                                            title="Eliminar proyecto completo"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        // FIX: Nuevo estado - Cliente seleccionado pero SIN proyectos
                        <div className="p-12 text-center">
                            <FolderOpen size={48} className="mx-auto mb-3 text-[var(--gray-300)]" />
                            <p className="font-medium text-[var(--gray-600)]">
                                Este cliente no tiene proyectos aún
                            </p>
                            <p className="text-sm text-[var(--gray-400)] mt-1">
                                Crea un nuevo estudio para comenzar a trabajar con <span className="font-semibold">{selectedClient}</span>
                            </p>
                            <button
                                onClick={onNewStudy}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary-500)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-600)]"
                            >
                                <Plus size={16} />
                                Crear Primer Proyecto
                            </button>
                        </div>
                    )
                ) : filteredStudies.length === 0 ? (
                    <div className="p-12 text-center bg-gradient-to-b from-transparent to-slate-50/50 animate-fade-in-up">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                            <FolderOpen size={32} className="text-blue-500" />
                        </div>
                        <p className="font-semibold text-[var(--gray-700)] text-lg mb-1">No hay estudios aún</p>
                        <p className="text-sm text-[var(--gray-500)] mb-4">
                            En <span className="font-medium">{selectedClient} / {selectedProject}</span>
                        </p>
                        <button
                            onClick={onNewStudy}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--primary-500)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--primary-600)] transition-all shadow-md hover:shadow-lg"
                        >
                            <Plus size={18} />
                            Crear Primer Estudio
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--gray-100)]">
                        {filteredStudies.map((study, idx) => (
                            <div
                                key={idx}
                                className="study-card p-4 flex items-center justify-between hover:bg-slate-50 transition-all animate-fade-in-up"
                                style={{ animationDelay: `${idx * 40}ms` }}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Checkbox for Mix selection */}
                                    <input
                                        type="checkbox"
                                        checked={selectedForMix.has(study.path)}
                                        onChange={() => toggleMixSelection(study.path)}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        title="Seleccionar para Mix"
                                    />
                                    <div className="p-2 rounded-lg bg-[var(--primary-50)] text-[var(--primary-600)]">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-[var(--gray-800)]">{study.name}</h3>
                                        <p className="text-xs text-[var(--gray-500)]">
                                            {study.client} / {study.project}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onOpenProject(study.path)}
                                    className="flex items-center gap-2 px-4 py-2 bg-[var(--primary-500)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-600)] transition-colors"
                                >
                                    <ExternalLink size={16} />
                                    Abrir
                                </button>
                                {onDeleteStudy && (
                                    <button
                                        onClick={() => requestDeleteStudy(study.path, study.name)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar estudio"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating action bar for Mix selection */}
            {
                selectedForMix.size > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-fade-in-up z-50">
                        <Layers size={24} />
                        <span className="font-medium">
                            {selectedForMix.size} producto{selectedForMix.size > 1 ? 's' : ''} seleccionado{selectedForMix.size > 1 ? 's' : ''}
                        </span>
                        <button
                            onClick={() => setSelectedForMix(new Set())}
                            className="ml-2 px-3 py-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors text-sm"
                        >
                            Limpiar
                        </button>
                        <button
                            onClick={async () => {
                                // MEJORA 3: Prevenir doble-click y race condition
                                if (isCreatingMix) return;
                                setIsCreatingMix(true);

                                // Capturar selección actual para evitar race condition
                                const currentSelection = Array.from(selectedForMix);

                                try {
                                    // Demanda por estudio: el backend web no lee master.json desde FS,
                                    // asi que usamos un default. TODO: leer demand real via Supabase.
                                    const products = currentSelection.map(studyPath => ({ path: studyPath, demand: 100 }));
                                    onNavigateToMix?.(products);
                                } catch (e) {
                                    toast.error('Error al crear Mix', 'No se pudieron cargar todos los estudios.');
                                    logger.error('Dashboard', 'Error creating mix', { error: String(e) });
                                } finally {
                                    setIsCreatingMix(false);
                                }
                            }}
                            disabled={isCreatingMix}
                            className={`px-4 py-2 bg-white text-blue-600 font-semibold rounded-lg hover:bg-slate-100 transition-colors ${isCreatingMix ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isCreatingMix ? 'Cargando...' : 'Crear Mix →'}
                        </button>
                    </div>
                )
            }


            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={showConfirmModal}
                onClose={cancelDelete}
                onConfirm={executeConfirmedDelete}
                title={`Eliminar ${pendingDelete?.type === 'client' ? 'Cliente' : pendingDelete?.type === 'project' ? 'Proyecto' : 'Estudio'}`}
                message={`¿Estás seguro de que deseas eliminar "${pendingDelete?.name}"?\nEsta acción no se puede deshacer y eliminará todos los datos asociados.`}
                confirmText="Sí, Eliminar"
                variant="danger"
                isLoading={isDeleting}
            />

            {/* Modal de confirmación para limpiar selección Mix */}
            <ConfirmModal
                isOpen={showClearSelectionConfirm}
                onClose={cancelClearSelection}
                onConfirm={confirmClearSelection}
                title="¿Cambiar Filtro?"
                message={`Tienes ${selectedForMix.size} estudio${selectedForMix.size > 1 ? 's' : ''} seleccionado${selectedForMix.size > 1 ? 's' : ''} para Mix.\nAl cambiar el filtro se perderá esta selección.`}
                confirmText="Continuar"
                cancelText="Cancelar"
                variant="warning"
            />
        </div >
    );
};
