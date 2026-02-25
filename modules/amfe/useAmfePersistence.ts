/**
 * AMFE Auto-Save Persistence Hook
 *
 * Provides debounced auto-save for draft data protection.
 * Delegates to SQLite via draftRepository.
 */

import { useState, useEffect, useRef } from 'react';
import type { AmfeDocument } from './amfeTypes';
import { logger } from '../../utils/logger';
import {
    saveDraft as repoSaveDraft,
    loadDraft as repoLoadDraft,
    deleteDraft as repoDeleteDraft,
    listDraftKeys as repoListDraftKeys,
} from '../../utils/repositories/draftRepository';

const AUTOSAVE_DEBOUNCE_MS = 2000;

/**
 * Save a draft to SQLite.
 */
async function saveDraftInternal(key: string, data: AmfeDocument): Promise<void> {
    await repoSaveDraft('amfe', key, data);
}

/**
 * Load a draft from SQLite.
 */
export async function loadDraft(key: string): Promise<AmfeDocument | null> {
    return repoLoadDraft<AmfeDocument>('amfe', key);
}

/**
 * Delete a draft from SQLite.
 */
export async function deleteDraft(key: string): Promise<void> {
    await repoDeleteDraft('amfe', key);
}

/**
 * List all draft keys.
 */
export async function listDraftKeys(): Promise<string[]> {
    return repoListDraftKeys('amfe');
}

interface AmfePersistenceOptions {
    currentData: AmfeDocument;
    currentProject: string;
    isSaving: boolean;
}

interface AmfePersistenceResult {
    lastAutoSave: string;
}

/**
 * Hook that auto-saves AMFE data with a 2-second debounce.
 */
export function useAmfePersistence({
    currentData,
    currentProject,
    isSaving,
}: AmfePersistenceOptions): AmfePersistenceResult {
    const [lastAutoSave, setLastAutoSave] = useState('');
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
                const key = `amfe_draft_${currentProject}`;
                await saveDraftInternal(key, currentData);
                if (isMountedRef.current) {
                    setLastAutoSave(new Date().toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    }));
                }
            } catch (err) {
                logger.warn('[AMFE] Auto-save failed:', err);
            }
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [currentData, currentProject, isSaving]);

    return { lastAutoSave };
}
