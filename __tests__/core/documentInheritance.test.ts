/**
 * Tests for the APQP Document Inheritance Engine
 *
 * Covers:
 * - regenerateUuids: UUID replacement and idMap generation
 * - cloneDocumentForVariant: per-module cloning with save + family link
 * - cloneAllMasterDocuments: batch cloning with partial failure handling
 */

import type { AmfeDocument } from '../../modules/amfe/amfeTypes';
import type { PfdDocument } from '../../modules/pfd/pfdTypes';
import type { ControlPlanDocument } from '../../modules/controlPlan/controlPlanTypes';
import type { HoDocument } from '../../modules/hojaOperaciones/hojaOperacionesTypes';
import type { FamilyDocument } from '../../utils/repositories/familyDocumentRepository';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports of the module under test
// ---------------------------------------------------------------------------

vi.mock('../../utils/repositories/amfeRepository', () => ({
    loadAmfeDocument: vi.fn(),
    saveAmfeDocument: vi.fn(),
}));

vi.mock('../../utils/repositories/pfdRepository', () => ({
    loadPfdDocument: vi.fn(),
    savePfdDocument: vi.fn(),
}));

vi.mock('../../utils/repositories/cpRepository', () => ({
    loadCpDocument: vi.fn(),
    saveCpDocument: vi.fn(),
}));

vi.mock('../../utils/repositories/hoRepository', () => ({
    loadHoDocument: vi.fn(),
    saveHoDocument: vi.fn(),
}));

vi.mock('../../utils/repositories/familyDocumentRepository', () => ({
    getFamilyMasterDocument: vi.fn(),
    linkDocumentToFamily: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('uuid', () => ({
    v4: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { v4 as uuidv4 } from 'uuid';
import {
    regenerateUuids,
    cloneDocumentForVariant,
    cloneAllMasterDocuments,
} from '../../core/inheritance/documentInheritance';
import { loadAmfeDocument, saveAmfeDocument } from '../../utils/repositories/amfeRepository';
import { loadPfdDocument, savePfdDocument } from '../../utils/repositories/pfdRepository';
import { loadCpDocument, saveCpDocument } from '../../utils/repositories/cpRepository';
import { loadHoDocument, saveHoDocument } from '../../utils/repositories/hoRepository';
import { getFamilyMasterDocument, linkDocumentToFamily } from '../../utils/repositories/familyDocumentRepository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_UUID_PREFIX = '00000000-0000-0000-0000-';
let uuidCounter = 0;

function resetUuidCounter(): void {
    uuidCounter = 0;
    (uuidv4 as ReturnType<typeof vi.fn>).mockImplementation(() => {
        uuidCounter++;
        return `${MOCK_UUID_PREFIX}${String(uuidCounter).padStart(12, '0')}`;
    });
}

function createMinimalAmfeDoc(): AmfeDocument {
    return {
        header: {
            organization: 'Barack Mercosul',
            location: 'Hurlingham',
            client: 'OEM',
            modelYear: '2026',
            subject: 'Inserto',
            startDate: '2026-01-01',
            revDate: '2026-02-01',
            team: 'Team',
            amfeNumber: 'AMFE-00005',
            responsible: 'Ing. Test',
            confidentiality: '',
            partNumber: 'PN-100',
            processResponsible: 'JP',
            revision: 'A',
            approvedBy: 'Boss',
            scope: 'Full',
            applicableParts: '',
        },
        operations: [
            {
                id: 'aaaaaaaa-1111-2222-3333-444444444444',
                opNumber: 'OP 10',
                name: 'Corte',
                workElements: [
                    {
                        id: 'bbbbbbbb-1111-2222-3333-444444444444',
                        type: 'Machine',
                        name: 'Prensa',
                        functions: [
                            {
                                id: 'cccccccc-1111-2222-3333-444444444444',
                                description: 'Cortar perfil',
                                requirements: '',
                                failures: [
                                    {
                                        id: 'dddddddd-1111-2222-3333-444444444444',
                                        description: 'Corte incompleto',
                                        effectLocal: 'Scrap',
                                        effectNextLevel: '',
                                        effectEndUser: '',
                                        severity: 7,
                                        causes: [
                                            {
                                                id: 'eeeeeeee-1111-2222-3333-444444444444',
                                                cause: 'Desgaste cuchilla',
                                                preventionControl: 'PM',
                                                detectionControl: 'Visual',
                                                occurrence: 4,
                                                detection: 3,
                                                ap: 'M',
                                                characteristicNumber: '1',
                                                specialChar: '',
                                                filterCode: '',
                                                preventionAction: '',
                                                detectionAction: '',
                                                responsible: '',
                                                targetDate: '',
                                                status: '',
                                                actionTaken: '',
                                                completionDate: '',
                                                severityNew: '',
                                                occurrenceNew: '',
                                                detectionNew: '',
                                                apNew: '',
                                                observations: '',
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

function createMinimalPfdDoc(): PfdDocument {
    return {
        id: 'f0f0f0f0-0001-0002-0003-000000000001',
        header: {
            partNumber: 'PN-100',
            partName: 'Inserto',
            engineeringChangeLevel: '',
            modelYear: '2026',
            documentNumber: 'PFD-001',
            revisionLevel: 'A',
            revisionDate: '2026-01-01',
            companyName: 'Barack Mercosul',
            plantLocation: 'Hurlingham',
            supplierCode: '',
            customerName: 'OEM',
            coreTeam: '',
            keyContact: '',
            processPhase: 'production',
            preparedBy: '',
            preparedDate: '',
            approvedBy: '',
            approvedDate: '',
        },
        steps: [
            {
                id: 'a1a1a1a1-0001-0002-0003-000000000001',
                stepNumber: 'OP 10',
                stepType: 'operation',
                description: 'Corte',
                machineDeviceTool: 'Prensa',
                productCharacteristic: '',
                productSpecialChar: 'none',
                processCharacteristic: '',
                processSpecialChar: 'none',
                reference: '',
                department: '',
                notes: '',
                isRework: false,
                isExternalProcess: false,
                reworkReturnStep: '',
                rejectDisposition: 'none',
                scrapDescription: '',
                branchId: '',
                branchLabel: '',
            },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    };
}

function createMinimalCpDoc(): ControlPlanDocument {
    return {
        header: {
            controlPlanNumber: 'CP-001',
            phase: 'production',
            partNumber: 'PN-100',
            latestChangeLevel: '',
            partName: 'Inserto',
            applicableParts: '',
            organization: 'Barack Mercosul',
            supplier: '',
            supplierCode: '',
            keyContactPhone: '',
            date: '2026-01-01',
            revision: 'A',
            responsible: 'Ing. Test',
            approvedBy: '',
            client: 'OEM',
            coreTeam: '',
            customerApproval: '',
            otherApproval: '',
            linkedAmfeProject: '',
        },
        items: [
            {
                id: 'b2b2b2b2-0001-0002-0003-000000000001',
                processStepNumber: 'OP 10',
                processDescription: 'Corte',
                machineDeviceTool: 'Prensa',
                characteristicNumber: '1',
                productCharacteristic: 'Longitud',
                processCharacteristic: '',
                specialCharClass: '',
                specification: '100 +/- 0.5mm',
                evaluationTechnique: 'Calibre',
                sampleSize: '5 pcs',
                sampleFrequency: 'Cada hora',
                controlMethod: 'SPC',
                reactionPlan: 'Detener',
                reactionPlanOwner: 'Supervisor',
                controlProcedure: 'P-001',
            },
        ],
    };
}

function createMinimalHoDoc(): HoDocument {
    return {
        header: {
            formNumber: 'I-IN-002.4-R01',
            organization: 'Barack Mercosul',
            client: 'OEM',
            partNumber: 'PN-100',
            partDescription: 'Inserto',
            applicableParts: '',
            linkedAmfeProject: '',
            linkedCpProject: '',
        },
        sheets: [
            {
                id: 'c3c3c3c3-0001-0002-0003-000000000001',
                amfeOperationId: 'aaaaaaaa-1111-2222-3333-444444444444',
                operationNumber: 'OP 10',
                operationName: 'Corte',
                hoNumber: 'HO-OP 10',
                sector: '',
                puestoNumber: '',
                vehicleModel: '',
                partCodeDescription: '',
                safetyElements: [],
                hazardWarnings: [],
                steps: [
                    {
                        id: 'd4d4d4d4-0001-0002-0003-000000000001',
                        stepNumber: 1,
                        description: 'Colocar pieza',
                        isKeyPoint: false,
                        keyPointReason: '',
                    },
                ],
                qualityChecks: [
                    {
                        id: 'e5e5e5e5-0001-0002-0003-000000000001',
                        characteristic: 'Longitud',
                        specification: '100 +/- 0.5mm',
                        evaluationTechnique: 'Calibre',
                        frequency: 'Cada hora',
                        controlMethod: 'SPC',
                        reactionAction: 'Detener',
                        reactionContact: 'Supervisor',
                        specialCharSymbol: '',
                        registro: '',
                    },
                ],
                reactionPlanText: 'Detener la operacion',
                reactionContact: 'Supervisor',
                visualAids: [
                    {
                        id: 'f6f6f6f6-0001-0002-0003-000000000001',
                        imageData: 'base64...',
                        caption: 'Vista frontal',
                        order: 0,
                    },
                ],
                preparedBy: '',
                approvedBy: '',
                date: '2026-01-01',
                revision: 'A',
                status: 'borrador',
            },
        ],
    };
}

function makeFamilyDocument(overrides: Partial<FamilyDocument> = {}): FamilyDocument {
    return {
        id: 100,
        familyId: 1,
        module: 'amfe',
        documentId: 'master-doc-id',
        isMaster: true,
        sourceMasterId: null,
        productId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('regenerateUuids', () => {
    beforeEach(() => {
        resetUuidCounter();
    });

    it('replaces UUID-shaped string id fields with fresh UUIDs and returns an idMap', () => {
        const input = {
            id: 'aaaaaaaa-1111-2222-3333-444444444444',
            name: 'Test',
            nested: {
                id: 'bbbbbbbb-1111-2222-3333-444444444444',
                value: 42,
            },
        };

        const { result, idMap } = regenerateUuids(input);
        const out = result as typeof input;

        // IDs should be replaced
        expect(out.id).not.toBe(input.id);
        expect(out.nested.id).not.toBe(input.nested.id);

        // Non-id fields should be untouched
        expect(out.name).toBe('Test');
        expect(out.nested.value).toBe(42);

        // idMap should have 2 entries
        expect(idMap.size).toBe(2);
        expect(idMap.get('aaaaaaaa-1111-2222-3333-444444444444')).toBe(out.id);
        expect(idMap.get('bbbbbbbb-1111-2222-3333-444444444444')).toBe(out.nested.id);
    });

    it('does NOT modify numeric ids or non-UUID strings', () => {
        const input = {
            id: 12345,
            code: 'not-a-uuid',
            items: [
                { id: 'short', value: 1 },
                { id: 99, value: 2 },
            ],
        };

        const { result, idMap } = regenerateUuids(input);
        const out = result as typeof input;

        expect(out.id).toBe(12345);
        expect(out.code).toBe('not-a-uuid');
        expect(out.items[0].id).toBe('short');
        expect(out.items[1].id).toBe(99);
        expect(idMap.size).toBe(0);
    });

    it('handles arrays of objects with UUID ids', () => {
        const input = [
            { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'A' },
            { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'B' },
        ];

        const { result, idMap } = regenerateUuids(input);
        const out = result as typeof input;

        expect(out[0].id).not.toBe(input[0].id);
        expect(out[1].id).not.toBe(input[1].id);
        expect(out[0].name).toBe('A');
        expect(idMap.size).toBe(2);
    });

    it('handles null and undefined values gracefully', () => {
        const input = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', field: null, other: undefined };

        const { result } = regenerateUuids(input);
        const out = result as typeof input;

        expect(out.field).toBeNull();
        expect(out.other).toBeUndefined();
    });

    it('reuses the same new UUID for duplicate old UUIDs', () => {
        const sharedId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        const input = {
            items: [
                { id: sharedId, ref: 'x' },
                { id: sharedId, ref: 'y' },
            ],
        };

        const { result, idMap } = regenerateUuids(input);
        const out = result as typeof input;

        expect(out.items[0].id).toBe(out.items[1].id);
        expect(idMap.size).toBe(1);
    });
});

describe('cloneDocumentForVariant', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetUuidCounter();
    });

    describe('module: amfe', () => {
        it('loads, clones, saves with new ID, and registers in family_documents', async () => {
            const amfeDoc = createMinimalAmfeDoc();
            (loadAmfeDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
                doc: amfeDoc,
                meta: {
                    id: 'master-amfe-id',
                    amfeNumber: 'AMFE-00005',
                    projectName: 'Inserto Patagonia',
                    status: 'draft',
                },
            });
            (saveAmfeDocument as ReturnType<typeof vi.fn>).mockResolvedValue(true);
            (linkDocumentToFamily as ReturnType<typeof vi.fn>).mockResolvedValue(42);

            const result = await cloneDocumentForVariant({
                familyId: 1,
                module: 'amfe',
                masterDocumentId: 'master-amfe-id',
                masterFamilyDocId: 100,
                variantLabel: 'L0',
                productId: 10,
            });

            expect(result.success).toBe(true);
            expect(result.newDocumentId).toBeTruthy();
            expect(result.familyDocId).toBe(42);
            expect(result.error).toBeUndefined();

            // Verify save was called with variant label in project name
            expect(saveAmfeDocument).toHaveBeenCalledTimes(1);
            const saveCall = (saveAmfeDocument as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(saveCall[2]).toBe('Inserto Patagonia [L0]'); // projectName
            const savedDoc = saveCall[3] as AmfeDocument;
            expect(savedDoc.header.amfeNumber).toBe('AMFE-00005 [L0]');

            // Verify IDs are regenerated (not the originals)
            expect(savedDoc.operations[0].id).not.toBe(amfeDoc.operations[0].id);

            // Verify family link
            expect(linkDocumentToFamily).toHaveBeenCalledWith({
                familyId: 1,
                module: 'amfe',
                documentId: result.newDocumentId,
                isMaster: false,
                sourceMasterId: 100,
                productId: 10,
            });
        });
    });

    describe('module: pfd', () => {
        it('loads, clones, saves with new ID, and registers in family_documents', async () => {
            const pfdDoc = createMinimalPfdDoc();
            (loadPfdDocument as ReturnType<typeof vi.fn>).mockResolvedValue(pfdDoc);
            (savePfdDocument as ReturnType<typeof vi.fn>).mockResolvedValue(true);
            (linkDocumentToFamily as ReturnType<typeof vi.fn>).mockResolvedValue(43);

            const result = await cloneDocumentForVariant({
                familyId: 1,
                module: 'pfd',
                masterDocumentId: 'pfd-master-id',
                masterFamilyDocId: 101,
                variantLabel: 'L1',
            });

            expect(result.success).toBe(true);
            expect(result.newDocumentId).toBeTruthy();
            expect(result.familyDocId).toBe(43);

            // Verify save was called
            expect(savePfdDocument).toHaveBeenCalledTimes(1);
            const saveCall = (savePfdDocument as ReturnType<typeof vi.fn>).mock.calls[0];
            const savedDoc = saveCall[1] as PfdDocument;
            expect(savedDoc.header.partName).toBe('Inserto [L1]');
            expect(savedDoc.header.documentNumber).toBe('PFD-001-L1');

            // Step IDs are regenerated
            expect(savedDoc.steps[0].id).not.toBe(pfdDoc.steps[0].id);

            // Family link
            expect(linkDocumentToFamily).toHaveBeenCalledWith(
                expect.objectContaining({
                    familyId: 1,
                    module: 'pfd',
                    isMaster: false,
                    sourceMasterId: 101,
                })
            );
        });
    });

    describe('module: cp', () => {
        it('loads, clones, saves with new ID, and registers in family_documents', async () => {
            const cpDoc = createMinimalCpDoc();
            (loadCpDocument as ReturnType<typeof vi.fn>).mockResolvedValue(cpDoc);
            (saveCpDocument as ReturnType<typeof vi.fn>).mockResolvedValue(true);
            (linkDocumentToFamily as ReturnType<typeof vi.fn>).mockResolvedValue(44);

            const result = await cloneDocumentForVariant({
                familyId: 1,
                module: 'cp',
                masterDocumentId: 'master-cp-id',
                masterFamilyDocId: 102,
                variantLabel: 'R0',
            });

            expect(result.success).toBe(true);
            expect(result.newDocumentId).toBeTruthy();

            const saveCall = (saveCpDocument as ReturnType<typeof vi.fn>).mock.calls[0];
            const savedDoc = saveCall[2] as ControlPlanDocument;
            expect(savedDoc.header.controlPlanNumber).toBe('CP-001 [R0]');
            expect(savedDoc.header.partName).toBe('Inserto [R0]');
            expect(savedDoc.items[0].id).not.toBe(cpDoc.items[0].id);
        });
    });

    describe('module: ho', () => {
        it('loads, clones, saves with new ID, and registers in family_documents', async () => {
            const hoDoc = createMinimalHoDoc();
            (loadHoDocument as ReturnType<typeof vi.fn>).mockResolvedValue(hoDoc);
            (saveHoDocument as ReturnType<typeof vi.fn>).mockResolvedValue(true);
            (linkDocumentToFamily as ReturnType<typeof vi.fn>).mockResolvedValue(45);

            const result = await cloneDocumentForVariant({
                familyId: 1,
                module: 'ho',
                masterDocumentId: 'master-ho-id',
                masterFamilyDocId: 103,
                variantLabel: 'L2',
            });

            expect(result.success).toBe(true);
            expect(result.newDocumentId).toBeTruthy();

            const saveCall = (saveHoDocument as ReturnType<typeof vi.fn>).mock.calls[0];
            const savedDoc = saveCall[1] as HoDocument;
            expect(savedDoc.header.partDescription).toBe('Inserto [L2]');
            expect(savedDoc.sheets[0].id).not.toBe(hoDoc.sheets[0].id);
            expect(savedDoc.sheets[0].steps[0].id).not.toBe(hoDoc.sheets[0].steps[0].id);
        });
    });

    it('returns error if the document does not exist', async () => {
        (loadAmfeDocument as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const result = await cloneDocumentForVariant({
            familyId: 1,
            module: 'amfe',
            masterDocumentId: 'nonexistent',
            masterFamilyDocId: 100,
            variantLabel: 'X',
        });

        expect(result.success).toBe(false);
        expect(result.newDocumentId).toBeNull();
        expect(result.familyDocId).toBeNull();
        expect(result.error).toContain('not found');
    });

    it('returns error if save fails', async () => {
        const amfeDoc = createMinimalAmfeDoc();
        (loadAmfeDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
            doc: amfeDoc,
            meta: { id: 'id', amfeNumber: 'AMFE-001', projectName: 'P', status: 'draft' },
        });
        (saveAmfeDocument as ReturnType<typeof vi.fn>).mockResolvedValue(false);

        const result = await cloneDocumentForVariant({
            familyId: 1,
            module: 'amfe',
            masterDocumentId: 'id',
            masterFamilyDocId: 100,
            variantLabel: 'X',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to save');
    });
});

describe('cloneAllMasterDocuments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetUuidCounter();
    });

    it('clones only modules that have a master document', async () => {
        // Only AMFE and PFD have masters
        (getFamilyMasterDocument as ReturnType<typeof vi.fn>).mockImplementation(
            async (_familyId: number, module: string) => {
                if (module === 'amfe') return makeFamilyDocument({ module: 'amfe', documentId: 'amfe-master' });
                if (module === 'pfd') return makeFamilyDocument({ id: 101, module: 'pfd', documentId: 'pfd-master' });
                return null;
            }
        );

        // Mock load + save for AMFE
        (loadAmfeDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
            doc: createMinimalAmfeDoc(),
            meta: { id: 'amfe-master', amfeNumber: 'AMFE-001', projectName: 'P', status: 'draft' },
        });
        (saveAmfeDocument as ReturnType<typeof vi.fn>).mockResolvedValue(true);

        // Mock load + save for PFD
        (loadPfdDocument as ReturnType<typeof vi.fn>).mockResolvedValue(createMinimalPfdDoc());
        (savePfdDocument as ReturnType<typeof vi.fn>).mockResolvedValue(true);

        (linkDocumentToFamily as ReturnType<typeof vi.fn>).mockResolvedValue(50);

        const { results, errors } = await cloneAllMasterDocuments({
            familyId: 1,
            variantLabel: 'L0',
        });

        // AMFE and PFD should succeed
        expect(results.amfe?.success).toBe(true);
        expect(results.pfd?.success).toBe(true);

        // CP and HO should be null (no master)
        expect(results.cp).toBeNull();
        expect(results.ho).toBeNull();

        expect(errors).toHaveLength(0);
    });

    it('continues if one module fails (does not abort the entire batch)', async () => {
        // All 4 modules have masters
        (getFamilyMasterDocument as ReturnType<typeof vi.fn>).mockImplementation(
            async (_familyId: number, module: string) => {
                return makeFamilyDocument({ id: 100, module, documentId: `${module}-master` });
            }
        );

        // AMFE: will fail to load
        (loadAmfeDocument as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        // PFD: success
        (loadPfdDocument as ReturnType<typeof vi.fn>).mockResolvedValue(createMinimalPfdDoc());
        (savePfdDocument as ReturnType<typeof vi.fn>).mockResolvedValue(true);

        // CP: success
        (loadCpDocument as ReturnType<typeof vi.fn>).mockResolvedValue(createMinimalCpDoc());
        (saveCpDocument as ReturnType<typeof vi.fn>).mockResolvedValue(true);

        // HO: throws an unexpected error
        (loadHoDocument as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB timeout'));

        (linkDocumentToFamily as ReturnType<typeof vi.fn>).mockResolvedValue(50);

        const { results, errors } = await cloneAllMasterDocuments({
            familyId: 1,
            variantLabel: 'V1',
        });

        // PFD + CP should succeed
        expect(results.pfd?.success).toBe(true);
        expect(results.cp?.success).toBe(true);

        // AMFE should fail gracefully
        expect(results.amfe?.success).toBe(false);
        expect(results.amfe?.error).toContain('not found');

        // HO should fail with the unexpected error
        expect(results.ho?.success).toBe(false);
        expect(results.ho?.error).toContain('DB timeout');

        // 2 errors total
        expect(errors).toHaveLength(2);
        expect(errors.some(e => e.includes('[AMFE]'))).toBe(true);
        expect(errors.some(e => e.includes('[HO]'))).toBe(true);
    });

    it('returns empty results when no module has a master', async () => {
        (getFamilyMasterDocument as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const { results, errors } = await cloneAllMasterDocuments({
            familyId: 99,
            variantLabel: 'X',
        });

        expect(results.pfd).toBeNull();
        expect(results.amfe).toBeNull();
        expect(results.cp).toBeNull();
        expect(results.ho).toBeNull();
        expect(errors).toHaveLength(0);
    });
});
