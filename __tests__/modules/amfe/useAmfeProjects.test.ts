import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock amfePathManager
const mockListAmfeClients = vi.fn().mockResolvedValue([]);
const mockListAmfeClientProjects = vi.fn().mockResolvedValue([]);
const mockListAmfeStudies = vi.fn().mockResolvedValue([]);
const mockListLooseAmfeFiles = vi.fn().mockResolvedValue([]);
const mockLoadAmfe = vi.fn().mockResolvedValue(null);
const mockSaveAmfe = vi.fn().mockResolvedValue(true);
const mockDeleteAmfe = vi.fn().mockResolvedValue(true);
const mockLoadAmfeHierarchical = vi.fn().mockResolvedValue(null);
const mockSaveAmfeHierarchical = vi.fn().mockResolvedValue(true);
const mockDeleteAmfeHierarchical = vi.fn().mockResolvedValue(true);
const mockDeleteAmfeProject = vi.fn().mockResolvedValue(true);
const mockDeleteAmfeClient = vi.fn().mockResolvedValue(true);
const mockEnsureAmfeHierarchy = vi.fn().mockResolvedValue(true);
const mockIsAmfePathAccessible = vi.fn().mockResolvedValue(true);

vi.mock('../../../modules/amfe/amfePathManager', () => ({
    listAmfeClients: (...args: any[]) => mockListAmfeClients(...args),
    listAmfeClientProjects: (...args: any[]) => mockListAmfeClientProjects(...args),
    listAmfeStudies: (...args: any[]) => mockListAmfeStudies(...args),
    listLooseAmfeFiles: (...args: any[]) => mockListLooseAmfeFiles(...args),
    loadAmfe: (...args: any[]) => mockLoadAmfe(...args),
    saveAmfe: (...args: any[]) => mockSaveAmfe(...args),
    deleteAmfe: (...args: any[]) => mockDeleteAmfe(...args),
    loadAmfeHierarchical: (...args: any[]) => mockLoadAmfeHierarchical(...args),
    saveAmfeHierarchical: (...args: any[]) => mockSaveAmfeHierarchical(...args),
    deleteAmfeHierarchical: (...args: any[]) => mockDeleteAmfeHierarchical(...args),
    deleteAmfeProject: (...args: any[]) => mockDeleteAmfeProject(...args),
    deleteAmfeClient: (...args: any[]) => mockDeleteAmfeClient(...args),
    ensureAmfeHierarchy: (...args: any[]) => mockEnsureAmfeHierarchy(...args),
    isAmfePathAccessible: () => mockIsAmfePathAccessible(),
    buildAmfePath: (c: string, p: string, n: string) => `${c}/${p}/${n}.json`,
}));

vi.mock('../../../modules/amfe/amfeValidation', () => ({
    migrateAmfeDocument: (doc: any) => doc,
}));

vi.mock('../../../modules/amfe/useAmfePersistence', () => ({
    deleteDraft: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../utils/repositories/amfeRepository', () => ({
    loadAmfeByProjectName: vi.fn().mockResolvedValue(null),
}));

import { useAmfeProjects } from '../../../modules/amfe/useAmfeProjects';
import { AmfeDocument } from '../../../modules/amfe/amfeTypes';

// --- Helpers ---
function makeDoc(overrides: Partial<AmfeDocument> = {}): AmfeDocument {
    return {
        header: {
            organization: 'Test', location: '', client: '', modelYear: '',
            subject: 'Test AMFE', startDate: '', revDate: '', team: '',
            amfeNumber: '', responsible: '', confidentiality: '',
            partNumber: '', processResponsible: '', revision: '',
            approvedBy: '', scope: '', applicableParts: '',
        },
        operations: [],
        ...overrides,
    };
}

function renderProjectsHook(doc?: AmfeDocument) {
    const onLoadProject = vi.fn();
    const onResetProject = vi.fn();
    const requestConfirm = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
        useAmfeProjects(doc || makeDoc(), onLoadProject, onResetProject, requestConfirm)
    );

    return { result, onLoadProject, onResetProject, requestConfirm };
}

describe('useAmfeProjects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListAmfeClients.mockResolvedValue([]);
        mockListAmfeClientProjects.mockResolvedValue([]);
        mockListAmfeStudies.mockResolvedValue([]);
        mockListLooseAmfeFiles.mockResolvedValue([]);
        mockLoadAmfe.mockResolvedValue(null);
        mockDeleteAmfe.mockResolvedValue(true);
        mockLoadAmfeHierarchical.mockResolvedValue(null);
        mockSaveAmfeHierarchical.mockResolvedValue(true);
        mockDeleteAmfeHierarchical.mockResolvedValue(true);
        mockIsAmfePathAccessible.mockResolvedValue(true);
        localStorage.clear();
    });

    describe('initialization', () => {
        it('starts with empty state', () => {
            const { result } = renderProjectsHook();
            expect(result.current.currentProject).toBe('');
            expect(result.current.currentProjectRef).toBeNull();
            expect(result.current.clients).toEqual([]);
        });

        it('checks network availability on mount', async () => {
            renderProjectsHook();
            await waitFor(() => expect(mockIsAmfePathAccessible).toHaveBeenCalled());
        });

        it('loads clients when network is available', async () => {
            mockListAmfeClients.mockResolvedValue(['VWA', 'TOYOTA']);
            renderProjectsHook();
            await waitFor(() => expect(mockListAmfeClients).toHaveBeenCalled());
        });

        it('sets networkAvailable to false when path not accessible', async () => {
            mockIsAmfePathAccessible.mockResolvedValue(false);
            const { result } = renderProjectsHook();
            await waitFor(() => expect(result.current.networkAvailable).toBe(false));
        });
    });

    describe('save operations', () => {
        it('saves in place when project has hierarchical ref', async () => {
            const doc = makeDoc();
            const { result } = renderProjectsHook(doc);

            // First load a hierarchical project to set the ref
            mockLoadAmfeHierarchical.mockResolvedValue(doc);
            await act(async () => {
                await result.current.loadHierarchicalProject('VWA', 'PATAGONIA', 'AMFE TOP ROLL');
            });
            expect(result.current.currentProjectRef).toEqual({
                client: 'VWA', project: 'PATAGONIA', name: 'AMFE TOP ROLL'
            });

            // Now save — should save in place
            await act(async () => {
                await result.current.saveCurrentProject();
            });
            expect(mockSaveAmfeHierarchical).toHaveBeenCalledWith(
                'VWA', 'PATAGONIA', 'AMFE TOP ROLL', doc
            );
        });

        it('opens saveAs modal when no hierarchical ref', () => {
            const { result } = renderProjectsHook();

            act(() => {
                result.current.saveCurrentProject();
            });

            expect(result.current.saveAsState.isOpen).toBe(true);
        });

        it('sets saveStatus to saved on hierarchical save success', async () => {
            const doc = makeDoc();
            const { result } = renderProjectsHook(doc);

            // Load a project first
            mockLoadAmfeHierarchical.mockResolvedValue(doc);
            await act(async () => {
                await result.current.loadHierarchicalProject('VWA', 'PATAGONIA', 'Test');
            });

            // Save
            await act(async () => {
                await result.current.saveCurrentProject();
            });
            expect(result.current.saveStatus).toBe('saved');
        });

        it('sets saveStatus to error on hierarchical save failure', async () => {
            mockSaveAmfeHierarchical.mockResolvedValue(false);
            const doc = makeDoc();
            const { result } = renderProjectsHook(doc);

            // Load a project first
            mockLoadAmfeHierarchical.mockResolvedValue(doc);
            await act(async () => {
                await result.current.loadHierarchicalProject('VWA', 'PATAGONIA', 'Test');
            });

            // Save — should fail
            await act(async () => {
                await result.current.saveCurrentProject();
            });
            expect(result.current.saveStatus).toBe('error');
        });

        it('sets saveStatus to error on exception', async () => {
            mockSaveAmfeHierarchical.mockRejectedValue(new Error('Network error'));
            const doc = makeDoc();
            const { result } = renderProjectsHook(doc);

            // Load a project first
            mockLoadAmfeHierarchical.mockResolvedValue(doc);
            await act(async () => {
                await result.current.loadHierarchicalProject('VWA', 'PATAGONIA', 'Test');
            });

            // Save — should error
            await act(async () => {
                await result.current.saveCurrentProject();
            });
            expect(result.current.saveStatus).toBe('error');
        });
    });

    describe('load operations', () => {
        it('loads hierarchical project and sets ref', async () => {
            const projectData = makeDoc({ operations: [{ id: 'op1', opNumber: '10', name: 'Loaded', workElements: [] }] });
            mockLoadAmfeHierarchical.mockResolvedValue(projectData);
            const { result, onLoadProject } = renderProjectsHook();

            await act(async () => {
                await result.current.loadHierarchicalProject('VWA', 'PATAGONIA', 'MyAmfe');
            });

            expect(onLoadProject).toHaveBeenCalledWith(projectData);
            expect(result.current.currentProjectRef).toEqual({
                client: 'VWA', project: 'PATAGONIA', name: 'MyAmfe'
            });
            expect(result.current.currentProject).toBe('MyAmfe');
        });

        it('loads loose file via loadSelectedProject', async () => {
            const projectData = makeDoc({ operations: [{ id: 'op1', opNumber: '10', name: 'Loaded', workElements: [] }] });
            mockLoadAmfe.mockResolvedValue(projectData);
            const { result, onLoadProject } = renderProjectsHook();

            await act(async () => {
                await result.current.loadSelectedProject('MyProject');
            });

            expect(onLoadProject).toHaveBeenCalledWith(projectData);
            expect(result.current.currentProject).toBe('MyProject');
        });

        it('shows error when project fails to load', async () => {
            mockLoadAmfe.mockResolvedValue(null);
            const { result, onLoadProject } = renderProjectsHook();

            await act(async () => {
                await result.current.loadSelectedProject('BadProject');
            });

            expect(onLoadProject).not.toHaveBeenCalled();
            expect(result.current.loadError).toContain('Error');
        });
    });

    describe('delete operations', () => {
        it('deletes loose project after confirmation', async () => {
            const { result, requestConfirm } = renderProjectsHook();
            requestConfirm.mockResolvedValue(true);

            await act(async () => {
                await result.current.deleteSelectedProject('OldProject');
            });

            expect(requestConfirm).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Eliminar Proyecto',
                variant: 'danger',
            }));
            expect(mockDeleteAmfe).toHaveBeenCalledWith('OldProject');
        });

        it('does not delete when confirmation is rejected', async () => {
            const { result, requestConfirm } = renderProjectsHook();
            requestConfirm.mockResolvedValue(false);

            await act(async () => {
                await result.current.deleteSelectedProject('OldProject');
            });

            expect(mockDeleteAmfe).not.toHaveBeenCalled();
        });

        it('deletes hierarchical AMFE after confirmation', async () => {
            const { result, requestConfirm } = renderProjectsHook();
            requestConfirm.mockResolvedValue(true);

            await act(async () => {
                await result.current.deleteHierarchicalProject('VWA', 'PATAGONIA', 'MyAmfe');
            });

            expect(requestConfirm).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Eliminar AMFE',
                variant: 'danger',
            }));
            expect(mockDeleteAmfeHierarchical).toHaveBeenCalledWith('VWA', 'PATAGONIA', 'MyAmfe');
        });
    });

    describe('new project', () => {
        it('resets project state', async () => {
            const { result, onResetProject } = renderProjectsHook();

            await act(async () => {
                await result.current.createNewProject();
            });

            expect(onResetProject).toHaveBeenCalled();
            expect(result.current.currentProject).toBe('');
            expect(result.current.currentProjectRef).toBeNull();
        });
    });

    describe('browser filters', () => {
        it('clears filters when clearFilters is called', () => {
            const { result } = renderProjectsHook();

            act(() => {
                result.current.setSelectedClient('VWA');
            });
            act(() => {
                result.current.clearFilters();
            });

            expect(result.current.selectedClient).toBe('');
            expect(result.current.selectedProject).toBe('');
            expect(result.current.searchQuery).toBe('');
        });

        it('updates searchQuery', () => {
            const { result } = renderProjectsHook();

            act(() => {
                result.current.setSearchQuery('top roll');
            });

            expect(result.current.searchQuery).toBe('top roll');
        });
    });
});
