/**
 * PFD Step Normalization
 *
 * Extracted to its own module so that both the PFD UI hook (usePfdDocument)
 * and the repository layer (pfdRepository) can import it without creating
 * a circular dependency.
 *
 * @module pfdNormalize
 */

import type { PfdStep } from './pfdTypes';
import { createEmptyStep } from './pfdTypes';

/**
 * C3-N1: Normalize a step loaded from old/incomplete format (backward compat).
 *
 * Merges defaults from createEmptyStep() so that any field added in a later
 * schema version is always present with a safe default value.
 */
export function normalizePfdStep(raw: Record<string, unknown> & { id: string }): PfdStep {
    const base = createEmptyStep();
    const step = { ...base, ...raw } as PfdStep;

    // Old docs may not have rejectDisposition -- derive from isRework
    if (!step.rejectDisposition || (step.rejectDisposition === 'none' && step.isRework)) {
        step.rejectDisposition = step.isRework ? 'rework' : 'none';
    }
    if (step.scrapDescription === undefined || step.scrapDescription === null) {
        step.scrapDescription = '';
    }

    // C9-N1: Branch fields for parallel flows
    if (step.branchId === undefined || step.branchId === null) {
        step.branchId = '';
    }
    if (step.branchLabel === undefined || step.branchLabel === null) {
        step.branchLabel = '';
    }

    // Cycle time (backward compat: old docs may not have it)
    if (step.cycleTimeMinutes !== undefined && step.cycleTimeMinutes !== null) {
        step.cycleTimeMinutes = typeof step.cycleTimeMinutes === 'number' ? step.cycleTimeMinutes : undefined;
    }

    return step;
}
