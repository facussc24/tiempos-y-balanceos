import { useState, useEffect, useCallback } from 'react';
import { AmfeDocument } from './amfeTypes';
import { validateAmfeDocument, migrateAmfeDocument } from './amfeValidation';
import { logger } from '../../utils/logger';

const DISMISSED_DRAFTS_KEY = 'amfe_dismissed_drafts';

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

interface UseAmfeDraftRecoveryParams {
    currentProject: string | null;
    loadData: (doc: AmfeDocument) => void;
    resetHistory: (doc: AmfeDocument) => void;
    requestConfirm: (options: {
        title: string;
        message: string;
        confirmText?: string;
        variant?: 'danger' | 'warning' | 'info';
    }) => Promise<boolean>;
}

interface UseAmfeDraftRecoveryReturn {
    draftRecovery: { key: string; name: string } | null;
    handleRecoverDraft: () => Promise<void>;
    handleDiscardDraft: () => Promise<void>;
    handleDismissDraft: () => void;
}

export function useAmfeDraftRecovery(params: UseAmfeDraftRecoveryParams): UseAmfeDraftRecoveryReturn {
    const { currentProject, loadData, resetHistory, requestConfirm } = params;

    const [draftRecovery, setDraftRecovery] = useState<{ key: string; name: string } | null>(null);

    useEffect(() => {
        // When a project is loaded, clear any stale draft recovery banner
        if (currentProject) {
            setDraftRecovery(null);
            return;
        }

        let cancelled = false;
        const checkDrafts = async () => {
            try {
                const { listDraftKeys, loadDraft: loadDraftFn, deleteDraft: deleteDraftFn } = await import('./useAmfePersistence');
                const keys = await listDraftKeys();
                if (cancelled || keys.length === 0) return;

                const dismissed = getDismissedDrafts();

                // Auto-clean dismissed drafts
                for (const key of keys) {
                    if (dismissed.includes(key)) {
                        try { await deleteDraftFn(key); } catch { /* ignore */ }
                    }
                }

                // Find first non-dismissed draft
                const validKey = keys.find(k => !dismissed.includes(k));
                if (cancelled || !validKey) return;

                const draft = await loadDraftFn(validKey);
                if (cancelled || !draft) return;

                // If the draft is empty (no operations), silently discard it
                if (!draft.operations || draft.operations.length === 0) {
                    try { await deleteDraftFn(validKey); } catch { /* ignore */ }
                    return;
                }

                const projectName = validKey.replace('amfe_draft_', '');
                setDraftRecovery({ key: validKey, name: projectName });
            } catch {
                // Non-critical — ignore
            }
        };
        checkDrafts();
        return () => { cancelled = true; };
    }, [currentProject]);

    const handleRecoverDraft = useCallback(async () => {
        if (!draftRecovery) return;
        try {
            const { loadDraft: loadDraftFn, deleteDraft: deleteDraftFn } = await import('./useAmfePersistence');
            const draft = await loadDraftFn(draftRecovery.key);
            if (draft) {
                const validation = validateAmfeDocument(draft);
                if (!validation.valid) {
                    logger.warn('AMFE', 'Draft failed validation, discarding', { errors: validation.errors });
                    await requestConfirm({
                        title: 'Borrador corrupto',
                        message: `El borrador "${draftRecovery.name}" tiene errores de formato y no se puede recuperar. Se descartará automáticamente.`,
                        confirmText: 'Entendido',
                        variant: 'warning',
                    });
                    try { await deleteDraftFn(draftRecovery.key); } catch { /* ignore */ }
                    setDraftRecovery(null);
                    return;
                }
                const migrated = migrateAmfeDocument(draft);
                loadData(migrated);
                resetHistory(migrated);
            }
        } catch {
            // ignore
        }
        setDraftRecovery(null);
    }, [draftRecovery, loadData, resetHistory, requestConfirm]);

    const handleDiscardDraft = useCallback(async () => {
        if (!draftRecovery) return;
        try {
            const { deleteDraft: deleteDraftFn } = await import('./useAmfePersistence');
            await deleteDraftFn(draftRecovery.key);
        } catch {
            // ignore
        }
        setDraftRecovery(null);
    }, [draftRecovery]);

    /** Dismiss the banner without deleting the draft. It won't appear again for this key. */
    const handleDismissDraft = useCallback(() => {
        if (!draftRecovery) return;
        addDismissedDraft(draftRecovery.key);
        setDraftRecovery(null);
    }, [draftRecovery]);

    return { draftRecovery, handleRecoverDraft, handleDiscardDraft, handleDismissDraft };
}
