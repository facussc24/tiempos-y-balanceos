/**
 * usePfdDraftRecovery - Smart draft recovery for PFD
 *
 * Features:
 * - Auto-cleans previously dismissed drafts
 * - Auto-discards empty drafts (no steps)
 * - Dismiss button persists to localStorage (won't show again)
 */

import { useState, useEffect, useCallback } from 'react';
import { loadPfdDraft, listPfdDraftKeys, deletePfdDraft } from './usePfdPersistence';
import type { PfdDocument } from './pfdTypes';
import { logger } from '../../utils/logger';

const DISMISSED_DRAFTS_KEY = 'pfd_dismissed_drafts';

function getDismissedDrafts(): string[] {
    try {
        const raw = localStorage.getItem(DISMISSED_DRAFTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function addDismissedDraft(key: string): void {
    try {
        const dismissed = getDismissedDrafts();
        if (!dismissed.includes(key)) {
            dismissed.push(key);
            localStorage.setItem(DISMISSED_DRAFTS_KEY, JSON.stringify(dismissed));
        }
    } catch { /* ignore */ }
}

interface UsePfdDraftRecoveryParams {
    embedded?: boolean;
    loadData: (data: PfdDocument) => void;
}

interface UsePfdDraftRecoveryReturn {
    draftRecovery: { key: string; name: string } | null;
    handleRecoverDraft: () => Promise<void>;
    handleDiscardDraft: () => Promise<void>;
    handleDismissDraft: () => void;
}

export function usePfdDraftRecovery({ embedded, loadData }: UsePfdDraftRecoveryParams): UsePfdDraftRecoveryReturn {
    const [draftRecovery, setDraftRecovery] = useState<{ key: string; name: string } | null>(null);

    useEffect(() => {
        // Effect runs once on mount; initial state is already null, so no setState
        // needed in the embedded short-circuit (avoids react-hooks/set-state-in-effect).
        if (embedded) return;

        let cancelled = false;
        (async () => {
            try {
                const keys = await listPfdDraftKeys();
                if (cancelled || keys.length === 0) return;

                const dismissed = getDismissedDrafts();

                // Auto-clean dismissed drafts
                for (const key of keys) {
                    if (dismissed.includes(key)) {
                        try { await deletePfdDraft(key); } catch { /* ignore */ }
                    }
                }

                // Find first non-dismissed draft
                const validKey = keys.find(k => !dismissed.includes(k));
                if (cancelled || !validKey) return;

                const draft = await loadPfdDraft(validKey);
                if (cancelled || !draft || !draft.header) return;

                // Auto-discard empty drafts
                if (!draft.steps || draft.steps.length === 0) {
                    try { await deletePfdDraft(validKey); } catch { /* ignore */ }
                    return;
                }

                const projectName = draft.header.partName || validKey.replace('pfd_draft_', '');
                setDraftRecovery({ key: validKey, name: projectName });
            } catch (err) {
                logger.warn('PfdApp', 'Draft recovery failed', { error: err instanceof Error ? err.message : String(err) });
            }
        })();
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRecoverDraft = useCallback(async () => {
        if (!draftRecovery) return;
        try {
            const draft = await loadPfdDraft(draftRecovery.key);
            if (draft) {
                loadData(draft);
            }
        } catch { /* ignore */ }
        setDraftRecovery(null);
    }, [draftRecovery, loadData]);

    const handleDiscardDraft = useCallback(async () => {
        if (!draftRecovery) return;
        try { await deletePfdDraft(draftRecovery.key); } catch { /* ignore */ }
        setDraftRecovery(null);
    }, [draftRecovery]);

    const handleDismissDraft = useCallback(() => {
        if (!draftRecovery) return;
        addDismissedDraft(draftRecovery.key);
        setDraftRecovery(null);
    }, [draftRecovery]);

    return { draftRecovery, handleRecoverDraft, handleDiscardDraft, handleDismissDraft };
}
