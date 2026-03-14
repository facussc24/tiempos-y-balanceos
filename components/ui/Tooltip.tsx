import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

interface Props {
    content: string | React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    shortcut?: string; // New prop for keyboard shortcuts
}

export const Tooltip: React.FC<Props> = ({ content, children, className = "", shortcut }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Calculate position when visible
    React.useLayoutEffect(() => {
        if (isVisible && triggerRef.current && tooltipRef.current) {
            const triggerRect = triggerRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();

            // Desired Center Position (centered on trigger)
            let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
            let top = triggerRect.top - tooltipRect.height - 10; // 10px offset above

            // Boundary Clamping (Keep on screen with padding)
            const padding = 12;
            const minLeft = padding;
            const maxLeft = window.innerWidth - tooltipRect.width - padding;

            // Clamp horizontal position
            left = Math.max(minLeft, Math.min(left, maxLeft));

            // Check Top overflow - flip to bottom if needed
            if (top < padding) {
                top = triggerRect.bottom + 10; // Flip to below trigger
            }

            // Also check bottom overflow
            if (top + tooltipRect.height > window.innerHeight - padding) {
                top = triggerRect.top - tooltipRect.height - 10;
            }

            setCoords({ top, left });
        }
    }, [isVisible]);

    const handleMouseEnter = () => {
        setIsVisible(true);
    };

    const handleFocus = () => {
        setIsVisible(true);
    };

    const handleBlur = () => {
        setIsVisible(false);
    };

    return (
        <>
            <div
                ref={triggerRef}
                className={`relative inline-flex items-center ${className}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setIsVisible(false)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsVisible(v => !v); }
                    if (e.key === 'Escape') setIsVisible(false);
                }}
                tabIndex={0}
                role="button"
                aria-describedby={isVisible ? 'tooltip-content' : undefined}
            >
                {children || <HelpCircle size={14} className="text-slate-400 cursor-help hover:text-blue-500 transition-colors" />}
            </div>

            {isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    id="tooltip-content"
                    role="tooltip"
                    className="fixed z-[9999] w-max max-w-[320px] p-2.5 bg-slate-900 text-white text-xs rounded-lg shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-150 border border-slate-700 border-l-2 border-l-blue-500 font-medium flex items-center gap-2"
                    style={{
                        top: coords ? coords.top : -9999, // Hide until calculated
                        left: coords ? coords.left : -9999,
                        visibility: coords ? 'visible' : 'hidden' // Force hide during first render frame
                    }}
                >
                    <div className="relative z-10 leading-relaxed whitespace-pre-wrap">
                        {content}
                    </div>

                    {shortcut && (
                        <div className="flex items-center bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-300 shadow-sm whitespace-nowrap">
                            {shortcut}
                        </div>
                    )}
                </div>,
                document.body
            )}
        </>
    );
};
