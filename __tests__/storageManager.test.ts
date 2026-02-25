import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock settingsRepository
const mockGetSetting = vi.fn();
const mockSetSetting = vi.fn();
vi.mock('../utils/repositories/settingsRepository', () => ({
    getSetting: (...args: unknown[]) => mockGetSetting(...args),
    setSetting: (...args: unknown[]) => mockSetSetting(...args),
}));

// Mock dependencies that require Tauri
vi.mock('../utils/unified_fs', () => ({
    isTauri: () => false,
}));

vi.mock('../utils/pathManager', () => ({
    getPathConfig: () => ({ basePath: 'C:\\TestServer\\Barack', dataFolder: 'data' }),
    setPathConfig: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import {
    loadStorageSettings,
    saveStorageSettings,
    isStorageConfigured,
    isSyncRecommended,
    type StorageSettings,
} from '../utils/storageManager';

describe('storageManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('loadStorageSettings', () => {
        it('should return defaults when no settings exist', async () => {
            mockGetSetting.mockResolvedValue(null);

            const settings = await loadStorageSettings();

            expect(settings.storageMode).toBe('shared');
            expect(settings.autoDetectNetwork).toBe(true);
            expect(settings.syncMediaFiles).toBe(false);
            expect(settings.lastSyncTimestamp).toBeNull();
        });

        it('should load stored settings from repository', async () => {
            const stored: StorageSettings = {
                storageMode: 'local',
                localStoragePath: 'C:\\Local\\Path',
                sharedStoragePath: 'C:\\Server\\Path',
                lastSyncTimestamp: 1000,
                autoDetectNetwork: false,
                syncMediaFiles: true,
            };
            mockGetSetting.mockResolvedValue(stored);

            const settings = await loadStorageSettings();

            expect(settings.storageMode).toBe('local');
            expect(settings.localStoragePath).toBe('C:\\Local\\Path');
            expect(settings.sharedStoragePath).toBe('C:\\Server\\Path');
            expect(settings.lastSyncTimestamp).toBe(1000);
            expect(settings.autoDetectNetwork).toBe(false);
            expect(settings.syncMediaFiles).toBe(true);
        });

        it('should return defaults if repository throws', async () => {
            mockGetSetting.mockRejectedValue(new Error('DB error'));

            const settings = await loadStorageSettings();
            expect(settings.storageMode).toBe('shared');
        });
    });

    describe('saveStorageSettings', () => {
        it('should save settings to repository', async () => {
            mockSetSetting.mockResolvedValue(undefined);

            const settings: StorageSettings = {
                storageMode: 'local',
                localStoragePath: 'C:\\Test',
                sharedStoragePath: 'C:\\Server',
                lastSyncTimestamp: Date.now(),
                autoDetectNetwork: true,
                syncMediaFiles: false,
            };

            const result = await saveStorageSettings(settings);
            expect(result).toBe(true);
            expect(mockSetSetting).toHaveBeenCalledWith('storage_settings', settings);
        });

        it('should return false if saving fails', async () => {
            mockSetSetting.mockRejectedValue(new Error('DB error'));

            const settings: StorageSettings = {
                storageMode: 'local',
                localStoragePath: null,
                sharedStoragePath: null,
                lastSyncTimestamp: null,
                autoDetectNetwork: true,
                syncMediaFiles: false,
            };

            const result = await saveStorageSettings(settings);
            expect(result).toBe(false);
        });
    });

    describe('isStorageConfigured', () => {
        it('should return false when no settings exist', async () => {
            mockGetSetting.mockResolvedValue(null);
            const result = await isStorageConfigured();
            expect(result).toBe(false);
        });

        it('should return true when settings exist', async () => {
            mockGetSetting.mockResolvedValue({ storageMode: 'shared' });
            const result = await isStorageConfigured();
            expect(result).toBe(true);
        });
    });

    describe('isSyncRecommended', () => {
        it('should recommend sync when never synced', async () => {
            const settings: StorageSettings = {
                storageMode: 'shared',
                localStoragePath: null,
                sharedStoragePath: null,
                lastSyncTimestamp: null,
                autoDetectNetwork: true,
                syncMediaFiles: false,
            };
            mockGetSetting.mockResolvedValue(settings);

            const result = await isSyncRecommended();
            expect(result).toBe(true);
        });

        it('should recommend sync when last sync > 24 hours ago', async () => {
            const settings: StorageSettings = {
                storageMode: 'shared',
                localStoragePath: null,
                sharedStoragePath: null,
                lastSyncTimestamp: Date.now() - (25 * 60 * 60 * 1000),
                autoDetectNetwork: true,
                syncMediaFiles: false,
            };
            mockGetSetting.mockResolvedValue(settings);

            const result = await isSyncRecommended();
            expect(result).toBe(true);
        });

        it('should NOT recommend sync when last sync < 24 hours ago', async () => {
            const settings: StorageSettings = {
                storageMode: 'shared',
                localStoragePath: null,
                sharedStoragePath: null,
                lastSyncTimestamp: Date.now() - (1 * 60 * 60 * 1000),
                autoDetectNetwork: true,
                syncMediaFiles: false,
            };
            mockGetSetting.mockResolvedValue(settings);

            const result = await isSyncRecommended();
            expect(result).toBe(false);
        });
    });

    describe('round-trip persistence', () => {
        it('should save and load settings consistently', async () => {
            const original: StorageSettings = {
                storageMode: 'local',
                localStoragePath: 'C:\\Users\\Test\\Documents\\Barack_Mercosul_Data',
                sharedStoragePath: 'S:\\Shared\\Barack',
                lastSyncTimestamp: 1700000000000,
                autoDetectNetwork: false,
                syncMediaFiles: true,
            };

            // Mock save to succeed, then load returns what was saved
            mockSetSetting.mockResolvedValue(undefined);
            await saveStorageSettings(original);

            mockGetSetting.mockResolvedValue(original);
            const loaded = await loadStorageSettings();

            expect(loaded.storageMode).toBe(original.storageMode);
            expect(loaded.localStoragePath).toBe(original.localStoragePath);
            expect(loaded.sharedStoragePath).toBe(original.sharedStoragePath);
            expect(loaded.lastSyncTimestamp).toBe(original.lastSyncTimestamp);
            expect(loaded.autoDetectNetwork).toBe(original.autoDetectNetwork);
            expect(loaded.syncMediaFiles).toBe(original.syncMediaFiles);
        });
    });
});
