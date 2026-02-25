/**
 * KPI Dashboard - Simulation metrics and station utilization
 * @module KPIDashboard
 */

import React from 'react';
import type { SimulationKPIs } from './flowTypes';
import type { ProductionStation } from './ProductionLine';

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return '-';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toFixed(0)}s`;
}

// =============================================================================
// PROPS
// =============================================================================

interface KPIDashboardProps {
    kpis: SimulationKPIs;
    stations: ProductionStation[];
    elapsedTime: number;
    throughput: number;
    avgCycleTime: number;
    taktTime: number;
    status: 'idle' | 'running' | 'paused' | 'completed';
}

// =============================================================================
// COMPONENT
// =============================================================================

export const KPIDashboard: React.FC<KPIDashboardProps> = ({
    kpis,
    stations,
    elapsedTime,
    throughput,
    avgCycleTime,
    taktTime,
    status,
}) => {
    if (status === 'idle') return null;

    const bottleneckStation = stations.find((_, idx) => idx === kpis.bottleneckStationId)
        || stations.find(s => s.id === kpis.bottleneckStationId);
    const bottleneckName = bottleneckStation?.name ?? '-';

    return (
        <div className="flow-kpi-dashboard">
            <h3 className="flow-kpi-dashboard__title">KPIs de Simulacion</h3>

            {/* Summary Cards */}
            <div className="flow-kpi-cards">
                <div className="flow-kpi-card">
                    <span className="flow-kpi-card__value">{throughput.toFixed(0)}</span>
                    <span className="flow-kpi-card__label">Piezas/hora</span>
                </div>
                <div className="flow-kpi-card">
                    <span className="flow-kpi-card__value">{formatTime(avgCycleTime)}</span>
                    <span className="flow-kpi-card__label">Lead Time Prom.</span>
                </div>
                <div className="flow-kpi-card">
                    <span className="flow-kpi-card__value">{kpis.peakWIP}</span>
                    <span className="flow-kpi-card__label">WIP Pico</span>
                </div>
                <div className="flow-kpi-card">
                    <span className="flow-kpi-card__value">{kpis.avgWIP.toFixed(1)}</span>
                    <span className="flow-kpi-card__label">WIP Prom.</span>
                </div>
                <div className="flow-kpi-card flow-kpi-card--highlight">
                    <span className="flow-kpi-card__value">{bottleneckName}</span>
                    <span className="flow-kpi-card__label">Cuello de Botella</span>
                </div>
                {taktTime > 0 && (
                    <div className="flow-kpi-card">
                        <span className="flow-kpi-card__value">{taktTime.toFixed(1)}s</span>
                        <span className="flow-kpi-card__label">Takt Time</span>
                    </div>
                )}
                {kpis.oee !== undefined && (
                    <div className="flow-kpi-card">
                        <span className="flow-kpi-card__value">{(kpis.oee * 100).toFixed(1)}%</span>
                        <span className="flow-kpi-card__label">OEE</span>
                    </div>
                )}
            </div>

            {/* Station Utilization Bars */}
            <div className="flow-kpi-utilization">
                <h4 className="flow-kpi-utilization__title">Utilizacion por Estacion</h4>
                {stations.map((station, idx) => {
                    const utilization = kpis.stationUtilization[idx] || 0;
                    const activeTime = kpis.stationActiveTime[idx] || 0;
                    const blockedTime = kpis.stationBlockedTime[idx] || 0;
                    const starvedTime = kpis.stationStarvedTime[idx] || 0;
                    const idleTime = kpis.stationIdleTime[idx] || 0;
                    const totalTime = activeTime + blockedTime + starvedTime + idleTime;

                    const activePct = totalTime > 0 ? (activeTime / totalTime) * 100 : 0;
                    const blockedPct = totalTime > 0 ? (blockedTime / totalTime) * 100 : 0;
                    const starvedPct = totalTime > 0 ? (starvedTime / totalTime) * 100 : 0;

                    const isBottleneck = station.id === kpis.bottleneckStationId || idx === kpis.bottleneckStationId;

                    return (
                        <div key={station.id} className={`flow-kpi-station-bar ${isBottleneck ? 'flow-kpi-station-bar--bottleneck' : ''}`}>
                            <div className="flow-kpi-station-bar__header">
                                <span className="flow-kpi-station-bar__name">{station.name}</span>
                                <span className="flow-kpi-station-bar__pct">{utilization.toFixed(0)}%</span>
                            </div>
                            <div className="flow-kpi-station-bar__bar">
                                <div className="flow-kpi-station-bar__active" style={{ width: `${activePct}%` }} title={`Activo: ${formatTime(activeTime)}`} />
                                <div className="flow-kpi-station-bar__blocked" style={{ width: `${blockedPct}%` }} title={`Bloqueado: ${formatTime(blockedTime)}`} />
                                <div className="flow-kpi-station-bar__starved" style={{ width: `${starvedPct}%` }} title={`Starved: ${formatTime(starvedTime)}`} />
                            </div>
                        </div>
                    );
                })}
                <div className="flow-kpi-utilization__legend">
                    <span className="flow-kpi-legend-item"><span className="flow-kpi-legend-color flow-kpi-legend-color--active" /> Activo</span>
                    <span className="flow-kpi-legend-item"><span className="flow-kpi-legend-color flow-kpi-legend-color--blocked" /> Bloqueado</span>
                    <span className="flow-kpi-legend-item"><span className="flow-kpi-legend-color flow-kpi-legend-color--starved" /> Sin material</span>
                </div>
            </div>

            {/* Lead Time Distribution */}
            {kpis.minLeadTime < Infinity && (
                <div className="flow-kpi-leadtime">
                    <h4>Lead Time</h4>
                    <div className="flow-kpi-leadtime__values">
                        <span>Min: {formatTime(kpis.minLeadTime)}</span>
                        <span>Prom: {formatTime(kpis.avgLeadTime)}</span>
                        <span>Max: {formatTime(kpis.maxLeadTime)}</span>
                    </div>
                </div>
            )}

            {/* Elapsed Time */}
            <div className="flow-kpi-elapsed">
                Tiempo simulado: {formatTime(elapsedTime)}
            </div>
        </div>
    );
};
