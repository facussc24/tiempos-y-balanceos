/**
 * LoadingOverlay — Generic loading overlay for module document loading.
 *
 * Displays a centered spinner with optional message and table skeleton.
 * Used by AMFE, Control Plan, HO, and PFD modules to provide visual feedback
 * while loading documents from SQLite.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
    /** Message shown below the spinner */
    message?: string;
    /** Spinner accent color (Tailwind border-t color class, default: border-t-blue-500) */
    accentColor?: string;
    /** Show a table skeleton below the spinner (default: true) */
    showSkeleton?: boolean;
}

/**
 * Full-area loading overlay with spinner, message, and optional table skeleton.
 * Mounts inside a flex container and fills available space.
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    message = 'Cargando documento...',
    accentColor = 'text-blue-500',
    showSkeleton = true,
}) => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[300px]" role="status" aria-live="polite">
        {/* Spinner */}
        <Loader2 size={36} className={`${accentColor} animate-spin mb-3`} />
        <p className="text-sm text-gray-500 font-medium mb-6">{message}</p>

        {/* Table skeleton for perceived progress */}
        {showSkeleton && (
            <div className="w-full max-w-4xl bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm" aria-hidden="true">
                {/* Header row */}
                <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 flex gap-4">
                    {[120, 80, 96, 64, 72].map((w, i) => (
                        <div key={i} className="h-3 bg-slate-200 rounded animate-pulse" style={{ width: w }} />
                    ))}
                </div>
                {/* Data rows */}
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="px-4 py-3 border-b border-gray-100 flex gap-4 items-center" style={{ opacity: 1 - i * 0.15 }}>
                        <div className="h-3 w-28 bg-slate-200 rounded animate-pulse" />
                        <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
                        <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                        <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                        <div className="h-3 w-12 bg-slate-200 rounded animate-pulse" />
                    </div>
                ))}
            </div>
        )}
    </div>
);
