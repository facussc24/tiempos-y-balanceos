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
import { getFamilyById } from '../../utils/repositories/familyRepository';
import { createCrossFamilyAlert } from '../../utils/crossDocumentAlerts';

import type { DocumentModule } from './documentInheritance';

// Module document types
import type { AmfeDocument, AmfeOperation } from '../../modules/amfe/amfeTypes';
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

// =============================================================================
// CROSS-FAMILY PROPAGATION (process-master → product AMFEs)
// =============================================================================

const CROSS_FAMILY_LOG_TAG = 'CrossFamilyPropagation';

/**
 * Result summary for a cross-family propagation run.
 */
export interface CrossFamilyPropagationResult {
    scannedDocs: number;
    affectedDocs: number;
    alertsCreated: number;
    /** Per-doc details of matches, useful for reports. */
    matches: Array<{
        targetDocId: string;
        targetSubject: string;
        matchedOperationNames: string[];
    }>;
}

/**
 * Normalize an operation name for tolerant matching:
 * - Uppercase
 * - Trim
 * - Strip diacritics (NFD + \p{Diacritic})
 */
export function normalizeOperationName(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw
        .toUpperCase()
        .trim()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
}

/** Stopwords excluded from substring matching to avoid spurious hits. */
const SUBSTRING_STOPWORDS = new Set(['DE', 'Y', 'DEL', 'LA', 'EL', 'EN', 'A', 'O']);

/**
 * Tokens that, when present in a target op name alongside a match, indicate
 * the target is a different physical process even if the master token matches.
 * Example: the plastic injection master matches "INYECCION PU" via rule 2, but
 * PU (polyurethane) is chemically and mechanically different — no tornillo, no
 * drying, no mold temperature profile. Exclude it.
 */
const INCOMPATIBLE_PROCESS_MARKERS = ['PU', 'POLIURETANO', 'POLYURETHANE', 'PUR', 'ESPUMADO'];

/**
 * Extract normalized operation names from an AMFE document, tolerating both
 * `name`/`operationName` aliases and filtering out empty strings.
 */
function extractMasterOperationNames(doc: AmfeDocument | null | undefined): string[] {
    if (!doc || !Array.isArray(doc.operations)) return [];
    const names = new Set<string>();
    for (const op of doc.operations) {
        const raw = (op as AmfeOperation & { operationName?: string }).name
            ?? (op as AmfeOperation & { operationName?: string }).operationName
            ?? '';
        const norm = normalizeOperationName(raw);
        if (norm) names.add(norm);
    }
    return [...names];
}

/**
 * Check whether a normalized target op name matches any of the normalized
 * master op names. Matching is ASYMMETRIC on purpose:
 *
 *  1. Exact normalized equality → match, OR
 *  2. Master op name appears as a full-token substring inside the target op
 *     (e.g. master "INYECCION" matches target "INYECCION DE SUSTRATO",
 *     "INYECCION DE PIEZA PLASTICA", etc.).
 *
 * We deliberately do NOT match in the other direction (target tokens inside
 * master) because a master's incidental token does not imply the target is
 * semantically related. A master like "CONTROL DIMENSIONAL POST-INYECCION Y
 * CORTE DE COLADA" should NOT pull every AMFE that happens to have a
 * "CONTROL FINAL" or "CORTE" operation into its alert list.
 *
 * Process-master AMFEs should keep operation names succinct (e.g. the single
 * word "INYECCION") so Rule 2 does the right thing on all product AMFEs that
 * derive from that process.
 *
 * Returns the matched master op name, or null if no match.
 */
export function matchOperationName(
    targetNormName: string,
    masterNormNames: readonly string[],
): string | null {
    if (!targetNormName) return null;
    // Rule 1: exact match
    for (const master of masterNormNames) {
        if (master === targetNormName) return master;
    }
    // Rule 2: master op is a full-token substring of the target.
    // Rejected if the target carries an incompatible-process marker (e.g.
    // "INYECCION PU" for a plastic injection master).
    for (const master of masterNormNames) {
        if (!master || master.length < 6) continue;
        if (SUBSTRING_STOPWORDS.has(master)) continue;
        if (!containsWholeWord(targetNormName, master)) continue;
        const hasIncompatibleMarker = INCOMPATIBLE_PROCESS_MARKERS.some(marker =>
            containsWholeWord(targetNormName, marker),
        );
        if (hasIncompatibleMarker) continue;
        return master;
    }
    return null;
}

/** True when `needle` appears as a full word token inside `haystack`. */
function containsWholeWord(haystack: string, needle: string): boolean {
    if (!haystack || !needle) return false;
    if (haystack === needle) return true;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`);
    return re.test(haystack);
}

/**
 * Row shape returned by the minimal amfe_documents select below.
 */
interface AmfeCrossFamilyRow {
    id: string;
    subject: string;
    project_name: string;
    data: string | AmfeDocument;
}

/**
 * Safe-parse the AMFE `data` column which Supabase stores as TEXT. When a
 * scripts-based caller already hands us an object, we just return it.
 */
function parseAmfeData(raw: string | AmfeDocument | null | undefined): AmfeDocument | null {
    if (raw == null) return null;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw) as AmfeDocument;
        } catch {
            return null;
        }
    }
    if (typeof raw === 'object') return raw as AmfeDocument;
    return null;
}

/**
 * Propagate changes from a process-master AMFE (family name starts with
 * "Proceso de") across every other AMFE document in the database, creating
 * cross_doc_checks alerts on any AMFE whose operations match one of the
 * master's operation names.
 *
 * Behavioral contract:
 * - Only runs when the family name starts with "Proceso de".
 * - Only runs for module === 'amfe' (initial feature scope).
 * - Never throws — callers swallow errors via the trigger wrapper.
 * - Never touches the family_change_proposals table (that belongs to
 *   intra-family propagation, unaffected by this feature).
 */
export async function propagateMasterAcrossFamilies(params: {
    familyId: number;
    familyName: string;
    module: string;
    masterDocId: string;
    // Kept for symmetry with intra-family propagation even though cross-family
    // scan is content-agnostic (only looks at operation names of the new doc).
    oldDoc: AnyDocument;
    newDoc: AnyDocument;
}): Promise<CrossFamilyPropagationResult> {
    const empty: CrossFamilyPropagationResult = {
        scannedDocs: 0,
        affectedDocs: 0,
        alertsCreated: 0,
        matches: [],
    };
    const { familyId, familyName, module, masterDocId, oldDoc, newDoc } = params;

    // Gate 1: only process-family masters trigger a cross-family scan.
    if (!familyName || !familyName.trim().toLowerCase().startsWith('proceso de')) {
        logger.debug(CROSS_FAMILY_LOG_TAG, 'Not a process-family master, skipping', { familyId, familyName });
        return empty;
    }
    // Gate 2: only AMFE in this initial version.
    if (module !== 'amfe') {
        logger.debug(CROSS_FAMILY_LOG_TAG, 'Module is not AMFE, skipping', { module });
        return empty;
    }

    // Extract normalized master operation names
    const masterOpNames = extractMasterOperationNames(newDoc as AmfeDocument);
    if (masterOpNames.length === 0) {
        logger.debug(CROSS_FAMILY_LOG_TAG, 'Master has no operations, skipping', { masterDocId });
        return empty;
    }

    // Gate 3: if the set of operation names is identical between oldDoc and
    // newDoc (cosmetic-only change in header, or save-without-change), skip
    // the scan. This prevents generating noise alerts and resetting
    // acknowledged_at=NULL on already-dismissed alerts every time a user
    // touches the header.
    const oldOpNames = extractMasterOperationNames(oldDoc as AmfeDocument);
    if (oldOpNames.length === masterOpNames.length) {
        const oldSet = new Set(oldOpNames);
        const unchanged = masterOpNames.every(n => oldSet.has(n));
        if (unchanged) {
            logger.debug(CROSS_FAMILY_LOG_TAG, 'Master operation set unchanged, skipping cross-family scan', { masterDocId });
            return empty;
        }
    }

    // Load all other amfe_documents
    const db = await getDatabase();
    const rows = await db.select<AmfeCrossFamilyRow>(
        `SELECT id, subject, project_name, data FROM amfe_documents WHERE id != ?`,
        [masterDocId],
    );

    const result: CrossFamilyPropagationResult = {
        scannedDocs: rows.length,
        affectedDocs: 0,
        alertsCreated: 0,
        matches: [],
    };

    const sourceRevision = (newDoc as AmfeDocument | undefined)?.header?.revision ?? '';
    const sourceUpdated = new Date().toISOString();

    for (const row of rows) {
        const targetDoc = parseAmfeData(row.data);
        if (!targetDoc || !Array.isArray(targetDoc.operations)) continue;

        const matchedNames = new Set<string>();
        for (const op of targetDoc.operations) {
            const rawName = (op as AmfeOperation & { operationName?: string }).name
                ?? (op as AmfeOperation & { operationName?: string }).operationName
                ?? '';
            const targetNorm = normalizeOperationName(rawName);
            const matched = matchOperationName(targetNorm, masterOpNames);
            if (matched) matchedNames.add(rawName.toString().trim());
        }
        if (matchedNames.size === 0) continue;

        result.affectedDocs++;
        const matchedList = [...matchedNames];
        result.matches.push({
            targetDocId: row.id,
            targetSubject: row.subject || row.project_name || row.id,
            matchedOperationNames: matchedList,
        });

        // Fire alert (one per affected doc)
        const alertOk = await createCrossFamilyAlert({
            sourceMasterId: masterDocId,
            targetDocId: row.id,
            matchedOperationNames: matchedList,
            familyName,
            sourceRevision,
            sourceUpdated,
        });
        if (alertOk) result.alertsCreated++;
    }

    logger.info(CROSS_FAMILY_LOG_TAG, 'Cross-family propagation complete', {
        masterDocId,
        familyId,
        familyName,
        scannedDocs: result.scannedDocs,
        affectedDocs: result.affectedDocs,
        alertsCreated: result.alertsCreated,
    });

    return result;
}

/**
 * Fire-and-forget wrapper for cross-family propagation. Mirrors the contract
 * of `triggerChangePropagation`: never throws, runs async, logs its own
 * errors.
 */
export function triggerCrossFamilyPropagation(
    documentId: string,
    oldDoc: AnyDocument,
    newDoc: AnyDocument,
    moduleType: DocumentModule,
): void {
    if (moduleType !== 'amfe') return;
    void (async () => {
        try {
            const familyInfo = await getDocumentFamilyInfo(documentId);
            if (!familyInfo || !familyInfo.isMaster) {
                logger.debug(CROSS_FAMILY_LOG_TAG, `Document ${documentId} not a master in any family, skipping cross-family`);
                return;
            }
            const family = await getFamilyById(familyInfo.familyId);
            if (!family) {
                logger.debug(CROSS_FAMILY_LOG_TAG, `Family ${familyInfo.familyId} not found, skipping`);
                return;
            }
            if (!family.name.trim().toLowerCase().startsWith('proceso de')) {
                logger.debug(CROSS_FAMILY_LOG_TAG, `Family "${family.name}" is not a process family, skipping cross-family`);
                return;
            }
            await propagateMasterAcrossFamilies({
                familyId: family.id,
                familyName: family.name,
                module: familyInfo.module,
                masterDocId: documentId,
                oldDoc,
                newDoc,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error(CROSS_FAMILY_LOG_TAG, `Cross-family propagation failed for ${documentId}`, { error: message }, err instanceof Error ? err : undefined);
            // Never throw — fire and forget
        }
    })();
}
