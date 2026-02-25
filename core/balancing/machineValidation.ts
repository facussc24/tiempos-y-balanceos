/**
 * Machine Validation Module (RC-ALBP)
 * 
 * Implements GALBP (General Assembly Line Balancing Problem) resource constraints.
 * Logic: "Validation per Station based on Task Requirements"
 * 
 * Key Rules:
 * 1. Each TASK declares which machine type it requires
 * 2. Each STATION consumes 1 machine if any of its tasks require it
 * 3. If a station has tasks requiring different machines -> Conflict alert
 * 4. If total stations > available machines -> Deficit alert
 */

import { Task, Assignment, MachineType } from '../../types';

export interface StationMachineRequirement {
    stationId: number;
    requiredMachineIds: string[];  // Unique machine types needed
    hasConflict: boolean;          // True if >1 different machine types
    conflictMessage?: string;
}

export interface PlantMachineBalance {
    machineId: string;
    machineName: string;
    available: number;       // From PlantConfig
    consumed: number;        // Count of stations requiring it
    balance: number;         // available - consumed
    isDeficit: boolean;      // balance < 0
    stationsUsing: number[]; // List of station IDs
}

export interface MachineValidationResult {
    stationRequirements: StationMachineRequirement[];
    machineBalance: PlantMachineBalance[];
    hasDeficit: boolean;
    hasConflicts: boolean;
    totalDeficit: number;
}

/**
 * Calculates machine requirements per station
 * Rule: A station consumes 1 unit per unique machine type required by its tasks
 */
export function calculateStationMachineRequirements(
    assignments: Assignment[],
    tasks: Task[],
    machines: MachineType[]
): StationMachineRequirement[] {
    // Group assignments by station
    const stationGroups: Record<number, string[]> = {};

    assignments.forEach(a => {
        if (!stationGroups[a.stationId]) stationGroups[a.stationId] = [];
        stationGroups[a.stationId].push(a.taskId);
    });

    const results: StationMachineRequirement[] = [];

    Object.entries(stationGroups).forEach(([stationId, taskIds]) => {
        const machineIds = new Set<string>();

        taskIds.forEach(taskId => {
            const task = tasks.find(t => t.id === taskId);
            if (task?.requiredMachineId) {
                machineIds.add(task.requiredMachineId);
            }
        });

        const uniqueMachines = Array.from(machineIds);
        const hasConflict = uniqueMachines.length > 1;

        // Get machine names for conflict message
        let conflictMessage: string | undefined;
        if (hasConflict) {
            const machineNames = uniqueMachines
                .map(id => machines.find(m => m.id === id)?.name || id)
                .join(', ');
            conflictMessage = `Conflicto: Esta estación requiere ${uniqueMachines.length} máquinas diferentes (${machineNames})`;
        }

        results.push({
            stationId: parseInt(stationId),
            requiredMachineIds: uniqueMachines,
            hasConflict,
            conflictMessage
        });
    });

    return results;
}

/**
 * Validates plant-wide machine inventory against station consumption
 */
export function validateMachineInventory(
    stationRequirements: StationMachineRequirement[],
    machines: MachineType[]
): PlantMachineBalance[] {
    const balances: PlantMachineBalance[] = [];

    machines.forEach(machine => {
        const stationsUsing = stationRequirements
            .filter(sr => sr.requiredMachineIds.includes(machine.id))
            .map(sr => sr.stationId);

        const consumed = stationsUsing.length;
        const available = machine.availableUnits || 0;
        const balance = available - consumed;

        balances.push({
            machineId: machine.id,
            machineName: machine.name,
            available,
            consumed,
            balance,
            isDeficit: balance < 0,
            stationsUsing
        });
    });

    return balances;
}

/**
 * Full validation pipeline - combines station requirements and inventory check
 */
export function validateMachineResources(
    assignments: Assignment[],
    tasks: Task[],
    machines: MachineType[]
): MachineValidationResult {
    const stationRequirements = calculateStationMachineRequirements(assignments, tasks, machines);
    const machineBalance = validateMachineInventory(stationRequirements, machines);

    const hasDeficit = machineBalance.some(b => b.isDeficit);
    const hasConflicts = stationRequirements.some(r => r.hasConflict);
    const totalDeficit = machineBalance
        .filter(b => b.isDeficit)
        .reduce((sum, b) => sum + Math.abs(b.balance), 0);

    return {
        stationRequirements,
        machineBalance,
        hasDeficit,
        hasConflicts,
        totalDeficit
    };
}

/**
 * Get the primary machine for a station (first required machine, or undefined)
 */
export function getStationPrimaryMachine(
    stationId: number,
    stationRequirements: StationMachineRequirement[],
    machines: MachineType[]
): MachineType | undefined {
    const req = stationRequirements.find(r => r.stationId === stationId);
    if (!req || req.requiredMachineIds.length === 0) return undefined;
    return machines.find(m => m.id === req.requiredMachineIds[0]);
}

// =============================================================================
// V8.1: PROCESS CONSTRAINT VALIDATION (Chemical/Physical Hard Floors)
// =============================================================================

/**
 * Represents a violation where a process-constrained task exceeds Takt Time.
 * These violations CANNOT be solved by adding operators - only more machines/molds.
 * 
 * Example: PU curing takes 40s, but Takt is 30s.
 * - WRONG solution: Add 2 operators (doesn't speed up curing)
 * - CORRECT solution: Add 2 molds in parallel
 */
export interface ProcessConstraintViolation {
    taskId: string;
    taskDescription: string;
    /** Time required by the physical/chemical process (cannot be reduced) */
    processTime: number;
    /** Target Takt Time */
    taktTime: number;
    /** How many seconds over Takt (processTime - taktTime) */
    deficit: number;
    /** Minimum machines/molds needed: ceil(processTime / taktTime) */
    requiredMachines: number;
    /** Severity level */
    severity: 'fatal';
    /** Human-readable message */
    message: string;
}

/**
 * Validation result for process constraints
 */
export interface ProcessConstraintValidationResult {
    /** True if all process-constrained tasks fit within Takt */
    valid: boolean;
    /** List of violations (empty if valid) */
    violations: ProcessConstraintViolation[];
    /** Worst offender task, if any */
    worstCase: { taskId: string; processTime: number; deficit: number } | null;
}

/**
 * Validate that tasks marked as process-constrained don't violate Takt Time.
 * 
 * CRITICAL: Unlike normal capacity issues, process constraints (injection, curing,
 * thermal processes) represent PHYSICAL LAWS that cannot be accelerated by adding
 * human resources. The only solution is more machines/molds in parallel.
 * 
 * When a violation is found:
 *   - DO NOT suggest adding operators
 *   - REQUIRE N = ceil(processTime / Takt) machines/molds
 *   - Flag as FATAL error (cannot proceed without investment)
 * 
 * @param tasks - Array of tasks to validate
 * @param taktTime - Target Takt Time in seconds
 * @returns Validation result with violations (if any)
 * 
 * @example
 * // Task with 40s curing time, Takt = 30s
 * const tasks = [{ id: 'CURE-01', isProcessConstraint: true, machineTimeFixed: 40 }];
 * const result = validateProcessConstraints(tasks, 30);
 * // result.valid = false
 * // result.violations[0].requiredMachines = 2 (need 2 molds in parallel)
 */
export function validateProcessConstraints(
    tasks: Task[],
    taktTime: number
): ProcessConstraintValidationResult {
    const violations: ProcessConstraintViolation[] = [];
    let worstCase: { taskId: string; processTime: number; deficit: number } | null = null;

    for (const task of tasks) {
        // Only validate tasks marked as process-constrained
        if (!task.isProcessConstraint) continue;

        // Use machineTimeFixed if available (explicit), otherwise fall back to standardTime
        const processTime = task.machineTimeFixed ?? task.standardTime;

        // Check if process time exceeds Takt
        if (processTime > taktTime) {
            const deficit = processTime - taktTime;
            const requiredMachines = Math.ceil(processTime / taktTime);

            violations.push({
                taskId: task.id,
                taskDescription: task.description || task.id,
                processTime,
                taktTime,
                deficit,
                requiredMachines,
                severity: 'fatal',
                message:
                    `🔴 BLOQUEO FÍSICO: "${task.description}" requiere ${processTime.toFixed(1)}s ` +
                    `(proceso químico/físico) pero Takt = ${taktTime.toFixed(1)}s. ` +
                    `Este tiempo NO puede reducirse agregando operarios. ` +
                    `Se requieren ${requiredMachines} máquinas/moldes en paralelo para cumplir la demanda.`
            });

            // Track worst case
            if (!worstCase || deficit > worstCase.deficit) {
                worstCase = { taskId: task.id, processTime, deficit };
            }
        }
    }

    // Sort by deficit (worst first)
    violations.sort((a, b) => b.deficit - a.deficit);

    return {
        valid: violations.length === 0,
        violations,
        worstCase
    };
}
