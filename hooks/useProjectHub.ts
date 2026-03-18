/**
 * useProjectHub — Fetches all product families with their linked documents
 * for the "Mis Proyectos" landing page section.
 *
 * Returns project entries with:
 * - Health indicator (red/yellow/green) based on AP=H unmitigated + pending proposals
 * - Phase from CP documents
 * - Master/variant info from family_documents
 * - Pending items list for the "Pendientes" section
 *
 * @module useProjectHub
 */

import { useState, useEffect, useCallback } from 'react';
import { listFamilies, getFamilyMembers } from '../utils/repositories/familyRepository';
import { listFamilyDocuments, getPendingProposalCount } from '../utils/repositories/familyDocumentRepository';
import { logger } from '../utils/logger';
import type { ProductFamily, ProductFamilyMember } from '../utils/repositories/familyRepository';
import type { FamilyDocument } from '../utils/repositories/familyDocumentRepository';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentStatus = 'complete' | 'missing';
export type ProjectHealth = 'red' | 'yellow' | 'green';

export interface ProjectDocumentStatuses {
    pfd: DocumentStatus;
    amfe: DocumentStatus;
    controlPlan: DocumentStatus;
    hojaOperaciones: DocumentStatus;
}

export interface ProjectKPIs {
    apHCount: number;
    apHUnmitigated: number;
    causeCount: number;
    cpItemCount: number;
    pendingProposals: number;
}

export interface ProjectEntry {
    family: ProductFamily;
    members: ProductFamilyMember[];
    documents: ProjectDocumentStatuses;
    kpis: ProjectKPIs;
    health: ProjectHealth;
    phase: string | null;
    hasMaster: boolean;
    variantCount: number;
}

export interface PendingItem {
    type: 'ap_h_unmitigated' | 'change_proposal';
    familyId: number;
    familyName: string;
    count: number;
}

export interface UseProjectHubReturn {
    projects: ProjectEntry[];
    pendingItems: PendingItem[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APQP_MODULES = ['pfd', 'amfe', 'controlPlan', 'hojaOperaciones'] as const;

/** family_documents stores short names ('cp','ho'); map to canonical keys */
const DB_MODULE_TO_CANONICAL: Record<string, keyof ProjectDocumentStatuses> = {
    pfd: 'pfd',
    amfe: 'amfe',
    controlPlan: 'controlPlan',
    hojaOperaciones: 'hojaOperaciones',
    cp: 'controlPlan',
    ho: 'hojaOperaciones',
};

function canonicalModule(dbModule: string): keyof ProjectDocumentStatuses | null {
    return DB_MODULE_TO_CANONICAL[dbModule] ?? null;
}

function buildDocumentStatuses(familyDocs: FamilyDocument[]): ProjectDocumentStatuses {
    const statuses: ProjectDocumentStatuses = {
        pfd: 'missing',
        amfe: 'missing',
        controlPlan: 'missing',
        hojaOperaciones: 'missing',
    };
    for (const d of familyDocs) {
        const key = canonicalModule(d.module);
        if (key) statuses[key] = 'complete';
    }
    return statuses;
}

function computeHealth(docs: ProjectDocumentStatuses, kpis: ProjectKPIs): ProjectHealth {
    // RED: AP=H without actions OR pending change proposals
    if (kpis.apHUnmitigated > 0 || kpis.pendingProposals > 0) return 'red';

    // GREEN: all 4 modules have documents
    const allComplete = APQP_MODULES.every(m => docs[m] === 'complete');
    if (allComplete) return 'green';

    // YELLOW: partial documentation
    return 'yellow';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProjectHub(): UseProjectHubReturn {
    const [projects, setProjects] = useState<ProjectEntry[]>([]);
    const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshCounter, setRefreshCounter] = useState(0);

    const refresh = useCallback(() => {
        setRefreshCounter(c => c + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const families = await listFamilies({ activeOnly: true });
                if (cancelled) return;

                if (families.length === 0) {
                    setProjects([]);
                    setPendingItems([]);
                    return;
                }

                // Fetch KPI data sources in parallel
                const [amfeMod, cpMod] = await Promise.all([
                    import('../utils/repositories/amfeRepository').catch(() => null),
                    import('../utils/repositories/cpRepository').catch(() => null),
                ]);

                const [amfeDocs, cpDocs] = await Promise.all([
                    amfeMod ? amfeMod.listAmfeDocuments().catch(() => []) : Promise.resolve([]),
                    cpMod ? cpMod.listCpDocuments().catch(() => []) : Promise.resolve([]),
                ]);

                if (cancelled) return;

                // Build lookup maps
                const amfeKpiMap = new Map<string, { apH: number; causes: number }>();
                for (const d of amfeDocs) {
                    amfeKpiMap.set(d.id, { apH: d.apHCount || 0, causes: d.causeCount || 0 });
                }
                const cpKpiMap = new Map<string, { count: number; phase: string }>();
                for (const d of cpDocs) {
                    cpKpiMap.set(d.id, { count: d.item_count || 0, phase: d.phase || '' });
                }

                // For AMFEs with AP=H, load full data to check unmitigated causes
                const amfeIdsWithApH = new Set<string>();
                for (const d of amfeDocs) {
                    if ((d.apHCount || 0) > 0) amfeIdsWithApH.add(d.id);
                }

                const apHUnmitigatedMap = new Map<string, number>();
                if (amfeMod && amfeIdsWithApH.size > 0) {
                    const loadResults = await Promise.all(
                        Array.from(amfeIdsWithApH).map(async (id) => {
                            try {
                                const result = await amfeMod.loadAmfeDocument(id);
                                if (!result) return { id, count: 0 };
                                let unmitigated = 0;
                                for (const op of result.doc.operations) {
                                    for (const we of op.workElements) {
                                        for (const fn of we.functions) {
                                            for (const fail of fn.failures) {
                                                for (const cause of fail.causes) {
                                                    if (cause.ap === 'H' && !cause.preventionAction && !cause.detectionAction) {
                                                        unmitigated++;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                return { id, count: unmitigated };
                            } catch {
                                return { id, count: 0 };
                            }
                        })
                    );
                    for (const { id, count } of loadResults) {
                        if (count > 0) apHUnmitigatedMap.set(id, count);
                    }
                }

                if (cancelled) return;

                // Build entries per family
                const allPending: PendingItem[] = [];
                const entries = await Promise.all(
                    families.map(async (family) => {
                        const [members, familyDocs, proposalCount] = await Promise.all([
                            getFamilyMembers(family.id),
                            listFamilyDocuments(family.id),
                            getPendingProposalCount(family.id),
                        ]);

                        const kpis: ProjectKPIs = {
                            apHCount: 0,
                            apHUnmitigated: 0,
                            causeCount: 0,
                            cpItemCount: 0,
                            pendingProposals: proposalCount,
                        };
                        let phase: string | null = null;
                        let hasMaster = false;
                        let variantCount = 0;

                        for (const fdoc of familyDocs) {
                            if (fdoc.isMaster) hasMaster = true;
                            if (!fdoc.isMaster && fdoc.sourceMasterId) variantCount++;

                            const canonical = canonicalModule(fdoc.module);
                            if (canonical === 'amfe') {
                                const s = amfeKpiMap.get(fdoc.documentId);
                                if (s) {
                                    kpis.apHCount += s.apH;
                                    kpis.causeCount += s.causes;
                                }
                                const u = apHUnmitigatedMap.get(fdoc.documentId);
                                if (u) kpis.apHUnmitigated += u;
                            } else if (canonical === 'controlPlan') {
                                const c = cpKpiMap.get(fdoc.documentId);
                                if (c) {
                                    kpis.cpItemCount += c.count;
                                    if (!phase && c.phase) phase = c.phase;
                                }
                            }
                        }

                        const documents = buildDocumentStatuses(familyDocs);
                        const health = computeHealth(documents, kpis);

                        if (kpis.apHUnmitigated > 0) {
                            allPending.push({
                                type: 'ap_h_unmitigated',
                                familyId: family.id,
                                familyName: family.name,
                                count: kpis.apHUnmitigated,
                            });
                        }
                        if (proposalCount > 0) {
                            allPending.push({
                                type: 'change_proposal',
                                familyId: family.id,
                                familyName: family.name,
                                count: proposalCount,
                            });
                        }

                        return {
                            family,
                            members,
                            documents,
                            kpis,
                            health,
                            phase,
                            hasMaster,
                            variantCount,
                        };
                    })
                );

                if (cancelled) return;

                // Sort pending: AP=H first, then by count descending
                allPending.sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'ap_h_unmitigated' ? -1 : 1;
                    return b.count - a.count;
                });

                setProjects(entries);
                setPendingItems(allPending.slice(0, 5));
            } catch (err) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : String(err);
                    logger.error('useProjectHub', 'Failed to load project hub data', { error: message });
                    setError(message);
                    setProjects([]);
                    setPendingItems([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        load();
        return () => { cancelled = true; };
    }, [refreshCounter]);

    return { projects, pendingItems, loading, error, refresh };
}
