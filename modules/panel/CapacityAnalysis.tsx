import React from 'react';
import { Card } from '../../components/ui/Card';
import { formatNumber } from '../../utils';
import { BarChart4, Users, Clock, UserCheck, UserX, UserMinus } from 'lucide-react';

interface Props {
    idealHeadcount: number;
    totalHeadcount: number;
    realStations: number;
    requiredManHours: number;
    totalLineCapacityHours: number;
    capacityDiff: number;
}

export const CapacityAnalysis: React.FC<Props> = ({
    idealHeadcount,
    totalHeadcount,
    realStations,
    requiredManHours,
    totalLineCapacityHours,
    capacityDiff
}) => {
    // Theoretical Stations (Tables needed)
    // Minimally 1 table per person unless optimized
    const minTheoreticalStations = idealHeadcount;

    // -- SEMAPHORE 1: HEADCOUNT (DOTACIÓN) --
    let headcountStatus: 'under' | 'optimal' | 'over' = 'optimal';
    let headcountMsg = "Dotación Correcta";
    let headcountColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
    let HeadcountIcon = UserCheck;

    if (totalHeadcount < idealHeadcount) {
        headcountStatus = 'under';
        headcountMsg = "Falta Personal (Riesgo)";
        headcountColor = "bg-red-50 text-red-700 border-red-200";
        HeadcountIcon = UserX;
    } else if (totalHeadcount > idealHeadcount + 1) {
        headcountStatus = 'over';
        headcountMsg = "Exceso de Personal (Desperdicio)";
        headcountColor = "bg-amber-50 text-amber-700 border-amber-200";
        HeadcountIcon = UserMinus;
    }

    // -- SEMAPHORE 2: SHIFT SUGGESTION --
    let shiftSuggestion = "Capacidad Correcta";
    let shiftColor = "text-slate-500";
    // shiftHours is implicitly part of totalLineCapacityHours, so we deduce purely from capacityDiff
    // Assuming standard shift logic is handled upstream or simplified here.

    // If capacityDiff is negative, we lack capacity.
    // If capacityDiff is HUGE positive, we have idle capacity.
    // Thresholds: -0.5 hrs (lack), > 20% of total capacity (idle)?
    // The previous logic used (shiftHours * 0.8), but we don't have shiftHours prop.
    // Let's infer shiftHours from context or just use a ratio.
    // Actually, let's keep it simple: if Diff > 20% of Required, it's idle.

    if (capacityDiff < -0.5) {
        shiftSuggestion = "⚠️ Sugerencia: Agregar Turno u Horas Extra";
        shiftColor = "text-red-600 font-bold";
    } else if (capacityDiff > (requiredManHours * 0.2) && totalLineCapacityHours > 0) {
        // Heuristic change: 20% of required. Old logic was 0.8 * shiftHours.
        // Let's try to stick to original logic if we can pass shiftHours.
        // I'll update Props to include ShiftHours for fidelity.
        shiftSuggestion = "📉 Sugerencia: Reducir Turnos (Capacidad ociosa)";
        shiftColor = "text-amber-600 font-bold";
    }

    return (
        <Card title="Análisis de Capacidad y Dimensionamiento" className="lg:col-span-1 bg-white">
            <div className="space-y-4">

                {/* NEW HEADCOUNT SEMAPHORE */}
                <div>
                    <div className="flex items-center gap-2 mb-2 text-slate-500 text-xs font-bold uppercase">
                        <Users size={14} /> Dotación (Recursos Humanos)
                    </div>
                    <div className={`p-3 rounded border ${headcountColor} transition-colors`}>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <span className="text-xs block opacity-70">Ideal (Teórico)</span>
                                <span className="text-lg font-bold">{idealHeadcount} Op.</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs block opacity-70">Actual (Asignado)</span>
                                <span className="text-lg font-bold">{totalHeadcount} Op.</span>
                            </div>
                        </div>
                        <div className="text-xs font-bold border-t border-current/20 pt-2 flex items-center gap-1">
                            <HeadcountIcon size={14} />
                            {headcountMsg}
                        </div>
                    </div>
                </div>

                {/* Stations Analysis (Infrastructure) */}
                <div>
                    <div className="flex items-center gap-2 mb-2 text-slate-500 text-xs font-bold uppercase">
                        <BarChart4 size={14} /> Infraestructura (Estaciones)
                    </div>
                    <div className="p-3 rounded border bg-slate-50 border-slate-200 text-slate-700">
                        <div className="flex justify-between items-center">
                            <span className="text-xs">Estaciones Configuradas (Mesas):</span>
                            <span className="font-bold">{realStations}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                            {realStations < minTheoreticalStations
                                ? "Nota: Uso intensivo de Multi-Manning (Más operarios que mesas)."
                                : "Distribución estándar."}
                        </div>
                    </div>
                </div>

                {/* Shift Analysis */}
                <div>
                    <div className="flex items-center gap-2 mb-2 text-slate-500 text-xs font-bold uppercase">
                        <Clock size={14} /> Tiempo de Producción
                    </div>
                    <div className="p-3 bg-slate-50 rounded border border-slate-200">
                        <div className="flex justify-between text-xs mb-1">
                            <span title="Total de horas-hombre necesarias para fabricar la demanda (inc. pérdidas OEE)">Contenido Trabajo (Total):</span>
                            <span className="font-bold">{formatNumber(requiredManHours, 1)}h</span>
                        </div>
                        <div className="flex justify-between text-xs mb-2">
                            <span title="Capacidad total de la línea (Horas Turno * Cantidad Estaciones)">Capacidad Total Línea:</span>
                            <span className="font-bold text-blue-600">{formatNumber(totalLineCapacityHours, 1)}h</span>
                        </div>

                        {/* Visual Bar */}
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
                            <div
                                className={`h-full rounded-full ${capacityDiff < 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Number.isFinite(requiredManHours) && Number.isFinite(totalLineCapacityHours) ? Math.min(100, (requiredManHours / (totalLineCapacityHours || 1)) * 100) : 0}%` }}
                            ></div>
                        </div>

                        <div className={`text-xs ${shiftColor}`}>
                            {shiftSuggestion}
                        </div>
                    </div>
                </div>

            </div>
        </Card>
    );
};
