/**
 * Production Capacity Report — "Capacidad de Producción por Proceso"
 *
 * Shows the same data as the Excel export in an HTML table:
 * stations, cycle times, cap/hour, OEE, status, daily production,
 * capacity %, and dotación. Includes export to Excel button.
 *
 * @module modules/ExecutiveSummary
 * @version 3.0.0
 */

import React, { useMemo, useState } from 'react';
import { ProjectData, Task } from '../types';
import { Download, BarChart3, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from '../components/ui/Toast';
import { buildGate3FromProjectData } from './gate3/gate3FromBalancing';
import {
    calculateTaktTime,
    calculateShiftNetMinutes,
    calculateEffectiveStationTime,
    calculateStationOEE,
} from '../core/balancing/simulation';

// ============================================================================
// Types
// ============================================================================

interface StationViewRow {
    id: number;
    description: string;
    sectorName: string;
    cycleTimeSeconds: number;
    capPerHour: number;
    oee: number;
    requiredDaily: number;
    prodDaily: number;
    capacityPct: number;
    dotacion: number;
    operators: number;
    machineTime: number;
    isOk: boolean;
    replicas: number;
}

interface Props {
    data: ProjectData;
}

// ============================================================================
// Calculation
// ============================================================================

function buildViewRows(data: ProjectData): StationViewRow[] {
    const validStationIds = data.assignments.map(a => a.stationId).filter(Number.isFinite);
    const maxA = validStationIds.length > 0 ? Math.max(...validStationIds) : 0;
    const count = Math.max(maxA, data.meta.configuredStations || 1);
    const cfgMap = new Map(data.stationConfigs?.map(c => [c.id, c]) ?? []);
    const tMap = new Map(data.tasks.map(t => [t.id, t]));

    const globalOee = data.meta.useSectorOEE ? 1 : data.meta.manualOEE;
    const globalTakt = calculateTaktTime(
        data.shifts, data.meta.activeShifts, data.meta.dailyDemand || 0, globalOee,
        data.meta.setupLossPercent || 0
    );
    const totalAvailableSeconds = globalTakt.totalAvailableMinutes * 60;
    const shiftNetMinutes = data.shifts
        .filter((_, i) => i < data.meta.activeShifts)
        .reduce((sum, s) => sum + calculateShiftNetMinutes(s), 0);

    const dailyDemand = data.meta.dailyDemand || 0;
    const rows: StationViewRow[] = [];

    for (let i = 1; i <= count; i++) {
        const tasks = data.assignments
            .filter(a => a.stationId === i)
            .map(a => tMap.get(a.taskId))
            .filter(Boolean) as Task[];

        if (tasks.length === 0) continue;

        const cfg = cfgMap.get(i);
        const replicas = cfg?.replicas && cfg.replicas > 0 ? cfg.replicas : 1;
        let effectiveTime = calculateEffectiveStationTime(tasks);
        if (!Number.isFinite(effectiveTime) || effectiveTime < 0) effectiveTime = 0;
        const cycleTime = replicas > 0 ? effectiveTime / replicas : 0;

        const rawOee = calculateStationOEE(data, i, tasks[0]?.sectorId);
        const oee = Math.max(0, Math.min(1, Number.isFinite(rawOee) ? rawOee : 0.85));

        const sectorId = tasks[0]?.sectorId;
        const sector = sectorId ? data.sectors?.find(s => s.id === sectorId) : undefined;
        const sectorName = sector?.name || 'General';

        const taskDescs = tasks.slice(0, 3).map(t => t.description || t.id);
        const description = taskDescs.join(', ') + (tasks.length > 3 ? '...' : '');

        const capPerHour = cycleTime > 0 ? 3600 / cycleTime : 0;
        const prodDaily = cycleTime > 0 ? totalAvailableSeconds / cycleTime : 0;
        const capacityPct = dailyDemand > 0 ? prodDaily / dailyDemand : 0;
        const dotacion = shiftNetMinutes > 0 ? (cycleTime / 60) * dailyDemand / shiftNetMinutes : 0;
        const operators = Math.ceil(dotacion);
        const isOk = prodDaily >= dailyDemand;

        const machineTime = tasks
            .filter(t => t.executionMode === 'machine' || t.executionMode === 'injection')
            .reduce((sum, t) => sum + (t.standardTime || t.averageTime || 0), 0);

        rows.push({
            id: i,
            description,
            sectorName,
            cycleTimeSeconds: cycleTime,
            capPerHour,
            oee,
            requiredDaily: dailyDemand,
            prodDaily,
            capacityPct,
            dotacion,
            operators,
            machineTime,
            isOk,
            replicas,
        });
    }

    return rows;
}

// ============================================================================
// Main Component
// ============================================================================

export const ExecutiveSummary: React.FC<Props> = ({ data }) => {
    const rows = useMemo(() => buildViewRows(data), [data]);
    const hasAssignments = data.assignments?.length > 0;

    const dailyDemand = data.meta.dailyDemand || 0;
    const ppv = Math.max(1, data.meta.piecesPerVehicle || 1);
    const vehicleDemand = ppv > 0 ? Math.round(dailyDemand / ppv) : dailyDemand;
    const weeklyDemand = dailyDemand * 5;
    const activeShifts = data.meta.activeShifts || 1;
    const oeeGlobal = data.meta.manualOEE ?? 0.85;

    const globalTakt = useMemo(() => calculateTaktTime(
        data.shifts, activeShifts, dailyDemand, data.meta.useSectorOEE ? 1 : oeeGlobal,
        data.meta.setupLossPercent || 0
    ), [data]);
    const totalAvailableMinutes = globalTakt.totalAvailableMinutes;

    const totalDotacion = rows.reduce((sum, r) => sum + r.dotacion, 0);
    const totalOperators = Math.ceil(totalDotacion);
    const operatorsPerShift = Math.ceil(totalOperators / Math.max(1, activeShifts));
    const bottleneck = rows.length > 0 ? rows.reduce((max, r) => r.cycleTimeSeconds > max.cycleTimeSeconds ? r : max, rows[0]) : null;

    const [isExporting, setIsExporting] = useState(false);

    // No assignments state
    if (!hasAssignments || rows.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <BarChart3 size={40} className="mx-auto mb-3 text-slate-300" strokeWidth={1.5} />
                    <p className="text-lg font-semibold text-slate-500">Sin datos de balanceo</p>
                    <p className="text-sm text-slate-400 mt-1">
                        Asigna tareas a estaciones en la pestaña <span className="font-medium text-slate-500">Balanceo</span> para ver el reporte de capacidad.
                    </p>
                </div>
            </div>
        );
    }

    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const { exportGate3Excel } = await import('./gate3/gate3ExcelExport');
            const project = buildGate3FromProjectData(data);
            await exportGate3Excel(project);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error('No se pudo exportar el Excel VW', msg);
            console.error('Error exporting Gate 3 Excel:', err);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto py-2">

            {/* ── Header ──────────────────────────────────────── */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Capacidad de Producción por Proceso
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {data.meta.name || 'Sin nombre'} — {data.meta.client || 'Sin cliente'} · {data.meta.date || '—'}
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
                >
                    <Download size={16} />
                    {isExporting ? 'Generando...' : 'Exportar Excel VW'}
                </button>
            </div>

            {/* ── Production Params ───────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Volumen vehículos diario', value: vehicleDemand.toLocaleString() },
                    { label: 'Turnos activos', value: activeShifts },
                    { label: 'Piezas por vehículo', value: ppv },
                    { label: 'Min. netos disp./día', value: Math.round(totalAvailableMinutes) },
                    { label: 'Piezas necesarias/día', value: dailyDemand.toLocaleString() },
                    { label: 'OEE Global', value: `${(oeeGlobal * 100).toFixed(0)}%` },
                    { label: 'Demanda semanal', value: weeklyDemand.toLocaleString() },
                    { label: 'Cuello de botella', value: bottleneck ? `Est. ${bottleneck.id} (${bottleneck.cycleTimeSeconds.toFixed(1)}s)` : '—' },
                ].map((p, i) => (
                    <div key={i} className="bg-white rounded-lg border border-slate-200 px-4 py-3">
                        <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{p.label}</div>
                        <div className="text-lg font-bold text-slate-800 mt-0.5">{p.value}</div>
                    </div>
                ))}
            </div>

            {/* ── Process Table ────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                <div className="px-5 py-3 bg-slate-800 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Detalle por Estación</span>
                    <span className="text-xs text-slate-300">
                        {rows.length} estaciones · {data.tasks.length} tareas
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50">
                                <th className="px-4 py-2.5 text-center font-medium w-14">Nro</th>
                                <th className="px-4 py-2.5 text-left font-medium">Descripción</th>
                                <th className="px-3 py-2.5 text-center font-medium">Sector</th>
                                <th className="px-3 py-2.5 text-center font-medium">Ciclo (s)</th>
                                <th className="px-3 py-2.5 text-center font-medium">Cap/hora</th>
                                <th className="px-3 py-2.5 text-center font-medium">OEE %</th>
                                <th className="px-3 py-2.5 text-center font-medium">Estado</th>
                                <th className="px-3 py-2.5 text-center font-medium">Pzs Req/Día</th>
                                <th className="px-3 py-2.5 text-center font-medium">Prod Diaria</th>
                                <th className="px-3 py-2.5 text-center font-medium">Cap %</th>
                                <th className="px-3 py-2.5 text-center font-medium">Dotación</th>
                                <th className="px-3 py-2.5 text-center font-medium">Ops</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => (
                                <tr
                                    key={row.id}
                                    className={`border-b border-slate-100 transition-colors hover:bg-slate-50/50 ${idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                                >
                                    <td className="px-4 py-3 text-center font-bold text-slate-600">{row.id}</td>
                                    <td className="px-4 py-3 text-left text-slate-800 max-w-[250px] truncate" title={row.description}>
                                        {row.description}
                                    </td>
                                    <td className="px-3 py-3 text-center text-slate-500 text-xs">{row.sectorName}</td>
                                    <td className="px-3 py-3 text-center font-mono font-bold text-blue-600">
                                        {row.cycleTimeSeconds.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono text-slate-600">
                                        {Math.round(row.capPerHour).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono text-blue-600 font-bold">
                                        {(row.oee * 100).toFixed(0)}%
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        {row.isOk ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <CheckCircle2 size={12} />
                                                OK
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                                <AlertTriangle size={12} />
                                                DEFICIT
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono text-slate-600">
                                        {row.requiredDaily.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono font-semibold text-slate-700">
                                        {Math.round(row.prodDaily).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <span className={`font-mono font-semibold ${row.capacityPct >= 1 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {(row.capacityPct * 100).toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono text-slate-600">
                                        {row.dotacion.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono font-bold text-slate-800">
                                        {row.operators}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Summary ─────────────────────────────────────── */}
            <div className="bg-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-3 divide-x divide-slate-700">
                    <div className="px-6 py-4">
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Total Dotación (operadores/día)</div>
                        <div className="text-2xl font-bold text-white mt-1">{totalOperators}</div>
                        <div className="text-xs text-slate-400 mt-0.5">Dotación exacta: {totalDotacion.toFixed(2)}</div>
                    </div>
                    <div className="px-6 py-4">
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Operadores por turno</div>
                        <div className="text-2xl font-bold text-white mt-1">{operatorsPerShift}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{activeShifts} turno{activeShifts > 1 ? 's' : ''} activo{activeShifts > 1 ? 's' : ''}</div>
                    </div>
                    <div className="px-6 py-4">
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Procesos analizados</div>
                        <div className="text-2xl font-bold text-white mt-1">{rows.length}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                            {rows.filter(r => r.isOk).length} OK · {rows.filter(r => !r.isOk).length} en déficit
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};
