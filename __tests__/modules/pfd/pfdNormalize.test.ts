import { normalizePfdStep } from '../../../modules/pfd/pfdNormalize';

describe('pfdNormalize — normalizePfdStep', () => {
    it('should add all missing fields with defaults for minimal input', () => {
        const raw = { id: 'min-1' } as Record<string, unknown> & { id: string };
        const step = normalizePfdStep(raw);

        expect(step.id).toBe('min-1');
        expect(step.stepType).toBe('operation');
        expect(step.description).toBe('');
        expect(step.machineDeviceTool).toBe('');
        expect(step.productCharacteristic).toBe('');
        expect(step.productSpecialChar).toBe('none');
        expect(step.processCharacteristic).toBe('');
        expect(step.processSpecialChar).toBe('none');
        expect(step.reference).toBe('');
        expect(step.department).toBe('');
        expect(step.notes).toBe('');
        expect(step.isRework).toBe(false);
        expect(step.isExternalProcess).toBe(false);
        expect(step.reworkReturnStep).toBe('');
        expect(step.rejectDisposition).toBe('none');
        expect(step.scrapDescription).toBe('');
        expect(step.branchId).toBe('');
        expect(step.branchLabel).toBe('');
    });

    it('should derive rejectDisposition=rework from isRework=true', () => {
        const raw = { id: 'rw-1', isRework: true } as Record<string, unknown> & { id: string };
        const step = normalizePfdStep(raw);
        expect(step.rejectDisposition).toBe('rework');
    });

    it('should preserve existing rejectDisposition=scrap even with isRework=false', () => {
        const raw = { id: 'sc-1', rejectDisposition: 'scrap', isRework: false } as Record<string, unknown> & { id: string };
        const step = normalizePfdStep(raw);
        expect(step.rejectDisposition).toBe('scrap');
    });

    it('should fill branchId as empty string when undefined', () => {
        const raw = { id: 'br-1' } as Record<string, unknown> & { id: string };
        const step = normalizePfdStep(raw);
        expect(step.branchId).toBe('');
    });

    it('should fill branchLabel as empty string when undefined', () => {
        const raw = { id: 'br-2' } as Record<string, unknown> & { id: string };
        const step = normalizePfdStep(raw);
        expect(step.branchLabel).toBe('');
    });

    it('should preserve existing branchId and branchLabel', () => {
        const raw = { id: 'br-3', branchId: 'B', branchLabel: 'Línea ZAC' } as Record<string, unknown> & { id: string };
        const step = normalizePfdStep(raw);
        expect(step.branchId).toBe('B');
        expect(step.branchLabel).toBe('Línea ZAC');
    });

    it('should fill scrapDescription as empty string when null', () => {
        const raw = { id: 'sd-1', scrapDescription: null } as Record<string, unknown> & { id: string };
        const step = normalizePfdStep(raw);
        expect(step.scrapDescription).toBe('');
    });

    it('should preserve existing description and stepNumber', () => {
        const raw = {
            id: 'pres-1',
            stepNumber: 'OP 30',
            description: 'Torneado CNC',
            stepType: 'operation',
        } as Record<string, unknown> & { id: string };
        const step = normalizePfdStep(raw);
        expect(step.stepNumber).toBe('OP 30');
        expect(step.description).toBe('Torneado CNC');
        expect(step.stepType).toBe('operation');
    });

    it('should return a valid PfdStep type', () => {
        const raw = { id: 'type-1' } as Record<string, unknown> & { id: string };
        const step = normalizePfdStep(raw);
        // Verify it has all required PfdStep keys
        const requiredKeys = [
            'id', 'stepNumber', 'stepType', 'description', 'machineDeviceTool',
            'productCharacteristic', 'productSpecialChar', 'processCharacteristic',
            'processSpecialChar', 'reference', 'department', 'notes', 'isRework',
            'isExternalProcess', 'reworkReturnStep', 'rejectDisposition',
            'scrapDescription', 'branchId', 'branchLabel',
        ];
        for (const key of requiredKeys) {
            expect(step).toHaveProperty(key);
        }
    });
});
