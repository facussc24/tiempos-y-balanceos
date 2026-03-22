/**
 * AMFE Risk Summary Bar
 *
 * Compact, collapsible bar showing AP (Action Priority) distribution at a glance.
 * Sits between AmfeFilters and the main table in the AMFE module.
 *
 * Auto-expands when AP=H causes exist to alert the user.
 * Collapse state persists via localStorage.
 */

import React, { useMemo, useState } from 'react';
import { AmfeDocument, ActionPriority } from './amfeTypes';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';

interface AmfeRiskSummaryBarProps {
    data: AmfeDocument;
}

const STORAGE_KEY = 'amfe-risk-bar-collapsed';

function readCollapsedState(): boolean | null {
    try {
        const val = localStorage.getItem(STORAGE_KEY);
        if (val === 'true') return true;
        if (val === 'false') return false;
        return null;
    } catch {
        return null;
    }
}

const AmfeRiskSummaryBar: React.FC<AmfeRiskSummaryBarProps> = ({ data }) => {
    const stats = useMemo(() => {
        let apH = 0, apM = 0, apL = 0, total = 0;
        let sodComplete = 0;

        for (const op of data.operations) {
            for (const we of op.workElements) {
                for (const func of we.functions) {
                    for (const fail of func.failures) {
                        for (const cause of fail.causes) {
                            total++;
                            if (cause.ap === ActionPriority.HIGH || cause.ap === 'H') apH++;
                            else if (cause.ap === ActionPriority.MEDIUM || cause.ap === 'M') apM++;
                            else if (cause.ap === ActionPriority.LOW || cause.ap === 'L') apL++;

                            const s = Number(fail.severity);
                            const o = Number(cause.occurrence);
                            const d = Number(cause.detection);
                            if (!isNaN(s) && s >= 1 && !isNaN(o) && o >= 1 && !isNaN(d) && d >= 1) {
                                sodComplete++;
                            }
                        }
                    }
                }
            }
        }

        const coveragePercent = total > 0 ? Math.round((sodComplete / total) * 100) : 0;
        return { apH, apM, apL, total, coveragePercent };
    }, [data]);

    // Default: expanded if apH > 0, collapsed if apH === 0
    // Persisted user preference overrides the default
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        const persisted = readCollapsedState();
        if (persisted !== null) return persisted;
        return stats.apH === 0;
    });

    const toggleCollapsed = () => {
        const next = !collapsed;
        setCollapsed(next);
        try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* noop */ }
    };

    // Don't render if no operations
    if (data.operations.length === 0) return null;
    // Don't render if no causes at all
    if (stats.total === 0) return null;

    const barWidth = (count: number) =>
        stats.total > 0 ? `${Math.max((count / stats.total) * 100, count > 0 ? 2 : 0)}%` : '0%';

    return (
        <div className="bg-white border-b border-gray-200 no-print">
            {/* Toggle header */}
            <button
                onClick={toggleCollapsed}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50/50 transition-colors duration-150"
                aria-expanded={!collapsed}
                aria-label="Resumen de Riesgo"
            >
                {collapsed ? (
                    <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />
                ) : (
                    <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />
                )}
                <span className="text-xs font-semibold text-slate-700">Resumen de Riesgo</span>

                {/* Inline badges when collapsed */}
                {collapsed && (
                    <div className="flex items-center gap-2 ml-2">
                        {stats.apH > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                H: {stats.apH}
                            </span>
                        )}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                            M: {stats.apM}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                            L: {stats.apL}
                        </span>
                    </div>
                )}

                <div className="flex-1" />
                <span className="text-[10px] text-slate-400">
                    S/O/D: {stats.coveragePercent}%
                </span>
            </button>

            {/* Expanded content */}
            {!collapsed && (
                <div className="px-4 pb-3">
                    {/* AP distribution bars */}
                    <div className="space-y-1.5 max-w-[600px]">
                        {/* H bar */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold w-6 text-center bg-red-500 text-white rounded px-1">H</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className="bg-red-500 h-full rounded-full transition-all duration-300"
                                    style={{ width: barWidth(stats.apH) }}
                                />
                            </div>
                            <span className="text-xs font-bold text-slate-700 w-8 text-right">{stats.apH}</span>
                        </div>
                        {/* M bar */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold w-6 text-center bg-amber-500 text-white rounded px-1">M</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className="bg-amber-500 h-full rounded-full transition-all duration-300"
                                    style={{ width: barWidth(stats.apM) }}
                                />
                            </div>
                            <span className="text-xs font-bold text-slate-700 w-8 text-right">{stats.apM}</span>
                        </div>
                        {/* L bar */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold w-6 text-center bg-emerald-500 text-white rounded px-1">L</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                    style={{ width: barWidth(stats.apL) }}
                                />
                            </div>
                            <span className="text-xs font-bold text-slate-700 w-8 text-right">{stats.apL}</span>
                        </div>
                    </div>

                    {/* Alert / success message */}
                    <div className={`mt-2.5 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                        stats.apH > 0
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                    }`}>
                        {stats.apH > 0 ? (
                            <>
                                <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                                <span>{stats.apH} {stats.apH === 1 ? 'causa' : 'causas'} con prioridad alta {stats.apH === 1 ? 'requiere' : 'requieren'} accion inmediata</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />
                                <span>Sin prioridades altas pendientes</span>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AmfeRiskSummaryBar;
