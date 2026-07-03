/**
 * Document Registry Hook
 *
 * Aggregates documents from the AMFE and CP repositories
 * into a unified list for the Document Hub.
 */

import { useState, useEffect, useCallback } from 'react';
import type { DocumentRegistryEntry } from './documentRegistryTypes';
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

            // Fetch from the repositories in parallel
            const [amfeMod, cpMod, registryMod] = await Promise.all([
                import('../../utils/repositories/amfeRepository').catch(() => null),
                import('../../utils/repositories/cpRepository').catch(() => null),
                import('../../utils/repositories/amfeRegistryRepository').catch(() => null),
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

            // Merge con el catalogo maestro (amfe_registry): las filas de docs
            // cargados ganan la metadata SGC del catalogo; las entradas sin
            // documento cargado se agregan como filas sinteticas no navegables.
            if (registryMod) {
                try {
                    const catalog = await registryMod.listRegistry();
                    const amfeById = new Map(
                        all.filter(e => e.type === 'amfe').map(e => [e.id, e]),
                    );
                    for (const cat of catalog) {
                        const linked = cat.documentId ? amfeById.get(cat.documentId) : undefined;
                        if (linked) {
                            // Doc cargado: la fila existente gana metadata del catalogo
                            linked.estadoSgc = cat.estado;
                            linked.revActual = cat.revActual;
                            linked.proximaRevision = cat.proximaRevision;
                            linked.serverPath = cat.serverPath;
                            linked.amfeCode = cat.amfeCode;
                            linked.cargado = true;
                        } else {
                            // Solo en catalogo: fila sintetica, no navegable
                            all.push({
                                id: `registry:${cat.amfeCode}`,
                                type: 'amfe',
                                name: cat.producto || cat.proyecto || `AMFE ${cat.amfeCode}`,
                                partNumber: cat.partNumber || '',
                                partName: cat.proyecto || '',
                                client: cat.cliente || '',
                                responsible: cat.propietario || '',
                                itemCount: 0,
                                updatedAt: cat.fechaUltimaRev || '',
                                estadoSgc: cat.estado,
                                revActual: cat.revActual,
                                proximaRevision: cat.proximaRevision,
                                serverPath: cat.serverPath,
                                amfeCode: cat.amfeCode,
                                cargado: false,
                                meta: { amfeNumber: cat.amfeCode, tipo: cat.tipo },
                            });
                        }
                    }
                } catch (err) {
                    logger.warn('Registry', 'Failed to merge amfe_registry catalog', { error: String(err) });
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

            // Web build: inject demo data when no real data exists.
            if (all.length === 0) {
                all.push(...DEMO_REGISTRY_ENTRIES);
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
