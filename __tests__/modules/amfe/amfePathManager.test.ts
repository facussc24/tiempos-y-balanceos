import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock amfeRepository
vi.mock('../../../utils/repositories/amfeRepository', () => ({
    listAmfeDocuments: vi.fn(),
    loadAmfeByProjectName: vi.fn(),
    saveAmfeDocument: vi.fn(),
    deleteAmfeDocument: vi.fn(),
    getNextAmfeNumber: vi.fn(),
}));

// Mock settingsRepository
vi.mock('../../../utils/repositories/settingsRepository', () => ({
    loadAppSettings: vi.fn().mockResolvedValue({}),
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock uuid
vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-uuid-1234') }));

import {
    listAmfeDocuments,
    loadAmfeByProjectName,
    saveAmfeDocument,
    deleteAmfeDocument,
    getNextAmfeNumber,
} from '../../../utils/repositories/amfeRepository';
import {
    ensureAmfeDir,
    listAmfeProjects,
    loadAmfe,
    saveAmfe,
    deleteAmfe,
    isAmfePathAccessible,
    listAmfeClients,
    listAmfeClientProjects,
    listAmfeStudies,
    listLooseAmfeFiles,
    buildAmfePath,
    normalizeProjectNames,
} from '../../../modules/amfe/amfePathManager';

const mockedListDocs = vi.mocked(listAmfeDocuments);
const mockedLoadByProject = vi.mocked(loadAmfeByProjectName);
const mockedSaveDoc = vi.mocked(saveAmfeDocument);
const mockedDeleteDoc = vi.mocked(deleteAmfeDocument);
const mockedGetNextNum = vi.mocked(getNextAmfeNumber);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ensureAmfeDir', () => {
    it('always returns true (SQLite handles storage)', async () => {
        const result = await ensureAmfeDir();
        expect(result).toBe(true);
    });
});

describe('listAmfeProjects', () => {
    it('returns a list of projects from repository', async () => {
        mockedListDocs.mockResolvedValue([
            { id: '1', amfeNumber: 'AMFE-001', projectName: 'project1', status: 'draft', subject: 'Test', client: 'Client', partNumber: '', responsible: '', operationCount: 1, causeCount: 2, apHCount: 1, apMCount: 0, coveragePercent: 50, startDate: '', lastRevisionDate: '', revisions: [], createdAt: '2025-01-01', updatedAt: '2025-06-01' },
            { id: '2', amfeNumber: 'AMFE-002', projectName: 'project2', status: 'draft', subject: 'Other', client: 'Client2', partNumber: '', responsible: '', operationCount: 0, causeCount: 0, apHCount: 0, apMCount: 0, coveragePercent: 0, startDate: '', lastRevisionDate: '', revisions: [], createdAt: '2025-02-01', updatedAt: '2025-07-01' },
        ]);

        const projects = await listAmfeProjects();
        expect(projects).toHaveLength(2);
        expect(projects[0].name).toBe('project1');
        expect(projects[1].name).toBe('project2');
        expect(projects[0].header?.subject).toBe('Test');
        expect(projects[0].filename).toBe('project1');
    });

    it('returns empty array when no documents', async () => {
        mockedListDocs.mockResolvedValue([]);
        const projects = await listAmfeProjects();
        expect(projects).toEqual([]);
    });
});

describe('loadAmfe', () => {
    it('loads a document by project name', async () => {
        const docData = { header: { organization: 'Test' }, operations: [] };
        mockedLoadByProject.mockResolvedValue({ doc: docData as any, meta: { id: '1', amfeNumber: 'AMFE-001', status: 'draft', revisions: [] } as any });

        const result = await loadAmfe('myproject');
        expect(result).toEqual(docData);
        expect(mockedLoadByProject).toHaveBeenCalledWith('myproject');
    });

    it('returns null if project not found', async () => {
        mockedLoadByProject.mockResolvedValue(null);
        const result = await loadAmfe('nonexistent');
        expect(result).toBeNull();
    });
});

describe('saveAmfe', () => {
    const docData = { header: { organization: 'Test' }, operations: [] } as any;

    it('updates existing document', async () => {
        mockedLoadByProject.mockResolvedValue({
            doc: docData,
            meta: { id: 'existing-id', amfeNumber: 'AMFE-001', status: 'draft', revisions: [{ date: '2025-01-01', reason: 'test', revisedBy: 'user', description: 'desc' }] } as any,
        });
        mockedSaveDoc.mockResolvedValue(true);

        const result = await saveAmfe('myproject', docData);
        expect(result).toBe(true);
        expect(mockedSaveDoc).toHaveBeenCalledWith('existing-id', 'AMFE-001', 'myproject', docData, 'draft', expect.any(Array));
    });

    it('creates new document if not found', async () => {
        mockedLoadByProject.mockResolvedValue(null);
        mockedGetNextNum.mockResolvedValue(5);
        mockedSaveDoc.mockResolvedValue(true);

        const result = await saveAmfe('newproject', docData);
        expect(result).toBe(true);
        expect(mockedSaveDoc).toHaveBeenCalledWith('mock-uuid-1234', 'AMFE-005', 'newproject', docData);
    });
});

describe('deleteAmfe', () => {
    it('deletes existing document and returns true', async () => {
        mockedLoadByProject.mockResolvedValue({
            doc: {} as any,
            meta: { id: 'del-id', amfeNumber: 'AMFE-001', status: 'draft', revisions: [] } as any,
        });
        mockedDeleteDoc.mockResolvedValue(true);

        const result = await deleteAmfe('myproject');
        expect(result).toBe(true);
        expect(mockedDeleteDoc).toHaveBeenCalledWith('del-id');
    });

    it('returns false if project not found', async () => {
        mockedLoadByProject.mockResolvedValue(null);
        const result = await deleteAmfe('nonexistent');
        expect(result).toBe(false);
    });
});

describe('isAmfePathAccessible', () => {
    it('always returns true (SQLite mode)', async () => {
        expect(await isAmfePathAccessible()).toBe(true);
    });
});

describe('listAmfeClients', () => {
    it('returns unique clients sorted', async () => {
        mockedListDocs.mockResolvedValue([
            { id: '1', projectName: 'p1', client: 'ZAC', amfeNumber: '', status: 'draft', subject: '', partNumber: '', responsible: '', operationCount: 0, causeCount: 0, apHCount: 0, apMCount: 0, coveragePercent: 0, startDate: '', lastRevisionDate: '', revisions: [], createdAt: '', updatedAt: '' },
            { id: '2', projectName: 'p2', client: 'BMW', amfeNumber: '', status: 'draft', subject: '', partNumber: '', responsible: '', operationCount: 0, causeCount: 0, apHCount: 0, apMCount: 0, coveragePercent: 0, startDate: '', lastRevisionDate: '', revisions: [], createdAt: '', updatedAt: '' },
            { id: '3', projectName: 'p3', client: 'ZAC', amfeNumber: '', status: 'draft', subject: '', partNumber: '', responsible: '', operationCount: 0, causeCount: 0, apHCount: 0, apMCount: 0, coveragePercent: 0, startDate: '', lastRevisionDate: '', revisions: [], createdAt: '', updatedAt: '' },
        ]);
        const clients = await listAmfeClients();
        expect(clients).toEqual(['BMW', 'ZAC']);
    });
});

// ============================================================================
// HELPER: create a registry entry with defaults
// ============================================================================

function makeEntry(overrides: Record<string, any>) {
    return {
        id: overrides.id ?? 'id-1',
        amfeNumber: overrides.amfeNumber ?? 'AMFE-001',
        projectName: overrides.projectName ?? 'VWA/PATAGONIA/INSERTO',
        status: 'draft' as const,
        subject: overrides.subject ?? 'INSERTO',
        client: overrides.client ?? 'VWA',
        partNumber: '',
        responsible: '',
        operationCount: 0,
        causeCount: 0,
        apHCount: 0,
        apMCount: 0,
        coveragePercent: 0,
        startDate: '',
        lastRevisionDate: '',
        revisions: [],
        createdAt: '',
        updatedAt: overrides.updatedAt ?? '',
    };
}

// ============================================================================
// listAmfeClientProjects — CRITICAL FIX FOR DUPLICATE BUG
// ============================================================================

describe('listAmfeClientProjects', () => {
    it('extracts project from "client/project/name" format', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'VWA/PATAGONIA/INSERTO', client: 'VWA' }),
        ]);
        const result = await listAmfeClientProjects('VWA');
        expect(result).toEqual(['PATAGONIA']);
    });

    it('returns multiple projects for same client', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'VWA/PATAGONIA/INSERTO', client: 'VWA', id: '1' }),
            makeEntry({ projectName: 'VWA/AMAROK/SOPORTE', client: 'VWA', id: '2' }),
        ]);
        const result = await listAmfeClientProjects('VWA');
        expect(result).toEqual(['AMAROK', 'PATAGONIA']);
    });

    it('deduplicates projects with multiple studies', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'VWA/PATAGONIA/INSERTO', client: 'VWA', id: '1' }),
            makeEntry({ projectName: 'VWA/PATAGONIA/TOP ROLL', client: 'VWA', id: '2' }),
        ]);
        const result = await listAmfeClientProjects('VWA');
        expect(result).toEqual(['PATAGONIA']);
    });

    it('groups flat project_name under "(Sin proyecto)" — REGRESSION FIX', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'INSERTO', client: 'VWA' }),
        ]);
        const result = await listAmfeClientProjects('VWA');
        expect(result).toEqual(['(Sin proyecto)']);
        // Must NOT return 'INSERTO' as a project name
        expect(result).not.toContain('INSERTO');
    });

    it('separates flat and hierarchical entries correctly — REGRESSION FIX', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'VWA/PATAGONIA/INSERTO', client: 'VWA', id: '1' }),
            makeEntry({ projectName: 'INSERTO', client: 'VWA', id: '2' }),
        ]);
        const result = await listAmfeClientProjects('VWA');
        expect(result).toContain('PATAGONIA');
        expect(result).toContain('(Sin proyecto)');
        expect(result).not.toContain('INSERTO');
    });

    it('handles two-part "project/name" format', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'PATAGONIA/INSERTO', client: 'VWA' }),
        ]);
        const result = await listAmfeClientProjects('VWA');
        expect(result).toEqual(['PATAGONIA']);
    });

    it('ignores other clients', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'VWA/PATAGONIA/INSERTO', client: 'VWA', id: '1' }),
            makeEntry({ projectName: 'BMW/X5/BRACKET', client: 'BMW', id: '2' }),
        ]);
        const result = await listAmfeClientProjects('VWA');
        expect(result).toEqual(['PATAGONIA']);
    });
});

// ============================================================================
// listAmfeStudies — STRICT PREFIX MATCH FIX
// ============================================================================

describe('listAmfeStudies', () => {
    it('filters by strict "client/project/" prefix', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'ZAC/Headlamp/study1', client: 'ZAC', id: '1', subject: 'Study 1', updatedAt: '2025-01-01' }),
            makeEntry({ projectName: 'BMW/Door/study2', client: 'BMW', id: '2', subject: 'Study 2', updatedAt: '2025-02-01' }),
        ]);

        const studies = await listAmfeStudies('ZAC', 'Headlamp');
        expect(studies).toHaveLength(1);
        expect(studies[0].name).toBe('study1');
        expect(studies[0].header?.subject).toBe('Study 1');
    });

    it('does NOT match flat names that happen to include the project string — REGRESSION FIX', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'VWA/PATAGONIA/INSERTO', client: 'VWA', id: '1' }),
            makeEntry({ projectName: 'INSERTO', client: 'VWA', id: '2' }),
        ]);
        const result = await listAmfeStudies('VWA', 'PATAGONIA');
        expect(result).toHaveLength(1);
        expect(result[0].filename).toBe('VWA/PATAGONIA/INSERTO');
    });

    it('returns multiple studies under same project', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'VWA/PAT/INSERTO', client: 'VWA', id: '1' }),
            makeEntry({ projectName: 'VWA/PAT/TOP ROLL', client: 'VWA', id: '2' }),
        ]);
        const result = await listAmfeStudies('VWA', 'PAT');
        expect(result).toHaveLength(2);
    });

    it('does not cross-match similar project names', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'VWA/PAT/INSERTO', client: 'VWA', id: '1' }),
            makeEntry({ projectName: 'VWA/PATAGONIA/INSERTO', client: 'VWA', id: '2' }),
        ]);
        const result = await listAmfeStudies('VWA', 'PAT');
        expect(result).toHaveLength(1);
        expect(result[0].filename).toBe('VWA/PAT/INSERTO');
    });

    it('handles "(Sin proyecto)" for flat entries', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'INSERTO', client: 'VWA', id: '1' }),
            makeEntry({ projectName: 'VWA/PAT/INSERTO', client: 'VWA', id: '2' }),
        ]);
        const result = await listAmfeStudies('VWA', '(Sin proyecto)');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('INSERTO');
        expect(result[0].filename).toBe('INSERTO');
    });
});

// ============================================================================
// listLooseAmfeFiles
// ============================================================================

describe('listLooseAmfeFiles', () => {
    it('returns flat entries (no slashes in project_name)', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'INSERTO', client: 'VWA', id: '1' }),
            makeEntry({ projectName: 'VWA/PAT/INSERTO', client: 'VWA', id: '2' }),
        ]);
        const result = await listLooseAmfeFiles();
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('INSERTO');
    });

    it('returns empty when all entries are hierarchical', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'VWA/PAT/INSERTO', client: 'VWA' }),
        ]);
        const result = await listLooseAmfeFiles();
        expect(result).toHaveLength(0);
    });

    it('returns empty when no documents exist', async () => {
        mockedListDocs.mockResolvedValue([]);
        const result = await listLooseAmfeFiles();
        expect(result).toHaveLength(0);
    });
});

// ============================================================================
// buildAmfePath
// ============================================================================

describe('buildAmfePath', () => {
    it('joins client/project/name', () => {
        expect(buildAmfePath('VWA', 'PATAGONIA', 'INSERTO')).toBe('VWA/PATAGONIA/INSERTO');
    });

    it('handles spaces in names', () => {
        expect(buildAmfePath('Mi Cliente', 'Proyecto 1', 'Mi AMFE')).toBe('Mi Cliente/Proyecto 1/Mi AMFE');
    });
});

// ============================================================================
// normalizeProjectNames — DATA REPAIR
// ============================================================================

describe('normalizeProjectNames', () => {
    it('deletes flat entry when a hierarchical duplicate exists', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'VWA/PATAGONIA/INSERTO', client: 'VWA', id: 'id-hier' }),
            makeEntry({ projectName: 'INSERTO', client: 'VWA', id: 'id-flat' }),
        ]);
        mockedDeleteDoc.mockResolvedValue(true);

        const count = await normalizeProjectNames();
        expect(count).toBe(1);
        expect(mockedDeleteDoc).toHaveBeenCalledWith('id-flat');
        expect(mockedSaveDoc).not.toHaveBeenCalled();
    });

    it('normalizes flat entry to "(Sin proyecto)" when no duplicate exists', async () => {
        const mockDoc = { header: { subject: 'STANDALONE', client: 'VWA' }, operations: [] } as any;
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'STANDALONE', client: 'VWA', id: 'id-flat' }),
        ]);
        mockedLoadByProject.mockResolvedValue({
            doc: mockDoc,
            meta: { id: 'id-flat', amfeNumber: 'AMFE-001', status: 'draft', revisions: [] } as any,
        });
        mockedSaveDoc.mockResolvedValue(true);

        const count = await normalizeProjectNames();
        expect(count).toBe(1);
        expect(mockedDeleteDoc).not.toHaveBeenCalled();
        expect(mockedSaveDoc).toHaveBeenCalledWith(
            'id-flat', 'AMFE-001', 'VWA/(Sin proyecto)/STANDALONE',
            mockDoc, 'draft', [],
        );
    });

    it('skips hierarchical entries (no-op)', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'VWA/PATAGONIA/INSERTO', client: 'VWA', id: '1' }),
        ]);
        const count = await normalizeProjectNames();
        expect(count).toBe(0);
    });

    it('returns 0 when database is empty', async () => {
        mockedListDocs.mockResolvedValue([]);
        const count = await normalizeProjectNames();
        expect(count).toBe(0);
    });

    it('handles multiple flat entries', async () => {
        mockedListDocs.mockResolvedValue([
            makeEntry({ projectName: 'INSERTO', client: 'VWA', id: 'flat-1' }),
            makeEntry({ projectName: 'VWA/PATAGONIA/INSERTO', client: 'VWA', id: 'hier-1' }),
            makeEntry({ projectName: 'BRACKET', client: 'BMW', id: 'flat-2' }),
        ]);
        mockedDeleteDoc.mockResolvedValue(true);
        mockedLoadByProject.mockResolvedValue({
            doc: { header: {}, operations: [] } as any,
            meta: { id: 'flat-2', amfeNumber: 'AMFE-002', status: 'draft', revisions: [] } as any,
        });
        mockedSaveDoc.mockResolvedValue(true);

        const count = await normalizeProjectNames();
        expect(count).toBe(2);
        expect(mockedDeleteDoc).toHaveBeenCalledWith('flat-1');
        expect(mockedSaveDoc).toHaveBeenCalledWith(
            'flat-2', 'AMFE-002', 'BMW/(Sin proyecto)/BRACKET',
            expect.anything(), 'draft', [],
        );
    });
});
