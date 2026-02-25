import React from 'react';
import { Layers, MinusCircle, PlusCircle, AlertTriangle, Users, HelpCircle, TrendingDown, ArrowRight, TrendingUp, Lock } from 'lucide-react';
import { formatNumber } from '../../../utils';
import { ManualOperation, InjectionScenario } from '../../../types';

interface Props {
    // Cavities
    activeN: number;
    updateCavities: (delta: number) => void;
    cavityMode: 'auto' | 'manual';
    setCavityMode: (mode: 'auto' | 'manual') => void;
    // Headcount
    activeHeadcount: number;
    updateHeadcount: (delta: number) => void;
    headcountMode: 'auto' | 'manual';
    setHeadcountMode: (mode: 'auto' | 'manual') => void;
    userHeadcountStr: string;
    setUserHeadcountStr: (val: string) => void;
    // Status
    isBottleneckLabor: boolean;
    realSaturation: number;
    // Data for Sensitivity
    chartData: InjectionScenario[];
    selectedData: InjectionScenario | undefined;
    manualOps: ManualOperation[];
    hourlyOutput: number;
    realCycleTime: number;
}

export const ProductionControls: React.FC<Props> = ({
    activeN, updateCavities, cavityMode, setCavityMode,
    activeHeadcount, updateHeadcount, headcountMode, setHeadcountMode, userHeadcountStr, setUserHeadcountStr,
    isBottleneckLabor, realSaturation,
    chartData, selectedData, manualOps, hourlyOutput, realCycleTime
}) => {

    return (
        <div className="flex flex-col gap-4 mb-4">
            {/* CONTROL: CAVITIES */}
            <div className={`flex-1 border rounded-xl px-4 py-2 shadow-sm flex flex-col items-center justify-center min-w-[160px] transition-colors relative group ${cavityMode === 'auto' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                <div className="absolute top-2 right-2 flex gap-1 bg-white rounded-md border border-slate-200 p-0.5 shadow-sm">
                    <button
                        onClick={() => setCavityMode('auto')}
                        data-testid="btn-cavity-mode-auto"
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors ${cavityMode === 'auto' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Cálculo Automático (Basado en Takt Time)"
                    >
                        AUTO
                    </button>
                    <button
                        onClick={() => setCavityMode('manual')}
                        data-testid="btn-cavity-mode-manual"
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors ${cavityMode === 'manual' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Selección Manual"
                    >
                        MAN
                    </button>
                </div>

                <span className="text-[9px] font-bold uppercase tracking-widest mt-4 mb-0.5 flex items-center gap-1 text-indigo-600">
                    <Layers size={10} /> N° Cavidades {cavityMode === 'auto' && '(Min)'}
                </span>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => updateCavities(-1)}
                        data-testid="btn-cavity-dec"
                        disabled={cavityMode === 'auto'}
                        className={`p-1 rounded-full transition-colors ${cavityMode === 'auto' ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-100 text-indigo-300 hover:text-indigo-600'}`}
                    >
                        <MinusCircle size={18} />
                    </button>

                    <div className="flex flex-col items-center">
                        <span className={`text-3xl font-black leading-none ${cavityMode === 'auto' ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {activeN}
                        </span>
                    </div>

                    <button
                        onClick={() => updateCavities(1)}
                        data-testid="btn-cavity-inc"
                        disabled={cavityMode === 'auto'}
                        className={`p-1 rounded-full transition-colors ${cavityMode === 'auto' ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-100 text-indigo-300 hover:text-indigo-600'}`}
                    >
                        <PlusCircle size={18} />
                    </button>
                </div>

                {/* STACKED ALERTS & PREDICTION CONTAINER */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 flex flex-col gap-1 z-20 pointer-events-none">
                    {/* TAKT VIOLATION WARNING - FIX-3: Clarify is about operator, not cavities */}
                    {selectedData && !selectedData.isSingleMachineFeasible && (
                        <div className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-1 rounded border border-amber-200 text-center shadow-sm flex flex-col items-center animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center gap-1 mb-0.5">
                                <AlertTriangle size={10} />
                                <span>Operario Saturado ({formatNumber(realSaturation)}%)</span>
                            </div>
                            <span className="opacity-80 font-medium">N* Óptimo: {selectedData.nStar} cavidades</span>
                        </div>
                    )}

                    {/* SENSITIVITY PREVIEW (Cavities) */}
                    <div className="absolute top-full left-0 right-0 mt-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                        <div className="bg-white border border-slate-200 rounded-lg shadow-xl p-2">
                            {(() => {
                                const nextN = Math.min(28, activeN + 1);
                                if (nextN === activeN) return null;

                                const nextData = chartData.find(d => d.n === nextN);
                                if (!nextData) return null;

                                const currentOutput = hourlyOutput;
                                const nextOutput = nextData.realCycle > 0 ? (3600 / nextData.realCycle) : 0;
                                const diff = nextOutput - currentOutput;
                                const isBetter = diff > 1;

                                return (
                                    <div className="text-center">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Predicción (+1 Cav)</div>
                                        {isBetter ? (
                                            <div>
                                                <div className="text-emerald-600 font-bold text-xs flex items-center justify-center gap-1">
                                                    <TrendingUp size={12} />
                                                    +{Math.floor(diff)} pz/h
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-medium">
                                                    {Math.floor(currentOutput)} &rarr; {Math.floor(nextOutput)}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-slate-400 text-[10px] font-medium flex items-center justify-center gap-1">
                                                <Lock size={10} />
                                                Sin mejora significativa
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTROL: HEADCOUNT */}
            <div className={`flex-1 border rounded-xl px-4 py-2 shadow-sm flex flex-col items-center justify-center min-w-[160px] transition-colors relative group ${isBottleneckLabor ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className="absolute top-2 right-2 flex gap-1 bg-white rounded-md border border-slate-200 p-0.5 shadow-sm">
                    <button
                        onClick={() => setHeadcountMode('auto')}
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors ${headcountMode === 'auto' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        AUTO
                    </button>
                    <button
                        onClick={() => setHeadcountMode('manual')}
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors ${headcountMode === 'manual' ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        MAN
                    </button>
                </div>

                <span className={`text-[9px] font-bold uppercase tracking-widest mt-4 mb-0.5 flex items-center gap-1 ${isBottleneckLabor ? 'text-red-600' : 'text-indigo-400'}`}>
                    <Users size={10} /> Dotación <HelpCircle size={8} className="cursor-help opacity-50 hover:opacity-100" />
                </span>

                <div className="flex items-center gap-3">
                    {headcountMode === 'manual' && (
                        <button
                            onClick={() => updateHeadcount(-1)}
                            className={`p-1 hover:bg-white rounded-full transition-colors ${isBottleneckLabor ? 'text-red-400 hover:text-red-600' : 'text-indigo-300 hover:text-indigo-600'}`}
                        >
                            <MinusCircle size={18} />
                        </button>
                    )}

                    <div className="flex flex-col items-center">
                        {headcountMode === 'manual' ? (
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="text"
                                    className={`text-3xl font-black text-center w-24 bg-transparent outline-none border-b-2 focus:border-current transition-all ${isBottleneckLabor ? 'text-red-700 border-red-300' : 'text-indigo-700 border-indigo-300'}`}
                                    value={userHeadcountStr}
                                    onChange={e => setUserHeadcountStr(e.target.value)}
                                />
                                <span className={`text-xs font-bold ${isBottleneckLabor ? 'text-red-500' : 'text-indigo-500'}`}>Op.</span>
                            </div>
                        ) : (
                            <span className={`text-3xl font-black leading-none ${isBottleneckLabor ? 'text-red-700' : 'text-indigo-700'}`}>
                                {activeHeadcount} Op.
                            </span>
                        )}
                    </div>

                    {headcountMode === 'manual' && (
                        <button
                            onClick={() => updateHeadcount(1)}
                            className={`p-1 hover:bg-white rounded-full transition-colors ${isBottleneckLabor ? 'text-red-400 hover:text-red-600' : 'text-indigo-300 hover:text-indigo-600'}`}
                        >
                            <PlusCircle size={18} />
                        </button>
                    )}
                </div>

                <span className={`text-[9px] font-medium mt-1 ${isBottleneckLabor ? 'text-red-600 font-bold' : 'text-indigo-400'}`}>
                    Sat: {formatNumber(realSaturation)}%
                </span>

                {/* SENSITIVITY PREVIEW (Manual Mode Only) */}
                {headcountMode === 'manual' && selectedData && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20 animate-in fade-in slide-in-from-top-1 pointer-events-none">
                        {(() => {
                            const nextOps = activeHeadcount + 1;
                            const workContent = selectedData.manualTime;
                            const totalWork = workContent * selectedData.machinesNeeded;
                            const nextLimit = totalWork / nextOps;

                            let totalInternal = 0;
                            let totalExternal = 0;
                            manualOps.forEach(op => {
                                const timeForN = (op.refCavities && op.refCavities > 0)
                                    ? (op.time / op.refCavities) * activeN
                                    : op.time;
                                if (op.type === 'external') totalExternal += timeForN;
                                else totalInternal += timeForN;
                            });

                            const naturalCycle = Math.max(selectedData.cyclePerPiece, totalInternal) + totalExternal;
                            const nextRealCycle = Math.max(naturalCycle, nextLimit);
                            const improvement = realCycleTime - nextRealCycle;
                            const isWorth = improvement > 0.1;

                            return (
                                <div className="text-center">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Predicción (+1 Op)</div>
                                    {isWorth ? (
                                        <div>
                                            <div className="text-emerald-600 font-bold text-xs flex items-center justify-center gap-1">
                                                <TrendingDown size={12} />
                                                {formatNumber(realCycleTime)}s <ArrowRight size={10} /> {formatNumber(nextRealCycle)}s
                                            </div>
                                            <div className="text-[9px] text-emerald-500 font-medium">
                                                Mejora: {formatNumber(improvement)}s
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-slate-400 text-[10px] font-medium flex items-center justify-center gap-1">
                                            <Lock size={10} />
                                            Sin cambios (Límite Máq)
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
};
