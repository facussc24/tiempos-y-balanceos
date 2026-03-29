/**
 * PFD ↔ AMFE Link Validation
 *
 * Pure functions that verify referential integrity between linked PFD steps
 * and AMFE operations. Detects broken links where:
 * - A PFD step's linkedAmfeOperationId points to a non-existent AMFE operation
 * - An AMFE operation's linkedPfdStepId points to a non-existent PFD step
 *
 * @module pfdAmfeLinkValidation
 */

import type { PfdDocument } from '../modules/pfd/pfdTypes';
import type { AmfeDocument } from '../modules/amfe/amfeTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrokenPfdLink {
    /** The PFD step with the broken link */
    stepId: string;
    stepNumber: string;
    stepDescription: string;
    /** The AMFE operation ID that doesn't exist */
    linkedAmfeOperationId: string;
}

export interface BrokenAmfeLink {
    /** The AMFE operation with the broken link */
    operationId: string;
    opNumber: string;
    operationName: string;
    /** The PFD step ID that doesn't exist */
    linkedPfdStepId: string;
}

export interface PfdAmfeLinkValidationResult {
    /** PFD steps pointing to non-existent AMFE operations */
    brokenPfdLinks: BrokenPfdLink[];
    /** AMFE operations pointing to non-existent PFD steps */
    brokenAmfeLinks: BrokenAmfeLink[];
    /** Total count of broken links */
    totalBroken: number;
    /** Whether both documents have valid data to check */
    isValid: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate referential integrity of links between a PFD document and an AMFE document.
 * Returns all broken links found in both directions.
 */
export function validatePfdAmfeLinks(
    pfdDoc: PfdDocument | null,
    amfeDoc: AmfeDocument | null,
): PfdAmfeLinkValidationResult {
    const brokenPfdLinks: BrokenPfdLink[] = [];
    const brokenAmfeLinks: BrokenAmfeLink[] = [];

    if (!pfdDoc || !amfeDoc || !amfeDoc.operations || !pfdDoc.steps) {
        return { brokenPfdLinks, brokenAmfeLinks, totalBroken: 0, isValid: false };
    }

    // Build lookup sets for fast existence checks
    const amfeOperationIds = new Set(amfeDoc.operations.map(op => op.id));
    const pfdStepIds = new Set(pfdDoc.steps.map(s => s.id));

    // Check PFD → AMFE direction
    for (const step of pfdDoc.steps) {
        if (step.linkedAmfeOperationId && !amfeOperationIds.has(step.linkedAmfeOperationId)) {
            brokenPfdLinks.push({
                stepId: step.id,
                stepNumber: step.stepNumber,
                stepDescription: step.description,
                linkedAmfeOperationId: step.linkedAmfeOperationId,
            });
        }
    }

    // Check AMFE → PFD direction
    for (const op of amfeDoc.operations) {
        if (op.linkedPfdStepId && !pfdStepIds.has(op.linkedPfdStepId)) {
            brokenAmfeLinks.push({
                operationId: op.id,
                opNumber: op.opNumber,
                operationName: op.name,
                linkedPfdStepId: op.linkedPfdStepId,
            });
        }
    }

    const totalBroken = brokenPfdLinks.length + brokenAmfeLinks.length;
    return { brokenPfdLinks, brokenAmfeLinks, totalBroken, isValid: true };
}

/**
 * Get PFD step IDs that have broken AMFE links (for UI highlighting).
 */
export function getBrokenPfdStepIds(result: PfdAmfeLinkValidationResult): Set<string> {
    return new Set(result.brokenPfdLinks.map(l => l.stepId));
}

/**
 * Get AMFE operation IDs that have broken PFD links (for UI highlighting).
 */
export function getBrokenAmfeOperationIds(result: PfdAmfeLinkValidationResult): Set<string> {
    return new Set(result.brokenAmfeLinks.map(l => l.operationId));
}

/**
 * Build candidate lists for re-linking.
 * Returns AMFE operations available to re-link from a PFD step,
 * and PFD steps available to re-link from an AMFE operation.
 */
export function getRelinkCandidates(
    pfdDoc: PfdDocument,
    amfeDoc: AmfeDocument,
): {
    amfeCandidates: { id: string; label: string }[];
    pfdCandidates: { id: string; label: string }[];
} {
    const amfeCandidates = amfeDoc.operations.map(op => ({
        id: op.id,
        label: `${op.opNumber} — ${op.name}`,
    }));

    const pfdCandidates = pfdDoc.steps
        .filter(s => s.stepType === 'operation' || s.stepType === 'combined' || s.stepType === 'inspection')
        .map(s => ({
            id: s.id,
            label: `${s.stepNumber} — ${s.description}`,
        }));

    return { amfeCandidates, pfdCandidates };
}
