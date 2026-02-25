/**
 * YamazumiStackedChart - V5.0 Multi-Model Stacked Visualization
 * 
 * Stacked bar chart showing workload per station with model contribution.
 * Each bar is segmented by product color showing time contribution.
 * 
 * Key visual elements:
 * - X-axis: Stations/Machines
 * - Y-axis: Time (seconds)
 * - Stacked segments: Each model's contribution
 * - TAKT line: Red horizontal reference
 */
import React from 'react';
import { BarChart3, AlertTriangle, CheckCircle } from 'lucide-react';

interface BarSegment {
    productId: string;
    productName: string;
    timeContribution: number;
    percentage: number;
    color: string;
}

interface YamazumiStackedBar {
    stationName: string;
    stationId: string;
    segments: BarSegment[];
    totalTime: number;
    machinesRequired: number;
    machinesAvailable: number;
    isBottleneck: boolean;
}

interface YamazumiStackedChartProps {
    bars: YamazumiStackedBar[];
    taktTime: number;
    products: { id: string; name: string; color: string }[];
    title?: string;
}

export const YamazumiStackedChart: React.FC<YamazumiStackedChartProps> = ({
    bars,
    taktTime,
    products,
    title = 'Diagrama Yamazumi'
}) => {
    if (bars.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <BarChart3 size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No hay datos de estaciones disponibles</p>
            </div>
        );
    }

    // Find max time for scaling (either highest bar or takt * 1.3)
    const maxTime = Math.max(...bars.map(b => b.totalTime), taktTime * 1.3);

    // Count bottlenecks
    const bottleneckCount = bars.filter(b => b.isBottleneck).length;

    // Calculate average saturation
    const avgSaturation = bars.reduce((sum, b) => {
        const sat = (b.totalTime / (b.machinesRequired * taktTime)) * 100;
        return sum + (isFinite(sat) ? sat : 0);
    }, 0) / bars.length;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <BarChart3 size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{title}</h3>
                            <p className="text-xs text-slate-500">
                                Carga de trabajo por estación • {bars.length} estaciones
                            </p>
                        </div>
                    </div>

                    {/* Status badge */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${bottleneckCount > 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                        {bottleneckCount > 0 ? (
                            <>
                                <AlertTriangle size={14} />
                                {bottleneckCount} cuello{bottleneckCount > 1 ? 's' : ''} de botella
                            </>
                        ) : (
                            <>
                                <CheckCircle size={14} />
                                Balance óptimo
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="p-6">
                <div className="relative">
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 h-64 flex flex-col justify-between text-xs text-slate-400 pr-2">
                        <span>{maxTime.toFixed(0)}s</span>
                        <span>{(maxTime * 0.75).toFixed(0)}s</span>
                        <span>{(maxTime * 0.5).toFixed(0)}s</span>
                        <span>{(maxTime * 0.25).toFixed(0)}s</span>
                        <span>0s</span>
                    </div>

                    {/* Chart container */}
                    <div className="ml-10 relative">
                        {/* TAKT line */}
                        <div
                            className="absolute left-0 right-0 border-t-2 border-dashed border-red-400 z-10"
                            style={{ bottom: `${(taktTime / maxTime) * 256}px` }}
                        >
                            <span className="absolute -top-5 right-0 text-xs font-medium text-red-500 bg-white px-1 rounded">
                                TAKT: {taktTime.toFixed(1)}s
                            </span>
                        </div>

                        {/* Bars */}
                        <div className="flex items-end gap-3 h-64 border-b border-l border-slate-200 pb-1 pl-1">
                            {bars.map((bar, idx) => {
                                const heightPercent = (bar.totalTime / maxTime) * 100;
                                const exceedsTakt = bar.totalTime > taktTime * bar.machinesRequired;

                                return (
                                    <div key={bar.stationId || idx} className="flex-1 flex flex-col items-center group">
                                        {/* Stacked bar */}
                                        <div
                                            className={`w-full relative rounded-t-lg overflow-hidden transition-all duration-500 ${exceedsTakt ? 'ring-2 ring-red-400 ring-offset-1' : ''
                                                }`}
                                            style={{ height: `${heightPercent}%`, minHeight: '8px' }}
                                        >
                                            {/* Segments */}
                                            {bar.segments.map((segment, segIdx) => {
                                                const segmentHeight = (segment.timeContribution / bar.totalTime) * 100;
                                                return (
                                                    <div
                                                        key={segment.productId}
                                                        className="w-full transition-all duration-700"
                                                        style={{
                                                            height: `${segmentHeight}%`,
                                                            backgroundColor: segment.color,
                                                            opacity: 0.85 + (segIdx * 0.05)
                                                        }}
                                                    />
                                                );
                                            })}

                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 text-white text-xs p-3 rounded-lg shadow-xl z-30 min-w-[160px]">
                                                <p className="font-bold mb-2">{bar.stationName}</p>
                                                <p className="text-slate-300 mb-2">
                                                    Total: {bar.totalTime.toFixed(1)}s
                                                </p>
                                                <div className="space-y-1">
                                                    {bar.segments.map(seg => (
                                                        <div key={seg.productId} className="flex items-center gap-2">
                                                            <div
                                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: seg.color }}
                                                            />
                                                            <span className="truncate">{seg.productName}</span>
                                                            <span className="ml-auto font-medium">
                                                                {seg.percentage.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {exceedsTakt && (
                                                    <p className="mt-2 text-red-300 font-medium">
                                                        ⚠️ Excede Takt en {(bar.totalTime - taktTime * bar.machinesRequired).toFixed(1)}s
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Label */}
                                        <div className="text-center mt-2 w-full">
                                            <p className="text-[10px] text-slate-600 font-medium truncate" title={bar.stationName}>
                                                {bar.stationName.length > 10 ? bar.stationName.substring(0, 8) + '...' : bar.stationName}
                                            </p>
                                            <p className={`mt-1 text-xs font-bold ${bar.machinesRequired > bar.machinesAvailable
                                                    ? 'text-red-600'
                                                    : 'text-blue-600'
                                                }`}>
                                                {bar.machinesRequired}
                                                {bar.machinesAvailable < 99 && (
                                                    <span className="font-normal text-slate-400">/{bar.machinesAvailable}</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="mt-6 flex flex-wrap items-center gap-4 justify-center">
                    {products.map(product => (
                        <div key={product.id} className="flex items-center gap-2 text-xs text-slate-600">
                            <div
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: product.color }}
                            />
                            <span>{product.name}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-2 text-xs text-red-500 border-l border-slate-200 pl-4">
                        <div className="w-4 h-0.5 bg-red-400 border-dashed" />
                        <span>Línea Takt ({taktTime.toFixed(1)}s)</span>
                    </div>
                </div>
            </div>

            {/* Footer metrics */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-around text-center">
                <div>
                    <p className="text-xs text-slate-500">Estaciones</p>
                    <p className="font-bold text-slate-800">{bars.length}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500">Saturación Promedio</p>
                    <p className={`font-bold ${avgSaturation > 95 ? 'text-red-600' : avgSaturation > 85 ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {avgSaturation.toFixed(0)}%
                    </p>
                </div>
                <div>
                    <p className="text-xs text-slate-500">Takt Time</p>
                    <p className="font-bold text-blue-600">{taktTime.toFixed(1)}s</p>
                </div>
            </div>
        </div>
    );
};
