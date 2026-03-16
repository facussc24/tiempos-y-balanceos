/**
 * Document Registry Hook
 *
 * Aggregates documents from all 4 repositories (AMFE, CP, PFD, HO)
 * into a unified list for the Document Hub.
 */

import { useState, useEffect, useCallback } from 'react';
import type { DocumentRegistryEntry, DocumentType } from './documentRegistryTypes';
import { logger } from '../../utils/logger';
import { DEMO_REGISTRY_ENTRIES } from './demoRegistryData';

export interface UseDocumentRegistryResult {
    entries: DocumentRegistryEntry[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

/**
 * Fetch and unify documents from all repositories.
 *
 * Uses dynamic imports to avoid pulling repository dependencies into
 * the main bundle when the hub isn't opened.
 */
export function useDocumentRegistry(): UseDocumentRegistryResult {
    const [entries, setEntries] = useState<DocumentRegistryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const all: DocumentRegistryEntry[] = [];

            // Fetch from all 4 repositories in parallel
            const [amfeMod, cpMod, pfdMod, hoMod] = await Promise.all([
                import('../../utils/repositories/amfeRepository').catch(() => null),
                import('../../utils/repositories/cpRepository').catch(() => null),
                import('../../utils/repositories/pfdRepository').catch(() => null),
                import('../../utils/repositories/hoRepository').catch(() => null),
            ]);

            // Map AMFE documents
            if (amfeMod) {
                try {
                    const amfeDocs = await amfeMod.listAmfeDocuments();
                    for (const doc of amfeDocs) {
                        all.push({
                            id: doc.id,
                            type: 'amfe',
                            name: doc.projectName || doc.subject || '(Sin nombre)',
                            partNumber: doc.partNumber || '',
                            partName: doc.subject || '',
                            client: doc.client || '',
                            responsible: doc.responsible || '',
                            itemCount: doc.operationCount || 0,
                            updatedAt: doc.lastRevisionDate || '',
                            createdBy: doc.createdBy || '',
                            updatedBy: doc.updatedBy || '',
                            meta: {
                                amfeNumber: doc.amfeNumber,
                                status: doc.status,
                                causeCount: doc.causeCount || 0,
                                apH: doc.apHCount || 0,
                                apM: doc.apMCount || 0,
                            },
                        });
                    }
                } catch (err) {
                    logger.warn('Registry', 'Failed to load AMFE docs', { error: String(err) });
                }
            }

            // Map CP documents
            if (cpMod) {
                try {
                    const cpDocs = await cpMod.listCpDocuments();
                    for (const doc of cpDocs) {
                        all.push({
                            id: doc.id,
                            type: 'controlPlan',
                            name: doc.project_name || doc.part_name || '(Sin nombre)',
                            partNumber: doc.part_number || '',
                            partName: doc.part_name || '',
                            client: doc.client || '',
                            responsible: doc.responsible || '',
                            itemCount: doc.item_count || 0,
                            updatedAt: doc.updated_at || '',
                            createdBy: doc.created_by || '',
                            updatedBy: doc.updated_by || '',
                            linkedAmfeProject: doc.linked_amfe_project || undefined,
                            meta: {
                                phase: doc.phase || '',
                                revision: doc.revision || '',
                                controlPlanNumber: doc.control_plan_number || '',
                            },
                        });
                    }
                } catch (err) {
                    logger.warn('Registry', 'Failed to load CP docs', { error: String(err) });
                }
            }

            // Map PFD documents
            if (pfdMod) {
                try {
                    const pfdDocs = await pfdMod.listPfdDocuments();
                    for (const doc of pfdDocs) {
                        all.push({
                            id: doc.id,
                            type: 'pfd',
                            name: doc.part_name || doc.part_number || '(Sin nombre)',
                            partNumber: doc.part_number || '',
                            partName: doc.part_name || '',
                            client: doc.customer_name || '',
                            responsible: '',
                            itemCount: doc.step_count || 0,
                            updatedAt: doc.updated_at || '',
                            createdBy: doc.created_by || '',
                            updatedBy: doc.updated_by || '',
                            meta: {
                                documentNumber: doc.document_number || '',
                                revisionLevel: doc.revision_level || '',
                            },
                        });
                    }
                } catch (err) {
                    logger.warn('Registry', 'Failed to load PFD docs', { error: String(err) });
                }
            }

            // Map HO documents
            if (hoMod) {
                try {
                    const hoDocs = await hoMod.listHoDocuments();
                    for (const doc of hoDocs) {
                        all.push({
                            id: doc.id,
                            type: 'hojaOperaciones',
                            name: doc.part_description || doc.part_number || '(Sin nombre)',
                            partNumber: doc.part_number || '',
                            partName: doc.part_description || '',
                            client: doc.client || '',
                            responsible: '',
                            itemCount: doc.sheet_count || 0,
                            updatedAt: doc.updated_at || '',
                            createdBy: doc.created_by || '',
                            updatedBy: doc.updated_by || '',
                            linkedAmfeProject: doc.linked_amfe_project || undefined,
                            meta: {
                                formNumber: doc.form_number || '',
                            },
                        });
                    }
                } catch (err) {
                    logger.warn('Registry', 'Failed to load HO docs', { error: String(err) });
                }
            }

            // In browser mode (non-Tauri), inject demo data when no real data exists
            if (all.length === 0) {
                try {
                    const fsMod = await import('../../utils/unified_fs');
                    if (!fsMod.isTauri()) {
                        all.push(...DEMO_REGISTRY_ENTRIES);
                    }
                } catch {
                    // If unified_fs import fails, still inject demo data (we're in browser)
                    all.push(...DEMO_REGISTRY_ENTRIES);
                }
            }

            // Sort by updatedAt descending (most recent first)
            all.sort((a, b) => {
                const da = a.updatedAt || '0';
                const db = b.updatedAt || '0';
                return db.localeCompare(da);
            });

            setEntries(all);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            logger.error('Registry', 'Failed to load document registry', { error: msg });
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { entries, loading, error, refresh };
}
