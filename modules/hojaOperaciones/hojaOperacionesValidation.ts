/**
 * Hoja de Operaciones Validation
 *
 * Per IATF 16949 clause 8.5.1.2 — validate before export.
 * Returns errors (must fix) and warnings (should fix).
 */

import { HoDocument, HojaOperacion } from './hojaOperacionesTypes';

// ============================================================================
// TYPES
// ============================================================================

export type HoValidationSeverity = 'error' | 'warning';

export interface HoValidationIssue {
    severity: HoValidationSeverity;
    sheetId: string;
    hoNumber: string;
    message: string;
}

// ============================================================================
// VALIDATORS
// ============================================================================

function validateSheet(sheet: HojaOperacion): HoValidationIssue[] {
    const issues: HoValidationIssue[] = [];
    const ctx = { sheetId: sheet.id, hoNumber: sheet.hoNumber };

    // ERROR: No steps defined
    if (sheet.steps.length === 0) {
        issues.push({
            ...ctx,
            severity: 'error',
            message: 'No tiene pasos de operacion definidos.',
        });
    }

    // WARNING: No PPE selected (some operations may not require PPE)
    if (sheet.safetyElements.length === 0) {
        issues.push({
            ...ctx,
            severity: 'warning',
            message: 'No tiene elementos de seguridad (EPP) seleccionados.',
        });
    }

    // WARNING: preparedBy empty (don't block export for missing metadata)
    if (!(sheet.preparedBy || '').trim()) {
        issues.push({
            ...ctx,
            severity: 'warning',
            message: 'Campo "Realizo" esta vacio.',
        });
    }

    // WARNING: approvedBy empty (don't block export for missing metadata)
    if (!(sheet.approvedBy || '').trim()) {
        issues.push({
            ...ctx,
            severity: 'warning',
            message: 'Campo "Aprobo" esta vacio.',
        });
    }

    // WARNING: No visual aids
    if (sheet.visualAids.length === 0) {
        issues.push({
            ...ctx,
            severity: 'warning',
            message: 'No tiene ayudas visuales. La norma IATF enfatiza fotos sobre texto.',
        });
    }

    // WARNING: Quality checks with CC/SC but no key point in steps
    const hasSpecialChar = sheet.qualityChecks.some(qc =>
        qc.specialCharSymbol && qc.specialCharSymbol.trim() !== '',
    );
    const hasKeyPoint = sheet.steps.some(s => s.isKeyPoint);
    if (hasSpecialChar && !hasKeyPoint) {
        issues.push({
            ...ctx,
            severity: 'warning',
            message: 'Tiene verificaciones CC/SC pero ningun paso marcado como punto clave.',
        });
    }

    // WARNING: Has quality checks from CP but steps don't reference any control task
    if (sheet.qualityChecks.length > 0 && sheet.steps.length > 0) {
        // This is informational — we can't automatically cross-reference
    }

    // WARNING: Sector empty
    if (!(sheet.sector || '').trim()) {
        issues.push({
            ...ctx,
            severity: 'warning',
            message: 'Campo "Sector" esta vacio.',
        });
    }

    // WARNING: Very large visual aid images (>2MB base64)
    for (const aid of sheet.visualAids) {
        if (aid.imageData && aid.imageData.length > 2_000_000) {
            issues.push({
                ...ctx,
                severity: 'warning',
                message: `Imagen "${aid.caption || 'sin titulo'}" es muy grande (>${Math.round(aid.imageData.length / 1_000_000)}MB). Considere reducir el tamaño.`,
            });
        }
    }

    // WARNING: Very long step descriptions (>500 chars)
    for (const step of sheet.steps) {
        if (step.description.length > 500) {
            issues.push({
                ...ctx,
                severity: 'warning',
                message: `Paso ${step.stepNumber}: Descripción muy larga (${step.description.length} caracteres).`,
            });
        }
    }

    // WARNING: Reaction plan has content but no escalation contact
    if ((sheet.reactionPlanText || '').trim() && !(sheet.reactionContact || '').trim()) {
        issues.push({
            ...ctx,
            severity: 'warning',
            message: "El plan de reacción tiene contenido pero falta el campo 'Contacto de escalamiento'.",
        });
    }

    return issues;
}

// ============================================================================
// MAIN VALIDATION
// ============================================================================

/**
 * Validate the entire HO document.
 * Returns issues sorted by severity (errors first).
 */
export function validateHoDocument(doc: HoDocument): HoValidationIssue[] {
    const issues: HoValidationIssue[] = [];

    if (doc.sheets.length === 0) {
        issues.push({
            severity: 'error',
            sheetId: '',
            hoNumber: '',
            message: 'El documento no tiene hojas de operaciones.',
        });
        return issues;
    }

    for (const sheet of doc.sheets) {
        issues.push(...validateSheet(sheet));
    }

    // Sort: errors first, then warnings
    issues.sort((a, b) => {
        if (a.severity === 'error' && b.severity === 'warning') return -1;
        if (a.severity === 'warning' && b.severity === 'error') return 1;
        return 0;
    });

    return issues;
}

/**
 * Get only errors (blocking issues) for pre-export check (all sheets).
 */
export function getHoExportErrors(doc: HoDocument): HoValidationIssue[] {
    return validateHoDocument(doc).filter(i => i.severity === 'error');
}

/**
 * Get only errors for a single sheet (for "Hoja Actual" export).
 */
export function getSheetExportErrors(sheet: HojaOperacion): HoValidationIssue[] {
    return validateSheet(sheet).filter(i => i.severity === 'error');
}

/**
 * Get a summary string for quick display.
 */
export function getHoValidationSummary(doc: HoDocument): string {
    const issues = validateHoDocument(doc);
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    if (errors === 0 && warnings === 0) return 'Sin problemas detectados.';
    const parts: string[] = [];
    if (errors > 0) parts.push(`${errors} error(es)`);
    if (warnings > 0) parts.push(`${warnings} advertencia(s)`);
    return parts.join(', ');
}
