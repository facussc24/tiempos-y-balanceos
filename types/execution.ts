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
