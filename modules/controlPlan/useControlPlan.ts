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
    removeItem: (itemId: string) => void;
    updateItem: (itemId: string, field: keyof ControlPlanItem, value: string) => void;
    moveItem: (itemId: string, direction: 'up' | 'down') => void;
    setItems: (items: ControlPlanItem[]) => void;
}

export function useControlPlan(): UseControlPlanResult {
    const [data, setData] = useState<ControlPlanDocument>({
        header: { ...EMPTY_CP_DOCUMENT.header },
        items: [],
    });

    const loadData = useCallback((doc: ControlPlanDocument) => {
        setData(doc);
    }, []);

    const resetData = useCallback(() => {
        setData({
            header: { ...EMPTY_CP_DOCUMENT.header },
            items: [],
        });
    }, []);

    const updateHeader = useCallback((field: keyof ControlPlanHeader, value: string) => {
        setData(prev => ({
            ...prev,
            header: { ...prev.header, [field]: value },
        }));
    }, []);

    const addItem = useCallback(() => {
        const newItem: ControlPlanItem = {
            id: uuidv4(),
            processStepNumber: '',
            processDescription: '',
            machineDeviceTool: '',
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
            reactionPlanOwner: '',
        };
        setData(prev => ({ ...prev, items: [...prev.items, newItem] }));
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
        removeItem,
        updateItem,
        moveItem,
        setItems,
    };
}
