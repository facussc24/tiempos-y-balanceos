/**
 * ShortcutHintsOverlay - Visual overlay showing keyboard shortcuts
 * 
 * When user holds Alt key for ~1 second, shows badges on elements
 * that have `data-shortcut` attribute.
 * 
 * @module ShortcutHintsOverlay
 * @version 1.1.0 - Added smart placement (avoid top cutoff)
 */

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Keyboard } from 'lucide-react';

interface HintPosition {
    id: string;
    shortcut: string;
    x: number;
    y: number;
    width: number;
    placement: 'top' | 'bottom';
}

interface ShortcutHintsOverlayProps {
    /** Whether the overlay should be visible */
    isVisible: boolean;
}

/**
 * Scans the DOM for elements with data-shortcut attribute
 * and calculates their positions for hint badges
 */
function getHintPositions(): HintPosition[] {
    const elements = document.querySelectorAll('[data-shortcut]');
    const positions: HintPosition[] = [];

    elements.forEach((el, index) => {
        const shortcut = el.getAttribute('data-shortcut');
        if (!shortcut) return;

        const rect = el.getBoundingClientRect();

        // Skip if element is not visible
        if (rect.width === 0 || rect.height === 0) return;

        // Determine if there is space above (need ~30px)
        const hasSpaceAbove = rect.top > 40;

        positions.push({
            id: `hint-${index}`,
            shortcut,
            x: rect.left + rect.width / 2,
            y: hasSpaceAbove ? rect.top - 8 : rect.bottom + 8,
            width: rect.width,
            placement: hasSpaceAbove ? 'top' : 'bottom'
        });
    });

    return positions;
}

/**
 * ShortcutHintsOverlay Component
 */
export const ShortcutHintsOverlay: React.FC<ShortcutHintsOverlayProps> = ({ isVisible }) => {
    const [hints, setHints] = useState<HintPosition[]>([]);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (isVisible) {
            // Get initial positions
            setHints(getHintPositions());

            // Update positions on scroll/resize
            const updatePositions = () => {
                rafRef.current = requestAnimationFrame(() => {
                    setHints(getHintPositions());
                });
            };

            window.addEventListener('scroll', updatePositions, true);
            window.addEventListener('resize', updatePositions);

            return () => {
                window.removeEventListener('scroll', updatePositions, true);
                window.removeEventListener('resize', updatePositions);
                if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current);
                }
            };
        } else {
            setHints([]);
        }
    }, [isVisible]);

    if (!isVisible || hints.length === 0) return null;

    return createPortal(
        <>
            {/* Subtle overlay to draw attention */}
            <div
                className="fixed inset-0 bg-black/5 backdrop-blur-[1px] pointer-events-none z-overlay animate-in fade-in duration-150"
                aria-hidden="true"
            />

            {/* Hint badges */}
            {hints.map((hint) => (
                <div
                    key={hint.id}
                    className="fixed z-overlay pointer-events-none animate-in zoom-in-95 fade-in duration-200"
                    style={{
                        left: hint.x,
                        top: hint.y,
                        transform: hint.placement === 'top'
                            ? 'translate(-50%, -100%)'
                            : 'translate(-50%, 0%)'
                    }}
                >
                    <div className="flex items-center gap-1 px-2 py-1 bg-slate-900 text-white text-xs font-mono font-bold rounded-md shadow-lg border border-slate-700">
                        <Keyboard size={12} className="opacity-70" />
                        <span>{hint.shortcut}</span>
                    </div>
                    {/* Arrow */}
                    <div
                        className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-l-transparent border-r-transparent border-slate-900 ${hint.placement === 'top'
                            ? 'border-t-4 border-b-0 top-full'
                            : 'border-b-4 border-t-0 bottom-full'
                            }`}
                    />
                </div>
            ))}

            {/* Helper text at bottom */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-tooltip pointer-events-none animate-in slide-in-from-bottom-4 fade-in duration-300">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/90 text-white text-sm rounded-full shadow-xl backdrop-blur-sm border border-slate-700">
                    <Keyboard size={16} className="text-blue-400" />
                    <span>Suelta <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs font-mono">Alt</kbd> para cerrar</span>
                </div>
            </div>
        </>,
        document.body
    );
};

export default ShortcutHintsOverlay;
