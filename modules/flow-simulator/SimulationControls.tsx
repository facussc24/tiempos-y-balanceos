/**
 * Simulation Controls - Play/Pause/Reset, scenarios, speed, and advanced config
 * @module SimulationControls
 */

import React from 'react';
import type { ProductMixMode } from './flowTypes';
import { formatTime } from './flowUtils';

// =============================================================================
// ICONS
// =============================================================================

const PlayIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
    </svg>
);

const PauseIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
);

const ResetIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
);

// =============================================================================
// SCENARIOS
// =============================================================================

const SIMULATION_SCENARIOS = [
    { id: 'quick', name: 'Rápida', icon: '⚡', time: '~30 seg', pieces: 10, speed: 5, variability: 0, wip: 3, description: 'Vista rápida del flujo' },
    { id: 'standard', name: 'Estándar', icon: '📊', time: '~2 min', pieces: 50, speed: 2, variability: 5, wip: 3, description: 'Análisis típico' },
    { id: 'stress', name: 'Stress Test', icon: '🔥', time: '~5 min', pieces: 200, speed: 1, variability: 15, wip: 5, description: 'Máxima carga' },
];

export type SimScenario = typeof SIMULATION_SCENARIOS[0];

// =============================================================================
// PROPS
// =============================================================================

interface SimulationControlsProps {
    status: 'idle' | 'running' | 'paused' | 'completed';
    speed: number;
    piecesToProcess: number;
    wipLimit: number;
    variabilityPercent: number;
    productMixMode: ProductMixMode;
    selectedScenarioId: string | null;
    showAdvancedControls: boolean;
    completedCount: number;
    elapsedTime: number;
    onStart: () => void;
    onPause: () => void;
    onReset: () => void;
    onInstantSimulation: () => void;
    onSpeedChange: (speed: number) => void;
    onPiecesChange: (pieces: number) => void;
    onWipLimitChange: (wip: number) => void;
    onVariabilityChange: (variability: number) => void;
    onProductMixModeChange: (mode: ProductMixMode) => void;
    onScenarioApply: (scenario: SimScenario) => void;
    onToggleAdvanced: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const SimulationControls: React.FC<SimulationControlsProps> = ({
    status,
    speed,
    piecesToProcess,
    wipLimit,
    variabilityPercent,
    productMixMode,
    selectedScenarioId,
    showAdvancedControls,
    completedCount,
    elapsedTime,
    onStart,
    onPause,
    onReset,
    onInstantSimulation,
    onSpeedChange,
    onPiecesChange,
    onWipLimitChange,
    onVariabilityChange,
    onProductMixModeChange,
    onScenarioApply,
    onToggleAdvanced,
}) => {
    const progressPct = piecesToProcess > 0 ? (completedCount / piecesToProcess) * 100 : 0;

    return (
        <div className="flow-controls-v2">
            <div className="flow-controls__buttons">
                {status === 'running' ? (
                    <button className="flow-btn flow-btn--warning" onClick={onPause}><PauseIcon /> Pausar</button>
                ) : (
                    <button className="flow-btn flow-btn--primary" onClick={onStart}><PlayIcon /> {status === 'paused' ? 'Continuar' : 'Iniciar'}</button>
                )}
                <button className="flow-btn flow-btn--secondary" onClick={onReset}><ResetIcon /> Reset</button>
                <button
                    className="flow-btn flow-btn--instant"
                    onClick={onInstantSimulation}
                    disabled={status === 'running'}
                    title="Ejecutar simulacion completa instantaneamente"
                >
                    ⚡ Simular Completo
                </button>
            </div>

            {/* Quick Scenarios */}
            {status === 'idle' && (
                <>
                    <div className="flow-quick-scenarios">
                        {SIMULATION_SCENARIOS.map(scenario => (
                            <button
                                key={scenario.id}
                                className={`flow-scenario-card ${selectedScenarioId === scenario.id ? 'flow-scenario-card--active' : ''}`}
                                onClick={() => onScenarioApply(scenario)}
                                title={scenario.description}
                            >
                                <span className="flow-scenario-card__icon">{scenario.icon}</span>
                                <span className="flow-scenario-card__name">{scenario.name}</span>
                                <span className="flow-scenario-card__time">{scenario.time}</span>
                            </button>
                        ))}
                        <button
                            className={`flow-scenario-card flow-scenario-card--advanced ${showAdvancedControls ? 'flow-scenario-card--active' : ''}`}
                            onClick={onToggleAdvanced}
                        >
                            <span className="flow-scenario-card__icon">⚙️</span>
                            <span className="flow-scenario-card__name">Manual</span>
                            <span className="flow-scenario-card__time">Experto</span>
                        </button>
                    </div>

                    {/* Product Mix Mode */}
                    <div className="flow-mix-mode-selector">
                        <span className="flow-mix-mode-label">Modo Producto:</span>
                        <div className="flow-mix-mode-buttons">
                            {(['dominant', 'random', 'heijunka'] as ProductMixMode[]).map(mode => (
                                <button
                                    key={mode}
                                    className={`flow-mix-mode-btn ${productMixMode === mode ? 'flow-mix-mode-btn--active' : ''}`}
                                    onClick={() => onProductMixModeChange(mode)}
                                >
                                    {mode === 'dominant' ? 'Dominante' : mode === 'random' ? 'Aleatorio' : 'Heijunka'}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Advanced Controls (only in idle) */}
            {showAdvancedControls && status === 'idle' && (
                <div className="flow-controls__advanced">
                    <div className="flow-control-group">
                        <label>Piezas: <strong>{piecesToProcess}</strong></label>
                        <input type="range" min={5} max={500} value={piecesToProcess} onChange={e => onPiecesChange(Number(e.target.value))} />
                    </div>
                    <div className="flow-control-group">
                        <label>WIP Limit: <strong>{wipLimit}</strong></label>
                        <input type="range" min={1} max={10} value={wipLimit} onChange={e => onWipLimitChange(Number(e.target.value))} />
                    </div>
                    <div className="flow-control-group">
                        <label>Variabilidad: <strong>{variabilityPercent}%</strong></label>
                        <input type="range" min={0} max={30} value={variabilityPercent} onChange={e => onVariabilityChange(Number(e.target.value))} />
                    </div>
                    <div className="flow-control-group">
                        <label>Velocidad: <strong>{speed}x</strong></label>
                        <div className="flow-speed-buttons">
                            {[1, 2, 5, 10].map(s => (
                                <button
                                    key={s}
                                    className={`flow-speed-btn ${speed === s ? 'flow-speed-btn--active' : ''}`}
                                    onClick={() => onSpeedChange(s)}
                                >
                                    {s}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Status Bar (visible during running/paused/completed) */}
            {status !== 'idle' && (
                <div className={`flow-status-bar ${status === 'paused' ? 'flow-status-bar--paused' : ''} ${status === 'completed' ? 'flow-status-bar--completed' : ''}`}>
                    <div className="flow-status-bar__item">
                        <span className="flow-status-bar__label">Progreso:</span>
                        <span className="flow-status-bar__value">{completedCount}/{piecesToProcess}</span>
                    </div>
                    <div className="flow-status-bar__progress">
                        <div className="flow-status-bar__progress-track">
                            <div className="flow-status-bar__progress-fill" style={{ width: `${Math.min(100, progressPct)}%` }} />
                        </div>
                    </div>
                    <div className="flow-status-bar__item">
                        <span className="flow-status-bar__label">Tiempo:</span>
                        <span className="flow-status-bar__value">{formatTime(elapsedTime)}</span>
                    </div>
                    <div className="flow-status-bar__item">
                        <span className="flow-status-bar__label">Velocidad:</span>
                        <div className="flow-speed-buttons">
                            {[1, 2, 5, 10].map(s => (
                                <button
                                    key={s}
                                    className={`flow-speed-btn ${speed === s ? 'flow-speed-btn--active' : ''}`}
                                    onClick={() => onSpeedChange(s)}
                                >
                                    {s}x
                                </button>
                            ))}
                        </div>
                    </div>
                    {status === 'completed' && (
                        <div className="flow-status-bar__item">
                            <span className="flow-complete-badge">Simulacion Completa</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export { SIMULATION_SCENARIOS };
