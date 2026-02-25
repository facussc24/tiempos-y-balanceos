/**
 * Shortcuts Help Modal
 * 
 * Displays all available keyboard shortcuts in a visually appealing modal.
 * Groups shortcuts by context and highlights the currently active context.
 * 
 * @module components/modals/ShortcutsHelpModal
 */

import React from 'react';
import { X, Keyboard, Command, Navigation, BarChart2, ListTodo, Binary, GitBranch } from 'lucide-react';
import { SHORTCUTS, formatShortcut, getShortcutsGrouped } from '../../hooks/useKeyboardShortcuts';

// ============================================================================
// TYPES
// ============================================================================

interface ShortcutsHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeContext?: string;
}

// ============================================================================
// CONTEXT METADATA
// ============================================================================

const CONTEXT_META: Record<string, {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
}> = {
    global: {
        label: 'Globales',
        icon: Command,
        color: 'blue'
    },
    navigation: {
        label: 'Navegación',
        icon: Navigation,
        color: 'purple'
    },
    balance: {
        label: 'Balanceo',
        icon: BarChart2,
        color: 'emerald'
    },
    tasks: {
        label: 'Tareas',
        icon: ListTodo,
        color: 'amber'
    },
    vsm: {
        label: 'Simulador de Flujo',
        icon: GitBranch,
        color: 'teal'
    }
};

const COLOR_CLASSES: Record<string, {
    bg: string;
    border: string;
    text: string;
    badge: string;
}> = {
    blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        badge: 'bg-blue-100 text-blue-800'
    },
    purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        badge: 'bg-purple-100 text-purple-800'
    },
    emerald: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        badge: 'bg-emerald-100 text-emerald-800'
    },
    amber: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        badge: 'bg-amber-100 text-amber-800'
    },
    rose: {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-700',
        badge: 'bg-rose-100 text-rose-800'
    },
    teal: {
        bg: 'bg-teal-50',
        border: 'border-teal-200',
        text: 'text-teal-700',
        badge: 'bg-teal-100 text-teal-800'
    }
};

// ============================================================================
// SHORTCUT KEY DISPLAY COMPONENT
// ============================================================================

interface KeyBadgeProps {
    children: React.ReactNode;
}

const KeyBadge: React.FC<KeyBadgeProps> = ({ children }) => (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-slate-100 border border-slate-300 rounded-md text-xs font-mono font-bold text-slate-700 shadow-sm">
        {children}
    </kbd>
);

// ============================================================================
// SHORTCUT ROW COMPONENT
// ============================================================================

interface ShortcutRowProps {
    keys: string;
    description: string;
}

const ShortcutRow: React.FC<ShortcutRowProps> = ({ keys, description }) => {
    // Parse keys string to render individual key badges
    const keyParts = keys.split(' + ');

    return (
        <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
            <span className="text-sm text-slate-600">{description}</span>
            <div className="flex items-center gap-1">
                {keyParts.map((key, index) => (
                    <React.Fragment key={index}>
                        <KeyBadge>{key}</KeyBadge>
                        {index < keyParts.length - 1 && (
                            <span className="text-slate-400 text-xs mx-0.5">+</span>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// CONTEXT SECTION COMPONENT
// ============================================================================

interface ContextSectionProps {
    contextKey: string;
    isActive?: boolean;
}

const ContextSection: React.FC<ContextSectionProps> = ({ contextKey, isActive }) => {
    const meta = CONTEXT_META[contextKey];
    const colors = COLOR_CLASSES[meta?.color || 'blue'];
    const shortcuts = getShortcutsGrouped()[contextKey] || [];

    if (shortcuts.length === 0) return null;

    const Icon = meta?.icon || Command;

    return (
        <div className={`rounded-xl border ${isActive ? colors.border + ' ' + colors.bg : 'border-slate-200 bg-white'} overflow-hidden transition-all`}>
            {/* Header */}
            <div className={`px-4 py-3 border-b ${isActive ? colors.border : 'border-slate-100'} flex items-center gap-2`}>
                <div className={`p-1.5 rounded-lg ${isActive ? colors.badge : 'bg-slate-100'}`}>
                    <Icon size={14} className={isActive ? colors.text : 'text-slate-600'} />
                </div>
                <h3 className={`text-sm font-bold ${isActive ? colors.text : 'text-slate-700'}`}>
                    {meta?.label || contextKey}
                </h3>
                {isActive && (
                    <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider ${colors.text} ${colors.badge} px-2 py-0.5 rounded-full`}>
                        Activo
                    </span>
                )}
            </div>

            {/* Shortcuts List */}
            <div className="p-2">
                {shortcuts.map((shortcut, index) => (
                    <ShortcutRow
                        key={index}
                        keys={formatShortcut(shortcut)}
                        description={shortcut.descriptionEs}
                    />
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({
    isOpen,
    onClose,
    activeContext = 'global'
}) => {
    if (!isOpen) return null;

    // Close on Escape key
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Map tab names to context names
    const contextMap: Record<string, string> = {
        'balance': 'balance',
        'tasks': 'tasks',
        'vsm': 'vsm',
    };

    const currentContext = contextMap[activeContext] || 'global';

    // Order for display: global, navigation, then context-specific
    const contextOrder = ['global', 'navigation', 'balance', 'tasks', 'vsm'];

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2.5 rounded-xl">
                            <Keyboard size={22} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Atajos de Teclado</h2>
                            <p className="text-slate-400 text-xs mt-0.5">Acceso rápido a funciones principales</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {contextOrder.map(context => (
                            <ContextSection
                                key={context}
                                contextKey={context}
                                isActive={context === currentContext}
                            />
                        ))}
                    </div>

                    {/* Footer Tip */}
                    <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-xs text-slate-500 text-center">
                            <span className="font-bold text-slate-700">Tip:</span> Presiona{' '}
                            <KeyBadge>?</KeyBadge> o <KeyBadge>F1</KeyBadge>{' '}
                            en cualquier momento para ver esta ayuda
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShortcutsHelpModal;
