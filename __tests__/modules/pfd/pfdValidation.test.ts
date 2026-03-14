import { validatePfdDocument } from '../../../modules/pfd/pfdValidation';
import { createEmptyPfdDocument, createEmptyStep, PfdDocument } from '../../../modules/pfd/pfdTypes';

function makeDoc(overrides?: Partial<PfdDocument>): PfdDocument {
    const doc = createEmptyPfdDocument();
    doc.steps[0].stepNumber = 'OP 10';
    doc.steps[0].description = 'Test operation';
    doc.header.partNumber = 'P-001';
    doc.header.partName = 'Test Part';
    doc.header.customerName = 'Test Client';
    doc.header.engineeringChangeLevel = 'A';
    doc.header.supplierCode = 'SUP-001';
    doc.header.preparedBy = 'Ing. Pérez';
    doc.header.approvedBy = 'Lic. García';
    return { ...doc, ...overrides };
}

describe('pfdValidation', () => {
    describe('V1: duplicate step numbers', () => {
        it('should detect duplicate step numbers', () => {
            const doc = makeDoc();
            const step2 = createEmptyStep();
            step2.stepNumber = 'OP 10';
            step2.description = 'Duplicate';
            doc.steps.push(step2);
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V1')).toBe(true);
        });

        it('should not flag empty step numbers as duplicates', () => {
            const doc = makeDoc();
            doc.steps[0].stepNumber = '';
            const step2 = createEmptyStep();
            step2.stepNumber = '';
            step2.description = 'Also empty';
            doc.steps.push(step2);
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V1')).toHaveLength(0);
        });
    });

    describe('V2: missing description', () => {
        it('should detect steps without description', () => {
            const doc = makeDoc();
            doc.steps[0].description = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V2')).toBe(true);
        });

        it('should not flag steps with description', () => {
            const doc = makeDoc();
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V2')).toHaveLength(0);
        });
    });

    describe('V3: CC/SC without characteristic', () => {
        it('should warn when product CC/SC set but no characteristic', () => {
            const doc = makeDoc();
            doc.steps[0].productSpecialChar = 'CC';
            doc.steps[0].productCharacteristic = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V3' && i.severity === 'warning')).toBe(true);
        });

        it('should warn when process SC set but no characteristic', () => {
            const doc = makeDoc();
            doc.steps[0].processSpecialChar = 'SC';
            doc.steps[0].processCharacteristic = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V3')).toBe(true);
        });

        it('should not warn when CC/SC is none', () => {
            const doc = makeDoc();
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V3')).toHaveLength(0);
        });
    });

    describe('V4: incomplete header', () => {
        it('should warn when part number missing', () => {
            const doc = makeDoc();
            doc.header.partNumber = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V4')).toBe(true);
        });

        it('should warn when customer missing', () => {
            const doc = makeDoc();
            doc.header.customerName = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V4')).toBe(true);
        });

        it('should not warn when header is complete', () => {
            const doc = makeDoc();
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V4')).toHaveLength(0);
        });
    });

    describe('V5: decision without notes', () => {
        it('should info when decision step has no notes', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'decision';
            doc.steps[0].notes = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V5' && i.severity === 'info')).toBe(true);
        });

        it('should not flag decision with notes', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'decision';
            doc.steps[0].notes = 'Pieza OK?';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V5')).toHaveLength(0);
        });
    });

    describe('V6: too many steps', () => {
        it('should warn when more than 50 steps', () => {
            const doc = makeDoc();
            for (let i = 0; i < 55; i++) {
                const s = createEmptyStep();
                s.stepNumber = `OP ${(i + 2) * 10}`;
                s.description = `Step ${i}`;
                doc.steps.push(s);
            }
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V6')).toBe(true);
        });
    });

    describe('V7: field length exceeds limit', () => {
        it('should error when description exceeds 10000 chars', () => {
            const doc = makeDoc();
            doc.steps[0].description = 'x'.repeat(10001);
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V7' && i.severity === 'error')).toBe(true);
        });

        it('should not error for normal length fields', () => {
            const doc = makeDoc();
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V7')).toHaveLength(0);
        });
    });

    describe('V4 extended: AIAG header fields', () => {
        it('should warn when engineeringChangeLevel missing', () => {
            const doc = makeDoc();
            doc.header.engineeringChangeLevel = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V4' && i.message.includes('nivel de cambio'))).toBe(true);
        });

        it('should warn when supplierCode missing', () => {
            const doc = makeDoc();
            doc.header.supplierCode = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V4' && i.message.includes('proveedor'))).toBe(true);
        });

        it('should warn when preparedBy missing', () => {
            const doc = makeDoc();
            doc.header.preparedBy = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V4' && i.message.includes('Elaboró'))).toBe(true);
        });

        it('should warn when approvedBy missing', () => {
            const doc = makeDoc();
            doc.header.approvedBy = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V4' && i.message.includes('Aprobó'))).toBe(true);
        });
    });

    describe('V10: last step should be storage', () => {
        it('should info when last step is not storage', () => {
            const doc = makeDoc();
            const step2 = createEmptyStep();
            step2.stepNumber = 'OP 20';
            step2.description = 'Final operation';
            step2.stepType = 'operation';
            doc.steps.push(step2);
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V10' && i.severity === 'info')).toBe(true);
        });

        it('should not flag when last step is storage', () => {
            const doc = makeDoc();
            const step2 = createEmptyStep();
            step2.stepNumber = 'OP 20';
            step2.description = 'Envío al cliente';
            step2.stepType = 'storage';
            doc.steps.push(step2);
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V10')).toHaveLength(0);
        });

        it('should not flag single-step document', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'operation';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V10')).toHaveLength(0);
        });
    });

    describe('V11: rework without return step', () => {
        it('should warn when rework has no return step', () => {
            const doc = makeDoc();
            doc.steps[0].isRework = true;
            doc.steps[0].reworkReturnStep = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V11' && i.severity === 'warning')).toBe(true);
        });

        it('should not warn when rework has return step', () => {
            const doc = makeDoc();
            doc.steps[0].isRework = true;
            doc.steps[0].reworkReturnStep = 'OP 20';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V11')).toHaveLength(0);
        });

        it('should not flag non-rework steps', () => {
            const doc = makeDoc();
            doc.steps[0].isRework = false;
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V11')).toHaveLength(0);
        });
    });

    describe('V12: scrap/sort without description (C3-N1)', () => {
        it('should warn when scrap has no description', () => {
            const doc = makeDoc();
            doc.steps[0].rejectDisposition = 'scrap';
            doc.steps[0].scrapDescription = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V12' && i.severity === 'warning')).toBe(true);
            expect(issues.find(i => i.rule === 'V12')?.message).toContain('descarte');
        });

        it('should warn when sort has no description', () => {
            const doc = makeDoc();
            doc.steps[0].rejectDisposition = 'sort';
            doc.steps[0].scrapDescription = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V12')).toBe(true);
            expect(issues.find(i => i.rule === 'V12')?.message).toContain('selección');
        });

        it('should not warn when scrap has description', () => {
            const doc = makeDoc();
            doc.steps[0].rejectDisposition = 'scrap';
            doc.steps[0].scrapDescription = 'Dimensional fuera de tolerancia';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V12')).toHaveLength(0);
        });

        it('should not warn for rework disposition', () => {
            const doc = makeDoc();
            doc.steps[0].rejectDisposition = 'rework';
            doc.steps[0].isRework = true;
            doc.steps[0].reworkReturnStep = 'OP 20';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V12')).toHaveLength(0);
        });

        it('should not warn for none disposition', () => {
            const doc = makeDoc();
            doc.steps[0].rejectDisposition = 'none';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V12')).toHaveLength(0);
        });
    });

    describe('V11 with rejectDisposition (C4-B2)', () => {
        it('should detect rework via rejectDisposition without return step', () => {
            const doc = makeDoc();
            doc.steps[0].rejectDisposition = 'rework';
            doc.steps[0].isRework = false; // canonical field is rejectDisposition
            doc.steps[0].reworkReturnStep = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V11')).toBe(true);
        });

        it('should not flag rework via rejectDisposition with return step', () => {
            const doc = makeDoc();
            doc.steps[0].rejectDisposition = 'rework';
            doc.steps[0].isRework = false;
            doc.steps[0].reworkReturnStep = 'OP 20';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V11')).toHaveLength(0);
        });
    });

    describe('V13: step without operation number (C4-N1)', () => {
        it('should warn when step has empty stepNumber', () => {
            const doc = makeDoc();
            doc.steps[0].stepNumber = '';
            doc.steps[0].stepType = 'operation';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V13' && i.severity === 'warning')).toBe(true);
        });

        it('should warn when step has whitespace-only stepNumber', () => {
            const doc = makeDoc();
            doc.steps[0].stepNumber = '   ';
            doc.steps[0].stepType = 'operation';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V13')).toBe(true);
        });

        it('should not flag steps with valid stepNumber', () => {
            const doc = makeDoc();
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V13')).toHaveLength(0);
        });

        it('should NOT fire for transport steps with empty stepNumber', () => {
            const doc = makeDoc();
            const transport = createEmptyStep();
            transport.stepType = 'transport';
            transport.stepNumber = '';
            transport.description = 'Transporte a línea';
            doc.steps.push(transport);
            const issues = validatePfdDocument(doc);
            // Should not have any V13 for the transport step
            const v13Issues = issues.filter(i => i.rule === 'V13');
            expect(v13Issues).toHaveLength(0);
        });

        it('should still fire for non-transport steps with empty stepNumber', () => {
            const doc = makeDoc();
            const inspection = createEmptyStep();
            inspection.stepType = 'inspection';
            inspection.stepNumber = '';
            inspection.description = 'Inspección';
            doc.steps.push(inspection);
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V13')).toBe(true);
        });
    });

    describe('V14: operation without machine/device (C4-N2)', () => {
        it('should warn when operation has no machineDeviceTool', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'operation';
            doc.steps[0].machineDeviceTool = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V14' && i.severity === 'warning')).toBe(true);
        });

        it('should warn when combined step has no machineDeviceTool', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'combined';
            doc.steps[0].machineDeviceTool = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V14')).toBe(true);
        });

        it('should not flag operation with machineDeviceTool', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'operation';
            doc.steps[0].machineDeviceTool = 'Prensa hidráulica 100T';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V14')).toHaveLength(0);
        });

        it('should not flag storage/transport/inspection without machine', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'storage';
            doc.steps[0].machineDeviceTool = '';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V14')).toHaveLength(0);
        });
    });

    describe('V15: inspection required (C5-N1)', () => {
        it('should warn when PFD has >2 steps but no inspection', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'operation';
            doc.steps.push({ ...createEmptyStep('OP 20'), description: 'Op 2', stepType: 'operation' });
            doc.steps.push({ ...createEmptyStep('OP 30'), description: 'Op 3', stepType: 'storage' });
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V15' && i.severity === 'warning')).toBe(true);
        });

        it('should not warn when PFD has an inspection step', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'operation';
            doc.steps[0].machineDeviceTool = 'Prensa';
            doc.steps.push({ ...createEmptyStep('OP 20'), description: 'Inspección', stepType: 'inspection', productCharacteristic: 'Diámetro' });
            doc.steps.push({ ...createEmptyStep('OP 30'), description: 'Envío', stepType: 'storage' });
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V15')).toHaveLength(0);
        });

        it('should not warn when PFD has a combined step', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'operation';
            doc.steps[0].machineDeviceTool = 'Prensa';
            doc.steps.push({ ...createEmptyStep('OP 20'), description: 'Op+Insp', stepType: 'combined', machineDeviceTool: 'Calibre' });
            doc.steps.push({ ...createEmptyStep('OP 30'), description: 'Envío', stepType: 'storage' });
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V15')).toHaveLength(0);
        });

        it('should not fire V15 for docs with 2 or fewer steps', () => {
            const doc = makeDoc();
            // Only 1 step
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V15')).toHaveLength(0);
        });
    });

    describe('V16: rework return step exists (C5-N3)', () => {
        it('should warn when rework return step does not exist in flow', () => {
            const doc = makeDoc();
            doc.steps[0].rejectDisposition = 'rework';
            doc.steps[0].reworkReturnStep = 'OP 99';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V16' && i.severity === 'warning')).toBe(true);
            expect(issues.find(i => i.rule === 'V16')?.message).toContain('OP 99');
        });

        it('should not warn when rework return step exists', () => {
            const doc = makeDoc();
            doc.steps.push({ ...createEmptyStep('OP 20'), description: 'Second op', stepType: 'operation', machineDeviceTool: 'Torno' });
            doc.steps[0].rejectDisposition = 'rework';
            doc.steps[0].reworkReturnStep = 'OP 20';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V16')).toHaveLength(0);
        });

        it('should not fire V16 when reworkReturnStep is empty', () => {
            const doc = makeDoc();
            doc.steps[0].rejectDisposition = 'rework';
            doc.steps[0].reworkReturnStep = '';
            const issues = validatePfdDocument(doc);
            // V11 fires for empty return step, but V16 should not
            expect(issues.filter(i => i.rule === 'V16')).toHaveLength(0);
        });
    });

    describe('V17: inspection without reference or notes (C6-N1)', () => {
        it('should info when inspection has no reference and no notes', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'inspection';
            doc.steps[0].reference = '';
            doc.steps[0].notes = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V17' && i.severity === 'info')).toBe(true);
        });

        it('should info for combined step without reference and notes', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'combined';
            doc.steps[0].machineDeviceTool = 'Calibre';
            doc.steps[0].reference = '';
            doc.steps[0].notes = '';
            const issues = validatePfdDocument(doc);
            expect(issues.some(i => i.rule === 'V17')).toBe(true);
        });

        it('should not fire when inspection has reference', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'inspection';
            doc.steps[0].reference = 'Plano 123-A';
            doc.steps[0].notes = '';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V17')).toHaveLength(0);
        });

        it('should not fire when inspection has notes', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'inspection';
            doc.steps[0].reference = '';
            doc.steps[0].notes = 'Verificar diámetro con calibre pasa-no pasa';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V17')).toHaveLength(0);
        });

        it('should not fire for operation steps', () => {
            const doc = makeDoc();
            doc.steps[0].stepType = 'operation';
            doc.steps[0].reference = '';
            doc.steps[0].notes = '';
            const issues = validatePfdDocument(doc);
            expect(issues.filter(i => i.rule === 'V17')).toHaveLength(0);
        });
    });

    describe('V20: branch without label (once per branch)', () => {
        it('should fire only once per branch without a label', () => {
            const doc = makeDoc();
            // 3 steps on branch A, none with a label
            const s1 = createEmptyStep('OP 20');
            s1.description = 'Op A1';
            s1.stepType = 'operation';
            s1.machineDeviceTool = 'Prensa';
            s1.branchId = 'A';
            s1.branchLabel = '';
            doc.steps.push(s1);

            const s2 = createEmptyStep('OP 30');
            s2.description = 'Op A2';
            s2.stepType = 'operation';
            s2.machineDeviceTool = 'Torno';
            s2.branchId = 'A';
            s2.branchLabel = '';
            doc.steps.push(s2);

            const s3 = createEmptyStep('OP 40');
            s3.description = 'Op A3';
            s3.stepType = 'operation';
            s3.machineDeviceTool = 'Fresa';
            s3.branchId = 'A';
            s3.branchLabel = '';
            doc.steps.push(s3);

            // Add convergence step so V19 doesn't fire
            const conv = createEmptyStep('OP 50');
            conv.description = 'Convergencia';
            conv.stepType = 'operation';
            conv.machineDeviceTool = 'Mesa';
            doc.steps.push(conv);

            const issues = validatePfdDocument(doc);
            const v20Issues = issues.filter(i => i.rule === 'V20');
            // Only ONE V20 issue for branch A, not three
            expect(v20Issues).toHaveLength(1);
            expect(v20Issues[0].message).toContain('"A"');
        });

        it('should not fire if any step on the branch has a label', () => {
            const doc = makeDoc();
            const s1 = createEmptyStep('OP 20');
            s1.description = 'Op A1';
            s1.stepType = 'operation';
            s1.machineDeviceTool = 'Prensa';
            s1.branchId = 'A';
            s1.branchLabel = '';
            doc.steps.push(s1);

            const s2 = createEmptyStep('OP 30');
            s2.description = 'Op A2';
            s2.stepType = 'operation';
            s2.machineDeviceTool = 'Torno';
            s2.branchId = 'A';
            s2.branchLabel = 'Mecanizado'; // has label
            doc.steps.push(s2);

            // Add convergence step
            const conv = createEmptyStep('OP 40');
            conv.description = 'Convergencia';
            conv.stepType = 'operation';
            conv.machineDeviceTool = 'Mesa';
            doc.steps.push(conv);

            const issues = validatePfdDocument(doc);
            const v20Issues = issues.filter(i => i.rule === 'V20');
            expect(v20Issues).toHaveLength(0);
        });

        it('should fire once per distinct branch', () => {
            const doc = makeDoc();
            // Branch A - no label
            const s1 = createEmptyStep('OP 20');
            s1.description = 'Op A1'; s1.stepType = 'operation'; s1.machineDeviceTool = 'P';
            s1.branchId = 'A'; s1.branchLabel = '';
            doc.steps.push(s1);

            // Branch B - no label
            const s2 = createEmptyStep('OP 30');
            s2.description = 'Op B1'; s2.stepType = 'operation'; s2.machineDeviceTool = 'T';
            s2.branchId = 'B'; s2.branchLabel = '';
            doc.steps.push(s2);

            // Convergence
            const conv = createEmptyStep('OP 40');
            conv.description = 'Conv'; conv.stepType = 'operation'; conv.machineDeviceTool = 'M';
            doc.steps.push(conv);

            const issues = validatePfdDocument(doc);
            const v20Issues = issues.filter(i => i.rule === 'V20');
            // One for A, one for B
            expect(v20Issues).toHaveLength(2);
        });
    });

    it('should return empty array for valid document', () => {
        const doc = makeDoc();
        const issues = validatePfdDocument(doc);
        expect(issues).toHaveLength(0);
    });
});
