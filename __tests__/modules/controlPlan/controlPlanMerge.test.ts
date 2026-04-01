import { mergeGeneratedWithExisting } from '../../../modules/controlPlan/controlPlanGenerator';
import { ControlPlanItem } from '../../../modules/controlPlan/controlPlanTypes';

function makeItem(overrides: Partial<ControlPlanItem> = {}): ControlPlanItem {
    return {
        id: crypto.randomUUID(),
        processStepNumber: '10',
        processDescription: 'Test Op',
        machineDeviceTool: '',
        componentMaterial: '',
        characteristicNumber: '',
        productCharacteristic: '',
        processCharacteristic: '',
        specialCharClass: '',
        specification: '',
        evaluationTechnique: '',
        sampleSize: '',
        sampleFrequency: '',
        controlMethod: '',
        reactionPlan: '',
        reactionPlanOwner: '',
        controlProcedure: '',
        ...overrides,
    };
}

describe('mergeGeneratedWithExisting', () => {
    it('preserves user-edited local fields on matched process rows', () => {
        const existing = [makeItem({
            id: 'exist-1',
            processCharacteristic: 'Causa A',
            specification: 'Manual spec',
            sampleSize: '5 piezas',
            // NOT in autoFilledFields → means user edited them
        })];
        const generated = [makeItem({
            processCharacteristic: 'Causa A',
            processDescription: 'Updated Op Name',
            specification: 'Generated spec',
            sampleSize: 'Generated size',
        })];
        const result = mergeGeneratedWithExisting(generated, existing);
        expect(result.stats.matched).toBe(1);
        expect(result.items[0].specification).toBe('Manual spec');
        expect(result.items[0].sampleSize).toBe('5 piezas');
        expect(result.items[0].processDescription).toBe('Updated Op Name'); // inherited updated
    });

    it('preserves user-edited local fields on matched product rows', () => {
        const existing = [makeItem({
            id: 'exist-1',
            productCharacteristic: 'Failure A',
            specification: 'User spec',
            evaluationTechnique: 'User technique',
        })];
        const generated = [makeItem({
            productCharacteristic: 'Failure A',
            specification: 'Gen spec',
            evaluationTechnique: 'Gen technique',
        })];
        const result = mergeGeneratedWithExisting(generated, existing);
        expect(result.items[0].specification).toBe('User spec');
        expect(result.items[0].evaluationTechnique).toBe('User technique');
    });

    it('updates auto-filled local fields', () => {
        const existing = [makeItem({
            id: 'exist-1',
            processCharacteristic: 'Causa A',
            specification: 'Old auto spec',
            autoFilledFields: ['specification'],
        })];
        const generated = [makeItem({
            processCharacteristic: 'Causa A',
            specification: 'New auto spec',
            autoFilledFields: ['specification'],
        })];
        const result = mergeGeneratedWithExisting(generated, existing);
        expect(result.items[0].specification).toBe('New auto spec');
    });

    it('creates new items when no match exists', () => {
        const existing = [makeItem({
            id: 'exist-1',
            processStepNumber: '10',
            processCharacteristic: 'Causa A',
        })];
        const generated = [
            makeItem({ processStepNumber: '10', processCharacteristic: 'Causa A' }),
            makeItem({ processStepNumber: '20', processCharacteristic: 'Causa B' }),
        ];
        const result = mergeGeneratedWithExisting(generated, existing);
        expect(result.stats.matched).toBe(1);
        expect(result.stats.added).toBe(1);
        expect(result.items.length).toBe(2);
    });

    it('marks unmatched existing items as orphaned', () => {
        const existing = [
            makeItem({ id: 'e1', processStepNumber: '10', processCharacteristic: 'Causa A' }),
            makeItem({ id: 'e2', processStepNumber: '20', processCharacteristic: 'Causa B' }),
        ];
        const generated = [
            makeItem({ processStepNumber: '10', processCharacteristic: 'Causa A' }),
        ];
        const result = mergeGeneratedWithExisting(generated, existing);
        expect(result.stats.orphaned).toBe(1);
        const orphan = result.items.find(i => i.id === 'e2');
        expect(orphan?.orphaned).toBe(true);
    });

    it('preserves existing item id for HO cpItemId links', () => {
        const existing = [makeItem({
            id: 'keep-this-id',
            processCharacteristic: 'Causa A',
        })];
        const generated = [makeItem({
            id: 'new-generated-id',
            processCharacteristic: 'Causa A',
        })];
        const result = mergeGeneratedWithExisting(generated, existing);
        expect(result.items[0].id).toBe('keep-this-id');
    });

    it('matches by amfeCauseIds fallback when key changes', () => {
        const existing = [makeItem({
            id: 'e1',
            processCharacteristic: 'Old Cause Name',
            amfeCauseIds: ['cause-1'],
            specification: 'User spec',
        })];
        const generated = [makeItem({
            processCharacteristic: 'New Cause Name',
            amfeCauseIds: ['cause-1'],
            specification: 'Gen spec',
        })];
        const result = mergeGeneratedWithExisting(generated, existing);
        expect(result.stats.matched).toBe(1);
        expect(result.items[0].processCharacteristic).toBe('New Cause Name');
        expect(result.items[0].specification).toBe('User spec');
    });

    it('matches by amfeFailureId fallback for product rows', () => {
        const existing = [makeItem({
            id: 'e1',
            productCharacteristic: 'Old Failure',
            amfeFailureId: 'fail-1',
            specification: 'Kept',
        })];
        const generated = [makeItem({
            productCharacteristic: 'New Failure Name',
            amfeFailureId: 'fail-1',
            specification: 'Generated',
        })];
        const result = mergeGeneratedWithExisting(generated, existing);
        expect(result.stats.matched).toBe(1);
        expect(result.items[0].specification).toBe('Kept');
    });

    it('empty existing = fresh generation', () => {
        const generated = [
            makeItem({ processCharacteristic: 'A' }),
            makeItem({ processCharacteristic: 'B' }),
        ];
        const result = mergeGeneratedWithExisting(generated, []);
        expect(result.stats.added).toBe(2);
        expect(result.stats.matched).toBe(0);
        expect(result.stats.orphaned).toBe(0);
    });

    it('respects overriddenFields for local fields', () => {
        const existing = [makeItem({
            id: 'e1',
            processCharacteristic: 'Causa A',
            specification: 'User Override',
            overriddenFields: ['specification'],
        })];
        const generated = [makeItem({
            processCharacteristic: 'Causa A',
            specification: 'Generated Value',
        })];
        const result = mergeGeneratedWithExisting(generated, existing);
        // specification is a local field, overriddenFields should preserve the user value
        expect(result.items[0].specification).toBe('User Override');
    });

    it('clears orphaned flag on re-matched items', () => {
        const existing = [makeItem({
            id: 'e1',
            processCharacteristic: 'Causa A',
            orphaned: true,
        })];
        // The merge loop iterates Object.keys(genItem), so orphaned must be
        // present on the generated item for the merge to set it to false.
        const generated = [makeItem({
            processCharacteristic: 'Causa A',
            orphaned: false,
        })];
        const result = mergeGeneratedWithExisting(generated, existing);
        expect(result.items[0].orphaned).toBe(false);
    });
});
