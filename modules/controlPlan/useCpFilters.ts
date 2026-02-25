/**
 * useCpFilters - Filter state and logic for Control Plan items
 *
 * Extracted from ControlPlanApp.tsx to reduce component size.
 * Handles search (debounced), AP filter, and special char filter.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { ControlPlanItem } from './controlPlanTypes';

interface UseCpFiltersParams {
    items: ControlPlanItem[];
}

interface UseCpFiltersReturn {
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    debouncedSearch: string;
    filterAp: '' | 'H' | 'M' | 'L';
    setFilterAp: (v: '' | 'H' | 'M' | 'L') => void;
    filterSpecial: '' | 'CC' | 'SC';
    setFilterSpecial: (v: '' | 'CC' | 'SC') => void;
    filteredItems: ControlPlanItem[];
    hasActiveFilters: boolean;
    searchRef: React.RefObject<HTMLInputElement | null>;
    clearFilters: () => void;
}

export function useCpFilters({ items }: UseCpFiltersParams): UseCpFiltersReturn {
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterAp, setFilterAp] = useState<'' | 'H' | 'M' | 'L'>('');
    const [filterSpecial, setFilterSpecial] = useState<'' | 'CC' | 'SC'>('');
    const searchRef = useRef<HTMLInputElement>(null);

    // Debounce search to avoid filtering on every keystroke
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Filtered items (uses debounced search)
    const filteredItems = useMemo(() => {
        let result = items;
        if (debouncedSearch.trim()) {
            const q = debouncedSearch.toLowerCase();
            result = result.filter(i =>
                i.processDescription.toLowerCase().includes(q) ||
                i.controlMethod.toLowerCase().includes(q) ||
                i.reactionPlan.toLowerCase().includes(q) ||
                i.processStepNumber.toLowerCase().includes(q) ||
                i.productCharacteristic.toLowerCase().includes(q) ||
                i.machineDeviceTool.toLowerCase().includes(q)
            );
        }
        if (filterAp) {
            result = result.filter(i => i.amfeAp === filterAp);
        }
        if (filterSpecial) {
            result = result.filter(i => i.specialCharClass?.toUpperCase().trim() === filterSpecial);
        }
        return result;
    }, [items, debouncedSearch, filterAp, filterSpecial]);

    const hasActiveFilters = !!(searchQuery || filterAp || filterSpecial);

    const clearFilters = () => {
        setSearchQuery('');
        setDebouncedSearch('');
        setFilterAp('');
        setFilterSpecial('');
    };

    return {
        searchQuery, setSearchQuery, debouncedSearch,
        filterAp, setFilterAp,
        filterSpecial, setFilterSpecial,
        filteredItems, hasActiveFilters, searchRef,
        clearFilters,
    };
}
