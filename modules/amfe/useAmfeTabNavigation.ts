import { useState, useCallback } from 'react';
import { AmfeDocument } from './amfeTypes';
import { ControlPlanDocument } from '../controlPlan/controlPlanTypes';
import { HoDocument } from '../hojaOperaciones/hojaOperacionesTypes';
import { generateControlPlanFromAmfe } from '../controlPlan/controlPlanGenerator';
import { generateHoFromAmfeAndCp } from '../hojaOperaciones/hojaOperacionesGenerator';

export type ActiveTab = 'amfe' | 'controlPlan' | 'hojaOperaciones';

interface UseAmfeTabNavigationParams {
    data: AmfeDocument;
    currentProject: string | null;
    requestConfirm: (options: {
        title: string;
        message: string;
        variant?: 'danger' | 'warning' | 'info';
        confirmText?: string;
    }) => Promise<boolean>;
}

interface UseAmfeTabNavigationReturn {
    activeTab: ActiveTab;
    setActiveTab: (tab: ActiveTab) => void;
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
    const { data, currentProject, requestConfirm } = params;

    const [activeTab, setActiveTab] = useState<ActiveTab>('amfe');
    const [cpInitialData, setCpInitialData] = useState<ControlPlanDocument | null>(null);
    const [cpWarnings, setCpWarnings] = useState<string[]>([]);
    const [hoInitialData, setHoInitialData] = useState<HoDocument | null>(null);
    const [hoWarnings, setHoWarnings] = useState<string[]>([]);

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
        if (hoInitialData) {
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
