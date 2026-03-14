/**
 * Tests for engineeringServerManager.ts (web-safe stub version)
 *
 * In web mode all filesystem-dependent functions return safe defaults
 * (false / [] / null) without calling any filesystem APIs.
 *
 * Covers: getEngineeringBasePath, isEngineeringServerAvailable,
 *         ensureEngineeringStructure, listEngineeringFiles, readManualHtml
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../utils/networkUtils', () => ({
    normalizePath: vi.fn((p: string) => p.replace(/\//g, '\\')),
    joinPath: vi.fn((...parts: string[]) => parts.join('\\')),
}));

vi.mock('../../../utils/repositories/settingsRepository', () => ({
    loadAppSettings: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { normalizePath } from '../../../utils/networkUtils';
import { loadAppSettings } from '../../../utils/repositories/settingsRepository';
import {
    getEngineeringBasePath,
    isEngineeringServerAvailable,
    ensureEngineeringStructure,
    listEngineeringFiles,
    readManualHtml,
} from '../../../modules/engineering/engineeringServerManager';
import { DEFAULT_ENGINEERING_BASE_PATH } from '../../../modules/engineering/engineeringTypes';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    (loadAppSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        engineeringBasePath: null,
    });
});

// ---------------------------------------------------------------------------
// getEngineeringBasePath
// ---------------------------------------------------------------------------

describe('getEngineeringBasePath', () => {
    it('returns default when setting is null', async () => {
        (loadAppSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
            engineeringBasePath: null,
        });
        const result = await getEngineeringBasePath();
        expect(normalizePath).toHaveBeenCalledWith(DEFAULT_ENGINEERING_BASE_PATH);
        expect(result).toBe(DEFAULT_ENGINEERING_BASE_PATH.replace(/\//g, '\\'));
    });

    it('returns configured path when set', async () => {
        (loadAppSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
            engineeringBasePath: 'Z:\\CustomPath',
        });
        const result = await getEngineeringBasePath();
        expect(normalizePath).toHaveBeenCalledWith('Z:\\CustomPath');
        expect(result).toBe('Z:\\CustomPath');
    });

    it('returns default when loadAppSettings throws', async () => {
        (loadAppSettings as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));
        const result = await getEngineeringBasePath();
        expect(result).toBe(DEFAULT_ENGINEERING_BASE_PATH.replace(/\//g, '\\'));
    });
});

// ---------------------------------------------------------------------------
// isEngineeringServerAvailable — always false in web-safe mode
// ---------------------------------------------------------------------------

describe('isEngineeringServerAvailable', () => {
    it('always returns false in web mode (no filesystem access)', async () => {
        const result = await isEngineeringServerAvailable();
        expect(result).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// ensureEngineeringStructure — always false in web-safe mode
// ---------------------------------------------------------------------------

describe('ensureEngineeringStructure', () => {
    it('always returns false in web mode (no filesystem access)', async () => {
        const result = await ensureEngineeringStructure();
        expect(result).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// listEngineeringFiles — always empty array in web-safe mode
// ---------------------------------------------------------------------------

describe('listEngineeringFiles', () => {
    it('returns empty array in web mode (no filesystem access)', async () => {
        const result = await listEngineeringFiles('Manuales');
        expect(result).toEqual([]);
    });

    it('returns empty array for any subdirectory', async () => {
        const result = await listEngineeringFiles('Formatos Estandar');
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// readManualHtml — always null in web-safe mode
// ---------------------------------------------------------------------------

describe('readManualHtml', () => {
    it('returns null in web mode (no filesystem access)', async () => {
        const result = await readManualHtml('test.html');
        expect(result).toBeNull();
    });

    it('returns null for any filename', async () => {
        const result = await readManualHtml('missing.html');
        expect(result).toBeNull();
    });
});
