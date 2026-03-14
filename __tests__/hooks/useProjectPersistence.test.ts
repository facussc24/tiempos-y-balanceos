import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ============================================================================
// MOCKS — Must be declared before importing the hook under test
// ============================================================================

const mockSaveProject = vi.fn().mockResolvedValue(1);
const mockLoadProject = vi.fn().mockResolvedValue(null);
const mockListProjects = vi.fn().mockResolvedValue([]);

vi.mock('../../utils/repositories/projectRepository', () => ({
    saveProject: (...args: unknown[]) => mockSaveProject(...args),
    loadProject: (...args: unknown[]) => mockLoadProject(...args),
    listProjects: (...args: unknown[]) => mockListProjects(...args),
}));

vi.mock('../../utils/unified_fs', () => ({
    initFileSystem: vi.fn().mockResolvedValue(undefined),
    isTauri: () => false,
    getAppInfo: () => ({ mode: 'web', version: '1.0.0' }),
    readTextFile: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../utils/concurrency', () => ({
    SaveConflict: class {},
    ConflictError: class extends Error {
        conflict = {};
    },
}));

vi.mock('../../components/ui/Toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('../../utils/logger', () => ({
    logger: {
        info: (...args: unknown[]) => mockLoggerInfo(...args),
        warn: (...args: unknown[]) => mockLoggerWarn(...args),
        error: (...args: unknown[]) => mockLoggerError(...args),
        debug: vi.fn(),
    },
}));

import { useProjectPersistence } from '../../hooks/useProjectPersistence';
import { INITIAL_PROJECT, ProjectData } from '../../types';

// ============================================================================
// HELPERS
// ============================================================================

function makeRealProject(overrides: Partial<ProjectData> = {}): ProjectData {
    return {
        ...INITIAL_PROJECT,
        id: 42,
        meta: {
            ...INITIAL_PROJECT.meta,
            name: 'Real User Project',
            client: 'ACME Corp',
            version: 'Rev A',
        },
        ...overrides,
    };
}

// ============================================================================
// TESTS — P0-3: Auto-save guard to prevent overwriting with INITIAL_PROJECT
// ============================================================================

describe('useProjectPersistence – P0-3 auto-save guards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: false });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // --------------------------------------------------------------------------
    // Test 1: auto-save does NOT run when hasLoadedRealData is false
    // --------------------------------------------------------------------------
    it('does NOT auto-save when loadLatestProject fails (hasLoadedRealData=false)', async () => {
        // loadLatestProject will fail: listProjects returns items but loadProject returns null
        mockListProjects.mockResolvedValue([{ id: 1, name: 'Test', updated_at: '2026-01-01' }]);
        mockLoadProject.mockResolvedValue(null);

        const { result } = renderHook(() => useProjectPersistence());

        // Wait for initialization to complete
        await act(async () => {
            // Flush the init effect's async work
            await vi.runAllTimersAsync();
        });

        // Verify the hook initialized (isDbLoaded becomes true)
        expect(result.current.isDbLoaded).toBe(true);

        // Data should still be INITIAL_PROJECT since load failed
        expect(result.current.data.meta.name).toBe('Nuevo Proyecto');

        // Now advance past auto-save debounce (2 seconds) + mount guard (3 seconds)
        await act(async () => {
            vi.advanceTimersByTime(6000);
            await vi.runAllTimersAsync();
        });

        // saveProject should NOT have been called by auto-save
        // (it might be called 0 times — the key assertion is that INITIAL_PROJECT was never auto-saved)
        expect(mockSaveProject).not.toHaveBeenCalled();
    });

    // --------------------------------------------------------------------------
    // Test 2: auto-save does NOT run in the first 3 seconds after mount
    // --------------------------------------------------------------------------
    it('does NOT auto-save within the first 3 seconds even with real data loaded', async () => {
        // loadLatestProject will succeed
        const realProject = makeRealProject();
        mockListProjects.mockResolvedValue([{ id: 42, name: 'Real User Project', updated_at: '2026-01-01' }]);
        mockLoadProject.mockResolvedValue(realProject);

        const { result } = renderHook(() => useProjectPersistence());

        // Wait for initialization
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        expect(result.current.isDbLoaded).toBe(true);
        expect(result.current.data.meta.name).toBe('Real User Project');

        // Clear the mock to isolate auto-save calls from any init calls
        mockSaveProject.mockClear();

        // Trigger a data change to fire the auto-save effect
        await act(async () => {
            result.current.setData(prev => ({ ...prev, meta: { ...prev.meta, name: 'Modified' } }));
        });

        // Advance 2.5 seconds (past auto-save debounce but within 3-second mount guard)
        // Note: the mount guard uses Date.now() which is controlled by fake timers
        // Since we haven't advanced 3 seconds total from mount, auto-save should be blocked
        await act(async () => {
            vi.advanceTimersByTime(2500);
            await vi.runAllTimersAsync();
        });

        // Auto-save should NOT have fired due to the 3-second mount guard
        expect(mockSaveProject).not.toHaveBeenCalled();
    });

    // --------------------------------------------------------------------------
    // Test 3: auto-save DOES run after loading real data + past 3 seconds
    // --------------------------------------------------------------------------
    it('auto-saves after real data is loaded and mount guard expires', async () => {
        const realProject = makeRealProject();
        mockListProjects.mockResolvedValue([{ id: 42, name: 'Real User Project', updated_at: '2026-01-01' }]);
        mockLoadProject.mockResolvedValue(realProject);
        mockSaveProject.mockResolvedValue(42);

        const { result } = renderHook(() => useProjectPersistence());

        // Wait for initialization to complete
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        expect(result.current.isDbLoaded).toBe(true);
        expect(result.current.data.meta.name).toBe('Real User Project');

        // Clear mock to isolate auto-save calls
        mockSaveProject.mockClear();

        // Advance past the 3-second mount guard
        await act(async () => {
            vi.advanceTimersByTime(3100);
        });

        // Now trigger a data change to fire auto-save
        await act(async () => {
            result.current.setData(prev => ({ ...prev, meta: { ...prev.meta, name: 'User Edit' } }));
        });

        // Advance past the 2-second auto-save debounce
        await act(async () => {
            vi.advanceTimersByTime(2100);
            await vi.runAllTimersAsync();
        });

        // Now auto-save SHOULD have been called
        expect(mockSaveProject).toHaveBeenCalledTimes(1);
        // Verify it was called with the updated data (not INITIAL_PROJECT)
        const savedData = mockSaveProject.mock.calls[0][0] as ProjectData;
        expect(savedData.meta.name).toBe('User Edit');
    });

    // --------------------------------------------------------------------------
    // Test 4: loadLatestProject failure does NOT trigger auto-save
    // --------------------------------------------------------------------------
    it('does NOT trigger auto-save when loadLatestProject throws an error', async () => {
        // listProjects throws an exception
        mockListProjects.mockRejectedValue(new Error('DB connection failed'));

        const { result } = renderHook(() => useProjectPersistence());

        // Wait for initialization
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        // Hook should have initialized despite the error
        expect(result.current.isDbLoaded).toBe(true);
        // Data stays as INITIAL_PROJECT
        expect(result.current.data.meta.name).toBe('Nuevo Proyecto');

        // The error should have been logged
        expect(mockLoggerError).toHaveBeenCalledWith(
            'Persistence',
            'Failed to load latest project - auto-save DISABLED until explicit user action',
            expect.objectContaining({ error: expect.stringContaining('DB connection failed') })
        );

        // Advance well past all timers
        await act(async () => {
            vi.advanceTimersByTime(10000);
            await vi.runAllTimersAsync();
        });

        // saveProject should NOT have been called — auto-save is disabled
        expect(mockSaveProject).not.toHaveBeenCalled();
    });

    // --------------------------------------------------------------------------
    // Test 5: setData from external caller enables auto-save (user creates project)
    // --------------------------------------------------------------------------
    it('enables auto-save when external caller uses setData (new project)', async () => {
        // No projects in DB (first use)
        mockListProjects.mockResolvedValue([]);
        mockSaveProject.mockResolvedValue(1);

        const { result } = renderHook(() => useProjectPersistence());

        // Wait for initialization
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        expect(result.current.isDbLoaded).toBe(true);
        mockSaveProject.mockClear();

        // Advance past mount guard
        await act(async () => {
            vi.advanceTimersByTime(3100);
        });

        // User explicitly creates a new project via setData (exposed wrapper enables hasLoadedRealData)
        const newProject = makeRealProject({ id: undefined });
        await act(async () => {
            result.current.setData(newProject);
        });

        // Advance past auto-save debounce
        await act(async () => {
            vi.advanceTimersByTime(2100);
            await vi.runAllTimersAsync();
        });

        // Auto-save should now work because setData (the safe wrapper) enabled hasLoadedRealData
        expect(mockSaveProject).toHaveBeenCalledTimes(1);
        const savedData = mockSaveProject.mock.calls[0][0] as ProjectData;
        expect(savedData.meta.name).toBe('Real User Project');
    });

    // --------------------------------------------------------------------------
    // Test 6: loadLatestProject logs error when projects exist but load fails
    // --------------------------------------------------------------------------
    it('logs specific error when projects exist but loadProject returns null', async () => {
        mockListProjects.mockResolvedValue([{ id: 99, name: 'Corrupted', updated_at: '2026-01-01' }]);
        mockLoadProject.mockResolvedValue(null); // Simulates data corruption

        renderHook(() => useProjectPersistence());

        // Wait for initialization
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        // Should have logged the specific error about failed load
        expect(mockLoggerError).toHaveBeenCalledWith(
            'Persistence',
            'Failed to load latest project - auto-save DISABLED until explicit user action'
        );
    });

    // --------------------------------------------------------------------------
    // Test 7: First use with no projects logs info, not error
    // --------------------------------------------------------------------------
    it('logs info (not error) when no projects exist yet', async () => {
        mockListProjects.mockResolvedValue([]); // No projects at all

        renderHook(() => useProjectPersistence());

        // Wait for initialization
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        // Should log info, not error
        expect(mockLoggerInfo).toHaveBeenCalledWith(
            'Persistence',
            'No existing projects found - awaiting explicit user action'
        );
    });
});
