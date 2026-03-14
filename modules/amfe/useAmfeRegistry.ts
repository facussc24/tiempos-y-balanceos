/**
 * AMFE Registry Hook
 *
 * Manages the centralized AMFE registry: loading, saving, CRUD operations,
 * and synchronization with project files on disk.
 *
 * Follows the same patterns as useAmfeProjects.ts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    AmfeRegistry,
    AmfeRegistryEntry,
    AmfeLifecycleStatus,
    createEmptyRegistry,
} from './amfeRegistryTypes';
import {
    loadRegistry,
    saveRegistry,
    addToRegistry,
    updateRegistryEntry,
    updateEntryStatus,
    addRevisionToEntry,
    syncRegistryFromProjects,
    findDuplicateAmfeNumbers,
    repairDuplicateNumbers,
} from './amfeRegistryManager';
import { AmfeDocument } from './amfeTypes';
import { logger } from '../../utils/logger';

export type RegistrySortField = 'amfeNumber' | 'subject' | 'client' | 'status' | 'updatedAt' | 'apHCount' | 'coveragePercent';
export type RegistrySortDir = 'asc' | 'desc';

export interface RegistryFilters {
    search: string;
    status: AmfeLifecycleStatus | 'all';
    client: string;
    responsible: string;
}

export const EMPTY_REGISTRY_FILTERS: RegistryFilters = {
    search: '',
    status: 'all',
    client: '',
    responsible: '',
};

export const useAmfeRegistry = () => {
    const [registry, setRegistry] = useState<AmfeRegistry>(createEmptyRegistry);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<RegistryFilters>(EMPTY_REGISTRY_FILTERS);
    const [sortField, setSortField] = useState<RegistrySortField>('updatedAt');
    const [sortDir, setSortDir] = useState<RegistrySortDir>('desc');

    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // FIX: Ref always holds the latest registry to avoid stale closures in CRUD callbacks.
    // Without this, rapid CRUD calls can read outdated state from their useCallback closures.
    const registryRef = useRef(registry);
    registryRef.current = registry;

    // ─── Load on mount ──────────────────────────────────────────
    // FIX: Added cancelled flag to prevent state updates after unmount
    const loadRegistryData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let data = await loadRegistry();
            // Auto-repair duplicate amfeNumbers on load
            const dupes = findDuplicateAmfeNumbers(data);
            if (dupes.length > 0) {
                logger.warn('useAmfeRegistry', 'Found duplicate amfeNumbers, repairing', { duplicates: dupes.map(d => d.amfeNumber) });
                data = repairDuplicateNumbers(data);
                await saveRegistry(data);
            }
            setRegistry(data);
        } catch (err) {
            setError('Error al cargar el registro AMFE');
            logger.error('useAmfeRegistry', 'Load error', {}, err instanceof Error ? err : undefined);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                let data = await loadRegistry();
                if (cancelled) return;
                const dupes = findDuplicateAmfeNumbers(data);
                if (dupes.length > 0) {
                    logger.warn('useAmfeRegistry', 'Found duplicate amfeNumbers, repairing', { duplicates: dupes.map(d => d.amfeNumber) });
                    data = repairDuplicateNumbers(data);
                    await saveRegistry(data);
                    if (cancelled) return;
                }
                setRegistry(data);
            } catch (err) {
                if (cancelled) return;
                setError('Error al cargar el registro AMFE');
                logger.error('useAmfeRegistry', 'Load error', {}, err instanceof Error ? err : undefined);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, []);

    // ─── Auto-save helper ───────────────────────────────────────
    const persistRegistry = useCallback(async (updated: AmfeRegistry) => {
        setRegistry(updated);
        // Debounced save to avoid rapid writes
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
            const ok = await saveRegistry(updated);
            if (!ok) setError('Error al guardar el registro');
        }, 500);
    }, []);

    // ─── CRUD Operations ────────────────────────────────────────

    /** Register a new AMFE document in the registry. */
    // FIX: Use registryRef.current to avoid stale closure reads during rapid operations.
    const registerAmfe = useCallback(async (
        projectName: string,
        doc: AmfeDocument,
    ): Promise<AmfeRegistryEntry | null> => {
        const current = registryRef.current;
        // Check if already registered
        const existing = current.entries.find(e => e.projectName === projectName);
        if (existing) {
            // Update existing entry instead
            const updated = await updateRegistryEntry(current, projectName, doc);
            await persistRegistry(updated);
            return updated.entries.find(e => e.projectName === projectName) || null;
        }

        const { entry, updatedRegistry } = await addToRegistry(current, projectName, doc);
        await persistRegistry(updatedRegistry);
        return entry;
    }, [persistRegistry]);

    /** Update stats for an existing AMFE project in the registry (called on save). */
    const updateAmfeStats = useCallback(async (
        projectName: string,
        doc: AmfeDocument,
    ): Promise<void> => {
        const updated = await updateRegistryEntry(registryRef.current, projectName, doc);
        await persistRegistry(updated);
    }, [persistRegistry]);

    /** Change lifecycle status for an entry. */
    const changeStatus = useCallback(async (
        entryId: string,
        status: AmfeLifecycleStatus,
    ): Promise<void> => {
        const updated = await updateEntryStatus(registryRef.current, entryId, status);
        await persistRegistry(updated);
    }, [persistRegistry]);

    /** Add a revision note to an entry. */
    const addRevision = useCallback(async (
        entryId: string,
        revision: { reason: string; revisedBy: string; description: string },
    ): Promise<void> => {
        const updated = addRevisionToEntry(registryRef.current, entryId, revision);
        await persistRegistry(updated);
    }, [persistRegistry]);

    /** Sync registry with project files on disk. */
    const syncFromDisk = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            const synced = await syncRegistryFromProjects(registryRef.current);
            await persistRegistry(synced);
        } catch (err) {
            setError('Error al sincronizar con disco');
        } finally {
            setLoading(false);
        }
    }, [persistRegistry]);

    // ─── Filtering & Sorting ────────────────────────────────────

    const filteredEntries = useCallback((): AmfeRegistryEntry[] => {
        let entries = [...registry.entries];

        // Apply filters
        if (filters.search) {
            const q = filters.search.toLowerCase();
            entries = entries.filter(e =>
                e.amfeNumber.toLowerCase().includes(q) ||
                e.subject.toLowerCase().includes(q) ||
                e.client.toLowerCase().includes(q) ||
                e.projectName.toLowerCase().includes(q) ||
                e.responsible.toLowerCase().includes(q)
            );
        }
        if (filters.status !== 'all') {
            entries = entries.filter(e => e.status === filters.status);
        }
        if (filters.client) {
            entries = entries.filter(e => e.client === filters.client);
        }
        if (filters.responsible) {
            entries = entries.filter(e => e.responsible === filters.responsible);
        }

        // Sort
        entries.sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'amfeNumber':
                    cmp = a.amfeNumber.localeCompare(b.amfeNumber);
                    break;
                case 'subject':
                    cmp = a.subject.localeCompare(b.subject);
                    break;
                case 'client':
                    cmp = a.client.localeCompare(b.client);
                    break;
                case 'status':
                    cmp = a.status.localeCompare(b.status);
                    break;
                case 'updatedAt':
                    cmp = a.updatedAt.localeCompare(b.updatedAt);
                    break;
                case 'apHCount':
                    cmp = a.apHCount - b.apHCount;
                    break;
                case 'coveragePercent':
                    cmp = a.coveragePercent - b.coveragePercent;
                    break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return entries;
    }, [registry.entries, filters, sortField, sortDir]);

    /** Get unique clients from all entries. */
    const uniqueClients = useCallback((): string[] => {
        const clients = new Set(registry.entries.map(e => e.client).filter(Boolean));
        return Array.from(clients).sort();
    }, [registry.entries]);

    /** Get unique responsibles from all entries. */
    const uniqueResponsibles = useCallback((): string[] => {
        const responsibles = new Set(registry.entries.map(e => e.responsible).filter(Boolean));
        return Array.from(responsibles).sort();
    }, [registry.entries]);

    /** Toggle sort field (or flip direction). */
    const toggleSort = useCallback((field: RegistrySortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    }, [sortField]);

    /** Get entry for a project name. */
    const getEntryByProject = useCallback((projectName: string): AmfeRegistryEntry | undefined => {
        return registry.entries.find(e => e.projectName === projectName);
    }, [registry.entries]);

    return {
        // State
        registry,
        loading,
        error,
        filters,
        sortField,
        sortDir,

        // Actions
        loadRegistryData,
        registerAmfe,
        updateAmfeStats,
        changeStatus,
        addRevision,
        syncFromDisk,

        // Filters & sort
        setFilters,
        toggleSort,
        filteredEntries,
        uniqueClients,
        uniqueResponsibles,
        getEntryByProject,
    };
};
