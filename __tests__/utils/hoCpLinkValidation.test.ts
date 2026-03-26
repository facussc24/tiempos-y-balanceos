/**
 * Tests for hoCpLinkValidation — pure functions, no mocks needed.
 */

import {
    validateHoCpLinks,
    getBrokenHoCheckIds,
    getCpRelinkCandidates,
} from '../../utils/hoCpLinkValidation';
import type { HoDocument } from '../../modules/hojaOperaciones/hojaOperacionesTypes';
import type { ControlPlanDocument } from '../../modules/controlPlan/controlPlanTypes';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeHoDoc(sheets: { id: string; name?: string; checks: { id: string; characteristic?: string; cpItemId?: string }[] }[]): HoDocument {
    return {
        header: {
            formNumber: 'I-IN-002.4-R01',
            organization: 'Test Org',
            client: 'Client',
            partNumber: 'P-100',
            partDescription: 'Test Part',
            applicableParts: '',
            linkedAmfeProject: 'amfe-1',
            linkedCpProject: 'cp-1',
        },
        sheets: sheets.map(s => ({
            id: s.id,
            amfeOperationId: '',
            operationNumber: '10',
            operationName: s.name ?? `Sheet ${s.id}`,
            hoNumber: 'HO-001',
            sector: '',
            puestoNumber: '',
            vehicleModel: '',
            partCodeDescription: '',
            safetyElements: [],
            hazardWarnings: [],
            steps: [],
            qualityChecks: s.checks.map(c => ({
                id: c.id,
                characteristic: c.characteristic ?? `Char ${c.id}`,
                specification: '',
                evaluationTechnique: '',
                frequency: '',
                controlMethod: '',
                reactionAction: '',
                reactionContact: '',
                specialCharSymbol: '',
                registro: '',
                cpItemId: c.cpItemId,
            })),
            reactionPlanText: '',
            reactionContact: '',
            visualAids: [],
            preparedBy: '',
            approvedBy: '',
            date: '2026-01-01',
            revision: 'A',
            status: 'borrador' as const,
        })),
    } as HoDocument;
}

function makeCpDoc(items: { id: string; stepNumber?: string; productChar?: string; processChar?: string }[]): ControlPlanDocument {
    return {
        header: {
            controlPlanNumber: 'CP-001',
            phase: 'production' as const,
            partNumber: 'P-100',
            latestChangeLevel: '',
            partName: 'Test Part',
            applicableParts: '',
            organization: 'Test Org',
            supplier: '',
            supplierCode: '',
            keyContactPhone: '',
            date: '2026-01-01',
            revision: 'A',
            responsible: '',
            approvedBy: '',
            client: 'Client',
            coreTeam: '',
            customerApproval: '',
            otherApproval: '',
            linkedAmfeProject: 'amfe-1',
        },
        items: items.map(item => ({
            id: item.id,
            processStepNumber: item.stepNumber ?? '10',
            processDescription: '',
            machineDeviceTool: '',
            characteristicNumber: '',
            productCharacteristic: item.productChar ?? '',
            processCharacteristic: item.processChar ?? '',
            specialCharClass: '',
            specification: '',
            evaluationTechnique: '',
            sampleSize: '',
            sampleFrequency: '',
            controlMethod: '',
            reactionPlan: '',
            reactionPlanOwner: '',
            controlProcedure: '',
        })),
    } as ControlPlanDocument;
}

// ---------------------------------------------------------------------------
// validateHoCpLinks
// ---------------------------------------------------------------------------

describe('hoCpLinkValidation', () => {
    describe('validateHoCpLinks', () => {
        it('returns isValid=false when hoDoc is null', () => {
            const result = validateHoCpLinks(null, makeCpDoc([]));
            expect(result.isValid).toBe(false);
            expect(result.totalBroken).toBe(0);
        });

        it('returns isValid=false when cpDoc is null', () => {
            const result = validateHoCpLinks(makeHoDoc([]), null);
            expect(result.isValid).toBe(false);
            expect(result.totalBroken).toBe(0);
        });

        it('returns isValid=false when both docs are null', () => {
            const result = validateHoCpLinks(null, null);
            expect(result.isValid).toBe(false);
        });

        it('returns no broken links when no cpItemId references exist', () => {
            const ho = makeHoDoc([{ id: 'sheet-1', checks: [{ id: 'qc-1' }] }]);
            const cp = makeCpDoc([{ id: 'cp-item-1' }]);
            const result = validateHoCpLinks(ho, cp);

            expect(result.isValid).toBe(true);
            expect(result.totalBroken).toBe(0);
            expect(result.brokenLinks).toHaveLength(0);
        });

        it('returns no broken links when all cpItemId references are valid', () => {
            const ho = makeHoDoc([{
                id: 'sheet-1',
                checks: [
                    { id: 'qc-1', cpItemId: 'cp-item-1' },
                    { id: 'qc-2', cpItemId: 'cp-item-2' },
                ],
            }]);
            const cp = makeCpDoc([{ id: 'cp-item-1' }, { id: 'cp-item-2' }]);
            const result = validateHoCpLinks(ho, cp);

            expect(result.isValid).toBe(true);
            expect(result.totalBroken).toBe(0);
        });

        it('detects broken HO → CP link', () => {
            const ho = makeHoDoc([{
                id: 'sheet-1',
                name: 'Corte',
                checks: [{ id: 'qc-1', characteristic: 'Diámetro', cpItemId: 'cp-DELETED' }],
            }]);
            const cp = makeCpDoc([{ id: 'cp-item-1' }]);
            const result = validateHoCpLinks(ho, cp);

            expect(result.totalBroken).toBe(1);
            expect(result.brokenLinks).toHaveLength(1);
            expect(result.brokenLinks[0]).toEqual({
                sheetId: 'sheet-1',
                sheetName: 'Corte',
                checkId: 'qc-1',
                characteristic: 'Diámetro',
                cpItemId: 'cp-DELETED',
            });
        });

        it('detects broken links across multiple sheets', () => {
            const ho = makeHoDoc([
                {
                    id: 'sheet-1',
                    checks: [{ id: 'qc-1', cpItemId: 'cp-MISSING-A' }],
                },
                {
                    id: 'sheet-2',
                    checks: [
                        { id: 'qc-2', cpItemId: 'cp-item-1' }, // valid
                        { id: 'qc-3', cpItemId: 'cp-MISSING-B' },
                    ],
                },
            ]);
            const cp = makeCpDoc([{ id: 'cp-item-1' }]);
            const result = validateHoCpLinks(ho, cp);

            expect(result.totalBroken).toBe(2);
            expect(result.brokenLinks).toHaveLength(2);
            expect(result.brokenLinks[0].checkId).toBe('qc-1');
            expect(result.brokenLinks[1].checkId).toBe('qc-3');
        });

        it('ignores checks with no cpItemId', () => {
            const ho = makeHoDoc([{
                id: 'sheet-1',
                checks: [
                    { id: 'qc-1' },                         // no cpItemId
                    { id: 'qc-2', cpItemId: undefined },     // explicit undefined
                ],
            }]);
            const cp = makeCpDoc([{ id: 'cp-item-1' }]);
            const result = validateHoCpLinks(ho, cp);

            expect(result.totalBroken).toBe(0);
            expect(result.isValid).toBe(true);
        });

        it('ignores empty string cpItemId', () => {
            const ho = makeHoDoc([{
                id: 'sheet-1',
                checks: [{ id: 'qc-1', cpItemId: '' }],
            }]);
            const cp = makeCpDoc([{ id: 'cp-item-1' }]);
            const result = validateHoCpLinks(ho, cp);

            expect(result.totalBroken).toBe(0);
        });

        it('handles empty documents', () => {
            const ho = makeHoDoc([]);
            const cp = makeCpDoc([]);
            const result = validateHoCpLinks(ho, cp);

            expect(result.isValid).toBe(true);
            expect(result.totalBroken).toBe(0);
        });

        it('handles sheet with empty qualityChecks', () => {
            const ho = makeHoDoc([{ id: 'sheet-1', checks: [] }]);
            const cp = makeCpDoc([{ id: 'cp-item-1' }]);
            const result = validateHoCpLinks(ho, cp);

            expect(result.isValid).toBe(true);
            expect(result.totalBroken).toBe(0);
        });

        it('uses operationName for sheetName in broken link', () => {
            const ho = makeHoDoc([{
                id: 'sheet-1',
                name: 'Soldadura MIG',
                checks: [{ id: 'qc-1', cpItemId: 'cp-GONE' }],
            }]);
            const cp = makeCpDoc([]);
            const result = validateHoCpLinks(ho, cp);

            expect(result.brokenLinks[0].sheetName).toBe('Soldadura MIG');
        });
    });

    // -----------------------------------------------------------------------
    // getBrokenHoCheckIds
    // -----------------------------------------------------------------------

    describe('getBrokenHoCheckIds', () => {
        it('returns empty set when no broken links', () => {
            const result = validateHoCpLinks(makeHoDoc([]), makeCpDoc([]));
            expect(getBrokenHoCheckIds(result).size).toBe(0);
        });

        it('returns set of broken check IDs', () => {
            const ho = makeHoDoc([{
                id: 'sheet-1',
                checks: [
                    { id: 'qc-A', cpItemId: 'cp-MISSING' },
                    { id: 'qc-B', cpItemId: 'cp-ALSO-MISSING' },
                    { id: 'qc-C', cpItemId: 'cp-item-1' },
                ],
            }]);
            const cp = makeCpDoc([{ id: 'cp-item-1' }]);
            const result = validateHoCpLinks(ho, cp);
            const ids = getBrokenHoCheckIds(result);

            expect(ids.size).toBe(2);
            expect(ids.has('qc-A')).toBe(true);
            expect(ids.has('qc-B')).toBe(true);
            expect(ids.has('qc-C')).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // getCpRelinkCandidates
    // -----------------------------------------------------------------------

    describe('getCpRelinkCandidates', () => {
        it('returns all CP items as candidates', () => {
            const cp = makeCpDoc([
                { id: 'cp-1', stepNumber: '10', productChar: 'Diámetro' },
                { id: 'cp-2', stepNumber: '20', productChar: 'Rugosidad' },
            ]);
            const candidates = getCpRelinkCandidates(cp);

            expect(candidates).toHaveLength(2);
            expect(candidates[0]).toEqual({ id: 'cp-1', label: '10 — Diámetro' });
            expect(candidates[1]).toEqual({ id: 'cp-2', label: '20 — Rugosidad' });
        });

        it('uses processCharacteristic when productCharacteristic is empty', () => {
            const cp = makeCpDoc([
                { id: 'cp-1', stepNumber: '10', productChar: '', processChar: 'Temperatura' },
            ]);
            const candidates = getCpRelinkCandidates(cp);

            expect(candidates[0].label).toBe('10 — Temperatura');
        });

        it('shows fallback label when both characteristics are empty', () => {
            const cp = makeCpDoc([
                { id: 'cp-1', stepNumber: '10', productChar: '', processChar: '' },
            ]);
            const candidates = getCpRelinkCandidates(cp);

            expect(candidates[0].label).toBe('10 — (sin característica)');
        });

        it('returns empty array for empty CP', () => {
            const candidates = getCpRelinkCandidates(makeCpDoc([]));
            expect(candidates).toHaveLength(0);
        });
    });
});
