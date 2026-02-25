import { useEffect, useRef } from 'react';

/**
 * useFocusTrap - Traps focus within a container when active.
 * 
 * @param isOpen - Whether the trap is active
 * @returns Ref object to attach to the container
 */
export const useFocusTrap = (isOpen: boolean) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const element = containerRef.current;
        if (!element) return;

        // Select all focusable elements
        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const first = focusableElements[0] as HTMLElement;
        const last = focusableElements[focusableElements.length - 1] as HTMLElement;

        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                }
            } else { // Tab
                if (document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        };

        element.addEventListener('keydown', handleTab);

        // Set initial focus to the first element
        // Small timeout to ensure DOM render if needed, though usually strict sync works
        requestAnimationFrame(() => {
            first.focus();
        });

        return () => element.removeEventListener('keydown', handleTab);
    }, [isOpen]);

    return containerRef;
};
