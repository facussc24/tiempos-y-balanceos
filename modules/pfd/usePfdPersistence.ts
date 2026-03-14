/**
 * PFD Auto-Save Persistence Hook
 *
 * Debounced auto-save for draft data protection.
 * Delegates to SQLite via draftRepository.
 */

import { useState, useEffect, useRef } from 'react';
import type { PfdDocument } from './pfdTypes';
import { logger } from '../../utils/logger';
import {
    saveDraft,
    loadDraft,
    deleteDraft,
    listDraftKeys,
} from '../../utils/repositories/draftRepository';
import { AUTOSAVE_DEBOUNCE_MS } from '../../config';

export async function loadPfdDraft(key: string): Promise<PfdDocument | null> {
    try {
        return await loadDraft<PfdDocument>('pfd', key);
    } catch (err) {
        logger.warn('PfdPersistence', 'Failed to load draft', { key, error: String(err) });
        return null;
    }
}

export async function listPfdDraftKeys(): Promise<string[]> {
    const keys = await listDraftKeys('pfd');
    return keys.filter(k => k.startsWith('pfd_draft_'));
}

export async function deletePfdDraft(key: string): Promise<void> {
    await deleteDraft('pfd', key);
}

interface Options {
    currentData: PfdDocument;
    currentProject: string;
    isSaving: boolean;
}

const UNSAVED_DRAFT_KEY = 'pfd_draft_unsaved';

export function usePfdPersistence({ currentData, currentProject, isSaving }: Options) {
    const [lastAutoSave, setLastAutoSave] = useState('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (isSaving) return;
        if (timerRef.current) clearTimeout(timerRef.current);

        const draftKey = currentProject ? `pfd_draft_${currentProject}` : UNSAVED_DRAFT_KEY;

        timerRef.current = setTimeout(async () => {
            try {
                await saveDraft('pfd', draftKey, currentData);
                if (isMountedRef.current) {
                    setLastAutoSave(new Date().toLocaleTimeString('es-AR', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                    }));
                }
            } catch (err) {
                logger.warn('PfdPersistence', 'Auto-save failed', { error: String(err) });
            }
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [currentData, currentProject, isSaving]);

    return { lastAutoSave };
}

/** Clean up the unsaved draft after a successful named save */
export async function deleteUnsavedDraft(): Promise<void> {
    try {
        await deleteDraft('pfd', UNSAVED_DRAFT_KEY);
    } catch {
        // Ignore — draft may not exist
    }
}
