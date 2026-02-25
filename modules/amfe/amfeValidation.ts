/**
 * AMFE Validation Utilities
 *
 * Provides input validation for S/O/D ratings, document schema validation
 * for imported JSON files, and migration from legacy formats.
 */

import { v4 as uuidv4 } from 'uuid';
import { AmfeDocument, AmfeFailure, AmfeCause, WorkElementType } from './amfeTypes';

/** Maximum recommended field length (warn above this). */
export const MAX_FIELD_LENGTH = 10_000;

/** Excel cell character limit. */
export const EXCEL_CELL_LIMIT = 32_767;

/** Soft limit: recommend splitting AMFE above this many operations. */
export const SOFT_LIMIT_OPERATIONS = 50;

/** Soft limit: recommend reviewing if a single failure has too many causes. */
export const SOFT_LIMIT_CAUSES_PER_FAILURE = 20;

/** Soft limit: total causes across the entire document. */
export const SOFT_LIMIT_TOTAL_CAUSES = 500;

/** Validation state for a cause row — used for inline color coding and warning icons. */
export interface CauseValidationState {
    level: 'error' | 'warning' | 'ok';
    messages: string[];
}

/**
 * Determine the validation state for a specific cause within a failure.
 * Used to drive inline color coding (red/yellow/green border) and warning tooltips.
 *
 * Rules:
 * - error: AP=H without any actions defined
 * - warning: AP=H with action but missing responsible/targetDate
 * - warning: S/O/D partially filled (some but not all 3)
 * - warning: severity >= 9 without CC in specialChar
 * - warning: status "Completado" without completionDate
 */
export function getCauseValidationState(failure: AmfeFailure, cause: AmfeCause): CauseValidationState {
    const messages: string[] = [];
    let level: 'error' | 'warning' | 'ok' = 'ok';

    const s = Number(failure.severity);
    const o = Number(cause.occurrence);
    const d = Number(cause.detection);
    const hasS = !isNaN(s) && s >= 1;
    const hasO = !isNaN(o) && o >= 1;
    const hasD = !isNaN(d) && d >= 1;

    // AP=H without ANY actions → error (blocking per AIAG-VDA)
    if (cause.ap === 'H' && !cause.preventionAction && !cause.detectionAction) {
        messages.push('AP Alto: requiere acciones de optimización');
        level = 'error';
    }

    // AP=H with action but missing responsible or target date → warning
    if (cause.ap === 'H' && (cause.preventionAction || cause.detectionAction)
        && (!cause.responsible || !cause.targetDate)) {
        messages.push('AP Alto: falta responsable o fecha objetivo');
        if (level !== 'error') level = 'warning';
    }

    // Partial S/O/D
    const filledCount = [hasS, hasO, hasD].filter(Boolean).length;
    if (filledCount > 0 && filledCount < 3) {
        messages.push('S/O/D incompletos');
        if (level !== 'error') level = 'warning';
    }

    // Severity >= 9 without CC
    if (hasS && s >= 9 && cause.specialChar !== 'CC') {
        messages.push('Severidad >= 9: debería tener característica CC');
        if (level !== 'error') level = 'warning';
    }

    // AP=M without actions and without justification in observations (AIAG-VDA normative)
    if (cause.ap === 'M' && !cause.preventionAction && !cause.detectionAction && !cause.observations) {
        messages.push('AP Medio sin acciones: documentar justificación en Observaciones');
        if (level !== 'error') level = 'warning';
    }

    // Completado without completion date
    if (cause.status === 'Completado' && !cause.completionDate) {
        messages.push('Estado Completado sin fecha de cierre');
        if (level !== 'error') level = 'warning';
    }

    // Text field length warnings
    const lengthFields: [string | undefined, string][] = [
        [cause.cause, 'Causa'],
        [cause.preventionAction, 'Accion preventiva'],
        [cause.detectionAction, 'Accion detectiva'],
        [cause.observations, 'Observaciones'],
    ];
    for (const [field, label] of lengthFields) {
        if (field && field.length > MAX_FIELD_LENGTH) {
            messages.push(`${label} demasiado largo (${field.length} caracteres)`);
            if (level !== 'error') level = 'warning';
        }
    }

    return { level, messages };
}

const VALID_WORK_ELEMENT_TYPES: WorkElementType[] = [
    'Machine', 'Man', 'Material', 'Method', 'Environment', 'Measurement'
];

/**
 * Validate and clamp an S/O/D rating value to the 1-10 integer range.
 */
export function clampSOD(value: string): number | '' {
    if (value === '' || value === undefined || value === null) return '';
    const num = Number(value);
    if (isNaN(num)) return '';
    const rounded = Math.round(num);
    if (rounded < 1) return 1;
    if (rounded > 10) return 10;
    return rounded;
}

/**
 * Validate an imported AMFE document against the expected schema.
 */
export function validateAmfeDocument(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['El archivo no contiene un objeto JSON válido.'] };
    }

    const doc = data as Record<string, unknown>;

    // Validate header
    if (!doc.header || typeof doc.header !== 'object') {
        errors.push('Falta la sección "header" del documento.');
    } else {
        const header = doc.header as Record<string, unknown>;
        const requiredHeaderFields = [
            'organization', 'location', 'client', 'modelYear',
            'subject', 'startDate', 'revDate', 'team',
            'amfeNumber', 'responsible', 'processResponsible',
            'confidentiality', 'partNumber',
        ];
        for (const field of requiredHeaderFields) {
            if (typeof header[field] !== 'string') {
                errors.push(`Campo del header faltante o inválido: "${field}".`);
            }
        }
    }

    // Validate operations
    if (!Array.isArray(doc.operations)) {
        errors.push('Falta el array "operations" del documento.');
    } else {
        for (let i = 0; i < doc.operations.length; i++) {
            const op = doc.operations[i] as Record<string, unknown>;
            if (!op || typeof op !== 'object') {
                errors.push(`Operación ${i + 1}: no es un objeto válido.`);
                continue;
            }
            if (typeof op.id !== 'string') errors.push(`Operación ${i + 1}: falta "id".`);
            if (typeof op.opNumber !== 'string') errors.push(`Operación ${i + 1}: falta "opNumber".`);
            if (typeof op.name !== 'string') errors.push(`Operación ${i + 1}: falta "name".`);

            if (!Array.isArray(op.workElements)) {
                errors.push(`Operación ${i + 1}: falta el array "workElements".`);
                continue;
            }

            const workElements = op.workElements as unknown[];
            for (let j = 0; j < workElements.length; j++) {
                const we = workElements[j] as Record<string, unknown>;
                if (!we || typeof we !== 'object') {
                    errors.push(`Operación ${i + 1}, Elemento ${j + 1}: no es un objeto válido.`);
                    continue;
                }
                if (typeof we.id !== 'string') errors.push(`Operación ${i + 1}, Elemento ${j + 1}: falta "id".`);
                if (!VALID_WORK_ELEMENT_TYPES.includes(we.type as WorkElementType)) {
                    errors.push(`Operación ${i + 1}, Elemento ${j + 1}: tipo inválido "${we.type}". Debe ser uno de: ${VALID_WORK_ELEMENT_TYPES.join(', ')}.`);
                }

                if (!Array.isArray(we.functions)) {
                    errors.push(`Operación ${i + 1}, Elemento ${j + 1}: falta el array "functions".`);
                    continue;
                }

                for (let k = 0; k < we.functions.length; k++) {
                    const func = we.functions[k];
                    if (!func || typeof func !== 'object') {
                        errors.push(`Operación ${i + 1}, Elemento ${j + 1}, Función ${k + 1}: no es un objeto válido.`);
                        continue;
                    }
                    if (typeof func.id !== 'string') errors.push(`Op ${i + 1}, El ${j + 1}, Func ${k + 1}: falta "id".`);

                    if (!Array.isArray(func.failures)) {
                        errors.push(`Op ${i + 1}, El ${j + 1}, Func ${k + 1}: falta el array "failures".`);
                        continue;
                    }

                    for (let l = 0; l < func.failures.length; l++) {
                        const fail = func.failures[l];
                        if (!fail || typeof fail !== 'object') {
                            errors.push(`Op ${i + 1}, El ${j + 1}, Func ${k + 1}, Falla ${l + 1}: no es un objeto válido.`);
                        } else if (typeof fail.id !== 'string') {
                            errors.push(`Op ${i + 1}, El ${j + 1}, Func ${k + 1}, Falla ${l + 1}: falta "id".`);
                        } else if (fail.causes !== undefined && !Array.isArray(fail.causes)) {
                            errors.push(`Op ${i + 1}, El ${j + 1}, Func ${k + 1}, Falla ${l + 1}: "causes" debe ser un array.`);
                        }
                    }
                }
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Migrate a legacy AmfeFailure that has the old single `effect` field
 * to the new 3-level effect fields (effectLocal, effectNextLevel, effectEndUser).
 */
export function migrateFailureEffects(failure: Record<string, any>): Record<string, any> {
    // If the legacy `effect` field has content and the new fields are empty/missing, migrate
    if (failure.effect && !failure.effectEndUser && !failure.effectLocal && !failure.effectNextLevel) {
        return {
            ...failure,
            effectEndUser: failure.effect,
            effectLocal: failure.effectLocal || '',
            effectNextLevel: failure.effectNextLevel || '',
            characteristicNumber: failure.characteristicNumber || '',
            severityLocal: failure.severityLocal ?? '',
            severityNextLevel: failure.severityNextLevel ?? '',
            severityEndUser: failure.severityEndUser ?? '',
        };
    }
    // Ensure new fields exist even if not migrating
    return {
        ...failure,
        effectLocal: failure.effectLocal ?? '',
        effectNextLevel: failure.effectNextLevel ?? '',
        effectEndUser: failure.effectEndUser ?? '',
        characteristicNumber: failure.characteristicNumber ?? '',
        // A5: Per-level severity fields (default empty for legacy docs)
        severityLocal: failure.severityLocal ?? '',
        severityNextLevel: failure.severityNextLevel ?? '',
        severityEndUser: failure.severityEndUser ?? '',
    };
}

/**
 * Migrate a legacy AmfeFailure with flat cause fields to the new causes[] array model.
 * If the failure already has a causes array, returns it as-is.
 */
export function migrateFailureToCausesModel(failure: Record<string, any>): Record<string, any> {
    // Already migrated — has a causes array
    if (Array.isArray(failure.causes) && failure.causes.length > 0) {
        return failure;
    }

    // Check if there's any meaningful cause-level data to migrate
    const hasCauseData = failure.cause || failure.preventionControl || failure.detectionControl ||
        failure.occurrence || failure.detection || failure.ap ||
        failure.preventionAction || failure.detectionAction;

    if (!hasCauseData) {
        // No cause data — initialize with empty causes array
        return {
            ...failure,
            causes: [],
        };
    }

    // Migrate flat cause fields into a single AmfeCause object
    const migratedCause: AmfeCause = {
        id: uuidv4(),
        cause: failure.cause || '',
        preventionControl: failure.preventionControl || '',
        detectionControl: failure.detectionControl || '',
        occurrence: failure.occurrence ?? '',
        detection: failure.detection ?? '',
        ap: failure.ap || '',
        characteristicNumber: failure.characteristicNumber || '',
        specialChar: failure.specialChar || '',
        filterCode: failure.filterCode || '',
        preventionAction: failure.preventionAction || '',
        detectionAction: failure.detectionAction || '',
        responsible: failure.responsible || '',
        targetDate: failure.targetDate || '',
        status: failure.status || '',
        actionTaken: failure.actionTaken || '',
        completionDate: failure.completionDate || '',
        severityNew: failure.severityNew ?? '',
        occurrenceNew: failure.occurrenceNew ?? '',
        detectionNew: failure.detectionNew ?? '',
        apNew: failure.apNew || '',
        observations: failure.observations || '',
    };

    return {
        ...failure,
        causes: [migratedCause],
    };
}

/**
 * Migrate a full AMFE document from legacy format to current format.
 * Handles: effect → 3-level effects, flat cause fields → causes[] array, missing header fields.
 */
export function migrateAmfeDocument(doc: AmfeDocument): AmfeDocument {
    return {
        ...doc,
        header: {
            ...doc.header,
            partNumber: doc.header.partNumber ?? '',
            processResponsible: doc.header.processResponsible ?? '',
            revision: doc.header.revision ?? '',
            approvedBy: doc.header.approvedBy ?? '',
            scope: doc.header.scope ?? '',
        },
        operations: doc.operations.map(op => ({
            ...op,
            workElements: op.workElements.map(we => ({
                ...we,
                functions: we.functions.map(func => ({
                    ...func,
                    failures: func.failures.map(fail => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration functions handle legacy formats with arbitrary keys
                        const withEffects = migrateFailureEffects(fail as Record<string, any>);
                        return migrateFailureToCausesModel(withEffects) as unknown as AmfeFailure;
                    }),
                })),
            })),
        })),
    };
}

/**
 * Get business rule warnings for a failure and its causes (non-blocking, informational).
 */
export function getFailureWarnings(failure: AmfeFailure): string[] {
    const warnings: string[] = [];

    const s = Number(failure.severity);
    const hasS = !isNaN(s) && s >= 1;

    // Check each cause for warnings
    for (const cause of failure.causes) {
        const o = Number(cause.occurrence);
        const d = Number(cause.detection);
        const hasO = !isNaN(o) && o >= 1;
        const hasD = !isNaN(d) && d >= 1;

        // AP=H without actions
        if (cause.ap === 'H' && !cause.preventionAction && !cause.detectionAction) {
            warnings.push(`Causa "${cause.cause || '(sin texto)'}": AP Alto sin acciones definidas`);
        }

        // Completed without completion date
        if (cause.status === 'Completado' && !cause.completionDate) {
            warnings.push(`Causa "${cause.cause || '(sin texto)'}": Status "Completado" sin fecha de cierre`);
        }

        // Partial S/O/D
        const filledCount = [hasS, hasO, hasD].filter(Boolean).length;
        if (filledCount > 0 && filledCount < 3) {
            warnings.push(`Causa "${cause.cause || '(sin texto)'}": S/O/D incompletos`);
        }
    }

    return warnings;
}

/**
 * Document-level compliance errors for AP=H enforcement.
 * Returns a list of AP=H causes that are missing required optimization actions.
 * Per AIAG-VDA: all AP=H causes MUST have optimization actions with responsible + target date.
 */
export interface ApHComplianceError {
    opName: string;
    weName: string;
    failDescription: string;
    causeText: string;
    causeId: string;
    missing: ('actions' | 'responsible' | 'targetDate')[];
}

export function getDocumentCompletionErrors(doc: AmfeDocument): ApHComplianceError[] {
    const errors: ApHComplianceError[] = [];

    for (const op of doc.operations) {
        for (const we of op.workElements) {
            for (const func of we.functions) {
                for (const fail of func.failures) {
                    for (const cause of fail.causes) {
                        if (cause.ap !== 'H') continue;

                        const missing: ('actions' | 'responsible' | 'targetDate')[] = [];

                        if (!cause.preventionAction && !cause.detectionAction) {
                            missing.push('actions');
                        }
                        if (!cause.responsible) {
                            missing.push('responsible');
                        }
                        if (!cause.targetDate) {
                            missing.push('targetDate');
                        }

                        if (missing.length > 0) {
                            errors.push({
                                opName: op.name || op.opNumber,
                                weName: we.name,
                                failDescription: fail.description || '(sin descripcion)',
                                causeText: cause.cause || '(sin texto)',
                                causeId: cause.id,
                                missing,
                            });
                        }
                    }
                }
            }
        }
    }

    return errors;
}

/**
 * Get warnings for pre-export validation.
 * Returns a list of human-readable warnings about data quality issues
 * that may affect the exported Excel report.
 */
export function getExportWarnings(doc: AmfeDocument): string[] {
    const warnings: string[] = [];

    // Check header completeness
    const h = doc.header;
    const emptyHeaderFields: string[] = [];
    if (!h.organization) emptyHeaderFields.push('Organizacion');
    if (!h.client) emptyHeaderFields.push('Cliente');
    if (!h.partNumber) emptyHeaderFields.push('Nro. Pieza');
    if (!h.responsible) emptyHeaderFields.push('Responsable');
    if (emptyHeaderFields.length > 0) {
        warnings.push(`Campos de encabezado vacios: ${emptyHeaderFields.join(', ')}.`);
    }

    // Check for AP=H without actions
    const apHErrors = getDocumentCompletionErrors(doc);
    if (apHErrors.length > 0) {
        warnings.push(`${apHErrors.length} causa(s) AP=Alto sin acciones/responsable/fecha completos.`);
    }

    // Check for causes with incomplete S/O/D
    let incompleteSod = 0;
    let noSeverity = 0;
    for (const op of doc.operations) {
        for (const we of op.workElements) {
            for (const func of we.functions) {
                for (const fail of func.failures) {
                    if (!fail.severity && fail.severity !== 0) noSeverity++;
                    for (const cause of fail.causes) {
                        const hasO = cause.occurrence !== '' && cause.occurrence !== undefined;
                        const hasD = cause.detection !== '' && cause.detection !== undefined;
                        if ((hasO && !hasD) || (!hasO && hasD)) {
                            incompleteSod++;
                        }
                    }
                }
            }
        }
    }
    if (noSeverity > 0) {
        warnings.push(`${noSeverity} falla(s) sin severidad asignada.`);
    }
    if (incompleteSod > 0) {
        warnings.push(`${incompleteSod} causa(s) con O/D parciales (uno sin el otro).`);
    }

    // Check for text fields exceeding Excel cell limit
    let longFieldCount = 0;
    for (const op of doc.operations) {
        for (const we of op.workElements) {
            for (const func of we.functions) {
                for (const fail of func.failures) {
                    if (fail.description && fail.description.length > EXCEL_CELL_LIMIT) longFieldCount++;
                    for (const cause of fail.causes) {
                        if (cause.cause && cause.cause.length > EXCEL_CELL_LIMIT) longFieldCount++;
                        if (cause.preventionAction && cause.preventionAction.length > EXCEL_CELL_LIMIT) longFieldCount++;
                        if (cause.detectionAction && cause.detectionAction.length > EXCEL_CELL_LIMIT) longFieldCount++;
                        if (cause.actionTaken && cause.actionTaken.length > EXCEL_CELL_LIMIT) longFieldCount++;
                    }
                }
            }
        }
    }
    if (longFieldCount > 0) {
        warnings.push(`${longFieldCount} campo(s) exceden el limite de ${EXCEL_CELL_LIMIT.toLocaleString()} caracteres de Excel.`);
    }

    return warnings;
}

/**
 * Check document-level soft limits and return warnings.
 * These are non-blocking — they inform the user but don't prevent saving.
 */
export function getSoftLimitWarnings(doc: AmfeDocument): string[] {
    const warnings: string[] = [];
    const opCount = doc.operations.length;

    if (opCount > SOFT_LIMIT_OPERATIONS) {
        warnings.push(
            `El AMFE tiene ${opCount} operaciones (recomendado: max ${SOFT_LIMIT_OPERATIONS}). Considere dividir en multiples AMFEs por etapa del proceso.`
        );
    }

    let totalCauses = 0;
    for (const op of doc.operations) {
        for (const we of op.workElements) {
            for (const func of we.functions) {
                for (const fail of func.failures) {
                    const causeCount = fail.causes.length;
                    totalCauses += causeCount;
                    if (causeCount > SOFT_LIMIT_CAUSES_PER_FAILURE) {
                        warnings.push(
                            `Falla "${fail.description || '(sin descripcion)'}" en op ${op.opNumber || op.name || '?'} tiene ${causeCount} causas (recomendado: max ${SOFT_LIMIT_CAUSES_PER_FAILURE}). Considere agrupar causas similares.`
                        );
                    }
                }
            }
        }
    }

    if (totalCauses > SOFT_LIMIT_TOTAL_CAUSES) {
        warnings.push(
            `El AMFE tiene ${totalCauses} causas totales (recomendado: max ${SOFT_LIMIT_TOTAL_CAUSES}). Documentos muy grandes pueden afectar rendimiento y dificultad de revision.`
        );
    }

    return warnings;
}
