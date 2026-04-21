import type { Shift } from './shifts';
import type { Sector, ManualOperation, ProductModel } from './sectors';
import type { Task, Assignment } from './tasks';
import type { Material } from './materials';
import type { TaskOverride } from './inheritance';
import type { ZoningConstraint } from './zoning';
import type { StationConfig, VSMExternalNode, VSMInfoFlow } from './wip';
import type { PlantConfig } from './plant';
import type { FSFileHandle, FSDirectoryHandle } from './fs';

export interface ProjectData {
  id?: number; // auto-generated ID
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
    piecesPerVehicle?: number; // Piezas necesarias por vehículo (default: 1). Permite calcular demanda en vehículos.
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
  injectionMode?: 'batch' | 'carousel'; // Batch = sequential (Iny+Cur/N), Carousel = parallel (MAX(Iny,Cur/N))
  indexTime?: number; // Carousel rotation time between stations (seconds)
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
