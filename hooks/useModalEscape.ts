/**
 * useModalEscape - Custom hook to handle Escape key for modals
 * 
 * Attaches a keydown listener that calls onClose when Escape is pressed.
 * Only active when isOpen is true.
 */

import { useEffect, useCallback } from 'react';

export const useModalEscape = (isOpen: boolean, onClose: () => void): void => {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleKeyDown]);
};
