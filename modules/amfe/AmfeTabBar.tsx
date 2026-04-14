import React from 'react';
import { GitBranch, ClipboardCheck, FileText, FileJson, Home, Check, Package } from 'lucide-react';
import type { ActiveTab } from './useAmfeTabNavigation';
import type { PfdDocument } from '../pfd/pfdTypes';
import type { ControlPlanDocument } from '../controlPlan/controlPlanTypes';
import type { HoDocument } from '../hojaOperaciones/hojaOperacionesTypes';

/** Project context shown across all APQP tabs to maintain "same family" feeling */
interface ProjectContext {
    projectName?: string;
    clientName?: string;
    partName?: string;
    partNumber?: string;
}

interface AmfeTabBarProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
    pfdInitialData: PfdDocument | null;
    onGeneratePfd: () => void;
    onImportPfdFromAmfe?: () => void;
    cpInitialData: ControlPlanDocument | null;
    hoInitialData: HoDocument | null;
    onBackToLanding: () => void;
    hasUnsavedChanges: boolean;
    requestConfirm: (options: {
        title: string;
        message: string;
        variant?: 'danger' | 'warning' | 'info';
        confirmText?: string;
    }) => Promise<boolean>;
    /** Project context: client, part name, etc. to show across all tabs */
    projectContext?: ProjectContext;
}

const TAB_CLASSES = {
    active: {
        pfd: 'text-cyan-700 border-b-2 border-cyan-600 bg-cyan-50/50',
        amfe: 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50',
        controlPlan: 'text-green-700 border-b-2 border-green-600 bg-green-50/50',
        hojaOperaciones: 'text-amber-700 border-b-2 border-amber-600 bg-amber-50/50',
    },
    inactive: 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-b-2 border-transparent hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300',
} as const;

const AmfeTabBar: React.FC<AmfeTabBarProps> = ({
    activeTab,
    onTabChange,
    pfdInitialData,
    onGeneratePfd,
    onImportPfdFromAmfe,
    cpInitialData,
    onBackToLanding,
    hasUnsavedChanges,
    requestConfirm,
    projectContext,
}) => {
    /** Prompt for unsaved changes before navigating away from the AMFE tab. */
    const confirmIfDirty = async (): Promise<boolean> => {
        if (!hasUnsavedChanges || activeTab !== 'amfe') return true;
        return requestConfirm({
            title: 'Cambios sin guardar',
            message: 'Tiene cambios sin guardar. ¿Desea descartarlos?',
            variant: 'warning',
            confirmText: 'Descartar',
        });
    };

    const handleBack = async () => {
        if (hasUnsavedChanges) {
            const ok = await requestConfirm({
                title: 'Cambios sin guardar',
                message: 'Tiene cambios sin guardar. ¿Desea descartarlos?',
                variant: 'warning',
                confirmText: 'Descartar',
            });
            if (!ok) return;
        }
        onBackToLanding();
    };

    const getTabClass = (tab: ActiveTab) =>
        activeTab === tab ? TAB_CLASSES.active[tab] : TAB_CLASSES.inactive;

    // Build context text pieces
    const contextParts: string[] = [];
    if (projectContext?.clientName) contextParts.push(projectContext.clientName);
    if (projectContext?.partName) contextParts.push(projectContext.partName);
    if (projectContext?.partNumber) contextParts.push(`Nro. ${projectContext.partNumber}`);
    const hasContext = contextParts.length > 0;

    return (
        <div className="bg-white border-b border-gray-300 sticky top-0 z-50">
            <div className="px-4 flex items-center gap-0 overflow-x-auto">
                <button
                    onClick={async () => {
                        if (!(await confirmIfDirty())) return;
                        if (pfdInitialData) { onTabChange('pfd'); } else { (onImportPfdFromAmfe || onGeneratePfd)(); }
                    }}
                    className={`px-4 py-2.5 text-xs font-medium transition-colors duration-150 flex items-center gap-1.5 ${getTabClass('pfd')}`}
                >
                    <GitBranch size={13} />
                    Diagrama de Flujo
                </button>
                <button
                    onClick={() => onTabChange('amfe')}
                    className={`px-4 py-2.5 text-xs font-medium transition-colors duration-150 flex items-center gap-1.5 ${getTabClass('amfe')}`}
                >
                    <FileJson size={13} />
                    AMFE VDA
                </button>
                <button
                    onClick={async () => {
                        if (!(await confirmIfDirty())) return;
                        onTabChange('controlPlan');
                    }}
                    className={`px-4 py-2.5 text-xs font-medium transition-colors duration-150 flex items-center gap-1.5 ${getTabClass('controlPlan')}`}
                >
                    <ClipboardCheck size={13} />
                    Plan de Control
                    {cpInitialData && (
                        <span className="flex items-center gap-0.5 text-[9px] bg-green-100 text-green-700 px-1.5 py-0 rounded-full font-bold" title="CP guardado vinculado">
                            <Check size={9} /> Guardado
                        </span>
                    )}
                </button>
                <button
                    onClick={async () => {
                        if (!(await confirmIfDirty())) return;
                        onTabChange('hojaOperaciones');
                    }}
                    className={`px-4 py-2.5 text-xs font-medium transition-colors duration-150 flex items-center gap-1.5 ${getTabClass('hojaOperaciones')}`}
                >
                    <FileText size={13} />
                    Hojas de Operaciones
                </button>

                {/* Project context — shows the family you're working on */}
                {hasContext && (
                    <div className="ml-4 flex items-center gap-1.5 text-[11px] text-gray-400 border-l border-gray-200 pl-4">
                        <Package size={12} className="text-gray-300 flex-shrink-0" />
                        <span className="truncate max-w-[300px]" title={contextParts.join(' · ')}>
                            {contextParts.join(' · ')}
                        </span>
                    </div>
                )}

                <div className="flex-1" />
                <div className="border-l border-gray-300 ml-2 pl-2 flex items-center gap-1">
                    <button
                        onClick={handleBack}
                        title="Volver al menú principal"
                        className="flex items-center gap-1.5 text-slate-600 hover:text-blue-700 px-3 py-1.5 rounded hover:bg-blue-50 transition text-xs font-medium"
                    >
                        <Home size={14} />
                        Inicio
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(AmfeTabBar);
