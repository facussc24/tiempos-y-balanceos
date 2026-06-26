/**
* Phase 29: Genetic Algorithm for Line Balancing Optimization
* Phase 30: GALBP - Added Zone and Resource Constraints
* 
* This module implements a GA that optimizes task sequencing for line balancing.
* The GA doesn't assign stations directly - it generates task orderings that
* are evaluated by the existing multi-resource engine.
* 
* Chromosome: Array of task IDs representing a valid topological order
* Fitness: (Stations × 1000) + SmoothnessIndex + ZonePenalty + ResourcePenalty
*/

import { Task, ProjectData, MachineType, ZoningConstraint } from '../../types';
import { simulateBalance, SimulationResult } from './engine';
import { logger } from '../../utils/logger';


// =============================================================================
// Types
// =============================================================================

/** Chromosome = permutation of task IDs respecting precedences */
export type Chromosome = string[];

/** Configuration for the Genetic Algorithm */
export interface GAConfig {
    populationSize: number;     // Default: 50
    generations: number;        // Default: 100
    mutationRate: number;       // Default: 0.01 (1%)
    eliteCount: number;         // Default: 2 (best solutions carried over)
    crossoverRate: number;      // Default: 0.8 (80%)
    onProgress?: (generation: number, totalGenerations: number, bestFitness: number) => void;
    machines?: MachineType[];   // Phase 30: Machine inventory for GALBP validation
    signal?: AbortSignal;       // Optional cancellation signal (used by the async runner)
}

/** Result from the Genetic Algorithm */
export interface GAResult {
    bestSequence: Chromosome;
    bestFitness: number;
    bestResult: SimulationResult;
    alternativeResults: SimulationResult[]; // Top distinct alternatives from final population
    generations: number;
    populationSize: number;
    cancelled?: boolean; // True if the async runner was aborted before finishing all generations
    improvementVsGreedy?: {
        stationsSaved: number;
        headcountSaved: number;
        efficiencyGain: number;
    };
}

/** Individual in the population */
interface Individual {
    chromosome: Chromosome;
    fitness: number;
    result?: SimulationResult;
}

// =============================================================================
// Chromosome Generation (Topological Sort with Randomization)
// =============================================================================

/**
 * Generate a valid task sequence respecting precedence constraints.
 * Uses Kahn's algorithm with random selection among available tasks.
 */
export const generateValidSequence = (tasks: Task[]): Chromosome => {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // Initialize in-degree and adjacency list
    for (const task of tasks) {
        inDegree.set(task.id, task.predecessors.length);
        if (!adjList.has(task.id)) adjList.set(task.id, []);

        for (const pred of task.predecessors) {
            if (!adjList.has(pred)) adjList.set(pred, []);
            adjList.get(pred)!.push(task.id);
        }
    }

    // Find all tasks with no predecessors
    const available: string[] = [];
    for (const task of tasks) {
        if (inDegree.get(task.id) === 0) {
            available.push(task.id);
        }
    }

    const sequence: Chromosome = [];

    // Kahn's algorithm with random selection
    while (available.length > 0) {
        // Randomly select from available tasks
        const randomIndex = Math.floor(Math.random() * available.length);
        const selected = available.splice(randomIndex, 1)[0];
        sequence.push(selected);

        // Update successors
        const successors = adjList.get(selected) || [];
        for (const succ of successors) {
            const newDegree = (inDegree.get(succ) || 1) - 1;
            inDegree.set(succ, newDegree);
            if (newDegree === 0) {
                available.push(succ);
            }
        }
    }

    return sequence;
};

/**
 * Check if a sequence is valid (respects all precedences)
 */
export const isValidSequence = (sequence: Chromosome, tasks: Task[]): boolean => {
    const positionMap = new Map(sequence.map((id, idx) => [id, idx]));
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    for (const taskId of sequence) {
        const task = taskMap.get(taskId);
        if (!task) continue;

        const taskPos = positionMap.get(taskId)!;
        for (const predId of task.predecessors) {
            const predPos = positionMap.get(predId);
            if (predPos === undefined || predPos >= taskPos) {
                return false; // Predecessor must come before task
            }
        }
    }

    return true;
};

// =============================================================================
// Fitness Evaluation
// =============================================================================

/**
 * Indice de Suavidad (Smoothness Index) - Moodie & Young (1965)
 *
 * Formula: SI = sqrt( sum( (C_max - ST_i)^2 ) )
 * Donde C_max = tiempo de la estacion mas cargada (cuello de botella)
 * y ST_i = tiempo efectivo de cada estacion.
 *
 * Un valor de 0 indica una linea perfectamente balanceada.
 * Valores mas altos indican mayor desbalance (mas tiempo desperdiciado).
 *
 * Ref: Moodie, C.L. & Young, H.H. (1965), "A Heuristic Method of
 * Assembly Line Balancing", Journal of Industrial Engineering, 16(1).
 */
const calculateSmoothnessIndex = (result: SimulationResult): number => {
    if (result.proposedConfigs.length === 0) return 0;

    const loads = result.proposedConfigs.map(c => c.effectiveTime || 0);
    const maxLoad = Math.max(...loads);
    const sumSquares = loads.reduce((sum, val) => sum + Math.pow(maxLoad - val, 2), 0);

    return Math.sqrt(sumSquares);
};

/**
 * Phase 30: GALBP Zone Penalty Calculation
 * Penalizes solutions that violate zone constraints (e.g., mixing oven tasks with packaging).
 * 
 * DESIGN RATIONALE:
 * We use a very high penalty (1M+) because zone violations are typically hard constraints
 * in physical plant layouts. This forces the GA to prioritize valid zone groupings
 * even over station count minimization.
 * 
 * @param result - Simulation result with assignments
 * @param taskMap - Map of task IDs to Task objects
 * @param sectors - Available sectors for validation
 * @returns Penalty score (0 = no violations, 1M+ = violations)
 */
const calculateZonePenalty = (
    result: SimulationResult,
    taskMap: Map<string, Task>,
    sectors: { id: string; name: string }[]
): number => {
    if (sectors.length === 0) return 0;

    let penalty = 0;

    // Group assignments by station to detect zone conflicts
    const stationTasks = new Map<number, string[]>();
    for (const assignment of result.assignments) {
        const tasks = stationTasks.get(assignment.stationId) || [];
        tasks.push(assignment.taskId);
        stationTasks.set(assignment.stationId, tasks);
    }

    // Check each station for zone homogeneity
    for (const [_stationId, taskIds] of stationTasks) {
        const zonesInStation = new Set<string>();

        for (const taskId of taskIds) {
            const task = taskMap.get(taskId);
            if (task?.sectorId) {
                zonesInStation.add(task.sectorId);
            }
        }

        // If station has tasks from multiple zones, heavy penalty
        if (zonesInStation.size > 1) {
            penalty += 1_000_000 * (zonesInStation.size - 1);
        }
    }

    return penalty;
};

/**
 * Phase 30: GALBP Resource Conflict Penalty
 * Penalizes when a limited resource (e.g., a specific machine) is required by tasks 
 * assigned to more stations than units available in the inventory.
 * 
 * DESIGN RATIONALE:
 * Penalty of 500K is lower than Zone Penalty (1M) but high enough to steer
 * the evolution. It allows the GA to "tolerate" resource conflicts temporarily
 * if it leads to a significantly better station count, though valid solutions
 * will always eventually win.
 * 
 * @param result - Simulation result with assignments
 * @param taskMap - Map of task IDs to Task objects
 * @param machineInventory - Map of machineId -> available units (from MachineType)
 * @returns Penalty score (0 = no conflicts, 500K+ = conflicts)
 */
const calculateResourceConflictPenalty = (
    result: SimulationResult,
    taskMap: Map<string, Task>,
    machineInventory: Map<string, number>
): number => {
    if (machineInventory.size === 0) return 0;

    // Track which machines are used in which stations
    const machineToStations = new Map<string, Set<number>>();

    for (const assignment of result.assignments) {
        const task = taskMap.get(assignment.taskId);
        if (task?.requiredMachineId) {
            const stations = machineToStations.get(task.requiredMachineId) || new Set();
            stations.add(assignment.stationId);
            machineToStations.set(task.requiredMachineId, stations);
        }
    }

    let penalty = 0;

    // Check for single-unit machines used in multiple stations
    for (const [machineId, stations] of machineToStations) {
        const available = machineInventory.get(machineId) || 1;

        // If we need more stations than available machines, penalize
        if (stations.size > available) {
            penalty += 500_000 * (stations.size - available);
        }
    }

    return penalty;
};

// =============================================================================
// FIX 3: HARD CONSTRAINT VALIDATION for Zoning
// =============================================================================

/**
 * FIX 3: Validate zoning constraints as HARD rules.
 * 
 * Unlike soft penalties that allow the GA to explore invalid solutions,
 * hard constraints return violations that cause the solution to be rejected entirely.
 * 
 * @param result - Simulation result with assignments
 * @param constraints - Array of zoning constraints to validate
 * @returns Object with valid flag and list of violations (empty if valid)
 */
const validateZoningConstraints = (
    result: SimulationResult,
    constraints: ZoningConstraint[]
): { valid: boolean; violations: string[] } => {
    if (!constraints || constraints.length === 0) {
        return { valid: true, violations: [] };
    }

    const violations: string[] = [];

    // Build map of taskId -> stationId for O(1) lookups
    const taskToStation = new Map<string, number>();
    for (const assignment of result.assignments) {
        taskToStation.set(assignment.taskId, assignment.stationId);
    }

    for (const constraint of constraints) {
        const stationA = taskToStation.get(constraint.taskA);
        const stationB = taskToStation.get(constraint.taskB);

        // If either task is not assigned yet, skip (partial solution)
        if (stationA === undefined || stationB === undefined) {
            continue;
        }

        if (constraint.type === 'must_include') {
            // MUST be in the same station
            if (stationA !== stationB) {
                violations.push(
                    `MUST-INCLUDE violado: "${constraint.taskA}" (Est.${stationA}) y "${constraint.taskB}" (Est.${stationB}) deben estar juntas` +
                    (constraint.reason ? ` - ${constraint.reason}` : '')
                );
            }
        } else if (constraint.type === 'must_exclude') {
            // MUST NOT be in the same station
            if (stationA === stationB) {
                violations.push(
                    `MUST-EXCLUDE violado: "${constraint.taskA}" y "${constraint.taskB}" están en Est.${stationA} pero no pueden estar juntas` +
                    (constraint.reason ? ` - ${constraint.reason}` : '')
                );
            }
        }
    }

    return {
        valid: violations.length === 0,
        violations
    };
};

/**

 * Lower fitness = better solution.
 * 
 * THE BRIDGE BETWEEN GA AND ENGINE:
 * The GA generates a "Sequence" (topological order). To evaluate it, we map this 
 * sequence to 'positionalWeight' values: the first task in the sequence gets the 
 * highest weight, and the last gets the lowest. 
 * 
 * When the simulateBalance engine runs with the 'RPW' (Ranked Positional Weight) 
 * heuristic, it will naturally follow this sequence because we've engineered the 
 * weights to mirror the chromosome's order.
 * 
 * FITNESS COMPONENTS (Weights):
 * - Stations Count (1000x): The primary objective. Reducing 1 station is always better than any smoothing gain.
 * - Headcount (100x): The secondary objective for Multi-Manning scenarios.
 * - Smoothness (1x): Tier-breaker for equal station counts.
 * - Penalties: Multi-million weights to prevent hard-constraint violations (Zones/Resources).
 */
export const evaluateFitness = (
    chromosome: Chromosome,
    data: ProjectData,
    nominalSeconds: number,
    effectiveSeconds: number,
    machineInventory: Map<string, number> = new Map()
): { fitness: number; result: SimulationResult } => {
    // Reorder tasks according to chromosome sequence
    const taskMap = new Map(data.tasks.map(t => [t.id, t]));
    const orderedTasks = chromosome
        .map(id => taskMap.get(id))
        .filter((t): t is Task => t !== undefined);

    // Update positional weights based on sequence position
    // Higher position = higher priority (processed first)
    const reweightedTasks = orderedTasks.map((task, idx) => ({
        ...task,
        positionalWeight: (orderedTasks.length - idx) * 100 // Reverse order: first = highest weight
    }));

    const orderedData: ProjectData = {
        ...data,
        tasks: reweightedTasks
    };

    // Run the multi-resource engine
    const result = simulateBalance(
        orderedData,
        'RPW',
        'GA-Eval',
        nominalSeconds,
        effectiveSeconds
    );

    // Calculate base fitness (lower is better)
    const smoothness = calculateSmoothnessIndex(result);
    let fitness = (result.stationsCount * 1000) + (result.totalHeadcount * 100) + smoothness;

    // Phase 30: Add GALBP penalties (soft constraints)
    const zonePenalty = calculateZonePenalty(result, taskMap, data.sectors || []);
    const resourcePenalty = calculateResourceConflictPenalty(result, taskMap, machineInventory);

    fitness += zonePenalty + resourcePenalty;

    // ==========================================================================
    // FIX 3: HARD CONSTRAINT VALIDATION
    // Zoning constraints (must-include/must-exclude) are HARD - violations mean
    // the solution is completely invalid. Return Infinity to reject it entirely.
    // ==========================================================================
    const zoningValidation = validateZoningConstraints(result, data.zoningConstraints || []);
    if (!zoningValidation.valid) {
        // Log violations for debugging (in development)
        if (process.env.NODE_ENV === 'development') {
            logger.warn('GA', 'Solution rejected - zoning violations', { violations: zoningValidation.violations });
        }
        return { fitness: Infinity, result };
    }

    return { fitness, result };
};


// =============================================================================
// Selection
// =============================================================================

/**
 * Tournament selection: pick 2 random individuals, return the better one
 */
const tournamentSelect = (population: Individual[]): Individual => {
    const idx1 = Math.floor(Math.random() * population.length);
    let idx2 = Math.floor(Math.random() * population.length);
    while (idx2 === idx1 && population.length > 1) {
        idx2 = Math.floor(Math.random() * population.length);
    }

    return population[idx1].fitness <= population[idx2].fitness
        ? population[idx1]
        : population[idx2];
};

// =============================================================================
// Crossover (Order Crossover with Repair)
// =============================================================================

/**
 * Order Crossover (OX) - Genetic operator for permutation-based chromosomes.
 * 1. Picks a random segment from Parent 1.
 * 2. Tasks in this segment are placed in the same positions in the child.
 * 3. The remaining positions are filled using tasks from Parent 2 in their 
 *    original relative order, skipping tasks already in the segment.
 * 
 * WHY OX?: OX preserves the relative order of tasks, which is crucial for 
 * maintaining sequences that might yield good line balances.
 */
const orderCrossover = (parent1: Chromosome, parent2: Chromosome, tasks: Task[]): Chromosome => {
    const len = parent1.length;
    if (len < 3) return [...parent1];

    // Select random crossover points
    let start = Math.floor(Math.random() * len);
    let end = Math.floor(Math.random() * len);
    if (start > end) [start, end] = [end, start];

    // Take segment from parent1
    const segment = parent1.slice(start, end + 1);
    const segmentSet = new Set(segment);

    // Fill rest from parent2 in order
    const remaining = parent2.filter(id => !segmentSet.has(id));

    // Build child
    const child: Chromosome = [];
    let remainingIdx = 0;

    for (let i = 0; i < len; i++) {
        if (i >= start && i <= end) {
            child.push(segment[i - start]);
        } else {
            child.push(remaining[remainingIdx++]);
        }
    }

    // Repair if invalid
    if (!isValidSequence(child, tasks)) {
        return repairChromosome(child, tasks);
    }

    return child;
};

/**
 * Repair an invalid chromosome by resorting it to respect precedence constraints.
 * 
 * Crossover and Mutation can occasionally create sequences that violate 
 * topological order (a task appearing before its predecessor).
 * 
 * This repair function performs a Topological Sort but uses the child's
 * current (invalid) order as a "preference" tie-breaker. This minimizes
 * how much we change the genetic material during repair.
 */
const repairChromosome = (chromosome: Chromosome, tasks: Task[]): Chromosome => {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const inChromosome = new Set(chromosome);

    // Use topological sort to create valid order
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    for (const taskId of chromosome) {
        const task = taskMap.get(taskId);
        if (!task) continue;

        // Only count predecessors that are in the chromosome
        const validPreds = task.predecessors.filter(p => inChromosome.has(p));
        inDegree.set(taskId, validPreds.length);

        if (!adjList.has(taskId)) adjList.set(taskId, []);
        for (const pred of validPreds) {
            if (!adjList.has(pred)) adjList.set(pred, []);
            adjList.get(pred)!.push(taskId);
        }
    }

    // Prioritize based on original chromosome order
    const originalOrder = new Map(chromosome.map((id, idx) => [id, idx]));

    const available: string[] = [];
    for (const taskId of chromosome) {
        if (inDegree.get(taskId) === 0) {
            available.push(taskId);
        }
    }

    const repaired: Chromosome = [];

    while (available.length > 0) {
        // Sort by original order preference
        available.sort((a, b) => (originalOrder.get(a) || 0) - (originalOrder.get(b) || 0));

        const selected = available.shift()!;
        repaired.push(selected);

        const successors = adjList.get(selected) || [];
        for (const succ of successors) {
            const newDegree = (inDegree.get(succ) || 1) - 1;
            inDegree.set(succ, newDegree);
            if (newDegree === 0) {
                available.push(succ);
            }
        }
    }

    return repaired;
};

// =============================================================================
// Mutation (Swap with Precedence Check)
// =============================================================================

/**
 * Swap mutation: swap two random tasks if the swap doesn't violate precedences
 */
const mutateSwap = (chromosome: Chromosome, tasks: Task[], mutationRate: number): Chromosome => {
    if (Math.random() > mutationRate) return chromosome;

    const mutated = [...chromosome];
    const len = mutated.length;
    if (len < 2) return mutated;

    // Try a few swaps until we find a valid one
    for (let attempt = 0; attempt < 10; attempt++) {
        const i = Math.floor(Math.random() * len);
        const j = Math.floor(Math.random() * len);

        if (i === j) continue;

        // Swap
        [mutated[i], mutated[j]] = [mutated[j], mutated[i]];

        if (isValidSequence(mutated, tasks)) {
            return mutated;
        }

        // Revert if invalid
        [mutated[i], mutated[j]] = [mutated[j], mutated[i]];
    }

    return chromosome; // No valid swap found
};



// =============================================================================
// Main GA Loop
// =============================================================================

const DEFAULT_CONFIG: GAConfig = {
    populationSize: 50,
    generations: 100,
    mutationRate: 0.02,
    eliteCount: 2,
    crossoverRate: 0.8
};

/** Resolve on the next macrotask, letting the browser render and process input. */
const yieldToEventLoop = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Build the machine-inventory lookup used by the GALBP penalties.
 */
const buildMachineInventory = (machines?: MachineType[]): Map<string, number> => {
    const machineInventory = new Map<string, number>();
    if (machines) {
        for (const m of machines) {
            // FIX: Fall back to quantity (legacy alias), default 0.
            // Use Number.isFinite — nullish coalescing (??) doesn't catch NaN.
            const rawUnits = m.availableUnits ?? m.quantity;
            machineInventory.set(m.id, Number.isFinite(rawUnits) ? rawUnits : 0);
        }
    }
    return machineInventory;
};

/**
 * Generate and evaluate the initial random population, sorted best-first.
 */
const seedPopulation = (
    tasks: Task[],
    data: ProjectData,
    nominalSeconds: number,
    effectiveSeconds: number,
    machineInventory: Map<string, number>,
    populationSize: number
): Individual[] => {
    const population: Individual[] = [];
    for (let i = 0; i < populationSize; i++) {
        const chromosome = generateValidSequence(tasks);
        const { fitness, result } = evaluateFitness(chromosome, data, nominalSeconds, effectiveSeconds, machineInventory);
        population.push({ chromosome, fitness, result });
    }
    // Sort by fitness (ascending = best first)
    population.sort((a, b) => a.fitness - b.fitness);
    return population;
};

/**
 * Produce the next generation (elitism + tournament selection + crossover + mutation),
 * sorted best-first.
 *
 * The RNG call order matches the original inline loop exactly, so the synchronous runner
 * yields results identical to the pre-refactor implementation (the 140 existing tests pin this).
 */
const evolveOneGeneration = (
    population: Individual[],
    tasks: Task[],
    data: ProjectData,
    nominalSeconds: number,
    effectiveSeconds: number,
    machineInventory: Map<string, number>,
    cfg: GAConfig
): Individual[] => {
    const { populationSize, mutationRate, eliteCount, crossoverRate } = cfg;
    const newPopulation: Individual[] = [];

    // Elitism: carry over best individuals
    for (let e = 0; e < Math.min(eliteCount, population.length); e++) {
        newPopulation.push(population[e]);
    }

    // Generate rest of new population
    while (newPopulation.length < populationSize) {
        // Selection
        const parent1 = tournamentSelect(population);
        const parent2 = tournamentSelect(population);

        let child: Chromosome;

        // Crossover
        if (Math.random() < crossoverRate) {
            child = orderCrossover(parent1.chromosome, parent2.chromosome, tasks);
        } else {
            child = [...parent1.chromosome];
        }

        // Mutation
        child = mutateSwap(child, tasks, mutationRate);

        // Evaluate
        const { fitness, result } = evaluateFitness(child, data, nominalSeconds, effectiveSeconds, machineInventory);
        newPopulation.push({ chromosome: child, fitness, result });
    }

    newPopulation.sort((a, b) => a.fitness - b.fitness);
    return newPopulation;
};

/**
 * Assemble the final GAResult from the best individual and the final population.
 */
const buildGAResult = (
    bestEver: Individual,
    population: Individual[],
    greedyResult: SimulationResult,
    generations: number,
    populationSize: number,
    cancelled: boolean
): GAResult => {
    const bestResult = bestEver.result!;
    const stationsSaved = greedyResult.stationsCount - bestResult.stationsCount;
    const headcountSaved = greedyResult.totalHeadcount - bestResult.totalHeadcount;
    const efficiencyGain = (bestResult.lineEfficiency || 0) - (greedyResult.lineEfficiency || 0);

    // Extract distinct alternative solutions from final population
    const alternativeResults: SimulationResult[] = [];
    for (const ind of population) {
        if (!ind.result || ind === bestEver) continue;
        // Check if this result is meaningfully different from best and already-collected alternatives
        const isDifferent = (a: SimulationResult, b: SimulationResult) =>
            a.stationsCount !== b.stationsCount ||
            a.totalHeadcount !== b.totalHeadcount ||
            Math.abs((a.lineEfficiency || 0) - (b.lineEfficiency || 0)) > 2;

        const isDiffFromBest = isDifferent(ind.result, bestResult);
        const isDiffFromAlts = alternativeResults.every(alt => isDifferent(ind.result!, alt));

        if (isDiffFromBest && isDiffFromAlts) {
            alternativeResults.push(ind.result);
            if (alternativeResults.length >= 2) break; // Max 2 alternatives (3 total with best)
        }
    }

    return {
        bestSequence: bestEver.chromosome,
        bestFitness: bestEver.fitness,
        bestResult,
        alternativeResults,
        generations,
        populationSize,
        cancelled,
        improvementVsGreedy: (stationsSaved > 0 || headcountSaved > 0 || efficiencyGain > 0.1) ? {
            stationsSaved,
            headcountSaved,
            efficiencyGain
        } : undefined
    };
};

/**
 * Run the Genetic Algorithm to find optimal task sequence (synchronous).
 *
 * Kept synchronous for tests and headless callers. UI callers that must stay responsive
 * (and support cancel) should use runGeneticAlgorithmAsync instead.
 */
export const runGeneticAlgorithm = (
    data: ProjectData,
    nominalSeconds: number,
    effectiveSeconds: number,
    config: Partial<GAConfig> = {}
): GAResult => {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const { populationSize, generations, onProgress, machines } = cfg;
    const tasks = data.tasks;
    const machineInventory = buildMachineInventory(machines);

    // === PHASE 1: Generate Initial Population ===
    let population = seedPopulation(tasks, data, nominalSeconds, effectiveSeconds, machineInventory, populationSize);
    const greedyResult = population[0].result!; // Baseline (best of random first generation)
    let bestEver = population[0];

    // === PHASE 2: Evolution Loop ===
    for (let gen = 0; gen < generations; gen++) {
        population = evolveOneGeneration(population, tasks, data, nominalSeconds, effectiveSeconds, machineInventory, cfg);
        if (population[0].fitness < bestEver.fitness) {
            bestEver = population[0];
        }
        if (onProgress) {
            onProgress(gen + 1, generations, bestEver.fitness);
        }
    }

    // === PHASE 3: Build Result ===
    return buildGAResult(bestEver, population, greedyResult, generations, populationSize, false);
};

/**
 * Async, cancellable version of the GA.
 *
 * Yields to the event loop after each generation so the UI can paint progress (onProgress)
 * and process a cancel request. If the provided AbortSignal fires, it stops after the current
 * generation and returns the best solution found so far with `cancelled: true`.
 */
export const runGeneticAlgorithmAsync = async (
    data: ProjectData,
    nominalSeconds: number,
    effectiveSeconds: number,
    config: Partial<GAConfig> = {}
): Promise<GAResult> => {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const { populationSize, generations, onProgress, machines, signal } = cfg;
    const tasks = data.tasks;
    const machineInventory = buildMachineInventory(machines);

    // === PHASE 1: Generate Initial Population ===
    let population = seedPopulation(tasks, data, nominalSeconds, effectiveSeconds, machineInventory, populationSize);
    const greedyResult = population[0].result!; // Baseline (best of random first generation)
    let bestEver = population[0];

    // Yield once after seeding so a large initial population still lets the UI paint.
    await yieldToEventLoop();

    // === PHASE 2: Evolution Loop (cooperative / cancellable) ===
    let cancelled = false;
    for (let gen = 0; gen < generations; gen++) {
        if (signal?.aborted) {
            cancelled = true;
            break;
        }

        population = evolveOneGeneration(population, tasks, data, nominalSeconds, effectiveSeconds, machineInventory, cfg);
        if (population[0].fitness < bestEver.fitness) {
            bestEver = population[0];
        }
        if (onProgress) {
            onProgress(gen + 1, generations, bestEver.fitness);
        }

        // Hand the thread back to the browser so progress paints and the cancel click is handled.
        await yieldToEventLoop();
    }

    // === PHASE 3: Build Result ===
    return buildGAResult(bestEver, population, greedyResult, generations, populationSize, cancelled);
};
