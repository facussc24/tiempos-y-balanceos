import { useState, useEffect, useCallback } from 'react';
import { AmfeDocument } from './amfeTypes';
import { validateAmfeDocument, migrateAmfeDocument } from './amfeValidation';
import { logger } from '../../utils/logger';

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
}

export function useAmfeDraftRecovery(params: UseAmfeDraftRecoveryParams): UseAmfeDraftRecoveryReturn {
    const { currentProject, loadData, resetHistory, requestConfirm } = params;

    const [draftRecovery, setDraftRecovery] = useState<{ key: string; name: string } | null>(null);

    useEffect(() => {
        // Only check for drafts when no project is loaded
        if (currentProject) return;

        let cancelled = false;
        const checkDrafts = async () => {
            try {
                const { listDraftKeys, loadDraft: loadDraftFn } = await import('./useAmfePersistence');
                const keys = await listDraftKeys();
                if (cancelled || keys.length === 0) return;

                // Pick the first draft found
                const key = keys[0];
                const draft = await loadDraftFn(key);
                if (cancelled || !draft) return;

                const projectName = key.replace('amfe_draft_', '');
                setDraftRecovery({ key, name: projectName });
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
                // Validate draft before loading (could be corrupted or outdated)
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

    return { draftRecovery, handleRecoverDraft, handleDiscardDraft };
}
