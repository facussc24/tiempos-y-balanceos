/**
 * Hoja de Operaciones Auto-Save Persistence Hook
 *
 * Debounced auto-save for draft data protection.
 * Delegates to SQLite via draftRepository.
 */

import { useState, useEffect, useRef } from 'react';
import type { HoDocument } from './hojaOperacionesTypes';
import { normalizeHoDocument } from './hojaOperacionesTypes';
import { logger } from '../../utils/logger';
import {
    saveDraft,
    loadDraft,
    deleteDraft,
    listDraftKeys,
} from '../../utils/repositories/draftRepository';

const AUTOSAVE_DEBOUNCE_MS = 2000;

export async function loadHoDraft(key: string): Promise<HoDocument | null> {
    try {
        const raw = await loadDraft<HoDocument>('ho', key);
        return raw ? normalizeHoDocument(raw) : null;
    } catch {
        return null;
    }
}

export async function listHoDraftKeys(): Promise<string[]> {
    const keys = await listDraftKeys('ho');
    return keys.filter(k => k.startsWith('ho_draft_'));
}

export async function deleteHoDraft(key: string): Promise<void> {
    await deleteDraft('ho', key);
}

interface Options {
    currentData: HoDocument;
    currentProject: string;
    isSaving: boolean;
}

export function useHoPersistence({ currentData, currentProject, isSaving }: Options) {
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
                await saveDraft('ho', `ho_draft_${currentProject}`, currentData);
                if (isMountedRef.current) {
                    setAutoSaveError(false);
                    setLastAutoSave(new Date().toLocaleTimeString('es-AR', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                    }));
                }
            } catch (err) {
                logger.warn('[HojaOperaciones] Auto-save failed:', err);
                if (isMountedRef.current) {
                    setAutoSaveError(true);
                }
            }
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [currentData, currentProject, isSaving]);

    return { lastAutoSave, autoSaveError };
}
