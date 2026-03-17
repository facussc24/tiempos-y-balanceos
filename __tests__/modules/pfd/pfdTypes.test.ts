import { createEmptyStep, createEmptyPfdDocument, PFD_COLUMNS, PFD_STEP_TYPES, EMPTY_PFD_HEADER, normalizePfdStep, getIntermediateStepNumber, parseStepNumber, getNextStepNumber, getBranchColor, BRANCH_COLORS, analyzeFlowTransition, collectForkBranches, renumberSteps } from '../../../modules/pfd/pfdTypes';

describe('pfdTypes', () => {
    describe('createEmptyStep', () => {
        it('should create a step with a UUID id', () => {
            const step = createEmptyStep();
            expect(step.id).toBeTruthy();
            expect(typeof step.id).toBe('string');
        });

        it('should default to operation type', () => {
            const step = createEmptyStep();
            expect(step.stepType).toBe('operation');
        });

        it('should have empty strings for text fields', () => {
            const step = createEmptyStep();
            expect(step.description).toBe('');
            expect(step.machineDeviceTool).toBe('');
            expect(step.reference).toBe('');
        });

        it('should default special chars to none', () => {
            const step = createEmptyStep();
            expect(step.productSpecialChar).toBe('none');
            expect(step.processSpecialChar).toBe('none');
        });

        it('should default booleans to false', () => {
            const step = createEmptyStep();
            expect(step.isRework).toBe(false);
            expect(step.isExternalProcess).toBe(false);
        });

        it('should create unique IDs', () => {
            const s1 = createEmptyStep();
            const s2 = createEmptyStep();
            expect(s1.id).not.toBe(s2.id);
        });
    });

    describe('createEmptyPfdDocument', () => {
        it('should create a document with a UUID id', () => {
            const doc = createEmptyPfdDocument();
            expect(doc.id).toBeTruthy();
        });

        it('should have an empty header with defaults', () => {
            const doc = createEmptyPfdDocument();
            expect(doc.header.companyName).toBe('Barack Mercosul');
            expect(doc.header.plantLocation).toBe('Hurlingham, Buenos Aires');
            expect(doc.header.revisionLevel).toBe('A');
        });

        it('should have one initial reception step (AIAG)', () => {
            const doc = createEmptyPfdDocument();
            expect(doc.steps).toHaveLength(1);
            expect(doc.steps[0].stepType).toBe('storage');
            expect(doc.steps[0].description).toBe('Recepción de materia prima');
            expect(doc.steps[0].stepNumber).toBe('OP 10');
        });

        it('should have timestamps', () => {
            const doc = createEmptyPfdDocument();
            expect(doc.createdAt).toBeTruthy();
            expect(doc.updatedAt).toBeTruthy();
        });
    });

    describe('PFD_STEP_TYPES', () => {
        it('should have 7 step types', () => {
            expect(PFD_STEP_TYPES).toHaveLength(7);
        });

        it('should include all expected types', () => {
            const values = PFD_STEP_TYPES.map(t => t.value);
            expect(values).toContain('operation');
            expect(values).toContain('transport');
            expect(values).toContain('inspection');
            expect(values).toContain('storage');
            expect(values).toContain('delay');
            expect(values).toContain('decision');
            expect(values).toContain('combined');
        });

        it('should have label and color for each type', () => {
            for (const t of PFD_STEP_TYPES) {
                expect(t.label).toBeTruthy();
                expect(t.color).toBeTruthy();
            }
        });
    });

    describe('PFD_COLUMNS', () => {
        it('should have 13 columns (machineDeviceTool hidden from UI)', () => {
            expect(PFD_COLUMNS).toHaveLength(13);
        });

        it('should have stepNumber, stepType, and description as required', () => {
            const required = PFD_COLUMNS.filter(c => c.required);
            const keys = required.map(c => c.key);
            expect(keys).toContain('stepNumber');
            expect(keys).toContain('stepType');
            expect(keys).toContain('description');
        });

        it('should have width for each column', () => {
            for (const col of PFD_COLUMNS) {
                expect(col.width).toMatch(/^\d+px$/);
            }
        });
    });

    describe('createEmptyStep — C3-N1 disposition fields', () => {
        it('should default rejectDisposition to none', () => {
            const step = createEmptyStep();
            expect(step.rejectDisposition).toBe('none');
        });

        it('should default scrapDescription to empty string', () => {
            const step = createEmptyStep();
            expect(step.scrapDescription).toBe('');
        });
    });

    describe('normalizePfdStep', () => {
        it('should fill missing rejectDisposition from isRework=true', () => {
            const raw = { id: 'test-1', isRework: true } as Record<string, unknown> & { id: string };
            const step = normalizePfdStep(raw);
            expect(step.rejectDisposition).toBe('rework');
        });

        it('should fill missing rejectDisposition from isRework=false', () => {
            const raw = { id: 'test-2', isRework: false } as Record<string, unknown> & { id: string };
            const step = normalizePfdStep(raw);
            expect(step.rejectDisposition).toBe('none');
        });

        it('should preserve existing rejectDisposition', () => {
            const raw = { id: 'test-3', rejectDisposition: 'scrap', isRework: false } as Record<string, unknown> & { id: string };
            const step = normalizePfdStep(raw);
            expect(step.rejectDisposition).toBe('scrap');
        });

        it('should fill scrapDescription as empty string if missing', () => {
            const raw = { id: 'test-4' } as Record<string, unknown> & { id: string };
            const step = normalizePfdStep(raw);
            expect(step.scrapDescription).toBe('');
        });

        it('should preserve existing scrapDescription', () => {
            const raw = { id: 'test-5', scrapDescription: 'Dimensional', rejectDisposition: 'scrap' } as Record<string, unknown> & { id: string };
            const step = normalizePfdStep(raw);
            expect(step.scrapDescription).toBe('Dimensional');
        });

        it('should fill all default fields for minimal raw input', () => {
            const raw = { id: 'test-6' } as Record<string, unknown> & { id: string };
            const step = normalizePfdStep(raw);
            expect(step.stepType).toBe('operation');
            expect(step.description).toBe('');
            expect(step.isExternalProcess).toBe(false);
        });
    });

    describe('PFD_COLUMNS — C3-N1 disposition column', () => {
        it('should have rejectDisposition column instead of isRework', () => {
            const keys = PFD_COLUMNS.map(c => c.key);
            expect(keys).toContain('rejectDisposition');
            expect(keys).not.toContain('isRework');
        });

        it('should have disposition type for rejectDisposition column', () => {
            const col = PFD_COLUMNS.find(c => c.key === 'rejectDisposition');
            expect(col?.type).toBe('disposition');
        });
    });

    describe('getIntermediateStepNumber (C6-B1)', () => {
        it('should calculate midpoint between two steps', () => {
            const steps = [
                { ...createEmptyStep('OP 20'), description: 'A' },
                { ...createEmptyStep('OP 30'), description: 'B' },
            ];
            // Insert after index 0 (OP 20), next is OP 30 → midpoint = OP 25
            expect(getIntermediateStepNumber(steps, 0)).toBe('OP 25');
        });

        it('should use +5 when inserting after the last step', () => {
            const steps = [
                { ...createEmptyStep('OP 20'), description: 'A' },
            ];
            expect(getIntermediateStepNumber(steps, 0)).toBe('OP 25');
        });

        it('should fallback to getNextStepNumber when no room between consecutive numbers', () => {
            const steps = [
                { ...createEmptyStep('OP 20'), description: 'A' },
                { ...createEmptyStep('OP 21'), description: 'B' },
            ];
            // No room between 20 and 21 → tries OP 25, which is available
            const result = getIntermediateStepNumber(steps, 0);
            expect(result).toBe('OP 25');
        });

        it('should fallback when +5 is already taken', () => {
            const steps = [
                { ...createEmptyStep('OP 20'), description: 'A' },
                { ...createEmptyStep('OP 21'), description: 'B' },
                { ...createEmptyStep('OP 25'), description: 'C' },
            ];
            // Between 20 and 21: no room. +5 = 25 but exists. Falls back to getNextStepNumber.
            const result = getIntermediateStepNumber(steps, 0);
            expect(parseStepNumber(result)).toBeGreaterThan(25);
        });

        it('should preserve prefix from current step', () => {
            const steps = [
                { ...createEmptyStep('INSP 100'), description: 'A' },
                { ...createEmptyStep('INSP 200'), description: 'B' },
            ];
            expect(getIntermediateStepNumber(steps, 0)).toBe('INSP 150');
        });

        it('should handle negative index by falling back', () => {
            const steps = [{ ...createEmptyStep('OP 10'), description: 'A' }];
            const result = getIntermediateStepNumber(steps, -1);
            // Fallback to getNextStepNumber
            expect(result).toBe(getNextStepNumber(steps));
        });

        it('should handle out-of-bounds index', () => {
            const steps = [{ ...createEmptyStep('OP 10'), description: 'A' }];
            const result = getIntermediateStepNumber(steps, 5);
            expect(result).toBe(getNextStepNumber(steps));
        });
    });

    describe('createEmptyStep — C9-N1 branch fields', () => {
        it('should default branchId to empty string', () => {
            const step = createEmptyStep();
            expect(step.branchId).toBe('');
        });

        it('should default branchLabel to empty string', () => {
            const step = createEmptyStep();
            expect(step.branchLabel).toBe('');
        });
    });

    describe('normalizePfdStep — C9-N1 branch backward compat', () => {
        it('should fill missing branchId as empty string', () => {
            const raw = { id: 'test-b1' } as Record<string, unknown> & { id: string };
            const step = normalizePfdStep(raw);
            expect(step.branchId).toBe('');
        });

        it('should fill missing branchLabel as empty string', () => {
            const raw = { id: 'test-b2' } as Record<string, unknown> & { id: string };
            const step = normalizePfdStep(raw);
            expect(step.branchLabel).toBe('');
        });

        it('should preserve existing branchId', () => {
            const raw = { id: 'test-b3', branchId: 'A', branchLabel: 'Mecanizado' } as Record<string, unknown> & { id: string };
            const step = normalizePfdStep(raw);
            expect(step.branchId).toBe('A');
            expect(step.branchLabel).toBe('Mecanizado');
        });
    });

    describe('getBranchColor (C9-N1)', () => {
        it('should return color for branch A', () => {
            const color = getBranchColor('A');
            expect(color).toBe(BRANCH_COLORS.A);
        });

        it('should return color for lowercase branch id', () => {
            const color = getBranchColor('b');
            expect(color).toBe(BRANCH_COLORS.B);
        });

        it('should return default gray for empty branchId', () => {
            const color = getBranchColor('');
            expect(color.text).toBe('text-gray-500');
        });

        it('should fallback to A colors for unknown branch', () => {
            const color = getBranchColor('Z');
            expect(color).toBe(BRANCH_COLORS.A);
        });
    });

    describe('analyzeFlowTransition (C9-N1)', () => {
        it('should detect fork (main → branch)', () => {
            const current = { ...createEmptyStep(), branchId: '' };
            const next = { ...createEmptyStep(), branchId: 'A' };
            const result = analyzeFlowTransition(current, next);
            expect(result.type).toBe('fork');
        });

        it('should detect join (branch → main)', () => {
            const current = { ...createEmptyStep(), branchId: 'B' };
            const next = { ...createEmptyStep(), branchId: '' };
            const result = analyzeFlowTransition(current, next);
            expect(result.type).toBe('join');
        });

        it('should detect normal flow (main → main)', () => {
            const current = { ...createEmptyStep(), branchId: '' };
            const next = { ...createEmptyStep(), branchId: '' };
            const result = analyzeFlowTransition(current, next);
            expect(result.type).toBe('normal');
        });

        it('should detect branch-continue (same branch)', () => {
            const current = { ...createEmptyStep(), branchId: 'A' };
            const next = { ...createEmptyStep(), branchId: 'A' };
            const result = analyzeFlowTransition(current, next);
            expect(result.type).toBe('branch-continue');
        });

        it('should detect branch-switch (different branches)', () => {
            const current = { ...createEmptyStep(), branchId: 'A' };
            const next = { ...createEmptyStep(), branchId: 'B' };
            const result = analyzeFlowTransition(current, next);
            expect(result.type).toBe('branch-switch');
        });
    });

    describe('collectForkBranches (C9-N1)', () => {
        it('should collect all branch IDs after fork point', () => {
            const steps = [
                { ...createEmptyStep(), branchId: '' },      // 0: fork point
                { ...createEmptyStep(), branchId: 'A' },     // 1
                { ...createEmptyStep(), branchId: 'A' },     // 2
                { ...createEmptyStep(), branchId: 'B' },     // 3
                { ...createEmptyStep(), branchId: '' },      // 4: convergence
            ];
            const branches = collectForkBranches(steps, 0);
            expect(branches).toEqual(['A', 'B']);
        });

        it('should return empty array when no branches follow', () => {
            const steps = [
                { ...createEmptyStep(), branchId: '' },
                { ...createEmptyStep(), branchId: '' },
            ];
            const branches = collectForkBranches(steps, 0);
            expect(branches).toEqual([]);
        });

        it('should stop at convergence (main flow)', () => {
            const steps = [
                { ...createEmptyStep(), branchId: '' },
                { ...createEmptyStep(), branchId: 'A' },
                { ...createEmptyStep(), branchId: '' },
                { ...createEmptyStep(), branchId: 'C' },
            ];
            const branches = collectForkBranches(steps, 0);
            expect(branches).toEqual(['A']);
        });
    });

    describe('EMPTY_PFD_HEADER', () => {
        it('should have Barack Mercosul as default company', () => {
            expect(EMPTY_PFD_HEADER.companyName).toBe('Barack Mercosul');
        });

        it('should default revision to A', () => {
            expect(EMPTY_PFD_HEADER.revisionLevel).toBe('A');
        });

        it('should have a date for revisionDate', () => {
            expect(EMPTY_PFD_HEADER.revisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('renumberSteps', () => {
        it('should assign sequential OP numbers to operations', () => {
            const steps = [
                { ...createEmptyStep('OP 10'), stepType: 'storage' as const, description: 'Recepción' },
                { ...createEmptyStep('OP 25'), stepType: 'operation' as const, description: 'Op 1' },
                { ...createEmptyStep('OP 45'), stepType: 'operation' as const, description: 'Op 2' },
                { ...createEmptyStep('OP 90'), stepType: 'storage' as const, description: 'Envío' },
            ];
            const result = renumberSteps(steps);
            expect(result[0].stepNumber).toBe('REC');
            expect(result[1].stepNumber).toBe('OP 10');
            expect(result[2].stepNumber).toBe('OP 20');
            expect(result[3].stepNumber).toBe('ENV');
        });

        it('should skip transport steps (keep empty stepNumber)', () => {
            const steps = [
                { ...createEmptyStep('OP 10'), stepType: 'storage' as const, description: 'Recepción' },
                { ...createEmptyStep('OP 15'), stepType: 'transport' as const, description: 'Transporte' },
                { ...createEmptyStep('OP 20'), stepType: 'operation' as const, description: 'Op 1' },
                { ...createEmptyStep('OP 50'), stepType: 'storage' as const, description: 'Envío' },
            ];
            const result = renumberSteps(steps);
            expect(result[0].stepNumber).toBe('REC');
            expect(result[1].stepNumber).toBe('');
            expect(result[2].stepNumber).toBe('OP 10');
            expect(result[3].stepNumber).toBe('ENV');
        });

        it('should preserve REC/ENV for bookend storage steps', () => {
            const steps = [
                { ...createEmptyStep('Whatever'), stepType: 'storage' as const, description: 'Recepción' },
                { ...createEmptyStep('SomeNum'), stepType: 'storage' as const, description: 'Envío' },
            ];
            const result = renumberSteps(steps);
            expect(result[0].stepNumber).toBe('REC');
            expect(result[1].stepNumber).toBe('ENV');
        });

        it('should number middle storage steps as regular operations', () => {
            const steps = [
                { ...createEmptyStep('OP 10'), stepType: 'storage' as const, description: 'Recepción' },
                { ...createEmptyStep('OP 20'), stepType: 'storage' as const, description: 'Buffer intermedio' },
                { ...createEmptyStep('OP 30'), stepType: 'storage' as const, description: 'Envío' },
            ];
            const result = renumberSteps(steps);
            expect(result[0].stepNumber).toBe('REC');
            expect(result[1].stepNumber).toBe('OP 10');
            expect(result[2].stepNumber).toBe('ENV');
        });

        it('should not mutate original steps', () => {
            const steps = [
                { ...createEmptyStep('OP 10'), stepType: 'operation' as const, description: 'Op 1' },
            ];
            const original = steps[0].stepNumber;
            renumberSteps(steps);
            expect(steps[0].stepNumber).toBe(original);
        });

        it('should handle empty array', () => {
            const result = renumberSteps([]);
            expect(result).toHaveLength(0);
        });

        it('should handle single operation step', () => {
            const steps = [
                { ...createEmptyStep('OP 99'), stepType: 'operation' as const, description: 'Solo op' },
            ];
            const result = renumberSteps(steps);
            expect(result[0].stepNumber).toBe('OP 10');
        });

        it('should number inspection and decision steps sequentially', () => {
            const steps = [
                { ...createEmptyStep('OP 10'), stepType: 'storage' as const, description: 'Rec' },
                { ...createEmptyStep('OP 20'), stepType: 'operation' as const, description: 'Op' },
                { ...createEmptyStep('OP 30'), stepType: 'inspection' as const, description: 'Insp' },
                { ...createEmptyStep('OP 40'), stepType: 'decision' as const, description: 'Dec' },
                { ...createEmptyStep('OP 50'), stepType: 'storage' as const, description: 'Env' },
            ];
            const result = renumberSteps(steps);
            expect(result[0].stepNumber).toBe('REC');
            expect(result[1].stepNumber).toBe('OP 10');
            expect(result[2].stepNumber).toBe('OP 20');
            expect(result[3].stepNumber).toBe('OP 30');
            expect(result[4].stepNumber).toBe('ENV');
        });

        it('should handle multiple transport steps interspersed', () => {
            const steps = [
                { ...createEmptyStep('OP 10'), stepType: 'storage' as const, description: 'Rec' },
                { ...createEmptyStep(''), stepType: 'transport' as const, description: 'T1' },
                { ...createEmptyStep('OP 20'), stepType: 'operation' as const, description: 'Op1' },
                { ...createEmptyStep(''), stepType: 'transport' as const, description: 'T2' },
                { ...createEmptyStep('OP 30'), stepType: 'operation' as const, description: 'Op2' },
                { ...createEmptyStep('OP 40'), stepType: 'storage' as const, description: 'Env' },
            ];
            const result = renumberSteps(steps);
            expect(result[0].stepNumber).toBe('REC');
            expect(result[1].stepNumber).toBe('');
            expect(result[2].stepNumber).toBe('OP 10');
            expect(result[3].stepNumber).toBe('');
            expect(result[4].stepNumber).toBe('OP 20');
            expect(result[5].stepNumber).toBe('ENV');
        });
    });
});
