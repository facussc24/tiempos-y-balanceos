/**
 * useLinkedDocuments — Queries linked CP, PFD, and HO documents for a given AMFE project.
 *
 * Automatically resolves:
 * - CP linked by `linked_amfe_project` column
 * - HO linked by `linked_amfe_project` column
 * - PFD linked via `linkedPfdStepId` on AMFE operations (back-reference)
 *
 * Returns metadata for display in the LinkedDocumentsPanel.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AmfeDocument } from './amfeTypes';
import { logger } from '../../utils/logger';

export interface LinkedDocInfo {
    /** Document type */
    type: 'cp' | 'pfd' | 'ho';
    /** Document exists in database */
    exists: boolean;
    /** Database row ID (if exists) */
    id?: string;
    /** Display name / identifier */
    name: string;
    /** Number of items/steps/sheets */
    itemCount: number;
    /** Last update timestamp (ISO) */
    updatedAt?: string;
}

export interface UseLinkedDocumentsReturn {
    linkedCp: LinkedDocInfo;
    linkedPfd: LinkedDocInfo;
    linkedHo: LinkedDocInfo;
    isLoading: boolean;
    /** Re-fetch linked documents */
    refresh: () => void;
}

export function useLinkedDocuments(
    amfeProjectName: string | null,
    amfeDoc: AmfeDocument
): UseLinkedDocumentsReturn {
    const [linkedCp, setLinkedCp] = useState<LinkedDocInfo>({
        type: 'cp', exists: false, name: 'Plan de Control', itemCount: 0,
    });
    const [linkedPfd, setLinkedPfd] = useState<LinkedDocInfo>({
        type: 'pfd', exists: false, name: 'Diagrama de Flujo', itemCount: 0,
    });
    const [linkedHo, setLinkedHo] = useState<LinkedDocInfo>({
        type: 'ho', exists: false, name: 'Hojas de Operaciones', itemCount: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const versionRef = useRef(0);

    const fetchLinkedDocs = useCallback(async () => {
        if (!amfeProjectName) {
            setLinkedCp({ type: 'cp', exists: false, name: 'Plan de Control', itemCount: 0 });
            setLinkedPfd({ type: 'pfd', exists: false, name: 'Diagrama de Flujo', itemCount: 0 });
            setLinkedHo({ type: 'ho', exists: false, name: 'Hojas de Operaciones', itemCount: 0 });
            return;
        }

        const version = ++versionRef.current;
        setIsLoading(true);

        try {
            // Dynamic imports to keep the module lazy-loadable
            const [cpRepo, hoRepo, pfdRepo] = await Promise.all([
                import('../../utils/repositories/cpRepository'),
                import('../../utils/repositories/hoRepository'),
                import('../../utils/repositories/pfdRepository'),
            ]);

            if (version !== versionRef.current) return; // stale

            // CP: lookup by linked_amfe_project
            const cpResult = await cpRepo.loadCpByAmfeProject(amfeProjectName);

            // HO: lookup by linked_amfe_project
            const hoResult = await hoRepo.loadHoByAmfeProject(amfeProjectName);

            // PFD: find PFDs whose steps are referenced by AMFE operations via linkedPfdStepId
            const pfdStepIds = new Set<string>();
            for (const op of amfeDoc.operations) {
                if (op.linkedPfdStepId) {
                    pfdStepIds.add(op.linkedPfdStepId);
                }
            }

            let pfdInfo: LinkedDocInfo = {
                type: 'pfd', exists: false, name: 'Diagrama de Flujo', itemCount: 0,
            };

            if (pfdStepIds.size > 0) {
                // List all PFDs and find the one containing matching step IDs
                const allPfds = await pfdRepo.listPfdDocuments();
                // We need to load each PFD to check step IDs — but that's expensive.
                // Instead, try loading them one by one until we find a match.
                for (const pfdItem of allPfds) {
                    const pfdDoc = await pfdRepo.loadPfdDocument(pfdItem.id);
                    if (pfdDoc) {
                        const hasMatch = pfdDoc.steps.some(s => pfdStepIds.has(s.id));
                        if (hasMatch) {
                            pfdInfo = {
                                type: 'pfd',
                                exists: true,
                                id: pfdItem.id,
                                name: pfdItem.part_name || pfdItem.part_number || 'Diagrama de Flujo',
                                itemCount: pfdItem.step_count,
                                updatedAt: pfdItem.updated_at,
                            };
                            break;
                        }
                    }
                }
            }

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

            setLinkedHo(hoResult ? {
                type: 'ho',
                exists: true,
                id: hoResult.id,
                name: hoResult.doc.header.formNumber || 'Hojas de Operaciones',
                itemCount: hoResult.doc.sheets.length,
                updatedAt: undefined,
            } : {
                type: 'ho', exists: false, name: 'Hojas de Operaciones', itemCount: 0,
            });

            setLinkedPfd(pfdInfo);
        } catch (err) {
            logger.warn('useLinkedDocuments', 'Failed to fetch linked documents', {
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            if (version === versionRef.current) {
                setIsLoading(false);
            }
        }
    }, [amfeProjectName, amfeDoc.operations]);

    // Fetch on mount and when project changes
    useEffect(() => {
        fetchLinkedDocs();
    }, [fetchLinkedDocs]);

    return { linkedCp, linkedPfd, linkedHo, isLoading, refresh: fetchLinkedDocs };
}
