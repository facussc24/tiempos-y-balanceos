/**
 * AMFE VDA 7-Step Progress Calculator
 *
 * Computes completion status for each of the 7 AIAG-VDA FMEA methodology steps:
 * 1. Planning (Header)
 * 2. Structure Analysis (Operations + Work Elements)
 * 3. Function Analysis (Functions per work element)
 * 4. Failure Analysis (Failure modes + effects + severity)
 * 5. Risk Analysis (Causes with O, D, AP, controls)
 * 6. Optimization (Actions for AP=H causes)
 * 7. Results Documentation (Revision date set)
 */

import { AmfeDocument } from './amfeTypes';

export interface AmfeStepStatus {
    step: number;
    label: string;
    shortLabel: string;
    status: 'completed' | 'in-progress' | 'pending';
    completionPercent: number;
}

/** Required header fields for Step 1 */
const REQUIRED_HEADER_FIELDS = [
    'organization', 'location', 'client', 'subject',
    'startDate', 'team', 'responsible', 'modelYear'
] as const;

/**
 * Compute the 7-step VDA progress from an AMFE document.
 */
export function computeAmfeStepProgress(doc: AmfeDocument): AmfeStepStatus[] {
    // --- Step 1: Planning (Header completeness) ---
    const headerRecord = doc.header as unknown as Record<string, string>;
    const headerFields = REQUIRED_HEADER_FIELDS.map(f => headerRecord[f]);
    const filledHeaderCount = headerFields.filter(v => v && String(v).trim() !== '' && v !== '-').length;
    const step1Pct = Math.round((filledHeaderCount / REQUIRED_HEADER_FIELDS.length) * 100);

    // --- Step 2: Structure Analysis (operations with work elements) ---
    const ops = doc.operations;
    let step2Pct = 0;
    if (ops.length > 0) {
        const validOps = ops.filter(op => op.opNumber && op.name);
        const opsWithWE = validOps.filter(op => op.workElements.length > 0);
        step2Pct = validOps.length > 0
            ? Math.round((opsWithWE.length / validOps.length) * 100)
            : 0;
    }

    // --- Step 3: Function Analysis (functions per work element) ---
    const allWEs = ops.flatMap(op => op.workElements);
    let step3Pct = 0;
    if (allWEs.length > 0) {
        const wesWithFunc = allWEs.filter(we =>
            we.functions.length > 0 && we.functions.some(f => (f.description || '').trim() !== '')
        );
        step3Pct = Math.round((wesWithFunc.length / allWEs.length) * 100);
    }

    // --- Step 4: Failure Analysis (failures with description + effect + severity) ---
    const allFuncs = allWEs.flatMap(we => we.functions);
    let step4Pct = 0;
    if (allFuncs.length > 0) {
        const funcsWithFailures = allFuncs.filter(f =>
            f.failures.length > 0 && f.failures.some(fail =>
                (fail.description || '').trim() !== '' &&
                (fail.effectLocal || fail.effectNextLevel || fail.effectEndUser) &&
                Number(fail.severity) >= 1
            )
        );
        step4Pct = Math.round((funcsWithFailures.length / allFuncs.length) * 100);
    }

    // --- Step 5: Risk Analysis (causes with O, D, AP calculated, and controls) ---
    const allFailures = allFuncs.flatMap(f => f.failures);
    let step5Pct = 0;
    if (allFailures.length > 0) {
        const failuresWithRisk = allFailures.filter(fail =>
            fail.causes.length > 0 && fail.causes.some(c =>
                Number(c.occurrence) >= 1 &&
                Number(c.detection) >= 1 &&
                c.ap !== ''
            )
        );
        step5Pct = Math.round((failuresWithRisk.length / allFailures.length) * 100);
    }

    // --- Step 6: Optimization (AP=H causes with actions + responsible + date) ---
    const allCauses = allFailures.flatMap(f => f.causes);
    const highCauses = allCauses.filter(c => c.ap === 'H');
    let step6Pct = 0;
    if (highCauses.length > 0) {
        const optimized = highCauses.filter(c =>
            (c.preventionAction || c.detectionAction) &&
            c.responsible &&
            c.targetDate
        );
        step6Pct = Math.round((optimized.length / highCauses.length) * 100);
    } else if (allCauses.length > 0) {
        // No AP=H causes — step 6 is complete (nothing to optimize)
        step6Pct = 100;
    }

    // --- Step 7: Results Documentation (revision date set) ---
    const step7Pct = doc.header.revDate && doc.header.revDate.trim() !== '' ? 100 : 0;

    // Map percentages to statuses
    const pcts = [step1Pct, step2Pct, step3Pct, step4Pct, step5Pct, step6Pct, step7Pct];
    const labels = [
        'Planificación',
        'Estructura',
        'Funciones',
        'Fallas',
        'Riesgo',
        'Optimización',
        'Documentación',
    ];
    const shortLabels = [
        'Plan',
        'Estruc.',
        'Func.',
        'Fallas',
        'Riesgo',
        'Optim.',
        'Doc.',
    ];

    return pcts.map((pct, i) => ({
        step: i + 1,
        label: labels[i],
        shortLabel: shortLabels[i],
        completionPercent: pct,
        status: pct >= 100 ? 'completed'
            : pct > 0 ? 'in-progress'
            : 'pending' as const,
    }));
}

/** Compute overall progress as average of all 7 steps. */
export function computeOverallProgress(steps: AmfeStepStatus[]): number {
    if (steps.length === 0) return 0;
    const total = steps.reduce((sum, s) => sum + s.completionPercent, 0);
    return Math.round(total / steps.length);
}
