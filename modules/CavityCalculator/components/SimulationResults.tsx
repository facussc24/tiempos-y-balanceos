import React from 'react';
import { ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Area, ReferenceLine, Bar, Cell } from 'recharts';
import { AlertOctagon, TrendingDown, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatNumber } from '../../../utils';
import { calculateMinOperators } from '../../../core/core_logic';
import { InjectionScenario } from '../../../types';
import { SmartInsight } from './SmartInsight';
import { analyzeImprovementOpportunities } from '../logic/optimizationAnalysis';

interface Props {
    chartData: InjectionScenario[];
    activeN: number;
    taktTime: number;
    realCycleTime: number;
    isBottleneckLabor: boolean;
    hourlyOutput: number;
    lostOutput: number;
    machinePortionPct: number;
    operatorDelay: number;
    manualLimitCycle: number;
    activeHeadcount: number;
    currentEffectiveManualTime: number;
    // We strictly need N* for analysis. 
    // We can iterate chartData to find max feasible N or rely on props.
    // 'activeN' usually points to 'n' in chartData.
    nStar: number;
    dailyDemand: number;
    availableSeconds?: number;
    oee: number;
}

export const SimulationResults: React.FC<Props> = ({
    chartData, activeN, taktTime, realCycleTime, isBottleneckLabor, hourlyOutput, lostOutput,
    machinePortionPct, operatorDelay, manualLimitCycle, activeHeadcount, currentEffectiveManualTime,
    nStar
}) => {
    // 1. Derive Current Scenario
    const currentScenario = chartData.find(d => d.n === activeN);

    // 2. Generate Insight
    const insight = currentScenario ? analyzeImprovementOpportunities(currentScenario, chartData, nStar) : null;

    return (
        <div className="flex-1 relative flex flex-col">
            {/* SMART INSIGHT WIDGET */}
            <SmartInsight insight={insight} />

            {/* SAFETY & SATURATION ALERTS [PHASE 8] */}
            {(() => {
                // Calculate Saturation during Machine Cycle (Shadow Time + External)
                // If BottleneckLabor is true, Manual > Machine, so saturation > 100% implicitly.
                // We want to warn even if NOT bottleneck but VERY close (90-99%)

                const saturationRatio = (machinePortionPct > 0) ? (currentEffectiveManualTime / (realCycleTime * (machinePortionPct / 100) / (machinePortionPct / 100))) : 0;
                // Wait, machinePortionPct is (machine/real)*100. 
                // Simpler: Compare Manual vs Machine Limit.
                const manualLoad = currentEffectiveManualTime;

                // We need the "Pure Machine Time" (approximate from manualLimitCycle vs realCycle logic or just trust the bottleneck flag).
                // Actually, manualLimitCycle vs machineLimitCycle (hidden props in Logic but calculated in useCavityCalculator).
                // Let's use the isBottleneckLabor and calculate percentage.

                // Approximation: RealCycle = Max(Machine, Manual).
                // If Bottleneck, Real = Manual. Saturation = 100%+.
                // If Machine Paced, Real = Machine. Saturation = Manual / Machine.

                const saturationPct = activeHeadcount > 0
                    ? (currentEffectiveManualTime / (activeHeadcount * realCycleTime)) * 100
                    : 0;

                const isCriticalSaturation = saturationPct >= 98; // >98% (No rest)
                const isHighSaturation = saturationPct >= 90 && saturationPct < 98; // 90-98% (Risk)

                if (isBottleneckLabor) {
                    return (
                        <div className="mb-2 mx-0 bg-red-100 border-l-4 border-red-500 p-3 rounded-r-lg shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                            <div className="bg-red-200 p-1.5 rounded-full text-red-700 mt-0.5"><AlertOctagon size={16} /></div>
                            <div>
                                <h4 className="text-xs font-black text-red-800 uppercase tracking-wide">¡Alerta: Cuello de Botella Operativo!</h4>
                                <p className="text-xs text-red-700 leading-relaxed mt-0.5">
                                    El tiempo manual ({formatNumber(currentEffectiveManualTime)}s) excede el tiempo de máquina.
                                    <strong> El ciclo se ha extendido</strong> y la máquina está esperando al operario.
                                </p>
                            </div>
                        </div>
                    );
                }

                if (isCriticalSaturation) {
                    return (
                        <div className="mb-2 mx-0 bg-amber-100 border-l-4 border-amber-500 p-3 rounded-r-lg shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                            <div className="bg-amber-200 p-1.5 rounded-full text-amber-900 mt-0.5"><AlertTriangle size={16} /></div>
                            <div>
                                <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide">¡Alerta de Saturación Critica! ({formatNumber(saturationPct)}%)</h4>
                                <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
                                    El operario trabaja el <strong>{formatNumber(saturationPct)}%</strong> del tiempo de ciclo sin descanso.
                                    Riesgo ergonómico alto. Considere reducir carga o rotar personal.
                                </p>
                            </div>
                        </div>
                    );
                }

                if (isHighSaturation) {
                    return (
                        <div className="mb-2 mx-0 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-lg shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                            <div className="bg-yellow-100 p-1.5 rounded-full text-yellow-700 mt-0.5"><TrendingDown size={16} /></div>
                            <div>
                                <h4 className="text-xs font-black text-yellow-800 uppercase tracking-wide">Aviso: Saturación Elevada ({formatNumber(saturationPct)}%)</h4>
                                <p className="text-xs text-yellow-700 leading-relaxed mt-0.5">
                                    Poco margen de recuperación. Cualquier pequeña variación en el operador detendrá la máquina.
                                </p>
                            </div>
                        </div>
                    );
                }

                {/* FATIGUE RISK (SMART ROI) */ }
                if (currentScenario?.isFatigueRisk) {
                    return (
                        <div className="mb-2 mx-0 bg-amber-100 border-l-4 border-amber-500 p-3 rounded-r-lg shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                            <div className="bg-amber-200 p-1.5 rounded-full text-amber-900 mt-0.5"><AlertTriangle size={16} /></div>
                            <div>
                                <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide flex items-center gap-1"><AlertTriangle size={12} /> Alerta de Fatiga: Saturación &gt; 85%</h4>
                                <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
                                    Se ha permitido 1 Operador para optimizar costos, pero la saturación es alta. Vigile la fatiga.
                                </p>
                            </div>
                        </div>
                    );
                }

                return null;
            })()}

            {/* METRICS HEADER */}
            <div className="flex gap-6 mb-2 pr-12 items-start border-b border-slate-100 pb-4">
                <div className="flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Ritmo Cliente (Takt)</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-800 tracking-tight">
                            {taktTime > 0 ? formatNumber(taktTime) : <span className="text-slate-300 text-2xl">--</span>}
                        </span>
                        <span className="text-xs font-bold text-slate-400">seg/u</span>
                    </div>
                </div>

                <div className="w-px bg-slate-200 self-stretch mx-2"></div>

                <div className="flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Ciclo Resultante (Real)</span>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-black tracking-tight ${isBottleneckLabor ? 'text-red-600' : 'text-indigo-600'}`}>
                            {formatNumber(realCycleTime)}
                        </span>
                        <span className={`text-xs font-bold ${isBottleneckLabor ? 'text-red-400' : 'text-indigo-300'}`}>seg/u</span>
                    </div>
                    {isBottleneckLabor ? (
                        <div className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded inline-flex items-center gap-1 mt-1 border border-red-100 animate-pulse">
                            <AlertOctagon size={10} />
                            Cuello: OPERADOR
                        </div>
                    ) : (
                        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded inline-block mt-1">Cuello: Máquina</span>
                    )}
                </div>

                <div className="w-px bg-slate-200 self-stretch mx-2"></div>

                <div className="flex-1 text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Capacidad Máxima (Output)</span>
                    <div className="flex items-baseline gap-1 justify-end">
                        <span className={`text-3xl font-black ${isBottleneckLabor ? 'text-red-600' : 'text-slate-800'}`}>{Math.floor(hourlyOutput)}</span>
                        <span className="text-xs font-bold text-slate-400">pz/h</span>
                    </div>
                    {isBottleneckLabor && lostOutput > 0.5 && (
                        <div className="text-[9px] font-bold text-red-500 flex items-center justify-end gap-1 mt-1">
                            <TrendingDown size={10} />
                            Perdiendo {Math.floor(lostOutput)} pz/h
                        </div>
                    )}
                </div>
            </div>

            {/* VISUAL CYCLE BAR */}
            <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-inner relative overflow-hidden">
                <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 z-10 relative">
                    <span>Composición del Ciclo Real</span>
                    <span>{formatNumber(realCycleTime)}s Total</span>
                </div>

                <div className="h-6 w-full bg-slate-200 rounded-full flex overflow-hidden relative">
                    <div
                        className="h-full bg-indigo-500 flex items-center justify-center text-[10px] text-white font-bold transition-all duration-500"
                        style={{ width: `${machinePortionPct}%` }}
                    >
                        {machinePortionPct > 10 && "MÁQUINA"}
                    </div>
                    {operatorDelay > 0.1 && (
                        <div
                            className={`h-full flex items-center justify-center text-[10px] text-white font-bold transition-all duration-500 relative pattern-diagonal-lines ${isBottleneckLabor ? 'bg-red-400' : 'bg-emerald-500'}`}
                            style={{ width: `${100 - machinePortionPct}%` }}
                        >
                            <span className="drop-shadow-md whitespace-nowrap px-1">
                                {isBottleneckLabor ? `ESPERA MÁQ (${formatNumber(operatorDelay)}s)` : `SLACK OP (${formatNumber(operatorDelay)}s)`}
                            </span>
                        </div>
                    )}
                </div>
                {operatorDelay > 0.1 && formatNumber(operatorDelay) !== "0,00" && (
                    <div className={`mt-2 text-[10px] font-bold flex items-center gap-1 justify-center ${isBottleneckLabor ? 'text-red-500' : 'text-emerald-600 animate-pulse'}`}>
                        {isBottleneckLabor ? <AlertOctagon size={12} /> : <TrendingUp size={12} />}
                        {isBottleneckLabor
                            ? `La máquina espera ${formatNumber(operatorDelay)}s al operario por ciclo.`
                            : `El operario tiene ${formatNumber(operatorDelay)}s de tiempo libre (slack) por ciclo.`
                        }
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="n"
                            label={{ value: 'Número de Cavidades', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tick={{ fill: '#64748b', fontSize: 11 }}
                        />
                        <YAxis yAxisId="left" hide />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} unit="s" />

                        <Tooltip
                            cursor={{ fill: '#f8fafc', opacity: 0.5 }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    const physicalOps = Math.max(1, Math.ceil(d.reqOperators));
                                    const isWaiting = d.machineStatus === 'waiting';
                                    const isSaturated = !isWaiting;

                                    return (
                                        <div className="bg-white text-slate-700 text-xs p-3 rounded-lg shadow-xl border border-slate-200 ring-1 ring-black/5">
                                            <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2 gap-4">
                                                <span className="font-bold text-base text-slate-800">{d.n} Cavidades</span>
                                                {!d.isSingleMachineFeasible && <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-100">MULTI-MÁQUINA</span>}
                                            </div>
                                            <div className="space-y-1">
                                                <p className="flex justify-between gap-4"><span>Ciclo Unitario:</span> <span className="font-mono font-bold">{formatNumber(d.cyclePerPiece)}s</span></p>
                                                {isWaiting && (
                                                    <p className="flex justify-between gap-4 text-red-500 font-bold border-t border-red-50 pt-1 mt-1">
                                                        <span>Estado:</span> <span>Esperando Curado</span>
                                                    </p>
                                                )}
                                                {isSaturated && (
                                                    <p className="flex justify-between gap-4 text-emerald-600 font-bold border-t border-emerald-50 pt-1 mt-1">
                                                        <span>Estado:</span> <span>Máx. Velocidad</span>
                                                    </p>
                                                )}
                                                <div className="border-t border-slate-100 pt-1 mt-1">
                                                    <p className="flex justify-between gap-4 text-indigo-600 font-bold">
                                                        <span>Personal:</span> <span>{physicalOps} Op.</span>
                                                    </p>
                                                    <p className="flex justify-between gap-4 text-slate-500 mt-1 italic">
                                                        <span>T. Manual Total:</span> <span>{formatNumber(d.manualTime)}s</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar yAxisId="right" dataKey="cyclePerPiece" stackId="a" barSize={40} radius={[0, 0, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.barColor}
                                    fillOpacity={activeN === entry.n ? 1 : 0.4}
                                    stroke={activeN === entry.n ? '#4f46e5' : 'transparent'}
                                    strokeWidth={activeN === entry.n ? 3 : 0}
                                />
                            ))}
                        </Bar>
                        <Bar yAxisId="right" name="Tiempo Espera (Cuello Botella)" dataKey="waitOp" stackId="a" barSize={40} radius={[4, 4, 0, 0]} fill="#ef4444" stroke="#ef4444" fillOpacity={0.6} />
                        {taktTime > 0 && (
                            <ReferenceLine yAxisId="right" y={taktTime} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} label={{ value: 'TAKT (Límite)', fill: '#ef4444', fontSize: 10, position: 'insideTopRight', fontWeight: 'bold' }} />
                        )}
                        {isBottleneckLabor && (
                            <ReferenceLine yAxisId="right" y={manualLimitCycle} stroke="#334155" strokeDasharray="3 3" strokeWidth={3} label={{ value: `Límite Operador (${activeHeadcount}p)`, fill: '#334155', fontSize: 10, position: 'insideRight', fontWeight: 'bold', dy: -10 }} />
                        )}
                        <ReferenceLine yAxisId="right" y={0} label={{ value: `Min Op: ${calculateMinOperators(currentEffectiveManualTime, taktTime)}`, fill: '#64748b', fontSize: 10, position: 'insideBottomLeft', fontWeight: 'bold', dy: -20 }} />
                        <Area yAxisId="left" type="monotone" dataKey="reqOperators" stroke="transparent" fill="transparent" />
                        <ReferenceDot yAxisId="left" x={activeN} y={chartData.find(d => d.n === activeN)?.reqOperators} r={6} fill="#4f46e5" stroke="white" strokeWidth={2} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
