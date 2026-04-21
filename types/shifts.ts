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
