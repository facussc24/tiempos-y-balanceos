import { useState, useCallback } from 'react';
import { AmfeDocument } from './amfeTypes';
import { ControlPlanDocument } from '../controlPlan/controlPlanTypes';
import { generateControlPlanFromAmfe, mergeGeneratedWithExisting } from '../controlPlan/controlPlanGenerator';

export type ActiveTab = 'amfe' | 'controlPlan';

const VALID_TABS = new Set<ActiveTab>(['amfe', 'controlPlan']);
const LS_KEY_TAB = 'amfe_activeTab';

interface UseAmfeTabNavigationParams {
    data: AmfeDocument;
    currentProject: string | null;
    requestConfirm: (options: {
        title: string;
        message: string;
        variant?: 'danger' | 'warning' | 'info';
        confirmText?: string;
    }) => Promise<boolean>;
    /** Tab to activate on first render (e.g. when entering CP from landing) */
    initialTab?: ActiveTab;
}

interface UseAmfeTabNavigationReturn {
    activeTab: ActiveTab;
    setActiveTab: (tab: ActiveTab) => void;
    cpInitialData: ControlPlanDocument | null;
    setCpInitialData: (doc: ControlPlanDocument | null) => void;
    cpWarnings: string[];
    setCpWarnings: (w: string[]) => void;
    handleGenerateControlPlan: () => Promise<void>;
}

export function useAmfeTabNavigation(params: UseAmfeTabNavigationParams): UseAmfeTabNavigationReturn {
    const { data, currentProject, requestConfirm, initialTab } = params;

    const [activeTab, setActiveTabRaw] = useState<ActiveTab>(() => {
        // Explicit initialTab (from landing page navigation) takes priority
        if (initialTab) return initialTab;
        // Restore from localStorage
        try {
            const saved = localStorage.getItem(LS_KEY_TAB) as ActiveTab | null;
            if (saved && VALID_TABS.has(saved)) return saved;
        } catch { /* ignore */ }
        return 'amfe';
    });
    const setActiveTab = useCallback((tab: ActiveTab) => {
        setActiveTabRaw(tab);
        try { localStorage.setItem(LS_KEY_TAB, tab); } catch { /* ignore */ }
    }, []);
    const [cpInitialData, setCpInitialData] = useState<ControlPlanDocument | null>(null);
    const [cpWarnings, setCpWarnings] = useState<string[]>([]);

    // Sync initialTab prop changes to activeTab state (e.g. when navigating
    // back from landing page with a different tab selected).
    // React 19 idiom: derive state during render with a "previous" tracker
    // instead of useEffect+setState. Avoids cascading renders.
    // See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
    const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
    if (initialTab !== prevInitialTab) {
        setPrevInitialTab(initialTab);
        if (initialTab && VALID_TABS.has(initialTab)) {
            setActiveTabRaw(initialTab);
            try { localStorage.setItem(LS_KEY_TAB, initialTab); } catch { /* ignore */ }
        }
    }

    const handleGenerateControlPlan = useCallback(async () => {
        const hasExisting = cpInitialData && cpInitialData.items.length > 0;
        if (hasExisting) {
            const ok = await requestConfirm({
                title: 'Actualizar Plan de Control',
                message: 'Se actualizaran los datos heredados del AMFE preservando los campos que completaste manualmente (especificacion, muestreo, metodo, etc.).',
                variant: 'info',
                confirmText: 'Actualizar',
            });
            if (!ok) return;
        }
        const { document: cpDoc, warnings } = generateControlPlanFromAmfe(data, currentProject || 'Sin nombre');

        let finalDoc = cpDoc;
        let mergeWarnings: string[] = [];

        if (hasExisting) {
            const result = mergeGeneratedWithExisting(cpDoc.items, cpInitialData!.items);
            finalDoc = { header: cpInitialData!.header, items: result.items };
            mergeWarnings = result.warnings;
        }

        setCpInitialData(finalDoc);
        setCpWarnings([...warnings, ...mergeWarnings]);
        setActiveTab('controlPlan');
    }, [data, currentProject, cpInitialData, requestConfirm, setActiveTab]);

    return {
        activeTab,
        setActiveTab,
        cpInitialData,
        setCpInitialData,
        cpWarnings,
        setCpWarnings,
        handleGenerateControlPlan,
    };
}
