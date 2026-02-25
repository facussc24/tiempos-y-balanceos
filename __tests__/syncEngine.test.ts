import { describe, it, expect, vi } from 'vitest';
import type { SyncItem, SyncDirection, ConflictResolution } from '../utils/syncEngine';

// Mock all Tauri-dependent imports before importing syncEngine
vi.mock('../utils/unified_fs', () => ({
    isTauri: () => false,
}));

vi.mock('../utils/storageManager', () => ({
    loadStorageSettings: vi.fn().mockResolvedValue({
        storageMode: 'shared',
        localStoragePath: 'C:\\Local',
        sharedStoragePath: 'C:\\Server',
        lastSyncTimestamp: null,
        autoDetectNetwork: true,
        syncMediaFiles: false,
    }),
    isPathAccessible: vi.fn().mockResolvedValue(false),
    updateLastSyncTimestamp: vi.fn().mockResolvedValue(true),
}));

vi.mock('../utils/pathManager', () => ({
    getPathConfig: () => ({ basePath: 'C:\\Server\\Barack', dataFolder: 'data' }),
}));

vi.mock('../utils/crypto', () => ({
    generateChecksum: vi.fn().mockResolvedValue('mock-checksum'),
}));

vi.mock('../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('syncEngine types and logic', () => {
    it('should define valid SyncItem structure', () => {
        const item: SyncItem = {
            id: 'TestClient/TestProject/TestPart',
            client: 'TestClient',
            project: 'TestProject',
            part: 'TestPart',
            localPath: 'C:\\Local\\data\\TestClient\\TestProject\\TestPart',
            serverPath: 'C:\\Server\\data\\TestClient\\TestProject\\TestPart',
            status: 'pending',
        };

        expect(item.id).toBe('TestClient/TestProject/TestPart');
        expect(item.status).toBe('pending');
    });

    it('should define valid sync statuses', () => {
        const statuses = ['pending', 'syncing', 'synced', 'conflict', 'error'] as const;
        statuses.forEach(status => {
            const item: SyncItem = {
                id: 'test',
                client: 'c',
                project: 'p',
                part: 'pt',
                localPath: '',
                serverPath: '',
                status,
            };
            expect(item.status).toBe(status);
        });
    });

    it('should define valid conflict resolutions', () => {
        const resolutions: ConflictResolution[] = ['keepLocal', 'keepServer', 'createCopy', 'skip'];
        expect(resolutions).toHaveLength(4);
    });

    it('should define valid sync directions', () => {
        const directions: SyncDirection[] = ['toLocal', 'toServer', 'bidirectional'];
        expect(directions).toHaveLength(3);
    });

    it('should handle sync items with checksum data', () => {
        const item: SyncItem = {
            id: 'Client/Project/Part',
            client: 'Client',
            project: 'Project',
            part: 'Part',
            localPath: 'C:\\Local\\data\\Client\\Project\\Part',
            serverPath: 'C:\\Server\\data\\Client\\Project\\Part',
            status: 'conflict',
            localModified: 1700000000000,
            serverModified: 1700000001000,
            localChecksum: 'abc123',
            serverChecksum: 'def456',
        };

        expect(item.localChecksum).not.toBe(item.serverChecksum);
        expect(item.status).toBe('conflict');
    });

    it('should handle items that exist only locally', () => {
        const item: SyncItem = {
            id: 'Client/NewProject/Part',
            client: 'Client',
            project: 'NewProject',
            part: 'Part',
            localPath: 'C:\\Local\\data\\Client\\NewProject\\Part',
            serverPath: '',
            status: 'pending',
            localModified: Date.now(),
        };

        expect(item.serverPath).toBe('');
        expect(item.serverModified).toBeUndefined();
    });

    it('should handle items that exist only on server', () => {
        const item: SyncItem = {
            id: 'Client/ServerOnly/Part',
            client: 'Client',
            project: 'ServerOnly',
            part: 'Part',
            localPath: '',
            serverPath: 'C:\\Server\\data\\Client\\ServerOnly\\Part',
            status: 'pending',
            serverModified: Date.now(),
        };

        expect(item.localPath).toBe('');
        expect(item.localModified).toBeUndefined();
    });
});

describe('syncEngine - syncProject', () => {
    it('should import syncProject successfully', async () => {
        const { syncProject } = await import('../utils/syncEngine');
        expect(typeof syncProject).toBe('function');
    });

    it('should succeed for already-synced items', async () => {
        const { syncProject } = await import('../utils/syncEngine');

        const syncedItem: SyncItem = {
            id: 'test/project/part',
            client: 'test',
            project: 'project',
            part: 'part',
            localPath: 'C:\\Local\\test',
            serverPath: 'C:\\Server\\test',
            status: 'synced',
        };

        const result = await syncProject(syncedItem, 'bidirectional');
        expect(result.success).toBe(true);
    });

    it('should fail for conflicts without resolution', async () => {
        const { syncProject } = await import('../utils/syncEngine');

        const conflictItem: SyncItem = {
            id: 'test/project/part',
            client: 'test',
            project: 'project',
            part: 'part',
            localPath: 'C:\\Local\\test',
            serverPath: 'C:\\Server\\test',
            status: 'conflict',
        };

        const result = await syncProject(conflictItem, 'bidirectional');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Conflict requires resolution');
    });

    it('should succeed for conflicts with skip resolution', async () => {
        const { syncProject } = await import('../utils/syncEngine');

        const conflictItem: SyncItem = {
            id: 'test/project/part',
            client: 'test',
            project: 'project',
            part: 'part',
            localPath: 'C:\\Local\\test',
            serverPath: 'C:\\Server\\test',
            status: 'conflict',
        };

        const result = await syncProject(conflictItem, 'bidirectional', 'skip');
        expect(result.success).toBe(true);
    });

    it('should handle no-op for local-only items when direction is toLocal', async () => {
        const { syncProject } = await import('../utils/syncEngine');

        const localOnlyItem: SyncItem = {
            id: 'test/project/part',
            client: 'test',
            project: 'project',
            part: 'part',
            localPath: 'C:\\Local\\test',
            serverPath: '',
            status: 'pending',
        };

        const result = await syncProject(localOnlyItem, 'toLocal');
        expect(result.success).toBe(true); // Nothing to do
    });

    it('should handle no-op for server-only items when direction is toServer', async () => {
        const { syncProject } = await import('../utils/syncEngine');

        const serverOnlyItem: SyncItem = {
            id: 'test/project/part',
            client: 'test',
            project: 'project',
            part: 'part',
            localPath: '',
            serverPath: 'C:\\Server\\test',
            status: 'pending',
        };

        const result = await syncProject(serverOnlyItem, 'toServer');
        expect(result.success).toBe(true); // Nothing to do
    });
});

describe('syncEngine - getSyncStatus', () => {
    it('should import getSyncStatus successfully', async () => {
        const { getSyncStatus } = await import('../utils/syncEngine');
        expect(typeof getSyncStatus).toBe('function');
    });
});

describe('syncEngine - needsSync', () => {
    it('should import needsSync successfully', async () => {
        const { needsSync } = await import('../utils/syncEngine');
        expect(typeof needsSync).toBe('function');
    });

    it('should return false in non-Tauri environment', async () => {
        const { needsSync } = await import('../utils/syncEngine');
        const result = await needsSync();
        expect(result).toBe(false);
    });
});
