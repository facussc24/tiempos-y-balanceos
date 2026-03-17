/**
 * useFamilyDocuments
 *
 * Hook that encapsulates loading, linking, and unlinking master documents
 * for a product family. One master per module type (PFD, AMFE, CP, HO).
 */

import { useState, useEffect, useCallback } from 'react';
import {
    listFamilyDocuments,
    linkDocumentToFamily,
    unlinkDocumentFromFamily,
} from '../../../utils/repositories/familyDocumentRepository';
import type { FamilyDocument } from '../../../utils/repositories/familyDocumentRepository';

export type DocumentModule = 'pfd' | 'amfe' | 'cp' | 'ho';

const ALL_MODULES: DocumentModule[] = ['pfd', 'amfe', 'cp', 'ho'];

export interface UseFamilyDocumentsReturn {
    masterDocs: Record<DocumentModule, FamilyDocument | null>;
    loading: boolean;
    error: string | null;
    linkMaster: (module: DocumentModule, documentId: string) => Promise<void>;
    unlinkMaster: (familyDocId: number) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useFamilyDocuments(familyId: number | null): UseFamilyDocumentsReturn {
    const [masterDocs, setMasterDocs] = useState<Record<DocumentModule, FamilyDocument | null>>({
        pfd: null,
        amfe: null,
        cp: null,
        ho: null,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadMasterDocs = useCallback(async () => {
        if (!familyId) {
            setMasterDocs({ pfd: null, amfe: null, cp: null, ho: null });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const docs = await listFamilyDocuments(familyId);
            const result: Record<DocumentModule, FamilyDocument | null> = {
                pfd: null,
                amfe: null,
                cp: null,
                ho: null,
            };
            for (const doc of docs) {
                const mod = doc.module as DocumentModule;
                if (ALL_MODULES.includes(mod) && doc.isMaster) {
                    result[mod] = doc;
                }
            }
            setMasterDocs(result);
        } catch {
            setError('Error al cargar documentos maestros');
        } finally {
            setLoading(false);
        }
    }, [familyId]);

    useEffect(() => {
        loadMasterDocs();
    }, [loadMasterDocs]);

    const linkMaster = useCallback(async (module: DocumentModule, documentId: string) => {
        if (!familyId) return;
        setError(null);
        try {
            await linkDocumentToFamily({
                familyId,
                module,
                documentId,
                isMaster: true,
            });
            await loadMasterDocs();
        } catch {
            setError('Error al vincular documento');
        }
    }, [familyId, loadMasterDocs]);

    const unlinkMaster = useCallback(async (familyDocId: number) => {
        if (!familyId) return;
        setError(null);
        try {
            await unlinkDocumentFromFamily(familyDocId);
            await loadMasterDocs();
        } catch {
            setError('Error al desvincular documento');
        }
    }, [familyId, loadMasterDocs]);

    return {
        masterDocs,
        loading,
        error,
        linkMaster,
        unlinkMaster,
        refresh: loadMasterDocs,
    };
}
