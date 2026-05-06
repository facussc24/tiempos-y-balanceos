/**
 * useCpDraftRecovery - Smart draft recovery for Control Plan
 *
 * Features:
 * - Auto-cleans previously dismissed drafts
 * - Auto-discards empty drafts (no items)
 * - Dismiss button persists to localStorage (won't show again)
 */

import { useState, useEffect, useCallback } from 'react';
import { loadCpDraft, listCpDraftKeys, deleteCpDraft } from './useControlPlanPersistence';
import type { ControlPlanDocument } from './controlPlanTypes';
import { logger } from '../../utils/logger';

const DISMISSED_DRAFTS_KEY = 'cp_dismissed_drafts';

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

interface UseCpDraftRecoveryParams {
    embedded?: boolean;
    currentProject: string | null;
    loadData: (data: ControlPlanDocument) => void;
}

interface UseCpDraftRecoveryReturn {
    draftRecovery: { key: string; name: string } | null;
    handleRecoverDraft: () => Promise<void>;
    handleDiscardDraft: () => Promise<void>;
    handleDismissDraft: () => void;
}

export function useCpDraftRecovery({ embedded, currentProject, loadData }: UseCpDraftRecoveryParams): UseCpDraftRecoveryReturn {
    const [draftRecovery, setDraftRecovery] = useState<{ key: string; name: string } | null>(null);

    useEffect(() => {
        // useState initial value is null, so no setDraftRecovery(null) needed here
        // (avoids react-hooks/set-state-in-effect lint and saves a render cycle).
        if (embedded || currentProject) {
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const keys = await listCpDraftKeys();
                if (cancelled || keys.length === 0) return;

                const dismissed = getDismissedDrafts();

                // Auto-clean dismissed drafts
                for (const key of keys) {
                    if (dismissed.includes(key)) {
                        try { await deleteCpDraft(key); } catch { /* ignore */ }
                    }
                }

                // Find first non-dismissed draft
                const validKey = keys.find(k => !dismissed.includes(k));
                if (cancelled || !validKey) return;

                const draft = await loadCpDraft(validKey);
                if (cancelled || !draft) return;

                // Auto-discard empty drafts
                if (!draft.items || draft.items.length === 0) {
                    try { await deleteCpDraft(validKey); } catch { /* ignore */ }
                    return;
                }

                const projectName = validKey.replace('cp_draft_', '');
                setDraftRecovery({ key: validKey, name: projectName });
            } catch (err) {
                logger.warn('ControlPlan', 'Draft recovery failed', { error: err instanceof Error ? err.message : String(err) });
            }
        })();
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRecoverDraft = useCallback(async () => {
        if (!draftRecovery) return;
        try {
            const draft = await loadCpDraft(draftRecovery.key);
            if (draft) {
                loadData(draft);
            }
        } catch { /* ignore */ }
        setDraftRecovery(null);
    }, [draftRecovery, loadData]);

    const handleDiscardDraft = useCallback(async () => {
        if (!draftRecovery) return;
        try { await deleteCpDraft(draftRecovery.key); } catch { /* ignore */ }
        setDraftRecovery(null);
    }, [draftRecovery]);

    const handleDismissDraft = useCallback(() => {
        if (!draftRecovery) return;
        addDismissedDraft(draftRecovery.key);
        setDraftRecovery(null);
    }, [draftRecovery]);

    return { draftRecovery, handleRecoverDraft, handleDiscardDraft, handleDismissDraft };
}
