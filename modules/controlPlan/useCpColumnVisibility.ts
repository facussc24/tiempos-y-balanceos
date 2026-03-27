/**
 * Control Plan Column Visibility Hook
 *
 * Allows users to toggle column groups on/off by CP section.
 * Persists visibility state in localStorage.
 *
 * Port of useAmfeColumnVisibility.ts with CP-specific groups.
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'cp-column-visibility';

export interface CpColumnGroupVisibility {
    proceso: boolean;         // processStepNumber, processDescription, machineDeviceTool
    caracteristicas: boolean; // characteristicNumber, productCharacteristic, processCharacteristic, specialCharClass
    metodos: boolean;         // specification, evaluationTechnique, sampleSize, sampleFrequency, controlMethod, reactionPlan, reactionPlanOwner, controlProcedure
}

export const CP_DEFAULT_VISIBILITY: CpColumnGroupVisibility = {
    proceso: true,
    caracteristicas: true,
    metodos: true,
};

export const CP_COLUMN_GROUP_LABELS: Record<keyof CpColumnGroupVisibility, string> = {
    proceso: 'Proceso',
    caracteristicas: 'Características',
    metodos: 'Métodos',
};

export const CP_COLUMN_GROUP_COLORS: Record<keyof CpColumnGroupVisibility, string> = {
    proceso: 'bg-teal-100 text-teal-700',
    caracteristicas: 'bg-cyan-100 text-cyan-700',
    metodos: 'bg-sky-100 text-sky-700',
};

/** Map each CP_COLUMNS key to its group */
export const CP_COLUMN_TO_GROUP: Record<string, keyof CpColumnGroupVisibility> = {
    processStepNumber: 'proceso',
    processDescription: 'proceso',
    machineDeviceTool: 'proceso',
    characteristicNumber: 'caracteristicas',
    productCharacteristic: 'caracteristicas',
    processCharacteristic: 'caracteristicas',
    specialCharClass: 'caracteristicas',
    specification: 'metodos',
    evaluationTechnique: 'metodos',
    sampleSize: 'metodos',
    sampleFrequency: 'metodos',
    controlMethod: 'metodos',
    reactionPlan: 'metodos',
    reactionPlanOwner: 'metodos',
    controlProcedure: 'metodos',
};

/** Column counts per group (for colspan calculation). */
export const CP_COLUMN_COUNTS: Record<keyof CpColumnGroupVisibility, number> = {
    proceso: 3,
    caracteristicas: 4,
    metodos: 8,
};

export const useCpColumnVisibility = () => {
    const [visibility, setVisibility] = useState<CpColumnGroupVisibility>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...CP_DEFAULT_VISIBILITY, ...parsed };
            }
        } catch { /* ignore */ }
        return { ...CP_DEFAULT_VISIBILITY };
    });

    // Persist to localStorage on changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
        } catch { /* ignore */ }
    }, [visibility]);

    const toggleGroup = useCallback((group: keyof CpColumnGroupVisibility) => {
        setVisibility(prev => ({ ...prev, [group]: !prev[group] }));
    }, []);

    const showAll = useCallback(() => {
        setVisibility({ ...CP_DEFAULT_VISIBILITY });
    }, []);

    const isDefault = Object.entries(visibility).every(
        ([k, v]) => v === CP_DEFAULT_VISIBILITY[k as keyof CpColumnGroupVisibility]
    );

    return {
        visibility,
        toggleGroup,
        showAll,
        isDefault,
    };
};
