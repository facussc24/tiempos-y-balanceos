/**
 * Control Plan Validation Utilities
 *
 * 4-layer validation system (ported from AMFE pattern in amfeValidation.ts):
 * Layer 1: Inline row validation (getItemValidationState)
 * Layer 2: Document-level compliance (getDocumentCompletionErrors)
 * Layer 3: Pre-export warnings (getExportWarnings)
 * Layer 4: Schema validation for JSON import (validateControlPlanDocument)
 */

import {
    ControlPlanDocument,
    ControlPlanItem,
    ControlPlanHeader,
    CP_COLUMNS,
    CONTROL_PLAN_PHASES,
} from './controlPlanTypes';

/** Maximum recommended field length (warn above this). */
export const MAX_FIELD_LENGTH = 10_000;

/** Excel cell character limit. */
export const EXCEL_CELL_LIMIT = 32_767;

/** Soft limit for total items in a CP document. */
export const CP_SOFT_LIMIT_ITEMS = 200;

// ============================================================================
// LAYER 1: Inline Row Validation
// ============================================================================

/** Validation state for a single CP item — used for inline color coding and warning icons. */
export interface ItemValidationState {
    level: 'error' | 'warning' | 'ok';
    messages: string[];
}

/**
 * Context-aware required fields based on row type (CP 2024).
 * Process rows (processCharacteristic filled, productCharacteristic empty) require controlMethod.
 * Product rows (productCharacteristic filled, processCharacteristic empty) require evaluationTechnique.
 * Mixed/legacy rows use the old behavior.
 */
export function getRequiredKeysForItem(item: ControlPlanItem): (keyof ControlPlanItem)[] {
    const base: (keyof ControlPlanItem)[] = [
        'processStepNumber', 'processDescription',
        'sampleSize', 'reactionPlan', 'reactionPlanOwner',
    ];

    const isProcessRow = !!(item.processCharacteristic || '').trim() && !(item.productCharacteristic || '').trim();
    const isProductRow = !!(item.productCharacteristic || '').trim() && !(item.processCharacteristic || '').trim();

    if (isProcessRow) {
        base.push('processCharacteristic', 'controlMethod');
    } else if (isProductRow) {
        base.push('productCharacteristic', 'evaluationTechnique');
    } else {
        // Mixed or user-added row: legacy behavior
        base.push('productCharacteristic', 'controlMethod');
    }

    return base;
}

/**
 * Determine the validation state for a single CP item.
 * Used to drive inline row coloring (red border for error, yellow for warning).
 *
 * Rules:
 * - error: CC/SC item missing reactionPlanOwner (CP 2024 mandatory)
 * - error: CC/SC item missing controlMethod
 * - warning: AP=H without specification
 * - warning: Required fields partially empty
 * - warning: Field length > MAX_FIELD_LENGTH
 */
export function getItemValidationState(item: ControlPlanItem): ItemValidationState {
    const messages: string[] = [];
    let level: 'error' | 'warning' | 'ok' = 'ok';

    const sc = (item.specialCharClass || '').toUpperCase().trim();
    const isCcSc = sc === 'CC' || sc === 'SC';
    const isHighAp = item.amfeAp === 'H';

    // ERROR: CC/SC item missing reactionPlanOwner (CP 2024 mandatory)
    if (isCcSc && !(item.reactionPlanOwner || '').trim()) {
        messages.push(`Item ${sc}: falta Responsable de Reaccion (obligatorio CP 2024)`);
        level = 'error';
    }

    // ERROR: CC/SC item missing controlMethod (only for process rows and mixed rows)
    const isProductRow = !!(item.productCharacteristic || '').trim() && !(item.processCharacteristic || '').trim();
    if (isCcSc && !isProductRow && !(item.controlMethod || '').trim()) {
        messages.push(`Item ${sc}: falta Metodo de Control`);
        level = 'error';
    }

    // ERROR: AP=H without controlMethod (process rows must have a control method)
    if (isHighAp && !isProductRow && !(item.controlMethod || '').trim()) {
        messages.push('AP Alto: falta Método de Control (obligatorio para AP=H)');
        level = 'error';
    }

    // WARNING: AP=H without specification
    if (isHighAp && !(item.specification || '').trim()) {
        messages.push('AP Alto: sin especificacion/tolerancia definida');
        if (level !== 'error') level = 'warning';
    }

    // WARNING: Required fields partially empty (context-aware)
    const requiredKeys = getRequiredKeysForItem(item);
    const filledCount = requiredKeys.filter(k => ((item[k] as string) || '').trim() !== '').length;
    if (filledCount > 0 && filledCount < requiredKeys.length) {
        const missing = requiredKeys.filter(k => !((item[k] as string) || '').trim());
        const missingLabels = missing.map(k => {
            const col = CP_COLUMNS.find(c => c.key === k);
            return col?.label || k;
        });
        messages.push(`Campos requeridos faltantes: ${missingLabels.join(', ')}`);
        if (level !== 'error') level = 'warning';
    }

    // WARNING: Field length > MAX_FIELD_LENGTH
    const textFields: [string | undefined, string][] = [
        [item.controlMethod, 'Metodo Control'],
        [item.reactionPlan, 'Plan Reaccion'],
        [item.specification, 'Especificacion'],
        [item.evaluationTechnique, 'Tec. Evaluacion'],
        [item.processDescription, 'Descripcion Proceso'],
    ];
    for (const [field, label] of textFields) {
        if (field && field.length > MAX_FIELD_LENGTH) {
            messages.push(`${label} demasiado largo (${field.length} car.)`);
            if (level !== 'error') level = 'warning';
        }
    }

    return { level, messages };
}

// ============================================================================
// LAYER 2: Document-Level Compliance Errors
// ============================================================================

export interface CpComplianceError {
    processStep: string;
    processDescription: string;
    itemId: string;
    missing: string[];
}

/**
 * Document-level compliance: CC/SC and AP=H items that are missing required fields.
 * Per AIAG-VDA: critical items MUST have all required fields.
 */
export function getDocumentCompletionErrors(doc: ControlPlanDocument): CpComplianceError[] {
    const errors: CpComplianceError[] = [];

    for (const item of doc.items) {
        const sc = (item.specialCharClass || '').toUpperCase().trim();
        const isCritical = sc === 'CC' || sc === 'SC' || item.amfeAp === 'H';
        if (!isCritical) continue;

        const missing: string[] = [];
        const requiredKeys = getRequiredKeysForItem(item);
        for (const k of requiredKeys) {
            if (!((item[k] as string) || '').trim()) {
                const col = CP_COLUMNS.find(c => c.key === k);
                missing.push(col?.label || k);
            }
        }

        if (missing.length > 0) {
            errors.push({
                processStep: item.processStepNumber || '\u2014',
                processDescription: item.processDescription || '(sin descripcion)',
                itemId: item.id,
                missing,
            });
        }
    }

    return errors;
}

// ============================================================================
// LAYER 3: Pre-Export Warnings
// ============================================================================

/**
 * Pre-export warnings about data quality issues.
 * Returns human-readable warning messages.
 */
export function getExportWarnings(doc: ControlPlanDocument): string[] {
    const warnings: string[] = [];

    // Header completeness
    const h = doc.header;
    const emptyHeader: string[] = [];
    if (!h.controlPlanNumber) emptyHeader.push('Nro. Plan');
    if (!h.partName) emptyHeader.push('Nombre Pieza');
    if (!h.partNumber) emptyHeader.push('Nro. Pieza');
    if (!h.organization) emptyHeader.push('Organizacion');
    if (!h.responsible) emptyHeader.push('Responsable');
    if (!h.date) emptyHeader.push('Fecha');
    if (emptyHeader.length > 0) {
        warnings.push(`Campos de encabezado vacios: ${emptyHeader.join(', ')}.`);
    }

    // CC/SC compliance
    const compErrors = getDocumentCompletionErrors(doc);
    if (compErrors.length > 0) {
        warnings.push(`${compErrors.length} item(s) critico(s) (CC/SC/AP=H) con campos obligatorios faltantes.`);
    }

    // Missing owners (all items, not just CC/SC)
    const noOwner = doc.items.filter(i => !(i.reactionPlanOwner || '').trim()).length;
    if (noOwner > 0) {
        warnings.push(`${noOwner} item(s) sin Responsable de Reaccion.`);
    }

    // Field length vs Excel limits
    let longFieldCount = 0;
    for (const item of doc.items) {
        for (const col of CP_COLUMNS) {
            const val = (item[col.key] as string) || '';
            if (val.length > EXCEL_CELL_LIMIT) longFieldCount++;
        }
    }
    if (longFieldCount > 0) {
        warnings.push(`${longFieldCount} campo(s) exceden el limite de ${EXCEL_CELL_LIMIT.toLocaleString()} caracteres de Excel.`);
    }

    // Empty plan
    if (doc.items.length === 0) {
        warnings.push('El Plan de Control no tiene items. Agregue items o genere desde un AMFE.');
    }

    return warnings;
}

// ============================================================================
// Soft Limits (non-blocking warnings for large documents)
// ============================================================================

/**
 * Check if the CP document exceeds soft limits and return warning messages.
 */
export function getCpSoftLimitWarnings(doc: ControlPlanDocument): string[] {
    const warnings: string[] = [];
    if (doc.items.length > CP_SOFT_LIMIT_ITEMS) {
        warnings.push(`El Plan de Control tiene ${doc.items.length} items (recomendado max ${CP_SOFT_LIMIT_ITEMS}). Considere dividir en sub-planes por proceso.`);
    }
    return warnings;
}

// ============================================================================
// LAYER 4: Schema Validation for JSON Import
// ============================================================================

/**
 * Validate an imported Control Plan document against the expected schema.
 * Returns validation result with list of errors.
 */
export function validateControlPlanDocument(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['El archivo no contiene un objeto JSON valido.'] };
    }

    const doc = data as Record<string, unknown>;

    // Validate header
    if (!doc.header || typeof doc.header !== 'object') {
        errors.push('Falta la seccion "header" del documento.');
    } else {
        const header = doc.header as Record<string, unknown>;
        const requiredHeaderFields = [
            'controlPlanNumber', 'phase', 'partNumber', 'partName',
            'organization', 'responsible', 'date',
        ];
        for (const field of requiredHeaderFields) {
            if (typeof header[field] !== 'string') {
                errors.push(`Campo del header faltante o invalido: "${field}".`);
            }
        }
        // Validate phase is a known value
        if (typeof header.phase === 'string' && !CONTROL_PLAN_PHASES.some(p => p.value === header.phase)) {
            errors.push(`Fase invalida: "${header.phase}". Valores validos: ${CONTROL_PLAN_PHASES.map(p => p.value).join(', ')}.`);
        }
    }

    // Validate items array
    if (!Array.isArray(doc.items)) {
        errors.push('Falta el array "items" del documento.');
    } else {
        const items = doc.items as unknown[];
        for (let i = 0; i < items.length; i++) {
            const item = items[i] as Record<string, unknown>;
            if (!item || typeof item !== 'object') {
                errors.push(`Item ${i + 1}: no es un objeto valido.`);
                continue;
            }
            if (typeof item.id !== 'string') {
                errors.push(`Item ${i + 1}: falta "id".`);
            }
            // Validate key string fields
            const stringFields = [
                'processStepNumber', 'processDescription', 'specification',
                'controlMethod', 'reactionPlan', 'reactionPlanOwner',
            ];
            for (const field of stringFields) {
                if (item[field] !== undefined && typeof item[field] !== 'string') {
                    errors.push(`Item ${i + 1}: campo "${field}" debe ser string.`);
                }
            }
        }
    }

    return { valid: errors.length === 0, errors };
}
