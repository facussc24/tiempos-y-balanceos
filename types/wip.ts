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

  // v1-beta: Manual cycle time override (seconds)
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
