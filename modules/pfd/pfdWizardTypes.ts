/**
 * PFD Wizard Types — Annotation types collected during the generation wizard.
 *
 * These types are ephemeral (wizard-only) and map to the standard PfdDocument
 * output via pfdSmartGenerator. They are NOT persisted.
 */

import type { PfdStepType, RejectDisposition, TransportMode } from './pfdTypes';

/** Per-operation annotation collected in wizard step 1 */
export interface PfdOperationAnnotation {
    /** AMFE operation ID */
    operationId: string;
    /** User-overridden step type (or auto-inferred) */
    stepType: PfdStepType;
    /** Whether this is an external/outsourced process */
    isExternal: boolean;
    /** Whether to include this operation in the PFD (default true) */
    included: boolean;
}

/** A group of operations assigned to a parallel branch */
export interface PfdBranchGroup {
    /** Branch identifier: 'A', 'B', 'C', 'D' */
    branchId: string;
    /** Human-readable label (e.g., "Linea Soldadura") */
    branchLabel: string;
    /** AMFE operation IDs in this branch, in order */
    operationIds: string[];
}

/** An inspection point inserted between operations */
export interface PfdInspectionAnnotation {
    /** Unique ID for this annotation */
    id: string;
    /** Insert inspection after this AMFE operation ID */
    afterOperationId: string;
    /** Description of the inspection step */
    description: string;
    /** Reject disposition: rework, scrap, sort, or none */
    rejectDisposition: RejectDisposition;
    /** For rework: which operation step number to return to */
    reworkReturnStep: string;
    /** For scrap/sort: description of criteria */
    scrapDescription: string;
    /** Whether this inspection was auto-detected from AMFE operation names */
    autoDetected?: boolean;
}

/** All annotations collected across the 4 wizard steps */
export interface PfdWizardAnnotations {
    /** Per-operation overrides from step 1 */
    operations: PfdOperationAnnotation[];
    /** Parallel branch groups from step 2 */
    branches: PfdBranchGroup[];
    /** Inspection points from step 3 */
    inspections: PfdInspectionAnnotation[];
    /** Transport step insertion mode (cross-sector recommended per AIAG) */
    transportMode: TransportMode;
    /** Whether to add bookend storage steps (receiving + shipping) */
    addBookendSteps: boolean;
}

/** Available branch IDs for parallel flows */
export const BRANCH_IDS = ['A', 'B', 'C', 'D'] as const;

/** Default annotations for a fresh wizard */
export function createDefaultAnnotations(): PfdWizardAnnotations {
    return {
        operations: [],
        branches: [],
        inspections: [],
        transportMode: 'cross-sector',
        addBookendSteps: true,
    };
}
