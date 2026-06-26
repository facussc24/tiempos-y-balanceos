/**
 * Hard assignment-constraint checks for the line-balancing board.
 *
 * Single source of truth for the BLOCKING constraints that reject a task→station assignment:
 *   1. Machine type conflict (a station can only host one required machine type)
 *   2. Sector affinity (tasks from different sectors cannot share a station)
 *   3. Zoning must_exclude (two tasks explicitly forbidden from sharing a station)
 *
 * Used both by useLineBalancing.handleDragEnd (to reject a drop with a toast) and by the live
 * drag preview (to warn proactively while hovering). Soft warnings — must_include, precedence,
 * overload, concurrency — are intentionally NOT handled here; they don't block the assignment.
 */
import { ProjectData, Task, MachineType } from '../../types';

export interface AssignmentConstraintResult {
    /** True when the assignment must be rejected. */
    blocked: boolean;
    /** Short label for the live drag preview overlay (e.g. "Conflicto de máquina"). */
    shortReason?: string;
    /** Full toast title for the drop handler. */
    title?: string;
    /** Full toast message for the drop handler. */
    message?: string;
}

const ALLOWED: AssignmentConstraintResult = { blocked: false };

export function checkHardAssignmentConstraints(
    taskId: string,
    targetStationId: number,
    data: ProjectData,
    machinesList: MachineType[]
): AssignmentConstraintResult {
    // O(1) lookup; this runs on every drag-over frame via the live preview, so avoid O(n) finds.
    const taskById = new Map(data.tasks.map(t => [t.id, t]));
    const movingTask = taskById.get(taskId);
    if (!movingTask) return ALLOWED;

    // 1) Machine type conflict — the station already hosts a different required machine type.
    if (movingTask.requiredMachineId) {
        const stationTasks = data.assignments
            .filter(a => a.stationId === targetStationId)
            .map(a => taskById.get(a.taskId))
            .filter(Boolean) as Task[];

        const stationMachineType = stationTasks.find(t => t.requiredMachineId)?.requiredMachineId;
        if (stationMachineType && stationMachineType !== movingTask.requiredMachineId) {
            const movingMachineName = machinesList.find(m => m.id === movingTask.requiredMachineId)?.name || movingTask.requiredMachineId;
            const stationMachineName = machinesList.find(m => m.id === stationMachineType)?.name || stationMachineType;
            return {
                blocked: true,
                shortReason: 'Conflicto de máquina',
                title: 'Conflicto de Máquina',
                message: `No se puede asignar "${movingTask.id}": Requiere ${movingMachineName}, pero la Estación ${targetStationId} ya tiene ${stationMachineName}.`,
            };
        }
    }

    // 2) Sector affinity — tasks from different sectors cannot share a station (engine.ts parity).
    if (!data.meta.disableSectorAffinity && movingTask.sectorId) {
        const stationTasks = data.assignments
            .filter(a => a.stationId === targetStationId && a.taskId !== taskId)
            .map(a => taskById.get(a.taskId))
            .filter(Boolean) as Task[];

        const stationSector = stationTasks.find(t => t.sectorId)?.sectorId;
        if (stationSector && stationSector !== movingTask.sectorId) {
            const taskSectorName = data.sectors?.find(s => s.id === movingTask.sectorId)?.name || movingTask.sectorId;
            const stationSectorName = data.sectors?.find(s => s.id === stationSector)?.name || stationSector;
            return {
                blocked: true,
                shortReason: 'Restricción de sector',
                title: 'Restricción de Sector',
                message: `No se puede asignar tarea de "${taskSectorName}" a una estación de "${stationSectorName}".`,
            };
        }
    }

    // 3) Zoning must_exclude — two tasks explicitly forbidden from sharing a station.
    const zoningConstraints = data.zoningConstraints || [];
    if (zoningConstraints.length > 0) {
        const stationTaskIds = new Set(
            data.assignments
                .filter(a => a.stationId === targetStationId && a.taskId !== taskId)
                .map(a => a.taskId)
        );

        for (const constraint of zoningConstraints) {
            if (constraint.type !== 'must_exclude') continue;
            const isInvolved = constraint.taskA === taskId || constraint.taskB === taskId;
            if (!isInvolved) continue;

            const partnerId = constraint.taskA === taskId ? constraint.taskB : constraint.taskA;
            if (stationTaskIds.has(partnerId)) {
                return {
                    blocked: true,
                    shortReason: 'Restricción de zona',
                    title: 'Restricción de Zona',
                    message: `"${taskId}" y "${partnerId}" no pueden estar en la misma estación.${constraint.reason ? ` Razón: ${constraint.reason}` : ''}`,
                };
            }
        }
    }

    return ALLOWED;
}

export interface BulkMovePlan {
    /** Task ids that can be moved (passed all hard constraints). */
    accepted: string[];
    /** Task ids skipped because they violate a hard constraint. */
    blocked: string[];
    /** A copy of `data` with the accepted assignments applied. Commit it only if accepted.length > 0. */
    nextData: ProjectData;
}

/**
 * Plan a bulk move of `taskIds` to `targetStationId`, validating hard constraints INCREMENTALLY
 * (each accepted task is reflected in the working state before the next is checked) so intra-batch
 * conflicts are caught — not just conflicts against the pre-existing assignments.
 *
 * Pure: returns the accepted/blocked split and the resulting data; the caller decides whether to
 * commit. Used by the multi-select "move N to station" action so bulk moves respect the same
 * machine / sector / zoning rules that single drag-and-drop enforces.
 */
export function planBulkMove(
    taskIds: string[],
    targetStationId: number,
    data: ProjectData,
    machinesList: MachineType[]
): BulkMovePlan {
    const validIds = taskIds.filter(id => data.tasks.some(t => t.id === id));
    let working = data;
    const accepted: string[] = [];
    const blocked: string[] = [];

    for (const id of validIds) {
        const res = checkHardAssignmentConstraints(id, targetStationId, working, machinesList);
        if (res.blocked) {
            blocked.push(id);
        } else {
            accepted.push(id);
            working = {
                ...working,
                assignments: [...working.assignments.filter(a => a.taskId !== id), { taskId: id, stationId: targetStationId }],
            };
        }
    }

    return { accepted, blocked, nextData: working };
}
