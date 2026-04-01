import { useState, useCallback, useEffect } from 'react';
import { AmfeDocument } from './amfeTypes';
import { ControlPlanDocument } from '../controlPlan/controlPlanTypes';
import { HoDocument } from '../hojaOperaciones/hojaOperacionesTypes';
import { PfdDocument } from '../pfd/pfdTypes';
import { generateControlPlanFromAmfe, linkPfdToCp, mergeGeneratedWithExisting } from '../controlPlan/controlPlanGenerator';
import { generateHoFromAmfeAndCp, mergeHoWithExisting } from '../hojaOperaciones/hojaOperacionesGenerator';
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
    setPfdInitialData: (doc: PfdDocument | null) => void;
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
    setCpInitialData: (doc: ControlPlanDocument | null) => void;
    cpWarnings: string[];
    setCpWarnings: (w: string[]) => void;
    hoInitialData: HoDocument | null;
    setHoInitialData: (doc: HoDocument | null) => void;
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

    // Sync initialTab prop changes to activeTab state (e.g. when navigating
    // back from landing page with a different tab selected)
    useEffect(() => {
        if (initialTab && initialTab !== activeTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

    /** Called when the wizard completes — receives the generated PFD document. */
    const handlePfdWizardComplete = useCallback((pfdDoc: PfdDocument) => {
        setPfdInitialData(pfdDoc);
        setPfdWarnings([]);
        setShowPfdWizard(false);
        setActiveTab('pfd');
    }, [setActiveTab]);

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
    }, [data, currentProject, pfdInitialData, requestConfirm, setActiveTab]);

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
        // Link PFD steps to CP items for full traceability
        if (pfdInitialData) {
            const linkedPfd = linkPfdToCp(pfdInitialData, finalDoc.items, data.operations);
            setPfdInitialData(linkedPfd);
        }
        setActiveTab('controlPlan');
    }, [data, currentProject, cpInitialData, pfdInitialData, requestConfirm, setActiveTab]);

    const handleGenerateHojasOperaciones = useCallback(async () => {
        const hasExisting = hoInitialData && hoInitialData.sheets.length > 0;
        if (hasExisting) {
            const ok = await requestConfirm({
                title: 'Actualizar Hojas de Operaciones',
                message: 'Se actualizaran los datos del CP/AMFE preservando pasos TWI, ayudas visuales, EPP y registros.',
                variant: 'info',
                confirmText: 'Actualizar',
            });
            if (!ok) return;
        }
        const { document: hoDoc, warnings } = generateHoFromAmfeAndCp(
            data,
            cpInitialData || null,
            currentProject || 'Sin nombre',
        );

        let finalDoc = hoDoc;
        let mergeWarnings: string[] = [];

        if (hasExisting) {
            const result = mergeHoWithExisting(hoDoc, hoInitialData!);
            finalDoc = result.document;
            mergeWarnings = result.warnings;
        }

        setHoInitialData(finalDoc);
        setHoWarnings([...warnings, ...mergeWarnings]);
        setActiveTab('hojaOperaciones');
    }, [data, cpInitialData, currentProject, hoInitialData, requestConfirm, setActiveTab]);

    return {
        activeTab,
        setActiveTab,
        pfdInitialData,
        setPfdInitialData,
        pfdWarnings,
        setPfdWarnings,
        handleGeneratePfd,
        handleImportPfdFromAmfe,
        showPfdWizard,
        setShowPfdWizard,
        handlePfdWizardComplete,
        cpInitialData,
        setCpInitialData,
        cpWarnings,
        setCpWarnings,
        hoInitialData,
        setHoInitialData,
        hoWarnings,
        setHoWarnings,
        handleGenerateControlPlan,
        handleGenerateHojasOperaciones,
    };
}
