import React from 'react';
import { Factory, Target, Activity, Layers, MousePointer2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Task, ManualOperation } from '../../../types';
import { formatNumber } from '../../../utils';

interface Props {
    task: Task;
    dailyDemand: number;
    activeShifts: number;
    oee: number;
    taktTime: number;
    machineLimitCycle: number;
    puCurTime: number;
    nStar: number;
    activeN: number;
    activeHeadcount: number;
    realCycleTime: number;
    hourlyOutput: number;
    realSaturation: number;
    manualOps: ManualOperation[];
    isCurrentFeasible: boolean;
    injectionMode?: 'batch' | 'carousel';
}

const PdfReport: React.FC<Props> = ({
    task, dailyDemand, activeShifts, oee, taktTime, machineLimitCycle, puCurTime, nStar,
    activeN, activeHeadcount, realCycleTime, hourlyOutput, realSaturation, manualOps,
    isCurrentFeasible, injectionMode = 'batch'
}) => {
    return (
        <div className="fixed inset-0 z-overlay bg-slate-900/90 overflow-auto flex justify-center items-start pt-10">
            <div className="text-white font-bold text-xl mb-4 fixed top-4 left-1/2 -translate-x-1/2 animate-pulse z-tooltip">Generando Reporte PDF...</div>
            <div id="pdf-report-content" className="bg-white text-slate-900 shadow-2xl relative flex flex-col" style={{ width: '297mm', height: '210mm', padding: '12mm', margin: '0 auto' }}>
                {/* HEADER */}
                <div className="flex justify-between items-center border-b-4 border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-800 text-white p-3 rounded-lg">
                            <Factory size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Estudio de Ingeniería de Ciclo</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Tecnología Poliuretano (PU)</span>
                                <span className="text-slate-400 text-xs font-mono">Ref: {task.id}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha Emisión</p>
                        <p className="font-bold text-lg text-slate-800">{new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-4 mb-4">
                    {/* LEFT COLUMN */}
                    <div className="col-span-4 flex flex-col gap-6">
                        {/* DESIGN PARAMETERS */}
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                            <h3 className="text-xs font-bold text-indigo-600 uppercase mb-4 flex items-center gap-2"><Target size={14} /> Parámetros de Diseño</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between border-b border-slate-200 pb-2">
                                    <span className="text-slate-600">Demanda Objetivo</span>
                                    <span className="font-bold text-slate-900">{dailyDemand ? formatNumber(dailyDemand) : '-'} u/día</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 pb-2">
                                    <span className="text-slate-600">Jornada Disponible</span>
                                    <span className="font-bold text-slate-900">{activeShifts} Turnos ({activeShifts * 8}h)</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 pb-2">
                                    <span className="text-slate-600">OEE Considerado</span>
                                    <span className="font-bold text-indigo-600">{Math.round(oee * 100)}%</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span className="font-bold text-slate-800">Takt Time (Límite)</span>
                                    <span className="font-bold text-red-600">{formatNumber(taktTime)} seg</span>
                                </div>
                                <p className="text-[10px] text-right text-slate-400 italic mt-1">*Incluye pérdidas por OEE</p>
                            </div>
                        </div>

                        {/* TECHNICAL DATA */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <h3 className="text-xs font-bold text-indigo-600 uppercase mb-4 flex items-center gap-2"><Activity size={14} /> Datos Técnicos</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Tiempo Inyección</span>
                                    <span className="font-mono font-bold text-slate-900">{formatNumber(machineLimitCycle)}s</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Tiempo Curado</span>
                                    <span className="font-mono font-bold text-slate-900">{formatNumber(puCurTime)}s</span>
                                </div>
                                <div className="flex justify-between mt-2 pt-2 border-t border-slate-100">
                                    <span className="text-slate-600">Modo Operación</span>
                                    <span className="font-bold text-slate-900">
                                        {injectionMode === 'carousel' ? 'Carrusel — MAX(Iny, Cur/N)' : 'Batch — Iny + Cur/N'}
                                    </span>
                                </div>
                                <div className="mt-6 bg-emerald-50 rounded-lg p-4 text-center border border-emerald-100">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Saturación Máxima (N*)</p>
                                    <p className="text-4xl font-black text-slate-800">{nStar}</p>
                                    <p className="text-[10px] text-emerald-600 mt-1">Moldes para 100% uso máquina</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="col-span-8 flex flex-col gap-6">
                        {/* SCENARIO ANALYSIS */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2"><Layers size={14} /> Análisis de Escenario Actual</h3>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider text-left">
                                    <tr>
                                        <th className="px-5 py-3">Configuración</th>
                                        <th className="px-5 py-3 text-center">Dotación</th>
                                        <th className="px-5 py-3 text-right">Ciclo (s)</th>
                                        <th className="px-5 py-3 text-right">Output Estimado</th>
                                        <th className="px-5 py-3 text-center">Saturación</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr className="bg-emerald-50/50">
                                        <td className="px-5 py-4 font-bold text-slate-800">{activeN} Moldes</td>
                                        <td className="px-5 py-4 text-center font-bold text-slate-800">{activeHeadcount} Op.</td>
                                        <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">{formatNumber(realCycleTime)}</td>
                                        <td className="px-5 py-4 text-right font-bold text-emerald-600">{Math.floor(hourlyOutput * activeShifts * 8)} u/día</td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${realSaturation > 100 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {formatNumber(realSaturation)}%
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* VISUAL CHART */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 flex-1 flex flex-col justify-center relative">
                            <div className="absolute top-4 right-4 text-[10px] font-bold text-red-500 uppercase tracking-wider">Límite Takt Time ({formatNumber(taktTime)}s)</div>

                            <div className="mb-2 flex justify-between items-end">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                                    <span className="text-sm font-bold text-slate-700">Ciclo Propuesto ({activeN} cavidades)</span>
                                </div>
                                <span className="text-2xl font-black text-slate-800">{formatNumber(realCycleTime)}s</span>
                            </div>
                            <div className="w-full h-12 bg-slate-100 rounded-lg overflow-hidden relative">
                                <div
                                    className={`h-full flex items-center justify-end px-4 text-white font-bold text-sm transition-all ${realCycleTime > taktTime ? 'bg-red-500' : 'bg-indigo-600'}`}
                                    style={{ width: `${Math.min(100, (realCycleTime / taktTime) * 100)}%` }}
                                >
                                    {formatNumber((realCycleTime / taktTime) * 100)}% Saturación
                                </div>
                                <div className="absolute top-0 right-0 h-full w-0.5 bg-red-500/50 border-l border-dashed border-red-500"></div>
                            </div>
                            <p className="text-[10px] text-slate-400 text-right mt-2">* El ciclo propuesto debe ser MENOR al Takt Time para garantizar cumplimiento.</p>
                        </div>
                    </div>
                </div>

                {/* MANUAL OPERATIONS BREAKDOWN */}
                <div className="mt-2 mb-2 flex-1 overflow-hidden">
                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><MousePointer2 size={14} /> Desglose de Operaciones Manuales (Detalle)</h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="p-2 pl-4">Descripción</th>
                                    <th className="p-2 text-center">Tipo</th>
                                    <th className="p-2 text-right pr-4">Tiempo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {manualOps.map(op => (
                                    <tr key={op.id}>
                                        <td className="p-2 pl-4 font-medium text-slate-700">{op.description}</td>
                                        <td className="p-2 text-center text-slate-500">{op.refCavities ? `Var (${op.refCavities} cav)` : 'Fijo'}</td>
                                        <td className="p-2 text-right pr-4 font-mono font-bold text-slate-800">{op.time}s</td>
                                    </tr>
                                ))}
                                {manualOps.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-4 text-center text-slate-400 italic">Sin operaciones manuales detalladas.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="mt-auto">
                    <div className={`rounded-xl p-4 flex items-start gap-4 border ${isCurrentFeasible ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                        <div className={`p-2 rounded-full ${isCurrentFeasible ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {isCurrentFeasible ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                        </div>
                        <div>
                            <h4 className={`font-bold uppercase text-sm mb-1 ${isCurrentFeasible ? 'text-emerald-800' : 'text-red-800'}`}>
                                {isCurrentFeasible ? 'Configuración Viable' : 'Configuración No Viable'}
                            </h4>
                            <p className={`text-xs ${isCurrentFeasible ? 'text-emerald-700' : 'text-red-700'}`}>
                                {isCurrentFeasible
                                    ? `Se recomienda utilizar ${activeN} moldes para cumplir la demanda. El tiempo de ciclo resultante permite absorber variaciones normales.`
                                    : `La configuración actual excede el Takt Time o los límites de la máquina. Se requiere ajustar cavidades o dotación.`}
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-end">
                        <div>
                            <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Barack Mercosul Software</p>
                            <p className="text-[10px] text-slate-400">Módulo de Ingeniería Industrial</p>
                        </div>
                        <p className="text-[10px] text-slate-300 italic">Documento generado automáticamente.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
