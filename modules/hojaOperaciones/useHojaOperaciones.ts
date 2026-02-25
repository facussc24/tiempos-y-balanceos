/**
 * Hoja de Operaciones State Management Hook
 *
 * Manages the in-memory state of an HO document.
 * CRUD operations for sheets, steps, PPE, visual aids, and quality checks.
 *
 * Pattern follows useControlPlan.ts but with additional nested-array ops
 * for steps, safetyElements, hazardWarnings, and visualAids.
 */

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    HoDocument,
    HoDocumentHeader,
    HojaOperacion,
    HoStep,
    HoVisualAid,
    PpeItem,
    HazardWarning,
    HoStatus,
    EMPTY_HO_DOCUMENT,
    createEmptyStep,
} from './hojaOperacionesTypes';

// ============================================================================
// PUBLIC INTERFACE
// ============================================================================

export interface UseHojaOperacionesResult {
    data: HoDocument;
    activeSheetId: string | null;

    // Document lifecycle
    loadData: (doc: HoDocument) => void;
    resetData: () => void;

    // Navigation
    setActiveSheet: (sheetId: string | null) => void;

    // Header
    updateHeader: (field: keyof HoDocumentHeader, value: string) => void;

    // Sheet-level fields
    updateSheetField: <K extends keyof HojaOperacion>(
        sheetId: string,
        field: K,
        value: HojaOperacion[K],
    ) => void;

    // Steps (Section C)
    addStep: (sheetId: string) => void;
    removeStep: (sheetId: string, stepId: string) => void;
    updateStep: (sheetId: string, stepId: string, field: keyof HoStep, value: any) => void;
    reorderSteps: (sheetId: string, fromIndex: number, toIndex: number) => void;

    // PPE & Hazards (Section B)
    togglePpe: (sheetId: string, item: PpeItem) => void;
    toggleHazard: (sheetId: string, hazard: HazardWarning) => void;

    // Visual Aids (Section F)
    addVisualAid: (sheetId: string, imageData: string, caption: string) => void;
    removeVisualAid: (sheetId: string, aidId: string) => void;
    updateVisualAid: (sheetId: string, aidId: string, field: keyof HoVisualAid, value: any) => void;

    // Quality Checks (Section D — only 'registro' is editable)
    updateQualityCheckRegistro: (sheetId: string, checkId: string, value: string) => void;

    // Reaction Plan (Section E)
    updateReactionPlan: (sheetId: string, text: string) => void;
    updateReactionContact: (sheetId: string, contact: string) => void;

    // Status
    updateStatus: (sheetId: string, status: HoStatus) => void;
}

// ============================================================================
// HELPER — update a single sheet inside the document
// ============================================================================

function mapSheet(
    data: HoDocument,
    sheetId: string,
    fn: (sheet: HojaOperacion) => HojaOperacion,
): HoDocument {
    return {
        ...data,
        sheets: data.sheets.map(s => (s.id === sheetId ? fn(s) : s)),
    };
}

// ============================================================================
// HOOK
// ============================================================================

export function useHojaOperaciones(): UseHojaOperacionesResult {
    const [data, setData] = useState<HoDocument>({
        header: { ...EMPTY_HO_DOCUMENT.header },
        sheets: [],
    });
    const [activeSheetId, setActiveSheetId] = useState<string | null>(null);

    // --- Document lifecycle ---

    const loadData = useCallback((doc: HoDocument) => {
        setData(doc);
        setActiveSheetId(doc.sheets.length > 0 ? doc.sheets[0].id : null);
    }, []);

    const resetData = useCallback(() => {
        setData({ header: { ...EMPTY_HO_DOCUMENT.header }, sheets: [] });
        setActiveSheetId(null);
    }, []);

    const setActiveSheet = useCallback((sheetId: string | null) => {
        setActiveSheetId(sheetId);
    }, []);

    // --- Header ---

    const updateHeader = useCallback((field: keyof HoDocumentHeader, value: string) => {
        setData(prev => ({
            ...prev,
            header: { ...prev.header, [field]: value },
        }));
    }, []);

    // --- Sheet-level fields ---

    const updateSheetField = useCallback(<K extends keyof HojaOperacion>(
        sheetId: string,
        field: K,
        value: HojaOperacion[K],
    ) => {
        setData(prev => mapSheet(prev, sheetId, sheet => ({ ...sheet, [field]: value })));
    }, []);

    // --- Steps ---

    const addStep = useCallback((sheetId: string) => {
        setData(prev => mapSheet(prev, sheetId, sheet => {
            const nextNumber = sheet.steps.length > 0
                ? Math.max(...sheet.steps.map(s => s.stepNumber)) + 1
                : 1;
            return { ...sheet, steps: [...sheet.steps, createEmptyStep(nextNumber)] };
        }));
    }, []);

    const removeStep = useCallback((sheetId: string, stepId: string) => {
        setData(prev => mapSheet(prev, sheetId, sheet => ({
            ...sheet,
            steps: sheet.steps.filter(s => s.id !== stepId),
        })));
    }, []);

    const updateStep = useCallback((sheetId: string, stepId: string, field: keyof HoStep, value: any) => {
        setData(prev => mapSheet(prev, sheetId, sheet => ({
            ...sheet,
            steps: sheet.steps.map(s => (s.id === stepId ? { ...s, [field]: value } : s)),
        })));
    }, []);

    const reorderSteps = useCallback((sheetId: string, fromIndex: number, toIndex: number) => {
        setData(prev => mapSheet(prev, sheetId, sheet => {
            const steps = [...sheet.steps];
            if (fromIndex < 0 || fromIndex >= steps.length) return sheet;
            if (toIndex < 0 || toIndex >= steps.length) return sheet;
            const [moved] = steps.splice(fromIndex, 1);
            steps.splice(toIndex, 0, moved);
            // Renumber
            const renumbered = steps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
            return { ...sheet, steps: renumbered };
        }));
    }, []);

    // --- PPE & Hazards ---

    const togglePpe = useCallback((sheetId: string, item: PpeItem) => {
        setData(prev => mapSheet(prev, sheetId, sheet => {
            const has = sheet.safetyElements.includes(item);
            return {
                ...sheet,
                safetyElements: has
                    ? sheet.safetyElements.filter(e => e !== item)
                    : [...sheet.safetyElements, item],
            };
        }));
    }, []);

    const toggleHazard = useCallback((sheetId: string, hazard: HazardWarning) => {
        setData(prev => mapSheet(prev, sheetId, sheet => {
            const has = sheet.hazardWarnings.includes(hazard);
            return {
                ...sheet,
                hazardWarnings: has
                    ? sheet.hazardWarnings.filter(h => h !== hazard)
                    : [...sheet.hazardWarnings, hazard],
            };
        }));
    }, []);

    // --- Visual Aids ---

    const addVisualAid = useCallback((sheetId: string, imageData: string, caption: string) => {
        setData(prev => mapSheet(prev, sheetId, sheet => {
            const maxOrder = sheet.visualAids.length > 0
                ? Math.max(...sheet.visualAids.map(v => v.order))
                : -1;
            const newAid: HoVisualAid = {
                id: uuidv4(),
                imageData,
                caption,
                order: maxOrder + 1,
            };
            return { ...sheet, visualAids: [...sheet.visualAids, newAid] };
        }));
    }, []);

    const removeVisualAid = useCallback((sheetId: string, aidId: string) => {
        setData(prev => mapSheet(prev, sheetId, sheet => ({
            ...sheet,
            visualAids: sheet.visualAids.filter(v => v.id !== aidId),
        })));
    }, []);

    const updateVisualAid = useCallback((sheetId: string, aidId: string, field: keyof HoVisualAid, value: any) => {
        setData(prev => mapSheet(prev, sheetId, sheet => ({
            ...sheet,
            visualAids: sheet.visualAids.map(v => (v.id === aidId ? { ...v, [field]: value } : v)),
        })));
    }, []);

    // --- Quality Checks ---

    const updateQualityCheckRegistro = useCallback((sheetId: string, checkId: string, value: string) => {
        setData(prev => mapSheet(prev, sheetId, sheet => ({
            ...sheet,
            qualityChecks: sheet.qualityChecks.map(qc =>
                qc.id === checkId ? { ...qc, registro: value } : qc,
            ),
        })));
    }, []);

    // --- Reaction Plan ---

    const updateReactionPlan = useCallback((sheetId: string, text: string) => {
        setData(prev => mapSheet(prev, sheetId, sheet => ({
            ...sheet,
            reactionPlanText: text,
        })));
    }, []);

    const updateReactionContact = useCallback((sheetId: string, contact: string) => {
        setData(prev => mapSheet(prev, sheetId, sheet => ({
            ...sheet,
            reactionContact: contact,
        })));
    }, []);

    // --- Status ---

    const updateStatus = useCallback((sheetId: string, status: HoStatus) => {
        setData(prev => mapSheet(prev, sheetId, sheet => ({
            ...sheet,
            status,
        })));
    }, []);

    return {
        data,
        activeSheetId,
        loadData,
        resetData,
        setActiveSheet,
        updateHeader,
        updateSheetField,
        addStep,
        removeStep,
        updateStep,
        reorderSteps,
        togglePpe,
        toggleHazard,
        addVisualAid,
        removeVisualAid,
        updateVisualAid,
        updateQualityCheckRegistro,
        updateReactionPlan,
        updateReactionContact,
        updateStatus,
    };
}
