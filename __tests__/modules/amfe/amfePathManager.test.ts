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

describe('listAmfeStudies', () => {
    it('filters by client and project', async () => {
        mockedListDocs.mockResolvedValue([
            { id: '1', projectName: 'ZAC/Headlamp/study1', client: 'ZAC', amfeNumber: 'AMFE-001', status: 'draft', subject: 'Study 1', partNumber: '', responsible: '', operationCount: 0, causeCount: 0, apHCount: 0, apMCount: 0, coveragePercent: 0, startDate: '', lastRevisionDate: '', revisions: [], createdAt: '', updatedAt: '2025-01-01' },
            { id: '2', projectName: 'BMW/Door/study2', client: 'BMW', amfeNumber: 'AMFE-002', status: 'draft', subject: 'Study 2', partNumber: '', responsible: '', operationCount: 0, causeCount: 0, apHCount: 0, apMCount: 0, coveragePercent: 0, startDate: '', lastRevisionDate: '', revisions: [], createdAt: '', updatedAt: '2025-02-01' },
        ]);

        const studies = await listAmfeStudies('ZAC', 'Headlamp');
        expect(studies).toHaveLength(1);
        expect(studies[0].name).toBe('ZAC/Headlamp/study1');
        expect(studies[0].header?.subject).toBe('Study 1');
    });
});

describe('listLooseAmfeFiles', () => {
    it('returns empty array (no loose files in SQLite mode)', async () => {
        const result = await listLooseAmfeFiles();
        expect(result).toEqual([]);
    });
});
