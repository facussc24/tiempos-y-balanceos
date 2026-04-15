/**
 * ProjectSwitcher Component
 * 
 * Dropdown in the header that allows quick switching between projects
 * without losing current context. Shows recent projects for fast access.
 * 
 * @module ProjectSwitcher
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, FolderOpen, Clock, XCircle, ArrowRight, Layers } from 'lucide-react';

// Types
export interface RecentProject {
    path: string;
    name: string;
    client: string;
    project: string;
    lastOpened: string;
}

interface ProjectSwitcherProps {
    currentProjectName: string | null;
    currentClient?: string;
    currentProject?: string;
    onSwitch: (path: string) => void;
    onClose: () => void;
    onNavigateToDashboard: () => void;
}

// Constants
const STORAGE_KEY = 'recent_projects';
const MAX_RECENT = 5;

/**
 * Get recent projects from localStorage
 */
const getRecentProjects = (): RecentProject[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

/**
 * Add a project to recent list
 */
export const addToRecentProjects = (project: Omit<RecentProject, 'lastOpened'>) => {
    const recent = getRecentProjects();

    // Remove if already exists
    const filtered = recent.filter(p => p.path !== project.path);

    // Add to front with timestamp
    const updated: RecentProject[] = [
        { ...project, lastOpened: new Date().toISOString() },
        ...filtered
    ].slice(0, MAX_RECENT);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

/**
 * ProjectSwitcher Component
 */
export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({
    currentProjectName,
    currentClient,
    currentProject,
    onSwitch,
    onClose,
    onNavigateToDashboard
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load recent projects on mount
    useEffect(() => {
        setRecentProjects(getRecentProjects());
    }, [isOpen]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Format time ago
    const formatTimeAgo = (isoDate: string): string => {
        const date = new Date(isoDate);
        // FIX: Invalid Date produces NaN from getTime(), causing "Hace NaN min"
        if (isNaN(date.getTime())) return '';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins} min`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Hace ${diffHours}h`;

        const diffDays = Math.floor(diffHours / 24);
        return `Hace ${diffDays}d`;
    };

    const handleSwitchProject = (path: string) => {
        setIsOpen(false);
        onSwitch(path);
    };

    const handleCloseProject = () => {
        setIsOpen(false);
        onClose();
    };

    const handleGoToDashboard = () => {
        setIsOpen(false);
        onNavigateToDashboard();
    };

    // Filter out current project from recents
    const availableRecents = recentProjects.filter(
        p => p.name !== currentProjectName
    );

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
                title="Cambiar Proyecto"
            >
                <FolderOpen size={14} className="text-blue-500" />
                <span className="max-w-[180px] truncate" title={currentProjectName || 'Sin Proyecto'}>
                    {currentProjectName || 'Sin Proyecto'}
                </span>
                <ChevronDown
                    size={14}
                    className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-dropdown animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Current Project Header */}
                    {currentProjectName && (
                        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                                Proyecto Actual
                            </div>
                            <div className="font-semibold text-slate-800 truncate" title={currentProjectName}>
                                {currentProjectName}
                            </div>
                            {currentClient && currentProject && (
                                <div className="text-xs text-slate-500 truncate" title={`${currentClient} / ${currentProject}`}>
                                    {currentClient} / {currentProject}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recent Projects */}
                    {availableRecents.length > 0 && (
                        <div className="py-2">
                            <div className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Clock size={10} />
                                Proyectos Recientes
                            </div>
                            {availableRecents.map((proj) => (
                                <button
                                    key={proj.path}
                                    onClick={() => handleSwitchProject(proj.path)}
                                    className="w-full px-4 py-2 flex items-center justify-between hover:bg-blue-50 hover:pl-5 transition-all group"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Layers size={14} className="text-slate-400 group-hover:text-blue-500 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-slate-700 group-hover:text-blue-600 truncate" title={proj.name}>
                                                {proj.name}
                                            </div>
                                            <div className="text-[10px] text-slate-400 truncate" title={`${proj.client} / ${proj.project}`}>
                                                {proj.client} / {proj.project}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-[10px] text-slate-400">
                                            {formatTimeAgo(proj.lastOpened)}
                                        </span>
                                        <ArrowRight size={12} className="text-slate-300 group-hover:text-blue-500" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="border-t border-slate-100 py-2">
                        <button
                            onClick={handleGoToDashboard}
                            className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center gap-2"
                        >
                            <FolderOpen size={14} />
                            Ver todos los proyectos
                        </button>

                        {currentProjectName && (
                            <button
                                onClick={handleCloseProject}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                            >
                                <XCircle size={14} />
                                Cerrar proyecto actual
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectSwitcher;
