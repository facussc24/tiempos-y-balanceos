/**
 * AMFE ← PFD Import
 *
 * Converts PFD process steps into AMFE operations for the "Importar desde PFD"
 * button. Only operation and combined step types are imported (not transport,
 * storage, delay, etc.). Skips operations that already exist by opNumber.
 *
 * Optionally pre-creates a Machine work element if machineDeviceTool was set.
 */

import { v4 as uuidv4 } from 'uuid';
import { PfdDocument } from '../pfd/pfdTypes';
import { AmfeOperation, AmfeWorkElement } from './amfeTypes';

export interface AmfePfdImportResult {
    /** New operations to add to the AMFE */
    operations: AmfeOperation[];
    /** Warnings/info messages for the user */
    warnings: string[];
    /** Map of PFD step ID → newly created AMFE operation ID (for back-linking) */
    linkMap: Map<string, string>;
    /** Count of steps skipped because they already exist */
    skippedCount: number;
}

/** Step types that represent actual process operations (not logistics) */
const IMPORTABLE_STEP_TYPES = new Set(['operation', 'combined']);

/**
 * Import PFD steps as AMFE operations.
 *
 * @param pfdDoc - The PFD document to import from
 * @param existingOps - Current AMFE operations (to detect duplicates by opNumber)
 */
export function importAmfeOpsFromPfd(
    pfdDoc: PfdDocument,
    existingOps: AmfeOperation[],
): AmfePfdImportResult {
    const operations: AmfeOperation[] = [];
    const warnings: string[] = [];
    const linkMap = new Map<string, string>();
    let skippedCount = 0;

    // Build set of existing opNumbers for duplicate detection (normalized)
    const existingOpNumbers = new Set(
        existingOps.map(op => normalizeOpNumber(op.opNumber))
    );

    // Filter to importable steps
    const importableSteps = pfdDoc.steps.filter(
        step => IMPORTABLE_STEP_TYPES.has(step.stepType)
    );

    if (importableSteps.length === 0) {
        warnings.push('El PFD no tiene pasos de tipo Operación o Combinado para importar.');
        return { operations, warnings, linkMap, skippedCount };
    }

    for (const step of importableSteps) {
        const normalizedNum = normalizeOpNumber(step.stepNumber);

        // Skip if already exists
        if (existingOpNumbers.has(normalizedNum)) {
            skippedCount++;
            continue;
        }

        const opId = uuidv4();
        const workElements: AmfeWorkElement[] = [];

        // Pre-create Machine work element if machine was set in PFD
        if (step.machineDeviceTool?.trim()) {
            workElements.push({
                id: uuidv4(),
                type: 'Machine',
                name: step.machineDeviceTool.trim(),
                functions: [],
            });
        }

        const newOp: AmfeOperation = {
            id: opId,
            opNumber: step.stepNumber,
            name: step.description,
            workElements,
            linkedPfdStepId: step.id,
        };

        operations.push(newOp);
        linkMap.set(step.id, opId);

        // Mark as used so we don't import duplicates within the same PFD
        existingOpNumbers.add(normalizedNum);
    }

    // Summary warnings
    if (operations.length > 0) {
        warnings.push(`${operations.length} operación(es) importada(s) del PFD.`);
    }
    if (skippedCount > 0) {
        warnings.push(`${skippedCount} operación(es) omitida(s) porque ya existen en el AMFE.`);
    }

    return { operations, warnings, linkMap, skippedCount };
}

/** Normalize operation number for comparison: lowercase, trim, strip "OP " prefix */
function normalizeOpNumber(opNumber: string): string {
    return (opNumber || '').toLowerCase().trim().replace(/^op\s*/i, '');
}
