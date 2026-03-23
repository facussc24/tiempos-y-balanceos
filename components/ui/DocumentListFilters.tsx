/**
 * Document List Filters
 *
 * Reusable filter bar for document lists across the Document Hub
 * and AMFE side drawer. Provides Client, Family/Project, and
 * free-text search filters that operate on DocumentRegistryEntry[].
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Filter, Search, X } from 'lucide-react';
import type { DocumentRegistryEntry, DocumentType } from '../../modules/registry/documentRegistryTypes';
import { logger } from '../../utils/logger';

export interface DocumentListFiltersProps {
    /** Source documents to filter */
    documents: DocumentRegistryEntry[];
    /** Callback with filtered results whenever filters change */
    onFilteredChange: (filtered: DocumentRegistryEntry[]) => void;
    /** Module type for color-coding (optional) */
    moduleType?: DocumentType;
    /** Use compact layout for side drawers */
    compact?: boolean;
}

interface FilterState {
    client: string;
    project: string;
    search: string;
}

const EMPTY_STATE: FilterState = { client: '', project: '', search: '' };

/**
 * Extract unique project/family names from document list.
 * Uses `linkedAmfeProject` if present, otherwise falls back to `name`.
 */
function extractProjectName(doc: DocumentRegistryEntry): string {
    return doc.linkedAmfeProject || doc.name;
}

const DocumentListFilters: React.FC<DocumentListFiltersProps> = ({
    documents,
    onFilteredChange,
    moduleType,
    compact = false,
}) => {
    const [filters, setFilters] = useState<FilterState>(EMPTY_STATE);

    // Extract unique clients sorted alphabetically
    const clientOptions = useMemo(() => {
        const set = new Set<string>();
        for (const doc of documents) {
            if (doc.client) set.add(doc.client);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [documents]);

    // Extract unique project names, optionally scoped to selected client
    const projectOptions = useMemo(() => {
        const set = new Set<string>();
        const scope = filters.client
            ? documents.filter(d => d.client === filters.client)
            : documents;
        for (const doc of scope) {
            const pName = extractProjectName(doc);
            if (pName) set.add(pName);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [documents, filters.client]);

    // Apply filters and notify parent
    const filtered = useMemo(() => {
        let result = documents;

        if (filters.client) {
            result = result.filter(d => d.client === filters.client);
        }

        if (filters.project) {
            result = result.filter(d => extractProjectName(d) === filters.project);
        }

        if (filters.search.trim()) {
            const q = filters.search.toLowerCase();
            result = result.filter(d =>
                d.name.toLowerCase().includes(q) ||
                d.partNumber.toLowerCase().includes(q) ||
                d.partName.toLowerCase().includes(q) ||
                d.client.toLowerCase().includes(q) ||
                (d.linkedAmfeProject || '').toLowerCase().includes(q)
            );
        }

        return result;
    }, [documents, filters]);

    // Notify parent of filtered results
    useEffect(() => {
        onFilteredChange(filtered);
    }, [filtered, onFilteredChange]);

    // Count active filters
    const activeCount = useMemo(() => {
        let count = 0;
        if (filters.client) count++;
        if (filters.project) count++;
        if (filters.search.trim()) count++;
        return count;
    }, [filters]);

    const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
        setFilters(prev => {
            const next = { ...prev, [key]: value };
            // When client changes, reset project if no longer valid
            if (key === 'client') {
                next.project = '';
            }
            return next;
        });
        logger.debug('DocumentListFilters', `Filter changed: ${key}`, { value });
    }, []);

    const clearAll = useCallback(() => {
        setFilters(EMPTY_STATE);
        logger.debug('DocumentListFilters', 'All filters cleared');
    }, []);

    // Determine accent color based on moduleType
    const accentClass = moduleType
        ? {
            pfd: 'focus:ring-cyan-200 focus:border-cyan-400',
            amfe: 'focus:ring-blue-200 focus:border-blue-400',
            controlPlan: 'focus:ring-green-200 focus:border-green-400',
            hojaOperaciones: 'focus:ring-indigo-200 focus:border-indigo-400',
        }[moduleType]
        : 'focus:ring-blue-200 focus:border-blue-400';

    const selectClass = `border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:ring-1 ${accentClass} outline-none appearance-none cursor-pointer`;
    const searchInputClass = `border border-gray-300 rounded pl-6 pr-2 py-1 text-xs bg-white focus:ring-1 ${accentClass} outline-none w-40`;

    if (compact) {
        // Compact layout for side drawers
        return (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                    <Filter size={14} className="text-gray-500" />
                    <span className="text-xs font-medium text-gray-600">Filtros</span>
                    {activeCount > 0 && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            {activeCount}
                        </span>
                    )}
                    {activeCount > 0 && (
                        <button
                            onClick={clearAll}
                            className="ml-auto text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                            Limpiar
                        </button>
                    )}
                </div>

                {/* Client */}
                <div className="mb-2">
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Cliente</label>
                    <select
                        value={filters.client}
                        onChange={e => updateFilter('client', e.target.value)}
                        className={`w-full ${selectClass}`}
                        aria-label="Filtrar por cliente"
                    >
                        <option value="">Todos los clientes</option>
                        {clientOptions.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                {/* Family / Project */}
                <div className="mb-2">
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Familia / Proyecto</label>
                    <select
                        value={filters.project}
                        onChange={e => updateFilter('project', e.target.value)}
                        className={`w-full ${selectClass}`}
                        aria-label="Filtrar por familia o proyecto"
                    >
                        <option value="">Todos los proyectos</option>
                        {projectOptions.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>

                {/* Search */}
                <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Buscar</label>
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={filters.search}
                            onChange={e => updateFilter('search', e.target.value)}
                            placeholder="Nombre, pieza, cliente..."
                            className={`w-full ${searchInputClass}`}
                            aria-label="Buscar documentos"
                        />
                        {filters.search && (
                            <button
                                onClick={() => updateFilter('search', '')}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                aria-label="Limpiar búsqueda"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Result count */}
                {activeCount > 0 && (
                    <div className="mt-2 text-[10px] text-gray-500">
                        {filtered.length} de {documents.length} documentos
                    </div>
                )}
            </div>
        );
    }

    // Standard layout for Document Hub (white background bar)
    return (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-1.5 overflow-x-auto">
            <div className="max-w-[1400px] mx-auto flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <Filter size={14} className="text-gray-500" />
                    {activeCount > 0 && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            {activeCount}
                        </span>
                    )}
                </div>

                {/* Client */}
                <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-medium text-gray-500">Cliente:</label>
                    <select
                        value={filters.client}
                        onChange={e => updateFilter('client', e.target.value)}
                        className={selectClass}
                        aria-label="Filtrar por cliente"
                    >
                        <option value="">Todos</option>
                        {clientOptions.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                {/* Family / Project */}
                <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-medium text-gray-500">Proyecto:</label>
                    <select
                        value={filters.project}
                        onChange={e => updateFilter('project', e.target.value)}
                        className={selectClass}
                        aria-label="Filtrar por familia o proyecto"
                    >
                        <option value="">Todos</option>
                        {projectOptions.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-xs ml-auto">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={e => updateFilter('search', e.target.value)}
                        placeholder="Buscar por nombre, pieza, cliente..."
                        className={`w-full ${searchInputClass}`}
                        aria-label="Buscar documentos"
                    />
                    {filters.search && (
                        <button
                            onClick={() => updateFilter('search', '')}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            aria-label="Limpiar búsqueda"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Clear all */}
                {activeCount > 0 && (
                    <button
                        onClick={clearAll}
                        className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition flex items-center gap-1"
                    >
                        <X size={12} />
                        Limpiar
                    </button>
                )}

                {/* Result count */}
                {activeCount > 0 && (
                    <span className="text-[10px] text-gray-500">
                        {filtered.length} de {documents.length}
                    </span>
                )}
            </div>
        </div>
    );
};

export default DocumentListFilters;
