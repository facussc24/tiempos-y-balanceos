
import React, { useState } from 'react';
import { Task, Shift } from '../types';
import { formatNumber, calculateTaktTime } from '../utils';
import { ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Bar, Cell } from 'recharts';
import { Calculator, X, Users, Activity, Clock, Save, AlertTriangle, CheckCircle2, Zap, Scale } from 'lucide-react';

interface Props {
    task: Task;
    shifts: Shift[];  // FIX: Added for accurate Takt Time calculation
    dailyDemand: number;
    activeShifts: number;
    oee: number;
    setupLossPercent?: number;
    onClose: () => void;
    onApply: (updates: Partial<Task>) => void;
}

export const ManualCapacityCalculator: React.FC<Props> = ({ task, shifts, dailyDemand, activeShifts, oee, setupLossPercent = 0, onClose, onApply }) => {

    // 1. Local State for "What-If" Analysis
    // We initialize with task values, but allow user to play with them
    const [rating, setRating] = useState(task.ratingFactor || 100);

    // Fatigue removed v10.1 - Managed Global ONLY

    // 2. Constants & Takt Calculation (FIX: Use centralized function with real shift data)
    const taktResult = calculateTaktTime(shifts, activeShifts, dailyDemand, oee, setupLossPercent);
    const taktEffective = taktResult.effectiveSeconds;

    // 3. Time Calculations
    const observedTime = task.averageTime;
    const basicTime = observedTime * (rating / 100);
    // FIX v10.1: Fatigue is Global (Panel Control). 
    // This calculator doesn't see global fatigue, so we show Base Standard Time (without supplements).
    // The user should know that Global Fatigue (e.g. 1.14) is applied ON TOP of this.
    const standardTime = basicTime;

    // 4. Dimensioning (Headcount) Logic
    // How many stations/ops do we need for THIS task to meet demand?
    const rawHeadcount = taktEffective > 0 ? standardTime / taktEffective : 0;
    const requiredHeadcount = Math.ceil(rawHeadcount);

    // 5. Saturation Logic
    // If we have 1 op, how busy are they? If we need 2, how busy is the set?
    // Saturation = (StandardTime / (Headcount * TaktEffective)) * 100
    // Note: We compare against Effective Takt because that's the real target speed.
    const saturation = (requiredHeadcount > 0 && taktEffective > 0)
        ? (standardTime / (requiredHeadcount * taktEffective)) * 100
        : 0;

    // 6. Max Capacity (Throughput)
    // If we staff this correctly (requiredHeadcount), what is the max output?
    // Or simpler: What is the max output of ONE station doing this task?
    // Expert asked for "Max Capacity" -> usually implied as "Line Capacity if this is the bottleneck"
    // Hourly Output = 3600 / StandardTime * Headcount * OEE
    const unitsPerHourPerOp = standardTime > 0 ? (3600 / standardTime) * oee : 0;
    const totalUnitsPerHour = unitsPerHourPerOp * requiredHeadcount;

    // 7. Chart Data Preparation
    const chartData = [
        {
            name: "Tiempo",
            value: standardTime,
            limit: taktEffective,
            idle: Math.max(0, (taktEffective * requiredHeadcount) - standardTime),
            isOverload: standardTime > taktEffective && requiredHeadcount === 1 // Only overload if we haven't scaled yet visually
        }
    ];

    // Determine Status / Recommendation
    let statusColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
    let StatusIcon = CheckCircle2;
    let recommendation = "Balanceado Correctamente";

    if (requiredHeadcount > 1) {
        statusColor = "bg-indigo-50 text-indigo-700 border-indigo-200";
        StatusIcon = Users;
        recommendation = `Requiere Multi-Manning (${requiredHeadcount} Ops)`;
    } else if (saturation < 75) {
        statusColor = "bg-amber-50 text-amber-700 border-amber-200";
        StatusIcon = Scale;
        recommendation = "Baja Saturación (Posible Ocio)";
    } else if (saturation > 95) {
        statusColor = "bg-red-50 text-red-700 border-red-200";
        StatusIcon = Zap;
        recommendation = "Saturación Crítica (Riesgo)";
    }

    const handleSave = () => {
        onApply({
            ratingFactor: rating
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-xl overflow-hidden flex flex-col md:flex-row h-[80vh] border border-slate-200 animate-in fade-in zoom-in duration-300 relative z-[100]">

                {/* LEFT: INPUTS & FACTORS */}
                <div className="w-full md:w-4/12 bg-slate-50 p-6 border-r border-slate-200 flex flex-col gap-6 overflow-y-auto">
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-lg border-b border-slate-200 pb-4">
                        <div className="bg-blue-600 text-white p-2 rounded-lg"><Calculator size={20} /></div>
                        <h2 className="leading-tight">Análisis de<br />Tarea Manual</h2>
                    </div>

                    <div className="space-y-6">
                        {/* 1. RATING FACTOR (VR) */}
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Valoración del Ritmo (VR)</label>
                                <span className="text-xs font-bold text-blue-600">{rating}%</span>
                            </div>
                            <input
                                type="range"
                                min="60"
                                max="140"
                                step="5"
                                className="w-full accent-blue-600 cursor-pointer"
                                value={rating}
                                onChange={(e) => setRating(parseInt(e.target.value))}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
                                <span>Lento (60%)</span>
                                <span>Normal (100%)</span>
                                <span>Rápido (140%)</span>
                            </div>
                        </div>

                        {/* 2. FATIGUE */}
                        {/* 2. FATIGUE REMOVED (Global Control) */}
                        <div className="bg-blue-50 p-3 rounded border border-blue-100 text-xs text-blue-800">
                            <strong>Nota:</strong> La fatiga se gestiona globalmente desde el Panel de Control.
                        </div>

                        {/* 3. TIME BREAKDOWN */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-sm shadow-sm">
                            <div className="flex justify-between text-slate-500">
                                <span>Tiempo Promedio:</span>
                                <span className="font-mono">{formatNumber(observedTime)}s</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                                <span>Tiempo Básico:</span>
                                <span className="font-mono">{formatNumber(basicTime)}s</span>
                            </div>
                            <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-slate-800">
                                <span className="font-bold">Tiempo Base (s/Fatiga):</span>
                                <span className="font-black text-xl text-blue-600">{formatNumber(standardTime)}s</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: RESULTS & VISUALS */}
                <div className="flex-1 bg-white p-8 flex flex-col relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-colors z-10" title="Cerrar calculadora">
                        <X size={24} />
                    </button>

                    {/* HEADER METRICS */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Takt Time Efectivo</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-slate-800">{formatNumber(taktEffective)}</span>
                                <span className="text-xs font-bold text-slate-400">seg/u</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                <Activity size={10} /> Ajustado por OEE ({formatNumber(oee * 100)}%)
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Capacidad Máxima (Output)</span>
                            <div className="text-[9px] text-amber-500 italic mb-0.5">* Teórica, sin cuellos de botella</div>
                            <div className="flex items-baseline gap-1 justify-end">
                                <span className="text-3xl font-black text-indigo-600">{Math.floor(totalUnitsPerHour)}</span>
                                <span className="text-xs font-bold text-indigo-300">pz/h</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">
                                {requiredHeadcount > 1 ? `Con ${requiredHeadcount} operarios` : 'Con 1 operario'}
                            </div>
                        </div>
                    </div>

                    {/* VISUAL CHART */}
                    <div className="flex-1 relative border rounded-xl bg-slate-50/50 p-4 border-slate-100 mb-6">
                        <h3 className="text-xs font-bold text-slate-500 mb-4 flex items-center gap-2">
                            <Clock size={14} /> Análisis de Saturación vs Takt
                        </h3>
                        <ResponsiveContainer width="100%" height="70%">
                            <ComposedChart layout="vertical" data={chartData} margin={{ top: 10, right: 30, left: 40, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" hide />
                                <Tooltip
                                    cursor={false}
                                    content={({ active }) => {
                                        if (active) {
                                            return (
                                                <div className="bg-slate-800 text-white text-xs p-2 rounded shadow-xl">
                                                    <p>Estándar: <strong>{formatNumber(standardTime)}s</strong></p>
                                                    <p>Takt: <strong>{formatNumber(taktEffective)}s</strong></p>
                                                    <p>Ocupación: <strong>{formatNumber(saturation)}%</strong></p>
                                                </div>
                                            )
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="limit" barSize={40} fill="#f1f5f9" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                                <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]}>
                                    {
                                        chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={standardTime > taktEffective ? '#ef4444' : '#2563eb'} />
                                        ))
                                    }
                                </Bar>
                                <ReferenceLine x={taktEffective} stroke="#64748b" strokeDasharray="3 3" label={{ value: 'TAKT', position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                            </ComposedChart>
                        </ResponsiveContainer>

                        {/* Legend / Explanation */}
                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                            <div className="text-xs text-slate-500">
                                {standardTime > taktEffective ? (
                                    <span className="text-red-600 font-bold flex items-center gap-1">
                                        <AlertTriangle size={14} /> Excede Takt Time por {formatNumber(standardTime - taktEffective)}s
                                    </span>
                                ) : (
                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                        <CheckCircle2 size={14} /> Cumple Takt Time (Holgura: {formatNumber(taktEffective - standardTime)}s)
                                    </span>
                                )}
                            </div>
                            <div className="text-right">
                                <span className="text-3xl font-black text-slate-800">{formatNumber(saturation)}%</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Saturación Real</span>
                            </div>
                        </div>
                    </div>

                    {/* FOOTER / RECOMMENDATION */}
                    <div className="flex items-center justify-between gap-4 mt-auto">
                        <div className={`flex-1 flex items-center gap-3 p-3 rounded-xl border ${statusColor}`}>
                            <div className="p-2 bg-white/50 rounded-lg">
                                <StatusIcon size={24} />
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold uppercase opacity-70">Diagnóstico</span>
                                <span className="font-bold text-lg leading-none">{recommendation}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            className="bg-blue-600 text-white px-8 py-4 rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all flex items-center gap-2 font-bold"
                        >
                            <Save size={18} /> Aplicar Cambios
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
