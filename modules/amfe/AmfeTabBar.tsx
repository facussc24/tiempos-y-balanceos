import React from 'react';
import { ClipboardCheck, FileText, RefreshCcw, ArrowLeft } from 'lucide-react';
import type { ActiveTab } from './useAmfeTabNavigation';
import type { ControlPlanDocument } from '../controlPlan/controlPlanTypes';
import type { HoDocument } from '../hojaOperaciones/hojaOperacionesTypes';

interface AmfeTabBarProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
    cpInitialData: ControlPlanDocument | null;
    hoInitialData: HoDocument | null;
    onGenerateControlPlan: () => void;
    onGenerateHojasOperaciones: () => void;
    onBackToLanding: () => void;
    hasUnsavedChanges: boolean;
    requestConfirm: (options: {
        title: string;
        message: string;
        variant?: 'danger' | 'warning' | 'info';
        confirmText?: string;
    }) => Promise<boolean>;
    regenerateButton?: {
        label: string;
        onClick: () => void;
        color: 'amber' | 'teal';
    };
}

const TAB_CLASSES = {
    active: {
        amfe: 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50',
        controlPlan: 'text-green-700 border-b-2 border-green-600 bg-green-50/50',
        hojaOperaciones: 'text-amber-700 border-b-2 border-amber-600 bg-amber-50/50',
    },
    inactive: 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300',
} as const;

const REGEN_COLORS = {
    amber: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300',
    teal: 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-300',
} as const;

const AmfeTabBar: React.FC<AmfeTabBarProps> = ({
    activeTab,
    onTabChange,
    cpInitialData,
    hoInitialData,
    onGenerateControlPlan,
    onGenerateHojasOperaciones,
    onBackToLanding,
    hasUnsavedChanges,
    requestConfirm,
    regenerateButton,
}) => {
    const handleBack = async () => {
        if (hasUnsavedChanges) {
            const ok = await requestConfirm({
                title: 'Cambios sin guardar',
                message: 'Hay cambios sin guardar. ¿Volver al inicio?',
                variant: 'warning',
                confirmText: 'Volver',
            });
            if (!ok) return;
        }
        onBackToLanding();
    };

    const getTabClass = (tab: ActiveTab) =>
        activeTab === tab ? TAB_CLASSES.active[tab] : TAB_CLASSES.inactive;

    return (
        <div className="bg-white border-b border-gray-300 px-4 flex items-center gap-0 sticky top-0 z-50">
            <button
                onClick={() => onTabChange('amfe')}
                className={`px-4 py-2.5 text-xs font-medium transition ${getTabClass('amfe')}`}
            >
                AMFE VDA
            </button>
            <button
                onClick={() => cpInitialData ? onTabChange('controlPlan') : onGenerateControlPlan()}
                className={`px-4 py-2.5 text-xs font-medium transition flex items-center gap-1.5 ${getTabClass('controlPlan')}`}
            >
                {activeTab !== 'controlPlan' && <ClipboardCheck size={13} />}
                Plan de Control
            </button>
            <button
                onClick={() => hoInitialData ? onTabChange('hojaOperaciones') : onGenerateHojasOperaciones()}
                className={`px-4 py-2.5 text-xs font-medium transition flex items-center gap-1.5 ${getTabClass('hojaOperaciones')}`}
            >
                {activeTab !== 'hojaOperaciones' || activeTab === 'hojaOperaciones' ? <FileText size={13} /> : null}
                Hojas de Operaciones
            </button>
            {regenerateButton && (
                <button
                    onClick={regenerateButton.onClick}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded transition ml-3 ${REGEN_COLORS[regenerateButton.color]}`}
                    title={regenerateButton.label}
                >
                    <RefreshCcw size={13} />
                    {regenerateButton.label}
                </button>
            )}
            <div className="flex-1" />
            <button
                onClick={handleBack}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded hover:bg-slate-100 transition text-xs"
            >
                <ArrowLeft size={14} />
                Inicio
            </button>
        </div>
    );
};

export default AmfeTabBar;
