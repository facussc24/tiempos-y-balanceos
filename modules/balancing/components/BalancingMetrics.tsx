import React, { useState } from 'react';
import { Users, TrendingUp, HelpCircle, Timer, Plus, Minus, Trash2, Sparkles, Scale, Calculator, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, XCircle, Link2, BarChart3, Clock } from 'lucide-react';
import { formatNumber } from '../../../utils';
import { SimStation } from '../../../core/balancing/engine';
import { Tooltip } from '../../../components/ui/Tooltip';


interface BalancingMetricsProps {
    configuredStations: number;
    totalHeadcount: number;
    efficiency: number;
    efficiencyLine: number;
    saturationVsTakt?: number;
    realCycleTime: number;
    machineCycleTime: number;
    totalIdleTimePerCycle: number;
    dailyLostHours: number;
    setStationCount: (count: number) => void;
    addStation: () => void;
    removeEmptyStation: () => void;
    emptyStationIds: number[];
    clearBalance: () => void;
    handleOptimization: () => void;
    balancingMode?: 'SALBP1' | 'SALBP2';
    targetOperators?: number;
    balancingObjective?: 'MAX_THROUGHPUT' | 'SMOOTH_WORKLOAD';
    onModeChange?: (mode: 'SALBP1' | 'SALBP2') => void;
    onTargetOperatorsChange?: (n: number) => void;
    onObjectiveChange?: (obj: 'MAX_THROUGHPUT' | 'SMOOTH_WORKLOAD') => void;
    onOpenWorkSheets?: () => void;
    nominalTaktTime?: number;
    totalWorkContent?: number;
    dailyAvailableTime?: number;
    dailyDemand?: number;
    gaProgress?: {
        generation: number;
        totalGenerations: number;
        bestFitness: number;
        phase: 'initializing' | 'evolving' | 'complete';
    } | null;
    stationData?: SimStation[];
    onOpenZoningConstraints?: () => void;
    zoningConstraintsCount?: number;
}


export const BalancingMetrics: React.FC<BalancingMetricsProps> = ({
    configuredStations,
    totalHeadcount,
    saturationVsTakt = 0,
    realCycleTime,
    machineCycleTime,
    totalIdleTimePerCycle,
    addStation,
    removeEmptyStation,
    emptyStationIds,
    clearBalance,
    handleOptimization,
    nominalTaktTime = 0,
    totalWorkContent = 0,
    dailyAvailableTime = 0,
    dailyDemand = 0,
    gaProgress = null,
    stationData = [],
    onOpenZoningConstraints,
    zoningConstraintsCount = 0
}) => {
    const [showFormulas, setShowFormulas] = useState(false);
    const [showSummary, setShowSummary] = useState(false);

    // Smoothness Index
    const smoothnessIndex = React.useMemo(() => {
        if (!stationData || stationData.length === 0) return 0;
        const validTimes = stationData
            .map(st => st.effectiveTime)
            .filter(t => typeof t === 'number' && !isNaN(t) && isFinite(t));
        if (validTimes.length === 0) return 0;
        const maxCycle = Math.max(...validTimes);
        const sumSquares = stationData.reduce((sum, st) => {
            const time = st.effectiveTime;
            if (typeof time !== 'number' || isNaN(time) || !isFinite(time)) return sum;
            const diff = maxCycle - time;
            return sum + (diff * diff);
        }, 0);
        return Math.sqrt(sumSquares);
    }, [stationData]);

    const siColor = smoothnessIndex <= 10 ? 'text-status-ok' : smoothnessIndex <= 30 ? 'text-status-warn' : 'text-status-crit';

    // Min/max station times for Crystal Box
    const stationTimes = stationData.map(st => st.effectiveTime).filter(t => typeof t === 'number' && isFinite(t));
    const maxStationTime = stationTimes.length > 0 ? Math.max(...stationTimes) : 0;
    const minStationTime = stationTimes.length > 0 ? Math.min(...stationTimes) : 0;

    // Utilización color
    const utilizationColor = saturationVsTakt > 100 ? 'text-status-crit' : saturationVsTakt < 85 ? 'text-status-warn' : 'text-status-ok';

    // Theoretical minimum headcount
    const theoreticalHC = nominalTaktTime > 0 ? Math.ceil(totalWorkContent / nominalTaktTime) : 0;
    const hcDelta = totalHeadcount - theoreticalHC;

    // Feasibility
    const cycleRatio = nominalTaktTime > 0 ? realCycleTime / nominalTaktTime : 0;
    let statusLabel = 'Factible';
    let StatusIcon = CheckCircle2;
    let statusColor = 'bg-status-ok-bg text-emerald-700 border-emerald-200';

    if (cycleRatio > 1.05) {
        StatusIcon = XCircle;
        statusLabel = 'No Factible';
        statusColor = 'bg-status-crit-bg text-red-700 border-red-200';
    } else if (cycleRatio > 1) {
        StatusIcon = AlertTriangle;
        statusLabel = 'Riesgo';
        statusColor = 'bg-status-warn-bg text-amber-700 border-amber-200';
    }

    // Can remove station? — Now uses emptyStationIds from the hook
    const canRemoveStation = emptyStationIds.length > 0 && configuredStations > 1;
    const nextStationToRemove = emptyStationIds.length > 0 ? emptyStationIds[0] : null;

    return (
        <div className="flex flex-col gap-3 bg-white p-3 rounded-md border border-slate-200 shadow-sm relative z-40">
            {/* GA Progress Bar */}
            {gaProgress && (
                <div className="bg-accent text-white px-4 py-3 rounded-md shadow-sm animate-in fade-in duration-300">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="animate-pulse" />
                            <span className="font-bold text-sm">
                                {gaProgress.phase === 'initializing' ? 'Inicializando...' :
                                    `Optimizando ${gaProgress.generation}/${gaProgress.totalGenerations}`}
                            </span>
                        </div>
                        <span className="text-xs opacity-80 tabular-nums">
                            Fitness: {gaProgress.bestFitness < Infinity ? gaProgress.bestFitness.toFixed(0) : '...'}
                        </span>
                    </div>
                    <div className="w-full bg-white/20 h-2 rounded-sm overflow-hidden">
                        <div
                            className="h-full bg-status-ok rounded-sm transition-all duration-200"
                            style={{ width: `${gaProgress.totalGenerations > 0 ? (gaProgress.generation / gaProgress.totalGenerations) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Crystal Box - Formula Transparency Panel */}
            <div className="border-b border-slate-100 pb-2">
                <button
                    onClick={() => setShowFormulas(!showFormulas)}
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-accent font-bold uppercase tracking-wider transition-colors group"
                >
                    <Calculator size={12} className="group-hover:text-accent" />
                    Ver Fórmulas
                    {showFormulas ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {showFormulas && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 animate-in slide-in-from-top-2 duration-300">
                        {/* CARD 1: RITMO */}
                        <div className="p-3 bg-industrial-50 border border-industrial-200 rounded-md border-l-4 border-l-accent flex flex-col justify-between">
                            <div>
                                <div className="text-xs text-accent font-bold mb-1.5 flex items-center gap-1">
                                    <Timer size={10} />
                                    Ritmo de Producción
                                </div>
                                <div className="font-mono text-xs tabular-nums flex items-center gap-1 flex-wrap mb-1">
                                    <span className="text-slate-500">Takt =</span>
                                    <span className="text-accent">{formatNumber(dailyAvailableTime)}s</span>
                                    <span className="text-slate-400">/</span>
                                    <span className="text-accent">{dailyDemand}</span>
                                    <span className="text-slate-400">=</span>
                                    <span className="font-bold text-slate-900 tabular-nums bg-white px-1.5 py-0.5 rounded-md shadow-sm">{formatNumber(nominalTaktTime)}s</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                    Cada <span className="tabular-nums">{formatNumber(nominalTaktTime)}s</span> debe salir 1 pieza para cumplir <span className="tabular-nums">{dailyDemand}</span> piezas/día.
                                </p>
                            </div>
                            <div className="mt-2 pt-2 border-t border-industrial-200/50 flex justify-between items-center text-xs">
                                <div>
                                    <span className="text-slate-400 block text-xs uppercase">Necesario</span>
                                    <span className="font-bold text-slate-700 tabular-nums">{formatNumber(nominalTaktTime)}s</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-400 block text-xs uppercase">Actual</span>
                                    <span className={`font-bold tabular-nums ${realCycleTime <= nominalTaktTime ? 'text-status-ok' : 'text-status-crit'}`}>
                                        {formatNumber(realCycleTime)}s
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* CARD 2: UTILIZACIÓN */}
                        <div className="p-3 bg-industrial-50 border border-industrial-200 rounded-md border-l-4 border-l-status-ok flex flex-col justify-between">
                            <div>
                                <div className="text-xs text-status-ok font-bold mb-1.5 flex items-center gap-1">
                                    <TrendingUp size={10} />
                                    Utilización de Operarios
                                </div>
                                <div className="font-mono text-xs tabular-nums flex items-center gap-1 flex-wrap mb-1">
                                    <span className="text-slate-500">Util =</span>
                                    <span className="text-status-ok">{formatNumber(totalWorkContent)}s</span>
                                    <span className="text-slate-400">/</span>
                                    <span className="text-status-warn">({totalHeadcount} ops × {formatNumber(nominalTaktTime)}s)</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                    {saturationVsTakt >= 85 && saturationVsTakt <= 100
                                        ? 'Tus operarios están bien aprovechados.'
                                        : saturationVsTakt > 100
                                            ? 'No alcanzan las manos. Necesitás más operarios.'
                                            : 'Hay capacidad ociosa. Podrías reducir operarios.'}
                                    <span className="text-slate-400"> Solo trabajo manual (excl. máquinas).</span>
                                </p>
                            </div>
                            <div className="mt-2 pt-2 border-t border-industrial-200/50 flex justify-between items-center">
                                <span className="text-xs text-slate-400 italic">
                                    85-100% = ideal
                                </span>
                                <span className={`font-bold text-lg tabular-nums ${utilizationColor}`}>
                                    {formatNumber(saturationVsTakt)}%
                                </span>
                            </div>
                        </div>

                        {/* CARD 3: ESTABILIDAD */}
                        <div className="p-3 bg-industrial-50 border border-industrial-200 rounded-md border-l-4 border-l-status-warn flex flex-col justify-between">
                            <div>
                                <div className="text-xs text-status-warn font-bold mb-1.5 flex items-center gap-1">
                                    <Scale size={10} />
                                    Equilibrio entre Estaciones
                                </div>
                                <div className="font-mono text-xs tabular-nums flex items-center gap-1 flex-wrap mb-1">
                                    <span className="text-slate-500">SI =</span>
                                    <span className="text-status-warn">{formatNumber(smoothnessIndex)}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                    {stationTimes.length > 1
                                        ? `${smoothnessIndex <= 10 ? 'Carga pareja.' : smoothnessIndex <= 30 ? 'Algo despareja.' : 'Muy despareja.'} La más cargada: ${formatNumber(maxStationTime)}s, la menos: ${formatNumber(minStationTime)}s.`
                                        : 'Se necesitan 2+ estaciones para medir equilibrio.'}
                                </p>
                            </div>
                            <div className="mt-2 pt-2 border-t border-industrial-200/50 flex justify-between items-center">
                                <div className="flex-1 mr-2">
                                    <div className="h-1.5 w-full bg-slate-200 rounded-sm overflow-hidden">
                                        <div
                                            className={`h-full ${smoothnessIndex <= 10 ? 'bg-status-ok' : smoothnessIndex <= 30 ? 'bg-status-warn' : 'bg-status-crit'}`}
                                            style={{ width: `${Math.min(100, (30 - Math.min(30, smoothnessIndex)) / 30 * 100)}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">0 (parejo) --- 30+ (desparejo)</div>
                                </div>
                                <span className={`font-bold text-lg tabular-nums ${siColor}`}>
                                    {formatNumber(smoothnessIndex)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Resumen del Balance — replaces "Plan vs Real" */}
            {nominalTaktTime > 0 && totalWorkContent > 0 && configuredStations > 0 && (
                <div className="border-b border-slate-100 pb-2">
                    <button
                        onClick={() => setShowSummary(!showSummary)}
                        className="flex items-center gap-2 text-xs text-slate-500 hover:text-accent font-bold uppercase tracking-wider transition-colors group"
                    >
                        <BarChart3 size={12} className="group-hover:text-accent" />
                        Resumen del Balance
                        {showSummary ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {showSummary && (
                        <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-300">
                            {/* Demand fulfillment */}
                            {(() => {
                                const cycleDelta = realCycleTime - nominalTaktTime;
                                const meetsdemand = cycleDelta <= 0;
                                const atRisk = cycleDelta > 0 && cycleRatio <= 1.05;
                                return (
                                    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-md border ${meetsdemand ? 'bg-status-ok-bg border-emerald-200' : atRisk ? 'bg-status-warn-bg border-amber-200' : 'bg-status-crit-bg border-red-200'}`}>
                                        {meetsdemand ? <CheckCircle2 size={16} className="text-status-ok mt-0.5 shrink-0" /> : atRisk ? <AlertTriangle size={16} className="text-status-warn mt-0.5 shrink-0" /> : <XCircle size={16} className="text-status-crit mt-0.5 shrink-0" />}
                                        <div className="text-xs">
                                            <span className={`font-bold ${meetsdemand ? 'text-emerald-700' : atRisk ? 'text-amber-700' : 'text-red-700'}`}>
                                                {meetsdemand ? 'Cumplís la demanda' : atRisk ? 'Ajustado, con riesgo' : 'No cumplís la demanda'}
                                            </span>
                                            <p className="text-slate-600 mt-0.5 tabular-nums">
                                                Ciclo: {formatNumber(realCycleTime)}s — Takt: {formatNumber(nominalTaktTime)}s
                                                {meetsdemand
                                                    ? ` (${formatNumber(Math.abs(cycleDelta))}s de margen)`
                                                    : ` (${formatNumber(cycleDelta)}s de exceso)`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Headcount assessment */}
                            {theoreticalHC > 0 && (
                                <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-md border ${hcDelta <= 0 ? 'bg-status-ok-bg border-emerald-200' : hcDelta === 1 ? 'bg-status-warn-bg border-amber-200' : 'bg-status-warn-bg border-amber-200'}`}>
                                    {hcDelta <= 0
                                        ? <CheckCircle2 size={16} className="text-status-ok mt-0.5 shrink-0" />
                                        : <AlertTriangle size={16} className="text-status-warn mt-0.5 shrink-0" />}
                                    <div className="text-xs">
                                        <span className={`font-bold ${hcDelta <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                            {hcDelta <= 0
                                                ? 'Dotación óptima'
                                                : `Tenés ${hcDelta} operario${hcDelta !== 1 ? 's' : ''} de más`}
                                        </span>
                                        <p className="text-slate-600 mt-0.5 tabular-nums">
                                            Mínimo teórico: {theoreticalHC} ops — Actual: {totalHeadcount} ops
                                            <span className="text-slate-400"> (Mínimo = Trabajo Manual / Takt)</span>
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Utilization assessment */}
                            <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-md border ${saturationVsTakt >= 85 && saturationVsTakt <= 100 ? 'bg-status-ok-bg border-emerald-200' : saturationVsTakt > 100 ? 'bg-status-crit-bg border-red-200' : 'bg-status-warn-bg border-amber-200'}`}>
                                {saturationVsTakt >= 85 && saturationVsTakt <= 100
                                    ? <CheckCircle2 size={16} className="text-status-ok mt-0.5 shrink-0" />
                                    : saturationVsTakt > 100
                                        ? <XCircle size={16} className="text-status-crit mt-0.5 shrink-0" />
                                        : <AlertTriangle size={16} className="text-status-warn mt-0.5 shrink-0" />}
                                <div className="text-xs">
                                    <span className={`font-bold ${saturationVsTakt >= 85 && saturationVsTakt <= 100 ? 'text-emerald-700' : saturationVsTakt > 100 ? 'text-red-700' : 'text-amber-700'}`}>
                                        Utilización {saturationVsTakt >= 85 && saturationVsTakt <= 100 ? 'saludable' : saturationVsTakt > 100 ? 'sobrecargada' : 'baja'}: {formatNumber(saturationVsTakt)}%
                                    </span>
                                    <p className="text-slate-600 mt-0.5">
                                        Rango ideal: 85-100%.
                                        {saturationVsTakt < 85 ? ' Podrías reducir operarios.' : saturationVsTakt > 100 ? ' Necesitás más operarios.' : ''}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Main Metrics Row */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
                <div className="flex gap-4 divide-x divide-slate-200 overflow-x-auto">
                    {/* Estaciones */}
                    <div className="px-2">
                        <span className="block text-xs text-slate-500 uppercase font-bold tracking-wider">Estaciones</span>
                        <span className="text-xl font-bold text-slate-800 tabular-nums">{configuredStations}</span>
                    </div>

                    {/* Operarios */}
                    <div className="px-4">
                        <span className="block text-xs text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                            <Users size={12} /> Operarios
                        </span>
                        <span className="text-xl font-bold text-accent tabular-nums">{totalHeadcount}</span>
                        {totalHeadcount > configuredStations && (
                            <span className="block text-xs text-accent font-medium tabular-nums">
                                (+{totalHeadcount - configuredStations} por paralelismo)
                            </span>
                        )}
                    </div>

                    {/* Ciclo de Salida */}
                    <div className="px-4 relative group cursor-help">
                        <span className="block text-xs text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                            <Timer size={12} /> Ciclo de Salida
                            <Tooltip content={
                                <div className="w-64 text-center">
                                    <strong>Tiempo entre piezas</strong>
                                    <p className="mt-1 opacity-90">Cada cuántos segundos sale 1 pieza de la línea. Es el tiempo de la estación más lenta.</p>
                                    {machineCycleTime > 0 && (
                                        <div className="mt-2 pt-2 border-t border-white/20 text-xs tabular-nums">
                                            <p>Base Máquina: {formatNumber(machineCycleTime)}s</p>
                                            <p>+ Manual: +{formatNumber(Math.max(0, realCycleTime - machineCycleTime))}s</p>
                                        </div>
                                    )}
                                </div>
                            } />
                        </span>
                        <span className="text-xl font-bold text-slate-800 tabular-nums">
                            {formatNumber(realCycleTime)}s
                        </span>
                        {machineCycleTime > 0 && machineCycleTime < realCycleTime && (
                            <span className="text-xs text-slate-400 ml-1 tabular-nums">
                                (Máq: {formatNumber(machineCycleTime)}s)
                            </span>
                        )}
                    </div>

                    {/* Utilización */}
                    <div className="px-4 relative group cursor-help">
                        <span className="block text-xs text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                            <TrendingUp size={12} /> Utilización
                            <Tooltip content={
                                <div className="w-64 text-center">
                                    <strong>Utilización vs Takt</strong>
                                    <p className="mt-1 opacity-90">
                                        Qué % del tiempo disponible (Takt) usan tus operarios.
                                    </p>
                                    <p className="mt-2 text-xs opacity-80">
                                        Fórmula: Trabajo Manual / (Operarios × Takt) × 100
                                    </p>
                                    <div className="mt-2 text-xs space-y-0.5">
                                        <p>&lt;85% = Capacidad ociosa (sobra gente)</p>
                                        <p>85-100% = Óptimo</p>
                                        <p>&gt;100% = Sobrecarga (falta gente)</p>
                                    </div>
                                </div>
                            } />
                        </span>
                        <span className={`text-xl font-bold tabular-nums ${utilizationColor}`}>
                            {formatNumber(saturationVsTakt)}%
                        </span>
                        {saturationVsTakt > 100 && (
                            <div className="text-xs text-status-crit mt-1 max-w-[160px] leading-tight bg-status-crit-bg px-1.5 py-1 rounded-md border border-red-200">
                                Sobrecarga. Se necesitan <strong>{Math.max(totalHeadcount, Math.ceil(totalHeadcount * saturationVsTakt / 100))}</strong> operarios.
                            </div>
                        )}
                    </div>

                    {/* Factibilidad */}
                    <div className="px-4 relative">
                        <span className="block text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Estado</span>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${statusColor}`}>
                            <StatusIcon size={16} />
                            <span className="text-sm font-bold">{statusLabel}</span>
                        </div>
                        <Tooltip content={
                            <div className="w-48 text-center">
                                <strong>Factibilidad</strong>
                                <p className="mt-1 text-xs opacity-90">
                                    {cycleRatio <= 1 ? 'El ciclo cumple el Takt.' : `Ciclo ${formatNumber((cycleRatio - 1) * 100)}% sobre Takt.`}
                                </p>
                            </div>
                        }>
                            <HelpCircle size={10} className="text-slate-400 cursor-help absolute -top-1 -right-1" />
                        </Tooltip>
                    </div>

                    {/* Margen vs Takt */}
                    <div className="px-4 relative group cursor-help">
                        <span className="block text-xs text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                            <Clock size={12} /> Margen vs Takt
                        </span>
                        <span className={`text-xl font-bold tabular-nums ${totalIdleTimePerCycle > 0 ? 'text-status-ok' : totalIdleTimePerCycle < 0 ? 'text-status-crit' : 'text-slate-400'}`}>
                            {totalIdleTimePerCycle < 0 ? '-' : '+'}{formatNumber(Math.abs(totalIdleTimePerCycle))}s
                        </span>
                        {totalIdleTimePerCycle < 0 && (
                            <span className="block text-xs text-status-crit font-medium">Déficit</span>
                        )}
                    </div>
                </div>

                {/* Action Buttons Area */}
                <div className="flex items-center gap-3">
                    {/* Station Management — stepper control */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
                            <Tooltip content={canRemoveStation
                                ? `Quitar estación ${nextStationToRemove} (vacía)`
                                : configuredStations <= 1
                                    ? 'Mínimo 1 estación'
                                    : 'Todas las estaciones tienen tareas. Movelas primero.'
                            }>
                                <button
                                    onClick={() => canRemoveStation && removeEmptyStation()}
                                    className={`px-2.5 py-1.5 border-r border-slate-200 transition-colors ${
                                        canRemoveStation
                                            ? 'hover:bg-red-50 text-slate-500 hover:text-red-600'
                                            : 'text-slate-200 cursor-not-allowed'
                                    }`}
                                    aria-label="Quitar estación vacía"
                                >
                                    <Minus size={14} />
                                </button>
                            </Tooltip>
                            <div className="px-3 py-1.5 text-xs font-bold text-slate-700 min-w-[80px] text-center select-none tabular-nums">
                                {configuredStations} Est.
                            </div>
                            <button
                                onClick={addStation}
                                className="px-2.5 py-1.5 border-l border-slate-200 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
                                title="Agregar estación"
                                aria-label="Agregar estación"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                        <button
                            onClick={clearBalance}
                            className="flex items-center gap-1 text-slate-400 hover:text-red-600 px-2 py-1.5 hover:bg-red-50 rounded-md transition-colors text-xs border border-transparent hover:border-red-200"
                            title="Quitar todas las tareas de todas las estaciones"
                            aria-label="Reiniciar balance"
                        >
                            <Trash2 size={12} />
                            <span className="font-medium">Reiniciar</span>
                        </button>
                    </div>

                    {/* Zoning Constraints */}
                    <button
                        onClick={onOpenZoningConstraints}
                        className="px-3 py-2 rounded-md text-sm font-bold flex items-center gap-2 border-2 border-industrial-200 bg-white text-industrial-500 hover:bg-industrial-50 hover:border-industrial-300 transition-colors"
                        title="Gestionar Restricciones de Zonificación"
                    >
                        <Link2 size={16} />
                        Restricciones
                        {zoningConstraintsCount > 0 && (
                            <span className="bg-industrial-500 text-white text-xs px-1.5 py-0.5 rounded-md font-bold tabular-nums">
                                {zoningConstraintsCount}
                            </span>
                        )}
                    </button>

                    {/* Optimize Button */}
                    <button
                        onClick={handleOptimization}
                        className="px-5 py-2 rounded-md transition-all flex items-center gap-2 font-bold text-sm ml-2 bg-accent hover:bg-blue-800 text-white"
                        title="Asigna las tareas automáticamente minimizando estaciones y operarios"
                    >
                        <Sparkles size={16} /> Balanceo Automático
                    </button>
                </div>
            </div>
        </div>
    );
};
