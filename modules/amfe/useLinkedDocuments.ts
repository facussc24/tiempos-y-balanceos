/**
 * useLinkedDocuments — Queries the linked CP document for a given AMFE project.
 *
 * CP linked by `linked_amfe_project` column.
 * Returns metadata for display in the LinkedDocumentsPanel.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AmfeDocument } from './amfeTypes';
import { logger } from '../../utils/logger';

export interface LinkedDocInfo {
    /** Document type */
    type: 'cp';
    /** Document exists in database */
    exists: boolean;
    /** Database row ID (if exists) */
    id?: string;
    /** Display name / identifier */
    name: string;
    /** Number of items */
    itemCount: number;
    /** Last update timestamp (ISO) */
    updatedAt?: string;
}

export interface UseLinkedDocumentsReturn {
    linkedCp: LinkedDocInfo;
    isLoading: boolean;
    /** Re-fetch linked documents */
    refresh: () => void;
}

export function useLinkedDocuments(
    amfeProjectName: string | null,
    _amfeDoc: AmfeDocument
): UseLinkedDocumentsReturn {
    const [linkedCp, setLinkedCp] = useState<LinkedDocInfo>({
        type: 'cp', exists: false, name: 'Plan de Control', itemCount: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const versionRef = useRef(0);

    const fetchLinkedDocs = useCallback(async () => {
        if (!amfeProjectName) {
            setLinkedCp({ type: 'cp', exists: false, name: 'Plan de Control', itemCount: 0 });
            return;
        }

        const version = ++versionRef.current;
        setIsLoading(true);

        try {
            // Dynamic import to keep the module lazy-loadable
            const cpRepo = await import('../../utils/repositories/cpRepository');

            if (version !== versionRef.current) return; // stale

            // CP: lookup by linked_amfe_project
            const cpResult = await cpRepo.loadCpByAmfeProject(amfeProjectName);

            if (version !== versionRef.current) return; // stale

            setLinkedCp(cpResult ? {
                type: 'cp',
                exists: true,
                id: cpResult.id,
                name: cpResult.doc.header.controlPlanNumber || cpResult.doc.header.partName || 'Plan de Control',
                itemCount: cpResult.doc.items.length,
                updatedAt: undefined, // full doc doesn't carry updated_at; it comes from list query
            } : {
                type: 'cp', exists: false, name: 'Plan de Control', itemCount: 0,
            });
        } catch (err) {
            logger.warn('useLinkedDocuments', 'Failed to fetch linked documents', {
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            if (version === versionRef.current) {
                setIsLoading(false);
            }
        }
    }, [amfeProjectName]);

    // Fetch on mount and when project changes
    useEffect(() => {
        fetchLinkedDocs();
    }, [fetchLinkedDocs]);

    return { linkedCp, isLoading, refresh: fetchLinkedDocs };
}
