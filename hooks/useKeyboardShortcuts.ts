/**
 * Keyboard Shortcuts System
 * 
 * Central hook for managing keyboard shortcuts across the application.
 * Supports global, navigation, and context-specific shortcuts.
 * 
 * @module hooks/useKeyboardShortcuts
 */

import { useEffect, useCallback, useRef } from 'react';
import { Tab } from './useAppNavigation';

// ============================================================================
// TYPES
// ============================================================================

export interface ShortcutHandlers {
    /** Save the current project */
    onSave?: () => void;
    /** Navigate to a specific tab */
    onNavigate?: (tab: Tab) => void;
    /** Show shortcuts help modal */
    onShowHelp?: () => void;
    /** Create new study */
    onNewStudy?: () => void;
    /** Close current project */
    onCloseProject?: () => void;
    /** Open command palette (Ctrl+K) */
    onOpenCommandPalette?: () => void;
    /** Undo last action (Ctrl+Z) */
    onUndo?: () => void;
    /** Redo last undone action (Ctrl+Y) */
    onRedo?: () => void;
    /** Whether a project is currently open */
    isProjectOpen?: boolean;
    /** Whether save is disabled (e.g., read-only mode) */
    isSaveDisabled?: boolean;

    // Context-specific handlers (Balanceo)
    onOptimize?: () => void;
    onClearBalance?: () => void;
    onAddStation?: () => void;
    onRemoveStation?: () => void;

    // Context-specific handlers (Simulation)
    onRunSimulation?: () => void;
    onToggleDetails?: () => void;

    // Context-specific handlers (Tasks)
    onAddTask?: () => void;
    onDeleteTask?: () => void;
    onSearchTasks?: () => void;
}

interface ShortcutDefinition {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    description: string;
    descriptionEs: string;
    context: 'global' | 'navigation' | 'balance' | 'tasks' | 'vsm';
    handler: (handlers: ShortcutHandlers) => void;
    requiresProject?: boolean;
}

// ============================================================================
// SHORTCUTS REGISTRY
// ============================================================================

export const SHORTCUTS: ShortcutDefinition[] = [
    // ─────────────────────────────────────────────────────────────────────────
    // GLOBAL SHORTCUTS
    // ─────────────────────────────────────────────────────────────────────────
    {
        key: 's',
        ctrl: true,
        description: 'Save Project',
        descriptionEs: 'Guardar Proyecto',
        context: 'global',
        requiresProject: true,
        handler: (h) => h.onSave?.()
    },
    {
        key: 'n',
        ctrl: true,
        description: 'New Study',
        descriptionEs: 'Nuevo Estudio',
        context: 'global',
        handler: (h) => h.onNewStudy?.()
    },
    {
        key: 'w',
        ctrl: true,
        description: 'Close Project',
        descriptionEs: 'Cerrar Proyecto',
        context: 'global',
        requiresProject: true,
        handler: (h) => h.onCloseProject?.()
    },
    {
        key: '?',
        description: 'Show Keyboard Shortcuts',
        descriptionEs: 'Mostrar Atajos de Teclado',
        context: 'global',
        handler: (h) => h.onShowHelp?.()
    },
    {
        key: 'F1',
        description: 'Show Keyboard Shortcuts',
        descriptionEs: 'Mostrar Atajos de Teclado',
        context: 'global',
        handler: (h) => h.onShowHelp?.()
    },
    {
        key: 'k',
        ctrl: true,
        description: 'Open Command Palette',
        descriptionEs: 'Abrir Paleta de Comandos',
        context: 'global',
        handler: (h) => h.onOpenCommandPalette?.()
    },
    {
        key: 'z',
        ctrl: true,
        description: 'Undo',
        descriptionEs: 'Deshacer',
        context: 'global',
        requiresProject: true,
        handler: (h) => h.onUndo?.()
    },
    {
        key: 'y',
        ctrl: true,
        description: 'Redo',
        descriptionEs: 'Rehacer',
        context: 'global',
        requiresProject: true,
        handler: (h) => h.onRedo?.()
    },

    // ─────────────────────────────────────────────────────────────────────────
    // NAVIGATION SHORTCUTS (Alt + Number)
    // ─────────────────────────────────────────────────────────────────────────
    {
        key: 'h',
        alt: true,
        description: 'Go to Dashboard',
        descriptionEs: 'Ir al Inicio',
        context: 'navigation',
        handler: (h) => h.onNavigate?.('dashboard')
    },
    {
        key: '1',
        alt: true,
        description: 'Go to Panel Control',
        descriptionEs: 'Ir a Panel de Control',
        context: 'navigation',
        requiresProject: true,
        handler: (h) => h.onNavigate?.('panel')
    },
    {
        key: '2',
        alt: true,
        description: 'Go to Tasks',
        descriptionEs: 'Ir a Tareas',
        context: 'navigation',
        requiresProject: true,
        handler: (h) => h.onNavigate?.('tasks')
    },
    {
        key: '3',
        alt: true,
        description: 'Go to Line Balancing',
        descriptionEs: 'Ir a Balanceo',
        context: 'navigation',
        requiresProject: true,
        handler: (h) => h.onNavigate?.('balance')
    },
    {
        key: '4',
        alt: true,
        description: 'Go to Flow Simulator',
        descriptionEs: 'Ir a Simulador de Flujo',
        context: 'navigation',
        requiresProject: true,
        handler: (h) => h.onNavigate?.('vsm')
    },
    {
        key: '5',
        alt: true,
        description: 'Go to Executive Summary',
        descriptionEs: 'Ir a Resumen Ejecutivo',
        context: 'navigation',
        requiresProject: true,
        handler: (h) => h.onNavigate?.('summary')
    },
    {
        key: 'v',
        alt: true,
        description: 'Go to VSM',
        descriptionEs: 'Ir a VSM',
        context: 'navigation',
        requiresProject: true,
        handler: (h) => h.onNavigate?.('vsm')
    },
    {
        key: 'g',
        alt: true,
        description: 'Go to Process Graph',
        descriptionEs: 'Ir a Mapa de Procesos',
        context: 'navigation',
        requiresProject: true,
        handler: (h) => h.onNavigate?.('graph')
    },

    // ─────────────────────────────────────────────────────────────────────────
    // BALANCING CONTEXT SHORTCUTS
    // ─────────────────────────────────────────────────────────────────────────
    {
        key: 'o',
        ctrl: true,
        description: 'Run Optimization',
        descriptionEs: 'Ejecutar Optimización',
        context: 'balance',
        handler: (h) => h.onOptimize?.()
    },
    {
        key: 'r',
        ctrl: true,
        description: 'Clear Balance',
        descriptionEs: 'Limpiar Balanceo',
        context: 'balance',
        handler: (h) => h.onClearBalance?.()
    },
    {
        key: '+',
        description: 'Add Station',
        descriptionEs: 'Agregar Estación',
        context: 'balance',
        handler: (h) => h.onAddStation?.()
    },
    {
        key: '-',
        description: 'Remove Station',
        descriptionEs: 'Quitar Estación',
        context: 'balance',
        handler: (h) => h.onRemoveStation?.()
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SIMULATION CONTEXT SHORTCUTS
    // ─────────────────────────────────────────────────────────────────────────
    {
        key: 'Enter',
        ctrl: true,
        description: 'Run Simulation',
        descriptionEs: 'Ejecutar Simulación',
        context: 'vsm',
        handler: (h) => h.onRunSimulation?.()
    },
    {
        key: 'd',
        ctrl: true,
        description: 'Toggle Details',
        descriptionEs: 'Mostrar/Ocultar Detalles',
        context: 'vsm',
        handler: (h) => h.onToggleDetails?.()
    },

    // ─────────────────────────────────────────────────────────────────────────
    // TASKS CONTEXT SHORTCUTS
    // ─────────────────────────────────────────────────────────────────────────
    {
        key: 'Enter',
        ctrl: true,
        description: 'Add New Task',
        descriptionEs: 'Agregar Nueva Tarea',
        context: 'tasks',
        handler: (h) => h.onAddTask?.()
    },
    {
        key: 'f',
        ctrl: true,
        description: 'Search/Filter Tasks',
        descriptionEs: 'Buscar/Filtrar Tareas',
        context: 'tasks',
        handler: (h) => h.onSearchTasks?.()
    },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if the event target is an input element where we shouldn't intercept shortcuts
 */
function isInputElement(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;

    const tagName = target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return true;
    }

    // Check for contenteditable
    if (target.isContentEditable) {
        return true;
    }

    return false;
}

/**
 * Check if a keyboard event matches a shortcut definition
 */
function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
    // Check modifiers
    if (shortcut.ctrl && !event.ctrlKey && !event.metaKey) return false;
    if (shortcut.shift && !event.shiftKey) return false;
    if (shortcut.alt && !event.altKey) return false;

    // Check that no extra modifiers are pressed (unless expected)
    if (!shortcut.ctrl && (event.ctrlKey || event.metaKey)) return false;
    if (!shortcut.shift && event.shiftKey) return false;
    if (!shortcut.alt && event.altKey) return false;

    // Check key
    const eventKey = event.key.toLowerCase();
    const shortcutKey = shortcut.key.toLowerCase();

    return eventKey === shortcutKey;
}

/**
 * Get shortcuts for a specific context
 */
export function getShortcutsForContext(context: string): ShortcutDefinition[] {
    return SHORTCUTS.filter(s => s.context === context || s.context === 'global');
}

/**
 * Get all shortcuts grouped by context
 */
export function getShortcutsGrouped(): Record<string, ShortcutDefinition[]> {
    const grouped: Record<string, ShortcutDefinition[]> = {};

    SHORTCUTS.forEach(shortcut => {
        if (!grouped[shortcut.context]) {
            grouped[shortcut.context] = [];
        }
        grouped[shortcut.context].push(shortcut);
    });

    return grouped;
}

/**
 * Format a shortcut key combination for display
 */
export function formatShortcut(shortcut: ShortcutDefinition): string {
    const parts: string[] = [];

    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');

    // Format the key nicely
    let keyDisplay = shortcut.key;
    if (keyDisplay === ' ') keyDisplay = 'Space';
    if (keyDisplay === 'Enter') keyDisplay = '↵';
    if (keyDisplay.length === 1) keyDisplay = keyDisplay.toUpperCase();

    parts.push(keyDisplay);

    return parts.join(' + ');
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Hook to manage keyboard shortcuts across the application
 * 
 * @param activeTab - The currently active tab/module
 * @param handlers - Object containing handler functions for various actions
 */
export function useKeyboardShortcuts(
    activeTab: Tab,
    handlers: ShortcutHandlers
): void {
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    const activeTabRef = useRef(activeTab);
    activeTabRef.current = activeTab;

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        const currentHandlers = handlersRef.current;
        const currentTab = activeTabRef.current;

        // Don't intercept if user is typing in an input
        if (isInputElement(event.target)) {
            // Exception: Allow Ctrl+S even in inputs (universal save)
            if (!(event.ctrlKey && event.key.toLowerCase() === 's')) {
                return;
            }
        }

        // Map active tab to context
        const contextMap: Record<Tab, string> = {
            'dashboard': 'global',
            'panel': 'global',
            'tasks': 'tasks',
            'balance': 'balance',
            'vsm': 'vsm',
            'graph': 'global',
            'oee': 'global',
            'help': 'global',
            'plant': 'global',
            'mix': 'global',
            'summary': 'global',
        };

        const currentContext = contextMap[currentTab] || 'global';

        // Find matching shortcut
        for (const shortcut of SHORTCUTS) {
            // Check if shortcut applies to current context
            const isGlobalOrNav = shortcut.context === 'global' || shortcut.context === 'navigation';
            const isContextMatch = shortcut.context === currentContext;

            if (!isGlobalOrNav && !isContextMatch) continue;

            // Check if shortcut requires a project to be open
            if (shortcut.requiresProject && !currentHandlers.isProjectOpen) continue;

            // Check if event matches shortcut
            if (matchesShortcut(event, shortcut)) {
                // Prevent default browser behavior
                event.preventDefault();
                event.stopPropagation();

                // Execute handler
                shortcut.handler(currentHandlers);
                return;
            }
        }
    }, []);

    useEffect(() => {
        // Add event listener
        window.addEventListener('keydown', handleKeyDown);

        // Cleanup
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);
}

export default useKeyboardShortcuts;
