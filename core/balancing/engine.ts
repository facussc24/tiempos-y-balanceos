/**
 * @module engine - Balancing Engine (SALBP-1 / SALBP-2 / RC-ALBP)
 *
 * Core line balancing engine for industrial assembly lines. Implements multiple
 * balancing strategies from operations research:
 *
 * **SALBP-1 (Minimize Stations):** Given a fixed cycle time (Takt), find the
 * minimum number of stations. Uses two approaches:
 *   - Iterative Deepening: tries N=ceil(totalWork/Takt), N+1, N+2...
 *     calling SALBP-2 at each N until feasible. Guarantees global minimum N.
 *   - Greedy Fallback: used when tasks exceed Takt (multi-manning needed)
 *     or when machines are scarce (RC-ALBP constraints).
 *
 * **SALBP-2 (Minimize Cycle Time):** Given a fixed number of stations N,
 * minimize the maximum station load via binary search on cycle time.
 * See {@link simulateBalanceType2}.
 *
 * **RC-ALBP (Resource-Constrained):** Extension that respects machine
 * inventory limits. Tasks requiring a specific machine type cannot be split
 * across more stations than available units. See {@link canAssignToStationRC}.
 *
 * **Key Concepts:**
 * - Takt Time: available production time / customer demand (seconds/unit)
 * - OEE: Overall Equipment Effectiveness — reduces effective available time
 * - Sector Affinity: hard constraint grouping tasks by production zone
 * - Multi-Manning (Replicas): multiple operators share one station when
 *   a single task exceeds the cycle time limit
 * - Ghost Tasks: machine-internal operations (isMachineInternal) that run
 *   concurrently with their parent task and contribute 0s to station load
 *
 * **Phase History:**
 * - Phase 4:  Hybrid stations (mixed machine types with configurable penalty)
 * - Phase 5:  SALBP-2 algorithm (binary search for min cycle given N operators)
 * - Phase 16: Ghost tasks (machine-internal concurrent tasks, 0s effective load)
 * - Phase 17: Station saturation based on manual work only (excludes auto time)
 * - Phase 19: Mixed sector OEE support (per-sector OEE targets)
 * - Phase 23: Sector-specific capacity limits / nominal vs OEE limit mode toggle
 * - Phase 24: Line efficiency = process time / (headcount * TCR)
 * - Phase 25: Injection station efficiency / TCR-based demand fulfillment
 * - Phase 27: Multi-pass stochastic optimization (weighted random selection)
 */

import { Task, ProjectData, Assignment, StationConfig } from '../../types';
import { postProcessRALBP } from './ralbpLogic';
import { validateNoCycles, PrecedenceCycleError } from './detectCycles';
import { calculateEffectiveStationTime, calculateStationOEE } from './simulation';

// Re-export for external use
export { PrecedenceCycleError };

/**
 * Error thrown when balancing engine receives structurally invalid inputs.
 * Indicates a programming error in the caller, not a user input issue.
 */
export class BalancingInputError extends Error {
    public readonly field: string;
    public readonly value: unknown;
    constructor(field: string, message: string, value?: unknown) {
        super(`Input de balanceo inválido [${field}]: ${message}`);
        this.name = 'BalancingInputError';
        this.field = field;
        this.value = value;
    }
}

export type HeuristicType = 'RPW' | 'LCR';

// V4.1: Resource constraint validation result
// Phase 4: Added OK_WITH_PENALTY for hybrid stations
export type ResourceValidationStatus = 'OK' | 'OK_WITH_PENALTY' | 'LOCAL_CONFLICT' | 'GLOBAL_DEFICIT';

// V4.1: Resource gap tracking for deficit reporting
export interface ResourceGap {
    machineId: string;
    machineName: string;
    required: number;
    available: number;
    deficit: number;
}

export interface SimulationResult {
    heuristicName: string;
    technicalName: HeuristicType;
    assignments: Assignment[];
    proposedConfigs: StationConfig[];
    stationsCount: number;
    totalHeadcount: number;
    targetHeadcount?: number; // User requested operators (for SALBP-2 context)
    efficiency: number;
    lineEfficiency?: number;
    realCycleTime?: number;
    idleTime: number;
    parallelStations: number;
    isRecommended?: boolean;
    sortedTasks: Task[];
    // V4.1: RC-ALBP Resource Gaps (Soft Fail)
    resourceGaps?: ResourceGap[];
    // V4.2: Fail-Safe - Virtual Resources Used
    usesVirtualResources?: boolean;
    // Phase 27: Multi-Pass Optimization Improvement Tracking
    improvementVsBaseline?: {
        stationsSaved: number;
        efficiencyGain: number;
    };
}

/**
 * Returns a safe, empty SimulationResult for cases where balancing
 * cannot proceed (e.g., nominalSeconds=0 because demand is 0).
 * This is NOT an error — it's a valid state during UX flow.
 */
const createEmptySimulationResult = (
    name: string,
    technicalName: HeuristicType,
    tasks: Task[]
): SimulationResult => ({
    heuristicName: name,
    technicalName,
    assignments: [],
    proposedConfigs: [],
    stationsCount: 0,
    totalHeadcount: 0,
    efficiency: 0,
    lineEfficiency: 0,
    realCycleTime: 0,
    idleTime: 0,
    parallelStations: 0,
    sortedTasks: [...tasks],
});

export interface SimStation {
    id: number;
    tasks: Task[];
    sectorId?: string;
    machineId?: string; // V4.1: Machine assigned to this station
    hasMixedMachines?: boolean; // Phase 4: Flag for hybrid station penalty
    hybridPenalty?: number; // Phase 4: Accumulated penalty for machine mixing
    effectiveTime: number;
    limit: number;
    replicas: number;
    insufficientResource?: boolean; // V4.1: Flag for deficit stations
}

// Imported from simulation.ts — single source of truth.
// Re-exported here for backward compatibility with existing imports.
export { calculateEffectiveStationTime, calculateStationOEE };

// =============================================================================
// V4.1: RC-ALBP (Resource-Constrained) Validation
// =============================================================================

/**
 * Validate if a task can be assigned to a station respecting resource constraints.
 * 
 * LOCAL CONSTRAINT: A station cannot have two different machine types.
 *   - If allowHybridStations is true, allow with penalty
 *   - If allowHybridStations is false (default), hard block
 * GLOBAL CONSTRAINT: Cannot exceed available machine inventory (Soft Fail).
 * 
 * @param task - The task to assign
 * @param station - Current station state
 * @param globalMachineUsage - Map of machineId -> stations using it
 * @param machineInventory - Map of machineId -> available units
 * @param allowHybridStations - If true, allow mixed machine types with penalty
 * @param hybridPenalty - Penalty in seconds for mixing machines (default: 5)
 * @returns Object with status, machineId, and optional penalty
 */
export const canAssignToStationRC = (
    task: Task,
    station: SimStation,
    globalMachineUsage: Map<string, number>,
    machineInventory: Map<string, number>,
    allowHybridStations: boolean = false,
    hybridPenalty: number = 5
): { status: ResourceValidationStatus; stationMachineId?: string; penalty?: number } => {
    // If task doesn't require a machine, always OK
    if (!task.requiredMachineId) {
        return { status: 'OK' };
    }

    const taskMachineId = task.requiredMachineId;

    // LOCAL CONSTRAINT: Check if station already has a different machine
    if (station.machineId && station.machineId !== taskMachineId) {
        // Phase 4: Check if hybrid stations are allowed
        if (allowHybridStations) {
            // Allow with penalty - mark as hybrid
            return {
                status: 'OK_WITH_PENALTY',
                stationMachineId: taskMachineId,
                penalty: hybridPenalty
            };
        }
        // Station already has a different machine type - cannot mix
        return { status: 'LOCAL_CONFLICT' };
    }

    // If station already has the same machine, OK (no new machine consumed)
    if (station.machineId === taskMachineId) {
        return { status: 'OK', stationMachineId: taskMachineId };
    }

    // Station is empty or has no machine yet - check GLOBAL inventory
    const currentUsage = globalMachineUsage.get(taskMachineId) || 0;
    const maxInventory = machineInventory.get(taskMachineId) || 0;

    if (currentUsage >= maxInventory) {
        // GLOBAL DEFICIT: Not enough machines, but we allow with Soft Fail
        // The station will be marked with insufficientResource flag
        return { status: 'GLOBAL_DEFICIT', stationMachineId: taskMachineId };
    }

    // All OK - machine is available
    return { status: 'OK', stationMachineId: taskMachineId };
};

/**
 * Post-Processing: Hill Climbing for Workload Smoothing (Heijunka)
 * 
 * Strategy:
 * 1. Force N stations (fill with empty if needed).
 * 2. Calculate Ideal Cycle Time (Total Work / N).
 * 3. Iteratively swap/move tasks to minimize Variance (SumSqDev).
 * 4. Constraint: Never exceed existing Max Cycle (or Takt) to preserve throughput.
 */
const optimizeWorkloadSmoothing = (
    initialAssignments: Assignment[],
    data: ProjectData,
    maxCycleLimit: number,
    fixedStations: number
): Assignment[] => {
    // 1. Reconstruct SimStations from Assignments
    // We need to group tasks by stationId
    const stationMap = new Map<number, SimStation>();

    // Initialize N stations
    for (let i = 1; i <= fixedStations; i++) {
        stationMap.set(i, {
            id: i,
            tasks: [],
            effectiveTime: 0,
            limit: maxCycleLimit,
            replicas: 1
        });
    }

    // Populate stations with tasks from assignments
    initialAssignments.forEach(assign => {
        const st = stationMap.get(assign.stationId);
        if (st) {
            const task = data.tasks.find(t => t.id === assign.taskId);
            if (task) {
                st.tasks.push(task);
            }
        }
    });

    // Recalculate loads
    for (const st of stationMap.values()) {
        st.effectiveTime = calculateEffectiveStationTime(st.tasks);
    }

    const stations = Array.from(stationMap.values());

    // 2. Calculate Targets
    const totalWork = stations.reduce((sum, st) => sum + st.effectiveTime, 0);
    const targetLoad = fixedStations > 0 ? totalWork / fixedStations : 0;

    // Constraint: Allow tiny tolerance
    const hardLimit = maxCycleLimit * 1.001;

    // Precedence Graphs for O(1) checks
    const predsMap = new Map<string, string[]>();
    const succsMap = new Map<string, string[]>();
    data.tasks.forEach(t => {
        predsMap.set(t.id, t.predecessors || []);
        (t.predecessors || []).forEach(pId => {
            if (!succsMap.has(pId)) succsMap.set(pId, []);
            succsMap.get(pId)!.push(t.id);
        });
    });

    const isMoveValid = (taskId: string, fromStId: number, toStId: number, currentStations: SimStation[]): boolean => {
        // Precedence Check

        const preds = predsMap.get(taskId) || [];
        for (const pId of preds) {
            const pSt = currentStations.find(st => st.tasks.some(t => t.id === pId));
            if (pSt && pSt.id > toStId) return false;
        }

        const succs = succsMap.get(taskId) || [];
        for (const sId of succs) {
            const sSt = currentStations.find(st => st.tasks.some(t => t.id === sId));
            if (sSt && sSt.id < toStId) return false;
        }

        return true;
    };

    // 3. Hill Climbing Algorithm
    let improved = true;
    let iterations = 0;
    const MAX_ITERATIONS = 500;

    while (improved && iterations < MAX_ITERATIONS) {
        improved = false;
        iterations++;

        let bestMove: { fromIdx: number, toIdx: number, taskIdx: number, reduction: number } | null = null;

        // Iterate all stations
        for (let fromIdx = 0; fromIdx < stations.length; fromIdx++) {
            if (stations[fromIdx].tasks.length === 0) continue;

            for (let toIdx = 0; toIdx < stations.length; toIdx++) {
                if (fromIdx === toIdx) continue;

                const fromSt = stations[fromIdx];
                const toSt = stations[toIdx];

                for (let tIdx = 0; tIdx < fromSt.tasks.length; tIdx++) {
                    const task = fromSt.tasks[tIdx];

                    // FIX: Use overlap-aware recalculation instead of linear arithmetic.
                    // calculateEffectiveStationTime is non-linear for concurrent groups
                    // (machine + manual overlap uses Math.max, not sum).
                    const tasksAfterRemoval = fromSt.tasks.filter((_, i) => i !== tIdx);
                    const tasksAfterAddition = [...toSt.tasks, task];
                    const newFromLoad = calculateEffectiveStationTime(tasksAfterRemoval);
                    const newToLoad = calculateEffectiveStationTime(tasksAfterAddition);

                    // Capacity Check (using actual recalculated time)
                    if (newToLoad > hardLimit) continue;

                    // Precedence Check
                    if (!isMoveValid(task.id, fromSt.id, toSt.id, stations)) continue;

                    // Variance Gain Check
                    const oldFromDiff = Math.pow(fromSt.effectiveTime - targetLoad, 2);
                    const oldToDiff = Math.pow(toSt.effectiveTime - targetLoad, 2);

                    const newFromDiff = Math.pow(newFromLoad - targetLoad, 2);
                    const newToDiff = Math.pow(newToLoad - targetLoad, 2);

                    const reduction = (oldFromDiff + oldToDiff) - (newFromDiff + newToDiff);

                    if (reduction > 0.0001) {
                        let isBetter = false;
                        if (!bestMove) {
                            isBetter = true;
                        } else {
                            const diff = reduction - bestMove.reduction;
                            if (diff > 0.0001) {
                                isBetter = true;
                            } else if (Math.abs(diff) <= 0.0001) {
                                // Tie-breaker: Maximize spread (distance between source and dest)
                                // This helps "stretch" chains across empty stations instead of clumping in the first available one
                                const currentDist = Math.abs(toIdx - fromIdx);
                                const bestDist = Math.abs(bestMove.toIdx - bestMove.fromIdx);
                                if (currentDist > bestDist) {
                                    isBetter = true;
                                }
                            }
                        }

                        if (isBetter) {
                            bestMove = { fromIdx, toIdx, taskIdx: tIdx, reduction };
                        }
                    }
                }
            }
        }

        // Execute Best Move
        if (bestMove) {
            const { fromIdx, toIdx, taskIdx } = bestMove;
            const task = stations[fromIdx].tasks[taskIdx];

            // Remove and recalculate using overlap-aware algorithm
            stations[fromIdx].tasks.splice(taskIdx, 1);
            stations[fromIdx].effectiveTime = calculateEffectiveStationTime(stations[fromIdx].tasks);

            // Add and recalculate
            stations[toIdx].tasks.push(task);
            stations[toIdx].effectiveTime = calculateEffectiveStationTime(stations[toIdx].tasks);

            improved = true;
        }
    }

    // 4. Flatten back to Assignments
    const finalAssignments: Assignment[] = [];
    for (const st of stations) {
        for (const t of st.tasks) {
            finalAssignments.push({
                stationId: st.id,
                taskId: t.id
            });
        }
    }

    return finalAssignments;
};

// =============================================================================
// Phase 27: Multi-Pass Stochastic Search Optimization
// =============================================================================

/**
 * Weighted Random Selection
 * Instead of always choosing the candidate with highest weight,
 * selects one based on probability proportional to weight.
 * 
 * Example: Task A (RPW 100), Task B (RPW 90)
 * A gets ~52.6% chance, B gets ~47.4% chance
 * 
 * @param candidates - List of candidate tasks
 * @returns Selected task
 */
const weightedRandomSelect = (candidates: Task[]): Task => {
    if (candidates.length === 0) throw new Error('No candidates for selection');
    if (candidates.length === 1) return candidates[0];

    // Calculate total weight (use positionalWeight, fallback to time)
    const totalWeight = candidates.reduce((sum, t) => {
        const weight = t.positionalWeight || (t.standardTime || t.averageTime || 1);
        return sum + Math.max(weight, 0.1); // Ensure minimum weight
    }, 0);

    // Generate random number [0, totalWeight)
    let random = Math.random() * totalWeight;

    // Select candidate based on cumulative probability
    for (const task of candidates) {
        const weight = task.positionalWeight || (task.standardTime || task.averageTime || 1);
        random -= Math.max(weight, 0.1);
        if (random <= 0) return task;
    }

    // Fallback (should not reach here)
    return candidates[candidates.length - 1];
};

/**
 * Compare two solutions to determine which is better.
 * Criteria (in priority order):
 * 1. Fewer stations (primary goal)
 * 2. Lower idle time (better distribution)
 * 3. Higher line efficiency
 */
const isBetterSolution = (a: SimulationResult, b: SimulationResult): boolean => {
    // Priority 1: Fewer stations
    if (a.stationsCount !== b.stationsCount) {
        return a.stationsCount < b.stationsCount;
    }

    // Priority 2: Lower idle time (better distribution)
    if (Math.abs(a.idleTime - b.idleTime) > 0.1) {
        return a.idleTime < b.idleTime;
    }

    // Priority 3: Higher line efficiency
    return (a.lineEfficiency || 0) > (b.lineEfficiency || 0);
};

/**
 * Multi-Pass Optimization Configuration
 */
export interface MultiPassConfig {
    iterations: number;
    onProgress?: (current: number, total: number) => void;
}

/**
 * Multi-Pass Optimization Engine
 * 
 * Runs the balancing algorithm multiple times with stochastic selection
 * to explore different solution paths and find better solutions than
 * a single greedy pass.
 * 
 * Guarantees: The result is NEVER worse than a pure greedy pass,
 * because iteration 0 always uses deterministic greedy.
 * 
 * @param data - Project data
 * @param heuristic - Heuristic type (RPW/LCR)
 * @param name - Display name
 * @param nominalSeconds - Takt time
 * @param effectiveSeconds - Effective takt time (with OEE)
 * @param config - Multi-pass configuration
 * @returns Best solution found across all iterations
 */
export const multiPassOptimize = (
    data: ProjectData,
    heuristic: HeuristicType,
    name: string,
    nominalSeconds: number,
    effectiveSeconds: number,
    config: MultiPassConfig = { iterations: 1000 }
): SimulationResult => {
    const { iterations, onProgress } = config;

    let bestResult: SimulationResult | null = null;
    let baselineResult: SimulationResult | null = null;

    for (let i = 0; i < iterations; i++) {
        // First iteration: Pure greedy (baseline guarantee)
        // Subsequent iterations: Stochastic selection
        const useRandom = i > 0;

        try {
            const result = simulateBalanceInternal(
                data, heuristic, name, nominalSeconds, effectiveSeconds, useRandom
            );

            // Save baseline for comparison
            if (i === 0) {
                baselineResult = result;
            }

            // Compare and keep best
            if (!bestResult || isBetterSolution(result, bestResult)) {
                bestResult = result;
            }
        } catch (e) {
            // If an iteration fails (shouldn't happen), continue with others
            // The baseline from iteration 0 is always valid
            if (i === 0) throw e; // Re-throw if baseline fails
            continue;
        }

        // Report progress every 50 iterations
        if (onProgress && i % 50 === 0) {
            onProgress(i, iterations);
        }
    }

    // Add improvement comparison to result
    if (bestResult && baselineResult) {
        const stationsSaved = baselineResult.stationsCount - bestResult.stationsCount;
        const efficiencyGain = (bestResult.lineEfficiency || 0) - (baselineResult.lineEfficiency || 0);

        if (stationsSaved > 0 || efficiencyGain > 0.1) {
            bestResult.improvementVsBaseline = {
                stationsSaved,
                efficiencyGain
            };
        }
    }

    // Final progress report
    if (onProgress) {
        onProgress(iterations, iterations);
    }

    return bestResult!;
};

/**
 * Validates engine inputs. Hybrid strategy:
 *  - Throws BalancingInputError for structural issues (empty tasks, missing meta)
 *  - Returns 'skip' for numeric edge cases (zero Takt) → caller returns empty result
 *  - Returns 'ok' when inputs are valid
 */
function validateEngineInputs(
    data: ProjectData,
    nominalSeconds: number,
    effectiveSeconds: number
): 'ok' | 'skip' {
    // === STRUCTURAL VALIDATION (throw) ===

    if (!data.meta) {
        throw new BalancingInputError('data.meta', 'ProjectData.meta es undefined/null');
    }

    if (!data.tasks || data.tasks.length === 0) {
        throw new BalancingInputError(
            'data.tasks',
            'No hay tareas para balancear (tasks está vacío)',
            data.tasks?.length ?? 'undefined'
        );
    }

    // Validate task times are non-negative and finite
    for (const task of data.tasks) {
        const time = task.standardTime || task.averageTime || 0;
        if (time < 0 || !isFinite(time)) {
            throw new BalancingInputError(
                'task.time',
                `Tarea ${task.id} tiene tiempo inválido: ${time}. Debe ser >= 0 y finito.`,
                time
            );
        }
    }

    // Note: data.shifts is NOT validated here because the engine receives
    // pre-calculated nominalSeconds/effectiveSeconds. Shifts are validated
    // upstream in calculateTaktTime() which returns 0 for invalid shifts,
    // and that's caught by the nominalSeconds <= 0 check below.

    // === NUMERIC EDGE CASES (return 'skip') ===

    if (nominalSeconds <= 0 || effectiveSeconds <= 0) {
        return 'skip';
    }

    if (!isFinite(nominalSeconds) || !isFinite(effectiveSeconds)) {
        return 'skip';
    }

    return 'ok';
}

// =============================================================================
// Extracted Sub-Functions (from simulateBalanceInternal)
// =============================================================================

/** Result of the greedy assignment phase, before final metric calculation. */
interface GreedyAssignmentResult {
    processedAssignments: Assignment[];
    proposedConfigs: StationConfig[];
    sortedTasks: Task[];
    usedStationIds: number[];
    globalMachineUsage: Map<string, number>;
    machineInventory: Map<string, number>;
    machineNames: Map<string, string>;
    usesVirtualResources: boolean;
}

/**
 * Greedy task-to-station assignment with RC-ALBP support.
 *
 * Sorts tasks by heuristic, then iteratively assigns them to stations
 * respecting precedence, sector affinity, and resource constraints.
 * Includes RALBP post-processing and config reconciliation.
 */
const runGreedyAssignment = (
    data: ProjectData,
    targetHeuristic: HeuristicType,
    nominalSeconds: number,
    effectiveSeconds: number,
    useRandomSelection: boolean
): GreedyAssignmentResult => {

    // 1. Sort Tasks
    // RPW: Positional Weight Descending. LCR: Duration Descending.
    const sortedTasks = [...data.tasks].sort((a, b) => {
        if (targetHeuristic === 'RPW') {
            if (Math.abs(b.positionalWeight - a.positionalWeight) > 0.01) {
                return b.positionalWeight - a.positionalWeight;
            }
            const timeA = a.standardTime || a.averageTime || 0;
            const timeB = b.standardTime || b.averageTime || 0;
            return timeB - timeA;
        } else {
            const timeA = a.standardTime || a.averageTime || 0;
            const timeB = b.standardTime || b.averageTime || 0;
            return timeB - timeA;
        }
    });

    const assignments: Assignment[] = [];
    const proposedConfigs: StationConfig[] = [];
    const unassignedIds = new Set(sortedTasks.map(t => t.id));

    // V4.1: RC-ALBP Machine Inventory Tracking
    const machineInventory = new Map<string, number>();
    const machineNames = new Map<string, string>();
    let usesVirtualResources = false;

    if (data.plantConfig?.machines && data.plantConfig.machines.length > 0) {
        for (const machine of data.plantConfig.machines) {
            // FIX: Fall back to quantity (legacy alias) for backward compatibility.
            // Use || 0 after ?? chain — nullish coalescing doesn't catch NaN,
            // which would corrupt machine constraint checks downstream.
            const rawUnits = machine.availableUnits ?? machine.quantity;
            machineInventory.set(machine.id, Number.isFinite(rawUnits) ? rawUnits : 0);
            machineNames.set(machine.id, machine.name);
        }
    } else {
        usesVirtualResources = true;
        if (data.sectors && data.sectors.length > 0) {
            for (const sector of data.sectors) {
                const virtualId = `VIRTUAL_${sector.id}`;
                machineInventory.set(virtualId, 999);
                machineNames.set(virtualId, `Estándar ${sector.name}`);
            }
        }
        machineInventory.set('VIRTUAL_GENERIC', 999);
        machineNames.set('VIRTUAL_GENERIC', 'Recurso Genérico');
    }

    const globalMachineUsage = new Map<string, number>();
    const stationsWithDeficit = new Set<number>();

    let stationIndex = 1;
    let currentStation: SimStation = {
        id: 1, tasks: [], effectiveTime: 0, limit: 0, replicas: 1
    };

    const startNewStation = () => {
        stationIndex++;
        currentStation = {
            id: stationIndex, tasks: [], effectiveTime: 0, limit: 0, replicas: 1
        };
    };

    const getLimitForSector = (sectorId?: string) => {
        const useNominal = data.meta.capacityLimitMode === 'nominal';
        if (useNominal) {
            return Math.max(1, nominalSeconds);
        }
        if (data.meta.useSectorOEE && sectorId) {
            const sector = data.sectors?.find(s => s.id === sectorId);
            const target = sector?.targetOee || data.meta.manualOEE;
            return Math.max(1, nominalSeconds * target);
        }
        return Math.max(1, effectiveSeconds);
    };

    // PERF: Pre-build lookup maps to avoid O(n) .find()/.filter() inside greedy loop
    const taskMap = new Map(data.tasks.map(t => [t.id, t]));
    const internalTasksByParent = new Map<string, Task[]>();
    for (const t of data.tasks) {
        if (t.isMachineInternal && t.concurrentWith) {
            const list = internalTasksByParent.get(t.concurrentWith);
            if (list) { list.push(t); } else { internalTasksByParent.set(t.concurrentWith, [t]); }
        }
    }

    let safetyCounter = 0;
    const MAX_ITERATIONS = 1000;
    const startTime = Date.now();
    const TIMEOUT_MS = 5000;

    // --- Greedy Loop ---
    while (unassignedIds.size > 0) {
        safetyCounter++;
        if (safetyCounter > MAX_ITERATIONS) {
            throw new Error(`Algoritmo excedió el límite de ${MAX_ITERATIONS} iteraciones.`);
        }
        if (Date.now() - startTime > TIMEOUT_MS) {
            throw new Error(`Optimización excedió el tiempo límite (${TIMEOUT_MS / 1000}s).`);
        }

        let assignedInPass = false;

        // Filter candidates that respect precedence
        const validCandidates = sortedTasks.filter(t =>
            unassignedIds.has(t.id) &&
            t.predecessors.every(pid => !unassignedIds.has(pid))
        );

        const useSectorAffinity = !data.meta.disableSectorAffinity;
        const prioritizedCandidates = validCandidates.sort((a, b) => {
            if (useSectorAffinity && currentStation.sectorId) {
                const aMatch = a.sectorId === currentStation.sectorId;
                const bMatch = b.sectorId === currentStation.sectorId;
                if (aMatch && !bMatch) return -1;
                if (!aMatch && bMatch) return 1;
            }
            return 0; // Stable sort
        });

        // Phase 27: Stochastic Selection Mode
        let candidatesToProcess: Task[];
        if (useRandomSelection && prioritizedCandidates.length > 1) {
            const shuffled: Task[] = [];
            const remaining = [...prioritizedCandidates];
            while (remaining.length > 0) {
                const selected = weightedRandomSelect(remaining);
                shuffled.push(selected);
                const idx = remaining.findIndex(t => t.id === selected.id);
                if (idx !== -1) remaining.splice(idx, 1);
            }
            candidatesToProcess = shuffled;
        } else {
            candidatesToProcess = prioritizedCandidates;
        }

        // Loop through candidates
        for (const task of candidatesToProcess) {
            if (!unassignedIds.has(task.id)) continue;

            // 1. Sector Constraint
            const taskSector = data.meta.disableSectorAffinity ? undefined : task.sectorId;
            if (currentStation.tasks.length === 0) {
                currentStation.sectorId = taskSector;
                currentStation.limit = getLimitForSector(taskSector);
            } else if (!data.meta.disableSectorAffinity && currentStation.sectorId !== taskSector) {
                continue;
            }

            // 2. Resource Constraint (RC-ALBP)
            const allowHybrid = data.meta.allowHybridStations || false;
            const hybridPenalty = data.meta.hybridStationPenalty ?? 5;
            const rcResult = canAssignToStationRC(
                task, currentStation, globalMachineUsage, machineInventory, allowHybrid, hybridPenalty
            );

            if (rcResult.status === 'LOCAL_CONFLICT') continue;

            let additionalPenalty = 0;
            if (rcResult.status === 'OK_WITH_PENALTY' && rcResult.penalty) {
                additionalPenalty = rcResult.penalty;
            }
            const hasDeficit = rcResult.status === 'GLOBAL_DEFICIT';

            // 3. Capacity Check
            const testTasks = [...currentStation.tasks, task];
            const testEffectiveTime = calculateEffectiveStationTime(testTasks);

            let effectiveTaskLoad = calculateEffectiveStationTime([task]);
            if (task.executionMode === 'injection' || task.executionMode === 'machine') {
                // PERF: Use pre-built Map instead of O(n) filter on every iteration
                const internalTasks = internalTasksByParent.get(task.id) || [];
                const totalInternalTime = calculateEffectiveStationTime(internalTasks);
                effectiveTaskLoad = Math.max(effectiveTaskLoad, totalInternalTime);
            }

            const taskTime = task.isMachineInternal ? 0 : effectiveTaskLoad;

            let limit = currentStation.limit > 0
                ? currentStation.limit
                : getLimitForSector(task.sectorId);
            if (task.executionMode === 'injection' || task.executionMode === 'machine') {
                limit = nominalSeconds || effectiveSeconds || 1;
            }
            limit = Math.max(1, limit);

            // Case GHOST: Internal tasks absorbed into their machine's station
            if (task.isMachineInternal && task.concurrentWith &&
                currentStation.tasks.some(t => t.id === task.concurrentWith)) {
                assignments.push({ taskId: task.id, stationId: currentStation.id });
                unassignedIds.delete(task.id);
                currentStation.tasks.push(task);
                assignedInPass = true;
                continue;
            }

            // Case A: Task fits normally
            const adjustedTime = testEffectiveTime / Math.max(1, currentStation.replicas);
            if (adjustedTime <= limit) {
                assignments.push({ taskId: task.id, stationId: currentStation.id });
                unassignedIds.delete(task.id);
                currentStation.tasks.push(task);
                currentStation.effectiveTime = testEffectiveTime;

                if (rcResult.status === 'OK_WITH_PENALTY' && rcResult.penalty) {
                    currentStation.hasMixedMachines = true;
                    currentStation.hybridPenalty = (currentStation.hybridPenalty || 0) + additionalPenalty;
                }

                if (rcResult.stationMachineId && !currentStation.machineId) {
                    currentStation.machineId = rcResult.stationMachineId;
                    const prevUsage = globalMachineUsage.get(rcResult.stationMachineId) || 0;
                    globalMachineUsage.set(rcResult.stationMachineId, prevUsage + currentStation.replicas);
                    if (hasDeficit) stationsWithDeficit.add(currentStation.id);
                }

                assignedInPass = true;
                // Do NOT break; keep filling the station.
            }
            // Case A.5: Resource-Aware Multi-Manning
            else if (
                taskTime <= limit &&
                currentStation.machineId &&
                task.requiredMachineId === currentStation.machineId &&
                task.executionMode !== 'injection' &&
                task.executionMode !== 'machine'
            ) {
                const scarceMachineId = currentStation.machineId;
                const availableUnits = machineInventory.get(scarceMachineId) || 0;
                const currentUsageCount = globalMachineUsage.get(scarceMachineId) || 0;

                if (currentUsageCount >= availableUnits) {
                    assignments.push({ taskId: task.id, stationId: currentStation.id });
                    unassignedIds.delete(task.id);
                    currentStation.tasks.push(task);
                    currentStation.effectiveTime = calculateEffectiveStationTime([...currentStation.tasks]);

                    const newReplicas = limit > 0 ? Math.ceil(currentStation.effectiveTime / limit) : 1;
                    currentStation.replicas = Math.max(currentStation.replicas, newReplicas);

                    const cfgIdx = proposedConfigs.findIndex(c => c.id === currentStation.id);
                    if (cfgIdx >= 0) {
                        proposedConfigs[cfgIdx].replicas = currentStation.replicas;
                        proposedConfigs[cfgIdx].effectiveTime = currentStation.effectiveTime;
                    } else {
                        proposedConfigs.push({
                            id: currentStation.id,
                            oeeTarget: calculateStationOEE(data, currentStation.id, currentStation.sectorId),
                            replicas: currentStation.replicas,
                            effectiveTime: currentStation.effectiveTime
                        });
                    }

                    assignedInPass = true;
                }
            }
            // Case B: Task is BIGGER than Limit (Requires Multi-Manning)
            else if (taskTime > limit) {
                const hasRealTasks = currentStation.tasks.some(t => !t.isMachineInternal);
                if (hasRealTasks) continue;

                const rawNeeded = limit > 0 ? Math.ceil(taskTime / limit) : 1;
                const needed = (task.executionMode === 'injection' || task.executionMode === 'machine') ? 1 : rawNeeded;

                currentStation.replicas = needed;
                currentStation.limit = limit;

                const taskEffectiveTime = calculateEffectiveStationTime([task]);
                proposedConfigs.push({
                    id: currentStation.id,
                    oeeTarget: calculateStationOEE(data, currentStation.id, currentStation.sectorId),
                    replicas: needed,
                    effectiveTime: taskEffectiveTime
                });

                assignments.push({ taskId: task.id, stationId: currentStation.id });
                unassignedIds.delete(task.id);
                currentStation.tasks.push(task);

                if (rcResult.stationMachineId && !currentStation.machineId) {
                    currentStation.machineId = rcResult.stationMachineId;
                    const prevUsage = globalMachineUsage.get(rcResult.stationMachineId) || 0;
                    globalMachineUsage.set(rcResult.stationMachineId, prevUsage + needed);
                    if (hasDeficit) stationsWithDeficit.add(currentStation.id);
                }

                currentStation.effectiveTime = calculateEffectiveStationTime([...currentStation.tasks]);
                assignedInPass = true;
            }
        }

        if (!assignedInPass) {
            const prevId = currentStation.id;
            startNewStation();
            if (currentStation.id === prevId) break;
        }
    }

    // RALBP post-processing
    const processedAssignments = postProcessRALBP(assignments, data.tasks);

    // Reconcile proposedConfigs after RALBP moves
    const usedStationIds = Array.from(new Set(processedAssignments.map(a => a.stationId))).sort((a, b) => a - b);

    usedStationIds.forEach(stId => {
        // PERF: Use pre-built taskMap instead of O(n) find per assignment
        const stationTasks = processedAssignments
            .filter(a => a.stationId === stId)
            .map(a => taskMap.get(a.taskId))
            .filter(Boolean) as Task[];

        const stationEffectiveTime = calculateEffectiveStationTime(stationTasks);

        const totalManualLoad = stationTasks.reduce((sum, t) => {
            if (t.isMachineInternal) return sum;
            if (t.executionMode === 'injection' || t.executionMode === 'machine') return sum;
            const time = t.standardTime || t.averageTime || 0;
            return sum + time;
        }, 0);

        const representativeSectorId = stationTasks[0]?.sectorId;
        let cycleLimit = nominalSeconds || 1;
        if (data.meta.useSectorOEE && representativeSectorId) {
            const sector = data.sectors?.find(s => s.id === representativeSectorId);
            const sectorOEE = sector?.targetOee || data.meta.manualOEE;
            cycleLimit = Math.max(1, nominalSeconds * sectorOEE);
        } else {
            cycleLimit = Math.max(1, effectiveSeconds);
        }

        let existingConfigIndex = proposedConfigs.findIndex(c => c.id === stId);
        if (existingConfigIndex < 0) {
            const representativeSectorId = stationTasks[0]?.sectorId;
            proposedConfigs.push({
                id: stId,
                oeeTarget: calculateStationOEE(data, stId, representativeSectorId),
                replicas: 1,
                effectiveTime: stationEffectiveTime
            });
            existingConfigIndex = proposedConfigs.length - 1;
        } else {
            proposedConfigs[existingConfigIndex].effectiveTime = stationEffectiveTime;
        }

        if (totalManualLoad > cycleLimit) {
            const requiredOps = cycleLimit > 0 ? Math.ceil(totalManualLoad / cycleLimit) : 1;
            if (proposedConfigs[existingConfigIndex].replicas < requiredOps) {
                proposedConfigs[existingConfigIndex].replicas = requiredOps;
            }
        }
    });

    return {
        processedAssignments,
        proposedConfigs,
        sortedTasks,
        usedStationIds,
        globalMachineUsage,
        machineInventory,
        machineNames,
        usesVirtualResources
    };
};

/**
 * Calculate final balancing metrics from processed assignments.
 *
 * Metrics:
 * - efficiency (Demand Fulfillment): 100% if TCR <= Takt, else (Takt/TCR)*100
 * - lineEfficiency (Asset Utilization): totalProcessTime / (headcount * TCR) * 100
 * - idleTime: (headcount * Takt) - totalProcessTime (only when TCR <= Takt)
 * - realCycleTime (TCR): max station cycle across all stations
 */
const calculateBalancingMetrics = (
    greedyResult: GreedyAssignmentResult,
    data: ProjectData,
    name: string,
    targetHeuristic: HeuristicType,
    nominalSeconds: number,
): SimulationResult => {
    const {
        processedAssignments, proposedConfigs, sortedTasks, usedStationIds,
        globalMachineUsage, machineInventory, machineNames, usesVirtualResources
    } = greedyResult;

    const finalStationIds = Array.from(new Set(processedAssignments.map(a => a.stationId))).sort((a, b) => a - b);
    const stationsCount = finalStationIds.length;

    // PERF: Pre-build task lookup Map to avoid O(n) find per assignment
    const metricsTaskMap = new Map(data.tasks.map(t => [t.id, t]));

    let totalEffWork = 0;
    let totalHeadcount = 0;
    let maxStationCycle = 0;

    for (const stId of usedStationIds) {
        const stTasks = processedAssignments
            .filter(a => a.stationId === stId)
            .map(a => metricsTaskMap.get(a.taskId))
            .filter(Boolean) as Task[];

        // Use the same effective time calculation as useLineBalancing (concurrency-aware)
        const stEffective = calculateEffectiveStationTime(stTasks);
        totalEffWork += stEffective;

        const cfg = proposedConfigs.find(c => c.id === stId);
        const replicas = cfg?.replicas || 1;
        totalHeadcount += replicas;

        let stationCycle = replicas > 0 ? stEffective / replicas : stEffective;

        const injectionTask = stTasks.find(t => t.executionMode === 'injection' || t.executionMode === 'machine');
        if (injectionTask?.injectionParams?.realCycle) {
            // Use Max: station cycle is limited by whichever is slower (manual work or machine)
            stationCycle = Math.max(stationCycle, injectionTask.injectionParams.realCycle);
        }

        if (stationCycle > maxStationCycle) maxStationCycle = stationCycle;
    }

    // Demand Fulfillment
    let efficiency: number;
    if (maxStationCycle <= 0) {
        efficiency = 0; // No work assigned → 0% efficiency, not 100%
    } else if (maxStationCycle <= nominalSeconds) {
        efficiency = 100;
    } else {
        efficiency = (nominalSeconds / maxStationCycle) * 100;
    }

    // Asset Utilization (Line Efficiency = Total Work / (Headcount × Bottleneck Cycle))
    // FIX: Use totalHeadcount (not stationsCount) to account for multi-manning replicas.
    // With replicas, multiple operators share one station — efficiency must reflect
    // all operator-time available, not just station count.
    // Consistent with SALBP-2 path (simulateBalanceType2) and idleTime calculation.
    // FIX: Check both operands individually to prevent 0*x=0 passing the guard
    // when totalHeadcount=0 but maxStationCycle>0, which would produce 0/0=NaN
    const lineEfficiency = totalHeadcount > 0 && maxStationCycle > 0
        ? Math.min(100, (totalEffWork / (totalHeadcount * maxStationCycle)) * 100)
        : 0;

    // FIX: Guard against maxStationCycle=0 (all machine-internal tasks)
    // which would falsely produce a large idle time
    const idleTime = maxStationCycle > 0 && maxStationCycle <= nominalSeconds
        ? (totalHeadcount * nominalSeconds) - totalEffWork
        : 0;

    const parallelStations = proposedConfigs.filter(c => c.replicas && c.replicas > 1).length;

    // RC-ALBP Resource Gaps
    const resourceGaps: ResourceGap[] = [];
    for (const [machineId, usageCount] of globalMachineUsage.entries()) {
        const available = machineInventory.get(machineId) || 0;
        if (usageCount > available) {
            resourceGaps.push({
                machineId,
                machineName: machineNames.get(machineId) || machineId,
                required: usageCount,
                available,
                deficit: usageCount - available
            });
        }
    }

    return {
        heuristicName: name,
        technicalName: targetHeuristic,
        assignments: processedAssignments,
        proposedConfigs,
        stationsCount,
        totalHeadcount,
        efficiency,
        lineEfficiency,
        realCycleTime: maxStationCycle,
        idleTime,
        parallelStations,
        sortedTasks,
        resourceGaps: resourceGaps.length > 0 ? resourceGaps : undefined,
        usesVirtualResources
    };
};

/**
 * Run a single-pass deterministic balancing simulation.
 *
 * This is the public entry point for SALBP-1 balancing. It delegates to the
 * internal engine which selects the best strategy automatically:
 *   - SALBP-2 path if `data.meta.balancingMode === 'SALBP2'`
 *   - Iterative Deepening if tasks fit within Takt (optimal N search)
 *   - Greedy with multi-manning fallback otherwise
 *
 * For stochastic multi-pass optimization, use {@link multiPassOptimize} instead.
 *
 * @param data - Project data (tasks, meta config, sectors, plant config)
 * @param targetHeuristic - Sorting heuristic: 'RPW' (Ranked Positional Weight) or 'LCR' (Longest Candidate Rule)
 * @param name - Display name for the result (shown in UI)
 * @param nominalSeconds - Nominal Takt time in seconds (gross, before OEE)
 * @param effectiveSeconds - Effective Takt time in seconds (Takt * global OEE)
 * @returns Balanced result with assignments, station configs, and metrics
 */
export const simulateBalance = (
    data: ProjectData,
    targetHeuristic: HeuristicType,
    name: string,
    nominalSeconds: number,
    effectiveSeconds: number
): SimulationResult => {
    return simulateBalanceInternal(data, targetHeuristic, name, nominalSeconds, effectiveSeconds, false);
};

/**
 * Internal balancing engine with optional stochastic selection.
 *
 * ## Algorithm Overview (Greedy Path)
 *
 * ```
 * 1. VALIDATE inputs, detect precedence cycles
 * 2. SELECT STRATEGY:
 *    - If SALBP-2 mode → binary search for min cycle (see simulateBalanceType2)
 *    - If tasks fit in Takt and no scarce machines → Iterative Deepening
 *    - Otherwise → Greedy with multi-manning (below)
 * 3. SORT tasks by heuristic (RPW: positional weight desc, LCR: duration desc)
 * 4. GREEDY ASSIGNMENT LOOP — while unassigned tasks remain:
 *    a. Filter valid candidates (all predecessors already assigned)
 *    b. Prioritize by sector affinity (same zone first), then heuristic order
 *    c. If stochastic mode: shuffle candidates via weighted random selection
 *    d. For each candidate, try to assign:
 *       - GHOST:    Machine-internal task whose parent is in station → absorb (0s cost)
 *       - CASE A:   Task fits within station time limit → assign normally
 *       - CASE A.5: Task doesn't fit but shares scarce machine → multi-man (increase replicas)
 *       - CASE B:   Task exceeds limit alone → new station with replicas = ceil(task/limit)
 *    e. If nothing assigned in this pass → close station, open new one
 * 5. POST-PROCESS with RALBP grouping (postProcessRALBP)
 * 6. RECALCULATE station configs (replicas, effectiveTime, OEE)
 * 7. COMPUTE METRICS:
 *    - efficiency (Demand Fulfillment): 100% if TCR <= Takt, else (Takt/TCR)*100
 *    - lineEfficiency (Asset Utilization): totalProcessTime / (headcount * TCR) * 100
 *    - idleTime: (headcount * Takt) - totalProcessTime  (only when TCR <= Takt)
 *    - realCycleTime (TCR): max station cycle across all stations
 * ```
 */
const simulateBalanceInternal = (
    data: ProjectData,
    targetHeuristic: HeuristicType,
    name: string,
    nominalSeconds: number,
    effectiveSeconds: number,
    useRandomSelection: boolean = false
): SimulationResult => {

    // ==========================================================================
    // INPUT VALIDATION: Structural checks (throw) + numeric edge cases (skip)
    // Must run BEFORE cycle detection since validateNoCycles accesses data.tasks
    // ==========================================================================
    const validationResult = validateEngineInputs(data, nominalSeconds, effectiveSeconds);
    if (validationResult === 'skip') {
        return createEmptySimulationResult(name, targetHeuristic, data.tasks);
    }

    // ==========================================================================
    // FIX 3: CYCLE DETECTION (Anti-Crash)
    // Validate no circular precedences before any balancing to prevent hangs
    // ==========================================================================
    validateNoCycles(data.tasks);

    // --- STRATEGY SELECTION ---

    // V4.1: RC-ALBP / SALBP-2 Handling
    const balancingMode = data.meta.balancingMode || 'SALBP1';
    const targetOperators = data.meta.targetOperators || 8;
    const objective = data.meta.balancingObjective || 'MAX_THROUGHPUT';

    // Strategy A: FIXED RESOURCES (SALBP-2)
    if (balancingMode === 'SALBP2') {
        // Run the "Type 2" Engine (Binary Search for Min Cycle)
        // This inherently handles "Maximizing Throughput" because it finds the lowest possible Cycle Time.
        // It also handles "Smoothing" because by lowering the ceiling, we force distribution.

        const result = simulateBalanceType2(data, targetOperators, name, nominalSeconds);

        // Post-Processing for specific objectives
        if (objective === 'SMOOTH_WORKLOAD') {
            // Execute Heijunka (Variance Minimization)
            // We use the Min Cycle found by Type2 as a constraint to ensure we don't lose throughput.
            const smoothedAssignments = optimizeWorkloadSmoothing(
                result.assignments,
                data,
                result.realCycleTime || 0, // Maintain the speed we achieved
                targetOperators   // Force usage of all N operators
            );

            result.assignments = smoothedAssignments;
            result.heuristicName = `${name} (Suavizado Heijunka)`;

            // Recalculate basic metrics since assignments changed
            // Recalculate basic metrics since assignments changed
            // Recalculate basic metrics since assignments changed
            // FIX: For Fixed Resources (SALBP-2), stationsCount MUST match targetOperators
            // even if some stations are empty (user requested specific headcount).
            result.stationsCount = targetOperators;

            // Update proposedConfigs to ensure all N stations exist (even if empty)
            for (let i = 1; i <= targetOperators; i++) {
                if (!result.proposedConfigs.find(c => c.id === i)) {
                    // FIX: Derive sectorId from tasks assigned to this station
                    const stTaskIds = smoothedAssignments.filter(a => a.stationId === i).map(a => a.taskId);
                    const stTasks = data.tasks.filter(t => stTaskIds.includes(t.id));
                    const sectorId = stTasks[0]?.sectorId;
                    // Create empty config for unused station
                    result.proposedConfigs.push({
                        id: i,
                        oeeTarget: calculateStationOEE(data, i, sectorId),
                        replicas: 1
                    });
                }
            }
            result.proposedConfigs.sort((a, b) => a.id - b.id);

            // FIX: Recalculate effectiveTime for all configs after smoothing
            for (const config of result.proposedConfigs) {
                const stationTaskIds = smoothedAssignments
                    .filter(a => a.stationId === config.id)
                    .map(a => a.taskId);
                const stationTasks = data.tasks.filter(t => stationTaskIds.includes(t.id));
                config.effectiveTime = calculateEffectiveStationTime(stationTasks);
            }

            // Recalculate Max Cycle properly (grouping tasks by station)
            const stMap = new Map<number, Task[]>();
            smoothedAssignments.forEach(a => {
                const t = data.tasks.find(task => task.id === a.taskId);
                if (t) {
                    if (!stMap.has(a.stationId)) stMap.set(a.stationId, []);
                    stMap.get(a.stationId)!.push(t);
                }
            });

            let newMaxCycle = 0;
            for (const tasks of stMap.values()) {
                const load = calculateEffectiveStationTime(tasks);
                if (load > newMaxCycle) newMaxCycle = load;
            }

            result.realCycleTime = newMaxCycle;

            // Note: If we really want to relax to Takt Time, we should have passed Takt as limit.
            // But the user usually wants "Best possible speed, then smoothest possible distribution".
            // If they want exactly Takt speed, they should set Takt.
        } else {
            result.heuristicName = `${name} (Max Prod.)`;
        }

        // Add context info
        result.targetHeadcount = targetOperators;

        // IMPORTANT: If we are in Fixed Mode, we do NOT loop for N. We return immediately.
        return result;
    }

    // Strategy B: MINIMIZE RESOURCES (SALBP-1) - Existing Logic
    // Expert Check: Can we use Iterative SALBP-2 (Optimal) or must we use Greedy (Multi-Manning)?
    const totalWorkContent = data.tasks.reduce((sum, t) => {
        if (t.isMachineInternal) return sum;
        // FIX v10.1: standardTime already includes fatigue
        return sum + (t.standardTime || t.averageTime || 0);
    }, 0);

    const _taskTimes = data.tasks.map(t => {
        if (t.isMachineInternal) return 0;
        // FIX v10.1: standardTime already includes fatigue
        return (t.standardTime || t.averageTime || 0);
    });
    const maxTaskTime = _taskTimes.length > 0 ? Math.max(..._taskTimes) : 0;

    // If any task exceeds Takt Time, we MUST use Greedy because SALBP-2 doesn't support splitting tasks (replicas) yet.
    // Also requires valid Takt Time.
    // Tolerance is configurable: 1.05 = 5% overflow allowed, 1.0 = strict (pure SALBP)
    const taktTolerance = data.meta.taktTolerance ?? 1.05;

    // FIX PHASE 23: Check against EFFECTIVE limit (considering sector OEE), not just nominalSeconds
    // When useSectorOEE is enabled, some sectors might have much lower limits than the global Takt
    // Capacity Limit Mode: 'nominal' uses Takt bruto, 'oee' (default) uses Takt × OEE
    const useNominalLimit = data.meta.capacityLimitMode === 'nominal';
    let minEffectiveLimit = useNominalLimit ? nominalSeconds : effectiveSeconds;
    if (!useNominalLimit && data.meta.useSectorOEE && data.sectors && data.sectors.length > 0) {
        // Find the MOST RESTRICTIVE sector limit (lowest OEE)
        const sectorLimits = data.sectors.map(s => nominalSeconds * (s.targetOee || data.meta.manualOEE));
        minEffectiveLimit = Math.min(...sectorLimits, effectiveSeconds);
    }

    const requiresMultiManning = minEffectiveLimit > 0 && maxTaskTime > (minEffectiveLimit * taktTolerance);

    // Resource-Aware Strategy Override:
    // If any machine is SCARCE (tasks needing it would require more stations than available units),
    // we MUST use the Greedy path which has Case A.5 (resource-aware multi-manning).
    // The SALBP-2 iterative path is resource-blind and would split tasks across N stations,
    // consuming N machine units when only K < N are available.
    let hasScarceResource = false;
    if (data.plantConfig?.machines && data.plantConfig.machines.length > 0 && effectiveSeconds > 0) {
        // Group tasks by required machine and calculate total work per machine
        const workPerMachine = new Map<string, number>();
        for (const task of data.tasks) {
            if (task.requiredMachineId && !task.isMachineInternal) {
                const rawTime = task.standardTime || task.averageTime || 0;
                const time = Number.isFinite(rawTime) ? rawTime : 0;
                workPerMachine.set(
                    task.requiredMachineId,
                    (workPerMachine.get(task.requiredMachineId) || 0) + time
                );
            }
        }

        for (const [machineId, totalWork] of workPerMachine) {
            const machine = data.plantConfig.machines.find(m => m.id === machineId);
            if (!machine) continue;
            // FIX: Fall back to quantity (legacy alias); guard NaN via Number.isFinite.
            const rawAvail = machine.availableUnits ?? machine.quantity;
            const available = Number.isFinite(rawAvail) ? rawAvail : 0;
            // How many stations would SALBP-2 need for these tasks?
            const stationsNeeded = effectiveSeconds > 0 ? Math.ceil(totalWork / effectiveSeconds) : 1;
            if (stationsNeeded > available && available > 0) {
                hasScarceResource = true;
                break;
            }
        }
    }

    const canUseIterative = !requiresMultiManning && !hasScarceResource && nominalSeconds > 0;

    if (canUseIterative) {
        // [STRATEGY 1]: ITERATIVE DEEPENING (Smart)
        // Try N=min, then N=min+1, until MaxCycle <= Takt. guarantees Global Minimum N.

        let lowerBoundN = nominalSeconds > 0 ? Math.ceil(totalWorkContent / nominalSeconds) : 1;

        // FIX: When sector affinity is enabled, minimum stations = at least one per distinct sector
        if (!data.meta.disableSectorAffinity) {
            const distinctSectors = new Set(data.tasks.filter(t => !t.isMachineInternal && t.sectorId).map(t => t.sectorId));
            lowerBoundN = Math.max(lowerBoundN, distinctSectors.size);
        }
        // Safety: Try up to N+50 or tasks count.
        const maxN = data.tasks.length;

        for (let n = lowerBoundN; n <= maxN; n++) {
            // Call SALBP-2 Engine (Smooth Flow) forcing 'n' stations
            const result = simulateBalanceType2(data, n, name, nominalSeconds);

            // Check Feasibility: Did it fit within Takt?
            // Tolerance is configurable: 1.05 = 5% overflow allowed, 1.0 = strict (pure SALBP)
            if (result.realCycleTime <= nominalSeconds * taktTolerance) {
                // SUCCESS: This is the minimum N.
                result.heuristicName = name; // UI Name
                result.technicalName = targetHeuristic; // Maintain requested technical label
                result.isRecommended = true; // Mark as optimized
                return result;
            }
        }
        // If we exit loop without success (unlikely), fall through to Greedy.
    }

    // [STRATEGY 3]: GREEDY ASSIGNMENT with RC-ALBP support
    // Delegates to extracted function for sorting, assignment loop, post-processing
    const greedyResult = runGreedyAssignment(data, targetHeuristic, nominalSeconds, effectiveSeconds, useRandomSelection);
    return calculateBalancingMetrics(greedyResult, data, name, targetHeuristic, nominalSeconds);
};

// =============================================================================
// Phase 5: SALBP-2 (SMOOTH FLOW) - Minimize Cycle Time Given N Operators
// =============================================================================

/**
 * SALBP-2 Balancing Algorithm (Type 2)
 * 
 * Given a FIXED number of stations/operators (N), distribute tasks to 
 * MINIMIZE the maximum station cycle time (smooth flow).
 * 
 * Algorithm:
 * 1. Calculate lower bound: LB = TotalWorkContent / N
 * 2. Sort tasks by RPW (same as SALBP-1)
 * 3. Try to fit all tasks with LB as limit
 * 4. If fails, use binary search to find minimum feasible cycle time
 * 5. Result: Even load distribution across exactly N stations
 * 
 * @param data - Project data with tasks and configuration
 * @param targetStations - Fixed number of stations/operators
 * @param name - Display name for the result
 * @param nominalSeconds - Nominal Takt Time (for reference only)
 * @returns SimulationResult with balanced assignments
 */
export function simulateBalanceType2(
    data: ProjectData,
    targetStations: number,
    name: string,
    nominalSeconds: number
): SimulationResult {
    // Input validation: empty tasks → empty result (prevents Math.max crash)
    if (!data.tasks || data.tasks.length === 0) {
        return createEmptySimulationResult(name, 'RPW', data.tasks || []);
    }

    // FIX: Guard against NaN/Infinity from corrupted targetStations input.
    // Math.floor(NaN) = NaN, and Math.max(1, NaN) = NaN, propagating through
    // all downstream calculations (lowerBound, theoreticalMin, binary search).
    const rawN = Math.floor(targetStations);
    const N = Number.isFinite(rawN) && rawN >= 1 ? rawN : 1;

    // 1. Calculate total work content
    const totalWorkContent = data.tasks.reduce((sum, t) => {
        if (t.isMachineInternal) return sum;
        const time = t.standardTime || t.averageTime || 0;
        // FIX v10.1: standardTime already includes fatigue
        return sum + time;
    }, 0);

    // Lower bound for cycle time
    const lowerBound = totalWorkContent / N;

    // Maximum task time (absolute floor for any station)
    const _taskTimesT2 = data.tasks.map(t => {
        if (t.isMachineInternal) return 0;
        // FIX v10.1: standardTime already includes fatigue
        return (t.standardTime || t.averageTime || 0);
    });
    const maxTaskTime = _taskTimesT2.length > 0 ? Math.max(..._taskTimesT2) : 0;

    // The actual minimum cycle time must be at least the largest task
    const theoreticalMin = Math.max(lowerBound, maxTaskTime);

    // 2. Sort tasks by RPW (Ranked Positional Weight)
    const sortedTasks = [...data.tasks].sort((a, b) => {
        if (Math.abs(b.positionalWeight - a.positionalWeight) > 0.01) {
            return b.positionalWeight - a.positionalWeight;
        }
        const timeA = a.standardTime || a.averageTime || 0;
        const timeB = b.standardTime || b.averageTime || 0;
        return timeB - timeA;
    });

    /**
     * Try to fit all tasks into N stations with given cycle limit
     * Returns null if not feasible, or the assignments if feasible
     */
    const tryFitWithLimit = (cycleLimit: number): Assignment[] | null => {
        const stations: { id: number; tasks: Task[]; time: number; sectorId?: string }[] = [];
        for (let i = 1; i <= N; i++) {
            stations.push({ id: i, tasks: [], time: 0 });
        }

        const unassigned = new Set(sortedTasks.map(t => t.id));
        const assigned: Assignment[] = [];
        // PERF: Map for O(1) precedence lookups instead of O(n) assigned.find()
        const assignmentMap = new Map<string, Assignment>();

        let iterations = 0;
        const MAX_ITER = sortedTasks.length * N * 2;

        while (unassigned.size > 0 && iterations < MAX_ITER) {
            iterations++;
            let madeProgress = false;

            // Find candidates respecting precedence
            const candidates = sortedTasks.filter(t =>
                unassigned.has(t.id) &&
                t.predecessors.every(pid => !unassigned.has(pid))
            );

            for (const task of candidates) {
                if (!unassigned.has(task.id)) continue;

                // PRECEDENCE FIX: Calculate minimum allowed station
                // Task must be assigned to station >= max(predecessor stations)
                let minAllowedStation = 1;
                for (const predId of task.predecessors) {
                    // PERF: Use Map for O(1) lookup instead of O(n) find
                    const predAssignment = assignmentMap.get(predId);
                    if (predAssignment && predAssignment.stationId > minAllowedStation) {
                        minAllowedStation = predAssignment.stationId;
                    }
                }

                // Find the best station that can fit this task
                // Sector affinity is a HARD constraint (unless disableSectorAffinity is true)
                const useSectorAffinity = !data.meta.disableSectorAffinity;

                // FIX: Find which station(s) contain this task's predecessors
                const predStationIds = new Set<number>();
                for (const predId of task.predecessors) {
                    // PERF: Use Map for O(1) lookup
                    const pa = assignmentMap.get(predId);
                    if (pa) predStationIds.add(pa.stationId);
                }

                // FIX: Use overlap-aware effective time for capacity check (not naive sum)
                // calculateEffectiveStationTime handles concurrent machine+manual groups via Math.max
                const eligibleStations = stations
                    .filter(st => {
                        if (st.id < minAllowedStation) return false;
                        if (useSectorAffinity && st.sectorId && st.sectorId !== task.sectorId) return false;
                        // Overlap-aware capacity check: actual effective time with this task added
                        const effectiveWithTask = task.isMachineInternal
                            ? st.time  // Internal tasks contribute 0 effective time
                            : calculateEffectiveStationTime([...st.tasks, task]);
                        return effectiveWithTask <= cycleLimit;
                    })
                    .sort((a, b) => {
                        // 1. Prefer station with predecessors (keeps chain together, preserves flexibility)
                        const aHasPred = predStationIds.has(a.id) ? 1 : 0;
                        const bHasPred = predStationIds.has(b.id) ? 1 : 0;
                        if (aHasPred !== bHasPred) return bHasPred - aHasPred;

                        // 2. Prefer stations that already have the same sector (fill before opening new)
                        if (useSectorAffinity) {
                            const aMatch = a.sectorId === task.sectorId ? 1 : 0;
                            const bMatch = b.sectorId === task.sectorId ? 1 : 0;
                            if (aMatch !== bMatch) return bMatch - aMatch;
                        }

                        // 3. Best-fit: prefer most-loaded station that still fits (reduces fragmentation)
                        return b.time - a.time;
                    });

                if (eligibleStations.length > 0) {
                    const target = eligibleStations[0];
                    target.tasks.push(task);
                    // FIX: Update time using overlap-aware calculation (not naive addition)
                    target.time = calculateEffectiveStationTime(target.tasks);
                    if (!target.sectorId) target.sectorId = task.sectorId;

                    const newAssignment = { taskId: task.id, stationId: target.id };
                    assigned.push(newAssignment);
                    assignmentMap.set(task.id, newAssignment);
                    unassigned.delete(task.id);
                    madeProgress = true;
                }
            }

            if (!madeProgress && unassigned.size > 0) {
                // Could not fit any more tasks - limit too small
                return null;
            }
        }

        if (unassigned.size > 0) {
            return null; // Failed to assign all
        }

        return assigned;
    };

    // 3. Binary search for minimum feasible cycle time
    let low = theoreticalMin;
    let high = totalWorkContent; // Worst case: all in one station
    let bestAssignments: Assignment[] | null = null;

    const EPSILON = 0.1; // 100ms precision

    while (high - low > EPSILON) {
        const mid = (low + high) / 2;
        const result = tryFitWithLimit(mid);

        if (result !== null) {
            bestAssignments = result;
            high = mid;
        } else {
            low = mid;
        }
    }

    // If binary search didn't find a solution, try with high (should always work)
    if (!bestAssignments) {
        bestAssignments = tryFitWithLimit(high) || [];
    }

    // 4. Build result structures
    const usedStationIds = Array.from(new Set(bestAssignments.map(a => a.stationId))).sort((a, b) => a - b);

    // PERF: Pre-build task lookup Map for result building
    const t2TaskMap = new Map(data.tasks.map(t => [t.id, t]));

    // FIX: Calculate effectiveTime for each station (was undefined before)
    const proposedConfigs: StationConfig[] = usedStationIds.map(stId => {
        const stTasks = bestAssignments!
            .filter(a => a.stationId === stId)
            .map(a => t2TaskMap.get(a.taskId))
            .filter(Boolean) as Task[];

        const stEffectiveTime = calculateEffectiveStationTime(stTasks);
        // FIX: Pass sectorId from tasks so calculateStationOEE uses sector OEE, not global fallback
        const representativeSectorId = stTasks[0]?.sectorId;

        return {
            id: stId,
            oeeTarget: calculateStationOEE(data, stId, representativeSectorId),
            replicas: 1,
            effectiveTime: stEffectiveTime  // FIX: Add effectiveTime
        };
    });

    // Calculate metrics
    const totalHeadcount = usedStationIds.length;
    let maxStationCycle = 0;
    let totalEffWork = 0;

    for (const stId of usedStationIds) {
        const stTasks = bestAssignments
            .filter(a => a.stationId === stId)
            .map(a => t2TaskMap.get(a.taskId))
            .filter(Boolean) as Task[];

        // Use concurrency-aware effective time (consistent with SALBP-1 metrics)
        const stTime = calculateEffectiveStationTime(stTasks);

        totalEffWork += stTime;
        if (stTime > maxStationCycle) maxStationCycle = stTime;
    }

    // Efficiency calculations (for SALBP-2, we show how smooth the flow is)
    const efficiency = nominalSeconds > 0 && maxStationCycle <= nominalSeconds
        ? 100
        : (maxStationCycle > 0 ? (nominalSeconds / maxStationCycle) * 100 : 0);

    // FIX: Check both operands individually to prevent 0*x=0 passing the guard
    // when totalHeadcount=0 but maxStationCycle>0, which would produce 0/0=NaN
    const lineEfficiency = totalHeadcount > 0 && maxStationCycle > 0
        ? Math.min(100, (totalEffWork / (totalHeadcount * maxStationCycle)) * 100)
        : 0;

    // FIX: Guard against maxStationCycle=0 (all machine-internal tasks)
    const idleTime = maxStationCycle > 0 && maxStationCycle <= nominalSeconds
        ? (totalHeadcount * nominalSeconds) - totalEffWork
        : 0;

    return {
        heuristicName: name,
        technicalName: 'RPW', // Using RPW for sorting, but algorithm is SALBP-2
        assignments: bestAssignments,
        proposedConfigs,
        stationsCount: usedStationIds.length,
        totalHeadcount,
        targetHeadcount: N, // Report back the constraint used
        efficiency,
        lineEfficiency,
        realCycleTime: maxStationCycle,
        idleTime,
        parallelStations: 0,
        sortedTasks
    };
};
