/**
 * Tests for cross-family propagation of process-master AMFE changes.
 *
 * Covers:
 * - propagateMasterAcrossFamilies scans other amfe_documents, matches ops, creates alerts
 * - Gate: only runs for families whose name starts with "Proceso de"
 * - Gate: only runs for module === 'amfe'
 * - Zero matches → no alerts
 * - Multiple matches on same doc → one alert with aggregated matched ops
 * - triggerCrossFamilyPropagation swallows errors (fire-and-forget)
 * - normalizeOperationName helper strips diacritics / case / whitespace
 */

import type { AmfeDocument, AmfeOperation } from '../../../modules/amfe/amfeTypes';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 });
const mockSelect = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/database', () => ({
    getDatabase: vi.fn().mockResolvedValue({
        execute: (...args: unknown[]) => mockExecute(...args),
        select: (...args: unknown[]) => mockSelect(...args),
        close: vi.fn(),
    }),
}));

vi.mock('../../../utils/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockGetDocumentFamilyInfo = vi.fn();
const mockGetVariantDocuments = vi.fn().mockResolvedValue([]);
const mockListOverrides = vi.fn().mockResolvedValue([]);
const mockCreateProposal = vi.fn().mockResolvedValue(1);

vi.mock('../../../utils/repositories/familyDocumentRepository', () => ({
    getDocumentFamilyInfo: (...args: unknown[]) => mockGetDocumentFamilyInfo(...args),
    getVariantDocuments: (...args: unknown[]) => mockGetVariantDocuments(...args),
    listOverrides: (...args: unknown[]) => mockListOverrides(...args),
    createProposal: (...args: unknown[]) => mockCreateProposal(...args),
    addOverride: vi.fn().mockResolvedValue(1),
}));

const mockGetFamilyById = vi.fn();
vi.mock('../../../utils/repositories/familyRepository', () => ({
    getFamilyById: (...args: unknown[]) => mockGetFamilyById(...args),
}));

const mockCreateCrossFamilyAlert = vi.fn().mockResolvedValue(true);
const mockUpsertCrossDocCheck = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../utils/crossDocumentAlerts', async () => {
    const actual = await vi.importActual<typeof import('../../../utils/crossDocumentAlerts')>(
        '../../../utils/crossDocumentAlerts',
    );
    return {
        ...actual,
        createCrossFamilyAlert: (...args: unknown[]) => mockCreateCrossFamilyAlert(...args),
    };
});

vi.mock('../../../utils/repositories/crossDocRepository', () => ({
    upsertCrossDocCheck: (...args: unknown[]) => mockUpsertCrossDocCheck(...args),
    acknowledgeCrossDocAlert: vi.fn(),
    getPendingAlerts: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
    propagateMasterAcrossFamilies,
    triggerCrossFamilyPropagation,
    normalizeOperationName,
    matchOperationName,
} from '../../../core/inheritance/changePropagation';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

function makeOp(opNumber: string, name: string): AmfeOperation {
    return {
        id: `op-${opNumber}`,
        opNumber,
        name,
        workElements: [],
        focusElementFunction: '',
        operationFunction: '',
    };
}

function makeAmfe(subject: string, opNames: string[]): AmfeDocument {
    return {
        header: {
            organization: 'Barack',
            location: 'Cordoba',
            client: 'VWA',
            modelYear: '2026',
            subject,
            startDate: '',
            revDate: '',
            team: '',
            amfeNumber: 'AMFE-TEST',
            responsible: '',
            confidentiality: '',
            partNumber: '',
            processResponsible: '',
            revision: 'A',
            approvedBy: '',
            scope: '',
            applicableParts: '',
        },
        operations: opNames.map((n, i) => makeOp(String((i + 1) * 10), n)),
    } as unknown as AmfeDocument;
}

function makeAmfeRow(id: string, subject: string, opNames: string[], dataAsObject = false) {
    const doc = makeAmfe(subject, opNames);
    return {
        id,
        subject,
        project_name: `test/${subject}`,
        data: dataAsObject ? doc : JSON.stringify(doc),
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('normalizeOperationName', () => {
    it('uppercases, trims, and strips diacritics', () => {
        expect(normalizeOperationName('  Inyección plástica  ')).toBe('INYECCION PLASTICA');
        expect(normalizeOperationName('Recepción de Materia Prima')).toBe('RECEPCION DE MATERIA PRIMA');
    });

    it('returns empty string for non-strings', () => {
        expect(normalizeOperationName(null)).toBe('');
        expect(normalizeOperationName(undefined)).toBe('');
        expect(normalizeOperationName(42)).toBe('');
    });
});

describe('matchOperationName', () => {
    const masters = ['INYECCION', 'RECEPCION Y PREPARACION DE MATERIA PRIMA'];

    it('matches exactly on normalized name', () => {
        expect(matchOperationName('INYECCION', masters)).toBe('INYECCION');
    });

    it('matches substring when master name is inside target', () => {
        expect(matchOperationName('INYECCION DE PIEZA PLASTICA', masters)).toBe('INYECCION');
        expect(matchOperationName('INYECCION DE SUSTRATO', masters)).toBe('INYECCION');
    });

    it('does not match short stopwords or single-word overlaps', () => {
        // 'DE' would be <5 chars so substring is rejected
        expect(matchOperationName('CORTE DE COMPONENTES', ['DE'])).toBeNull();
    });

    it('returns null when no match', () => {
        expect(matchOperationName('COSTURA UNION', masters)).toBeNull();
    });
});

describe('propagateMasterAcrossFamilies', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSelect.mockResolvedValue([]);
        mockCreateCrossFamilyAlert.mockResolvedValue(true);
    });

    it('scans all other AMFEs and creates one alert per affected doc (proceso family)', async () => {
        const oldMasterDoc = makeAmfe('Proceso de Inyeccion Plastica Estandar', [
            'RECEPCION Y PREPARACION DE MATERIA PRIMA',
            'INYECCION',
        ]);
        const masterDoc = makeAmfe('Proceso de Inyeccion Plastica Estandar', [
            'RECEPCION Y PREPARACION DE MATERIA PRIMA',
            'INYECCION',
            'CONTROL DIMENSIONAL POST-INYECCION Y CORTE DE COLADA',
        ]);
        // Simulate other amfes — 3 should match INYECCION in some way, 1 should not
        mockSelect.mockResolvedValue([
            makeAmfeRow('doc-a', 'TRIM ASM-UPR WRAPPING', ['RECEPCION DE MATERIA PRIMA', 'INYECCION', 'CORTE']),
            makeAmfeRow('doc-b', 'Headrest Front', ['RECEPCION DE MATERIA PRIMA', 'INYECCION DE SUSTRATO']),
            makeAmfeRow('doc-c', 'Top Roll', ['INYECCION DE PIEZA PLASTICA', 'CORTE']),
            makeAmfeRow('doc-d', 'Telas Planas', ['CORTE', 'COSTURA']),
        ]);

        const result = await propagateMasterAcrossFamilies({
            familyId: 15,
            familyName: 'Proceso de Inyeccion Plastica',
            module: 'amfe',
            masterDocId: 'master-1',
            oldDoc: oldMasterDoc,
            newDoc: masterDoc,
        });

        expect(result.scannedDocs).toBe(4);
        expect(result.affectedDocs).toBe(3);
        expect(result.alertsCreated).toBe(3);
        expect(mockCreateCrossFamilyAlert).toHaveBeenCalledTimes(3);
        const affectedIds = result.matches.map(m => m.targetDocId).sort();
        expect(affectedIds).toEqual(['doc-a', 'doc-b', 'doc-c']);
    });

    it('does NOT run for non-process families', async () => {
        const masterDoc = makeAmfe('Insert Patagonia Master', ['CORTE', 'COSTURA']);
        mockSelect.mockResolvedValue([
            makeAmfeRow('doc-x', 'Some Variant', ['CORTE']),
        ]);

        const result = await propagateMasterAcrossFamilies({
            familyId: 1,
            familyName: 'Insert Patagonia',
            module: 'amfe',
            masterDocId: 'master-2',
            oldDoc: masterDoc,
            newDoc: masterDoc,
        });

        expect(result.scannedDocs).toBe(0);
        expect(result.affectedDocs).toBe(0);
        expect(result.alertsCreated).toBe(0);
        expect(mockSelect).not.toHaveBeenCalled();
        expect(mockCreateCrossFamilyAlert).not.toHaveBeenCalled();
    });

    it('does NOT run for non-amfe modules', async () => {
        const masterDoc = makeAmfe('Proceso de Inyeccion Plastica', ['INYECCION']);
        const result = await propagateMasterAcrossFamilies({
            familyId: 15,
            familyName: 'Proceso de Inyeccion Plastica',
            module: 'cp',
            masterDocId: 'master-3',
            oldDoc: masterDoc,
            newDoc: masterDoc,
        });

        expect(result.scannedDocs).toBe(0);
        expect(result.affectedDocs).toBe(0);
        expect(result.alertsCreated).toBe(0);
        expect(mockSelect).not.toHaveBeenCalled();
        expect(mockCreateCrossFamilyAlert).not.toHaveBeenCalled();
    });

    it('does not alert a doc with no matching operations', async () => {
        const oldMasterDoc = makeAmfe('Proceso de Inyeccion', []);
        const masterDoc = makeAmfe('Proceso de Inyeccion', ['INYECCION']);
        mockSelect.mockResolvedValue([
            makeAmfeRow('doc-y', 'Costura Only', ['COSTURA', 'ENVASADO']),
        ]);

        const result = await propagateMasterAcrossFamilies({
            familyId: 15,
            familyName: 'Proceso de Inyeccion Plastica',
            module: 'amfe',
            masterDocId: 'master-4',
            oldDoc: oldMasterDoc,
            newDoc: masterDoc,
        });

        expect(result.scannedDocs).toBe(1);
        expect(result.affectedDocs).toBe(0);
        expect(result.alertsCreated).toBe(0);
        expect(mockCreateCrossFamilyAlert).not.toHaveBeenCalled();
    });

    it('creates exactly one alert even when a doc matches multiple master ops', async () => {
        const oldMasterDoc = makeAmfe('Proceso de Inyeccion', ['INYECCION']);
        const masterDoc = makeAmfe('Proceso de Inyeccion', [
            'INYECCION',
            'CONTROL DIMENSIONAL POST-INYECCION',
        ]);
        mockSelect.mockResolvedValue([
            makeAmfeRow('doc-z', 'Double Match', [
                'INYECCION DE SUSTRATO',                // matches "INYECCION"
                'CONTROL DIMENSIONAL POST-INYECCION Y CORTE',  // matches 2nd
            ]),
        ]);

        const result = await propagateMasterAcrossFamilies({
            familyId: 15,
            familyName: 'Proceso de Inyeccion Plastica',
            module: 'amfe',
            masterDocId: 'master-5',
            oldDoc: oldMasterDoc,
            newDoc: masterDoc,
        });

        expect(result.scannedDocs).toBe(1);
        expect(result.affectedDocs).toBe(1);
        expect(result.alertsCreated).toBe(1);
        expect(mockCreateCrossFamilyAlert).toHaveBeenCalledTimes(1);
        // Both matched op names should be in the match record
        expect(result.matches[0].matchedOperationNames.length).toBe(2);
    });

    it('parses data column whether stored as string or object', async () => {
        const oldMasterDoc = makeAmfe('Proceso de Inyeccion', []);
        const masterDoc = makeAmfe('Proceso de Inyeccion', ['INYECCION']);
        mockSelect.mockResolvedValue([
            makeAmfeRow('doc-str', 'As String', ['INYECCION DE ALGO'], false),
            makeAmfeRow('doc-obj', 'As Object', ['INYECCION DE OTRO'], true),
        ]);

        const result = await propagateMasterAcrossFamilies({
            familyId: 15,
            familyName: 'Proceso de Inyeccion Plastica',
            module: 'amfe',
            masterDocId: 'master-6',
            oldDoc: oldMasterDoc,
            newDoc: masterDoc,
        });

        expect(result.affectedDocs).toBe(2);
    });

    it('short-circuits when master has no operations', async () => {
        const emptyMaster = makeAmfe('Proceso de Inyeccion Vacio', []);
        const result = await propagateMasterAcrossFamilies({
            familyId: 15,
            familyName: 'Proceso de Inyeccion Plastica',
            module: 'amfe',
            masterDocId: 'master-7',
            oldDoc: emptyMaster,
            newDoc: emptyMaster,
        });
        expect(result.scannedDocs).toBe(0);
        expect(mockSelect).not.toHaveBeenCalled();
    });

    it('short-circuits when the set of operation names is unchanged (cosmetic save)', async () => {
        const masterDoc = makeAmfe('Proceso de Inyeccion', ['INYECCION', 'SECADO']);
        mockSelect.mockResolvedValue([
            makeAmfeRow('doc-any', 'Any', ['INYECCION DE ALGO']),
        ]);

        const result = await propagateMasterAcrossFamilies({
            familyId: 15,
            familyName: 'Proceso de Inyeccion Plastica',
            module: 'amfe',
            masterDocId: 'master-no-change',
            oldDoc: masterDoc,
            newDoc: masterDoc,
        });

        expect(result.scannedDocs).toBe(0);
        expect(result.affectedDocs).toBe(0);
        expect(result.alertsCreated).toBe(0);
        expect(mockSelect).not.toHaveBeenCalled();
        expect(mockCreateCrossFamilyAlert).not.toHaveBeenCalled();
    });

    it('rejects incompatible-process markers: PU/POLIURETANO/ESPUMADO', async () => {
        const oldMasterDoc = makeAmfe('Proceso de Inyeccion', []);
        const masterDoc = makeAmfe('Proceso de Inyeccion', ['INYECCION']);
        mockSelect.mockResolvedValue([
            makeAmfeRow('doc-pu', 'Armrest PU', ['INYECCION PU']),
            makeAmfeRow('doc-esp', 'Foam ESPUMADO', ['ESPUMADO']),
            makeAmfeRow('doc-ok', 'Regular', ['INYECCION DE PIEZAS PLASTICAS']),
        ]);

        const result = await propagateMasterAcrossFamilies({
            familyId: 15,
            familyName: 'Proceso de Inyeccion Plastica',
            module: 'amfe',
            masterDocId: 'master-incompat',
            oldDoc: oldMasterDoc,
            newDoc: masterDoc,
        });

        expect(result.affectedDocs).toBe(1);
        expect(result.matches[0].targetDocId).toBe('doc-ok');
    });
});

describe('triggerCrossFamilyPropagation (fire-and-forget wrapper)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSelect.mockResolvedValue([]);
        mockCreateCrossFamilyAlert.mockResolvedValue(true);
    });

    it('never throws when the database throws', async () => {
        mockGetDocumentFamilyInfo.mockRejectedValueOnce(new Error('DB boom'));
        const masterDoc = makeAmfe('Proceso de Inyeccion', ['INYECCION']);
        expect(() => {
            triggerCrossFamilyPropagation('doc-err', masterDoc, masterDoc, 'amfe');
        }).not.toThrow();
        // Let the async fire-and-forget settle
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('is a no-op when the document is not a master', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue({
            id: 5,
            familyId: 15,
            module: 'amfe',
            documentId: 'doc-variant',
            isMaster: false,
            sourceMasterId: 1,
            productId: null,
            createdAt: '',
        });
        const masterDoc = makeAmfe('Proceso de Inyeccion', ['INYECCION']);
        triggerCrossFamilyPropagation('doc-variant', masterDoc, masterDoc, 'amfe');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockGetFamilyById).not.toHaveBeenCalled();
    });

    it('is a no-op when moduleType is not amfe', async () => {
        const masterDoc = makeAmfe('Proceso de Inyeccion', ['INYECCION']);
        triggerCrossFamilyPropagation('doc-1', masterDoc, masterDoc, 'cp');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockGetDocumentFamilyInfo).not.toHaveBeenCalled();
    });

    it('is a no-op when family name does not start with "Proceso de"', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue({
            id: 1,
            familyId: 1,
            module: 'amfe',
            documentId: 'doc-master',
            isMaster: true,
            sourceMasterId: null,
            productId: null,
            createdAt: '',
        });
        mockGetFamilyById.mockResolvedValue({
            id: 1,
            name: 'Insert Patagonia',
            description: '',
            lineaCode: '',
            lineaName: '',
            active: true,
            createdAt: '',
            updatedAt: '',
        });
        const masterDoc = makeAmfe('Insert', ['CORTE']);
        triggerCrossFamilyPropagation('doc-master', masterDoc, masterDoc, 'amfe');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockCreateCrossFamilyAlert).not.toHaveBeenCalled();
    });
});
