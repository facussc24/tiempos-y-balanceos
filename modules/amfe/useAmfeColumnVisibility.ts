/**
 * AMFE Column Visibility Hook
 *
 * Allows users to toggle column groups on/off by VDA step.
 * Persists visibility state in localStorage.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

const STORAGE_KEY = 'amfe-column-visibility';

export interface ColumnGroupVisibility {
    step2: boolean; // Structure: Op#, Item/Step, Work Element
    step3: boolean; // Functions (3 levels: Item, Paso, Elemento)
    step4: boolean; // Failure Analysis: FE, FM, FC
    step5: boolean; // Risk Analysis: S, PC, O, DC, D, AP, Car.Especiales
    step6: boolean; // Optimization: Actions, Responsible, Dates, New S/O/D/AP
    obs: boolean;   // Observations
}

const DEFAULT_VISIBILITY: ColumnGroupVisibility = {
    step2: true,
    step3: true,
    step4: true,
    step5: true,
    step6: true,
    obs: true,
};

export const COLUMN_GROUP_LABELS: Record<keyof ColumnGroupVisibility, string> = {
    step2: 'P2: Estructura',
    step3: 'P3: Funciones',
    step4: 'P4: Fallas',
    step5: 'P5: Riesgo',
    step6: 'P6: Optimización',
    obs: 'Observaciones',
};

export const COLUMN_GROUP_TOOLTIPS: Record<keyof ColumnGroupVisibility, string> = {
    step2: 'Paso 2: Operaciones y elementos de trabajo (6M)',
    step3: 'Paso 3: Funciones del Item, Paso y Elemento de Trabajo',
    step4: 'Paso 4: Efectos, Modos de Falla y Causas',
    step5: 'Paso 5: Severidad, Controles, O/D, AP y Características Especiales',
    step6: 'Paso 6: Acciones de mejora, responsables y fechas',
    obs: 'Notas y comentarios adicionales',
};

export const COLUMN_GROUP_COLORS: Record<keyof ColumnGroupVisibility, string> = {
    step2: 'bg-slate-100 text-slate-700',
    step3: 'bg-slate-50 text-slate-600',
    step4: 'bg-orange-50 text-orange-700',
    step5: 'bg-yellow-50 text-yellow-700',
    step6: 'bg-blue-50 text-blue-700',
    obs: 'bg-gray-100 text-gray-600',
};

/** Column counts per group (for colspan calculation). */
export const COLUMN_COUNTS: Record<keyof ColumnGroupVisibility, number> = {
    step2: 3,  // Op#, Item/Step, Work Element
    step3: 3,  // Func.Item, Func.Paso, Func.Elem.Trabajo
    step4: 3,  // FE, FM, FC
    step5: 7,  // S, PC, O, DC, D, AP, Car.Especiales
    step6: 11, // PrevAction, DetAction, Responsible, TargetDate, Status, ActionTaken, CompletionDate, S_new, O_new, D_new, AP_new
    obs: 1,    // Observations
};

export const useAmfeColumnVisibility = () => {
    const [visibility, setVisibility] = useState<ColumnGroupVisibility>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...DEFAULT_VISIBILITY, ...parsed };
            }
        } catch { /* ignore */ }
        return { ...DEFAULT_VISIBILITY };
    });

    // Persist to localStorage on changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
        } catch { /* ignore */ }
    }, [visibility]);

    const toggleGroup = useCallback((group: keyof ColumnGroupVisibility) => {
        setVisibility(prev => ({ ...prev, [group]: !prev[group] }));
    }, []);

    const showAll = useCallback(() => {
        setVisibility({ ...DEFAULT_VISIBILITY });
    }, []);

    const isDefault = useMemo(() => Object.entries(visibility).every(
        ([k, v]) => v === DEFAULT_VISIBILITY[k as keyof ColumnGroupVisibility]
    ), [visibility]);

    return {
        visibility,
        toggleGroup,
        showAll,
        isDefault,
    };
};
