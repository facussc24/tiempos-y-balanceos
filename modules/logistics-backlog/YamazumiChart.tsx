/**
 * YamazumiChart - V4.5 Expert-Based Design
 * 
 * Bar chart with Takt line showing load per station
 * Standard visualization for line balancing
 */
import React from 'react';
import { BarChart3 } from 'lucide-react';

interface YamazumiBar {
    name: string;
    time: number;  // Weighted time in seconds
    required: number;  // Number of stations needed
}

interface YamazumiChartProps {
    bars: YamazumiBar[];
    taktTime: number;
}

export const YamazumiChart: React.FC<YamazumiChartProps> = ({
    bars,
    taktTime
}) => {
    if (bars.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <BarChart3 size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No hay datos de estaciones disponibles</p>
            </div>
        );
    }

    // Calculate the max time for scaling (use highest bar or takt * 1.5)
    // FIX: Filter NaN values to prevent Math.max corruption — one NaN bar
    // would make maxTime=1 (via || 1 fallback), causing all valid bars to overflow.
    const validBarTimes = bars.map(b => b.time).filter(Number.isFinite);
    const taktRef = Number.isFinite(taktTime) ? taktTime * 1.5 : 0;
    const maxTime = validBarTimes.length > 0 ? Math.max(...validBarTimes, taktRef) : (taktRef || 1);

    // Get bar color based on how close to takt
    const getBarColor = (time: number, required: number) => {
        if (required <= 0 || taktTime <= 0) return 'bg-slate-300';
        const saturation = (time / (required * taktTime)) * 100;
        if (saturation > 95) return 'bg-red-500';
        if (saturation > 85) return 'bg-emerald-500';
        return 'bg-amber-400';
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-blue-600" />
                <h3 className="font-semibold text-slate-700">Gráfico de Balanceo (Yamazumi)</h3>
            </div>

            <div className="relative">
                {/* Chart area */}
                <div className="flex items-end gap-4 h-48 border-b border-l border-slate-200 pt-4 pl-2">
                    {bars.map((bar, idx) => {
                        const heightPercent = (bar.time / maxTime) * 100;
                        const taktPercent = (taktTime * bar.required / maxTime) * 100;

                        return (
                            <div key={idx} className="flex-1 flex flex-col items-center">
                                {/* Bar container with Takt reference */}
                                <div className="w-full relative h-40 flex items-end justify-center">
                                    {/* Takt line for this station */}
                                    <div
                                        className="absolute w-full h-0.5 bg-red-400 z-10"
                                        style={{ bottom: `${taktPercent}%` }}
                                    >
                                        <span className="absolute -right-1 -top-2 text-[10px] text-red-500">
                                            Takt
                                        </span>
                                    </div>

                                    {/* The bar itself */}
                                    <div
                                        className={`w-12 ${getBarColor(bar.time, bar.required)} rounded-t-lg transition-all duration-700 ease-out relative group`}
                                        style={{ height: `${heightPercent}%` }}
                                    >
                                        {/* Tooltip on hover */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
                                            {bar.time.toFixed(1)}s / {bar.required} puestos
                                        </div>
                                    </div>
                                </div>

                                {/* Label */}
                                <div className="text-center mt-2">
                                    <p className="text-xs text-slate-600 font-medium truncate max-w-16" title={bar.name}>
                                        {bar.name.substring(0, 8)}
                                    </p>
                                    <p className="text-sm font-bold text-blue-600">{bar.required}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 h-48 flex flex-col justify-between text-xs text-slate-400 -ml-1">
                    <span>{maxTime.toFixed(0)}s</span>
                    <span>{(maxTime / 2).toFixed(0)}s</span>
                    <span>0s</span>
                </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <span>Línea Takt ({(Number.isFinite(taktTime) ? taktTime : 0).toFixed(1)}s)</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                    <span>Óptimo (85-95%)</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-amber-400 rounded"></div>
                    <span>Subutilizado (&lt;85%)</span>
                </div>
            </div>
        </div>
    );
};
