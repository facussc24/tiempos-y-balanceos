import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock cpRepository
vi.mock('../../../utils/repositories/cpRepository', () => ({
    listCpDocuments: vi.fn(),
    loadCpByProjectName: vi.fn(),
    saveCpDocument: vi.fn(),
    deleteCpByProjectName: vi.fn(),
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock uuid
vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-uuid-cp-001') }));

// Mock settingsStore (used by initCpBasePath)
vi.mock('../../../utils/settingsStore', () => ({
    loadSettings: vi.fn().mockResolvedValue({}),
}));

import {
    listCpDocuments,
    loadCpByProjectName,
    saveCpDocument,
    deleteCpByProjectName,
} from '../../../utils/repositories/cpRepository';
import type { CpDocumentListItem } from '../../../utils/repositories/cpRepository';
import {
    listControlPlanProjects,
    loadControlPlan,
    saveControlPlan,
    deleteControlPlan,
    isCpPathAccessible,
    getCpBasePath,
    setCpBasePath,
} from '../../../modules/controlPlan/controlPlanPathManager';
import type { ControlPlanDocument } from '../../../modules/controlPlan/controlPlanTypes';

const mockedListDocs = vi.mocked(listCpDocuments);
const mockedLoadByName = vi.mocked(loadCpByProjectName);
const mockedSaveDoc = vi.mocked(saveCpDocument);
const mockedDeleteByName = vi.mocked(deleteCpByProjectName);

// Sample data
const sampleDoc: ControlPlanDocument = {
    header: {
        controlPlanNumber: 'CP-001',
        phase: 'production',
        partNumber: 'P-123',
        latestChangeLevel: '',
        partName: 'Test Part',
        organization: 'Barack',
        supplier: '',
        supplierCode: '',
        keyContactPhone: '',
        date: '2026-01-01',
        revision: 'A',
        responsible: 'Eng',
        approvedBy: '',
        plantApproval: '',
        client: 'Acme',
        coreTeam: '',
        customerApproval: '',
        otherApproval: '',
        linkedAmfeProject: 'AMFE-Test',
        applicableParts: '',
    },
    items: [],
};

const sampleDbEntry: CpDocumentListItem = {
    id: 'uuid-1',
    project_name: 'TestProject',
    control_plan_number: 'CP-001',
    phase: 'production',
    part_number: 'P-123',
    part_name: 'Test Part',
    organization: 'Barack',
    client: 'Acme',
    responsible: 'Eng',
    revision: 'A',
    linked_amfe_project: 'AMFE-Test',
    linked_amfe_id: null,
    item_count: 0,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('getCpBasePath / setCpBasePath', () => {
    it('returns default path initially', () => {
        setCpBasePath('');
        expect(getCpBasePath()).toBe('Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\19. Plan de Control');
    });

    it('allows setting a custom path', () => {
        setCpBasePath('C:\\custom\\path');
        expect(getCpBasePath()).toBe('C:\\custom\\path');
        // Reset
        setCpBasePath('');
    });
});

describe('listControlPlanProjects', () => {
    it('returns projects from cpRepository', async () => {
        mockedListDocs.mockResolvedValue([sampleDbEntry]);

        const projects = await listControlPlanProjects();

        expect(mockedListDocs).toHaveBeenCalledOnce();
        expect(projects).toHaveLength(1);
        expect(projects[0].name).toBe('TestProject');
        expect(projects[0].filename).toBe('TestProject.json');
        expect(projects[0].header?.partName).toBe('Test Part');
        expect(projects[0].header?.client).toBe('Acme');
        expect(projects[0].header?.phase).toBe('production');
        expect(projects[0].header?.linkedAmfeProject).toBe('AMFE-Test');
    });

    it('returns empty array when no documents', async () => {
        mockedListDocs.mockResolvedValue([]);
        const projects = await listControlPlanProjects();
        expect(projects).toEqual([]);
    });

    it('handles repository errors gracefully', async () => {
        mockedListDocs.mockRejectedValue(new Error('DB error'));
        const projects = await listControlPlanProjects();
        expect(projects).toEqual([]);
    });
});

describe('loadControlPlan', () => {
    it('loads from cpRepository by project name', async () => {
        mockedLoadByName.mockResolvedValue({ id: 'uuid-1', doc: sampleDoc });

        const result = await loadControlPlan('TestProject');

        expect(mockedLoadByName).toHaveBeenCalledWith('TestProject');
        expect(result).toEqual(sampleDoc);
    });

    it('returns null when project not found in SQLite and filesystem unavailable', async () => {
        mockedLoadByName.mockResolvedValue(null);

        const result = await loadControlPlan('nonexistent');

        expect(mockedLoadByName).toHaveBeenCalledWith('nonexistent');
        expect(result).toBeNull();
    });

    it('handles repository errors gracefully', async () => {
        mockedLoadByName.mockRejectedValue(new Error('DB error'));
        const result = await loadControlPlan('broken');
        expect(result).toBeNull();
    });
});

describe('saveControlPlan', () => {
    it('delegates save to cpRepository.saveCpDocument', async () => {
        mockedLoadByName.mockResolvedValue(null); // new project
        mockedSaveDoc.mockResolvedValue(true);

        const result = await saveControlPlan('NewProject', sampleDoc);

        expect(result).toBe(true);
        expect(mockedSaveDoc).toHaveBeenCalledWith('mock-uuid-cp-001', 'NewProject', sampleDoc);
    });

    it('reuses existing ID when updating', async () => {
        mockedLoadByName.mockResolvedValue({ id: 'existing-uuid', doc: sampleDoc });
        mockedSaveDoc.mockResolvedValue(true);

        const result = await saveControlPlan('ExistingProject', sampleDoc);

        expect(result).toBe(true);
        expect(mockedSaveDoc).toHaveBeenCalledWith('existing-uuid', 'ExistingProject', sampleDoc);
    });

    it('returns false when saveCpDocument fails', async () => {
        mockedLoadByName.mockResolvedValue(null);
        mockedSaveDoc.mockResolvedValue(false);

        const result = await saveControlPlan('FailProject', sampleDoc);

        expect(result).toBe(false);
    });

    it('handles unexpected errors gracefully', async () => {
        mockedLoadByName.mockRejectedValue(new Error('Unexpected'));

        const result = await saveControlPlan('ErrorProject', sampleDoc);

        expect(result).toBe(false);
    });
});

describe('deleteControlPlan', () => {
    it('delegates delete to cpRepository.deleteCpByProjectName', async () => {
        mockedDeleteByName.mockResolvedValue(true);

        const result = await deleteControlPlan('TestProject');

        expect(result).toBe(true);
        expect(mockedDeleteByName).toHaveBeenCalledWith('TestProject');
    });

    it('returns false when deleteCpByProjectName fails', async () => {
        mockedDeleteByName.mockResolvedValue(false);

        const result = await deleteControlPlan('FailProject');

        expect(result).toBe(false);
    });

    it('handles unexpected errors gracefully', async () => {
        mockedDeleteByName.mockRejectedValue(new Error('Unexpected'));

        const result = await deleteControlPlan('ErrorProject');

        expect(result).toBe(false);
    });
});

describe('isCpPathAccessible', () => {
    it('returns true in web mode (SQLite always available)', async () => {
        // In test environment (no Tauri), the dynamic import fails and falls back to true
        const result = await isCpPathAccessible();
        expect(result).toBe(true);
    });
});
