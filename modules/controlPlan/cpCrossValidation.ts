/**
 * Control Plan ↔ AMFE Cross-Validation
 *
 * Pure functions (no React, no side effects) that validate consistency
 * between a Control Plan document and its linked AMFE document.
 *
 * Validations per IATF 16949 / AIAG CP 1st Ed (2024):
 * V1: CC/SC classification consistency
 * V2: Orphan failures (AMFE causes with AP=H/M not covered in CP)
 * V3: 4M alignment (machine/device matches work element)
 * V4: Reaction plan owners (CP 2024 mandatory)
 * V5: Poka-Yoke frequency verification
 * V6: Poka-Yoke vs Detection rating coherence
 * V7: Sampling consistency (100% must say "each piece")
 */

import { ControlPlanDocument, ControlPlanItem } from './controlPlanTypes';
import { AmfeDocument } from '../amfe/amfeTypes';

// ============================================================================
// TYPES
// ============================================================================

export type CpValidationSeverity = 'error' | 'warning' | 'info';

export interface CpValidationIssue {
    severity: CpValidationSeverity;
    code: string;
    message: string;
    itemId?: string;
    amfePath?: string;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Run all cross-validations between CP and AMFE.
 * Returns issues sorted by severity (error > warning > info).
 */
export function validateCpAgainstAmfe(
    cpDoc: ControlPlanDocument,
    amfeDoc?: AmfeDocument,
): CpValidationIssue[] {
    if (!cpDoc?.items) return [];
    const issues: CpValidationIssue[] = [];

    // CP-only validations (always run)
    issues.push(...validateReactionPlanOwners(cpDoc));
    issues.push(...validatePokaYokeFrequency(cpDoc));
    issues.push(...validatePokaYokeDetectionCoherence(cpDoc, amfeDoc));
    issues.push(...validateSamplingConsistency(cpDoc));

    // Cross-validations (only when AMFE is available)
    if (amfeDoc?.operations && amfeDoc.operations.length > 0) {
        issues.push(...validateSpecialCharConsistency(cpDoc, amfeDoc));
        issues.push(...validateOrphanFailures(cpDoc, amfeDoc));
        issues.push(...validate4MAlignment(cpDoc, amfeDoc));
    }

    // Sort: error > warning > info
    const severityOrder: Record<CpValidationSeverity, number> = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return issues;
}

// ============================================================================
// V1: Special Characteristic Consistency (CC/SC)
// ============================================================================

/**
 * Check that CC/SC classifications in the CP match the AMFE's severity-derived values.
 * AMFE: S>=9 → CC, S=7-8 → SC (unless explicitly set otherwise)
 */
export function validateSpecialCharConsistency(
    cpDoc: ControlPlanDocument,
    amfeDoc: AmfeDocument,
): CpValidationIssue[] {
    const issues: CpValidationIssue[] = [];
    if (!amfeDoc?.operations || !cpDoc?.items) return issues;

    // Build AMFE classification map: processDescription → expected CC/SC
    const amfeClassMap = new Map<string, { expected: string; severity: number; failDesc: string }>();

    for (const op of amfeDoc.operations) {
        if (!op?.workElements) continue;
        for (const we of op.workElements) {
            if (!we?.functions) continue;
            for (const func of we.functions) {
                if (!func?.failures) continue;
                for (const fail of func.failures) {
                    if (!fail?.causes) continue;
                    for (const cause of fail.causes) {
                        if (cause.ap !== 'H' && cause.ap !== 'M') continue;
                        const explicit = cause.specialChar?.trim();
                        let expected = '';
                        const sev = typeof fail.severity === 'number' ? fail.severity : Number(fail.severity) || 0;
                        if (explicit) {
                            expected = explicit;
                        } else if (sev >= 9) {
                            expected = 'CC';
                        // AIAG-VDA: S=5-8 → SC (Significant Characteristic)
                        } else if (sev >= 5) {
                            expected = 'SC';
                        }
                        if (expected) {
                            amfeClassMap.set(norm(op.name), { expected, severity: sev, failDesc: fail.description });
                        }
                    }
                }
            }
        }
    }

    for (const item of cpDoc.items) {
        const key = norm(item.processDescription);
        const amfeEntry = amfeClassMap.get(key);
        if (!amfeEntry) continue;

        const cpClass = (item.specialCharClass ?? '').trim().toUpperCase();
        const expected = amfeEntry.expected.toUpperCase();

        if (!cpClass && expected) {
            issues.push({
                severity: 'warning',
                code: 'CC_SC_MISSING',
                message: `Item "${item.processDescription}": Debería tener clasificación ${expected} (AMFE S=${amfeEntry.severity}, falla: ${amfeEntry.failDesc})`,
                itemId: item.id,
            });
        } else if (cpClass && expected && cpClass !== expected) {
            issues.push({
                severity: 'warning',
                code: 'CC_SC_MISMATCH',
                message: `Item "${item.processDescription}": Clasificación ${cpClass} no coincide con AMFE (esperado: ${expected}, S=${amfeEntry.severity})`,
                itemId: item.id,
            });
        }
    }

    return issues;
}

// ============================================================================
// V2: Orphan Failures (AMFE causes AP=H/M without CP coverage)
// ============================================================================

/**
 * Check that every AMFE cause with AP=H or AP=M has a corresponding CP item.
 * Matching is by operation name (processDescription ↔ operation name).
 */
export function validateOrphanFailures(
    cpDoc: ControlPlanDocument,
    amfeDoc: AmfeDocument,
): CpValidationIssue[] {
    const issues: CpValidationIssue[] = [];
    if (!cpDoc?.items || !amfeDoc?.operations) return issues;

    // Build set of CP-covered process descriptions
    const cpProcesses = new Set(cpDoc.items.map(item => norm(item.processDescription)));

    for (const op of amfeDoc.operations) {
        if (!op?.workElements) continue;
        for (const we of op.workElements) {
            if (!we?.functions) continue;
            for (const func of we.functions) {
                if (!func?.failures) continue;
                for (const fail of func.failures) {
                    if (!fail?.causes) continue;
                    for (const cause of fail.causes) {
                        if (cause.ap !== 'H' && cause.ap !== 'M') continue;

                        // Check if any CP item covers this operation
                        const opNorm = norm(op.name);
                        const covered = [...cpProcesses].some(
                            cpProc => cpProc.includes(opNorm) || opNorm.includes(cpProc)
                        );

                        if (!covered) {
                            issues.push({
                                severity: cause.ap === 'H' ? 'error' : 'warning',
                                code: 'ORPHAN_FAILURE',
                                message: `Causa AMFE sin cobertura en CP: Op "${op.name}" → Falla "${fail.description}" → Causa "${cause.cause}" (AP=${cause.ap})`,
                                amfePath: `${op.name} > ${fail.description} > ${cause.cause}`,
                            });
                        }
                    }
                }
            }
        }
    }

    return issues;
}

// ============================================================================
// V3: 4M Alignment (machine/device matches work element)
// ============================================================================

/**
 * Check that CP machineDeviceTool matches AMFE work element names
 * for the same process/operation.
 */
export function validate4MAlignment(
    cpDoc: ControlPlanDocument,
    amfeDoc: AmfeDocument,
): CpValidationIssue[] {
    const issues: CpValidationIssue[] = [];
    if (!cpDoc?.items || !amfeDoc?.operations) return issues;

    // Build map: operation name → work element names
    const amfe4M = new Map<string, string[]>();
    for (const op of amfeDoc.operations) {
        if (!op?.workElements) continue;
        const weNames = op.workElements.map(we => we.name).filter(n => n?.trim());
        if (weNames.length > 0) {
            amfe4M.set(norm(op.name), weNames);
        }
    }

    for (const item of cpDoc.items) {
        if (!(item.machineDeviceTool ?? '').trim()) continue;

        const procNorm = norm(item.processDescription);
        // Find matching AMFE operation
        const matchKey = [...amfe4M.keys()].find(
            k => k.includes(procNorm) || procNorm.includes(k)
        );
        if (!matchKey) continue;

        const weNames = amfe4M.get(matchKey)!;
        const cpMachine = norm(item.machineDeviceTool);

        const matches = weNames.some(
            weName => norm(weName).includes(cpMachine) || cpMachine.includes(norm(weName))
        );

        if (!matches) {
            issues.push({
                severity: 'info',
                code: '4M_MISMATCH',
                message: `Item "${item.processDescription}": Máquina "${item.machineDeviceTool}" no coincide con elementos AMFE (${weNames.join(', ')})`,
                itemId: item.id,
            });
        }
    }

    return issues;
}

// ============================================================================
// V4: Reaction Plan Owners (CP 2024 mandatory)
// ============================================================================

/**
 * Check that all CP items have a non-empty reactionPlanOwner.
 * Per AIAG CP 1st Ed 2024, this field is mandatory.
 */
export function validateReactionPlanOwners(
    cpDoc: ControlPlanDocument,
): CpValidationIssue[] {
    const issues: CpValidationIssue[] = [];
    if (!cpDoc?.items) return issues;

    for (const item of cpDoc.items) {
        if (!(item.reactionPlanOwner ?? '').trim()) {
            issues.push({
                severity: 'error',
                code: 'MISSING_OWNER',
                message: `Item "${item.processDescription || '(sin descripción)'}": Falta Responsable del Plan de Reacción (obligatorio CP 2024)`,
                itemId: item.id,
            });
        }
    }

    return issues;
}

// ============================================================================
// V5: Poka-Yoke Frequency Verification
// ============================================================================

/**
 * Check that items using Poka-Yoke as control method have a verification
 * frequency for the device (e.g., "verificar pieza patrón al inicio de turno").
 */
export function validatePokaYokeFrequency(
    cpDoc: ControlPlanDocument,
): CpValidationIssue[] {
    const issues: CpValidationIssue[] = [];
    if (!cpDoc?.items) return issues;

    for (const item of cpDoc.items) {
        const cm = (item.controlMethod ?? '').toLowerCase();
        if (!cm.includes('poka-yoke') && !cm.includes('poka yoke')) continue;

        if (!(item.sampleFrequency ?? '').toLowerCase().includes('verific')) {
            issues.push({
                severity: 'warning',
                code: 'POKAYOKE_NO_VERIFY',
                message: `Item "${item.processDescription}": Método Poka-Yoke sin frecuencia de verificación del dispositivo`,
                itemId: item.id,
            });
        }
    }

    return issues;
}

// ============================================================================
// V6: Poka-Yoke vs Detection Rating Coherence
// ============================================================================

/**
 * If controlMethod mentions Poka-Yoke, the AMFE detection rating should be 1-3.
 * D > 3 with Poka-Yoke suggests the AMFE detection was not updated after adding the control.
 */
export function validatePokaYokeDetectionCoherence(
    cpDoc: ControlPlanDocument,
    amfeDoc?: AmfeDocument,
): CpValidationIssue[] {
    const issues: CpValidationIssue[] = [];
    if (!cpDoc?.items || !amfeDoc?.operations) return issues;

    // Build map: operation name → max detection rating from causes
    const amfeDetection = new Map<string, number>();
    for (const op of amfeDoc.operations) {
        if (!op?.workElements) continue;
        let maxD = 0;
        for (const we of op.workElements) {
            if (!we?.functions) continue;
            for (const func of we.functions) {
                if (!func?.failures) continue;
                for (const fail of func.failures) {
                    if (!fail?.causes) continue;
                    for (const cause of fail.causes) {
                        const d = Number(cause.detection) || 0;
                        if (d > maxD) maxD = d;
                    }
                }
            }
        }
        if (maxD > 0) amfeDetection.set(norm(op.name), maxD);
    }

    for (const item of cpDoc.items) {
        const cm = (item.controlMethod ?? '').toLowerCase();
        const hasPokaYoke = cm.includes('poka-yoke') || cm.includes('poka yoke') || cm.includes('pokayoke');
        if (!hasPokaYoke) continue;

        const procNorm = norm(item.processDescription);
        const matchKey = [...amfeDetection.keys()].find(
            k => k.includes(procNorm) || procNorm.includes(k)
        );
        if (!matchKey) continue;

        const detectionRating = amfeDetection.get(matchKey)!;
        if (detectionRating > 3) {
            issues.push({
                severity: 'warning',
                code: 'POKAYOKE_HIGH_D',
                message: `Item "${item.processDescription}": Método Poka-Yoke pero detección AMFE D=${detectionRating} (esperado D<=3). Verificar si D fue actualizado.`,
                itemId: item.id,
            });
        }
    }

    return issues;
}

// ============================================================================
// V7: Sampling Consistency
// ============================================================================

/**
 * If sampleSize is "100%" the frequency should indicate continuous/each piece.
 * Warning if 100% sample but frequency doesn't match.
 */
export function validateSamplingConsistency(
    cpDoc: ControlPlanDocument,
): CpValidationIssue[] {
    const issues: CpValidationIssue[] = [];
    if (!cpDoc?.items) return issues;

    for (const item of cpDoc.items) {
        const size = (item.sampleSize ?? '').trim().toLowerCase();
        const freq = (item.sampleFrequency ?? '').trim().toLowerCase();

        if (size !== '100%') continue;
        if (!freq) continue; // don't warn if frequency is empty (other validators catch that)

        const isConsistent = freq.includes('pieza') || freq.includes('continuo') ||
            freq.includes('cada una') || freq.includes('100%') ||
            freq.includes('each') || freq.includes('continuous');

        if (!isConsistent) {
            issues.push({
                severity: 'info',
                code: 'SAMPLE_INCONSISTENCY',
                message: `Item "${item.processDescription}": Muestra 100% pero frecuencia "${item.sampleFrequency}" no indica muestreo continuo. Verificar coherencia.`,
                itemId: item.id,
            });
        }
    }

    return issues;
}

// ============================================================================
// HELPERS
// ============================================================================

function norm(s: string): string {
    return s.toLowerCase().trim().replace(/\s+/g, ' ');
}
