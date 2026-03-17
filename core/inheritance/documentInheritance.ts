/**
 * Document Inheritance Engine for APQP Documents
 *
 * Deep-clones a master document (AMFE, CP, PFD, or HO) to create a variant copy
 * with fresh UUIDs. Links the new document to the family via family_documents.
 *
 * Used when creating a new product variant that shares the same process family.
 *
 * @module core/inheritance/documentInheritance
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

// Repositories
import { loadAmfeDocument, saveAmfeDocument } from '../../utils/repositories/amfeRepository';
import { loadPfdDocument, savePfdDocument } from '../../utils/repositories/pfdRepository';
import { loadCpDocument, saveCpDocument } from '../../utils/repositories/cpRepository';
import { loadHoDocument, saveHoDocument } from '../../utils/repositories/hoRepository';
import {
    getFamilyMasterDocument,
    linkDocumentToFamily,
} from '../../utils/repositories/familyDocumentRepository';

// Types
import type { AmfeDocument } from '../../modules/amfe/amfeTypes';
import type { PfdDocument } from '../../modules/pfd/pfdTypes';
import type { ControlPlanDocument } from '../../modules/controlPlan/controlPlanTypes';
import type { HoDocument } from '../../modules/hojaOperaciones/hojaOperacionesTypes';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export type DocumentModule = 'pfd' | 'amfe' | 'cp' | 'ho';

export interface CloneResult {
    success: boolean;
    newDocumentId: string | null;
    familyDocId: number | null;
    error?: string;
}

// ---------------------------------------------------------------------------
// UUID Regeneration
// ---------------------------------------------------------------------------

/** Regex for a standard UUID v4 string (8-4-4-4-12 hex). */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Recursively walks an object/array and replaces every string field named `id`
 * whose value matches the UUID v4 pattern with a fresh UUID.
 *
 * Returns the cloned object and a map of old-UUID -> new-UUID so that
 * internal cross-references can be resolved by the caller if needed.
 */
export function regenerateUuids(obj: unknown): { result: unknown; idMap: Map<string, string> } {
    const idMap = new Map<string, string>();

    function walk(value: unknown, key?: string): unknown {
        if (value === null || value === undefined) {
            return value;
        }

        if (Array.isArray(value)) {
            return value.map((item) => walk(item));
        }

        if (typeof value === 'object') {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
                out[k] = walk(v, k);
            }
            return out;
        }

        // Leaf value — only replace strings named 'id' that look like UUIDs
        if (typeof value === 'string' && key === 'id' && UUID_REGEX.test(value)) {
            // Reuse the same mapping if we have seen this UUID before
            // (handles e.g. duplicated references)
            if (!idMap.has(value)) {
                idMap.set(value, uuidv4());
            }
            return idMap.get(value)!;
        }

        return value;
    }

    const result = walk(obj);
    return { result, idMap };
}

// ---------------------------------------------------------------------------
// Per-module clone helpers
// ---------------------------------------------------------------------------

interface AmfeCloneResult {
    newId: string;
    newDoc: AmfeDocument;
    projectName: string;
}

function cloneAmfeDocument(doc: AmfeDocument, meta: { projectName: string; amfeNumber: string }, variantLabel: string): AmfeCloneResult {
    const cloned = JSON.parse(JSON.stringify(doc)) as AmfeDocument;
    const { result } = regenerateUuids(cloned);
    const newDoc = result as AmfeDocument;

    // Append variant label to the AMFE number in the header
    newDoc.header.amfeNumber = `${meta.amfeNumber} [${variantLabel}]`;
    newDoc.header.subject = `${doc.header.subject || meta.projectName} [${variantLabel}]`;

    const newId = uuidv4();
    const projectName = `${meta.projectName} [${variantLabel}]`;
    return { newId, newDoc, projectName };
}

interface PfdCloneResult {
    newId: string;
    newDoc: PfdDocument;
}

function clonePfdDocument(doc: PfdDocument, variantLabel: string): PfdCloneResult {
    const cloned = JSON.parse(JSON.stringify(doc)) as PfdDocument;
    const { result } = regenerateUuids(cloned);
    const newDoc = result as PfdDocument;

    const newId = uuidv4();
    newDoc.id = newId;
    newDoc.header.partName = `${doc.header.partName} [${variantLabel}]`;
    newDoc.header.documentNumber = doc.header.documentNumber
        ? `${doc.header.documentNumber}-${variantLabel}`
        : '';
    newDoc.createdAt = new Date().toISOString();
    newDoc.updatedAt = new Date().toISOString();

    return { newId, newDoc };
}

interface CpCloneResult {
    newId: string;
    newDoc: ControlPlanDocument;
    projectName: string;
}

function cloneCpDocument(doc: ControlPlanDocument, originalProjectName: string, variantLabel: string): CpCloneResult {
    const cloned = JSON.parse(JSON.stringify(doc)) as ControlPlanDocument;
    const { result } = regenerateUuids(cloned);
    const newDoc = result as ControlPlanDocument;

    newDoc.header.controlPlanNumber = doc.header.controlPlanNumber
        ? `${doc.header.controlPlanNumber} [${variantLabel}]`
        : '';
    newDoc.header.partName = `${doc.header.partName} [${variantLabel}]`;

    const newId = uuidv4();
    const projectName = `${originalProjectName} [${variantLabel}]`;
    return { newId, newDoc, projectName };
}

interface HoCloneResult {
    newId: string;
    newDoc: HoDocument;
}

function cloneHoDocument(doc: HoDocument, variantLabel: string): HoCloneResult {
    const cloned = JSON.parse(JSON.stringify(doc)) as HoDocument;
    const { result } = regenerateUuids(cloned);
    const newDoc = result as HoDocument;

    newDoc.header.partDescription = `${doc.header.partDescription} [${variantLabel}]`;

    const newId = uuidv4();
    return { newId, newDoc };
}

// ---------------------------------------------------------------------------
// Main clone function
// ---------------------------------------------------------------------------

/**
 * Clones a master document to create a variant.
 *
 * 1. Loads the original document using the appropriate repository.
 * 2. Deep-clones the JSON structure.
 * 3. Regenerates all internal UUIDs.
 * 4. Modifies the header to indicate it is a variant (appends "[variantLabel]").
 * 5. Saves as a new document (INSERT, not UPDATE).
 * 6. Registers the new document in `family_documents` as a variant.
 * 7. Returns a `CloneResult`.
 */
export async function cloneDocumentForVariant(params: {
    familyId: number;
    module: DocumentModule;
    masterDocumentId: string;
    masterFamilyDocId: number;
    variantLabel: string;
    productId?: number;
}): Promise<CloneResult> {
    const { familyId, module, masterDocumentId, masterFamilyDocId, variantLabel, productId } = params;
    const LOG_TAG = 'DocumentInheritance';

    try {
        logger.info(LOG_TAG, `Cloning ${module} document ${masterDocumentId} for variant "${variantLabel}"`);

        let newDocumentId: string;

        switch (module) {
            case 'amfe': {
                const loaded = await loadAmfeDocument(masterDocumentId);
                if (!loaded) {
                    return { success: false, newDocumentId: null, familyDocId: null, error: `AMFE document ${masterDocumentId} not found` };
                }
                const { newId, newDoc, projectName } = cloneAmfeDocument(loaded.doc, { projectName: loaded.meta.projectName, amfeNumber: loaded.meta.amfeNumber }, variantLabel);
                const saved = await saveAmfeDocument(newId, newDoc.header.amfeNumber, projectName, newDoc, 'draft', []);
                if (!saved) {
                    return { success: false, newDocumentId: null, familyDocId: null, error: `Failed to save cloned AMFE document` };
                }
                newDocumentId = newId;
                break;
            }

            case 'pfd': {
                const loaded = await loadPfdDocument(masterDocumentId);
                if (!loaded) {
                    return { success: false, newDocumentId: null, familyDocId: null, error: `PFD document ${masterDocumentId} not found` };
                }
                const { newId, newDoc } = clonePfdDocument(loaded, variantLabel);
                const saved = await savePfdDocument(newId, newDoc);
                if (!saved) {
                    return { success: false, newDocumentId: null, familyDocId: null, error: `Failed to save cloned PFD document` };
                }
                newDocumentId = newId;
                break;
            }

            case 'cp': {
                const loaded = await loadCpDocument(masterDocumentId);
                if (!loaded) {
                    return { success: false, newDocumentId: null, familyDocId: null, error: `CP document ${masterDocumentId} not found` };
                }
                // CP needs a project name — derive from the controlPlanNumber or partName
                const originalProjectName = loaded.header.controlPlanNumber || loaded.header.partName || masterDocumentId;
                const { newId, newDoc, projectName } = cloneCpDocument(loaded, originalProjectName, variantLabel);
                const saved = await saveCpDocument(newId, projectName, newDoc);
                if (!saved) {
                    return { success: false, newDocumentId: null, familyDocId: null, error: `Failed to save cloned CP document` };
                }
                newDocumentId = newId;
                break;
            }

            case 'ho': {
                const loaded = await loadHoDocument(masterDocumentId);
                if (!loaded) {
                    return { success: false, newDocumentId: null, familyDocId: null, error: `HO document ${masterDocumentId} not found` };
                }
                const { newId, newDoc } = cloneHoDocument(loaded, variantLabel);
                const saved = await saveHoDocument(newId, newDoc);
                if (!saved) {
                    return { success: false, newDocumentId: null, familyDocId: null, error: `Failed to save cloned HO document` };
                }
                newDocumentId = newId;
                break;
            }

            default: {
                const _exhaustive: never = module;
                return { success: false, newDocumentId: null, familyDocId: null, error: `Unknown module: ${_exhaustive}` };
            }
        }

        // Register in family_documents as a variant
        const familyDocId = await linkDocumentToFamily({
            familyId,
            module,
            documentId: newDocumentId,
            isMaster: false,
            sourceMasterId: masterFamilyDocId,
            productId,
        });

        logger.info(LOG_TAG, `Successfully cloned ${module} document`, {
            masterDocumentId,
            newDocumentId,
            familyDocId,
            variantLabel,
        });

        return { success: true, newDocumentId, familyDocId };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(LOG_TAG, `Clone failed for ${module} document ${masterDocumentId}`, { error: message }, err instanceof Error ? err : undefined);
        return { success: false, newDocumentId: null, familyDocId: null, error: message };
    }
}

// ---------------------------------------------------------------------------
// Batch clone: all master documents in a family
// ---------------------------------------------------------------------------

/**
 * Clones all master documents of a family for a new variant.
 * Only clones modules that have a master document linked to the family.
 * If one module fails, the others are still attempted (no all-or-nothing).
 */
export async function cloneAllMasterDocuments(params: {
    familyId: number;
    variantLabel: string;
    productId?: number;
}): Promise<{ results: Record<DocumentModule, CloneResult | null>; errors: string[] }> {
    const { familyId, variantLabel, productId } = params;
    const modules: DocumentModule[] = ['pfd', 'amfe', 'cp', 'ho'];
    const results: Record<DocumentModule, CloneResult | null> = {
        pfd: null,
        amfe: null,
        cp: null,
        ho: null,
    };
    const errors: string[] = [];

    logger.info('DocumentInheritance', `Cloning all masters for family ${familyId}, variant "${variantLabel}"`);

    for (const mod of modules) {
        try {
            const master = await getFamilyMasterDocument(familyId, mod);
            if (!master) {
                // No master for this module — skip silently
                results[mod] = null;
                continue;
            }

            const result = await cloneDocumentForVariant({
                familyId,
                module: mod,
                masterDocumentId: master.documentId,
                masterFamilyDocId: master.id,
                variantLabel,
                productId,
            });

            results[mod] = result;
            if (!result.success && result.error) {
                errors.push(`[${mod.toUpperCase()}] ${result.error}`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`[${mod.toUpperCase()}] Unexpected error: ${message}`);
            results[mod] = { success: false, newDocumentId: null, familyDocId: null, error: message };
        }
    }

    logger.info('DocumentInheritance', `Batch clone complete for family ${familyId}`, {
        variantLabel,
        cloned: modules.filter(m => results[m]?.success).map(m => m),
        failed: errors.length,
    });

    return { results, errors };
}
