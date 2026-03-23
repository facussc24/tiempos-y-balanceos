/**
 * Station Diagnostic Panel - Click-to-expand station detail panel
 * @module StationDiagnosticPanel
 */

import React from 'react';
import { createPortal } from 'react-dom';
import type { SimulationKPIs } from './flowTypes';
import type { ProductionStation } from './ProductionLine';
import { formatTime } from './flowUtils';

// =============================================================================
// PROPS
// =============================================================================

interface StationDiagnosticPanelProps {
    station: ProductionStation;
    stationIndex: number;
    kpis: SimulationKPIs;
    elapsedTime: number;
    taktTime: number;
    onClose: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const StationDiagnosticPanel: React.FC<StationDiagnosticPanelProps> = ({
    station,
    stationIndex,
    kpis,
    elapsedTime,
    taktTime,
    onClose,
}) => {
    const utilization = kpis.stationUtilization[stationIndex] || 0;
    const activeTime = kpis.stationActiveTime[stationIndex] || 0;
    const blockedTime = kpis.stationBlockedTime[stationIndex] || 0;
    const starvedTime = kpis.stationStarvedTime[stationIndex] || 0;
    const idleTime = kpis.stationIdleTime[stationIndex] || 0;

    const saturation = taktTime > 0
        ? (station.cycleTime / (taktTime * station.operators)) * 100
        : 0;

    const isBottleneck = station.id === kpis.bottleneckStationId;

    const content = (
        <div className="flow-diagnostic-panel" role="dialog" aria-modal="true" aria-label={`Diagnostico de ${station.name}`} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
            <div className="flow-diagnostic-panel__header">
                <h3>{station.name}</h3>
                <span className="flow-diagnostic-panel__sector" style={{ color: station.sectorColor }}>
                    {station.sectorName}
                </span>
                <button className="flow-diagnostic-panel__close" onClick={onClose} aria-label="Cerrar">&times;</button>
            </div>

            {isBottleneck && (
                <div className="flow-diagnostic-panel__badge flow-diagnostic-panel__badge--bottleneck">
                    Cuello de Botella
                </div>
            )}

            {/* Status */}
            <div className="flow-diagnostic-panel__section">
                <h4>Estado Actual</h4>
                <div className="flow-diagnostic-panel__grid">
                    <span>Estado:</span>
                    <span className={station.blocked ? 'text-amber-500' : station.isStarved ? 'text-red-500' : 'text-green-500'}>
                        {station.blocked ? 'Bloqueado' : station.isStarved ? 'Sin material' : station.activeItems > 0 ? 'Procesando' : 'Idle'}
                    </span>
                    <span>Procesando:</span>
                    <span>{station.activeItems} / {station.operators}</span>
                    <span>En cola:</span>
                    <span>{station.wipQueue}</span>
                </div>
            </div>

            {/* Configuration */}
            <div className="flow-diagnostic-panel__section">
                <h4>Configuración</h4>
                <div className="flow-diagnostic-panel__grid">
                    <span>Ciclo:</span>
                    <span>{station.cycleTime.toFixed(1)}s</span>
                    <span>Operadores:</span>
                    <span>{station.operators}</span>
                    <span>Saturacion:</span>
                    <span className={saturation > 100 ? 'text-red-500' : 'text-green-500'}>{saturation.toFixed(0)}%</span>
                </div>
            </div>

            {/* Time Breakdown */}
            <div className="flow-diagnostic-panel__section">
                <h4>Tiempos ({formatTime(elapsedTime)})</h4>
                <div className="flow-diagnostic-panel__grid">
                    <span>Activo:</span>
                    <span className="text-green-500">{formatTime(activeTime)}</span>
                    <span>Bloqueado:</span>
                    <span className="text-amber-500">{formatTime(blockedTime)}</span>
                    <span>Sin trabajo:</span>
                    <span className="text-blue-400">{formatTime(idleTime)}</span>
                    <span>Sin material:</span>
                    <span className="text-red-500">{formatTime(starvedTime)}</span>
                </div>
            </div>

            {/* Utilization Bar */}
            <div className="flow-diagnostic-panel__section">
                <h4>Utilizacion: {utilization.toFixed(1)}%</h4>
                <div className="flow-diagnostic-panel__utilization-bar">
                    <div className="flow-diagnostic-panel__bar-fill" style={{ width: `${Math.min(100, utilization)}%` }} />
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};
