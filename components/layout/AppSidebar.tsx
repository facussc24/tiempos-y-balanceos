/**
 * AppSidebar — Global collapsible sidebar navigation for Barack Mercosul
 *
 * Collapsed by default (48px, icons only). Expands to 240px on toggle.
 * State persisted in localStorage.
 */
import React, { useState, useCallback } from 'react';
import {
    Menu,
    LayoutDashboard,
    GitBranch,
    FileJson,
    ClipboardCheck,
    FileText,
    Clock,
    FileEdit,
    Layers,
    Settings,
    Home,
} from 'lucide-react';

interface AppSidebarProps {
    currentMode: string;
    onSelectModule: (module: string) => void;
    onBackToLanding: () => void;
}

const LS_KEY_SIDEBAR = 'barack_sidebar_expanded';

interface SidebarItem {
    label: string;
    mode: string;
    icon: React.ReactNode;
}

interface SidebarSection {
    title: string;
    items: SidebarItem[];
}

const SECTIONS: SidebarSection[] = [
    {
        title: 'General',
        items: [
            { label: 'Dashboard', mode: 'dashboard', icon: <LayoutDashboard size={18} /> },
        ],
    },
    {
        title: 'APQP',
        items: [
            { label: 'Diagrama de Flujo', mode: 'pfd', icon: <GitBranch size={18} /> },
            { label: 'AMFE VDA', mode: 'amfe', icon: <FileJson size={18} /> },
            { label: 'Plan de Control', mode: 'controlPlan', icon: <ClipboardCheck size={18} /> },
            { label: 'Hojas de Operaciones', mode: 'hojaOperaciones', icon: <FileText size={18} /> },
        ],
    },
    {
        title: 'Lean',
        items: [
            { label: 'Tiempos y Balanceos', mode: 'tiempos', icon: <Clock size={18} /> },
        ],
    },
    {
        title: 'Calidad',
        items: [
            { label: 'Reportes 8D', mode: '8dReports', icon: <ClipboardCheck size={18} /> },
        ],
    },
    {
        title: 'Gestion',
        items: [
            { label: 'Solicitudes', mode: 'solicitud', icon: <FileEdit size={18} /> },
            { label: 'Hub de Documentos', mode: 'registry', icon: <Layers size={18} /> },
        ],
    },
    {
        title: 'Sistema',
        items: [
            { label: 'Administracion', mode: 'admin', icon: <Settings size={18} /> },
            { label: 'Inicio', mode: 'landing', icon: <Home size={18} /> },
        ],
    },
];

const AppSidebar: React.FC<AppSidebarProps> = ({ currentMode, onSelectModule, onBackToLanding }) => {
    const [expanded, setExpanded] = useState<boolean>(() => {
        try {
            return localStorage.getItem(LS_KEY_SIDEBAR) === 'true';
        } catch {
            return false;
        }
    });

    const toggleExpanded = useCallback(() => {
        setExpanded(prev => {
            const next = !prev;
            try { localStorage.setItem(LS_KEY_SIDEBAR, String(next)); } catch { /* ignore */ }
            return next;
        });
    }, []);

    const handleItemClick = useCallback((mode: string) => {
        if (mode === 'landing') {
            onBackToLanding();
        } else {
            onSelectModule(mode);
        }
    }, [onSelectModule, onBackToLanding]);

    return (
        <aside
            className={`no-print flex-shrink-0 bg-slate-900 flex flex-col h-full transition-all duration-200 ${
                expanded ? 'w-60' : 'w-12'
            }`}
            aria-label="Navegacion principal"
        >
            {/* Toggle button */}
            <button
                onClick={toggleExpanded}
                className="flex items-center justify-center h-12 w-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors duration-200"
                title={expanded ? 'Colapsar menu' : 'Expandir menu'}
                aria-label={expanded ? 'Colapsar menu' : 'Expandir menu'}
            >
                <Menu size={20} />
            </button>

            {/* Sections */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1">
                {SECTIONS.map((section, sIdx) => (
                    <div key={section.title}>
                        {/* Divider (not before first section) */}
                        {sIdx > 0 && (
                            <div className="border-t border-slate-700/50 my-1" />
                        )}

                        {/* Section label (only when expanded) */}
                        {expanded && (
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider px-4 pt-3 pb-1 select-none">
                                {section.title}
                            </div>
                        )}

                        {/* Items */}
                        {section.items.map(item => {
                            const isActive = currentMode === item.mode;
                            return (
                                <button
                                    key={item.mode}
                                    onClick={() => handleItemClick(item.mode)}
                                    title={expanded ? undefined : item.label}
                                    className={`w-full flex items-center gap-3 transition-colors duration-200 ${
                                        expanded ? 'px-4 py-2' : 'px-0 py-2 justify-center'
                                    } ${
                                        isActive
                                            ? 'bg-blue-500/10 text-blue-400 border-l-2 border-blue-500'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-l-2 border-transparent'
                                    }`}
                                    aria-current={isActive ? 'page' : undefined}
                                >
                                    <span className="flex-shrink-0">{item.icon}</span>
                                    {expanded && (
                                        <span className="text-sm font-medium truncate">{item.label}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </nav>
        </aside>
    );
};

export default AppSidebar;
