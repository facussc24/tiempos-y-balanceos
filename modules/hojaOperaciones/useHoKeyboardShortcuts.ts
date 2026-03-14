/**
 * useHoKeyboardShortcuts - Keyboard shortcuts for Hoja de Operaciones App
 *
 * Extracted from HojaOperacionesApp.tsx to match the CP pattern (useCpKeyboardShortcuts).
 * Handles Ctrl+N, Ctrl+D, Ctrl+F, Ctrl+Z, Ctrl+Y, F1, Escape.
 */

import { useEffect, startTransition } from 'react';

interface UseHoKeyboardShortcutsParams {
    onUndo: () => void;
    onRedo: () => void;
    onToggleHelp: () => void;
    onAddStep: () => void;
    onToggleViewMode: () => void;
    onFocusStepSearch: () => void;
    showHelp: boolean;
    isReadOnly: boolean;
    activeSheetId: string | null;
}

export function useHoKeyboardShortcuts(params: UseHoKeyboardShortcutsParams): void {
    const {
        onUndo, onRedo, onToggleHelp, onAddStep, onToggleViewMode,
        onFocusStepSearch, showHelp, isReadOnly, activeSheetId,
    } = params;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+N: Add new step (only in edit mode with active sheet)
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (!isReadOnly && activeSheetId) onAddStep();
            }
            // Ctrl+D: Toggle view / edit mode
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                startTransition(() => onToggleViewMode());
            }
            // Ctrl+F: Focus step search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                onFocusStepSearch();
            }
            // Ctrl+Z: Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                onUndo();
            }
            // Ctrl+Y or Ctrl+Shift+Z: Redo
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                onRedo();
            }
            // F1: Toggle help
            if (e.key === 'F1') {
                e.preventDefault();
                onToggleHelp();
            }
            // Escape: Close help panel
            if (e.key === 'Escape') {
                if (showHelp) { onToggleHelp(); return; }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onUndo, onRedo, onToggleHelp, onAddStep, onToggleViewMode,
        onFocusStepSearch, showHelp, isReadOnly, activeSheetId]);
}
