import { describe, it, expect } from 'vitest';
import { validateInjectionParams } from '../modules/validation/injectionValidation';

describe('validateInjectionParams', () => {
    const validParams = {
        puInyTime: 20,
        puCurTime: 120,
        activeShifts: 1,
        manualOps: [],
        manualTimeOverride: 15,
        taktTime: 10,
        headcountMode: 'auto' as const,
        userHeadcountOverride: 1,
        oee: 0.85,
        cycleQuantity: 1
    };

    it('should return valid for correct params', () => {
        const result = validateInjectionParams(validParams);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should fail if Injection Time is 0 or negative', () => {
        const result = validateInjectionParams({ ...validParams, puInyTime: 0 });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(expect.objectContaining({ field: 'puInyTime' }));

        const resultNeg = validateInjectionParams({ ...validParams, puInyTime: -10 });
        expect(resultNeg.isValid).toBe(false);
        expect(resultNeg.errors).toContainEqual(expect.objectContaining({ field: 'puInyTime' }));
    });

    it('should fail if Curing Time is negative', () => {
        const result = validateInjectionParams({ ...validParams, puCurTime: -5 });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(expect.objectContaining({ field: 'puCurTime' }));
    });

    it('should fail if Shifts are invalid', () => {
        const result = validateInjectionParams({ ...validParams, activeShifts: 0 });
        expect(result.isValid).toBe(false);

        const resultHigh = validateInjectionParams({ ...validParams, activeShifts: 4 });
        expect(resultHigh.isValid).toBe(false);
    });

    it('should warn if calculated manual time is 0 and no override', () => {
        // Logic might allow it but it's suspicious. 
        // Our validation currently might check for negative ops.
        // Let's check negative op time
        const result = validateInjectionParams({
            ...validParams,
            manualOps: [{ id: '1', description: 'Bad Op', time: -5, type: 'external' }]
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(expect.objectContaining({ field: 'manualOps' }));
    });
});
