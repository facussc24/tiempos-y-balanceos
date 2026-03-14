/**
 * LoadCapacityChart - V4.8 Phase 27 (Peak Line Visualization)
 * 
 * Yamazumi-style chart showing load vs capacity with:
 * - Main bar: Average weighted saturation
 * - Peak marker: Saturation of the most complex model
 * - Color coding: Green (OK), Yellow (variability risk), Red (bottleneck)
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface LoadCapacityChartProps {
    sectors: Array<{
        name: string;
        weightedTime: number; // TW (Average)
        peakTime?: number;    // V4.8: Time of the most complex model
        taktTime: number;
        saturation: number;   // Average saturation %
        peakSaturation?: number; // V4.8: Peak model saturation %
    }>;
    taktTime: number;
}

export const LoadCapacityChart: React.FC<LoadCapacityChartProps> = ({ sectors = [], taktTime = 1 }) => {
    // Safety: Ensure taktTime is valid
    const safeTakt = (taktTime && taktTime > 0 && isFinite(taktTime)) ? taktTime : 1;

    // Safety: If no sectors, show empty state
    if (!sectors || sectors.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm text-center text-slate-400">
                Sin datos de sectores para visualizar.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center justify-between">
                <span>Carga vs Capacidad (Yamazumi)</span>
                <div className="flex items-center gap-3 text-xs font-normal">
                    <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        Takt: {safeTakt.toFixed(2)}s
                    </span>
                    <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded flex items-center gap-1">
                        <AlertTriangle size={12} /> = Pico
                    </span>
                </div>
            </h3>

            <div className="space-y-4">
                {sectors.map((sector, idx) => {
                    const loadPercentage = (sector.weightedTime / safeTakt) * 100;
                    // For visualization, we might cap the bar width or handle it if it exceeds 100% of a SINGLE workstation?
                    // "Process Load" vs Takt. 
                    // If a sector has multiple stations, the "Load" is total time, but capacity is machines * Takt.
                    // Expert says: "Barra sobrepasa la línea del Takt". This implies we are comparing Time PER UNIT vs TAKT.
                    // Yes, TW (Weighted Time) vs Takt. 
                    // Note: If TW > Takt, we need multiple people.
                    // But the chart the expert described: "Barra Roja (> 100%): La barra sobrepasa la línea del Takt. Cuello de Botella."
                    // If we have 10 people, TW is 100s, Takt is 10s. Load IS > Takt.
                    // This chart makes sense for checking "Cycle Time vs Takt" for a single station flow, OR 
                    // it visualizes "Saturation %" where 100% = Full Capacity of the ASSIGNED resources.

                    // Expert said: "Barra Horizontal (Load vs Capacity)... Línea Vertical (Marca): El Takt Time."
                    // "Barra Roja (> 100%): La barra sobrepasa la línea del Takt."

                    // IF the bar represents the WORK to be done (TW) relative to TAKT, it will be huge for the "Union" sector (106s vs 9s).
                    // So maybe this chart is meant to show "Average Cycle Time per Person" vs Takt?
                    // OR "Saturation %" where the line is 100% saturation?

                    // Let's re-read expert tip carefully:
                    // "Barra: Representa la carga de trabajo asignada."
                    // "Lógica Visual: Barra Verde (50% - 85%), Roja (> 100%)."
                    // "Por qué funciona: Si la barra pasa la línea, no llego."

                    // This creates a paradox if we don't normalize by headcount.
                    // If UNION has 12 people, the effective cycle time is TW / 12.
                    // If (TW / 12) > Takt, THEN we have a bottleneck.
                    // So the bar should represent: (Weighted Time / Headcount).
                    // And the Limit Line is Takt.

                    // Wait, if we assume "Saturation" which is (TW / (Headcount * Takt)), then:
                    // 100% Saturation = Exact Match with Takt.
                    // > 100% Saturation = Exceeds Capacity (Bottle neck).

                    // So I will render "Saturation" bars. 
                    // 100% width = Takt Time Limit (Capacity).
                    // Bar width = Saturation %.

                    // Actually, to make it look like "Time", we can scale it:
                    // Max Scale = Takt Time * 1.2 (to show overflow).
                    // Bar Value = (TW / Headcount). 
                    // This is "Average Cycle Time".

                    // Let's do that. It is more physical.
                    // "Average Cycle Time" vs "Takt".

                    // But we don't have Headcount in props yet?
                    // Ah, sectors prop needs headcount.

                    // WAIT. The previous `sectors` in `resourceRows` had `required` (headcount).
                    // I'll add `required` to props.

                    // Let's calculate "Effective Cycle Time" = weightedTime / available_resources (or required).
                    // If we stick to "Required" (calculated), saturation will always be <= 100% (unless we force fewer resources).
                    // But user might have FIXED resources (Inventory).
                    // If we rely on the calculcated "Required" row, we are showing the theoretical solution so it won't be red.
                    // UNLESS we use "Available Machines" from Plant Config!

                    // Expert mentioned: "Required_Machines (13) > Inventory (12) -> Cuello de Botella".
                    // So we should try to use "Available" if possible.

                    // In `MixBalanceResults`, we are currently calculating `required` based on demand.
                    // We also have `plantConfig` passed in.
                    // I should pass `available` to this chart to show RED bars if Required > Available.

                    // Refined Plan for Chart:
                    // Bar represents: Work Content / Available Resources (Actual Cycle Time if we use available machines).
                    // Line represents: Takt Time.

                    // If Input has 12 machines for Union. TW = 106s.
                    // Cycle Time = 106 / 12 = 8.83s.
                    // Takt = 9.07s.
                    // 8.83 < 9.07 -> GREEN/YELLOW bar.

                    // If we had 11 machines:
                    // Cycle Time = 106 / 11 = 9.63s.
                    // 9.63 > 9.07 -> RED bar.

                    // V4.8: Peak Visualization Logic
                    const avgSat = sector.saturation || 0;
                    const peakSat = sector.peakSaturation || avgSat;
                    const hasVariabilityRisk = peakSat > 100 && avgSat <= 100;

                    // Determine bar color based on expert logic:
                    // Green: both avg and peak under 85%
                    // Amber/Yellow: avg under Takt but peak exceeds (variability risk)
                    // Red: avg exceeds Takt (structural bottleneck)
                    const getBarColor = () => {
                        if (avgSat > 100) return 'bg-red-500';
                        if (hasVariabilityRisk) return 'bg-amber-400';
                        if (avgSat > 85) return 'bg-amber-400';
                        if (avgSat < 30) return 'bg-slate-300';
                        return 'bg-emerald-500';
                    };

                    return (
                        <div key={idx} className="relative py-2">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-slate-700">{sector.name || 'Sector'}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500">
                                        {avgSat.toFixed(0)}%
                                    </span>
                                    {hasVariabilityRisk && (
                                        <span className="text-amber-600 text-xs flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            Pico: {peakSat.toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Bar Container - Represents scaled time range, e.g. 0 to 120% of Takt */}
                            <div className="h-4 bg-slate-100 rounded-full relative overflow-visible">
                                {/* Takt Line Marker */}
                                <div
                                    className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-red-500 z-10"
                                    style={{ left: '80%' }} // Let's define Takt as 80% of width to allow room for overflow
                                >
                                    <span className="absolute -top-4 -translate-x-1/2 text-[10px] font-bold text-red-600">
                                        Takt
                                    </span>
                                </div>

                                {/* The Average Bar */}
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${getBarColor()}`}
                                    style={{ width: `${Math.min((avgSat / 100) * 80, 100)}%` }}
                                />

                                {/* V4.8: Peak Marker (triangle indicator) */}
                                {peakSat > avgSat && (
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 z-20"
                                        style={{ left: `${Math.min((peakSat / 100) * 80, 98)}%` }}
                                        title={`Pico: ${peakSat.toFixed(0)}% (modelo más complejo)`}
                                    >
                                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-amber-500" />
                                    </div>
                                )}
                            </div>

                            {/* Variability Warning */}
                            {hasVariabilityRisk && (
                                <p className="text-xs text-amber-600 mt-1">
                                    ⚠️ El modelo complejo causará cuello de botella momentáneo.
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="mt-4 flex gap-4 text-xs text-slate-500 justify-center flex-wrap">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> Saludable</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-400 rounded-full"></div> Variabilidad</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Cuello Botella</div>
                <div className="flex items-center gap-1">
                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-amber-500" />
                    Pico Modelo
                </div>
            </div>
        </div>
    );
};
