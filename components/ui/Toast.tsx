/**
 * Toast Notification System
 * 
 * Provides a centralized notification system replacing alert() calls.
 * Supports success, error, warning, and info notifications.
 * 
 * @module notifications
 */

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number; // ms, 0 = manual dismiss
    actions?: ToastAction[];
}

export interface ToastAction {
    label: string;
    onClick: () => void;
    primary?: boolean;
}

// ============================================================================
// TOAST STORE (Global State)
// ============================================================================

type ToastListener = (toasts: Toast[]) => void;

// H-05 Fix: Maximum number of visible toasts
const MAX_TOASTS = 5;

class ToastStore {
    private toasts: Toast[] = [];
    private listeners: Set<ToastListener> = new Set();
    private timers = new Map<string, ReturnType<typeof setTimeout>>();

    subscribe(listener: ToastListener): () => void {
        this.listeners.add(listener);
        listener(this.toasts);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        this.listeners.forEach(l => l([...this.toasts]));
    }

    add(toast: Omit<Toast, 'id'>): string {
        const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newToast: Toast = { ...toast, id };
        this.toasts.push(newToast);

        // H-05 Fix: Limit to MAX_TOASTS, removing oldest first
        if (this.toasts.length > MAX_TOASTS) {
            const evicted = this.toasts.slice(0, -MAX_TOASTS);
            evicted.forEach(t => { const tm = this.timers.get(t.id); if (tm != null) { clearTimeout(tm); this.timers.delete(t.id); } });
            this.toasts = this.toasts.slice(-MAX_TOASTS);
        }

        this.notify();

        // Auto-dismiss after duration (default 5s for non-errors)
        const duration = toast.duration ?? (toast.type === 'error' ? 0 : 5000);
        if (duration > 0) {
            this.timers.set(id, setTimeout(() => this.remove(id), duration));
        }

        return id;
    }

    remove(id: string): void {
        const timer = this.timers.get(id);
        if (timer != null) { clearTimeout(timer); this.timers.delete(id); }
        this.toasts = this.toasts.filter(t => t.id !== id);
        this.notify();
    }

    clear(): void {
        this.timers.forEach(t => clearTimeout(t));
        this.timers.clear();
        this.toasts = [];
        this.notify();
    }
}

// Singleton instance
const toastStore = new ToastStore();

// ============================================================================
// PUBLIC API (Global Functions)
// ============================================================================

export const toast = {
    success: (title: string, message?: string, actions?: ToastAction[]) =>
        toastStore.add({ type: 'success', title, message, actions }),

    error: (title: string, message?: string, actions?: ToastAction[]) =>
        toastStore.add({ type: 'error', title, message, actions, duration: 0 }),

    warning: (title: string, message?: string, actions?: ToastAction[]) =>
        toastStore.add({ type: 'warning', title, message, actions }),

    info: (title: string, message?: string, actions?: ToastAction[]) =>
        toastStore.add({ type: 'info', title, message, actions }),

    dismiss: (id: string) => toastStore.remove(id),

    clear: () => toastStore.clear(),
};

// ============================================================================
// REACT HOOK
// ============================================================================

export function useToasts(): Toast[] {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        return toastStore.subscribe(setToasts);
    }, []);

    return toasts;
}

// ============================================================================
// TOAST COMPONENT
// ============================================================================

const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const colors = {
    success: {
        bg: 'bg-emerald-50 border-emerald-200',
        icon: 'text-emerald-500',
        text: 'text-emerald-800',
    },
    error: {
        bg: 'bg-red-50 border-red-200',
        icon: 'text-red-500',
        text: 'text-red-800',
    },
    warning: {
        bg: 'bg-amber-50 border-amber-200',
        icon: 'text-amber-500',
        text: 'text-amber-800',
    },
    info: {
        bg: 'bg-blue-50 border-blue-200',
        icon: 'text-blue-500',
        text: 'text-blue-800',
    },
};

interface ToastItemProps {
    toast: Toast;
    onDismiss: () => void;
}

function ToastItem({ toast: t, onDismiss }: ToastItemProps) {
    const Icon = icons[t.type];
    const color = colors[t.type];

    return (
        <div
            className={`
                flex items-start gap-3 p-4 rounded-lg border shadow-lg
                animate-in slide-in-from-right duration-200
                hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-default
                ${color.bg}
            `}
        >
            <Icon className={`${color.icon} flex-shrink-0 mt-0.5`} size={20} />
            <div className="flex-1 min-w-0">
                <p className={`font-medium ${color.text}`}>{t.title}</p>
                {t.message && (
                    <p className={`mt-1 text-sm ${color.text} opacity-80`}>{t.message}</p>
                )}
                {t.actions && t.actions.length > 0 && (
                    <div className="mt-3 flex gap-2">
                        {t.actions.map((action, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    action.onClick();
                                    onDismiss();
                                }}
                                className={`
                                    px-3 py-1.5 text-sm font-medium rounded transition-colors
                                    ${action.primary
                                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                                    }
                                `}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <button
                onClick={onDismiss}
                aria-label="Cerrar notificación"
                className={`${color.text} opacity-50 hover:opacity-100 transition-opacity`}
            >
                <X size={16} />
            </button>
        </div>
    );
}

// ============================================================================
// TOAST CONTAINER (Render in App root)
// ============================================================================

export function ToastContainer() {
    const toasts = useToasts();

    if (toasts.length === 0) return null;

    return (
        <div
            className="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
            role="alert"
            aria-live="polite"
            aria-atomic="true"
        >
            {toasts.map(t => (
                <div key={t.id} className="pointer-events-auto">
                    <ToastItem toast={t} onDismiss={() => toast.dismiss(t.id)} />
                </div>
            ))}
        </div>
    );
}

export default toast;
