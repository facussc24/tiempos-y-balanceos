import type { TaskMaterial } from './materials';

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
