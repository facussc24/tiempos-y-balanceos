/**
 * Hoja de Operaciones App — Main Shell
 *
 * Can operate embedded in AMFE (as a tab) or standalone.
 * Layout: Navigator sidebar (left) + Sheet editor (right).
 * Theme: Navy blue (matching paper format HO 952 REV.06).
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { useHojaOperaciones } from './useHojaOperaciones';
import { useHoPersistence } from './useHoPersistence';
import { HoDocument, HojaOperacion, HoStep, HoVisualAid, PpeItem } from './hojaOperacionesTypes';
import HoSheetNavigator from './HoSheetNavigator';
import HoSheetEditor from './HoSheetEditor';
import { ModuleErrorBoundary } from '../../components/ui/ModuleErrorBoundary';
import { FileText } from 'lucide-react';

interface Props {
    /** When embedded in AMFE, parent provides initial data. */
    embedded?: boolean;
    initialData?: HoDocument;
    /** Callback when data changes (for parent tracking). */
    onDataChange?: (data: HoDocument) => void;
}

const HojaOperacionesApp: React.FC<Props> = ({ embedded, initialData, onDataChange }) => {
    const ho = useHojaOperaciones();

    // Auto-save drafts
    useHoPersistence({
        currentData: ho.data,
        currentProject: ho.data.header.linkedAmfeProject || 'untitled',
        isSaving: false,
    });

    // Load initial data when provided
    useEffect(() => {
        if (initialData && initialData.sheets.length > 0) {
            ho.loadData(initialData);
        }
    }, [initialData]); // eslint-disable-line react-hooks/exhaustive-deps

    // Notify parent of data changes
    useEffect(() => {
        onDataChange?.(ho.data);
    }, [ho.data, onDataChange]);

    // Find active sheet
    const activeSheet = useMemo(
        () => ho.data.sheets.find(s => s.id === ho.activeSheetId) || null,
        [ho.data.sheets, ho.activeSheetId],
    );

    // --- Handlers (bound to active sheet) ---

    const handleUpdateField = useCallback(<K extends keyof HojaOperacion>(field: K, value: HojaOperacion[K]) => {
        if (!ho.activeSheetId) return;
        ho.updateSheetField(ho.activeSheetId, field, value);
    }, [ho.activeSheetId, ho.updateSheetField]);

    const handleAddStep = useCallback(() => {
        if (!ho.activeSheetId) return;
        ho.addStep(ho.activeSheetId);
    }, [ho.activeSheetId, ho.addStep]);

    const handleRemoveStep = useCallback((stepId: string) => {
        if (!ho.activeSheetId) return;
        ho.removeStep(ho.activeSheetId, stepId);
    }, [ho.activeSheetId, ho.removeStep]);

    const handleUpdateStep = useCallback((stepId: string, field: keyof HoStep, value: any) => {
        if (!ho.activeSheetId) return;
        ho.updateStep(ho.activeSheetId, stepId, field, value);
    }, [ho.activeSheetId, ho.updateStep]);

    const handleReorderSteps = useCallback((from: number, to: number) => {
        if (!ho.activeSheetId) return;
        ho.reorderSteps(ho.activeSheetId, from, to);
    }, [ho.activeSheetId, ho.reorderSteps]);

    const handleTogglePpe = useCallback((item: PpeItem) => {
        if (!ho.activeSheetId) return;
        ho.togglePpe(ho.activeSheetId, item);
    }, [ho.activeSheetId, ho.togglePpe]);

    const handleAddVisualAid = useCallback((imageData: string, caption: string) => {
        if (!ho.activeSheetId) return;
        ho.addVisualAid(ho.activeSheetId, imageData, caption);
    }, [ho.activeSheetId, ho.addVisualAid]);

    const handleRemoveVisualAid = useCallback((aidId: string) => {
        if (!ho.activeSheetId) return;
        ho.removeVisualAid(ho.activeSheetId, aidId);
    }, [ho.activeSheetId, ho.removeVisualAid]);

    const handleUpdateVisualAidCaption = useCallback((aidId: string, caption: string) => {
        if (!ho.activeSheetId) return;
        ho.updateVisualAid(ho.activeSheetId, aidId, 'caption', caption);
    }, [ho.activeSheetId, ho.updateVisualAid]);

    const handleUpdateQcRegistro = useCallback((checkId: string, value: string) => {
        if (!ho.activeSheetId) return;
        ho.updateQualityCheckRegistro(ho.activeSheetId, checkId, value);
    }, [ho.activeSheetId, ho.updateQualityCheckRegistro]);

    const handleUpdateReactionPlan = useCallback((text: string) => {
        if (!ho.activeSheetId) return;
        ho.updateReactionPlan(ho.activeSheetId, text);
    }, [ho.activeSheetId, ho.updateReactionPlan]);

    const handleUpdateReactionContact = useCallback((contact: string) => {
        if (!ho.activeSheetId) return;
        ho.updateReactionContact(ho.activeSheetId, contact);
    }, [ho.activeSheetId, ho.updateReactionContact]);

    // --- Empty state ---
    if (ho.data.sheets.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-16">
                <FileText size={48} className="mb-4 text-blue-300" />
                <p className="text-sm font-medium text-gray-500 mb-1">Sin hojas de operaciones</p>
                <p className="text-xs text-gray-400 max-w-sm text-center">
                    Las Hojas de Operaciones se generan automaticamente desde el AMFE y el Plan de Control.
                    Vuelva a la pestana AMFE y use "Generar Hojas de Operaciones".
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-1 overflow-hidden">
            {/* Navigator sidebar */}
            <div className="w-52 flex-shrink-0">
                <HoSheetNavigator
                    sheets={ho.data.sheets}
                    activeSheetId={ho.activeSheetId}
                    onSelect={ho.setActiveSheet}
                />
            </div>

            {/* Editor area */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {activeSheet ? (
                    <HoSheetEditor
                        sheet={activeSheet}
                        formNumber={ho.data.header.formNumber}
                        clientName={ho.data.header.client || ''}
                        onUpdateField={handleUpdateField}
                        onAddStep={handleAddStep}
                        onRemoveStep={handleRemoveStep}
                        onUpdateStep={handleUpdateStep}
                        onReorderSteps={handleReorderSteps}
                        onTogglePpe={handleTogglePpe}
                        onAddVisualAid={handleAddVisualAid}
                        onRemoveVisualAid={handleRemoveVisualAid}
                        onUpdateVisualAidCaption={handleUpdateVisualAidCaption}
                        onUpdateQualityCheckRegistro={handleUpdateQcRegistro}
                        onUpdateReactionPlan={handleUpdateReactionPlan}
                        onUpdateReactionContact={handleUpdateReactionContact}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                        Seleccione una operacion del panel izquierdo
                    </div>
                )}
            </div>
        </div>
    );
};

/** Wrapped with ModuleErrorBoundary for production resilience. */
const HojaOperacionesAppWithBoundary: React.FC<Props> = (props) => (
    <ModuleErrorBoundary moduleName="Hoja de Operaciones">
        <HojaOperacionesApp {...props} />
    </ModuleErrorBoundary>
);

export default HojaOperacionesAppWithBoundary;
