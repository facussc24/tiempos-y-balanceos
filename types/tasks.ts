import type { FatigueCategory } from './shifts';
import type { ExecutionMode } from './execution';
import type { InjectionParams } from './sectors';
import type { TaskMaterial, ContinuousConsumable } from './materials';

// ============================================================================
// TASK MANAGEMENT
// ============================================================================

/**
 * Represents a production task with time study data
 *
 * Tasks are the fundamental unit of work in line balancing.
 * They contain time measurements, dependencies, and all metadata
 * needed for balancing algorithms and simulation.
 *
 * @example
 * ```typescript
 * const assemblyTask: Task = {
 *   id: 'OP-001',
 *   description: 'Ensamblar componente A',
 *   times: [45.2, 43.8, 44.5, 42.9, 45.0],
 *   averageTime: 44.28,
 *   standardTime: 50.48,
 *   ratingFactor: 100,
 *   fatigueCategory: 'standard',
 *   predecessors: [],
 *   successors: ['OP-002'],
 *   positionalWeight: 150,
 *   calculatedSuccessorSum: 100,
 *   executionMode: 'manual'
 * };
 * ```
 */
export interface Task {
  /** Unique identifier for the task (e.g., "OP-001", "E-015") */
  id: string;
  /** Human-readable description of the operation */
  description: string;
  /** Array of time measurements in seconds (null for unmeasured slots) */
  times: (number | null)[];
  /** Indices of times marked as outliers/foreign elements */
  ignoredTimeIndices?: number[];

  /**
   * Normalization factor (pieces per cycle)
   * If > 1, raw times are divided by this value
   * @default 1
   */
  cycleQuantity?: number;

  /** Calculated average of valid time measurements */
  averageTime: number;

  // Fair Times (Tiempos Justos)
  /**
   * Rating factor (VR - Valoración del Ritmo)
   * Percentage where 100 = normal pace
   * @example 90 = slow operator, 115 = fast operator
   */
  ratingFactor: number;
  /** Fatigue allowance category */
  fatigueCategory: FatigueCategory;

  /**
   * Standard time = (Average × Rating/100) × (1 + Fatigue)
   * If models exist, this is the weighted average
   */
  standardTime: number;

  // Model-specific times (MMALBP)
  /** @deprecated Use modelApplicability instead */
  modelTimes?: Record<string, number>;
  /** Fixed standard time input by user (v2.1+) */
  baseTime?: number;
  /** Map of ModelID → IsApplicable for MMALBP */
  modelApplicability?: Record<string, boolean>;

  // Dependencies
  /** IDs of tasks that must complete before this one */
  predecessors: string[];
  /** IDs of tasks that depend on this one */
  successors: string[];
  /** Positional weight for balancing heuristics */
  positionalWeight: number;
  /** Sum of successor weights (for LCR heuristic) */
  calculatedSuccessorSum: number;

  /** Standard deviation in seconds (for Monte Carlo simulation) */
  stdDev?: number;

  /** Calculated required sample size (95.45% confidence, 5% error) */
  requiredSamples?: number;

  // Concurrency Logic
  /**
   * Execution mode determines how this task is performed
   * @default 'manual'
   */
  executionMode?: ExecutionMode;
  /** ID of machine task this manual task runs in parallel with */
  concurrentWith?: string | null;

  // Sector Assignment
  /** ID of the sector/department this task belongs to */
  sectorId?: string;

  // Standard Work Documentation
  /** Step-by-step method description */
  methodDescription?: string;
  /** Trigger condition to start (e.g., "Cuando el operario toca...") */
  startCondition?: string;
  /** End condition (e.g., "Cuando la pieza deja...") */
  endCondition?: string;
  /** Relative path to video/image: "_STD_WORK/TaskID_Video.mp4" */
  mediaRef?: string;

  // Injection Optimization
  /** Injection molding specific parameters */
  injectionParams?: InjectionParams;

  // Shadow Tasks
  /** If true, task happens DURING machine cycle (curing) */
  isMachineInternal?: boolean;

  // Machine Resource Reference (v4.0+)
  /** Reference to MachineType.id from plant assets */
  requiredMachineId?: string;

  // Fixed Machine Time (v8.0+)
  /** Fixed chemical/physical process time in seconds (cannot be reduced by operators) */
  machineTimeFixed?: number;
  /** Number of molds/cavities for parallel processing */
  machineCapacity?: number;

  // V8.1: Process Constraint Flag (Injection, Curing, Thermal Processes)
  /**
   * When true, this task's time is a HARD FLOOR (physical/chemical constraint)
   * that cannot be reduced by adding operators. Only more machines/molds can
   * increase capacity. Typical uses: Injection molding, PU curing, ovens.
   *
   * If Takt < processTime and isProcessConstraint=true:
   *   - System must NOT suggest adding operators
   *   - System MUST require N = ceil(processTime / Takt) machines/molds
   *
   * @default false (manual/sewing operations can be parallelized with operators)
   */
  isProcessConstraint?: boolean;

  // =============================================================================
  // SIMULATION: Material Consumption (v1.0)
  // =============================================================================

  /**
   * Discrete materials consumed per production cycle
   * Each entry references a Material and specifies quantity per cycle
   * @example [{ materialId: 'SCREW-M6', quantityPerCycle: 4 }]
   */
  materials?: TaskMaterial[];

  /**
   * Continuous consumables (rolls, tape, wire) consumed per cycle
   * Each entry references a Material and specifies meters per cycle
   * @example [{ materialId: 'TAPE-50MM', metersPerCycle: 0.3 }]
   */
  continuousConsumables?: ContinuousConsumable[];
}

export interface Assignment {
  stationId: number;
  taskId: string;
}
