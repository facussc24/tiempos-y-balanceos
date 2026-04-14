/**
 * Override Tracker for Family Document Variants
 *
 * Compares a variant document against its master to identify items that have
 * been modified, added, or removed. Records these overrides in the
 * `family_document_overrides` table via the familyDocumentRepository.
 *
 * Also provides a query function (`getOverrideStatus`) so the UI can render
 * inherited vs. overridden vs. variant-only items with visual indicators.
 *
 * Supports all four APQP modules: PFD, AMFE, CP, and HO.
 *
 * @module core/inheritance/overrideTracker
 */

import { logger } from '../../utils/logger';
import {
    addOverride,
    listOverrides,
    type FamilyDocumentOverride,
} from '../../utils/repositories/familyDocumentRepository';
import { getDatabase } from '../../utils/database';

import type { DocumentModule } from './documentInheritance';

// Module document types
import type { AmfeDocument, AmfeOperation } from '../../modules/amfe/amfeTypes';
import type { PfdDocument, PfdStep } from '../../modules/pfd/pfdTypes';
import type { ControlPlanDocument, ControlPlanItem } from '../../modules/controlPlan/controlPlanTypes';
import type { HoDocument, HojaOperacion } from '../../modules/hojaOperaciones/hojaOperacionesTypes';

// =============================================================================
// PUBLIC TYPES
// =============================================================================

/** The type of override detected for a single item. */
export type OverrideType = 'modified' | 'added' | 'removed';

/** A single detected override, before persistence. */
export interface DetectedOverride {
    itemType: string;
    itemId: string;
    overrideType: OverrideType;
    /** JSON-serialized diff data (optional, for modified items). */
    overrideData?: string;
}

/** Result of running trackOverrides. */
export interface TrackOverridesResult {
    /** Total overrides detected and saved. */
    totalOverrides: number;
    /** Breakdown by type. */
    modified: number;
    added: number;
    removed: number;
    /** Detailed list of detected overrides. */
    overrides: DetectedOverride[];
}

/** Override status for a variant document, keyed by itemType:itemId. */
export interface OverrideStatusMap {
    /**
     * Map of `"itemType:itemId"` -> override info.
     * Items NOT in this map are inherited unchanged from master.
     */
    overrides: Map<string, { overrideType: string; overrideData: string | null }>;
    /** Total number of overridden items. */
    totalOverrides: number;
}

/** Union type for any APQP document. */
type AnyDocument = AmfeDocument | PfdDocument | ControlPlanDocument | HoDocument;

// =============================================================================
// ITEM EXTRACTION — per module
// =============================================================================

/**
 * Extracts a flat map of item IDs -> serialized content for comparison.
 * Each module defines its own item granularity.
 */
export function extractItems(doc: AnyDocument, module: DocumentModule): Map<string, { itemType: string; data: string }> {
    switch (module) {
        case 'pfd':
            return extractPfdItems(doc as PfdDocument);
        case 'amfe':
            return extractAmfeItems(doc as AmfeDocument);
        case 'cp':
            return extractCpItems(doc as ControlPlanDocument);
        case 'ho':
            return extractHoItems(doc as HoDocument);
        default: {
            const _exhaustive: never = module;
            throw new Error(`Unknown module: ${_exhaustive}`);
        }
    }
}

// ---------------------------------------------------------------------------
// PFD: each step is an item
// ---------------------------------------------------------------------------

function extractPfdItems(doc: PfdDocument): Map<string, { itemType: string; data: string }> {
    const items = new Map<string, { itemType: string; data: string }>();
    for (const step of doc.steps) {
        items.set(step.id, {
            itemType: 'pfd_step',
            data: serializePfdStep(step),
        });
    }
    return items;
}

/** Serialize a PfdStep for comparison, excluding volatile fields. */
function serializePfdStep(step: PfdStep): string {
    // Omit id (used as key), and linkage metadata that may differ between master/variant
    const { id: _id, linkedAmfeOperationId: _linkedAmfeOperationId, linkedCpItemIds: _linkedCpItemIds, ...comparable } = step;
    return JSON.stringify(comparable, Object.keys(comparable).sort());
}

// ---------------------------------------------------------------------------
// AMFE: operations are top-level items; nested structure is compared as a whole
// ---------------------------------------------------------------------------

function extractAmfeItems(doc: AmfeDocument): Map<string, { itemType: string; data: string }> {
    const items = new Map<string, { itemType: string; data: string }>();
    for (const op of doc.operations) {
        items.set(op.id, {
            itemType: 'amfe_operation',
            data: serializeAmfeOperation(op),
        });
    }
    return items;
}

/** Serialize an AmfeOperation for comparison, excluding volatile IDs. */
function serializeAmfeOperation(op: AmfeOperation): string {
    // Deep clone and remove all `id` fields for content-only comparison
    const cleaned = stripIds(op);
    // Remove linkage fields that are variant-specific via destructuring
    const { linkedPfdStepId: _lps, ...comparable } = cleaned as Record<string, unknown>;
    return JSON.stringify(comparable);
}

// ---------------------------------------------------------------------------
// CP: each ControlPlanItem is an item
// ---------------------------------------------------------------------------

function extractCpItems(doc: ControlPlanDocument): Map<string, { itemType: string; data: string }> {
    const items = new Map<string, { itemType: string; data: string }>();
    for (const item of doc.items) {
        items.set(item.id, {
            itemType: 'cp_item',
            data: serializeCpItem(item),
        });
    }
    return items;
}

function serializeCpItem(item: ControlPlanItem): string {
    const {
        id: _id, autoFilledFields: _autoFilledFields, amfeAp: _amfeAp, amfeSeverity: _amfeSeverity, operationCategory: _operationCategory,
        amfeCauseIds: _amfeCauseIds, amfeFailureId: _amfeFailureId, amfeFailureIds: _amfeFailureIds,
        ...comparable
    } = item;
    return JSON.stringify(comparable, Object.keys(comparable).sort());
}

// ---------------------------------------------------------------------------
// HO: each HojaOperacion (sheet) is an item
// ---------------------------------------------------------------------------

function extractHoItems(doc: HoDocument): Map<string, { itemType: string; data: string }> {
    const items = new Map<string, { itemType: string; data: string }>();
    for (const sheet of doc.sheets) {
        items.set(sheet.id, {
            itemType: 'ho_sheet',
            data: serializeHoSheet(sheet),
        });
    }
    return items;
}

function serializeHoSheet(sheet: HojaOperacion): string {
    const cleaned = stripIds(sheet);
    // Remove linkage metadata via destructuring
    const { amfeOperationId: _aoi, ...comparable } = cleaned as Record<string, unknown>;
    return JSON.stringify(comparable);
}

// =============================================================================
// DIFF ENGINE
// =============================================================================

/**
 * Compare variant items against master items and return detected overrides.
 * Pure function, no side effects.
 */
export function diffDocuments(
    variantDoc: AnyDocument,
    masterDoc: AnyDocument,
    moduleType: DocumentModule
): DetectedOverride[] {
    const masterItems = extractItems(masterDoc, moduleType);
    const variantItems = extractItems(variantDoc, moduleType);
    const overrides: DetectedOverride[] = [];

    // Check for modified and added items
    for (const [itemId, variantItem] of variantItems) {
        const masterItem = masterItems.get(itemId);

        if (!masterItem) {
            // Item exists only in variant -> added
            overrides.push({
                itemType: variantItem.itemType,
                itemId,
                overrideType: 'added',
            });
        } else if (variantItem.data !== masterItem.data) {
            // Item exists in both but content differs -> modified
            overrides.push({
                itemType: variantItem.itemType,
                itemId,
                overrideType: 'modified',
                overrideData: buildDiffSummary(masterItem.data, variantItem.data),
            });
        }
        // else: identical -> inherited, no override
    }

    // Check for removed items (in master but not in variant)
    for (const [itemId, masterItem] of masterItems) {
        if (!variantItems.has(itemId)) {
            overrides.push({
                itemType: masterItem.itemType,
                itemId,
                overrideType: 'removed',
            });
        }
    }

    return overrides;
}

// =============================================================================
// MAIN PUBLIC FUNCTIONS
// =============================================================================

const LOG_TAG = 'OverrideTracker';

/**
 * Compare a variant document against its master, identify overrides, and
 * persist them in `family_document_overrides`.
 *
 * This function first clears any existing overrides for the given familyDocId,
 * then inserts the newly detected overrides. This ensures the override table
 * always reflects the current state of the variant.
 *
 * @param variantDoc   - The variant document content
 * @param masterDoc    - The master document content
 * @param moduleType   - Which APQP module ('pfd' | 'amfe' | 'cp' | 'ho')
 * @param familyDocId  - The family_documents.id for the variant (for DB writes)
 * @returns Summary of detected overrides
 */
export async function trackOverrides(
    variantDoc: AnyDocument,
    masterDoc: AnyDocument,
    moduleType: DocumentModule,
    familyDocId: number
): Promise<TrackOverridesResult> {
    logger.info(LOG_TAG, `Tracking overrides for familyDocId=${familyDocId}, module=${moduleType}`);

    // 1. Detect overrides (pure diff)
    const detected = diffDocuments(variantDoc, masterDoc, moduleType);

    // 2. Clear existing overrides for this variant document
    const db = await getDatabase();
    await db.execute(
        'DELETE FROM family_document_overrides WHERE family_doc_id = ?',
        [familyDocId]
    );

    // 3. Persist new overrides
    for (const ov of detected) {
        await addOverride({
            familyDocId,
            itemType: ov.itemType,
            itemId: ov.itemId,
            overrideType: ov.overrideType,
            overrideData: ov.overrideData,
        });
    }

    const result: TrackOverridesResult = {
        totalOverrides: detected.length,
        modified: detected.filter(o => o.overrideType === 'modified').length,
        added: detected.filter(o => o.overrideType === 'added').length,
        removed: detected.filter(o => o.overrideType === 'removed').length,
        overrides: detected,
    };

    logger.info(LOG_TAG, `Override tracking complete for familyDocId=${familyDocId}`, {
        total: result.totalOverrides,
        modified: result.modified,
        added: result.added,
        removed: result.removed,
    });

    return result;
}

/**
 * Query the override status for a variant document.
 *
 * Returns a map so the UI can quickly check whether a given item is inherited
 * (not in map), modified, added, or removed.
 *
 * @param familyDocId - The family_documents.id for the variant
 * @returns OverrideStatusMap with a Map keyed by "itemType:itemId"
 */
export async function getOverrideStatus(familyDocId: number): Promise<OverrideStatusMap> {
    const rows: FamilyDocumentOverride[] = await listOverrides(familyDocId);

    const overrides = new Map<string, { overrideType: string; overrideData: string | null }>();
    for (const row of rows) {
        const key = `${row.itemType}:${row.itemId}`;
        overrides.set(key, {
            overrideType: row.overrideType,
            overrideData: row.overrideData,
        });
    }

    return {
        overrides,
        totalOverrides: overrides.size,
    };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Build a lightweight diff summary for a modified item.
 * Returns a JSON string listing changed field names (not full content,
 * to keep the override_data column manageable).
 */
function buildDiffSummary(masterData: string, variantData: string): string {
    try {
        const masterObj = JSON.parse(masterData);
        const variantObj = JSON.parse(variantData);
        const changedFields: string[] = [];

        // Collect all keys from both objects
        const allKeys = new Set([...Object.keys(masterObj), ...Object.keys(variantObj)]);

        for (const key of allKeys) {
            const masterVal = JSON.stringify(masterObj[key]);
            const variantVal = JSON.stringify(variantObj[key]);
            if (masterVal !== variantVal) {
                changedFields.push(key);
            }
        }

        return JSON.stringify({ changedFields });
    } catch {
        // If parsing fails, return a simple indicator
        return JSON.stringify({ changedFields: ['_unparseable'] });
    }
}

/**
 * Deep-clone an object and remove all `id` fields whose values look like UUIDs.
 * Used to compare content-only (structure without identity).
 */
function stripIds(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => stripIds(item));
    }

    if (typeof obj === 'object') {
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            if (key === 'id') continue; // Strip all id fields
            out[key] = stripIds(value);
        }
        return out;
    }

    return obj;
}
