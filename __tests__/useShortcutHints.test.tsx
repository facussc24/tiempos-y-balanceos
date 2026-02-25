import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShortcutHints } from '../hooks/useShortcutHints';

describe('useShortcutHints', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should start with no hints visible', () => {
        const { result } = renderHook(() => useShortcutHints(800));

        expect(result.current.isAltHeld).toBe(false);
        expect(result.current.hintsVisible).toBe(false);
    });

    it('should detect Alt key press', () => {
        const { result } = renderHook(() => useShortcutHints(800));

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true }));
        });

        expect(result.current.isAltHeld).toBe(true);
        expect(result.current.hintsVisible).toBe(false); // Not yet - delay not elapsed
    });

    it('should show hints after delay when Alt is held', () => {
        const { result } = renderHook(() => useShortcutHints(800));

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true }));
        });

        act(() => {
            vi.advanceTimersByTime(800);
        });

        expect(result.current.isAltHeld).toBe(true);
        expect(result.current.hintsVisible).toBe(true);
    });

    it('should hide hints when Alt is released', () => {
        const { result } = renderHook(() => useShortcutHints(800));

        // Press Alt
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true }));
        });

        act(() => {
            vi.advanceTimersByTime(800);
        });
        expect(result.current.hintsVisible).toBe(true);

        // Release Alt
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Alt',
                bubbles: true,
                cancelable: true,
            }));
        });

        expect(result.current.isAltHeld).toBe(false);
        expect(result.current.hintsVisible).toBe(false);
    });

    it('should not show hints if Alt is released before delay', () => {
        const { result } = renderHook(() => useShortcutHints(800));

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true }));
        });

        // Release before delay
        act(() => {
            vi.advanceTimersByTime(400);
        });

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Alt',
                bubbles: true,
                cancelable: true,
            }));
        });

        // Advance past the original delay
        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current.isAltHeld).toBe(false);
        expect(result.current.hintsVisible).toBe(false);
    });

    it('should reset on window blur (user switches app)', () => {
        const { result } = renderHook(() => useShortcutHints(800));

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true }));
        });

        act(() => {
            vi.advanceTimersByTime(800);
        });
        expect(result.current.hintsVisible).toBe(true);

        // Blur
        act(() => {
            window.dispatchEvent(new Event('blur'));
        });

        expect(result.current.isAltHeld).toBe(false);
        expect(result.current.hintsVisible).toBe(false);
    });

    it('should not trigger when typing in an input field', () => {
        const { result } = renderHook(() => useShortcutHints(800));

        const input = document.createElement('input');
        document.body.appendChild(input);

        act(() => {
            const event = new KeyboardEvent('keydown', { key: 'Alt', bubbles: true });
            Object.defineProperty(event, 'target', { value: input });
            window.dispatchEvent(event);
        });

        expect(result.current.isAltHeld).toBe(false);

        document.body.removeChild(input);
    });

    it('should ignore repeated keydown events', () => {
        const { result } = renderHook(() => useShortcutHints(800));

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Alt',
                bubbles: true,
                repeat: true,
            }));
        });

        expect(result.current.isAltHeld).toBe(false);
    });

    it('should work with custom delay', () => {
        const { result } = renderHook(() => useShortcutHints(200));

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true }));
        });

        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(result.current.hintsVisible).toBe(true);
    });
});
