import { Assignment, Task } from '../../types';

/**
 * RALBP-2: Post-process assignments to group manual predecessors AND successors with injection tasks
 * This runs AFTER the greedy algorithm completes, avoiding modification of core logic.
 * 
 * Logic:
 * 1. Identifies Injection/Machine tasks.
 * 2. Builds a bidirectional graph (predecessors <-> successors).
 * 3. Uses BFS to find all connected manual tasks (upstream and downstream).
 * 4. Reassigns all connected manual tasks to the injection station.
 */
export const postProcessRALBP = (
    assignments: Assignment[],
    tasks: Task[]
): Assignment[] => {
    // Return early if no assignments or tasks
    if (!assignments.length || !tasks.length) return assignments;

    const result = assignments.map(a => ({ ...a })); // Shallow copy assignments

    // Build successor graph from predecessors (since task.successors may be empty or incomplete)
    // We trust task.predecessors as the source of truth
    const successorsMap = new Map<string, string[]>();

    // Initialize map
    tasks.forEach(t => {
        if (!successorsMap.has(t.id)) successorsMap.set(t.id, []);
    });

    tasks.forEach(task => {
        task.predecessors.forEach(predId => {
            if (!successorsMap.has(predId)) {
                successorsMap.set(predId, []);
            }
            successorsMap.get(predId)!.push(task.id);
        });
    });

    // Find all injection/machine tasks
    const injectionTasks = tasks.filter(
        t => t.executionMode === 'injection' || t.executionMode === 'machine'
    );

    // For each injection task, reassign ALL manual predecessors AND successors to the same station
    for (const injTask of injectionTasks) {
        const injAssignment = result.find(a => a.taskId === injTask.id);
        if (!injAssignment) continue;

        const injStationId = injAssignment.stationId;
        const processedTasks = new Set<string>();
        const queue: string[] = [injTask.id]; // Start with injection task

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (processedTasks.has(currentId)) continue;
            processedTasks.add(currentId);

            const currentTask = tasks.find(t => t.id === currentId);
            if (!currentTask) continue;

            // Reassign if it's a manual task and NOT the injection task itself (though reassigning inj to itself is harmless)
            if (currentTask.executionMode === 'manual') {
                const assignment = result.find(a => a.taskId === currentId);
                if (assignment) {
                    assignment.stationId = injStationId;
                }
            }

            // 1. Add Predecessors to queue
            currentTask.predecessors.forEach(predId => {
                const pred = tasks.find(t => t.id === predId);
                // Only traverse into Manual tasks or the Injection task itself
                // STRICT SECTOR CHECK: Stop validation if crossing sector boundary
                if (pred && !processedTasks.has(predId)) {
                    if (pred.sectorId === injTask.sectorId) {
                        queue.push(predId);
                    }
                }
            });

            // 2. Add Successors to queue (using our built map)
            const succIds = successorsMap.get(currentId) || [];
            succIds.forEach(succId => {
                const succ = tasks.find(t => t.id === succId);
                if (succ && !processedTasks.has(succId)) {
                    if (succ.sectorId === injTask.sectorId) {
                        queue.push(succId);
                    }
                }
            });
        }
    }

    return result;
};
