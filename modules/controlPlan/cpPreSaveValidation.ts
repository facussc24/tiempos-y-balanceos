/**
 * CP Pre-Save Validation
 *
 * Validates Control Plan data before saving. Blocking errors prevent save;
 * warnings allow save but inform the user of potential issues.
 */

import type { ControlPlanDocument, ControlPlanItem } from './controlPlanTypes';
import type { AmfeDocument } from '../amfe/amfeTypes';
import type { SaveValidationResult } from '../../utils/repositories/validationTypes';

/** Specifications considered too generic or placeholder. */
const GENERIC_SPECS = ['tbd', 'según especificación', 'segun especificacion', 'conforme a especificación', 'conforme a especificacion'];

/** Evaluation techniques considered too vague without additional detail. */
const VAGUE_TECHNIQUES = ['visual', 'inspección', 'inspeccion'];

/**
 * Validate a Control Plan document before saving.
 * Returns { valid: true } if all blocking checks pass.
 */
export function validateCpBeforeSave(
    doc: ControlPlanDocument,
    amfeDoc?: AmfeDocument,
): SaveValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // B1: Reception items with empty componentMaterial
    warnings.push(...validateReceptionMaterial(doc));

    // B2: Specification too generic or empty
    warnings.push(...validateSpecificationQuality(doc));

    // B3: Product AND Process in same row (BLOCK)
    errors.push(...validateNoMixedCharacteristics(doc));

    // B4: evaluationTechnique too vague
    warnings.push(...validateEvaluationDetail(doc));

    // B5: Reception without P-14 in reactionPlan
    warnings.push(...validateReceptionReactionPlan(doc));

    // B6: CC/SC mismatch with AMFE
    if (amfeDoc) {
        warnings.push(...validateSpecialCharMismatch(doc, amfeDoc));
    }

    // B7: approvedBy and plantApproval both empty (BLOCK)
    errors.push(...validateApprovals(doc));

    return { valid: errors.length === 0, errors, warnings };
}

/** B1: Reception items (OP <= 10) should have componentMaterial populated. */
function validateReceptionMaterial(doc: ControlPlanDocument): string[] {
    const issues: string[] = [];
    for (const item of doc.items) {
        const opNum = parseInt(item.processStepNumber, 10);
        if (opNum <= 10 && !(item.componentMaterial || '').trim()) {
            issues.push(
                `OP ${item.processStepNumber} "${item.processDescription || ''}": item de recepcion sin componente/material`
            );
        }
    }
    return issues;
}

/** B2: Specification should not be TBD, generic placeholder, or empty. */
function validateSpecificationQuality(doc: ControlPlanDocument): string[] {
    const issues: string[] = [];
    for (const item of doc.items) {
        const hasCharacteristic = (item.productCharacteristic || '').trim() || (item.processCharacteristic || '').trim();
        if (!hasCharacteristic) continue; // no characteristic -> no spec needed

        const spec = (item.specification || '').trim().toLowerCase();
        if (!spec || GENERIC_SPECS.includes(spec)) {
            issues.push(
                `OP ${item.processStepNumber} "${item.productCharacteristic || item.processCharacteristic || ''}": especificacion generica o vacia`
            );
        }
    }
    return issues;
}

/** B3: Product and Process characteristics must NOT both be filled in the same row. */
function validateNoMixedCharacteristics(doc: ControlPlanDocument): string[] {
    const issues: string[] = [];
    for (const item of doc.items) {
        const hasProduct = (item.productCharacteristic || '').trim();
        const hasProcess = (item.processCharacteristic || '').trim();
        if (hasProduct && hasProcess) {
            issues.push(
                `OP ${item.processStepNumber}: producto ("${hasProduct}") y proceso ("${hasProcess}") en la misma fila — deben ser filas separadas`
            );
        }
    }
    return issues;
}

/** B4: evaluationTechnique should not be just "Visual" or "Inspeccion" without detail. */
function validateEvaluationDetail(doc: ControlPlanDocument): string[] {
    const issues: string[] = [];
    for (const item of doc.items) {
        const tech = (item.evaluationTechnique || '').trim().toLowerCase();
        if (VAGUE_TECHNIQUES.includes(tech)) {
            issues.push(
                `OP ${item.processStepNumber} "${item.productCharacteristic || item.processCharacteristic || ''}": tecnica de evaluacion demasiado generica ("${item.evaluationTechnique}") — especificar detalle`
            );
        }
    }
    return issues;
}

/** B5: Reception items (OP <= 10) should reference P-14 in reactionPlan. */
function validateReceptionReactionPlan(doc: ControlPlanDocument): string[] {
    const issues: string[] = [];
    for (const item of doc.items) {
        const opNum = parseInt(item.processStepNumber, 10);
        if (opNum <= 10 && !(item.reactionPlan || '').includes('P-14')) {
            issues.push(
                `OP ${item.processStepNumber} "${item.productCharacteristic || item.processCharacteristic || ''}": item de recepcion sin referencia a P-14 en plan de reaccion`
            );
        }
    }
    return issues;
}

/** B6: CC/SC in CP should match what the linked AMFE says. */
function validateSpecialCharMismatch(doc: ControlPlanDocument, amfeDoc: AmfeDocument): string[] {
    const issues: string[] = [];

    // Build map of AMFE cause ID -> specialChar
    const amfeCauseSpecialChar = new Map<string, string>();
    for (const op of amfeDoc.operations) {
        for (const we of op.workElements) {
            for (const func of we.functions) {
                for (const fail of func.failures) {
                    for (const cause of fail.causes) {
                        amfeCauseSpecialChar.set(cause.id, cause.specialChar || '');
                    }
                }
            }
        }
    }

    for (const item of doc.items) {
        if (!item.amfeCauseIds || item.amfeCauseIds.length === 0) continue;
        const cpClass = (item.specialCharClass || '').trim();

        for (const causeId of item.amfeCauseIds) {
            const amfeChar = amfeCauseSpecialChar.get(causeId);
            if (amfeChar === undefined) continue; // cause not found, skip
            if (cpClass !== amfeChar) {
                issues.push(
                    `OP ${item.processStepNumber} "${item.productCharacteristic || item.processCharacteristic || ''}": CP dice "${cpClass || 'estandar'}" pero AMFE dice "${amfeChar || 'estandar'}"`
                );
                break; // one mismatch per item is enough
            }
        }
    }

    return issues;
}

/** B7: Both approvedBy and plantApproval must not be empty. */
function validateApprovals(doc: ControlPlanDocument): string[] {
    const issues: string[] = [];
    const hasApproved = (doc.header.approvedBy || '').trim();
    const hasPlant = (doc.header.plantApproval || '').trim();
    if (!hasApproved && !hasPlant) {
        issues.push('Faltan ambas aprobaciones: Ingenieria (approvedBy) y Planta (plantApproval)');
    }
    return issues;
}
