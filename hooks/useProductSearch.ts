/**
 * useProductSearch
 *
 * Debounced search hook over the product catalog (SQLite).
 * Loads customer lines once, then searches products on demand.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Product, CustomerLine } from '../utils/repositories/productRepository';
import { listProducts, listCustomerLines } from '../utils/repositories/productRepository';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseProductSearchOptions {
    /** Filter by customer line code */
    lineaCode?: string;
    /** Debounce delay in ms (default: 200) */
    debounceMs?: number;
    /** Max results (default: 30) */
    limit?: number;
}

export interface UseProductSearchReturn {
    /** Current search query */
    query: string;
    /** Set the search query (triggers debounced search) */
    setQuery: (q: string) => void;
    /** Search results */
    results: Product[];
    /** Whether a search is in progress */
    isLoading: boolean;
    /** All customer lines (loaded once on mount) */
    customerLines: CustomerLine[];
    /** Currently selected line filter code ('' = all) */
    selectedLine: string;
    /** Set the selected line filter */
    setSelectedLine: (code: string) => void;
    /** Clear search query and results */
    clearSearch: () => void;
    /** Whether browse-all mode is active (shows products without min query length) */
    browseAll: boolean;
    /** Enable/disable browse-all mode */
    setBrowseAll: (on: boolean) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const MIN_QUERY_LENGTH = 2;

export function useProductSearch(options?: UseProductSearchOptions): UseProductSearchReturn {
    const debounceMs = options?.debounceMs ?? 200;
    const limit = options?.limit ?? 30;

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [customerLines, setCustomerLines] = useState<CustomerLine[]>([]);
    const [selectedLine, setSelectedLine] = useState(options?.lineaCode ?? '');
    const [browseAll, setBrowseAll] = useState(false);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    const searchIdRef = useRef(0);

    // Load customer lines once on mount
    useEffect(() => {
        let cancelled = false;
        listCustomerLines()
            .then(lines => {
                if (!cancelled) setCustomerLines(lines);
            })
            .catch(() => {
                // Silently fail — customer lines are optional enhancement
            });
        return () => { cancelled = true; };
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    // Debounced search effect
    useEffect(() => {
        // Clear previous timer
        if (timerRef.current) clearTimeout(timerRef.current);

        // browseAll mode: list products without minimum query length
        const shouldSearch = browseAll || query.length >= MIN_QUERY_LENGTH;

        if (!shouldSearch) {
            setResults([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const currentSearchId = ++searchIdRef.current;

        timerRef.current = setTimeout(async () => {
            try {
                const products = await listProducts({
                    search: query.length >= MIN_QUERY_LENGTH ? query : undefined,
                    lineaCode: selectedLine || undefined,
                    limit,
                    activeOnly: true,
                });
                // Only update if this is still the latest search
                if (mountedRef.current && currentSearchId === searchIdRef.current) {
                    setResults(products);
                }
            } catch {
                if (mountedRef.current && currentSearchId === searchIdRef.current) {
                    setResults([]);
                }
            } finally {
                if (mountedRef.current && currentSearchId === searchIdRef.current) {
                    setIsLoading(false);
                }
            }
        }, debounceMs);
    }, [query, selectedLine, debounceMs, limit, browseAll]);

    const clearSearch = useCallback(() => {
        setQuery('');
        setResults([]);
        setIsLoading(false);
        setBrowseAll(false);
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    return {
        query,
        setQuery,
        results,
        isLoading,
        customerLines,
        selectedLine,
        setSelectedLine,
        clearSearch,
        browseAll,
        setBrowseAll,
    };
}
