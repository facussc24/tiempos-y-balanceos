/**
 * Hoja de Operaciones Persistence
 *
 * Two layers:
 * 1. Auto-save (drafts) — debounced writes to draftRepository for crash protection.
 * 2. Formal save — explicit CRUD via hoRepository (ho_documents table).
 *
 * Pattern follows PFD: usePfdPersistence.ts + PfdApp.tsx.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { HoDocument } from './hojaOperacionesTypes';
import { normalizeHoDocument } from './hojaOperacionesTypes';
import { logger } from '../../utils/logger';
import {
    saveDraft,
    loadDraft,
    deleteDraft as deleteDraftRepo,
    listDraftKeys,
} from '../../utils/repositories/draftRepository';
import {
    saveHoDocument,
    loadHoDocument,
    listHoDocuments,
    deleteHoDocument,
} from '../../utils/repositories/hoRepository';
import type { HoDocumentListItem } from '../../utils/repositories/hoRepository';
import { AUTOSAVE_DEBOUNCE_MS } from '../../config';
import { triggerOverrideTracking } from '../../core/inheritance/triggerOverrideTracking';
import { triggerChangePropagation } from '../../core/inheritance/changePropagation';

// ============================================================================
// DRAFT UTILITIES (unchanged — backward compatible)
// ============================================================================

export async function loadHoDraft(key: string): Promise<HoDocument | null> {
    try {
        const raw = await loadDraft<HoDocument>('ho', key);
        return raw ? normalizeHoDocument(raw) : null;
    } catch (err) {
        logger.warn('HoPersistence', 'Failed to load draft', { key, error: String(err) });
        return null;
    }
}

export async function listHoDraftKeys(): Promise<string[]> {
    const keys = await listDraftKeys('ho');
    return keys.filter(k => k.startsWith('ho_draft_'));
}

export async function deleteHoDraft(key: string): Promise<void> {
    await deleteDraftRepo('ho', key);
}

// ============================================================================
// FORMAL PERSISTENCE — delegates to hoRepository
// ============================================================================

/**
 * Save an HO document formally to ho_documents table.
 * Returns true on success, false on failure.
 */
export async function saveHoDocumentFormal(id: string, doc: HoDocument): Promise<boolean> {
    try {
        // Load old doc for change propagation (before overwriting)
        let oldHoDoc: HoDocument | null = null;
        try {
            oldHoDoc = await loadHoDocument(id);
        } catch { /* non-critical */ }

        const ok = await saveHoDocument(id, doc);
        if (ok) {
            logger.info('HoPersistence', 'Document saved formally', { id, sheets: doc.sheets.length });
            // Fire-and-forget: trigger override tracking for variant documents
            triggerOverrideTracking(id, doc, 'ho');
            // Fire-and-forget: propagate master changes to variants
            if (oldHoDoc) {
                triggerChangePropagation(id, oldHoDoc, doc, 'ho');
            }
        }
        return ok;
    } catch (err) {
        logger.error('HoPersistence', `Failed to save document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Load an HO document from ho_documents table, with normalization.
 * Returns null if not found.
 */
export async function loadHoDocumentFormal(id: string): Promise<HoDocument | null> {
    try {
        const raw = await loadHoDocument(id);
        if (!raw) return null;
        return normalizeHoDocument(raw);
    } catch (err) {
        logger.error('HoPersistence', `Failed to load document ${id}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * List all formally saved HO documents (metadata only).
 */
export async function listHoDocumentsFormal(): Promise<HoDocumentListItem[]> {
    try {
        return await listHoDocuments();
    } catch (err) {
        logger.error('HoPersistence', 'Failed to list documents', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * Delete an HO document from ho_documents table.
 * Returns true on success, false on failure.
 */
export async function deleteHoDocumentFormal(id: string): Promise<boolean> {
    try {
        const ok = await deleteHoDocument(id);
        if (ok) {
            logger.info('HoPersistence', 'Document deleted', { id });
        }
        return ok;
    } catch (err) {
        logger.error('HoPersistence', `Failed to delete document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/** Clean up a specific HO draft (e.g. after formal save). */
export async function deleteHoUnsavedDraft(key: string): Promise<void> {
    try {
        await deleteDraftRepo('ho', key);
    } catch {
        // Ignore — draft may not exist
    }
}

// ============================================================================
// HOOK — auto-save to drafts + formal persistence methods
// ============================================================================

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

    // --- Auto-save to drafts (unchanged behavior) ---
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
                logger.warn('HoPersistence', 'Auto-save failed', { error: String(err) });
                if (isMountedRef.current) {
                    setAutoSaveError(true);
                }
            }
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [currentData, currentProject, isSaving]);

    // --- Formal persistence callbacks ---
    const saveDocument = useCallback(async (id: string, doc: HoDocument): Promise<boolean> => {
        return saveHoDocumentFormal(id, doc);
    }, []);

    const loadDocument = useCallback(async (id: string): Promise<HoDocument | null> => {
        return loadHoDocumentFormal(id);
    }, []);

    const listDocuments = useCallback(async (): Promise<HoDocumentListItem[]> => {
        return listHoDocumentsFormal();
    }, []);

    const deleteDocument = useCallback(async (id: string): Promise<boolean> => {
        return deleteHoDocumentFormal(id);
    }, []);

    const deleteDraft = useCallback(async (key: string): Promise<void> => {
        return deleteHoUnsavedDraft(key);
    }, []);

    return {
        lastAutoSave,
        autoSaveError,
        isSaving,
        // Formal persistence
        saveDocument,
        loadDocument,
        listDocuments,
        deleteDocument,
        deleteDraft,
    };
}
