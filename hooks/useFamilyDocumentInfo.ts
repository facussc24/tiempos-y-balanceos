/**
 * useFamilyDocumentInfo — Hook for querying whether a document is a master,
 * variant, or unlinked to any product family.
 *
 * Provides family name, variant count (for masters), and master doc name
 * (for variants). Used by FamilyDocumentBanner and other UI indicators.
 *
 * @module useFamilyDocumentInfo
 */

import { useState, useEffect, useCallback } from 'react';
import {
    getDocumentFamilyInfo,
    getVariantDocuments,
    getFamilyMasterDocument,
} from '../utils/repositories/familyDocumentRepository';
import { getFamilyById } from '../utils/repositories/familyRepository';
import { loadAmfeDocument } from '../utils/repositories/amfeRepository';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FamilyDocumentInfo {
    /** Whether the document is the master of its family */
    isMaster: boolean;
    /** Whether the document is a variant (child of a master) */
    isVariant: boolean;
    /** Whether the document is not linked to any family */
    isUnlinked: boolean;
    /** Family name (e.g., "Insert Patagonia") */
    familyName: string;
    /** Family ID */
    familyId: number;
    /** Number of variant documents (only meaningful for masters) */
    variantCount: number;
    /** Name/subject of the master document (only meaningful for variants) */
    masterDocName: string;
    /** The family_documents.id record */
    familyDocId: number;
}

export interface UseFamilyDocumentInfoReturn {
    info: FamilyDocumentInfo | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFamilyDocumentInfo(
    documentId: string | null | undefined
): UseFamilyDocumentInfoReturn {
    const [info, setInfo] = useState<FamilyDocumentInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshCounter, setRefreshCounter] = useState(0);

    const refresh = useCallback(() => {
        setRefreshCounter(c => c + 1);
    }, []);

    useEffect(() => {
        if (!documentId) {
            setInfo(null);
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
                const familyDoc = await getDocumentFamilyInfo(documentId!);

                if (!familyDoc) {
                    // Not linked to any family
                    if (!cancelled) {
                        setInfo(null);
                        setLoading(false);
                    }
                    return;
                }

                // Step 2: Get family details
                const family = await getFamilyById(familyDoc.familyId);
                if (cancelled) return;

                const familyName = family?.name ?? `Familia #${familyDoc.familyId}`;

                if (familyDoc.isMaster) {
                    // Master document — count variants
                    const variants = await getVariantDocuments(familyDoc.familyId, familyDoc.module);
                    if (cancelled) return;

                    setInfo({
                        isMaster: true,
                        isVariant: false,
                        isUnlinked: false,
                        familyName,
                        familyId: familyDoc.familyId,
                        variantCount: variants.length,
                        masterDocName: '',
                        familyDocId: familyDoc.id,
                    });
                } else {
                    // Variant document — get master doc name
                    let masterDocName = '';
                    const masterFamilyDoc = await getFamilyMasterDocument(familyDoc.familyId, familyDoc.module);
                    if (cancelled) return;

                    if (masterFamilyDoc) {
                        try {
                            const masterDoc = await loadAmfeDocument(masterFamilyDoc.documentId);
                            if (masterDoc?.doc) {
                                masterDocName = masterDoc.doc?.header?.subject
                                    || masterDoc.doc?.header?.partNumber
                                    || 'Maestro';
                            }
                        } catch {
                            masterDocName = 'Maestro';
                        }
                    }

                    if (cancelled) return;

                    setInfo({
                        isMaster: false,
                        isVariant: true,
                        isUnlinked: false,
                        familyName,
                        familyId: familyDoc.familyId,
                        variantCount: 0,
                        masterDocName,
                        familyDocId: familyDoc.id,
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : String(err);
                    logger.error('useFamilyDocumentInfo', 'Failed to load family info', { documentId, error: message });
                    setError(message);
                    setInfo(null);
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
    }, [documentId, refreshCounter]);

    return { info, loading, error, refresh };
}
