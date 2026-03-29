/**
 * HO → CP Link Validation
 *
 * Pure functions that verify referential integrity of cpItemId references
 * in Hoja de Operaciones quality checks against the linked Control Plan.
 *
 * Unlike PFD↔AMFE (bidirectional), this validation is one-way:
 * HO quality checks reference CP items, but CP doesn't reference HO back.
 *
 * @module hoCpLinkValidation
 */

import type { HoDocument } from '../modules/hojaOperaciones/hojaOperacionesTypes';
import type { ControlPlanDocument } from '../modules/controlPlan/controlPlanTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrokenHoCpLink {
    /** The HO sheet containing the broken quality check */
    sheetId: string;
    sheetName: string;
    /** The quality check with the broken link */
    checkId: string;
    characteristic: string;
    /** The CP item ID that doesn't exist */
    cpItemId: string;
}

export interface HoCpLinkValidationResult {
    /** Quality checks pointing to non-existent CP items */
    brokenLinks: BrokenHoCpLink[];
    /** Total count of broken links */
    totalBroken: number;
    /** Whether both documents have valid data to check */
    isValid: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate referential integrity of cpItemId references in HO quality checks
 * against the linked Control Plan items.
 */
export function validateHoCpLinks(
    hoDoc: HoDocument | null,
    cpDoc: ControlPlanDocument | null,
): HoCpLinkValidationResult {
    const brokenLinks: BrokenHoCpLink[] = [];

    if (!hoDoc || !cpDoc || !cpDoc.items || !hoDoc.sheets) {
        return { brokenLinks, totalBroken: 0, isValid: false };
    }

    // Build lookup set for fast existence checks
    const cpItemIds = new Set(cpDoc.items.map(item => item.id));

    // Check every quality check across all sheets
    for (const sheet of hoDoc.sheets) {
        for (const qc of sheet.qualityChecks) {
            if (qc.cpItemId && !cpItemIds.has(qc.cpItemId)) {
                brokenLinks.push({
                    sheetId: sheet.id,
                    sheetName: sheet.operationName || sheet.hoNumber || sheet.operationNumber || `Sheet ${sheet.id}`,
                    checkId: qc.id,
                    characteristic: qc.characteristic,
                    cpItemId: qc.cpItemId,
                });
            }
        }
    }

    return { brokenLinks, totalBroken: brokenLinks.length, isValid: true };
}

/**
 * Get quality check IDs that have broken CP links (for UI highlighting).
 */
export function getBrokenHoCheckIds(result: HoCpLinkValidationResult): Set<string> {
    return new Set(result.brokenLinks.map(l => l.checkId));
}

/**
 * Build candidate list for re-linking: all CP items available.
 * Labels: "processStepNumber — productCharacteristic || processCharacteristic"
 */
export function getCpRelinkCandidates(
    cpDoc: ControlPlanDocument,
): { id: string; label: string }[] {
    return cpDoc.items.map(item => ({
        id: item.id,
        label: `${item.processStepNumber} — ${item.productCharacteristic || item.processCharacteristic || '(sin característica)'}`,
    }));
}

// ---------------------------------------------------------------------------
// CP → HO Coverage Gap Detection
// ---------------------------------------------------------------------------

export interface CpHoCoverageGap {
    cpItemId: string;
    processStepNumber: string;
    characteristic: string;
    reactionPlanOwner: string;
}

export interface CpHoCoverageResult {
    gaps: CpHoCoverageGap[];
    totalGaps: number;
}

/** Roles whose controls should NOT go to the HO (lab, metrology, audits). */
const NON_HO_ROLES = ['laboratorio', 'metrología', 'metrologia', 'metrologo', 'auditor'];

/**
 * Find CP items that have no corresponding HO qcItem (by cpItemId).
 * Only reports items whose reactionPlanOwner is a shop-floor role
 * (excludes laboratory, metrology, and audit controls per CP→HO filtering rules).
 */
function validateCpHoCoverage(
    cpDoc: ControlPlanDocument | null,
    hoDoc: HoDocument | null,
): CpHoCoverageResult {
    const gaps: CpHoCoverageGap[] = [];
    if (!cpDoc || !hoDoc) return { gaps, totalGaps: 0 };

    // Build set of CP item IDs referenced by HO qcItems
    const coveredCpIds = new Set<string>();
    for (const sheet of hoDoc.sheets) {
        for (const qc of sheet.qualityChecks) {
            if (qc.cpItemId) coveredCpIds.add(qc.cpItemId);
        }
    }

    for (const item of cpDoc.items) {
        if (coveredCpIds.has(item.id)) continue;

        // Skip items whose owner is lab/metrology/audit (they don't go to HO)
        const ownerLower = (item.reactionPlanOwner || '').toLowerCase();
        if (NON_HO_ROLES.some(role => ownerLower.includes(role))) continue;

        gaps.push({
            cpItemId: item.id,
            processStepNumber: item.processStepNumber,
            characteristic: item.productCharacteristic || item.processCharacteristic || '',
            reactionPlanOwner: item.reactionPlanOwner || '',
        });
    }

    return { gaps, totalGaps: gaps.length };
}
