/**
 * AMFE Library Hook
 *
 * Manages the global operations library: load, save, add, remove, import, sync.
 * Provides the bridge between the library persistence and the AMFE UI.
 * Includes search/filter capabilities for browsing the library.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AmfeDocument, AmfeOperation } from './amfeTypes';
import { AmfeLibrary, AmfeLibraryOperation, EMPTY_LIBRARY, buildSearchableText } from './amfeLibraryTypes';
import { loadLibrary, saveLibrary } from '../../utils/repositories/amfeRepository';
import { loadAmfe, saveAmfe, listAmfeProjects } from './amfePathManager';
import { loadRegistry, saveRegistry, addRevisionToEntry } from './amfeRegistryManager';
import { mergeWithLibrary } from './amfeLibraryMerge';
import { deepCloneOperation } from './amfeUtils';
import { ImpactScanResult, scanLinkedAmfes, syncAmfeWithLibrary, generateSyncSummary, SyncResult } from './amfeImpactAnalysis';
import { logger } from '../../utils/logger';

export interface UseAmfeLibraryResult {
    /** All library operations */
    libraryOps: AmfeLibraryOperation[];
    /** Filtered library operations (after search + category filter) */
    filteredOps: AmfeLibraryOperation[];
    /** Current search query */
    searchQuery: string;
    /** Set search query */
    setSearchQuery: (q: string) => void;
    /** Current category filter (empty = all) */
    categoryFilter: string;
    /** Set category filter */
    setCategoryFilter: (c: string) => void;
    /** Whether the library is loaded */
    isLoaded: boolean;
    /** Whether the network path is accessible */
    networkAvailable: boolean;
    /** Refresh the library from disk */
    refresh: () => Promise<void>;
    /** Save an operation to the library as a base template */
    saveToLibrary: (op: AmfeOperation, description?: string, category?: string, tags?: string[]) => Promise<void>;
    /** Remove an operation from the library */
    removeFromLibrary: (libOpId: string) => Promise<void>;
    /** Update an existing library operation with new data from an AMFE operation */
    updateInLibrary: (libOpId: string, op: AmfeOperation) => Promise<void>;
    /** Import a library operation into the current AMFE (returns the new linked operation) */
    importFromLibrary: (libOpId: string) => AmfeOperation | null;
    /** Sync a linked operation with its library base, returning the merged operation */
    syncFromLibrary: (localOp: AmfeOperation) => AmfeOperation | null;
    /** Scan all AMFEs to find which ones link to a given library operation */
    scanImpact: (libOpId: string) => Promise<ImpactScanResult | null>;
    /** Batch sync selected AMFEs after a library update */
    batchSync: (libOpId: string, projectNames: string[], syncAuthor?: string) => Promise<string>;
    /** Whether an impact scan is in progress */
    isScanning: boolean;
    /** Whether a batch sync is in progress */
    isSyncing: boolean;
}

export function useAmfeLibrary(): UseAmfeLibraryResult {
    const [library, setLibrary] = useState<AmfeLibrary>(EMPTY_LIBRARY);
    const [isLoaded, setIsLoaded] = useState(false);
    const [networkAvailable, setNetworkAvailable] = useState(true);
    const libraryRef = useRef<AmfeLibrary>(EMPTY_LIBRARY);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    // Keep ref in sync for use inside callbacks
    useEffect(() => {
        libraryRef.current = library;
    }, [library]);

    const refresh = useCallback(async () => {
        // SQLite mode: always accessible
        setNetworkAvailable(true);

        const lib = await loadLibrary();
        setLibrary(lib);
        setIsLoaded(true);
    }, []);

    // Load on mount
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Build search index and filter
    const filteredOps = useMemo(() => {
        let ops = library.operations;

        // Category filter
        if (categoryFilter) {
            ops = ops.filter(op => op.category === categoryFilter);
        }

        // Text search (case-insensitive, matches across all content)
        if (searchQuery.trim()) {
            const terms = searchQuery.toLowerCase().trim().split(/\s+/);
            ops = ops.filter(op => {
                const text = buildSearchableText(op);
                return terms.every(term => text.includes(term));
            });
        }

        return ops;
    }, [library.operations, searchQuery, categoryFilter]);

    const persistLibrary = useCallback(async (newLib: AmfeLibrary) => {
        newLib.lastModified = new Date().toISOString();
        setLibrary(newLib);
        libraryRef.current = newLib;
        await saveLibrary(newLib);
    }, []);

    const saveToLibrary = useCallback(async (op: AmfeOperation, description?: string, category?: string, tags?: string[]) => {
        const lib = libraryRef.current;
        const libOp: AmfeLibraryOperation = {
            id: uuidv4(),
            opNumber: op.opNumber,
            name: op.name,
            workElements: op.workElements,
            lastModified: new Date().toISOString(),
            version: 1,
            description: description || '',
            category: category || '',
            tags: tags || [],
        };
        await persistLibrary({
            ...lib,
            operations: [...lib.operations, libOp],
        });
    }, [persistLibrary]);

    const removeFromLibrary = useCallback(async (libOpId: string) => {
        const lib = libraryRef.current;
        await persistLibrary({
            ...lib,
            operations: lib.operations.filter(o => o.id !== libOpId),
        });
    }, [persistLibrary]);

    const updateInLibrary = useCallback(async (libOpId: string, op: AmfeOperation) => {
        const lib = libraryRef.current;
        await persistLibrary({
            ...lib,
            operations: lib.operations.map(o =>
                o.id === libOpId
                    ? {
                        ...o,
                        opNumber: op.opNumber,
                        name: op.name,
                        workElements: op.workElements,
                        lastModified: new Date().toISOString(),
                        version: o.version + 1,
                    }
                    : o
            ),
        });
    }, [persistLibrary]);

    const importFromLibrary = useCallback((libOpId: string): AmfeOperation | null => {
        const libOp = libraryRef.current.operations.find(o => o.id === libOpId);
        if (!libOp) return null;

        // Deep clone with new IDs, then link to library
        const cloned = deepCloneOperation({
            id: '', // will be replaced by deepClone
            opNumber: libOp.opNumber,
            name: libOp.name,
            workElements: libOp.workElements,
        });

        return {
            ...cloned,
            linkedLibraryOpId: libOpId,
        };
    }, []);

    const syncFromLibrary = useCallback((localOp: AmfeOperation): AmfeOperation | null => {
        if (!localOp.linkedLibraryOpId) return null;
        const libOp = libraryRef.current.operations.find(o => o.id === localOp.linkedLibraryOpId);
        if (!libOp) return null;

        return mergeWithLibrary(localOp, libOp);
    }, []);

    // --- Impact Analysis ---
    const [isScanning, setIsScanning] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const scanImpact = useCallback(async (libOpId: string): Promise<ImpactScanResult | null> => {
        const libOp = libraryRef.current.operations.find(o => o.id === libOpId);
        if (!libOp) return null;

        setIsScanning(true);
        try {
            // Load registry and all AMFE docs
            const registry = await loadRegistry();
            const projects = await listAmfeProjects();
            const docs = new Map<string, AmfeDocument>();

            for (const project of projects) {
                const doc = await loadAmfe(project.name);
                if (doc) docs.set(project.name, doc);
            }

            return scanLinkedAmfes(libOpId, libOp.name, docs, registry.entries);
        } catch (err) {
            logger.error('AMFE', 'Library: Error scanning impact', { error: err instanceof Error ? err.message : String(err) });
            return null;
        } finally {
            setIsScanning(false);
        }
    }, []);

    const batchSync = useCallback(async (
        libOpId: string,
        projectNames: string[],
        syncAuthor: string = 'Sistema',
    ): Promise<string> => {
        const libOp = libraryRef.current.operations.find(o => o.id === libOpId);
        if (!libOp) return 'Operacion de biblioteca no encontrada.';

        setIsSyncing(true);
        try {
            let registry = await loadRegistry();
            const results: SyncResult[] = [];

            for (const projectName of projectNames) {
                const doc = await loadAmfe(projectName);
                if (!doc) continue;

                const result = syncAmfeWithLibrary(doc, projectName, libOp, syncAuthor);
                if (result.mergedCount === 0) continue;

                // Save updated AMFE
                const updatedDoc: AmfeDocument = {
                    ...doc,
                    operations: result.updatedOperations,
                };
                await saveAmfe(projectName, updatedDoc);

                // Add revision to registry (IATF 16949 Paso 7)
                const registryEntry = registry.entries.find(e => e.projectName === projectName);
                if (registryEntry) {
                    registry = addRevisionToEntry(registry, registryEntry.id, {
                        reason: result.revisionEntry.reason,
                        revisedBy: result.revisionEntry.revisedBy,
                        description: result.revisionEntry.description,
                    });
                }

                results.push(result);
            }

            // Save updated registry
            await saveRegistry(registry);

            return generateSyncSummary(results);
        } catch (err) {
            logger.error('AMFE', 'Library: Error during batch sync', { error: err instanceof Error ? err.message : String(err) });
            return 'Error durante la sincronización. Verifique la red y reintente.';
        } finally {
            setIsSyncing(false);
        }
    }, []);

    return {
        libraryOps: library.operations,
        filteredOps,
        searchQuery,
        setSearchQuery,
        categoryFilter,
        setCategoryFilter,
        isLoaded,
        networkAvailable,
        refresh,
        saveToLibrary,
        removeFromLibrary,
        updateInLibrary,
        importFromLibrary,
        syncFromLibrary,
        scanImpact,
        batchSync,
        isScanning,
        isSyncing,
    };
}
