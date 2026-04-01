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
    HoStep,
    PpeItem,
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

/** Infer basic PPE from operation name using regex patterns. */
function inferSafetyElements(opName: string): PpeItem[] {
    const n = (opName || '').toLowerCase();
    if (/soldadura|soldar|weld/.test(n))        return ['anteojos', 'guantes', 'delantal', 'proteccionAuditiva'];
    if (/pintura|e-coat|lacado|paint/.test(n))   return ['respirador', 'guantes', 'anteojos'];
    if (/prensa|estampado|corte|troquel/.test(n)) return ['anteojos', 'guantes', 'proteccionAuditiva'];
    if (/inspecci[oó]n|medici[oó]n|control/.test(n)) return ['anteojos', 'zapatos'];
    return ['anteojos', 'zapatos'];
}

/** Create a stub step for a generated sheet. */
function createStubStep(opName: string): HoStep {
    return {
        id: uuidv4(),
        stepNumber: 1,
        description: `Realizar ${opName}`,
        isKeyPoint: false,
        keyPointReason: '',
    };
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
        applicableParts: amfeDoc.header.applicableParts || '',
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

        // Deduplicate by normalized characteristic (CP may have duplicate items)
        const seenChars = new Set<string>();
        const dedupedChecks: HoQualityCheck[] = [];
        for (const qc of qualityChecks) {
            const key = (qc.characteristic || '').trim().toLowerCase().replace(/\s+/g, ' ');
            if (!key || seenChars.has(key)) continue;
            seenChars.add(key);
            dedupedChecks.push(qc);
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
            safetyElements: inferSafetyElements(op.name),
            hazardWarnings: [],
            steps: [createStubStep(op.name)],
            qualityChecks: dedupedChecks,
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
            `Los ciclos de control están vacíos — genere primero el Plan de Control.`
        );
    } else if (opsWithoutCp > 0) {
        warnings.push(
            `${opsWithoutCp} operación(es) no tienen ítems en el Plan de Control. ` +
            `Sus ciclos de control estarán vacíos.`
        );
    }

    warnings.push(
        `Hojas de Operaciones generadas: ${sheets.length} hoja(s) con ${totalChecks} verificación(es) de calidad ` +
        `a partir de ${amfeDoc.operations.length} operación(es) AMFE.`
    );

    return { document: { header, sheets }, warnings };
}

// ============================================================================
// MERGE TYPES
// ============================================================================

export interface HoMergeStats {
    sheetsMatched: number;
    sheetsAdded: number;
    sheetsOrphaned: number;
    qcMatched: number;
    qcAdded: number;
    qcOrphaned: number;
}

export interface HoMergeResult {
    document: HoDocument;
    stats: HoMergeStats;
    warnings: string[];
}

// ============================================================================
// MERGE FUNCTION
// ============================================================================

/**
 * Merge a freshly generated HO document with an existing one, preserving
 * local user-entered data (steps, visual aids, PPE, metadata) while updating
 * inherited fields from AMFE/CP.
 *
 * Matching: sheets matched by operationNumber, then by amfeOperationId.
 * QCs within sheets matched by cpItemId.
 *
 * Unmatched existing sheets/QCs are marked orphaned and appended at the end.
 */
export function mergeHoWithExisting(
    generated: HoDocument,
    existing: HoDocument,
): HoMergeResult {
    const warnings: string[] = [];
    const stats: HoMergeStats = {
        sheetsMatched: 0,
        sheetsAdded: 0,
        sheetsOrphaned: 0,
        qcMatched: 0,
        qcAdded: 0,
        qcOrphaned: 0,
    };

    // --- Build indexes for existing sheets ---
    const existingByOpNum = new Map<string, HojaOperacion>();
    const existingByAmfeOpId = new Map<string, HojaOperacion>();

    for (const sheet of existing.sheets) {
        const opKey = sheet.operationNumber.trim();
        if (opKey) existingByOpNum.set(opKey, sheet);
        if (sheet.amfeOperationId) existingByAmfeOpId.set(sheet.amfeOperationId, sheet);
    }

    const matchedSheetIds = new Set<string>();
    const resultSheets: HojaOperacion[] = [];

    // --- Process each generated sheet ---
    for (const genSheet of generated.sheets) {
        // Try to find a matching existing sheet
        let existingSheet: HojaOperacion | undefined =
            existingByOpNum.get(genSheet.operationNumber.trim());

        if (!existingSheet || matchedSheetIds.has(existingSheet.id)) {
            existingSheet = existingByAmfeOpId.get(genSheet.amfeOperationId);
        }

        // Only accept if not already matched
        if (existingSheet && matchedSheetIds.has(existingSheet.id)) {
            existingSheet = undefined;
        }

        if (existingSheet) {
            // --- Match found: merge sheet ---
            matchedSheetIds.add(existingSheet.id);

            // Start from existing, update inherited fields from generated
            const mergedSheet: HojaOperacion = {
                ...existingSheet,
                // Inherited fields (from AMFE/CP via generator)
                amfeOperationId: genSheet.amfeOperationId,
                operationNumber: genSheet.operationNumber,
                operationName: genSheet.operationName,
                hoNumber: genSheet.hoNumber,
                partCodeDescription: genSheet.partCodeDescription,
                vehicleModel: genSheet.vehicleModel,
                reactionContact: genSheet.reactionContact,
                // Preserve local fields from existing (spread already covers them):
                // steps, visualAids, safetyElements, hazardWarnings, sector,
                // puestoNumber, preparedBy, approvedBy, date, revision, status,
                // reactionPlanText
                orphaned: false,
            };

            // --- QC merge within the sheet ---
            const existingQcByCpItemId = new Map<string, HoQualityCheck>();
            for (const qc of existingSheet.qualityChecks) {
                if (qc.cpItemId) {
                    existingQcByCpItemId.set(qc.cpItemId, qc);
                }
            }

            const matchedQcIds = new Set<string>();
            const mergedQcs: HoQualityCheck[] = [];

            for (const genQc of genSheet.qualityChecks) {
                // Defensive: skip QCs without cpItemId (treat as new)
                if (!genQc.cpItemId) {
                    mergedQcs.push(genQc);
                    stats.qcAdded++;
                    continue;
                }

                const existingQc = existingQcByCpItemId.get(genQc.cpItemId);

                if (existingQc && !matchedQcIds.has(existingQc.id)) {
                    // QC matched: keep existing id and registro, update inherited fields
                    matchedQcIds.add(existingQc.id);
                    mergedQcs.push({
                        ...existingQc,
                        // Inherited fields from CP
                        characteristic: genQc.characteristic,
                        specification: genQc.specification,
                        evaluationTechnique: genQc.evaluationTechnique,
                        frequency: genQc.frequency,
                        controlMethod: genQc.controlMethod,
                        reactionAction: genQc.reactionAction,
                        reactionContact: genQc.reactionContact,
                        specialCharSymbol: genQc.specialCharSymbol,
                        cpItemId: genQc.cpItemId,
                        orphaned: false,
                    });
                    stats.qcMatched++;
                } else {
                    // No match: use generated QC as-is (new)
                    mergedQcs.push(genQc);
                    stats.qcAdded++;
                }
            }

            // Unmatched existing QCs → orphaned
            for (const existingQc of existingSheet.qualityChecks) {
                if (!matchedQcIds.has(existingQc.id)) {
                    mergedQcs.push({
                        ...existingQc,
                        orphaned: true,
                    });
                    stats.qcOrphaned++;
                }
            }

            mergedSheet.qualityChecks = mergedQcs;
            stats.sheetsMatched++;
            resultSheets.push(mergedSheet);
        } else {
            // --- No match: use generated sheet as-is ---
            resultSheets.push(genSheet);
            stats.sheetsAdded++;
            stats.qcAdded += genSheet.qualityChecks.length;
        }
    }

    // --- Unmatched existing sheets → orphaned ---
    for (const existingSheet of existing.sheets) {
        if (!matchedSheetIds.has(existingSheet.id)) {
            resultSheets.push({
                ...existingSheet,
                orphaned: true,
            });
            stats.sheetsOrphaned++;
            stats.qcOrphaned += existingSheet.qualityChecks.length;
        }
    }

    // --- Sort: by parseInt(operationNumber), orphaned sheets last ---
    resultSheets.sort((a, b) => {
        const aOrphaned = a.orphaned ? 1 : 0;
        const bOrphaned = b.orphaned ? 1 : 0;
        if (aOrphaned !== bOrphaned) return aOrphaned - bOrphaned;
        const numA = parseInt(a.operationNumber) || 0;
        const numB = parseInt(b.operationNumber) || 0;
        return numA - numB;
    });

    // --- Warnings ---
    if (stats.sheetsOrphaned > 0) {
        warnings.push(
            `${stats.sheetsOrphaned} hoja(s) de operaciones ya no tienen operación AMFE correspondiente (marcadas como huérfanas).`
        );
    }

    warnings.push(
        `Merge HO: ${stats.sheetsMatched} hojas actualizadas, ${stats.sheetsAdded} nuevas, ${stats.sheetsOrphaned} huérfanas. ` +
        `QCs: ${stats.qcMatched} actualizados, ${stats.qcAdded} nuevos, ${stats.qcOrphaned} huérfanos.`
    );

    return {
        document: { header: generated.header, sheets: resultSheets },
        stats,
        warnings,
    };
}
