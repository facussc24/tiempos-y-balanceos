/**
 * useCpDraftRecovery - Draft recovery on mount for Control Plan
 *
 * Extracted from ControlPlanApp.tsx to reduce component size.
 * Recovers the latest draft when no project is loaded and not embedded.
 */

import { useEffect } from 'react';
import { loadCpDraft, listCpDraftKeys, deleteCpDraft } from './useControlPlanPersistence';
import { ControlPlanDocument } from './controlPlanTypes';
import { logger } from '../../utils/logger';

interface UseCpDraftRecoveryParams {
    embedded?: boolean;
    currentProject: string | null;
    loadData: (data: ControlPlanDocument) => void;
    requestConfirm: (opts: { title: string; message: string; variant?: string; confirmText?: string }) => Promise<boolean>;
}

export function useCpDraftRecovery({ embedded, currentProject, loadData, requestConfirm }: UseCpDraftRecoveryParams): void {
    useEffect(() => {
        if (embedded || currentProject) return;
        // FIX: Added cancelled flag to prevent state updates after unmount
        // (matching useAmfeDraftRecovery pattern)
        let cancelled = false;
        (async () => {
            try {
                const keys = await listCpDraftKeys();
                if (cancelled || keys.length === 0) return;
                const latestKey = keys[keys.length - 1];
                const draft = await loadCpDraft(latestKey);
                if (cancelled || !draft || draft.items.length === 0) return;
                const ok = await requestConfirm({
                    title: 'Borrador encontrado',
                    message: `Se encontro un borrador de Plan de Control con ${draft.items.length} item(s). ¿Desea recuperarlo?`,
                    variant: 'info',
                    confirmText: 'Recuperar',
                });
                if (cancelled) return;
                if (ok) {
                    loadData(draft);
                } else {
                    await deleteCpDraft(latestKey);
                }
            } catch (err) {
                logger.warn('ControlPlan', 'Draft recovery failed', { error: err instanceof Error ? err.message : String(err) });
            }
        })();
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
