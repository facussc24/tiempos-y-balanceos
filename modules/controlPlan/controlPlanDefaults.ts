/**
 * Control Plan Defaults
 *
 * Intelligent defaults for auto-filling Control Plan fields based on
 * AMFE data (AP, severity, phase). Validated against AIAG-VDA standard
 * and Control Plan 1st Edition (2024) via NotebookLM consultation.
 *
 * Rules:
 * - specification: NEVER auto-fill (comes from design, per AIAG-VDA)
 * - reactionPlanOwner: NEVER auto-fill (must be specific person on floor)
 * - sampleSize/Frequency: based on AP + phase (Safe Launch = higher freq)
 * - reactionPlan: based on severity level
 */

import { ControlPlanPhase } from './controlPlanTypes';

type ActionPriority = 'H' | 'M' | 'L' | '';

interface DefaultsInput {
    ap: ActionPriority;
    severity: number;
    phase: ControlPlanPhase;
}

interface DefaultsOutput {
    sampleSize: string;
    sampleFrequency: string;
    reactionPlan: string;
    /** Which fields were auto-filled — for UI suggestion markers. */
    autoFilledFields: string[];
}

/**
 * Get suggested defaults for a Control Plan item based on AMFE cause data.
 * Returns empty strings for fields that should NOT be auto-filled.
 */
export function getControlPlanDefaults(input: DefaultsInput): DefaultsOutput {
    const { ap, severity, phase } = input;
    const isPrototype = phase === 'prototype';
    const isPreLaunch = phase === 'preLaunch';
    const isSafeLaunch = phase === 'safeLaunch';
    const autoFilledFields: string[] = [];

    // --- Sample Size & Frequency ---
    // Per AIAG CP 2024: Prototype/Pre-Launch = 100%; Safe Launch = intensive; Production = CPK-based
    let sampleSize = '';
    let sampleFrequency = '';

    if (ap === 'H') {
        sampleSize = '100%';
        sampleFrequency = 'Cada pieza';
        autoFilledFields.push('sampleSize', 'sampleFrequency');
    } else if (ap === 'M') {
        if (isPrototype) {
            // Prototype: 100% inspection per AIAG
            sampleSize = '100%';
            sampleFrequency = 'Cada pieza (Prototipo)';
        } else if (isPreLaunch) {
            // Pre-Launch: intensive, near 100% per AIAG
            sampleSize = '100%';
            sampleFrequency = 'Cada pieza (Pre-Lanzamiento)';
        } else if (isSafeLaunch) {
            // Safe Launch: higher frequency temporarily
            sampleSize = '100%';
            sampleFrequency = 'Cada pieza (Safe Launch)';
        } else if (severity >= 9) {
            sampleSize = '5 piezas';
            sampleFrequency = 'Cada hora';
        } else {
            sampleSize = '5 piezas';
            sampleFrequency = 'Cada turno';
        }
        autoFilledFields.push('sampleSize', 'sampleFrequency');
    }

    // --- Reaction Plan based on Severity ---
    let reactionPlan = '';

    if (severity >= 9) {
        reactionPlan = 'Detener linea. Escalar a Gerencia. Segregar producto.';
        autoFilledFields.push('reactionPlan');
    } else if (severity >= 7) {
        reactionPlan = 'Contener producto sospechoso. Verificar ultimas N piezas. Corregir proceso.';
        autoFilledFields.push('reactionPlan');
    } else if (severity >= 4) {
        reactionPlan = 'Ajustar proceso. Reinspeccionar ultimo lote.';
        autoFilledFields.push('reactionPlan');
    }
    // severity < 4: leave empty for user to decide

    return { sampleSize, sampleFrequency, reactionPlan, autoFilledFields };
}

/**
 * Check if a Control Plan document has missing required fields that should
 * block export. Returns list of issues.
 */
export function validateControlPlanForExport(
    items: { reactionPlanOwner: string; reactionPlan: string; sampleSize: string; controlMethod: string }[]
): string[] {
    const issues: string[] = [];
    let missingOwnerCount = 0;

    for (const item of items) {
        if (!item.reactionPlanOwner.trim()) {
            missingOwnerCount++;
        }
    }

    if (missingOwnerCount > 0) {
        issues.push(
            `${missingOwnerCount} item(s) sin Responsable de Reaccion. ` +
            `Debe asignarse una persona especifica (operador, supervisor), no un departamento generico.`
        );
    }

    return issues;
}
