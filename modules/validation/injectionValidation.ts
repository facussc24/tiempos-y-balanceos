import { InjectionSimulationParams } from "../../types";

export interface ValidationError {
    field: keyof InjectionSimulationParams | 'general';
    message: string;
    severity: 'error' | 'warning';
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

export const validateInjectionParams = (params: InjectionSimulationParams): ValidationResult => {
    const errors: ValidationError[] = [];
    const { puInyTime, puCurTime, activeShifts, manualOps } = params;

    // 1. Critical Machine Params
    if (puInyTime <= 0) {
        errors.push({
            field: 'puInyTime',
            message: 'El tiempo de inyección debe ser mayor a 0.',
            severity: 'error'
        });
    }

    if (puCurTime < 0) { // Curing could be 0 theoretically (e.g. cooling in mold during injection?) but unlikely
        errors.push({
            field: 'puCurTime',
            message: 'El tiempo de curado no puede ser negativo.',
            severity: 'error'
        });
    }

    // 2. Production Config
    if (activeShifts < 1 || activeShifts > 3) {
        errors.push({
            // activeShifts is a valid key of InjectionSimulationParams
            field: 'activeShifts',
            message: 'Los turnos activos deben ser 1, 2 o 3.',
            severity: 'error'
        });
    }

    // 3. Manual Ops Integrity
    const hasNegativeTime = manualOps.some(op => op.time < 0);
    if (hasNegativeTime) {
        errors.push({
            field: 'manualOps',
            message: 'Existen operaciones manuales con tiempo negativo.',
            severity: 'error'
        });
    }

    const hasEmptyDescription = manualOps.some(op => !op.description.trim());
    if (hasEmptyDescription) {
        errors.push({
            field: 'manualOps',
            message: 'Todas las operaciones deben tener una descripción.',
            severity: 'warning'
        });
    }

    return {
        isValid: errors.every(e => e.severity !== 'error'),
        errors
    };
};
