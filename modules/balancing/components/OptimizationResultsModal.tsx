import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Sparkles,
    CheckCircle2,
    ChevronRight,
    Users,
    Factory,
    ChevronDown,
    ChevronUp,
    Info,
    Award,
    Timer,
    BarChart3
} from 'lucide-react';
import { SimulationResult } from '../../../core/balancing/engine';
import { formatNumber } from '../../../utils';

interface OptimizationResultsModalProps {
    results: SimulationResult[] | null;
    onClose: () => void;
    onApply: (result: SimulationResult) => void;
}

/** Compact scenario card for multi-scenario comparison */
const ScenarioCard: React.FC<{
    result: SimulationResult;
    index: number;
    isRecommended: boolean;
    onApply: (result: SimulationResult) => void;
}> = ({ result, index, isRecommended, onApply }) => {
    const isFeasible = result.efficiency >= 100;
    const isRisk = result.efficiency >= 95 && result.efficiency < 100;

    const borderColor = isRecommended
        ? 'border-indigo-300 ring-2 ring-indigo-100'
        : 'border-slate-200';

    const statusLabel = isFeasible ? 'Factible' : isRisk ? 'Riesgo' : 'No Factible';
    const statusColor = isFeasible ? 'text-emerald-600 bg-emerald-50' : isRisk ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
    const statusIcon = isFeasible ? '✅' : isRisk ? '⚠️' : '❌';

    const labels = ['A', 'B', 'C'];

    return (
        <div className={`bg-white rounded-xl border-2 ${borderColor} p-5 flex flex-col relative overflow-hidden transition-all hover:shadow-lg`}>
            {/* Recommended badge */}
            {isRecommended && (
                <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-bl-lg flex items-center gap-1">
                    <Award size={10} />
                    Recomendado
                </div>
            )}

            {/* Scenario label */}
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Escenario {labels[index] || index + 1}
            </div>

            {/* Headcount (hero metric) */}
            <div className="flex items-baseline gap-2 mb-4">
                <Users size={16} className="text-indigo-400" />
                <span className="text-4xl font-black text-slate-900 tracking-tight">{result.totalHeadcount}</span>
                <span className="text-sm text-slate-400 font-medium">ops</span>
            </div>

            {/* Metrics grid */}
            <div className="space-y-2.5 flex-1">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5">
                        <Factory size={12} /> Estaciones
                    </span>
                    <span className="font-bold text-slate-800">{result.stationsCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5">
                        <BarChart3 size={12} /> Saturación
                    </span>
                    <span className="font-bold text-slate-800">{formatNumber(result.lineEfficiency || 0)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5">
                        <Timer size={12} /> Ciclo Real
                    </span>
                    <span className="font-bold text-slate-800">{formatNumber(result.realCycleTime)}s</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Estado</span>
                    <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${statusColor}`}>
                        {statusIcon} {statusLabel}
                    </span>
                </div>
            </div>

            {/* Apply button */}
            <button
                onClick={() => onApply(result)}
                className={`mt-4 w-full py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 ${
                    isRecommended
                        ? 'text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                        : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                }`}
            >
                <CheckCircle2 size={16} />
                Aplicar
            </button>
        </div>
    );
};

export const OptimizationResultsModal: React.FC<OptimizationResultsModalProps> = ({ results, onClose, onApply }) => {
    const [showDetails, setShowDetails] = useState(false);

    if (!results || results.length === 0) return null;

    const res = results[0];
    const hasMultipleScenarios = results.length > 1;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className={`relative w-full bg-white rounded-xl shadow-xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh] ${hasMultipleScenarios ? 'max-w-3xl' : 'max-w-lg'}`}>

                {/* HEADER (Minimalist) */}
                <div className="flex items-center justify-between px-8 pt-8 pb-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Sparkles size={20} className="text-indigo-500" />
                            Optimización Completada
                        </h3>
                        <p className="text-slate-500 text-sm mt-1">
                            {hasMultipleScenarios
                                ? `Se encontraron ${results.length} escenarios distintos. Compará y elegí el mejor.`
                                : 'Hemos calculado el balanceo óptimo para tu demanda.'
                            }
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="px-8 py-2 flex-1 overflow-y-auto">

                    {/* MULTI-SCENARIO VIEW */}
                    {hasMultipleScenarios ? (
                        <div className={`grid gap-4 mb-6 ${results.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            {results.map((r, i) => (
                                <ScenarioCard
                                    key={i}
                                    result={r}
                                    index={i}
                                    isRecommended={i === 0}
                                    onApply={onApply}
                                />
                            ))}
                        </div>
                    ) : (
                        /* SINGLE SCENARIO VIEW (original layout) */
                        <>
                            {/* HERO SECTION: HEADCOUNT */}
                            <div className="mb-6 bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100 flex items-center justify-between relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100/50 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-indigo-200/50 transition-colors"></div>

                                <div className="z-10">
                                    <div className="text-indigo-900/60 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Users size={14} /> Recursos Totales
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-black text-indigo-900 tracking-tight">
                                            {res.totalHeadcount}
                                        </span>
                                        <span className="text-lg font-bold text-indigo-900/50">Operarios (HC)</span>
                                    </div>
                                    {res.targetHeadcount && res.targetHeadcount !== res.totalHeadcount && (
                                        <div className="text-amber-600 text-xs font-bold mt-2 flex items-center gap-1">
                                            <Info size={12} /> Objetivo original: {res.targetHeadcount}
                                        </div>
                                    )}
                                </div>

                                {/* STATUS BADGE */}
                                <div className="z-10 text-right space-y-2">
                                    {res.improvementVsBaseline && res.improvementVsBaseline.stationsSaved > 0 && (
                                        <div className="bg-emerald-100 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm inline-flex items-center gap-1.5">
                                            <Sparkles size={12} className="text-emerald-600" />
                                            <span className="text-xs font-bold text-emerald-700">
                                                ¡Ahorró {res.improvementVsBaseline.stationsSaved} estación(es)!
                                            </span>
                                        </div>
                                    )}
                                    {res.improvementVsBaseline && res.improvementVsBaseline.stationsSaved === 0 && res.improvementVsBaseline.efficiencyGain > 0.1 && (
                                        <div className="bg-blue-100 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm inline-flex items-center gap-1.5">
                                            <Sparkles size={12} className="text-blue-600" />
                                            <span className="text-xs font-bold text-blue-700">
                                                +{res.improvementVsBaseline.efficiencyGain.toFixed(1)}% eficiencia
                                            </span>
                                        </div>
                                    )}
                                    <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-indigo-100 shadow-sm inline-block">
                                        <span className="text-xs font-bold text-indigo-600">Configuración Óptima</span>
                                    </div>
                                </div>
                            </div>

                            {/* Phase 30: Comparison Split View */}
                            {res.improvementVsBaseline && res.improvementVsBaseline.stationsSaved > 0 && (
                                <div className="mb-6 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4">
                                    <h4 className="text-emerald-700 font-bold flex items-center gap-2 mb-3">
                                        <Sparkles size={16} /> Comparativa de Métodos
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white/80 p-3 rounded-lg border border-slate-200">
                                            <div className="text-slate-500 text-xs font-medium mb-1">Método Secuencial</div>
                                            <div className="text-2xl font-bold text-slate-700">
                                                {res.stationsCount + res.improvementVsBaseline.stationsSaved} <span className="text-xs font-normal text-slate-400">estaciones</span>
                                            </div>
                                        </div>
                                        <div className="bg-emerald-100/50 p-3 rounded-lg border border-emerald-300 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-1">
                                                <div className="bg-emerald-200 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">Recomendado</div>
                                            </div>
                                            <div className="text-emerald-700 text-xs font-medium mb-1">Algoritmo Genético</div>
                                            <div className="text-2xl font-bold text-emerald-700">
                                                {res.stationsCount} <span className="text-xs font-normal text-emerald-500">estaciones</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SECONDARY METRICS GRID */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                {(() => {
                                    const isFeasible = res.efficiency >= 100;
                                    const isRisk = res.efficiency >= 95 && res.efficiency < 100;

                                    let statusLabel = 'Factible';
                                    let statusColor = 'border-emerald-200 bg-emerald-50';
                                    let statusTextColor = 'text-emerald-700';
                                    let statusDesc = 'La línea cumple la demanda';

                                    if (!isFeasible && !isRisk) {
                                        statusLabel = 'No Factible';
                                        statusColor = 'border-red-200 bg-red-50';
                                        statusTextColor = 'text-red-700';
                                        statusDesc = 'Capacidad insuficiente';
                                    } else if (isRisk) {
                                        statusLabel = 'Riesgo';
                                        statusColor = 'border-amber-200 bg-amber-50';
                                        statusTextColor = 'text-amber-700';
                                        statusDesc = `${formatNumber(res.efficiency)}% de capacidad`;
                                    }

                                    return (
                                        <div className={`p-4 rounded-xl border ${statusColor}`}>
                                            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Estado</div>
                                            <div className={`text-3xl font-black ${statusTextColor} flex items-center gap-2`}>
                                                {isFeasible && <span>✅</span>}
                                                {isRisk && <span>⚠️</span>}
                                                {!isFeasible && !isRisk && <span>❌</span>}
                                                {statusLabel}
                                            </div>
                                            <div className="text-slate-400 text-xs mt-1">{statusDesc}</div>
                                        </div>
                                    );
                                })()}

                                <div className="p-4 rounded-xl border border-slate-100 bg-white">
                                    <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Saturación Activos</div>
                                    <div className="text-3xl font-black text-slate-800">
                                        {formatNumber(res.lineEfficiency || 0)}%
                                    </div>
                                    <div className="text-slate-400 text-xs mt-1">
                                        Pérdida: {formatNumber(res.idleTime)}s
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* DETAILS EXPANDER (Subtle) */}
                    <div>
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="w-full flex items-center justify-between text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors py-2 group"
                        >
                            <span>Detalles de Ingeniería</span>
                            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />}
                        </button>

                        {showDetails && (
                            <div className="mt-2 text-xs text-slate-600 space-y-2 px-2 pb-2 animate-in slide-in-from-top-1 bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                    <span>Motor de Cálculo:</span>
                                    <span className="font-mono text-slate-800">{res.technicalName} (1000 iteraciones)</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                    <span>Estaciones Físicas:</span>
                                    <span className="font-mono text-slate-800">{res.stationsCount}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                    <span>Ciclo Real (Botella):</span>
                                    <span className="font-mono text-slate-800">{formatNumber(res.realCycleTime)}s</span>
                                </div>
                                {res.improvementVsBaseline && (
                                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                        <span>Mejora vs Método Estándar:</span>
                                        <span className="font-mono text-emerald-600">
                                            {res.improvementVsBaseline.stationsSaved > 0
                                                ? `${res.improvementVsBaseline.stationsSaved} estación(es) menos`
                                                : `+${res.improvementVsBaseline.efficiencyGain.toFixed(1)}% eficiencia`
                                            }
                                        </span>
                                    </div>
                                )}
                                {hasMultipleScenarios && (
                                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                        <span>Escenarios Distintos:</span>
                                        <span className="font-mono text-indigo-600">{results.length} encontrados</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* FOOTER ACTIONS */}
                <div className="px-8 pb-8 pt-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                        Descartar
                    </button>
                    {!hasMultipleScenarios && (
                        <button
                            onClick={() => onApply(res)}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl transition-all flex items-center gap-2 transform active:scale-95"
                        >
                            <CheckCircle2 size={18} />
                            Aplicar Configuración
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
