/**
 * useInheritanceStatus — Hook for querying inheritance status of items
 * in variant documents.
 *
 * Loads the family_document record for the given documentId, checks if it
 * is a variant (not master), and fetches the override records to build a
 * per-item status map.
 *
 * Status mapping:
 *   - Items with override_type 'modified' → 'modified'
 *   - Items with override_type 'added'    → 'own'
 *   - Items with override_type 'removed'  → excluded (not shown)
 *   - Items with no override              → 'inherited' (unchanged from master)
 *
 * Returns null when the document is a master or is not linked to any family,
 * so consumers can skip rendering badges entirely.
 *
 * @module useInheritanceStatus
 */

import { useState, useEffect, useCallback } from 'react';
import {
    getDocumentFamilyInfo,
    listOverrides,
} from '../utils/repositories/familyDocumentRepository';
import type { FamilyDocumentOverride } from '../utils/repositories/familyDocumentRepository';
import type { InheritanceStatus } from '../components/ui/InheritanceBadge';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InheritanceStatusMap {
    /** Map from itemId to its inheritance status */
    items: Map<string, InheritanceStatus>;
    /** Set of removed item IDs (should be excluded from display) */
    removedItems: Set<string>;
    /** The family_documents.id for this variant document */
    familyDocId: number;
    /** Whether the document is a variant */
    isVariant: true;
}

export interface UseInheritanceStatusReturn {
    /** null if the document is not a variant or is not linked to a family */
    statusMap: InheritanceStatusMap | null;
    /** True while loading */
    loading: boolean;
    /** Error message if the query failed */
    error: string | null;
    /** Force re-fetch */
    refresh: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Queries inheritance status for all items in a document.
 *
 * @param documentId - The document's unique ID (UUID). Pass null/empty to disable.
 * @param allItemIds - Array of all item IDs currently in the document.
 *   Items not present in override records are assumed to be 'inherited'.
 */
export function useInheritanceStatus(
    documentId: string | null | undefined,
    allItemIds: string[]
): UseInheritanceStatusReturn {
    const [statusMap, setStatusMap] = useState<InheritanceStatusMap | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshCounter, setRefreshCounter] = useState(0);

    const refresh = useCallback(() => {
        setRefreshCounter(c => c + 1);
    }, []);

    useEffect(() => {
        if (!documentId) {
            setStatusMap(null);
            setLoading(false);
            setError(null);
            return;
        }

        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                // Step 1: Check if this document is linked to a family
                const familyInfo = await getDocumentFamilyInfo(documentId!);

                if (!familyInfo || familyInfo.isMaster) {
                    // Master documents or unlinked documents don't show inheritance badges
                    setStatusMap(null);
                    return;
                }

                // Step 2: Load override records for this variant
                const overrides = await listOverrides(familyInfo.id);

                if (cancelled) return;

                // Step 3: Build the status map
                const items = new Map<string, InheritanceStatus>();
                const removedItems = new Set<string>();

                // Index overrides by itemId
                const overrideByItemId = new Map<string, FamilyDocumentOverride>();
                for (const ov of overrides) {
                    overrideByItemId.set(ov.itemId, ov);
                }

                // Classify each current item
                for (const itemId of allItemIds) {
                    const override = overrideByItemId.get(itemId);
                    if (!override) {
                        // No override = inherited unchanged from master
                        items.set(itemId, 'inherited');
                    } else if (override.overrideType === 'modified') {
                        items.set(itemId, 'modified');
                    } else if (override.overrideType === 'added') {
                        items.set(itemId, 'own');
                    } else if (override.overrideType === 'removed' || override.overrideType === 'rejected') {
                        removedItems.add(itemId);
                    } else {
                        // Unknown override type, treat as modified
                        items.set(itemId, 'modified');
                    }
                }

                // Also mark items in overrides as 'removed' even if not in allItemIds
                for (const ov of overrides) {
                    if (ov.overrideType === 'removed' || ov.overrideType === 'rejected') {
                        removedItems.add(ov.itemId);
                    }
                }

                setStatusMap({
                    items,
                    removedItems,
                    familyDocId: familyInfo.id,
                    isVariant: true,
                });
            } catch (err) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : String(err);
                    logger.error('useInheritanceStatus', 'Failed to load inheritance status', { documentId, error: message });
                    setError(message);
                    setStatusMap(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [documentId, allItemIds.length, refreshCounter]); // eslint-disable-line react-hooks/exhaustive-deps

    return { statusMap, loading, error, refresh };
}

// ---------------------------------------------------------------------------
// Helper: Get status for a single item (convenience)
// ---------------------------------------------------------------------------

/**
 * Extracts the inheritance status for a single item from the map.
 * Returns null if the document is not a variant.
 */
export function getItemInheritanceStatus(
    statusMap: InheritanceStatusMap | null,
    itemId: string
): InheritanceStatus | null {
    if (!statusMap) return null;
    return statusMap.items.get(itemId) ?? 'inherited';
}
