import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock amfeRepository (keep computeAmfeStats as real implementation)
vi.mock('../../../utils/repositories/amfeRepository', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../utils/repositories/amfeRepository')>();
    return {
        ...actual,
        listAmfeDocuments: vi.fn(),
        saveAmfeDocument: vi.fn().mockResolvedValue(true),
        updateAmfeStatus: vi.fn().mockResolvedValue(true),
        getNextAmfeNumber: vi.fn().mockResolvedValue(1),
        loadAmfeByProjectName: vi.fn(),
    };
});

// Mock logger
vi.mock('../../../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { listAmfeDocuments } from '../../../utils/repositories/amfeRepository';
import {
    loadRegistry,
    saveRegistry,
    getNextAmfeNumber,
    computeEntryStats,
    addToRegistry,
    updateRegistryEntry,
    updateEntryStatus,
    addRevisionToEntry,
    findDuplicateAmfeNumbers,
    repairDuplicateNumbers,
} from '../../../modules/amfe/amfeRegistryManager';
import { AmfeRegistry, AmfeRegistryEntry, EMPTY_REGISTRY } from '../../../modules/amfe/amfeRegistryTypes';
import { AmfeDocument } from '../../../modules/amfe/amfeTypes';

const mockedListDocs = vi.mocked(listAmfeDocuments);

beforeEach(() => {
    vi.clearAllMocks();
});

/** Minimal AMFE doc for testing */
const makeDoc = (): AmfeDocument => ({
    header: {
        organization: 'BARACK', location: 'HUR', client: 'Client',
        modelYear: '2025', subject: 'Test AMFE', startDate: '2025-01-01',
        team: 'Team', responsible: 'John', revDate: '2025-06-01',
        amfeNumber: '', confidentiality: '',
        partNumber: 'PN-001', processResponsible: '', revision: '', approvedBy: '', scope: '', applicableParts: '',
    },
    operations: [{
        id: 'op1', opNumber: '10', name: 'Soldadura',
        workElements: [{
            id: 'we1', type: 'Machine', name: 'Robot',
            functions: [{
                id: 'f1', description: 'Soldar', requirements: '',
                failures: [{
                    id: 'fail1', description: 'No suelda',
                    effectLocal: 'Rep', effectNextLevel: '', effectEndUser: 'Def',
                    severity: 8,
                    causes: [
                        {
                            id: 'c1', cause: 'Electrodo', preventionControl: 'Maint', detectionControl: 'Visual',
                            occurrence: 5, detection: 6, ap: 'H',
                            characteristicNumber: '', specialChar: '', filterCode: '',
                            preventionAction: '', detectionAction: '', responsible: '', targetDate: '', status: '',
                            actionTaken: '', completionDate: '',
                            severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '', observations: '',
                        },
                        {
                            id: 'c2', cause: 'Gas', preventionControl: '', detectionControl: '',
                            occurrence: 3, detection: 4, ap: 'M',
                            characteristicNumber: '', specialChar: '', filterCode: '',
                            preventionAction: '', detectionAction: '', responsible: '', targetDate: '', status: '',
                            actionTaken: '', completionDate: '',
                            severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '', observations: '',
                        },
                    ],
                }],
            }],
        }],
    }],
});

describe('loadRegistry', () => {
    it('returns empty registry when no documents exist', async () => {
        mockedListDocs.mockResolvedValue([]);
        const result = await loadRegistry();
        expect(result.entries).toEqual([]);
        expect(result.nextNumber).toBe(1);
    });

    it('loads and parses entries from repository', async () => {
        mockedListDocs.mockResolvedValue([
            {
                id: '1', amfeNumber: 'AMFE-004', projectName: 'proj1', status: 'draft',
                subject: 'Test', client: 'Client', partNumber: '', responsible: '',
                operationCount: 1, causeCount: 2, apHCount: 1, apMCount: 0, coveragePercent: 50,
                startDate: '', lastRevisionDate: '', revisions: [], createdAt: '', updatedAt: '',
            },
        ]);
        const result = await loadRegistry();
        expect(result.entries).toHaveLength(1);
        expect(result.nextNumber).toBe(5);
    });

    it('returns empty registry on error', async () => {
        mockedListDocs.mockRejectedValue(new Error('DB error'));
        const result = await loadRegistry();
        expect(result.entries).toEqual([]);
    });
});

describe('saveRegistry', () => {
    it('is a no-op and returns true (registry is derived from table)', async () => {
        const registry: AmfeRegistry = { entries: [], lastUpdated: '', nextNumber: 1 };
        const result = await saveRegistry(registry);
        expect(result).toBe(true);
    });
});

describe('getNextAmfeNumber', () => {
    it('generates AMFE-001 format', () => {
        const registry: AmfeRegistry = { entries: [], lastUpdated: '', nextNumber: 1 };
        const { number, updatedRegistry } = getNextAmfeNumber(registry);
        expect(number).toBe('AMFE-001');
        expect(updatedRegistry.nextNumber).toBe(2);
    });

    it('generates AMFE-042 for nextNumber 42', () => {
        const registry: AmfeRegistry = { entries: [], lastUpdated: '', nextNumber: 42 };
        const { number } = getNextAmfeNumber(registry);
        expect(number).toBe('AMFE-042');
    });
});

describe('computeEntryStats', () => {
    it('computes correct stats from AMFE document', () => {
        const doc = makeDoc();
        const stats = computeEntryStats(doc);
        expect(stats.operationCount).toBe(1);
        expect(stats.causeCount).toBe(2);
        expect(stats.apHCount).toBe(1);
        expect(stats.apMCount).toBe(1);
        expect(stats.coveragePercent).toBe(100);
    });

    it('handles empty document', () => {
        const doc: AmfeDocument = {
            header: {} as any,
            operations: [],
        };
        const stats = computeEntryStats(doc);
        expect(stats.operationCount).toBe(0);
        expect(stats.causeCount).toBe(0);
        expect(stats.coveragePercent).toBe(0);
    });
});

describe('addToRegistry', () => {
    it('creates new entry with AMFE number', async () => {
        const registry: AmfeRegistry = { entries: [], lastUpdated: '', nextNumber: 1 };
        const doc = makeDoc();
        const { entry, updatedRegistry } = await addToRegistry(registry, 'test-project', doc);

        expect(entry.amfeNumber).toBe('AMFE-001');
        expect(entry.projectName).toBe('test-project');
        expect(entry.status).toBe('draft');
        expect(entry.subject).toBe('Test AMFE');
        expect(entry.client).toBe('Client');
        expect(entry.causeCount).toBe(2);
        expect(entry.id).toBeTruthy();
        expect(updatedRegistry.entries).toHaveLength(1);
        expect(updatedRegistry.nextNumber).toBe(2);
    });
});

describe('updateRegistryEntry', () => {
    it('updates stats for existing project', async () => {
        const registry: AmfeRegistry = {
            entries: [{
                id: '1', amfeNumber: 'AMFE-001', projectName: 'proj1', status: 'draft',
                subject: 'Old', client: 'Old', partNumber: '', responsible: '',
                startDate: '', lastRevisionDate: '',
                operationCount: 0, causeCount: 0, apHCount: 0, apMCount: 0, coveragePercent: 0,
                revisions: [], createdAt: '', updatedAt: '',
            }],
            lastUpdated: '',
            nextNumber: 2,
        };

        const doc = makeDoc();
        const updated = await updateRegistryEntry(registry, 'proj1', doc);

        expect(updated.entries[0].subject).toBe('Test AMFE');
        expect(updated.entries[0].causeCount).toBe(2);
        expect(updated.entries[0].apHCount).toBe(1);
    });

    it('does not modify other entries', async () => {
        const registry: AmfeRegistry = {
            entries: [
                { id: '1', projectName: 'proj1', subject: 'Keep' } as any,
                { id: '2', projectName: 'proj2', subject: 'Keep2' } as any,
            ],
            lastUpdated: '',
            nextNumber: 3,
        };
        const doc = makeDoc();
        const updated = await updateRegistryEntry(registry, 'proj1', doc);
        expect(updated.entries[1].subject).toBe('Keep2');
    });
});

describe('updateEntryStatus', () => {
    it('changes status of matching entry', async () => {
        const registry: AmfeRegistry = {
            entries: [{ id: 'e1', status: 'draft' } as any],
            lastUpdated: '', nextNumber: 1,
        };
        const updated = await updateEntryStatus(registry, 'e1', 'approved');
        expect(updated.entries[0].status).toBe('approved');
    });
});

describe('addRevisionToEntry', () => {
    it('adds revision and updates date', () => {
        const registry: AmfeRegistry = {
            entries: [{ id: 'e1', revisions: [], lastRevisionDate: '' } as any],
            lastUpdated: '', nextNumber: 1,
        };
        const updated = addRevisionToEntry(registry, 'e1', {
            reason: 'Correccion', revisedBy: 'Juan', description: 'Se corrigio AP',
        });
        expect(updated.entries[0].revisions).toHaveLength(1);
        expect(updated.entries[0].revisions[0].reason).toBe('Correccion');
        expect(updated.entries[0].lastRevisionDate).toBeTruthy();
    });
});

// ============================================================================
// R5C: Duplicate amfeNumber validation
// ============================================================================

/** Helper: build a minimal registry entry with overrides. */
function makeEntry(overrides: Partial<AmfeRegistryEntry> & { id: string; amfeNumber: string }): AmfeRegistryEntry {
    return {
        projectName: 'proj-' + overrides.id,
        status: 'draft',
        subject: '', client: '', partNumber: '', responsible: '',
        startDate: '', lastRevisionDate: '',
        operationCount: 0, causeCount: 0, apHCount: 0, apMCount: 0, coveragePercent: 0,
        revisions: [],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        ...overrides,
    };
}

describe('getNextAmfeNumber — skip existing (R5C)', () => {
    it('skips numbers that already exist in registry entries', () => {
        const registry: AmfeRegistry = {
            entries: [
                makeEntry({ id: 'e1', amfeNumber: 'AMFE-001' }),
                makeEntry({ id: 'e2', amfeNumber: 'AMFE-002' }),
            ],
            lastUpdated: '',
            nextNumber: 1,
        };
        const { number, updatedRegistry } = getNextAmfeNumber(registry);
        expect(number).toBe('AMFE-003');
        expect(updatedRegistry.nextNumber).toBe(4);
    });

    it('returns next in sequence when no conflicts exist', () => {
        const registry: AmfeRegistry = {
            entries: [
                makeEntry({ id: 'e1', amfeNumber: 'AMFE-001' }),
            ],
            lastUpdated: '',
            nextNumber: 2,
        };
        const { number } = getNextAmfeNumber(registry);
        expect(number).toBe('AMFE-002');
    });
});

describe('findDuplicateAmfeNumbers (R5C)', () => {
    it('returns empty array for a clean registry with no duplicates', () => {
        const registry: AmfeRegistry = {
            entries: [
                makeEntry({ id: 'e1', amfeNumber: 'AMFE-001' }),
                makeEntry({ id: 'e2', amfeNumber: 'AMFE-002' }),
                makeEntry({ id: 'e3', amfeNumber: 'AMFE-003' }),
            ],
            lastUpdated: '',
            nextNumber: 4,
        };
        const duplicates = findDuplicateAmfeNumbers(registry);
        expect(duplicates).toEqual([]);
    });

    it('returns empty array for empty registry', () => {
        const registry: AmfeRegistry = { entries: [], lastUpdated: '', nextNumber: 1 };
        const duplicates = findDuplicateAmfeNumbers(registry);
        expect(duplicates).toEqual([]);
    });

    it('finds duplicate amfeNumbers correctly', () => {
        const registry: AmfeRegistry = {
            entries: [
                makeEntry({ id: 'e1', amfeNumber: 'AMFE-001' }),
                makeEntry({ id: 'e2', amfeNumber: 'AMFE-001' }),
                makeEntry({ id: 'e3', amfeNumber: 'AMFE-002' }),
                makeEntry({ id: 'e4', amfeNumber: 'AMFE-003' }),
                makeEntry({ id: 'e5', amfeNumber: 'AMFE-003' }),
            ],
            lastUpdated: '',
            nextNumber: 4,
        };
        const duplicates = findDuplicateAmfeNumbers(registry);
        expect(duplicates).toHaveLength(2);

        const dup001 = duplicates.find(d => d.amfeNumber === 'AMFE-001');
        expect(dup001).toBeDefined();
        expect(dup001!.entries).toHaveLength(2);

        const dup003 = duplicates.find(d => d.amfeNumber === 'AMFE-003');
        expect(dup003).toBeDefined();
        expect(dup003!.entries).toHaveLength(2);
    });
});

describe('repairDuplicateNumbers (R5C)', () => {
    it('is a no-op for a clean registry without duplicates', () => {
        const registry: AmfeRegistry = {
            entries: [
                makeEntry({ id: 'e1', amfeNumber: 'AMFE-001' }),
                makeEntry({ id: 'e2', amfeNumber: 'AMFE-002' }),
            ],
            lastUpdated: '',
            nextNumber: 3,
        };
        const repaired = repairDuplicateNumbers(registry);
        expect(repaired).toBe(registry);
    });

    it('throws when all numbers up to 99999 are exhausted (Audit R8)', () => {
        const registry: AmfeRegistry = {
            entries: [makeEntry({ id: 'e1', amfeNumber: 'AMFE-99999' })],
            lastUpdated: '',
            nextNumber: 99999,
        };
        expect(() => getNextAmfeNumber(registry)).toThrow('exhausted');
    });

    it('fixes duplicates by keeping oldest entry number and re-numbering the rest', () => {
        const registry: AmfeRegistry = {
            entries: [
                makeEntry({ id: 'e1', amfeNumber: 'AMFE-001', createdAt: '2025-01-01T00:00:00Z' }),
                makeEntry({ id: 'e2', amfeNumber: 'AMFE-001', createdAt: '2025-06-01T00:00:00Z' }),
                makeEntry({ id: 'e3', amfeNumber: 'AMFE-002' }),
            ],
            lastUpdated: '',
            nextNumber: 3,
        };
        const repaired = repairDuplicateNumbers(registry);

        const e1 = repaired.entries.find(e => e.id === 'e1');
        expect(e1!.amfeNumber).toBe('AMFE-001');

        const e2 = repaired.entries.find(e => e.id === 'e2');
        expect(e2!.amfeNumber).not.toBe('AMFE-001');
        expect(e2!.amfeNumber).toBe('AMFE-003');

        const e3 = repaired.entries.find(e => e.id === 'e3');
        expect(e3!.amfeNumber).toBe('AMFE-002');

        expect(findDuplicateAmfeNumbers(repaired)).toEqual([]);
    });
});
