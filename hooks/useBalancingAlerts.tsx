/**
 * @module useBalancingAlerts
 *
 * Custom hook que deriva el array de Alert[] consumible por AlertCenter
 * a partir del estado actual de balanceo. Extraido de LineBalancing.tsx
 * donde vivian 105 lineas inline en un useMemo enorme.
 *
 * Reglas de las 4 alertas:
 *   1. Overload (critical)     -> estaciones con time > limit (exceden Takt).
 *   2. Machine Deficit (warn)  -> no hay suficientes maquinas en planta.
 *   3. Machine Conflicts (warn)-> tareas con maquinas incompatibles en una estacion.
 *   4. OEE Zone (warn)         -> solo en modo nominal: estacion supera limite OEE
 *                                 pero se mantiene bajo Takt nominal.
 *
 * Es un hook separado para:
 *   - Reusar en otros containers (dashboards, reportes).
 *   - Testearlo sin montar todo LineBalancing.
 *   - Liberar el contenedor principal de 105 ln de JSX condicional.
 */

import React, { useMemo } from 'react';
import { formatNumber } from '../utils';
import { Task, ProjectData } from '../types';
import { Alert } from '../components/ui/AlertCenter';
import { detectOverloadAndRecommend } from '../core/balancing/simulation';
import { MachineValidationResult } from '../core/balancing/machineValidation';

/** Subset minimo de station state que las alertas necesitan. */
export interface AlertStationLike {
    id: number;
    time: number;
    limit: number;
    replicas: number;
    tasks: string[];
}

export interface UseBalancingAlertsArgs {
    stationData: AlertStationLike[];
    machineValidation: MachineValidationResult;
    nominalSeconds: number;
    effectiveSeconds: number;
    tasks: Task[];
    capacityLimitMode: ProjectData['meta']['capacityLimitMode'];
    manualOEE: number;
}

/**
 * Deriva el array de alertas para AlertCenter. Pure function of inputs —
 * sin side effects, memoizado.
 */
export function useBalancingAlerts({
    stationData,
    machineValidation,
    nominalSeconds,
    effectiveSeconds,
    tasks,
    capacityLimitMode,
    manualOEE,
}: UseBalancingAlertsArgs): Alert[] {
    return useMemo<Alert[]>(() => {
        const alerts: Alert[] = [];

        // ---------------------------------------------------------------------
        // 1. Overload (critical) — estaciones que exceden Takt
        // ---------------------------------------------------------------------
        const overloadedStations = stationData.filter(st => st.time > st.limit);
        if (overloadedStations.length > 0) {
            alerts.push({
                id: 'overload',
                severity: 'critical',
                title: 'Sobrecarga Detectada',
                message: `${overloadedStations.length} ${overloadedStations.length === 1 ? 'estación excede' : 'estaciones exceden'} el Takt Time (${formatNumber(nominalSeconds)}s).`,
                details: (
                    <ul className="list-disc pl-4 space-y-1 font-medium">
                        {overloadedStations.map(st => {
                            const stationTasks = st.tasks
                                .map(tid => tasks.find(t => t.id === tid))
                                .filter(Boolean) as Task[];
                            const info = detectOverloadAndRecommend(
                                { effectiveTime: st.time, limit: st.limit, replicas: st.replicas, tasks: stationTasks },
                                nominalSeconds
                            );
                            const isMachine = info?.bottleneckType === 'machine';
                            return (
                                <li key={st.id}>
                                    Est. {st.id}: <strong>{formatNumber(st.time)}s</strong> vs <strong>{formatNumber(st.limit)}s</strong>
                                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${isMachine ? 'bg-purple-100 text-purple-900' : 'bg-red-100 text-red-900'}`}>
                                        {isMachine ? '🔧' : '👥'} {info?.recommendation}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                ),
            });
        }

        // ---------------------------------------------------------------------
        // 2. Machine Deficit (warning) — planta sin suficientes maquinas
        // ---------------------------------------------------------------------
        if (machineValidation.hasDeficit) {
            const deficitMachines = machineValidation.machineBalance.filter(b => b.isDeficit);
            alerts.push({
                id: 'machine-deficit',
                severity: 'warning',
                title: '⚙️ Déficit de Máquinas',
                message: `No hay suficientes máquinas para ${deficitMachines.length} ${deficitMachines.length === 1 ? 'tipo de equipo' : 'tipos de equipos'}.`,
                details: (
                    <ul className="list-disc pl-4 space-y-1 font-medium">
                        {deficitMachines.map(b => (
                            <li key={b.machineId}>
                                <strong>{b.machineName}:</strong> Necesitas {b.consumed}, tienes {b.available}
                                <span className="ml-2 px-2 py-0.5 rounded text-xs font-bold bg-purple-200 text-purple-900">
                                    Faltan {Math.abs(b.balance)}
                                </span>
                            </li>
                        ))}
                    </ul>
                ),
            });
        }

        // ---------------------------------------------------------------------
        // 3. Machine Conflicts (warning) — estacion con maquinas incompatibles
        // ---------------------------------------------------------------------
        if (machineValidation.hasConflicts) {
            const conflictStations = machineValidation.stationRequirements.filter(r => r.hasConflict);
            alerts.push({
                id: 'machine-conflict',
                severity: 'warning',
                title: '⚠️ Conflicto de Máquinas',
                message: `${conflictStations.length} ${conflictStations.length === 1 ? 'estación tiene' : 'estaciones tienen'} tareas con máquinas incompatibles.`,
                details: (
                    <ul className="list-disc pl-4 space-y-1 font-medium">
                        {conflictStations.map(r => (
                            <li key={r.stationId}>
                                Estación {r.stationId}: {r.conflictMessage}
                            </li>
                        ))}
                    </ul>
                ),
            });
        }

        // ---------------------------------------------------------------------
        // 4. OEE Zone Warning (warning) — solo modo nominal
        //    Estacion supera limite OEE pero esta dentro del Takt nominal.
        // ---------------------------------------------------------------------
        if (capacityLimitMode === 'nominal' && stationData.length > 0) {
            const oeeLimit = effectiveSeconds;
            const oeeRiskStations = stationData.filter(st => st.time > oeeLimit && st.time <= st.limit);
            if (oeeRiskStations.length > 0) {
                alerts.push({
                    id: 'oee-zone-warning',
                    severity: 'warning',
                    title: '⚡ Modo Permisivo — Zona OEE',
                    message: `${oeeRiskStations.length} ${oeeRiskStations.length === 1 ? 'estación supera' : 'estaciones superan'} el límite OEE (${formatNumber(oeeLimit)}s) pero están dentro del Takt (${formatNumber(nominalSeconds)}s).`,
                    details: (
                        <div className="text-xs text-amber-800">
                            <p className="mb-1 font-medium">La producción depende de mantener un OEE real ≥ {(manualOEE * 100).toFixed(0)}%.</p>
                            <ul className="list-disc pl-4 space-y-0.5">
                                {oeeRiskStations.map(st => (
                                    <li key={st.id}>Est. {st.id}: <strong>{formatNumber(st.time)}s</strong> (Límite OEE: {formatNumber(oeeLimit)}s)</li>
                                ))}
                            </ul>
                        </div>
                    ),
                });
            }
        }

        return alerts;
    }, [stationData, nominalSeconds, effectiveSeconds, machineValidation, tasks, capacityLimitMode, manualOEE]);
}
