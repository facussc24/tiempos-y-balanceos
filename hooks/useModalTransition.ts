/**
 * useModalTransition Hook
 * 
 * Manages the exit animation state for modals.
 * Allows the component to stay mounted while the exit animation plays,
 * then unmounts it after the duration.
 * 
 * Usage:
 * const { shouldRender, isClosing } = useModalTransition(isOpen, 200);
 * 
 * if (!shouldRender) return null;
 * 
 * return (
 *   <div className={isClosing ? 'animate-out fade-out' : 'animate-in fade-in'}>
 *     ...
 *   </div>
 * );
 * 
 * @module useModalTransition
 * @version 1.0.0
 */

import { useState, useEffect } from 'react';

export function useModalTransition(isOpen: boolean, duration: number = 200) {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setIsClosing(false);
        } else {
            setIsClosing(true);
            const timer = setTimeout(() => {
                setShouldRender(false);
                setIsClosing(false);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isOpen, duration]);

    return { shouldRender, isClosing };
}
