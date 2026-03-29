/**
 * MixEngineeringKPIs - V5.0 Engineering Metrics Header
 * 
 * Shows only capacity/engineering KPIs:
 * - Takt Time
 * - Max Cycle Time (bottleneck)
 * - Balancing Efficiency
 * - Total Headcount
 * - Machine Status
 */
import React from 'react';
import {
    Timer,
    AlertTriangle,
    Users,
    Cog,
    TrendingUp,
    TrendingDown,
    CheckCircle,
    XCircle
} from 'lucide-react';
import { EducationalTooltip } from '../../components/ui/EducationalTooltip';

interface MixEngineeringKPIsProps {
    taktTime: number;
    maxCycleTime: number;
    bottleneckStation: string;
    balancingEfficiency: number;
    totalHeadcount: number;
    machineStatus: {
        name: string;
        required: number;
        available: number;
    }[];
    isViable: boolean;
}

export const MixEngineeringKPIs: React.FC<MixEngineeringKPIsProps> = ({
    taktTime,
    maxCycleTime,
    bottleneckStation,
    balancingEfficiency,
    totalHeadcount,
    machineStatus,
    isViable
}) => {
    const hasMachineDeficit = machineStatus.some(m => m.required > m.available);
    const criticalMachines = machineStatus.filter(m => m.required > m.available);
    const exceedsTakt = maxCycleTime > taktTime;

    return (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
            {/* Top row: Main verdict */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    {isViable ? (
                        <div className="p-3 bg-emerald-500/20 rounded-xl">
                            <CheckCircle size={28} className="text-emerald-400" />
                        </div>
                    ) : (
                        <div className="p-3 bg-red-500/20 rounded-xl animate-pulse">
                            <XCircle size={28} className="text-red-400" />
                        </div>
                    )}
                    <div>
                        <p className="text-2xl font-bold">
                            {isViable ? 'Mix Factible' : 'Mix No Factible'}
                        </p>
                        <p className="text-sm text-slate-400">
                            {isViable
                                ? 'Todos los tiempos de ciclo caben en el Takt'
                                : `Cuello de botella en ${bottleneckStation}`}
                        </p>
                    </div>
                </div>

                {/* Efficiency gauge */}
                <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                        {balancingEfficiency >= 85 ? (
                            <TrendingUp size={20} className="text-emerald-400" />
                        ) : (
                            <TrendingDown size={20} className="text-amber-400" />
                        )}
                        <span className={`text-3xl font-bold ${balancingEfficiency >= 85 ? 'text-emerald-400' :
                            balancingEfficiency >= 70 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                            {/* FIX: Guard against NaN from upstream division-by-zero */}
                            {isFinite(balancingEfficiency) ? balancingEfficiency.toFixed(0) : '0'}%
                        </span>
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-xs text-slate-500">Eficiencia del Balance</span>
                        <EducationalTooltip termKey="BALANCING_EFFICIENCY" iconSize={12} />
                    </div>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-4 gap-4">
                {/* Takt Time */}
                <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Timer size={16} />
                        <span className="text-xs font-medium uppercase tracking-wide">Takt Time</span>
                        <EducationalTooltip termKey="TAKT_TIME" iconSize={12} />
                    </div>
                    <p className="text-2xl font-bold text-blue-400">{taktTime.toFixed(1)}s</p>
                    <p className="text-[10px] text-slate-500 mt-1">Ritmo de producción</p>
                </div>

                {/* Max Cycle Time */}
                <div className={`rounded-xl p-4 border ${exceedsTakt
                    ? 'bg-red-900/30 border-red-500/50'
                    : 'bg-slate-700/50 border-slate-600'
                    }`}>
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <AlertTriangle size={16} className={exceedsTakt ? 'text-red-400' : ''} />
                        <span className="text-xs font-medium uppercase tracking-wide">Ciclo Máx</span>
                    </div>
                    <p className={`text-2xl font-bold ${exceedsTakt ? 'text-red-400' : 'text-emerald-400'}`}>
                        {maxCycleTime.toFixed(1)}s
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 truncate" title={bottleneckStation}>
                        {bottleneckStation}
                    </p>
                </div>

                {/* Headcount */}
                <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Users size={16} />
                        <span className="text-xs font-medium uppercase tracking-wide">Headcount</span>
                        <EducationalTooltip termKey="HEADCOUNT" iconSize={12} />
                    </div>
                    <p className="text-2xl font-bold text-white">{totalHeadcount}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Operarios requeridos</p>
                </div>

                {/* Machine Status */}
                <div className={`rounded-xl p-4 border ${hasMachineDeficit
                    ? 'bg-amber-900/30 border-amber-500/50'
                    : 'bg-slate-700/50 border-slate-600'
                    }`}>
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Cog size={16} className={hasMachineDeficit ? 'text-amber-400' : ''} />
                        <span className="text-xs font-medium uppercase tracking-wide">Máquinas</span>
                    </div>
                    {hasMachineDeficit ? (
                        <div>
                            <p className="text-lg font-bold text-amber-400">
                                {criticalMachines.length} en déficit
                            </p>
                            <p className="text-[10px] text-amber-300 truncate" title={criticalMachines.map(m => m.name).join(', ')}>
                                {criticalMachines.map(m => m.name).join(', ')}
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-2xl font-bold text-emerald-400">OK</p>
                            <p className="text-[10px] text-slate-500">Capacidad suficiente</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Critical alerts */}
            {criticalMachines.length > 0 && (
                <div className="mt-4 bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-xs font-medium text-amber-400 mb-2">⚠️ Déficit de Máquinas:</p>
                    <div className="flex flex-wrap gap-2">
                        {criticalMachines.map((machine, idx) => (
                            <span
                                key={idx}
                                className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded"
                            >
                                {machine.name}: {machine.required}/{machine.available}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
