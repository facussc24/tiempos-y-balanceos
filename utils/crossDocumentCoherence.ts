/**
 * Cross-Document Coherence Check
 *
 * Unified verifier that checks consistency between AMFE and CP.
 * Runs on demand (button click), NOT on every save. Informational only — no blocking.
 *
 * Reuses existing validation functions from cpCrossValidation.ts
 * (AMFE → CP orphan failures, failure coverage).
 */

import type { AmfeDocument } from '../modules/amfe/amfeTypes';
import type { ControlPlanDocument } from '../modules/controlPlan/controlPlanTypes';

import { validateCpAgainstAmfe } from '../modules/controlPlan/cpCrossValidation';

// ============================================================================
// TYPES
// ============================================================================

export type CoherenceSeverity = 'error' | 'warning' | 'info';

export interface CoherenceIssue {
    severity: CoherenceSeverity;
    category: 'amfe-cp' | 'op-names';
    message: string;
    navigateTo?: { module: 'amfe' | 'cp'; itemId?: string };
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
    amfeDoc: AmfeDocument | null,
    cpDoc: ControlPlanDocument | null,
): CoherenceResult {
    const issues: CoherenceIssue[] = [];

    // C1: AMFE → CP
    if (amfeDoc && cpDoc) {
        issues.push(...checkAmfeCpCoherence(amfeDoc, cpDoc));
    }

    // C2: Operation names across documents
    issues.push(...checkOperationNames(amfeDoc, cpDoc));

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
// C2: OPERATION NAMES ACROSS DOCUMENTS
// ============================================================================

function normalizeOpName(name: string): string {
    return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function checkOperationNames(
    amfeDoc: AmfeDocument | null,
    cpDoc: ControlPlanDocument | null,
): CoherenceIssue[] {
    const issues: CoherenceIssue[] = [];

    // Build map: opNumber → { amfe?, cp? }
    const opMap = new Map<string, { amfe?: string; cp?: string }>();

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
