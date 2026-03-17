/**
 * Tests for pfdAmfeLinkValidation — pure functions, no mocks needed.
 */

import {
    validatePfdAmfeLinks,
    getBrokenPfdStepIds,
    getBrokenAmfeOperationIds,
    getRelinkCandidates,
} from '../../utils/pfdAmfeLinkValidation';
import type { PfdDocument } from '../../modules/pfd/pfdTypes';
import type { AmfeDocument } from '../../modules/amfe/amfeTypes';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makePfdDoc(steps: Partial<PfdDocument['steps'][0]>[]): PfdDocument {
    return {
        id: 'pfd-1',
        header: {
            partNumber: 'P-100',
            partName: 'Test Part',
            documentNumber: 'PFD-001',
            revisionLevel: '1',
            revisionDate: '2026-01-01',
            customerName: 'Customer',
            linkedAmfeId: 'amfe-1',
            plant: '',
            approvedBy: '',
            createdBy: '',
        },
        steps: steps.map((s, i) => ({
            id: s.id ?? `step-${i}`,
            stepNumber: s.stepNumber ?? `${10 + i * 10}`,
            stepType: s.stepType ?? 'operation',
            description: s.description ?? `Step ${i}`,
            machineDeviceTool: '',
            productCharacteristic: '',
            productSpecialChar: 'none',
            processCharacteristic: '',
            processSpecialChar: 'none',
            dispositionScrap: false,
            dispositionRework: false,
            dispositionUseAsIs: false,
            notes: '',
            linkedAmfeOperationId: s.linkedAmfeOperationId,
            ...s,
        })) as PfdDocument['steps'],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
    } as unknown as PfdDocument;
}

function makeAmfeDoc(operations: Partial<AmfeDocument['operations'][0]>[]): AmfeDocument {
    return {
        header: {
            companyName: 'Test Co',
            plant: 'Plant 1',
            customerName: 'Customer',
            modelYear: '2026',
            subject: 'Test AMFE',
            startDate: '2026-01-01',
            revisionDate: '2026-01-01',
            teamMembers: '',
            responsibleDesign: '',
            revision: '1',
        },
        operations: operations.map((op, i) => ({
            id: op.id ?? `op-${i}`,
            opNumber: op.opNumber ?? `${i + 1}`,
            name: op.name ?? `Operation ${i}`,
            workElements: [],
            linkedPfdStepId: op.linkedPfdStepId,
            ...op,
        })) as AmfeDocument['operations'],
    } as unknown as AmfeDocument;
}

// ---------------------------------------------------------------------------
// validatePfdAmfeLinks
// ---------------------------------------------------------------------------

describe('pfdAmfeLinkValidation', () => {
    describe('validatePfdAmfeLinks', () => {
        it('returns isValid=false when pfdDoc is null', () => {
            const result = validatePfdAmfeLinks(null, makeAmfeDoc([]));
            expect(result.isValid).toBe(false);
            expect(result.totalBroken).toBe(0);
        });

        it('returns isValid=false when amfeDoc is null', () => {
            const result = validatePfdAmfeLinks(makePfdDoc([]), null);
            expect(result.isValid).toBe(false);
            expect(result.totalBroken).toBe(0);
        });

        it('returns isValid=false when both docs are null', () => {
            const result = validatePfdAmfeLinks(null, null);
            expect(result.isValid).toBe(false);
        });

        it('returns no broken links when no cross-links exist', () => {
            const pfd = makePfdDoc([{ id: 'step-1' }]);
            const amfe = makeAmfeDoc([{ id: 'op-1' }]);
            const result = validatePfdAmfeLinks(pfd, amfe);

            expect(result.isValid).toBe(true);
            expect(result.totalBroken).toBe(0);
            expect(result.brokenPfdLinks).toHaveLength(0);
            expect(result.brokenAmfeLinks).toHaveLength(0);
        });

        it('returns no broken links when all cross-links are valid', () => {
            const pfd = makePfdDoc([
                { id: 'step-1', linkedAmfeOperationId: 'op-1' },
                { id: 'step-2', linkedAmfeOperationId: 'op-2' },
            ]);
            const amfe = makeAmfeDoc([
                { id: 'op-1', linkedPfdStepId: 'step-1' },
                { id: 'op-2', linkedPfdStepId: 'step-2' },
            ]);
            const result = validatePfdAmfeLinks(pfd, amfe);

            expect(result.isValid).toBe(true);
            expect(result.totalBroken).toBe(0);
        });

        it('detects broken PFD → AMFE link', () => {
            const pfd = makePfdDoc([
                { id: 'step-1', stepNumber: '10', description: 'Corte', linkedAmfeOperationId: 'op-DELETED' },
            ]);
            const amfe = makeAmfeDoc([{ id: 'op-1' }]);
            const result = validatePfdAmfeLinks(pfd, amfe);

            expect(result.totalBroken).toBe(1);
            expect(result.brokenPfdLinks).toHaveLength(1);
            expect(result.brokenPfdLinks[0]).toEqual({
                stepId: 'step-1',
                stepNumber: '10',
                stepDescription: 'Corte',
                linkedAmfeOperationId: 'op-DELETED',
            });
        });

        it('detects broken AMFE → PFD link', () => {
            const pfd = makePfdDoc([{ id: 'step-1' }]);
            const amfe = makeAmfeDoc([
                { id: 'op-1', opNumber: '1', name: 'Soldadura', linkedPfdStepId: 'step-GONE' },
            ]);
            const result = validatePfdAmfeLinks(pfd, amfe);

            expect(result.totalBroken).toBe(1);
            expect(result.brokenAmfeLinks).toHaveLength(1);
            expect(result.brokenAmfeLinks[0]).toEqual({
                operationId: 'op-1',
                opNumber: '1',
                operationName: 'Soldadura',
                linkedPfdStepId: 'step-GONE',
            });
        });

        it('detects broken links in both directions simultaneously', () => {
            const pfd = makePfdDoc([
                { id: 'step-1', linkedAmfeOperationId: 'op-MISSING' },
                { id: 'step-2', linkedAmfeOperationId: 'op-1' }, // valid
            ]);
            const amfe = makeAmfeDoc([
                { id: 'op-1', linkedPfdStepId: 'step-MISSING' },
                { id: 'op-2' }, // no link
            ]);
            const result = validatePfdAmfeLinks(pfd, amfe);

            expect(result.totalBroken).toBe(2);
            expect(result.brokenPfdLinks).toHaveLength(1);
            expect(result.brokenPfdLinks[0].stepId).toBe('step-1');
            expect(result.brokenAmfeLinks).toHaveLength(1);
            expect(result.brokenAmfeLinks[0].operationId).toBe('op-1');
        });

        it('ignores steps/ops with no cross-link', () => {
            const pfd = makePfdDoc([
                { id: 'step-1' }, // no linkedAmfeOperationId
                { id: 'step-2', linkedAmfeOperationId: undefined },
            ]);
            const amfe = makeAmfeDoc([
                { id: 'op-1' }, // no linkedPfdStepId
                { id: 'op-2', linkedPfdStepId: undefined },
            ]);
            const result = validatePfdAmfeLinks(pfd, amfe);

            expect(result.totalBroken).toBe(0);
            expect(result.isValid).toBe(true);
        });

        it('ignores empty string cross-links', () => {
            const pfd = makePfdDoc([{ id: 'step-1', linkedAmfeOperationId: '' }]);
            const amfe = makeAmfeDoc([{ id: 'op-1', linkedPfdStepId: '' }]);
            const result = validatePfdAmfeLinks(pfd, amfe);

            expect(result.totalBroken).toBe(0);
        });

        it('handles empty documents', () => {
            const pfd = makePfdDoc([]);
            const amfe = makeAmfeDoc([]);
            const result = validatePfdAmfeLinks(pfd, amfe);

            expect(result.isValid).toBe(true);
            expect(result.totalBroken).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // getBrokenPfdStepIds
    // -----------------------------------------------------------------------

    describe('getBrokenPfdStepIds', () => {
        it('returns empty set when no broken PFD links', () => {
            const result = validatePfdAmfeLinks(makePfdDoc([]), makeAmfeDoc([]));
            expect(getBrokenPfdStepIds(result).size).toBe(0);
        });

        it('returns set of broken step IDs', () => {
            const pfd = makePfdDoc([
                { id: 'step-A', linkedAmfeOperationId: 'op-MISSING' },
                { id: 'step-B', linkedAmfeOperationId: 'op-ALSO-MISSING' },
                { id: 'step-C', linkedAmfeOperationId: 'op-1' },
            ]);
            const amfe = makeAmfeDoc([{ id: 'op-1' }]);
            const result = validatePfdAmfeLinks(pfd, amfe);
            const ids = getBrokenPfdStepIds(result);

            expect(ids.size).toBe(2);
            expect(ids.has('step-A')).toBe(true);
            expect(ids.has('step-B')).toBe(true);
            expect(ids.has('step-C')).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // getBrokenAmfeOperationIds
    // -----------------------------------------------------------------------

    describe('getBrokenAmfeOperationIds', () => {
        it('returns empty set when no broken AMFE links', () => {
            const result = validatePfdAmfeLinks(makePfdDoc([]), makeAmfeDoc([]));
            expect(getBrokenAmfeOperationIds(result).size).toBe(0);
        });

        it('returns set of broken operation IDs', () => {
            const pfd = makePfdDoc([{ id: 'step-1' }]);
            const amfe = makeAmfeDoc([
                { id: 'op-X', linkedPfdStepId: 'step-GONE' },
                { id: 'op-Y', linkedPfdStepId: 'step-1' }, // valid
            ]);
            const result = validatePfdAmfeLinks(pfd, amfe);
            const ids = getBrokenAmfeOperationIds(result);

            expect(ids.size).toBe(1);
            expect(ids.has('op-X')).toBe(true);
            expect(ids.has('op-Y')).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // getRelinkCandidates
    // -----------------------------------------------------------------------

    describe('getRelinkCandidates', () => {
        it('returns all AMFE operations as candidates', () => {
            const pfd = makePfdDoc([]);
            const amfe = makeAmfeDoc([
                { id: 'op-1', opNumber: '1', name: 'Corte' },
                { id: 'op-2', opNumber: '2', name: 'Soldadura' },
            ]);
            const { amfeCandidates } = getRelinkCandidates(pfd, amfe);

            expect(amfeCandidates).toHaveLength(2);
            expect(amfeCandidates[0]).toEqual({ id: 'op-1', label: '1 — Corte' });
            expect(amfeCandidates[1]).toEqual({ id: 'op-2', label: '2 — Soldadura' });
        });

        it('returns only linkable PFD step types as candidates', () => {
            const pfd = makePfdDoc([
                { id: 's1', stepNumber: '10', description: 'Op step', stepType: 'operation' },
                { id: 's2', stepNumber: '20', description: 'Insp step', stepType: 'inspection' },
                { id: 's3', stepNumber: '30', description: 'Combined step', stepType: 'combined' },
                { id: 's4', stepNumber: '40', description: 'Storage step', stepType: 'storage' },
                { id: 's5', stepNumber: '50', description: 'Transport step', stepType: 'transport' },
            ]);
            const amfe = makeAmfeDoc([]);
            const { pfdCandidates } = getRelinkCandidates(pfd, amfe);

            // Only operation, inspection, and combined are linkable
            expect(pfdCandidates).toHaveLength(3);
            expect(pfdCandidates.map(c => c.id)).toEqual(['s1', 's2', 's3']);
        });

        it('formats candidate labels with number and description', () => {
            const pfd = makePfdDoc([
                { id: 's1', stepNumber: '10', description: 'Corte láser', stepType: 'operation' },
            ]);
            const amfe = makeAmfeDoc([]);
            const { pfdCandidates } = getRelinkCandidates(pfd, amfe);

            expect(pfdCandidates[0].label).toBe('10 — Corte láser');
        });

        it('returns empty arrays for empty documents', () => {
            const { amfeCandidates, pfdCandidates } = getRelinkCandidates(
                makePfdDoc([]),
                makeAmfeDoc([]),
            );
            expect(amfeCandidates).toHaveLength(0);
            expect(pfdCandidates).toHaveLength(0);
        });
    });
});
