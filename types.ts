/**
 * Core Type Definitions for Barack Mercosul
 * 
 * This file contains all shared interfaces and types used throughout the application.
 * 
 * @module types
 * @version 7.0.0
 */

// ============================================================================
// SHIFT MANAGEMENT
// ============================================================================

/**
 * Represents a break period within a work shift
 * 
 * @example
 * ```typescript
 * const lunchBreak: ShiftBreak = {
 *   id: 'break-1',
 *   name: 'Almuerzo',
 *   startTime: '12:00',
 *   duration: 30
 * };
 * ```
 */
export interface ShiftBreak {
  /** Unique identifier for the break */
  id: string;
  /** Human-readable name (e.g., "Almuerzo", "Descanso") */
  name: string;
  /** Start time in "HH:mm" format */
  startTime: string;
  /** Duration in minutes */
  duration: number;
}

/**
 * Represents a work shift configuration
 * 
 * @example
 * ```typescript
 * const morningShift: Shift = {
 *   id: 1,
 *   name: 'Turno Mañana',
 *   startTime: '06:00',
 *   endTime: '14:00',
 *   breaks: [lunchBreak],
 *   plannedMinutes: 480,
 *   performanceFactor: 0.95
 * };
 * ```
 */
export interface Shift {
  /** Numeric identifier for the shift */
  id: number;
  /** Human-readable name (e.g., "Turno Mañana") */
  name: string;
  /** Start time in "HH:mm" format */
  startTime: string;
  /** End time in "HH:mm" format */
  endTime: string;
  /** Array of break periods during this shift */
  breaks: ShiftBreak[];
  /** Total planned working minutes (auto-calculated if not set) */
  plannedMinutes?: number;
  /** Performance factor for OEE calculation (0-1) */
  performanceFactor?: number;
}

// ============================================================================
// FATIGUE MANAGEMENT
// ============================================================================

/** Fatigue category for time study calculations */
export type FatigueCategory = 'none' | 'low' | 'standard' | 'high';

/** Fatigue options with display labels and multiplier factors */
export const FATIGUE_OPTIONS: { value: FatigueCategory; label: string; factor: number }[] = [
  { value: 'none', label: 'Sin Fatiga (0%)', factor: 0.00 },
  { value: 'low', label: 'Baja (9%)', factor: 0.09 },
  { value: 'standard', label: 'Estándar (14%)', factor: 0.14 },
  { value: 'high', label: 'Alta (18%)', factor: 0.18 },
];

// ============================================================================
// EXECUTION MODES
// ============================================================================

/** 
 * Execution mode for a task
 * - 'manual': Operator-performed task
 * - 'machine': Machine-performed task (requires machine assignment)
 * - 'injection': Injection molding task (special PU/RCR handling)
 */
export type ExecutionMode = 'manual' | 'machine' | 'injection';

// ============================================================================
// OEE AUDIT STRUCTURES
// ============================================================================

/**
 * OEE (Overall Equipment Effectiveness) audit log entry
 * Records a point-in-time measurement of equipment efficiency
 */
export interface OeeLog {
  /** Unique identifier for this log entry */
  id: string;
  /** Unix timestamp when the audit was performed */
  timestamp: number;
  /** Name of the analyst who performed the audit */
  analyst: string;
  /** Production batch identifier */
  batchId: string;
  /** Additional notes or observations */
  comments: string;

  // Inputs
  /** Planned production time in minutes */
  plannedTime: number;
  /** Downtime (unplanned stops) in minutes */
  downtime: number;
  /** Maximum theoretical capacity in Units per Hour */
  maxCapacity: number;
  /** Total units produced (including defects) */
  totalProduced: number;
  /** Units that passed quality control */
  goodProduced: number;

  // Results (Calculated snapshots)
  /** Availability factor (0-1) */
  availability: number;
  /** Performance factor (0-1) */
  performance: number;
  /** Quality factor (0-1) */
  quality: number;
  /** Final OEE = Availability × Performance × Quality */
  finalOee: number;
}

// ============================================================================
// SECTOR MANAGEMENT
// ============================================================================

/**
 * Represents a production sector/area in the plant
 * 
 * Sectors group related workstations and can have their own OEE targets.
 * Used for visual organization and Mix module loop classification.
 * 
 * @example
 * ```typescript
 * const costuraSection: Sector = {
 *   id: 'sector-1',
 *   name: 'Costura',
 *   color: '#10B981',
 *   loop: 'Preparación',
 *   targetOee: 0.85
 * };
 * ```
 */
export interface Sector {
  /** Unique identifier for the sector */
  id: string;
  /** Human-readable name (e.g., "Costura", "Inyección") */
  name: string;
  /** Hex color code for visual identification */
  color: string;

  /**
   * Sequence number for ordering (1 = first sector in flow)
   * Used to sort stations in simulator by process order
   * @example 1=Corte, 2=Costura, 3=Tapizado, 4=Ensamble
   */
  sequence?: number;

  /** 
   * Loop/stage classification for Mix module
   * Used to group sectors in Yamazumi charts
   */
  loop?: 'Preparación' | 'Ensamble' | 'Finalización' | string;

  /** Target OEE for this sector (0-1), overrides global OEE */
  targetOee?: number;

  /** Most recent OEE audit log (for form pre-fill) */
  lastLog?: OeeLog;

  /** Historical OEE audit entries */
  history?: OeeLog[];
}


// --- OPTIMAL CAVITY CALCULATOR PARAMS ---
export interface ManualOperation {
  id: string;
  description: string;
  time: number; // Seconds
  refCavities?: number; // Optional: If defined, time is variable based on this quantity. If 0/undefined, time is fixed per cycle.
  type?: 'internal' | 'external'; // Default 'internal'. External adds to cycle (stops machine). Internal overlaps.
}

export interface InjectionParams {
  productionVolume: number;

  // PU Specifics (RCR Module)
  pInyectionTime?: number; // t_iny (min/molde) converted to seconds
  pCuringTime?: number; // t_cur (min/pieza) converted to seconds

  investmentRatio: number; // "Hours of Machine" equivalent to 1 Cavity

  // Updated Logic for PU/Realism

  // Explicit Operator Interaction Time (Sum of sub-tasks)
  manualInteractionTime?: number;

  // NEW: Breakdown of manual tasks inside the cycle
  manualOperations?: ManualOperation[];

  optimalCavities: number;

  // PERSISTENCE STATE
  cavityMode?: 'auto' | 'manual';
  userSelectedN?: number;
  headcountMode?: 'auto' | 'manual';
  userHeadcount?: number;

  // Calculated Real Cycle Time (Phase 25 - for balancing)
  realCycle?: number;
}

// --- MMALBP (Mixed Model Balancing) TYPES [v2.0] ---
export interface ProductModel {
  id: string; // UUID
  name: string; // "Modelo A", "Sedan"
  percentage: number; // 0.0 - 1.0 (Sum must generally be 1.0)
  color?: string; // Hex for UI differentiation
  units?: number; // v2.1: Quantity in pieces (UI persistence)

  /**
   * Scrap/defect rate for this product model (0.00 - 0.20)
   * Used to inflate demand automatically to account for expected losses.
   * 
   * Formula: Adjusted_Demand = Base_Demand / (1 - scrapRate)
   * 
   * @example 0.03 = 3% scrap → produces 103 to deliver 100
   * @default 0 (no scrap adjustment)
   * @version 5.1.0 - Phase 1 Completion
   */
  scrapRate?: number;
}


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

// =============================================================================
// MATERIAL & CONSUMABLE MANAGEMENT (Simulation v1.0)
// =============================================================================

/**
 * Supply mode for materials at line-side
 * - LINE_SIDE_BIN: Discrete pieces in bins/boxes (tracked by piece count)
 * - LINE_SIDE_ROLL: Continuous material on rolls (tracked by meters)
 * - BULK_UNLIMITED: Unlimited supply, no tracking (e.g., air, electricity)
 */
export type MaterialSupplyMode = 'LINE_SIDE_BIN' | 'LINE_SIDE_ROLL' | 'BULK_UNLIMITED';

/**
 * Represents a consumable material used in production tasks
 * 
 * @example
 * ```typescript
 * const screw: Material = {
 *   id: 'MAT-001',
 *   name: 'Tornillo M6x20',
 *   unit: 'pieces',
 *   piecesPerContainer: 100,
 *   supplyMode: 'LINE_SIDE_BIN',
 *   alertThreshold: 0.25
 * };
 * ```
 */
export interface Material {
  /** Unique identifier (e.g., "MAT-001", "TORNILLO-M6") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Unit of measure */
  unit: 'pieces' | 'meters' | 'kg' | 'liters';
  /** Qbin - quantity per container (pieces, meters, or kg) */
  piecesPerContainer: number;
  /** How the material is supplied to the line */
  supplyMode: MaterialSupplyMode;

  // Optional metadata
  /** Supplier part number for traceability */
  supplierPartNumber?: string;
  /** Cost per unit for efficiency calculations */
  costPerUnit?: number;
  /** Warning threshold (0-1), alerts when below this % of capacity */
  alertThreshold?: number;
}

/**
 * Links a material to a task with consumption quantity per cycle
 * Used for discrete piece consumables (screws, clips, brackets)
 */
export interface TaskMaterial {
  /** Reference to Material.id */
  materialId: string;
  /** Number of pieces consumed per production cycle */
  quantityPerCycle: number;

  // =========================================================================
  // MILK RUN LOGISTICS (v9.0)
  // =========================================================================

  /**
   * Number of pieces per bin/container at line-side
   * Used for Kanban calculation: K = D × (T + Safety) / standardPack
   * @default Uses global LogisticsConfig.piecesPerContainer if undefined
   */
  standardPack?: number;

  /**
   * Override replenishment cycle time in minutes for this specific material
   * @default Uses global LogisticsConfig.milkRunCycleSeconds / 60 if undefined
   */
  replenishmentMinutes?: number;

  /**
   * Safety buffer time in minutes for Kanban calculation
   * Accounts for variability in Milk Run delivery
   * @default 5 minutes if undefined
   */
  safetyMinutes?: number;
}

/**
 * Continuous consumable for roll/length-based materials
 * Used for tape, wire, fabric, tubing, etc.
 */
export interface ContinuousConsumable {
  /** Reference to Material.id */
  materialId: string;
  /** Meters consumed per production cycle */
  metersPerCycle: number;
}

// =============================================================================
// PRODUCT INHERITANCE: Override system for child products (v9.0)
// =============================================================================

/**
 * Override of a task inherited from a parent product.
 * Only fields present are overwritten; others inherit from parent.
 * 
 * Use case: "Puerta Derecha" inherits from "Puerta Izquierda"
 * but overrides specific task times or materials.
 * 
 * @example
 * ```typescript
 * const override: TaskOverride = {
 *   taskId: 'CLIP-CABLES',
 *   standardTime: 35,          // Override time
 *   materials: [{ materialId: 'SKU-R', quantityPerCycle: 1 }], // Override materials
 *   // excluded: false          // Omitted = inherited from parent
 * };
 * ```
 */
export interface TaskOverride {
  /** ID of the parent task to modify */
  taskId: string;
  /** New standard time in seconds (replaces parent value) */
  standardTime?: number;
  /** New materials array (replaces parent array completely) */
  materials?: TaskMaterial[];
  /** If true, this task is excluded from the child product */
  excluded?: boolean;
}

// =============================================================================
// FIX 3: ZONING CONSTRAINTS (Must-Include / Must-Exclude)
// =============================================================================

/**
 * Constraint type for zoning relationships between tasks.
 * - 'must_include': Tasks MUST be in the same station (share expensive machine)
 * - 'must_exclude': Tasks MUST NOT be in the same station (safety/incompatibility)
 */
export type ZoningConstraintType = 'must_include' | 'must_exclude';

/**
 * Defines a hard constraint between two tasks for line balancing.
 * 
 * These constraints are enforced as HARD rules - solutions that violate
 * them are rejected entirely (fitness = Infinity), not just penalized.
 * 
 * @example
 * ```typescript
 * // These two welding tasks must share the same station (single welding robot)
 * const mustInclude: ZoningConstraint = {
 *   id: 'zc-1',
 *   taskA: 'WELD-A',
 *   taskB: 'WELD-B',
 *   type: 'must_include',
 *   reason: 'Comparten robot de soldadura única'
 * };
 * 
 * // Painting and grinding cannot be together (safety - sparks near paint)
 * const mustExclude: ZoningConstraint = {
 *   id: 'zc-2',
 *   taskA: 'PAINT-001',
 *   taskB: 'GRIND-001',
 *   type: 'must_exclude',
 *   reason: 'Seguridad - chispas cerca de pintura'
 * };
 * ```
 */
export interface ZoningConstraint {
  /** Unique identifier for this constraint */
  id: string;
  /** First task in the constraint pair */
  taskA: string;
  /** Second task in the constraint pair */
  taskB: string;
  /** Type of constraint: must share station or must not share station */
  type: ZoningConstraintType;
  /** Optional human-readable explanation for this constraint */
  reason?: string;
}

// =============================================================================
// FIX 7: WIP BUFFER (IPK - In-Process Kanban)
// =============================================================================

/**
 * WIP Buffer (In-Process Kanban) configuration between stations
 * FIX 7: Absorbs process variability and prevents blocking/starving
 * 
 * Buffer is placed AFTER the station (toward next station) to decouple
 * stations and absorb micro-variations in cycle time.
 * 
 * @example
 * ```typescript
 * const buffer: IPKBufferConfig = {
 *   size: 2,
 *   reason: 'bottleneck',
 *   isManual: false
 * };
 * ```
 */
export interface IPKBufferConfig {
  /** Recommended buffer size in pieces (1-3 typical) */
  size: number;
  /** Reason for buffer placement */
  reason: 'bottleneck' | 'high_saturation' | 'man_machine_interface';
  /** Whether user manually overrode the recommendation */
  isManual?: boolean;
}

/**

 * Per-material buffer state at a station
 * Tracks inventory, reorder policies, and replenishment
 */
export interface StationMaterialBuffer {
  /** Reference to Material.id */
  materialId: string;
  /** Initial number of boxes/containers on rack */
  boxesOnRackInitial: number;
  /** Target number of boxes (Kanban max) */
  boxesTarget: number;
  /** Reorder trigger policy */
  reorderPolicy: 'KANBAN' | 'MIN_MAX' | 'MANUAL';
  /** How replenishment is triggered/executed */
  replenishmentPolicy: 'MILK_RUN' | 'ANDON_CALL' | 'SCHEDULED';

  // For rolls/continuous materials
  /** Alert when autonomy falls below X minutes */
  alertAutonomyMinutes?: number;
}

// --- VSM MODULE: LOGISTICS DATA STRUCTURES [v3.0] ---
export type VsmProcessType = 'continuous' | 'batch' | 'injection';

// --- VSM v4.0: Door-to-Door External Nodes ---
export type VSMNodeType = 'supplier' | 'customer' | 'production_control';

export interface VSMExternalNode {
  id: string;
  type: VSMNodeType;
  name: string;
  position?: { x: number; y: number }; // For diagram rendering

  // Supplier-specific fields
  deliveryFrequency?: 'daily' | 'weekly' | 'monthly' | string;
  deliveryQty?: number;        // Pieces per delivery
  supplierLeadTimeDays?: number; // Raw material lead time

  // Customer-specific fields
  demandDaily?: number;        // Links to meta.dailyDemand by default
  shippingFrequency?: string;  // "Diario", "Por lote"
  containerQty?: number;       // Pieces per shipping container

  // Production Control-specific fields
  planningSystem?: 'mrp' | 'kanban' | 'heijunka' | 'manual';
  forecastHorizon?: string;    // "30 días", "Semanal"
}

export interface VSMInfoFlow {
  id: string;
  from: string;                // Node ID (external or station)
  to: string;                  // Node ID (external or station)
  flowType: 'electronic' | 'manual' | 'verbal';
  label?: string;              // "Forecast 30d", "Orden diaria"
  frequency?: string;          // "Diario", "Semanal", "Por lote"
}

export interface StationLogistics {
  binCapacity: number;        // Pieces per bin/container
  currentBins: number;        // Observed WIP bins
  targetBufferHours: number;  // Coverage target (default: 1h)
  snapshotTimestamp?: number; // When the data was captured
  processType: VsmProcessType;
  transportTimeSeconds?: number; // Optional transport time to next station

  // VSM v10.0: Direct physical piece count for Current State mode
  // When provided, this value OVERRIDES the calculated (currentBins × binCapacity)
  // Use this for accurate Current State VSM based on Gemba Walk floor counts
  physicalPieceCount?: number;

  // VSM v3.1: Information flow type
  infoFlowType?: 'push' | 'pull'; // Default: 'push' (Programa/Verbal)

  // VSM v4.0: Supermarket support
  inventoryType?: 'triangle' | 'supermarket'; // △ (Push/uncontrolled) vs E (Pull/controlled)
  maxBins?: number;       // Max limit for Supermarket (Kanban ceiling)
  reorderPoint?: number;  // Trigger level for replenishment signal

  // Phase 6: Roll configuration for continuous consumables (tape, wire, etc.)
  rollConfig?: {
    materialId: string;
    materialName: string;
    metersPerRoll: number;
    alertAutonomyMin: number;
    scrapFactor?: number;
    metersPerCycle: number;
    unit?: 'pieces' | 'meters' | 'grams' | 'liters';
  };
}



export interface StationConfig {
  id: number;
  name?: string;
  oeeTarget: number; // 0-1 (Individual OEE)
  replicas?: number; // Number of parallel resources (Multi-manning). Default 1.
  availability?: number;
  performance?: number;
  quality?: number;
  effectiveTime?: number; // V4.2: Actual weighted time content of the station

  // VSM v3.1: Tiempo de cambio de modelo (Setup/Changeover)
  changeoverTime?: number; // Segundos (default: 0)

  // v7.0: Manual cycle time override (seconds)
  // If set, this value is used instead of calculated task sum
  cycleTimeOverride?: number;

  // VSM Logistics (Optional - v3.0)
  logistics?: StationLogistics;

  // Phase 2: Kanban Configuration
  kanban?: {
    kanbanCount: number;        // K - number of containers
    idealPieces: number;        // Total ideal inventory (K × C)
    reorderPoint: number;       // Trigger level for replenishment
    containerCapacity: number;  // Pieces per container
    safetyMargin: number;       // SS as decimal (0.15 = 15%)
    replenishmentTimeHours: number; // RT in hours
  };

  // v8.0: Pacemaker / Output Logistics (Expert-validated)
  // Pitch = Takt × Pack-out Quantity (defines Mizusumashi rhythm)
  isPacemaker?: boolean;        // True if this is the pacemaker process (typically last station)
  packOutQuantity?: number;     // Pieces per container/pack for shipping

  // =============================================================================
  // SIMULATION: Per-Material Buffer Tracking (v1.0)
  // =============================================================================

  /**
   * Dictionary of material buffers at this station
   * Key is Material.id, value is the buffer configuration
   * @example { 'SCREW-M6': { boxesOnRackInitial: 3, boxesTarget: 5, ... } }
   */
  materialBuffers?: Record<string, StationMaterialBuffer>;

  // =============================================================================
  // FIX 7: WIP BUFFER (Decoupling Buffer)
  // =============================================================================

  /**
   * WIP Buffer AFTER this station (toward next station)
   * Used to decouple stations and absorb process variability.
   * Prevents Blocking/Starving propagation in high-efficiency lines.
   * 
   * @see IPKBufferConfig
   */
  wipBuffer?: IPKBufferConfig;
}

// =============================================================================
// V4.0: PLANT ASSET REGISTRY
// =============================================================================

export type MachineCategory = 'costura' | 'inyeccion' | 'ensamble' | 'otro';

export interface MachineType {
  id: string;                    // "PFAFF-001"
  name: string;                  // "Máquina Recta Industrial"
  sectorId: string;              // Reference to Sector.id
  /** @deprecated Category is now derived from sector. Kept for backward compatibility. */
  category?: MachineCategory;
  availableUnits: number;        // How many in plant (1-10)
  quantity?: number;             // T-07 FIX: Alias for availableUnits (legacy support)
  oeeBase?: number;              // Default OEE for this machine (0-1)
}

export interface PlantConfig {
  version: 1;
  lastModified: number;
  sectors: Sector[];             // Master list of sectors
  machines: MachineType[];       // Master list of machines
  savedMixScenarios?: MixSavedScenario[];  // V5.0: Saved Mix scenarios history
}

export const DEFAULT_PLANT_CONFIG: PlantConfig = {
  version: 1,
  lastModified: Date.now(),
  sectors: [
    { id: 'COSTURA', name: 'Costura', color: '#8B5CF6' },
    { id: 'INYECCION', name: 'Inyección', color: '#F59E0B' },
    { id: 'TAPIZADO', name: 'Tapizado', color: '#10B981' },
    { id: 'EMBALAJE', name: 'Embalaje', color: '#6366F1' }
  ],
  machines: [],
  savedMixScenarios: []
};

// =============================================================================
// V4.0: MIX SCENARIO
// =============================================================================

export interface MixProductReference {
  path: string;           // Relative path to product JSON
  demand: number;         // Daily demand for this product
  percentage?: number;    // Calculated: demand / totalDemand

  // V8.3: Integrity validation
  sourceChecksum?: string;    // SHA-256 of critical task/time data
  lastVerifiedAt?: string;    // ISO timestamp of last verification
}

export interface MixScenario {
  type: 'mix_scenario';
  version: 1;
  name: string;
  createdAt: string;
  createdBy: string;

  products: MixProductReference[];
  totalDemand: number;

  // V8.3: Integrity validation metadata
  integrityVersion?: number;   // 1 = checksums enabled
  lastIntegrityCheck?: string; // ISO timestamp of last validation

  // Sector filter (optional - null = all sectors)
  targetSectorId?: string | null;

  // Balancing results (populated after calculation)
  results?: {
    totalOperators: number;
    calculatedAt: string;
    taktTime: number;
    stations: Array<{
      id: number;
      sectorId: string;
      tasks: string[];  // Task IDs
      weightedTime: number;
      productBreakdown: Record<string, number>; // productPath -> time contribution
    }>;
  };

  // Heijunka alert
  heijunkaWarning?: {
    enabled: boolean;
    sequence: string;  // "A-A-B-A-A-B"
    rationale: string;
  };
}

// =============================================================================
// V4.2: MIX SECTOR ANALYSIS (Sector-Based UX)
// =============================================================================

export interface ProductContribution {
  productPath: string;
  productName: string;
  color: string;
  timeContribution: number;    // Weighted seconds this product adds
  percentageOfTotal: number;   // 0-100
}

export interface MachineRequirement {
  machineId: string;
  machineName: string;
  unitsRequired: number;       // ceil(totalTime / takt)
  unitsAvailable: number;      // From plantConfig inventory
  hasDeficit: boolean;
  totalWeightedTime: number;   // Sum of all task times
  saturationPerUnit: number;   // (time / (N * takt)) * 100
  productBreakdown: ProductContribution[];
  taskDescriptions: string[];  // Human-readable task names
}

export interface SectorRequirement {
  sectorId: string;
  sectorName: string;
  sectorColor: string;
  totalPuestos: number;        // Sum of all machine units
  machines: MachineRequirement[];
  manualOperators: number;     // Tasks without requiredMachineId
}

export interface MixSectorAnalysis {
  sectors: SectorRequirement[];
  totalPuestos: number;
  totalOperators: number;
  hasAnyDeficit: boolean;
  taktTime: number;
  totalDemand: number;
}

// V4.3: Parallel Station Alert (tasks requiring 2+ parallel workstations)
export interface ParallelStationAlert {
  productName: string;
  taskId: string;
  taskDescription: string;
  taskTime: number;
  taktTime: number;
  parallelStationsNeeded: number;  // ceil(taskTime / takt)
}

// Keep TaktViolation as alias for backward compatibility
export type TaktViolation = ParallelStationAlert;

// V5.0: Saved Mix Scenario (for persistence)
export interface MixSavedScenario {
  type: 'mix_saved_scenario';
  version: 1;
  id: string;                        // UUID
  name: string;                      // "Mix 2026-01-10"
  createdAt: string;                 // ISO timestamp

  // Inputs
  selectedProducts: Array<{
    path: string;
    name: string;
    demand: number;
  }>;
  totalDemand: number;
  setupMinutesPerShift?: number;  // V4.2: Tiempo de setup (opcional)

  // Results (from MixSimplifiedResult)
  result: MixSimplifiedResult;
}

export interface ProjectData {
  id?: number; // IndexedDB ID
  fileHandle?: FSFileHandle | string; // Transient: FileSystemFileHandle or Tauri path
  directoryHandle?: FSDirectoryHandle | string; // Transient: FileSystemDirectoryHandle or Tauri path
  _loadedTimestamp?: number; // Transient: Last Modified Time from Disk (Concurrency Check)
  _checksum?: string; // Transient: SHA-256 Hash of content on load (Strict Concurrency Check)

  // v2 Encryption Metadata (persisted in JSON)
  encryption?: {
    version: 2;
    kdf: 'PBKDF2';
    iterations: number;
    hash: 'SHA-256';
    salt: string;  // Base64 encoded
    algo: 'AES-GCM';
    keyId?: string; // Optional identifier for corporate shared secrets
    encryptedFields: string[]; // List of encrypted field paths (e.g., 'meta.client')
  };

  meta: {
    name: string;
    date: string;
    client: string;
    client_encrypted?: boolean; // Flag for encrypted field
    project?: string; // V8.4: Proyecto (ej: "RCR", "HDC") para estructura Cliente/Proyecto/Pieza

    // V9.0: Product Inheritance (Parent/Child)
    /** Relative path to parent JSON file (if this is a child variant) */
    parentPath?: string;
    version: string;
    engineer: string;
    engineer_encrypted?: boolean; // Flag for encrypted field
    modifiedBy?: string; // Name of person who saved the revision
    modifiedBy_encrypted?: boolean; // Flag for encrypted field
    logo?: string; // Base64 string for custom logo
    activeShifts: number; // 1-3
    manualOEE: number; // 0-1 (Global OEE)
    useManualOEE: boolean; // true = Global, false = Per Station/Sector

    // Toggles between "Detailed per Station" vs "Weighted per Sector"
    useSectorOEE?: boolean;

    dailyDemand: number;
    targetInventoryDays?: number; // VSM Coach: Threshold for "excess inventory" alert (default: 3)

    // Section E2.2: Demand Variability / Bullwhip Effect Detection
    demandHistory?: number[]; // Last N days of actual demand for CV calculation

    // V8.1: Setup/Changeover Loss for Batched Production
    /**
     * Percentage of available time lost to model changeovers (0-0.20 = 0-20%).
     * Used in Mix/Heijunka scenarios where batch production consumes capacity.
     * 
     * Formula: Takt_effective = (AvailableTime × (1 - setupLossPercent)) / Demand
     * 
     * @example 0.10 = 10% of shift time dedicated to setup/changeover
     * @default 0 (no setup loss assumed)
     */
    setupLossPercent?: number;

    configuredStations: number; // Manual override for number of stations displayed

    // --- GLOBAL CALCULATOR STATE [FIX #11] ---
    injectionDefaults?: {
      pInyectionTime: number;
      pCuringTime: number;
      manualOperations: ManualOperation[];
    };

    // v2.0 MMALBP Mix Definition
    activeModels?: ProductModel[];

    // Phase 4: Hybrid Station Configuration (RC-ALBP)
    /**
     * If true, allows mixing different machine types in the same station
     * with a time penalty. If false (default), machine mixing is blocked.
     * @default false
     */
    allowHybridStations?: boolean;

    /**
     * Time penalty in seconds added when mixing machine types in a station.
     * Only applies when allowHybridStations is true.
     * @default 5
     */
    hybridStationPenalty?: number;

    // Phase 5: SALBP-2 (Smooth Flow) Configuration
    /**
     * Balancing mode selection:
     * - 'SALBP1': Minimize stations given Takt (default, "Save People")
     * - 'SALBP2': Minimize cycle time given N operators ("Smooth Flow")
     * @default 'SALBP1'
     */
    balancingMode?: 'SALBP1' | 'SALBP2';

    /**
     * Target number of operators for SALBP-2 mode.
     * Only used when balancingMode is 'SALBP2'.
     * @default 8
     */
    targetOperators?: number;

    /**
     * Detailed objective for SALBP-2:
     * - 'MAX_THROUGHPUT': Reduce Cycle Time (Standard SALBP-2)
     * - 'SMOOTH_WORKLOAD': Minimize Variance (Heijunka)
     * @default 'MAX_THROUGHPUT'
     */
    balancingObjective?: 'MAX_THROUGHPUT' | 'SMOOTH_WORKLOAD';

    /**
     * Disable sector affinity optimization for pure SALBP validation.
     * When true, the balancing algorithm ignores sector preferences and
     * treats all tasks as if they have no sectorId.
     * Useful for academic SALBP benchmarks and regression tests.
     * @default false
     */
    disableSectorAffinity?: boolean;

    /**
     * Takt time tolerance factor for feasibility check.
     * Controls how much stations can exceed takt before requiring more stations.
     * - 1.0 = strict (pure SALBP, no overflow)
     * - 1.05 = default (5% overflow allowed for practicality)
     * @default 1.05
     */
    taktTolerance?: number;

    /**
     * Station capacity limit mode:
     * - 'oee': Uses effectiveSeconds (Takt × OEE) as hard limit — conservative/safe (default)
     * - 'nominal': Uses nominalSeconds (Takt) as hard limit — permissive, with OEE warning
     * 
     * In 'nominal' mode, stations may exceed the OEE limit but stay within Takt.
     * This reduces unnecessary multi-manning when OEE losses are managed externally.
     * 
     * @default 'oee'
     */
    capacityLimitMode?: 'oee' | 'nominal';

    /**
     * Global Fatigue Supplement Configuration (OIT Standard)
     * Applied as a safety margin for human physiological needs and recovery.
     * 
     * When enabled, tasks with fatigueCategory='none' receive this global percentage.
     * Tasks with individual fatigue categories use their own values (priority).
     * Machine/injection tasks are always excluded (physical/chemical times).
     * 
     * @example
     * fatigueCompensation: { enabled: true, globalPercent: 10 }
     * // All manual tasks without fatigue category get +10%
     * 
     * @version 10.0.0 - Global Fatigue Supplement
     */
    fatigueCompensation?: {
      /** Master switch to enable/disable global compensation */
      enabled: boolean;
      /** Percentage supplement (0-30), default 10 (OIT minimum) */
      globalPercent: number;
    };
  };
  shifts: Shift[];
  sectors: Sector[]; // List of defined sectors
  tasks: Task[];
  assignments: Assignment[];
  stationConfigs: StationConfig[]; // Per-station configuration

  // FIX 3: Zoning constraints for hard constraint validation
  /**
   * Hard constraints between tasks for line balancing.
   * - must_include: Tasks must share the same station
   * - must_exclude: Tasks must be in different stations
   * @see ZoningConstraint
   */
  zoningConstraints?: ZoningConstraint[];

  lastModified?: number;


  // --- VSM v4.0: Door-to-Door Architecture ---
  vsmExternalNodes?: VSMExternalNode[];  // Supplier, Customer, Production Control
  vsmInfoFlows?: VSMInfoFlow[];          // Information flow arrows

  // V4.1: Plant Configuration (Machines for RC-ALBP)
  plantConfig?: PlantConfig;

  // =============================================================================
  // SIMULATION: Materials Catalog (v1.0)
  // =============================================================================

  /**
   * Global catalog of materials used in this project
   * Tasks reference these by Material.id in their materials[] array
   */
  materials?: Material[];

  // =============================================================================
  // PRODUCT INHERITANCE: Task Overrides (v9.0)
  // =============================================================================

  /**
   * Task overrides for child products (only when parentPath is set)
   * Each override modifies a specific task inherited from the parent.
   * 
   * @example
   * ```typescript
   * taskOverrides: [
   *   { taskId: 'CLIP-CABLES', standardTime: 35, materials: [...] },
   *   { taskId: 'OTRO-TASK', excluded: true }  // Disable this task
   * ]
   * ```
   */
  taskOverrides?: TaskOverride[];
}

// =============================================================================
// T-01 to T-05 FIX: MixEnrichedProduct for type-safe mix calculations
// =============================================================================

/**
 * Extended ProjectData with mix-specific runtime properties.
 * Used during MMALBP calculations to attach demand and percentage data.
 */
export interface MixEnrichedProduct extends ProjectData {
  _mixDemand?: number;      // Daily demand for this product in the mix
  _mixPath?: string;        // File path (relative or absolute)
  _mixPercentage?: number;  // Calculated: demand / totalDemand
}

// --- FILE SYSTEM TYPES ---
export interface FSItem {
  name: string;
  kind: 'file' | 'directory';
  // Note: `any` is intentional here for cross-platform interop (Web FileSystemHandle vs Tauri path)
  handle: any;
}

// =============================================================================
// H-06 Fix: Unified File Handle Types (Web FileSystem API vs Tauri Paths)
// =============================================================================

/**
 * Union type for file handles:
 * - Web mode: FileSystemFileHandle (browser API)
 * - Tauri mode: string (file path)
 */
export type FSFileHandle = FileSystemFileHandle | string;

/**
 * Union type for directory handles:
 * - Web mode: FileSystemDirectoryHandle (browser API)
 * - Tauri mode: string (directory path)
 */
export type FSDirectoryHandle = FileSystemDirectoryHandle | string;

/**
 * Type guard: Check if handle is a Tauri path (string)
 */
export function isTauriPath(handle: FSFileHandle | FSDirectoryHandle | null | undefined): handle is string {
  return typeof handle === 'string';
}

/**
 * Type guard: Check if handle is a Web FileSystemFileHandle
 */
export function isWebFileHandle(handle: FSFileHandle | null | undefined): handle is FileSystemFileHandle {
  return handle !== null && handle !== undefined && typeof handle !== 'string' && 'getFile' in handle;
}

/**
 * Type guard: Check if handle is a Web FileSystemDirectoryHandle
 */
export function isWebDirectoryHandle(handle: FSDirectoryHandle | null | undefined): handle is FileSystemDirectoryHandle {
  return handle !== null && handle !== undefined && typeof handle !== 'string' && 'getDirectoryHandle' in handle;
}

export const INITIAL_PROJECT: ProjectData = {
  meta: {
    name: "Nuevo Proyecto",
    date: new Date().toISOString().split('T')[0],
    client: "",
    version: "Borrador", // Starts as Draft, becomes Rev A on first official save
    engineer: "",
    activeShifts: 1,
    manualOEE: 0.85,
    useManualOEE: true,
    useSectorOEE: false, // Default off
    dailyDemand: 1000,
    configuredStations: 1,
    activeModels: [
      { id: 'default', name: 'Modelo Estándar', percentage: 1.0, color: '#3b82f6' }
    ],
    // Global Fatigue Supplement (OIT Standard 10-15%)
    fatigueCompensation: {
      enabled: true,
      globalPercent: 10,
    },
  },
  shifts: [
    {
      id: 1,
      name: "Turno 1",
      startTime: "06:00",
      endTime: "15:00",
      breaks: [{ id: "b1", name: "Descanso", startTime: "11:00", duration: 60 }],
    },
    {
      id: 2,
      name: "Turno 2",
      startTime: "15:00",
      endTime: "23:00",
      breaks: [{ id: "b2", name: "Descanso", startTime: "19:00", duration: 45 }],
    },
    {
      id: 3,
      name: "Turno 3",
      startTime: "23:00",
      endTime: "06:00",
      breaks: [{ id: "b3", name: "Descanso", startTime: "03:00", duration: 45 }],
    },
  ],
  sectors: [],
  tasks: [],
  assignments: [],
  stationConfigs: [],
  vsmExternalNodes: [],  // VSM v4.0
  vsmInfoFlows: [],      // VSM v4.0
};

export const EXAMPLE_PROJECT: ProjectData = {
  meta: {
    name: "SALBP-1 Verification",
    date: new Date().toISOString().split('T')[0],
    client: "Validation",
    version: "Test",
    engineer: "AI",
    activeShifts: 1,
    manualOEE: 1.0,
    useManualOEE: false,
    dailyDemand: 200,
    configuredStations: 1,
  },
  shifts: [
    { id: 1, name: "Turno 1", startTime: "00:00", endTime: "07:30", breaks: [], plannedMinutes: 450 }
  ],
  sectors: [],
  tasks: [
    { id: "T1", description: "Manual 1", times: [15], averageTime: 15, ratingFactor: 100, fatigueCategory: 'standard', standardTime: 15, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' },
    { id: "T2", description: "Manual 2", times: [20], averageTime: 20, ratingFactor: 100, fatigueCategory: 'standard', standardTime: 20, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' },
    { id: "T3", description: "Manual 3", times: [45], averageTime: 45, ratingFactor: 100, fatigueCategory: 'standard', standardTime: 45, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' },
    { id: "T4", description: "Manual 4", times: [10], averageTime: 10, ratingFactor: 100, fatigueCategory: 'standard', standardTime: 10, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' },
    { id: "T5", description: "Machine", times: [120], averageTime: 120, ratingFactor: 100, fatigueCategory: 'standard', standardTime: 120, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'machine' },
    { id: "T6", description: "Absorbed Manual", times: [70], averageTime: 70, ratingFactor: 100, fatigueCategory: 'standard', standardTime: 70, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual', isMachineInternal: true, concurrentWith: "T5" },
    { id: "T7", description: "Manual 7", times: [15], averageTime: 15, ratingFactor: 100, fatigueCategory: 'standard', standardTime: 15, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' },
    { id: "T8", description: "Manual 8", times: [30], averageTime: 30, ratingFactor: 100, fatigueCategory: 'standard', standardTime: 30, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' },
    { id: "T9", description: "Manual 9", times: [25], averageTime: 25, ratingFactor: 100, fatigueCategory: 'standard', standardTime: 25, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' },
  ],
  assignments: [],
  stationConfigs: [],
};

// --- INJECTION SIMULATION TYPES ---

export interface InjectionSimulationParams {
  puInyTime: number;
  puCurTime: number;
  manualOps: ManualOperation[];
  manualTimeOverride: number | null;
  taktTime: number;
  headcountMode: 'auto' | 'manual';
  userHeadcountOverride: number;
  activeShifts: number;
  oee: number;
  cycleQuantity?: number; // New param for normalization
  availableSeconds?: number; // FIX Bug #4: Pre-calculated from real shift config
}

export interface InjectionScenario {
  n: number;
  totalShotTime: number;
  cyclePerPiece: number;
  manualLimitCycle: number;
  waitOp: number;
  realCycle: number;
  isFeasible: boolean;
  isSingleMachineFeasible: boolean;
  barColor: string;
  machineStatus: string;
  reqOperators: number;
  machinesNeeded: number;
  reqCavities: number; // New for Zero CapEx Logic
  dailyOutput: number;
  manualTime: number;
  isOversaturated: boolean; // If N > N* (Machine limit)
  isFatigueRisk?: boolean; // If Saturation > 85% but accepted (Smart ROI)
  nStar: number;
}

// =============================================================================
// MIX REDESIGN V2 - Nuevos Tipos (Fase 1)
// Estos tipos soportan la UI simplificada sin modificar la lógica existente
// =============================================================================

/**
 * Producto seleccionable para Mix (vista simplificada)
 * Representa un producto en la grilla de selección con checkbox
 */
export interface MixSelectableProduct {
  path: string;              // Ruta al master.json
  displayName: string;       // Nombre visible (normalmente el nombre de la pieza)
  client: string;            // Cliente
  project: string;           // Proyecto
  part: string;              // Pieza
  dailyDemand: number;       // Pre-cargada del master.json
  isSelected: boolean;       // Estado de selección en UI
  isDefaultDemand?: boolean; // V5.3: true si la demanda es valor por defecto (no encontrada en archivo)
}

/**
 * Representación simplificada de una máquina en un sector
 */
export interface MixMachineCard {
  machineId: string;
  machineName: string;
  unitsRequired: number;
  unitsAvailable: number;
  hasDeficit: boolean;
  deficitMessage?: string;   // Mensaje en español simple
}

/**
 * Tarjeta de sector en resultados (vista simplificada)
 * Agrupa máquinas y operarios por zona de la planta
 */
export interface MixSectorCard {
  sectorId: string;
  sectorName: string;
  sectorColor: string;
  machines: MixMachineCard[];
  operatorsRequired: number;
  isShared: boolean;           // true si múltiples productos usan este sector
  sharedProducts: string[];    // nombres de productos que comparten
  alerts: string[];            // alertas en lenguaje simple
}

/**
 * Resultado simplificado de Mix para UI
 * Traduce los resultados técnicos a formato comprensible
 */
export interface MixSimplifiedResult {
  isViable: boolean;           // false si hay déficits o bloqueos
  taktTimeSeconds: number;     // Tiempo Takt calculado
  totalMachines: number;       // Total de máquinas necesarias
  totalOperators: number;      // Total de operarios necesarios
  sectors: MixSectorCard[];    // Resultados agrupados por sector
  summary: string;             // Resumen en una oración (español)
  warnings: string[];          // Alertas en lenguaje simple
  productBreakdown: Array<{    // Contribución de cada producto
    productName: string;
    percentage: number;
    color: string;
  }>;

  // V4.2: Expert feedback - process constraint violations (química, curado)
  processViolations?: Array<{
    taskId: string;
    taskDescription: string;
    requiredMachines: number;
    deficit: number;
    message: string;
  }>;

  // V4.2: Expert feedback - model-specific Takt violations
  modelAlerts?: Array<{
    modelName: string;
    taskId: string;
    taskDescription: string;
    message: string;
    severity: 'critical' | 'warning' | 'ok';
  }>;
}

/**
 * Estado de la vista de Mix V2
 */
export interface MixV2ViewState {
  step: 'select' | 'calculating' | 'results';
  selectedProducts: MixSelectableProduct[];
  result: MixSimplifiedResult | null;
  isLoading: boolean;
  error: string | null;
}
