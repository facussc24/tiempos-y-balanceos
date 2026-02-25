/**
 * useCpKeyboardShortcuts - Keyboard shortcuts for Control Plan App
 *
 * Extracted from ControlPlanApp.tsx to reduce component size.
 * Handles Ctrl+S, Ctrl+I, Ctrl+D, Ctrl+F, Ctrl+N, Ctrl+Z, Ctrl+Y, Ctrl+E, Ctrl+H, Escape.
 */

import { useEffect, startTransition } from 'react';
import { CpValidationIssue } from './cpCrossValidation';

interface UseCpKeyboardShortcutsParams {
    onSave: () => void;
    onToggleChat: () => void;
    onToggleViewMode: () => void;
    onFocusSearch: () => void;
    onAddItem: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onToggleSummary: () => void;
    onToggleHelp: () => void;
    showChat: boolean;
    validationIssues: CpValidationIssue[] | null;
    showSummary: boolean;
    showHelp: boolean;
    showTemplates: boolean;
    isReadOnly: boolean;
    setValidationIssues: (v: CpValidationIssue[] | null) => void;
    setShowChat: (v: boolean) => void;
    setShowSummary: (v: boolean) => void;
    setShowHelp: (v: boolean) => void;
    setShowTemplates: (v: boolean) => void;
    showOverflowMenu: boolean;
    setShowOverflowMenu: (v: boolean) => void;
}

export function useCpKeyboardShortcuts(params: UseCpKeyboardShortcutsParams): void {
    const {
        onSave, onToggleChat, onToggleViewMode, onFocusSearch, onAddItem,
        onUndo, onRedo, onToggleSummary, onToggleHelp,
        showChat, validationIssues, showSummary, showHelp, showTemplates,
        isReadOnly, setValidationIssues, setShowChat, setShowSummary, setShowHelp, setShowTemplates,
        showOverflowMenu, setShowOverflowMenu,
    } = params;

    // Close overflow menu on outside click
    useEffect(() => {
        if (!showOverflowMenu) return;
        const handleClick = () => setShowOverflowMenu(false);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [showOverflowMenu, setShowOverflowMenu]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                onSave();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                onToggleChat();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                startTransition(() => onToggleViewMode());
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                onFocusSearch();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (!isReadOnly) onAddItem();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                onUndo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                onRedo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                onToggleSummary();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                onToggleHelp();
            }
            // Escape: close open panels in priority order
            if (e.key === 'Escape') {
                if (showHelp) { setShowHelp(false); return; }
                if (showTemplates) { setShowTemplates(false); return; }
                if (showChat) { setShowChat(false); return; }
                if (validationIssues) { setValidationIssues(null); return; }
                if (showSummary) { setShowSummary(false); return; }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onSave, isReadOnly, onAddItem, onUndo, onRedo, showChat, validationIssues, showSummary, showHelp, showTemplates,
        onToggleChat, onToggleViewMode, onFocusSearch, onToggleSummary, onToggleHelp,
        setValidationIssues, setShowChat, setShowSummary, setShowHelp, setShowTemplates]);
}
