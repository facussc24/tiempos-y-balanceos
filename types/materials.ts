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
