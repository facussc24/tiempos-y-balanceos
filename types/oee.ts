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
