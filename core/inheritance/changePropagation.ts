/**
 * Change Propagation Engine for Master → Variant Inheritance
 *
 * When a master document is saved, this module:
 * 1. Diffs old master vs new master to find changed items
 * 2. For each variant of the same family+module, creates change proposals
 * 3. Smart logic: if variant has an override on a changed item → status 'pending';
 *    if no override → status 'auto_applied'
 *
 * @module core/inheritance/changePropagation
 */

import { logger } from '../../utils/logger';
import { getDatabase } from '../../utils/database';
import { extractItems } from './overrideTracker';
import {
    getDocumentFamilyInfo,
    getVariantDocuments,
    listOverrides,
    createProposal,
    type FamilyDocument,
} from '../../utils/repositories/familyDocumentRepository';

import type { DocumentModule } from './documentInheritance';

// Module document types
import type { AmfeDocument } from '../../modules/amfe/amfeTypes';
import type { PfdDocument } from '../../modules/pfd/pfdTypes';
import type { ControlPlanDocument } from '../../modules/controlPlan/controlPlanTypes';
import type { HoDocument } from '../../modules/hojaOperaciones/hojaOperacionesTypes';

// =============================================================================
// PUBLIC TYPES
// =============================================================================

/** Union type for any APQP document. */
type AnyDocument = AmfeDocument | PfdDocument | ControlPlanDocument | HoDocument;

/** The type of change detected in a master document. */
export type MasterChangeType = 'added' | 'removed' | 'modified';

/** A single detected master change, before persistence. */
export interface DetectedMasterChange {
    itemType: string;
    itemId: string;
    changeType: MasterChangeType;
    /** Serialized item data from the old master (undefined for 'added'). */
    oldData?: string;
    /** Serialized item data from the new master (undefined for 'removed'). */
    newData?: string;
}

/** Summary of proposals created for all variants. */
export interface PropagationResult {
    totalProposals: number;
    autoApplied: number;
    pending: number;
    proposalsByVariant: Map<number, { autoApplied: number; pending: number }>;
}

// =============================================================================
// PURE DIFF FUNCTION
// =============================================================================

const LOG_TAG = 'ChangePropagation';

/**
 * Compare old master document vs new master document to detect what items changed.
 * Pure function — no side effects, no DB calls.
 *
 * Returns an array of changes with their old/new serialized data.
 */
export function diffMasterChanges(
    oldDoc: AnyDocument,
    newDoc: AnyDocument,
    moduleType: DocumentModule
): DetectedMasterChange[] {
    const oldItems = extractItems(oldDoc, moduleType);
    const newItems = extractItems(newDoc, moduleType);
    const changes: DetectedMasterChange[] = [];

    // Check for modified and added items (present in new)
    for (const [itemId, newItem] of newItems) {
        const oldItem = oldItems.get(itemId);

        if (!oldItem) {
            // Item exists only in new master → added
            changes.push({
                itemType: newItem.itemType,
                itemId,
                changeType: 'added',
                newData: newItem.data,
            });
        } else if (newItem.data !== oldItem.data) {
            // Item exists in both but content differs → modified
            changes.push({
                itemType: newItem.itemType,
                itemId,
                changeType: 'modified',
                oldData: oldItem.data,
                newData: newItem.data,
            });
        }
        // else: identical → no change
    }

    // Check for removed items (in old but not in new)
    for (const [itemId, oldItem] of oldItems) {
        if (!newItems.has(itemId)) {
            changes.push({
                itemType: oldItem.itemType,
                itemId,
                changeType: 'removed',
                oldData: oldItem.data,
            });
        }
    }

    return changes;
}

// =============================================================================
// ASYNC PROPAGATION
// =============================================================================

/**
 * Propagate master changes to all variants in the same family+module.
 *
 * For each variant, for each change:
 * - If the variant has an override on the changed item → create proposal with status 'pending'
 * - If no override → create proposal with status 'auto_applied'
 *
 * Before creating new proposals, clears any existing pending/auto_applied proposals
 * for the same target_family_doc_id to ensure idempotency.
 */
export async function propagateChangesToVariants(params: {
    familyId: number;
    module: string;
    masterDocId: string;
    oldDoc: AnyDocument;
    newDoc: AnyDocument;
    moduleType: DocumentModule;
}): Promise<PropagationResult> {
    const { familyId, module, masterDocId, oldDoc, newDoc, moduleType } = params;

    // 1. Diff the master documents
    const changes = diffMasterChanges(oldDoc, newDoc, moduleType);

    if (changes.length === 0) {
        logger.info(LOG_TAG, 'No changes detected in master document, skipping propagation');
        return { totalProposals: 0, autoApplied: 0, pending: 0, proposalsByVariant: new Map() };
    }

    // 2. Get all variants for this family+module
    const variants: FamilyDocument[] = await getVariantDocuments(familyId, module);

    if (variants.length === 0) {
        logger.info(LOG_TAG, 'No variants found, skipping propagation');
        return { totalProposals: 0, autoApplied: 0, pending: 0, proposalsByVariant: new Map() };
    }

    const result: PropagationResult = {
        totalProposals: 0,
        autoApplied: 0,
        pending: 0,
        proposalsByVariant: new Map(),
    };

    const db = await getDatabase();

    // 3. For each variant, create proposals
    for (const variant of variants) {
        // Clear old pending/auto_applied proposals for idempotency
        await db.execute(
            `DELETE FROM family_change_proposals WHERE target_family_doc_id = ? AND status IN ('pending', 'auto_applied')`,
            [variant.id]
        );

        // Load variant's existing overrides
        const overrides = await listOverrides(variant.id);
        const overrideSet = new Set(
            overrides.map(ov => `${ov.itemType}:${ov.itemId}`)
        );

        let variantAutoApplied = 0;
        let variantPending = 0;

        for (const change of changes) {
            const overrideKey = `${change.itemType}:${change.itemId}`;
            const hasOverride = overrideSet.has(overrideKey);
            const status = hasOverride ? 'pending' : 'auto_applied';

            await createProposal({
                familyId,
                module,
                masterDocId,
                targetFamilyDocId: variant.id,
                changeType: change.changeType,
                itemType: change.itemType,
                itemId: change.itemId,
                oldData: change.oldData,
                newData: change.newData,
            });

            if (status === 'auto_applied') {
                variantAutoApplied++;
                result.autoApplied++;
            } else {
                variantPending++;
                result.pending++;
            }
            result.totalProposals++;
        }

        result.proposalsByVariant.set(variant.id, {
            autoApplied: variantAutoApplied,
            pending: variantPending,
        });
    }

    logger.info(LOG_TAG, 'Propagation complete', {
        familyId,
        module,
        totalChanges: changes.length,
        totalVariants: variants.length,
        totalProposals: result.totalProposals,
        autoApplied: result.autoApplied,
        pending: result.pending,
    });

    return result;
}

// =============================================================================
// FIRE-AND-FORGET WRAPPER
// =============================================================================

/**
 * Fire-and-forget wrapper for change propagation.
 * Checks if the document is a master, and if so, propagates changes to all variants.
 *
 * Never throws — errors are logged and swallowed.
 * Runs async without blocking the caller.
 */
export function triggerChangePropagation(
    documentId: string,
    oldDoc: AnyDocument,
    newDoc: AnyDocument,
    moduleType: DocumentModule
): void {
    // Fire and forget — don't await
    void (async () => {
        try {
            // 1. Check if this document is part of a family
            const familyInfo = await getDocumentFamilyInfo(documentId);
            if (!familyInfo) {
                logger.debug(LOG_TAG, `Document ${documentId} is not linked to a family, skipping propagation`);
                return;
            }

            // 2. Only propagate if this is a master document
            if (!familyInfo.isMaster) {
                logger.debug(LOG_TAG, `Document ${documentId} is a variant, skipping propagation`);
                return;
            }

            // 3. Check if there are any variants to propagate to
            const variants = await getVariantDocuments(familyInfo.familyId, familyInfo.module);
            if (variants.length === 0) {
                logger.debug(LOG_TAG, `No variants for family ${familyInfo.familyId}/${familyInfo.module}, skipping propagation`);
                return;
            }

            // 4. Run propagation
            const result = await propagateChangesToVariants({
                familyId: familyInfo.familyId,
                module: familyInfo.module,
                masterDocId: documentId,
                oldDoc,
                newDoc,
                moduleType,
            });

            logger.info(LOG_TAG, `Change propagation completed for master ${documentId}`, {
                totalProposals: result.totalProposals,
                autoApplied: result.autoApplied,
                pending: result.pending,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error(LOG_TAG, `Change propagation failed for document ${documentId}`, { error: message }, err instanceof Error ? err : undefined);
            // Never throw — fire and forget
        }
    })();
}
