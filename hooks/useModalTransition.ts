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

import { useState, useEffect, useRef } from 'react';

export function useModalTransition(isOpen: boolean, duration: number = 200) {
    // Track only the post-close animation state. shouldRender and isClosing
    // are derived from isOpen + closingFromOpen, avoiding setState-in-effect
    // for the open path.
    const [closingFromOpen, setClosingFromOpen] = useState(false);
    const wasOpenRef = useRef(isOpen);

    useEffect(() => {
        if (isOpen) {
            wasOpenRef.current = true;
            return;
        }
        // isOpen just turned false (or was false from start). Only animate close
        // if it was previously open — avoids a flash on initial mount with isOpen=false.
        if (!wasOpenRef.current) return;
        wasOpenRef.current = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- entering closing animation; paired with timer below
        setClosingFromOpen(true);
        const timer = setTimeout(() => setClosingFromOpen(false), duration);
        return () => clearTimeout(timer);
    }, [isOpen, duration]);

    const shouldRender = isOpen || closingFromOpen;
    const isClosing = !isOpen && closingFromOpen;

    return { shouldRender, isClosing };
}
