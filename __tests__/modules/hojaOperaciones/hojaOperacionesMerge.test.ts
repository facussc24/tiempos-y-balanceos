import { mergeHoWithExisting } from '../../../modules/hojaOperaciones/hojaOperacionesGenerator';
import { HoDocument, HojaOperacion, HoQualityCheck, EMPTY_HO_HEADER } from '../../../modules/hojaOperaciones/hojaOperacionesTypes';

function makeQc(overrides: Partial<HoQualityCheck> = {}): HoQualityCheck {
    return {
        id: crypto.randomUUID(),
        characteristic: '',
        specification: '',
        evaluationTechnique: '',
        frequency: '',
        controlMethod: '',
        reactionAction: '',
        reactionContact: '',
        specialCharSymbol: '',
        registro: '',
        ...overrides,
    };
}

function makeSheet(overrides: Partial<HojaOperacion> = {}): HojaOperacion {
    return {
        id: crypto.randomUUID(),
        amfeOperationId: crypto.randomUUID(),
        operationNumber: '10',
        operationName: 'Test Op',
        hoNumber: 'HO-10',
        sector: '',
        puestoNumber: '',
        vehicleModel: '',
        partCodeDescription: '',
        safetyElements: [],
        hazardWarnings: [],
        steps: [],
        qualityChecks: [],
        reactionPlanText: '',
        reactionContact: '',
        visualAids: [],
        preparedBy: '',
        approvedBy: '',
        date: '',
        revision: '',
        status: 'borrador',
        ...overrides,
    };
}

function makeDoc(sheets: HojaOperacion[]): HoDocument {
    return { header: { ...EMPTY_HO_HEADER }, sheets };
}

describe('mergeHoWithExisting', () => {
    it('preserves steps on matched sheet', () => {
        const existingSteps = [{ id: 's1', stepNumber: 1, description: 'Manual step', isKeyPoint: true, keyPointReason: 'Critical' }];
        const existing = makeDoc([makeSheet({ operationNumber: '10', steps: existingSteps })]);
        const generated = makeDoc([makeSheet({ operationNumber: '10', steps: [] })]);
        const result = mergeHoWithExisting(generated, existing);
        expect(result.stats.sheetsMatched).toBe(1);
        expect(result.document.sheets[0].steps).toEqual(existingSteps);
    });

    it('preserves visualAids on matched sheet', () => {
        const aids = [{ id: 'v1', imageData: 'base64data', caption: 'Photo', order: 0 }];
        const existing = makeDoc([makeSheet({ operationNumber: '10', visualAids: aids })]);
        const generated = makeDoc([makeSheet({ operationNumber: '10', visualAids: [] })]);
        const result = mergeHoWithExisting(generated, existing);
        expect(result.document.sheets[0].visualAids).toEqual(aids);
    });

    it('preserves QC registro on matched QC', () => {
        const existQc = makeQc({ cpItemId: 'cp-1', registro: 'R-01', characteristic: 'Old' });
        const genQc = makeQc({ cpItemId: 'cp-1', registro: '', characteristic: 'Updated' });
        const existing = makeDoc([makeSheet({ operationNumber: '10', qualityChecks: [existQc] })]);
        const generated = makeDoc([makeSheet({ operationNumber: '10', qualityChecks: [genQc] })]);
        const result = mergeHoWithExisting(generated, existing);
        const qc = result.document.sheets[0].qualityChecks[0];
        expect(qc.registro).toBe('R-01');
        expect(qc.characteristic).toBe('Updated');
    });

    it('creates new sheet for new operation', () => {
        const existing = makeDoc([makeSheet({ operationNumber: '10' })]);
        const generated = makeDoc([
            makeSheet({ operationNumber: '10' }),
            makeSheet({ operationNumber: '20', operationName: 'New Op' }),
        ]);
        const result = mergeHoWithExisting(generated, existing);
        expect(result.stats.sheetsMatched).toBe(1);
        expect(result.stats.sheetsAdded).toBe(1);
    });

    it('marks orphaned sheet for removed operation', () => {
        const existing = makeDoc([
            makeSheet({ id: 's1', operationNumber: '10' }),
            makeSheet({ id: 's2', operationNumber: '20' }),
        ]);
        const generated = makeDoc([makeSheet({ operationNumber: '10' })]);
        const result = mergeHoWithExisting(generated, existing);
        expect(result.stats.sheetsOrphaned).toBe(1);
        const orphan = result.document.sheets.find(s => s.id === 's2');
        expect(orphan?.orphaned).toBe(true);
    });

    it('marks orphaned QC when CP item removed', () => {
        const existing = makeDoc([makeSheet({
            operationNumber: '10',
            qualityChecks: [
                makeQc({ id: 'qc1', cpItemId: 'cp-1' }),
                makeQc({ id: 'qc2', cpItemId: 'cp-2' }),
            ],
        })]);
        const generated = makeDoc([makeSheet({
            operationNumber: '10',
            qualityChecks: [makeQc({ cpItemId: 'cp-1' })],
        })]);
        const result = mergeHoWithExisting(generated, existing);
        expect(result.stats.qcMatched).toBe(1);
        expect(result.stats.qcOrphaned).toBe(1);
        const orphanQc = result.document.sheets[0].qualityChecks.find(q => q.id === 'qc2');
        expect(orphanQc?.orphaned).toBe(true);
    });

    it('preserves safetyElements on matched sheet', () => {
        const ppe = ['anteojos', 'guantes', 'respirador'] as any;
        const existing = makeDoc([makeSheet({ operationNumber: '10', safetyElements: ppe })]);
        const generated = makeDoc([makeSheet({ operationNumber: '10', safetyElements: ['anteojos', 'zapatos'] as any })]);
        const result = mergeHoWithExisting(generated, existing);
        expect(result.document.sheets[0].safetyElements).toEqual(ppe);
    });

    it('preserves metadata on matched sheet', () => {
        const existing = makeDoc([makeSheet({
            operationNumber: '10',
            preparedBy: 'Facundo',
            approvedBy: 'Carlos',
            revision: 'B',
        })]);
        const generated = makeDoc([makeSheet({ operationNumber: '10' })]);
        const result = mergeHoWithExisting(generated, existing);
        expect(result.document.sheets[0].preparedBy).toBe('Facundo');
        expect(result.document.sheets[0].approvedBy).toBe('Carlos');
        expect(result.document.sheets[0].revision).toBe('B');
    });

    it('matches sheet by amfeOperationId fallback', () => {
        const amfeOpId = 'amfe-op-1';
        const existing = makeDoc([makeSheet({
            id: 'e1',
            operationNumber: '10',
            amfeOperationId: amfeOpId,
            preparedBy: 'Kept',
        })]);
        const generated = makeDoc([makeSheet({
            operationNumber: '15',
            amfeOperationId: amfeOpId,
        })]);
        const result = mergeHoWithExisting(generated, existing);
        expect(result.stats.sheetsMatched).toBe(1);
        expect(result.document.sheets[0].operationNumber).toBe('15');
        expect(result.document.sheets[0].preparedBy).toBe('Kept');
    });

    it('empty existing = fresh generation', () => {
        const generated = makeDoc([makeSheet(), makeSheet({ operationNumber: '20' })]);
        const result = mergeHoWithExisting(generated, makeDoc([]));
        expect(result.stats.sheetsAdded).toBe(2);
        expect(result.stats.sheetsMatched).toBe(0);
    });
});
