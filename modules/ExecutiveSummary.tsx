/**
 * Executive Summary Module — Clean Report View
 * 
 * Synthesized view of capacity analysis per sector.
 * Designed for clarity, quick scanning, and clean PDF/Excel export.
 * 
 * @module modules/ExecutiveSummary
 * @version 2.0.0
 */

import React, { useMemo, useState } from 'react';
import { ProjectData } from '../types';
import {
    calculateExecutiveSummary,
    exportSummaryToExcel,
    exportFullSummaryToExcel,
    exportSummaryToPDF,
} from '../utils/executiveSummaryCalc';
import { Download, FileText, Printer } from 'lucide-react';

// ============================================================================
// Props
// ============================================================================

interface Props {
    data: ProjectData;
}

// ============================================================================
// Main Component
// ============================================================================

export const ExecutiveSummary: React.FC<Props> = ({ data }) => {
    const activeShifts = data.meta.activeShifts || 1;
    const [selectedShift, setSelectedShift] = useState(activeShifts);

    const summary = useMemo(() => calculateExecutiveSummary(data), [data]);

    // Only show up to activeShifts (user-configured), not all defined shifts
    const maxShifts = Math.min(activeShifts, summary.scenarios.length);
    const currentShift = Math.min(selectedShift, maxShifts);
    const scenario = summary.scenarios[currentShift - 1];
    const visibleScenarios = summary.scenarios.slice(0, maxShifts);

    if (!scenario) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p className="text-lg font-semibold text-slate-500">Sin datos para generar reporte</p>
                    <p className="text-sm text-slate-400 mt-1">Configure turnos y demanda en Panel de Control</p>
                </div>
            </div>
        );
    }

    const fatiguePct = data.meta.fatigueCompensation?.globalPercent ?? 10;
    const fatigueOn = data.meta.fatigueCompensation?.enabled !== false;

    return (
        <div className="max-w-5xl mx-auto py-2">

            {/* ── Header ────────────────────────────────────────── */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Resumen Ejecutivo
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {summary.projectName} · {new Date(summary.calculatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Shift tabs — only show active shifts */}
                    {maxShifts > 1 && (
                        <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5 mr-3">
                            {Array.from({ length: maxShifts }, (_, i) => i + 1).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSelectedShift(s)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${currentShift === s
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {s}T
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => exportSummaryToPDF(summary, currentShift - 1)}
                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Exportar PDF"
                    >
                        <Printer size={18} />
                    </button>
                    <button
                        onClick={() => exportSummaryToExcel(scenario, summary.projectName)}
                        className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title={`Excel ${currentShift}T`}
                    >
                        <Download size={18} />
                    </button>
                    <button
                        onClick={() => exportFullSummaryToExcel(summary)}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Excel completo (todos los turnos)"
                    >
                        <FileText size={18} />
                    </button>
                </div>
            </div>

            {/* ── KPI Strip ─────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-px bg-slate-200 rounded-xl overflow-hidden mb-8 shadow-sm">
                {([
                    {
                        label: 'Takt Time',
                        value: `${scenario.taktTime.toFixed(1)}s`,
                        sub: `Objetivo: ${scenario.dailyDemand.toLocaleString()} pzs/día`,
                    },
                    {
                        label: 'Capacidad Real',
                        value: scenario.hasBottleneck
                            ? `${Math.round(scenario.piecesPerHour)} pzs/h`
                            : 'Sin datos',
                        sub: scenario.hasBottleneck
                            ? `${scenario.theoreticalCapacity.toLocaleString()} pzs/día · Cuello: ${scenario.bottleneckCycleTime.toFixed(1)}s`
                            : 'Balancear primero',
                        alert: scenario.hasBottleneck && scenario.bottleneckCycleTime > scenario.taktTime,
                        muted: !scenario.hasBottleneck,
                    },
                    {
                        label: 'Estaciones',
                        value: scenario.hasBalancingData
                            ? scenario.totalOperatorsBalanced
                            : 'Sin datos',
                        sub: scenario.hasBalancingData
                            ? `${scenario.sectors.length} sectores`
                            : 'Balancear primero',
                        muted: !scenario.hasBalancingData,
                    },
                ] as { label: string; value: string | number; sub: string; alert?: boolean; muted?: boolean }[]).map((kpi, i) => (
                    <div key={i} className={`bg-white p-4 ${kpi.alert ? 'bg-red-50/50' : ''}`}>
                        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{kpi.label}</div>
                        <div className={`text-xl font-bold mt-1 ${kpi.alert ? 'text-red-600' : kpi.muted ? 'text-slate-300' : 'text-slate-900'}`}>
                            {kpi.value}
                        </div>
                        <div className={`text-[11px] mt-0.5 ${kpi.alert ? 'text-red-400 font-medium' : 'text-slate-400'}`}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Sector Table ──────────────────────────────────── */}
            {(() => {
                const anyMachines = scenario.sectors.some(s => s.totalMachinesRequired > 0);
                return (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-700">Desglose por Sector</span>
                            <span className="text-xs text-slate-400">
                                {currentShift}T · Demanda: {scenario.dailyDemand.toLocaleString()} pzs/día
                                {fatigueOn ? ` · Fatiga +${fatiguePct}%` : ''}
                            </span>
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                    <th className="px-5 py-2.5 text-left font-medium">Sector</th>
                                    <th className="px-3 py-2.5 text-center font-medium">Tareas</th>
                                    <th className="px-3 py-2.5 text-center font-medium">Estaciones</th>
                                    <th className="px-3 py-2.5 text-center font-medium">Operarios</th>
                                    {anyMachines && (
                                        <th className="px-5 py-2.5 text-left font-medium">Máquinas</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {scenario.sectors.map(s => (
                                    <tr key={s.sectorId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: s.sectorColor }}
                                                />
                                                <span className="font-medium text-slate-800">{s.sectorName}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center font-mono text-slate-500">
                                            {s.taskCount}
                                        </td>
                                        <td className="px-3 py-3 text-center font-mono font-semibold text-slate-700">
                                            {s.hasBalancingData ? s.operatorsBalanced : s.operatorsRequired}
                                        </td>
                                        <td className="px-3 py-3 text-center font-mono text-slate-600">
                                            {s.hasBalancingData ? s.operatorsTotal : s.operatorsRequired}
                                        </td>
                                        {anyMachines && (
                                            <td className="px-5 py-3 text-left">
                                                {s.machines.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {s.machines.map(m => (
                                                            <span key={m.machineId} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs text-slate-700">
                                                                <span className="font-semibold">{m.unitsRequired}</span>
                                                                <span className="text-slate-500 truncate max-w-[120px]" title={m.machineName}>{m.machineName}</span>
                                                                {m.gap > 0 && (
                                                                    <span className="text-red-500 font-bold ml-0.5" title={`Faltan ${m.gap}`}>!</span>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-sm">
                                    <td className="px-5 py-3 text-slate-700">
                                        Total <span className="text-xs font-normal text-slate-400">({scenario.sectors.length} sectores)</span>
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono text-slate-700">
                                        {scenario.sectors.reduce((sum, s) => sum + s.taskCount, 0)}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono text-slate-700">
                                        {scenario.hasBalancingData
                                            ? scenario.totalOperatorsBalanced
                                            : scenario.totalOperatorsRequired}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono text-slate-700">
                                        {scenario.hasBalancingData
                                            ? scenario.sectors.reduce((sum, s) => sum + s.operatorsTotal, 0)
                                            : scenario.totalOperatorsRequired}
                                    </td>
                                    {anyMachines && (
                                        <td className="px-5 py-3 text-left font-mono text-slate-700">
                                            {scenario.totalMachinesRequired} u.
                                        </td>
                                    )}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                );
            })()}

            {/* ── Shift Comparison (only if >1 active shift) ────── */}
            {visibleScenarios.length > 1 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                        <span className="text-sm font-semibold text-slate-700">Comparativa por Turnos</span>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <th className="px-5 py-2.5 text-left font-medium">Escenario</th>
                                <th className="px-3 py-2.5 text-right font-medium">Takt</th>
                                <th className="px-3 py-2.5 text-right font-medium">Pzs/Hora</th>
                                <th className="px-3 py-2.5 text-right font-medium">Cap. Diaria</th>
                                <th className="px-3 py-2.5 text-center font-medium">Operadores</th>
                                <th className="px-3 py-2.5 text-center font-medium">Máquinas</th>
                                <th className="px-3 py-2.5 text-center font-medium">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleScenarios.map(s => (
                                <tr
                                    key={s.shiftCount}
                                    className={`border-b border-slate-50 transition-colors ${s.shiftCount === currentShift
                                        ? 'bg-blue-50/40'
                                        : 'hover:bg-slate-50/50'
                                        }`}
                                >
                                    <td className="px-5 py-3 font-medium text-slate-800">
                                        {s.shiftCount} Turno{s.shiftCount > 1 ? 's' : ''}
                                        {s.shiftCount === currentShift && (
                                            <span className="ml-2 text-[10px] text-blue-500 font-normal">actual</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                                        {s.taktTime.toFixed(1)}s
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                                        {Math.round(s.piecesPerHour)}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                                        {s.theoreticalCapacity.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono font-semibold text-slate-700">
                                        {s.totalOperatorsRequired}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono font-semibold text-slate-700">
                                        {s.totalMachinesRequired}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        {s.totalDeficits > 0 ? (
                                            <span className="text-xs font-semibold text-red-600">
                                                {s.totalDeficits} faltantes
                                            </span>
                                        ) : (
                                            <span className="text-xs font-semibold text-emerald-600">✓ OK</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Footer ────────────────────────────────────────── */}
            <p className="text-center text-[11px] text-slate-300 mt-4">
                Tiempos estándar {fatigueOn ? `con fatiga +${fatiguePct}%` : 'sin fatiga'} · OEE {((data.meta.manualOEE || 1) * 100).toFixed(0)}%
            </p>
        </div>
    );
};
