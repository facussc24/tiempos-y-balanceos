/**
 * useShortcutHints Hook
 * 
 * Detects when user holds Alt key for 1 second and triggers hint overlay.
 * 
 * @module useShortcutHints
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface ShortcutHintsState {
    /** Whether Alt key is currently being held */
    isAltHeld: boolean;
    /** Whether hints should be visible (after delay) */
    hintsVisible: boolean;
}

/**
 * Hook to detect Alt key hold for shortcut hints overlay
 * 
 * @param delay - Milliseconds to wait before showing hints (default: 800ms)
 * @returns State indicating if Alt is held and if hints should show
 */
export function useShortcutHints(delay: number = 800): ShortcutHintsState {
    const [isAltHeld, setIsAltHeld] = useState(false);
    const [hintsVisible, setHintsVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Don't interfere when user is typing in an input field
        const target = event.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
            return;
        }

        // Only trigger on Alt key alone (not Alt+other key combos)
        if (event.key === 'Alt' && !event.repeat) {
            setIsAltHeld(true);

            // Start timer to show hints after delay
            timerRef.current = setTimeout(() => {
                setHintsVisible(true);
            }, delay);
        }
    }, [delay]);

    const handleKeyUp = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Alt') {
            event.preventDefault(); // Prevent native menu bar focus
            setIsAltHeld(false);
            setHintsVisible(false);

            // Clear pending timer
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        }
    }, []);

    // Handle blur (user switches window while holding Alt)
    const handleBlur = useCallback(() => {
        setIsAltHeld(false);
        setHintsVisible(false);

        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);

            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [handleKeyDown, handleKeyUp, handleBlur]);

    return { isAltHeld, hintsVisible };
}

export default useShortcutHints;
