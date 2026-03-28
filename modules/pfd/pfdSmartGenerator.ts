/**
 * PFD Smart Generator — Wizard-annotated PFD generation from AMFE document
 *
 * Enhanced replacement for the basic generatePfdFromAmfe() when using the
 * generation wizard. Reads user annotations (step overrides, branches,
 * inspections, bookend/transport toggles) to produce a more accurate PFD.
 *
 * Pure function, no React deps. Follows the same style as pfdGenerator.ts.
 */

import type { AmfeDocument } from '../amfe/amfeTypes';
import type {
    PfdWizardAnnotations,
    PfdOperationAnnotation,
    PfdBranchGroup,
    PfdInspectionAnnotation,
} from './pfdWizardTypes';
import type { PfdDocument, PfdStep, PfdStepType, TransportMode } from './pfdTypes';
import { createEmptyStep } from './pfdTypes';
import {
    inferStepType,
    extractMachine,
    extractSpecialChar,
    extractProductCharacteristic,
    extractProcessCharacteristic,
    buildPfdHeader,
} from './pfdGenerator';
import { inferDepartment } from '../../utils/processCategory';

// ============================================================================
// TYPES
// ============================================================================

/** Result of smart PFD generation, including any warnings. */
export interface SmartPfdGenerationResult {
    document: PfdDocument;
    warnings: string[];
}

// ============================================================================
// ANNOTATION BUILDER (wizard initialization)
// ============================================================================

/**
 * Pre-build operation annotations from AMFE operations with default values.
 * Used by the wizard to initialize step 1 so the user can override.
 *
 * Defaults: included=true, isExternal=false, stepType=inferred from name.
 */
export function buildOperationAnnotations(amfeDoc: AmfeDocument): PfdOperationAnnotation[] {
    if (!amfeDoc.operations || amfeDoc.operations.length === 0) return [];

    return amfeDoc.operations.map((op) => ({
        operationId: op.id,
        stepType: inferStepType(op.name || ''),
        isExternal: false,
        included: true,
    }));
}

// ============================================================================
// AUTO-DETECT INSPECTIONS FROM AMFE
// ============================================================================

/**
 * Extended regex for detecting inspection-like operations.
 * Catches patterns beyond what inferStepType detects, including tool-specific names.
 */
const INSPECTION_PATTERN = /inspecci[oó]n|verific|control\s*(por|de|con|visual|dimensional)|control.*calidad|medici[oó]n|ensayo|prueba|galga|mylar|calibre|torqu[ií]metro|auditor[ií]a|audit\b|muestreo/i;

/**
 * Try to infer reject disposition from an inspection operation name.
 * Returns a reasonable default based on common patterns.
 */
function inferRejectDisposition(opName: string): 'none' | 'rework' | 'scrap' | 'sort' {
    const n = (opName || '').toLowerCase();
    // Visual/dimensional/mylar/galga inspections typically lead to sorting
    if (/muestreo|selecci[oó]n|clasific|sort/.test(n)) return 'sort';
    // Rework patterns
    if (/retrabajo|rework|reproceso/.test(n)) return 'rework';
    return 'none';
}

/**
 * Auto-detect operations that are inspections and generate inspection annotations.
 * Looks at:
 * 1. Operations whose inferred stepType is 'inspection' or 'combined'
 * 2. Operations whose name matches inspection patterns (control, verificacion,
 *    medicion, ensayo, mylar, galga, etc.)
 *
 * These become PfdInspectionAnnotation entries placed AFTER the PREVIOUS
 * non-inspection operation in the AMFE sequence.
 *
 * If an inspection operation is the first in the AMFE (no previous non-inspection
 * operation), it is skipped since there is no operation to attach it after.
 */
export function autoDetectInspections(amfeDoc: AmfeDocument): PfdInspectionAnnotation[] {
    if (!amfeDoc.operations || amfeDoc.operations.length === 0) return [];

    const inspections: PfdInspectionAnnotation[] = [];
    let lastNonInspectionOpId: string | null = null;

    for (const op of amfeDoc.operations) {
        const opName = (op.name || '').trim();
        const stepType = inferStepType(opName);
        const isInspection = stepType === 'inspection' || stepType === 'combined'
            || INSPECTION_PATTERN.test(opName);

        if (isInspection) {
            // Only create an inspection annotation if we have a previous non-inspection op
            if (lastNonInspectionOpId) {
                inspections.push({
                    id: crypto.randomUUID(),
                    afterOperationId: lastNonInspectionOpId,
                    description: opName,
                    rejectDisposition: inferRejectDisposition(opName),
                    reworkReturnStep: '',
                    scrapDescription: '',
                    autoDetected: true,
                });
            }
            // Do NOT update lastNonInspectionOpId — inspections chain after the same parent
        } else {
            lastNonInspectionOpId = op.id;
        }
    }

    return inspections;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/** Find annotation for an AMFE operation, or undefined if none. */
function findAnnotation(
    annotations: PfdOperationAnnotation[],
    operationId: string,
): PfdOperationAnnotation | undefined {
    return annotations.find((a) => a.operationId === operationId);
}

/** Find the branch group that contains a given operation ID. */
function findBranchForOperation(
    branches: PfdBranchGroup[],
    operationId: string,
): PfdBranchGroup | undefined {
    return branches.find((b) => b.operationIds.includes(operationId));
}

/** Find all inspection annotations that fire after a given operation. */
function findInspectionsAfter(
    inspections: PfdInspectionAnnotation[],
    operationId: string,
): PfdInspectionAnnotation[] {
    return inspections.filter((insp) => insp.afterOperationId === operationId);
}

/** Build a transport step with the given description (no step number — connectors, not process steps). */
function buildTransportStep(
    description: string,
): PfdStep {
    return {
        ...createEmptyStep(''),
        stepType: 'transport',
        description,
    };
}

/** Parse numeric portion from an AMFE opNumber like "10", "OP 20", etc. */
function parseOpNum(opNumber: string): number {
    const match = opNumber.match(/(\d+)\s*$/);
    return match ? parseInt(match[1], 10) : 0;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate a PFD document using wizard annotations for enhanced accuracy.
 *
 * Improvements over the basic generator:
 * - User can override step types (wizard step 1)
 * - User can exclude operations from the PFD
 * - User can mark external/outsourced processes
 * - Parallel branches are assigned via wizard step 2
 * - Inspection points are inserted between operations (wizard step 3)
 * - Transport and bookend steps are optional toggles (wizard step 4)
 *
 * Step numbering:
 * - Transport steps: empty stepNumber (connectors, not process steps)
 * - Bookend storage: 'REC' for receiving, 'ENV' for shipping
 * - Operation steps: use AMFE opNumber directly (e.g., 'OP 10', 'OP 20')
 * - Inspection steps: intermediate number between parent and next operation
 */
export function generateSmartPfd(
    amfeDoc: AmfeDocument,
    amfeProjectName: string,
    annotations: PfdWizardAnnotations,
): SmartPfdGenerationResult {
    const warnings: string[] = [];
    const header = buildPfdHeader(amfeDoc, amfeProjectName);
    const steps: PfdStep[] = [];

    // --- Warn on empty annotations ---
    if (annotations.operations.length === 0 && amfeDoc.operations?.length > 0) {
        warnings.push(
            'Las anotaciones del wizard están vacías. Se usarán valores inferidos para todas las operaciones.'
        );
    }

    // --- Early exit: no operations ---
    if (!amfeDoc.operations || amfeDoc.operations.length === 0) {
        warnings.push('El AMFE no tiene operaciones definidas. El flujograma se generó vacío.');
        return {
            document: {
                id: crypto.randomUUID(),
                header,
                steps: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            warnings,
        };
    }

    // --- Pre-compute included operations for intermediate numbering ---
    const includedOps = amfeDoc.operations.filter((op) => {
        const ann = findAnnotation(annotations.operations, op.id);
        return !ann || ann.included;
    });

    // --- Resolve transport mode ---
    const transportMode: TransportMode = annotations.transportMode ?? 'cross-sector';

    // --- Bookend: Receiving storage ---
    if (annotations.addBookendSteps) {
        steps.push({
            ...createEmptyStep('REC'),
            stepType: 'storage',
            description: 'Recepción de materia prima',
            department: 'Almacén',
        });
    }

    // --- Map each AMFE operation ---
    let opsGenerated = 0;
    let opsSkipped = 0;
    let inspectionsGenerated = 0;
    let transportGenerated = 0;
    let prevDepartment = annotations.addBookendSteps ? 'Almacén' : '';
    let preForkDepartment = '';   // saved at fork point for branch resets
    let currentBranchId = '';     // track current branch for transition detection

    for (let i = 0; i < amfeDoc.operations.length; i++) {
        const op = amfeDoc.operations[i];
        const opName = (op.name || '').trim();
        const annotation = findAnnotation(annotations.operations, op.id);

        // --- Check inclusion ---
        if (annotation && !annotation.included) {
            opsSkipped++;
            warnings.push(
                `Operación "${opName || op.opNumber}" excluida del flujograma por el usuario.`
            );
            continue;
        }

        // --- Resolve step type: user override > inferred ---
        const stepType: PfdStepType = annotation?.stepType || inferStepType(opName);

        // --- Auto-infer department from operation name ---
        const department = inferDepartment(opName);

        // --- Resolve branch assignment (before transport, so transport inherits it) ---
        const branch = findBranchForOperation(annotations.branches, op.id);
        const branchId = branch?.branchId ?? '';

        // --- Detect branch transitions and reset prevDepartment ---
        if (branchId !== currentBranchId) {
            if (!currentBranchId && branchId) {
                // Fork: main → branch. Save fork department.
                preForkDepartment = prevDepartment;
            } else if (currentBranchId && branchId && branchId !== currentBranchId) {
                // Branch switch: A → B. Reset to fork department.
                prevDepartment = preForkDepartment;
            } else if (currentBranchId && !branchId) {
                // Join: branch → main. Reset to fork department.
                prevDepartment = preForkDepartment;
                preForkDepartment = '';
            }
            currentBranchId = branchId;
        }

        // --- Insert transport step (mode-aware) ---
        // Transport inherits branchId from the destination operation so that
        // FlowMap keeps it in the correct parallel lane.
        const shouldAddTransport =
            transportMode === 'all' ||
            (transportMode === 'cross-sector' && department && prevDepartment && department !== prevDepartment);

        if (shouldAddTransport) {
            const transportDesc = transportMode === 'cross-sector' && prevDepartment && department
                ? `Transporte de ${prevDepartment} a ${department}`
                : opName
                    ? `Transporte a ${opName}`
                    : `Transporte a operación ${op.opNumber || (i + 1)}`;
            const transportStep = buildTransportStep(transportDesc);
            if (branch) {
                transportStep.branchId = branch.branchId;
                transportStep.branchLabel = branch.branchLabel;
            }
            steps.push(transportStep);
            transportGenerated++;
        }

        // --- Extract AMFE data for the main step (guard null/undefined workElements) ---
        const weList = op.workElements || [];
        const machine = extractMachine(weList);
        const { productSpecialChar, processSpecialChar } = extractSpecialChar(weList);
        const productChar = extractProductCharacteristic(weList);
        const processChar = extractProcessCharacteristic(weList);

        // --- Use AMFE opNumber directly for the step number ---
        const opStepNumber = `OP ${op.opNumber || ((i + 1) * 10)}`;

        // --- Build the main operation step ---
        const mainStep: PfdStep = {
            ...createEmptyStep(opStepNumber),
            stepType,
            description: opName || `Operación ${op.opNumber || (i + 1)}`,
            machineDeviceTool: machine,
            productCharacteristic: productChar,
            productSpecialChar,
            processCharacteristic: processChar,
            processSpecialChar,
            department,
            isExternalProcess: annotation?.isExternal ?? false,
            linkedAmfeOperationId: op.id,
            branchId: branch?.branchId ?? '',
            branchLabel: branch?.branchLabel ?? '',
        };

        steps.push(mainStep);
        opsGenerated++;

        // Track department for cross-sector transport logic
        if (department) prevDepartment = department;

        // --- Warn if operation has no work elements ---
        if (!op.workElements || op.workElements.length === 0) {
            warnings.push(
                `Operación "${opName || op.opNumber}" no tiene elementos de trabajo (6M) definidos en el AMFE.`
            );
        }

        // --- Insert inspection steps after this operation ---
        const inspections = findInspectionsAfter(annotations.inspections, op.id);

        // Compute intermediate step number for inspections:
        // Find the next included operation's opNumber to place inspections between
        const currentOpNum = parseOpNum(op.opNumber || String((i + 1) * 10));
        const includedIdx = includedOps.indexOf(op);
        const nextIncluded = includedIdx >= 0 && includedIdx + 1 < includedOps.length
            ? includedOps[includedIdx + 1]
            : undefined;
        const nextOpNum = nextIncluded
            ? parseOpNum(nextIncluded.opNumber || String((amfeDoc.operations.indexOf(nextIncluded) + 1) * 10))
            : currentOpNum + 10;
        const rawGap = nextOpNum - currentOpNum;
        // Ensure enough room: if gap is too small, expand so inspections fit without collision
        const inspGap = Math.max(rawGap, inspections.length + 1);

        for (let inspIdx = 0; inspIdx < inspections.length; inspIdx++) {
            const insp = inspections[inspIdx];
            // Distribute inspection numbers evenly between current and next operation
            // Clamp to never reach nextOpNum (stay at nextOpNum - 1 at most)
            let inspNum = currentOpNum + Math.floor(inspGap * (inspIdx + 1) / (inspections.length + 1));
            if (rawGap > 0 && inspNum >= nextOpNum) {
                inspNum = nextOpNum - 1;
            }
            const inspStep: PfdStep = {
                ...createEmptyStep(`OP ${inspNum}`),
                stepType: 'inspection',
                description: insp.description || `Inspección después de ${opName}`,
                rejectDisposition: insp.rejectDisposition,
                reworkReturnStep: insp.reworkReturnStep || '',
                scrapDescription: insp.scrapDescription || '',
                department: department || 'Inspección',
                // Inherit branch from parent operation
                branchId: branch?.branchId ?? '',
                branchLabel: branch?.branchLabel ?? '',
            };
            steps.push(inspStep);
            inspectionsGenerated++;
        }
    }

    // --- Transport to shipping (conditional: skip when already in Almacén for cross-sector) ---
    if (transportMode === 'all' ||
        (transportMode === 'cross-sector' && prevDepartment && prevDepartment !== 'Almacén')) {
        const lastDept = prevDepartment;
        const shippingDesc = transportMode === 'cross-sector' && lastDept && lastDept !== 'Almacén'
            ? `Transporte de ${lastDept} a Almacén`
            : 'Transporte a almacenamiento';
        steps.push(buildTransportStep(shippingDesc));
        transportGenerated++;
    }

    // --- Bookend: Final storage ---
    if (annotations.addBookendSteps) {
        steps.push({
            ...createEmptyStep('ENV'),
            stepType: 'storage',
            description: 'Almacenamiento y envío al cliente',
            department: 'Almacén',
        });
    }

    // --- Warn if all operations were excluded ---
    if (opsGenerated === 0 && amfeDoc.operations.length > 0) {
        warnings.push(
            'Todas las operaciones fueron excluidas. El flujograma no contiene pasos de proceso.'
        );
    }

    // --- Summary warning ---
    const parts = [`${opsGenerated} operaciones`];
    if (transportGenerated > 0) parts.push(`${transportGenerated} transportes`);
    if (inspectionsGenerated > 0) parts.push(`${inspectionsGenerated} inspecciones`);
    if (opsSkipped > 0) parts.push(`${opsSkipped} excluidas`);
    const bookendCount = (annotations.addBookendSteps ? 2 : 0);
    if (bookendCount > 0) parts.push(`${bookendCount} almacenamiento`);
    warnings.push(
        `Flujograma generado: ${steps.length} pasos (${parts.join(' + ')}) ` +
        `a partir de ${amfeDoc.operations.length} operaciones AMFE.`
    );

    return {
        document: {
            id: crypto.randomUUID(),
            header,
            steps,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        warnings,
    };
}
