/**
 * Cross-Document Coherence Check
 *
 * Unified verifier that checks consistency across PFD, AMFE, CP, and HO.
 * Runs on demand (button click), NOT on every save. Informational only — no blocking.
 *
 * Reuses existing validation functions from:
 * - pfdAmfeLinkValidation.ts (PFD ↔ AMFE broken links)
 * - hoCpLinkValidation.ts (HO → CP broken links, CP → HO coverage gaps)
 * - cpCrossValidation.ts (AMFE → CP orphan failures, failure coverage)
 */

import type { PfdDocument } from '../modules/pfd/pfdTypes';
import type { AmfeDocument } from '../modules/amfe/amfeTypes';
import type { ControlPlanDocument } from '../modules/controlPlan/controlPlanTypes';
import type { HoDocument } from '../modules/hojaOperaciones/hojaOperacionesTypes';

import { validatePfdAmfeLinks } from './pfdAmfeLinkValidation';
import { validateHoCpLinks, validateCpHoCoverage } from './hoCpLinkValidation';
import { validateCpAgainstAmfe } from '../modules/controlPlan/cpCrossValidation';

// ============================================================================
// TYPES
// ============================================================================

export type CoherenceSeverity = 'error' | 'warning' | 'info';

export interface CoherenceIssue {
    severity: CoherenceSeverity;
    category: 'amfe-cp' | 'cp-ho' | 'pfd-amfe' | 'op-names';
    message: string;
    navigateTo?: { module: 'pfd' | 'amfe' | 'cp' | 'ho'; itemId?: string };
}

export interface CoherenceResult {
    issues: CoherenceIssue[];
    summary: {
        errors: number;
        warnings: number;
        infos: number;
        status: 'green' | 'yellow' | 'red';
    };
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export function runCoherenceCheck(
    pfdDoc: PfdDocument | null,
    amfeDoc: AmfeDocument | null,
    cpDoc: ControlPlanDocument | null,
    hoDoc: HoDocument | null,
): CoherenceResult {
    const issues: CoherenceIssue[] = [];

    // C1: AMFE → CP
    if (amfeDoc && cpDoc) {
        issues.push(...checkAmfeCpCoherence(amfeDoc, cpDoc));
    }

    // C2: CP → HO
    if (cpDoc && hoDoc) {
        issues.push(...checkCpHoCoherence(cpDoc, hoDoc));
    }

    // C3: PFD ↔ AMFE
    if (pfdDoc && amfeDoc) {
        issues.push(...checkPfdAmfeCoherence(pfdDoc, amfeDoc));
    }

    // C4: Operation names across documents
    issues.push(...checkOperationNames(pfdDoc, amfeDoc, cpDoc, hoDoc));

    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const infos = issues.filter(i => i.severity === 'info').length;

    return {
        issues,
        summary: {
            errors,
            warnings,
            infos,
            status: errors > 0 ? 'red' : warnings > 0 ? 'yellow' : 'green',
        },
    };
}

// ============================================================================
// C1: AMFE → CP COHERENCE
// ============================================================================

function checkAmfeCpCoherence(amfeDoc: AmfeDocument, cpDoc: ControlPlanDocument): CoherenceIssue[] {
    const issues: CoherenceIssue[] = [];

    // Reuse existing validateCpAgainstAmfe for rich validation
    const cpIssues = validateCpAgainstAmfe(cpDoc, amfeDoc);
    for (const issue of cpIssues) {
        // Only include orphan failures and coverage gaps (the most important cross-doc issues)
        if (issue.code === 'ORPHAN_FAILURE' || issue.code === 'FAILURE_NO_CP_ITEM') {
            issues.push({
                severity: issue.severity === 'error' ? 'error' : 'warning',
                category: 'amfe-cp',
                message: issue.message,
                navigateTo: issue.itemId ? { module: 'cp', itemId: issue.itemId } : undefined,
            });
        }
    }

    // Check for CP items with broken amfeFailureId
    const amfeFailureIds = new Set<string>();
    for (const op of amfeDoc.operations) {
        for (const we of op.workElements) {
            for (const func of we.functions) {
                for (const fail of func.failures) {
                    amfeFailureIds.add(fail.id);
                }
            }
        }
    }

    for (const item of cpDoc.items) {
        if (item.amfeFailureId && !amfeFailureIds.has(item.amfeFailureId)) {
            issues.push({
                severity: 'error',
                category: 'amfe-cp',
                message: `OP ${item.processStepNumber} "${item.productCharacteristic || item.processCharacteristic || ''}": amfeFailureId apunta a falla inexistente en AMFE`,
                navigateTo: { module: 'cp', itemId: item.id },
            });
        }
    }

    return issues;
}

// ============================================================================
// C2: CP → HO COHERENCE
// ============================================================================

function checkCpHoCoherence(cpDoc: ControlPlanDocument, hoDoc: HoDocument): CoherenceIssue[] {
    const issues: CoherenceIssue[] = [];

    // Reuse existing broken link validation
    const linkResult = validateHoCpLinks(hoDoc, cpDoc);
    for (const link of linkResult.brokenLinks) {
        issues.push({
            severity: 'error',
            category: 'cp-ho',
            message: `HO "${link.sheetName}" qcItem "${link.characteristic}": cpItemId "${link.cpItemId}" apunta a item CP inexistente`,
            navigateTo: { module: 'ho' },
        });
    }

    // Reuse existing coverage gap detection
    const coverageResult = validateCpHoCoverage(cpDoc, hoDoc);
    for (const gap of coverageResult.gaps) {
        issues.push({
            severity: 'warning',
            category: 'cp-ho',
            message: `OP ${gap.processStepNumber} "${gap.characteristic}": item CP sin cobertura en HO (responsable: ${gap.reactionPlanOwner})`,
            navigateTo: { module: 'cp', itemId: gap.cpItemId },
        });
    }

    // Check reactionContact mismatch between CP and HO for linked items
    const cpItemMap = new Map(cpDoc.items.map(item => [item.id, item]));

    for (const sheet of hoDoc.sheets) {
        for (const qc of sheet.qualityChecks) {
            if (!qc.cpItemId) continue;
            const cpItem = cpItemMap.get(qc.cpItemId);
            if (!cpItem) continue; // broken link, already reported above

            const cpOwner = (cpItem.reactionPlanOwner || '').trim().toLowerCase();
            const hoContact = (qc.reactionContact || '').trim().toLowerCase();
            if (cpOwner && hoContact && cpOwner !== hoContact) {
                issues.push({
                    severity: 'warning',
                    category: 'cp-ho',
                    message: `OP ${sheet.operationNumber} "${qc.characteristic || ''}": responsable difiere — CP: "${cpItem.reactionPlanOwner}", HO: "${qc.reactionContact}"`,
                    navigateTo: { module: 'ho' },
                });
            }
        }
    }

    return issues;
}

// ============================================================================
// C3: PFD ↔ AMFE COHERENCE
// ============================================================================

function checkPfdAmfeCoherence(pfdDoc: PfdDocument, amfeDoc: AmfeDocument): CoherenceIssue[] {
    const issues: CoherenceIssue[] = [];

    // Reuse existing link validation
    const linkResult = validatePfdAmfeLinks(pfdDoc, amfeDoc);

    for (const link of linkResult.brokenPfdLinks) {
        issues.push({
            severity: 'error',
            category: 'pfd-amfe',
            message: `PFD step "${link.stepDescription || link.stepNumber}" tiene link AMFE roto`,
            navigateTo: { module: 'pfd', itemId: link.stepId },
        });
    }

    for (const link of linkResult.brokenAmfeLinks) {
        issues.push({
            severity: 'error',
            category: 'pfd-amfe',
            message: `AMFE operacion "${link.operationName || link.opNumber}" tiene link PFD roto`,
            navigateTo: { module: 'amfe', itemId: link.operationId },
        });
    }

    // AMFE operations without PFD link
    for (const op of amfeDoc.operations) {
        if (!op.linkedPfdStepId) {
            issues.push({
                severity: 'info',
                category: 'pfd-amfe',
                message: `AMFE operacion "${op.name}" (OP ${op.opNumber}) sin vinculo a PFD`,
                navigateTo: { module: 'amfe' },
            });
        }
    }

    // PFD operation steps with no matching AMFE operation (by opNumber)
    const amfeOpNumbers = new Set(amfeDoc.operations.map(op => op.opNumber));
    for (const step of pfdDoc.steps) {
        if (step.stepType !== 'operation') continue;
        if (!amfeOpNumbers.has(step.stepNumber)) {
            issues.push({
                severity: 'warning',
                category: 'pfd-amfe',
                message: `PFD step OP ${step.stepNumber} "${step.description}" sin operacion en AMFE`,
                navigateTo: { module: 'pfd', itemId: step.id },
            });
        }
    }

    return issues;
}

// ============================================================================
// C4: OPERATION NAMES ACROSS DOCUMENTS
// ============================================================================

function normalizeOpName(name: string): string {
    return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function checkOperationNames(
    pfdDoc: PfdDocument | null,
    amfeDoc: AmfeDocument | null,
    cpDoc: ControlPlanDocument | null,
    hoDoc: HoDocument | null,
): CoherenceIssue[] {
    const issues: CoherenceIssue[] = [];

    // Build map: opNumber → { pfd?, amfe?, cp?, ho? }
    const opMap = new Map<string, { pfd?: string; amfe?: string; cp?: string; ho?: string }>();

    if (pfdDoc) {
        for (const step of pfdDoc.steps) {
            const num = step.stepNumber;
            if (!num) continue;
            const entry = opMap.get(num) || {};
            entry.pfd = step.description;
            opMap.set(num, entry);
        }
    }

    if (amfeDoc) {
        for (const op of amfeDoc.operations) {
            const num = op.opNumber;
            if (!num) continue;
            const entry = opMap.get(num) || {};
            entry.amfe = op.name;
            opMap.set(num, entry);
        }
    }

    if (cpDoc) {
        // CP may have multiple items per operation — use first non-empty
        for (const item of cpDoc.items) {
            const num = item.processStepNumber;
            if (!num) continue;
            const entry = opMap.get(num) || {};
            if (!entry.cp && (item.processDescription || '').trim()) {
                entry.cp = item.processDescription;
            }
            opMap.set(num, entry);
        }
    }

    if (hoDoc) {
        for (const sheet of hoDoc.sheets) {
            const num = sheet.operationNumber;
            if (!num) continue;
            const entry = opMap.get(num) || {};
            entry.ho = sheet.operationName;
            opMap.set(num, entry);
        }
    }

    // Compare names for each operation
    for (const [opNum, names] of opMap) {
        const allNames = Object.entries(names)
            .filter(([, name]) => name && name.trim())
            .map(([source, name]) => ({ source, name: name!, normalized: normalizeOpName(name!) }));

        if (allNames.length < 2) continue; // need at least 2 to compare

        const baseline = allNames[0].normalized;
        const mismatches = allNames.filter(n => n.normalized !== baseline);

        if (mismatches.length > 0) {
            const details = allNames.map(n => `${n.source.toUpperCase()}="${n.name}"`).join(', ');
            issues.push({
                severity: 'warning',
                category: 'op-names',
                message: `OP ${opNum}: nombres difieren entre documentos — ${details}`,
            });
        }
    }

    return issues;
}
