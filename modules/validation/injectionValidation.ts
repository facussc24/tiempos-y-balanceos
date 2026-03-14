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
    // FIX: Guard against NaN bypassing comparison operators
    if (!Number.isFinite(puInyTime) || puInyTime <= 0) {
        errors.push({
            field: 'puInyTime',
            message: 'El tiempo de inyección debe ser un número válido mayor a 0.',
            severity: 'error'
        });
    }

    if (!Number.isFinite(puCurTime) || puCurTime < 0) {
        errors.push({
            field: 'puCurTime',
            message: 'El tiempo de curado debe ser un número válido no negativo.',
            severity: 'error'
        });
    }

    // 2. Production Config
    // FIX: Guard against NaN bypassing range check
    if (!Number.isFinite(activeShifts) || activeShifts < 1 || activeShifts > 3) {
        errors.push({
            // activeShifts is a valid key of InjectionSimulationParams
            field: 'activeShifts',
            message: 'Los turnos activos deben ser 1, 2 o 3.',
            severity: 'error'
        });
    }

    // 3. Manual Ops Integrity
    // FIX: Guard against NaN in operation times
    const hasNegativeTime = manualOps.some(op => !Number.isFinite(op.time) || op.time < 0);
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
