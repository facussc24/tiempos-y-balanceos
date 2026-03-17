/**
 * Post-Save Override Tracking Trigger
 *
 * Fire-and-forget helper that runs after a successful document save.
 * Checks if the saved document is a variant (via family_documents), and
 * if so, loads the master document and calls `trackOverrides` to persist
 * the diff in `family_document_overrides`.
 *
 * Designed to be called from each module's save flow WITHOUT blocking it.
 * Errors are logged but never propagated to the caller or shown to the user.
 *
 * @module core/inheritance/triggerOverrideTracking
 */

import { logger } from '../../utils/logger';
import {
    getDocumentFamilyInfo,
    getFamilyMasterDocument,
} from '../../utils/repositories/familyDocumentRepository';
import { trackOverrides } from './overrideTracker';
import type { DocumentModule } from './documentInheritance';

// Module-specific document loaders
import { loadAmfeDocument } from '../../utils/repositories/amfeRepository';
import { loadPfdDocument } from '../../utils/repositories/pfdRepository';
import { loadCpDocument } from '../../utils/repositories/cpRepository';
import { loadHoDocument } from '../../utils/repositories/hoRepository';

import type { AmfeDocument } from '../../modules/amfe/amfeTypes';
import type { PfdDocument } from '../../modules/pfd/pfdTypes';
import type { ControlPlanDocument } from '../../modules/controlPlan/controlPlanTypes';
import type { HoDocument } from '../../modules/hojaOperaciones/hojaOperacionesTypes';

const LOG_TAG = 'OverrideTrackingTrigger';

type AnyDocument = AmfeDocument | PfdDocument | ControlPlanDocument | HoDocument;

/**
 * Load a master document by its UUID, using the appropriate repository
 * for the given module type.
 */
async function loadMasterDocument(masterDocumentId: string, module: DocumentModule): Promise<AnyDocument | null> {
    switch (module) {
        case 'amfe': {
            const result = await loadAmfeDocument(masterDocumentId);
            return result?.doc ?? null;
        }
        case 'pfd':
            return loadPfdDocument(masterDocumentId);
        case 'cp':
            return loadCpDocument(masterDocumentId);
        case 'ho':
            return loadHoDocument(masterDocumentId);
        default: {
            const _exhaustive: never = module;
            logger.warn(LOG_TAG, `Unknown module type: ${_exhaustive}`);
            return null;
        }
    }
}

/**
 * Trigger override tracking for a document after a successful save.
 *
 * This function is fire-and-forget: it runs asynchronously and never throws.
 * It checks if the document is a variant, and if so, diffs it against its
 * master and persists the overrides.
 *
 * @param documentId  - The UUID of the saved document (as stored in the repository)
 * @param variantDoc  - The document content that was just saved
 * @param moduleType  - Which APQP module ('pfd' | 'amfe' | 'cp' | 'ho')
 */
export function triggerOverrideTracking(
    documentId: string,
    variantDoc: AnyDocument,
    moduleType: DocumentModule
): void {
    // Fire-and-forget: run async without awaiting
    (async () => {
        try {
            // Step 1: Check if this document belongs to a family and is a variant
            const familyInfo = await getDocumentFamilyInfo(documentId);

            if (!familyInfo) {
                // Not linked to any family — nothing to track
                return;
            }

            if (familyInfo.isMaster) {
                // Master documents don't have overrides
                return;
            }

            // Step 2: Find the master document for this family + module
            const masterFamilyDoc = await getFamilyMasterDocument(familyInfo.familyId, moduleType);

            if (!masterFamilyDoc) {
                logger.warn(LOG_TAG, 'No master document found for family', {
                    familyId: familyInfo.familyId,
                    module: moduleType,
                    variantDocId: documentId,
                });
                return;
            }

            // Step 3: Load the master document content
            const masterDoc = await loadMasterDocument(masterFamilyDoc.documentId, moduleType);

            if (!masterDoc) {
                logger.warn(LOG_TAG, 'Failed to load master document content', {
                    masterDocumentId: masterFamilyDoc.documentId,
                    module: moduleType,
                });
                return;
            }

            // Step 4: Track overrides (diff + persist)
            const result = await trackOverrides(variantDoc, masterDoc, moduleType, familyInfo.id);

            logger.info(LOG_TAG, `Override tracking completed for ${moduleType}`, {
                documentId,
                familyDocId: familyInfo.id,
                overrides: result.totalOverrides,
            });
        } catch (err) {
            // Never propagate errors — this is a background side-effect
            logger.error(
                LOG_TAG,
                `Override tracking failed for ${moduleType} document ${documentId}`,
                { error: err instanceof Error ? err.message : String(err) },
                err instanceof Error ? err : undefined
            );
        }
    })();
}
