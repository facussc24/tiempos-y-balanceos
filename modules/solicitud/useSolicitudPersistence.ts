/**
 * Solicitud Persistence Hook
 *
 * Draft auto-save and formal persistence for Solicitud documents.
 * Delegates to SQLite via draftRepository and solicitudRepository.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SolicitudDocument, SolicitudListItem } from './solicitudTypes';
import { logger } from '../../utils/logger';

const AUTOSAVE_DEBOUNCE_MS = 3000;
const DRAFT_MODULE = 'solicitud';

interface UseSolicitudPersistenceProps {
    currentData: SolicitudDocument;
    currentId: string;
}

export interface UseSolicitudPersistenceResult {
    saveDocument: () => Promise<boolean>;
    loadDocument: (id: string) => Promise<SolicitudDocument | null>;
    listDocuments: () => Promise<SolicitudListItem[]>;
    deleteDocument: (id: string) => Promise<boolean>;
    getNextNumber: () => Promise<string>;
    isSaving: boolean;
    lastSavedAt: string | null;
}

export function useSolicitudPersistence({
    currentData,
    currentId,
}: UseSolicitudPersistenceProps): UseSolicitudPersistenceResult {
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true);
    const savingRef = useRef(false);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // --- Auto-save draft via debounced effect ---
    useEffect(() => {
        if (!currentId) return;

        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(async () => {
            try {
                const { saveDraft } = await import('../../utils/repositories/draftRepository');
                // DraftModule type doesn't include 'solicitud' yet, cast to any for forward compat
                await (saveDraft as (module: string, key: string, data: unknown) => Promise<void>)(
                    DRAFT_MODULE, currentId, currentData
                );
                logger.debug('SolicitudPersistence', `Auto-saved draft for ${currentId}`);
            } catch (err) {
                logger.warn('SolicitudPersistence', 'Draft auto-save failed', {
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [currentData, currentId]);

    // --- Save document formally ---
    const saveDocument = useCallback(async (): Promise<boolean> => {
        if (savingRef.current) return false;
        savingRef.current = true;
        setIsSaving(true);

        try {
            // Snapshot data before async work
            const snapshot = { ...currentData };

            // Assign solicitud number if empty
            if (!snapshot.header.solicitudNumber) {
                const { getNextSolicitudNumber } = await import('../../utils/repositories/solicitudRepository');
                const nextNumber = await getNextSolicitudNumber();
                snapshot.header = { ...snapshot.header, solicitudNumber: nextNumber };
            }

            // Update timestamp
            snapshot.updatedAt = new Date().toISOString();

            // Save to repository
            const { saveSolicitud: repoSave } = await import('../../utils/repositories/solicitudRepository');
            const success = await repoSave(snapshot.id, snapshot);

            if (success) {
                // Clean up draft after successful save
                try {
                    const { deleteDraft } = await import('../../utils/repositories/draftRepository');
                    await (deleteDraft as (module: string, key: string) => Promise<void>)(
                        DRAFT_MODULE, currentId
                    );
                } catch {
                    // Non-critical: draft cleanup failure
                }

                if (isMountedRef.current) {
                    setLastSavedAt(new Date().toLocaleTimeString());
                }
                logger.info('SolicitudPersistence', `Saved document ${snapshot.id}`);
            }

            return success;
        } catch (err) {
            logger.error('SolicitudPersistence', 'Save failed', {},
                err instanceof Error ? err : undefined);
            return false;
        } finally {
            savingRef.current = false;
            if (isMountedRef.current) setIsSaving(false);
        }
    }, [currentData, currentId]);

    // --- Load document ---
    const loadDocument = useCallback(async (id: string): Promise<SolicitudDocument | null> => {
        try {
            const { loadSolicitud: repoLoad } = await import('../../utils/repositories/solicitudRepository');
            return await repoLoad(id);
        } catch (err) {
            logger.error('SolicitudPersistence', `Failed to load document ${id}`, {},
                err instanceof Error ? err : undefined);
            return null;
        }
    }, []);

    // --- List all documents ---
    const listDocuments = useCallback(async (): Promise<SolicitudListItem[]> => {
        try {
            const { listSolicitudes: repoList } = await import('../../utils/repositories/solicitudRepository');
            return await repoList();
        } catch (err) {
            logger.error('SolicitudPersistence', 'Failed to list documents', {},
                err instanceof Error ? err : undefined);
            return [];
        }
    }, []);

    // --- Delete document ---
    const deleteDocument = useCallback(async (id: string): Promise<boolean> => {
        try {
            const { deleteSolicitud: repoDelete } = await import('../../utils/repositories/solicitudRepository');
            const success = await repoDelete(id);

            if (success) {
                // Also clean up any draft
                try {
                    const { deleteDraft } = await import('../../utils/repositories/draftRepository');
                    await (deleteDraft as (module: string, key: string) => Promise<void>)(
                        DRAFT_MODULE, id
                    );
                } catch {
                    // Non-critical
                }
                logger.info('SolicitudPersistence', `Deleted document ${id}`);
            }

            return success;
        } catch (err) {
            logger.error('SolicitudPersistence', `Failed to delete document ${id}`, {},
                err instanceof Error ? err : undefined);
            return false;
        }
    }, []);

    // --- Get next number ---
    const getNextNumber = useCallback(async (): Promise<string> => {
        try {
            const { getNextSolicitudNumber } = await import('../../utils/repositories/solicitudRepository');
            return await getNextSolicitudNumber();
        } catch (err) {
            logger.warn('SolicitudPersistence', 'Failed to get next solicitud number', { error: err instanceof Error ? err.message : String(err) });
            return 'SGC-001';
        }
    }, []);

    return {
        saveDocument,
        loadDocument,
        listDocuments,
        deleteDocument,
        getNextNumber,
        isSaving,
        lastSavedAt,
    };
}
