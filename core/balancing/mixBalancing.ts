/**
 * Mixed-Model Assembly Line Balancing (MMALBP) Engine
 * 
 * Implements Type-1 MMALBP: Minimize N (stations) given Takt Time
 * Based on expert consultation decisions for weighted time calculation
 * and combined precedence graph approach.
 * 
 * @module mixBalancing
 * @version 4.0.0
 */
import { Task, ProjectData, MixEnrichedProduct, MixScenario, MachineType } from '../../types';
import { simulateBalance, SimulationResult } from './engine';

// Extended task with mix-specific properties
interface MixTask extends Task {
    _multiProductTimes?: Array<{
        productId: string;
        time: number;
        demand: number;
    }>;
    _originalTimes?: Array<{ productId: string; time: number; demand: number }>;
    _weightedTime?: number;
    _isLowWeight?: boolean; // V4.1: Flag for Mizusumashi recommendation (< 15% Takt)
}

/**
 * Build combined precedence graph from multiple products
 * Union of all individual graphs, no cross-product dependencies
 * 
 * Per expert: "The graph is the UNION of individual product graphs.
 * NO cross-product dependencies - competition for shared resources
 * is resolved via weighted time, not precedences."
 * 
 * V4.2 Fix: Validate description match before merging to prevent
 * incorrect conflation of tasks with same ID but different operations.
 */
export function buildCombinedPrecedenceGraph(
    products: ProjectData[]
): { tasks: MixTask[]; conflicts: string[] } {
    const taskMap = new Map<string, MixTask>();
    const conflicts: string[] = [];

    for (const product of products) {
        const productId = product.meta?.name || product.id?.toString() || 'unknown';
        const productDemand = (product as MixEnrichedProduct)._mixDemand || 0;

        for (const task of product.tasks) {
            const existingTask = taskMap.get(task.id);

            if (existingTask) {
                // V4.2 FIX: Check if descriptions match before merging
                const descMatch = existingTask.description.toLowerCase().trim() ===
                    task.description.toLowerCase().trim();

                if (!descMatch) {
                    // Different operations with same ID - log conflict and use composite key
                    conflicts.push(
                        `[${productId}] Tarea ID "${task.id}" tiene descripción diferente: ` +
                        `"${task.description}" vs "${existingTask.description}" - Se tratará como tarea separada`
                    );

                    // Create with composite ID to avoid collision
                    const compositeId = `${task.id}__${productId}`;
                    const cloned: MixTask = {
                        ...task,
                        id: compositeId,
                        _multiProductTimes: [{
                            productId,
                            time: task.standardTime,
                            demand: productDemand
                        }]
                    };
                    taskMap.set(compositeId, cloned);
                    continue;
                }

                // Same task - merge with weighted time
                if (!existingTask._multiProductTimes) {
                    existingTask._multiProductTimes = [];
                }

                // Add this product's time contribution
                existingTask._multiProductTimes.push({
                    productId,
                    time: task.standardTime,
                    demand: productDemand
                });

                // Merge predecessors (union)
                const allPreds = new Set([...existingTask.predecessors, ...task.predecessors]);
                existingTask.predecessors = Array.from(allPreds);

                // Merge successors (union)
                const allSuccs = new Set([...existingTask.successors, ...task.successors]);
                existingTask.successors = Array.from(allSuccs);

            } else {
                // New task - clone with product reference
                const cloned: MixTask = {
                    ...task,
                    _multiProductTimes: [{
                        productId,
                        time: task.standardTime,
                        demand: productDemand
                    }]
                };
                taskMap.set(task.id, cloned);
            }
        }
    }

    return {
        tasks: Array.from(taskMap.values()),
        conflicts
    };
}

/**
 * Calculate weighted average time for each task based on mix percentages
 * 
 * Formula (per expert): T_weighted = Σ(T_model × %_mix)
 * 
 * V4.1: Added isLowWeight detection for Mizusumashi recommendation
 * Threshold: 15% of Takt Time (tasks below this are candidates for auxiliary roles)
 * 
 * Example:
 * - Product A: 45s, demand 600 (67%)
 * - Product B: 60s, demand 300 (33%)
 * - Weighted = (45 × 0.67) + (60 × 0.33) = 30.15 + 19.80 = 50s
 */

// V4.1: Threshold for low-weight task detection
export const MIN_SATURATION_THRESHOLD = 0.15; // 15% of Takt Time

/**
 * Calculate strict weighted average time for each task based on mix percentages.
 * Formula: T_weighted = Σ(T_model × %_mix)
 * 
 * V4.2 Update:
 * - Uses total demand to calculate exact percentages.
 * - Enforces 2 decimal precision.
 * - Identifies low-weight tasks relative to Takt (Mizusumashi candidates).
 */
export function calculateWeightedTimes(
    tasks: MixTask[],
    totalDemand: number, // Sum of daily demands for all products
    taktTime?: number
): MixTask[] {
    if (totalDemand <= 0) {
        // H-08 FIX: Use centralized logger
        logger.warn('MMALBP', 'Total demand is 0, cannot calculate weighted times');
        return tasks;
    }

    // V4.1: Low-weight threshold
    const lowWeightThreshold = taktTime ? taktTime * MIN_SATURATION_THRESHOLD : 0;

    return tasks.map(task => {
        const times = task._multiProductTimes;

        if (!times || times.length === 0) {
            // Task has no recorded times (should not happen in valid graph), treat as 0 or keep existing?
            // Safer to return as is if no mix data.
            return task;
        }

        // --- CORE MMALBP LOGIC: Weighted Average ---
        let weightedSum = 0;

        for (const entry of times) {
            // FIX: Guard against NaN in entry data (corrupted JSON, bad import)
            if (!Number.isFinite(entry.time) || !Number.isFinite(entry.demand)) {
                logger.warn('MMALBP', 'Non-finite entry in weighted calc, skipping', {
                    taskId: task.id,
                    time: entry.time,
                    demand: entry.demand
                });
                continue;
            }

            // Calculate percentage of this product in total mix
            const mixPercentage = entry.demand / totalDemand;

            // Contribution = Time * %Mix
            weightedSum += entry.time * mixPercentage;
        }

        // FIX: Guard against NaN propagation from corrupted upstream data
        if (!Number.isFinite(weightedSum)) {
            logger.error('MMALBP', 'Weighted sum is non-finite, using 0', {
                taskId: task.id, weightedSum
            });
            weightedSum = 0;
        }

        // Round to 2 decimals for UI clarity
        const finalWeightedTime = Math.round(weightedSum * 100) / 100;

        // V4.1: Detect low-weight tasks
        const isLowWeight = lowWeightThreshold > 0 && finalWeightedTime < lowWeightThreshold;

        return {
            ...task,
            standardTime: finalWeightedTime, // OVERWRITE standardTime for simulation
            _weightedTime: finalWeightedTime,
            _originalTimes: times,
            _isLowWeight: isLowWeight
        };
    });
}

/**
 * Generate recommended Heijunka sequence string
 * 
 * Per expert: "The average time is valid ONLY if the production
 * sequence mixes models correctly (e.g., A-A-B-A-A-B)"
 */
export function generateHeijunkaSequence(
    products: Array<{ name: string; demand: number }>
): { sequence: string; rationale: string } {
    if (products.length === 0) {
        return { sequence: '', rationale: 'No hay productos en el mix' };
    }

    if (products.length === 1) {
        return {
            sequence: `Lote ${products[0].name}`,
            rationale: 'Producción de un solo modelo - sin cambios necesarios'
        };
    }

    // V8.2: Per expert decision - Use BATCH production format instead of rapid interleaving
    // "The client operates by batches (campaigns of 'Only IP' or 'Only APC'),
    //  not rapid interleaving. The visual Heijunka box adds no value at this stage."

    // Sort by demand (higher demand first for typical campaign approach)
    const sorted = [...products].sort((a, b) => b.demand - a.demand);

    // Calculate percentages for rationale
    const totalDemand = products.reduce((sum, p) => sum + p.demand, 0);
    if (totalDemand <= 0) {
        return { sequence: '', rationale: 'Demanda total es 0 - no se puede generar secuencia' };
    }
    const percentages = sorted.map(p => ({
        name: p.name,
        percent: Math.round((p.demand / totalDemand) * 100)
    }));

    // Build batch sequence: "Lote A → Cambio → Lote B → Cambio → Lote C"
    const batchNames = sorted.map(p => {
        // Use first 3 chars of name for readability
        const shortName = p.name.length > 10
            ? p.name.substring(0, 8) + '...'
            : p.name;
        return `Lote ${shortName}`;
    });
    const sequence = batchNames.join(' → Cambio → ');

    // Build rationale with percentages
    const demandBreakdown = percentages
        .map(p => `${p.name} (${p.percent}%)`)
        .join(', ');
    const rationale = `Producción por lotes: ${demandBreakdown}. ` +
        `Agrupar producción por modelo para minimizar cambios de setup.`;

    return { sequence, rationale };
}

/**
 * Execute MMALBP balancing on combined product set
 * 
 * Per expert: "The objective is to MINIMIZE N (number of operators)
 * given a fixed Takt Time. This is MMALBP Type-1."
 */
export function balanceMixedModel(
    products: ProjectData[],
    scenario: MixScenario,
    nominalTaktTime: number,
    effectiveTaktTime: number,
    globalMachines?: MachineType[] // V4.1: Inject Global Assets for Validation
): {
    success: boolean;
    result?: SimulationResult;
    error?: string;
    heijunkaWarning?: { sequence: string; rationale: string };
    weightedTasks?: MixTask[];
} {
    try {
        // Validate inputs
        if (!products || products.length === 0) {
            return { success: false, error: 'No hay productos para balancear' };
        }

        if (scenario.totalDemand <= 0) {
            return { success: false, error: 'La demanda total debe ser mayor a 0' };
        }

        // 1. Build combined graph
        const { tasks: combinedTasks, conflicts } = buildCombinedPrecedenceGraph(products);

        if (conflicts.length > 0) {
            // H-08 FIX: Use centralized logger
            logger.warn('MMALBP', 'Conflicts detected in graph union', { conflicts });
        }

        // 2. Calculate weighted times
        const weightedTasks = calculateWeightedTimes(combinedTasks, scenario.totalDemand);

        // 3. Create synthetic ProjectData for balancing engine
        // Use first product as template for shifts, sectors, etc.
        const templateProduct = products[0];

        const syntheticProject: ProjectData = {
            meta: {
                name: `Mix: ${scenario.name}`,
                date: new Date().toISOString(),
                client: 'Mix',
                version: '4.0',
                engineer: scenario.createdBy || 'Sistema',
                activeShifts: templateProduct.meta?.activeShifts ?? 1,
                manualOEE: templateProduct.meta?.manualOEE ?? 0.85,
                useManualOEE: templateProduct.meta?.useManualOEE ?? true,
                dailyDemand: scenario.totalDemand,
                configuredStations: 0
            },
            shifts: templateProduct.shifts || [],
            sectors: templateProduct.sectors || [],
            tasks: weightedTasks,
            assignments: [],
            stationConfigs: [],
            // V4.2 FIX: Proper PlantConfig structure (no more 'as any')
            plantConfig: {
                version: 1,
                lastModified: Date.now(),
                machines: globalMachines || [],
                sectors: templateProduct.sectors || []
            }
        };

        // 4. Run standard balancing with weighted times
        // Using RPW heuristic as it typically gives good results
        const result = simulateBalance(
            syntheticProject,
            'RPW',
            `Mix: ${scenario.name}`,
            nominalTaktTime,
            effectiveTaktTime
        );

        // 5. Generate Heijunka warning if needed
        let heijunkaWarning: { sequence: string; rationale: string } | undefined;

        if (products.length > 1) {
            const productInfo = products.map(p => ({
                name: p.meta?.name || 'Producto',
                demand: (p as MixEnrichedProduct)._mixDemand || 0
            }));
            heijunkaWarning = generateHeijunkaSequence(productInfo);
        }

        return {
            success: true,
            result,
            heijunkaWarning,
            weightedTasks
        };

    } catch (e) {
        logger.error('MMALBP', 'Balancing error', { error: String(e) });
        return {
            success: false,
            error: `Error en balanceo: ${(e as Error).message}`
        };
    }
}

/**
 * Calculate product breakdown for a station
 * Used for stacked bar visualization
 */
export function calculateStationProductBreakdown(
    stationTasks: MixTask[],
    totalDemand: number
): Record<string, number> {
    const breakdown: Record<string, number> = {};
    if (totalDemand <= 0) return breakdown;

    for (const task of stationTasks) {
        const times = task._originalTimes || task._multiProductTimes;
        if (!times) continue;

        for (const entry of times) {
            const percentage = entry.demand / totalDemand;
            const contribution = entry.time * percentage;

            if (!breakdown[entry.productId]) {
                breakdown[entry.productId] = 0;
            }
            breakdown[entry.productId] += contribution;
        }
    }

    // Round values
    for (const key of Object.keys(breakdown)) {
        breakdown[key] = Math.round(breakdown[key] * 100) / 100;
    }

    return breakdown;
}

export function validateMixBalance(
    result: SimulationResult,
    taktTime: number
): {
    valid: boolean;
    warnings: string[];
    riskyStations: number[];
} {
    const warnings: string[] = [];
    const riskyStations: number[] = [];
    const SATURATION_THRESHOLD = 0.95;

    // Build task time lookup from sortedTasks
    const taskTimeMap = new Map<string, number>();
    for (const task of result.sortedTasks) {
        taskTimeMap.set(task.id, task.standardTime);
    }

    for (const config of result.proposedConfigs) {
        // Find assignments for this station and calculate total time
        const stationAssignments = result.assignments.filter(a => a.stationId === config.id);
        const totalTime = stationAssignments.reduce((sum, a) => {
            const taskTime = taskTimeMap.get(a.taskId) || 0;
            return sum + taskTime;
        }, 0);
        const saturation = taktTime > 0 ? totalTime / taktTime : 0;

        if (saturation > SATURATION_THRESHOLD) {
            riskyStations.push(config.id);
            warnings.push(
                `Estación ${config.id}: Saturación ${(saturation * 100).toFixed(0)}% - ` +
                `Riesgo de cuello de botella por variabilidad del mix`
            );
        }
    }

    return {
        valid: riskyStations.length === 0,
        warnings,
        riskyStations
    };
}

/**
 * V4.1 CRITICAL: Validate that NO individual model exceeds Takt Time
 * 
 * This catches the "hidden trap" where weighted average is OK but
 * specific models cause bottlenecks when they appear in sequence.
 * 
 * Example:
 * - Model A (Standard): 40s, 50% mix
 * - Model B (Lujo): 80s, 50% mix
 * - Weighted Average: 60s (OK if Takt = 61s)
 * - BUT Model B alone (80s) > Takt (61s) = BOTTLENECK!
 * 
 * @param tasks - Tasks with _multiProductTimes data
 * @param taktTime - Takt time in seconds
 * @param totalDemand - Total demand for percentage calculation
 * @returns Validation result with specific model alerts
 */
export interface ModelVariabilityAlert {
    modelId: string;
    modelName: string;
    taskId: string;
    taskDescription: string;
    modelTime: number;
    taktTime: number;
    excessSeconds: number;
    requiredCapacity: number; // How many resources needed
    severity: 'critical' | 'warning' | 'ok';
    message: string;
}

export function validateModelVariability(
    tasks: MixTask[],
    taktTime: number,
    _totalDemand: number
): {
    valid: boolean;
    alerts: ModelVariabilityAlert[];
    worstCase: { modelId: string; maxTime: number } | null;
} {
    if (taktTime <= 0) return { valid: false, alerts: [], worstCase: null };

    const alerts: ModelVariabilityAlert[] = [];
    let worstCase: { modelId: string; maxTime: number } | null = null;
    let maxModelTime = 0;

    for (const task of tasks) {
        const times = task._multiProductTimes || task._originalTimes;
        if (!times || times.length === 0) continue;

        for (const entry of times) {
            const modelTime = entry.time;
            const modelId = entry.productId;

            // Track worst case
            if (modelTime > maxModelTime) {
                maxModelTime = modelTime;
                worstCase = { modelId, maxTime: modelTime };
            }

            // Check if this model exceeds Takt
            if (modelTime > taktTime) {
                const excessSeconds = modelTime - taktTime;
                const requiredCapacity = modelTime / taktTime;

                alerts.push({
                    modelId,
                    modelName: modelId,
                    taskId: task.id,
                    taskDescription: task.description || task.id,
                    modelTime,
                    taktTime,
                    excessSeconds,
                    requiredCapacity,
                    severity: 'critical',
                    message: `🔴 BLOQUEO: "${modelId}" (${modelTime.toFixed(1)}s) excede Takt (${taktTime.toFixed(1)}s) por ${excessSeconds.toFixed(1)}s. ` +
                        `El promedio ponderado es engañoso. Se requieren ${requiredCapacity.toFixed(1)} recursos/máquinas.`
                });
            } else if (modelTime > taktTime * 0.90) {
                // Warning zone: 90-100% of Takt
                const utilizationPct = (modelTime / taktTime * 100).toFixed(0);

                alerts.push({
                    modelId,
                    modelName: modelId,
                    taskId: task.id,
                    taskDescription: task.description || task.id,
                    modelTime,
                    taktTime,
                    excessSeconds: 0,
                    requiredCapacity: modelTime / taktTime,
                    severity: 'warning',
                    message: `⚠️ AJUSTADO: "${modelId}" (${modelTime.toFixed(1)}s) ocupa ${utilizationPct}% del Takt. ` +
                        `Sin margen para variabilidad.`
                });
            }
        }
    }

    // Sort by severity (critical first) then by excess time
    alerts.sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (b.severity === 'critical' && a.severity !== 'critical') return 1;
        return b.excessSeconds - a.excessSeconds;
    });

    return {
        valid: alerts.filter(a => a.severity === 'critical').length === 0,
        alerts,
        worstCase
    };
}

/**
 * Combined validation: Weighted average + Model variability
 * Call this before accepting a Mix balance as valid
 */
export function validateMixComplete(
    result: SimulationResult,
    tasks: MixTask[],
    taktTime: number,
    totalDemand: number
): {
    valid: boolean;
    saturationWarnings: string[];
    modelAlerts: ModelVariabilityAlert[];
    riskyStations: number[];
    summary: string;
} {
    // 1. Standard saturation check
    const saturationResult = validateMixBalance(result, taktTime);

    // 2. Model variability check (the critical one!)
    const variabilityResult = validateModelVariability(tasks, taktTime, totalDemand);

    // 3. Combine results
    const valid = saturationResult.valid && variabilityResult.valid;

    // 4. Generate summary
    let summary = '';
    if (valid) {
        summary = '✅ Balanceo Mix válido. Ningún modelo excede el Takt Time.';
    } else {
        const criticalCount = variabilityResult.alerts.filter(a => a.severity === 'critical').length;
        if (criticalCount > 0) {
            summary = `🔴 BLOQUEO: ${criticalCount} modelo(s) exceden el Takt Time. ` +
                `Aunque el promedio ponderado parece OK, estos modelos causarán paros de línea cuando aparezcan.`;
        } else if (saturationResult.riskyStations.length > 0) {
            summary = `⚠️ RIESGO: ${saturationResult.riskyStations.length} estación(es) con saturación >95%. ` +
                `Posible cuello de botella por variabilidad.`;
        }
    }

    return {
        valid,
        saturationWarnings: saturationResult.warnings,
        modelAlerts: variabilityResult.alerts,
        riskyStations: saturationResult.riskyStations,
        summary
    };
}

// =============================================================================
// V8.2: PROCESS CONSTRAINT VALIDATION (Injection/Curing Hard Limits)
// =============================================================================

/**
 * Violation result when a process-constrained task exceeds Takt Time.
 * These tasks have FIXED times (chemical/physical) that cannot be reduced by operators.
 */
export interface ProcessConstraintViolation {
    taskId: string;
    taskDescription: string;
    processTime: number;          // The fixed process time (cannot be reduced)
    taktTime: number;
    requiredMachines: number;     // ceil(processTime / takt)
    availableMachines: number;    // From plantConfig or default 1
    deficit: number;              // requiredMachines - availableMachines
    message: string;              // User-friendly message
}

/**
 * V8.2 CRITICAL: Validate tasks with isProcessConstraint flag
 * 
 * Per expert: "If presented software recommends 'add operator' for a chemical
 * curing time, it loses all technical credibility immediately."
 * 
 * This function MUST be called before accepting a Mix balance result.
 * It prevents the system from recommending operators for tasks that 
 * can only be solved with additional machines/molds.
 * 
 * @param tasks - All tasks from loaded products
 * @param taktTime - Calculated Takt Time in seconds
 * @param plantConfig - Optional plant configuration with machine inventory
 * @returns Validation result with any fatal violations
 */
export function validateProcessConstraints(
    tasks: Task[],
    taktTime: number,
    plantConfig?: PlantConfig
): {
    valid: boolean;
    violations: ProcessConstraintViolation[];
    fatalMessage: string | null;
} {
    const violations: ProcessConstraintViolation[] = [];

    // Guard: taktTime must be positive for constraint validation
    if (taktTime <= 0) {
        return { valid: false, violations: [], fatalMessage: 'Takt Time invalido (debe ser > 0). Revise turnos y demanda.' };
    }

    // Filter tasks with process constraints
    const constrainedTasks = tasks.filter(t => t.isProcessConstraint === true);

    if (constrainedTasks.length === 0) {
        return { valid: true, violations: [], fatalMessage: null };
    }

    for (const task of constrainedTasks) {
        const processTime = task.standardTime;

        // Check if process time exceeds Takt
        if (processTime > taktTime) {
            // Calculate required machines: N = ceil(processTime / Takt)
            const requiredMachines = Math.ceil(processTime / taktTime);

            // Get available machines from plantConfig
            let availableMachines = 1; // Default: assume 1 exists
            if (plantConfig?.machines && task.requiredMachineId) {
                const machineConfig = plantConfig.machines.find(
                    m => m.id === task.requiredMachineId
                );
                if (machineConfig) {
                    // FIX: Guard NaN — nullish coalescing doesn't catch NaN
                    const rawUnits = machineConfig.availableUnits ?? machineConfig.quantity;
                    availableMachines = Number.isFinite(rawUnits) ? rawUnits : 1;
                }
            }

            const deficit = requiredMachines - availableMachines;

            violations.push({
                taskId: task.id,
                taskDescription: task.description || task.id,
                processTime,
                taktTime,
                requiredMachines,
                availableMachines,
                deficit: Math.max(0, deficit),
                message: `🔴 RESTRICCIÓN DE PROCESO: "${task.description}" (${processTime.toFixed(1)}s) ` +
                    `excede Takt (${taktTime.toFixed(1)}s). ` +
                    `Se requieren ${requiredMachines} máquinas/moldes, NO más operarios.` +
                    (deficit > 0 ? ` Déficit actual: ${deficit} unidades.` : '')
            });
        }
    }

    // Generate fatal message if there are violations with deficits
    const fatalViolations = violations.filter(v => v.deficit > 0);
    let fatalMessage: string | null = null;

    if (fatalViolations.length > 0) {
        const totalDeficit = fatalViolations.reduce((sum, v) => sum + v.deficit, 0);
        fatalMessage = `🚨 BLOQUEO DE PROCESO: ${fatalViolations.length} tarea(s) de inyección/curado ` +
            `exceden el Takt Time. Se requieren ${totalDeficit} máquina(s)/molde(s) adicionales. ` +
            `Agregar operarios NO resuelve este problema.`;
    }

    return {
        valid: violations.length === 0,
        violations,
        fatalMessage
    };
}

// =============================================================================
// V4.2: SECTOR-BASED ANALYSIS FOR UX
// =============================================================================

import {
    MixSectorAnalysis,
    SectorRequirement,
    MachineRequirement,
    PlantConfig,
    ParallelStationAlert
} from '../../types';
import { PRODUCT_COLORS } from '../../utils/constants';
import { logger } from '../../utils/logger';

/**
 * Analyze mix balance results grouped by Sector → Machine → Product
 * This provides the data structure needed for the intuitive plant-floor UI
 */
export function analyzeMixBySector(
    result: SimulationResult,
    products: Array<{ path: string; demand: number; name?: string }>,
    taktTime: number,
    plantConfig?: PlantConfig,
    efficiencyFactor: number = 0.85
): MixSectorAnalysis {
    try {
        const totalDemand = products.reduce((sum, p) => sum + p.demand, 0);

        // Guard: zero demand means no analysis possible
        if (totalDemand <= 0) {
            return {
                sectors: [],
                totalPuestos: 0,
                totalOperators: result.totalHeadcount,
                hasAnyDeficit: false,
                taktTime,
                totalDemand: 0
            };
        }

        const sectorsMap = new Map<string, SectorRequirement>();
        const machinesMap = new Map<string, MachineRequirement>();

        // Get sector info from plantConfig or create defaults
        const getSectorInfo = (sectorId?: string): { id: string; name: string; color: string } => {
            if (!sectorId) return { id: 'MANUAL', name: 'Manual', color: '#6B7280' };
            const sector = plantConfig?.sectors.find(s => s.id === sectorId);
            return sector
                ? { id: sector.id, name: sector.name, color: sector.color }
                : { id: sectorId, name: sectorId, color: '#6B7280' };
        };

        // Get machine info from plantConfig
        const getMachineInfo = (machineId?: string): { id: string; name: string; available: number } => {
            if (!machineId) return { id: 'MANUAL', name: 'Manual', available: 999 };
            const machine = plantConfig?.machines.find(m => m.id === machineId);
            if (machine) {
                // FIX: Guard NaN — nullish coalescing doesn't catch NaN
                const rawUnits = machine.availableUnits ?? machine.quantity;
                return { id: machine.id, name: machine.name, available: Number.isFinite(rawUnits) ? rawUnits : 1 };
            }
            return { id: machineId, name: machineId, available: 999 };
        };

        // Process each task in the result
        for (const task of result.sortedTasks) {
            const sectorInfo = getSectorInfo(task.sectorId);
            const machineInfo = getMachineInfo(task.requiredMachineId);

            // Ensure sector exists in map
            if (!sectorsMap.has(sectorInfo.id)) {
                sectorsMap.set(sectorInfo.id, {
                    sectorId: sectorInfo.id,
                    sectorName: sectorInfo.name,
                    sectorColor: sectorInfo.color,
                    totalPuestos: 0,
                    machines: [],
                    manualOperators: 0
                });
            }

            const machineKey = `${sectorInfo.id}:${machineInfo.id}`;

            // Ensure machine exists in map
            if (!machinesMap.has(machineKey)) {
                machinesMap.set(machineKey, {
                    machineId: machineInfo.id,
                    machineName: machineInfo.name,
                    unitsRequired: 0,
                    unitsAvailable: machineInfo.available,
                    hasDeficit: false,
                    totalWeightedTime: 0,
                    saturationPerUnit: 0,
                    productBreakdown: [],
                    taskDescriptions: []
                });
            }

            const machine = machinesMap.get(machineKey)!;

            // Add task to machine
            machine.totalWeightedTime += task.standardTime;
            if (!machine.taskDescriptions.includes(task.description)) {
                machine.taskDescriptions.push(task.description);
            }

            // Calculate product breakdown from _multiProductTimes if available
            const mixTask = task as MixTask;
            if (mixTask._multiProductTimes && mixTask._multiProductTimes.length > 0) {
                for (const mpt of mixTask._multiProductTimes) {
                    const productInfo = products.find(p => p.path === mpt.productId || p.name === mpt.productId);
                    const productIdx = products.findIndex(p => p.path === mpt.productId || p.name === mpt.productId);
                    const weightedContribution = mpt.time * (mpt.demand / totalDemand);

                    // Find or create product contribution entry
                    let contrib = machine.productBreakdown.find(c => c.productPath === mpt.productId);
                    if (!contrib) {
                        // FIX: findIndex returns -1 when not found; -1 % N = -1 in JS → undefined color
                        const safeIdx = productIdx >= 0 ? productIdx : 0;
                        contrib = {
                            productPath: mpt.productId,
                            productName: productInfo?.name || mpt.productId.split(/[\\/]/).pop() || mpt.productId,
                            color: PRODUCT_COLORS[safeIdx % PRODUCT_COLORS.length],
                            timeContribution: 0,
                            percentageOfTotal: 0
                        };
                        machine.productBreakdown.push(contrib);
                    }
                    contrib.timeContribution += weightedContribution;
                }
            }
        }

        // Finalize calculations for each machine
        for (const [machineKey, machine] of machinesMap) {
            const sectorId = machineKey.split(':')[0];
            const sector = sectorsMap.get(sectorId)!;

            // V4.5 FIX: Apply Variable Efficiency Factor (OBE)
            // Passed from UI: 1.0 (Theoretical) or 0.85 (Real)
            // Clamp to valid range to prevent division by zero or nonsensical values
            const OBE = Math.max(0.01, Math.min(1.0, efficiencyFactor));

            // ── CAPACITY PLANNING ─────────────────────────────────────────
            // OBE goes in the denominator HERE to inflate machine count,
            // absorbing real-world losses (micro-stops, fatigue, changeovers).
            // Formula: unitsRequired = ceil(weightedTime / (takt × OBE))
            // Source: Krajewski capacity cushion model, AIAG capacity analysis.
            machine.unitsRequired = machine.totalWeightedTime > 0 && taktTime > 0
                ? Math.ceil(machine.totalWeightedTime / (taktTime * OBE))
                : 0;

            // ── SATURATION REPORTING ──────────────────────────────────────
            // IMPORTANT: Saturation is measured against NOMINAL takt (without OBE).
            // This is the automotive industry standard (Toyota Yamazumi charts,
            // Lean Enterprise Institute OBC, AIAG/VDA capacity planning).
            //
            // Rationale: A well-balanced line with OBE=0.85 should show ~85%
            // saturation, making the 15% efficiency buffer VISIBLE to the user.
            // If we divided by (takt × OBE), saturation would always show ~100%
            // for balanced lines, hiding the buffer and providing no diagnostic value.
            //
            // UI color thresholds reflect this:
            //   Green  < 85%  → healthy margin
            //   Amber  85-95% → tight but viable
            //   Red    >= 95% → no margin, risk of missed takt
            //
            // DO NOT add OBE to this denominator.
            if (machine.unitsRequired > 0 && taktTime > 0) {
                machine.saturationPerUnit = (machine.totalWeightedTime / (machine.unitsRequired * taktTime)) * 100;
            }

            // Check for deficit
            machine.hasDeficit = machine.unitsRequired > machine.unitsAvailable;

            // Calculate percentages for product breakdown
            const totalContribution = machine.productBreakdown.reduce((sum, c) => sum + c.timeContribution, 0);
            for (const contrib of machine.productBreakdown) {
                contrib.percentageOfTotal = totalContribution > 0
                    ? (contrib.timeContribution / totalContribution) * 100
                    : 0;
            }

            // Add to sector
            if (machine.machineId === 'MANUAL') {
                sector.manualOperators += machine.unitsRequired;
            } else {
                sector.machines.push(machine);
            }
            sector.totalPuestos += machine.unitsRequired;
        }

        // Build final result
        const sectors = Array.from(sectorsMap.values()).filter(s => s.totalPuestos > 0);
        const totalPuestos = sectors.reduce((sum, s) => sum + s.totalPuestos, 0);
        const hasAnyDeficit = sectors.some(s => s.machines.some(m => m.hasDeficit));

        return {
            sectors,
            totalPuestos,
            totalOperators: result.totalHeadcount,
            hasAnyDeficit,
            taktTime,
            totalDemand
        };
    } catch (e) {
        // V4.2 FIX: Graceful error handling
        logger.error('analyzeMixBySector', 'Analysis failed', { error: String(e) });
        return {
            sectors: [],
            totalPuestos: 0,
            totalOperators: result.totalHeadcount,
            hasAnyDeficit: false,
            taktTime,
            totalDemand: products.reduce((sum, p) => sum + p.demand, 0)
        };
    }
}

/**
 * V4.3: Detect tasks that require parallel stations
 * These are tasks where a single workstation cannot meet the Takt,
 * requiring 2+ operators/machines working in parallel.
 * 
 * @param products Loaded product data with tasks
 * @param taktTime Calculated Takt Time in seconds
 * @returns Array of alerts for tasks requiring parallel stations
 */
export function detectParallelStationNeeds(
    products: ProjectData[],
    taktTime: number
): ParallelStationAlert[] {
    if (taktTime <= 0) return [];
    const alerts: ParallelStationAlert[] = [];

    for (const product of products) {
        const productName = product.meta?.name || 'Producto';

        for (const task of product.tasks) {
            const parallelNeeded = Math.ceil(task.standardTime / taktTime);

            // Only alert if task requires 2+ parallel stations
            if (parallelNeeded >= 2) {
                alerts.push({
                    productName,
                    taskId: task.id,
                    taskDescription: task.description,
                    taskTime: task.standardTime,
                    taktTime,
                    parallelStationsNeeded: parallelNeeded
                });
            }
        }
    }

    // Sort by parallel stations needed (highest first)
    alerts.sort((a, b) => b.parallelStationsNeeded - a.parallelStationsNeeded);

    return alerts;
}

// Backward compatibility alias
export const detectTaktViolations = detectParallelStationNeeds;
