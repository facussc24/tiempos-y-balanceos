/**
 * Control Plan State Management Hook
 *
 * Manages the in-memory state of a Control Plan document.
 * CRUD operations for items and header updates.
 */

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    ControlPlanDocument,
    ControlPlanItem,
    ControlPlanHeader,
    EMPTY_CP_DOCUMENT,
} from './controlPlanTypes';

export interface UseControlPlanResult {
    data: ControlPlanDocument;
    loadData: (doc: ControlPlanDocument) => void;
    resetData: () => void;
    updateHeader: (field: keyof ControlPlanHeader, value: string) => void;
    addItem: () => void;
    duplicateItem: (itemId: string) => void;
    removeItem: (itemId: string) => void;
    updateItem: (itemId: string, field: keyof ControlPlanItem, value: string) => void;
    moveItem: (itemId: string, direction: 'up' | 'down') => void;
    setItems: (items: ControlPlanItem[]) => void;
}

export function useControlPlan(): UseControlPlanResult {
    const [data, setData] = useState<ControlPlanDocument>({
        header: { ...EMPTY_CP_DOCUMENT.header, date: new Date().toISOString().split('T')[0] },
        items: [],
    });

    const loadData = useCallback((doc: ControlPlanDocument) => {
        setData(doc);
    }, []);

    const resetData = useCallback(() => {
        setData({
            header: { ...EMPTY_CP_DOCUMENT.header, date: new Date().toISOString().split('T')[0] },
            items: [],
        });
    }, []);

    const updateHeader = useCallback((field: keyof ControlPlanHeader, value: string) => {
        setData(prev => ({
            ...prev,
            header: { ...prev.header, [field]: value },
        }));
    }, []);

    /**
     * Add a new item. Pre-fills processStepNumber, processDescription, and
     * machineDeviceTool from the last item to speed up data entry within the
     * same process group. Characteristic and method fields start empty.
     */
    const addItem = useCallback(() => {
        setData(prev => {
            const last = prev.items.length > 0 ? prev.items[prev.items.length - 1] : null;
            const newItem: ControlPlanItem = {
                id: uuidv4(),
                processStepNumber: last?.processStepNumber ?? '',
                processDescription: last?.processDescription ?? '',
                machineDeviceTool: last?.machineDeviceTool ?? '',
                characteristicNumber: '',
                productCharacteristic: '',
                processCharacteristic: '',
                specialCharClass: '',
                specification: '',
                evaluationTechnique: '',
                sampleSize: '',
                sampleFrequency: '',
                controlMethod: '',
                reactionPlan: '',
                reactionPlanOwner: last?.reactionPlanOwner ?? '',
                controlProcedure: '',
            };
            return { ...prev, items: [...prev.items, newItem] };
        });
    }, []);

    /**
     * Duplicate an existing item. Copies process context (step number,
     * description, machine) but clears characteristic-specific fields
     * so the user can define a new characteristic for the same process.
     */
    const duplicateItem = useCallback((itemId: string) => {
        setData(prev => {
            const srcIdx = prev.items.findIndex(i => i.id === itemId);
            if (srcIdx === -1) return prev;
            const src = prev.items[srcIdx];
            const dup: ControlPlanItem = {
                ...src,
                id: uuidv4(),
                // Keep process context
                processStepNumber: src.processStepNumber,
                processDescription: src.processDescription,
                machineDeviceTool: src.machineDeviceTool,
                specialCharClass: src.specialCharClass,
                reactionPlanOwner: src.reactionPlanOwner,
                // Clear characteristic/method fields for new entry
                characteristicNumber: '',
                productCharacteristic: '',
                processCharacteristic: '',
                specification: '',
                evaluationTechnique: '',
                sampleSize: src.sampleSize,
                sampleFrequency: src.sampleFrequency,
                controlMethod: '',
                reactionPlan: src.reactionPlan,
                // Clear AMFE traceability (new item, not linked)
                amfeCauseIds: undefined,
                amfeFailureId: undefined,
                amfeFailureIds: undefined,
                autoFilledFields: undefined,
            };
            const items = [...prev.items];
            items.splice(srcIdx + 1, 0, dup);
            return { ...prev, items };
        });
    }, []);

    const removeItem = useCallback((itemId: string) => {
        setData(prev => ({
            ...prev,
            items: prev.items.filter(i => i.id !== itemId),
        }));
    }, []);

    const updateItem = useCallback((itemId: string, field: keyof ControlPlanItem, value: string) => {
        setData(prev => ({
            ...prev,
            items: prev.items.map(i => {
                if (i.id !== itemId) return i;
                // When user manually edits an auto-filled field, remove it from autoFilledFields
                const updated: ControlPlanItem = { ...i, [field]: value };
                if (i.autoFilledFields?.includes(field)) {
                    updated.autoFilledFields = i.autoFilledFields.filter(f => f !== field);
                }
                return updated;
            }),
        }));
    }, []);

    const moveItem = useCallback((itemId: string, direction: 'up' | 'down') => {
        setData(prev => {
            const items = [...prev.items];
            const index = items.findIndex(i => i.id === itemId);
            if (index === -1) return prev;
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= items.length) return prev;
            [items[index], items[newIndex]] = [items[newIndex], items[index]];
            return { ...prev, items };
        });
    }, []);

    const setItems = useCallback((items: ControlPlanItem[]) => {
        setData(prev => ({ ...prev, items }));
    }, []);

    return {
        data,
        loadData,
        resetData,
        updateHeader,
        addItem,
        duplicateItem,
        removeItem,
        updateItem,
        moveItem,
        setItems,
    };
}
