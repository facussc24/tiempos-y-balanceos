/**
 * usePfdColumnVisibility — Column group visibility management for PFD table
 *
 * Priority: user override > autoShow > defaultVisible.
 * Essential group is always visible and cannot be toggled off.
 * State persists to localStorage.
 */

import { useState, useCallback, useMemo } from 'react';
import type { PfdStep, PfdColumnGroup, PfdColumnDef } from './pfdTypes';
import { PFD_COLUMN_GROUPS, PFD_COLUMNS } from './pfdTypes';

const STORAGE_KEY = 'pfd_column_visibility';

export function usePfdColumnVisibility(steps: PfdStep[]) {
    // Load from localStorage or use defaults
    const [userOverrides, setUserOverrides] = useState<Partial<Record<PfdColumnGroup, boolean>>>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch { return {}; }
    });

    // Compute effective visibility: user override > autoShow > defaultVisible
    // Essential is ALWAYS visible (cannot be toggled off)
    const visibleGroups = useMemo(() => {
        const result: Record<PfdColumnGroup, boolean> = {} as Record<PfdColumnGroup, boolean>;
        for (const group of PFD_COLUMN_GROUPS) {
            if (group.id === 'essential') {
                result[group.id] = true;
                continue;
            }
            if (userOverrides[group.id] !== undefined) {
                result[group.id] = userOverrides[group.id]!;
            } else if (group.autoShow) {
                result[group.id] = group.autoShow(steps);
            } else {
                result[group.id] = group.defaultVisible;
            }
        }
        return result;
    }, [steps, userOverrides]);

    // Filter PFD_COLUMNS to only include columns from visible groups
    const visibleColumns: PfdColumnDef[] = useMemo(() => {
        return PFD_COLUMNS.filter(col => visibleGroups[col.group]);
    }, [visibleGroups]);

    const toggleGroup = useCallback((groupId: PfdColumnGroup) => {
        if (groupId === 'essential') return; // Can't toggle essential
        setUserOverrides(prev => {
            const currentVisible = (() => {
                const group = PFD_COLUMN_GROUPS.find(g => g.id === groupId);
                if (!group) return false;
                if (prev[groupId] !== undefined) return prev[groupId]!;
                if (group.autoShow) return group.autoShow(steps);
                return group.defaultVisible;
            })();
            const next = { ...prev, [groupId]: !currentVisible };
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
            return next;
        });
    }, [steps]);

    const resetToDefaults = useCallback(() => {
        setUserOverrides({});
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    }, []);

    return { visibleGroups, visibleColumns, toggleGroup, resetToDefaults };
}
