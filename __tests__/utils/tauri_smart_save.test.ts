import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks - must be declared before imports
// ---------------------------------------------------------------------------

const mockWriteTextFile = vi.fn<(path: string, content: string) => Promise<boolean>>();
const mockReadTextFile = vi.fn<(path: string) => Promise<string | null>>();
const mockRename = vi.fn<(from: string, to: string) => Promise<boolean>>();
const mockRemove = vi.fn<(path: string) => Promise<boolean>>();
const mockExists = vi.fn<(path: string) => Promise<boolean>>();
const mockEnsureDir = vi.fn<(path: string) => Promise<boolean>>();
const mockIsTauri = vi.fn<() => boolean>();

vi.mock('../../utils/tauri_fs', () => ({
    writeTextFile: (...args: Parameters<typeof mockWriteTextFile>) => mockWriteTextFile(...args),
    readTextFile: (...args: Parameters<typeof mockReadTextFile>) => mockReadTextFile(...args),
    rename: (...args: Parameters<typeof mockRename>) => mockRename(...args),
    remove: (...args: Parameters<typeof mockRemove>) => mockRemove(...args),
    exists: (...args: Parameters<typeof mockExists>) => mockExists(...args),
    ensureDir: (...args: Parameters<typeof mockEnsureDir>) => mockEnsureDir(...args),
    isTauri: () => mockIsTauri(),
}));

vi.mock('../../utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../utils/crypto', () => ({
    generateChecksum: vi.fn().mockResolvedValue('mock-checksum-abc123'),
}));

vi.mock('../../utils/networkUtils', () => ({
    normalizePath: (p: string) => p.replace(/\//g, '\\'),
    joinPath: (...segments: string[]) => segments.filter(Boolean).join('\\'),
    getFilename: (p: string) => {
        const last = p.lastIndexOf('\\');
        return last >= 0 ? p.substring(last + 1) : p;
    },
    classifyError: (err: unknown) => ({
        isTransient: false,
        isPermanent: true,
        isLockError: false,
        isPermissionError: false,
        isNetworkError: false,
        isNetworkPathError: false,
        code: null,
        message: err instanceof Error ? err.message : String(err),
        userMessage: 'Error desconocido',
    }),
    withSmartRetry: async <T>(fn: () => Promise<T>) => fn(),
    LockHeartbeat: class {
        start() { /* noop */ }
        stop() { /* noop */ }
    },
}));

vi.mock('../../types', () => ({}));
vi.mock('../../utils', () => ({
    incrementVersion: (v: string) => {
        const parts = v.split('.');
        const last = parseInt(parts[parts.length - 1] || '0', 10);
        parts[parts.length - 1] = String(last + 1);
        return parts.join('.');
    },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { withTimeout, quickSaveTauri } from '../../utils/tauri_smart_save';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal valid ProjectData for testing quickSaveTauri
 */
function makeProjectData(overrides: Record<string, unknown> = {}) {
    return {
        meta: { name: 'Test', version: '1.0.0', description: '', created: Date.now() },
        operations: [],
        config: {},
        lastModified: Date.now(),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Storage mocks (sessionStorage / localStorage)
// ---------------------------------------------------------------------------

const sessionStorageData: Record<string, string> = {};
const localStorageData: Record<string, string> = {};

const mockSessionStorage = {
    getItem: (key: string) => sessionStorageData[key] ?? null,
    setItem: (key: string, value: string) => { sessionStorageData[key] = value; },
    removeItem: (key: string) => { delete sessionStorageData[key]; },
    clear: () => { Object.keys(sessionStorageData).forEach(k => delete sessionStorageData[k]); },
    get length() { return Object.keys(sessionStorageData).length; },
    key: (_i: number) => null as string | null,
};

const mockLocalStorage = {
    getItem: (key: string) => localStorageData[key] ?? null,
    setItem: (key: string, value: string) => { localStorageData[key] = value; },
    removeItem: (key: string) => { delete localStorageData[key]; },
    clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); },
    get length() { return Object.keys(localStorageData).length; },
    key: (_i: number) => null as string | null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tauri_smart_save', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        sessionStorageData['_machine_id'] = 'test_machine_001';
        localStorageData['_current_user'] = 'TestUser';

        // Default: all FS operations succeed
        mockWriteTextFile.mockResolvedValue(true);
        mockReadTextFile.mockResolvedValue(null);
        mockRename.mockResolvedValue(true);
        mockRemove.mockResolvedValue(true);
        mockExists.mockResolvedValue(true);
        mockEnsureDir.mockResolvedValue(true);
        mockIsTauri.mockReturnValue(true);

        // Provide storage mocks
        vi.stubGlobal('sessionStorage', mockSessionStorage);
        vi.stubGlobal('localStorage', mockLocalStorage);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        mockSessionStorage.clear();
        mockLocalStorage.clear();
    });

    // =========================================================================
    // withTimeout
    // =========================================================================

    describe('withTimeout', () => {
        it('resolves if promise completes before timeout', async () => {
            const result = await withTimeout(
                Promise.resolve('ok'),
                5000,
                'test-op'
            );
            expect(result).toBe('ok');
        });

        it('rejects with timeout error if promise exceeds timeout', async () => {
            const neverResolves = new Promise<string>(() => {
                // intentionally never resolves
            });

            const promise = withTimeout(neverResolves, 100, 'slow-op');

            // Advance time past the timeout
            vi.advanceTimersByTime(150);

            await expect(promise).rejects.toThrow('slow-op timed out after 100ms');
        });

        it('rejects with original error if promise rejects before timeout', async () => {
            const failing = Promise.reject(new Error('original error'));

            await expect(
                withTimeout(failing, 5000, 'test-op')
            ).rejects.toThrow('original error');
        });

        it('includes operation name and duration in timeout message', async () => {
            const neverResolves = new Promise<string>(() => {});
            const promise = withTimeout(neverResolves, 30000, 'Write temp file');

            vi.advanceTimersByTime(30001);

            await expect(promise).rejects.toThrow('Write temp file timed out after 30000ms');
        });
    });

    // =========================================================================
    // quickSaveTauri - web stub (no-op)
    // =========================================================================

    describe('quickSaveTauri', () => {
        it('returns false in web mode (no-op stub)', async () => {
            const data = makeProjectData();
            const result = await quickSaveTauri('C:\\projects\\test.json', data as never);
            expect(result).toBe(false);
        });

        it('does not call any filesystem functions in web mode', async () => {
            const data = makeProjectData();
            await quickSaveTauri('C:\\projects\\test.json', data as never);
            expect(mockWriteTextFile).not.toHaveBeenCalled();
            expect(mockRename).not.toHaveBeenCalled();
            expect(mockRemove).not.toHaveBeenCalled();
        });
    });
});
