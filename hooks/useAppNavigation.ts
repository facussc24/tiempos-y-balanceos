// hooks/useAppNavigation.ts
/**
 * Hook for managing application navigation and hash-based routing.
 * Extracted from App.tsx to reduce component complexity.
 */
import { useState, useEffect, useCallback } from 'react';

export type Tab = 'dashboard' | 'plant' | 'mix' | 'panel' | 'tasks' | 'graph' | 'balance' |
    'oee' | 'vsm' | 'help' | 'summary';

const VALID_TABS: Tab[] = ['dashboard', 'plant', 'mix', 'panel', 'tasks', 'graph', 'balance',
    'oee', 'vsm', 'help', 'summary'];

interface UseAppNavigationOptions {
    defaultTab?: Tab;
    isReady?: boolean; // Wait for DB load before syncing hash
}

export function useAppNavigation(options: UseAppNavigationOptions = {}) {
    const { defaultTab = 'dashboard', isReady = true } = options;
    const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

    // Sync URL Hash → Tab State
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '') as Tab;
            if (hash && VALID_TABS.includes(hash)) {
                setActiveTab(hash);
            }
        };

        // Initial check on mount
        handleHashChange();

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Sync Tab State → URL Hash (only when ready)
    useEffect(() => {
        if (isReady) {
            window.location.hash = activeTab;
            localStorage.setItem('optiline_tab', activeTab);
        }
    }, [activeTab, isReady]);

    const navigateTo = useCallback((tab: Tab) => {
        setActiveTab(tab);
    }, []);

    const navigateToPanel = useCallback(() => setActiveTab('panel'), []);
    const navigateToDashboard = useCallback(() => setActiveTab('dashboard'), []);

    return {
        activeTab,
        setActiveTab: navigateTo,
        navigateToPanel,
        navigateToDashboard,
        VALID_TABS
    };
}
