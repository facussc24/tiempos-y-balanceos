/**
 * InheritanceBadge — Visual indicator for item inheritance status in variant documents.
 *
 * Three states:
 *   - "inherited"  → Grey badge: item comes from master without changes
 *   - "modified"   → Amber/orange badge: master item was modified in the variant
 *   - "own"        → Blue badge: item was added exclusively in the variant
 *
 * Follows the project design system (DESIGN_SYSTEM.md) for badge styling.
 * Only rendered inside variant documents; master documents should not show these.
 *
 * @module InheritanceBadge
 */

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link2, Pencil, Plus } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InheritanceStatus = 'inherited' | 'modified' | 'own';

interface InheritanceBadgeProps {
    status: InheritanceStatus;
    /** Optional: compact mode shows only icon + abbreviation */
    compact?: boolean;
    className?: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<InheritanceStatus, {
    label: string;
    shortLabel: string;
    tooltip: string;
    bg: string;
    text: string;
    border: string;
    icon: React.ReactNode;
}> = {
    inherited: {
        label: 'HEREDADO',
        shortLabel: 'HER',
        tooltip: 'Este item proviene del documento maestro sin modificaciones',
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        icon: <Link2 size={10} />,
    },
    modified: {
        label: 'MODIFICADO',
        shortLabel: 'MOD',
        tooltip: 'Este item fue heredado del maestro y modificado en esta variante',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: <Pencil size={10} />,
    },
    own: {
        label: 'PROPIO',
        shortLabel: 'PROP',
        tooltip: 'Este item fue agregado exclusivamente en esta variante',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: <Plus size={10} />,
    },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InheritanceBadge: React.FC<InheritanceBadgeProps> = ({
    status,
    compact = false,
    className = '',
}) => {
    const config = STATUS_CONFIG[status];
    const [showTooltip, setShowTooltip] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
    const badgeRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    React.useLayoutEffect(() => {
        if (showTooltip && badgeRef.current && tooltipRef.current) {
            const triggerRect = badgeRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();

            let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
            let top = triggerRect.top - tooltipRect.height - 8;

            const padding = 12;
            left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

            if (top < padding) {
                top = triggerRect.bottom + 8;
            }

            setCoords({ top, left });
        }
    }, [showTooltip]);

    const displayLabel = compact ? config.shortLabel : config.label;

    return (
        <>
            <span
                ref={badgeRef}
                className={`
                    inline-flex items-center gap-1
                    ${compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5'}
                    rounded-md text-[10px] font-bold uppercase tracking-wide
                    border ${config.bg} ${config.text} ${config.border}
                    cursor-default select-none
                    ${className}
                `.trim().replace(/\s+/g, ' ')}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                role="status"
                aria-label={config.tooltip}
            >
                {config.icon}
                {displayLabel}
            </span>

            {showTooltip && createPortal(
                <div
                    ref={tooltipRef}
                    role="tooltip"
                    className="fixed z-[9999] w-max max-w-[280px] px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-150 border border-slate-700 border-l-2 border-l-blue-500 font-medium leading-relaxed"
                    style={{
                        top: coords ? coords.top : -9999,
                        left: coords ? coords.left : -9999,
                        visibility: coords ? 'visible' : 'hidden',
                    }}
                >
                    {config.tooltip}
                </div>,
                document.body
            )}
        </>
    );
};

export default InheritanceBadge;
