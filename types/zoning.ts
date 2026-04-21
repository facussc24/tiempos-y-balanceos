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
