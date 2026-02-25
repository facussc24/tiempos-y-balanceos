import React from 'react';
import {
    FolderOpen, FilePlus, Trash2, FileJson, ChevronDown,
    AlertTriangle, X, Loader2, Search, Filter,
} from 'lucide-react';
import AmfeRegistryView from './AmfeRegistryView';
import AmfeSummary from './AmfeSummary';
import type { AmfeDocument } from './amfeTypes';

type ActivePanel = 'none' | 'projects' | 'summary' | 'library' | 'registry' | 'templates';

interface AmfeSideDrawerProps {
    activePanel: ActivePanel;
    setActivePanel: (p: ActivePanel) => void;
    projects: {
        createNewProject: () => void;
        selectedClient: string;
        setSelectedClient: (v: string) => void;
        selectedProject: string;
        setSelectedProject: (v: string) => void;
        clients: string[];
        clientProjects: string[];
        studies: Array<{ filename: string; name: string; header?: { subject?: string } }>;
        looseFiles: Array<{ filename: string; name: string; header?: { subject?: string; client?: string } }>;
        isLoadingBrowser: boolean;
        searchQuery: string;
        setSearchQuery: (v: string) => void;
        clearFilters: () => void;
        currentProject: string | null;
        currentProjectRef: { client: string; project: string; name: string } | null;
        loadHierarchicalProject: (client: string, project: string, name: string) => void;
        loadSelectedProject: (name: string) => void;
        deleteHierarchicalProject: (client: string, project: string, name: string) => void;
        deleteProjectFolder: (client: string, project: string) => void;
        deleteSelectedProject: (name: string) => void;
    };
    data: AmfeDocument;
}

const AmfeSideDrawer: React.FC<AmfeSideDrawerProps> = ({ activePanel, setActivePanel, projects, data }) => {
    const showProjectPanel = activePanel === 'projects';
    const showRegistry = activePanel === 'registry';
    const showSummary = activePanel === 'summary';

    if (!showProjectPanel && !showRegistry && !showSummary) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setActivePanel('none')}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/20" />
            {/* Drawer */}
            <div className="relative w-[480px] max-w-full bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
                {/* Close button */}
                <button onClick={() => setActivePanel('none')} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 z-10">
                    <X size={18} />
                </button>

                {/* Projects Panel */}
                {showProjectPanel && (
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <FolderOpen size={16} className="text-blue-600" />
                                Proyectos AMFE
                            </h2>
                            <button onClick={projects.createNewProject}
                                className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded transition font-medium mr-6">
                                <FilePlus size={14} /> Nuevo
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 mb-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Filter size={14} className="text-gray-500" />
                                <span className="text-xs font-medium text-gray-600">Filtrar por Jerarquia</span>
                                <button
                                    onClick={projects.clearFilters}
                                    disabled={!projects.selectedClient && !projects.searchQuery}
                                    className={`ml-auto text-[10px] px-2 py-0.5 rounded transition ${projects.selectedClient || projects.searchQuery
                                        ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                                        : 'text-gray-300 cursor-not-allowed'}`}
                                >
                                    Limpiar
                                </button>
                            </div>

                            {/* Client dropdown */}
                            <div className="mb-2">
                                <label className="block text-[10px] font-medium text-gray-500 mb-1 flex items-center gap-1.5">
                                    Cliente
                                    {!projects.selectedClient && (
                                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-600 rounded animate-pulse">
                                            Comienza aqui
                                        </span>
                                    )}
                                </label>
                                <div className="relative">
                                    <select
                                        value={projects.selectedClient}
                                        onChange={(e) => projects.setSelectedClient(e.target.value)}
                                        className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg bg-white appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Todos los clientes</option>
                                        {projects.clients.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Project dropdown */}
                            <div className="mb-2">
                                <label className="block text-[10px] font-medium text-gray-500 mb-1">Proyecto</label>
                                <div className="relative">
                                    <select
                                        value={projects.selectedProject}
                                        onChange={(e) => projects.setSelectedProject(e.target.value)}
                                        disabled={!projects.selectedClient}
                                        className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg bg-white appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
                                    >
                                        <option value="">{projects.selectedClient ? 'Todos los proyectos' : 'Selecciona cliente primero'}</option>
                                        {projects.clientProjects.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Search */}
                            <div>
                                <label className="block text-[10px] font-medium text-gray-500 mb-1">Buscar</label>
                                <div className="relative">
                                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={projects.searchQuery}
                                        onChange={(e) => projects.setSearchQuery(e.target.value)}
                                        disabled={!projects.selectedClient || !projects.selectedProject}
                                        placeholder="Buscar AMFE..."
                                        className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Loading */}
                        {projects.isLoadingBrowser && (
                            <div className="flex items-center justify-center py-6 text-gray-400">
                                <Loader2 size={18} className="animate-spin mr-2" />
                                <span className="text-xs">Cargando...</span>
                            </div>
                        )}

                        {/* State 1: No client selected */}
                        {!projects.isLoadingBrowser && !projects.selectedClient && projects.clients.length === 0 && (
                            <div className="text-center py-8 text-gray-400">
                                <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No se encontraron carpetas de clientes.</p>
                                <p className="text-[10px] mt-1">Usa "Guardar Como" para crear la primera.</p>
                            </div>
                        )}

                        {/* State 2: Client selected, no project */}
                        {!projects.isLoadingBrowser && projects.selectedClient && !projects.selectedProject && (
                            <div>
                                <div className="text-[10px] text-gray-500 mb-2 font-medium">
                                    Proyectos de {projects.selectedClient} ({projects.clientProjects.length})
                                </div>
                                {projects.clientProjects.length === 0 ? (
                                    <div className="text-center py-6 text-gray-400">
                                        <FolderOpen size={24} className="mx-auto mb-1 opacity-50" />
                                        <p className="text-xs">Sin proyectos.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {projects.clientProjects.map(proj => (
                                            <div
                                                key={proj}
                                                onClick={() => projects.setSelectedProject(proj)}
                                                className="group flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm bg-white cursor-pointer transition hover:-translate-y-0.5"
                                            >
                                                <FolderOpen size={20} className="text-blue-500 mb-1 group-hover:text-blue-600" />
                                                <span className="text-xs font-medium text-gray-700 text-center truncate w-full">{proj}</span>
                                                <Trash2 size={12}
                                                    className="mt-1 text-transparent group-hover:text-gray-300 hover:!text-red-500 transition cursor-pointer"
                                                    onClick={(e) => { e.stopPropagation(); projects.deleteProjectFolder(projects.selectedClient, proj); }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* State 3: Client + Project selected */}
                        {!projects.isLoadingBrowser && projects.selectedClient && projects.selectedProject && (
                            <div>
                                <div className="text-[10px] text-gray-500 mb-2 font-medium">
                                    AMFEs en {projects.selectedClient} / {projects.selectedProject} ({projects.studies.length})
                                </div>
                                {projects.studies.length === 0 ? (
                                    <div className="text-center py-6 text-gray-400">
                                        <FileJson size={24} className="mx-auto mb-1 opacity-50" />
                                        <p className="text-xs">Sin AMFEs en esta carpeta.</p>
                                        <p className="text-[10px] mt-1">Usa "Guardar Como" para crear uno.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-2">
                                        {projects.studies.map(s => {
                                            const isActive = projects.currentProjectRef?.client === projects.selectedClient
                                                && projects.currentProjectRef?.project === projects.selectedProject
                                                && projects.currentProjectRef?.name === s.name;
                                            return (
                                                <div key={s.filename}
                                                    className={`flex items-center justify-between p-3 rounded-lg border transition hover:shadow-sm cursor-pointer ${isActive ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                                                    onClick={() => { projects.loadHierarchicalProject(projects.selectedClient, projects.selectedProject, s.name); setActivePanel('none'); }}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <FileJson size={14} className="text-blue-500 flex-shrink-0" />
                                                            <span className="font-medium text-sm text-gray-800 truncate">{s.name}</span>
                                                            {isActive && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full">activo</span>}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 ml-6 mt-0.5">
                                                            {s.header?.subject && <span className="mr-2">{s.header.subject}</span>}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); projects.deleteHierarchicalProject(projects.selectedClient, projects.selectedProject, s.name); }}
                                                        className="text-gray-300 hover:text-red-500 p-1.5 transition"
                                                        title="Eliminar AMFE"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Loose files (legacy unclassified) */}
                        {!projects.isLoadingBrowser && projects.looseFiles.length > 0 && !projects.selectedProject && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="text-[10px] text-gray-500 mb-2 font-medium flex items-center gap-1">
                                    <AlertTriangle size={12} className="text-amber-500" />
                                    Sin clasificar ({projects.looseFiles.length})
                                </div>
                                <div className="grid gap-2">
                                    {projects.looseFiles.map(p => (
                                        <div key={p.filename}
                                            className={`flex items-center justify-between p-3 rounded-lg border transition hover:shadow-sm cursor-pointer ${projects.currentProject === p.name && !projects.currentProjectRef?.client ? 'border-amber-400 bg-amber-50/50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                                            onClick={() => { projects.loadSelectedProject(p.name); setActivePanel('none'); }}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <FileJson size={14} className="text-amber-500 flex-shrink-0" />
                                                    <span className="font-medium text-sm text-gray-800 truncate">{p.name}</span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 ml-6 mt-0.5">
                                                    {p.header?.subject && <span className="mr-3">{p.header.subject}</span>}
                                                    {p.header?.client && <span>| {p.header.client}</span>}
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); projects.deleteSelectedProject(p.name); }}
                                                className="text-gray-300 hover:text-red-500 p-1.5 transition"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Registry Panel */}
                {showRegistry && (
                    <AmfeRegistryView
                        onOpenProject={(projectName) => {
                            projects.loadSelectedProject(projectName);
                            setActivePanel('none');
                        }}
                        onClose={() => setActivePanel('none')}
                    />
                )}

                {/* Summary Panel */}
                {showSummary && (
                    <div className="p-5 overflow-y-auto max-h-[calc(100vh-2rem)]">
                        <AmfeSummary data={data} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AmfeSideDrawer;
