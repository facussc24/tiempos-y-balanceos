/**
 * AppSidebar — Global collapsible sidebar navigation for Barack Mercosul
 * @version 2.0.0 — Mejora #3 (grid 64px axis + brand row + bottom toggle + active pill)
 *
 * Design: every visual element (logo, item icons, section dash, toggle icon)
 * is centered at x=32px via `grid-template-columns: 64px 1fr ...`. State
 * persisted in localStorage. API unchanged from v1.
 */
import React, { useState, useCallback } from 'react';
import {
    ChevronRight,
    GitBranch,
    FileJson,
    ClipboardCheck,
    FileText,
    Clock,
    FileEdit,
    Layers,
    Settings,
    Home,
    Search,
    Box,
} from 'lucide-react';

interface AppSidebarProps {
    currentMode: string;
    onSelectModule: (module: string) => void;
    onBackToLanding: () => void;
}

const LS_KEY_SIDEBAR = 'barack_sidebar_expanded';

interface SidebarItem {
    label: string;
    /** Mode key for module navigation. Special: 'landing' returns to landing, 'search' opens command palette. */
    mode: string;
    icon: React.ReactNode;
    /** Optional alert count — shows red pill when expanded, red dot on icon when collapsed. */
    alertCount?: number;
    /** Optional override action — if defined, runs instead of navigation. Used for search trigger. */
    onClick?: () => void;
}

interface SidebarSection {
    title: string;
    items: SidebarItem[];
}

/** Dispatched globally — handled by CommandPaletteProvider listener. */
const openCommandPalette = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barack:open-command-palette'));
    }
};

const SECTIONS: SidebarSection[] = [
    {
        title: 'General',
        items: [
            { label: 'Inicio', mode: 'landing', icon: <Home size={16} /> },
            { label: 'Buscar (Ctrl+K)', mode: 'search', icon: <Search size={16} />, onClick: openCommandPalette },
        ],
    },
    {
        title: 'APQP',
        items: [
            { label: 'Diagrama de Flujo', mode: 'pfd', icon: <GitBranch size={16} /> },
            { label: 'AMFE VDA', mode: 'amfe', icon: <FileJson size={16} /> },
            { label: 'Plan de Control', mode: 'controlPlan', icon: <ClipboardCheck size={16} /> },
            { label: 'Hojas de Operaciones', mode: 'hojaOperaciones', icon: <FileText size={16} /> },
        ],
    },
    {
        title: 'Lean',
        items: [
            { label: 'Tiempos y Balanceos', mode: 'tiempos', icon: <Clock size={16} /> },
            { label: 'Medios Logisticos', mode: 'mediosCalculator', icon: <Layers size={16} /> },
        ],
    },
    {
        title: 'Calidad',
        items: [
            { label: 'Reportes 8D', mode: '8dReports', icon: <ClipboardCheck size={16} /> },
        ],
    },
    {
        title: 'Diseno',
        items: [
            { label: 'Impresion 3D', mode: 'threeD', icon: <Box size={16} /> },
        ],
    },
    {
        title: 'Gestion',
        items: [
            { label: 'Solicitudes', mode: 'solicitud', icon: <FileEdit size={16} /> },
            { label: 'Hub de Documentos', mode: 'registry', icon: <Layers size={16} /> },
        ],
    },
    {
        title: 'Sistema',
        items: [
            { label: 'Administracion', mode: 'admin', icon: <Settings size={16} /> },
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

    const handleItemClick = useCallback((item: SidebarItem) => {
        if (item.onClick) {
            item.onClick();
            return;
        }
        if (item.mode === 'landing') {
            onBackToLanding();
        } else {
            onSelectModule(item.mode);
        }
    }, [onSelectModule, onBackToLanding]);

    return (
        <aside
            className="no-print flex-shrink-0 flex flex-col h-full transition-[width] duration-300 ease-out"
            style={{
                width: expanded ? 248 : 64,
                background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
                color: '#CBD5E1',
                borderRight: '1px solid rgba(148, 163, 184, 0.08)',
                boxShadow: 'inset -1px 0 0 rgba(255, 255, 255, 0.02)',
            }}
            aria-label="Navegacion principal"
        >
            {/* Brand row — logo siempre en eje x=32, nombre fade in/out */}
            <div
                className="flex-shrink-0 grid items-center"
                style={{
                    gridTemplateColumns: '64px 1fr',
                    height: 56,
                    borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
                }}
            >
                <div
                    className="mx-auto flex items-center justify-center text-white font-bold text-[13px]"
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
                        boxShadow: '0 4px 12px -2px rgba(59, 130, 246, 0.4)',
                    }}
                    aria-hidden="true"
                >
                    B
                </div>
                <span
                    className="font-semibold text-[14px] whitespace-nowrap overflow-hidden transition-opacity duration-200"
                    style={{
                        color: '#F1F5F9',
                        letterSpacing: '-0.01em',
                        opacity: expanded ? 1 : 0,
                    }}
                >
                    Barack Mercosul
                </span>
            </div>

            {/* Sections */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 sidebar-scroll">
                {SECTIONS.map((section, sIdx) => (
                    <div key={section.title}>
                        {/* Divider entre secciones (no antes de la primera) */}
                        {sIdx > 0 && (
                            <div
                                style={{
                                    height: 1,
                                    margin: '6px 16px',
                                    background:
                                        'linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.12), transparent)',
                                }}
                            />
                        )}

                        {/* Section header — dash en col 1, label en col 2 */}
                        <div
                            className="grid items-center"
                            style={{
                                gridTemplateColumns: '64px 1fr',
                                height: 28,
                                marginTop: 8,
                            }}
                        >
                            <span className="flex justify-center" style={{ color: 'rgba(148, 163, 184, 0.4)' }}>
                                <span
                                    aria-hidden="true"
                                    style={{
                                        height: 1,
                                        width: expanded ? 6 : 16,
                                        background: 'currentColor',
                                        transition: 'width 200ms ease',
                                    }}
                                />
                            </span>
                            <span
                                className="text-[10px] font-semibold uppercase whitespace-nowrap transition-opacity duration-200"
                                style={{
                                    color: '#64748B',
                                    letterSpacing: '0.1em',
                                    opacity: expanded ? 1 : 0,
                                }}
                            >
                                {section.title}
                            </span>
                        </div>

                        {/* Items */}
                        {section.items.map(item => {
                            const isActive = currentMode === item.mode;
                            const hasBadge = typeof item.alertCount === 'number' && item.alertCount > 0;
                            return (
                                <button
                                    key={item.mode}
                                    type="button"
                                    onClick={() => handleItemClick(item)}
                                    title={!expanded ? item.label : undefined}
                                    aria-label={!expanded ? item.label : undefined}
                                    aria-current={isActive ? 'page' : undefined}
                                    className="group/item relative w-full grid items-center text-left transition-colors duration-200"
                                    style={{
                                        gridTemplateColumns: '64px 1fr auto',
                                        height: 40,
                                        color: isActive ? '#F1F5F9' : '#94A3B8',
                                        background: isActive
                                            ? 'linear-gradient(90deg, rgba(59,130,246,0.16) 0%, rgba(59,130,246,0.04) 60%, transparent 100%)'
                                            : 'transparent',
                                    }}
                                >
                                    {/* Indicador activo — barra azul vertical centrada en y */}
                                    {isActive && (
                                        <span
                                            aria-hidden="true"
                                            className="absolute"
                                            style={{
                                                left: 0,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                width: 3,
                                                height: 20,
                                                background: '#60A5FA',
                                                borderRadius: '0 3px 3px 0',
                                                boxShadow: '0 0 12px 0 rgba(96, 165, 250, 0.6)',
                                            }}
                                        />
                                    )}

                                    {/* Pill del icono — siempre 32x32 centrado en x=32 */}
                                    <span
                                        className="mx-auto flex items-center justify-center transition-all duration-200 group-hover/item:bg-white/[0.06]"
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            background: isActive
                                                ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
                                                : undefined,
                                            color: isActive ? '#fff' : undefined,
                                            boxShadow: isActive
                                                ? '0 2px 8px -1px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                                                : undefined,
                                        }}
                                    >
                                        {item.icon}
                                        {/* Dot de alerta cuando esta collapsed */}
                                        {hasBadge && !expanded && (
                                            <span
                                                aria-hidden="true"
                                                className="absolute"
                                                style={{
                                                    top: 6,
                                                    left: 36,
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: '50%',
                                                    background: '#EF4444',
                                                    boxShadow: '0 0 0 2px #0F172A',
                                                }}
                                            />
                                        )}
                                    </span>

                                    {/* Label */}
                                    <span
                                        className="text-[13.5px] font-medium whitespace-nowrap overflow-hidden transition-opacity duration-200 group-hover/item:text-slate-100"
                                        style={{ opacity: expanded ? 1 : 0 }}
                                    >
                                        {item.label}
                                    </span>

                                    {/* Badge expandido */}
                                    {hasBadge && expanded && (
                                        <span
                                            className="text-[10px] font-semibold transition-opacity duration-200"
                                            style={{
                                                marginRight: 14,
                                                padding: '1px 6px',
                                                borderRadius: 999,
                                                background: 'rgba(239, 68, 68, 0.18)',
                                                color: '#FCA5A5',
                                            }}
                                        >
                                            {item.alertCount}
                                        </span>
                                    )}
                                    {!hasBadge && <span />}

                                    {/* Tooltip cuando esta collapsed */}
                                    {!expanded && (
                                        <span
                                            className="pointer-events-none absolute opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all duration-150"
                                            style={{
                                                left: 60,
                                                top: '50%',
                                                transform: 'translate(8px, -50%)',
                                                background: '#0F172A',
                                                color: '#F1F5F9',
                                                fontSize: 12,
                                                fontWeight: 500,
                                                padding: '6px 10px',
                                                borderRadius: 8,
                                                whiteSpace: 'nowrap',
                                                border: '1px solid rgba(148, 163, 184, 0.12)',
                                                boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.4)',
                                                zIndex: 50,
                                            }}
                                        >
                                            {item.label}
                                            {hasBadge && (
                                                <span style={{ color: '#FCA5A5', marginLeft: 6 }}>
                                                    · {item.alertCount}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Toggle row al BOTTOM */}
            <button
                type="button"
                onClick={toggleExpanded}
                className="flex-shrink-0 grid items-center text-left transition-colors duration-200 hover:bg-white/[0.03]"
                style={{
                    gridTemplateColumns: '64px 1fr',
                    height: 48,
                    borderTop: '1px solid rgba(148, 163, 184, 0.06)',
                }}
                title={expanded ? 'Colapsar menu' : 'Expandir menu'}
                aria-label={expanded ? 'Colapsar menu' : 'Expandir menu'}
                aria-expanded={expanded}
            >
                <span
                    className="mx-auto flex items-center justify-center transition-all duration-300"
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        color: '#94A3B8',
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                >
                    <ChevronRight size={16} />
                </span>
                <span
                    className="text-[12px] whitespace-nowrap transition-opacity duration-200"
                    style={{ color: '#64748B', opacity: expanded ? 1 : 0 }}
                >
                    Colapsar
                </span>
            </button>
        </aside>
    );
};

export default AppSidebar;
