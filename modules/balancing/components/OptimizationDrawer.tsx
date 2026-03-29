import React, { useState } from 'react';
import { X, Sparkles, AlertCircle, AlertTriangle, Lightbulb, Info, ChevronRight, CheckCircle2, ChevronUp, ChevronDown, Users } from 'lucide-react';
import { formatNumber } from '../../../utils';
import { SimulationResult } from '../../../core/balancing/engine';

interface OptimizationDrawerProps {
    results: SimulationResult[] | null;
    onClose: () => void;
    onApply: (result: SimulationResult) => void;
}

const OptimizationDrawer: React.FC<OptimizationDrawerProps> = ({ results, onClose, onApply }) => {
    const [showPriorityTable, setShowPriorityTable] = useState(false);

    if (!results) return null;

    // We assume the first result is the "Best" one if simplified, but keep logic robust for list
    const bestResult = results[0];

    return (
        <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
            {/* BACKDROP */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto transition-opacity duration-200"
                onClick={onClose}
            ></div>

            {/* DRAWER */}
            <div className="relative w-full max-w-md h-screen bg-white shadow-xl border-l border-slate-200 pointer-events-auto flex flex-col animate-in slide-in-from-right duration-200">

                {/* HEADER */}
                <div className="px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center bg-gradient-to-r from-blue-50/50 to-white">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Sparkles className="text-blue-600" size={20} />
                            Optimización
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">Estructura recomendada para tu línea</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600" title="Cerrar optimización" aria-label="Cerrar optimización">
                        <X size={20} />
                    </button>
                </div>

                {/* CONTENT SEARCH/SCROLL */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

                    {/* INFO BOX */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900 shadow-sm">
                        <div className="flex gap-3">
                            <div className="mt-0.5"><Info size={18} className="text-blue-600" /></div>
                            <div>
                                <p className="font-bold mb-1">Resultado Automático (RPW)</p>
                                <p className="opacity-90 leading-relaxed text-xs">
                                    El sistema ha calculado la mejor distribución posible basándose en tus restricciones de Takt Time y Precedencias.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* V4.1: RC-ALBP Resource Gap Alert (Jidoka/Andon Pattern) */}
                    {bestResult.resourceGaps && bestResult.resourceGaps.length > 0 && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm text-red-900 shadow-md animate-pulse">
                            <div className="flex gap-3">
                                <div className="mt-0.5"><AlertCircle size={20} className="text-red-600" /></div>
                                <div className="flex-1">
                                    <p className="font-bold mb-2 flex items-center gap-2">
                                        <AlertTriangle size={16} className="text-red-600" /> Conflicto de Recursos Detectado
                                    </p>
                                    <div className="space-y-2">
                                        {bestResult.resourceGaps.map((gap, gapIdx) => (
                                            <div key={gapIdx} className="bg-white/60 rounded-lg p-2 border border-red-100">
                                                <div className="font-bold text-red-800">{gap.machineName}</div>
                                                <div className="text-xs text-red-700 mt-1 font-mono">
                                                    Requiere: <span className="font-bold">{gap.required}</span> unidades
                                                    · Disponible: <span className="font-bold">{gap.available}</span>
                                                    · <span className="bg-red-200 px-1 rounded">Déficit: {gap.deficit}</span>
                                                </div>
                                                <div className="text-[10px] text-red-600 mt-1 italic flex items-center gap-1">
                                                    <Lightbulb size={10} /> Acción: Comprar {gap.deficit} unidad(es) adicional(es) o redistribuir carga
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {results.map((res, idx) => (
                        <div key={idx} className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${res.isRecommended ? 'border-emerald-500 shadow-lg' : 'border-slate-200'}`}>
                            {/* RECOMMENDATION BANNER */}
                            {res.isRecommended && (
                                <div className="bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 flex items-center justify-between">
                                    <span className="flex items-center gap-1"><CheckCircle2 size={12} /> MEJOR OPCIÓN</span>
                                    <span className="opacity-90 font-mono">{res.technicalName}</span>
                                </div>
                            )}

                            <div className="p-5 space-y-5">
                                {/* KEY METRICS GRID */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-slate-50 rounded-lg text-center border border-slate-100">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estaciones</div>
                                        <div className="text-3xl font-black text-slate-800">{res.stationsCount}</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg text-center border border-slate-100">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Personal (HC)</div>
                                        <div className="text-3xl font-black text-indigo-600">{res.totalHeadcount}</div>
                                    </div>
                                </div>

                                {/* METRICS LIST */}
                                <div className="space-y-3 pt-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600 flex items-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full ${res.efficiency > 85 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                            Eficiencia (Línea)
                                        </span>
                                        <span className="font-bold text-slate-800 text-base">{formatNumber(res.efficiency)}%</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600 flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                            Tiempo Ocioso
                                        </span>
                                        <span className="font-mono font-medium text-slate-500">{formatNumber(res.idleTime)}s</span>
                                    </div>
                                    {res.parallelStations > 0 && (
                                        <div className="mt-3 p-2 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-100 flex items-center gap-2">
                                            <Users size={14} />
                                            <span>Incluye <strong>{res.parallelStations}</strong> estaciones paralelas.</span>
                                        </div>
                                    )}
                                </div>

                                {/* ACTION BUTTON */}
                                <button
                                    onClick={() => onApply(res)}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md hover:shadow-emerald-200 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                                >
                                    Aplicar esta Configuración <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* PRIORITY TABLE DROPDOWN */}
                    <div className="pt-4 border-t border-slate-200">
                        <button
                            onClick={() => setShowPriorityTable(!showPriorityTable)}
                            className="flex items-center justify-between w-full text-xs font-bold text-slate-500 hover:text-blue-600 uppercase tracking-wider transition-colors mb-3"
                        >
                            <span>Detalle de Prioridades (RPW)</span>
                            {showPriorityTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {showPriorityTable && bestResult && (
                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm animate-in slide-in-from-top-2 duration-200">
                                <table className="w-full text-[10px] text-left" aria-label="Detalle de prioridades RPW">
                                    <thead className="bg-slate-50 text-slate-400 font-bold uppercase border-b border-slate-100">
                                        <tr>
                                            <th className="p-2">ID</th>
                                            <th className="p-2">Tarea</th>
                                            <th className="p-2 text-right">Peso</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {bestResult.sortedTasks.slice(0, 15).map((t) => (
                                            <tr key={t.id} className="hover:bg-slate-50">
                                                <td className="p-2 font-mono text-slate-500">{t.id}</td>
                                                <td className="p-2 truncate max-w-[120px]" title={t.description}>{t.description}</td>
                                                <td className="p-2 text-right font-mono font-bold text-blue-600">{formatNumber(t.positionalWeight)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="p-2 text-[10px] text-center text-slate-400 bg-slate-50 border-t border-slate-100">
                                    Mostrando top 15 tareas críticas
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
