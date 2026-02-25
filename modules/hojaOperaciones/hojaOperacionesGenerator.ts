/**
 * Hoja de Operaciones Generator
 *
 * Generates HO sheets from an AMFE document + optional Control Plan.
 * One HojaOperacion per AMFE operation, with quality checks auto-filled from CP.
 *
 * Per NotebookLM/AIAG:
 * - The WI "consumes" CP data — it doesn't create quality parameters
 * - CP columns mapped to WI: specification, evaluationTechnique, sampleFrequency,
 *   controlMethod, reactionPlan, reactionPlanOwner, specialCharClass
 * - Data NOT copied to operator: AP, S-O-D, CP revision dates (engineering metadata)
 */

import { v4 as uuidv4 } from 'uuid';
import { AmfeDocument } from '../amfe/amfeTypes';
import { ControlPlanDocument, ControlPlanItem } from '../controlPlan/controlPlanTypes';
import {
    HoDocument,
    HoDocumentHeader,
    HojaOperacion,
    HoQualityCheck,
    EMPTY_HO_HEADER,
    DEFAULT_REACTION_PLAN_TEXT,
} from './hojaOperacionesTypes';

// ============================================================================
// TYPES
// ============================================================================

/** Result of generating HO sheets, including any warnings. */
export interface HoGenerationResult {
    document: HoDocument;
    warnings: string[];
}

// ============================================================================
// HELPERS
// ============================================================================

/** Build the part code + description string from AMFE header fields. */
function buildPartCodeDescription(partNumber: string, subject: string): string {
    const parts = [partNumber, subject].filter(Boolean);
    return parts.join(' / ');
}

/**
 * Map a ControlPlanItem to an HoQualityCheck.
 * Uses productCharacteristic if available, otherwise processCharacteristic.
 */
function cpItemToQualityCheck(cpItem: ControlPlanItem): HoQualityCheck {
    return {
        id: uuidv4(),
        characteristic: cpItem.productCharacteristic || cpItem.processCharacteristic || '',
        specification: cpItem.specification || '',
        evaluationTechnique: cpItem.evaluationTechnique || '',
        frequency: cpItem.sampleFrequency || '',
        controlMethod: cpItem.controlMethod || '',
        reactionAction: cpItem.reactionPlan || '',
        reactionContact: cpItem.reactionPlanOwner || '',
        specialCharSymbol: cpItem.specialCharClass || '',
        registro: '',
        cpItemId: cpItem.id,
    };
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate HO sheets from AMFE operations + Control Plan items.
 *
 * Creates one HojaOperacion per AMFE operation. For each operation,
 * filters CP items by matching processStepNumber and maps them to
 * quality checks that the operator sees on the work instruction.
 *
 * @param amfeDoc - Source AMFE document (provides operations + header)
 * @param cpDoc - Optional Control Plan (provides quality checks per operation)
 * @param amfeProjectName - Name of the AMFE project (for header linking)
 */
export function generateHoFromAmfeAndCp(
    amfeDoc: AmfeDocument,
    cpDoc: ControlPlanDocument | null,
    amfeProjectName: string,
): HoGenerationResult {
    const warnings: string[] = [];

    // --- Build header from AMFE ---
    const header: HoDocumentHeader = {
        ...EMPTY_HO_HEADER,
        organization: amfeDoc.header.organization || '',
        client: amfeDoc.header.client || '',
        partNumber: amfeDoc.header.partNumber || '',
        partDescription: amfeDoc.header.subject || '',
        linkedAmfeProject: amfeProjectName,
        linkedCpProject: cpDoc?.header.controlPlanNumber || '',
    };

    // --- Early exit: no operations ---
    if (amfeDoc.operations.length === 0) {
        warnings.push('El AMFE no tiene operaciones definidas. Agregue operaciones primero.');
        return { document: { header, sheets: [] }, warnings };
    }

    // --- Index CP items by processStepNumber for O(1) lookup ---
    const cpItemsByOp = new Map<string, ControlPlanItem[]>();
    if (cpDoc) {
        for (const item of cpDoc.items) {
            const key = item.processStepNumber.trim();
            if (!key) continue;
            const group = cpItemsByOp.get(key) || [];
            group.push(item);
            cpItemsByOp.set(key, group);
        }
    }

    // --- Generate one sheet per operation ---
    const sheets: HojaOperacion[] = [];
    let opsWithoutCp = 0;

    for (const op of amfeDoc.operations) {
        const qualityChecks: HoQualityCheck[] = [];

        // Find matching CP items
        const matchingCpItems = cpItemsByOp.get(op.opNumber.trim()) || [];

        // Map CP items to quality checks (skip items with empty characteristics)
        for (const cpItem of matchingCpItems) {
            const characteristic = cpItem.productCharacteristic || cpItem.processCharacteristic;
            if (!characteristic?.trim()) continue;
            qualityChecks.push(cpItemToQualityCheck(cpItem));
        }

        if (matchingCpItems.length === 0 && cpDoc) {
            opsWithoutCp++;
        }

        // Determine reaction contact from first CP item with a reactionPlanOwner
        const reactionContact = matchingCpItems.find(i => i.reactionPlanOwner?.trim())?.reactionPlanOwner || '';

        const sheet: HojaOperacion = {
            id: uuidv4(),
            amfeOperationId: op.id,
            operationNumber: op.opNumber,
            operationName: op.name,
            hoNumber: `HO-${op.opNumber}`,
            sector: '',
            puestoNumber: '',
            vehicleModel: amfeDoc.header.modelYear || '',
            partCodeDescription: buildPartCodeDescription(
                amfeDoc.header.partNumber || '',
                amfeDoc.header.subject || '',
            ),
            safetyElements: [],
            hazardWarnings: [],
            steps: [],
            qualityChecks,
            reactionPlanText: DEFAULT_REACTION_PLAN_TEXT,
            reactionContact,
            visualAids: [],
            preparedBy: '',
            approvedBy: '',
            date: new Date().toISOString().split('T')[0],
            revision: 'A',
            status: 'borrador',
        };

        sheets.push(sheet);
    }

    // --- Sort by operation number ---
    sheets.sort((a, b) => {
        const numA = parseInt(a.operationNumber) || 0;
        const numB = parseInt(b.operationNumber) || 0;
        return numA - numB;
    });

    // --- Warnings ---
    const totalChecks = sheets.reduce((sum, s) => sum + s.qualityChecks.length, 0);

    if (!cpDoc) {
        warnings.push(
            `Se generaron ${sheets.length} hoja(s) de operaciones sin Plan de Control vinculado. ` +
            `Los ciclos de control estan vacios — genere primero el Plan de Control.`
        );
    } else if (opsWithoutCp > 0) {
        warnings.push(
            `${opsWithoutCp} operacion(es) no tienen items en el Plan de Control. ` +
            `Sus ciclos de control estaran vacios.`
        );
    }

    warnings.push(
        `Hojas de Operaciones generadas: ${sheets.length} hoja(s) con ${totalChecks} verificacion(es) de calidad ` +
        `a partir de ${amfeDoc.operations.length} operacion(es) AMFE.`
    );

    return { document: { header, sheets }, warnings };
}
