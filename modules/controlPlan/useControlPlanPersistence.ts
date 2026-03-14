/**
 * Control Plan Auto-Save Persistence Hook
 *
 * Debounced auto-save for draft data protection.
 * Delegates to SQLite via draftRepository.
 */

import { useState, useEffect, useRef } from 'react';
import type { ControlPlanDocument } from './controlPlanTypes';
import { normalizeControlPlanDocument } from './controlPlanTypes';
import { logger } from '../../utils/logger';
import {
    saveDraft,
    loadDraft,
    deleteDraft,
    listDraftKeys,
} from '../../utils/repositories/draftRepository';
import { AUTOSAVE_DEBOUNCE_MS } from '../../config';

export async function loadCpDraft(key: string): Promise<ControlPlanDocument | null> {
    try {
        const raw = await loadDraft<ControlPlanDocument>('cp', key);
        return raw ? normalizeControlPlanDocument(raw) : null;
    } catch {
        return null;
    }
}

export async function listCpDraftKeys(): Promise<string[]> {
    const keys = await listDraftKeys('cp');
    return keys.filter(k => k.startsWith('cp_draft_'));
}

export async function deleteCpDraft(key: string): Promise<void> {
    await deleteDraft('cp', key);
}

interface Options {
    currentData: ControlPlanDocument;
    currentProject: string;
    isSaving: boolean;
}

export function useControlPlanPersistence({ currentData, currentProject, isSaving }: Options) {
    const [lastAutoSave, setLastAutoSave] = useState('');
    const [autoSaveError, setAutoSaveError] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!currentProject || isSaving) return;
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(async () => {
            try {
                await saveDraft('cp', `cp_draft_${currentProject}`, currentData);
                if (isMountedRef.current) {
                    setAutoSaveError(false);
                    setLastAutoSave(new Date().toLocaleTimeString('es-AR', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                    }));
                }
            } catch (err) {
                logger.warn('ControlPlan', 'Auto-save failed', { error: err instanceof Error ? err.message : String(err) });
                if (isMountedRef.current) {
                    setAutoSaveError(true);
                }
            }
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [currentData, currentProject, isSaving]);

    return { lastAutoSave, autoSaveError };
}
