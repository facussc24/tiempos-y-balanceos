import { useState, useCallback } from 'react';
import { AmfeDocument } from './amfeTypes';
import { ControlPlanDocument } from '../controlPlan/controlPlanTypes';
import { HoDocument } from '../hojaOperaciones/hojaOperacionesTypes';
import { PfdDocument } from '../pfd/pfdTypes';
import { generateControlPlanFromAmfe } from '../controlPlan/controlPlanGenerator';
import { generateHoFromAmfeAndCp } from '../hojaOperaciones/hojaOperacionesGenerator';
import { importPfdOpsFromAmfe } from '../pfd/pfdGenerator';

export type ActiveTab = 'pfd' | 'amfe' | 'controlPlan' | 'hojaOperaciones';

const VALID_TABS = new Set<ActiveTab>(['pfd', 'amfe', 'controlPlan', 'hojaOperaciones']);
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
    /** Tab to activate on first render (e.g. when entering PFD from landing) */
    initialTab?: ActiveTab;
}

interface UseAmfeTabNavigationReturn {
    activeTab: ActiveTab;
    setActiveTab: (tab: ActiveTab) => void;
    pfdInitialData: PfdDocument | null;
    pfdWarnings: string[];
    setPfdWarnings: (w: string[]) => void;
    /** Opens the PFD generation wizard instead of generating directly. */
    handleGeneratePfd: () => Promise<void>;
    /** Simplified PFD import — only operation numbers + descriptions from AMFE. */
    handleImportPfdFromAmfe: () => Promise<void>;
    /** Whether the PFD wizard modal should be shown. */
    showPfdWizard: boolean;
    setShowPfdWizard: (show: boolean) => void;
    /** Called when the wizard completes — receives the generated PFD document. */
    handlePfdWizardComplete: (pfdDoc: PfdDocument) => void;
    cpInitialData: ControlPlanDocument | null;
    cpWarnings: string[];
    setCpWarnings: (w: string[]) => void;
    hoInitialData: HoDocument | null;
    hoWarnings: string[];
    setHoWarnings: (w: string[]) => void;
    handleGenerateControlPlan: () => Promise<void>;
    handleGenerateHojasOperaciones: () => Promise<void>;
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
    const [pfdInitialData, setPfdInitialData] = useState<PfdDocument | null>(null);
    const [pfdWarnings, setPfdWarnings] = useState<string[]>([]);
    const [showPfdWizard, setShowPfdWizard] = useState(false);
    const [cpInitialData, setCpInitialData] = useState<ControlPlanDocument | null>(null);
    const [cpWarnings, setCpWarnings] = useState<string[]>([]);
    const [hoInitialData, setHoInitialData] = useState<HoDocument | null>(null);
    const [hoWarnings, setHoWarnings] = useState<string[]>([]);

    /** Open the PFD wizard. If there's existing data, confirm regeneration first. */
    const handleGeneratePfd = useCallback(async () => {
        if (pfdInitialData) {
            const ok = await requestConfirm({
                title: 'Regenerar Diagrama de Flujo',
                message: 'Se abrirá el asistente para regenerar el Diagrama de Flujo desde el AMFE actual. Se perderán los cambios manuales realizados.',
                variant: 'warning',
                confirmText: 'Abrir Asistente',
            });
            if (!ok) return;
        }
        setShowPfdWizard(true);
    }, [pfdInitialData, requestConfirm]);

    /** Called when the wizard completes — receives the generated PFD document. */
    const handlePfdWizardComplete = useCallback((pfdDoc: PfdDocument) => {
        setPfdInitialData(pfdDoc);
        setPfdWarnings([]);
        setShowPfdWizard(false);
        setActiveTab('pfd');
    }, []);

    /** Simplified PFD import — only operation numbers + descriptions, everything else manual. */
    const handleImportPfdFromAmfe = useCallback(async () => {
        if (pfdInitialData) {
            const ok = await requestConfirm({
                title: 'Importar Operaciones al PFD',
                message: 'Se importarán los números y descripciones de las operaciones del AMFE. Todo lo demás (tipo de paso, máquina, CC/SC, transportes) quedará vacío para completar manualmente.\n\n¿Continuar?',
                variant: 'warning',
                confirmText: 'Importar',
            });
            if (!ok) return;
        }
        const { document: pfdDoc, warnings } = importPfdOpsFromAmfe(data, currentProject || 'Sin nombre');
        setPfdInitialData(pfdDoc);
        setPfdWarnings(warnings);
        setActiveTab('pfd');
    }, [data, currentProject, pfdInitialData, requestConfirm]);

    const handleGenerateControlPlan = useCallback(async () => {
        if (cpInitialData) {
            const ok = await requestConfirm({
                title: 'Regenerar Plan de Control',
                message: 'Se regenerará el Plan de Control desde el AMFE actual. Se perderán los cambios manuales realizados.',
                variant: 'warning',
                confirmText: 'Regenerar',
            });
            if (!ok) return;
        }
        const { document: cpDoc, warnings } = generateControlPlanFromAmfe(data, currentProject || 'Sin nombre');
        setCpInitialData(cpDoc);
        setCpWarnings(warnings);
        setActiveTab('controlPlan');
    }, [data, currentProject, cpInitialData, requestConfirm]);

    const handleGenerateHojasOperaciones = useCallback(async () => {
        // Only ask for confirmation if there are actual sheets to lose
        if (hoInitialData && hoInitialData.sheets.length > 0) {
            const ok = await requestConfirm({
                title: 'Regenerar Hojas de Operaciones',
                message: 'Se regenerarán las Hojas de Operaciones desde el AMFE y Plan de Control actuales. Se perderán los cambios manuales realizados.',
                variant: 'warning',
                confirmText: 'Regenerar',
            });
            if (!ok) return;
        }
        const { document: hoDoc, warnings } = generateHoFromAmfeAndCp(
            data,
            cpInitialData || null,
            currentProject || 'Sin nombre',
        );
        setHoInitialData(hoDoc);
        setHoWarnings(warnings);
        setActiveTab('hojaOperaciones');
    }, [data, cpInitialData, currentProject, hoInitialData, requestConfirm]);

    return {
        activeTab,
        setActiveTab,
        pfdInitialData,
        pfdWarnings,
        setPfdWarnings,
        handleGeneratePfd,
        handleImportPfdFromAmfe,
        showPfdWizard,
        setShowPfdWizard,
        handlePfdWizardComplete,
        cpInitialData,
        cpWarnings,
        setCpWarnings,
        hoInitialData,
        hoWarnings,
        setHoWarnings,
        handleGenerateControlPlan,
        handleGenerateHojasOperaciones,
    };
}
