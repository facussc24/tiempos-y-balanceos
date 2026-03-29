import { Task, FATIGUE_OPTIONS, ProductModel } from "../types";
import { calculateRequiredSampleSize } from "./math";

export const syncSuccessors = (tasks: Task[]): Task[] => {
    const taskMap = new Map(tasks.map(t => [t.id, { ...t, successors: [] as string[] }]));

    taskMap.forEach(task => {
        task.predecessors.forEach(predId => {
            const parent = taskMap.get(predId);
            if (parent) {
                if (!parent.successors.includes(task.id)) {
                    parent.successors.push(task.id);
                }
            }
        });
    });

    return Array.from(taskMap.values());
};

export const detectCycles = (tasks: Task[]): boolean => {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (taskId: string): boolean => {
        visited.add(taskId);
        recursionStack.add(taskId);

        const task = taskMap.get(taskId);
        if (task) {
            for (const succId of task.successors) {
                if (!visited.has(succId)) {
                    if (dfs(succId)) return true;
                } else if (recursionStack.has(succId)) {
                    return true;
                }
            }
        }

        recursionStack.delete(taskId);
        return false;
    };

    for (const task of tasks) {
        if (!visited.has(task.id)) {
            if (dfs(task.id)) return true;
        }
    }

    return false;
};


/**
 * Calculates task weights for RPW heuristic and MMALBP weighted averaging.
 * 
 * @param tasks - Array of tasks to process
 * @param activeModels - Active product models for MMALBP (optional, default [])
 * @returns Tasks with calculated standardTime, positionalWeight, and other metrics
 * 
 * @remarks
 * **MMALBP Logic (v2.1):**
 * - If `activeModels.length > 1`, applies Weighted Average based on `modelApplicability`
 * - Formula: `weightedTime = Sum(averageTime * model.percentage)` for applicable models
 * - If `modelApplicability[modelId]` is undefined, defaults to TRUE (task applies)
 * 
 * **Machine/Injection Tasks:**
 * - Rating forced to 100%
 * - Fatigue forced to 0%
 * 
 * **Global Fatigue Supplement (v10.0):**
 * - If fatigueCompensation.enabled and task.fatigueCategory='none', applies globalPercent
 * - Individual fatigue categories have priority over global
 * 
 * **Calculation Flow:**
 * 1. Filter ignored time samples
 * 2. Normalize times by cycleQuantity
 * 3. Calculate averageTime and stdDev
 * 4. Apply MMALBP Weighted Average (if mix active)
 * 5. Calculate basicTime = weightedAverage * (rating/100)
 * 6. Calculate standardTime = basicTime * (1 + fatigue%)
 * 7. Calculate positionalWeight = standardTime + sum(descendant standardTimes)
 */
export const calculateTaskWeights = (
    tasks: Task[],
    activeModels: ProductModel[] = [],
    fatigueCompensation?: { enabled: boolean; globalPercent: number }
): Task[] => {
    const taskMap = new Map<string, Task>();


    tasks.forEach((t) => {
        taskMap.set(t.id, t);
    });

    const descendantsCache = new Map<string, Set<string>>();

    const getDescendants = (taskId: string, path: Set<string>): Set<string> => {
        if (descendantsCache.has(taskId)) return descendantsCache.get(taskId)!;
        const t = taskMap.get(taskId);
        if (!t || path.has(taskId)) return new Set();

        const descendants = new Set<string>();
        path.add(taskId);

        for (const succId of t.successors) {
            descendants.add(succId);
            const sub = getDescendants(succId, new Set(path));
            sub.forEach(id => descendants.add(id));
        }

        descendantsCache.set(taskId, descendants);
        return descendants;
    };

    // PASADA 1: Calcular standardTime para todas las tareas
    const tasksWithStdTime = tasks.map((t) => {
        // 1. Ensure Defaults for Legacy Data
        // LOGIC FIX: For Machines/Injection, enforce Rating 100%
        let rating = (t.ratingFactor !== undefined && t.ratingFactor !== null) ? t.ratingFactor : 100;
        if (t.executionMode === 'machine' || t.executionMode === 'injection') {
            rating = 100;
        }

        // FIX v10.2: Restore per-task fatigue categories as Priority 1.
        // Global fatigueCompensation is used as fallback for tasks with 'none'.
        // This allows tasks like heavy lifting (high fatigue) to use individual factors
        // while other tasks fall back to the global supplement.
        const fatigueCat = t.fatigueCategory || 'none';

        // NORMALIZATION FACTOR (Pieces per Cycle)
        const cycleQuantity = t.cycleQuantity && t.cycleQuantity > 0 ? t.cycleQuantity : 1;

        // 2. Filter out ignored values (Outliers)
        // IMPORTANT: Normalization happens dynamically here for calculation
        const activeTimesRaw = t.times.filter((v, idx) => !t.ignoredTimeIndices?.includes(idx));
        const validValuesRaw = activeTimesRaw.filter(x => x !== null && x > 0) as number[];

        // NORMALIZE: Convert Raw Times (Total Cycle) to Unit Times
        // Formula: Unit Time = Raw Time / Quantity
        const validValuesNormalized = validValuesRaw.map(v => v / cycleQuantity);
        const validCount = validValuesNormalized.length;

        // 3. Recalculate Stats based on active values only
        let stdDev = 0;
        let averageTime = 0;

        if (validCount > 0) {
            averageTime = validValuesNormalized.reduce((a, b) => a + b, 0) / validCount;

            // Calculate StdDev on normalized values
            // BUG FIX: Only calculate variance if validCount > 1 to avoid division by zero
            if (validCount > 1) {
                const mean = averageTime;
                const variance = validValuesNormalized.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (validCount - 1);
                stdDev = Math.sqrt(variance);
            } else {
                stdDev = 0;
            }
        } else {
            // Keep legacy or manual if no time data
            // FIX: Guard against undefined/NaN averageTime from legacy data — this is
            // the root cause of NaN propagation through standardTime → positionalWeight
            // → sort comparators and Math.max calculations downstream.
            averageTime = t.averageTime || 0;
            stdDev = t.stdDev || 0;
        }

        // 4. Calculate N (Statistical Sample Size)
        const requiredSamples = calculateRequiredSampleSize(averageTime, stdDev, validCount);

        // --- v2.1 MMALBP: Apply Weighted Average if Mix is Active ---
        let weightedAverageTime = averageTime;
        if (activeModels.length > 1) {
            let weightedSum = 0;
            activeModels.forEach((m) => {
                // Default to TRUE if not defined (backward compatibility)
                const isApplicable = t.modelApplicability?.[m.id] !== false;
                if (isApplicable) {
                    weightedSum += averageTime * m.percentage;
                }
            });
            weightedAverageTime = parseFloat(weightedSum.toFixed(2));
        }
        // --- END MMALBP ---

        // 5. Calculate Basic Time (Tiempo Básico)
        // Uses weightedAverageTime (which equals averageTime if no Mix)
        const basicTime = weightedAverageTime * (rating / 100);

        // 6. Calculate Standard Time (Tiempo Estándar)
        // v10.0: Global Fatigue Supplement - Priority: Individual > Global > 0
        // LOGIC: For Machines/Injection, enforce Fatigue 0% (physical/chemical times)
        const fatigueOption = FATIGUE_OPTIONS.find(opt => opt.value === fatigueCat);
        let fatiguePct = 0;

        // Priority 1: Individual task fatigue category (if not 'none')
        if (fatigueOption && fatigueCat !== 'none') {
            fatiguePct = fatigueOption.factor * 100;
        }
        // Priority 2: Global supplement fallback (for tasks with 'none')
        else if (fatigueCompensation?.enabled && fatigueCompensation.globalPercent > 0) {
            fatiguePct = fatigueCompensation.globalPercent;
        }

        // Machine/Injection tasks are excluded from fatigue (physical/chemical processes)
        if (t.executionMode === 'machine' || t.executionMode === 'injection') {
            fatiguePct = 0;
        }
        const stdTime = basicTime * (1 + (fatiguePct / 100));

        return {
            ...t,
            cycleQuantity,
            ratingFactor: rating,
            fatigueCategory: fatigueCat,
            stdDev,
            averageTime,
            requiredSamples,
            standardTime: stdTime,
            executionMode: t.executionMode || 'manual',
            concurrentWith: t.concurrentWith || null
        };
    });

    // Actualizar taskMap con las tareas que tienen standardTime calculado
    const updatedTaskMap = new Map<string, Task>();
    tasksWithStdTime.forEach(t => updatedTaskMap.set(t.id, t));

    // PASADA 2: Calcular peso posicional usando standardTime ya calculados
    return tasksWithStdTime.map((t) => {
        const allDescendants = getDescendants(t.id, new Set());

        // 7. Calculate Positional Weight (Sum of standard times of successors)
        // FIX: Ahora usa standardTime que YA fue calculado en la pasada 1
        let successorSum = 0;
        allDescendants.forEach(descId => {
            const descTask = updatedTaskMap.get(descId);
            if (descTask) {
                successorSum += (descTask.standardTime || 0);
            }
        });

        return {
            ...t,
            calculatedSuccessorSum: successorSum,
            positionalWeight: t.standardTime + successorSum
        };
    });
};

