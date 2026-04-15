/**
 * CommandPalette - Quick Actions & Navigation Modal
 * 
 * A modern command palette (similar to VS Code Ctrl+Shift+P, Slack Ctrl+K)
 * that allows users to quickly navigate, execute actions, and find shortcuts.
 * 
 * Features:
 * - Fuzzy search filtering
 * - Keyboard navigation (↑↓ Enter Esc)
 * - Categorized commands (Navigation, Actions, Help)
 * - Visual keyboard shortcuts display
 * - Smooth animations
 * 
 * @module CommandPalette
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
    Search,
    X,
    Home,
    LayoutDashboard,
    ListTodo,
    Scale,
    Activity,
    FileText,
    GitBranch,
    Plus,
    Save,
    Keyboard,
    Zap,
    Command,
    ArrowRight,
    Layers
} from 'lucide-react';
import { Tab } from '../../hooks/useAppNavigation';

// ============================================================================
// TYPES
// ============================================================================

export type CommandCategory = 'navigation' | 'actions' | 'help';

export interface CommandItem {
    id: string;
    label: string;
    description?: string;
    category: CommandCategory;
    icon: React.ReactNode;
    shortcut?: string;
    action: () => void;
    disabled?: boolean;
    requiresProject?: boolean;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (tab: Tab) => void;
    onNewStudy: () => void;
    onSave?: () => void;
    onShowHelp: () => void;
    isProjectOpen: boolean;
    isSaveDisabled?: boolean;
}

// ============================================================================
// CATEGORY CONFIG
// ============================================================================

const CATEGORY_CONFIG: Record<CommandCategory, {
    label: string;
    color: string;
    bgColor: string;
}> = {
    navigation: {
        label: 'Navegación',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
    },
    actions: {
        label: 'Acciones Rápidas',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50'
    },
    help: {
        label: 'Ayuda',
        color: 'text-purple-600',
        bgColor: 'bg-purple-50'
    }
};

// ============================================================================
// HIGHLIGHT MATCH COMPONENT
// ============================================================================

const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
    if (!query.trim()) return <>{text}</>;

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
};

// ============================================================================
// COMMAND PALETTE COMPONENT
// ============================================================================

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen,
    onClose,
    onNavigate,
    onNewStudy,
    onSave,
    onShowHelp,
    isProjectOpen,
    isSaveDisabled = false
}) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const paletteRef = useFocusTrap(isOpen);

    // Build command list
    const commands = useMemo<CommandItem[]>(() => [
        // === NAVIGATION ===
        {
            id: 'nav-home',
            label: 'Inicio / Dashboard',
            description: 'Ir a la pantalla principal',
            category: 'navigation',
            icon: <Home size={18} />,
            shortcut: 'Alt+H',
            action: () => onNavigate('dashboard')
        },
        {
            id: 'nav-panel',
            label: 'Panel de Control',
            description: 'Configuración del proyecto',
            category: 'navigation',
            icon: <LayoutDashboard size={18} />,
            shortcut: 'Alt+1',
            action: () => onNavigate('panel'),
            requiresProject: true
        },
        {
            id: 'nav-tasks',
            label: 'Gestión de Tareas',
            description: 'Crear y editar operaciones',
            category: 'navigation',
            icon: <ListTodo size={18} />,
            shortcut: 'Alt+2',
            action: () => onNavigate('tasks'),
            requiresProject: true
        },
        {
            id: 'nav-balance',
            label: 'Balanceo de Líneas',
            description: 'Asignar tareas a estaciones',
            category: 'navigation',
            icon: <Scale size={18} />,
            shortcut: 'Alt+3',
            action: () => onNavigate('balance'),
            requiresProject: true
        },
        {
            id: 'nav-sim',
            label: 'Simulador de Flujo',
            description: 'Laboratorio de flujo y cuellos de botella',
            category: 'navigation',
            icon: <Activity size={18} />,
            shortcut: 'Alt+4',
            action: () => onNavigate('vsm'),
            requiresProject: true
        },
        {
            id: 'nav-reports',
            label: 'Resumen Ejecutivo',
            description: 'Resumen ejecutivo del estudio',
            category: 'navigation',
            icon: <FileText size={18} />,
            shortcut: 'Alt+5',
            action: () => onNavigate('summary'),
            requiresProject: true
        },
        {
            id: 'nav-graph',
            label: 'Mapa de Procesos',
            description: 'Grafo de dependencias',
            category: 'navigation',
            icon: <GitBranch size={18} />,
            shortcut: 'Alt+G',
            action: () => onNavigate('graph'),
            requiresProject: true
        },
        {
            id: 'nav-mix',
            label: 'Modo Mix',
            description: 'Planificación multi-producto',
            category: 'navigation',
            icon: <Layers size={18} />,
            action: () => onNavigate('mix'),
            requiresProject: true
        },
        {
            id: 'nav-oee',
            label: 'Indicadores OEE',
            description: 'Eficiencia de equipos',
            category: 'navigation',
            icon: <Activity size={18} />,
            action: () => onNavigate('oee'),
            requiresProject: true
        },
        // === ACTIONS ===
        {
            id: 'action-new',
            label: 'Nuevo Estudio',
            description: 'Crear un proyecto nuevo',
            category: 'actions',
            icon: <Plus size={18} />,
            shortcut: 'Ctrl+N',
            action: onNewStudy
        },
        {
            id: 'action-save',
            label: 'Guardar Proyecto',
            description: 'Guardar cambios actuales',
            category: 'actions',
            icon: <Save size={18} />,
            shortcut: 'Ctrl+S',
            action: () => onSave?.(),
            disabled: !onSave || isSaveDisabled,
            requiresProject: true
        },
        // === HELP ===
        {
            id: 'help-shortcuts',
            label: 'Atajos de Teclado',
            description: 'Ver todos los atajos disponibles',
            category: 'help',
            icon: <Keyboard size={18} />,
            shortcut: 'F1',
            action: onShowHelp
        },
    ], [onNavigate, onNewStudy, onSave, onShowHelp, isSaveDisabled]);

    // Filter commands based on query and project state
    const filteredCommands = useMemo(() => {
        let filtered = commands.filter(cmd => {
            // Filter by project requirement
            if (cmd.requiresProject && !isProjectOpen) return false;
            // Filter by disabled state
            if (cmd.disabled) return false;
            return true;
        });

        if (query.trim()) {
            const lowerQuery = query.toLowerCase();
            filtered = filtered.filter(cmd =>
                cmd.label.toLowerCase().includes(lowerQuery) ||
                cmd.description?.toLowerCase().includes(lowerQuery) ||
                cmd.shortcut?.toLowerCase().includes(lowerQuery)
            );
        }

        return filtered;
    }, [commands, query, isProjectOpen]);

    // Group by category
    const groupedCommands = useMemo(() => {
        const groups: Record<CommandCategory, CommandItem[]> = {
            navigation: [],
            actions: [],
            help: []
        };

        filteredCommands.forEach(cmd => {
            groups[cmd.category].push(cmd);
        });

        return groups;
    }, [filteredCommands]);

    // Reset selection when query changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selectedElement = listRef.current.querySelector('[data-selected="true"]');
            selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex]);

    // Execute selected command
    const executeCommand = useCallback((cmd: CommandItem) => {
        onClose();
        setTimeout(() => cmd.action(), 100);
    }, [onClose]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < filteredCommands.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev > 0 ? prev - 1 : filteredCommands.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    executeCommand(filteredCommands[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [filteredCommands, selectedIndex, executeCommand, onClose]);

    // Close on backdrop click
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    if (!isOpen) return null;

    // Flatten for index calculation
    let flatIndex = 0;

    return createPortal(
        <div
            className="fixed inset-0 z-overlay flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={handleBackdropClick}
        >
            <div
                ref={paletteRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="command-palette-title"
                className="w-full max-w-xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in slide-in-from-top-4 duration-200"
                onKeyDown={handleKeyDown}
            >
                {/* Search Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <span id="command-palette-title" className="sr-only">Paleta de comandos</span>
                    <Search size={20} className="text-slate-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar acciones, módulos o ayuda..."
                        className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 text-base"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-mono text-slate-500 bg-slate-100 rounded-md border border-slate-200">
                        <Command size={12} />K
                    </kbd>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Commands List */}
                <div
                    ref={listRef}
                    className="max-h-[60vh] overflow-y-auto py-2"
                >
                    {filteredCommands.length === 0 ? (
                        <div className="px-4 py-8 text-center text-slate-400">
                            <Search size={32} className="mx-auto mb-2 opacity-50" />
                            <p>No se encontraron resultados para &ldquo;{query}&rdquo;</p>
                        </div>
                    ) : (
                        Object.entries(groupedCommands).map(([category, items]) => {
                            if (items.length === 0) return null;
                            const config = CATEGORY_CONFIG[category as CommandCategory];

                            return (
                                <div key={category} className="mb-2">
                                    {/* Category Header */}
                                    <div className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${config.color}`}>
                                        {config.label}
                                    </div>

                                    {/* Commands */}
                                    {items.map((cmd) => {
                                        const isSelected = flatIndex === selectedIndex;
                                        const currentIndex = flatIndex;
                                        flatIndex++;

                                        return (
                                            <button
                                                key={cmd.id}
                                                data-selected={isSelected}
                                                onClick={() => executeCommand(cmd)}
                                                onMouseEnter={() => setSelectedIndex(currentIndex)}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${isSelected
                                                    ? 'bg-blue-50 border-l-2 border-blue-500'
                                                    : 'border-l-2 border-transparent hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {cmd.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`font-medium truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`} title={cmd.label}>
                                                        <HighlightMatch text={cmd.label} query={query} />
                                                    </div>
                                                    {cmd.description && (
                                                        <div className="text-xs text-slate-400 truncate" title={cmd.description}>
                                                            <HighlightMatch text={cmd.description} query={query} />
                                                        </div>
                                                    )}
                                                </div>
                                                {cmd.shortcut && (
                                                    <kbd className="hidden sm:block px-2 py-1 text-xs font-mono text-slate-500 bg-slate-100 rounded border border-slate-200">
                                                        {cmd.shortcut}
                                                    </kbd>
                                                )}
                                                {isSelected && (
                                                    <ArrowRight size={16} className="text-blue-500" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200">↑↓</kbd>
                            navegar
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200">↵</kbd>
                            seleccionar
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200">esc</kbd>
                            cerrar
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Zap size={12} className="text-amber-500" />
                        <span>Acceso rápido</span>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CommandPalette;
