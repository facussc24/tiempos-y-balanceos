import { createBasicProcessTemplate, createManufacturingProcessTemplate } from '../../../modules/pfd/pfdTemplates';

describe('pfdTemplates', () => {
    describe('createBasicProcessTemplate', () => {
        it('should return 8 steps (C5-N2: with transport)', () => {
            const steps = createBasicProcessTemplate();
            expect(steps).toHaveLength(8);
        });

        it('should start with OP 10 reception (storage)', () => {
            const steps = createBasicProcessTemplate();
            expect(steps[0].stepNumber).toBe('OP 10');
            expect(steps[0].stepType).toBe('storage');
            expect(steps[0].description).toBe('Recepción de materia prima');
        });

        it('should have OP 15 as transport to production line', () => {
            const steps = createBasicProcessTemplate();
            expect(steps[1].stepNumber).toBe('OP 15');
            expect(steps[1].stepType).toBe('transport');
        });

        it('should have OP 20 as empty operation', () => {
            const steps = createBasicProcessTemplate();
            const op20 = steps.find(s => s.stepNumber === 'OP 20');
            expect(op20).toBeDefined();
            expect(op20!.stepType).toBe('operation');
            expect(op20!.description).toBe('');
        });

        it('should have OP 30 as inspection', () => {
            const steps = createBasicProcessTemplate();
            const op30 = steps.find(s => s.stepNumber === 'OP 30');
            expect(op30).toBeDefined();
            expect(op30!.stepType).toBe('inspection');
            expect(op30!.description).toBe('Inspección final');
        });

        it('should have OP 40 as packaging operation', () => {
            const steps = createBasicProcessTemplate();
            const op40 = steps.find(s => s.stepNumber === 'OP 40');
            expect(op40).toBeDefined();
            expect(op40!.stepType).toBe('operation');
            expect(op40!.description).toBe('Embalaje');
        });

        it('should end with OP 50 shipping (storage)', () => {
            const steps = createBasicProcessTemplate();
            const last = steps[steps.length - 1];
            expect(last.stepNumber).toBe('OP 50');
            expect(last.stepType).toBe('storage');
            expect(last.description).toContain('envío');
        });

        it('should include transport steps between operations (C5-N2)', () => {
            const steps = createBasicProcessTemplate();
            const transportSteps = steps.filter(s => s.stepType === 'transport');
            expect(transportSteps.length).toBeGreaterThanOrEqual(2);
        });

        it('should give each step a unique id', () => {
            const steps = createBasicProcessTemplate();
            const ids = steps.map(s => s.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(8);
        });

        it('should have default rejectDisposition=none for all steps', () => {
            const steps = createBasicProcessTemplate();
            for (const step of steps) {
                expect(step.rejectDisposition).toBe('none');
            }
        });

        it('should create fresh instances on each call', () => {
            const a = createBasicProcessTemplate();
            const b = createBasicProcessTemplate();
            expect(a[0].id).not.toBe(b[0].id);
        });
    });

    describe('createManufacturingProcessTemplate (C4-U3)', () => {
        it('should return 11 steps (C5-N2: with transport)', () => {
            const steps = createManufacturingProcessTemplate();
            expect(steps).toHaveLength(11);
        });

        it('should start with OP 10 reception (storage)', () => {
            const steps = createManufacturingProcessTemplate();
            expect(steps[0].stepNumber).toBe('OP 10');
            expect(steps[0].stepType).toBe('storage');
            expect(steps[0].description).toContain('Recepción');
        });

        it('should have OP 15 as transport to production line', () => {
            const steps = createManufacturingProcessTemplate();
            const op15 = steps.find(s => s.stepNumber === 'OP 15');
            expect(op15).toBeDefined();
            expect(op15!.stepType).toBe('transport');
        });

        it('should have OP 20 as cutting/preparation (operation)', () => {
            const steps = createManufacturingProcessTemplate();
            const op20 = steps.find(s => s.stepNumber === 'OP 20');
            expect(op20).toBeDefined();
            expect(op20!.stepType).toBe('operation');
            expect(op20!.description).toContain('Corte');
        });

        it('should have OP 30 as main manufacturing (operation)', () => {
            const steps = createManufacturingProcessTemplate();
            const op30 = steps.find(s => s.stepNumber === 'OP 30');
            expect(op30).toBeDefined();
            expect(op30!.stepType).toBe('operation');
        });

        it('should have OP 40 as in-process inspection (combined)', () => {
            const steps = createManufacturingProcessTemplate();
            const op40 = steps.find(s => s.stepNumber === 'OP 40');
            expect(op40).toBeDefined();
            expect(op40!.stepType).toBe('combined');
            expect(op40!.description).toContain('Inspección en proceso');
        });

        it('should have OP 60 as final inspection', () => {
            const steps = createManufacturingProcessTemplate();
            const op60 = steps.find(s => s.stepNumber === 'OP 60');
            expect(op60).toBeDefined();
            expect(op60!.stepType).toBe('inspection');
            expect(op60!.description).toContain('Inspección final');
        });

        it('should end with OP 80 shipping (storage)', () => {
            const steps = createManufacturingProcessTemplate();
            const last = steps[steps.length - 1];
            expect(last.stepNumber).toBe('OP 80');
            expect(last.stepType).toBe('storage');
            expect(last.description).toContain('envío');
        });

        it('should include transport steps between key transitions (C5-N2)', () => {
            const steps = createManufacturingProcessTemplate();
            const transportSteps = steps.filter(s => s.stepType === 'transport');
            expect(transportSteps.length).toBeGreaterThanOrEqual(3);
        });

        it('should give each step a unique id', () => {
            const steps = createManufacturingProcessTemplate();
            const ids = new Set(steps.map(s => s.id));
            expect(ids.size).toBe(11);
        });

        it('should have default rejectDisposition=none', () => {
            const steps = createManufacturingProcessTemplate();
            for (const step of steps) {
                expect(step.rejectDisposition).toBe('none');
            }
        });

        it('should create fresh instances on each call', () => {
            const a = createManufacturingProcessTemplate();
            const b = createManufacturingProcessTemplate();
            expect(a[0].id).not.toBe(b[0].id);
        });
    });
});
