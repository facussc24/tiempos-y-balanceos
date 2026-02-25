/**
 * EducationalTooltip - Enhanced tooltip for technical terms
 * 
 * Displays technical Lean Manufacturing terms with:
 * - Simple name in Spanish
 * - Clear definition
 * - Formula (if applicable)
 * - Practical example
 * 
 * Uses the centralized LEAN_TERMS dictionary for consistency.
 * 
 * @module EducationalTooltip
 * @version 1.0.0
 */

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, BookOpen, Calculator, Lightbulb } from 'lucide-react';
import { LEAN_TERMS, LeanTermDefinition, getTerm } from '../../utils/leanTerms';
import { logger } from '../../utils/logger';

interface EducationalTooltipProps {
    /** Key of the term in LEAN_TERMS dictionary (e.g., 'OEE', 'TAKT_TIME') */
    termKey: string;
    /** Optional: Override the trigger element. Default is a help icon. */
    children?: React.ReactNode;
    /** Optional: Additional CSS classes for the trigger wrapper */
    className?: string;
    /** Optional: Size of the default help icon */
    iconSize?: number;
    /** Optional: Show simplified name inline next to the icon */
    showLabel?: boolean;
}

/**
 * EducationalTooltip Component
 * 
 * Usage:
 * ```tsx
 * <EducationalTooltip termKey="OEE" />
 * <EducationalTooltip termKey="TAKT_TIME" showLabel />
 * <span>Takt Time <EducationalTooltip termKey="TAKT_TIME" /></span>
 * ```
 */
export const EducationalTooltip: React.FC<EducationalTooltipProps> = ({
    termKey,
    children,
    className = "",
    iconSize = 14,
    showLabel = false
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Get term definition from dictionary
    const termDef = getTerm(termKey);

    // If term not found, render nothing or fallback
    if (!termDef) {
        logger.warn('EducationalTooltip', 'Term not found in dictionary', { termKey });
        return null;
    }

    // Calculate position when visible
    React.useLayoutEffect(() => {
        if (isVisible && triggerRef.current && tooltipRef.current) {
            const triggerRect = triggerRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();

            // Desired position: centered above trigger
            let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
            let top = triggerRect.top - tooltipRect.height - 12;

            // Boundary clamping
            const padding = 16;
            const minLeft = padding;
            const maxLeft = window.innerWidth - tooltipRect.width - padding;

            // Clamp horizontal
            left = Math.max(minLeft, Math.min(left, maxLeft));

            // Flip to bottom if no space on top
            if (top < padding) {
                top = triggerRect.bottom + 12;
            }

            // Also check bottom overflow
            if (top + tooltipRect.height > window.innerHeight - padding) {
                top = triggerRect.top - tooltipRect.height - 12;
            }

            setCoords({ top, left });
        }
    }, [isVisible]);

    const handleMouseEnter = () => {
        setIsVisible(true);
    };

    const handleMouseLeave = () => {
        setIsVisible(false);
        setCoords(null);
    };

    return (
        <>
            <span
                ref={triggerRef}
                className={`inline-flex items-center gap-1 cursor-help ${className}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handleMouseEnter}
                onBlur={handleMouseLeave}
                tabIndex={0}
                role="button"
                aria-label={`Información sobre ${termDef.simple}`}
            >
                {children || (
                    <HelpCircle
                        size={iconSize}
                        className="text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0"
                    />
                )}
                {showLabel && (
                    <span className="text-[10px] text-slate-500 hidden sm:inline">
                        {termDef.simple}
                    </span>
                )}
            </span>

            {isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    className="fixed z-[9999] w-80 max-w-[90vw] bg-slate-900 text-white rounded-xl shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-150 border border-slate-700 overflow-hidden"
                    style={{
                        top: coords ? coords.top : -9999,
                        left: coords ? coords.left : -9999,
                        visibility: coords ? 'visible' : 'hidden'
                    }}
                >
                    {/* Header */}
                    <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen size={14} className="text-blue-400" />
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                                {termDef.term}
                            </span>
                        </div>
                        <h4 className="font-semibold text-white text-sm">
                            {termDef.simple}
                        </h4>
                    </div>

                    {/* Content */}
                    <div className="px-4 py-3 space-y-3">
                        {/* Definition */}
                        <p className="text-slate-300 text-xs leading-relaxed">
                            {termDef.definition}
                        </p>

                        {/* Formula (if available) */}
                        {termDef.formula && (
                            <div className="flex items-start gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
                                <Calculator size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide block mb-0.5">
                                        Fórmula
                                    </span>
                                    <code className="text-emerald-300 text-xs font-mono">
                                        {termDef.formula}
                                    </code>
                                </div>
                            </div>
                        )}

                        {/* Example (if available) */}
                        {termDef.example && (
                            <div className="flex items-start gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
                                <Lightbulb size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide block mb-0.5">
                                        Ejemplo
                                    </span>
                                    <p className="text-slate-300 text-xs leading-relaxed">
                                        {termDef.example}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer hint */}
                    <div className="bg-slate-800/50 px-4 py-2 border-t border-slate-700/50">
                        <p className="text-[10px] text-slate-500 text-center">
                            Mantén el cursor para ver más detalles
                        </p>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

/**
 * Inline tooltip for use within text
 * Shows term with underline and tooltip on hover
 * 
 * Usage:
 * ```tsx
 * <p>El <InlineTermTooltip termKey="TAKT_TIME">Takt Time</InlineTermTooltip> es clave...</p>
 * ```
 */
interface InlineTermTooltipProps {
    termKey: string;
    children: React.ReactNode;
}

export const InlineTermTooltip: React.FC<InlineTermTooltipProps> = ({ termKey, children }) => {
    return (
        <EducationalTooltip termKey={termKey} className="inline">
            <span className="border-b border-dotted border-slate-400 hover:border-blue-500 hover:text-blue-600 transition-colors cursor-help">
                {children}
            </span>
        </EducationalTooltip>
    );
};

export default EducationalTooltip;
