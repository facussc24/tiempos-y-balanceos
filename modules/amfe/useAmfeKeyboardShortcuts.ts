import { useEffect, startTransition } from 'react';
import { AmfeFilterState, EMPTY_FILTERS, hasActiveFilters } from './AmfeFilters';

interface UseAmfeKeyboardShortcutsParams {
    onUndo: () => void;
    onRedo: () => void;
    onSave: () => void;
    onAddOperation: () => void;
    filters: AmfeFilterState;
    setFilters: (f: AmfeFilterState) => void;
    showHelp: boolean;
    setShowHelp: (fn: (prev: boolean) => boolean) => void;
    showSummary: boolean;
    setShowSummary: (v: boolean) => void;
    setViewMode: (fn: (prev: 'view' | 'edit') => 'view' | 'edit') => void;
    /** When true, keyboard shortcuts are disabled (e.g., when a child tab is active). */
    disabled?: boolean;
}

export function useAmfeKeyboardShortcuts(params: UseAmfeKeyboardShortcutsParams): void {
    const {
        onUndo, onRedo, onSave, onAddOperation,
        filters, setFilters,
        showHelp, setShowHelp,
        showSummary, setShowSummary,
        setViewMode,
        disabled,
    } = params;

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // When a child module tab is active (PFD, CP, HO), don't intercept shortcuts
            if (disabled) return;

            const mod = e.ctrlKey || e.metaKey;

            // Ctrl+Z: Undo
            if (mod && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                onUndo();
                return;
            }

            // Ctrl+Y or Ctrl+Shift+Z: Redo
            if (mod && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                onRedo();
                return;
            }

            // Ctrl+S: Save
            if (mod && e.key === 's') {
                e.preventDefault();
                onSave();
                return;
            }

            // Ctrl+N: New operation (only when not in an input/textarea)
            if (mod && e.key === 'n') {
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
                    e.preventDefault();
                    onAddOperation();
                    return;
                }
            }

            // Ctrl+E: Toggle summary
            if (mod && e.key === 'e') {
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
                    e.preventDefault();
                    setShowSummary(!showSummary);
                    return;
                }
            }

            // Ctrl+D: Toggle view/edit mode
            if (mod && e.key === 'd') {
                e.preventDefault();
                startTransition(() => setViewMode(prev => prev === 'view' ? 'edit' : 'view'));
                return;
            }

            // Ctrl+F: Focus on filter search (custom, not browser find)
            if (mod && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.querySelector<HTMLInputElement>('[data-amfe-search]');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
                return;
            }

            // Ctrl+H: Toggle Help Panel
            if (mod && e.key === 'h') {
                e.preventDefault();
                setShowHelp(prev => !prev);
                return;
            }

            // Escape: Close panels in priority order, then clear filters
            if (e.key === 'Escape') {
                if (showHelp) {
                    setShowHelp(() => false);
                    return;
                }
                if (hasActiveFilters(filters)) {
                    setFilters(EMPTY_FILTERS);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onSave, onAddOperation, filters, showHelp, onUndo, onRedo, showSummary, setShowSummary, setFilters, setShowHelp, setViewMode, disabled]);

    // Beforeunload warning — uses same hook file since it's a global listener
    // (moved to separate hook below)
}

interface UseAmfeBeforeUnloadParams {
    hasUnsavedChanges: boolean;
}

export function useAmfeBeforeUnload({ hasUnsavedChanges }: UseAmfeBeforeUnloadParams): void {
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);
}
