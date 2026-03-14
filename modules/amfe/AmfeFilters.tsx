/**
 * AMFE Filters Bar
 *
 * Provides filtering for the AMFE table by AP, Status, Operation, 6M type,
 * and free text search. Also includes column visibility toggle pills.
 *
 * Data model: AP and status live on causes (not failures). A failure passes
 * the filter if ANY of its causes match the AP/status/search criteria.
 */

import React, { useMemo } from 'react';
import { AmfeOperation, ActionPriority, AMFE_STATUS_OPTIONS, WORK_ELEMENT_TYPES, WORK_ELEMENT_LABELS, WorkElementType } from './amfeTypes';
import { Filter, X, Search, Eye } from 'lucide-react';
import { ColumnGroupVisibility, COLUMN_GROUP_LABELS, COLUMN_GROUP_COLORS, COLUMN_GROUP_TOOLTIPS } from './useAmfeColumnVisibility';

export interface AmfeFilterState {
    ap: string;       // '' | 'H' | 'M' | 'L'
    status: string;   // '' | AMFE_STATUS_OPTIONS values
    operation: string; // '' | operation id
    weType: string;   // '' | WorkElementType
    search: string;   // free text
}

export const EMPTY_FILTERS: AmfeFilterState = {
    ap: '', status: '', operation: '', weType: '', search: ''
};

export function hasActiveFilters(filters: AmfeFilterState): boolean {
    return filters.ap !== '' || filters.status !== '' || filters.operation !== '' || filters.weType !== '' || filters.search !== '';
}

/**
 * Apply filters to operations, returning only operations/children that match.
 * Preserves the hierarchy structure but removes non-matching branches.
 *
 * AP and status filters check `fail.causes.some(c => ...)` — a failure is
 * included if at least one of its causes matches the filter criteria.
 * Text search includes both failure-level fields and cause-level fields.
 */
export function applyFilters(operations: AmfeOperation[], filters: AmfeFilterState): AmfeOperation[] {
    if (!hasActiveFilters(filters)) return operations;

    const searchLower = filters.search.toLowerCase();

    return operations
        .filter(op => !filters.operation || op.id === filters.operation)
        .map(op => {
            const filteredWEs = op.workElements
                .filter(we => !filters.weType || we.type === filters.weType)
                .map(we => {
                    const filteredFuncs = we.functions.map(func => {
                        const filteredFails = func.failures.filter(fail => {
                            // AP filter: at least one cause must match
                            if (filters.ap && !fail.causes.some(c => c.ap === filters.ap)) return false;

                            // Status filter: at least one cause must match
                            if (filters.status && !fail.causes.some(c => c.status === filters.status)) return false;

                            // Text search: check failure-level fields + all cause-level fields
                            if (searchLower) {
                                // Failure-level fields
                                const failureHaystack = [
                                    fail.description, fail.effectLocal, fail.effectNextLevel, fail.effectEndUser,
                                ].join(' ').toLowerCase();

                                // Cause-level fields (aggregate all causes)
                                const causesHaystack = fail.causes.map(c => [
                                    c.cause, c.preventionControl, c.detectionControl,
                                    c.preventionAction, c.detectionAction, c.responsible,
                                    c.actionTaken, c.observations,
                                ].join(' ')).join(' ').toLowerCase();

                                const fullHaystack = failureHaystack + ' ' + causesHaystack;
                                if (!fullHaystack.includes(searchLower)) return false;
                            }
                            return true;
                        });
                        return { ...func, failures: filteredFails };
                    }).filter(func => func.failures.length > 0);

                    return { ...we, functions: filteredFuncs };
                }).filter(we => we.functions.length > 0);

            return { ...op, workElements: filteredWEs };
        })
        .filter(op => op.workElements.length > 0);
}

interface Props {
    filters: AmfeFilterState;
    onFiltersChange: (filters: AmfeFilterState) => void;
    operations: AmfeOperation[];
    columnVisibility?: ColumnGroupVisibility;
    onToggleColumn?: (group: keyof ColumnGroupVisibility) => void;
    isColumnDefault?: boolean;
    onShowAllColumns?: () => void;
    hasCollapsed?: boolean;
    onCollapseAll?: () => void;
    onExpandAll?: () => void;
    readOnly?: boolean;
}

const AmfeFilters: React.FC<Props> = ({ filters, onFiltersChange, operations, columnVisibility, onToggleColumn, isColumnDefault, onShowAllColumns, hasCollapsed, onCollapseAll, onExpandAll, readOnly }) => {
    const active = hasActiveFilters(filters);

    const update = (field: keyof AmfeFilterState, value: string) => {
        onFiltersChange({ ...filters, [field]: value });
    };

    const selectClass = "border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-200 focus:border-blue-400 outline-none";

    return (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-1.5">
            <div className="max-w-[1800px] mx-auto flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 text-xs font-bold text-gray-600">
                    <Filter size={13} />
                    Filtros
                </div>

                {readOnly && (
                    <div className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-indigo-200">
                        <Eye size={10} />
                        MODO VISTA
                    </div>
                )}

                {/* AP Filter */}
                <select
                    value={filters.ap}
                    onChange={e => update('ap', e.target.value)}
                    className={selectClass}
                    aria-label="Filtrar por prioridad de accion"
                >
                    <option value="">AP: Todos</option>
                    <option value="H">AP: Alto (H)</option>
                    <option value="M">AP: Medio (M)</option>
                    <option value="L">AP: Bajo (L)</option>
                </select>

                {/* Status Filter */}
                <select
                    value={filters.status}
                    onChange={e => update('status', e.target.value)}
                    className={selectClass}
                    aria-label="Filtrar por estado"
                >
                    <option value="">Estado: Todos</option>
                    {AMFE_STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                {/* Operation Filter */}
                <select
                    value={filters.operation}
                    onChange={e => update('operation', e.target.value)}
                    className={selectClass}
                    aria-label="Filtrar por operación"
                >
                    <option value="">Operación: Todas</option>
                    {operations.map(op => (
                        <option key={op.id} value={op.id}>{op.opNumber || '?'} - {op.name || '(sin nombre)'}</option>
                    ))}
                </select>

                {/* 6M Type Filter */}
                <select
                    value={filters.weType}
                    onChange={e => update('weType', e.target.value)}
                    className={selectClass}
                    aria-label="Filtrar por tipo 6M"
                >
                    <option value="">6M: Todos</option>
                    {WORK_ELEMENT_TYPES.map(t => (
                        <option key={t} value={t}>{WORK_ELEMENT_LABELS[t]}</option>
                    ))}
                </select>

                {/* Free text search */}
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={e => update('search', e.target.value)}
                        placeholder="Buscar... (Ctrl+F)"
                        className={`${selectClass} pl-6 w-40`}
                        data-amfe-search="true"
                        data-shortcut="Ctrl+F"
                        aria-label="Buscar texto en AMFE"
                    />
                </div>

                {/* Clear filters */}
                {active && (
                    <button
                        onClick={() => onFiltersChange(EMPTY_FILTERS)}
                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition"
                    >
                        <X size={12} />
                        Limpiar
                    </button>
                )}

                {/* Collapse/Expand all */}
                {onCollapseAll && onExpandAll && (
                    <div className="flex items-center gap-1 border-l border-gray-200 pl-2 ml-1">
                        <button onClick={hasCollapsed ? onExpandAll : onCollapseAll} className="text-[10px] text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100 transition">
                            {hasCollapsed ? 'Expandir Todo' : 'Colapsar Todo'}
                        </button>
                    </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Column visibility toggles (integrated from separate bar) */}
                {columnVisibility && onToggleColumn && (
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 font-medium">Columnas:</span>
                        {(Object.keys(COLUMN_GROUP_LABELS) as (keyof ColumnGroupVisibility)[]).map(group => (
                            <button
                                key={group}
                                onClick={() => onToggleColumn(group)}
                                title={COLUMN_GROUP_TOOLTIPS[group]}
                                className={`text-[10px] px-2 py-0.5 rounded-full border transition font-medium ${
                                    columnVisibility[group]
                                        ? `${COLUMN_GROUP_COLORS[group]} border-current`
                                        : 'bg-gray-50 text-gray-300 border-gray-200 line-through'
                                }`}
                            >
                                {COLUMN_GROUP_LABELS[group]}
                            </button>
                        ))}
                        {isColumnDefault === false && onShowAllColumns && (
                            <button onClick={onShowAllColumns} className="text-[10px] text-blue-500 hover:text-blue-700 ml-1">
                                Mostrar todas
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AmfeFilters;
