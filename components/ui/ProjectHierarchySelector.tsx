/**
 * ProjectHierarchySelector — Shared Client → Document hierarchy filter
 *
 * Reusable component for filtering APQP documents by client.
 * Modeled after the AMFE project browser hierarchy (AmfeSideDrawer).
 *
 * Usage: CP, PFD, and HO modules use this to show Client → Documents
 * instead of a flat document list.
 */

import React from 'react';
import { ChevronDown, Filter, Loader2, FolderOpen } from 'lucide-react';

export interface HierarchyDocument {
    id: string;
    label: string;
    sublabel?: string;
    client: string;
}

interface ProjectHierarchySelectorProps {
    /** Available client names */
    clients: string[];
    /** Currently selected client filter */
    selectedClient: string;
    /** Callback when client filter changes */
    onClientChange: (client: string) => void;
    /** Whether the list is loading */
    isLoading?: boolean;
    /** Module accent color for theming */
    accentColor?: 'teal' | 'cyan' | 'navy' | 'blue';
    /** Label for the module (e.g., "Plan de Control", "PFD") */
    moduleLabel?: string;
}

const ACCENT_CLASSES: Record<string, { select: string; badge: string }> = {
    teal: {
        select: 'focus:ring-teal-500 focus:border-teal-500',
        badge: 'bg-teal-100 text-teal-600',
    },
    cyan: {
        select: 'focus:ring-cyan-500 focus:border-cyan-500',
        badge: 'bg-cyan-100 text-cyan-600',
    },
    navy: {
        select: 'focus:ring-blue-500 focus:border-blue-500',
        badge: 'bg-blue-100 text-blue-600',
    },
    blue: {
        select: 'focus:ring-blue-500 focus:border-blue-500',
        badge: 'bg-blue-100 text-blue-600',
    },
};

/**
 * Inline client filter component that sits above a document list.
 * Renders a small dropdown to filter by client, matching AMFE style.
 */
const ProjectHierarchySelector: React.FC<ProjectHierarchySelectorProps> = ({
    clients,
    selectedClient,
    onClientChange,
    isLoading = false,
    accentColor = 'teal',
    moduleLabel,
}) => {
    const accent = ACCENT_CLASSES[accentColor] || ACCENT_CLASSES.teal;

    if (clients.length === 0 && !isLoading) {
        // No clients available — don't render the filter
        return null;
    }

    return (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
                <Filter size={14} className="text-gray-500" />
                <span className="text-xs font-medium text-gray-600">
                    Filtrar por Cliente
                </span>
                {selectedClient && (
                    <button
                        onClick={() => onClientChange('')}
                        className="ml-auto text-[10px] px-2 py-0.5 rounded text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition"
                    >
                        Limpiar
                    </button>
                )}
            </div>

            <div className="relative">
                <select
                    value={selectedClient}
                    onChange={(e) => onClientChange(e.target.value)}
                    disabled={isLoading}
                    className={`w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg bg-white appearance-none cursor-pointer focus:ring-2 ${accent.select} disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50`}
                >
                    <option value="">
                        {isLoading ? 'Cargando...' : `Todos los clientes${moduleLabel ? ` (${moduleLabel})` : ''}`}
                    </option>
                    {clients.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-2 text-gray-400">
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                    <span className="text-[10px]">Cargando clientes...</span>
                </div>
            )}

            {selectedClient && (
                <div className="mt-2 flex items-center gap-1.5">
                    <FolderOpen size={12} className="text-gray-400" />
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${accent.badge}`}>
                        {selectedClient}
                    </span>
                </div>
            )}
        </div>
    );
};

export default ProjectHierarchySelector;
