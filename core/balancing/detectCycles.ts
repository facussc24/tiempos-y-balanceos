/**
 * Cycle Detection for Precedence Validation (FIX 3)
 * 
 * Detects circular dependencies in task precedences BEFORE running any balancing.
 * Uses DFS with three-color marking (Cormen et al. algorithm).
 * 
 * @example
 * // If A→B, B→C, C→A exists:
 * const cycles = detectPrecedenceCycles(tasks);
 * // Returns: [['A', 'B', 'C', 'A']]
 */

import { Task } from '../../types';

// Node colors for DFS traversal
const WHITE = 0; // Not visited
const GRAY = 1;  // In current path (visiting)
const BLACK = 2; // Fully processed

/**
 * Custom error for circular precedence detection
 */
export class PrecedenceCycleError extends Error {
    public readonly cycles: string[][];

    constructor(cycles: string[][]) {
        const cycleStr = cycles[0].join(' → ');
        super(`Error de Lógica Circular en las tareas: ${cycleStr}`);
        this.name = 'PrecedenceCycleError';
        this.cycles = cycles;
    }
}

/**
 * Detects cycles in the precedence graph using DFS.
 * 
 * Algorithm: Three-color marking
 * - WHITE: unvisited
 * - GRAY: currently in recursion stack (visiting)
 * - BLACK: fully processed (all descendants visited)
 * 
 * A cycle exists if we encounter a GRAY node during DFS.
 * 
 * @param tasks - Array of tasks with predecessors defined
 * @returns Array of cycles found (each cycle is an array of task IDs)
 */
export function detectPrecedenceCycles(tasks: Task[]): string[][] {
    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();
    const cycles: string[][] = [];

    // Build adjacency list: predecessor → successors
    // We traverse from predecessors to successors
    const adjList = new Map<string, string[]>();
    const taskIds = new Set<string>();

    for (const task of tasks) {
        taskIds.add(task.id);
        if (!adjList.has(task.id)) {
            adjList.set(task.id, []);
        }

        // For each predecessor, add this task as a successor
        for (const pred of task.predecessors) {
            if (!adjList.has(pred)) {
                adjList.set(pred, []);
            }
            adjList.get(pred)!.push(task.id);
        }
    }

    // Initialize all nodes as WHITE
    for (const id of taskIds) {
        color.set(id, WHITE);
    }

    // Also check predecessors that might be referenced but not in task list
    for (const task of tasks) {
        for (const pred of task.predecessors) {
            if (!color.has(pred)) {
                color.set(pred, WHITE);
            }
        }
    }

    /**
     * DFS visit with cycle detection
     */
    function dfs(nodeId: string, pathStack: string[]): boolean {
        color.set(nodeId, GRAY);
        pathStack.push(nodeId);

        const successors = adjList.get(nodeId) || [];

        for (const succ of successors) {
            const succColor = color.get(succ);

            if (succColor === GRAY) {
                // Found a back edge = cycle detected!
                // Extract the cycle from pathStack
                const cycleStart = pathStack.indexOf(succ);
                const cycle = [...pathStack.slice(cycleStart), succ];
                cycles.push(cycle);

                // Continue to find all cycles (don't return early)
            } else if (succColor === WHITE) {
                parent.set(succ, nodeId);
                dfs(succ, pathStack);
            }
            // BLACK nodes are already fully processed, skip
        }

        pathStack.pop();
        color.set(nodeId, BLACK);
        return false;
    }

    // Run DFS from all unvisited nodes
    for (const id of color.keys()) {
        if (color.get(id) === WHITE) {
            dfs(id, []);
        }
    }

    return cycles;
}

/**
 * Validates that no cycles exist in task precedences.
 * Throws PrecedenceCycleError if cycles are detected.
 * 
 * @param tasks - Array of tasks to validate
 * @throws PrecedenceCycleError if cycles are detected
 */
export function validateNoCycles(tasks: Task[]): void {
    const cycles = detectPrecedenceCycles(tasks);

    if (cycles.length > 0) {
        throw new PrecedenceCycleError(cycles);
    }
}

/**
 * Alternative: Kahn's algorithm with cycle detection.
 * Returns tasks in topological order, or null if cycle exists.
 * 
 * This is useful when you need both the sorted order AND cycle detection.
 * 
 * @param tasks - Array of tasks
 * @returns Topologically sorted task IDs, or null if cycle exists
 */
export function topologicalSortWithCycleCheck(tasks: Task[]): string[] | null {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // Initialize
    for (const task of tasks) {
        inDegree.set(task.id, task.predecessors.length);
        if (!adjList.has(task.id)) {
            adjList.set(task.id, []);
        }

        for (const pred of task.predecessors) {
            if (!adjList.has(pred)) {
                adjList.set(pred, []);
            }
            adjList.get(pred)!.push(task.id);
        }
    }

    // Find all tasks with no predecessors
    const queue: string[] = [];
    for (const task of tasks) {
        if (inDegree.get(task.id) === 0) {
            queue.push(task.id);
        }
    }

    const sorted: string[] = [];

    while (queue.length > 0) {
        const current = queue.shift()!;
        sorted.push(current);

        for (const succ of adjList.get(current) || []) {
            const newDegree = (inDegree.get(succ) || 1) - 1;
            inDegree.set(succ, newDegree);

            if (newDegree === 0) {
                queue.push(succ);
            }
        }
    }

    // If we couldn't process all tasks, there's a cycle
    if (sorted.length !== tasks.length) {
        return null; // Cycle detected
    }

    return sorted;
}
