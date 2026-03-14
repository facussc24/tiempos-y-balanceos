import { describe, it, expect } from 'vitest';
import { scanLinkedAmfes, syncAmfeWithLibrary, generateSyncSummary, SyncResult } from '../../../modules/amfe/amfeImpactAnalysis';
import { AmfeDocument } from '../../../modules/amfe/amfeTypes';
import { AmfeLibraryOperation } from '../../../modules/amfe/amfeLibraryTypes';
import { AmfeRegistryEntry } from '../../../modules/amfe/amfeRegistryTypes';

// --- Test Helpers ---

function makeRegistryEntry(overrides: Partial<AmfeRegistryEntry> = {}): AmfeRegistryEntry {
    return {
        id: 'reg-1',
        amfeNumber: 'AMFE-001',
        projectName: 'TestProject',
        status: 'draft',
        subject: 'Test Subject',
        client: 'Test Client',
        partNumber: 'P-001',
        responsible: 'Juan',
        startDate: '2024-01-01',
        lastRevisionDate: '',
        operationCount: 1,
        causeCount: 2,
        apHCount: 1,
        apMCount: 1,
        coveragePercent: 50,
        revisions: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        ...overrides,
    };
}

function makeAmfeDoc(ops: { opNumber: string; name: string; linkedLibraryOpId?: string }[]): AmfeDocument {
    return {
        header: {
            subject: 'Test',
            client: '',
            organization: '',
            location: '',
            modelYear: '',
            amfeNumber: '',
            scope: '',
            partNumber: '',
            responsible: '',
            team: '',
            startDate: '',
            revision: '',
            revDate: '',
            confidentiality: '',
            approvedBy: '',
            processResponsible: '',
            applicableParts: '',
        },
        operations: ops.map((op, idx) => ({
            id: `op-${idx}`,
            opNumber: op.opNumber,
            name: op.name,
            workElements: [{
                id: `we-${idx}`,
                type: 'Method' as const,
                name: 'WE Test',
                functions: [{
                    id: `f-${idx}`,
                    description: 'Funcion Test',
                    requirements: '',
                    failures: [{
                        id: `fl-${idx}`,
                        description: 'Falla Test',
                        severity: '5',
                        effectLocal: '',
                        effectNextLevel: '',
                        effectEndUser: '',
                        causes: [{
                            id: `c-${idx}`,
                            cause: 'Causa Test',
                            occurrence: '3',
                            detection: '4',
                            preventionControl: '',
                            detectionControl: '',
                            ap: 'M',
                            characteristicNumber: '',
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
                        }],
                    }],
                }],
            }],
            ...(op.linkedLibraryOpId ? { linkedLibraryOpId: op.linkedLibraryOpId } : {}),
        })),
    };
}

function makeLibOp(overrides: Partial<AmfeLibraryOperation> = {}): AmfeLibraryOperation {
    return {
        id: 'lib-op-1',
        opNumber: '10',
        name: 'Corte Laser',
        workElements: [{
            id: 'lib-we-1',
            type: 'Method',
            name: 'WE Lib',
            functions: [{
                id: 'lib-f-1',
                description: 'Funcion Lib',
                requirements: '',
                failures: [{
                    id: 'lib-fl-1',
                    description: 'Falla Lib',
                    severity: '7',
                    effectLocal: '',
                    effectNextLevel: '',
                    effectEndUser: '',
                    causes: [{
                        id: 'lib-c-1',
                        cause: 'Causa Lib',
                        occurrence: '5',
                        detection: '3',
                        preventionControl: 'Control preventivo nuevo',
                        detectionControl: 'Control deteccion nuevo',
                        ap: 'H',
                        characteristicNumber: '',
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
                    }],
                }],
            }],
        }],
        lastModified: '2024-06-01T00:00:00.000Z',
        version: 2,
        ...overrides,
    };
}

// --- Tests ---

describe('scanLinkedAmfes', () => {
    it('finds AMFEs linked to a specific library operation', () => {
        const docs = new Map<string, AmfeDocument>();
        docs.set('Project1', makeAmfeDoc([{ opNumber: '10', name: 'Corte', linkedLibraryOpId: 'lib-op-1' }]));
        docs.set('Project2', makeAmfeDoc([{ opNumber: '20', name: 'Soldadura' }]));
        docs.set('Project3', makeAmfeDoc([{ opNumber: '10', name: 'Corte', linkedLibraryOpId: 'lib-op-1' }]));

        const entries = [
            makeRegistryEntry({ projectName: 'Project1', amfeNumber: 'AMFE-001' }),
            makeRegistryEntry({ projectName: 'Project2', id: 'reg-2', amfeNumber: 'AMFE-002' }),
            makeRegistryEntry({ projectName: 'Project3', id: 'reg-3', amfeNumber: 'AMFE-003' }),
        ];

        const result = scanLinkedAmfes('lib-op-1', 'Corte Laser', docs, entries);

        expect(result.totalLinked).toBe(2);
        expect(result.linkedAmfes).toHaveLength(2);
        expect(result.linkedAmfes[0].registryEntry.projectName).toBe('Project1');
        expect(result.linkedAmfes[1].registryEntry.projectName).toBe('Project3');
    });

    it('returns empty when no AMFEs link to the library operation', () => {
        const docs = new Map<string, AmfeDocument>();
        docs.set('Project1', makeAmfeDoc([{ opNumber: '20', name: 'Soldadura' }]));

        const entries = [makeRegistryEntry({ projectName: 'Project1' })];

        const result = scanLinkedAmfes('lib-op-1', 'Corte Laser', docs, entries);
        expect(result.totalLinked).toBe(0);
        expect(result.linkedAmfes).toHaveLength(0);
    });

    it('counts multiple linked operations within a single AMFE', () => {
        const docs = new Map<string, AmfeDocument>();
        docs.set('Project1', makeAmfeDoc([
            { opNumber: '10', name: 'Corte A', linkedLibraryOpId: 'lib-op-1' },
            { opNumber: '20', name: 'Corte B', linkedLibraryOpId: 'lib-op-1' },
        ]));

        const entries = [makeRegistryEntry({ projectName: 'Project1' })];

        const result = scanLinkedAmfes('lib-op-1', 'Corte Laser', docs, entries);
        expect(result.totalLinked).toBe(1);
        expect(result.linkedAmfes[0].linkedOperationCount).toBe(2);
        expect(result.linkedAmfes[0].linkedOperationNames).toEqual(['10 - Corte A', '20 - Corte B']);
    });

    it('skips AMFEs not in the registry', () => {
        const docs = new Map<string, AmfeDocument>();
        docs.set('UnregisteredProject', makeAmfeDoc([{ opNumber: '10', name: 'Corte', linkedLibraryOpId: 'lib-op-1' }]));

        const entries: AmfeRegistryEntry[] = []; // no entries

        const result = scanLinkedAmfes('lib-op-1', 'Corte Laser', docs, entries);
        expect(result.totalLinked).toBe(0);
    });

    it('includes library operation info in result', () => {
        const docs = new Map<string, AmfeDocument>();
        const entries: AmfeRegistryEntry[] = [];

        const result = scanLinkedAmfes('lib-op-1', 'Corte Laser', docs, entries);
        expect(result.libraryOpId).toBe('lib-op-1');
        expect(result.libraryOpName).toBe('Corte Laser');
    });
});

describe('syncAmfeWithLibrary', () => {
    it('merges linked operations and generates revision entry', () => {
        const doc = makeAmfeDoc([{ opNumber: '10', name: 'Corte', linkedLibraryOpId: 'lib-op-1' }]);
        const libOp = makeLibOp();

        const result = syncAmfeWithLibrary(doc, 'TestProject', libOp, 'Juan Perez');

        expect(result.mergedCount).toBe(1);
        expect(result.revisionEntry.reason).toBe('Sincronización de Biblioteca');
        expect(result.revisionEntry.revisedBy).toContain('Juan Perez');
        expect(result.revisionEntry.revisedBy).toContain('Sync Biblioteca');
        expect(result.revisionEntry.description).toContain('Corte Laser');
        expect(result.revisionEntry.description).toContain('v2');
        expect(result.revisionEntry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('does not merge operations without matching linkedLibraryOpId', () => {
        const doc = makeAmfeDoc([{ opNumber: '20', name: 'Soldadura' }]);
        const libOp = makeLibOp();

        const result = syncAmfeWithLibrary(doc, 'TestProject', libOp);

        expect(result.mergedCount).toBe(0);
        expect(result.updatedOperations).toHaveLength(1);
    });

    it('preserves non-linked operations unchanged', () => {
        const doc = makeAmfeDoc([
            { opNumber: '10', name: 'Corte', linkedLibraryOpId: 'lib-op-1' },
            { opNumber: '20', name: 'Soldadura' },
        ]);
        const libOp = makeLibOp();

        const result = syncAmfeWithLibrary(doc, 'TestProject', libOp);

        expect(result.updatedOperations).toHaveLength(2);
        expect(result.updatedOperations[1].name).toBe('Soldadura');
    });

    it('uses default author when not provided', () => {
        const doc = makeAmfeDoc([{ opNumber: '10', name: 'Corte', linkedLibraryOpId: 'lib-op-1' }]);
        const libOp = makeLibOp();

        const result = syncAmfeWithLibrary(doc, 'TestProject', libOp);

        expect(result.revisionEntry.revisedBy).toContain('Sistema');
    });
});

describe('generateSyncSummary', () => {
    it('generates summary for successful syncs', () => {
        const results: SyncResult[] = [
            {
                projectName: 'P1',
                updatedOperations: [],
                mergedCount: 2,
                revisionEntry: { date: '2024-01-01', reason: '', revisedBy: '', description: '' },
                hasLinkedControlPlan: false,
            },
            {
                projectName: 'P2',
                updatedOperations: [],
                mergedCount: 1,
                revisionEntry: { date: '2024-01-01', reason: '', revisedBy: '', description: '' },
                hasLinkedControlPlan: false,
            },
        ];

        const summary = generateSyncSummary(results);
        expect(summary).toContain('2 AMFE(s)');
        expect(summary).toContain('3 operación(es)');
    });

    it('mentions Control Plan attention when applicable', () => {
        const results: SyncResult[] = [
            {
                projectName: 'P1',
                updatedOperations: [],
                mergedCount: 1,
                revisionEntry: { date: '2024-01-01', reason: '', revisedBy: '', description: '' },
                hasLinkedControlPlan: true,
            },
        ];

        const summary = generateSyncSummary(results);
        expect(summary).toContain('Plan de Control');
        expect(summary).toContain('atencion');
    });

    it('does not mention Control Plan when none are linked', () => {
        const results: SyncResult[] = [
            {
                projectName: 'P1',
                updatedOperations: [],
                mergedCount: 1,
                revisionEntry: { date: '2024-01-01', reason: '', revisedBy: '', description: '' },
                hasLinkedControlPlan: false,
            },
        ];

        const summary = generateSyncSummary(results);
        expect(summary).not.toContain('Plan de Control');
    });

    it('handles zero merges correctly', () => {
        const results: SyncResult[] = [
            {
                projectName: 'P1',
                updatedOperations: [],
                mergedCount: 0,
                revisionEntry: { date: '2024-01-01', reason: '', revisedBy: '', description: '' },
                hasLinkedControlPlan: false,
            },
        ];

        const summary = generateSyncSummary(results);
        expect(summary).toContain('0 AMFE(s)');
    });
});
