/**
 * Brute Force Feasibility Check for SALBP Validation
 * 
 * Backtracking algorithm to determine if N stations is mathematically feasible
 * given precedence constraints and takt time limit.
 * 
 * @module core/balancing/bruteForceCheck
 */

import { Task, Assignment } from '../../types';

/**
 * Result of feasibility check
 */
export interface FeasibilityResult {
    feasible: boolean;
    solution?: Assignment[];
    stationsUsed?: number;
    maxStationTime?: number;
}

/**
 * Build a map of predecessors that must be completed before each task
 */
function buildPredecessorMap(tasks: Task[]): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();

    for (const task of tasks) {
        result.set(task.id, new Set(task.predecessors || []));
    }

    return result;
}

/**
 * Check if a task can be assigned (all predecessors already assigned)
 */
function canAssign(
    taskId: string,
    assigned: Set<string>,
    predecessorMap: Map<string, Set<string>>
): boolean {
    const preds = predecessorMap.get(taskId);
    if (!preds) return true;

    for (const pred of preds) {
        if (!assigned.has(pred)) return false;
    }
    return true;
}

/**
 * Get task time — FIX v10.1: standardTime already includes fatigue from graph.ts.
 * Previous version had DOUBLE fatigue AND incorrect factors (1.05/1.10/1.15 vs 1.09/1.14/1.18).
 */
function getTaskTime(task: Task): number {
    if (task.isMachineInternal) return 0;
    return task.standardTime || task.averageTime || 0;
}

/**
 * Brute force backtracking to find valid N-station assignment
 * 
 * Algorithm:
 * 1. For each unassigned task that has all predecessors assigned
 * 2. Try assigning to each station (1..N) where it fits
 * 3. Recurse; backtrack if stuck
 * 4. Return first valid complete assignment
 * 
 * @param tasks - List of tasks to assign
 * @param N - Target number of stations
 * @param takt - Maximum time per station
 * @returns FeasibilityResult with solution if feasible
 */
export function bruteForceFeasibilityCheck(
    tasks: Task[],
    N: number,
    takt: number
): FeasibilityResult {
    // FIX: Guard against N=0 causing Math.max(...[]) = -Infinity
    if (N <= 0 || tasks.length === 0) {
        return { feasible: tasks.length === 0, maxStationTime: 0 };
    }
    const predecessorMap = buildPredecessorMap(tasks);
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Station state: time used
    const stationTimes: number[] = Array(N).fill(0);

    // Assignment tracking
    const assigned = new Set<string>();
    const assignments: Assignment[] = [];

    // Iteration limit to prevent infinite loops
    let iterations = 0;
    const MAX_ITERATIONS = 100000;

    function backtrack(): boolean {
        iterations++;
        if (iterations > MAX_ITERATIONS) return false;

        // All tasks assigned?
        if (assigned.size === tasks.length) return true;

        // Find candidates: unassigned tasks with all predecessors done
        const candidates = tasks.filter(t =>
            !assigned.has(t.id) && canAssign(t.id, assigned, predecessorMap)
        );

        if (candidates.length === 0) return false; // Stuck

        // Try each candidate
        for (const task of candidates) {
            const taskTime = getTaskTime(task);

            // Try assigning to each station
            for (let s = 0; s < N; s++) {
                // Station must have capacity
                if (stationTimes[s] + taskTime <= takt) {
                    // Assign
                    stationTimes[s] += taskTime;
                    assigned.add(task.id);
                    assignments.push({ taskId: task.id, stationId: s + 1 });

                    // Recurse
                    if (backtrack()) return true;

                    // Backtrack
                    stationTimes[s] -= taskTime;
                    assigned.delete(task.id);
                    assignments.pop();
                }
            }
        }

        return false;
    }

    const feasible = backtrack();

    if (feasible) {
        return {
            feasible: true,
            solution: [...assignments],
            stationsUsed: new Set(assignments.map(a => a.stationId)).size,
            maxStationTime: Math.max(...stationTimes)
        };
    }

    return { feasible: false };
}

/**
 * Find minimum feasible N using binary search + brute force
 * Useful for determining theoretical minimum stations
 */
export function findMinimumFeasibleN(
    tasks: Task[],
    takt: number,
    maxN: number = tasks.length
): { minN: number; solution?: Assignment[] } {
    if (takt <= 0) return { minN: -1 }; // No feasible solution with zero/negative takt

    // Lower bound: ceil(totalWork / takt)
    const totalWork = tasks.reduce((sum, t) => sum + getTaskTime(t), 0);
    let low = Math.ceil(totalWork / takt);
    let high = maxN;

    let bestResult: FeasibilityResult | null = null;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const result = bruteForceFeasibilityCheck(tasks, mid, takt);

        if (result.feasible) {
            bestResult = result;
            high = mid - 1; // Try fewer stations
        } else {
            low = mid + 1; // Need more stations
        }
    }

    if (bestResult) {
        return { minN: bestResult.stationsUsed!, solution: bestResult.solution };
    }

    return { minN: -1 }; // No feasible solution found
}
