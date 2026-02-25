/**
 * ProductionLine - Visual rendering of stations, connectors, and flowing pieces
 * @module ProductionLine
 */

import React from 'react';
import type { InventoryStatus } from './flowTypes';

// =============================================================================
// TYPES
// =============================================================================

export interface ProductionStation {
    id: number;
    name: string;
    cycleTime: number;
    operators: number;
    activeItems: number;
    wipQueue: number;
    processProgress: number[];
    blocked: boolean;
    isStarved: boolean;
    bufferPieces: number;
    bufferCapacity: number;
    bufferStatus: InventoryStatus;
    sectorColor: string;
    sectorName: string;
    failed?: boolean;
}

export interface FlowingPiece {
    id: number;
    stationIndex: number;
    isMoving: boolean;
    moveProgress: number;
    color: string;
    isProcessing: boolean;
    processSlot?: number;
    entryTime: number;
    productId: string;
    cycleTimeMultiplier: number;
    currentStationDuration?: number;
    inTransit?: boolean;
    subjectToDelete?: boolean;
}

// =============================================================================
// ICONS
// =============================================================================

const WorkerIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
);

const LockIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

// =============================================================================
// STATION CARD
// =============================================================================

interface StationCardProps {
    station: ProductionStation;
    pieces: FlowingPiece[];
    taktTime: number;
    isSelected: boolean;
    onClick: () => void;
}

const StationCard: React.FC<StationCardProps> = ({ station, pieces, taktTime, isSelected, onClick }) => {
    const processingPieces = pieces.filter(p => !p.isMoving && p.isProcessing);

    const saturation = taktTime > 0 ? (station.cycleTime / (taktTime * station.operators)) * 100 : 0;
    const isOverloaded = saturation > 100;

    const getSemaphoreStatus = (): InventoryStatus => {
        if (station.isStarved) return 'critical';
        if (station.bufferStatus === 'critical') return 'critical';
        if (station.bufferStatus === 'warning') return 'warning';
        if (station.blocked) return 'warning';
        return 'ok';
    };
    const semaphoreStatus = getSemaphoreStatus();

    return (
        <div
            className={`flow-station ${station.blocked ? 'flow-station--blocked' : ''} ${station.isStarved ? 'flow-station--starving' : ''} ${isSelected ? 'flow-station--selected' : ''}`}
            onClick={onClick}
            role="button"
            tabIndex={0}
        >
            <div className={`flow-station__semaphore flow-station__semaphore--${semaphoreStatus}`}
                title={semaphoreStatus === 'ok' ? 'OK' : semaphoreStatus === 'warning' ? 'Atencion' : 'Critico'} />

            {station.blocked && (
                <div className="flow-station__blocked-overlay" title="Blocked - Output Full">
                    <LockIcon />
                </div>
            )}

            <div className="flow-station__header" style={{ borderColor: station.sectorColor }}>
                <span className="flow-station__name">{station.name}</span>
                <span className="flow-station__sector" style={{ color: station.sectorColor }}>{station.sectorName}</span>
            </div>

            <div className="flow-station__body">
                <div className="flow-station__workers">
                    {Array.from({ length: station.operators }).map((_, i) => (
                        <div key={i} className={`flow-station__worker ${i < station.activeItems ? 'flow-station__worker--active' : ''}`} title={i < station.activeItems ? 'Working' : 'Idle'}>
                            <WorkerIcon />
                        </div>
                    ))}
                </div>

                <div className="flow-station__process-area">
                    {processingPieces.map((p, i) => {
                        const progress = p.processSlot !== undefined
                            ? (station.processProgress[p.processSlot] || 0)
                            : (station.processProgress[i] || 0);
                        return (
                            <div key={p.id} className="flow-piece flow-piece--processing" style={{ backgroundColor: p.color, left: `${10 + (i * 5)}%`, top: `${10 + (i * 5)}%`, zIndex: 10 + i, position: 'absolute' }}>
                                <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{progress.toFixed(0)}%</span>
                            </div>
                        );
                    })}
                    {station.activeItems === 0 && <div className="flow-station__empty">&mdash;</div>}
                </div>

                <div className="flow-station__stats">
                    <div className="flow-station__stat">
                        <span className="flow-station__stat-value">{station.cycleTime.toFixed(1)}s</span>
                        <span className="flow-station__stat-label">Ciclo</span>
                    </div>
                    <div className="flow-station__stat">
                        <span className={`flow-station__stat-value ${isOverloaded ? 'text-red-400' : 'text-green-400'}`}>{saturation.toFixed(0)}%</span>
                        <span className="flow-station__stat-label">Sat.</span>
                    </div>
                </div>
            </div>

            <div className="flow-station__queue-indicator">
                Cola: {station.wipQueue}
            </div>
        </div>
    );
};

// =============================================================================
// CONNECTOR
// =============================================================================

interface ConnectorProps {
    pieces: FlowingPiece[];
}

const Connector: React.FC<ConnectorProps> = ({ pieces = [] }) => (
    <div className="flow-connector">
        <div className="flow-connector__line" />
        <div className="flow-connector__arrow">&rarr;</div>
        {pieces.map(p => (
            <div key={p.id} className="flow-piece flow-piece--moving" style={{ backgroundColor: p.color, left: `${p.moveProgress}%`, width: '24px', height: '24px', position: 'absolute', zIndex: 20 }} />
        ))}
    </div>
);

// =============================================================================
// PROGRESS RING
// =============================================================================

interface ProgressRingProps {
    completed: number;
    total: number;
    throughput: number;
    status: 'idle' | 'running' | 'paused' | 'completed';
}

const ProgressRing: React.FC<ProgressRingProps> = ({ completed, total, throughput, status }) => {
    const progress = total > 0 ? (completed / total) * 100 : 0;
    const remaining = total - completed;
    const etaSeconds = throughput > 0 ? (remaining / throughput) * 3600 : 0;

    const formatETA = (seconds: number): string => {
        if (seconds <= 0 || !isFinite(seconds)) return '--:--';
        if (seconds < 60) return `${Math.ceil(seconds)}s`;
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const size = 100;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    if (status === 'idle') return null;

    return (
        <div className={`flow-progress-ring ${status === 'completed' ? 'flow-progress-ring--completed' : ''}`}>
            <svg width={size} height={size} className="flow-progress-ring__svg">
                <circle className="flow-progress-ring__bg" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
                <circle className="flow-progress-ring__progress" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            </svg>
            <div className="flow-progress-ring__content">
                <span className="flow-progress-ring__percentage">{progress.toFixed(0)}%</span>
                <span className="flow-progress-ring__count">{completed}/{total}</span>
                {status === 'running' && etaSeconds > 0 && <span className="flow-progress-ring__eta">ETA {formatETA(etaSeconds)}</span>}
                {status === 'completed' && <span className="flow-progress-ring__done">Listo</span>}
                {status === 'paused' && <span className="flow-progress-ring__paused">Pausa</span>}
            </div>
        </div>
    );
};

// =============================================================================
// MAIN PRODUCTION LINE
// =============================================================================

interface ProductionLineProps {
    stations: ProductionStation[];
    pieces: FlowingPiece[];
    taktTime: number;
    completedCount: number;
    totalToProcess: number;
    throughput: number;
    status: 'idle' | 'running' | 'paused' | 'completed';
    selectedStationId: number | null;
    onStationClick: (id: number) => void;
}

export const ProductionLine: React.FC<ProductionLineProps> = ({
    stations,
    pieces,
    taktTime,
    completedCount,
    totalToProcess,
    throughput,
    status,
    selectedStationId,
    onStationClick,
}) => {
    return (
        <div className="flow-production-line">
            {/* Input */}
            <div className="flow-input">
                <div className="flow-input__label">Entrada</div>
                <div className="flow-input__count">
                    {Math.max(0, totalToProcess - completedCount - pieces.length)}
                </div>
            </div>

            {/* Station-Connector chain */}
            {stations.map((station, idx) => {
                const stationPieces = pieces.filter(p => p.stationIndex === idx && !p.isMoving);
                const movingPieces = idx > 0
                    ? pieces.filter(p => p.stationIndex === idx && p.isMoving)
                    : pieces.filter(p => p.stationIndex === 0 && p.isMoving);

                return (
                    <React.Fragment key={station.id}>
                        {idx === 0 && <Connector pieces={movingPieces} />}
                        <StationCard
                            station={station}
                            pieces={stationPieces}
                            taktTime={taktTime}
                            isSelected={selectedStationId === station.id}
                            onClick={() => onStationClick(station.id)}
                        />
                        {idx < stations.length - 1 && (
                            <Connector pieces={pieces.filter(p => p.stationIndex === idx + 1 && p.isMoving)} />
                        )}
                    </React.Fragment>
                );
            })}

            {/* Connector before output */}
            <Connector pieces={[]} />

            {/* Output */}
            <div className="flow-output">
                <ProgressRing
                    completed={completedCount}
                    total={totalToProcess}
                    throughput={throughput}
                    status={status}
                />
                <div className="flow-output__label">Salida</div>
                <div className="flow-output__count">{completedCount}</div>
            </div>
        </div>
    );
};
