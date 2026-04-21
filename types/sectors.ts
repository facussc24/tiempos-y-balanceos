import type { Shift } from './shifts';
import type { OeeLog } from './oee';

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

  /** Per-sector shift override (independent Takt calculation) */
  shiftOverride?: {
    /** Number of active shifts for this sector (1-3), overrides meta.activeShifts */
    activeShifts: number;
    /** Optional custom shift definitions for this sector */
    shifts?: Shift[];
  };

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

  // Injection mode: batch (sequential) or carousel (parallel)
  injectionMode?: 'batch' | 'carousel';

  // Carousel index time (rotation between stations, seconds)
  indexTime?: number;
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
