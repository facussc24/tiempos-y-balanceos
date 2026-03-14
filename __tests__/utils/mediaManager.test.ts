/**
 * Tests for utils/mediaManager.ts — Media scanning, migration, and dual-location loading
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock tauri_fs
const mockIsTauri = vi.fn(() => true);
const mockGetProjectsDir = vi.fn();
const mockReadDir = vi.fn();
const mockExists = vi.fn();
const mockReadTextFile = vi.fn();
const mockReadBinaryFile = vi.fn();
const mockWriteBinaryFile = vi.fn();
const mockCopyFile = vi.fn();
const mockEnsureDir = vi.fn();
const mockRemove = vi.fn();
const mockSaveMediaFile = vi.fn();
const mockLoadMediaFile = vi.fn();

vi.mock('../../utils/tauri_fs', () => ({
    isTauri: () => mockIsTauri(),
    getProjectsDir: () => mockGetProjectsDir(),
    readDir: (p: string) => mockReadDir(p),
    exists: (p: string) => mockExists(p),
    readTextFile: (p: string) => mockReadTextFile(p),
    readBinaryFile: (p: string) => mockReadBinaryFile(p),
    writeBinaryFile: (p: string, c: Uint8Array) => mockWriteBinaryFile(p, c),
    copyFile: (from: string, to: string) => mockCopyFile(from, to),
    ensureDir: (p: string) => mockEnsureDir(p),
    remove: (p: string) => mockRemove(p),
    saveMediaFile: (pid: string, tid: string, f: File) => mockSaveMediaFile(pid, tid, f),
    loadMediaFile: (pid: string, ref: string) => mockLoadMediaFile(pid, ref),
}));

// Mock pathManager
vi.mock('../../utils/pathManager', () => ({
    buildPath: (type: string, client: string, project: string, part: string, filename?: string) =>
        `Y:\\Software\\02_MEDIA\\${client}\\${project}\\${part}${filename ? '\\' + filename : ''}`,
}));

// Mock storageManager
const mockIsServerAvailable = vi.fn();
vi.mock('../../utils/storageManager', () => ({
    isServerAvailable: () => mockIsServerAvailable(),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
    logger: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import {
    scanLocalMedia,
    countLocalMediaFiles,
    buildMigrationPlan,
    migrateMediaToServer,
    loadMedia,
    saveMedia,
} from '../../utils/mediaManager';

beforeEach(() => {
    vi.resetAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockGetProjectsDir.mockResolvedValue('/appdata/projects');
    mockEnsureDir.mockResolvedValue(true);
});

// ============================================================================
// scanLocalMedia
// ============================================================================

describe('scanLocalMedia', () => {
    it('returns empty array when not Tauri', async () => {
        mockIsTauri.mockReturnValue(false);
        expect(await scanLocalMedia()).toEqual([]);
    });

    it('returns empty array when no projects dir', async () => {
        mockGetProjectsDir.mockResolvedValue(null);
        expect(await scanLocalMedia()).toEqual([]);
    });

    it('returns empty array when no projects have media', async () => {
        mockReadDir.mockResolvedValueOnce([
            { name: 'proj1', path: '/appdata/projects/proj1', isDirectory: true },
        ]);
        mockExists.mockResolvedValueOnce(false); // media dir doesn't exist
        expect(await scanLocalMedia()).toEqual([]);
    });

    it('scans media files from projects with valid metadata', async () => {
        mockReadDir
            .mockResolvedValueOnce([ // projects list
                { name: 'proj1', path: '/appdata/projects/proj1', isDirectory: true },
            ])
            .mockResolvedValueOnce([ // media files
                { name: 'task1_123.mp4', path: '/appdata/projects/proj1/media/task1_123.mp4', isDirectory: false },
            ]);
        mockExists.mockResolvedValueOnce(true); // media dir exists
        mockReadTextFile.mockResolvedValueOnce(JSON.stringify({
            meta: { name: 'APB_TRASERO', client: 'VWA', project: 'PATAGONIA' },
        }));

        const results = await scanLocalMedia();
        expect(results).toHaveLength(1);
        expect(results[0]).toEqual(expect.objectContaining({
            projectId: 'proj1',
            client: 'VWA',
            project: 'PATAGONIA',
            filename: 'task1_123.mp4',
            mediaRef: 'media/task1_123.mp4',
            extension: 'mp4',
        }));
    });

    it('skips projects without client metadata', async () => {
        mockReadDir
            .mockResolvedValueOnce([
                { name: 'proj1', path: '/appdata/projects/proj1', isDirectory: true },
            ])
            .mockResolvedValueOnce([
                { name: 'file.jpg', path: '/appdata/projects/proj1/media/file.jpg', isDirectory: false },
            ]);
        mockExists.mockResolvedValueOnce(true);
        mockReadTextFile.mockResolvedValueOnce(JSON.stringify({
            meta: { name: 'Test', client: '' }, // empty client
        }));

        expect(await scanLocalMedia()).toEqual([]);
    });

    it('skips projects with invalid JSON', async () => {
        mockReadDir.mockResolvedValueOnce([
            { name: 'proj1', path: '/appdata/projects/proj1', isDirectory: true },
        ]);
        mockExists.mockResolvedValueOnce(true);
        mockReadTextFile.mockResolvedValueOnce('not json');

        expect(await scanLocalMedia()).toEqual([]);
    });

    it('skips files with unsafe filenames (path traversal)', async () => {
        mockReadDir
            .mockResolvedValueOnce([
                { name: 'proj1', path: '/appdata/projects/proj1', isDirectory: true },
            ])
            .mockResolvedValueOnce([
                { name: '..', path: '/appdata/projects/proj1/media/..', isDirectory: false },
                { name: 'safe.mp4', path: '/appdata/projects/proj1/media/safe.mp4', isDirectory: false },
                { name: '..\\etc\\passwd', path: '/appdata/projects/proj1/media/..\\etc\\passwd', isDirectory: false },
            ]);
        mockExists.mockResolvedValueOnce(true);
        mockReadTextFile.mockResolvedValueOnce(JSON.stringify({
            meta: { name: 'APB', client: 'VWA', project: 'PAT' },
        }));

        const results = await scanLocalMedia();
        expect(results).toHaveLength(1);
        expect(results[0].filename).toBe('safe.mp4');
    });
});

// ============================================================================
// countLocalMediaFiles
// ============================================================================

describe('countLocalMediaFiles', () => {
    it('returns 0 when not Tauri', async () => {
        mockIsTauri.mockReturnValue(false);
        expect(await countLocalMediaFiles()).toBe(0);
    });

    it('counts files across multiple projects (with valid metadata)', async () => {
        const validMeta = JSON.stringify({ meta: { name: 'APB', client: 'VWA' } });
        mockReadDir
            .mockResolvedValueOnce([ // /appdata/projects
                { name: 'p1', path: '/appdata/projects/p1', isDirectory: true },
                { name: 'p2', path: '/appdata/projects/p2', isDirectory: true },
            ])
            .mockResolvedValueOnce([ // p1/media
                { name: 'a.mp4', path: '/p1/media/a.mp4', isDirectory: false },
                { name: 'b.jpg', path: '/p1/media/b.jpg', isDirectory: false },
            ])
            .mockResolvedValueOnce([ // p2/media
                { name: 'c.png', path: '/p2/media/c.png', isDirectory: false },
            ]);
        mockExists.mockResolvedValue(true); // all media dirs exist
        mockReadTextFile.mockResolvedValue(validMeta); // both projects have client

        expect(await countLocalMediaFiles()).toBe(3);
    });

    it('skips projects without client metadata', async () => {
        mockReadDir
            .mockResolvedValueOnce([
                { name: 'p1', path: '/appdata/projects/p1', isDirectory: true },
            ])
            .mockResolvedValueOnce([
                { name: 'a.mp4', path: '/p1/media/a.mp4', isDirectory: false },
            ]);
        mockExists.mockResolvedValue(true);
        mockReadTextFile.mockResolvedValueOnce(JSON.stringify({ meta: { name: 'Test', client: '' } }));

        expect(await countLocalMediaFiles()).toBe(0);
    });

    it('returns 0 when no media dirs exist', async () => {
        mockReadDir.mockResolvedValueOnce([
            { name: 'p1', path: '/p1', isDirectory: true },
        ]);
        mockExists.mockResolvedValueOnce(false);

        expect(await countLocalMediaFiles()).toBe(0);
    });
});

// ============================================================================
// buildMigrationPlan
// ============================================================================

describe('buildMigrationPlan', () => {
    it('maps local files to server destinations', async () => {
        const files = [{
            projectId: 'p1', projectName: 'APB', client: 'VWA', project: 'PATAGONIA',
            part: 'APB_TRASERO', filename: 'task1_123.mp4', localPath: '/local/task1_123.mp4',
            mediaRef: 'media/task1_123.mp4', extension: 'mp4',
        }];

        const plan = await buildMigrationPlan(files);
        expect(plan).toHaveLength(1);
        expect(plan[0].serverDestination).toBe('Y:\\Software\\02_MEDIA\\VWA\\PATAGONIA\\APB_TRASERO\\task1_123.mp4');
        expect(plan[0].status).toBe('pending');
    });

    it('handles empty file list', async () => {
        expect(await buildMigrationPlan([])).toEqual([]);
    });
});

// ============================================================================
// migrateMediaToServer
// ============================================================================

describe('migrateMediaToServer', () => {
    const makeItem = (filename: string) => ({
        localFile: {
            projectId: 'p1', projectName: 'APB', client: 'VWA', project: 'PAT',
            part: 'APB', filename, localPath: `/local/${filename}`,
            mediaRef: `media/${filename}`, extension: 'mp4',
        },
        serverDestination: `Y:\\02_MEDIA\\VWA\\PAT\\APB\\${filename}`,
        status: 'pending' as const,
    });

    it('returns server unavailable error when offline', async () => {
        mockIsServerAvailable.mockResolvedValue(false);
        const result = await migrateMediaToServer([makeItem('a.mp4')], false);
        expect(result.failed).toBe(1);
        expect(result.errors[0].error).toContain('Servidor no disponible');
    });

    it('migrates files successfully and returns updatedItems', async () => {
        mockIsServerAvailable.mockResolvedValue(true);
        mockCopyFile.mockResolvedValue(true);
        mockExists
            .mockResolvedValueOnce(false) // alreadyExists check: not on server
            .mockResolvedValueOnce(true); // verify after copy

        const input = [makeItem('a.mp4')];
        const result = await migrateMediaToServer(input, false);
        expect(result.migrated).toBe(1);
        expect(result.failed).toBe(0);
        expect(mockCopyFile).toHaveBeenCalled();
        // Does NOT mutate original items
        expect(input[0].status).toBe('pending');
        // Returns cloned items with updated status
        expect(result.updatedItems[0].status).toBe('done');
    });

    it('skips copy for files already on server', async () => {
        mockIsServerAvailable.mockResolvedValue(true);
        mockExists.mockResolvedValueOnce(true); // alreadyExists check: on server

        const result = await migrateMediaToServer([makeItem('a.mp4')], false);
        expect(result.migrated).toBe(1);
        expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it('deletes local even when file already on server', async () => {
        mockIsServerAvailable.mockResolvedValue(true);
        mockRemove.mockResolvedValue(true);
        mockExists.mockResolvedValueOnce(true); // already on server

        await migrateMediaToServer([makeItem('a.mp4')], true);
        expect(mockRemove).toHaveBeenCalledWith('/local/a.mp4');
        expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it('deletes local files when requested', async () => {
        mockIsServerAvailable.mockResolvedValue(true);
        mockCopyFile.mockResolvedValue(true);
        mockRemove.mockResolvedValue(true);
        mockExists
            .mockResolvedValueOnce(false) // alreadyExists: not on server
            .mockResolvedValueOnce(true); // verify after copy

        await migrateMediaToServer([makeItem('a.mp4')], true);
        expect(mockRemove).toHaveBeenCalledWith('/local/a.mp4');
    });

    it('does not delete local files when not requested', async () => {
        mockIsServerAvailable.mockResolvedValue(true);
        mockCopyFile.mockResolvedValue(true);
        mockExists
            .mockResolvedValueOnce(false) // alreadyExists
            .mockResolvedValueOnce(true); // verify

        await migrateMediaToServer([makeItem('a.mp4')], false);
        expect(mockRemove).not.toHaveBeenCalled();
    });

    it('handles copy failure gracefully', async () => {
        mockIsServerAvailable.mockResolvedValue(true);
        mockExists.mockResolvedValueOnce(false); // not on server
        mockCopyFile.mockResolvedValue(false);

        const result = await migrateMediaToServer([makeItem('a.mp4')], false);
        expect(result.failed).toBe(1);
        expect(result.errors[0].file).toBe('a.mp4');
    });

    it('reports progress', async () => {
        mockIsServerAvailable.mockResolvedValue(true);
        mockExists.mockResolvedValue(true); // already on server (skip)

        const progressCalls: any[] = [];
        await migrateMediaToServer([makeItem('a.mp4')], false, (p) => progressCalls.push({ ...p }));

        expect(progressCalls.length).toBeGreaterThan(0);
        expect(progressCalls[progressCalls.length - 1].phase).toBe('complete');
    });

    it('continues after partial failure', async () => {
        mockIsServerAvailable.mockResolvedValue(true);
        mockExists
            .mockResolvedValueOnce(false) // file1: not on server
            .mockResolvedValueOnce(true); // file2: already on server
        mockCopyFile.mockRejectedValueOnce(new Error('network error'));

        const result = await migrateMediaToServer(
            [makeItem('fail.mp4'), makeItem('ok.mp4')],
            false
        );
        expect(result.migrated).toBe(1);
        expect(result.failed).toBe(1);
    });
});

// ============================================================================
// loadMedia
// ============================================================================

describe('loadMedia', () => {
    it('returns null when not Tauri', async () => {
        mockIsTauri.mockReturnValue(false);
        expect(await loadMedia('p1', 'media/file.mp4')).toBeNull();
    });

    it('returns null for empty mediaRef', async () => {
        expect(await loadMedia('p1', '')).toBeNull();
    });

    it('returns local file when available', async () => {
        mockLoadMediaFile.mockResolvedValue('blob:http://local/123');
        const result = await loadMedia('p1', 'media/file.mp4');
        expect(result).toBe('blob:http://local/123');
        expect(mockLoadMediaFile).toHaveBeenCalledWith('p1', 'media/file.mp4');
    });

    it('falls back to server when local is null', async () => {
        mockLoadMediaFile.mockResolvedValue(null);
        mockReadTextFile.mockResolvedValue(JSON.stringify({
            meta: { name: 'APB', client: 'VWA', project: 'PAT' },
        }));
        const fakeContent = new Uint8Array([0xFF, 0xD8, 0xFF]);
        mockReadBinaryFile.mockResolvedValue(fakeContent);

        // Mock URL.createObjectURL for jsdom
        const mockUrl = 'blob:http://localhost/fake-uuid';
        globalThis.URL.createObjectURL = vi.fn(() => mockUrl);

        const result = await loadMedia('p1', 'media/photo.jpg');
        expect(result).toBe(mockUrl);
        expect(mockReadBinaryFile).toHaveBeenCalled();
    });

    it('returns null when both local and server fail', async () => {
        mockLoadMediaFile.mockResolvedValue(null);
        mockReadTextFile.mockResolvedValue(null); // no data.json
        expect(await loadMedia('p1', 'media/file.mp4')).toBeNull();
    });
});

// ============================================================================
// saveMedia
// ============================================================================

describe('saveMedia', () => {
    const fakeFile = new File(['test'], 'video.mp4', { type: 'video/mp4' });

    it('returns null when not Tauri', async () => {
        mockIsTauri.mockReturnValue(false);
        expect(await saveMedia('p1', 't1', fakeFile)).toBeNull();
    });

    it('saves locally and returns ref', async () => {
        mockSaveMediaFile.mockResolvedValue('media/t1_123.mp4');

        const result = await saveMedia('p1', 't1', fakeFile);
        expect(result).toEqual({ localRef: 'media/t1_123.mp4', savedToServer: false });
    });

    it('returns null when local save fails', async () => {
        mockSaveMediaFile.mockResolvedValue(null);
        expect(await saveMedia('p1', 't1', fakeFile)).toBeNull();
    });

    it('copies to server when available and meta provided', async () => {
        mockSaveMediaFile.mockResolvedValue('media/t1_123.mp4');
        mockIsServerAvailable.mockResolvedValue(true);
        mockCopyFile.mockResolvedValue(true);

        const result = await saveMedia('p1', 't1', fakeFile, {
            client: 'VWA', project: 'PAT', name: 'APB',
        });

        expect(result?.savedToServer).toBe(true);
        expect(mockCopyFile).toHaveBeenCalled();
    });

    it('still returns local ref when server copy fails', async () => {
        mockSaveMediaFile.mockResolvedValue('media/t1_123.mp4');
        mockIsServerAvailable.mockResolvedValue(true);
        mockCopyFile.mockRejectedValue(new Error('network error'));

        const result = await saveMedia('p1', 't1', fakeFile, {
            client: 'VWA', name: 'APB',
        });

        expect(result?.localRef).toBe('media/t1_123.mp4');
        expect(result?.savedToServer).toBe(false);
    });

    it('skips server copy when no meta provided', async () => {
        mockSaveMediaFile.mockResolvedValue('media/t1_123.mp4');

        const result = await saveMedia('p1', 't1', fakeFile);
        expect(result?.savedToServer).toBe(false);
        expect(mockIsServerAvailable).not.toHaveBeenCalled();
    });
});
