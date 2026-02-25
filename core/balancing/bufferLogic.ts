/**
 * FIX 7: Buffer Dimensioning Logic (IPK - In-Process Kanban)
 * 
 * Heuristic-based buffer placement using saturation as variability proxy.
 * No Monte Carlo simulation needed - deterministic algorithm.
 * 
 * Theory: A line with >90% efficiency and no buffers is "fragile" - 
 * any micro-variation in cycle time causes blocking/starving propagation.
 * Strategic WIP buffers absorb this variability.
 * 
 * Algorithm (from manufacturing expert):
 * - Saturation > 92% → Buffer = 2 (bottleneck/critical)
 * - Saturation 85-92% → Buffer = 1 (high saturation)
 * - Saturation < 85% → Buffer = 0 (operator has recovery margin)
 * - Man-Machine Interface → Buffer = 2 (always, machines don't wait)
 * 
 * @module bufferLogic
 * @version 1.0.0
 */

import { Task, StationConfig, Assignment, IPKBufferConfig } from '../../types';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Threshold for "fragile line" detection */
export const FRAGILE_LINE_EFFICIENCY_THRESHOLD = 0.90;

/** Saturation threshold for critical buffers (bottleneck) */
export const CRITICAL_SATURATION_THRESHOLD = 0.92;

/** Saturation threshold for standard buffers */
export const HIGH_SATURATION_THRESHOLD = 0.85;

/** Buffer size for critical situations */
export const BUFFER_SIZE_CRITICAL = 2;

/** Buffer size for high saturation */
export const BUFFER_SIZE_STANDARD = 1;

// =============================================================================
// TYPES
// =============================================================================

export interface BufferRecommendation {
    /** Station ID after which buffer should be placed */
    afterStationId: number;
    /** Station name for UI display */
    stationName: string;
    /** Recommended buffer size in pieces */
    recommendedSize: number;
    /** Reason for recommendation */
    reason: IPKBufferConfig['reason'];
    /** Station saturation (0-1) */
    saturation: number;
    /** Human-readable explanation */
    explanation: string;
}

export interface LineBufferAnalysis {
    /** Overall line efficiency (0-1) */
    lineEfficiency: number;
    /** True if line is fragile (efficiency > 90% and no existing buffers) */
    isFragileLine: boolean;
    /** List of buffer recommendations */
    recommendations: BufferRecommendation[];
    /** Warning messages for UI */
    warnings: string[];
    /** Total recommended buffer pieces */
    totalBufferPieces: number;
}

export interface StationSaturationInfo {
    stationId: number;
    stationName: string;
    saturation: number;
    cycleTime: number;
    isBottleneck: boolean;
    hasMachineTasks: boolean;
    hasManualTasks: boolean;
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Calculate buffer size based on saturation (expert algorithm)
 * 
 * @param saturation - Station saturation (0-1)
 * @param isManMachineInterface - True if transition between manual and machine stations
 * @returns Buffer configuration with size and reason
 */
export function calculateBufferSize(
    saturation: number,
    isManMachineInterface: boolean
): { size: number; reason: IPKBufferConfig['reason'] } {
    // Rule 1: Man-Machine interface always gets critical buffer
    if (isManMachineInterface) {
        return { size: BUFFER_SIZE_CRITICAL, reason: 'man_machine_interface' };
    }

    // Rule 2: Critical saturation (>92%) - bottleneck
    if (saturation > CRITICAL_SATURATION_THRESHOLD) {
        return { size: BUFFER_SIZE_CRITICAL, reason: 'bottleneck' };
    }

    // Rule 3: High saturation (85-92%) - standard buffer
    if (saturation > HIGH_SATURATION_THRESHOLD) {
        return { size: BUFFER_SIZE_STANDARD, reason: 'high_saturation' };
    }

    // Rule 4: Low saturation (<85%) - no buffer needed
    return { size: 0, reason: 'high_saturation' }; // reason doesn't matter when size=0
}

/**
 * Calculate saturation for each station
 * Saturation = (Cycle Time) / (Takt Time)
 */
export function calculateStationSaturations(
    stations: StationConfig[],
    tasks: Task[],
    assignments: Assignment[],
    taktTime: number
): StationSaturationInfo[] {
    if (taktTime <= 0) return [];

    // Build task time lookup
    const taskTimeMap = new Map<string, Task>();
    for (const task of tasks) {
        taskTimeMap.set(task.id, task);
    }

    // Find max cycle time for bottleneck detection
    let maxCycleTime = 0;
    const saturationInfos: StationSaturationInfo[] = [];

    for (const station of stations) {
        // Get tasks assigned to this station
        const stationAssignments = assignments.filter(a => a.stationId === station.id);

        // Calculate cycle time (sum of assigned task times, excluding machine-internal)
        let cycleTime = 0;
        let hasMachineTasks = false;
        let hasManualTasks = false;

        for (const assignment of stationAssignments) {
            const task = taskTimeMap.get(assignment.taskId);
            if (task) {
                // Skip machine-internal tasks (ghost tasks absorbed during machine cycle)
                if (!task.isMachineInternal) {
                    cycleTime += task.standardTime;
                }

                // Track task types for man-machine detection
                if (task.executionMode === 'machine' || task.executionMode === 'injection') {
                    hasMachineTasks = true;
                } else {
                    hasManualTasks = true;
                }
            }
        }

        // Use override cycle time if available
        if (station.effectiveTime && station.effectiveTime > 0) {
            cycleTime = station.effectiveTime;
        } else if (station.cycleTimeOverride && station.cycleTimeOverride > 0) {
            cycleTime = station.cycleTimeOverride;
        }

        // Calculate saturation (considering replicas)
        const replicas = station.replicas || 1;
        const effectiveCycleTime = cycleTime / replicas;
        const saturation = effectiveCycleTime / taktTime;

        if (cycleTime > maxCycleTime) {
            maxCycleTime = cycleTime;
        }

        saturationInfos.push({
            stationId: station.id,
            stationName: station.name || `Estación ${station.id}`,
            saturation,
            cycleTime: effectiveCycleTime,
            isBottleneck: false, // Will be set in second pass
            hasMachineTasks,
            hasManualTasks
        });
    }

    // Second pass: mark bottleneck
    for (const info of saturationInfos) {
        info.isBottleneck = info.cycleTime === maxCycleTime && maxCycleTime > 0;
    }

    return saturationInfos;
}

/**
 * Detect if there's a man-machine interface transition between two stations
 * 
 * A transition exists when:
 * - Current station has primarily machine tasks AND next has primarily manual tasks
 * - OR current station has primarily manual tasks AND next has primarily machine tasks
 */
export function isManMachineTransition(
    currentStation: StationSaturationInfo,
    nextStation: StationSaturationInfo | null
): boolean {
    if (!nextStation) return false;

    const currentIsMachine = currentStation.hasMachineTasks && !currentStation.hasManualTasks;
    const currentIsManual = currentStation.hasManualTasks && !currentStation.hasMachineTasks;
    const nextIsMachine = nextStation.hasMachineTasks && !nextStation.hasManualTasks;
    const nextIsManual = nextStation.hasManualTasks && !nextStation.hasMachineTasks;

    // Machine → Manual or Manual → Machine
    return (currentIsMachine && nextIsManual) || (currentIsManual && nextIsMachine);
}

/**
 * Analyze a balanced line and recommend WIP buffers
 * 
 * @param stations - Station configurations from project
 * @param tasks - All tasks in project
 * @param assignments - Task-to-station assignments
 * @param taktTime - Effective takt time in seconds
 * @returns Complete buffer analysis with recommendations
 */
export function analyzeBufferNeeds(
    stations: StationConfig[],
    tasks: Task[],
    assignments: Assignment[],
    taktTime: number
): LineBufferAnalysis {
    const warnings: string[] = [];
    const recommendations: BufferRecommendation[] = [];

    if (stations.length === 0 || taktTime <= 0) {
        return {
            lineEfficiency: 0,
            isFragileLine: false,
            recommendations: [],
            warnings: ['No hay estaciones configuradas o Takt Time inválido'],
            totalBufferPieces: 0
        };
    }

    // Calculate saturations for all stations
    const saturationInfos = calculateStationSaturations(stations, tasks, assignments, taktTime);

    if (saturationInfos.length === 0) {
        return {
            lineEfficiency: 0,
            isFragileLine: false,
            recommendations: [],
            warnings: ['No se pudo calcular la saturación de las estaciones'],
            totalBufferPieces: 0
        };
    }

    // Calculate line efficiency (average saturation)
    const avgSaturation = saturationInfos.reduce((sum, s) => sum + s.saturation, 0) / saturationInfos.length;
    const lineEfficiency = Math.min(avgSaturation, 1); // Cap at 100%

    // Check for existing buffers
    const hasExistingBuffers = stations.some(s => s.wipBuffer && s.wipBuffer.size > 0);

    // Detect fragile line
    const isFragileLine = lineEfficiency > FRAGILE_LINE_EFFICIENCY_THRESHOLD && !hasExistingBuffers;

    if (isFragileLine) {
        warnings.push(
            `⚠️ Riesgo Operativo Alto: Saturación promedio ${(lineEfficiency * 100).toFixed(0)}% sin amortiguación. ` +
            `Cualquier pequeña demora detendrá la línea. ` +
            `Recomendación: Agregue buffer de 1-2 unidades entre estaciones o reduzca la carga.`
        );
    }

    // Generate recommendations for each station (except last)
    for (let i = 0; i < saturationInfos.length - 1; i++) {
        const current = saturationInfos[i];
        const next = saturationInfos[i + 1];

        // Check existing buffer
        const existingBuffer = stations.find(s => s.id === current.stationId)?.wipBuffer;
        if (existingBuffer && existingBuffer.isManual) {
            // User manually configured - skip recommendation
            continue;
        }

        // Check for man-machine transition
        const isInterface = isManMachineTransition(current, next);

        // Calculate recommended buffer
        const { size, reason } = calculateBufferSize(current.saturation, isInterface);

        if (size > 0) {
            let explanation = '';

            switch (reason) {
                case 'man_machine_interface':
                    explanation = `Interfaz Hombre-Máquina entre ${current.stationName} y ${next.stationName}. ` +
                        `La máquina no espera - se necesita buffer de desacople.`;
                    break;
                case 'bottleneck':
                    explanation = `Cuello de botella con saturación ${(current.saturation * 100).toFixed(0)}%. ` +
                        `Buffer crítico para evitar propagación de paradas.`;
                    break;
                case 'high_saturation':
                    explanation = `Saturación alta (${(current.saturation * 100).toFixed(0)}%). ` +
                        `Buffer estándar para absorber microvariaciones.`;
                    break;
            }

            recommendations.push({
                afterStationId: current.stationId,
                stationName: current.stationName,
                recommendedSize: size,
                reason,
                saturation: current.saturation,
                explanation
            });
        }
    }

    // Special case: Last station with critical saturation (>95%)
    // No buffer recommendation (nothing after it), but warn about capacity
    const lastStation = saturationInfos[saturationInfos.length - 1];
    if (lastStation && lastStation.saturation > 0.95) {
        warnings.push(
            `⚠️ Estación Final Saturada: ${lastStation.stationName} al ${(lastStation.saturation * 100).toFixed(0)}%. ` +
            `Recomendación: Reducir carga asignada o agregar horas extra/turno adicional.`
        );
    }

    // Sort by importance: bottleneck > man_machine > high_saturation
    const priorityOrder: Record<IPKBufferConfig['reason'], number> = {
        'bottleneck': 1,
        'man_machine_interface': 2,
        'high_saturation': 3
    };

    recommendations.sort((a, b) => priorityOrder[a.reason] - priorityOrder[b.reason]);

    const totalBufferPieces = recommendations.reduce((sum, r) => sum + r.recommendedSize, 0);

    return {
        lineEfficiency,
        isFragileLine,
        recommendations,
        warnings,
        totalBufferPieces
    };
}

/**
 * Apply buffer recommendations to station configs
 * Returns a new array with updated wipBuffer fields
 */
export function applyBufferRecommendations(
    stations: StationConfig[],
    recommendations: BufferRecommendation[]
): StationConfig[] {
    const recommendationMap = new Map<number, BufferRecommendation>();
    for (const rec of recommendations) {
        recommendationMap.set(rec.afterStationId, rec);
    }

    return stations.map(station => {
        const recommendation = recommendationMap.get(station.id);

        // Skip if user manually configured
        if (station.wipBuffer?.isManual) {
            return station;
        }

        if (recommendation) {
            return {
                ...station,
                wipBuffer: {
                    size: recommendation.recommendedSize,
                    reason: recommendation.reason,
                    isManual: false
                }
            };
        }

        // Clear any previous auto-recommendation if no longer needed
        if (station.wipBuffer && !station.wipBuffer.isManual) {
            return {
                ...station,
                wipBuffer: undefined
            };
        }

        return station;
    });
}
