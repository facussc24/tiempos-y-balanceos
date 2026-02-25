import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
    useKeyboardShortcuts,
    getShortcutsForContext,
    getShortcutsGrouped,
    formatShortcut,
    SHORTCUTS,
    type ShortcutHandlers,
} from '../hooks/useKeyboardShortcuts';

// Helper to dispatch keyboard events on window
function pressKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...opts,
    });
    window.dispatchEvent(event);
}

describe('useKeyboardShortcuts', () => {
    function makeHandlers(overrides: Partial<ShortcutHandlers> = {}): ShortcutHandlers {
        return {
            onSave: vi.fn(),
            onNavigate: vi.fn(),
            onShowHelp: vi.fn(),
            onNewStudy: vi.fn(),
            onCloseProject: vi.fn(),
            onOpenCommandPalette: vi.fn(),
            onUndo: vi.fn(),
            onRedo: vi.fn(),
            isProjectOpen: true,
            isSaveDisabled: false,
            ...overrides,
        };
    }

    it('should call onSave on Ctrl+S', () => {
        const handlers = makeHandlers();
        renderHook(() => useKeyboardShortcuts('dashboard', handlers));

        pressKey('s', { ctrlKey: true });

        expect(handlers.onSave).toHaveBeenCalledTimes(1);
    });

    it('should call onUndo on Ctrl+Z', () => {
        const handlers = makeHandlers();
        renderHook(() => useKeyboardShortcuts('dashboard', handlers));

        pressKey('z', { ctrlKey: true });

        expect(handlers.onUndo).toHaveBeenCalledTimes(1);
    });

    it('should call onRedo on Ctrl+Y', () => {
        const handlers = makeHandlers();
        renderHook(() => useKeyboardShortcuts('dashboard', handlers));

        pressKey('y', { ctrlKey: true });

        expect(handlers.onRedo).toHaveBeenCalledTimes(1);
    });

    it('should call onNewStudy on Ctrl+N', () => {
        const handlers = makeHandlers();
        renderHook(() => useKeyboardShortcuts('dashboard', handlers));

        pressKey('n', { ctrlKey: true });

        expect(handlers.onNewStudy).toHaveBeenCalledTimes(1);
    });

    it('should call onOpenCommandPalette on Ctrl+K', () => {
        const handlers = makeHandlers();
        renderHook(() => useKeyboardShortcuts('dashboard', handlers));

        pressKey('k', { ctrlKey: true });

        expect(handlers.onOpenCommandPalette).toHaveBeenCalledTimes(1);
    });

    it('should call onShowHelp on ?', () => {
        const handlers = makeHandlers();
        renderHook(() => useKeyboardShortcuts('dashboard', handlers));

        pressKey('?');

        expect(handlers.onShowHelp).toHaveBeenCalledTimes(1);
    });

    it('should call onShowHelp on F1', () => {
        const handlers = makeHandlers();
        renderHook(() => useKeyboardShortcuts('dashboard', handlers));

        pressKey('F1');

        expect(handlers.onShowHelp).toHaveBeenCalledTimes(1);
    });

    it('should call onNavigate with correct tab on Alt+number', () => {
        const handlers = makeHandlers();
        renderHook(() => useKeyboardShortcuts('dashboard', handlers));

        pressKey('1', { altKey: true }); // Panel
        expect(handlers.onNavigate).toHaveBeenCalledWith('panel');

        pressKey('2', { altKey: true }); // Tasks
        expect(handlers.onNavigate).toHaveBeenCalledWith('tasks');

        pressKey('3', { altKey: true }); // Balance
        expect(handlers.onNavigate).toHaveBeenCalledWith('balance');
    });

    it('should call onNavigate with dashboard on Alt+H', () => {
        const handlers = makeHandlers();
        renderHook(() => useKeyboardShortcuts('tasks', handlers));

        pressKey('h', { altKey: true });

        expect(handlers.onNavigate).toHaveBeenCalledWith('dashboard');
    });

    it('should NOT trigger shortcuts requiring project when project is closed', () => {
        const handlers = makeHandlers({ isProjectOpen: false });
        renderHook(() => useKeyboardShortcuts('dashboard', handlers));

        pressKey('s', { ctrlKey: true }); // Requires project
        expect(handlers.onSave).not.toHaveBeenCalled();

        pressKey('z', { ctrlKey: true }); // Requires project
        expect(handlers.onUndo).not.toHaveBeenCalled();
    });

    it('should NOT intercept shortcuts when typing in input fields', () => {
        const handlers = makeHandlers();
        renderHook(() => useKeyboardShortcuts('dashboard', handlers));

        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        const event = new KeyboardEvent('keydown', {
            key: 'n',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        });
        Object.defineProperty(event, 'target', { value: input, writable: false });
        window.dispatchEvent(event);

        expect(handlers.onNewStudy).not.toHaveBeenCalled();

        document.body.removeChild(input);
    });

    it('should STILL allow Ctrl+S in input fields (universal save)', () => {
        const handlers = makeHandlers();
        renderHook(() => useKeyboardShortcuts('dashboard', handlers));

        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        const event = new KeyboardEvent('keydown', {
            key: 's',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        });
        Object.defineProperty(event, 'target', { value: input, writable: false });
        window.dispatchEvent(event);

        expect(handlers.onSave).toHaveBeenCalledTimes(1);

        document.body.removeChild(input);
    });

    it('should not trigger context-specific shortcuts on wrong tab', () => {
        const handlers = makeHandlers({
            onOptimize: vi.fn(),
        });
        renderHook(() => useKeyboardShortcuts('tasks', handlers)); // Not on balance tab

        pressKey('o', { ctrlKey: true }); // Balance-only shortcut
        expect(handlers.onOptimize).not.toHaveBeenCalled();
    });
});

describe('getShortcutsForContext', () => {
    it('should return global shortcuts for any context', () => {
        const shortcuts = getShortcutsForContext('balance');
        const globalShortcuts = shortcuts.filter(s => s.context === 'global');
        expect(globalShortcuts.length).toBeGreaterThan(0);
    });

    it('should return balance-specific shortcuts', () => {
        const shortcuts = getShortcutsForContext('balance');
        const balanceShortcuts = shortcuts.filter(s => s.context === 'balance');
        expect(balanceShortcuts.length).toBeGreaterThan(0);
    });
});

describe('getShortcutsGrouped', () => {
    it('should group shortcuts by context', () => {
        const grouped = getShortcutsGrouped();

        expect(grouped['global']).toBeDefined();
        expect(grouped['navigation']).toBeDefined();
        expect(grouped['balance']).toBeDefined();
        expect(grouped['global'].length).toBeGreaterThan(0);
    });
});

describe('formatShortcut', () => {
    it('should format Ctrl+S correctly', () => {
        const shortcut = SHORTCUTS.find(s => s.key === 's' && s.ctrl);
        expect(shortcut).toBeDefined();
        expect(formatShortcut(shortcut!)).toBe('Ctrl + S');
    });

    it('should format Alt+1 correctly', () => {
        const shortcut = SHORTCUTS.find(s => s.key === '1' && s.alt);
        expect(shortcut).toBeDefined();
        expect(formatShortcut(shortcut!)).toBe('Alt + 1');
    });

    it('should format F1 correctly', () => {
        const shortcut = SHORTCUTS.find(s => s.key === 'F1');
        expect(shortcut).toBeDefined();
        expect(formatShortcut(shortcut!)).toBe('F1');
    });

    it('should format Enter as ↵', () => {
        const shortcut = SHORTCUTS.find(s => s.key === 'Enter' && s.ctrl);
        expect(shortcut).toBeDefined();
        expect(formatShortcut(shortcut!)).toBe('Ctrl + ↵');
    });
});
