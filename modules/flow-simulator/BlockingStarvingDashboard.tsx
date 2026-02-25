/**
 * FIX 10: Blocking & Starving Dashboard
 * 
 * Visualizes the percentage of time each station spent blocked or starved.
 * This is the "killer feature" of the simulator - showing what static balancing can't see.
 * 
 * @module BlockingStarvingDashboard
 */

import React from 'react';
import type { SimulationKPIs } from './flowTypes';

interface StationInfo {
    id: number;
    name: string;
}

export interface BlockingStarvingDashboardProps {
    /** Simulation KPIs containing blocked/starved time per station */
    kpis: SimulationKPIs;
    /** Station information for names */
    stations: StationInfo[];
    /** Total elapsed simulation time in seconds */
    elapsedTime: number;
    /** Whether the simulation is complete */
    isComplete: boolean;
}

/**
 * Dashboard component showing blocking and starving percentages per station.
 * 
 * The key insight this provides:
 * - A station might have low saturation (looks "safe") but still cause problems
 * - Blocking happens when output buffer is full (downstream slow)
 * - Starving happens when input buffer is empty (upstream slow or logistics)
 */
export const BlockingStarvingDashboard: React.FC<BlockingStarvingDashboardProps> = ({
    kpis,
    stations,
    elapsedTime,
    isComplete,
}) => {
    // Don't show if simulation hasn't run yet
    if (elapsedTime < 1) {
        return null;
    }

    // Calculate percentages for each station
    const stationData = stations.map((station, idx) => {
        const blockedTime = kpis.stationBlockedTime[idx] || 0;
        const starvedTime = kpis.stationStarvedTime[idx] || 0;
        const blockedPct = Math.min(100, (blockedTime / elapsedTime) * 100);
        const starvedPct = Math.min(100, (starvedTime / elapsedTime) * 100);

        return {
            id: station.id,
            name: station.name,
            blockedPct,
            starvedPct,
            blockedTime,
            starvedTime,
        };
    });

    // Calculate line-level totals
    const totalBlockedPct = stationData.reduce((sum, s) => sum + s.blockedPct, 0) / stations.length;
    const totalStarvedPct = stationData.reduce((sum, s) => sum + s.starvedPct, 0) / stations.length;
    const hasIssues = totalBlockedPct > 1 || totalStarvedPct > 1;

    return (
        <div className="bs-dashboard">
            <div className="bs-dashboard__header">
                <h3 className="bs-dashboard__title">
                    📊 Cuellos de Botella Dinámicos
                    {isComplete && (
                        <span className="bs-dashboard__badge">Simulación Completa</span>
                    )}
                </h3>
                <div className="bs-dashboard__summary">
                    {hasIssues ? (
                        <span className="bs-dashboard__warning">
                            ⚠️ Detectadas pérdidas por Bloqueo/Hambre
                        </span>
                    ) : (
                        <span className="bs-dashboard__ok">
                            ✅ Línea balanceada sin bloqueos significativos
                        </span>
                    )}
                </div>
            </div>

            <div className="bs-dashboard__grid">
                {stationData.map(station => (
                    <div key={station.id} className="bs-station-row">
                        <div className="bs-station-row__name" title={station.name}>
                            {station.name}
                        </div>

                        <div className="bs-station-row__bars">
                            {/* Blocked bar (Red) */}
                            <div className="bs-bar bs-bar--blocked" title={`Bloqueado: ${station.blockedPct.toFixed(1)}% (${station.blockedTime.toFixed(1)}s)`}>
                                <div
                                    className="bs-bar__fill"
                                    style={{ width: `${Math.min(100, station.blockedPct * 2)}%` }}
                                />
                                {station.blockedPct > 0.5 && (
                                    <span className="bs-bar__label">{station.blockedPct.toFixed(0)}%</span>
                                )}
                            </div>

                            {/* Starved bar (Yellow) */}
                            <div className="bs-bar bs-bar--starved" title={`Hambriento: ${station.starvedPct.toFixed(1)}% (${station.starvedTime.toFixed(1)}s)`}>
                                <div
                                    className="bs-bar__fill"
                                    style={{ width: `${Math.min(100, station.starvedPct * 2)}%` }}
                                />
                                {station.starvedPct > 0.5 && (
                                    <span className="bs-bar__label">{station.starvedPct.toFixed(0)}%</span>
                                )}
                            </div>
                        </div>

                        <div className="bs-station-row__values">
                            <span className="bs-value bs-value--blocked" title="Tiempo bloqueado">
                                🔴 {station.blockedPct.toFixed(1)}%
                            </span>
                            <span className="bs-value bs-value--starved" title="Tiempo hambriento">
                                🟡 {station.starvedPct.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bs-dashboard__legend">
                <div className="bs-legend-item">
                    <span className="bs-legend-dot bs-legend-dot--blocked"></span>
                    <span>Bloqueado (salida llena)</span>
                </div>
                <div className="bs-legend-item">
                    <span className="bs-legend-dot bs-legend-dot--starved"></span>
                    <span>Hambriento (entrada vacía)</span>
                </div>
            </div>

            {/* Line-level summary */}
            <div className="bs-dashboard__totals">
                <div className="bs-total">
                    <span className="bs-total__label">Pérdida promedio por Bloqueo:</span>
                    <span className={`bs-total__value ${totalBlockedPct > 5 ? 'bs-total__value--critical' : ''}`}>
                        {totalBlockedPct.toFixed(1)}%
                    </span>
                </div>
                <div className="bs-total">
                    <span className="bs-total__label">Pérdida promedio por Hambre:</span>
                    <span className={`bs-total__value ${totalStarvedPct > 5 ? 'bs-total__value--critical' : ''}`}>
                        {totalStarvedPct.toFixed(1)}%
                    </span>
                </div>
            </div>
        </div>
    );
};

export default BlockingStarvingDashboard;
