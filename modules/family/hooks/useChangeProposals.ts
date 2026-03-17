/**
 * useChangeProposals — Hook for managing change proposals from master documents.
 *
 * Loads pending change proposals for a variant document and provides
 * methods to accept, reject, or accept all proposals.
 *
 * Returns empty state when the document is a master or not linked to a family.
 *
 * @module useChangeProposals
 */

import { useState, useEffect, useCallback } from 'react';
import {
    getDocumentFamilyInfo,
    listPendingProposals,
    resolveProposal,
    type ChangeProposal,
} from '../../../utils/repositories/familyDocumentRepository';
import { logger } from '../../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseChangeProposalsReturn {
    proposals: ChangeProposal[];
    pendingCount: number;
    loading: boolean;
    error: string | null;
    acceptProposal: (proposalId: number) => Promise<void>;
    rejectProposal: (proposalId: number) => Promise<void>;
    acceptAll: () => Promise<void>;
    refresh: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChangeProposals(documentId: string | null): UseChangeProposalsReturn {
    const [proposals, setProposals] = useState<ChangeProposal[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshCounter, setRefreshCounter] = useState(0);

    const refresh = useCallback(() => {
        setRefreshCounter(c => c + 1);
    }, []);

    useEffect(() => {
        if (!documentId) {
            setProposals([]);
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
                    // Master documents or unlinked documents have no proposals
                    if (!cancelled) {
                        setProposals([]);
                    }
                    return;
                }

                // Step 2: Load pending proposals for this variant
                const pending = await listPendingProposals(familyInfo.id);

                if (!cancelled) {
                    setProposals(pending);
                }
            } catch (err) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : String(err);
                    logger.error('useChangeProposals', 'Failed to load change proposals', {
                        documentId,
                        error: message,
                    });
                    setError(message);
                    setProposals([]);
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

    const acceptProposal = useCallback(async (proposalId: number) => {
        try {
            await resolveProposal(proposalId, 'accepted', 'user');
            refresh();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('useChangeProposals', 'Failed to accept proposal', {
                proposalId,
                error: message,
            });
            setError(message);
        }
    }, [refresh]);

    const rejectProposal = useCallback(async (proposalId: number) => {
        try {
            await resolveProposal(proposalId, 'rejected', 'user');
            refresh();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('useChangeProposals', 'Failed to reject proposal', {
                proposalId,
                error: message,
            });
            setError(message);
        }
    }, [refresh]);

    const acceptAll = useCallback(async () => {
        try {
            for (const proposal of proposals) {
                await resolveProposal(proposal.id, 'accepted', 'user');
            }
            refresh();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('useChangeProposals', 'Failed to accept all proposals', {
                error: message,
            });
            setError(message);
        }
    }, [proposals, refresh]);

    return {
        proposals,
        pendingCount: proposals.length,
        loading,
        error,
        acceptProposal,
        rejectProposal,
        acceptAll,
        refresh,
    };
}
